package com.inmobiliaria.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * El PasswordEncoder vive en su propia clase (y no en SecurityConfig) para evitar un ciclo:
 * SecurityConfig → JwtAuthenticationFilter → UsuarioAutenticacionService → PasswordEncoder → SecurityConfig.
 */
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
