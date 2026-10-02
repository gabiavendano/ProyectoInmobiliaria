package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.config.Errores;
import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.model.LiquidacionMensual;
import com.inmobiliaria.backend.service.CobranzaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Cobranza de alquileres y rendiciones a propietarios (Finanzas y Cobros). */
@RestController
@RequestMapping("/api/finanzas/cobranza")
public class CobranzaController {

    @Autowired private CobranzaService service;

    @GetMapping("/liquidaciones")
    public List<LiquidacionMensual> liquidaciones() { return service.listarLiquidaciones(); }

    @PostMapping("/contratos/{id}/cobro")
    public ResponseEntity<?> cobrar(@PathVariable Integer id, @RequestBody LiquidacionMensual liq) {
        try {
            if (liq.getContrato() == null) liq.setContrato(new ContratoOperacion());
            liq.getContrato().setIdOperacion(id);
            return ResponseEntity.ok(service.registrarCobro(liq));
        } catch (Exception e) { return error(e); }
    }

    @PatchMapping("/liquidaciones/{id}/anular")
    public ResponseEntity<?> anularCobro(@PathVariable Integer id, @RequestBody(required = false) Map<String, String> body) {
        try { return ResponseEntity.ok(service.anularCobro(id, body == null ? null : body.get("motivo"))); }
        catch (Exception e) { return error(e); }
    }

    @GetMapping("/rendiciones/preview")
    public ResponseEntity<?> preview(@RequestParam Integer idPropietario, @RequestParam String mesAno,
                                     @RequestParam(required = false) String moneda,
                                     @RequestParam(required = false, defaultValue = "true") boolean incluirServicios) {
        try { return ResponseEntity.ok(service.previewRendicion(idPropietario, mesAno, moneda, incluirServicios)); }
        catch (Exception e) { return error(e); }
    }

    @PostMapping("/rendiciones")
    public ResponseEntity<?> generar(@RequestBody Map<String, Object> data) {
        try { return ResponseEntity.ok(service.generarRendicion(data)); }
        catch (Exception e) { return error(e); }
    }

    @PatchMapping("/rendiciones/{id}/transferida")
    public ResponseEntity<?> transferida(@PathVariable Integer id) {
        try { return ResponseEntity.ok(service.marcarTransferida(id)); }
        catch (Exception e) { return error(e); }
    }

    @PatchMapping("/rendiciones/{id}/anular")
    public ResponseEntity<?> anularRendicion(@PathVariable Integer id, @RequestBody(required = false) Map<String, String> body) {
        try { return ResponseEntity.ok(service.anularRendicion(id, body == null ? null : body.get("motivo"))); }
        catch (Exception e) { return error(e); }
    }

    private ResponseEntity<?> error(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", Errores.msg(e)));
    }
}
