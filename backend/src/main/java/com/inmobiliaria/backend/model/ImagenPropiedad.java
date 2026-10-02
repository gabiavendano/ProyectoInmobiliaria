package com.inmobiliaria.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Imagen de una propiedad para la galería web.
 * Reemplaza al enfoque @ElementCollection para soportar
 * foto principal y orden de aparición.
 */
@Data
@Entity
@Table(name = "Imagenes_Propiedad")
public class ImagenPropiedad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_imagen")
    private Integer idImagen;

    // @JsonIgnore: evita el ciclo infinito Propiedad → imagenes → propiedad → ... al serializar a JSON
    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "id_propiedad", nullable = false)
    private Propiedad propiedad;

    @Column(name = "url_imagen", nullable = false, length = 255)
    private String urlImagen;

    @Column(name = "es_foto_principal")
    private Boolean esFotoPrincipal = false;

    @Column(name = "orden_aparicion")
    private Integer ordenAparicion = 1;
}
