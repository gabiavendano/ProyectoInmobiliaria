package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "Contratos_y_Operaciones")
public class ContratoOperacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_operacion")
    private Integer idOperacion;

    // ── PARTES ─────────────────────────────────────────────────────
    @ManyToOne
    @JoinColumn(name = "id_propiedad", nullable = false)
    private Propiedad propiedad;

    @ManyToOne
    @JoinColumn(name = "id_vendedor_propietario", nullable = false)
    private Persona vendedorPropietario;

    @ManyToOne
    @JoinColumn(name = "id_comprador_inquilino", nullable = false)
    private Persona compradorInquilino;

    // ── TIPO / ESTADO / FECHAS ─────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_contrato", nullable = false)
    private TipoContrato tipoContrato;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_contrato")
    private EstadoContrato estadoContrato = EstadoContrato.Vigente;

    @Column(name = "fecha_inicio", nullable = false)
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Column(name = "numero_interno", length = 255)
    private String numeroInterno;

    @Column(name = "fecha_alta")
    private LocalDate fechaAlta;

    @Column(name = "estado_operacion", length = 255)
    private String estadoOperacion = "Borrador";

    @Column(name = "usuario_responsable", length = 255)
    private String usuarioResponsable;

    // ── IDENTIFICACION CORREDOR (Art. 32, 36 Ley 25.028) ──────────
    @Column(name = "matricula_corredor", length = 255)
    private String matriculaCorredor;

    @Column(name = "domicilio_corredor", length = 500)
    private String domicilioCorredor;

    @Column(name = "numero_matriz", length = 255)
    private String numeroMatriz;

    @Column(name = "profesion_corredor", length = 255)
    private String profesionCorredor;

    // ── CONDICIONES GENERALES ──────────────────────────────────────
    @Column(name = "monto_total_operacion", precision = 12, scale = 2)
    private BigDecimal montoTotalOperacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "moneda_operacion")
    private Moneda monedaOperacion;

    @Enumerated(EnumType.STRING)
    @Column(name = "indice_ajuste")
    private IndiceAjuste indiceAjuste = IndiceAjuste.Ninguno;

    @Column(name = "frecuencia_ajuste_meses")
    private Integer frecuenciaAjusteMeses;

    // El formulario envía "interesMoraDiario": sin el alias la tasa de mora nunca se guardaba (quedaba en 0)
    @com.fasterxml.jackson.annotation.JsonAlias("interesMoraDiario")
    @Column(name = "interes_mora_diario", precision = 5, scale = 4)
    private BigDecimal interestMoraDiario = BigDecimal.ZERO;

    @Column(name = "porcentaje_comision_vendedor", precision = 4, scale = 2)
    private BigDecimal porcentajeComisionVendedor;   // en desuso: los porcentajes reales están en honParteAPorcentaje / honParteBPorcentaje

    @Column(name = "porcentaje_comision_comprador", precision = 4, scale = 2)
    private BigDecimal porcentajeComisionComprador;  // en desuso

    @Column(name = "es_co_corretaje")
    private Boolean esCoCorretaje = false;

    @ManyToOne
    @JoinColumn(name = "id_inmobiliaria_colega")
    private Persona inmobiliariaColega;

    // ── TIRAS DE COMPRADORES / VENDEDORES (selects multiples) ──────
    @ElementCollection
    @CollectionTable(name = "Contrato_Vendedores", joinColumns = @JoinColumn(name = "id_operacion"))
    @Column(name = "id_vendedor")
    private List<Integer> vendedoresAdicionales = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Contrato_Compradores", joinColumns = @JoinColumn(name = "id_operacion"))
    @Column(name = "id_comprador")
    private List<Integer> compradoresAdicionales = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Contrato_Garantes", joinColumns = @JoinColumn(name = "id_operacion"))
    @Column(name = "id_garante")
    private List<Integer> garantesAdicionales = new ArrayList<>();

    // ── VENTA ──────────────────────────────────────────────────────
    @Column(name = "ven_precio", precision = 12, scale = 2)
    private BigDecimal venPrecio;

    @Enumerated(EnumType.STRING)
    @Column(name = "ven_moneda")
    private Moneda venMoneda;

    @Column(name = "ven_forma_pago", length = 255)
    private String venFormaPago = "Contado";

    @Column(name = "ven_anticipo", precision = 12, scale = 2)
    private BigDecimal venAnticipo;

    @Column(name = "ven_cuotas")
    private Integer venCuotas;

    @Column(name = "ven_monto_cuota", precision = 12, scale = 2)
    private BigDecimal venMontoCuota;

    @Column(name = "ven_monto_reserva", precision = 12, scale = 2)
    private BigDecimal venMontoReserva;

    @Column(name = "ven_fecha_posesion")
    private LocalDate venFechaPosesion;

    @Column(name = "ven_escribano", length = 255)
    private String venEscribano;

    // ── PERMUTA ────────────────────────────────────────────────────
    @Column(name = "per_bienes_a", length = 500)
    private String perBienesA;

    @Column(name = "per_bienes_b", length = 500)
    private String perBienesB;

    @Column(name = "per_diferencia_monto", precision = 12, scale = 2)
    private BigDecimal perDiferenciaMonto;

    @Enumerated(EnumType.STRING)
    @Column(name = "per_diferencia_moneda")
    private Moneda perDiferenciaMoneda;

    @Column(name = "per_quien_paga_diferencia", length = 255)
    private String perQuienPagaDiferencia = "Parte A";

    /** Propiedad (ya cargada en el sistema) que entrega la Parte B. Opcional: si entrega otro bien se describe en perBienesB. */
    @Column(name = "per_propiedad_b_id")
    private Integer perPropiedadBId;

    // ── ALQUILER ANUAL ─────────────────────────────────────────────
    @Column(name = "alq_fecha_inicio")
    private LocalDate alqFechaInicio;

    @Column(name = "alq_fecha_fin")
    private LocalDate alqFechaFin;

    @Column(name = "alq_destino", length = 255)
    private String alqDestino = "Vivienda";

    @Column(name = "alq_canon_monto", precision = 12, scale = 2)
    private BigDecimal alqCanonMonto;

    @Enumerated(EnumType.STRING)
    @Column(name = "alq_canon_moneda")
    private Moneda alqCanonMoneda;

    @Column(name = "alq_indice_ajuste", length = 20)
    private String alqIndiceAjuste = "ICL";

    @Column(name = "alq_frecuencia_ajuste", length = 20)
    private String alqFrecuenciaAjuste = "Trimestral";

    /** Día del mes en que vence el pago del alquiler (1–28). Por defecto el 10. */
    @Column(name = "alq_dia_vencimiento")
    private Integer alqDiaVencimiento = 10;

    /** Honorarios de administración (% sobre el alquiler cobrado) pactados en este contrato. Por defecto 10. */
    @Column(name = "alq_porcentaje_administracion", precision = 5, scale = 2)
    private BigDecimal alqPorcentajeAdministracion = new BigDecimal("10.00");

    @Column(name = "alq_monto_deposito", precision = 12, scale = 2)
    private BigDecimal alqMontoDeposito;

    // ── ALQUILER TEMPORARIO ─────────────────────────────────────────
    @Column(name = "temp_check_in")
    private LocalDate tempCheckIn;

    @Column(name = "temp_check_out")
    private LocalDate tempCheckOut;

    @Column(name = "temp_huespedes")
    private Integer tempHuespedes = 2;

    @Column(name = "temp_precio_noche", precision = 12, scale = 2)
    private BigDecimal tempPrecioNoche;

    @Column(name = "temp_precio_total", precision = 12, scale = 2)
    private BigDecimal tempPrecioTotal;

    @Enumerated(EnumType.STRING)
    @Column(name = "temp_moneda")
    private Moneda tempMoneda;

    /** Seña / reserva como porcentaje (0 a 100) del precio total de la estadía. Es el dato que se carga. */
    @Column(name = "temp_senia_porcentaje", precision = 5, scale = 2)
    private BigDecimal tempSeniaPorcentaje;

    /** Seña / reserva en dinero (se calcula sola: precio total × porcentaje) y se descuenta del saldo a cobrar. */
    @Column(name = "temp_senia", precision = 12, scale = 2)
    private BigDecimal tempSenia;

    /** Depósito reembolsable en garantía (no forma parte del precio). */
    @Column(name = "temp_deposito", precision = 12, scale = 2)
    private BigDecimal tempDeposito;

    /** Día en que se cobró la seña / reserva (null = todavía no registrada). */
    @Column(name = "temp_senia_cobrada_fecha")
    private LocalDate tempSeniaCobradaFecha;

    /** Día en que se cobró el saldo de la estadía (null = todavía no registrado). */
    @Column(name = "temp_saldo_cobrado_fecha")
    private LocalDate tempSaldoCobradoFecha;

    // ── HONORARIOS (transversal) ────────────────────────────────────
    @Column(name = "hon_moneda", length = 10)
    private String honMoneda = "ARS";

    @Column(name = "hon_monto_total", precision = 12, scale = 2)
    private BigDecimal honMontoTotal;

    // Parte A (vendedor/locador)
    @Column(name = "hon_parte_a_monto", precision = 12, scale = 2)
    private BigDecimal honParteAMonto;

    @Column(name = "hon_parte_a_estado", length = 255)
    private String honParteAEstado = "Pendiente";

    @Column(name = "hon_parte_a_forma_pago", length = 255)
    private String honParteAFormaPago = "Efectivo";

    // Parte B (comprador/locatario)
    @Column(name = "hon_parte_b_monto", precision = 12, scale = 2)
    private BigDecimal honParteBMonto;

    @Column(name = "hon_parte_b_estado", length = 255)
    private String honParteBEstado = "Pendiente";

    @Column(name = "hon_parte_b_forma_pago", length = 255)
    private String honParteBFormaPago = "Efectivo";

    // ── Honorarios: porcentaje aplicado, base de cálculo y cobranza ──
    /** Importe sobre el que se calculó el porcentaje (precio de venta, total del contrato de alquiler, etc.). */
    @Column(name = "hon_base_calculo", precision = 14, scale = 2)
    private BigDecimal honBaseCalculo;

    /** Texto de la escala aplicada (ej.: "Ley 9.445 art. 25 · Venta 3 % + 3 %"). */
    @Column(name = "hon_escala", length = 500)
    private String honEscala;

    /** true si alguien cambió a mano los porcentajes o montos que propone la escala. */
    @Column(name = "hon_editado_manual")
    private Boolean honEditadoManual = false;

    @Column(name = "hon_parte_a_porcentaje", precision = 5, scale = 2)
    private BigDecimal honParteAPorcentaje;

    @Column(name = "hon_parte_b_porcentaje", precision = 5, scale = 2)
    private BigDecimal honParteBPorcentaje;

    @Column(name = "hon_parte_a_cobrado", precision = 12, scale = 2)
    private BigDecimal honParteACobrado;

    @Column(name = "hon_parte_b_cobrado", precision = 12, scale = 2)
    private BigDecimal honParteBCobrado;

    @Column(name = "hon_parte_a_fecha_cobro")
    private LocalDate honParteAFechaCobro;

    @Column(name = "hon_parte_b_fecha_cobro")
    private LocalDate honParteBFechaCobro;

    @Column(name = "hon_parte_a_comprobante", length = 255)
    private String honParteAComprobante;

    @Column(name = "hon_parte_b_comprobante", length = 255)
    private String honParteBComprobante;

    @Column(name = "hon_parte_a_fecha_emision")
    private LocalDate honParteAFechaEmision;

    @Column(name = "hon_parte_b_fecha_emision")
    private LocalDate honParteBFechaEmision;

    /** Porcentaje de los honorarios totales que le corresponde a la inmobiliaria colega (solo co-corretaje). */
    @Column(name = "hon_colega_porcentaje", precision = 5, scale = 2)
    private BigDecimal honColegaPorcentaje;

    // ── CO-CORRETAJE ────────────────────────────────────────────────
    @Column(name = "co_nombre", length = 255)
    private String coNombre;

    @Column(name = "co_matricula", length = 255)
    private String coMatricula;

    @Column(name = "co_intervencion", length = 255)
    private String coIntervencion = "Representa Comprador";

    // ── VERIFICACIONES OBLIGATORIAS (Art. 36 Ley 25.028) ───────────
    @Column(name = "cert_dominio_inmueble", length = 500)
    private String certDominioInmueble;

    @Column(name = "cert_garantias", length = 500)
    private String certGarantias;

    @Column(name = "hetero_fondo_legal", length = 500)
    private String heteroFondoLegal;

    @Column(name = "condiciones_negocio", columnDefinition = "TEXT")
    private String condicionesNegocio;

    @Column(name = "minuta_operacion", columnDefinition = "TEXT")
    private String minutaOperacion;

    @Column(name = "fecha_firma", length = 255)
    private String fechaFirma;

    @Column(name = "firma_corredor", length = 255)
    private String firmaCorredor;

    @Column(name = "legajos_checados", length = 1000)
    private String legajosChecados;

    @Column(name = "identidades_checadas", length = 500)
    private String identidadesChecadas;

    // ── DOCUMENTOS ──────────────────────────────────────────────────
    @OneToMany(mappedBy = "contrato", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DocumentoAdjunto> documentos = new ArrayList<>();

    // ── ENUMS ───────────────────────────────────────────────────────
    public enum TipoContrato { Locacion, Compraventa, Permuta }
    public enum Moneda { ARS, USD, EUR }
    public enum IndiceAjuste { IPC, ICL, Ninguno }
    public enum EstadoContrato { Borrador, Vigente, Rescindido, Finalizado }
}
