package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.CargoServicio;
import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.repository.CargoServicioRepository;
import com.inmobiliaria.backend.repository.ContratoRepository;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Carga de servicios y expensas por unidad (prorrateo) para cobrar junto con el alquiler. */
@Service
public class CargoServicioService {

    @Autowired private CargoServicioRepository repo;
    @Autowired private PropiedadRepository propiedadRepo;
    @Autowired private ContratoRepository contratoRepo;

    public List<CargoServicio> listar(String estado) {
        List<CargoServicio> todos = repo.findAll();
        if (estado == null || estado.isBlank()) return todos;
        return todos.stream().filter(c -> estado.equals(c.getEstado())).toList();
    }

    /** Un alquiler vigente (no temporario) sobre la propiedad: es a quien se le cobra el cargo. */
    private boolean tieneAlquilerVigente(Integer idPropiedad) {
        return contratoRepo.findByPropiedadIdPropiedad(idPropiedad).stream().anyMatch(c ->
            c.getTipoContrato() == ContratoOperacion.TipoContrato.Locacion
                && c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Vigente
                && c.getTempCheckIn() == null);
    }

    /**
     * data: { periodoMesAnio: "2026-09", items: [ { idPropiedad, concepto, monto, medicion?, unidadMedida?, observaciones? } ] }
     * Todo o nada: si un renglón es inválido no se guarda ninguno.
     */
    @SuppressWarnings("unchecked")
    @Transactional
    public List<CargoServicio> crearLote(Map<String, Object> data) {
        String periodo = (String) data.get("periodoMesAnio");
        if (periodo == null || !periodo.matches("\\d{4}-(0[1-9]|1[0-2])"))
            throw new IllegalArgumentException("El período debe tener formato AAAA-MM (ej: 2026-09).");
        Object raw = data.get("items");
        if (!(raw instanceof List<?> lista) || lista.isEmpty())
            throw new IllegalArgumentException("No hay cargos para guardar.");
        List<CargoServicio> out = new ArrayList<>();
        for (Object o : lista) {
            Map<String, Object> it = (Map<String, Object>) o;
            Integer idProp;
            try { idProp = Integer.parseInt(String.valueOf(it.get("idPropiedad"))); }
            catch (Exception e) { throw new IllegalArgumentException("Falta la unidad en uno de los cargos."); }
            Propiedad p = propiedadRepo.findById(idProp).orElseThrow(() -> new IllegalArgumentException("Propiedad no encontrada: " + idProp));
            String concepto = it.get("concepto") == null ? "" : it.get("concepto").toString().trim();
            if (concepto.isEmpty()) throw new IllegalArgumentException("Cada cargo necesita un concepto (Luz, Agua, Expensas...).");
            BigDecimal monto;
            try { monto = new BigDecimal(String.valueOf(it.get("monto"))).setScale(2, RoundingMode.HALF_UP); }
            catch (Exception e) { throw new IllegalArgumentException("Monto inválido en \"" + concepto + "\"."); }
            if (monto.signum() <= 0) throw new IllegalArgumentException("El monto de \"" + concepto + "\" debe ser mayor a cero.");
            if (!tieneAlquilerVigente(idProp))
                throw new IllegalStateException("\"" + p.getTitulo() + "\" no tiene un alquiler vigente al que cobrarle el cargo.");
            CargoServicio c = new CargoServicio();
            c.setPropiedad(p);
            c.setConcepto(concepto.length() > 100 ? concepto.substring(0, 100) : concepto);
            c.setPeriodoMesAnio(periodo);
            c.setMonto(monto);
            if (it.get("medicion") != null && !it.get("medicion").toString().isBlank()) {
                try { c.setMedicion(new BigDecimal(it.get("medicion").toString())); } catch (Exception ignorada) { /* medición opcional */ }
            }
            if (it.get("unidadMedida") != null) c.setUnidadMedida(it.get("unidadMedida").toString());
            if (it.get("observaciones") != null) c.setObservaciones(it.get("observaciones").toString());
            out.add(c);
        }
        return repo.saveAll(out);
    }

    @Transactional
    public CargoServicio anular(Integer id) {
        CargoServicio c = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("Cargo no encontrado."));
        if (!"Pendiente".equals(c.getEstado()))
            throw new IllegalStateException("Solo se puede anular un cargo pendiente (estado: " + c.getEstado() + "). Si ya se cobró, anulá el cobro.");
        c.setEstado("Anulado");
        return repo.save(c);
    }
}
