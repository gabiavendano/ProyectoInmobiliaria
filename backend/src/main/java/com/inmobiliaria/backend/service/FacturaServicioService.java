package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.FacturaServicio;
import com.inmobiliaria.backend.repository.FacturaServicioRepository;
import com.inmobiliaria.backend.model.Propiedad;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FacturaServicioService {

    @Autowired
    private FacturaServicioRepository repo;

    @Autowired
    private com.inmobiliaria.backend.repository.MovimientoFinancieroRepository movimientoRepo;

    // ── CRUD base ──────────────────────────────────────────────────────

    public List<FacturaServicio> listarTodos() {
        return repo.findAll();
    }

    public FacturaServicio guardar(FacturaServicio f) {
        return repo.save(f);
    }

    @Transactional
    public void eliminar(Integer id) {
        FacturaServicio f = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Factura no encontrada."));
        if (f.getEstadoPago() != FacturaServicio.EstadoPago.Pendiente)
            throw new IllegalStateException("Solo se pueden eliminar facturas pendientes; una factura pagada queda como registro.");
        repo.deleteById(id);
    }

    // ── Búsquedas ──────────────────────────────────────────────────────

    public List<FacturaServicio> filtrarPorEstado(String estado) {
        return repo.findByEstadoPagoOrderByFechaVencimientoAsc(FacturaServicio.EstadoPago.valueOf(estado));
    }

    public List<FacturaServicio> filtrarPorServicio(String servicio) {
        FacturaServicio.TipoServicio tipo = FacturaServicio.TipoServicio.valueOf(servicio);
        return repo.findAll().stream()
            .filter(factura -> factura.getTipoServicio() == tipo && factura.getPropiedad() != null)
            .collect(Collectors.toList());
    }

    public List<FacturaServicio> buscarPorTexto(String texto) {
        return repo.buscarPorTexto(texto);
    }

    // ── Cálculos ───────────────────────────────────────────────────────

    public BigDecimal obtenerTotalPorPropiedad(Integer idPropiedad) {
        return repo.sumarTotalPorPropiedad(idPropiedad);
    }

    // ── Acciones sobre una factura ─────────────────────────────────────

    /** pagadoPor: "Inmobiliaria" (genera un Egreso) o "Propietario" (por defecto). */
    @Transactional
    public FacturaServicio marcarPagado(Integer idFactura, String formaPago, String pagadoPor) {
        FacturaServicio f = repo.findById(idFactura)
            .orElseThrow(() -> new IllegalArgumentException("Factura no encontrada: " + idFactura));
        if (f.getEstadoPago() == FacturaServicio.EstadoPago.PagadoPorInmobiliaria
                || f.getEstadoPago() == FacturaServicio.EstadoPago.PagadoPorPropietario) {
            throw new IllegalStateException("La factura ya está pagada");
        }
        boolean inmo = "Inmobiliaria".equalsIgnoreCase(pagadoPor);
        f.setEstadoPago(inmo ? FacturaServicio.EstadoPago.PagadoPorInmobiliaria : FacturaServicio.EstadoPago.PagadoPorPropietario);
        f.setFechaPago(java.time.LocalDate.now());
        f.setFormaPago(formaPago);
        if (inmo) {
            // La inmobiliaria adelantó el pago: queda registrado como egreso (a recuperar / descontar en la rendición)
            com.inmobiliaria.backend.model.MovimientoFinanciero m = new com.inmobiliaria.backend.model.MovimientoFinanciero();
            m.setFecha(java.time.LocalDate.now());
            m.setPropiedad(f.getPropiedad());
            m.setTipo("Egreso");
            m.setMonto(f.getMontoTotalFactura());
            m.setMoneda(com.inmobiliaria.backend.model.MovimientoFinanciero.Moneda.ARS);
            m.setMedioPago(formaPago);
            m.setEstado("Completado");
            m.setConceptoEgreso("Servicio " + f.getTipoServicio() + " " + f.getPeriodoMesAnio());
            m.setOrigen("Factura");
            movimientoRepo.save(m);
        }
        return repo.save(f);
    }

    @Transactional
    public FacturaServicio crearDesdeComprobante(Map<String, Object> data, com.inmobiliaria.backend.model.Propiedad prop,
                                                  com.inmobiliaria.backend.model.Persona agente) {
        FacturaServicio.TipoServicio tipo;
        try { tipo = FacturaServicio.TipoServicio.valueOf((String) data.get("tipoServicio")); }
        catch (Exception e) { throw new IllegalArgumentException("Elegí el tipo de servicio (Luz, Agua, Gas, Expensas o Impuestos)."); }
        String periodo = (String) data.get("periodoMesAnio");
        if (periodo == null || !periodo.matches("\\d{4}-(0[1-9]|1[0-2])"))
            throw new IllegalArgumentException("El período debe tener formato AAAA-MM (ej: 2026-09).");
        BigDecimal monto;
        try { monto = new BigDecimal(String.valueOf(data.get("montoTotalFactura"))); }
        catch (Exception e) { throw new IllegalArgumentException("Ingresá el monto de la factura."); }
        if (monto.signum() <= 0) throw new IllegalArgumentException("El monto de la factura debe ser mayor a cero.");
        java.time.LocalDate venc;
        try { venc = java.time.LocalDate.parse((String) data.get("fechaVencimiento")); }
        catch (Exception e) { throw new IllegalArgumentException("Ingresá la fecha de vencimiento."); }

        FacturaServicio f = new FacturaServicio();
        f.setPropiedad(prop);
        f.setAgenteCarga(agente);
        f.setTipoServicio(tipo);
        f.setPeriodoMesAnio(periodo);
        f.setMontoTotalFactura(monto);
        f.setFechaVencimiento(venc);
        f.setEstadoPago(FacturaServicio.EstadoPago.Pendiente);
        f.setFormaPago((String) data.get("formaPago"));
        f.setLinkFacturaPdf((String) data.get("linkFacturaPdf"));
        f.setObservaciones((String) data.get("observaciones"));
        return repo.save(f);
    }

    // ── Validaciones ───────────────────────────────────────────────────

    public Map<String, Object> validarPagosPendientes(Integer idPropiedad) {
        List<FacturaServicio> pendientes = repo.findByEstadoPagoAndPropiedadIdPropiedadOrderByFechaVencimientoAsc(
            FacturaServicio.EstadoPago.Pendiente, idPropiedad);
        BigDecimal totalPendiente = repo.sumarTotalVencido(idPropiedad);
        return Map.of(
            "totalPendiente", totalPendiente,
            "cantidadPendientes", pendientes.size(),
            "facturas", pendientes
        );
    }

    // ── Reportes ───────────────────────────────────────────────────────

    public List<FacturaServicio> obtenerFacturasVencidasHoy() {
        java.time.LocalDate hoy = java.time.LocalDate.now();
        return repo.findByEstadoPagoAndFechaVencimientoLessThanEqual(
            FacturaServicio.EstadoPago.Pendiente, hoy);
    }

    public List<FacturaServicio> groupByServiceType() {
        return repo.findAllByOrderByTipoServicioAscFechaVencimientoDesc();
    }
}
