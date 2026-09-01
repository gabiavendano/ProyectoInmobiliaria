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

    @Column(name = "fecha_pago_real", nullable = false)
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
    private BigDecimal porcentajeHonorariosAdministracion = new BigDecimal("5.00");

    @Column(name = "monto_comision_inmobiliaria", precision = 12, scale = 2)
    private BigDecimal montoComisionInmobiliaria;

    @Column(name = "es_co_corretaje_mensual")
    private Boolean esCoCorretajeMensual = false;

    @Column(name = "monto_neto_a_rendir", precision = 12, scale = 2)
    private BigDecimal montoNetoARendir;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_rendicion")
    private EstadoRendicion estadoRendicion = EstadoRendicion.Pendiente;

    public enum EstadoRendicion {
        Pendiente, CobradoInquilino, RendidoAlPropietario
    }
}