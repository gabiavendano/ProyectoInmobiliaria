package com.inmobiliaria.backend.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Usuario que ejecuta la operación (para la auditoría de cobros, rendiciones y movimientos). */
public final class UsuarioActual {
    private UsuarioActual() {}

    public static String nombre() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null || auth.getName().isBlank()
            || "anonymousUser".equals(auth.getName())) return "sistema";
        // El "principal" es la ficha completa del usuario: se toma solo su nombre de usuario
        // (auth.getName() devolvería el texto de toda la ficha, con el hash de la contraseña y la foto).
        String n = auth.getPrincipal() instanceof com.inmobiliaria.backend.model.UsuarioAutenticacion u && u.getUsername() != null
            ? u.getUsername() : auth.getName();
        return n.length() > 80 ? n.substring(0, 80) : n;
    }
}
