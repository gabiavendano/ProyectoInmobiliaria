package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.DocumentoAdjunto;
import com.inmobiliaria.backend.service.DocumentoAdjuntoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documentos")
@CrossOrigin(origins = "http://localhost:5173")
public class DocumentoAdjuntoController {

    @Autowired
    private DocumentoAdjuntoService service;

    @GetMapping("/contrato/{id}")
    public List<DocumentoAdjunto> listarPorContrato(@PathVariable Integer id) {
        return service.listarPorContrato(id);
    }

    @GetMapping("/propiedad/{id}")
    public List<DocumentoAdjunto> listarPorPropiedad(@PathVariable Integer id) {
        return service.listarPorPropiedad(id);
    }

    @PostMapping
    public DocumentoAdjunto crear(@RequestBody DocumentoAdjunto d) {
        return service.guardar(d);
    }

    @PostMapping("/crear")
    public ResponseEntity<?> crearDocumento(@RequestBody Map<String, Object> data) {
        try {
            Integer idOperacion = data.get("idOperacion") != null
                ? Integer.parseInt(data.get("idOperacion").toString()) : null;
            Integer idPropiedad = data.get("idPropiedad") != null
                ? Integer.parseInt(data.get("idPropiedad").toString()) : null;
            String nombreOriginal = (String) data.get("nombreOriginal");
            String tipoArchivo = (String) data.get("tipoArchivo");
            String rutaAlmacenamiento = (String) data.get("rutaAlmacenamiento");
            String descripcion = (String) data.get("descripcion");

            DocumentoAdjunto d = service.crearDocumento(
                idOperacion, idPropiedad, nombreOriginal,
                tipoArchivo, rutaAlmacenamiento, descripcion);
            return ResponseEntity.ok(d);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
