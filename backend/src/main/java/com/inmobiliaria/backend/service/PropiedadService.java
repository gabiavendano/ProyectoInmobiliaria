package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.repository.PropiedadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class PropiedadService {

    @Autowired
    private PropiedadRepository repo;

    public List<Propiedad> listarTodos()              { return repo.findAll(); }
    public Optional<Propiedad> buscarPorId(Integer id) { return repo.findById(id); }
    public Propiedad guardar(Propiedad p)              { return repo.save(p); }
    public void eliminar(Integer id)                   { repo.deleteById(id); }
}