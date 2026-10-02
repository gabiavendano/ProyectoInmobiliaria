package com.inmobiliaria.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.time.LocalDate;

// Antes era @Data: el equals/hashCode/toString generados recorrían persona → historialNotas → persona...
// y el JSON entraba en un ciclo infinito en cuanto existía una sola nota.
@Getter
@Setter
@ToString(exclude = "persona")
@Entity
@Table(name = "Notas_Persona")
public class NotaPersona {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_nota")
    private Integer idNota;

    // @JsonIgnore: corta el ciclo Persona → historialNotas → persona al armar el JSON
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_persona", nullable = false)
    private Persona persona;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Column(name = "texto", columnDefinition = "TEXT", nullable = false)
    private String texto;
}
