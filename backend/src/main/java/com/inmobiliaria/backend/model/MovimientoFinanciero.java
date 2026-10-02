package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "Movimientos_Financieros")
public class MovimientoFinanciero {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_movimiento")
    private Integer idMovimiento;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @ManyToOne
    @JoinColumn(name = "id_propiedad")
    private Propiedad propiedad;

    @ManyToOne
    @JoinColumn(name = "id_persona")
    private Persona persona;

    @Column(name = "tipo", nullable = false, length = 20)
    private String tipo; // "Ingreso", "Egreso", "Transferencia"

    @Column(name = "monto", nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Enumerated(EnumType.STRING)
    @Column(name = "moneda")
    private Moneda moneda;

    @Column(name = "medio_pago", length = 100)
    private String medioPago;

    @Column(name = "estado", length = 50)
    private String estado = "Completado";

    @Column(name = "concepto_ingreso", length = 200)
    private String conceptoIngreso;

    @Column(name = "concepto_egreso", length = 200)
    private String conceptoEgreso;

    @Column(name = "requiere_autorizacion")
    private Boolean requiereAutorizacion = false;

    @Column(name = "banco_destino", length = 100)
    private String bancoDestino;

    @Column(name = "cbu_alias", length = 100)
    private String cbuAlias;

    @Column(name = "observaciones", length = 500)
    private String observaciones;

    // Para Transferencia (liquidación a propietario)
    @ManyToOne
    @JoinColumn(name = "id_rendicion")
    private RendicionPropietario rendicion;

    /** null / "Manual" = cargado a mano; "Cobranza", "Rendicion" o "Factura" = generado por otro módulo (se corrige desde allí). */
    @Column(name = "origen", length = 20)
    private String origen;

    /** Auditoría: usuario que cargó y, si corresponde, que anuló el movimiento. */
    @Column(name = "registrado_por", length = 80)
    private String registradoPor;

    @Column(name = "anulado_por", length = 80)
    private String anuladoPor;

    public enum Moneda { ARS, USD, EUR }
}
