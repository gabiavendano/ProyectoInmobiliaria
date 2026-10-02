package com.inmobiliaria.backend.repository;

import com.inmobiliaria.backend.model.Propiedad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PropiedadRepository extends JpaRepository<Propiedad, Integer> {

    List<Propiedad> findByEstadoPropiedad(Propiedad.EstadoPropiedad estado);

    // Propiedades disponibles para web pública
    @Query("SELECT p FROM Propiedad p WHERE " +
        "p.estadoPropiedad = 'Disponible' AND p.titulo IS NOT NULL " +
        "AND (p.zona IS NOT NULL OR p.barrio IS NOT NULL OR p.localidad IS NOT NULL)")
    List<Propiedad> findAllDisponiblesForWeb();

    // Filtros para web pública
    @Query("SELECT p FROM Propiedad p WHERE " +
        "(:zona IS NULL OR p.zona = :zona) AND " +
        "(:tipoInmueble IS NULL OR p.tipoInmueble = :tipoInmueble) AND " +
        "(:tipoOperacion IS NULL OR p.tipoOperacion = :tipoOperacion) AND " +
        "(:minPrecio IS NULL OR p.precio >= :minPrecio) AND " +
        "(:maxPrecio IS NULL OR p.precio <= :maxPrecio) AND " +
        "p.estadoPropiedad = 'Disponible'")
    List<Propiedad> findByFiltersWeb(
        @Param("zona") String zona,
        @Param("tipoInmueble") Propiedad.TipoInmueble tipoInmueble,
        @Param("tipoOperacion") Propiedad.TipoOperacion tipoOperacion,
        @Param("minPrecio") Double minPrecio,
        @Param("maxPrecio") Double maxPrecio);

    // Complejos y sus unidades
    List<Propiedad> findByIdComplejoIsNotNull();
    List<Propiedad> findByIdComplejoOrderByIdPropiedadAsc(Integer idComplejo);
    long countByIdComplejo(Integer idComplejo);
    boolean existsByPropietarioActualIdPersona(Integer idPersona);

    // Por propietario
    List<Propiedad> findByPropietarioActualIdPersona(Integer idPropietario);

    // Por localidad/barrio
    List<Propiedad> findByLocalidad(String localidad);
    List<Propiedad> findByBarrio(String barrio);

    // Búsqueda por título (case-insensitive)
    Optional<Propiedad> findByTituloContainingIgnoreCase(String term);

    // Listado por tipo de inmueble
    List<Propiedad> findByTipoInmueble(Propiedad.TipoInmueble tipoInmueble);
}
