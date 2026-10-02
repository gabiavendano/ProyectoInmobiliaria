package com.inmobiliaria.backend;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import com.inmobiliaria.backend.service.CobranzaService;
import com.inmobiliaria.backend.service.ContratoService;
import com.inmobiliaria.backend.service.MovimientoFinancieroService;
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
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CobranzaYMovimientosTest {

    @Mock private ContratoService contratoService;
    @Mock private LiquidacionRepository liquidacionRepo;
    @Mock private MovimientoFinancieroRepository movimientoRepo;
    @Mock private RendicionPropietarioRepository rendicionRepo;
    @Mock private PersonaRepository personaRepo;
    @Mock private CargoServicioRepository cargoRepo;
    @Mock private ContratoRepository contratoRepo;
    @InjectMocks private CobranzaService cobranza;

    @Mock private PropiedadRepository propiedadRepo;
    @InjectMocks private com.inmobiliaria.backend.service.CargoServicioService cargoService;

    @InjectMocks private MovimientoFinancieroService movService;

    private Persona propietario;
    private ContratoOperacion contrato;

    @BeforeEach
    void setUp() {
        propietario = new Persona();
        propietario.setIdPersona(1);
        propietario.setNombreCompleto("Dueño");
        Persona inq = new Persona();
        inq.setIdPersona(2);
        inq.setNombreCompleto("Inquilino");
        Propiedad p = new Propiedad();
        p.setIdPropiedad(5);
        p.setTitulo("Depto 1");
        contrato = new ContratoOperacion();
        contrato.setIdOperacion(10);
        contrato.setPropiedad(p);
        contrato.setVendedorPropietario(propietario);
        contrato.setCompradorInquilino(inq);
        when(personaRepo.findById(1)).thenReturn(Optional.of(propietario));
        when(movimientoRepo.save(any())).thenAnswer(i -> { MovimientoFinanciero m = i.getArgument(0); if (m.getIdMovimiento() == null) m.setIdMovimiento(77); return m; });
        when(rendicionRepo.save(any())).thenAnswer(i -> { RendicionPropietario r = i.getArgument(0); if (r.getIdRendicion() == null) r.setIdRendicion(3); return r; });
        when(liquidacionRepo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private LiquidacionMensual cobrada(int id, String mes) {
        LiquidacionMensual l = new LiquidacionMensual();
        l.setIdLiquidacion(id);
        l.setContrato(contrato);
        l.setMesAnoLiquidado(mes);
        l.setFechaPagoReal(LocalDate.of(2026, 9, 10));
        l.setMontoAlquilerBase(new BigDecimal("100000.00"));
        l.setMontoMoraCalculado(BigDecimal.ZERO);
        l.setDiasAtraso(0);
        l.setPorcentajeHonorariosAdministracion(new BigDecimal("10.00"));
        l.setMontoComisionInmobiliaria(new BigDecimal("10000.00"));
        l.setMontoNetoARendir(new BigDecimal("90000.00"));
        l.setMoneda("ARS");
        return l;
    }

    // ── Cobros ──────────────────────────────────────────────────────

    @Test
    void cobrar_genera_recibo_correlativo_e_ingreso() {
        LiquidacionMensual existente = cobrada(1, "2026-08");
        existente.setNumeroRecibo("0001-00000007");
        when(liquidacionRepo.findAll()).thenReturn(List.of(existente));
        LiquidacionMensual nueva = cobrada(2, "2026-09");
        nueva.setMontoNetoARendir(new BigDecimal("90000.00"));
        nueva.setTotalAbonadoInquilino(new BigDecimal("100000.00"));
        when(contratoService.registrarLiquidacion(any())).thenReturn(nueva);

        LiquidacionMensual r = cobranza.registrarCobro(nueva);

        assertEquals("0001-00000008", r.getNumeroRecibo());
        assertEquals(77, r.getIdMovimiento());
        verify(movimientoRepo).save(argThat(m -> "Ingreso".equals(m.getTipo()) && "Completado".equals(m.getEstado())
            && "Cobranza".equals(m.getOrigen()) && m.getMonto().compareTo(new BigDecimal("100000.00")) == 0));
    }

    @Test
    void cobrar_y_anular_guardan_el_usuario_y_no_aceptan_uno_enviado_por_el_cliente() {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("gabi", null, java.util.List.of()));
        try {
            when(liquidacionRepo.findAll()).thenReturn(List.of());
            LiquidacionMensual nueva = cobrada(2, "2026-09");
            nueva.setRegistradoPor("otro-usuario");
            nueva.setTotalAbonadoInquilino(new BigDecimal("100000.00"));
            when(contratoService.registrarLiquidacion(any())).thenAnswer(i -> i.getArgument(0));
            LiquidacionMensual r = cobranza.registrarCobro(nueva);
            assertEquals("gabi", r.getRegistradoPor());
            verify(movimientoRepo).save(argThat(m -> "gabi".equals(m.getRegistradoPor())));

            when(liquidacionRepo.findById(2)).thenReturn(Optional.of(r));
            LiquidacionMensual anulada = cobranza.anularCobro(2, "Error de carga");
            assertEquals("gabi", anulada.getAnuladoPor());
        } finally {
            org.springframework.security.core.context.SecurityContextHolder.clearContext();
        }
    }

    @Test
    void sin_usuario_autenticado_se_registra_como_sistema() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        assertEquals("sistema", com.inmobiliaria.backend.config.UsuarioActual.nombre());
    }

    @Test
    void cobrar_sin_fecha_de_pago_se_rechaza() {
        LiquidacionMensual l = cobrada(2, "2026-09");
        l.setFechaPagoReal(null);
        assertThrows(IllegalArgumentException.class, () -> cobranza.registrarCobro(l));
    }

    @Test
    void anular_cobro_anula_el_ingreso_y_exige_motivo() {
        LiquidacionMensual l = cobrada(2, "2026-09");
        l.setIdMovimiento(77);
        MovimientoFinanciero m = new MovimientoFinanciero();
        m.setIdMovimiento(77);
        m.setEstado("Completado");
        when(liquidacionRepo.findById(2)).thenReturn(Optional.of(l));
        when(movimientoRepo.findById(77)).thenReturn(Optional.of(m));
        assertThrows(IllegalArgumentException.class, () -> cobranza.anularCobro(2, " "));
        cobranza.anularCobro(2, "Error de carga");
        assertTrue(l.getAnulada());
        assertEquals("Anulado", m.getEstado());
    }

    @Test
    void no_se_anula_un_cobro_ya_rendido() {
        LiquidacionMensual l = cobrada(2, "2026-09");
        l.setIdRendicion(3);
        when(liquidacionRepo.findById(2)).thenReturn(Optional.of(l));
        assertThrows(IllegalStateException.class, () -> cobranza.anularCobro(2, "x"));
    }

    // ── Servicios / prorrateo ───────────────────────────────────────

    private CargoServicio cargo(int id, String monto, String estado) {
        CargoServicio c = new CargoServicio();
        c.setIdCargo(id);
        c.setPropiedad(contrato.getPropiedad());
        c.setConcepto("Luz");
        c.setPeriodoMesAnio("2026-09");
        c.setMonto(new BigDecimal(monto));
        c.setEstado(estado);
        return c;
    }

    @Test
    void cobro_incluye_los_servicios_pendientes_y_los_marca_cobrados() {
        when(liquidacionRepo.findAll()).thenReturn(List.of());
        when(contratoRepo.findById(10)).thenReturn(Optional.of(contrato));
        CargoServicio c1 = cargo(1, "3000", "Pendiente");
        CargoServicio c2 = cargo(2, "500.50", "Pendiente");
        when(cargoRepo.findById(1)).thenReturn(Optional.of(c1));
        when(cargoRepo.findById(2)).thenReturn(Optional.of(c2));
        LiquidacionMensual liq = cobrada(2, "2026-09");
        liq.setContrato(contrato);
        liq.setCargosIds(List.of(1, 2));
        when(contratoService.registrarLiquidacion(any())).thenAnswer(i -> {
            LiquidacionMensual l = i.getArgument(0);
            l.setIdLiquidacion(9);
            l.setTotalAbonadoInquilino(new BigDecimal("100000.00").add(l.getMontoServicios()));
            return l;
        });
        LiquidacionMensual r = cobranza.registrarCobro(liq);
        assertEquals(new BigDecimal("3500.50"), r.getMontoServicios());
        assertTrue(r.getServiciosDetalle().contains("Luz 2026-09|3000"));
        assertEquals("Cobrado", c1.getEstado());
        assertEquals(9, c2.getIdLiquidacion());
    }

    @Test
    void cobro_rechaza_cargos_ya_cobrados_o_de_otra_propiedad() {
        when(contratoRepo.findById(10)).thenReturn(Optional.of(contrato));
        when(cargoRepo.findById(1)).thenReturn(Optional.of(cargo(1, "100", "Cobrado")));
        LiquidacionMensual liq = cobrada(2, "2026-09");
        liq.setContrato(contrato);
        liq.setCargosIds(List.of(1));
        assertThrows(IllegalStateException.class, () -> cobranza.registrarCobro(liq));

        CargoServicio ajeno = cargo(2, "100", "Pendiente");
        Propiedad otra = new Propiedad();
        otra.setIdPropiedad(99);
        ajeno.setPropiedad(otra);
        when(cargoRepo.findById(2)).thenReturn(Optional.of(ajeno));
        liq.setCargosIds(List.of(2));
        assertThrows(IllegalStateException.class, () -> cobranza.registrarCobro(liq));
    }

    @Test
    void anular_cobro_devuelve_los_servicios_a_pendiente() {
        LiquidacionMensual l = cobrada(2, "2026-09");
        l.setIdMovimiento(77);
        CargoServicio c = cargo(1, "100", "Cobrado");
        c.setIdLiquidacion(2);
        when(liquidacionRepo.findById(2)).thenReturn(Optional.of(l));
        when(cargoRepo.findByIdLiquidacion(2)).thenReturn(List.of(c));
        cobranza.anularCobro(2, "Error");
        assertEquals("Pendiente", c.getEstado());
        assertNull(c.getIdLiquidacion());
    }

    @Test
    void lote_de_cargos_valida_periodo_monto_y_alquiler_vigente() {
        Propiedad p = contrato.getPropiedad();
        when(propiedadRepo.findById(5)).thenReturn(Optional.of(p));
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        when(contratoRepo.findByPropiedadIdPropiedad(5)).thenReturn(List.of(contrato));
        when(cargoRepo.saveAll(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> ok = new HashMap<>();
        ok.put("periodoMesAnio", "2026-09");
        ok.put("items", List.of(Map.of("idPropiedad", 5, "concepto", "Agua", "monto", 1200.5, "medicion", 12, "unidadMedida", "m3")));
        List<CargoServicio> out = cargoService.crearLote(ok);
        assertEquals(1, out.size());
        assertEquals("Pendiente", out.get(0).getEstado());
        assertEquals(new BigDecimal("1200.50"), out.get(0).getMonto());

        assertThrows(IllegalArgumentException.class, () -> cargoService.crearLote(new HashMap<>(Map.of("periodoMesAnio", "septiembre", "items", List.of()))));
        assertThrows(IllegalArgumentException.class, () -> cargoService.crearLote(new HashMap<>(Map.of("periodoMesAnio", "2026-09",
            "items", List.of(Map.of("idPropiedad", 5, "concepto", "Agua", "monto", 0))))));
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Finalizado);
        assertThrows(IllegalStateException.class, () -> cargoService.crearLote(ok));
    }

    // ── Rendiciones ─────────────────────────────────────────────────

    @Test
    void rendicion_suma_solo_cobros_del_propietario_sin_rendir_y_no_anulados() {
        LiquidacionMensual ok = cobrada(1, "2026-09");
        LiquidacionMensual yaRendida = cobrada(2, "2026-09"); yaRendida.setIdRendicion(9);
        LiquidacionMensual anulada = cobrada(3, "2026-09"); anulada.setAnulada(true);
        LiquidacionMensual otroMes = cobrada(4, "2026-08");
        when(liquidacionRepo.findAll()).thenReturn(List.of(ok, yaRendida, anulada, otroMes));
        Map<String, Object> p = cobranza.previewRendicion(1, "2026-09", "ARS");
        assertEquals(1, p.get("cobros"));
        assertEquals(new BigDecimal("90000.00"), p.get("subtotal"));
    }

    @Test
    void rendicion_incluye_los_servicios_cobrados_sin_honorarios_y_se_pueden_excluir() {
        LiquidacionMensual l = cobrada(1, "2026-09");
        l.setMontoServicios(new BigDecimal("11500.00"));
        l.setServiciosDetalle("Luz 2026-09|3000\nAgua 2026-09|8500");
        when(liquidacionRepo.findAll()).thenReturn(List.of(l));

        Map<String, Object> con = cobranza.previewRendicion(1, "2026-09", "ARS", true);
        assertEquals(new BigDecimal("101500.00"), con.get("subtotal"));   // 90.000 neto + 11.500 de servicios
        assertEquals(4, ((List<?>) con.get("lineas")).size());             // alquiler + 2 servicios + honorarios (sin mora)

        Map<String, Object> sin = cobranza.previewRendicion(1, "2026-09", "ARS", false);
        assertEquals(new BigDecimal("90000.00"), sin.get("subtotal"));
    }

    @Test
    void generar_rendicion_descuenta_gastos_marca_cobros_y_programa_transferencia() {
        LiquidacionMensual l = cobrada(1, "2026-09");
        when(liquidacionRepo.findAll()).thenReturn(List.of(l));
        when(liquidacionRepo.findById(1)).thenReturn(Optional.of(l));
        Map<String, Object> data = new HashMap<>();
        data.put("idPropietario", 1);
        data.put("mesAno", "2026-09");
        data.put("gastos", List.of(Map.of("descripcion", "Plomería", "monto", 15000)));
        data.put("crearTransferencia", true);

        RendicionPropietario r = cobranza.generarRendicion(data);

        assertEquals(new BigDecimal("75000.00"), r.getTotalNeto());
        assertEquals("REN-202609-3", r.getComprobante());
        assertEquals(3, l.getIdRendicion());
        assertEquals(LiquidacionMensual.EstadoRendicion.RendidoAlPropietario, l.getEstadoRendicion());
        assertEquals(77, r.getIdMovimiento());
    }

    @Test
    void rendicion_sin_cobros_o_con_total_negativo_se_rechaza() {
        when(liquidacionRepo.findAll()).thenReturn(List.of());
        Map<String, Object> vacio = new HashMap<>(Map.of("idPropietario", 1, "mesAno", "2026-09"));
        assertThrows(IllegalStateException.class, () -> cobranza.generarRendicion(vacio));

        when(liquidacionRepo.findAll()).thenReturn(List.of(cobrada(1, "2026-09")));
        Map<String, Object> negativo = new HashMap<>(Map.of("idPropietario", 1, "mesAno", "2026-09",
            "gastos", List.of(Map.of("descripcion", "Obra", "monto", 999999))));
        assertThrows(IllegalArgumentException.class, () -> cobranza.generarRendicion(negativo));
    }

    @Test
    void rendicion_transferida_no_se_anula_y_anular_libera_los_cobros() {
        LiquidacionMensual l = cobrada(1, "2026-09");
        l.setIdRendicion(3);
        RendicionPropietario r = new RendicionPropietario();
        r.setIdRendicion(3);
        r.setEstado("Pendiente");
        when(rendicionRepo.findById(3)).thenReturn(Optional.of(r));
        when(liquidacionRepo.findAll()).thenReturn(List.of(l));
        cobranza.anularRendicion(3, "Error");
        assertEquals("Anulada", r.getEstado());
        assertNull(l.getIdRendicion());

        RendicionPropietario t = new RendicionPropietario();
        t.setIdRendicion(4);
        t.setEstado("Transferida");
        when(rendicionRepo.findById(4)).thenReturn(Optional.of(t));
        assertThrows(IllegalStateException.class, () -> cobranza.anularRendicion(4, "x"));
    }

    // ── Movimientos ─────────────────────────────────────────────────

    private MovimientoFinanciero mov(String tipo, String monto) {
        MovimientoFinanciero m = new MovimientoFinanciero();
        m.setTipo(tipo);
        m.setMonto(monto == null ? null : new BigDecimal(monto));
        m.setPersona(propietario);
        return m;
    }

    @Test
    void movimiento_valido_toma_valores_por_defecto() {
        MovimientoFinanciero m = mov("Ingreso", "1000");
        movService.validar(m);
        assertEquals("Completado", m.getEstado());
        assertEquals(MovimientoFinanciero.Moneda.ARS, m.getMoneda());
        assertNotNull(m.getFecha());
    }

    @Test
    void movimiento_invalido_se_rechaza() {
        assertThrows(IllegalArgumentException.class, () -> movService.validar(mov("Otro", "1000")));
        assertThrows(IllegalArgumentException.class, () -> movService.validar(mov("Ingreso", "0")));
        assertThrows(IllegalArgumentException.class, () -> movService.validar(mov("Ingreso", "-5")));
        assertThrows(IllegalArgumentException.class, () -> movService.validar(mov("Ingreso", null)));
        MovimientoFinanciero estadoRaro = mov("Ingreso", "10");
        estadoRaro.setEstado("Enviada (Acreditación 24hs)");
        assertThrows(IllegalArgumentException.class, () -> movService.validar(estadoRaro));
        MovimientoFinanciero sinPersona = mov("Transferencia", "10");
        sinPersona.setPersona(null);
        assertThrows(IllegalArgumentException.class, () -> movService.validar(sinPersona));
    }

    @Test
    void anular_movimiento_manual_pide_motivo_y_no_toca_los_automaticos() {
        MovimientoFinanciero manual = mov("Egreso", "50");
        manual.setIdMovimiento(1);
        manual.setOrigen("Manual");
        manual.setEstado("Completado");
        when(movimientoRepo.findById(1)).thenReturn(Optional.of(manual));
        assertThrows(IllegalArgumentException.class, () -> movService.anular(1, ""));
        movService.anular(1, "Duplicado");
        assertEquals("Anulado", manual.getEstado());

        MovimientoFinanciero auto = mov("Ingreso", "50");
        auto.setIdMovimiento(2);
        auto.setOrigen("Cobranza");
        when(movimientoRepo.findById(2)).thenReturn(Optional.of(auto));
        assertThrows(IllegalStateException.class, () -> movService.anular(2, "x"));
    }
}
