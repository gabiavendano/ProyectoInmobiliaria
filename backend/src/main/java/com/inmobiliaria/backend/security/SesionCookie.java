package com.inmobiliaria.backend.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Cookie de sesión: guarda el JWT en una cookie HttpOnly, así el JavaScript de la
 * página (y por lo tanto un ataque XSS) nunca puede leer el token.
 *
 * Configuración (application.properties):
 *   app.cookie.secure   true en producción (HTTPS). En desarrollo local (http) va en false.
 *   app.cookie.samesite Lax (mismo sitio) o None (frontend y API en dominios distintos; exige secure=true).
 */
@Component
public class SesionCookie {

    public static final String NOMBRE = "inmobiliaria_sesion";

    @Value("${app.cookie.secure:true}")
    private boolean secure;

    @Value("${app.cookie.samesite:Lax}")
    private String sameSite;

    @Value("${jwt.expiration}")
    private long expirationMs;

    /** Valor del header Set-Cookie para una sesión nueva. */
    public String crear(String token) {
        return base(token).maxAge(Duration.ofMillis(expirationMs)).build().toString();
    }

    /** Valor del header Set-Cookie que borra la sesión. */
    public String borrar() {
        return base("").maxAge(Duration.ZERO).build().toString();
    }

    /** Token guardado en la cookie del request, o null. */
    public static String leer(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (NOMBRE.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return c.getValue();
            }
        }
        return null;
    }

    private ResponseCookie.ResponseCookieBuilder base(String valor) {
        return ResponseCookie.from(NOMBRE, valor)
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .path("/");
    }
}
