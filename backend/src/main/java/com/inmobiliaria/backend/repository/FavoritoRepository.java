package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.Favorito;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio de Favoritos de propiedades para clientes.
 */
@Repository
public interface FavoritoRepository extends JpaRepository<Favorito, Integer> {

    /**
     * Obtener todos los favoritos de un cliente dado.
     */
    @Query("SELECT f FROM Favorito f JOIN FETCH f.propiedad WHERE f.cliente.idPersona = :idCliente AND f.estado = 'Activo' ORDER BY f.fechaAgregado DESC")
    List<Favorito> findByClienteId(@Param("idCliente") Integer idCliente);

    /**
     * Verificar si un cliente ya tiene una propiedad como favorita.
     */
    @Query("SELECT CASE WHEN COUNT(f) > 0 THEN true ELSE false END FROM Favorito f WHERE f.cliente.idPersona = :idCliente AND f.propiedad.idPropiedad = :idPropiedad AND f.estado = 'Activo'")
    boolean existsByClienteAndPropiedad(@Param("idCliente") Integer idCliente, @Param("idPropiedad") Integer idPropiedad);

    /**
     * Eliminar por id de favorito.
     */
    void deleteById(Integer id);
}
