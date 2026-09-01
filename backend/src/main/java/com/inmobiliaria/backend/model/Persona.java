package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

// @Entity le dice a JPA: "esta clase es una tabla"
// @Data de Lombok genera getters, setters, toString automáticamente
@Data
@Entity
@Table(name = "Personas")
public class Persona {

    // @Id = clave primaria | @GeneratedValue = autoincremento
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_persona")
    private Integer idPersona;

    @Column(name = "nombre_completo", nullable = false, length = 100)
    private String nombreCompleto;

    // unique = true significa que no pueden existir dos personas con el mismo DNI
    @Column(name = "dni_cuit", nullable = false, unique = true, length = 20)
    private String dniCuit;

    @Column(name = "telefono", length = 20)
    private String telefono;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "direccion_particular", length = 150)
    private String direccionParticular;

    // @Enumerated(STRING) guarda el texto del enum, no un número
    @Enumerated(EnumType.STRING)
    @Column(name = "rol_principal", nullable = false)
    private RolPrincipal rolPrincipal;

    @Column(name = "estado_bcra")
    private Integer estadoBcra = 1;

    @Column(name = "inhibido")
    private Boolean inhibido = false;

    @Column(name = "link_informe_veraz_pdf", length = 255)
    private String linkInformeVerazPdf;

    @Column(name = "fecha_ultima_auditoria")
    private LocalDate fechaUltimaAuditoria;

    // Enum interno: define los valores permitidos para rol_principal
    public enum RolPrincipal {
        Propietario, Inquilino, Comprador, Colega
    }
}