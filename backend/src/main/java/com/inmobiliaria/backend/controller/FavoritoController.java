package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.Favorito;
import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.FavoritoRepository;
import com.inmobiliaria.backend.repository.PersonaRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Favoritos de propiedades. Rutas: /api/favoritos (requiere login, ver SecurityConfig).
 *
 * Seguridad: el cliente NUNCA se toma del body ni de la URL. Se deduce del usuario
 * logueado (su email/username ↔ Persona con ese email; si no existe se crea una
 * Persona "Comprador" vinculada). Los AGENTE/ADMIN pueden consultar el de cualquier
 * cliente por id de Persona.
 *
 * Compatibilidad: el frontend manda igual {idCliente} / /{idCliente}; para un CLIENTE
 * ese valor se ignora.
 */
@RestController
@RequestMapping("/api/favoritos")
public class FavoritoController {

    @Autowired private FavoritoRepository favoritoRepo;
    @Autowired private PersonaRepository personaRepo;
    @Autowired private PropiedadRepository propiedadRepo;

    // ── Helpers ───────────────────────────────────────────────────────────

    private UsuarioAutenticacion usuarioActual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UsuarioAutenticacion) {
            return (UsuarioAutenticacion) auth.getPrincipal();
        }
        return null;
    }

    private static boolean esStaff(UsuarioAutenticacion u) {
        return u.getRol() == UsuarioAutenticacion.Rol.ADMIN || u.getRol() == UsuarioAutenticacion.Rol.AGENTE;
    }

    /** Persona asociada al usuario (la crea si no existe). */
    private Persona personaDe(UsuarioAutenticacion u) {
        Optional<Persona> existente = personaRepo.findFirstByEmailIgnoreCaseOrderByIdPersonaAsc(u.getUsername());
        if (existente.isPresent()) return existente.get();

        Persona p = new Persona();
        p.setNombreCompleto(u.getNombreCompleto());
        p.setDniCuit("USR-" + u.getIdUsuario());     // placeholder único (la columna es unique y obligatoria)
        p.setEmail(u.getUsername());
        p.setRolPrincipal(Persona.RolPrincipal.Comprador);
        return personaRepo.save(p);
    }

    /** Persona cuyos favoritos se consultan: la propia, o (staff) la indicada por id. */
    private Persona personaObjetivo(UsuarioAutenticacion u, Integer idPedido) {
        if (esStaff(u) && idPedido != null) {
            return personaRepo.findById(idPedido).orElse(null);
        }
        return personaDe(u);
    }

    /** Respuesta mínima: no se serializan entidades (evita filtrar datos de Persona/Propiedad). */
    private static Map<String, Object> dto(Favorito f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("idFavorito", f.getIdFavorito());
        Propiedad p = f.getPropiedad();
        Integer idProp = p != null ? p.getIdPropiedad() : null;
        m.put("idPropiedad", idProp);
        if (p != null) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("id", idProp);
            pm.put("idPropiedad", idProp);
            pm.put("titulo", p.getTitulo());
            m.put("propiedad", pm);
        }
        m.put("nota", f.getNota());
        m.put("fechaAgregado", f.getFechaAgregado());
        m.put("estado", f.getEstado());
        return m;
    }

    private static Map<String, Object> error(String mensaje) {
        return Map.of("error", mensaje);
    }

    // ── Endpoints ─────────────────────────────────────────────────────────

    /** Favoritos del usuario logueado (sin depender de ningún id que mande el navegador). */
    @GetMapping("/mios")
    @Transactional
    public ResponseEntity<?> misFavoritos() {
        UsuarioAutenticacion u = usuarioActual();
        if (u == null) return ResponseEntity.status(401).body(error("No autenticado"));
        Persona yo = personaDe(u);
        return ResponseEntity.ok(favoritoRepo.findByClienteId(yo.getIdPersona()).stream().map(FavoritoController::dto).toList());
    }

    @GetMapping("/{idCliente}")
    @Transactional
    public ResponseEntity<?> getFavoritos(@PathVariable Integer idCliente) {
        UsuarioAutenticacion u = usuarioActual();
        if (u == null) return ResponseEntity.status(401).body(error("No autenticado"));
        Persona cliente = personaObjetivo(u, idCliente);
        if (cliente == null) return ResponseEntity.status(404).body(error("Cliente no encontrado"));
        List<Favorito> favoritos = favoritoRepo.findByClienteId(cliente.getIdPersona());
        return ResponseEntity.ok(favoritos.stream().map(FavoritoController::dto).toList());
    }

    @PostMapping("/agregar")
    @Transactional
    public ResponseEntity<?> agregarFavorito(@RequestBody Map<String, Object> data) {
        UsuarioAutenticacion u = usuarioActual();
        if (u == null) return ResponseEntity.status(401).body(error("No autenticado"));
        try {
            Object rawProp = data.get("idPropiedad");
            if (!(rawProp instanceof Number)) {
                return ResponseEntity.badRequest().body(error("idPropiedad es requerido"));
            }
            Integer idPropiedad = ((Number) rawProp).intValue();
            String nota = data.get("nota") instanceof String ? (String) data.get("nota") : null;
            if (nota != null && nota.length() > 300) nota = nota.substring(0, 300);

            Optional<Propiedad> propiedad = propiedadRepo.findById(idPropiedad);
            if (propiedad.isEmpty()) {
                return ResponseEntity.badRequest().body(error("Propiedad no encontrada"));
            }
            // Solo se pueden guardar propiedades publicadas (las del sitio público)
            Propiedad.EstadoPropiedad estado = propiedad.get().getEstadoPropiedad();
            if (estado != null && estado != Propiedad.EstadoPropiedad.Disponible) {
                return ResponseEntity.badRequest().body(error("Esta propiedad ya no está disponible"));
            }

            Persona cliente = personaDe(u);   // siempre el propio usuario
            if (favoritoRepo.existsByClienteAndPropiedad(cliente.getIdPersona(), idPropiedad)) {
                // Ya estaba guardada: no es un error, se devuelve el favorito existente
                Optional<Favorito> existente = favoritoRepo.findByClienteId(cliente.getIdPersona()).stream()
                    .filter(f -> f.getPropiedad() != null && idPropiedad.equals(f.getPropiedad().getIdPropiedad())).findFirst();
                Map<String, Object> ya = new LinkedHashMap<>();
                ya.put("mensaje", "La propiedad ya estaba en favoritos");
                existente.ifPresent(f -> ya.put("favorito", dto(f)));
                return ResponseEntity.ok(ya);
            }

            Favorito favorito = new Favorito();
            favorito.setCliente(cliente);
            favorito.setPropiedad(propiedad.get());
            favorito.setNota(nota);
            favorito.setFechaAgregado(LocalDateTime.now());
            Favorito saved = favoritoRepo.save(favorito);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("mensaje", "Propiedad agregada a favoritos");
            body.put("favorito", dto(saved));
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(error(
                e.getMessage() != null ? e.getMessage() : "No se pudo agregar el favorito"));
        }
    }

    @DeleteMapping("/{idFavorito}")
    @Transactional
    public ResponseEntity<?> quitarFavorito(@PathVariable Integer idFavorito) {
        UsuarioAutenticacion u = usuarioActual();
        if (u == null) return ResponseEntity.status(401).body(error("No autenticado"));
        Optional<Favorito> fav = favoritoRepo.findById(idFavorito);
        if (fav.isEmpty()) {
            return ResponseEntity.badRequest().body(error("Favorito no encontrado"));
        }
        if (!esStaff(u)) {
            Persona propia = personaDe(u);
            Integer duenio = fav.get().getCliente() != null ? fav.get().getCliente().getIdPersona() : null;
            if (duenio == null || !duenio.equals(propia.getIdPersona())) {
                return ResponseEntity.status(403).body(error("Ese favorito no te pertenece"));
            }
        }
        favoritoRepo.deleteById(idFavorito);
        return ResponseEntity.ok(Map.of("mensaje", "Propiedad eliminada de favoritos"));
    }

    @GetMapping("/count/{idCliente}")
    @Transactional
    public ResponseEntity<?> countFavoritos(@PathVariable Integer idCliente) {
        UsuarioAutenticacion u = usuarioActual();
        if (u == null) return ResponseEntity.status(401).body(error("No autenticado"));
        Persona cliente = personaObjetivo(u, idCliente);
        if (cliente == null) return ResponseEntity.status(404).body(error("Cliente no encontrado"));
        return ResponseEntity.ok(Map.of("total", favoritoRepo.findByClienteId(cliente.getIdPersona()).size()));
    }
}
