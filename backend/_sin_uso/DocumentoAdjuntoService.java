package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.ContratoOperacion;
import com.inmobiliaria.backend.model.DocumentoAdjunto;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.repository.DocumentoAdjuntoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class DocumentoAdjuntoService {

    @Autowired
    private DocumentoAdjuntoRepository repo;

    public List<DocumentoAdjunto> listarPorContrato(Integer idOperacion) {
        return repo.findByContratoIdOperacionOrderByFechaSubidaDesc(idOperacion);
    }

    public List<DocumentoAdjunto> listarPorPropiedad(Integer idPropiedad) {
        return repo.findByPropiedadIdPropiedadOrderByFechaSubidaDesc(idPropiedad);
    }

    public DocumentoAdjunto guardar(DocumentoAdjunto d) {
        if (d.getFechaSubida() == null) {
            d.setFechaSubida(LocalDateTime.now());
        }
        return repo.save(d);
    }

    @Transactional
    public void eliminar(Integer id) {
        repo.deleteById(id);
    }

    public DocumentoAdjunto crearDocumento(
            Integer idOperacion, Integer idPropiedad,
            String nombreOriginal, String tipoArchivo,
            String rutaAlmacenamiento, String descripcion) {

        DocumentoAdjunto d = new DocumentoAdjunto();
        if (idOperacion != null) {
            d.setContrato(new ContratoOperacion());
            d.getContrato().setIdOperacion(idOperacion);
        }
        if (idPropiedad != null) {
            d.setPropiedad(new Propiedad());
            d.getPropiedad().setIdPropiedad(idPropiedad);
        }
        d.setNombreOriginal(nombreOriginal);
        d.setTipoArchivo(tipoArchivo);
        d.setRutaAlmacenamiento(rutaAlmacenamiento);
        d.setDescripcion(descripcion);
        d.setFechaSubida(LocalDateTime.now());

        return repo.save(d);
    }
}
