package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.RendicionPropietario;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.service.RendicionPropietarioService;
import com.inmobiliaria.backend.service.InquilinoContratoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rendiciones")
public class RendicionPropietarioController {

    @Autowired
    private RendicionPropietarioService service;

    @Autowired
    private InquilinoContratoService inquilinoContratoService;

    @Autowired
    private com.inmobiliaria.backend.service.PropiedadService propiedadService;

    @Autowired
    private com.inmobiliaria.backend.service.PersonaService personaService;

    @GetMapping
    public List<RendicionPropietario> listarTodos() {
        return service.listarTodos();
    }

    @GetMapping("/propietario/{id}")
    public List<RendicionPropietario> listarPorPropietario(@PathVariable Integer id) {
        return service.listarPorPropietario(id);
    }

    @PostMapping
    public RendicionPropietario crear(@RequestBody RendicionPropietario r) {
        return service.guardar(r);
    }

    @PostMapping("/crear/{idPropietario}")
    public ResponseEntity<?> crearRendicion(@PathVariable Integer idPropietario,
                                             @RequestBody Map<String, String> data) {
        try {
            String mesAno = data.get("mesAno");
            RendicionPropietario r = service.crearRendicion(idPropietario, mesAno);
            return ResponseEntity.ok(r);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @GetMapping("/propietario/{id}/estructura")
    public ResponseEntity<?> obtenerEstructuraPropietario(@PathVariable("id") Integer idPersona) {
        try {
            return ResponseEntity.ok(service.listarPorPropietario(idPersona));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        return ResponseEntity.badRequest().body(Map.of("error",
            "Las rendiciones no se eliminan: anulalas desde Finanzas y Cobros para conservar el registro."));
    }
}
