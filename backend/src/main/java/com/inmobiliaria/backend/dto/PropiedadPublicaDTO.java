package com.inmobiliaria.backend.dto;

import com.inmobiliaria.backend.model.ImagenPropiedad;
import com.inmobiliaria.backend.model.Propiedad;
import com.inmobiliaria.backend.service.PropiedadService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Lo ÚNICO que el sitio público puede ver de una propiedad.
 * No incluye propietario, deudas, cuentas de servicios, catastro, observaciones internas,
 * ubicación de llaves, comisión, link de Google Maps, etc.
 * Si la propiedad no muestra su dirección exacta, las coordenadas salen corridas (hasta ~200 m)
 * para que no se pueda averiguar el punto real desde la respuesta del servidor.
 */
public record PropiedadPublicaDTO(
        Integer idPropiedad,
        String titulo,
        String descripcion,
        String tipoInmueble,
        String tipoOperacion,
        List<String> operaciones,
        BigDecimal precio,
        String moneda,
        String priceStr,
        String zona,
        Double latitud,
        Double longitud,
        Boolean showExactLocation,
        Integer cantDormitorios,
        Integer cantBanos,
        Integer superficieTotalM2,
        String agent,
        LocalDate dateAdded,
        List<String> amenities,
        List<String> fotos,
        Boolean esComplejo,
        Integer unidadesTotal,
        Integer unidadesDisponibles,
        List<Unidad> unidades
) {

    /** Operación principal + adicionales, en ese orden y sin repetir. */
    private static List<String> operacionesDe(Propiedad p) {
        java.util.LinkedHashSet<String> out = new java.util.LinkedHashSet<>();
        if (p.getTipoOperacion() != null) out.add(p.getTipoOperacion().name());
        if (p.getOperacionesAdicionales() != null)
            p.getOperacionesAdicionales().forEach(o -> { if (o != null) out.add(o.name()); });
        return new java.util.ArrayList<>(out);
    }

    /** Unidad disponible de un complejo (solo datos públicos; la dirección es la del complejo). */
    public record Unidad(
            Integer idPropiedad,
            String identificador,
            BigDecimal precio,
            String moneda,
            String priceStr,
            Integer cantAmbientes,
            Integer cantDormitorios,
            Integer cantBanos,
            Integer superficieTotalM2,
            String tipoInmueble,
            List<String> fotos
    ) {}

    public static PropiedadPublicaDTO desde(Propiedad p) {
        return construir(p, false, 0, List.of());
    }

    /** Complejo con sus unidades libres anidadas. El precio pasa a ser el "Desde" de la unidad más barata (si comparten moneda). */
    public static PropiedadPublicaDTO desdeComplejo(Propiedad c, List<Propiedad> libres, int total) {
        return construir(c, true, total, libres);
    }

    private static List<String> fotosDe(Propiedad p) {
        List<String> fotos = new ArrayList<>();
        if (p.getImagenes() != null) {
            p.getImagenes().stream()
                    .sorted(Comparator
                            .comparing((ImagenPropiedad i) -> !Boolean.TRUE.equals(i.getEsFotoPrincipal()))
                            .thenComparing(i -> i.getOrdenAparicion() == null ? 0 : i.getOrdenAparicion()))
                    .forEach(i -> { if (i.getUrlImagen() != null && !i.getUrlImagen().isBlank()) fotos.add(i.getUrlImagen()); });
        }
        return fotos;
    }

    private static PropiedadPublicaDTO construir(Propiedad p, boolean complejo, int total, List<Propiedad> libres) {
        boolean exacta = !Boolean.FALSE.equals(p.getShowExactLocation());
        Double lat = p.getLatitud();
        Double lng = p.getLongitud();
        String zona = primeroNoVacio(p.getZona(), p.getBarrio(), p.getLocalidad());
        if (!exacta && lat != null && lng != null) {
            double[] c = desplazar(lat, lng, p.getIdPropiedad() == null ? 0 : p.getIdPropiedad());
            lat = c[0];
            lng = c[1];
        }

        List<String> fotos = fotosDe(p);
        List<Unidad> unidades = new ArrayList<>();
        BigDecimal precio = p.getPrecio();
        String priceStr = p.getPriceStr();
        if (complejo) {
            for (Propiedad u : libres) {
                unidades.add(new Unidad(u.getIdPropiedad(), u.getUnidadIdentificador(), u.getPrecio(),
                        u.getMoneda() == null ? null : u.getMoneda().name(), u.getPriceStr(),
                        u.getCantAmbientes(), u.getCantDormitorios(), u.getCantBanos(), u.getSuperficieTotalM2(),
                        u.getTipoInmueble() == null ? null : u.getTipoInmueble().name(), fotosDe(u)));
                if (fotos.isEmpty()) fotos = fotosDe(u);
            }
            Propiedad.Moneda mon = p.getMoneda();
            boolean mismaMoneda = !libres.isEmpty() && libres.stream().allMatch(u -> u.getMoneda() == mon && u.getPrecio() != null);
            if (mismaMoneda) {
                BigDecimal min = libres.stream().map(Propiedad::getPrecio).min(Comparator.naturalOrder()).get();
                precio = min;
                priceStr = "Desde " + PropiedadService.armarPriceStr(min, mon, p.getTipoOperacion());
            }
        }

        return new PropiedadPublicaDTO(
                p.getIdPropiedad(),
                p.getTitulo(),
                p.getDescripcion(),
                p.getTipoInmueble() == null ? null : p.getTipoInmueble().name(),
                p.getTipoOperacion() == null ? null : p.getTipoOperacion().name(),
                operacionesDe(p),
                precio,
                p.getMoneda() == null ? null : p.getMoneda().name(),
                priceStr,
                zona,
                lat,
                lng,
                exacta,
                p.getCantDormitorios(),
                p.getCantBanos(),
                p.getSuperficieTotalM2(),
                p.getAgent(),
                p.getDateAdded(),
                p.getAmenities() == null ? new ArrayList<>() : new ArrayList<>(p.getAmenities()),
                fotos,
                complejo,
                total,
                libres.size(),
                unidades
        );
    }

    private static String primeroNoVacio(String... valores) {
        for (String v : valores) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }

    // ── Ubicación aproximada ──────────────────────────────────────────────
    // El corrimiento sale de un HMAC con un secreto del servidor: es siempre el mismo para la misma
    // propiedad (así no se puede promediar varias consultas), pero sin el secreto no se puede deshacer
    // aunque se conozca esta fórmula y el id de la propiedad.
    private static volatile byte[] secreto = secretoAleatorio();

    private static byte[] secretoAleatorio() {
        byte[] b = new byte[32];
        new SecureRandom().nextBytes(b);
        return b;
    }

    /** Lo llama la configuración al arrancar (ver UbicacionPublicaConfig). Con menos de 16 caracteres se ignora. */
    public static void configurarSecreto(String valor) {
        if (valor != null && valor.length() >= 16) secreto = valor.getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] hmac(String dato) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secreto, "HmacSHA256"));
            return mac.doFinal(dato.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo calcular la ubicación aproximada", e);
        }
    }

    /** Corrimiento fijo por propiedad: dirección cualquiera y distancia entre 80 y 200 m. */
    static double[] desplazar(double lat, double lng, int semilla) {
        byte[] h = hmac("ubicacion:" + semilla);
        double u1 = (((h[0] & 0xff) << 8) | (h[1] & 0xff)) / 65536.0;
        double u2 = (((h[2] & 0xff) << 8) | (h[3] & 0xff)) / 65536.0;
        double angulo = u1 * 2 * Math.PI;
        double metros = 80 + u2 * 120;
        double dLat = (metros * Math.cos(angulo)) / 111_320.0;
        double dLng = (metros * Math.sin(angulo)) / (111_320.0 * Math.max(0.2, Math.cos(Math.toRadians(lat))));
        return new double[]{ Math.round((lat + dLat) * 10000.0) / 10000.0, Math.round((lng + dLng) * 10000.0) / 10000.0 };
    }
}
