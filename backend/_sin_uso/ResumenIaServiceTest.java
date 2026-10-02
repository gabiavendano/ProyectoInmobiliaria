package com.inmobiliaria.backend;

import org.junit.jupiter.api.Test;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

/** Prueba las piezas del Resumen IA que no necesitan red ni clave (están en el paquete de servicio, se usan por reflexión). */
class ResumenIaServiceTest {

    private static final Class<?> C;
    static {
        try { C = Class.forName("com.inmobiliaria.backend.service.ResumenIaService"); }
        catch (ClassNotFoundException e) { throw new ExceptionInInitializerError(e); }
    }

    private static Object llamar(String nombre, Class<?>[] tipos, Object... args) throws Exception {
        Method m = C.getDeclaredMethod(nombre, tipos);
        m.setAccessible(true);
        return m.invoke(null, args);
    }

    @Test
    void descripcionCortaNoSeResume() throws Exception {
        assertFalse((Boolean) llamar("merecerResumen", new Class<?>[]{String.class}, "Casa linda."));
        assertFalse((Boolean) llamar("merecerResumen", new Class<?>[]{String.class}, (Object) null));
        assertTrue((Boolean) llamar("merecerResumen", new Class<?>[]{String.class}, "x ".repeat(100)));
    }

    @Test
    void huellaCambiaSoloSiCambiaElTexto() throws Exception {
        Class<?>[] t = {String.class};
        Object a = llamar("huella", t, "Casa  con   pileta");
        assertEquals(a, llamar("huella", t, " Casa con pileta "));   // los espacios no cuentan
        assertNotEquals(a, llamar("huella", t, "Casa con pileta y quincho"));
        assertEquals(64, ((String) a).length());
    }

    @Test
    void respuestaSeLimpia() throws Exception {
        Class<?>[] t = {String.class};
        assertEquals("Casa luminosa en el centro.", llamar("limpiarRespuesta", t, "  \"Casa luminosa\n en el centro.\"  "));
        assertNull(llamar("limpiarRespuesta", t, "   "));
        String larga = ("palabra ").repeat(200);
        assertTrue(((String) llamar("limpiarRespuesta", t, larga)).length() <= 425);
    }

    @Test
    void extraeElTextoDeLaRespuestaDeLaApi() throws Exception {
        Map<String, Object> r = Map.of("content", List.of(Map.of("type", "text", "text", "Resumen listo.")));
        assertEquals("Resumen listo.", llamar("extraerTexto", new Class<?>[]{Map.class}, r));
        assertNull(llamar("extraerTexto", new Class<?>[]{Map.class}, Map.of()));
    }

    @Test
    void elMensajeIncluyeTituloYDescripcion() throws Exception {
        String m = (String) llamar("construirMensaje", new Class<?>[]{String.class, String.class}, "Chalet", "Tiene   pileta");
        assertTrue(m.contains("Título: Chalet"));
        assertTrue(m.contains("Tiene pileta"));
    }
}
