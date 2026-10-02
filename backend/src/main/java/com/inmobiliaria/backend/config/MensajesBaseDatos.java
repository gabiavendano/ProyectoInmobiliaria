package com.inmobiliaria.backend.config;

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Traduce los errores de la base de datos (PostgreSQL) a mensajes claros para el usuario:
 * qué campo falta, qué dato está duplicado o qué registro lo está usando.
 * Se guía por el código SQLSTATE, que no depende del idioma del servidor.
 */
public final class MensajesBaseDatos {
    private MensajesBaseDatos() {}

    private static final Pattern ENTRE_COMILLAS = Pattern.compile("[\"«“]([^\"»”]+)[\"»”]");
    private static final Pattern CLAVE_VALOR = Pattern.compile("\\(([^)]+)\\)=\\(([^)]*)\\)");

    /** Nombres legibles de columnas y tablas frecuentes; el resto se arma a partir del nombre técnico. */
    private static final Map<String, String> NOMBRES = new LinkedHashMap<>();
    static {
        NOMBRES.put("dni_cuit", "DNI/CUIT"); NOMBRES.put("cuit_cuil", "CUIT/CUIL"); NOMBRES.put("nombre_completo", "nombre");
        NOMBRES.put("username", "usuario"); NOMBRES.put("email", "email"); NOMBRES.put("titulo", "título");
        NOMBRES.put("id_propietario_actual", "propietario"); NOMBRES.put("id_propiedad", "propiedad");
        NOMBRES.put("id_comprador_inquilino", "comprador / inquilino"); NOMBRES.put("id_vendedor_propietario", "propietario / vendedor");
        NOMBRES.put("tipo_inmueble", "tipo de inmueble"); NOMBRES.put("tipo_operacion", "tipo de operación");
        NOMBRES.put("tipo_contrato", "tipo de contrato"); NOMBRES.put("estado_contrato", "estado del contrato");
        NOMBRES.put("monto_total_operacion", "monto de la operación"); NOMBRES.put("moneda_operacion", "moneda");
        NOMBRES.put("fecha_inicio", "fecha de inicio"); NOMBRES.put("fecha_fin", "fecha de fin");
        NOMBRES.put("temp_check_in", "check-in"); NOMBRES.put("temp_check_out", "check-out");
        NOMBRES.put("temp_huespedes", "huéspedes"); NOMBRES.put("temp_precio_total", "precio total de la estadía");
        NOMBRES.put("temp_precio_noche", "precio por noche"); NOMBRES.put("temp_moneda", "moneda de la estadía");
        NOMBRES.put("temp_senia_porcentaje", "seña (%)"); NOMBRES.put("temp_senia", "seña"); NOMBRES.put("temp_deposito", "depósito");
        NOMBRES.put("contratos_y_operaciones", "contratos y operaciones"); NOMBRES.put("propiedades", "propiedades");
        NOMBRES.put("personas", "personas"); NOMBRES.put("movimientos_financieros", "movimientos financieros");
        NOMBRES.put("liquidaciones_mensuales", "cobros de alquiler"); NOMBRES.put("usuarios_autenticacion", "usuarios");
        NOMBRES.put("imagenes_propiedad", "fotos"); NOMBRES.put("documentos_adjuntos", "documentos");
    }

    public static String legible(String tecnico) {
        if (tecnico == null) return "un campo";
        String clave = tecnico.trim().toLowerCase(Locale.ROOT);
        String conocido = NOMBRES.get(clave);
        if (conocido != null) return conocido;
        String s = clave.replaceFirst("^(id_|ten_|alq_|ven_|per_|hon_|ocp_|cou_|edi_)", "").replace('_', ' ').trim();
        return s.isEmpty() ? "un campo" : s;
    }

    private static SQLException sqlDe(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException s && s.getSQLState() != null) return s;
            if (t.getCause() == t) break;
        }
        return null;
    }

    private static Throwable raiz(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        return t;
    }

    /** Detalle técnico para el log del servidor (nunca se manda al usuario). */
    public static String detalleTecnico(Throwable e) {
        SQLException s = sqlDe(e);
        return "SQLSTATE=" + (s != null ? s.getSQLState() : "?") + " · " + Errores.msg(raiz(e)).replace('\n', ' ');
    }

    /** Mensaje para el usuario, según el tipo de violación. */
    public static String mensaje(Throwable e) {
        SQLException s = sqlDe(e);
        String estado = s != null ? s.getSQLState() : "";
        String texto = Errores.msg(raiz(e));
        Matcher comillas = ENTRE_COMILLAS.matcher(texto);
        String primero = comillas.find() ? comillas.group(1) : null;

        switch (estado == null ? "" : estado) {
            case "23502": {  // campo obligatorio vacío
                return "Falta completar un dato obligatorio: " + legible(primero) + ".";
            }
            case "23505": {  // dato duplicado
                Matcher kv = CLAVE_VALOR.matcher(texto);
                if (kv.find()) {
                    String campo = legible(kv.group(1).split(",")[0]);
                    return "Ya existe otro registro con ese mismo " + campo + " (" + kv.group(2) + ").";
                }
                return "Ya existe otro registro con esos mismos datos.";
            }
            case "23503": {  // clave foránea
                // La tabla que lo usa es la última nombrada en el mensaje ("... is still referenced from table «x»")
                Matcher t = Pattern.compile("(?:tabla|table)\\s+[\"«“]([^\"»”]+)[\"»”]").matcher(texto);
                String tabla = null;
                while (t.find()) tabla = legible(t.group(1));
                if (texto.toLowerCase(Locale.ROOT).contains("still referenced") || texto.toLowerCase(Locale.ROOT).contains("todavía se hace referencia")
                        || texto.toLowerCase(Locale.ROOT).contains("sigue referenci") || texto.toLowerCase(Locale.ROOT).contains("update o delete"))
                    return "No se puede eliminar ni modificar: todavía está en uso" + (tabla != null ? " en " + tabla : "") + ".";
                return "Uno de los datos elegidos (propiedad, persona u otro) ya no existe o no es válido. Actualizá la pantalla y volvé a elegirlo.";
            }
            case "23514": {  // restricción CHECK (por ejemplo, lista de monedas)
                String restriccion = null;
                Matcher c = ENTRE_COMILLAS.matcher(texto);
                while (c.find()) restriccion = c.group(1);
                return "La base de datos no acepta uno de los valores cargados (restricción «" + (restriccion != null ? restriccion : "desconocida")
                    + "»). Si cambió una lista de opciones, como la moneda, reiniciá el backend para que se actualice.";
            }
            case "22001": {  // texto demasiado largo
                Matcher lim = Pattern.compile("\\((\\d+)\\)").matcher(texto);
                return "Un texto es demasiado largo para el campo donde se guarda"
                    + (lim.find() ? " (máximo " + lim.group(1) + " caracteres)" : "") + ". Acortalo e intentá de nuevo.";
            }
            case "22003": {  // número fuera de rango
                return "Un número es demasiado grande para el campo donde se guarda.";
            }
            default:
                return "La base de datos rechazó el guardado por una regla de integridad. Avisá al administrador (el detalle quedó en el registro del servidor).";
        }
    }
}
