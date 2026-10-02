package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.FacturaServicio;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.service.FacturaServicioService;
import com.inmobiliaria.backend.service.PropiedadService;
import com.inmobiliaria.backend.service.PersonaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/finanzas/facturas-servicios")
public class FacturaServicioController {

    @Autowired
    private FacturaServicioService service;

    @Autowired
    private PropiedadService propiedadService;

    @Autowired
    private PersonaService personaService;

    // ── Listado general ─────────────────────────────────────────────

    @GetMapping
    public List<FacturaServicio> listarTodos() {
        return service.listarTodos();
    }

    // ── Búsquedas por filtro ────────────────────────────────────────

    @GetMapping("/estado/{estado}")
    public List<FacturaServicio> filtrarPorEstado(@PathVariable String estado) {
        return service.filtrarPorEstado(estado);
    }

    @GetMapping("/servicio/{servicio}")
    public List<FacturaServicio> filtrarPorServicio(@PathVariable String servicio) {
        return service.filtrarPorServicio(servicio);
    }

    @GetMapping("/buscar")
    public List<FacturaServicio> buscarPorTexto(@RequestParam String q) {
        return service.buscarPorTexto(q);
    }

    // ── Cálculos ────────────────────────────────────────────────────

    @GetMapping("/total/{idPropiedad}")
    public ResponseEntity<Map<String, Object>> obtenerTotalPorPropiedad(@PathVariable Integer idPropiedad) {
        BigDecimal total = service.obtenerTotalPorPropiedad(idPropiedad);
        return ResponseEntity.ok(Map.of("idPropiedad", idPropiedad, "total", total));
    }

    // ── Validaciones ────────────────────────────────────────────────

    @GetMapping("/validar-pendientes/{idPropiedad}")
    public ResponseEntity<?> validarPagosPendientes(@PathVariable Integer idPropiedad) {
        return ResponseEntity.ok(service.validarPagosPendientes(idPropiedad));
    }

    // ── Acciones ────────────────────────────────────────────────────

    @PostMapping("/marcar-pagado/{idFactura}")
    public ResponseEntity<?> marcarPagado(@PathVariable Integer idFactura,
                                           @RequestBody(required = false) Map<String, String> data) {
        try {
            String formaPago = data != null && data.get("formaPago") != null ? data.get("formaPago") : "Transferencia";
            String pagadoPor = data != null ? data.get("pagadoPor") : null;
            FacturaServicio f = service.marcarPagado(idFactura, formaPago, pagadoPor);
            return ResponseEntity.ok(f);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @PostMapping("/crear-desde-comprobante")
    public ResponseEntity<?> crearDesdeComprobante(@RequestBody Map<String, Object> data) {
        try {
            Integer idPropiedad = Integer.parseInt(data.get("idPropiedad").toString());
            Propiedad prop = propiedadService.buscarPorId(idPropiedad)
                .orElseThrow(() -> new IllegalArgumentException("Propiedad no encontrada"));
            // Quién cargó la factura: el agente indicado, o la persona cuyo email coincide con el usuario logueado;
            // si no existe, se usa el propietario de la propiedad como referencia.
            Persona agente = null;
            if (data.get("idAgente") != null && !data.get("idAgente").toString().isBlank())
                agente = personaService.buscarPorId(Integer.parseInt(data.get("idAgente").toString())).orElse(null);
            if (agente == null) {
                var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof com.inmobiliaria.backend.model.UsuarioAutenticacion u && u.getUsername() != null) {
                    try { agente = personaService.buscarPorEmail(u.getUsername()).orElse(null); }
                    catch (Exception ignorada) { agente = null; }
                }
            }
            if (agente == null) agente = prop.getPropietarioActual();
            if (agente == null)
                throw new IllegalArgumentException("La propiedad no tiene propietario cargado y no se pudo identificar quién carga la factura.");

            FacturaServicio f = service.crearDesdeComprobante(data, prop, agente);
            return ResponseEntity.ok(f);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        try {
            service.eliminar(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    // ── Reportes ────────────────────────────────────────────────────

    @GetMapping("/reportes/vencidas")
    public List<FacturaServicio> obtenerFacturasVencidasHoy() {
        return service.obtenerFacturasVencidasHoy();
    }

    @GetMapping("/reportes/grupo-por-tipo")
    public List<FacturaServicio> groupByServiceType() {
        return service.groupByServiceType();
    }
}
