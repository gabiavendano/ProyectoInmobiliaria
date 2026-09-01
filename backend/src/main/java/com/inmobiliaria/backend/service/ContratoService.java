package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
public class ContratoService {

    @Autowired private ContratoRepository contratoRepo;
    @Autowired private PropiedadRepository propiedadRepo;
    @Autowired private LiquidacionRepository liquidacionRepo;
    @Autowired private AuditoriaService auditoria;

    // @Transactional: si algo falla en el medio, deshace todo (como un rollback)
    @Transactional
    public ContratoOperacion crearContrato(ContratoOperacion contrato) {

        Integer idInquilino = contrato.getCompradorInquilino().getIdPersona();
        Integer idPropiedad = contrato.getPropiedad().getIdPropiedad();

        // Módulo 1: validaciones de auditoría
        auditoria.validarEstadoBcra(idInquilino);
        auditoria.validarNoInhibido(idInquilino);
        auditoria.validarLegajosPropiedad(idPropiedad);

        // Módulo 2: reglas DNU 70/2023
        if (contrato.getMonedaOperacion() == ContratoOperacion.Moneda.USD) {
            // En dólares no se aplica ajuste
            contrato.setIndiceAjuste(ContratoOperacion.IndiceAjuste.Ninguno);
            contrato.setFrecuenciaAjusteMeses(null);
        } else {
            // En pesos es obligatorio el índice y la frecuencia
            if (contrato.getIndiceAjuste() == null ||
                contrato.getIndiceAjuste() == ContratoOperacion.IndiceAjuste.Ninguno) {
                throw new IllegalStateException(
                    "Contratos en ARS requieren índice de ajuste (ICL o IPC) según DNU 70/2023."
                );
            }
            if (contrato.getFrecuenciaAjusteMeses() == null || contrato.getFrecuenciaAjusteMeses() <= 0) {
                throw new IllegalStateException(
                    "Contratos en ARS requieren frecuencia de ajuste en meses."
                );
            }
        }

        ContratoOperacion guardado = contratoRepo.save(contrato);

        // Módulo 5: trigger — cambiar estado de la propiedad automáticamente
        Propiedad prop = propiedadRepo.findById(idPropiedad).orElseThrow();
        switch (contrato.getTipoContrato()) {
            case Locacion    -> prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Alquilada);
            case Compraventa -> prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Vendida);
            case Permuta     -> prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Permutada);
        }
        propiedadRepo.save(prop);

        return guardado;
    }

    @Transactional
    public LiquidacionMensual registrarLiquidacion(LiquidacionMensual liq) {

        ContratoOperacion contrato = contratoRepo
            .findById(liq.getContrato().getIdOperacion())
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));

        // Módulo 3: calcular días de atraso y mora
        BigDecimal mora = BigDecimal.ZERO;
        int diasAtraso = 0;

        if (liq.getFechaPagoReal().isAfter(liq.getFechaVencimiento())) {
            diasAtraso = (int) java.time.temporal.ChronoUnit.DAYS.between(
                liq.getFechaVencimiento(), liq.getFechaPagoReal()
            );
            // mora = dias x tasa diaria x base (todo BigDecimal, sin double)
            mora = new BigDecimal(diasAtraso)
                .multiply(contrato.getInterestMoraDiario())
                .multiply(liq.getMontoAlquilerBase())
                .setScale(2, RoundingMode.HALF_UP);
        }

        liq.setDiasAtraso(diasAtraso);
        liq.setMontoMoraCalculado(mora);

        // Total cobrado al inquilino
        BigDecimal total = liq.getMontoAlquilerBase().add(mora);
        liq.setTotalAbonadoInquilino(total);

        // Módulo 4: co-corretaje
        boolean esCoCorretaje = Boolean.TRUE.equals(contrato.getEsCoCorretaje());
        liq.setEsCoCorretajeMensual(esCoCorretaje);

        BigDecimal comision = liq.getMontoAlquilerBase()
            .multiply(liq.getPorcentajeHonorariosAdministracion())
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        // Si hay co-corretaje, la comisión se divide entre dos
        BigDecimal comisionRetenida = esCoCorretaje
            ? comision.divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP)
            : comision;

        liq.setMontoComisionInmobiliaria(comisionRetenida);
        liq.setMontoNetoARendir(total.subtract(comisionRetenida));

        return liquidacionRepo.save(liq);
    }

    // Módulo 5: cierre de venta — transfiere la propiedad al comprador
    @Transactional
    public void cerrarVenta(Integer idOperacion) {
        ContratoOperacion contrato = contratoRepo.findById(idOperacion)
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        if (contrato.getTipoContrato() != ContratoOperacion.TipoContrato.Compraventa) {
            throw new IllegalStateException("El contrato no es una Compraventa.");
        }
        Propiedad prop = contrato.getPropiedad();
        prop.setIdPropietarioActualId(contrato.getCompradorInquilino().getIdPersona());
        prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Vendida);
        propiedadRepo.save(prop);
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Finalizado);
        contratoRepo.save(contrato);
    }

    // Módulo 6: rescindir sin borrar — solo cambia el estado
    @Transactional
    public ContratoOperacion rescindirContrato(Integer idOperacion) {
        ContratoOperacion contrato = contratoRepo.findById(idOperacion)
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Rescindido);
        Propiedad prop = contrato.getPropiedad();
        prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        propiedadRepo.save(prop);
        return contratoRepo.save(contrato);
    }

    public List<ContratoOperacion> listarTodos()               { return contratoRepo.findAll(); }
    public Optional<ContratoOperacion> buscarPorId(Integer id) { return contratoRepo.findById(id); }
    public List<LiquidacionMensual> listarLiquidaciones(Integer id) {
        return liquidacionRepo.findByContratoIdOperacion(id);
    }
}