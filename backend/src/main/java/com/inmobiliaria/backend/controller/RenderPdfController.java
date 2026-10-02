package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.RendicionPropietario;
import com.inmobiliaria.backend.service.RendicionPropietarioService;
import com.inmobiliaria.backend.service.InquilinoContratoService;
import com.inmobiliaria.backend.service.PropiedadService;
import com.inmobiliaria.backend.service.PersonaService;
import com.inmobiliaria.backend.repository.RendicionPropietarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/render-pdf")
public class RenderPdfController {

    @Autowired
    private RendicionPropietarioService rendicionService;

    @Autowired
    private RendicionPropietarioRepository rendicionRepo;

    @Autowired
    private InquilinoContratoService inquilinoContratoService;

    @Autowired
    private PropiedadService propiedadService;

    @Autowired
    private PersonaService personaService;

    // ── PDF de rendición mensual ────────────────────────────────────────────
    // Generación de PDF deshabilitada temporalmente (iText 7 no disponible).
    // Para habilitar: agregar com.itextpdf:itext7-core al pom.xml y
    // restaurar el código original que usa PdfWriter, PdfDocument, Document,
    // Paragraph, Table, Cell, ColorConstants, etc.

    @GetMapping("/rendicion/{id}")
    public ResponseEntity<byte[]> previewRendicion(@PathVariable Integer id) {
        // Placeholder: devuelve 501 Not Implemented hasta que se agregue iText 7
        return ResponseEntity.status(501).body(null);
    }

    // ── PDF de recibo de alquiler ──────────────────────────────────────────
    // Generación de PDF deshabilitada temporalmente (iText 7 no disponible).
    // Igual que el endpoint anterior, requiere iText 7 para generar el PDF.

    @GetMapping("/recibo/{idPropiedad}/{idInquilino}")
    public ResponseEntity<byte[]> previewRecibo(
            @PathVariable Integer idPropiedad,
            @PathVariable Integer idInquilino) {
        // Placeholder: devuelve 501 Not Implemented hasta que se agregue iText 7
        return ResponseEntity.status(501).body(null);
    }
}
