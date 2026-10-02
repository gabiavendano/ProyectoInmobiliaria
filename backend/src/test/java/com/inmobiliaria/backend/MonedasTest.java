package com.inmobiliaria.backend;

import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.model.MovimientoFinanciero;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.service.Monedas;
import com.inmobiliaria.backend.service.PropiedadService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** Pesos, dólares y euros. */
class MonedasTest {

    @Test
    void normalizaLosCodigosValidosYTomaPesosPorDefecto() {
        assertEquals("EUR", Monedas.normalizar("EUR"));
        assertEquals("EUR", Monedas.normalizar(" eur "));
        assertEquals("USD", Monedas.normalizar("USD"));
        assertEquals("ARS", Monedas.normalizar("ARS"));
        assertEquals("ARS", Monedas.normalizar("XYZ"));
        assertEquals("ARS", Monedas.normalizar(null));
    }

    @Test
    void convierteAMonedaDeMovimiento() {
        assertEquals(MovimientoFinanciero.Moneda.EUR, Monedas.aMovimiento("EUR"));
        assertEquals(MovimientoFinanciero.Moneda.USD, Monedas.aMovimiento("USD"));
        assertEquals(MovimientoFinanciero.Moneda.ARS, Monedas.aMovimiento(null));
    }

    @Test
    void soloLosPesosNoSonMonedaExtranjera() {
        assertFalse(Monedas.esExtranjera("ARS"));
        assertTrue(Monedas.esExtranjera("USD"));
        assertTrue(Monedas.esExtranjera("EUR"));
    }

    @Test
    void losEnumsDeLosModelosAceptanEuro() {
        assertNotNull(Propiedad.Moneda.valueOf("EUR"));
        assertNotNull(ContratoOperacion.Moneda.valueOf("EUR"));
        assertNotNull(MovimientoFinanciero.Moneda.valueOf("EUR"));
    }

    @Test
    void elPrecioEnEurosLlevaSuSimbolo() {
        String s = PropiedadService.armarPriceStr(new BigDecimal("150000"), Propiedad.Moneda.EUR, Propiedad.TipoOperacion.Venta);
        assertTrue(s.startsWith("€ "), s);
        assertTrue(s.contains("150.000"), s);
        assertTrue(PropiedadService.armarPriceStr(new BigDecimal("90"), Propiedad.Moneda.USD, Propiedad.TipoOperacion.Venta).startsWith("U$S "));
    }
}
