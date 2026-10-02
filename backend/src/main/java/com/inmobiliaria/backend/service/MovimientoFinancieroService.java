package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.MovimientoFinanciero;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.MovimientoFinancieroRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class MovimientoFinancieroService {

    @Autowired
    private MovimientoFinancieroRepository repo;

    public List<MovimientoFinanciero> listarTodos() {
        return repo.findAll();
    }

    public List<MovimientoFinanciero> listarPorPropiedad(Integer idPropiedad) {
        return repo.findByPropiedadIdPropiedadOrderByFechaDesc(idPropiedad);
    }

    public List<MovimientoFinanciero> listarPorPersona(Integer idPersona) {
        return repo.findByPersonaIdPersonaOrderByFechaDesc(idPersona);
    }

    public List<MovimientoFinanciero> listarPorEstado(String estado) {
        return repo.findByEstadoOrderByFechaDesc(estado);
    }

    public List<MovimientoFinanciero> listarPorTipo(String tipo) {
        return repo.findByTipoOrderByFechaDesc(tipo);
    }

    public List<MovimientoFinanciero> listarPorRangoFechas(LocalDate inicio, LocalDate fin) {
        return repo.findByFechaBetweenOrderByFechaDesc(inicio, fin);
    }

    public static final java.util.Set<String> TIPOS = java.util.Set.of("Ingreso", "Egreso", "Transferencia");
    public static final java.util.Set<String> ESTADOS = java.util.Set.of("Completado", "Pendiente de Pago", "Programado", "Anulado");

    /** Valida y normaliza un movimiento antes de guardarlo. */
    public void validar(MovimientoFinanciero m) {
        if (m.getTipo() == null || !TIPOS.contains(m.getTipo()))
            throw new IllegalArgumentException("El tipo de movimiento debe ser Ingreso, Egreso o Transferencia.");
        if (m.getMonto() == null || m.getMonto().signum() <= 0)
            throw new IllegalArgumentException("El monto debe ser mayor a cero.");
        if (m.getMonto().compareTo(new BigDecimal("9999999999")) > 0)
            throw new IllegalArgumentException("El monto es demasiado grande.");
        if (m.getMoneda() == null) m.setMoneda(MovimientoFinanciero.Moneda.ARS);
        if (m.getEstado() == null || m.getEstado().isBlank()) m.setEstado("Completado");
        if (!ESTADOS.contains(m.getEstado()))
            throw new IllegalArgumentException("Estado inválido. Opciones: Completado, Pendiente de Pago, Programado o Anulado.");
        if (m.getFecha() == null) m.setFecha(LocalDate.now());
        if (!"Ingreso".equals(m.getTipo()) && !"Egreso".equals(m.getTipo()) && m.getPersona() == null)
            throw new IllegalArgumentException("Una transferencia necesita el propietario destinatario.");
        if ("Ingreso".equals(m.getTipo()) && m.getPersona() == null)
            throw new IllegalArgumentException("Indicá quién paga el ingreso.");
    }

    public MovimientoFinanciero guardar(MovimientoFinanciero m) {
        validar(m);
        m.setRegistradoPor(com.inmobiliaria.backend.config.UsuarioActual.nombre());
        m.setAnuladoPor(null);
        return repo.save(m);
    }

    /** Los movimientos no se borran (registro contable): se anulan. */
    public MovimientoFinanciero anular(Integer id, String motivo) {
        MovimientoFinanciero m = detalleMovimiento(id);
        if (m.getOrigen() != null && !"Manual".equals(m.getOrigen()))
            throw new IllegalStateException("Este movimiento fue generado por " + m.getOrigen()
                + ". Anulalo desde su origen (cobro, rendición o factura).");
        if ("Anulado".equals(m.getEstado())) throw new IllegalStateException("El movimiento ya está anulado.");
        if (motivo == null || motivo.isBlank()) throw new IllegalArgumentException("Indicá el motivo de la anulación.");
        m.setEstado("Anulado");
        m.setAnuladoPor(com.inmobiliaria.backend.config.UsuarioActual.nombre());
        String obs = "Anulado: " + motivo.trim() + (m.getObservaciones() == null || m.getObservaciones().isBlank() ? "" : " | " + m.getObservaciones());
        m.setObservaciones(obs.length() > 500 ? obs.substring(0, 500) : obs);
        return repo.save(m);
    }

    /** Edición de un movimiento cargado a mano. */
    public MovimientoFinanciero editar(Integer id, MovimientoFinanciero datos) {
        MovimientoFinanciero m = detalleMovimiento(id);
        if (m.getOrigen() != null && !"Manual".equals(m.getOrigen()))
            throw new IllegalStateException("Este movimiento fue generado por " + m.getOrigen() + " y se corrige desde allí.");
        if ("Anulado".equals(m.getEstado())) throw new IllegalStateException("Un movimiento anulado no se puede editar.");
        if ("Anulado".equals(datos.getEstado()))
            throw new IllegalArgumentException("Para anular usá la opción Anular (pide el motivo).");
        m.setFecha(datos.getFecha() != null ? datos.getFecha() : m.getFecha());
        m.setPropiedad(datos.getPropiedad());
        m.setPersona(datos.getPersona());
        m.setTipo(datos.getTipo() != null ? datos.getTipo() : m.getTipo());
        m.setMonto(datos.getMonto());
        m.setMoneda(datos.getMoneda());
        m.setMedioPago(datos.getMedioPago());
        m.setEstado(datos.getEstado());
        m.setConceptoIngreso(datos.getConceptoIngreso());
        m.setConceptoEgreso(datos.getConceptoEgreso());
        m.setRequiereAutorizacion(datos.getRequiereAutorizacion());
        m.setBancoDestino(datos.getBancoDestino());
        m.setCbuAlias(datos.getCbuAlias());
        m.setObservaciones(datos.getObservaciones());
        validar(m);
        return repo.save(m);
    }

    public BigDecimal sumarMovimientosPorPropiedad(Integer idPropiedad, String tipo) {
        List<MovimientoFinanciero> movs = repo.findByPropiedadIdPropiedadOrderByFechaDesc(idPropiedad);
        return movs.stream()
            .filter(m -> !"Anulado".equals(m.getEstado()))
            .filter(m -> tipo == null || tipo.equals(m.getTipo()))
            .map(MovimientoFinanciero::getMonto)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public MovimientoFinanciero crearMovimiento(Integer idPropiedad, Integer idPersona,
                                                   String tipo, BigDecimal monto,
                                                   String moneda, String medioPago,
                                                   String estado, String conceptoIngreso,
                                                   String conceptoEgreso, Boolean requiereAutorizacion,
                                                   String bancoDestino, String cbuAlias,
                                                   String observaciones) {
        MovimientoFinanciero m = new MovimientoFinanciero();
        m.setFecha(LocalDate.now());
        if (idPropiedad != null) {
            m.setPropiedad(new com.inmobiliaria.backend.model.Propiedad());
            m.getPropiedad().setIdPropiedad(idPropiedad);
        }
        if (idPersona != null) {
            m.setPersona(new com.inmobiliaria.backend.model.Persona());
            m.getPersona().setIdPersona(idPersona);
        }
        m.setTipo(tipo);
        m.setMonto(monto);
        m.setMoneda(moneda != null ? com.inmobiliaria.backend.model.MovimientoFinanciero.Moneda.valueOf(moneda) : null);
        m.setMedioPago(medioPago);
        m.setEstado(estado);
        m.setConceptoIngreso(conceptoIngreso);
        m.setConceptoEgreso(conceptoEgreso);
        m.setRequiereAutorizacion(requiereAutorizacion);
        m.setBancoDestino(bancoDestino);
        m.setCbuAlias(cbuAlias);
        m.setObservaciones(observaciones);
        m.setOrigen("Manual");
        validar(m);
        return repo.save(m);
    }


    public Optional<MovimientoFinanciero> buscarPorId(Integer id) {
        return repo.findById(id);
    }

    public MovimientoFinanciero actualizar(MovimientoFinanciero m) {
        return guardar(m);
    }

    public MovimientoFinanciero detalleMovimiento(Integer id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Movimiento no encontrado: " + id));
    }

    public Map<String, Object> totalesPorPropiedad(Integer idPropiedad, String inicio, String fin) {
        LocalDate startDate = inicio != null ? LocalDate.parse(inicio) : LocalDate.of(2020, 1, 1);
        LocalDate endDate   = fin != null ? LocalDate.parse(fin) : LocalDate.now();
        List<MovimientoFinanciero> movs = repo.findByPropiedadIdPropiedadAndFechaBetweenOrderByFechaDesc(
            idPropiedad, startDate, endDate).stream().filter(m -> !"Anulado".equals(m.getEstado())).toList();
        BigDecimal ingresos = movs.stream()
            .filter(m -> "Ingreso".equals(m.getTipo()))
            .map(MovimientoFinanciero::getMonto)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal egresos = movs.stream()
            .filter(m -> "Egreso".equals(m.getTipo()))
            .map(MovimientoFinanciero::getMonto)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal transferencias = movs.stream()
            .filter(m -> "Transferencia".equals(m.getTipo()))
            .map(MovimientoFinanciero::getMonto)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("ingresos", ingresos, "egresos", egresos, "transferencias", transferencias,
            "saldo", ingresos.subtract(egresos).subtract(transferencias), "cantidad", movs.size());
    }

    public Map<String, Object> totalesPorPeriodo(String mesAno) {
        // mesAno llega como "2026-09" (formato de YearMonth); no hay que agregarle "-01"
        YearMonth ym;
        try {
            ym = YearMonth.parse(mesAno);
        } catch (java.time.format.DateTimeParseException | NullPointerException e) {
            throw new IllegalArgumentException("Período inválido: use el formato AAAA-MM (ej: 2026-09).");
        }
        LocalDate inicio = ym.atDay(1);
        LocalDate fin = ym.atEndOfMonth();
        List<MovimientoFinanciero> movs = repo.findByFechaBetweenOrderByFechaDesc(inicio, fin).stream().filter(m -> !"Anulado".equals(m.getEstado())).toList();
        BigDecimal ingresos = movs.stream()
            .filter(m -> "Ingreso".equals(m.getTipo()))
            .map(MovimientoFinanciero::getMonto)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal egresos = movs.stream()
            .filter(m -> "Egreso".equals(m.getTipo()))
            .map(MovimientoFinanciero::getMonto)
            .filter(java.util.Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("periodo", mesAno, "ingresos", ingresos, "egresos", egresos,
            "saldo", ingresos.subtract(egresos), "cantidad", movs.size());
    }

    public String exportarCsv(Integer idPropiedad) {
        List<MovimientoFinanciero> movs = repo.findByPropiedadIdPropiedadOrderByFechaDesc(idPropiedad);
        StringBuilder sb = new StringBuilder();
        sb.append("Fecha,Tipo,Concepto,Monto,Moneda,MedioPago,Estado,Observaciones\n");
        for (MovimientoFinanciero m : movs) {
            String concepto = m.getConceptoIngreso() != null ? m.getConceptoIngreso() : m.getConceptoEgreso();
            // Locale.ROOT → siempre punto decimal (con el locale de Argentina saldría coma y rompería el CSV)
            String monto = m.getMonto() != null ? String.format(java.util.Locale.ROOT, "%.2f", m.getMonto()) : "";
            sb.append(csv(m.getFecha())).append(',')
              .append(csv(m.getTipo())).append(',')
              .append(csv(concepto)).append(',')
              .append(monto).append(',')
              .append(csv(m.getMoneda())).append(',')
              .append(csv(m.getMedioPago())).append(',')
              .append(csv(m.getEstado())).append(',')
              .append(csv(m.getObservaciones())).append('\n');
        }
        return sb.toString();
    }

    /** Escapa un valor para CSV (comillas, comas, saltos de línea) y neutraliza fórmulas de Excel (=,+,-,@). */
    private static String csv(Object valor) {
        if (valor == null) return "";
        String t = valor.toString();
        if (!t.isEmpty() && "=+-@".indexOf(t.charAt(0)) >= 0) t = "'" + t;
        if (t.contains(",") || t.contains("\"") || t.contains("\n") || t.contains("\r")) {
            t = "\"" + t.replace("\"", "\"\"") + "\"";
        }
        return t;
    }
}
