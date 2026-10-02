package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.InquilinoContratoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class InquilinoContratoService {

    @Autowired
    private InquilinoContratoRepository repo;

    public List<InquilinoContrato> listarTodos() {
        return repo.findAll();
    }

    public List<InquilinoContrato> listarPorRendicion(Integer idRendicion) {
        return repo.findByRendicionIdRendicion(idRendicion);
    }

    public List<InquilinoContrato> listarPorPropiedad(Integer idPropiedad) {
        return repo.findByPropiedadIdPropiedadOrderByNombreInquilinoAsc(idPropiedad);
    }

    public Optional<InquilinoContrato> buscarPorPropiedadYNombre(Integer idPropiedad, String nombreInquilino) {
        return repo.findByPropiedadIdPropiedadAndNombreInquilino(idPropiedad, nombreInquilino);
    }

    public List<InquilinoContrato> listarPorContrato(Integer idOperacion) {
        return repo.findByContratoOperacionIdOperacion(idOperacion);
    }

    public InquilinoContrato guardar(InquilinoContrato i) {
        return repo.save(i);
    }

    public void eliminar(Integer id) {
        repo.deleteById(id);
    }

    public InquilinoContrato crearInquilinoContrato(
            Integer idRendicion, Integer idPropiedad, String nombreInquilino,
            Integer idContratoOperacion, BigDecimal montoBaseRenta,
            String indiceAjuste, String tipoAjuste, LocalDate proximoAumento,
            BigDecimal deudaSaldo, BigDecimal serviciosImportados) {

        InquilinoContrato i = new InquilinoContrato();
        i.setRendicion(new RendicionPropietario());
        i.getRendicion().setIdRendicion(idRendicion);
        i.setPropiedad(new Propiedad());
        i.getPropiedad().setIdPropiedad(idPropiedad);
        i.setNombreInquilino(nombreInquilino);
        if (idContratoOperacion != null) {
            i.setContratoOperacion(new ContratoOperacion());
            i.getContratoOperacion().setIdOperacion(idContratoOperacion);
        }
        i.setMontoBaseRenta(montoBaseRenta);
        i.setIndiceAjuste(indiceAjuste);
        i.setTipoAjuste(tipoAjuste);
        i.setProximoAumento(proximoAumento);
        i.setDeudaSaldo(deudaSaldo != null ? deudaSaldo : BigDecimal.ZERO);
        i.setServiciosImportados(serviciosImportados != null ? serviciosImportados : BigDecimal.ZERO);

        return repo.save(i);
    }
}
