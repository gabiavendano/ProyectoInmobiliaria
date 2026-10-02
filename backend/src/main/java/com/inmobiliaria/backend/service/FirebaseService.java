package com.inmobiliaria.backend.service;

import com.google.api.core.ApiFuture;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import com.google.firebase.cloud.FirestoreClient;

@Service
public class FirebaseService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseService.class);

    private FirebaseAuth firebaseAuth;
    private Firestore db;
    private boolean initialized = false;

    @Value("${firebase.config-path:}")
    private String configPath;

    @PostConstruct
    public void initialize() {
        if (configPath == null || configPath.isBlank()) {
            log.info("Firebase no configurado — se omitirá inicialización");
            return;
        }
        try {
            InputStream serviceAccount = getClass().getClassLoader()
                .getResourceAsStream(configPath.replace("classpath:", ""));
            if (serviceAccount == null) {
                log.warn("Firebase config file not found: {} — se omitirá Firebase", configPath);
                return;
            }
            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                .build();
            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
            }
            firebaseAuth = FirebaseAuth.getInstance();
            db = FirestoreClient.getFirestore();
            initialized = true;
            log.info("🔥 Firebase inicializado correctamente");
        } catch (IOException e) {
            log.error("Error inicializando Firebase: {}", e.getMessage(), e);
        }
    }

    private void ensureInitialized() {
        if (!initialized) {
            throw new IllegalStateException("Firebase no está inicializado");
        }
    }

    // ── Token Validation ──────────────────────────────────────────

    /**
     * Valida un token Firebase e integra la info del usuario desde la
     * colección usuariosFirebase (Firestore). Retorna el mismo formato que
     * usaba FirebaseAuthenticationHelper.validarToken().
     */
    public Map<String, Object> validateToken(String token) {
        if (!initialized) {
            Map<String, Object> resultado = new HashMap<>();
            resultado.put("ok", false);
            resultado.put("mensaje", "Firebase no está configurado o inicializado");
            return resultado;
        }
        try {
            FirebaseToken decodedToken = firebaseAuth.verifyIdToken(token);
            String uid = decodedToken.getUid();

            DocumentReference userDoc = db.collection("usuariosFirebase").document(uid);
            DocumentSnapshot doc = userDoc.get().get();

            Map<String, Object> resultado = new HashMap<>();
            resultado.put("uid", uid);
            resultado.put("email", decodedToken.getEmail());
            resultado.put("ok", true);                 // token válido (firma verificada)
            resultado.put("existeEnFirestore", doc.exists());

            if (doc.exists()) {
                Map<String, Object> datos = doc.getData();
                resultado.put("usuario", datos);
                resultado.put("rol", datos.get("rol"));
                resultado.put("iniciales", datos.get("iniciales"));
                resultado.put("nombre", datos.get("nombre"));
                resultado.put("id", datos.get("id"));
            } else {
                resultado.put("mensaje", "Usuario no encontrado en la base de datos");
            }
            return resultado;

        } catch (Exception e) {
            Map<String, Object> resultado = new HashMap<>();
            resultado.put("ok", false);
            resultado.put("mensaje", "Token inválido");
            return resultado;
        }
    }

    // ── UsuariosFirebase (Firestore) ──────────────────────────────

    public Map<String, Object> getUsuarioFirebase(String uid) {
        ensureInitialized();
        try {
            DocumentSnapshot doc = db.collection("usuariosFirebase").document(uid).get().get();
            if (!doc.exists()) return null;
            Map<String, Object> datos = doc.getData();
            datos.put("id", doc.getId());
            return datos;
        } catch (Exception e) {
            throw new RuntimeException("Error obteniendo usuario Firebase: " + e.getMessage(), e);
        }
    }

    public void createUsuarioFirebase(String uid, Map<String, Object> usuario) {
        ensureInitialized();
        try {
            Map<String, Object> datos = new HashMap<>(usuario);
            datos.remove("uid");
            db.collection("usuariosFirebase").document(uid).set(datos).get();
        } catch (Exception e) {
            throw new RuntimeException("Error creando usuario Firebase: " + e.getMessage(), e);
        }
    }

    public void updateUsuarioFirebase(String uid, Map<String, Object> updates) {
        ensureInitialized();
        try {
            db.collection("usuariosFirebase").document(uid).update(updates).get();
        } catch (Exception e) {
            throw new RuntimeException("Error actualizando usuario Firebase: " + e.getMessage(), e);
        }
    }

    public void deleteUsuarioFirebase(String uid) {
        ensureInitialized();
        try {
            db.collection("usuariosFirebase").document(uid).delete().get();
            firebaseAuth.deleteUser(uid);
        } catch (Exception e) {
            throw new RuntimeException("Error eliminando usuario: " + e.getMessage(), e);
        }
    }

    public List<Map<String, Object>> listarUsuariosFirebase() {
        ensureInitialized();
        try {
            List<QueryDocumentSnapshot> docs = db.collection("usuariosFirebase").get().get().getDocuments();
            List<Map<String, Object>> usuarios = new ArrayList<>();
            for (DocumentSnapshot doc : docs) {
                Map<String, Object> data = doc.getData();
                if (data != null) {
                    data.put("id", doc.getId());
                    usuarios.add(data);
                }
            }
            return usuarios;
        } catch (Exception e) {
            throw new RuntimeException("Error listando usuarios Firebase: " + e.getMessage(), e);
        }
    }

    public boolean isInitialized() {
        return initialized;
    }
}
