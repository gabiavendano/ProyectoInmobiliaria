package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ToString(exclude = {"relaciones", "compExtras", "compFormasPago", "historialNotas"})
@Entity
@Table(name = "Personas")
public class Persona {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_persona")
    private Integer idPersona;

    // ── IDENTIFICACION BASE (ya existente) ────────────────────────────
    @Column(name = "nombre_completo", nullable = false, length = 100)
    private String nombreCompleto;

    @Column(name = "dni_cuit", nullable = false, unique = true, length = 20)
    private String dniCuit;

    @Column(name = "telefono", length = 20)
    private String telefono;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "direccion_particular", length = 150)
    private String direccionParticular;

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

    // ── IDENTIFICACION EXTENDIDA (PersonaForm.jsx seccion 1) ──────────
    @Column(name = "tipo_cliente", length = 50)
    private String tipoCliente = "Persona humana";

    @Column(name = "nombre", length = 100)
    private String nombre;

    @Column(name = "apellido", length = 100)
    private String apellido;

    @Column(name = "fecha_nacimiento")
    private LocalDate fechaNacimiento;

    @Column(name = "nacionalidad", length = 50)
    private String nacionalidad = "Argentina";

    @Column(name = "razon_social", length = 150)
    private String razonSocial;

    @Column(name = "nombre_comercial", length = 150)
    private String nombreComercial;

    @Column(name = "cuit_juridica", length = 20)
    private String cuitJuridica;

    // CUIT/CUIL de la persona humana (antes se perdía cuando también cargaban el DNI)
    @Column(name = "cuit_cuil", length = 20)
    private String cuitCuil;

    @Column(name = "tipo_societario", length = 50)
    private String tipoSocietario;

    @Column(name = "actividad", length = 200)
    private String actividad;

    // ── CONTACTO (PersonaForm.jsx seccion 2) ──────────────────────────
    @Column(name = "tel_principal", length = 20)
    private String telPrincipal;

    @Column(name = "tel_secundario", length = 20)
    private String telSecundario;

    @Column(name = "whatsapp", length = 20)
    private String whatsapp;

    @Column(name = "email_principal", length = 100)
    private String emailPrincipal;

    @Column(name = "email_secundario", length = 100)
    private String emailSecundario;

    @Column(name = "medio_contacto_pref", length = 50)
    private String medioContactoPref = "WhatsApp";

    @Column(name = "horario_contacto_pref", length = 100)
    private String horarioContactoPref;

    @Column(name = "acepta_comunicaciones_comerciales")
    private Boolean aceptaComunicacionesComerciales = true;

    // ── DOMICILIO (PersonaForm.jsx seccion 1, parte 2) ─────────────────
    @Column(name = "dom_calle", length = 150)
    private String calle;

    @Column(name = "dom_numero", length = 20)
    private String numero;

    @Column(name = "dom_piso", length = 20)
    private String piso;

    @Column(name = "dom_departamento", length = 20)
    private String departamento;

    @Column(name = "dom_localidad", length = 100)
    private String localidad = "Villa Carlos Paz";

    @Column(name = "dom_provincia", length = 50)
    private String provincia = "Cordoba";

    @Column(name = "dom_pais", length = 50)
    private String pais = "Argentina";

    @Column(name = "dom_codigo_postal", length = 10)
    private String codigoPostal = "5152";

    // ── PERFIL COMERCIAL (PersonaForm.jsx seccion 3) ───────────────────
    @ElementCollection
    @CollectionTable(name = "Persona_Relaciones", joinColumns = @JoinColumn(name = "id_persona"))
    @Column(name = "relacion")
    private List<String> relaciones = new ArrayList<>();

    @Column(name = "situacion_bcra", length = 100)
    private String situacionBcra = "Desconocido";

    // ── PERFIL COMPRADOR (PersonaForm.jsx seccion 4, condicional) ─────
    @Column(name = "comp_tipo_prop", length = 100)
    private String compTipoProp;

    @Column(name = "comp_localidades", length = 200)
    private String compLocalidades = "Villa Carlos Paz";

    @Column(name = "comp_barrios", length = 200)
    private String compBarrios;

    @Column(name = "comp_presupuesto_min")
    private Double compPresupuestoMin;

    @Column(name = "comp_presupuesto_max")
    private Double compPresupuestoMax;

    @Column(name = "comp_moneda", length = 10)
    private String compMoneda = "USD";

    @Column(name = "comp_dorms")
    private Integer compDorms;

    @Column(name = "comp_banos")
    private Integer compBanos;

    @Column(name = "comp_ambientes")
    private Integer compAmbientes;

    @Column(name = "comp_sup_min")
    private Double compSupMin;

    @Column(name = "comp_sup_max")
    private Double compSupMax;

    @Column(name = "comp_terreno_min")
    private Double compTerrenoMin;

    @Column(name = "comp_estado_prop", length = 50)
    private String compEstadoProp = "Indiferente";

    @Column(name = "comp_antiguedad_max")
    private Integer compAntiguedadMax;

    @Column(name = "comp_prioridades", length = 500)
    private String compPrioridades;

    @ElementCollection
    @CollectionTable(name = "Persona_Comp_Extras", joinColumns = @JoinColumn(name = "id_persona"))
    @Column(name = "extra")
    private List<String> compExtras = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Persona_Comp_Formas_Pago", joinColumns = @JoinColumn(name = "id_persona"))
    @Column(name = "forma_pago")
    private List<String> compFormasPago = new ArrayList<>();

    // ── PERFIL INQUILINO (PersonaForm.jsx seccion 5, condicional) ─────
    @Column(name = "alq_tipo_prop", length = 100)
    private String alqTipoProp;

    @Column(name = "alq_zona", length = 200)
    private String alqZona;

    @Column(name = "alq_presupuesto")
    private Double alqPresupuesto;

    @Column(name = "alq_moneda", length = 10)
    private String alqMoneda = "ARS";

    @Column(name = "alq_ambientes")
    private Integer alqAmbientes;

    @Column(name = "alq_dorms")
    private Integer alqDorms;

    @Column(name = "alq_banos")
    private Integer alqBanos;

    @Column(name = "alq_cochera")
    private Boolean alqCochera = false;

    @Column(name = "alq_amoblado")
    private Boolean alqAmoblado = false;

    @Column(name = "alq_mascotas")
    private Boolean alqMascotas = true;

    @Column(name = "alq_fecha_ingreso")
    private LocalDate alqFechaIngreso;

    @Column(name = "alq_plazo", length = 50)
    private String alqPlazo = "2 Anos";

    @Column(name = "alq_imprescindibles", length = 500)
    private String alqImprescindibles;

    @Column(name = "alq_deseables", length = 500)
    private String alqDeseables;

    // ── CRM (PersonaForm.jsx seccion 6) ────────────────────────────────
    @Column(name = "crm_estado", length = 50)
    private String crmEstado = "Prospecto";

    @Column(name = "crm_prioridad", length = 20)
    private String crmPrioridad = "Media";

    @Column(name = "crm_agente", length = 100)
    private String crmAgente;

    @Column(name = "crm_fuente", length = 50)
    private String crmFuente = "WhatsApp";

    @Column(name = "seg_fecha_primer_contacto")
    private LocalDate segFechaPrimerContacto;

    @Column(name = "seg_fecha_ultimo")
    private LocalDate segFechaUltimo;

    @Column(name = "seg_fecha_proximo")
    private LocalDate segFechaProximo;

    @Column(name = "seg_tareas_pendientes", length = 500)
    private String segTareasPendientes;

    // ── HISTORIAL DE NOTAS (PersonaForm.jsx seccion 6, timeline) ──────
    @OneToMany(mappedBy = "persona", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<NotaPersona> historialNotas = new ArrayList<>();

    // ── ENUMS ──────────────────────────────────────────────────────────
    public enum RolPrincipal { Propietario, Inquilino, Comprador, Colega, Agente }

    // ── HELPER ─────────────────────────────────────────────────────────
    public void agregarNota(String texto) {
        NotaPersona nota = new NotaPersona();
        nota.setPersona(this);
        nota.setTexto(texto);
        nota.setFecha(LocalDate.now());
        this.historialNotas.add(nota);
    }
}
