package com.inmobiliaria.backend.config;

import jakarta.servlet.MultipartConfigElement;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import java.util.Map;

/** Límites de subida (por defecto Spring solo deja 1 MB) y mensajes claros cuando un archivo no entra. */
@Configuration
public class SubidaArchivosConfig {

    @Bean
    public MultipartConfigElement multipartConfigElement() {
        // 15 MB por archivo (PDF), 80 MB por envío (hasta 20 fotos de 10 MB entre varios envíos)
        return new MultipartConfigElement("", 15L * 1024 * 1024, 80L * 1024 * 1024, 0);
    }

    @RestControllerAdvice
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public static class ErroresDeSubida {

        @ExceptionHandler(MaxUploadSizeExceededException.class)
        public ResponseEntity<Map<String, String>> demasiadoGrande(MaxUploadSizeExceededException e) {
            return ResponseEntity.status(413).body(Map.of("error",
                    "El archivo es demasiado grande (fotos hasta 10 MB, documentos PDF hasta 15 MB)"));
        }

        @ExceptionHandler(MultipartException.class)
        public ResponseEntity<Map<String, String>> envioInvalido(MultipartException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "No se pudo leer el archivo enviado"));
        }
    }
}
