package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RendicionPropietarioRepository extends JpaRepository<RendicionPropietario, Integer> {
    List<RendicionPropietario> findByPropietarioIdPersonaOrderByFechaRenderDesc(Integer idPersona);
    boolean existsByPropietarioIdPersona(Integer idPersona);
}
