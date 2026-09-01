package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.service.PropiedadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/propiedades")
@CrossOrigin(origins = "http://localhost:5173")
public class PropiedadController {

    @Autowired
    private PropiedadService service;

    @GetMapping
    public List<Propiedad> listarTodos() { return service.listarTodos(); }

    @GetMapping("/{id}")
    public ResponseEntity<Propiedad> buscarPorId(@PathVariable Integer id) {
        return service.buscarPorId(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Propiedad crear(@RequestBody Propiedad propiedad) {
        return service.guardar(propiedad);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Propiedad> actualizar(@PathVariable Integer id,
                                                 @RequestBody Propiedad propiedad) {
        return service.buscarPorId(id).map(p -> {
            propiedad.setIdPropiedad(id);
            return ResponseEntity.ok(service.guardar(propiedad));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}