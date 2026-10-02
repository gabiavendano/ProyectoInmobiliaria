package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.Persona;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

// JpaRepository<Entidad, TipoDelId>
// Con esto ya tenés findAll(), findById(), save(), deleteById() gratis
@Repository
public interface PersonaRepository extends JpaRepository<Persona, Integer> {

    Optional<Persona> findByDniCuit(String dniCuit);

    boolean existsByEmail(String email);

    Optional<Persona> findByEmail(String email);

    // Tolera emails duplicados / mayúsculas (se usa para vincular usuario → persona)
    Optional<Persona> findFirstByEmailIgnoreCaseOrderByIdPersonaAsc(String email);
}