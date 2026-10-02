package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.InquilinoContrato;
import com.inmobiliaria.backend.service.InquilinoContratoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inquilinos-contratos")
public class InquilinoContratoController {

    @Autowired
    private InquilinoContratoService service;

    @GetMapping
    public List<InquilinoContrato> listarTodos() {
        return service.listarTodos();
    }

    @GetMapping("/rendicion/{id}")
    public List<InquilinoContrato> listarPorRendicion(@PathVariable Integer id) {
        return service.listarPorRendicion(id);
    }

    @GetMapping("/propiedad/{id}")
    public List<InquilinoContrato> listarPorPropiedad(@PathVariable Integer id) {
        return service.listarPorPropiedad(id);
    }

    @GetMapping("/propiedad/{idProp}/{nombreInquilino}")
    public ResponseEntity<?> buscar(@PathVariable Integer idProp,
                                     @PathVariable String nombreInquilino) {
        try {
            return service.buscarPorPropiedadYNombre(idProp, nombreInquilino)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @GetMapping("/contrato/{id}")
    public List<InquilinoContrato> listarPorContrato(@PathVariable Integer id) {
        return service.listarPorContrato(id);
    }

    @PostMapping("/crear")
    public ResponseEntity<?> crear(@RequestBody Map<String, Object> data) {
        try {
            Integer idRendicion       = data.get("idRendicion") != null
                ? Integer.parseInt(data.get("idRendicion").toString()) : null;
            Integer idPropiedad       = data.get("idPropiedad") != null
                ? Integer.parseInt(data.get("idPropiedad").toString()) : null;
            String nombreInquilino    = (String) data.get("nombreInquilino");
            Integer idContratoOp      = data.get("idContratoOperacion") != null
                ? Integer.parseInt(data.get("idContratoOperacion").toString()) : null;
            BigDecimal montoBaseRenta = data.get("montoBaseRenta") != null
                ? new BigDecimal(data.get("montoBaseRenta").toString()) : null;
            String indiceAjuste       = (String) data.get("indiceAjuste");
            String tipoAjuste         = (String) data.get("tipoAjuste");
            LocalDate proximoAumento  = data.get("proximoAumento") != null
                ? LocalDate.parse(data.get("proximoAumento").toString()) : null;
            BigDecimal deudaSaldo     = data.get("deudaSaldo") != null
                ? new BigDecimal(data.get("deudaSaldo").toString()) : null;
            BigDecimal serviciosImportados = data.get("serviciosImportados") != null
                ? new BigDecimal(data.get("serviciosImportados").toString()) : null;

            InquilinoContrato i = service.crearInquilinoContrato(
                idRendicion, idPropiedad, nombreInquilino,
                idContratoOp, montoBaseRenta,
                indiceAjuste, tipoAjuste, proximoAumento,
                deudaSaldo, serviciosImportados);

            return ResponseEntity.ok(i);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", com.inmobiliaria.backend.config.Errores.msg(e)));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Integer id) {
        service.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}
