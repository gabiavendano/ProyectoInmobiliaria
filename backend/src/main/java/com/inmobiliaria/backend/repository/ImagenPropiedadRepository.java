package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.ImagenPropiedad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ImagenPropiedadRepository extends JpaRepository<ImagenPropiedad, Integer> {

    List<ImagenPropiedad> findByPropiedadIdPropiedadOrderByOrdenAparicionAsc(Integer idPropiedad);

    Optional<ImagenPropiedad> findByPropiedadIdPropiedadAndEsFotoPrincipalTrue(Integer idPropiedad);

    void deleteByPropiedadIdPropiedad(Integer idPropiedad);
}
