package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Entity
@Table(name = "Permutas")
public class Permuta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_permuta")
    private Integer idPermuta;

    @OneToOne
    @JoinColumn(name = "id_operacion_madre", nullable = false)
    private ContratoOperacion operacionMadre;

    @ManyToOne
    @JoinColumn(name = "id_propiedad_a", nullable = false)
    private Propiedad propiedadA;

    @ManyToOne
    @JoinColumn(name = "id_propiedad_b", nullable = false)
    private Propiedad propiedadB;

    @Column(name = "diferencia_efectivo", precision = 12, scale = 2)
    private BigDecimal diferenciaEfectivo = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "moneda_diferencia")
    private Moneda monedaDiferencia = Moneda.USD;

    public enum Moneda { ARS, USD }
}