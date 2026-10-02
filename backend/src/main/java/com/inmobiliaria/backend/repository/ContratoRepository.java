package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.ContratoOperacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ContratoRepository extends JpaRepository<ContratoOperacion, Integer> {
    // Spring genera el SQL solo leyendo el nombre del método
    List<ContratoOperacion> findByPropiedadIdPropiedad(Integer idPropiedad);
    List<ContratoOperacion> findByCompradorInquilinoIdPersona(Integer idPersona);

    /** Cantidad de contratos en los que participa una persona (propietario, inquilino/comprador o colega). */
    @Query("select count(c) from ContratoOperacion c where c.vendedorPropietario.idPersona = :id "
         + "or c.compradorInquilino.idPersona = :id or c.inmobiliariaColega.idPersona = :id")
    long contarPorPersona(@Param("id") Integer id);
}