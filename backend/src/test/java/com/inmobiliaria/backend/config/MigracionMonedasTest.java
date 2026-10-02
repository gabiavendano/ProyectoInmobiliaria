package com.inmobiliaria.backend.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MigracionMonedasTest {

    @Test
    void agregaEuroALaRestriccionDePostgres() {
        String vieja = "CHECK (((moneda)::text = ANY ((ARRAY['ARS'::character varying, 'USD'::character varying])::text[])))";
        String esperada = "CHECK (((moneda)::text = ANY ((ARRAY['ARS'::character varying, 'USD'::character varying, 'EUR'::character varying])::text[])))";
        assertEquals(esperada, MigracionMonedas.conEuro(vieja));
    }
}
