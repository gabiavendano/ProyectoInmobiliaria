package com.inmobiliaria.backend.config;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    // Contraseña inicial del admin. Definila con la variable de entorno ADMIN_INITIAL_PASSWORD.
    // Si no la definís, se genera una aleatoria y se imprime UNA vez en el log al arrancar.
    @Value("${app.seed.admin-password:}")
    private String adminPasswordConfigurada;

    // app.seed.enabled=false evita crear datos de ejemplo (usalo en producción)
    @Value("${app.seed.enabled:true}")
    private boolean seedHabilitado;

    @Autowired
    private PropiedadRepository propiedadRepo;

    @Autowired
    private PersonaRepository personaRepo;

    @Autowired
    private ContratoRepository contratoRepo;

    @Autowired
    private UsuarioAutenticacionRepository usuarioRepo;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (!seedHabilitado) return;
        if (usuarioRepo.count() > 0) return; // ya hay datos

        // ── 1. USUARIO ADMIN ──────────────────────────────────────────────
        UsuarioAutenticacion admin = new UsuarioAutenticacion();
        admin.setUsername("admin");
        String adminPassword = adminPasswordConfigurada;
        if (adminPassword == null || adminPassword.isBlank()) {
            adminPassword = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 14);
            log.warn("==========================================================");
            log.warn(" Usuario admin creado. Contraseña inicial: {}", adminPassword);
            log.warn(" (guardala ahora: no se vuelve a mostrar)");
            log.warn("==========================================================");
        }
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setNombreCompleto("Administrador");
        admin.setIniciales("AD");
        admin.setRol(UsuarioAutenticacion.Rol.ADMIN);
        admin.setActivo(true);
        usuarioRepo.save(admin);

        // ── 2. PERSONAS DE EJEMPLO ────────────────────────────────────────
        Persona propietario1 = new Persona();
        propietario1.setNombreCompleto("María González");
        propietario1.setDniCuit("27334445558");
        propietario1.setTelefono("3541557179");
        propietario1.setEmail("maria.gonzalez@email.com");
        propietario1.setRolPrincipal(Persona.RolPrincipal.Propietario);
        propietario1.setEstadoBcra(1);
        propietario1.setInhibido(false);
        personaRepo.save(propietario1);

        Persona propietario2 = new Persona();
        propietario2.setNombreCompleto("Inversiones Vallegrande S.A.");
        propietario2.setDniCuit("30345678901");
        propietario2.setEmail("contacto@vallegrande.com");
        propietario2.setRolPrincipal(Persona.RolPrincipal.Propietario);
        propietario2.setEstadoBcra(1);
        personaRepo.save(propietario2);

        Persona inquilino1 = new Persona();
        inquilino1.setNombreCompleto("Martín Gómez");
        inquilino1.setDniCuit("23456789");
        inquilino1.setTelefono("3541123456");
        inquilino1.setEmail("martin.gomez@email.com");
        inquilino1.setRolPrincipal(Persona.RolPrincipal.Inquilino);
        inquilino1.setEstadoBcra(1);
        inquilino1.setInhibido(false);
        personaRepo.save(inquilino1);

        Persona inquilino2 = new Persona();
        inquilino2.setNombreCompleto("Lucía Pérez");
        inquilino2.setDniCuit("24567890");
        inquilino2.setTelefono("3541987654");
        inquilino2.setEmail("lucia.perez@email.com");
        inquilino2.setRolPrincipal(Persona.RolPrincipal.Inquilino);
        inquilino2.setEstadoBcra(1);
        inquilino2.setInhibido(false);
        personaRepo.save(inquilino2);

        Persona colega1 = new Persona();
        colega1.setNombreCompleto("Lic. Avendaño");
        colega1.setDniCuit("27123456");
        colega1.setTelefono("3541555555");
        colega1.setEmail("lic.avendano@inmobiliaria.com");
        colega1.setRolPrincipal(Persona.RolPrincipal.Colega);
        personaRepo.save(colega1);

        // ── 3. PROPIEDADES DE EJEMPLO ─────────────────────────────────────
        Propiedad prop1 = new Propiedad();
        prop1.setTitulo("Exclusivo Chalet Céntrico de Categoría");
        prop1.setDescripcion("Extraordinario chalet de estilo moderno ubicado en el corazón neurálgico de Villa Carlos Paz...");
        prop1.setTipoInmueble(Propiedad.TipoInmueble.Casa);
        prop1.setTipoOperacion(Propiedad.TipoOperacion.Venta);
        prop1.setPrecio(new BigDecimal("120000.00"));
        prop1.setMoneda(Propiedad.Moneda.USD);
        prop1.setSuperficieTotalM2(450);
        prop1.setCantDormitorios(3);
        prop1.setCantBanos(2);
        prop1.setTieneGarage(true);
        prop1.setTienePileta(true);
        prop1.setTieneAsador(true);
        prop1.setTieneGasNatural(true);
        prop1.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        prop1.setPropietarioActual(propietario1);
        prop1.setLatitud(-31.4180);
        prop1.setLongitud(-64.4990);
        prop1.setZona("Centro");
        prop1.setPriceStr("U$S 120.000");
        prop1.setAgent("Lic. Avendaño");
        prop1.setShowExactLocation(true);
        prop1.setDateAdded(LocalDate.of(2023, 10, 1));
        prop1.setFotosFromUrls(Arrays.asList(
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ));
        prop1.setAmenities(Arrays.asList("Pileta", "Cochera", "Asador", "Gas Natural"));
        prop1.setProvincia("Córdoba");
        prop1.setLocalidad("Villa Carlos Paz");
        prop1.setCalle("Pedro Justo Besano");
        prop1.setNumero("1500");
        prop1.setSuperficieTotalM2(450);
        prop1.setCaractUbicacion(Arrays.asList("Frente a avenida", "Primera línea"));
        propiedadRepo.save(prop1);

        Propiedad prop2 = new Propiedad();
        prop2.setTitulo("Departamento Premium Frente al Lago");
        prop2.setDescripcion("Moderno departamento totalmente equipado en Costa Azul con vista panorámica al Lago San Roque...");
        prop2.setTipoInmueble(Propiedad.TipoInmueble.Departamento);
        prop2.setTipoOperacion(Propiedad.TipoOperacion.AlquilerTemporario);
        prop2.setPrecio(new BigDecimal("55000.00"));
        prop2.setMoneda(Propiedad.Moneda.ARS);
        prop2.setSuperficieTotalM2(75);
        prop2.setCantDormitorios(2);
        prop2.setCantBanos(1);
        prop2.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        prop2.setPropietarioActual(propietario2);
        prop2.setLatitud(-31.4050);
        prop2.setLongitud(-64.4800);
        prop2.setZona("Costa Azul");
        prop2.setPriceStr("$ 55.000 / noche");
        prop2.setAgent("Martillero Flores");
        prop2.setShowExactLocation(false);
        prop2.setDateAdded(LocalDate.of(2023, 10, 15));
        prop2.setFotosFromUrls(Arrays.asList(
            "https://images.unsplash.com/photo-1502672260266-1c1f5523a5d1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ));
        prop2.setAmenities(Arrays.asList("Pileta", "Cochera", "Vista al Lago", "Amoblado"));
        prop2.setProvincia("Córdoba");
        prop2.setLocalidad("Villa Carlos Paz");
        prop2.setBarrio("Costa Azul");
        prop2.setCaractUbicacion(Arrays.asList("Frente al agua", "Excelente luminosidad"));
        propiedadRepo.save(prop2);

        Propiedad prop3 = new Propiedad();
        prop3.setTitulo("Clásica Casa Familiar en Barrio Residencial");
        prop3.setDescripcion("Amplia y sólida residencia disponible para contrato de alquiler anual (36 meses)...");
        prop3.setTipoInmueble(Propiedad.TipoInmueble.Casa);
        prop3.setTipoOperacion(Propiedad.TipoOperacion.AlquilerPermanente);
        prop3.setPrecio(new BigDecimal("420000.00"));
        prop3.setMoneda(Propiedad.Moneda.ARS);
        prop3.setSuperficieTotalM2(220);
        prop3.setCantDormitorios(4);
        prop3.setCantBanos(3);
        prop3.setTieneGarage(true);
        prop3.setTieneAsador(true);
        prop3.setTieneGasNatural(true);
        prop3.setEstadoPropiedad(Propiedad.EstadoPropiedad.Alquilada);
        prop3.setPropietarioActual(propietario1);
        prop3.setLatitud(-31.4350);
        prop3.setLongitud(-64.5100);
        prop3.setZona("San Antonio");
        prop3.setPriceStr("$ 420.000 / mes");
        prop3.setAgent("Asesor Toledo");
        prop3.setShowExactLocation(true);
        prop3.setDateAdded(LocalDate.of(2023, 9, 20));
        prop3.setAmenities(Arrays.asList("Cochera", "Asador", "Gas Natural"));
        prop3.setProvincia("Córdoba");
        prop3.setLocalidad("Villa Carlos Paz");
        prop3.setBarrio("San Antonio");
        propiedadRepo.save(prop3);

        Propiedad prop4 = new Propiedad();
        prop4.setTitulo("Lote Apto Dúplex con Vista Panorámica");
        prop4.setDescripcion("Inmejorable oportunidad de inversión en Villa del Lago...");
        prop4.setTipoInmueble(Propiedad.TipoInmueble.Terreno);
        prop4.setTipoOperacion(Propiedad.TipoOperacion.Venta);
        prop4.setPrecio(new BigDecimal("48000.00"));
        prop4.setMoneda(Propiedad.Moneda.USD);
        prop4.setSuperficieTotalM2(950);
        prop4.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        prop4.setPropietarioActual(propietario2);
        prop4.setLatitud(-31.3900);
        prop4.setLongitud(-64.5100);
        prop4.setZona("Villa del Lago");
        prop4.setPriceStr("U$S 48.000");
        prop4.setAgent("Lic. Avendaño");
        prop4.setShowExactLocation(false);
        prop4.setDateAdded(LocalDate.of(2023, 10, 25));
        prop4.setFotosFromUrls(Arrays.asList(
            "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
        ));
        prop4.setAmenities(Arrays.asList("Vista al Lago"));
        prop4.setProvincia("Córdoba");
        prop4.setLocalidad("Villa Carlos Paz");
        prop4.setBarrio("Villa del Lago");
        propiedadRepo.save(prop4);

        Propiedad prop5 = new Propiedad();
        prop5.setTitulo("Depto 1 Dormitorio (Acepta Vehículo)");
        prop5.setDescripcion("Práctico y funcional departamento céntrico de 1 dormitorio...");
        prop5.setTipoInmueble(Propiedad.TipoInmueble.Departamento);
        prop5.setTipoOperacion(Propiedad.TipoOperacion.Permuta);
        prop5.setPrecio(new BigDecimal("55000.00"));
        prop5.setMoneda(Propiedad.Moneda.USD);
        prop5.setSuperficieTotalM2(45);
        prop5.setCantDormitorios(1);
        prop5.setCantBanos(1);
        prop5.setTieneGasNatural(true);
        prop5.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        prop5.setPropietarioActual(propietario1);
        prop5.setLatitud(-31.4215);
        prop5.setLongitud(-64.4985);
        prop5.setZona("Centro");
        prop5.setPriceStr("U$S 55.000");
        prop5.setAgent("Martillero Flores");
        prop5.setShowExactLocation(true);
        prop5.setDateAdded(LocalDate.of(2023, 11, 5));
        prop5.setFotosFromUrls(Arrays.asList(
            "https://images.unsplash.com/photo-1502672023488-70e25813eb80?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ));
        prop5.setAmenities(Arrays.asList("Gas Natural", "Amoblado"));
        prop5.setProvincia("Córdoba");
        prop5.setLocalidad("Villa Carlos Paz");
        prop5.setBarrio("Centro");
        propiedadRepo.save(prop5);

        // ── 4. CONTRATOS DE EJEMPLO ───────────────────────────────────────
        ContratoOperacion contrato1 = new ContratoOperacion();
        contrato1.setPropiedad(prop3);
        contrato1.setVendedorPropietario(propietario1);
        contrato1.setCompradorInquilino(inquilino1);
        contrato1.setTipoContrato(ContratoOperacion.TipoContrato.Locacion);
        contrato1.setFechaInicio(LocalDate.of(2024, 3, 1));
        contrato1.setFechaFin(LocalDate.of(2027, 2, 28));
        contrato1.setMontoTotalOperacion(new BigDecimal("420000.00"));
        contrato1.setMonedaOperacion(ContratoOperacion.Moneda.ARS);
        contrato1.setIndiceAjuste(ContratoOperacion.IndiceAjuste.ICL);
        contrato1.setFrecuenciaAjusteMeses(3);
        contrato1.setInterestMoraDiario(new BigDecimal("0.0005"));
        contrato1.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        contratoRepo.save(contrato1);

        // ── 5. USUARIOS EXTRA ──────────────────────────────────────────────
        UsuarioAutenticacion agente1 = new UsuarioAutenticacion();
        agente1.setUsername("agente1");
        agente1.setPassword(passwordEncoder.encode("agente123"));
        agente1.setNombreCompleto("Lic. Avendaño");
        agente1.setIniciales("LA");
        agente1.setRol(UsuarioAutenticacion.Rol.AGENTE);
        agente1.setActivo(true);
        usuarioRepo.save(agente1);

        UsuarioAutenticacion cliente1 = new UsuarioAutenticacion();
        cliente1.setUsername("cliente1");
        cliente1.setPassword(passwordEncoder.encode("cliente123"));
        cliente1.setNombreCompleto("Mariela Del Castillo");
        cliente1.setIniciales("MD");
        cliente1.setRol(UsuarioAutenticacion.Rol.CLIENTE);
        cliente1.setActivo(true);
        usuarioRepo.save(cliente1);
    }
}
