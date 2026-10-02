package com.inmobiliaria.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Convierte las excepciones que no atrapa cada controlador en respuestas JSON
 * coherentes: {"error": "mensaje"}. Así el frontend siempre recibe el mismo formato
 * y nunca se filtran stack traces.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> reglaDeNegocio(RuntimeException e) {
        return ResponseEntity.badRequest().body(Map.of("error", Errores.msg(e)));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> noEncontrado(NoSuchElementException e) {
        return ResponseEntity.status(404).body(Map.of("error", "No se encontró el recurso solicitado"));
    }

    private static final java.util.regex.Pattern CAMPO_JSON = java.util.regex.Pattern.compile("\\[\"([A-Za-z0-9_]+)\"\\]");

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> cuerpoInvalido(HttpMessageNotReadableException e) {
        // Se busca el nombre del campo en la cadena de errores de lectura (…["tempCheckIn"])
        String texto = Errores.msg(e) + " " + Errores.msg(e.getMostSpecificCause());
        String campo = null;
        java.util.regex.Matcher m = CAMPO_JSON.matcher(texto);
        while (m.find()) campo = m.group(1);
        log.warn("Cuerpo de la solicitud inválido: {}", Errores.msg(e.getMostSpecificCause()));
        return ResponseEntity.badRequest().body(Map.of("error", campo != null
            ? "El campo «" + campo + "» tiene un valor o un formato inválido (revisá fechas, números y opciones)."
            : "Los datos enviados no tienen un formato válido. Revisá fechas, números y opciones."));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> parametroInvalido(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "El valor de «" + e.getName() + "» no es válido."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> integridad(DataIntegrityViolationException e) {
        log.warn("Violación de integridad: {}", MensajesBaseDatos.detalleTecnico(e));
        return ResponseEntity.status(409).body(Map.of("error", MensajesBaseDatos.mensaje(e)));
    }

    // Las excepciones de seguridad se dejan pasar para que las maneje Spring Security (401/403)
    @ExceptionHandler({AccessDeniedException.class, AuthenticationException.class})
    public void seguridad(RuntimeException e) {
        throw e;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> inesperado(Exception e) {
        log.error("Error inesperado", e);
        return ResponseEntity.status(500).body(Map.of("error", "Error interno del servidor"));
    }
}
