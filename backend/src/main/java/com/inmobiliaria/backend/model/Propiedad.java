package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ToString(exclude = {"imagenes", "amenities", "caractTerreno", "caractRiesgos",
        "caractUbicacion", "ambientesEsp", "caractCocina", "caractExteriores",
        "caractAberturas", "caractPisos", "caractAguaGas", "caractDesagues",
        "caractSeguridad", "caractDestacadas", "caractAccesibilidad",
        "gastosGenerales", "transferenciasParciales", "historialNotas", "operacionesAdicionales"})
@Entity
@Table(name = "Propiedades")
public class Propiedad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_propiedad")
    private Integer idPropiedad;

    // @ManyToOne = muchas propiedades pueden tener un mismo propietario
    // @JoinColumn = columna FK en esta tabla que apunta a Personas
    @ManyToOne
    @JoinColumn(name = "id_propietario_actual", nullable = false)
    private Persona propietarioActual;

    // ── NOMBRE / DESCRIPCION ──────────────────────────────────────────
    @Column(name = "titulo", nullable = false, length = 150)
    private String titulo;

    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String descripcion;

    // ── TIPO / OPERACION / PRECIO / MONEDA ────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_inmueble", nullable = false)
    private TipoInmueble tipoInmueble;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_operacion", nullable = false)
    private TipoOperacion tipoOperacion;

    // Otras operaciones en las que TAMBIÉN se ofrece (ej. principal Venta + Alquiler Anual).
    // La principal manda en el precio, la ficha y el mapa; estas solo habilitan la propiedad para esas operaciones.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "propiedad_operaciones_adicionales", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Enumerated(EnumType.STRING)
    @Column(name = "operacion", length = 30)
    private java.util.Set<TipoOperacion> operacionesAdicionales = new java.util.LinkedHashSet<>();

    public boolean ofreceOperacion(TipoOperacion op) {
        return op != null && (op == tipoOperacion || (operacionesAdicionales != null && operacionesAdicionales.contains(op)));
    }

    @Column(name = "precio", nullable = false, precision = 12, scale = 2)
    private BigDecimal precio;

    @Enumerated(EnumType.STRING)
    @Column(name = "moneda", nullable = false)
    private Moneda moneda;

    // ── SUPERFICIES BASE ───────────────────────────────────────────────
    @Column(name = "superficie_total_m2")
    private Integer superficieTotalM2;

    @Column(name = "superficie_cubierta_m2")
    private Integer superficieCubiertaM2;

    @Column(name = "cant_dormitorios")
    private Integer cantDormitorios = 0;

    @Column(name = "cant_banos")
    private Integer cantBanos = 0;

    @Column(name = "tiene_garage")
    private Boolean tieneGarage = false;

    @Column(name = "tiene_pileta")
    private Boolean tienePileta = false;

    @Column(name = "tiene_asador")
    private Boolean tieneAsador = false;

    @Column(name = "vista_al_lago")
    private Boolean vistaAlLago = false;

    @Column(name = "tiene_gas_natural")
    private Boolean tieneGasNatural = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_propiedad")
    private EstadoPropiedad estadoPropiedad = EstadoPropiedad.Disponible;

    // ── DOCUMENTOS ─────────────────────────────────────────────────────
    @Column(name = "ruta_carpeta_fotos", length = 255)
    private String rutaCarpetaFotos;

    @Column(name = "link_escritura_pdf", length = 255)
    private String linkEscrituraPdf;

    @Column(name = "link_informe_dominio_pdf", length = 255)
    private String linkInformeDominioPdf;

    // ── PUBLICACION WEB (usado por MapaInteractivo.jsx) ───────────────
    @Column(name = "latitud")
    private Double latitud;

    @Column(name = "longitud")
    private Double longitud;

    @Column(name = "zona", length = 50)
    private String zona;

    @Column(name = "price_str", length = 50)
    private String priceStr;

    @Column(name = "agent", length = 100)
    private String agent;

    @Column(name = "show_exact_location")
    private Boolean showExactLocation = true;

    @Column(name = "date_added")
    private LocalDate dateAdded = LocalDate.now();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Amenities", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "amenity")
    private List<String> amenities = new ArrayList<>();

    @OneToMany(mappedBy = "propiedad", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ImagenPropiedad> imagenes = new ArrayList<>();

    /**
     * Helper: obtener URLs de fotos como lista de strings (compatibilidad con frontend).
     */
    public List<String> getFotosUrls() {
        return imagenes.stream().map(ImagenPropiedad::getUrlImagen).toList();
    }

    /**
     * Helper: establecer fotos desde una lista de URLs (compatibilidad con frontend).
     * Crea Entidades ImagenPropiedad asociadas.
     */
    public void setFotosFromUrls(List<String> urls) {
        this.imagenes.clear();
        if (urls != null) {
            for (int i = 0; i < urls.size(); i++) {
                ImagenPropiedad img = new ImagenPropiedad();
                img.setPropiedad(this);
                img.setUrlImagen(urls.get(i));
                img.setEsFotoPrincipal(i == 0);
                img.setOrdenAparicion(i + 1);
                this.imagenes.add(img);
            }
        }
    }

    // ── UBICACION GEOGRAFICA ───────────────────────────────────────────
    @Column(name = "provincia", length = 50)
    private String provincia;

    @Column(name = "departamento_prov", length = 50)
    private String departamentoProv;

    @Column(name = "localidad", length = 100)
    private String localidad;

    @Column(name = "barrio", length = 100)
    private String barrio;

    @Column(name = "sub_barrio", length = 100)
    private String subBarrio;

    @Column(name = "calle", length = 150)
    private String calle;

    @Column(name = "numero", length = 20)
    private String numero;

    @Column(name = "piso_dpto", length = 20)
    private String pisoDpto;

    @Column(name = "torre", length = 20)
    private String torre;

    @Column(name = "bloque", length = 20)
    private String bloque;

    @Column(name = "casa_unidad", length = 20)
    private String casaUnidad;

    @Column(name = "codigo_postal", length = 10)
    private String codigoPostal;

    @Column(name = "dir_exacta_publica")
    private Boolean dirExactaPublica = true;

    @Column(name = "ubicacion_aprox_publica")
    private Boolean ubicacionAproxPublica = true;

    @Column(name = "link_google_maps", length = 500)
    private String linkGoogleMaps;

    // ── CATASTRO ───────────────────────────────────────────────────────
    @Column(name = "cat_circunscripcion", length = 20)
    private String catCircunscripcion;

    @Column(name = "cat_seccion", length = 20)
    private String catSeccion;

    @Column(name = "cat_manzana", length = 20)
    private String catManzana;

    @Column(name = "cat_parcela", length = 20)
    private String catParcela;

    @Column(name = "cat_lote", length = 20)
    private String catLote;

    @Column(name = "cat_partida", length = 50)
    private String catPartida;

    @Column(name = "cat_cuenta_tributaria", length = 50)
    private String catCuentaTributaria;

    @Column(name = "cat_matricula", length = 50)
    private String catMatricula;

    @Column(name = "cat_folio", length = 50)
    private String catFolio;

    @Column(name = "cat_finca", length = 50)
    private String catFinca;

    @Column(name = "uf", length = 20)
    private String uf;

    @Column(name = "uc", length = 20)
    private String uc;

    @Column(name = "sup_titulo")
    private Double supTitulo;

    @Column(name = "sup_catastro")
    private Double supCatastro;

    @Column(name = "sup_plano")
    private Double supPlano;

    @Column(name = "sup_mensura")
    private Double supMensura;

    @Column(name = "sup_ph")
    private Double supPH;

    @Column(name = "sup_relevada")
    private Double supRelevada;

    @Column(name = "dif_superficies")
    private Boolean difSuperficies = false;

    @Column(name = "obs_superficies", length = 200)
    private String obsSuperficies;

    // ── TERRENO ────────────────────────────────────────────────────────
    @Column(name = "ter_sup")
    private Double terSup;

    @Column(name = "ter_frente")
    private Double terFrente;

    @Column(name = "ter_fondo")
    private Double terFondo;

    @Column(name = "ter_frente2")
    private Double terFrente2;

    @Column(name = "ter_fondo2")
    private Double terFondo2;

    @Column(name = "ter_sup_esquina")
    private Double terSupEsquina;

    @Column(name = "ter_forma", length = 50)
    private String terForma;

    @Column(name = "ter_orientacion", length = 20)
    private String terOrientacion;

    @Column(name = "ter_lim_frente")
    private Double terLimFrente;

    @Column(name = "ter_lim_fondo")
    private Double terLimFondo;

    @Column(name = "ter_lim_derecho")
    private Double terLimDerecho;

    @Column(name = "ter_lim_izquierdo")
    private Double terLimIzquierdo;

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Terreno", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractTerreno = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Riesgos", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractRiesgos = new ArrayList<>();

    // ── CONSTRUCCION ───────────────────────────────────────────────────
    @Column(name = "sup_cubierta")
    private Double supCubierta;

    @Column(name = "sup_semicubierta")
    private Double supSemicubierta;

    @Column(name = "sup_descubierta")
    private Double supDescubierta;

    @Column(name = "sup_total")
    private Double supTotal;

    @Column(name = "sup_construida")
    private Double supConstruida;

    @Column(name = "sup_habitable")
    private Double supHabitable;

    @Column(name = "sup_comunes")
    private Double supComunes;

    @Column(name = "sup_propia")
    private Double supPropia;

    @Column(name = "anio_construccion")
    private Integer anioConstruccion;

    @Column(name = "antiguedad")
    private Integer antiguedad;

    @Column(name = "anio_remodelacion")
    private Integer anioRemodelacion;

    @Column(name = "anio_ampliacion")
    private Integer anioAmpliacion;

    @Column(name = "estado_conservacion", length = 50)
    private String estadoConservacion = "Excelente";

    // ── DISTRIBUCION ───────────────────────────────────────────────────
    @Column(name = "cant_ambientes")
    private Integer cantAmbientes = 0;

    @Column(name = "cant_plantas")
    private Integer cantPlantas = 1;

    @Column(name = "cant_suites")
    private Integer cantSuites = 0;

    @Column(name = "cant_toilettes")
    private Integer cantToilettes = 0;

    @Column(name = "cant_cocinas")
    private Integer cantCocinas = 1;

    @Column(name = "cant_livings")
    private Integer cantLivings = 1;

    @Column(name = "cant_comedores")
    private Integer cantComedores = 1;

    @Column(name = "cant_cocheras")
    private Integer cantCocheras = 0;

    // ── CARACTERISTICAS (arrays del formulario) ────────────────────────
    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Ubicacion", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractUbicacion = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Ambientes_Esp", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "ambiente")
    private List<String> ambientesEsp = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Cocina", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractCocina = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Exteriores", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractExteriores = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Aberturas", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractAberturas = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Pisos", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractPisos = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Agua_Gas", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractAguaGas = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Desagues", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractDesagues = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Seguridad", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractSeguridad = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Destacadas", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractDestacadas = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "Propiedad_Caract_Accesibilidad", joinColumns = @JoinColumn(name = "id_propiedad"))
    @Column(name = "caracteristica")
    private List<String> caractAccesibilidad = new ArrayList<>();

    // ── INSTALACIONES ───────────────────────────────────────────────────
    @Column(name = "pileta_tipo", length = 100)
    private String piletaTipo;

    @Column(name = "pileta_medidas", length = 50)
    private String piletaMedidas;

    @Column(name = "pileta_climatizada")
    private Boolean piletaClimatizada = false;

    @Column(name = "tiene_internet")
    private Boolean tieneInternet = false;

    @Column(name = "internet_tipo", length = 50)
    private String internetTipo;

    @Column(name = "internet_proveedor", length = 100)
    private String internetProveedor;

    @Column(name = "tiene_climatizacion")
    private Boolean tieneClimatizacion = false;

    @Column(name = "climatizacion_tipo", length = 100)
    private String climatizacionTipo;

    // ── EDIFICIO / COMPLEJO ────────────────────────────────────────────
    @Column(name = "es_parte_de", length = 50)
    private String esParteDe = "Ninguno";

    @Column(name = "edi_cant_pisos")
    private Integer ediCantPisos;

    @Column(name = "edi_cant_unidades")
    private Integer ediCantUnidades;

    @Column(name = "edi_expensas")
    private Double ediExpensas;

    @Column(name = "edi_amenities", length = 200)
    private String ediAmenities;

    @Column(name = "cou_nombre", length = 100)
    private String couNombre;

    @Column(name = "cou_lote", length = 50)
    private String couLote;

    @Column(name = "cou_expensas")
    private Double couExpensas;

    @Column(name = "cou_amenities", length = 200)
    private String couAmenities;

    // ── LEGAL / REGISTRAL ──────────────────────────────────────────────
    @Column(name = "leg_dominio", length = 50)
    private String legDominio;

    @Column(name = "leg_restricciones", length = 200)
    private String legRestricciones;

    @Column(name = "leg_medidas_cautelares", length = 200)
    private String legMedidasCautelares;

    @Column(name = "leg_litigios", length = 200)
    private String legLitigios;

    @Column(name = "cta_epec", length = 50)
    private String ctaEpec;

    @Column(name = "cta_gas", length = 50)
    private String ctaGas;

    @Column(name = "cta_agua", length = 50)
    private String ctaAgua;

    @Column(name = "cta_muni", length = 50)
    private String ctaMuni;

    @Column(name = "deuda_inmobiliario")
    private Double deudaInmobiliario;

    @Column(name = "deuda_muni")
    private Double deudaMuni;

    @Column(name = "deuda_expensas")
    private Double deudaExpensas;

    @Column(name = "libre_deuda_disponible")
    private Boolean libreDeudaDisponible = false;

    @Column(name = "servidumbres", length = 200)
    private String servidumbres;

    // ── OCUPACION ──────────────────────────────────────────────────────
    @Column(name = "ocp_estado", length = 50)
    private String ocpEstado = "Desocupado";

    @Column(name = "ocp_fecha_vencimiento")
    private LocalDate ocpFechaVencimiento;

    @Column(name = "ocp_monto")
    private Double ocpMonto;

    @Column(name = "ocp_moneda", length = 10)
    private String ocpMoneda = "ARS";

    @Column(name = "ocp_garantia", length = 200)
    private String ocpGarantia;

    @Column(name = "ocp_se_vende_con_contrato")
    private Boolean ocpSeVendeConContrato = false;

    @Column(name = "sit_construccion_registrada", length = 50)
    private String sitConstruccionRegistrada = "Registrada";

    @Column(name = "sit_final_obra")
    private Boolean sitFinalObra = false;

    // ── RURAL ──────────────────────────────────────────────────────────
    @Column(name = "es_rural")
    private Boolean esRural = false;

    @Column(name = "rur_hectareas")
    private Double rurHectareas;

    @Column(name = "rur_aptitud", length = 100)
    private String rurAptitud;

    @Column(name = "rur_mejoras", length = 200)
    private String rurMejoras;

    // ── DESCRIPCIONES ──────────────────────────────────────────────────
    @Column(name = "desc_gral", columnDefinition = "TEXT")
    private String descGral;

    @Column(name = "desc_const", columnDefinition = "TEXT")
    private String descConst;

    @Column(name = "desc_ubicacion", columnDefinition = "TEXT")
    private String descUbicacion;

    @Column(name = "obs_tecnicas", columnDefinition = "TEXT")
    private String obsTecnicas;

    @Column(name = "obs_legales", columnDefinition = "TEXT")
    private String obsLegales;

    @Column(name = "obs_internas", columnDefinition = "TEXT")
    private String obsInternas;

    @Column(name = "estado_verificacion", length = 50)
    private String estadoVerificacion = "En revision";

    @Column(name = "fuente_verificacion", length = 50)
    private String fuenteVerificacion = "Declaracion";

    // ── COMERCIAL ──────────────────────────────────────────────────────
    @Column(name = "comision_pactada")
    private Double comisionPactada;

    @Column(name = "tiene_exclusividad")
    private Boolean tieneExclusividad = false;

    @Column(name = "fecha_vencimiento_exclusividad")
    private LocalDate fechaVencimientoExclusividad;

    @Column(name = "ubicacion_llaves", length = 200)
    private String ubicacionLlaves;

    @Column(name = "tiene_cartel")
    private Boolean tieneCartel = false;

    @Column(name = "tipo_cartel", length = 50)
    private String tipoCartel;

    @Column(name = "fecha_colocacion_cartel")
    private LocalDate fechaColocacionCartel;

    // ── COMUNS ─────────────────────────────────────────────────────────
    @Column(name = "estado_ficha", length = 50)
    private String estadoFicha = "Activa";

    @Column(name = "observaciones_generales", columnDefinition = "TEXT")
    private String observacionesGenerales;

    @Column(name = "es_complejo")
    private Boolean esComplejo = false;

    @Column(name = "cant_unidades")
    private Integer cantUnidades = 0;

    // Complejos: cada unidad es una Propiedad propia enlazada al complejo (otra Propiedad con esComplejo = true)
    @Column(name = "id_complejo")
    private Integer idComplejo;

    @Column(name = "unidad_identificador", length = 50)
    private String unidadIdentificador;

    @Column(name = "subtipo", length = 50)
    private String subtipo;

    @Column(name = "uso_actual", length = 50)
    private String usoActual;

    @Column(name = "uso_potencial", length = 100)
    private String usoPotencial;

    // ── TIPOS DE CONEXION / INTERNET ───────────────────────────────────
    @Column(name = "tipo_internet", length = 50)
    private String tipoInternet;

    // ── ENUMS ──────────────────────────────────────────────────────────
    public enum TipoInmueble { Casa, Departamento, Terreno, Local, Oficina, Cabana, Galpan }
    public enum TipoOperacion { Venta, AlquilerPermanente, AlquilerTemporario, Permuta }
    public enum Moneda { ARS, USD, EUR }
    public enum EstadoPropiedad { Disponible, Reservada, Alquilada, Vendida, Permutada, Inactiva, Suspendida, EnObra }

    // ── HELPER ─────────────────────────────────────────────────────────
    public void setIdPropietarioActualId(Integer id) {
        Persona p = new Persona();
        p.setIdPersona(id);
        this.propietarioActual = p;
    }
}
