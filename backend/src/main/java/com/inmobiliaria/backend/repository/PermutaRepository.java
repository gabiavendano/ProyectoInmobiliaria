package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.Permuta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PermutaRepository extends JpaRepository<Permuta, Integer> { }