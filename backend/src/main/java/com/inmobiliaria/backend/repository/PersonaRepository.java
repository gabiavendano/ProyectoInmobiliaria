package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.Persona;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

// JpaRepository<Entidad, TipoDelId>
// Con esto ya tenés findAll(), findById(), save(), deleteById() gratis
@Repository
public interface PersonaRepository extends JpaRepository<Persona, Integer> { }