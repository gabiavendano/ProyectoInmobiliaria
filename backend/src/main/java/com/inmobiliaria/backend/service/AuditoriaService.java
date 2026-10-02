package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.repository.DocumentoAdjuntoRepository;
import com.inmobiliaria.backend.repository.PersonaRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

// Este service solo tiene validaciones.
// Si algo falla, lanza una excepción que el Controller convierte en error HTTP 400.
@Service
public class AuditoriaService {

    @Autowired private PersonaRepository personaRepo;
    @Autowired private PropiedadRepository propiedadRepo;
    @Autowired private DocumentoAdjuntoRepository documentoRepo;

    // Regla 1: estado BCRA debe ser 1 (Situación Normal)
    public void validarEstadoBcra(Integer idPersona) {
        Persona p = personaRepo.findById(idPersona)
            .orElseThrow(() -> new IllegalArgumentException("Persona no encontrada: " + idPersona));
        if (p.getEstadoBcra() != null && p.getEstadoBcra() >= 2) {
            throw new IllegalStateException(
                "RIESGO FINANCIERO: " + p.getNombreCompleto() +
                " tiene estado BCRA " + p.getEstadoBcra() + ". Solo se permite estado 1."
            );
        }
    }

    // Regla 2: la persona no puede estar inhibida judicialmente
    public void validarNoInhibido(Integer idPersona) {
        Persona p = personaRepo.findById(idPersona)
            .orElseThrow(() -> new IllegalArgumentException("Persona no encontrada: " + idPersona));
        if (Boolean.TRUE.equals(p.getInhibido())) {
            throw new IllegalStateException(
                "RIESGO LEGAL: " + p.getNombreCompleto() + " está inhibido judicialmente."
            );
        }
    }

    // Regla 3: la propiedad debe tener los documentos cargados
    public void validarLegajosPropiedad(Integer idPropiedad) {
        Propiedad prop = propiedadRepo.findById(idPropiedad)
            .orElseThrow(() -> new IllegalArgumentException("Propiedad no encontrada: " + idPropiedad));
        // Una unidad de un complejo usa la escritura / informe de dominio del complejo si no tiene los suyos
        Integer idDocs = prop.getIdComplejo() != null ? prop.getIdComplejo() : idPropiedad;
        Propiedad docsDe = prop.getIdComplejo() != null ? propiedadRepo.findById(prop.getIdComplejo()).orElse(prop) : prop;
        // Vale el PDF subido desde la ficha (tipo "Escritura" / "Informe de dominio") o, si no, el link cargado antes
        boolean escritura = documentoRepo.existsByPropiedadIdPropiedadAndTipoArchivo(idPropiedad, "Escritura")
            || documentoRepo.existsByPropiedadIdPropiedadAndTipoArchivo(idDocs, "Escritura")
            || (prop.getLinkEscrituraPdf() != null && !prop.getLinkEscrituraPdf().isBlank())
            || (docsDe.getLinkEscrituraPdf() != null && !docsDe.getLinkEscrituraPdf().isBlank());
        if (!escritura) {
            throw new IllegalStateException(
                "LEGAJO INCOMPLETO: La propiedad '" + prop.getTitulo() + "' no tiene escritura cargada. "
                + "Subí el PDF en la ficha de la propiedad (sección 13, tipo \"Escritura\")."
            );
        }
        boolean informe = documentoRepo.existsByPropiedadIdPropiedadAndTipoArchivo(idPropiedad, "Informe de dominio")
            || documentoRepo.existsByPropiedadIdPropiedadAndTipoArchivo(idDocs, "Informe de dominio")
            || (prop.getLinkInformeDominioPdf() != null && !prop.getLinkInformeDominioPdf().isBlank())
            || (docsDe.getLinkInformeDominioPdf() != null && !docsDe.getLinkInformeDominioPdf().isBlank());
        if (!informe) {
            throw new IllegalStateException(
                "LEGAJO INCOMPLETO: La propiedad '" + prop.getTitulo() + "' no tiene informe de dominio. "
                + "Subí el PDF en la ficha de la propiedad (sección 13, tipo \"Informe de dominio\")."
            );
        }
    }
}