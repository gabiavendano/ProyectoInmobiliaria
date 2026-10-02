package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.util.*;

@Service
public class FacturadorService {

    @Autowired private FacturaServicioRepository facturaRepo;
    @Autowired private RendicionPropietarioRepository rendicionRepo;
    @Autowired private PropiedadRepository propiedadRepo;
    @Autowired private PersonaRepository personaRepo;

    // ── Consulta de facturas de servicios ────────────────────────────────

    /**
     * Retorna todas las facturas de servicios de una propiedad,
     * ordenadas por fecha de vencimiento descendente (más próxima primero).
     */
    public List<FacturaServicio> getFacturasPorPropiedad(Integer idPropiedad) {
        return facturaRepo.findByPropiedadIdPropiedadOrderByFechaVencimientoDesc(idPropiedad);
    }

    /**
     * Retorna todas las facturas de servicios cargadas por un agente.
     */
    public List<FacturaServicio> getFacturasPorAgente(Integer idAgente) {
        return facturaRepo.findByAgenteCargaIdPersonaOrderByFechaVencimientoDesc(idAgente);
    }

    /**
     * Retorna todas las facturas de un tipo dentro de una propiedad.
     */
    public List<FacturaServicio> getFacturasPorTipoServicio(Integer idPropiedad, FacturaServicio.TipoServicio tipo) {
        return facturaRepo.findByTipoServicioAndPropiedadIdPropiedad(tipo, idPropiedad);
    }

    /**
     * Retorna una factura por su ID.
     */
    public Optional<FacturaServicio> getFacturaById(Integer idFactura) {
        return facturaRepo.findById(idFactura);
    }

    /**
     * Retorna todas las facturas (para el servicio de finanzas — admin).
     */
    public List<FacturaServicio> getAllFacturas() {
        return facturaRepo.findAll();
    }

    // ── Estado de pago de una factura ────────────────────────────────────

    public FacturaServicio getEstadoPago(Integer idFactura) {
        return facturaRepo.findById(idFactura)
            .orElseThrow(() -> new RuntimeException("Factura no encontrada: " + idFactura));
    }

    /**
     * Marca una factura como pagada por la inmobiliaria.
     */
    @Transactional
    public FacturaServicio marcarPagada(Integer idFactura) {
        FacturaServicio f = facturaRepo.findById(idFactura)
            .orElseThrow(() -> new RuntimeException("Factura no encontrada: " + idFactura));
        f.setEstadoPago(FacturaServicio.EstadoPago.PagadoPorInmobiliaria);
        return facturaRepo.save(f);
    }

    /**
     * Marca una factura como pagada por el propietario.
     */
    @Transactional
    public FacturaServicio marcarPagadaPorPropietario(Integer idFactura) {
        FacturaServicio f = facturaRepo.findById(idFactura)
            .orElseThrow(() -> new RuntimeException("Factura no encontrada: " + idFactura));
        f.setEstadoPago(FacturaServicio.EstadoPago.PagadoPorPropietario);
        return facturaRepo.save(f);
    }

    /**
     * Retira el pago de una factura (para correcciones).
     */
    @Transactional
    public FacturaServicio desmarcarPago(Integer idFactura) {
        FacturaServicio f = facturaRepo.findById(idFactura)
            .orElseThrow(() -> new RuntimeException("Factura no encontrada: " + idFactura));
        f.setEstadoPago(FacturaServicio.EstadoPago.Pendiente);
        return facturaRepo.save(f);
    }

    // ── Cálculos de saldos ────────────────────────────────────────────────

    public BigDecimal getSaldoInmobiliaria(Integer idInmobiliaria) {
        BigDecimal ingresos   = BigDecimal.ZERO;
        BigDecimal gastos     = BigDecimal.ZERO;
        BigDecimal prestamos  = BigDecimal.ZERO;
        BigDecimal comisiones = BigDecimal.ZERO;

        // (implementación simplificada — datos reales provienen de las tablas)
        // TODO: calcular sobre Movimientos_Financieros cuando estén disponibles

        return ingresos.subtract(gastos).subtract(prestamos).add(comisiones);
    }

    /**
     * Retorna todos los movimientos para el balance general.
     */
    public Map<String, Object> getMovimientosParaBalance() {
        return new HashMap<>(); // TODO: implementar con datos reales
    }

    public BigDecimal getTotalFacturasPendientes(Integer idInmobiliaria) {
        // TODO: calcular sobre las facturas de servicios de todas las propiedades
        return BigDecimal.ZERO;
    }

    // ── Consulta de pendientes ────────────────────────────────────────────

    /**
     * Retorna todas las facturas pendientes de pago (de cualquier estado pendiente).
     */
    public List<FacturaServicio> getFacturasPendientes() {
        return facturaRepo.findPendientesOrdenDesc();
    }

    /**
     * Retorna las facturas pendientes agrupadas por propiedad.
     */
    public Map<Integer, List<FacturaServicio>> getPendientesPorPropiedad() {
        List<FacturaServicio> todas = getFacturasPendientes();
        Map<Integer, List<FacturaServicio>> agrupadas = new LinkedHashMap<>();
        for (FacturaServicio f : todas) {
            Integer idProp = f.getPropiedad().getIdPropiedad();
            agrupadas.computeIfAbsent(idProp, k -> new ArrayList<>()).add(f);
        }
        return agrupadas;
    }

    /**
     * Retorna las facturas que vence hoy o están vencidas.
     */
    public List<FacturaServicio> getFacturasVencidasHOlargo() {
        LocalDate hoy = LocalDate.now();
        return facturaRepo.findVencidasHoyOHoy(hoy);
    }

    // ── Consulta por servicio ─────────────────────────────────────────────

    /**
     * Retorna facturas de un servicio específico para una propiedad.
     */
    public List<FacturaServicio> getFacturasDeServicio(Integer idPropiedad, String nombreServicio) {
        try {
            FacturaServicio.TipoServicio tipo = FacturaServicio.TipoServicio.valueOf(nombreServicio);
            return getFacturasPorTipoServicio(idPropiedad, tipo);
        } catch (IllegalArgumentException e) {
            return Collections.emptyList();
        }
    }

    /**
     * Retorna una factura de un servicio específico por su ID.
     */
    public Optional<FacturaServicio> getFacturaDeServicioById(Integer idFactura) {
        return getFacturaById(idFactura);
    }
}
