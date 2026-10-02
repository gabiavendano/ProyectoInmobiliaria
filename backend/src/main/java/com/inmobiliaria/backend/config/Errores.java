package com.inmobiliaria.backend.config;

/** Utilidad para armar mensajes de error que nunca sean null (Map.of no acepta null). */
public final class Errores {
    private Errores() {}

    public static String msg(Throwable e) {
        if (e == null) return "Error desconocido";
        String m = e.getMessage();
        return (m != null && !m.isBlank()) ? m : e.getClass().getSimpleName();
    }
}
