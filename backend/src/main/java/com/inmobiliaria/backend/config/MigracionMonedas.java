package com.inmobiliaria.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Migración automática para poder usar el Euro en una base de datos que ya existe.
 *
 * Hibernate crea las columnas de moneda con una restricción CHECK (moneda IN ('ARS','USD')) y
 * "ddl-auto=update" no la modifica después. Al arrancar se buscan esas restricciones viejas
 * (las que nombran ARS y USD pero no EUR) y se reemplazan por otras que también aceptan EUR.
 * Es seguro correrla muchas veces: si no hay nada para cambiar, no hace nada.
 * Solo aplica a PostgreSQL; en cualquier otra base se omite sin error.
 */
@Component
@Order(0)
public class MigracionMonedas implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MigracionMonedas.class);

    @Autowired
    private JdbcTemplate jdbc;

    /** Agrega 'EUR' a la lista de valores de una restricción CHECK que ya permite 'USD'. */
    static String conEuro(String definicion) {
        return definicion.replaceFirst("('USD'::[a-z ]+)", "$1, 'EUR'::character varying");
    }

    @Override
    public void run(String... args) {
        try {
            List<Map<String, Object>> viejas = jdbc.queryForList(
                "SELECT t.relname AS tabla, c.conname AS restriccion, pg_get_constraintdef(c.oid) AS definicion "
              + "FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid "
              + "WHERE c.contype = 'c' "
              + "AND pg_get_constraintdef(c.oid) LIKE '%''ARS''%' "
              + "AND pg_get_constraintdef(c.oid) LIKE '%''USD''%' "
              + "AND pg_get_constraintdef(c.oid) NOT LIKE '%''EUR''%'");
            for (Map<String, Object> f : viejas) {
                String tabla = f.get("tabla").toString();
                String nombre = f.get("restriccion").toString();
                String definicion = f.get("definicion").toString();
                // Se agrega EUR a la lista de valores permitidos: ... 'USD'::character varying ... -> ... 'USD'::character varying, 'EUR'::character varying ...
                String nueva = conEuro(definicion);
                if (nueva.equals(definicion)) {
                    // formato inesperado: se quita la restricción vieja (el enum de la aplicación igual valida los valores)
                    jdbc.execute("ALTER TABLE \"" + tabla + "\" DROP CONSTRAINT \"" + nombre + "\"");
                    log.info("Moneda EUR: se quitó la restricción {} de {} (formato no reconocido).", nombre, tabla);
                } else {
                    jdbc.execute("ALTER TABLE \"" + tabla + "\" DROP CONSTRAINT \"" + nombre + "\"");
                    jdbc.execute("ALTER TABLE \"" + tabla + "\" ADD CONSTRAINT \"" + nombre + "\" " + nueva);
                    log.info("Moneda EUR: se actualizó la restricción {} de {}.", nombre, tabla);
                }
            }
        } catch (Exception e) {
            // Base distinta de PostgreSQL o sin permisos: no se detiene el arranque
            log.warn("Migración de monedas omitida: {}", e.getMessage());
        }
    }
}
