package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.service.ArchivoPropiedadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Fotos y documentos de las propiedades.
 *  - /api/propiedades/{id}/...  → solo AGENTE / ADMIN (ya cubierto por SecurityConfig).
 *  - /api/archivos/fotos/...    → público: es la URL con la que el sitio muestra las fotos.
 */
@RestController
public class ArchivoPropiedadController {

    @Autowired
    private ArchivoPropiedadService service;

    // ── Fotos (panel) ──
    @GetMapping("/api/propiedades/{id}/fotos")
    public List<Map<String, Object>> fotos(@PathVariable Integer id) { return service.listarFotos(id); }

    @PostMapping(value = "/api/propiedades/{id}/fotos/archivos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public List<Map<String, Object>> subirFotos(@PathVariable Integer id, @RequestParam("archivos") List<MultipartFile> archivos) {
        return service.subirFotos(id, archivos);
    }

    @PutMapping("/api/propiedades/{id}/fotos/{idImagen}/principal")
    public List<Map<String, Object>> principal(@PathVariable Integer id, @PathVariable Integer idImagen) {
        return service.hacerPrincipal(id, idImagen);
    }

    @DeleteMapping("/api/propiedades/{id}/fotos/{idImagen}")
    public List<Map<String, Object>> eliminarFoto(@PathVariable Integer id, @PathVariable Integer idImagen) {
        return service.eliminarFoto(id, idImagen);
    }

    // ── Foto publicada (sin login) ──
    @GetMapping("/api/archivos/fotos/{id}/{nombre}")
    public ResponseEntity<Resource> verFoto(@PathVariable Integer id, @PathVariable String nombre) {
        Path ruta = service.rutaDeFoto(id, nombre);
        String n = nombre.toLowerCase();
        MediaType tipo = n.endsWith(".png") ? MediaType.IMAGE_PNG
                : n.endsWith(".gif") ? MediaType.IMAGE_GIF
                : n.endsWith(".webp") ? MediaType.parseMediaType("image/webp")
                : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(tipo)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(ruta));
    }

    // ── Documentos PDF (panel) ──
    @GetMapping("/api/propiedades/{id}/documentos")
    public List<Map<String, Object>> documentos(@PathVariable Integer id) { return service.listarDocumentos(id); }

    @PostMapping(value = "/api/propiedades/{id}/documentos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> subirDocumento(@PathVariable Integer id,
                                              @RequestParam("archivo") MultipartFile archivo,
                                              @RequestParam(value = "tipo", required = false) String tipo,
                                              @RequestParam(value = "descripcion", required = false) String descripcion) {
        return service.subirDocumento(id, archivo, tipo, descripcion);
    }

    @GetMapping("/api/propiedades/{id}/documentos/{idDoc}/archivo")
    public ResponseEntity<Resource> abrirDocumento(@PathVariable Integer id, @PathVariable Integer idDoc) {
        ArchivoPropiedadService.ArchivoEnDisco a = service.abrirDocumento(id, idDoc);
        String nombre = a.nombre().toLowerCase().endsWith(".pdf") ? a.nombre() : a.nombre() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(nombre, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(new FileSystemResource(a.ruta()));
    }

    @DeleteMapping("/api/propiedades/{id}/documentos/{idDoc}")
    public ResponseEntity<Void> eliminarDocumento(@PathVariable Integer id, @PathVariable Integer idDoc) {
        service.eliminarDocumento(id, idDoc);
        return ResponseEntity.noContent().build();
    }
}
