package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Favorito de propiedad para clientes (sistema de deseos/compras).
 * Cada cliente puede marcar propiedades como favoritas.
 */
@Data
@Entity
@Table(name = "Favoritos")
public class Favorito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_favorito")
    private Integer idFavorito;

    // Cliente que marcó como favorito
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_cliente", nullable = false)
    private Persona cliente;

    // Propiedad guardada como favorita
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_propiedad", nullable = false)
    private Propiedad propiedad;

    // Fecha en que se agregó
    @Column(name = "fecha_agregado", nullable = false)
    private LocalDateTime fechaAgregado = LocalDateTime.now();

    // Nota/opinion del cliente sobre esta propiedad
    @Column(name = "nota", length = 300)
    private String nota;

    // Estado del favorito
    @Column(name = "estado", length = 20)
    private String estado = "Activo";
}
