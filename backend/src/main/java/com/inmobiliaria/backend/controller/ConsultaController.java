package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.Consulta;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.ConsultaRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Consultas (leads) que llegan desde la web pública.
 *
 *  - POST /api/consultas           → cualquier usuario logueado (un cliente consulta por una propiedad).
 *  - GET/PATCH /api/consultas/**   → solo AGENTE o ADMIN (ver SecurityConfig).
 *
 * El autor SIEMPRE es el usuario del token: nunca se toma de lo que mande el navegador.
 */
@RestController
@RequestMapping("/api/consultas")
public class ConsultaController {

    private static final Pattern TEL_OK = Pattern.compile("^[0-9+()\\-\\s.]{0,30}$");
    private static final Set<String> ESTADOS = Set.of("Nueva", "Contactada", "Descartada");
    private static final int MAX_POR_DIA = 10;

    @Autowired private ConsultaRepository consultaRepo;
    @Autowired private PropiedadRepository propiedadRepo;

    private UsuarioAutenticacion usuarioActual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.getPrincipal() instanceof UsuarioAutenticacion)
            ? (UsuarioAutenticacion) auth.getPrincipal() : null;
    }

    private static String texto(Object o) {
        return o instanceof String ? ((String) o).trim() : null;
    }

    private static ResponseEntity<?> error(int status, String msg) {
        return ResponseEntity.status(status).body(Map.of("error", msg));
    }

    static Map<String, Object> dto(Consulta c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("idConsulta", c.getIdConsulta());
        m.put("idUsuario", c.getIdUsuario());
        m.put("nombre", c.getNombre());
        m.put("email", c.getEmail());
        m.put("telefono", c.getTelefono());
        m.put("idPropiedad", c.getIdPropiedad());
        m.put("propiedadTitulo", c.getPropiedadTitulo());
        m.put("mensaje", c.getMensaje());
        m.put("horarioPreferido", c.getHorarioPreferido());
        m.put("fecha", c.getFecha());
        m.put("estado", c.getEstado());
        m.put("notaAgente", c.getNotaAgente());
        m.put("idPersona", c.getIdPersona());
        return m;
    }

    // ── Cliente: enviar una consulta ──────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, Object> data) {
        UsuarioAutenticacion u = usuarioActual();
        if (u == null) return error(401, "No autenticado");

        String mensaje = texto(data.get("mensaje"));
        if (mensaje == null || mensaje.isEmpty()) return error(400, "Escribí tu consulta");
        if (mensaje.length() > 1000) return error(400, "La consulta es demasiado larga (máximo 1000 caracteres)");

        String horario = texto(data.get("horarioPreferido"));
        if (horario != null && horario.length() > 100) return error(400, "El horario es demasiado largo (máximo 100 caracteres)");
        if (horario != null && horario.isEmpty()) horario = null;

        String telefono = texto(data.get("telefono"));
        if (telefono == null || telefono.isEmpty()) telefono = u.getTelefono();
        if (telefono != null && !TEL_OK.matcher(telefono).matches()) return error(400, "El teléfono solo puede tener números, espacios y + ( ) - .");

        // Freno básico contra spam: máximo 10 consultas por usuario cada 24 horas
        if (consultaRepo.countByIdUsuarioAndFechaAfter(u.getIdUsuario(), LocalDateTime.now().minusHours(24)) >= MAX_POR_DIA) {
            return error(400, "Enviaste demasiadas consultas hoy. Si es urgente, escribinos por WhatsApp.");
        }

        Propiedad prop = null;
        if (data.get("idPropiedad") instanceof Number) {
            prop = propiedadRepo.findById(((Number) data.get("idPropiedad")).intValue()).orElse(null);
        }

        String nombre = u.getNombreCompleto();
        if (u.getApellido() != null && !u.getApellido().isBlank() && (nombre == null || !nombre.contains(u.getApellido()))) {
            nombre = ((nombre == null ? "" : nombre) + " " + u.getApellido()).trim();
        }

        Consulta c = new Consulta();
        c.setIdUsuario(u.getIdUsuario());
        c.setNombre(nombre != null && nombre.length() > 200 ? nombre.substring(0, 200) : nombre);
        c.setEmail(u.getUsername());
        c.setTelefono(telefono);
        if (prop != null) {
            c.setIdPropiedad(prop.getIdPropiedad());
            String t = prop.getTitulo();
            c.setPropiedadTitulo(t != null && t.length() > 200 ? t.substring(0, 200) : t);
        }
        c.setMensaje(mensaje);
        c.setHorarioPreferido(horario);
        Consulta guardada = consultaRepo.save(c);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("mensaje", "Recibimos tu consulta. Un agente se va a comunicar con vos.");
        body.put("consulta", dto(guardada));
        return ResponseEntity.ok(body);
    }

    // ── Agentes: listar y gestionar ───────────────────────────────────────
    @GetMapping
    public List<Map<String, Object>> listar(@RequestParam(required = false) String estado) {
        List<Consulta> lista = (estado != null && ESTADOS.contains(estado))
            ? consultaRepo.findByEstadoOrderByFechaDesc(estado)
            : consultaRepo.findAllByOrderByFechaDesc();
        return lista.stream().map(ConsultaController::dto).toList();
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> actualizar(@PathVariable Integer id, @RequestBody Map<String, Object> data) {
        return consultaRepo.findById(id).<ResponseEntity<?>>map(c -> {
            String estado = texto(data.get("estado"));
            if (estado != null) {
                if (!ESTADOS.contains(estado)) return error(400, "Estado inválido");
                c.setEstado(estado);
            }
            if (data.containsKey("notaAgente")) {
                String nota = texto(data.get("notaAgente"));
                if (nota != null && nota.length() > 500) return error(400, "La nota es demasiado larga (máximo 500 caracteres)");
                c.setNotaAgente(nota == null || nota.isEmpty() ? null : nota);
            }
            return ResponseEntity.ok(dto(consultaRepo.save(c)));
        }).orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Consulta no encontrada")));
    }
}
