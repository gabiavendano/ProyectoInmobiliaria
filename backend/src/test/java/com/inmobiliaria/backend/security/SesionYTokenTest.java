package com.inmobiliaria.backend.security;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/** Token JWT (jjwt 0.12) y cookie de sesión HttpOnly con su defensa CSRF. */
class SesionYTokenTest {

    private static final String SECRETO = "una-clave-de-prueba-bien-larga-de-mas-de-32-caracteres";

    private JwtProvider jwt;
    private SesionCookie cookie;
    private JwtAuthenticationFilter filtro;

    @BeforeEach
    void preparar() {
        jwt = new JwtProvider();
        ReflectionTestUtils.setField(jwt, "secret", SECRETO);
        ReflectionTestUtils.setField(jwt, "expirationMs", 60_000L);

        cookie = new SesionCookie();
        ReflectionTestUtils.setField(cookie, "secure", true);
        ReflectionTestUtils.setField(cookie, "sameSite", "Lax");
        ReflectionTestUtils.setField(cookie, "expirationMs", 60_000L);

        filtro = new JwtAuthenticationFilter();
        ReflectionTestUtils.setField(filtro, "allowedOrigins", "http://localhost:5173, https://midominio.com");
    }

    @Test
    void tokenGeneradoSeValidaYDevuelveElUsuario() {
        String t = jwt.generateToken("gabi");
        assertTrue(jwt.validateToken(t));
        assertEquals("gabi", jwt.getUsernameFromToken(t));
    }

    @Test
    void tokenAlteradoOVencidoOConOtraClaveNoValida() {
        String t = jwt.generateToken("gabi");
        // Se cambia un carácter del medio de la firma (agregar uno al final puede ser ignorado al decodificar)
        int i = t.length() - 6;
        String alterado = t.substring(0, i) + (t.charAt(i) == 'A' ? 'B' : 'A') + t.substring(i + 1);
        assertFalse(jwt.validateToken(alterado));
        assertFalse(jwt.validateToken("basura"));

        JwtProvider otro = new JwtProvider();
        ReflectionTestUtils.setField(otro, "secret", "otra-clave-distinta-tambien-de-mas-de-32-caracteres");
        ReflectionTestUtils.setField(otro, "expirationMs", 60_000L);
        assertFalse(jwt.validateToken(otro.generateToken("gabi")));

        ReflectionTestUtils.setField(jwt, "expirationMs", -1000L);
        assertFalse(jwt.validateToken(jwt.generateToken("gabi")));
    }

    @Test
    void secretoCortoHaceFallarElArranque() {
        JwtProvider debil = new JwtProvider();
        ReflectionTestUtils.setField(debil, "secret", "corto");
        assertThrows(IllegalStateException.class, () -> ReflectionTestUtils.invokeMethod(debil, "validarSecreto"));
    }

    @Test
    void laCookieEsHttpOnlySecureYSameSite() {
        String h = cookie.crear("abc");
        assertTrue(h.startsWith(SesionCookie.NOMBRE + "=abc"));
        assertTrue(h.contains("HttpOnly"));
        assertTrue(h.contains("Secure"));
        assertTrue(h.contains("SameSite=Lax"));
        assertTrue(h.contains("Path=/"));
        assertTrue(h.contains("Max-Age=60"));
    }

    @Test
    void borrarLaCookieLaVenceYa() {
        String h = cookie.borrar();
        assertTrue(h.contains("Max-Age=0"));
        assertTrue(h.contains("HttpOnly"));
    }

    @Test
    void enDesarrolloLaCookieNoEsSecure() {
        ReflectionTestUtils.setField(cookie, "secure", false);
        assertFalse(cookie.crear("abc").contains("Secure"));
    }

    @Test
    void seLeeElTokenDeLaCookie() {
        MockHttpServletRequest r = new MockHttpServletRequest();
        assertNull(SesionCookie.leer(r));
        r.setCookies(new Cookie("otra", "x"), new Cookie(SesionCookie.NOMBRE, "tok"));
        assertEquals("tok", SesionCookie.leer(r));
    }

    @Test
    void csrfLosGetPasanSinHeader() {
        MockHttpServletRequest r = new MockHttpServletRequest("GET", "/api/auth/me");
        assertTrue(filtro.origenConfiable(r));
    }

    @Test
    void csrfUnPostSinHeaderPersonalizadoSeRechaza() {
        MockHttpServletRequest r = new MockHttpServletRequest("POST", "/api/contratos");
        assertFalse(filtro.origenConfiable(r));
    }

    @Test
    void csrfUnPostDeOtroOrigenSeRechazaAunConHeader() {
        MockHttpServletRequest r = new MockHttpServletRequest("DELETE", "/api/contratos/1");
        r.addHeader("X-Requested-With", "XMLHttpRequest");
        r.addHeader("Origin", "https://sitio-malicioso.com");
        assertFalse(filtro.origenConfiable(r));
    }

    @Test
    void csrfUnPostDelFrontendPermitidoPasa() {
        MockHttpServletRequest r = new MockHttpServletRequest("POST", "/api/contratos");
        r.addHeader("X-Requested-With", "XMLHttpRequest");
        r.addHeader("Origin", "https://midominio.com");
        assertTrue(filtro.origenConfiable(r));
        r.removeHeader("Origin");
        assertTrue(filtro.origenConfiable(r));
    }
}
