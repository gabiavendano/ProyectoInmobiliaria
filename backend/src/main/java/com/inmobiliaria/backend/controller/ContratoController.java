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
public class ContratoController {

    @Autowired
    private ContratoService service;

    @Autowired
    private com.inmobiliaria.backend.service.CobranzaService cobranzaService;

    @GetMapping
    public List<ContratoOperacion> listarTodos() { return service.listarTodos(); }

    // Calendario de una propiedad: estadías temporarias confirmadas y en borrador (uso interno)
    @GetMapping("/ocupacion/{idPropiedad}")
    public List<Map<String, Object>> ocupacion(@PathVariable Integer idPropiedad,
                                               @RequestParam(required = false) Integer excluir) {
        return service.ocupacionTemporaria(idPropiedad, true, excluir);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContratoOperacion> buscarPorId(@PathVariable Integer id) {
        return service.buscarPorId(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // POST con todas las validaciones — devuelve 400 + mensaje si algo falla
    @PostMapping
    public ResponseEntity<?> crear(@RequestBody ContratoOperacion contrato,
                                   org.springframework.security.core.Authentication auth) {
        try {
            // Quién lo carga lo decide el servidor (el usuario logueado), no el formulario
            contrato.setUsuarioResponsable(com.inmobiliaria.backend.config.UsuarioActual.nombre());
            return ResponseEntity.ok(service.crearContrato(contrato));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // PUT: corregir una operación en borrador o vigente
    @PutMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Integer id, @RequestBody ContratoOperacion contrato) {
        try {
            return ResponseEntity.ok(service.actualizarContrato(id, contrato));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // PATCH: pasar un borrador a operación vigente (bloquea la propiedad)
    @PatchMapping("/{id}/activar")
    public ResponseEntity<?> activar(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(service.activarContrato(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // PATCH: finalizar un alquiler que terminó (la propiedad vuelve a Disponible)
    @PatchMapping("/{id}/finalizar")
    public ResponseEntity<?> finalizar(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(service.finalizarContrato(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // PATCH: rescisión sin borrar
    @PatchMapping("/{id}/rescindir")
    public ResponseEntity<?> rescindir(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(service.rescindirContrato(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // PATCH: cierre de venta y transferencia de propiedad
    @PatchMapping("/{id}/cerrar-venta")
    public ResponseEntity<?> cerrarVenta(@PathVariable Integer id) {
        try {
            service.cerrarVenta(id);
            return ResponseEntity.ok(Map.of("mensaje", "Venta cerrada. Propiedad transferida."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // PATCH: cierre de permuta (cada propiedad pasa a nombre de la otra parte)
    @PatchMapping("/{id}/cerrar-permuta")
    public ResponseEntity<?> cerrarPermuta(@PathVariable Integer id) {
        try {
            service.cerrarPermuta(id);
            return ResponseEntity.ok(Map.of("mensaje", "Permuta cerrada. Propiedades transferidas."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // POST: registrar pago mensual con cálculo de mora
    @PostMapping("/{id}/liquidaciones")
    public ResponseEntity<?> registrarLiquidacion(@PathVariable Integer id,
                                                   @RequestBody LiquidacionMensual liq) {
        try {
            if (liq.getContrato() == null) {
                liq.setContrato(new ContratoOperacion());
            }
            liq.getContrato().setIdOperacion(id);
            return ResponseEntity.ok(cobranzaService.registrarCobro(liq));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @GetMapping("/{id}/liquidaciones")
    public List<LiquidacionMensual> listarLiquidaciones(@PathVariable Integer id) {
        return service.listarLiquidaciones(id);
    }
}