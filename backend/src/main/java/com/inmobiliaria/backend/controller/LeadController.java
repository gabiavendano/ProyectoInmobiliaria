package com.inmobiliaria.backend.controller;

import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.model.UsuarioAutenticacion;
import com.inmobiliaria.backend.service.LeadService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Leads web (solo AGENTE / ADMIN, ver SecurityConfig). */
@RestController
@RequestMapping("/api/leads")
public class LeadController {

    @Autowired private LeadService service;

    @GetMapping
    public List<Map<String, Object>> listar() {
        return service.listar();
    }

    @PostMapping("/{idUsuario}/convertir")
    public Map<String, Object> convertir(@PathVariable Integer idUsuario, @RequestBody Map<String, Object> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String agente = (auth != null && auth.getPrincipal() instanceof UsuarioAutenticacion)
            ? ((UsuarioAutenticacion) auth.getPrincipal()).getNombreCompleto() : null;
        String dni = body.get("dni") instanceof String ? (String) body.get("dni") : null;
        String tel = body.get("telefono") instanceof String ? (String) body.get("telefono") : null;

        Persona p = service.convertir(idUsuario, dni, tel, agente);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("idPersona", p.getIdPersona());
        out.put("nombreCompleto", p.getNombreCompleto());
        out.put("dniCuit", p.getDniCuit());
        return out;
    }
}
