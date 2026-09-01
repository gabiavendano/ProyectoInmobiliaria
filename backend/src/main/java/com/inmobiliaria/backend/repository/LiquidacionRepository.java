package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.LiquidacionMensual;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LiquidacionRepository extends JpaRepository<LiquidacionMensual, Integer> {
    List<LiquidacionMensual> findByContratoIdOperacion(Integer idContrato);
}