package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
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

    @Column(name = "titulo", nullable = false, length = 150)
    private String titulo;

    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_inmueble", nullable = false)
    private TipoInmueble tipoInmueble;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_operacion", nullable = false)
    private TipoOperacion tipoOperacion;

    @Column(name = "precio", nullable = false)
    private Double precio;

    @Enumerated(EnumType.STRING)
    @Column(name = "moneda", nullable = false)
    private Moneda moneda;

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

    @Column(name = "ruta_carpeta_fotos", length = 255)
    private String rutaCarpetaFotos;

    @Column(name = "link_escritura_pdf", length = 255)
    private String linkEscrituraPdf;

    @Column(name = "link_informe_dominio_pdf", length = 255)
    private String linkInformeDominioPdf;

    // Helper para cambiar propietario solo por ID (usado en cerrar venta)
    public void setIdPropietarioActualId(Integer id) {
        Persona p = new Persona();
        p.setIdPersona(id);
        this.propietarioActual = p;
    }

    public enum TipoInmueble   { Casa, Departamento, Terreno, Local }
    public enum TipoOperacion  { Venta, AlquilerPermanente, AlquilerTemporario, Permuta }
    public enum Moneda         { ARS, USD }
    public enum EstadoPropiedad {
        Disponible, Reservada, Alquilada, Vendida, Permutada, Inactiva
    }
}