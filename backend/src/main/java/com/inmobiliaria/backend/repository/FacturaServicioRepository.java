package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.FacturaServicio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.math.BigDecimal;
import java.time.LocalDate;

@Repository
public interface FacturaServicioRepository extends JpaRepository<FacturaServicio, Integer> {

    List<FacturaServicio> findByPropiedadIdPropiedadOrderByFechaVencimientoDesc(Integer idPropiedad);
    List<FacturaServicio> findByAgenteCargaIdPersonaOrderByFechaVencimientoDesc(Integer idAgente);
    List<FacturaServicio> findByTipoServicioAndPropiedadIdPropiedad(FacturaServicio.TipoServicio tipo, Integer idPropiedad);

    List<FacturaServicio> findByEstadoPagoOrderByFechaVencimientoAsc(FacturaServicio.EstadoPago estado);

    @Query("SELECT f FROM FacturaServicio f WHERE " +
        "f.periodoMesAnio LIKE %:texto% OR " +
        "f.formaPago LIKE %:texto% OR " +
        "f.observaciones LIKE %:texto% OR " +
        "f.linkFacturaPdf LIKE %:texto%")
    List<FacturaServicio> buscarPorTexto(String texto);

    @Query("SELECT COALESCE(SUM(f.montoTotalFactura), 0) FROM FacturaServicio f WHERE f.propiedad.idPropiedad = :idPropiedad")
    BigDecimal sumarTotalPorPropiedad(Integer idPropiedad);

    @Query("SELECT f FROM FacturaServicio f WHERE f.estadoPago = 'Pendiente' ORDER BY f.fechaVencimiento DESC")
    List<FacturaServicio> findPendientesOrdenDesc();

    @Query("SELECT f FROM FacturaServicio f WHERE f.fechaVencimiento = :hoy")
    List<FacturaServicio> findVencidasHoyOHoy(LocalDate hoy);

    List<FacturaServicio> findByEstadoPagoAndPropiedadIdPropiedadOrderByFechaVencimientoAsc(
        FacturaServicio.EstadoPago estado, Integer idPropiedad);

    @Query("SELECT COALESCE(SUM(f.montoTotalFactura), 0) FROM FacturaServicio f " +
        "WHERE f.propiedad.idPropiedad = :idPropiedad AND f.estadoPago = 'Pendiente'")
    BigDecimal sumarTotalVencido(Integer idPropiedad);

    List<FacturaServicio> findByEstadoPagoAndFechaVencimientoLessThanEqual(
        FacturaServicio.EstadoPago estado, LocalDate fecha);

    List<FacturaServicio> findAllByOrderByTipoServicioAscFechaVencimientoDesc();
}
