package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.PersonaRepository;
import com.inmobiliaria.backend.repository.RendicionPropietarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
public class RendicionPropietarioService {

    @Autowired
    private RendicionPropietarioRepository repo;

    @Autowired
    private PersonaRepository personaRepo;

    @Autowired
    private InquilinoContratoService inquilinoContratoService;

    @Autowired
    private MovimientoFinancieroService movimientoService;

    public List<RendicionPropietario> listarTodos() {
        return repo.findAll();
    }

    public List<RendicionPropietario> listarPorPropietario(Integer idPersona) {
        return repo.findByPropietarioIdPersonaOrderByFechaRenderDesc(idPersona);
    }

    public RendicionPropietario guardar(RendicionPropietario r) {
        return repo.save(r);
    }

    @Transactional
    public RendicionPropietario crearRendicion(Integer idPropietario, String mesAno) {
        if (mesAno == null || !mesAno.matches("\\d{4}-(0[1-9]|1[0-2])")) {
            throw new IllegalArgumentException("El mes de la rendición es obligatorio y debe tener formato AAAA-MM (ej: 2026-09).");
        }
        Persona propietario = personaRepo.findById(idPropietario)
            .orElseThrow(() -> new IllegalArgumentException("Propietario no encontrado: " + idPropietario));
        RendicionPropietario r = new RendicionPropietario();
        r.setPropietario(propietario);
        r.setMesAno(mesAno);
        r.setFechaRender(LocalDate.now());
        r.setTotalNeto(BigDecimal.ZERO);   // se acumula al agregar rendiciones mensuales
        return repo.save(r);
    }

    @Transactional
    public RendicionPropietario.RendicionHistorial agregarRendicionMensual(
            Integer idRendicion, Integer idPropiedad, String nombrePropiedad,
            String nombreInquilino, BigDecimal montoAlquiler,
            String concepto, BigDecimal servicios, BigDecimal descuentos,
            String estado, String comprobante, String mesAno) {

        RendicionPropietario r = repo.findById(idRendicion)
            .orElseThrow(() -> new IllegalArgumentException("Rendición no encontrada"));

        RendicionPropietario.RendicionHistorial h = new RendicionPropietario.RendicionHistorial();
        h.setRendicionPadre(r);
        h.setMesAno(mesAno);
        h.setFechaRender(LocalDate.now());
        h.setEstado(estado);
        h.setComprobante(comprobante);

        BigDecimal total = montoAlquiler != null ? montoAlquiler : BigDecimal.ZERO;
        total = total.subtract(servicios != null ? servicios : BigDecimal.ZERO);
        total = total.subtract(descuentos != null ? descuentos : BigDecimal.ZERO);
        h.setTotalNeto(total);

        r.getHistorial().add(h);
        BigDecimal acumulado = r.getTotalNeto() != null ? r.getTotalNeto() : BigDecimal.ZERO;
        r.setTotalNeto(acumulado.add(total));

        return h;
    }

    @Transactional
    public void eliminar(Integer id) {
        repo.deleteById(id);
    }
}
