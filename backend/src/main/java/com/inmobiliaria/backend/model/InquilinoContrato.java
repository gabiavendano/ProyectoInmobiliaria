package com.inmobiliaria.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "Inquilinos_Contratos")
public class InquilinoContrato {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_inquilino_contrato")
    private Integer idInquilinoContrato;

    @ManyToOne
    @JoinColumn(name = "id_rendicion")
    private RendicionPropietario rendicion;

    @ManyToOne
    @JoinColumn(name = "id_propiedad")
    private Propiedad propiedad;

    @Column(name = "nombre_inquilino", nullable = false, length = 100)
    private String nombreInquilino;

    @OneToOne
    @JoinColumn(name = "id_contrato_operacion")
    private ContratoOperacion contratoOperacion;

    // Monto base del contrato
    @Column(name = "monto_base_renta", precision = 12, scale = 2)
    private BigDecimal montoBaseRenta;

    @Column(name = "indice_ajuste", length = 20)
    private String indiceAjuste;

    @Column(name = "tipo_ajuste", length = 50)
    private String tipoAjuste;

    @Column(name = "proximo_aumento")
    private LocalDate proximoAumento;

    // Deudas del inquilino
    @Column(name = "deuda_saldo", precision = 12, scale = 2)
    private BigDecimal deudaSaldo;

    // Servicios prorrateados
    @Column(name = "servicios_importados", precision = 12, scale = 2)
    private BigDecimal serviciosImportados;
}
