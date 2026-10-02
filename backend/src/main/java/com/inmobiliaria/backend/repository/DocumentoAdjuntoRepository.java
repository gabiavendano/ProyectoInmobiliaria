package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DocumentoAdjuntoRepository extends JpaRepository<DocumentoAdjunto, Integer> {
    List<DocumentoAdjunto> findByContratoIdOperacionOrderByFechaSubidaDesc(Integer idOperacion);
    List<DocumentoAdjunto> findByPropiedadIdPropiedadOrderByFechaSubidaDesc(Integer idPropiedad);
    boolean existsByPropiedadIdPropiedadAndTipoArchivo(Integer idPropiedad, String tipoArchivo);
}
