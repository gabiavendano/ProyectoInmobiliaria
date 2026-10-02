package com.inmobiliaria.backend;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import com.inmobiliaria.backend.security.LimiteIntentos;
import com.inmobiliaria.backend.service.ArchivoPropiedadService;
import com.inmobiliaria.backend.service.PersonaService;
import com.inmobiliaria.backend.service.PropiedadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Validaciones de Persona y Propiedad (DNI/CUIT, borrado y baja) y límite de intentos de login. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ValidacionesYSeguridadTest {

    // ── Persona ───────────────────────────────────────────────────────────
    @Mock private PersonaRepository personaRepo;
    @Mock private NotaPersonaRepository notaRepo;
    @Mock private PropiedadRepository propiedadRepo;
    @Mock private ContratoRepository contratoRepo;
    @Mock private RendicionPropietarioRepository rendicionRepo;
    @Mock private MovimientoFinancieroRepository movimientoRepo;
    @InjectMocks private PersonaService personaService;

    private Persona persona(String dni) {
        Persona p = new Persona();
        p.setNombreCompleto("Ana Pérez");
        p.setDniCuit(dni);
        return p;
    }

    @BeforeEach
    void setUp() {
        when(personaRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(personaRepo.findByDniCuit(any())).thenReturn(Optional.empty());
    }

    @Test
    void persona_dniConPuntosSeGuardaSoloConNumeros() {
        Persona guardada = personaService.crear(persona("12.345.678"));
        assertEquals("12345678", guardada.getDniCuit());
    }

    @Test
    void persona_dniConLetrasSeRechaza() {
        assertThrows(IllegalArgumentException.class, () -> personaService.crear(persona("ABC123")));
    }

    @Test
    void persona_dniMuyCortoSeRechaza() {
        assertThrows(IllegalArgumentException.class, () -> personaService.crear(persona("123")));
    }

    @Test
    void persona_codigoUsrEstaReservado() {
        assertThrows(IllegalArgumentException.class, () -> personaService.crear(persona("USR-99")));
    }

    @Test
    void persona_usuarioWebConservaSuCodigoTecnicoAlEditar() {
        Persona actual = persona("USR-7");
        actual.setIdPersona(7);
        when(personaRepo.findById(7)).thenReturn(Optional.of(actual));
        Persona editada = persona("USR-7");
        assertTrue(personaService.actualizar(7, editada).isPresent());
    }

    @Test
    void persona_cuitDebeTenerOnceDigitos() {
        Persona p = persona("12345678");
        p.setCuitCuil("2012345");
        assertThrows(IllegalArgumentException.class, () -> personaService.crear(p));
        p.setCuitCuil("20-12345678-3");
        assertEquals("20123456783", personaService.crear(p).getCuitCuil());
    }

    @Test
    void persona_dniRepetidoSeRechaza() {
        Persona otra = persona("12345678");
        otra.setIdPersona(99);
        when(personaRepo.findByDniCuit("12345678")).thenReturn(Optional.of(otra));
        assertThrows(IllegalArgumentException.class, () -> personaService.crear(persona("12345678")));
    }

    @Test
    void persona_conContratosNoSePuedeEliminar() {
        when(personaRepo.existsById(5)).thenReturn(true);
        when(contratoRepo.contarPorPersona(5)).thenReturn(2L);
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> personaService.eliminar(5));
        assertTrue(e.getMessage().contains("contrato"));
        verify(personaRepo, never()).deleteById(anyInt());
    }

    @Test
    void persona_conPropiedadesNoSePuedeEliminar() {
        when(personaRepo.existsById(5)).thenReturn(true);
        when(propiedadRepo.existsByPropietarioActualIdPersona(5)).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> personaService.eliminar(5));
        verify(personaRepo, never()).deleteById(anyInt());
    }

    @Test
    void persona_sinNadaAsociadoSeElimina() {
        when(personaRepo.existsById(5)).thenReturn(true);
        personaService.eliminar(5);
        verify(personaRepo).deleteById(5);
    }

    // ── Propiedad ─────────────────────────────────────────────────────────
    @Mock private PropiedadRepository propRepo2;
    @Mock private ArchivoPropiedadService archivos;
    @Mock private MovimientoFinancieroRepository movRepo2;
    @Mock private ContratoRepository contratoRepo2;

    private PropiedadService nuevoServicioPropiedad() {
        PropiedadService s = new PropiedadService();
        org.springframework.test.util.ReflectionTestUtils.setField(s, "repo", propRepo2);
        org.springframework.test.util.ReflectionTestUtils.setField(s, "archivos", archivos);
        org.springframework.test.util.ReflectionTestUtils.setField(s, "contratoRepo", contratoRepo2);
        org.springframework.test.util.ReflectionTestUtils.setField(s, "movimientoRepo", movRepo2);
        return s;
    }

    private ContratoOperacion contratoEn(Integer idProp, ContratoOperacion.EstadoContrato estado) {
        ContratoOperacion c = new ContratoOperacion();
        c.setEstadoContrato(estado);
        Propiedad p = new Propiedad();
        p.setIdPropiedad(idProp);
        c.setPropiedad(p);
        return c;
    }

    @Test
    void propiedad_conContratoVigenteNoSeDaDeBaja() {
        Propiedad p = new Propiedad();
        p.setIdPropiedad(3);
        p.setEstadoPropiedad(Propiedad.EstadoPropiedad.Alquilada);
        when(propRepo2.findById(3)).thenReturn(Optional.of(p));
        when(contratoRepo2.findByPropiedadIdPropiedad(3))
            .thenReturn(List.of(contratoEn(3, ContratoOperacion.EstadoContrato.Vigente)));
        assertThrows(IllegalStateException.class, () -> nuevoServicioPropiedad().cambiarEstado(3, "Inactiva"));
        assertEquals(Propiedad.EstadoPropiedad.Alquilada, p.getEstadoPropiedad());
    }

    @Test
    void propiedad_sinContratosVigentesSePuedeDarDeBajaYReactivar() {
        Propiedad p = new Propiedad();
        p.setIdPropiedad(3);
        p.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
        when(propRepo2.findById(3)).thenReturn(Optional.of(p));
        when(propRepo2.save(any())).thenAnswer(i -> i.getArgument(0));
        when(contratoRepo2.findByPropiedadIdPropiedad(3))
            .thenReturn(List.of(contratoEn(3, ContratoOperacion.EstadoContrato.Finalizado)));
        PropiedadService s = nuevoServicioPropiedad();
        assertEquals(Propiedad.EstadoPropiedad.Inactiva, s.cambiarEstado(3, "Inactiva").orElseThrow().getEstadoPropiedad());
        assertEquals(Propiedad.EstadoPropiedad.Disponible, s.cambiarEstado(3, "Disponible").orElseThrow().getEstadoPropiedad());
    }

    @Test
    void propiedad_conContratosNoSeElimina() {
        when(contratoRepo2.findByPropiedadIdPropiedad(3))
            .thenReturn(List.of(contratoEn(3, ContratoOperacion.EstadoContrato.Finalizado)));
        assertThrows(IllegalStateException.class, () -> nuevoServicioPropiedad().eliminar(3));
        verify(archivos, never()).eliminarPropiedadConArchivos(anyInt());
    }

    // ── Límite de intentos ────────────────────────────────────────────────
    @Test
    void login_seBloqueaTrasCincoFallosYSeLimpiaConUnExito() {
        LimiteIntentos l = new LimiteIntentos();
        String k = LimiteIntentos.claveLogin("1.2.3.4", "Admin");
        for (int i = 0; i < LimiteIntentos.MAX_FALLOS_LOGIN - 1; i++) l.loginFallido(k);
        assertFalse(l.loginBloqueado(k));
        l.loginFallido(k);
        assertTrue(l.loginBloqueado(k));
        // otra persona desde la misma IP no queda bloqueada
        assertFalse(l.loginBloqueado(LimiteIntentos.claveLogin("1.2.3.4", "otro")));
        // la clave no distingue mayúsculas
        assertTrue(l.loginBloqueado(LimiteIntentos.claveLogin("1.2.3.4", " ADMIN ")));
        l.loginExitoso(k);
        assertFalse(l.loginBloqueado(k));
    }

    @Test
    void registro_seLimitaPorIp() {
        LimiteIntentos l = new LimiteIntentos();
        for (int i = 0; i < LimiteIntentos.MAX_REGISTROS; i++) {
            assertFalse(l.registroBloqueado("9.9.9.9"));
            l.registroRealizado("9.9.9.9");
        }
        assertTrue(l.registroBloqueado("9.9.9.9"));
        assertFalse(l.registroBloqueado("8.8.8.8"));
    }
}
