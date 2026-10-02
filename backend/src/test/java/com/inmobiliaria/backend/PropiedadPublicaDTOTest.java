package com.inmobiliaria.backend;

import com.inmobiliaria.backend.dto.PropiedadPublicaDTO;
import com.inmobiliaria.backend.model.Propiedad;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Lo que el sitio público puede ver: ubicación aproximada, zona de respaldo y precio "Desde" de los complejos. */
class PropiedadPublicaDTOTest {

    private static final double LAT = -31.4201, LNG = -64.4993;

    private Propiedad propiedad(int id, boolean exacta) {
        Propiedad p = new Propiedad();
        p.setIdPropiedad(id);
        p.setTitulo("Casa " + id);
        p.setLatitud(LAT);
        p.setLongitud(LNG);
        p.setShowExactLocation(exacta);
        p.setZona("Centro");
        p.setMoneda(Propiedad.Moneda.USD);
        p.setTipoOperacion(Propiedad.TipoOperacion.Venta);
        p.setPrecio(new BigDecimal("100000"));
        return p;
    }

    private static double metros(double lat1, double lng1, double lat2, double lng2) {
        double dLat = (lat2 - lat1) * 111_320.0;
        double dLng = (lng2 - lng1) * 111_320.0 * Math.cos(Math.toRadians(lat1));
        return Math.sqrt(dLat * dLat + dLng * dLng);
    }

    @Test
    void ubicacionExactaSeMuestraTalCual() {
        PropiedadPublicaDTO d = PropiedadPublicaDTO.desde(propiedad(7, true));
        assertEquals(LAT, d.latitud());
        assertEquals(LNG, d.longitud());
    }

    @Test
    void ubicacionAproximadaSeCorreEntre80y200MetrosYEsEstable() {
        PropiedadPublicaDTO.configurarSecreto("secreto-de-prueba-numero-uno");
        PropiedadPublicaDTO a = PropiedadPublicaDTO.desde(propiedad(7, false));
        PropiedadPublicaDTO b = PropiedadPublicaDTO.desde(propiedad(7, false));
        assertEquals(a.latitud(), b.latitud());          // siempre el mismo corrimiento para la misma propiedad
        assertEquals(a.longitud(), b.longitud());
        double m = metros(LAT, LNG, a.latitud(), a.longitud());
        assertTrue(m > 60 && m < 230, "corrimiento fuera de rango: " + m);
    }

    @Test
    void elCorrimientoDependeDelSecretoDelServidor() {
        PropiedadPublicaDTO.configurarSecreto("secreto-de-prueba-numero-uno");
        PropiedadPublicaDTO a = PropiedadPublicaDTO.desde(propiedad(7, false));
        PropiedadPublicaDTO.configurarSecreto("otro-secreto-de-prueba-distinto");
        PropiedadPublicaDTO b = PropiedadPublicaDTO.desde(propiedad(7, false));
        assertTrue(a.latitud().doubleValue() != b.latitud().doubleValue()
                || a.longitud().doubleValue() != b.longitud().doubleValue());
    }

    @Test
    void zonaDeRespaldoSiNoTieneZona() {
        Propiedad p = propiedad(3, true);
        p.setZona(null);
        p.setBarrio("Costa Azul");
        assertEquals("Costa Azul", PropiedadPublicaDTO.desde(p).zona());
        p.setBarrio(null);
        p.setLocalidad("Villa Carlos Paz");
        assertEquals("Villa Carlos Paz", PropiedadPublicaDTO.desde(p).zona());
    }

    @Test
    void complejoMuestraPrecioDesdeConMilesYMoneda() {
        Propiedad c = propiedad(1, true);
        c.setEsComplejo(true);
        Propiedad u1 = propiedad(11, true);
        u1.setPrecio(new BigDecimal("40000"));
        Propiedad u2 = propiedad(12, true);
        u2.setPrecio(new BigDecimal("55000"));
        PropiedadPublicaDTO d = PropiedadPublicaDTO.desdeComplejo(c, List.of(u1, u2), 3);
        assertEquals("Desde U$S 40.000", d.priceStr());
        assertEquals(2, d.unidadesDisponibles());
    }
}
