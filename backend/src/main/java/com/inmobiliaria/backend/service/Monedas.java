package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.MovimientoFinanciero;

import java.util.Set;

/**
 * Monedas admitidas por el sistema. Un solo lugar para saber cuáles son, así agregar una nueva
 * (además de la lista de enums de los modelos) no obliga a tocar cada servicio.
 */
public final class Monedas {

    private Monedas() { }

    public static final Set<String> VALIDAS = Set.of("ARS", "USD", "EUR");

    /** Código de moneda válido ("ARS", "USD" o "EUR"); cualquier otro valor (o nulo) se toma como pesos. */
    public static String normalizar(Object valor) {
        if (valor == null) return "ARS";
        String v = valor.toString().trim().toUpperCase();
        return VALIDAS.contains(v) ? v : "ARS";
    }

    /** Moneda de un movimiento financiero a partir de su código. */
    public static MovimientoFinanciero.Moneda aMovimiento(String codigo) {
        return MovimientoFinanciero.Moneda.valueOf(normalizar(codigo));
    }

    /** Moneda extranjera = cualquiera que no sea pesos (no lleva ajuste por índices locales). */
    public static boolean esExtranjera(String codigo) {
        return !"ARS".equals(normalizar(codigo));
    }

    /** Símbolo para mostrar precios. */
    public static String simbolo(String codigo) {
        switch (normalizar(codigo)) {
            case "USD": return "U$S";
            case "EUR": return "€";
            default:    return "$";
        }
    }
}
