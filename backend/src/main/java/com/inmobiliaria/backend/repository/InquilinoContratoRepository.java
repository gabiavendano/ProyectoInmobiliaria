package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface InquilinoContratoRepository extends JpaRepository<InquilinoContrato, Integer> {
    List<InquilinoContrato> findByRendicionIdRendicion(Integer idRendicion);
    List<InquilinoContrato> findByPropiedadIdPropiedadOrderByNombreInquilinoAsc(Integer idPropiedad);
    Optional<InquilinoContrato> findByPropiedadIdPropiedadAndNombreInquilino(Integer idPropiedad, String nombreInquilino);
    List<InquilinoContrato> findByContratoOperacionIdOperacion(Integer idOperacion);
}
