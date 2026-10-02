package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.config.Errores;
import com.inmobiliaria.backend.model.CargoServicio;
import com.inmobiliaria.backend.service.CargoServicioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/finanzas/cargos")
public class CargoServicioController {

    @Autowired private CargoServicioService service;

    @GetMapping
    public List<CargoServicio> listar(@RequestParam(required = false) String estado) { return service.listar(estado); }

    @PostMapping("/lote")
    public ResponseEntity<?> crearLote(@RequestBody Map<String, Object> data) {
        try { return ResponseEntity.ok(service.crearLote(data)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", Errores.msg(e))); }
    }

    @PatchMapping("/{id}/anular")
    public ResponseEntity<?> anular(@PathVariable Integer id) {
        try { return ResponseEntity.ok(service.anular(id)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", Errores.msg(e))); }
    }
}
