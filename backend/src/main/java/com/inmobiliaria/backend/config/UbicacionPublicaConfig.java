package com.inmobiliaria.backend.config;

import com.inmobiliaria.backend.dto.PropiedadPublicaDTO;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Le da al sitio público un secreto estable para calcular las ubicaciones aproximadas (se deriva de jwt.secret). */
@Component
public class UbicacionPublicaConfig {

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @PostConstruct
    void iniciar() {
        PropiedadPublicaDTO.configurarSecreto("ubicacion-publica|" + jwtSecret);
    }
}
