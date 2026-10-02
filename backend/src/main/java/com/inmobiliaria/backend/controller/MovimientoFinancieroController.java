package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.MovimientoFinanciero;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.service.MovimientoFinancieroService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/finanzas")
public class MovimientoFinancieroController {

    @Autowired
    private MovimientoFinancieroService service;

    @GetMapping
    public List<MovimientoFinanciero> listarTodos() {
        return service.listarTodos();
    }

    @GetMapping("/propiedad/{id}")
    public List<MovimientoFinanciero> listarPorPropiedad(@PathVariable Integer id) {
        return service.listarPorPropiedad(id);
    }

    @GetMapping("/persona/{id}")
    public List<MovimientoFinanciero> listarPorPersona(@PathVariable Integer id) {
        return service.listarPorPersona(id);
    }

    @GetMapping("/tipo/{tipo}")
    public List<MovimientoFinanciero> listarPorTipo(@PathVariable String tipo) {
        return service.listarPorTipo(tipo);
    }

    @GetMapping("/estado/{estado}")
    public List<MovimientoFinanciero> listarPorEstado(@PathVariable String estado) {
        return service.listarPorEstado(estado);
    }

    @GetMapping("/rango")
    public List<MovimientoFinanciero> listarPorRango(
            @RequestParam LocalDate inicio,
            @RequestParam LocalDate fin) {
        return service.listarPorRangoFechas(inicio, fin);
    }

    @PostMapping
    public ResponseEntity<?> crear(@RequestBody MovimientoFinanciero mov) {
        try {
            mov.setIdMovimiento(null);
            mov.setOrigen("Manual");
            return ResponseEntity.ok(service.guardar(mov));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> editar(@PathVariable Integer id, @RequestBody MovimientoFinanciero mov) {
        try { return ResponseEntity.ok(service.editar(id, mov)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e))); }
    }

    @PatchMapping("/{id}/anular")
    public ResponseEntity<?> anular(@PathVariable Integer id, @RequestBody(required = false) Map<String, String> body) {
        try { return ResponseEntity.ok(service.anular(id, body == null ? null : body.get("motivo"))); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e))); }
    }

    @PostMapping("/crear")
    public ResponseEntity<?> crearMovimiento(@RequestBody Map<String, Object> data) {
        try {
            Integer idPropiedad = data.get("idPropiedad") != null
                ? Integer.parseInt(data.get("idPropiedad").toString()) : null;
            Integer idPersona = data.get("idPersona") != null
                ? Integer.parseInt(data.get("idPersona").toString()) : null;
            String tipo = (String) data.get("tipo");
            BigDecimal monto = new BigDecimal(data.get("monto").toString());
            String moneda = (String) data.get("moneda");
            String medioPago = (String) data.get("medioPago");
            String estado = (String) data.get("estado");
            String conceptoIngreso = (String) data.get("conceptoIngreso");
            String conceptoEgreso = (String) data.get("conceptoEgreso");
            Boolean requiereAutorizacion = data.get("requiereAutorizacion") != null
                ? Boolean.TRUE.equals(data.get("requiereAutorizacion")) : false;
            String bancoDestino = (String) data.get("bancoDestino");
            String cbuAlias = (String) data.get("cbuAlias");
            String observaciones = (String) data.get("observaciones");

            MovimientoFinanciero mov = service.crearMovimiento(
                idPropiedad, idPersona, tipo, monto, moneda,
                medioPago, estado, conceptoIngreso, conceptoEgreso,
                requiereAutorizacion, bancoDestino, cbuAlias, observaciones);
            // El servicio usa la fecha de hoy; si el formulario eligió otra, se respeta
            Object fecha = data.get("fecha");
            if (fecha != null && !fecha.toString().isBlank()) {
                mov.setFecha(java.time.LocalDate.parse(fecha.toString()));
                mov = service.guardar(mov);
            }
            return ResponseEntity.ok(mov);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id) {
        return ResponseEntity.badRequest().body(Map.of("error",
            "Los movimientos no se eliminan: anulalos para conservar el registro contable."));
    }
}
