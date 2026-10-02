package com.inmobiliaria.backend.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.config.Customizer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Reglas de acceso de la API.
 *
 *  - Público (sin login): login, registro de clientes y mapa de propiedades públicas.
 *  - Cualquier usuario logueado (CLIENTE/AGENTE/ADMIN): /api/auth/me y favoritos
 *    (el controlador de favoritos valida que cada cliente solo toque los suyos).
 *  - Solo AGENTE o ADMIN: todo el resto (personas, propiedades, contratos,
 *    finanzas, rendiciones, documentos, inquilinos-contratos, PDF).
 *  - Solo ADMIN: endpoints de administración de usuarios en Firebase.
 *
 * Ojo: las reglas se evalúan en orden, la primera que coincide gana.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtFilter;

    // Orígenes permitidos, separados por coma. En producción: app.cors.allowed-origins=https://tu-dominio.com
    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // CSRF: la sesión va en cookie HttpOnly, y la defensa (header X-Requested-With + Origin
            // permitido, SameSite) está en JwtAuthenticationFilter; por eso el CSRF por token de Spring no se usa.
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // Cabeceras de seguridad: sin iframes ajenos (clickjacking), sin adivinar tipos MIME,
            // sin filtrar la URL de origen y sin APIs del dispositivo que el sistema no usa.
            .headers(h -> h
                .frameOptions(fo -> fo.deny())
                .contentTypeOptions(Customizer.withDefaults())
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
                .contentSecurityPolicy(csp -> csp.policyDirectives("frame-ancestors 'none'"))
                .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)"))
            )
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Sin token / token inválido → 401 (en vez del 403 por defecto)
            .exceptionHandling(ex -> ex.authenticationEntryPoint(
                (request, response, authException) -> response.sendError(401, "No autenticado")))
            .authorizeHttpRequests(auth -> auth
                // Preflight CORS
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Página de error interna de Spring (si no, un 500 se vería como 401)
                .requestMatchers("/error").permitAll()

                // ── Público ──────────────────────────────────────────────
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/logout").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/firebase/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/firebase/register").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/propiedades/publicas").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/propiedades/publicas/*/ocupacion").permitAll()
                // Las fotos se muestran con <img src>, que no puede mandar el token: deben ser públicas
                .requestMatchers(HttpMethod.GET, "/api/archivos/fotos/*/*").permitAll()

                // ── Administración de usuarios Firebase: solo ADMIN ──────
                .requestMatchers("/api/auth/firebase/usuario/**").hasRole("ADMIN")

                // ── Cualquier usuario logueado ───────────────────────────
                .requestMatchers("/api/auth/me").authenticated()
                .requestMatchers("/api/favoritos/**").authenticated()
                // Un cliente logueado puede enviar consultas; verlas/gestionarlas es solo del staff (abajo)
                .requestMatchers(HttpMethod.POST, "/api/consultas").authenticated()

                // ── Backoffice: solo AGENTE o ADMIN (todos los métodos) ──
                .requestMatchers("/api/personas/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/propiedades/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/contratos/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/finanzas/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/rendiciones/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/inquilinos-contratos/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/consultas/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/leads/**").hasAnyRole("AGENTE", "ADMIN")
                .requestMatchers("/api/render-pdf/**").hasAnyRole("AGENTE", "ADMIN")

                // Todo lo demás, con login
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration corsConfig = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        corsConfig.setAllowedOrigins(origins);
        // PATCH es necesario para rescindir / cerrar-venta desde el navegador
        corsConfig.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        corsConfig.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "X-Requested-With"));
        corsConfig.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);
        return source;
    }
}
