package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.service.PersonaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController                          // Esta clase responde con JSON
@RequestMapping("/api/personas")         // Todas las rutas empiezan con /api/personas
@CrossOrigin(origins = "http://localhost:5173") // Permite pedidos desde React
public class PersonaController {

    @Autowired
    private PersonaService service;

    // GET /api/personas → devuelve lista completa
    @GetMapping
    public List<Persona> listarTodos() {
        return service.listarTodos();
    }

    // GET /api/personas/5 → devuelve persona con id=5
    @GetMapping("/{id}")
    public ResponseEntity<Persona> buscarPorId(@PathVariable Integer id) {
        return service.buscarPorId(id)
            .map(ResponseEntity::ok)                    // si existe → 200 OK + datos
            .orElse(ResponseEntity.notFound().build()); // si no existe → 404
    }

    // POST /api/personas → crea nueva persona con los datos del body
    @PostMapping
    public Persona crear(@RequestBody Persona persona) {
        return service.guardar(persona);
    }

    // PUT /api/personas/5 → actualiza persona con id=5
    @PutMapping("/{id}")
    public ResponseEntity<Persona> actualizar(@PathVariable Integer id,
                                               @RequestBody Persona persona) {
        return service.buscarPorId(id).map(p -> {
            persona.setIdPersona(id);
            return ResponseEntity.ok(service.guardar(persona));
        }).orElse(ResponseEntity.notFound().build());
    }

    // DELETE /api/personas/5 → elimina persona con id=5
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}