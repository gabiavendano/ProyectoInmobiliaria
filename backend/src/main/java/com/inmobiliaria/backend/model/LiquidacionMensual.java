package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "Liquidaciones_Mensuales")
public class LiquidacionMensual {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_liquidacion")
    private Integer idLiquidacion;

    // Relación con el contrato al que pertenece este pago
    @ManyToOne
    @JoinColumn(name = "id_contrato", nullable = false)
    private ContratoOperacion contrato;

    @Column(name = "mes_ano_liquidado", nullable = false, length = 20)
    private String mesAnoLiquidado;

    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    @Column(name = "fecha_pago_real", nullable = true)
    private LocalDate fechaPagoReal;

    @Column(name = "monto_alquiler_base", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoAlquilerBase;

    // Este campo lo calcula el Service antes de guardar
    @Column(name = "monto_mora_calculado", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoMoraCalculado = BigDecimal.ZERO;

    @Column(name = "dias_atraso")
    private Integer diasAtraso = 0;

    @Column(name = "total_abonado_inquilino", precision = 12, scale = 2)
    private BigDecimal totalAbonadoInquilino;

    @Column(name = "porcentaje_honorarios_administracion", precision = 4, scale = 2)
    private BigDecimal porcentajeHonorariosAdministracion = new BigDecimal("10.00");

    @Column(name = "monto_comision_inmobiliaria", precision = 12, scale = 2)
    private BigDecimal montoComisionInmobiliaria;

    @Column(name = "es_co_corretaje_mensual")
    private Boolean esCoCorretajeMensual = false;

    @Column(name = "monto_neto_a_rendir", precision = 12, scale = 2)
    private BigDecimal montoNetoARendir;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_rendicion")
    private EstadoRendicion estadoRendicion = EstadoRendicion.Pendiente;

    // ── Cobranza real ──────────────────────────────────────────────
    /** ARS o USD (se toma de la moneda del contrato). */
    @Column(name = "moneda", length = 3)
    private String moneda = "ARS";

    /** Recibo correlativo, ej. 0001-00000023. Se genera al registrar el cobro. */
    @Column(name = "numero_recibo", length = 20, unique = true)
    private String numeroRecibo;

    @Column(name = "medio_pago", length = 50)
    private String medioPago;

    /** true solo si el contrato de administración autoriza expresamente que la inmobiliaria retenga la mora. Por defecto la mora es del propietario. */
    @Column(name = "mora_para_inmobiliaria")
    private Boolean moraParaInmobiliaria = false;

    @Column(name = "anulada")
    private Boolean anulada = false;

    @Column(name = "motivo_anulacion", length = 300)
    private String motivoAnulacion;

    /** Movimiento de Ingreso generado automáticamente al cobrar. */
    @Column(name = "id_movimiento")
    private Integer idMovimiento;

    /** Rendición en la que se liquidó este cobro al propietario (null = pendiente de rendir). */
    @Column(name = "id_rendicion")
    private Integer idRendicion;

    @Column(name = "observaciones", length = 500)
    private String observaciones;

    /** Servicios y expensas prorrateados que se cobran junto con el alquiler (no pagan honorarios ni mora y no se rinden al propietario). */
    @Column(name = "monto_servicios", precision = 12, scale = 2)
    private BigDecimal montoServicios = BigDecimal.ZERO;

    /** Un renglón por cargo: "concepto|monto" separados por salto de línea (para el recibo). */
    @Column(name = "servicios_detalle", length = 1000)
    private String serviciosDetalle;

    /** "Alquiler" (el del mes) u otro concepto de cobro: "Indemnización por rescisión", "Otro: ..." (no nulo = vacío se toma como "Alquiler"). */
    @Column(name = "concepto", length = 80)
    private String concepto = "Alquiler";

    /** Alquiler total que corresponde cobrar ese mes (un mes puede cobrarse en varios pagos). Nulo en cobros que no son alquiler. */
    @Column(name = "monto_alquiler_mes", precision = 12, scale = 2)
    private BigDecimal montoAlquilerMes;

    /** true si este pago cubre solo una parte del alquiler del mes (pago a cuenta o saldo). */
    @Column(name = "pago_parcial")
    private Boolean pagoParcial = false;

    /** Lo que queda por cobrar del alquiler del mes después de este pago. */
    @Column(name = "saldo_alquiler_pendiente", precision = 12, scale = 2)
    private BigDecimal saldoAlquilerPendiente;

    /** Auditoría: usuario que registró y, si corresponde, que anuló el cobro (los pone el servidor, nunca el cliente). */
    @Column(name = "registrado_por", length = 80)
    private String registradoPor;

    @Column(name = "anulado_por", length = 80)
    private String anuladoPor;

    /** Cargos pendientes que se incluyen en este cobro (solo viaja en el pedido). */
    @Transient
    private java.util.List<Integer> cargosIds;

    public enum EstadoRendicion {
        Pendiente, CobradoInquilino, RendidoAlPropietario
    }
}