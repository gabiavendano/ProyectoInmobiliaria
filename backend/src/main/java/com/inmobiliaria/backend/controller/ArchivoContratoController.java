package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.service.ArchivoContratoService;
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
import java.util.List;
import java.util.Map;

/** Documentos PDF de las operaciones. /api/contratos/** ya exige AGENTE o ADMIN (SecurityConfig). */
@RestController
public class ArchivoContratoController {

    @Autowired
    private ArchivoContratoService service;

    @GetMapping("/api/contratos/{id}/documentos")
    public List<Map<String, Object>> listar(@PathVariable Integer id) { return service.listar(id); }

    @PostMapping(value = "/api/contratos/{id}/documentos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> subir(@PathVariable Integer id,
                                     @RequestParam("archivo") MultipartFile archivo,
                                     @RequestParam(value = "tipo", required = false) String tipo,
                                     @RequestParam(value = "descripcion", required = false) String descripcion) {
        return service.subir(id, archivo, tipo, descripcion);
    }

    @GetMapping("/api/contratos/{id}/documentos/{idDoc}/archivo")
    public ResponseEntity<Resource> abrir(@PathVariable Integer id, @PathVariable Integer idDoc) {
        ArchivoContratoService.ArchivoEnDisco a = service.abrir(id, idDoc);
        String nombre = a.nombre().toLowerCase().endsWith(".pdf") ? a.nombre() : a.nombre() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(nombre, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(new FileSystemResource(a.ruta()));
    }

    @DeleteMapping("/api/contratos/{id}/documentos/{idDoc}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id, @PathVariable Integer idDoc) {
        service.eliminar(id, idDoc);
        return ResponseEntity.noContent().build();
    }
}
