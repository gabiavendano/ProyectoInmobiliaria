package com.inmobiliaria.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "Rendiciones_Propietarios")
public class RendicionPropietario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_rendicion")
    private Integer idRendicion;

    @ManyToOne
    @JoinColumn(name = "id_propietario", nullable = false)
    private Persona propietario;

    @Column(name = "mes_ano", nullable = false, length = 20)
    private String mesAno;

    @Column(name = "fecha_render", nullable = false)
    private LocalDate fechaRender;

    @Column(name = "estado", length = 50)
    private String estado = "Pendiente";

    @Column(name = "total_neto", precision = 12, scale = 2)
    private BigDecimal totalNeto = BigDecimal.ZERO;

    @Column(name = "comprobante", length = 50)
    private String comprobante;

    // Propiedades rendidas (denormalizados para la vista del frontend)
    @ElementCollection
    @CollectionTable(name = "Rendicion_Propiedades", joinColumns = @JoinColumn(name = "id_rendicion"))
    @Column(name = "propiedad_nombre")
    private List<String> propiedadesNombres = new ArrayList<>();

    // Gastos generales del complejo
    @ElementCollection
    @CollectionTable(name = "Rendicion_Gastos", joinColumns = @JoinColumn(name = "id_rendicion"))
    private List<GastoRendicion> gastosGenerales = new ArrayList<>();

    // Transferencias parciales
    @ElementCollection
    @CollectionTable(name = "Rendicion_Transferencias", joinColumns = @JoinColumn(name = "id_rendicion"))
    private List<TransferenciaRendicion> transferenciasParciales = new ArrayList<>();

    // Detalle de cobros rendidos (líneas con signo: + alquiler/mora, − honorarios)
    @ElementCollection
    @CollectionTable(name = "Rendicion_Lineas", joinColumns = @JoinColumn(name = "id_rendicion"))
    private List<LineaRendicion> lineas = new ArrayList<>();

    @Column(name = "moneda", length = 3)
    private String moneda = "ARS";

    @Column(name = "id_movimiento")
    private Integer idMovimiento;

    /** Auditoría: usuarios que generaron, marcaron como transferida o anularon la rendición. */
    @Column(name = "generada_por", length = 80)
    private String generadaPor;

    @Column(name = "transferida_por", length = 80)
    private String transferidaPor;

    @Column(name = "anulada_por", length = 80)
    private String anuladaPor;

    // Historial de rendiciones (para mostrar en tabla)
    @OneToMany(mappedBy = "rendicionPadre", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RendicionHistorial> historial = new ArrayList<>();

    @Data
    @Embeddable
    public static class LineaRendicion {
        @Column(name = "descripcion")
        private String descripcion;
        @Column(name = "monto", precision = 12, scale = 2)
        private BigDecimal monto;
    }

    @Data
    @Embeddable
    public static class GastoRendicion {
        @Column(name = "descripcion")
        private String descripcion;
        @Column(name = "monto", precision = 12, scale = 2)
        private BigDecimal monto;
    }

    @Data
    @Embeddable
    public static class TransferenciaRendicion {
        @Column(name = "descripcion")
        private String descripcion;
        @Column(name = "monto", precision = 12, scale = 2)
        private BigDecimal monto;
    }

    @Data
    @Entity
    @Table(name = "Rendicion_Historial")
    public static class RendicionHistorial {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "id_historial")
        private Integer idHistorial;

        // @JsonIgnore: evita el ciclo Rendicion → historial → rendicionPadre
        @JsonIgnore
        @ManyToOne
        @JoinColumn(name = "id_rendicion_padre")
        private RendicionPropietario rendicionPadre;

        @Column(name = "mes_ano", length = 20)
        private String mesAno;

        @Column(name = "fecha_render")
        private LocalDate fechaRender;

        @Column(name = "estado", length = 50)
        private String estado;

        @Column(name = "total_neto", precision = 12, scale = 2)
        private BigDecimal totalNeto;

        @Column(name = "comprobante", length = 50)
        private String comprobante;
    }
}
