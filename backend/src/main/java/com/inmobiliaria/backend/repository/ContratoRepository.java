package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.ContratoOperacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ContratoRepository extends JpaRepository<ContratoOperacion, Integer> {
    // Spring genera el SQL solo leyendo el nombre del método
    List<ContratoOperacion> findByPropiedadIdPropiedad(Integer idPropiedad);
    List<ContratoOperacion> findByCompradorInquilinoIdPersona(Integer idPersona);
}