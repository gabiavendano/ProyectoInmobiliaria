package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.Persona;
import com.inmobiliaria.backend.repository.PersonaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class PersonaService {

    // @Autowired le pide a Spring que inyecte este objeto automáticamente
    @Autowired
    private PersonaRepository repo;

    public List<Persona> listarTodos() {
        return repo.findAll(); // SELECT * FROM Personas
    }

    public Optional<Persona> buscarPorId(Integer id) {
        return repo.findById(id); // SELECT * FROM Personas WHERE id = ?
    }

    public Persona guardar(Persona p) {
        return repo.save(p); // INSERT o UPDATE según si tiene id o no
    }

    public void eliminar(Integer id) {
        repo.deleteById(id); // DELETE FROM Personas WHERE id = ?
    }
}