package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.repository.ContratoRepository;
import com.inmobiliaria.backend.repository.MovimientoFinancieroRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.inmobiliaria.backend.model.Persona;
import org.springframework.beans.BeanUtils;
import java.time.LocalDate;
import java.util.ArrayList;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import com.inmobiliaria.backend.dto.PropiedadPublicaDTO;
import java.net.URI;
import java.util.Locale;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;

@Service
public class PropiedadService {

    @Autowired
    private PropiedadRepository repo;

    @Autowired
    private ArchivoPropiedadService archivos;

    @Autowired private ContratoRepository contratoRepo;
    @Autowired private MovimientoFinancieroRepository movimientoRepo;

    private boolean tieneContratoVigente(Integer idPropiedad) {
        return contratoRepo.findByPropiedadIdPropiedad(idPropiedad).stream()
            .anyMatch(c -> c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Vigente);
    }

    public List<Propiedad> listarTodos()              { return repo.findAll(); }
    public Optional<Propiedad> buscarPorId(Integer id) { return repo.findById(id); }
    public Propiedad guardar(Propiedad p)              { return repo.save(p); }
    @Transactional
    public void eliminar(Integer id) {
        long unidades = repo.countByIdComplejo(id);
        if (unidades > 0)
            throw new IllegalStateException("El complejo tiene " + unidades + " unidad(es). Eliminá primero las unidades (o usá \"Dar de baja\" si solo querés sacarlo del mapa).");
        int contratos = contratoRepo.findByPropiedadIdPropiedad(id).size();
        if (contratos > 0)
            throw new IllegalStateException("No se puede eliminar: la propiedad tiene " + contratos
                + " contrato(s) asociado(s). Usá \"Dar de baja\" para sacarla de circulación sin perder el historial.");
        if (movimientoRepo.existsByPropiedadIdPropiedad(id))
            throw new IllegalStateException("No se puede eliminar: la propiedad tiene movimientos financieros registrados. Usá \"Dar de baja\".");
        Integer idComplejo = repo.findById(id).map(Propiedad::getIdComplejo).orElse(null);
        archivos.eliminarPropiedadConArchivos(id);
        if (idComplejo != null) {
            repo.findById(idComplejo).ifPresent(c -> { c.setCantUnidades((int) repo.countByIdComplejo(idComplejo)); repo.save(c); });
        }
    }
    
    public List<Propiedad> listarPorPropietario(Integer idPropietario) {
        return repo.findByPropietarioActualIdPersona(idPropietario);
    }
    
    @PersistenceContext
    private EntityManager em;

    // Campos que el formulario NO maneja: al editar se conservan tal como están en la base
    private static final String[] NO_COPIAR_AL_EDITAR = {
        "idPropiedad", "imagenes", "dateAdded", "linkEscrituraPdf", "linkInformeDominioPdf",
        "rutaCarpetaFotos", "agent", "tipoInternet", "idComplejo"
    };

    private void validar(Propiedad p) {
        if (p.getTitulo() == null || p.getTitulo().isBlank())
            throw new IllegalArgumentException("El título es obligatorio");
        if (p.getPrecio() == null || p.getPrecio().signum() <= 0)
            throw new IllegalArgumentException("El precio debe ser mayor a cero");
        if (p.getTipoInmueble() == null || p.getTipoOperacion() == null || p.getMoneda() == null)
            throw new IllegalArgumentException("Tipo de inmueble, operación y moneda son obligatorios");
        // Operaciones adicionales: sin repetir la principal ni valores nulos
        if (p.getOperacionesAdicionales() == null) p.setOperacionesAdicionales(new java.util.LinkedHashSet<>());
        p.getOperacionesAdicionales().removeIf(o -> o == null || o == p.getTipoOperacion());
        // Coordenadas del mapa: van las dos juntas y dentro de rango (el formulario las completa solo a partir de la dirección)
        Double lat = p.getLatitud(), lng = p.getLongitud();
        if ((lat == null) != (lng == null))
            throw new IllegalArgumentException("La latitud y la longitud deben cargarse juntas");
        if (lat != null && (lat.isNaN() || lng.isNaN() || lat < -90 || lat > 90 || lng < -180 || lng > 180))
            throw new IllegalArgumentException("Las coordenadas del mapa no son válidas");
        if (p.getIdComplejo() != null) {
            if (Boolean.TRUE.equals(p.getEsComplejo()))
                throw new IllegalArgumentException("Una unidad no puede ser a la vez un complejo");
            repo.findById(p.getIdComplejo()).filter(c -> Boolean.TRUE.equals(c.getEsComplejo()))
                .orElseThrow(() -> new IllegalArgumentException("El complejo indicado no existe"));
        }
        largo(p.getUnidadIdentificador(), 50, "Identificador de la unidad");
        validarLinkGoogleMaps(p);
        validarTextosYNumeros(p);
        if (p.getPropietarioActual() == null || p.getPropietarioActual().getIdPersona() == null)
            throw new IllegalArgumentException("La propiedad debe tener un propietario");
        Persona dueno = em.find(Persona.class, p.getPropietarioActual().getIdPersona());
        if (dueno == null) throw new IllegalArgumentException("El propietario indicado no existe");
        p.setPropietarioActual(dueno);
    }


    // ── Link de Google Maps: solo enlaces https de Google Maps (nunca texto libre ni otros sitios) ──
    private static final java.util.Set<String> HOSTS_MAPS = java.util.Set.of(
        "google.com", "www.google.com", "maps.google.com", "google.com.ar", "www.google.com.ar",
        "maps.app.goo.gl", "goo.gl", "g.co");

    public static boolean esLinkGoogleMapsValido(String link) {
        if (link == null || link.isBlank()) return true; // es opcional
        String t = link.trim();
        if (t.length() > 500 || t.chars().anyMatch(ch -> Character.isWhitespace(ch) || Character.isISOControl(ch))) return false;
        try {
            URI u = new URI(t);
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getUserInfo() != null) return false;
            String host = u.getHost().toLowerCase(Locale.ROOT);
            if (!HOSTS_MAPS.contains(host)) return false;
            String path = u.getPath() == null ? "" : u.getPath();
            // en google.com / google.com.ar solo vale la parte /maps ; goo.gl solo /maps
            if (host.startsWith("www.google.") || host.startsWith("google.")) return path.startsWith("/maps");
            if (host.equals("goo.gl")) return path.startsWith("/maps");
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void validarLinkGoogleMaps(Propiedad p) {
        String l = p.getLinkGoogleMaps();
        if (l == null || l.isBlank()) { p.setLinkGoogleMaps(null); return; }
        if (!esLinkGoogleMapsValido(l))
            throw new IllegalArgumentException("El link de Google Maps no es válido: debe ser un enlace https de Google Maps (por ejemplo https://maps.app.goo.gl/... o https://www.google.com/maps/...)");
        p.setLinkGoogleMaps(l.trim());
    }

    // ── Largos de texto y números no negativos (antes desbordaban la columna y daban un error genérico) ──
    private static void largo(String valor, int max, String campo) {
        if (valor != null && valor.length() > max)
            throw new IllegalArgumentException("\"" + campo + "\" es demasiado largo (máximo " + max + " caracteres)");
    }

    private static void noNegativo(Number n, String campo) {
        if (n != null && n.doubleValue() < 0)
            throw new IllegalArgumentException("\"" + campo + "\" no puede ser negativo");
    }

    private static final Set<String> NUMEROS_CON_SIGNO = Set.of("latitud", "longitud", "idPropiedad", "idComplejo");

    /** Revisa por reflexión todos los campos numéricos de la ficha: ninguno puede ser negativo (salvo coordenadas). */
    private static void validarNumerosNoNegativos(Propiedad p) {
        for (java.lang.reflect.Field f : Propiedad.class.getDeclaredFields()) {
            if (java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
            if (!Number.class.isAssignableFrom(f.getType()) || NUMEROS_CON_SIGNO.contains(f.getName())) continue;
            try {
                f.setAccessible(true);
                Object v = f.get(p);
                if (v instanceof Number n && n.doubleValue() < 0) {
                    String nombre = f.getName().replaceAll("([A-Z])", " $1").toLowerCase(Locale.ROOT);
                    throw new IllegalArgumentException("\"" + nombre + "\" no puede ser negativo");
                }
            } catch (IllegalAccessException ignored) { }
        }
    }

    private void validarTextosYNumeros(Propiedad p) {
        largo(p.getTitulo(), 150, "Título");
        largo(p.getCalle(), 150, "Calle");
        largo(p.getNumero(), 20, "Número");
        largo(p.getBarrio(), 100, "Barrio");
        largo(p.getLocalidad(), 100, "Localidad");
        largo(p.getProvincia(), 50, "Provincia");
        largo(p.getZona(), 50, "Zona");
        largo(p.getPriceStr(), 50, "Precio (texto)");
        largo(p.getUbicacionLlaves(), 200, "Ubicación de llaves");
        largo(p.getLegRestricciones(), 200, "Restricciones");
        largo(p.getLegMedidasCautelares(), 200, "Medidas cautelares");
        largo(p.getTerForma(), 50, "Forma del terreno");
        largo(p.getTorre(), 20, "Torre");
        largo(p.getBloque(), 20, "Bloque");
        largo(p.getUf(), 20, "UF");
        largo(p.getUc(), 20, "UC");
        largo(p.getCatFinca(), 50, "Finca");
        largo(p.getCodigoPostal(), 10, "Código postal");
        largo(p.getDepartamentoProv(), 50, "Departamento");
        largo(p.getLegLitigios(), 200, "Litigios");
        largo(p.getServidumbres(), 200, "Servidumbres");
        largo(p.getOcpGarantia(), 200, "Garantía");
        largo(p.getObsSuperficies(), 200, "Observaciones de superficies");
        largo(p.getEstadoFicha(), 50, "Estado de la ficha");
        largo(p.getEstadoVerificacion(), 50, "Verificación");
        largo(p.getFuenteVerificacion(), 50, "Fuente de verificación");
        // Ningún campo numérico (superficies, cantidades, deudas, expensas, medidas…) puede ser negativo
        validarNumerosNoNegativos(p);
        noNegativo(p.getSupTotal(), "Sup. total");
        noNegativo(p.getSupConstruida(), "Sup. construida");
        noNegativo(p.getSupMensura(), "Sup. según mensura");
        noNegativo(p.getOcpMonto(), "Monto de ocupación");
        noNegativo(p.getAntiguedad(), "Antigüedad");
        noNegativo(p.getCantDormitorios(), "Dormitorios");
        noNegativo(p.getCantBanos(), "Baños");
        noNegativo(p.getCantAmbientes(), "Ambientes");
        noNegativo(p.getCantCocheras(), "Cocheras");
        noNegativo(p.getSuperficieTotalM2(), "Superficie total");
        noNegativo(p.getSupCubierta(), "Superficie cubierta");
        noNegativo(p.getTerSup(), "Superficie del terreno");
        noNegativo(p.getComisionPactada(), "Honorarios");
        if (p.getComisionPactada() != null && p.getComisionPactada().doubleValue() > 100)
            throw new IllegalArgumentException("Los honorarios no pueden superar el 100%");
        Integer anio = p.getAnioConstruccion();
        if (anio != null && (anio < 1500 || anio > LocalDate.now().getYear() + 5))
            throw new IllegalArgumentException("El año de construcción no es válido");
    }

    /** Alta desde el panel: ignora cualquier id o imágenes que vengan en el pedido. */
    @Transactional
    public Propiedad crear(Propiedad p) {
        p.setIdPropiedad(null);
        p.setImagenes(new ArrayList<>());
        p.setIdComplejo(null);          // las unidades se crean desde la ficha del complejo
        p.setCantUnidades(0);
        p.setDateAdded(LocalDate.now());
        validar(p);
        return repo.save(p);
    }

    /** Edición desde el panel: actualiza lo que envía el formulario y conserva imágenes, links y fecha de alta. */
    @Transactional
    public Optional<Propiedad> actualizar(Integer id, Propiedad incoming) {
        return repo.findById(id).map(actual -> {
            validar(incoming);
            long unidades = repo.countByIdComplejo(id);
            if (unidades > 0 && !Boolean.TRUE.equals(incoming.getEsComplejo()))
                throw new IllegalArgumentException("Este complejo tiene " + unidades + " unidad(es): no se puede desactivar \"Complejo\" mientras existan.");
            // Si el formulario no manda el estado, se conserva el actual (antes quedaba en null)
            if (incoming.getEstadoPropiedad() == null) incoming.setEstadoPropiedad(actual.getEstadoPropiedad());
            BeanUtils.copyProperties(incoming, actual, NO_COPIAR_AL_EDITAR);
            actual.setCantUnidades(Boolean.TRUE.equals(actual.getEsComplejo()) ? (int) unidades : 0);
            Propiedad guardada = repo.save(actual);
            if (unidades > 0) propagarUbicacionAUnidades(guardada);
            return guardada;
        });
    }

    // ───────────────────────────── COMPLEJOS Y UNIDADES ─────────────────────────────

    public static String armarPriceStr(BigDecimal precio, Propiedad.Moneda moneda, Propiedad.TipoOperacion op) {
        String simbolo = Monedas.simbolo(moneda == null ? null : moneda.name());
        String sufijo = op == Propiedad.TipoOperacion.AlquilerPermanente ? " / mes"
                : op == Propiedad.TipoOperacion.AlquilerTemporario ? " / noche" : "";
        BigDecimal v = precio == null ? BigDecimal.ZERO : precio.setScale(0, RoundingMode.HALF_UP);
        return simbolo + " " + NumberFormat.getIntegerInstance(java.util.Locale.forLanguageTag("es-AR")).format(v) + sufijo;
    }

    /** La dirección y el punto del mapa son del complejo: las unidades los heredan cada vez que se edita el complejo. */
    private void propagarUbicacionAUnidades(Propiedad c) {
        for (Propiedad u : repo.findByIdComplejoOrderByIdPropiedadAsc(c.getIdPropiedad())) {
            u.setProvincia(c.getProvincia());
            u.setDepartamentoProv(c.getDepartamentoProv());
            u.setLocalidad(c.getLocalidad());
            u.setBarrio(c.getBarrio());
            u.setSubBarrio(c.getSubBarrio());
            u.setCalle(c.getCalle());
            u.setNumero(c.getNumero());
            u.setCodigoPostal(c.getCodigoPostal());
            u.setZona(c.getZona());
            u.setLatitud(c.getLatitud());
            u.setLongitud(c.getLongitud());
            u.setShowExactLocation(c.getShowExactLocation());
            repo.save(u);
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listarUnidades(Integer idComplejo) {
        repo.findById(idComplejo).orElseThrow(() -> new IllegalArgumentException("Propiedad no encontrada"));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Propiedad u : repo.findByIdComplejoOrderByIdPropiedadAsc(idComplejo)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("idPropiedad", u.getIdPropiedad());
            m.put("identificador", u.getUnidadIdentificador());
            m.put("titulo", u.getTitulo());
            m.put("tipoInmueble", u.getTipoInmueble() == null ? null : u.getTipoInmueble().name());
            m.put("precio", u.getPrecio());
            m.put("moneda", u.getMoneda() == null ? null : u.getMoneda().name());
            m.put("estadoPropiedad", u.getEstadoPropiedad() == null ? null : u.getEstadoPropiedad().name());
            m.put("cantAmbientes", u.getCantAmbientes());
            m.put("superficieTotalM2", u.getSuperficieTotalM2());
            m.put("cantFotos", u.getImagenes() == null ? 0 : u.getImagenes().size());
            out.add(m);
        }
        return out;
    }

    /** Crea N unidades nuevas (Disponibles) que heredan dirección, punto del mapa, propietario y operación del complejo. */
    @Transactional
    public List<Map<String, Object>> generarUnidades(Integer idComplejo, int cantidad, String prefijo, String tipo, BigDecimal precio) {
        Propiedad c = repo.findById(idComplejo).orElseThrow(() -> new IllegalArgumentException("Propiedad no encontrada"));
        if (!Boolean.TRUE.equals(c.getEsComplejo()) || c.getIdComplejo() != null)
            throw new IllegalArgumentException("Esta propiedad no está marcada como complejo");
        if (cantidad < 1 || cantidad > 100)
            throw new IllegalArgumentException("Se pueden crear entre 1 y 100 unidades por vez");
        List<Propiedad> existentes = repo.findByIdComplejoOrderByIdPropiedadAsc(idComplejo);
        if (existentes.size() + cantidad > 300)
            throw new IllegalArgumentException("Un complejo puede tener hasta 300 unidades");
        String pref = prefijo == null || prefijo.isBlank() ? "Unidad" : prefijo.trim();
        if (pref.length() > 35) throw new IllegalArgumentException("El nombre de las unidades es demasiado largo (máximo 35 caracteres)");
        Propiedad.TipoInmueble t = c.getTipoInmueble();
        if (tipo != null && !tipo.isBlank()) {
            try { t = Propiedad.TipoInmueble.valueOf(tipo.trim()); }
            catch (IllegalArgumentException e) { throw new IllegalArgumentException("Tipo de inmueble inválido"); }
        }
        BigDecimal pr = precio != null ? precio : c.getPrecio();
        if (pr == null || pr.signum() <= 0) throw new IllegalArgumentException("Indicá un precio mayor a cero para las unidades");
        if (pr.compareTo(new BigDecimal("1000000000000")) > 0) throw new IllegalArgumentException("El precio es demasiado alto");

        Set<String> usados = new HashSet<>();
        for (Propiedad e : existentes) if (e.getUnidadIdentificador() != null) usados.add(e.getUnidadIdentificador().toLowerCase());
        int n = existentes.size();
        String base = c.getTitulo() == null ? "" : c.getTitulo();
        for (int i = 0; i < cantidad; i++) {
            String ident;
            do { n++; ident = pref + " " + n; } while (usados.contains(ident.toLowerCase()));
            usados.add(ident.toLowerCase());
            Propiedad u = new Propiedad();
            u.setIdComplejo(idComplejo);
            u.setEsComplejo(false);
            u.setCantUnidades(0);
            u.setUnidadIdentificador(ident);
            String sufijoTitulo = " - " + ident;
            u.setTitulo((base.length() + sufijoTitulo.length() > 150 ? base.substring(0, 150 - sufijoTitulo.length()) : base) + sufijoTitulo);
            u.setPropietarioActual(c.getPropietarioActual());
            u.setTipoOperacion(c.getTipoOperacion());
            u.setMoneda(c.getMoneda());
            u.setTipoInmueble(t);
            u.setPrecio(pr);
            u.setPriceStr(armarPriceStr(pr, c.getMoneda(), c.getTipoOperacion()));
            u.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
            u.setDateAdded(LocalDate.now());
            u.setDescripcion(c.getDescripcion());
            u.setAmenities(new ArrayList<>(c.getAmenities() == null ? List.<String>of() : c.getAmenities()));
            repo.save(u);
        }
        repo.flush();
        propagarUbicacionAUnidades(c);
        c.setCantUnidades((int) repo.countByIdComplejo(idComplejo));
        repo.save(c);
        return listarUnidades(idComplejo);
    }

    /**
     * Listado PÚBLICO (mapa): devuelve solo los datos pensados para el sitio web (ver PropiedadPublicaDTO).
     * Nunca se expone la entidad completa: así no salen propietario, deudas, catastro ni notas internas.
     * Las unidades de un complejo no salen sueltas: aparecen dentro de su complejo (solo las Disponibles).
     * Un complejo con todas sus unidades ocupadas deja de publicarse.
     */
    @Transactional(readOnly = true)
    public List<PropiedadPublicaDTO> listarDisponiblesParaWeb() {
        Map<Integer, Integer> totalPorComplejo = new HashMap<>();
        Map<Integer, List<Propiedad>> libresPorComplejo = new HashMap<>();
        for (Propiedad u : repo.findByIdComplejoIsNotNull()) {
            totalPorComplejo.merge(u.getIdComplejo(), 1, Integer::sum);
            if (u.getEstadoPropiedad() == Propiedad.EstadoPropiedad.Disponible)
                libresPorComplejo.computeIfAbsent(u.getIdComplejo(), k -> new ArrayList<>()).add(u);
        }
        List<PropiedadPublicaDTO> out = new ArrayList<>();
        for (Propiedad p : repo.findAllDisponiblesForWeb()) {
            if (p.getIdComplejo() != null) continue;
            if (Boolean.TRUE.equals(p.getEsComplejo())) {
                int total = totalPorComplejo.getOrDefault(p.getIdPropiedad(), 0);
                List<Propiedad> libres = libresPorComplejo.getOrDefault(p.getIdPropiedad(), List.of());
                if (total > 0 && libres.isEmpty()) continue;
                out.add(PropiedadPublicaDTO.desdeComplejo(p, libres, total));
            } else {
                out.add(PropiedadPublicaDTO.desde(p));
            }
        }
        return out;
    }

    /** Cambia solo el estado (por ejemplo "dar de baja" = Inactiva) sin tocar el resto de la ficha. */
    @Transactional
    public Optional<Propiedad> cambiarEstado(Integer id, String estado) {
        Propiedad.EstadoPropiedad nuevo;
        try { nuevo = Propiedad.EstadoPropiedad.valueOf(estado == null ? "" : estado.trim()); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Estado de propiedad inválido"); }
        return repo.findById(id).map(p -> {
            boolean saleDeCirculacion = nuevo == Propiedad.EstadoPropiedad.Inactiva || nuevo == Propiedad.EstadoPropiedad.Suspendida;
            if (saleDeCirculacion && tieneContratoVigente(id))
                throw new IllegalStateException("No se puede dar de baja: la propiedad tiene un contrato vigente. Finalizalo o rescindilo primero.");
            if (nuevo == Propiedad.EstadoPropiedad.Disponible && tieneContratoVigente(id))
                throw new IllegalStateException("No se puede marcar como Disponible: tiene un contrato vigente. Finalizalo o rescindilo primero.");
            p.setEstadoPropiedad(nuevo);
            return repo.save(p);
        });
    }

    public Optional<Propiedad> buscarPorTituloContiene(String term) {
        return repo.findByTituloContainingIgnoreCase(term);
    }

    public List<Propiedad> listarPorTipoInmueble(Propiedad.TipoInmueble tipo) {
        return repo.findByTipoInmueble(tipo);
    }
}