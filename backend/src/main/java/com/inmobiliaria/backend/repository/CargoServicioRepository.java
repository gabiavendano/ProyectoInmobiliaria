package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.CargoServicio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CargoServicioRepository extends JpaRepository<CargoServicio, Integer> {
    List<CargoServicio> findByIdLiquidacion(Integer idLiquidacion);
}
