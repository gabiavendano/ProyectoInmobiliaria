package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.model.LiquidacionMensual;
import com.inmobiliaria.backend.service.ContratoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/contratos")
@CrossOrigin(origins = "http://localhost:5173")
public class ContratoController {

    @Autowired
    private ContratoService service;

    @GetMapping
    public List<ContratoOperacion> listarTodos() { return service.listarTodos(); }

    @GetMapping("/{id}")
    public ResponseEntity<ContratoOperacion> buscarPorId(@PathVariable Integer id) {
        return service.buscarPorId(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // POST con todas las validaciones — devuelve 400 + mensaje si algo falla
    @PostMapping
    public ResponseEntity<?> crear(@RequestBody ContratoOperacion contrato) {
        try {
            return ResponseEntity.ok(service.crearContrato(contrato));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // PATCH: rescisión sin borrar
    @PatchMapping("/{id}/rescindir")
    public ResponseEntity<?> rescindir(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(service.rescindirContrato(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // PATCH: cierre de venta y transferencia de propiedad
    @PatchMapping("/{id}/cerrar-venta")
    public ResponseEntity<?> cerrarVenta(@PathVariable Integer id) {
        try {
            service.cerrarVenta(id);
            return ResponseEntity.ok(Map.of("mensaje", "Venta cerrada. Propiedad transferida."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // POST: registrar pago mensual con cálculo de mora
    @PostMapping("/{id}/liquidaciones")
    public ResponseEntity<?> registrarLiquidacion(@PathVariable Integer id,
                                                   @RequestBody LiquidacionMensual liq) {
        try {
            liq.getContrato().setIdOperacion(id);
            return ResponseEntity.ok(service.registrarLiquidacion(liq));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/liquidaciones")
    public List<LiquidacionMensual> listarLiquidaciones(@PathVariable Integer id) {
        return service.listarLiquidaciones(id);
    }
}