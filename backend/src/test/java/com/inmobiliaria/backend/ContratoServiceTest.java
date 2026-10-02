package com.inmobiliaria.backend;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import com.inmobiliaria.backend.service.AuditoriaService;
import com.inmobiliaria.backend.service.ContratoService;
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
import static org.mockito.Mockito.*;

/**
 * Tests de ContratoService — valida las reglas de negocio
 * y las validaciones legales (DNU 70/2023, BCRA, inhibidos, legajos).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ContratoServiceTest {

    @Mock private ContratoRepository contratoRepo;
    @Mock private PropiedadRepository propiedadRepo;
    @Mock private LiquidacionRepository liquidacionRepo;
    @Mock private AuditoriaService auditoria;
    @InjectMocks private ContratoService service;

    private Propiedad propiedad;
    private Persona vendedor;
    private Persona comprador;

    @BeforeEach
    void setUp() {
        propiedad = new Propiedad();
        propiedad.setIdPropiedad(1);
        propiedad.setTitulo("Propiedad de prueba");
        propiedad.setLinkEscrituraPdf("https://ejemplo.com/escritura.pdf");
        propiedad.setLinkInformeDominioPdf("https://ejemplo.com/dominio.pdf");
        propiedad.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);

        vendedor = new Persona();
        vendedor.setIdPersona(1);
        vendedor.setNombreCompleto("Juan Vendedor");
        vendedor.setDniCuit("27123456");
        vendedor.setEstadoBcra(1);
        vendedor.setInhibido(false);
        vendedor.setRolPrincipal(Persona.RolPrincipal.Propietario);

        comprador = new Persona();
        comprador.setIdPersona(2);
        comprador.setNombreCompleto("María Compradora");
        comprador.setDniCuit("23456789");
        comprador.setEstadoBcra(1);
        comprador.setInhibido(false);
        comprador.setRolPrincipal(Persona.RolPrincipal.Inquilino);

        // El vendedor del contrato es siempre el propietario actual de la ficha
        propiedad.setPropietarioActual(vendedor);
        when(propiedadRepo.findById(1)).thenReturn(Optional.of(propiedad));
        when(contratoRepo.findAll()).thenReturn(List.of());
    }

    // ── CREACIÓN: ARS con ICL ──────────────────────────────────────────────

    @Test
    void crearContrato_ARS_con_ICL_y_frecuencia_DeberiaExito() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato.setFrecuenciaAjusteMeses(3);
        contrato.setInterestMoraDiario(new BigDecimal("0.0005"));

        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        doNothing().when(auditoria).validarLegajosPropiedad(any());
        when(propiedadRepo.findById(1)).thenReturn(Optional.of(propiedad));

        ContratoOperacion resultado = assertDoesNotThrow(() -> service.crearContrato(contrato));
        assertNotNull(resultado);
        assertEquals(ContratoOperacion.IndiceAjuste.ICL, resultado.getIndiceAjuste());
        assertEquals(3, resultado.getFrecuenciaAjusteMeses());
    }

    // ── CREACIÓN: ARS sin índice ─────────────────────────────────────────

    @Test
    void crearContrato_ARS_sin_indice_es_monto_fijo_y_se_acepta() {
        // Desde el DNU 70/2023 el ajuste se pacta libremente: "sin ajuste" (monto fijo) es válido
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.Ninguno);
        contrato.setFrecuenciaAjusteMeses(null);

        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        doNothing().when(auditoria).validarLegajosPropiedad(any());

        ContratoOperacion r = assertDoesNotThrow(() -> service.crearContrato(contrato));
        assertEquals(ContratoOperacion.IndiceAjuste.Ninguno, r.getIndiceAjuste());
        assertNull(r.getFrecuenciaAjusteMeses());
    }

    @Test
    void crearContrato_alquiler_anual_sincroniza_canon_moneda_y_fechas() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setAlqFechaInicio(LocalDate.now());
        contrato.setAlqFechaFin(LocalDate.now().plusYears(2));
        contrato.setAlqCanonMonto(new BigDecimal("300000"));
        contrato.setAlqCanonMoneda(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.IPC);
        contrato.setFrecuenciaAjusteMeses(4);

        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        doNothing().when(auditoria).validarLegajosPropiedad(any());

        ContratoOperacion r = assertDoesNotThrow(() -> service.crearContrato(contrato));
        assertEquals(new BigDecimal("300000"), r.getMontoTotalOperacion());
        assertEquals(ContratoOperacion.Moneda.ARS, r.getMonedaOperacion());
        assertEquals(LocalDate.now(), r.getFechaInicio());
        assertEquals(LocalDate.now().plusYears(2), r.getFechaFin());
    }

    @Test
    void crearContrato_alquiler_con_frecuencia_mayor_a_12_meses_DeberiaFallar() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato.setFrecuenciaAjusteMeses(24);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.crearContrato(contrato));
        assertTrue(ex.getMessage().contains("12 meses"));
    }

    @Test
    void crearContrato_garante_igual_al_locatario_DeberiaFallar() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato.setFrecuenciaAjusteMeses(3);
        contrato.setGarantesAdicionales(new java.util.ArrayList<>(java.util.List.of(comprador.getIdPersona())));

        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        doNothing().when(auditoria).validarLegajosPropiedad(any());

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.crearContrato(contrato));
        assertTrue(ex.getMessage().contains("garante"));
    }

    // ── CREACIÓN: ARS sin frecuencia ───────────────────────────────────────

    @Test
    void crearContrato_ARS_con_indice_pero_sin_frecuencia_DeberiaFallar() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.IPC);
        contrato.setFrecuenciaAjusteMeses(null);   // ← falta frecuencia

        when(contratoRepo.save(any())).thenReturn(contrato);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
            service.crearContrato(contrato));

        assertTrue(ex.getMessage().contains("DNU 70/2023") ||
                   ex.getMessage().contains("frecuencia"));
    }

    // ── CREACIÓN: USD (sin índice ni frecuencia) ─────────────────────────

    @Test
    void crearContrato_USD_sin_indiceNiFrecuencia_DeberiaExito() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Compraventa);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("250000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.USD);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.Ninguno);
        contrato.setFrecuenciaAjusteMeses(null);

        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        doNothing().when(auditoria).validarLegajosPropiedad(any());
        when(propiedadRepo.findById(1)).thenReturn(Optional.of(propiedad));

        ContratoOperacion resultado = assertDoesNotThrow(() -> service.crearContrato(contrato));
        assertNotNull(resultado);
        assertEquals(ContratoOperacion.IndiceAjuste.Ninguno, resultado.getIndiceAjuste());
        assertNull(resultado.getFrecuenciaAjusteMeses());
    }

    // ── VALIDACIÓN: BCRA >= 2 ────────────────────────────────────────────

    @Test
    void crearContrato_comprador_con_BCRA_2_DeberiaFallar() {
        // contratoARSSinIndice(conBcrra2());  // ← eliminado: helper no implementado

        Persona compradorConRiesgo = new Persona();
        compradorConRiesgo.setIdPersona(2);
        compradorConRiesgo.setNombreCompleto("Fulano Riesgo");
        compradorConRiesgo.setDniCuit("23456789");
        compradorConRiesgo.setEstadoBcra(2);   // ← Riesgo
        compradorConRiesgo.setInhibido(false);
        compradorConRiesgo.setRolPrincipal(Persona.RolPrincipal.Inquilino);

        doThrow(new IllegalStateException("RIESGO FINANCIERO: BCRA >= 2"))
            .when(auditoria).validarEstadoBcra(2);

        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setCompradorInquilino(compradorConRiesgo);
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato.setFrecuenciaAjusteMeses(3);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
            service.crearContrato(contrato));

        assertTrue(ex.getMessage().contains("BCRA") || ex.getMessage().contains("RIESGO"));
    }

    // helper
    private void contratoARSSinIndice(Persona comprador) {
        // no se usa, solo referencia del patrón
    }

    // ── VALIDACIÓN: Persona inhibida ──────────────────────────────────────

    @Test
    void crearContrato_comprador_inhibido_DeberiaFallar() {
        Persona compradorInhibido = new Persona();
        compradorInhibido.setIdPersona(2);
        compradorInhibido.setNombreCompleto("Fulano Inhibido");
        compradorInhibido.setDniCuit("23456789");
        compradorInhibido.setEstadoBcra(1);
        compradorInhibido.setInhibido(true);   // ← Inhibido

        doThrow(new IllegalStateException("RIESGO LEGAL: inhibido judicialmente"))
            .when(auditoria).validarNoInhibido(2);

        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setCompradorInquilino(compradorInhibido);
        contrato.setPropiedad(propiedad);
        contrato.setVendedorPropietario(vendedor);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato.setFrecuenciaAjusteMeses(3);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
            service.crearContrato(contrato));

        assertTrue(ex.getMessage().contains("inhibido") ||
                   ex.getMessage().contains("LEGAL"));
    }

    // ── VALIDACIÓN: Propiedad sin escritura ──────────────────────────────

    @Test
    void crearContrato_propiedad_sin_escritura_DeberiaFallar() {
        Propiedad sinEscritura = new Propiedad();
        sinEscritura.setIdPropiedad(1);
        sinEscritura.setTitulo("Propiedad sin legajo");
        sinEscritura.setLinkEscrituraPdf(null);     // ← sin escritura
        sinEscritura.setLinkInformeDominioPdf("https://ejemplo.com/dominio.pdf");
        sinEscritura.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        sinEscritura.setPropietarioActual(vendedor);
        when(propiedadRepo.findById(1)).thenReturn(Optional.of(sinEscritura));

        doThrow(new IllegalStateException("LEGAJO INCOMPLETO: sin escritura"))
            .when(auditoria).validarLegajosPropiedad(1);

        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setPropiedad(sinEscritura);
        contrato.setVendedorPropietario(vendedor);
        contrato.setCompradorInquilino(comprador);
        contrato.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato.setFechaInicio(LocalDate.now());
        contrato.setFechaFin(LocalDate.now().plusYears(2));
        contrato.setMontoTotalOperacion(new BigDecimal("500000"));
        contrato.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato.setFrecuenciaAjusteMeses(3);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
            service.crearContrato(contrato));

        assertTrue(ex.getMessage().contains("LEGAJO") || ex.getMessage().contains("escritura"));
    }

    // ── HONORARIOS (Ley 9.445): coherencia de estados y total calculado por el servidor ──

    private ContratoOperacion ventaConHonorarios() {
        ContratoOperacion c = new ContratoOperacion();
        c.setPropiedad(propiedad);
        c.setVendedorPropietario(vendedor);
        c.setCompradorInquilino(comprador);
        c.setTipoContrato(ContratoOperacion.TipoContrato.Compraventa);
        c.setFechaInicio(LocalDate.now());
        c.setMontoTotalOperacion(new BigDecimal("100000"));
        c.setMonedaOperacion(ContratoOperacion.Moneda.USD);
        c.setHonParteAMonto(new BigDecimal("3000"));
        c.setHonParteBMonto(new BigDecimal("3000"));
        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        return c;
    }

    @Test
    void honorarios_el_total_lo_calcula_el_servidor_y_no_cuenta_partes_anuladas() {
        ContratoOperacion c = ventaConHonorarios();
        c.setHonMontoTotal(new BigDecimal("999999"));           // un total inventado desde afuera se corrige
        assertEquals(0, new BigDecimal("6000.00").compareTo(service.crearContrato(c).getHonMontoTotal()));

        propiedad.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);   // el primer contrato la dejó Reservada
        ContratoOperacion c2 = ventaConHonorarios();
        c2.setHonParteBEstado("Anulado");
        assertEquals(0, new BigDecimal("3000.00").compareTo(service.crearContrato(c2).getHonMontoTotal()));
    }

    @Test
    void honorarios_abonado_sin_indicar_lo_cobrado_se_toma_como_cobrado_todo() {
        ContratoOperacion c = ventaConHonorarios();
        c.setHonParteAEstado("Abonado");
        ContratoOperacion r = service.crearContrato(c);
        assertEquals(0, new BigDecimal("3000").compareTo(r.getHonParteACobrado()));
    }

    @Test
    void honorarios_facturado_sin_comprobante_se_rechaza() {
        ContratoOperacion c = ventaConHonorarios();
        c.setHonParteAEstado("Facturado");
        assertThrows(IllegalArgumentException.class, () -> service.crearContrato(c));
    }

    @Test
    void honorarios_parcialmente_abonado_exige_un_cobro_parcial_y_no_mas_que_el_monto() {
        ContratoOperacion sinCobro = ventaConHonorarios();
        sinCobro.setHonParteAEstado("Parcialmente abonado");
        assertThrows(IllegalArgumentException.class, () -> service.crearContrato(sinCobro));

        ContratoOperacion demas = ventaConHonorarios();
        demas.setHonParteAEstado("Parcialmente abonado");
        demas.setHonParteACobrado(new BigDecimal("4000"));
        assertThrows(IllegalArgumentException.class, () -> service.crearContrato(demas));

        ContratoOperacion ok = ventaConHonorarios();
        ok.setHonParteAEstado("Parcialmente abonado");
        ok.setHonParteACobrado(new BigDecimal("1000"));
        assertDoesNotThrow(() -> service.crearContrato(ok));
    }

    @Test
    void honorarios_porcentaje_fuera_de_rango_se_rechaza() {
        ContratoOperacion c = ventaConHonorarios();
        c.setHonParteAPorcentaje(new BigDecimal("150"));
        assertThrows(IllegalArgumentException.class, () -> service.crearContrato(c));
    }

    // ── LISTAR ──────────────────────────────────────────────────────────────

    @Test
    void listarTodos_DeberiaRetornarListaVacia() {
        when(contratoRepo.findAll()).thenReturn(List.of());

        Iterable<ContratoOperacion> resultado = service.listarTodos();
        assertNotNull(resultado);
        assertTrue(resultado.spliterator().hasCharacteristics(java.util.Spliterator.ORDERED));
    }

    @Test
    void listarPorId_PropiedadExistente_DeberiaRetornarOptionalConDatos() {
        ContratoOperacion contrato = new ContratoOperacion();
        contrato.setIdOperacion(1);
        when(contratoRepo.findById(1)).thenReturn(Optional.of(contrato));

        Optional<ContratoOperacion> resultado = service.buscarPorId(1);
        assertTrue(resultado.isPresent());
        assertEquals(1, resultado.get().getIdOperacion());
    }

    @Test
    void listarPorId_PropiedadInexistente_DeberiaRetornarOptionalEmpty() {
        when(contratoRepo.findById(999)).thenReturn(Optional.empty());

        Optional<ContratoOperacion> resultado = service.buscarPorId(999);
        assertFalse(resultado.isPresent());
    }

    // ── PERMUTA ─────────────────────────────────────────────────────────────

    private ContratoOperacion permutaBase() {
        ContratoOperacion c = new ContratoOperacion();
        c.setPropiedad(propiedad);
        c.setVendedorPropietario(vendedor);
        c.setCompradorInquilino(comprador);
        c.setTipoContrato(ContratoOperacion.TipoContrato.Permuta);
        c.setEstadoOperacion("Vigente");
        c.setFechaInicio(LocalDate.now());
        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        doNothing().when(auditoria).validarLegajosPropiedad(any());
        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        return c;
    }

    @Test
    void crearPermuta_sin_indicar_que_entrega_la_parte_B_DeberiaFallar() {
        ContratoOperacion c = permutaBase();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.crearContrato(c));
        assertTrue(ex.getMessage().contains("Parte B"));
    }

    @Test
    void crearPermuta_con_bien_descripto_y_sin_diferencia_DeberiaExito() {
        ContratoOperacion c = permutaBase();
        c.setPerBienesB("Camioneta 2022");
        ContratoOperacion r = assertDoesNotThrow(() -> service.crearContrato(c));
        assertEquals(0, r.getPerDiferenciaMonto().signum());
        assertNull(r.getPerQuienPagaDiferencia());
        assertEquals(Propiedad.EstadoPropiedad.Permutada, propiedad.getEstadoPropiedad());
    }

    @Test
    void crearPermuta_con_diferencia_exige_quien_abona() {
        ContratoOperacion c = permutaBase();
        c.setPerBienesB("Lote");
        c.setPerDiferenciaMonto(new BigDecimal("5000"));
        c.setPerDiferenciaMoneda(ContratoOperacion.Moneda.USD);
        c.setPerQuienPagaDiferencia(null);
        assertThrows(IllegalArgumentException.class, () -> service.crearContrato(c));
    }

    @Test
    void crearPermuta_con_propiedad_de_B_la_bloquea_y_al_cerrar_se_intercambian_los_duenios() {
        Propiedad b = new Propiedad();
        b.setIdPropiedad(7);
        b.setTitulo("Casa de B");
        b.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        b.setPropietarioActual(comprador);
        when(propiedadRepo.findById(7)).thenReturn(Optional.of(b));

        ContratoOperacion c = permutaBase();
        c.setPerPropiedadBId(7);
        c.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        ContratoOperacion r = assertDoesNotThrow(() -> service.crearContrato(c));
        assertEquals(Propiedad.EstadoPropiedad.Permutada, b.getEstadoPropiedad());

        when(contratoRepo.findById(any())).thenReturn(Optional.of(r));
        r.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        service.cerrarPermuta(1);
        assertEquals(2, propiedad.getPropietarioActual().getIdPersona());   // A pasó a la Parte B
        assertEquals(1, b.getPropietarioActual().getIdPersona());           // B pasó a la Parte A
        assertEquals(ContratoOperacion.EstadoContrato.Finalizado, r.getEstadoContrato());
    }

    @Test
    void crearPermuta_con_propiedad_que_no_es_de_la_parte_B_DeberiaFallar() {
        Propiedad ajena = new Propiedad();
        ajena.setIdPropiedad(8);
        ajena.setTitulo("Casa ajena");
        ajena.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        ajena.setPropietarioActual(vendedor);   // no es de la Parte B
        when(propiedadRepo.findById(8)).thenReturn(Optional.of(ajena));

        ContratoOperacion c = permutaBase();
        c.setPerPropiedadBId(8);
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.crearContrato(c));
        assertTrue(ex.getMessage().contains("Parte B"));
    }

    // ── ALQUILER TEMPORARIO ─────────────────────────────────────────────────

    private ContratoOperacion temporario(LocalDate in, LocalDate out) {
        ContratoOperacion c = new ContratoOperacion();
        c.setPropiedad(propiedad);
        c.setVendedorPropietario(vendedor);
        c.setCompradorInquilino(comprador);
        c.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        c.setEstadoOperacion("Vigente");
        c.setTempCheckIn(in);
        c.setTempCheckOut(out);
        c.setTempHuespedes(2);
        c.setTempPrecioNoche(new BigDecimal("50000"));
        c.setTempMoneda(ContratoOperacion.Moneda.ARS);
        doNothing().when(auditoria).validarEstadoBcra(any());
        doNothing().when(auditoria).validarNoInhibido(any());
        when(contratoRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        return c;
    }

    @Test
    void crearTemporario_calcula_total_sincroniza_fechas_y_NO_bloquea_la_propiedad() {
        LocalDate in = LocalDate.now().plusDays(10);
        ContratoOperacion c = temporario(in, in.plusDays(4));
        ContratoOperacion r = assertDoesNotThrow(() -> service.crearContrato(c));
        assertEquals(0, new BigDecimal("200000").compareTo(r.getTempPrecioTotal()));
        assertEquals(0, new BigDecimal("200000").compareTo(r.getMontoTotalOperacion()));
        assertEquals(in, r.getFechaInicio());
        assertEquals(in.plusDays(4), r.getFechaFin());
        assertEquals(Propiedad.EstadoPropiedad.Disponible, propiedad.getEstadoPropiedad());   // sigue libre para otras fechas
    }

    @Test
    void crearTemporario_que_se_superpone_con_otra_estadia_confirmada_DeberiaFallar() {
        LocalDate in = LocalDate.now().plusDays(10);
        ContratoOperacion existente = temporario(in, in.plusDays(5));
        existente.setIdOperacion(50);
        existente.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        when(contratoRepo.findByPropiedadIdPropiedad(1)).thenReturn(List.of(existente));

        ContratoOperacion nuevo = temporario(in.plusDays(3), in.plusDays(8));
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.crearContrato(nuevo));
        assertTrue(ex.getMessage().contains("superponen"));
    }

    @Test
    void crearTemporario_que_empieza_el_dia_del_check_out_de_otra_DeberiaExito() {
        LocalDate in = LocalDate.now().plusDays(10);
        ContratoOperacion existente = temporario(in, in.plusDays(5));
        existente.setIdOperacion(50);
        existente.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        when(contratoRepo.findByPropiedadIdPropiedad(1)).thenReturn(List.of(existente));

        ContratoOperacion nuevo = temporario(in.plusDays(5), in.plusDays(8));
        assertDoesNotThrow(() -> service.crearContrato(nuevo));
    }

    @Test
    void crearTemporario_con_senia_mayor_al_total_DeberiaFallar() {
        LocalDate in = LocalDate.now().plusDays(10);
        ContratoOperacion c = temporario(in, in.plusDays(2));   // total 100000
        c.setTempSenia(new BigDecimal("150000"));
        assertThrows(IllegalArgumentException.class, () -> service.crearContrato(c));
    }

    @Test
    void crearTemporario_no_exige_BCRA_del_huesped() {
        LocalDate in = LocalDate.now().plusDays(10);
        ContratoOperacion c = temporario(in, in.plusDays(2));
        comprador.setEstadoBcra(4);
        doThrow(new IllegalStateException("RIESGO")).when(auditoria).validarEstadoBcra(2);
        assertDoesNotThrow(() -> service.crearContrato(c));
    }

    @Test
    void crearAlquilerAnual_con_estadia_temporaria_confirmada_por_delante_DeberiaFallar() {
        LocalDate in = LocalDate.now().plusDays(10);
        ContratoOperacion temp = temporario(in, in.plusDays(5));
        temp.setIdOperacion(60);
        temp.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        when(contratoRepo.findByPropiedadIdPropiedad(1)).thenReturn(List.of(temp));

        ContratoOperacion anual = new ContratoOperacion();
        anual.setPropiedad(propiedad);
        anual.setVendedorPropietario(vendedor);
        anual.setCompradorInquilino(comprador);
        anual.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        anual.setEstadoOperacion("Vigente");
        anual.setFechaInicio(LocalDate.now());
        anual.setFechaFin(LocalDate.now().plusYears(2));
        anual.setMontoTotalOperacion(new BigDecimal("300000"));
        anual.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        anual.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        anual.setFrecuenciaAjusteMeses(3);
        doNothing().when(auditoria).validarLegajosPropiedad(any());
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.crearContrato(anual));
        assertTrue(ex.getMessage().contains("estadía temporaria"));
    }

    // ── CALENDARIO DE DISPONIBILIDAD ────────────────────────────────────────

    @Test
    void ocupacionTemporaria_devuelve_solo_estadias_vigentes_futuras_sin_datos_personales() {
        LocalDate hoy = LocalDate.now();
        ContratoOperacion vigente = temporario(hoy.plusDays(5), hoy.plusDays(9));
        vigente.setIdOperacion(1);
        vigente.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        ContratoOperacion borrador = temporario(hoy.plusDays(20), hoy.plusDays(22));
        borrador.setIdOperacion(2);
        borrador.setEstadoContrato(ContratoOperacion.EstadoContrato.Borrador);
        ContratoOperacion pasada = temporario(hoy.minusDays(10), hoy.minusDays(5));
        pasada.setIdOperacion(3);
        pasada.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        ContratoOperacion rescindida = temporario(hoy.plusDays(30), hoy.plusDays(33));
        rescindida.setIdOperacion(4);
        rescindida.setEstadoContrato(ContratoOperacion.EstadoContrato.Rescindido);
        when(contratoRepo.findByPropiedadIdPropiedad(1)).thenReturn(List.of(borrador, pasada, vigente, rescindida));

        var publica = service.ocupacionTemporaria(1, false, null);
        assertEquals(1, publica.size());
        assertEquals(hoy.plusDays(5).toString(), publica.get(0).get("desde"));
        assertFalse(publica.get(0).containsKey("idOperacion"));      // la vista pública no expone ids ni personas

        var interna = service.ocupacionTemporaria(1, true, null);
        assertEquals(2, interna.size());                              // vigente + borrador, ordenadas por fecha
        assertEquals("Borrador", interna.get(1).get("estado"));

        var sinPropia = service.ocupacionTemporaria(1, true, 1);      // al editar una estadía no se cuenta a sí misma
        assertEquals(1, sinPropia.size());
    }
}
