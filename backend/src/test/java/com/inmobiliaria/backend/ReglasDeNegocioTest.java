package com.inmobiliaria.backend;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import com.inmobiliaria.backend.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Tests de las reglas de negocio que NO cubre ContratoServiceTest:
 * mora, co-corretaje, estados de contrato/propiedad, rendiciones y finanzas.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReglasDeNegocioTest {

    // ── ContratoService ───────────────────────────────────────────────────
    @Mock private ContratoRepository contratoRepo;
    @Mock private PropiedadRepository propiedadRepo;
    @Mock private LiquidacionRepository liquidacionRepo;
    @Mock private AuditoriaService auditoria;
    @InjectMocks private ContratoService contratoService;

    private Propiedad propiedad;
    private Persona vendedor;
    private Persona inquilino;
    private ContratoOperacion contrato;

    @BeforeEach
    void setUp() {
        propiedad = new Propiedad();
        propiedad.setIdPropiedad(1);
        propiedad.setTitulo("Depto test");
        propiedad.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);

        vendedor = new Persona();
        vendedor.setIdPersona(1);
        vendedor.setNombreCompleto("Vendedor");
        inquilino = new Persona();
        inquilino.setIdPersona(2);
        inquilino.setNombreCompleto("Inquilino");
        propiedad.setPropietarioActual(vendedor);

        contrato = new ContratoOperacion();
        contrato.setIdOperacion(10);
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(inquilino);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setInterestMoraDiario(new BigDecimal("0.0010"));

        when(contratoRepo.findById(10)).thenReturn(Optional.of(contrato));
        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(propiedadRepo.findById(1)).thenReturn(Optional.of(propiedad));
        when(liquidacionRepo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private LiquidacionMensual liquidacion(LocalDate vencimiento, LocalDate pagoReal) {
        LiquidacionMensual liq = new LiquidacionMensual();
        ContratoOperacion ref = new ContratoOperacion();
        ref.setIdOperacion(10);
        liq.setContrato(ref);
        liq.setMesAnoLiquidado("2026-09");
        liq.setFechaVencimiento(vencimiento);
        liq.setFechaPagoReal(pagoReal);
        liq.setMontoAlquilerBase(new BigDecimal("100000.00"));
        liq.setPorcentajeHonorariosAdministracion(new BigDecimal("5.00"));
        return liq;
    }

    private ContratoOperacion contratoValidoARS() {
        ContratoOperacion c = new ContratoOperacion();
        c.setPropiedad(propiedad);
        c.setVendedorPropietario(vendedor);
        c.setCompradorInquilino(inquilino);
        c.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        c.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        c.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        c.setFrecuenciaAjusteMeses(3);
        c.setFechaInicio(LocalDate.of(2026, 10, 1));
        c.setFechaFin(LocalDate.of(2028, 10, 1));
        c.setMontoTotalOperacion(new BigDecimal("500000"));
        return c;
    }

    // ── Liquidaciones: mora ───────────────────────────────────────────────

    @Test
    void liquidacion_con_atraso_calcula_mora_y_comision() {
        LiquidacionMensual liq = contratoService.registrarLiquidacion(
            liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 15)));

        assertEquals(5, liq.getDiasAtraso());
        // 5 días × 0,10 % × 100.000 = 500,00
        assertEquals(new BigDecimal("500.00"), liq.getMontoMoraCalculado());
        assertEquals(new BigDecimal("100500.00"), liq.getTotalAbonadoInquilino());
        // comisión 5 % sobre la base (no sobre la mora)
        assertEquals(new BigDecimal("5000.00"), liq.getMontoComisionInmobiliaria());
        assertEquals(new BigDecimal("95500.00"), liq.getMontoNetoARendir());
    }

    @Test
    void liquidacion_pagada_en_fecha_no_tiene_mora() {
        LiquidacionMensual liq = contratoService.registrarLiquidacion(
            liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10)));
        assertEquals(0, liq.getDiasAtraso());
        assertEquals(0, liq.getMontoMoraCalculado().compareTo(BigDecimal.ZERO));
    }

    @Test
    void liquidacion_sin_fecha_de_pago_no_rompe_y_no_cobra_mora() {
        LiquidacionMensual liq = assertDoesNotThrow(() -> contratoService.registrarLiquidacion(
            liquidacion(LocalDate.of(2026, 9, 10), null)));
        assertEquals(0, liq.getMontoMoraCalculado().compareTo(BigDecimal.ZERO));
        assertEquals(new BigDecimal("100000.00"), liq.getTotalAbonadoInquilino());
    }

    @Test
    void liquidacion_con_co_corretaje_divide_la_comision_a_la_mitad() {
        contrato.setEsCoCorretaje(true);
        LiquidacionMensual liq = contratoService.registrarLiquidacion(
            liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10)));
        assertEquals(new BigDecimal("2500.00"), liq.getMontoComisionInmobiliaria());
        assertEquals(new BigDecimal("97500.00"), liq.getMontoNetoARendir());
        assertTrue(liq.getEsCoCorretajeMensual());
    }

    @Test
    void la_mora_es_del_propietario_y_no_paga_honorarios() {
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 15));
        liq.setPorcentajeHonorariosAdministracion(new BigDecimal("10.00"));
        LiquidacionMensual r = contratoService.registrarLiquidacion(liq);
        // honorarios 10 % del alquiler base (10.000), mora 500 íntegra al propietario
        assertEquals(new BigDecimal("10000.00"), r.getMontoComisionInmobiliaria());
        assertEquals(new BigDecimal("90500.00"), r.getMontoNetoARendir());
    }

    @Test
    void la_mora_solo_la_retiene_la_inmobiliaria_con_clausula_expresa() {
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 15));
        liq.setPorcentajeHonorariosAdministracion(new BigDecimal("10.00"));
        liq.setMoraParaInmobiliaria(true);
        LiquidacionMensual r = contratoService.registrarLiquidacion(liq);
        assertEquals(new BigDecimal("10500.00"), r.getMontoComisionInmobiliaria());
        assertEquals(new BigDecimal("90000.00"), r.getMontoNetoARendir());
    }

    @Test
    void los_honorarios_de_administracion_por_defecto_son_10_por_ciento() {
        assertEquals(new BigDecimal("10.00"), new LiquidacionMensual().getPorcentajeHonorariosAdministracion());
    }

    @Test
    void honorarios_de_administracion_fuera_de_rango_se_rechazan() {
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10));
        liq.setPorcentajeHonorariosAdministracion(new BigDecimal("150"));
        assertThrows(IllegalArgumentException.class, () -> contratoService.registrarLiquidacion(liq));
    }

    @Test
    void liquidacion_duplicada_del_mismo_mes_se_rechaza() {
        LiquidacionMensual existente = new LiquidacionMensual();
        existente.setMesAnoLiquidado("2026-09");
        existente.setMontoAlquilerBase(new BigDecimal("100000.00"));
        when(liquidacionRepo.findByContratoIdOperacion(10)).thenReturn(List.of(existente));
        assertThrows(IllegalStateException.class, () -> contratoService.registrarLiquidacion(
            liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10))));
    }

    @Test
    void el_alquiler_del_mes_puede_cobrarse_en_partes_y_calcula_el_saldo() {
        LiquidacionMensual aCuenta = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10));
        aCuenta.setMontoAlquilerBase(new BigDecimal("60000.00"));
        aCuenta.setMontoAlquilerMes(new BigDecimal("100000.00"));
        LiquidacionMensual g1 = contratoService.registrarLiquidacion(aCuenta);
        assertTrue(g1.getPagoParcial());
        assertEquals(new BigDecimal("40000.00"), g1.getSaldoAlquilerPendiente());

        when(liquidacionRepo.findByContratoIdOperacion(10)).thenReturn(List.of(g1));
        LiquidacionMensual resto = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 20));
        resto.setMontoAlquilerBase(new BigDecimal("40000.00"));
        resto.setMontoAlquilerMes(new BigDecimal("100000.00"));
        LiquidacionMensual g2 = contratoService.registrarLiquidacion(resto);
        assertEquals(0, g2.getSaldoAlquilerPendiente().signum());

        // ya está completo: un tercer cobro del mismo mes se rechaza
        when(liquidacionRepo.findByContratoIdOperacion(10)).thenReturn(List.of(g1, g2));
        LiquidacionMensual extra = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 25));
        extra.setMontoAlquilerBase(new BigDecimal("1000.00"));
        extra.setMontoAlquilerMes(new BigDecimal("100000.00"));
        assertThrows(IllegalStateException.class, () -> contratoService.registrarLiquidacion(extra));
    }

    @Test
    void un_pago_que_supera_lo_que_falta_del_mes_se_rechaza() {
        LiquidacionMensual previa = new LiquidacionMensual();
        previa.setMesAnoLiquidado("2026-09");
        previa.setMontoAlquilerBase(new BigDecimal("80000.00"));
        when(liquidacionRepo.findByContratoIdOperacion(10)).thenReturn(List.of(previa));
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 12));
        liq.setMontoAlquilerBase(new BigDecimal("30000.00"));
        liq.setMontoAlquilerMes(new BigDecimal("100000.00"));
        assertThrows(IllegalStateException.class, () -> contratoService.registrarLiquidacion(liq));
    }

    @Test
    void un_concepto_distinto_del_alquiler_no_tiene_mora_y_no_bloquea_el_mes() {
        LiquidacionMensual previa = new LiquidacionMensual();
        previa.setMesAnoLiquidado("2026-09");
        previa.setMontoAlquilerBase(new BigDecimal("100000.00"));
        when(liquidacionRepo.findByContratoIdOperacion(10)).thenReturn(List.of(previa));
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 28));
        liq.setConcepto("Indemnización por rescisión");
        liq.setMontoAlquilerBase(new BigDecimal("441103.00"));
        LiquidacionMensual g = contratoService.registrarLiquidacion(liq);
        assertEquals(0, g.getDiasAtraso());
        assertEquals(0, g.getMontoMoraCalculado().signum());
        assertEquals(new BigDecimal("441103.00"), g.getTotalAbonadoInquilino());
        assertNull(g.getSaldoAlquilerPendiente());
    }

    @Test
    void los_honorarios_se_toman_del_contrato_si_el_cobro_no_los_indica() {
        contrato.setAlqPorcentajeAdministracion(new BigDecimal("7.50"));
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10));
        liq.setPorcentajeHonorariosAdministracion(null);
        LiquidacionMensual g = contratoService.registrarLiquidacion(liq);
        assertEquals(new BigDecimal("7.50"), g.getPorcentajeHonorariosAdministracion());
        assertEquals(new BigDecimal("7500.00"), g.getMontoComisionInmobiliaria());
    }

    @Test
    void liquidacion_sobre_contrato_rescindido_se_rechaza() {
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Rescindido);
        assertThrows(IllegalStateException.class, () -> contratoService.registrarLiquidacion(
            liquidacion(LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 10))));
    }

    @Test
    void liquidacion_sin_contrato_da_error_claro_y_no_NullPointer() {
        LiquidacionMensual liq = liquidacion(LocalDate.of(2026, 9, 10), null);
        liq.setContrato(null);
        assertThrows(IllegalArgumentException.class, () -> contratoService.registrarLiquidacion(liq));
    }

    // ── Estado de la propiedad / contrato ─────────────────────────────────

    @Test
    void no_se_puede_contratar_una_propiedad_no_disponible() {
        propiedad.setEstadoPropiedad(Propiedad.EstadoPropiedad.Alquilada);
        IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> contratoService.crearContrato(contratoValidoARS()));
        assertTrue(ex.getMessage().contains("no está disponible"));
    }

    @Test
    void vendedor_y_comprador_no_pueden_ser_la_misma_persona() {
        ContratoOperacion c = contratoValidoARS();
        c.setCompradorInquilino(vendedor);
        assertThrows(IllegalStateException.class, () -> contratoService.crearContrato(c));
    }

    @Test
    void compraventa_deja_la_propiedad_reservada_y_cerrar_venta_la_marca_vendida() {
        ContratoOperacion c = contratoValidoARS();
        c.setTipoContrato(ContratoOperacion.TipoContrato.Compraventa);
        c.setMonedaOperacion(ContratoOperacion.Moneda.USD);
        c.setIdOperacion(10);
        c.setEstadoOperacion("Vigente");   // un contrato sin estado de operación nace como borrador y no toca la propiedad
        contratoService.crearContrato(c);
        assertEquals(Propiedad.EstadoPropiedad.Reservada, propiedad.getEstadoPropiedad());

        when(contratoRepo.findById(10)).thenReturn(Optional.of(c));
        contratoService.cerrarVenta(10);
        assertEquals(Propiedad.EstadoPropiedad.Vendida, propiedad.getEstadoPropiedad());
        assertEquals(2, propiedad.getPropietarioActual().getIdPersona());
        assertEquals(ContratoOperacion.EstadoContrato.Finalizado, c.getEstadoContrato());

        // una venta ya cerrada no se puede cerrar ni rescindir de nuevo
        assertThrows(IllegalStateException.class, () -> contratoService.cerrarVenta(10));
        assertThrows(IllegalStateException.class, () -> contratoService.rescindirContrato(10));
    }

    @Test
    void rescindir_libera_la_propiedad_solo_una_vez() {
        propiedad.setEstadoPropiedad(Propiedad.EstadoPropiedad.Alquilada);
        contratoService.rescindirContrato(10);
        assertEquals(Propiedad.EstadoPropiedad.Disponible, propiedad.getEstadoPropiedad());
        assertEquals(ContratoOperacion.EstadoContrato.Rescindido, contrato.getEstadoContrato());
        assertThrows(IllegalStateException.class, () -> contratoService.rescindirContrato(10));
    }

    // ── Rendiciones ───────────────────────────────────────────────────────

    @Mock private RendicionPropietarioRepository rendicionRepo;
    @Mock private PersonaRepository personaRepo;
    @InjectMocks private RendicionPropietarioService rendicionService;

    @Test
    void crear_rendicion_inicia_en_cero_y_valida_el_mes() {
        when(personaRepo.findById(1)).thenReturn(Optional.of(vendedor));
        when(rendicionRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        RendicionPropietario r = rendicionService.crearRendicion(1, "2026-09");
        assertEquals(BigDecimal.ZERO, r.getTotalNeto());

        assertThrows(IllegalArgumentException.class, () -> rendicionService.crearRendicion(1, null));
        assertThrows(IllegalArgumentException.class, () -> rendicionService.crearRendicion(1, "septiembre"));
        assertThrows(IllegalArgumentException.class, () -> rendicionService.crearRendicion(1, "2026-13"));
    }

    @Test
    void agregar_rendicion_mensual_acumula_sin_NullPointer() {
        RendicionPropietario r = new RendicionPropietario();   // totalNeto arranca en cero
        when(rendicionRepo.findById(5)).thenReturn(Optional.of(r));

        rendicionService.agregarRendicionMensual(5, 1, "Depto", "Inquilino",
            new BigDecimal("100000"), "Alquiler", new BigDecimal("10000"), new BigDecimal("5000"),
            "Pendiente", null, "2026-09");

        assertEquals(new BigDecimal("85000"), r.getTotalNeto());
        assertEquals(1, r.getHistorial().size());
    }

    // ── Finanzas ──────────────────────────────────────────────────────────

    @Mock private MovimientoFinancieroRepository movimientoRepo;
    @InjectMocks private MovimientoFinancieroService movimientoService;

    private MovimientoFinanciero mov(String tipo, String monto, String concepto) {
        MovimientoFinanciero m = new MovimientoFinanciero();
        m.setFecha(LocalDate.of(2026, 9, 5));
        m.setTipo(tipo);
        m.setMonto(new BigDecimal(monto));
        m.setConceptoIngreso(concepto);
        return m;
    }

    @Test
    void totales_por_periodo_acepta_formato_AAAA_MM() {
        when(movimientoRepo.findByFechaBetweenOrderByFechaDesc(any(), any())).thenReturn(List.of(
            mov("Ingreso", "1000", "Alquiler"), mov("Egreso", "300", "Reparación")));

        var t = movimientoService.totalesPorPeriodo("2026-09");
        assertEquals(new BigDecimal("1000"), t.get("ingresos"));
        assertEquals(new BigDecimal("300"), t.get("egresos"));
        assertEquals(new BigDecimal("700"), t.get("saldo"));
        assertThrows(IllegalArgumentException.class, () -> movimientoService.totalesPorPeriodo("hoy"));
    }

    @Test
    void csv_usa_punto_decimal_y_escapa_comas_y_formulas() {
        when(movimientoRepo.findByPropiedadIdPropiedadOrderByFechaDesc(1)).thenReturn(List.of(
            mov("Ingreso", "1234.5", "Alquiler, septiembre"), mov("Egreso", "10", "=SUMA(A1:A2)")));

        String csv = movimientoService.exportarCsv(1);
        assertTrue(csv.contains("\"Alquiler, septiembre\",1234.50"), csv);
        assertTrue(csv.contains("'=SUMA(A1:A2)"), csv);
    }

    @Test
    void suma_por_propiedad_tolera_movimientos_sin_tipo() {
        MovimientoFinanciero sinTipo = mov("Ingreso", "50", "x");
        sinTipo.setTipo(null);
        when(movimientoRepo.findByPropiedadIdPropiedadOrderByFechaDesc(1)).thenReturn(List.of(
            sinTipo, mov("Ingreso", "100", "y")));
        assertEquals(new BigDecimal("100"), movimientoService.sumarMovimientosPorPropiedad(1, "Ingreso"));
    }

    // ── Estado de la operación y edición con cobros ───────────────────────
    @Test
    void estadoOperacionInventadoSeRechaza() {
        contrato.setIdOperacion(null);
        contrato.setEstadoOperacion("Estado inventado");
        assertThrows(IllegalArgumentException.class, () -> contratoService.crearContrato(contrato));
    }

    @Test
    void conCobrosNoSePuedeCambiarElInquilino() {
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        LiquidacionMensual cobro = new LiquidacionMensual();
        cobro.setAnulada(false);
        when(liquidacionRepo.findByContratoIdOperacion(10)).thenReturn(List.of(cobro));
        Persona otro = new Persona();
        otro.setIdPersona(3);
        ContratoOperacion datos = new ContratoOperacion();
        datos.setCompradorInquilino(otro);
        assertThrows(IllegalStateException.class, () -> contratoService.actualizarContrato(10, datos));
    }
}
