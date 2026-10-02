package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioAutenticacionRepository extends JpaRepository<UsuarioAutenticacion, Integer> {
    Optional<UsuarioAutenticacion> findByUsername(String username);
    boolean existsByUsername(String username);
    List<UsuarioAutenticacion> findByRol(UsuarioAutenticacion.Rol rol);
}
