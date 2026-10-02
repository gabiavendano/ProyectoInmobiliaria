package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.DocumentoAdjunto;
import com.inmobiliaria.backend.model.ImagenPropiedad;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.repository.DocumentoAdjuntoRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Fotos y documentos PDF de las propiedades, guardados en disco (carpeta "uploads" junto al backend,
 * o la que indique app.uploads.dir). En la base solo queda el nombre/ruta.
 *
 *  - Fotos: JPG, PNG, WEBP o GIF, hasta 10 MB cada una, máximo 20 por propiedad. Se publican (URL pública).
 *  - Documentos: solo PDF, hasta 15 MB, máximo 30 por propiedad. Son privados (solo personal logueado).
 * El tipo de archivo se comprueba por su contenido real, no por la extensión ni por lo que diga el navegador.
 */
@Service
public class ArchivoPropiedadService {

    public static final long MAX_FOTO = 10L * 1024 * 1024;
    public static final long MAX_PDF = 15L * 1024 * 1024;
    public static final int MAX_FOTOS = 20;
    public static final int MAX_DOCS = 30;
    private static final String PREFIJO_URL_FOTO = "/api/archivos/fotos/";
    private static final Pattern NOMBRE_SEGURO = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$");
    private static final Set<String> TIPOS_DOC = Set.of("Escritura", "Plano", "Informe de dominio", "Recibo", "Otro");

    @Value("${app.uploads.dir:uploads}")
    private String dirConfigurado;

    @Autowired
    private PropiedadRepository propiedades;

    @Autowired
    private DocumentoAdjuntoRepository docs;

    public record ArchivoEnDisco(Path ruta, String nombre) {}

    private Path base() { return Paths.get(dirConfigurado).toAbsolutePath().normalize(); }

    private Path carpeta(Integer idPropiedad, String sub) {
        return base().resolve("propiedades").resolve(String.valueOf(idPropiedad)).resolve(sub).normalize();
    }

    private Propiedad buscar(Integer id) {
        return propiedades.findById(id).orElseThrow(() -> new NoSuchElementException("Propiedad no encontrada"));
    }

    private static String limpiarNombre(String original) {
        String n = original == null ? "archivo" : original;
        int i = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
        if (i >= 0) n = n.substring(i + 1);
        n = n.replaceAll("[\\p{Cntrl}]", "").trim();
        if (n.isEmpty()) n = "archivo";
        return n.length() > 200 ? n.substring(0, 200) : n;
    }

    private static byte[] cabecera(MultipartFile f) throws IOException {
        byte[] h = new byte[16];
        try (InputStream in = f.getInputStream()) {
            int n = in.readNBytes(h, 0, 16);
            if (n < 16) { byte[] c = new byte[n]; System.arraycopy(h, 0, c, 0, n); return c; }
        }
        return h;
    }

    private static String extensionDeFoto(byte[] h) {
        int n = h.length;
        if (n >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) return "jpg";
        if (n >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return "png";
        if (n >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8') return "gif";
        if (n >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }

    private static boolean esPdf(byte[] h) {
        return h.length >= 5 && h[0] == '%' && h[1] == 'P' && h[2] == 'D' && h[3] == 'F' && h[4] == '-';
    }

    private static void borrarSilencioso(Path p) {
        try { Files.deleteIfExists(p); } catch (IOException ignorado) { /* si no se puede borrar, queda el archivo suelto */ }
    }

    private static void borrarCarpeta(Path dir) {
        if (!Files.exists(dir)) return;
        try (Stream<Path> s = Files.walk(dir)) {
            s.sorted(Comparator.reverseOrder()).forEach(ArchivoPropiedadService::borrarSilencioso);
        } catch (IOException ignorado) { /* idem */ }
    }

    // ───────────────────────────── FOTOS ─────────────────────────────

    private List<Map<String, Object>> comoLista(Propiedad p) {
        List<Map<String, Object>> out = new ArrayList<>();
        p.getImagenes().stream()
                .sorted(Comparator.comparing((ImagenPropiedad i) -> i.getOrdenAparicion() == null ? 0 : i.getOrdenAparicion()))
                .forEach(i -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("idImagen", i.getIdImagen());
                    m.put("url", i.getUrlImagen());
                    m.put("principal", Boolean.TRUE.equals(i.getEsFotoPrincipal()));
                    out.add(m);
                });
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listarFotos(Integer id) {
        return comoLista(buscar(id));
    }

    @Transactional
    public List<Map<String, Object>> subirFotos(Integer id, List<MultipartFile> archivos) {
        Propiedad p = buscar(id);
        List<MultipartFile> validos = archivos == null ? List.of() : archivos.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (validos.isEmpty()) throw new IllegalArgumentException("No se recibió ninguna foto");
        if (p.getImagenes().size() + validos.size() > MAX_FOTOS)
            throw new IllegalArgumentException("Una propiedad puede tener hasta " + MAX_FOTOS + " fotos (ya tiene " + p.getImagenes().size() + ")");

        Path dir = carpeta(id, "fotos");
        List<Path> creados = new ArrayList<>();
        try {
            Files.createDirectories(dir);
            int orden = p.getImagenes().stream().map(i -> i.getOrdenAparicion() == null ? 0 : i.getOrdenAparicion()).max(Integer::compare).orElse(0);
            boolean hayPrincipal = p.getImagenes().stream().anyMatch(i -> Boolean.TRUE.equals(i.getEsFotoPrincipal()));
            for (MultipartFile f : validos) {
                String nombreOriginal = limpiarNombre(f.getOriginalFilename());
                if (f.getSize() > MAX_FOTO)
                    throw new IllegalArgumentException("La foto \"" + nombreOriginal + "\" supera los 10 MB");
                String ext = extensionDeFoto(cabecera(f));
                if (ext == null)
                    throw new IllegalArgumentException("\"" + nombreOriginal + "\" no es una imagen válida (se aceptan JPG, PNG, WEBP o GIF)");
                String nombre = UUID.randomUUID().toString().replace("-", "") + "." + ext;
                Path destino = dir.resolve(nombre).normalize();
                try (InputStream in = f.getInputStream()) { Files.copy(in, destino); }
                creados.add(destino);

                ImagenPropiedad img = new ImagenPropiedad();
                img.setPropiedad(p);
                img.setUrlImagen(PREFIJO_URL_FOTO + id + "/" + nombre);
                img.setEsFotoPrincipal(!hayPrincipal);
                hayPrincipal = true;
                img.setOrdenAparicion(++orden);
                p.getImagenes().add(img);
            }
            propiedades.saveAndFlush(p);
        } catch (IOException e) {
            creados.forEach(ArchivoPropiedadService::borrarSilencioso);
            throw new IllegalStateException("No se pudieron guardar las fotos en el servidor");
        } catch (RuntimeException e) {
            creados.forEach(ArchivoPropiedadService::borrarSilencioso);
            throw e;
        }
        return comoLista(p);
    }

    @Transactional
    public List<Map<String, Object>> eliminarFoto(Integer id, Integer idImagen) {
        Propiedad p = buscar(id);
        ImagenPropiedad img = p.getImagenes().stream().filter(i -> idImagen.equals(i.getIdImagen())).findFirst()
                .orElseThrow(() -> new NoSuchElementException("Foto no encontrada"));
        boolean eraPrincipal = Boolean.TRUE.equals(img.getEsFotoPrincipal());
        p.getImagenes().remove(img);
        if (eraPrincipal) {
            p.getImagenes().stream()
                    .min(Comparator.comparing((ImagenPropiedad i) -> i.getOrdenAparicion() == null ? 0 : i.getOrdenAparicion()))
                    .ifPresent(i -> i.setEsFotoPrincipal(true));
        }
        propiedades.saveAndFlush(p);
        String url = img.getUrlImagen() == null ? "" : img.getUrlImagen();
        String prefijo = PREFIJO_URL_FOTO + id + "/";
        if (url.startsWith(prefijo)) {
            String nombre = url.substring(prefijo.length());
            if (NOMBRE_SEGURO.matcher(nombre).matches()) borrarSilencioso(carpeta(id, "fotos").resolve(nombre).normalize());
        }
        return comoLista(p);
    }

    @Transactional
    public List<Map<String, Object>> hacerPrincipal(Integer id, Integer idImagen) {
        Propiedad p = buscar(id);
        if (p.getImagenes().stream().noneMatch(i -> idImagen.equals(i.getIdImagen())))
            throw new NoSuchElementException("Foto no encontrada");
        // la principal pasa al primer lugar
        int orden = 1;
        for (ImagenPropiedad i : p.getImagenes()) {
            boolean es = idImagen.equals(i.getIdImagen());
            i.setEsFotoPrincipal(es);
            if (es) i.setOrdenAparicion(0);
        }
        List<ImagenPropiedad> resto = p.getImagenes().stream().filter(i -> !idImagen.equals(i.getIdImagen()))
                .sorted(Comparator.comparing((ImagenPropiedad i) -> i.getOrdenAparicion() == null ? 0 : i.getOrdenAparicion())).toList();
        for (ImagenPropiedad i : resto) i.setOrdenAparicion(orden++);
        propiedades.saveAndFlush(p);
        return comoLista(p);
    }

    /** Ruta de una foto publicada (para servirla). Solo nombres seguros dentro de la carpeta de la propiedad. */
    public Path rutaDeFoto(Integer id, String nombre) {
        if (nombre == null || !NOMBRE_SEGURO.matcher(nombre).matches()) throw new NoSuchElementException("Foto no encontrada");
        Path dir = carpeta(id, "fotos");
        Path f = dir.resolve(nombre).normalize();
        if (!f.startsWith(dir) || !Files.isRegularFile(f)) throw new NoSuchElementException("Foto no encontrada");
        return f;
    }

    // ───────────────────────────── DOCUMENTOS (PDF) ─────────────────────────────

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
    public List<Map<String, Object>> listarDocumentos(Integer id) {
        buscar(id);
        return docs.findByPropiedadIdPropiedadOrderByFechaSubidaDesc(id).stream().map(ArchivoPropiedadService::comoMapa).toList();
    }

    @Transactional
    public Map<String, Object> subirDocumento(Integer id, MultipartFile f, String tipo, String descripcion) {
        Propiedad p = buscar(id);
        if (f == null || f.isEmpty()) throw new IllegalArgumentException("No se recibió ningún documento");
        String nombreOriginal = limpiarNombre(f.getOriginalFilename());
        if (f.getSize() > MAX_PDF) throw new IllegalArgumentException("El documento \"" + nombreOriginal + "\" supera los 15 MB");
        String t = tipo == null || tipo.isBlank() ? "Otro" : tipo.trim();
        if (!TIPOS_DOC.contains(t)) throw new IllegalArgumentException("Tipo de documento inválido");
        String desc = descripcion == null ? null : descripcion.trim();
        if (desc != null && desc.isEmpty()) desc = null;
        if (desc != null && desc.length() > 255) throw new IllegalArgumentException("La descripción es demasiado larga (máximo 255 caracteres)");
        if (docs.findByPropiedadIdPropiedadOrderByFechaSubidaDesc(id).size() >= MAX_DOCS)
            throw new IllegalArgumentException("Una propiedad puede tener hasta " + MAX_DOCS + " documentos");

        Path destino = null;
        try {
            if (!esPdf(cabecera(f))) throw new IllegalArgumentException("\"" + nombreOriginal + "\" no es un PDF válido");
            Path dir = carpeta(id, "docs");
            Files.createDirectories(dir);
            String nombre = UUID.randomUUID().toString().replace("-", "") + ".pdf";
            destino = dir.resolve(nombre).normalize();
            try (InputStream in = f.getInputStream()) { Files.copy(in, destino); }

            DocumentoAdjunto d = new DocumentoAdjunto();
            d.setPropiedad(p);
            d.setNombreOriginal(nombreOriginal);
            d.setTipoArchivo(t);
            d.setRutaAlmacenamiento("propiedades/" + id + "/docs/" + nombre);
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
        DocumentoAdjunto d = docs.findById(idDoc).orElseThrow(() -> new NoSuchElementException("Documento no encontrado"));
        if (d.getPropiedad() == null || !id.equals(d.getPropiedad().getIdPropiedad()))
            throw new NoSuchElementException("Documento no encontrado");
        return d;
    }

    private Path rutaSegura(Integer id, DocumentoAdjunto d) {
        Path permitido = base().resolve("propiedades").resolve(String.valueOf(id)).normalize();
        Path f = base().resolve(d.getRutaAlmacenamiento()).normalize();
        if (!f.startsWith(permitido)) throw new NoSuchElementException("Documento no encontrado");
        return f;
    }

    @Transactional(readOnly = true)
    public ArchivoEnDisco abrirDocumento(Integer id, Integer idDoc) {
        DocumentoAdjunto d = docDe(id, idDoc);
        Path f = rutaSegura(id, d);
        if (!Files.isRegularFile(f)) throw new NoSuchElementException("El archivo ya no está en el servidor");
        return new ArchivoEnDisco(f, d.getNombreOriginal());
    }

    @Transactional
    public void eliminarDocumento(Integer id, Integer idDoc) {
        DocumentoAdjunto d = docDe(id, idDoc);
        Path f = rutaSegura(id, d);
        docs.delete(d);
        docs.flush();
        borrarSilencioso(f);
    }

    // ───────────────────────────── BORRADO DE LA PROPIEDAD ─────────────────────────────

    /** Borra la propiedad con sus documentos; los archivos del disco se borran solo si la base lo permitió. */
    @Transactional
    public void eliminarPropiedadConArchivos(Integer id) {
        docs.deleteAll(docs.findByPropiedadIdPropiedadOrderByFechaSubidaDesc(id));
        propiedades.deleteById(id);
        propiedades.flush();
        borrarCarpeta(base().resolve("propiedades").resolve(String.valueOf(id)).normalize());
    }
}
