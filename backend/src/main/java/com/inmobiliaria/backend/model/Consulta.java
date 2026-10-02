package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Consulta que un cliente registrado en la web le hace a la inmobiliaria ("Quiero visitarla", "Quiero más información").
 * Es el "lead": el agente la ve en el panel (Leads web), la marca como contactada y, si avanza, convierte al usuario en cliente.
 *
 * Los datos de contacto y el título de la propiedad se guardan como copia (snapshot): así la consulta sigue
 * siendo legible aunque el usuario cambie su perfil o la propiedad se modifique.
 */
@Getter
@Setter
@Entity
@Table(name = "Consultas")
public class Consulta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_consulta")
    private Integer idConsulta;

    @Column(name = "id_usuario", nullable = false)
    private Integer idUsuario;

    @Column(name = "nombre", length = 200)
    private String nombre;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "telefono", length = 30)
    private String telefono;

    @Column(name = "id_propiedad")
    private Integer idPropiedad;

    @Column(name = "propiedad_titulo", length = 200)
    private String propiedadTitulo;

    @Column(name = "mensaje", columnDefinition = "TEXT", nullable = false)
    private String mensaje;

    @Column(name = "horario_preferido", length = 100)
    private String horarioPreferido;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();

    // Nueva | Contactada | Descartada
    @Column(name = "estado", length = 20, nullable = false)
    private String estado = "Nueva";

    @Column(name = "nota_agente", length = 500)
    private String notaAgente;

    // Se completa cuando el usuario se convierte en cliente (ficha de Personas)
    @Column(name = "id_persona")
    private Integer idPersona;
}
