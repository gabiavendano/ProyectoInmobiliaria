package com.inmobiliaria.backend.config;

import jakarta.persistence.Column;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Table;
import jakarta.persistence.metamodel.EntityType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Pone al día las restricciones CHECK de las columnas de opciones (enums).
 *
 * Hibernate crea para cada columna de opciones una restricción CHECK con los valores que existían ese día
 * y "ddl-auto=update" no la modifica cuando el sistema suma una opción nueva (por ejemplo el estado
 * "Borrador" de un contrato). Resultado: la base rechaza el guardado con
 * "viola la restricción ..._check". Al arrancar se revisa cada columna de opciones y, si a su restricción
 * le falta algún valor, se reemplaza por otra con todos los valores actuales. Solo agrega valores.
 * Es seguro correrla muchas veces. Si algo falla no detiene el arranque.
 */
@Component
@Order(2)
public class MigracionEnums implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MigracionEnums.class);

    @PersistenceContext
    private EntityManager em;

    @Autowired
    private JdbcTemplate jdbc;

    private static String snake(String s) {
        return s.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase(Locale.ROOT);
    }

    @Override
    public void run(String... args) {
        int cambios = 0;
        try {
            for (EntityType<?> et : em.getMetamodel().getEntities()) {
                Class<?> clase = et.getJavaType();
                Table t = clase.getAnnotation(Table.class);
                String tabla = (t != null && !t.name().isEmpty() ? t.name() : snake(clase.getSimpleName())).toLowerCase(Locale.ROOT);
                for (Field f : clase.getDeclaredFields()) {
                    if (!f.getType().isEnum() || Modifier.isStatic(f.getModifiers())) continue;
                    Enumerated e = f.getAnnotation(Enumerated.class);
                    if (e == null || e.value() != EnumType.STRING) continue;
                    Column c = f.getAnnotation(Column.class);
                    String columna = (c != null && !c.name().isEmpty() ? c.name() : snake(f.getName())).toLowerCase(Locale.ROOT);
                    List<String> valores = new ArrayList<>();
                    for (Object k : f.getType().getEnumConstants()) valores.add(((Enum<?>) k).name());
                    cambios += ajustar(tabla, columna, valores);
                }
            }
        } catch (Exception ex) {
            log.warn("Actualización de opciones de la base omitida: {}", ex.getMessage());
        }
        if (cambios > 0) log.info("Restricciones de opciones actualizadas: {}", cambios);
    }

    private int ajustar(String tabla, String columna, List<String> valores) {
        int n = 0;
        try {
            List<Map<String, Object>> restricciones = jdbc.queryForList(
                "SELECT c.conname AS nombre, pg_get_constraintdef(c.oid) AS definicion "
              + "FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid "
              + "WHERE c.contype = 'c' AND lower(t.relname) = ? AND array_length(c.conkey, 1) = 1 "
              + "AND c.conkey[1] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = ?)",
                tabla, columna);
            for (Map<String, Object> r : restricciones) {
                String nombre = r.get("nombre").toString();
                String def = r.get("definicion").toString();
                boolean faltan = valores.stream().anyMatch(v -> !def.contains("'" + v + "'"));
                if (!faltan) continue;
                String lista = valores.stream().map(v -> "'" + v.replace("'", "''") + "'").collect(Collectors.joining(", "));
                jdbc.execute("ALTER TABLE \"" + tabla + "\" DROP CONSTRAINT \"" + nombre + "\"");
                jdbc.execute("ALTER TABLE \"" + tabla + "\" ADD CONSTRAINT \"" + nombre + "\" CHECK (\"" + columna + "\" IN (" + lista + "))");
                log.info("Opciones actualizadas: {}.{} ahora acepta {}.", tabla, columna, valores);
                n++;
            }
        } catch (Exception ex) {
            log.warn("No se pudo actualizar las opciones de {}.{}: {}", tabla, columna, ex.getMessage());
        }
        return n;
    }
}
