package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Cargo de servicios / expensas a cobrar a un inquilino (resultado de cargar una factura y prorratearla entre unidades).
 * Queda "Pendiente" hasta que se incluye en un cobro de alquiler ("Cobrado") o se anula.
 */
@Data
@Entity
@Table(name = "Cargos_Servicios")
public class CargoServicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cargo")
    private Integer idCargo;

    /** Unidad o propiedad a la que se le cobra el cargo. */
    @ManyToOne
    @JoinColumn(name = "id_propiedad", nullable = false)
    private Propiedad propiedad;

    @Column(name = "concepto", nullable = false, length = 100)
    private String concepto;

    @Column(name = "periodo_mes_anio", nullable = false, length = 7)
    private String periodoMesAnio;

    @Column(name = "monto", nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    /** Lectura del medidor / consumo de la unidad (opcional). */
    @Column(name = "medicion", precision = 12, scale = 2)
    private BigDecimal medicion;

    @Column(name = "unidad_medida", length = 20)
    private String unidadMedida;

    /** Pendiente, Cobrado o Anulado. */
    @Column(name = "estado", length = 20)
    private String estado = "Pendiente";

    @Column(name = "fecha_carga")
    private LocalDate fechaCarga = LocalDate.now();

    @Column(name = "id_liquidacion")
    private Integer idLiquidacion;

    @Column(name = "observaciones", length = 300)
    private String observaciones;
}
