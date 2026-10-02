package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.NotaPersona;
import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.repository.ContratoRepository;
import com.inmobiliaria.backend.repository.MovimientoFinancieroRepository;
import com.inmobiliaria.backend.repository.NotaPersonaRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import com.inmobiliaria.backend.repository.RendicionPropietarioRepository;
import com.inmobiliaria.backend.repository.PersonaRepository;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class PersonaService {

    @Autowired
    private PersonaRepository repo;

    @Autowired
    private NotaPersonaRepository notaRepo;

    @Autowired private PropiedadRepository propiedadRepo;
    @Autowired private ContratoRepository contratoRepo;
    @Autowired private RendicionPropietarioRepository rendicionRepo;
    @Autowired private MovimientoFinancieroRepository movimientoRepo;

    public List<Persona> listarTodos() {
        return repo.findAll();
    }

    public Optional<Persona> buscarPorId(Integer id) {
        return repo.findById(id);
    }

    public Optional<Persona> buscarPorEmail(String email) {
        return repo.findByEmail(email);
    }

    public Optional<Persona> buscarPorDniCuit(String dniCuit) {
        return repo.findByDniCuit(dniCuit);
    }

    public boolean existeByEmail(String email) {
        return repo.existsByEmail(email);
    }

    public Persona guardar(Persona p) {
        return repo.save(p);
    }

    /** Borra una persona solo si nada depende de ella (propiedades, contratos, rendiciones, movimientos). */
    @Transactional
    public void eliminar(Integer id) {
        if (!repo.existsById(id)) throw new java.util.NoSuchElementException("Persona no encontrada");
        List<String> usos = new ArrayList<>();
        if (propiedadRepo.existsByPropietarioActualIdPersona(id)) usos.add("es propietaria de propiedades");
        long contratos = contratoRepo.contarPorPersona(id);
        if (contratos > 0) usos.add("participa en " + contratos + " contrato(s)");
        if (rendicionRepo.existsByPropietarioIdPersona(id)) usos.add("tiene rendiciones");
        if (movimientoRepo.existsByPersonaIdPersona(id)) usos.add("tiene movimientos financieros");
        if (!usos.isEmpty())
            throw new IllegalStateException("No se puede eliminar: la persona " + String.join(", ", usos)
                + ". Cambiá o dá de baja esos registros primero.");
        repo.deleteById(id);
    }

    // ── Alta / edición desde el panel ──────────────────────────────────────

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    // Campos que el formulario NO maneja: al editar se conservan tal como están
    private static final String[] NO_COPIAR_AL_EDITAR = {
        "idPersona", "historialNotas", "linkInformeVerazPdf", "fechaUltimaAuditoria"
    };

    /** Limpia espacios, completa el rol y deja que el BCRA decida si la persona está inhibida. */
    private void normalizar(Persona p) {
        if (p.getNombreCompleto() != null) p.setNombreCompleto(p.getNombreCompleto().trim());
        if (p.getNombreCompleto() != null && p.getNombreCompleto().matches("(?s).*[<>\\p{Cntrl}].*"))
            throw new IllegalArgumentException("El nombre no puede contener los símbolos < ni > ni caracteres especiales de control");
        if (p.getDniCuit() != null) p.setDniCuit(p.getDniCuit().trim());
        if (p.getRolPrincipal() == null) p.setRolPrincipal(Persona.RolPrincipal.Comprador);
        // Regla de negocio: BCRA 3 o más => inhibido. No se confía en lo que mande el navegador.
        p.setInhibido(p.getEstadoBcra() != null && p.getEstadoBcra() >= 3);
    }

    private void largo(String valor, int max, String campo) {
        if (valor != null && valor.length() > max)
            throw new IllegalArgumentException(campo + " es demasiado largo (máximo " + max + " caracteres)");
    }

    private void email(String valor, String campo) {
        if (valor != null && !valor.isBlank() && !EMAIL.matcher(valor.trim()).matches())
            throw new IllegalArgumentException(campo + " no es un email válido");
    }

    // DNI: 7 u 8 dígitos. CUIT/CUIL: 11 dígitos. Se aceptan puntos, guiones y espacios al tipear.
    private static final Pattern SOLO_DIGITOS = Pattern.compile("^\\d+$");

    private static String digitos(String v) {
        return v == null ? "" : v.replaceAll("[\\s.\\-]", "");
    }

    private void validar(Persona p, Integer idActual) {
        if (p.getNombreCompleto() == null || p.getNombreCompleto().isBlank())
            throw new IllegalArgumentException("El nombre es obligatorio");
        if (p.getDniCuit() == null || p.getDniCuit().isBlank())
            throw new IllegalArgumentException("El DNI o CUIT es obligatorio");

        largo(p.getNombreCompleto(), 100, "El nombre");
        largo(p.getDniCuit(), 20, "El DNI/CUIT");
        largo(p.getCuitCuil(), 20, "El CUIT/CUIL");
        largo(p.getTelPrincipal(), 20, "El teléfono principal");
        largo(p.getTelSecundario(), 20, "El teléfono secundario");
        largo(p.getWhatsapp(), 20, "El WhatsApp");
        largo(p.getDireccionParticular(), 150, "La dirección");
        email(p.getEmail(), "El email");
        email(p.getEmailPrincipal(), "El email principal");
        email(p.getEmailSecundario(), "El email secundario");

        // DNI/CUIT: solo números (7 a 11 dígitos). "USR-n" es un código técnico de usuarios web:
        // solo se acepta si la persona ya lo tenía (no se puede inventar uno desde el panel).
        String dni = p.getDniCuit().trim();
        boolean tecnico = dni.toUpperCase().startsWith("USR-");
        if (tecnico) {
            boolean yaLoTenia = idActual != null && repo.findById(idActual)
                .map(a -> dni.equalsIgnoreCase(a.getDniCuit())).orElse(false);
            if (!yaLoTenia)
                throw new IllegalArgumentException("El DNI no puede empezar con \"USR-\" (código reservado de usuarios web)");
        } else {
            String solo = digitos(dni);
            if (!SOLO_DIGITOS.matcher(solo).matches() || solo.length() < 7 || solo.length() > 11)
                throw new IllegalArgumentException("El DNI/CUIT debe tener solo números (7 a 11 dígitos)");
            p.setDniCuit(solo);
        }
        if (p.getCuitCuil() != null && !p.getCuitCuil().isBlank()) {
            String c = digitos(p.getCuitCuil());
            if (!SOLO_DIGITOS.matcher(c).matches() || c.length() != 11)
                throw new IllegalArgumentException("El CUIT/CUIL debe tener 11 dígitos");
            p.setCuitCuil(c);
        }

        repo.findByDniCuit(p.getDniCuit()).ifPresent(existente -> {
            if (idActual == null || !existente.getIdPersona().equals(idActual))
                throw new IllegalArgumentException("Ya existe una persona con ese DNI/CUIT: " + existente.getNombreCompleto());
        });
    }

    @Transactional
    public Persona crear(Persona p) {
        p.setIdPersona(null);
        normalizar(p);
        validar(p, null);
        if (p.getEstadoBcra() != null) p.setFechaUltimaAuditoria(LocalDate.now());

        // Notas cargadas junto con el alta: se vinculan a la persona nueva
        List<NotaPersona> notas = new ArrayList<>();
        if (p.getHistorialNotas() != null) {
            for (NotaPersona n : p.getHistorialNotas()) {
                if (n.getTexto() == null || n.getTexto().isBlank()) continue;
                n.setIdNota(null);
                n.setPersona(p);
                n.setTexto(n.getTexto().trim());
                if (n.getFecha() == null) n.setFecha(LocalDate.now());
                notas.add(n);
            }
        }
        p.setHistorialNotas(notas);
        return repo.save(p);
    }

    /** Edición desde el panel: conserva el historial de notas, el informe BCRA y la fecha de auditoría. */
    @Transactional
    public Optional<Persona> actualizar(Integer id, Persona incoming) {
        return repo.findById(id).map(actual -> {
            normalizar(incoming);
            validar(incoming, id);
            boolean cambioBcra = !Objects.equals(actual.getEstadoBcra(), incoming.getEstadoBcra());
            BeanUtils.copyProperties(incoming, actual, NO_COPIAR_AL_EDITAR);
            if (cambioBcra) actual.setFechaUltimaAuditoria(LocalDate.now());
            return repo.save(actual);
        });
    }

    /** Agrega una nota al historial de una persona ya guardada. */
    @Transactional
    public Optional<NotaPersona> agregarNota(Integer idPersona, String texto) {
        if (texto == null || texto.isBlank())
            throw new IllegalArgumentException("La nota no puede estar vacía");
        if (texto.length() > 2000)
            throw new IllegalArgumentException("La nota es demasiado larga (máximo 2000 caracteres)");
        return repo.findById(idPersona).map(persona -> {
            NotaPersona nota = new NotaPersona();
            nota.setPersona(persona);
            nota.setFecha(LocalDate.now());
            nota.setTexto(texto.trim());
            return notaRepo.save(nota);
        });
    }
}
