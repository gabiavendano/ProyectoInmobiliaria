package com.inmobiliaria.backend.security;

import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.UsuarioAutenticacionRepository;
import com.inmobiliaria.backend.service.FirebaseService;
import com.inmobiliaria.backend.service.UsuarioAutenticacionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Collections;
import java.util.Map;

/**
 * Filtro de autenticación. El token llega en la cookie HttpOnly de sesión (navegador) o en
 * "Authorization: Bearer ..." (herramientas y clientes que no son el navegador). Acepta dos tipos:
 *   1. JWT propio (emitido por /api/auth/login).
 *   2. ID Token de Firebase (solo si Firebase está configurado).
 *
 * Si no hay token o es inválido, el request sigue SIN autenticar y
 * SecurityConfig decide (devuelve 401/403 en rutas protegidas).
 * El rol SIEMPRE se lee de la base de datos, nunca del token.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Autowired
    private JwtProvider jwtProvider;

    @Autowired
    private UsuarioAutenticacionRepository usuarioRepository;

    @Autowired
    private UsuarioAutenticacionService usuarioService;

    @Autowired(required = false)
    private FirebaseService firebaseService;

    // Mismos orígenes que CORS: se usan para validar el Origin de pedidos con cookie
    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        String token;
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring(7).trim();
        } else {
            token = SesionCookie.leer(request);
            if (token == null) {
                filterChain.doFilter(request, response);
                return;
            }
            // Sesión por cookie: el navegador la manda sola, así que los pedidos que
            // modifican datos deben demostrar que vienen de nuestro propio frontend (CSRF).
            if (!origenConfiable(request)) {
                response.sendError(403, "Pedido rechazado (protección CSRF)");
                return;
            }
        }

        // 1. JWT propio
        if (jwtProvider.validateToken(token)) {
            String username = jwtProvider.getUsernameFromToken(token);
            UsuarioAutenticacion usuario = usuarioRepository.findByUsername(username).orElse(null);
            if (usuario != null && Boolean.TRUE.equals(usuario.getActivo())) {
                autenticar(usuario);
            }
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Token de Firebase
        if (esTokenDeFirebase(token)) {
            try {
                Map<String, Object> resultado = firebaseService.validateToken(token);
                if (!Boolean.TRUE.equals(resultado.get("ok"))) {
                    log.warn("Token de Firebase inválido: {}", resultado.get("mensaje"));
                } else {
                    UsuarioAutenticacion usuario = usuarioService.obtenerOCrearDesdeFirebase(
                        (String) resultado.get("email"), (String) resultado.get("nombre"));
                    if (Boolean.TRUE.equals(usuario.getActivo())) {
                        autenticar(usuario);
                    }
                }
            } catch (Exception e) {
                log.error("Error autenticando con Firebase: {}", e.getMessage());
            }
        }

        // 3. Token inválido → sigue sin autenticar
        filterChain.doFilter(request, response);
    }

    private static final java.util.Set<String> METODOS_SEGUROS = java.util.Set.of("GET", "HEAD", "OPTIONS", "TRACE");

    /**
     * Defensa CSRF para la sesión por cookie: los métodos que modifican datos exigen el
     * header "X-Requested-With" (un sitio ajeno no puede mandarlo sin que CORS lo bloquee)
     * y, si el navegador manda "Origin", que sea uno de los orígenes permitidos.
     */
    boolean origenConfiable(HttpServletRequest request) {
        if (METODOS_SEGUROS.contains(request.getMethod())) return true;
        if (request.getHeader("X-Requested-With") == null) return false;
        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank()) return true;
        for (String o : allowedOrigins.split(",")) {
            if (o.trim().equals(origin)) return true;
        }
        return false;
    }

    private void autenticar(UsuarioAutenticacion usuario) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
            usuario, null,
            Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + usuario.getRol().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    /** Un ID token de Firebase es un JWT cuyo "iss" es https://securetoken.google.com/<proyecto>. */
    private boolean esTokenDeFirebase(String token) {
        if (firebaseService == null || !firebaseService.isInitialized()) return false;
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return false;
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            return payload.contains("https://securetoken.google.com/");
        } catch (Exception e) {
            return false;
        }
    }
}
