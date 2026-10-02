package com.inmobiliaria.backend.security;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Límite de intentos en memoria (sin librerías externas) para frenar la fuerza bruta en login y
 * el registro masivo de cuentas. Se reinicia al reiniciar el servidor, que alcanza para este sistema.
 *
 *  - Login: máx. 5 intentos FALLIDOS cada 15 minutos por (IP + usuario).
 *  - Registro: máx. 5 altas por hora por IP.
 */
@Component
public class LimiteIntentos {

    public static final int MAX_FALLOS_LOGIN = 5;
    public static final long VENTANA_LOGIN_MS = 15 * 60_000L;
    public static final int MAX_REGISTROS = 5;
    public static final long VENTANA_REGISTRO_MS = 60 * 60_000L;

    private final Map<String, Deque<Long>> fallosLogin = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> registros = new ConcurrentHashMap<>();

    private static int contar(Map<String, Deque<Long>> mapa, String clave, long ventana, long ahora) {
        Deque<Long> d = mapa.get(clave);
        if (d == null) return 0;
        synchronized (d) {
            while (!d.isEmpty() && ahora - d.peekFirst() > ventana) d.pollFirst();
            if (d.isEmpty()) mapa.remove(clave, d);
            return d.size();
        }
    }

    private static void anotar(Map<String, Deque<Long>> mapa, String clave, long ahora) {
        Deque<Long> d = mapa.computeIfAbsent(clave, k -> new ArrayDeque<>());
        synchronized (d) { d.addLast(ahora); }
        // limpieza oportunista para que el mapa no crezca sin límite
        if (mapa.size() > 10_000) mapa.entrySet().removeIf(e -> e.getValue().isEmpty());
    }

    public static String claveLogin(String ip, String usuario) {
        return (ip == null ? "?" : ip) + "|" + (usuario == null ? "" : usuario.trim().toLowerCase());
    }

    public boolean loginBloqueado(String clave) {
        return contar(fallosLogin, clave, VENTANA_LOGIN_MS, System.currentTimeMillis()) >= MAX_FALLOS_LOGIN;
    }

    public void loginFallido(String clave) { anotar(fallosLogin, clave, System.currentTimeMillis()); }

    public void loginExitoso(String clave) { fallosLogin.remove(clave); }

    public boolean registroBloqueado(String ip) {
        return contar(registros, ip == null ? "?" : ip, VENTANA_REGISTRO_MS, System.currentTimeMillis()) >= MAX_REGISTROS;
    }

    public void registroRealizado(String ip) { anotar(registros, ip == null ? "?" : ip, System.currentTimeMillis()); }
}
