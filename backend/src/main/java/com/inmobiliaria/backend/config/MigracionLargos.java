package com.inmobiliaria.backend.config;

import jakarta.persistence.Column;
import jakarta.persistence.EntityManager;
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
import java.util.List;
import java.util.Locale;

/**
 * Amplía las columnas de texto de la base que quedaron más cortas que lo que declara el sistema.
 *
 * "ddl-auto=update" crea las columnas que faltan pero nunca cambia el largo de las que ya existen,
 * así que una base creada con una versión anterior puede rechazar textos que el sistema sí permite
 * ("value too long for type character varying"). Al arrancar se compara cada columna de texto con el
 * largo declarado en @Column y, si la de la base es menor, se agranda. Solo agranda: nunca achica.
 * Es seguro correrla muchas veces. Si algo falla no detiene el arranque.
 */
@Component
@Order(1)
public class MigracionLargos implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MigracionLargos.class);

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
                    if (f.getType() != String.class || Modifier.isStatic(f.getModifiers())) continue;
                    Column c = f.getAnnotation(Column.class);
                    if (c == null || !c.columnDefinition().isEmpty()) continue;   // los TEXT no tienen tope
                    String columna = (!c.name().isEmpty() ? c.name() : snake(f.getName())).toLowerCase(Locale.ROOT);
                    cambios += ajustar(tabla, columna, c.length());
                }
            }
        } catch (Exception e) {
            log.warn("Ampliación de columnas de texto omitida: {}", e.getMessage());
        }
        if (cambios > 0) log.info("Columnas de texto ampliadas: {}", cambios);
    }

    private int ajustar(String tabla, String columna, int largoEntidad) {
        try {
            List<Integer> actual = jdbc.query(
                "SELECT character_maximum_length FROM information_schema.columns "
              + "WHERE lower(table_name) = ? AND lower(column_name) = ? AND data_type = 'character varying'",
                (rs, i) -> rs.getObject(1) == null ? null : rs.getInt(1), tabla, columna);
            if (actual.isEmpty() || actual.get(0) == null || actual.get(0) >= largoEntidad) return 0;
            jdbc.execute("ALTER TABLE \"" + tabla + "\" ALTER COLUMN \"" + columna + "\" TYPE varchar(" + largoEntidad + ")");
            log.info("Texto ampliado: {}.{} de {} a {} caracteres.", tabla, columna, actual.get(0), largoEntidad);
            return 1;
        } catch (Exception e) {
            log.warn("No se pudo ampliar {}.{}: {}", tabla, columna, e.getMessage());
            return 0;
        }
    }
}
