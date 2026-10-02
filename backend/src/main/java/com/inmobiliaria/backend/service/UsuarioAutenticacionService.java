package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.repository.UsuarioAutenticacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class UsuarioAutenticacionService {

    @Autowired
    private UsuarioAutenticacionRepository repo;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public List<UsuarioAutenticacion> listarTodos() {
        return repo.findAll();
    }

    public Optional<UsuarioAutenticacion> buscarPorId(Integer id) {
        return repo.findById(id);
    }

    public Optional<UsuarioAutenticacion> buscarPorUsername(String username) {
        return repo.findByUsername(username);
    }

    public UsuarioAutenticacion guardar(UsuarioAutenticacion u) {
        if (u.getPassword() != null && !u.getPassword().startsWith("{")) {
            u.setPassword(passwordEncoder.encode(u.getPassword()));
        }
        u.setIniciales(u.getNombreCompleto().substring(0, 2).toUpperCase());
        return repo.save(u);
    }

    public UsuarioAutenticacion autenticar(String username, String password) {
        Optional<UsuarioAutenticacion> opt = repo.findByUsername(username);
        if (opt.isEmpty()) return null;
        UsuarioAutenticacion u = opt.get();
        if (!passwordEncoder.matches(password, u.getPassword())) return null;
        if (!u.getActivo()) return null;
        u.setFechaUltimoLogin(LocalDate.now());
        return repo.save(u);
    }

    public void eliminar(Integer id) {
        repo.deleteById(id);
    }

    /**
     * Busca al usuario por email; si no existe lo crea SIEMPRE con rol CLIENTE.
     * El rol nunca se toma de datos externos (Firebase/Firestore): para subir
     * de rol hay que hacerlo desde la base o con un ADMIN.
     */
    public UsuarioAutenticacion obtenerOCrearDesdeFirebase(String email, String nombreOriginal) {
        // El nombre viene de Google/Firebase: no se rechaza, pero se le sacan < > y caracteres de control
        String nombre = nombreOriginal == null ? null : nombreOriginal.replaceAll("[<>\\p{Cntrl}]", "").trim();
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("El token de Firebase no trae email.");
        }
        Optional<UsuarioAutenticacion> existente = repo.findByUsername(email);
        if (existente.isPresent()) {
            UsuarioAutenticacion u = existente.get();
            if (nombre != null && !nombre.isBlank() && !nombre.equals(u.getNombreCompleto())) {
                u.setNombreCompleto(nombre);
                u.setIniciales(iniciales(nombre));
                u = repo.save(u);
            }
            return u;
        }
        String base = (nombre != null && !nombre.isBlank()) ? nombre : email.split("@")[0];
        UsuarioAutenticacion u = new UsuarioAutenticacion();
        u.setUsername(email);
        u.setPassword("");   // sin contraseña local: entra solo vía Firebase
        u.setNombreCompleto(base);
        u.setIniciales(iniciales(base));
        u.setRol(UsuarioAutenticacion.Rol.CLIENTE);
        u.setActivo(true);
        return repo.save(u);
    }

    public static String iniciales(String nombre) {
        if (nombre == null || nombre.isBlank()) return "US";
        String n = nombre.trim();
        String[] partes = n.split("\\s+");
        if (partes.length >= 2) {
            return ("" + partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
        }
        return n.substring(0, Math.min(2, n.length())).toUpperCase();
    }
}
