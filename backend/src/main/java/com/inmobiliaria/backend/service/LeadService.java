package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.Consulta;
import com.inmobiliaria.backend.model.Favorito;
import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.ConsultaRepository;
import com.inmobiliaria.backend.repository.FavoritoRepository;
import com.inmobiliaria.backend.repository.PersonaRepository;
import com.inmobiliaria.backend.repository.UsuarioAutenticacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Leads web: clientes que se registraron en la página pública.
 * Reúne su actividad (favoritos y consultas) y permite convertirlos en clientes reales de la inmobiliaria.
 */
@Service
public class LeadService {

    private static final Pattern TEL_OK = Pattern.compile("^[0-9+()\\-\\s.]{0,20}$");

    @Autowired private UsuarioAutenticacionRepository usuarioRepo;
    @Autowired private PersonaRepository personaRepo;
    @Autowired private FavoritoRepository favoritoRepo;
    @Autowired private ConsultaRepository consultaRepo;

    /** Los usuarios web tienen un DNI técnico "USR-n" hasta que un agente carga el DNI real. */
    private static boolean esPlaceholder(Persona p) {
        return p.getDniCuit() != null && p.getDniCuit().toUpperCase().startsWith("USR-");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listar() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (UsuarioAutenticacion u : usuarioRepo.findByRol(UsuarioAutenticacion.Rol.CLIENTE)) {
            if (!Boolean.TRUE.equals(u.getActivo())) continue;

            Persona persona = personaRepo.findFirstByEmailIgnoreCaseOrderByIdPersonaAsc(u.getUsername()).orElse(null);
            boolean convertido = persona != null && !esPlaceholder(persona);
            List<Favorito> favs = persona != null ? favoritoRepo.findByClienteId(persona.getIdPersona()) : List.of();
            List<Consulta> consultas = consultaRepo.findByIdUsuarioOrderByFechaDesc(u.getIdUsuario());

            LocalDateTime ultima = null;
            for (Favorito f : favs) {
                if (f.getFechaAgregado() != null && (ultima == null || f.getFechaAgregado().isAfter(ultima))) ultima = f.getFechaAgregado();
            }
            for (Consulta c : consultas) {
                if (c.getFecha() != null && (ultima == null || c.getFecha().isAfter(ultima))) ultima = c.getFecha();
            }

            List<Map<String, Object>> favDto = new ArrayList<>();
            for (Favorito f : favs) {
                Map<String, Object> fm = new LinkedHashMap<>();
                fm.put("idPropiedad", f.getPropiedad() != null ? f.getPropiedad().getIdPropiedad() : null);
                fm.put("titulo", f.getPropiedad() != null ? f.getPropiedad().getTitulo() : null);
                favDto.add(fm);
            }

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("idUsuario", u.getIdUsuario());
            m.put("nombre", u.getNombreCompleto());
            m.put("apellido", u.getApellido());
            m.put("email", u.getUsername());
            m.put("telefono", u.getTelefono());
            m.put("convertido", convertido);
            m.put("idPersona", convertido ? persona.getIdPersona() : null);
            m.put("favoritos", favDto);
            m.put("totalConsultas", consultas.size());
            m.put("consultasNuevas", consultas.stream().filter(c -> "Nueva".equals(c.getEstado())).count());
            m.put("ultimaActividad", ultima);
            out.add(m);
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> (LocalDateTime) m.get("ultimaActividad"),
            Comparator.nullsLast(Comparator.reverseOrder())));
        return out;
    }

    /**
     * Convierte a un usuario web en cliente: si ya tiene ficha técnica ("USR-n") la completa con el DNI real;
     * si no, crea una ficha nueva. Queda como Prospecto, origen "Web Propia", con una nota que resume su actividad.
     */
    @Transactional
    public Persona convertir(Integer idUsuario, String dni, String telefono, String agente) {
        UsuarioAutenticacion u = usuarioRepo.findById(idUsuario)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado"));
        if (u.getRol() != UsuarioAutenticacion.Rol.CLIENTE)
            throw new IllegalArgumentException("Solo se pueden convertir usuarios con rol Cliente");

        String dniLimpio = dni == null ? "" : dni.replaceAll("\\D", "");
        if (!dniLimpio.matches("\\d{7,11}"))
            throw new IllegalArgumentException("Ingresá un DNI o CUIT válido (solo números, de 7 a 11 dígitos)");

        final Persona existente = personaRepo.findFirstByEmailIgnoreCaseOrderByIdPersonaAsc(u.getUsername()).orElse(null);
        if (existente != null && !esPlaceholder(existente))
            throw new IllegalArgumentException("Este usuario ya está cargado como cliente (ficha #" + existente.getIdPersona() + ")");

        personaRepo.findByDniCuit(dniLimpio).ifPresent(otra -> {
            if (existente == null || !otra.getIdPersona().equals(existente.getIdPersona()))
                throw new IllegalArgumentException("Ya existe una persona con ese DNI/CUIT: " + otra.getNombreCompleto() + " (ficha #" + otra.getIdPersona() + ")");
        });

        // Teléfono: el que escribe el agente; si no, el del perfil del usuario (si es válido)
        String tel = telefono != null && !telefono.isBlank() ? telefono.trim() : null;
        if (tel != null && !TEL_OK.matcher(tel).matches())
            throw new IllegalArgumentException("El teléfono solo puede tener números, espacios y + ( ) - . (máximo 20 caracteres)");
        if (tel == null && u.getTelefono() != null && TEL_OK.matcher(u.getTelefono().trim()).matches()) tel = u.getTelefono().trim();

        String nombre = u.getNombreCompleto() == null ? "" : u.getNombreCompleto().trim();
        String apellido = u.getApellido() == null ? "" : u.getApellido().trim();
        String completo = apellido.isEmpty() || nombre.contains(apellido) ? nombre : nombre + " " + apellido;
        if (completo.length() > 100) completo = completo.substring(0, 100);

        Persona p = existente != null ? existente : new Persona();
        p.setNombreCompleto(completo);
        p.setNombre(nombre.length() > 100 ? nombre.substring(0, 100) : nombre);
        p.setApellido(apellido.isEmpty() ? null : apellido);
        p.setDniCuit(dniLimpio);
        p.setEmail(u.getUsername());
        p.setEmailPrincipal(u.getUsername());
        if (tel != null) { p.setTelefono(tel); p.setTelPrincipal(tel); }
        if (p.getRolPrincipal() == null) p.setRolPrincipal(Persona.RolPrincipal.Comprador);
        p.setCrmFuente("Web Propia");
        p.setCrmEstado("Prospecto");
        if (p.getSegFechaPrimerContacto() == null) p.setSegFechaPrimerContacto(LocalDate.now());
        // Todavía no se consultó el BCRA: sin nivel y no inhibido
        p.setEstadoBcra(null);
        p.setSituacionBcra("Desconocido");
        p.setInhibido(false);
        if (p.getRelaciones() == null) p.setRelaciones(new ArrayList<>());
        if (!p.getRelaciones().contains("Interesado")) p.getRelaciones().add("Interesado");

        List<Consulta> consultas = consultaRepo.findByIdUsuarioOrderByFechaDesc(idUsuario);
        int cantFavs = existente != null && existente.getIdPersona() != null
            ? favoritoRepo.findByClienteId(existente.getIdPersona()).size() : 0;
        StringBuilder nota = new StringBuilder("Lead de la web convertido en cliente por ")
            .append(agente == null || agente.isBlank() ? "un agente" : agente)
            .append(". Favoritos: ").append(cantFavs).append(". Consultas: ").append(consultas.size()).append(".");
        if (!consultas.isEmpty()) {
            Consulta ult = consultas.get(0);
            String msg = ult.getMensaje() == null ? "" : ult.getMensaje();
            if (msg.length() > 300) msg = msg.substring(0, 300) + "…";
            nota.append(" Última consulta")
                .append(ult.getPropiedadTitulo() != null ? " sobre «" + ult.getPropiedadTitulo() + "»" : "")
                .append(": «").append(msg).append("».");
        }
        p.agregarNota(nota.toString());

        Persona guardada = personaRepo.save(p);

        // Las consultas quedan vinculadas a la ficha; las nuevas pasan a "Contactada"
        for (Consulta c : consultas) {
            c.setIdPersona(guardada.getIdPersona());
            if ("Nueva".equals(c.getEstado())) c.setEstado("Contactada");
        }
        consultaRepo.saveAll(consultas);
        return guardada;
    }
}
