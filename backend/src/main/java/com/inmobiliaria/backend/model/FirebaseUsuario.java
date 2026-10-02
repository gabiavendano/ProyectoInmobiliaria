package com.inmobiliaria.backend.model;

import lombok.Data;

/**
 * Representa un usuario proveniente de Firebase Auth / Firestore.
 * Se usa transitoriamente en los endpoints de AuthController
 * para manejar el flujo de registro/login con Firebase.
 */
@Data
public class FirebaseUsuario {

    private String idToken;    // token de Firebase: es lo que prueba quién es (uid/email se toman de acá)
    private String uid;
    private String email;
    private String nombre;
    private String telefono;
    private String rol;          // ADMIN, AGENTE, CLIENTE
    private String iniciales;
    private String id;           // ID en PostgreSQL (luego de crear/linkear)
    private boolean existeEnPostgreSQL;
}
