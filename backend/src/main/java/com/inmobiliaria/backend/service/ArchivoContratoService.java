package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.model.DocumentoAdjunto;
import com.inmobiliaria.backend.repository.ContratoRepository;
import com.inmobiliaria.backend.repository.DocumentoAdjuntoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Documentos PDF de una operación / contrato (DNI, garantías, escritura, contrato firmado...).
 * Se guardan en disco (carpeta "uploads/contratos/{id}/docs") y en la base queda el nombre y la ruta.
 * Solo PDF (se comprueba el contenido real), hasta 15 MB cada uno, máximo 30 por operación. Son privados.
 */
@Service
public class ArchivoContratoService {

    public static final long MAX_PDF = 15L * 1024 * 1024;
    public static final int MAX_DOCS = 30;
    private static final Set<String> TIPOS = Set.of("DNI", "Garantía", "Escritura", "Contrato firmado", "Reserva", "Comprobante", "Otro");

    @Value("${app.uploads.dir:uploads}")
    private String dirConfigurado;

    @Autowired private ContratoRepository contratos;
    @Autowired private DocumentoAdjuntoRepository docs;

    public record ArchivoEnDisco(Path ruta, String nombre) {}

    private Path base() { return Paths.get(dirConfigurado).toAbsolutePath().normalize(); }
    private Path carpeta(Integer id) { return base().resolve("contratos").resolve(String.valueOf(id)).resolve("docs").normalize(); }

    private ContratoOperacion buscar(Integer id) {
        return contratos.findById(id).orElseThrow(() -> new IllegalArgumentException("Operación no encontrada"));
    }

    private static String limpiarNombre(String original) {
        String n = original == null ? "archivo" : original;
        int i = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
        if (i >= 0) n = n.substring(i + 1);
        n = n.replaceAll("[\\p{Cntrl}]", "").trim();
        if (n.isEmpty()) n = "archivo";
        return n.length() > 200 ? n.substring(0, 200) : n;
    }

    private static boolean esPdf(MultipartFile f) throws IOException {
        byte[] h = new byte[5];
        try (InputStream in = f.getInputStream()) {
            int n = in.readNBytes(h, 0, 5);
            return n == 5 && h[0] == '%' && h[1] == 'P' && h[2] == 'D' && h[3] == 'F' && h[4] == '-';
        }
    }

    private static void borrarSilencioso(Path p) {
        try { Files.deleteIfExists(p); } catch (IOException ignorado) { /* queda suelto */ }
    }

    private static Map<String, Object> comoMapa(DocumentoAdjunto d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("idDocumento", d.getIdDocumento());
        m.put("nombre", d.getNombreOriginal());
        m.put("tipo", d.getTipoArchivo());
        m.put("descripcion", d.getDescripcion());
        m.put("fecha", d.getFechaSubida());
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listar(Integer id) {
        buscar(id);
        return docs.findByContratoIdOperacionOrderByFechaSubidaDesc(id).stream().map(ArchivoContratoService::comoMapa).toList();
    }

    @Transactional
    public Map<String, Object> subir(Integer id, MultipartFile f, String tipo, String descripcion) {
        ContratoOperacion c = buscar(id);
        if (f == null || f.isEmpty()) throw new IllegalArgumentException("No se recibió ningún documento");
        String nombreOriginal = limpiarNombre(f.getOriginalFilename());
        if (f.getSize() > MAX_PDF) throw new IllegalArgumentException("El documento \"" + nombreOriginal + "\" supera los 15 MB");
        String t = tipo == null || tipo.isBlank() ? "Otro" : tipo.trim();
        if (!TIPOS.contains(t)) throw new IllegalArgumentException("Tipo de documento inválido");
        String desc = descripcion == null ? null : descripcion.trim();
        if (desc != null && desc.isEmpty()) desc = null;
        if (desc != null && desc.length() > 255) throw new IllegalArgumentException("La descripción es demasiado larga (máximo 255 caracteres)");
        if (docs.findByContratoIdOperacionOrderByFechaSubidaDesc(id).size() >= MAX_DOCS)
            throw new IllegalArgumentException("Una operación puede tener hasta " + MAX_DOCS + " documentos");

        Path destino = null;
        try {
            if (!esPdf(f)) throw new IllegalArgumentException("\"" + nombreOriginal + "\" no es un PDF válido");
            Path dir = carpeta(id);
            Files.createDirectories(dir);
            String nombre = UUID.randomUUID().toString().replace("-", "") + ".pdf";
            destino = dir.resolve(nombre).normalize();
            try (InputStream in = f.getInputStream()) { Files.copy(in, destino); }

            DocumentoAdjunto d = new DocumentoAdjunto();
            d.setContrato(c);
            d.setNombreOriginal(nombreOriginal);
            d.setTipoArchivo(t);
            d.setRutaAlmacenamiento("contratos/" + id + "/docs/" + nombre);
            d.setDescripcion(desc);
            d.setFechaSubida(LocalDateTime.now());
            return comoMapa(docs.saveAndFlush(d));
        } catch (IOException e) {
            if (destino != null) borrarSilencioso(destino);
            throw new IllegalStateException("No se pudo guardar el documento en el servidor");
        } catch (RuntimeException e) {
            if (destino != null) borrarSilencioso(destino);
            throw e;
        }
    }

    private DocumentoAdjunto docDe(Integer id, Integer idDoc) {
        DocumentoAdjunto d = docs.findById(idDoc).orElseThrow(() -> new IllegalArgumentException("Documento no encontrado"));
        if (d.getContrato() == null || !id.equals(d.getContrato().getIdOperacion()))
            throw new IllegalArgumentException("Documento no encontrado");
        return d;
    }

    private Path rutaSegura(Integer id, DocumentoAdjunto d) {
        Path permitido = base().resolve("contratos").resolve(String.valueOf(id)).normalize();
        Path f = base().resolve(d.getRutaAlmacenamiento()).normalize();
        if (!f.startsWith(permitido)) throw new IllegalArgumentException("Documento no encontrado");
        return f;
    }

    @Transactional(readOnly = true)
    public ArchivoEnDisco abrir(Integer id, Integer idDoc) {
        DocumentoAdjunto d = docDe(id, idDoc);
        Path f = rutaSegura(id, d);
        if (!Files.isRegularFile(f)) throw new IllegalArgumentException("El archivo ya no está en el servidor");
        return new ArchivoEnDisco(f, d.getNombreOriginal());
    }

    @Transactional
    public void eliminar(Integer id, Integer idDoc) {
        DocumentoAdjunto d = docDe(id, idDoc);
        Path f = rutaSegura(id, d);
        docs.delete(d);
        docs.flush();
        borrarSilencioso(f);
    }
}
