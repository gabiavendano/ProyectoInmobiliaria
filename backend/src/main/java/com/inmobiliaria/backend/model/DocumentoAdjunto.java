package com.inmobiliaria.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "Documentos_Adjuntos")
public class DocumentoAdjunto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_documento")
    private Integer idDocumento;

    // @JsonIgnore: evita ciclos (Contrato → documentos → contrato) y proxies LAZY en el JSON.
    // El JSON expone solo los ids (ver getIdOperacion / getIdPropiedad).
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_contrato")
    private ContratoOperacion contrato;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_propiedad")
    private Propiedad propiedad;

    @Column(name = "nombre_original", length = 255, nullable = false)
    private String nombreOriginal;

    @Column(name = "tipo_archivo", length = 50)
    private String tipoArchivo;

    @Column(name = "ruta_almacenamiento", length = 500, nullable = false)
    private String rutaAlmacenamiento;

    @Column(name = "fecha_subida", nullable = false)
    private LocalDateTime fechaSubida = LocalDateTime.now();

    @Column(name = "descripcion", length = 255)
    private String descripcion;

    @JsonProperty("idOperacion")
    public Integer getIdOperacion() {
        return contrato != null ? contrato.getIdOperacion() : null;
    }

    @JsonProperty("idPropiedad")
    public Integer getIdPropiedad() {
        return propiedad != null ? propiedad.getIdPropiedad() : null;
    }
}
