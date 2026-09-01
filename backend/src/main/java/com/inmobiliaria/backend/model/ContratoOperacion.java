package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "Contratos_y_Operaciones")
public class ContratoOperacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_operacion")
    private Integer idOperacion;

    @ManyToOne
    @JoinColumn(name = "id_propiedad", nullable = false)
    private Propiedad propiedad;

    @ManyToOne
    @JoinColumn(name = "id_vendedor_propietario", nullable = false)
    private Persona vendedorPropietario;

    @ManyToOne
    @JoinColumn(name = "id_comprador_inquilino", nullable = false)
    private Persona compradorInquilino;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_contrato", nullable = false)
    private TipoContrato tipoContrato;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    // BigDecimal en vez de Double para evitar errores de centavos
    @Column(name = "monto_total_operacion", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoTotalOperacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "moneda_operacion", nullable = false)
    private Moneda monedaOperacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "indice_ajuste")
    private IndiceAjuste indiceAjuste = IndiceAjuste.Ninguno;

    @Column(name = "frecuencia_ajuste_meses")
    private Integer frecuenciaAjusteMeses;

    @Column(name = "interes_mora_diario", precision = 5, scale = 4)
    private BigDecimal interestMoraDiario = BigDecimal.ZERO;

    @Column(name = "porcentaje_comision_vendedor", precision = 4, scale = 2)
    private BigDecimal porcentajeComisionVendedor = new BigDecimal("3.00");

    @Column(name = "porcentaje_comision_comprador", precision = 4, scale = 2)
    private BigDecimal porcentajeComisionComprador = new BigDecimal("3.00");

    @Column(name = "es_co_corretaje")
    private Boolean esCoCorretaje = false;

    @ManyToOne
    @JoinColumn(name = "id_inmobiliaria_colega")
    private Persona inmobiliariaColega;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_contrato")
    private EstadoContrato estadoContrato = EstadoContrato.Vigente;

    public enum TipoContrato  { Locacion, Compraventa, Permuta }
    public enum Moneda        { ARS, USD }
    public enum IndiceAjuste  { IPC, ICL, Ninguno }
    public enum EstadoContrato { Vigente, Rescindido, Finalizado }
}