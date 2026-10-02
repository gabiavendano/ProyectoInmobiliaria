package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.dto.PropiedadPublicaDTO;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.service.GeocodificacionService;
import com.inmobiliaria.backend.service.PropiedadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/propiedades")
public class PropiedadController {

    @Autowired
    private PropiedadService service;

    @Autowired
    private GeocodificacionService geo;

    @Autowired
    private com.inmobiliaria.backend.service.ContratoService contratoService;

    @GetMapping
    public List<Propiedad> listarTodos() { return service.listarTodos(); }


    /** Busca la dirección con Google Maps. Si el servidor no tiene clave, responde configurado=false y el panel usa el buscador libre. */
    @GetMapping("/geocodificar")
    public Map<String, Object> geocodificar(@RequestParam String direccion) {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("configurado", geo.configurado());
        if (!geo.configurado()) return out;
        Map<String, Object> r = geo.geocodificar(direccion);
        out.put("resultado", r);
        return out;
    }

    /** Saca las coordenadas de un link de Google Maps (también los cortos). */
    @GetMapping("/coordenadas-link")
    public Map<String, Object> coordenadasLink(@RequestParam String link) {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("resultado", geo.coordenadasDeLink(link));
        return out;
    }

    @GetMapping("/publicas")
    public List<PropiedadPublicaDTO> listarPublicas() { return service.listarDisponiblesParaWeb(); }

    // Público: fechas ocupadas de un alquiler temporario (solo desde/hasta, sin datos de personas)
    @GetMapping("/publicas/{id}/ocupacion")
    public List<Map<String, Object>> ocupacionPublica(@PathVariable Integer id) {
        return service.buscarPorId(id)
            .filter(p -> p.ofreceOperacion(Propiedad.TipoOperacion.AlquilerTemporario))
            .filter(p -> p.getEstadoPropiedad() == null || p.getEstadoPropiedad() == Propiedad.EstadoPropiedad.Disponible)
            .map(p -> contratoService.ocupacionTemporaria(id, false, null))
            .orElse(List.of());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Propiedad> buscarPorId(@PathVariable Integer id) {
        return service.buscarPorId(id).map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Propiedad crear(@RequestBody Propiedad propiedad) {
        return service.crear(propiedad);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Propiedad> actualizar(@PathVariable Integer id,
                                                 @RequestBody Propiedad propiedad) {
        return service.actualizar(id, propiedad)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }


    @PatchMapping("/{id}/estado")
    public ResponseEntity<Propiedad> estado(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        return service.cambiarEstado(id, body.get("estado"))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Unidades de un complejo (todas, cualquiera sea su estado). */
    @GetMapping("/{id}/unidades")
    public List<Map<String, Object>> unidades(@PathVariable Integer id) {
        return service.listarUnidades(id);
    }

    /** Crea varias unidades de una vez: {cantidad, prefijo, tipoInmueble, precio}. */
    @PostMapping("/{id}/unidades/generar")
    public List<Map<String, Object>> generarUnidades(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        int cantidad;
        try { cantidad = Integer.parseInt(String.valueOf(body.get("cantidad"))); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("Indicá cuántas unidades querés crear"); }
        java.math.BigDecimal precio = null;
        Object pr = body.get("precio");
        if (pr != null && !String.valueOf(pr).isBlank()) {
            try { precio = new java.math.BigDecimal(String.valueOf(pr)); }
            catch (NumberFormatException e) { throw new IllegalArgumentException("Precio inválido"); }
        }
        String prefijo = body.get("prefijo") == null ? null : String.valueOf(body.get("prefijo"));
        String tipo = body.get("tipoInmueble") == null ? null : String.valueOf(body.get("tipoInmueble"));
        return service.generarUnidades(id, cantidad, prefijo, tipo, precio);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}