package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.FirebaseUsuario;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.UsuarioAutenticacionRepository;
import com.inmobiliaria.backend.security.JwtProvider;
import com.inmobiliaria.backend.security.LimiteIntentos;
import com.inmobiliaria.backend.security.SesionCookie;
import jakarta.servlet.http.HttpServletRequest;
import com.inmobiliaria.backend.service.FirebaseService;
import com.inmobiliaria.backend.service.UsuarioAutenticacionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Autenticación. Reglas de seguridad importantes:
 *  - /register es público pero SIEMPRE crea usuarios CLIENTE. Solo un ADMIN
 *    autenticado puede crear usuarios AGENTE o ADMIN (mandando "rol").
 *  - El rol de un usuario Firebase nunca se toma de Firestore ni del body.
 *  - Los endpoints /firebase/usuario/** están restringidos a ADMIN en SecurityConfig.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);
    private static final int MIN_PASSWORD = 8;

    /** Nombres y apellidos: sin < ni > (evita código incrustado) ni caracteres de control. Devuelve el problema o null. */
    static String problemaNombre(String valor, String campo) {
        if (valor != null && valor.matches("(?s).*[<>\\p{Cntrl}].*"))
            return "El " + campo + " no puede contener los símbolos < ni > ni caracteres especiales de control";
        return null;
    }

    /** Usuario: letras, números y . _ @ + - (sirve también para un email). Devuelve el problema o null. */
    static String problemaUsuario(String u) {
        if (u == null || !u.matches("[A-Za-z0-9._@+\\-]{3,100}"))
            return "El usuario solo puede tener letras, números y los símbolos . _ @ + - (de 3 a 100 caracteres)";
        return null;
    }

    /** Reglas de contraseña del registro (las mismas que el formulario). Devuelve el problema o null si es válida. */
    static String validarFortaleza(String p, String usuario) {
        if (p == null || p.length() < MIN_PASSWORD) return "La contraseña debe tener al menos " + MIN_PASSWORD + " caracteres";
        if (p.length() > 72) return "La contraseña es demasiado larga (máximo 72 caracteres)";
        if (!p.matches(".*\\p{Ll}.*")) return "La contraseña debe incluir al menos una letra minúscula";
        if (!p.matches(".*\\p{Lu}.*")) return "La contraseña debe incluir al menos una letra mayúscula";
        if (!p.matches(".*\\d.*")) return "La contraseña debe incluir al menos un número";
        if (usuario != null && p.equalsIgnoreCase(usuario.trim())) return "La contraseña no puede ser igual al usuario";
        return null;
    }

    @Autowired private UsuarioAutenticacionRepository usuarioRepository;
    @Autowired private UsuarioAutenticacionService usuarioService;
    @Autowired private JwtProvider jwtProvider;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private LimiteIntentos limite;
    @Autowired private SesionCookie sesionCookie;

    @Autowired(required = false)
    private FirebaseService firebaseService;

    // ── Helpers ───────────────────────────────────────────────────────────

    private Map<String, Object> usuarioDto(UsuarioAutenticacion u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getIdUsuario());
        m.put("username", u.getUsername());
        m.put("nombre", u.getNombreCompleto());
        m.put("iniciales", u.getIniciales() != null ? u.getIniciales() : "");
        m.put("rol", u.getRol().name());
        m.put("apellido", u.getApellido() != null ? u.getApellido() : "");
        m.put("telefono", u.getTelefono() != null ? u.getTelefono() : "");
        m.put("foto", u.getFotoPerfil() != null ? u.getFotoPerfil() : "");
        return m;
    }

    private ResponseEntity<?> respuestaConToken(UsuarioAutenticacion u) {
        Map<String, Object> body = new LinkedHashMap<>();
        // El token NO viaja en el cuerpo: va en una cookie HttpOnly que el JavaScript no puede leer
        body.put("usuario", usuarioDto(u));
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sesionCookie.crear(jwtProvider.generateToken(u.getUsername())))
            .body(body);
    }

    /** Usuario autenticado en este request (lo setea JwtAuthenticationFilter) o null. */
    private UsuarioAutenticacion usuarioActual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UsuarioAutenticacion) {
            return (UsuarioAutenticacion) auth.getPrincipal();
        }
        return null;
    }

    private static Map<String, Object> error(String mensaje) {
        return Map.of("error", mensaje);
    }

    // ── Login / registro ──────────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credenciales, HttpServletRequest req) {
        String username = credenciales.get("username");
        String password = credenciales.get("password");
        if (username == null || password == null || username.isBlank() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(error("Usuario y contraseña requeridos"));
        }
        String clave = LimiteIntentos.claveLogin(req.getRemoteAddr(), username);
        if (limite.loginBloqueado(clave)) {
            return ResponseEntity.status(429).body(error("Demasiados intentos fallidos. Esperá 15 minutos e intentá de nuevo."));
        }
        UsuarioAutenticacion u = usuarioRepository.findByUsername(username.trim()).orElse(null);
        boolean ok = u != null
            && Boolean.TRUE.equals(u.getActivo())
            && u.getPassword() != null && !u.getPassword().isEmpty()
            && passwordEncoder.matches(password, u.getPassword());
        if (!ok) {
            limite.loginFallido(clave);
            return ResponseEntity.status(401).body(error("Credenciales inválidas"));
        }
        limite.loginExitoso(clave);
        u.setFechaUltimoLogin(LocalDate.now());
        usuarioRepository.save(u);
        return respuestaConToken(u);
    }

    /** Cierra la sesión: borra la cookie (público, para poder limpiar también sesiones vencidas). */
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sesionCookie.borrar())
            .body(Map.of("ok", true));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> data, HttpServletRequest req) {
        if (limite.registroBloqueado(req.getRemoteAddr())) {
            return ResponseEntity.status(429).body(error("Se crearon demasiadas cuentas desde esta conexión. Probá más tarde."));
        }
        String username = data.get("username");
        String password = data.get("password");
        String nombre   = data.get("nombre");
        if (username == null || username.isBlank() || password == null || nombre == null || nombre.isBlank()) {
            return ResponseEntity.badRequest().body(error("Campos requeridos: username, password, nombre"));
        }
        username = username.trim();
        String problemaTexto = problemaUsuario(username);
        if (problemaTexto == null) problemaTexto = problemaNombre(nombre, "nombre");
        if (problemaTexto != null) return ResponseEntity.badRequest().body(error(problemaTexto));
        String problemaClave = validarFortaleza(password, username);
        if (problemaClave != null) {
            return ResponseEntity.badRequest().body(error(problemaClave));
        }
        if (usuarioRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(error("El usuario ya existe"));
        }

        // Rol: por defecto CLIENTE. Solo un ADMIN logueado puede elegir otro.
        UsuarioAutenticacion.Rol rolEnum = UsuarioAutenticacion.Rol.CLIENTE;
        String rolPedido = data.get("rol");
        if (rolPedido != null && !rolPedido.isBlank()
                && !rolPedido.trim().equalsIgnoreCase("CLIENTE")) {
            UsuarioAutenticacion actual = usuarioActual();
            boolean esAdmin = actual != null && actual.getRol() == UsuarioAutenticacion.Rol.ADMIN;
            if (!esAdmin) {
                return ResponseEntity.status(403).body(error(
                    "Solo un administrador puede crear usuarios con rol " + rolPedido.toUpperCase()));
            }
            try {
                rolEnum = UsuarioAutenticacion.Rol.valueOf(rolPedido.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(error("Rol inválido. Opciones: ADMIN, AGENTE, CLIENTE"));
            }
        }

        UsuarioAutenticacion usuario = new UsuarioAutenticacion();
        usuario.setUsername(username);
        usuario.setPassword(passwordEncoder.encode(password));
        usuario.setNombreCompleto(nombre.trim());
        usuario.setIniciales(UsuarioAutenticacionService.iniciales(nombre));
        usuario.setRol(rolEnum);
        usuario.setActivo(true);
        usuarioRepository.save(usuario);
        limite.registroRealizado(req.getRemoteAddr());
        return ResponseEntity.ok(Map.of("ok", true, "mensaje", "Usuario registrado exitosamente", "rol", rolEnum.name()));
    }

    // ── Firebase ──────────────────────────────────────────────────────────

    @PostMapping("/firebase/login")
    public ResponseEntity<?> loginConFirebase(@RequestBody Map<String, String> request) {
        String idToken = request.get("idToken");
        if (idToken == null || idToken.isBlank()) {
            return ResponseEntity.badRequest().body(error("idToken requerido"));
        }
        if (firebaseService == null || !firebaseService.isInitialized()) {
            return ResponseEntity.status(503).body(error("Firebase no disponible"));
        }
        try {
            Map<String, Object> resultado = firebaseService.validateToken(idToken);
            if (!Boolean.TRUE.equals(resultado.get("ok"))) {
                Object msg = resultado.get("mensaje");
                return ResponseEntity.status(401).body(error(msg != null ? msg.toString() : "Token inválido"));
            }
            UsuarioAutenticacion usuario = usuarioService.obtenerOCrearDesdeFirebase(
                (String) resultado.get("email"), (String) resultado.get("nombre"));
            if (!Boolean.TRUE.equals(usuario.getActivo())) {
                return ResponseEntity.status(401).body(error("Usuario inactivo"));
            }
            return respuestaConToken(usuario);
        } catch (Exception e) {
            log.error("Error en login con Firebase: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(error("Error interno del servidor"));
        }
    }

    /** Registro "desde Firebase": siempre CLIENTE, y solo si Firebase está configurado. */
    @PostMapping("/firebase/register")
    public ResponseEntity<?> registrarDesdeFirebase(@RequestBody FirebaseUsuario firebaseUsuario) {
        if (firebaseService == null || !firebaseService.isInitialized()) {
            return ResponseEntity.status(503).body(error("Firebase no disponible"));
        }
        if (firebaseUsuario == null || firebaseUsuario.getIdToken() == null || firebaseUsuario.getIdToken().isBlank()) {
            return ResponseEntity.badRequest().body(error("idToken requerido"));
        }
        try {
            // uid y email salen del token verificado por Firebase, nunca de lo que mande el navegador
            Map<String, Object> verificado = firebaseService.validateToken(firebaseUsuario.getIdToken());
            if (!Boolean.TRUE.equals(verificado.get("ok")) || verificado.get("uid") == null || verificado.get("email") == null) {
                return ResponseEntity.status(401).body(error("Token inválido"));
            }
            String uidVerificado = verificado.get("uid").toString();
            String emailVerificado = verificado.get("email").toString();
            if (usuarioRepository.findByUsername(emailVerificado).isPresent()) {
                return ResponseEntity.badRequest().body(error("El usuario ya existe"));
            }
            UsuarioAutenticacion usuario = usuarioService.obtenerOCrearDesdeFirebase(
                emailVerificado, firebaseUsuario.getNombre());
            firebaseService.createUsuarioFirebase(uidVerificado, Map.of(
                "id", usuario.getIdUsuario(),
                "email", usuario.getUsername(),
                "nombre", usuario.getNombreCompleto(),
                "rol", usuario.getRol().name(),
                "iniciales", usuario.getIniciales()
            ));
            return respuestaConToken(usuario);
        } catch (Exception e) {
            log.error("Error registrando usuario desde Firebase: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(error("Error interno del servidor"));
        }
    }

    @GetMapping("/firebase/usuario/{uid}")
    public ResponseEntity<?> getUsuarioDesdeFirebase(@PathVariable String uid) {
        try {
            if (firebaseService == null || !firebaseService.isInitialized()) {
                return ResponseEntity.status(503).body(error("Firebase no disponible"));
            }
            Map<String, Object> usuario = firebaseService.getUsuarioFirebase(uid);
            if (usuario == null) {
                return ResponseEntity.status(404).body(error("Usuario no encontrado en Firebase"));
            }
            return ResponseEntity.ok(usuario);
        } catch (Exception e) {
            log.error("Error obteniendo usuario de Firebase: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(error("Error interno del servidor"));
        }
    }

    @PostMapping("/firebase/usuario/{uid}")
    public ResponseEntity<?> upsertUsuarioEnFirebase(@PathVariable String uid, @RequestBody Map<String, Object> data) {
        try {
            if (firebaseService == null || !firebaseService.isInitialized()) {
                return ResponseEntity.status(503).body(error("Firebase no disponible"));
            }
            firebaseService.updateUsuarioFirebase(uid, data);
            return ResponseEntity.ok(Map.of("mensaje", "Usuario actualizado en Firebase"));
        } catch (Exception e) {
            log.error("Error actualizando usuario en Firebase: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(error("Error interno del servidor"));
        }
    }

    // ── Sesión ────────────────────────────────────────────────────────────

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        UsuarioAutenticacion actual = usuarioActual();
        if (actual == null) {
            return ResponseEntity.status(401).body(error("No autenticado"));
        }
        // Releer de la base por si cambió algo desde el login
        return usuarioRepository.findById(actual.getIdUsuario())
            .map(u -> ResponseEntity.ok((Object) usuarioDto(u)))
            .orElse(ResponseEntity.status(404).body(error("Usuario no encontrado")));
    }

    // Formatos de imagen aceptados (SVG queda afuera a propósito: puede llevar scripts)
    private static final java.util.regex.Pattern FOTO_OK =
        java.util.regex.Pattern.compile("^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$");
    private static final int FOTO_MAX_CHARS = 300_000;   // ~220 KB de imagen
    private static final java.util.regex.Pattern TEL_OK =
        java.util.regex.Pattern.compile("^[0-9+()\\-\\s.]{0,30}$");

    @PutMapping("/me")
    public ResponseEntity<?> updateMe(@RequestBody Map<String, String> data) {
        UsuarioAutenticacion actual = usuarioActual();
        if (actual == null) {
            return ResponseEntity.status(401).body(error("No autenticado"));
        }
        UsuarioAutenticacion usuario = usuarioRepository.findById(actual.getIdUsuario()).orElse(null);
        if (usuario == null) {
            return ResponseEntity.status(404).body(error("Usuario no encontrado"));
        }

        // Nombre / apellido: si vienen, no pueden estar vacíos
        if (data.containsKey("nombre")) {
            String nombre = data.get("nombre") == null ? "" : data.get("nombre").trim();
            if (nombre.isEmpty()) return ResponseEntity.badRequest().body(error("El nombre es obligatorio"));
            if (nombre.length() > 100) return ResponseEntity.badRequest().body(error("El nombre es demasiado largo"));
            String pn = problemaNombre(nombre, "nombre");
            if (pn != null) return ResponseEntity.badRequest().body(error(pn));
            usuario.setNombreCompleto(nombre);
        }
        if (data.containsKey("apellido")) {
            String apellido = data.get("apellido") == null ? "" : data.get("apellido").trim();
            if (apellido.length() > 100) return ResponseEntity.badRequest().body(error("El apellido es demasiado largo"));
            String pa = problemaNombre(apellido, "apellido");
            if (pa != null) return ResponseEntity.badRequest().body(error(pa));
            usuario.setApellido(apellido);
        }

        if (data.containsKey("telefono")) {
            String tel = data.get("telefono") == null ? "" : data.get("telefono").trim();
            if (!TEL_OK.matcher(tel).matches()) {
                return ResponseEntity.badRequest().body(error("Teléfono inválido (solo números, +, espacios, guiones y paréntesis, máx. 30)"));
            }
            usuario.setTelefono(tel.isEmpty() ? null : tel);
        }

        // Foto: ausente = no se toca; "" = quitar; data URL = reemplazar
        if (data.containsKey("foto")) {
            String foto = data.get("foto");
            if (foto == null || foto.isBlank()) {
                usuario.setFotoPerfil(null);
            } else {
                if (foto.length() > FOTO_MAX_CHARS) {
                    return ResponseEntity.badRequest().body(error("La imagen es demasiado pesada"));
                }
                if (!FOTO_OK.matcher(foto).matches()) {
                    return ResponseEntity.badRequest().body(error("Formato de imagen no permitido (usá PNG, JPG, WEBP o GIF)"));
                }
                usuario.setFotoPerfil(foto);
            }
        }

        String base = usuario.getNombreCompleto() + " " + (usuario.getApellido() == null ? "" : usuario.getApellido());
        usuario.setIniciales(UsuarioAutenticacionService.iniciales(base.trim()));
        usuarioRepository.save(usuario);
        return ResponseEntity.ok(usuarioDto(usuario));
    }
}
