package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.Consulta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ConsultaRepository extends JpaRepository<Consulta, Integer> {
    List<Consulta> findAllByOrderByFechaDesc();
    List<Consulta> findByEstadoOrderByFechaDesc(String estado);
    List<Consulta> findByIdUsuarioOrderByFechaDesc(Integer idUsuario);
    long countByIdUsuarioAndFechaAfter(Integer idUsuario, LocalDateTime desde);
}
