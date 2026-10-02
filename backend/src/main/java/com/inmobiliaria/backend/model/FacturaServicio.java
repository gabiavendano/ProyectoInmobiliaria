package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Factura de servicios asociada a una propiedad (luz, agua, gas, expensas, impuestos).
 * Cargada por un agente del equipo como comprobante.
 */
@Data
@Entity
@Table(name = "Facturas_Servicios")
public class FacturaServicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_factura")
    private Integer idFactura;

    @ManyToOne
    @JoinColumn(name = "id_propiedad", nullable = false)
    private Propiedad propiedad;

    @ManyToOne
    @JoinColumn(name = "id_agente_carga", nullable = false)
    private Persona agenteCarga;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_servicio", nullable = false, length = 20)
    private TipoServicio tipoServicio;

    @Column(name = "periodo_mes_anio", nullable = false, length = 20)
    private String periodoMesAnio;

    @Column(name = "monto_total_factura", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoTotalFactura;

    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_pago_ente", length = 30)
    private EstadoPago estadoPago = EstadoPago.Pendiente;

    @Column(name = "link_factura_pdf", length = 255)
    private String linkFacturaPdf;

    @Column(name = "fecha_pago")
    private LocalDate fechaPago;

    @Column(name = "forma_pago", length = 50)
    private String formaPago;

    @Column(name = "observaciones", columnDefinition = "TEXT")
    private String observaciones;

    public enum TipoServicio { Luz, Agua, Gas, Expensas, Impuestos }
    public enum EstadoPago { Pendiente, PagadoPorInmobiliaria, PagadoPorPropietario }
}
