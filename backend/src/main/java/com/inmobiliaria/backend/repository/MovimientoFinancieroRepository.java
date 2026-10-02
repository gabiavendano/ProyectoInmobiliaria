package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MovimientoFinancieroRepository extends JpaRepository<MovimientoFinanciero, Integer> {
    List<MovimientoFinanciero> findByPropiedadIdPropiedadOrderByFechaDesc(Integer idPropiedad);
    List<MovimientoFinanciero> findByPersonaIdPersonaOrderByFechaDesc(Integer idPersona);
    List<MovimientoFinanciero> findByEstadoOrderByFechaDesc(String estado);
    List<MovimientoFinanciero> findByTipoOrderByFechaDesc(String tipo);
    boolean existsByPersonaIdPersona(Integer idPersona);
    boolean existsByPropiedadIdPropiedad(Integer idPropiedad);
    List<MovimientoFinanciero> findByFechaBetweenOrderByFechaDesc(LocalDate inicio, LocalDate fin);

    List<MovimientoFinanciero> findByPropiedadIdPropiedadAndFechaBetweenOrderByFechaDesc(Integer idPropiedad, LocalDate inicio, LocalDate fin);

    @Query("SELECT m FROM MovimientoFinanciero m ORDER BY m.monto ASC")
    List<MovimientoFinanciero> findAllByOrderByTipoServicioAscFechaVencimientoDesc();
}
