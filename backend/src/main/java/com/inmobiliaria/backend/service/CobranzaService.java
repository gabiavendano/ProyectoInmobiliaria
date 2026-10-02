package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.config.UsuarioActual;
import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * Cobranza de alquileres y rendiciones a propietarios.
 * Reglas:
 *  - Cada cobro genera un recibo correlativo y un movimiento de Ingreso.
 *  - La mora es del propietario (salvo cláusula expresa de retención).
 *  - Los cobros se rinden al propietario en una rendición que queda guardada; lo rendido no se vuelve a rendir.
 *  - Nada se borra: los cobros, movimientos y rendiciones se anulan.
 */
@Service
public class CobranzaService {

    @Autowired private ContratoService contratoService;
    @Autowired private LiquidacionRepository liquidacionRepo;
    @Autowired private MovimientoFinancieroRepository movimientoRepo;
    @Autowired private RendicionPropietarioRepository rendicionRepo;
    @Autowired private PersonaRepository personaRepo;
    @Autowired private CargoServicioRepository cargoRepo;
    @Autowired private ContratoRepository contratoRepo;

    // ── Cobros ────────────────────────────────────────────────────────

    public List<LiquidacionMensual> listarLiquidaciones() {
        return liquidacionRepo.findAll();
    }

    @Transactional
    public synchronized LiquidacionMensual registrarCobro(LiquidacionMensual liq) {
        // Datos que nunca deben venir del cliente
        liq.setIdLiquidacion(null);
        liq.setIdMovimiento(null);
        liq.setIdRendicion(null);
        liq.setNumeroRecibo(null);
        liq.setMotivoAnulacion(null);
        liq.setRegistradoPor(UsuarioActual.nombre());
        liq.setAnuladoPor(null);
        if (liq.getFechaPagoReal() == null)
            throw new IllegalArgumentException("Indicá la fecha en que el inquilino pagó.");
        liq.setEstadoRendicion(LiquidacionMensual.EstadoRendicion.CobradoInquilino);

        // Alquileres temporarios: la seña y el saldo de la estadía tienen sus propias reglas
        ContratoOperacion ctEst = liq.getContrato() == null || liq.getContrato().getIdOperacion() == null ? null
            : contratoRepo.findById(liq.getContrato().getIdOperacion()).orElse(null);
        String conceptoPedido = liq.getConcepto() == null ? "" : liq.getConcepto().trim();
        boolean estadia = esEstadia(ctEst) && esConceptoEstadia(conceptoPedido);
        if (esEstadia(ctEst) && !estadia && (conceptoPedido.isEmpty() || "Alquiler".equals(conceptoPedido)))
            throw new IllegalStateException("Esta es una estadía temporaria: cobrá la \"Seña de estadía\" o el \"Saldo de estadía\" (no un alquiler mensual).");
        if (!esEstadia(ctEst) && ctEst != null && esConceptoEstadia(conceptoPedido))
            throw new IllegalStateException("La seña y el saldo de estadía solo se cobran en alquileres temporarios.");
        if (estadia) prepararCobroEstadia(liq, ctEst, conceptoPedido);

        // Servicios y expensas prorrateados que se cobran junto con el alquiler
        List<CargoServicio> cargos = new ArrayList<>();
        BigDecimal servicios = BigDecimal.ZERO;
        boolean esAlquilerMes = liq.getConcepto() == null || liq.getConcepto().isBlank() || "Alquiler".equals(liq.getConcepto().trim());
        if (!esAlquilerMes && liq.getCargosIds() != null && !liq.getCargosIds().isEmpty())
            throw new IllegalArgumentException("Los servicios y expensas solo se cobran junto con el alquiler del mes.");
        StringBuilder detalle = new StringBuilder();
        if (liq.getCargosIds() != null && !liq.getCargosIds().isEmpty()) {
            Integer idContrato = liq.getContrato() == null ? null : liq.getContrato().getIdOperacion();
            ContratoOperacion c = contratoRepo.findById(idContrato == null ? -1 : idContrato)
                .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
            for (Integer idCargo : new LinkedHashSet<>(liq.getCargosIds())) {
                CargoServicio cs = cargoRepo.findById(idCargo).orElseThrow(() -> new IllegalArgumentException("Cargo no encontrado: " + idCargo));
                if (!"Pendiente".equals(cs.getEstado()))
                    throw new IllegalStateException("El cargo \"" + cs.getConcepto() + "\" ya no está pendiente.");
                if (cs.getPropiedad() == null || c.getPropiedad() == null || !cs.getPropiedad().getIdPropiedad().equals(c.getPropiedad().getIdPropiedad()))
                    throw new IllegalStateException("El cargo \"" + cs.getConcepto() + "\" no corresponde a la propiedad de este alquiler.");
                cargos.add(cs);
                servicios = servicios.add(cs.getMonto());
                if (detalle.length() > 0) detalle.append("\n");
                detalle.append(cs.getConcepto()).append(" ").append(cs.getPeriodoMesAnio()).append("|").append(cs.getMonto().toPlainString());
            }
        }
        liq.setMontoServicios(servicios);
        liq.setServiciosDetalle(detalle.length() == 0 ? null : (detalle.length() > 1000 ? detalle.substring(0, 1000) : detalle.toString()));

        LiquidacionMensual g = contratoService.registrarLiquidacion(liq);
        g.setNumeroRecibo(proximoRecibo());

        MovimientoFinanciero m = new MovimientoFinanciero();
        m.setFecha(g.getFechaPagoReal());
        m.setPropiedad(g.getContrato().getPropiedad());
        m.setPersona(g.getContrato().getCompradorInquilino());
        m.setTipo("Ingreso");
        m.setMonto(g.getTotalAbonadoInquilino());
        m.setMoneda(Monedas.aMovimiento(g.getMoneda()));
        m.setMedioPago(g.getMedioPago());
        m.setEstado("Completado");
        m.setConceptoIngreso(etiqueta(g)
            + (g.getMontoMoraCalculado().signum() > 0 ? " (incluye mora)" : "")
            + (g.getMontoServicios().signum() > 0 ? " + servicios y expensas" : ""));
        m.setObservaciones("Recibo N° " + g.getNumeroRecibo());
        m.setOrigen("Cobranza");
        m.setRegistradoPor(UsuarioActual.nombre());
        g.setIdMovimiento(movimientoRepo.save(m).getIdMovimiento());
        LiquidacionMensual guardada = liquidacionRepo.save(g);
        for (CargoServicio cs : cargos) {
            cs.setEstado("Cobrado");
            cs.setIdLiquidacion(guardada.getIdLiquidacion());
            cargoRepo.save(cs);
        }
        return estadia ? completarCobroEstadia(guardada, ctEst) : guardada;
    }

    // ── Estadías temporarias: seña y saldo ────────────────────────────

    static final String SENIA_ESTADIA = "Seña de estadía";
    static final String SALDO_ESTADIA = "Saldo de estadía";

    static boolean esConceptoEstadia(String c) { return SENIA_ESTADIA.equals(c) || SALDO_ESTADIA.equals(c); }

    static boolean esEstadia(ContratoOperacion c) {
        return c != null && c.getTipoContrato() == ContratoOperacion.TipoContrato.Locacion && c.getTempCheckIn() != null;
    }

    private static BigDecimal cero(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    /** Cobros vigentes (no anulados) de seña y saldo de una estadía, sin contar el que se está registrando. */
    private List<LiquidacionMensual> cobrosEstadia(Integer idOperacion, Integer exceptoId) {
        return liquidacionRepo.findByContratoIdOperacion(idOperacion).stream()
            .filter(l -> !Boolean.TRUE.equals(l.getAnulada()) && esConceptoEstadia(l.getConcepto()))
            .filter(l -> exceptoId == null || !exceptoId.equals(l.getIdLiquidacion()))
            .toList();
    }

    /** Valida el importe y deja listos los datos del cobro: sin vencimiento ni mora, y honorarios del propietario según el contrato. */
    private void prepararCobroEstadia(LiquidacionMensual liq, ContratoOperacion c, String concepto) {
        if (c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente && c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Finalizado)
            throw new IllegalStateException("La estadía no está vigente ni finalizada (estado: " + c.getEstadoContrato() + ").");
        BigDecimal importe = liq.getMontoAlquilerBase();
        if (importe == null || importe.signum() <= 0) throw new IllegalArgumentException("El importe a cobrar debe ser mayor a cero.");
        BigDecimal total = cero(c.getTempPrecioTotal());
        if (total.signum() <= 0) throw new IllegalStateException("La estadía no tiene precio total cargado.");
        List<LiquidacionMensual> previas = cobrosEstadia(c.getIdOperacion(), null);
        BigDecimal cobrado = previas.stream().map(l -> cero(l.getMontoAlquilerBase())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendiente = total.subtract(cobrado);
        if (pendiente.signum() <= 0) throw new IllegalStateException("Esta estadía ya está cobrada por completo.");
        if (importe.compareTo(pendiente) > 0)
            throw new IllegalStateException("El importe supera lo que falta cobrar de la estadía (pendiente: " + pendiente.toPlainString() + ").");
        if (SENIA_ESTADIA.equals(concepto)) {
            if (previas.stream().anyMatch(l -> SENIA_ESTADIA.equals(l.getConcepto())))
                throw new IllegalStateException("La seña de esta estadía ya fue cobrada. Si hay que corregirla, anulá primero ese recibo.");
            if (cero(c.getTempSenia()).signum() <= 0)
                throw new IllegalStateException("Esta estadía no tiene seña pactada: cobrá directamente el saldo.");
            if (importe.compareTo(c.getTempSenia()) > 0)
                throw new IllegalStateException("La seña pactada es de " + c.getTempSenia().toPlainString() + ": el importe no puede superarla.");
        }
        if (liq.getFechaPagoReal() == null) throw new IllegalArgumentException("Indicá la fecha de pago.");
        liq.setConcepto(concepto);
        liq.setMesAnoLiquidado(liq.getFechaPagoReal().toString().substring(0, 7));
        liq.setFechaVencimiento(liq.getFechaPagoReal());
        liq.setMoraParaInmobiliaria(false);
        // Honorarios a cargo del propietario (Parte A) según lo pactado en el contrato (escala de temporada: 10 %)
        BigDecimal pct = "Anulado".equals(c.getHonParteAEstado()) ? BigDecimal.ZERO
            : (c.getHonParteAPorcentaje() != null ? c.getHonParteAPorcentaje() : new BigDecimal("10.00"));
        liq.setPorcentajeHonorariosAdministracion(pct);
    }

    /** Después de guardar el cobro: saldo de la estadía, fechas en el contrato y honorarios retenidos al propietario. */
    private LiquidacionMensual completarCobroEstadia(LiquidacionMensual g, ContratoOperacion c) {
        BigDecimal total = cero(c.getTempPrecioTotal());
        BigDecimal cobrado = cobrosEstadia(c.getIdOperacion(), null).stream()
            .map(l -> cero(l.getMontoAlquilerBase())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal saldo = total.subtract(cobrado).max(BigDecimal.ZERO);
        g.setMontoAlquilerMes(total);
        g.setSaldoAlquilerPendiente(saldo);
        g.setPagoParcial(saldo.signum() > 0);
        if (SENIA_ESTADIA.equals(g.getConcepto())) c.setTempSeniaCobradaFecha(g.getFechaPagoReal());
        if (saldo.signum() == 0) c.setTempSaldoCobradoFecha(g.getFechaPagoReal());
        imputarHonorariosEstadia(c, cero(g.getMontoComisionInmobiliaria()), g.getFechaPagoReal());
        contratoRepo.save(c);
        return liquidacionRepo.save(g);
    }

    /** Suma (o resta, si el cobro se anula) lo retenido al propietario a los honorarios Parte A del contrato. */
    private void imputarHonorariosEstadia(ContratoOperacion c, BigDecimal delta, LocalDate fecha) {
        BigDecimal monto = cero(c.getHonParteAMonto());
        if ("Anulado".equals(c.getHonParteAEstado()) || monto.signum() <= 0 || delta.signum() == 0) return;
        BigDecimal cobrado = cero(c.getHonParteACobrado()).add(delta).max(BigDecimal.ZERO).min(monto);
        c.setHonParteACobrado(cobrado);
        if (delta.signum() > 0) c.setHonParteAFechaCobro(fecha);
        String estadoActual = c.getHonParteAEstado();
        if (cobrado.compareTo(monto) >= 0) c.setHonParteAEstado("Abonado");
        else if (cobrado.signum() > 0) c.setHonParteAEstado("Parcialmente abonado");
        else if ("Abonado".equals(estadoActual) || "Parcialmente abonado".equals(estadoActual)) c.setHonParteAEstado("Pendiente");
    }

    /** Al anular un cobro de estadía: se revierten las fechas del contrato y los honorarios retenidos. */
    private void revertirCobroEstadia(LiquidacionMensual l) {
        ContratoOperacion c = l.getContrato();
        if (!esEstadia(c) || !esConceptoEstadia(l.getConcepto())) return;
        List<LiquidacionMensual> otras = cobrosEstadia(c.getIdOperacion(), l.getIdLiquidacion());
        BigDecimal cobrado = otras.stream().map(x -> cero(x.getMontoAlquilerBase())).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (cero(c.getTempPrecioTotal()).subtract(cobrado).signum() > 0) c.setTempSaldoCobradoFecha(null);
        if (SENIA_ESTADIA.equals(l.getConcepto()) && otras.stream().noneMatch(x -> SENIA_ESTADIA.equals(x.getConcepto())))
            c.setTempSeniaCobradaFecha(null);
        imputarHonorariosEstadia(c, cero(l.getMontoComisionInmobiliaria()).negate(), null);
        contratoRepo.save(c);
    }

    /** Texto del concepto cobrado: "Alquiler 2026-09", "Pago a cuenta de alquiler 2026-09", "Saldo de alquiler 2026-09" u otro concepto. */
    static String etiqueta(LiquidacionMensual l) {
        if (esConceptoEstadia(l.getConcepto()) && esEstadia(l.getContrato()) && l.getContrato().getTempCheckOut() != null) {
            java.time.format.DateTimeFormatter f = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
            return l.getConcepto() + " (" + l.getContrato().getTempCheckIn().format(f) + " al " + l.getContrato().getTempCheckOut().format(f) + ")";
        }
        if (l.getConcepto() != null && !l.getConcepto().isBlank() && !"Alquiler".equals(l.getConcepto())) return l.getConcepto();
        if (Boolean.TRUE.equals(l.getPagoParcial())) {
            boolean saldoCero = l.getSaldoAlquilerPendiente() != null && l.getSaldoAlquilerPendiente().signum() == 0;
            return (saldoCero ? "Saldo de alquiler " : "Pago a cuenta de alquiler ") + l.getMesAnoLiquidado();
        }
        return "Alquiler " + l.getMesAnoLiquidado();
    }

    private String proximoRecibo() {
        int max = 0;
        for (LiquidacionMensual l : liquidacionRepo.findAll()) {
            String n = l.getNumeroRecibo();
            if (n != null && n.matches("\\d{4}-\\d{8}")) max = Math.max(max, Integer.parseInt(n.substring(5)));
        }
        return String.format("0001-%08d", max + 1);
    }

    @Transactional
    public LiquidacionMensual anularCobro(Integer id, String motivo) {
        LiquidacionMensual l = liquidacionRepo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Cobro no encontrado."));
        if (Boolean.TRUE.equals(l.getAnulada())) throw new IllegalStateException("El cobro ya está anulado.");
        if (l.getIdRendicion() != null)
            throw new IllegalStateException("Este cobro ya fue rendido al propietario. Anulá primero la rendición.");
        if (motivo == null || motivo.isBlank()) throw new IllegalArgumentException("Indicá el motivo de la anulación.");
        l.setAnulada(true);
        l.setMotivoAnulacion(motivo.trim());
        l.setAnuladoPor(UsuarioActual.nombre());
        if (l.getIdMovimiento() != null) {
            movimientoRepo.findById(l.getIdMovimiento()).ifPresent(m -> {
                m.setEstado("Anulado");
                m.setAnuladoPor(UsuarioActual.nombre());
                m.setObservaciones(("Anulado: " + motivo.trim() + " | " + (m.getObservaciones() == null ? "" : m.getObservaciones())));
                movimientoRepo.save(m);
            });
        }
        revertirCobroEstadia(l);
        // Los servicios incluidos en este cobro vuelven a quedar pendientes de cobrar
        for (CargoServicio cs : cargoRepo.findByIdLiquidacion(l.getIdLiquidacion())) {
            cs.setEstado("Pendiente");
            cs.setIdLiquidacion(null);
            cargoRepo.save(cs);
        }
        return liquidacionRepo.save(l);
    }

    // ── Rendiciones ───────────────────────────────────────────────────

    private boolean rendible(LiquidacionMensual l, Integer idPropietario, String mesAno, String moneda) {
        if (Boolean.TRUE.equals(l.getAnulada()) || l.getFechaPagoReal() == null || l.getIdRendicion() != null) return false;
        if (!mesAno.equals(l.getMesAnoLiquidado())) return false;
        if (!moneda.equals(l.getMoneda() == null ? "ARS" : l.getMoneda())) return false;
        ContratoOperacion c = l.getContrato();
        return c != null && c.getVendedorPropietario() != null && idPropietario.equals(c.getVendedorPropietario().getIdPersona());
    }

    private RendicionPropietario.LineaRendicion linea(String desc, BigDecimal monto) {
        RendicionPropietario.LineaRendicion x = new RendicionPropietario.LineaRendicion();
        x.setDescripcion(desc);
        x.setMonto(monto);
        return x;
    }

    /** Arma (sin guardar) las líneas de la rendición: cobros del mes pendientes de rendir del propietario. */
    public Map<String, Object> previewRendicion(Integer idPropietario, String mesAno, String moneda) {
        return previewRendicion(idPropietario, mesAno, moneda, true);
    }

    /**
     * @param incluirServicios si es true, los servicios/expensas cobrados al inquilino se rinden al propietario
     *                         (sin honorarios) como líneas propias de cada unidad; si es false quedan en poder de la inmobiliaria
     *                         (cuando ella paga la factura al consorcio o ente).
     */
    public Map<String, Object> previewRendicion(Integer idPropietario, String mesAno, String moneda, boolean incluirServicios) {
        if (idPropietario == null) throw new IllegalArgumentException("Elegí el propietario.");
        if (mesAno == null || !mesAno.matches("\\d{4}-(0[1-9]|1[0-2])"))
            throw new IllegalArgumentException("El mes debe tener formato AAAA-MM (ej: 2026-09).");
        String mon = Monedas.normalizar(moneda);
        List<LiquidacionMensual> liqs = new ArrayList<>();
        for (LiquidacionMensual l : liquidacionRepo.findAll()) if (rendible(l, idPropietario, mesAno, mon)) liqs.add(l);
        liqs.sort(Comparator.comparing(LiquidacionMensual::getIdLiquidacion));

        List<RendicionPropietario.LineaRendicion> lineas = new ArrayList<>();
        Set<String> props = new LinkedHashSet<>();
        BigDecimal bruto = BigDecimal.ZERO;
        for (LiquidacionMensual l : liqs) {
            ContratoOperacion c = l.getContrato();
            String prop = c.getPropiedad() != null && c.getPropiedad().getTitulo() != null ? c.getPropiedad().getTitulo() : "Propiedad";
            String inq = c.getCompradorInquilino() != null ? c.getCompradorInquilino().getNombreCompleto() : "";
            props.add(prop);
            String base = prop + (inq.isBlank() ? "" : " (" + inq + ")");
            lineas.add(linea(base + " — " + etiqueta(l), l.getMontoAlquilerBase()));
            if (l.getMontoMoraCalculado() != null && l.getMontoMoraCalculado().signum() > 0)
                lineas.add(linea(base + " — Intereses por mora (" + l.getDiasAtraso() + " días)", l.getMontoMoraCalculado()));
            if (incluirServicios && l.getServiciosDetalle() != null && !l.getServiciosDetalle().isBlank()) {
                for (String fila : l.getServiciosDetalle().split("\\n")) {
                    String[] pr = fila.split("\\|");
                    if (pr.length < 2) continue;
                    try {
                        BigDecimal m = new BigDecimal(pr[1].trim());
                        lineas.add(linea(base + " — Servicios: " + pr[0].trim(), m));
                        bruto = bruto.add(m);
                    } catch (NumberFormatException ignorado) { /* línea mal formada: se omite */ }
                }
            }
            boolean esEst = esConceptoEstadia(l.getConcepto()) && esEstadia(c);
            String honDesc = (esEst ? "Honorarios por alquiler temporario (" : "Honorarios de administración (") + l.getPorcentajeHonorariosAdministracion().stripTrailingZeros().toPlainString() + "%"
                + (Boolean.TRUE.equals(l.getEsCoCorretajeMensual()) ? ", co-corretaje" : "")
                + (Boolean.TRUE.equals(l.getMoraParaInmobiliaria()) ? " + mora retenida" : "") + ")";
            lineas.add(linea(base + " — " + honDesc, l.getMontoComisionInmobiliaria().negate()));
            bruto = bruto.add(l.getMontoNetoARendir());
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("idPropietario", idPropietario);
        r.put("mesAno", mesAno);
        r.put("moneda", mon);
        r.put("cobros", liqs.size());
        r.put("idsLiquidaciones", liqs.stream().map(LiquidacionMensual::getIdLiquidacion).toList());
        r.put("propiedades", new ArrayList<>(props));
        r.put("lineas", lineas);
        r.put("subtotal", bruto);
        return r;
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public RendicionPropietario generarRendicion(Map<String, Object> data) {
        Integer idProp = data.get("idPropietario") == null ? null : Integer.parseInt(data.get("idPropietario").toString());
        String mesAno = (String) data.get("mesAno");
        String moneda = Monedas.normalizar(data.get("moneda"));
        Persona propietario = personaRepo.findById(idProp == null ? -1 : idProp)
            .orElseThrow(() -> new IllegalArgumentException("Propietario no encontrado."));
        Map<String, Object> prev = previewRendicion(idProp, mesAno, moneda, !Boolean.FALSE.equals(data.get("incluirServicios")));
        List<Integer> ids = (List<Integer>) prev.get("idsLiquidaciones");
        if (ids.isEmpty())
            throw new IllegalStateException("No hay cobros de " + mesAno + " pendientes de rendir para este propietario.");

        final RendicionPropietario r = new RendicionPropietario();
        r.setPropietario(propietario);
        r.setMesAno(mesAno);
        r.setMoneda(moneda);
        r.setFechaRender(LocalDate.now());
        r.setEstado("Pendiente");
        r.setGeneradaPor(UsuarioActual.nombre());
        r.getLineas().addAll((List<RendicionPropietario.LineaRendicion>) prev.get("lineas"));
        r.getPropiedadesNombres().addAll((List<String>) prev.get("propiedades"));

        BigDecimal total = (BigDecimal) prev.get("subtotal");
        total = cargarGenerico(data.get("gastos"), (d, m) -> {
            var g = new RendicionPropietario.GastoRendicion(); g.setDescripcion(d); g.setMonto(m); r.getGastosGenerales().add(g);
        }, total);
        total = cargarGenerico(data.get("transferencias"), (d, m) -> {
            var t = new RendicionPropietario.TransferenciaRendicion(); t.setDescripcion(d); t.setMonto(m); r.getTransferenciasParciales().add(t);
        }, total);
        if (total.signum() < 0)
            throw new IllegalArgumentException("El total a depositar es negativo: los gastos y adelantos superan lo cobrado.");
        r.setTotalNeto(total);
        rendicionRepo.save(r);
        r.setComprobante("REN-" + mesAno.replace("-", "") + "-" + r.getIdRendicion());

        for (Integer id : ids) {
            LiquidacionMensual l = liquidacionRepo.findById(id).orElseThrow();
            l.setIdRendicion(r.getIdRendicion());
            l.setEstadoRendicion(LiquidacionMensual.EstadoRendicion.RendidoAlPropietario);
            liquidacionRepo.save(l);
        }

        if (Boolean.TRUE.equals(data.get("crearTransferencia")) && total.signum() > 0) {
            MovimientoFinanciero m = new MovimientoFinanciero();
            m.setFecha(LocalDate.now());
            m.setPersona(propietario);
            m.setTipo("Transferencia");
            m.setMonto(total);
            m.setMoneda(Monedas.aMovimiento(moneda));
            m.setEstado("Programado");
            m.setConceptoIngreso("Rendición " + mesAno + " (" + r.getComprobante() + ")");
            m.setOrigen("Rendicion");
            m.setRegistradoPor(UsuarioActual.nombre());
            r.setIdMovimiento(movimientoRepo.save(m).getIdMovimiento());
        }
        return rendicionRepo.save(r);
    }

    @SuppressWarnings("unchecked")
    private BigDecimal cargarGenerico(Object raw, java.util.function.BiConsumer<String, BigDecimal> alta, BigDecimal total) {
        if (raw == null) return total;
        for (Object o : (List<Object>) raw) {
            Map<String, Object> it = (Map<String, Object>) o;
            String desc = it.get("descripcion") == null ? "" : it.get("descripcion").toString().trim();
            BigDecimal monto = new BigDecimal(String.valueOf(it.get("monto"))).setScale(2, RoundingMode.HALF_UP);
            if (desc.isEmpty()) throw new IllegalArgumentException("Cada gasto o adelanto necesita una descripción.");
            if (monto.signum() <= 0) throw new IllegalArgumentException("El monto de \"" + desc + "\" debe ser mayor a cero.");
            alta.accept(desc, monto);
            total = total.subtract(monto);
        }
        return total;
    }

    @Transactional
    public RendicionPropietario marcarTransferida(Integer id) {
        RendicionPropietario r = rendicionRepo.findById(id).orElseThrow(() -> new IllegalArgumentException("Rendición no encontrada."));
        if (!"Pendiente".equals(r.getEstado())) throw new IllegalStateException("Solo se puede marcar como transferida una rendición pendiente (estado: " + r.getEstado() + ").");
        r.setEstado("Transferida");
        r.setTransferidaPor(UsuarioActual.nombre());
        if (r.getIdMovimiento() != null) {
            movimientoRepo.findById(r.getIdMovimiento()).ifPresent(m -> { m.setEstado("Completado"); m.setFecha(LocalDate.now()); movimientoRepo.save(m); });
        } else {
            MovimientoFinanciero m = new MovimientoFinanciero();
            m.setFecha(LocalDate.now());
            m.setPersona(r.getPropietario());
            m.setTipo("Transferencia");
            m.setMonto(r.getTotalNeto());
            m.setMoneda(Monedas.aMovimiento(r.getMoneda()));
            m.setEstado("Completado");
            m.setConceptoIngreso("Rendición " + r.getMesAno() + " (" + r.getComprobante() + ")");
            m.setOrigen("Rendicion");
            r.setIdMovimiento(movimientoRepo.save(m).getIdMovimiento());
        }
        return rendicionRepo.save(r);
    }

    @Transactional
    public RendicionPropietario anularRendicion(Integer id, String motivo) {
        RendicionPropietario r = rendicionRepo.findById(id).orElseThrow(() -> new IllegalArgumentException("Rendición no encontrada."));
        if ("Anulada".equals(r.getEstado())) throw new IllegalStateException("La rendición ya está anulada.");
        if ("Transferida".equals(r.getEstado()))
            throw new IllegalStateException("La rendición ya fue transferida al propietario; no se puede anular.");
        if (motivo == null || motivo.isBlank()) throw new IllegalArgumentException("Indicá el motivo de la anulación.");
        r.setEstado("Anulada");
        r.setAnuladaPor(UsuarioActual.nombre());
        for (LiquidacionMensual l : liquidacionRepo.findAll()) {
            if (r.getIdRendicion().equals(l.getIdRendicion())) {
                l.setIdRendicion(null);
                l.setEstadoRendicion(LiquidacionMensual.EstadoRendicion.CobradoInquilino);
                liquidacionRepo.save(l);
            }
        }
        if (r.getIdMovimiento() != null) {
            movimientoRepo.findById(r.getIdMovimiento()).ifPresent(m -> {
                m.setEstado("Anulado");
                m.setAnuladoPor(UsuarioActual.nombre());
                m.setObservaciones("Anulado: " + motivo.trim());
                movimientoRepo.save(m);
            });
        }
        return rendicionRepo.save(r);
    }
}
