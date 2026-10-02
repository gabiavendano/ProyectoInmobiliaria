package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "Usuarios_Autenticacion")
public class UsuarioAutenticacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Integer idUsuario;

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    // Nunca debe aparecer en toString(): ni el hash de la contraseña ni la foto salen en logs o registros
    @ToString.Exclude
    @Column(name = "password", nullable = false, length = 255)
    private String password;

    @Column(name = "nombre_completo", nullable = false, length = 100)
    private String nombreCompleto;

    @Column(name = "iniciales", length = 10)
    private String iniciales;

    // Datos de perfil (opcionales). Las columnas se crean solas con ddl-auto=update.
    @Column(name = "apellido", length = 100)
    private String apellido;

    @Column(name = "telefono", length = 30)
    private String telefono;

    // Foto como data URL (data:image/jpeg;base64,...), ya reducida por el frontend
    @ToString.Exclude
    @Column(name = "foto_perfil", columnDefinition = "TEXT")
    private String fotoPerfil;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 20)
    private Rol rol = Rol.CLIENTE;

    @Column(name = "activo")
    private Boolean activo = true;

    @Column(name = "fecha_ultimo_login")
    private LocalDate fechaUltimoLogin;

    public enum Rol { ADMIN, AGENTE, CLIENTE }
}
