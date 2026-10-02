package com.inmobiliaria.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ubicación con Google Maps:
 *  1) geocodificar(): convierte calle/altura/localidad en coordenadas con la API de Geocodificación de Google
 *     (necesita una clave en la variable de entorno GOOGLE_MAPS_API_KEY o en la propiedad google.maps.api-key).
 *  2) coordenadasDeLink(): abre un link de Google Maps (incluso los cortos maps.app.goo.gl) y saca las coordenadas.
 *     Solo sigue redirecciones que sigan siendo de Google Maps (validadas una por una).
 */
@Service
public class GeocodificacionService {

    @Value("${google.maps.api-key:}")
    private String apiKey;

    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    private static final Pattern[] PATRONES = {
        Pattern.compile("!3d(-?\\d{1,2}\\.\\d+)!4d(-?\\d{1,3}\\.\\d+)"),
        Pattern.compile("@(-?\\d{1,2}\\.\\d+),(-?\\d{1,3}\\.\\d+)"),
        Pattern.compile("[?&](?:q|ll|query|destination)=(-?\\d{1,2}\\.\\d+),(-?\\d{1,3}\\.\\d+)")
    };

    public boolean configurado() { return apiKey != null && !apiKey.isBlank(); }

    /** @return mapa con lat, lng, etiqueta, precision; o null si Google no encontró la dirección */
    @SuppressWarnings("unchecked")
    public Map<String, Object> geocodificar(String direccion) {
        if (!configurado()) throw new IllegalStateException("Google Maps no está configurado en el servidor");
        if (direccion == null || direccion.isBlank() || direccion.length() > 300)
            throw new IllegalArgumentException("La dirección no es válida");
        Map<String, Object> resp = RestClient.create().get()
                .uri("https://maps.googleapis.com/maps/api/geocode/json?address={a}&components=country:AR&region=ar&language=es&key={k}",
                        direccion.trim(), apiKey.trim())
                .retrieve().body(Map.class);
        if (resp == null) throw new IllegalStateException("Google Maps no respondió");
        String status = String.valueOf(resp.get("status"));
        if ("ZERO_RESULTS".equals(status)) return null;
        if (!"OK".equals(status)) {
            String detalle = resp.get("error_message") == null ? status : status + ": " + resp.get("error_message");
            throw new IllegalStateException("Google Maps rechazó la consulta (" + detalle + ")");
        }
        List<Map<String, Object>> results = (List<Map<String, Object>>) resp.get("results");
        if (results == null || results.isEmpty()) return null;
        Map<String, Object> r = results.get(0);
        Map<String, Object> geo = (Map<String, Object>) r.get("geometry");
        Map<String, Object> loc = (Map<String, Object>) geo.get("location");
        String tipo = String.valueOf(geo.get("location_type"));
        String precision = switch (tipo) {
            case "ROOFTOP", "RANGE_INTERPOLATED" -> "exacta";
            case "GEOMETRIC_CENTER" -> "calle";
            default -> "barrio";
        };
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("lat", ((Number) loc.get("lat")).doubleValue());
        out.put("lng", ((Number) loc.get("lng")).doubleValue());
        out.put("etiqueta", String.valueOf(r.get("formatted_address")));
        out.put("precision", precision);
        return out;
    }

    /** @return {lat,lng} o null si el link no trae coordenadas */
    public Map<String, Object> coordenadasDeLink(String link) {
        String actual = link == null ? "" : link.trim();
        if (!PropiedadService.esLinkGoogleMapsValido(actual) || actual.isEmpty())
            throw new IllegalArgumentException("El link no es un enlace válido de Google Maps");
        try {
            for (int salto = 0; salto < 6; salto++) {
                Map<String, Object> c = extraer(actual);
                if (c != null) return c;
                HttpResponse<Void> r = http.send(
                        HttpRequest.newBuilder(URI.create(actual)).timeout(Duration.ofSeconds(8))
                                .header("User-Agent", "Mozilla/5.0").GET().build(),
                        HttpResponse.BodyHandlers.discarding());
                if (r.statusCode() / 100 != 3) return null;
                String loc = r.headers().firstValue("Location").orElse("");
                if (loc.isBlank()) return null;
                String siguiente = URI.create(actual).resolve(loc).toString();
                // cada redirección tiene que seguir siendo de Google Maps (evita que nos lleven a otro sitio)
                if (!PropiedadService.esLinkGoogleMapsValido(siguiente)) return null;
                actual = siguiente;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    private static Map<String, Object> extraer(String url) {
        for (Pattern p : PATRONES) {
            Matcher m = p.matcher(url);
            if (m.find()) {
                double lat = Double.parseDouble(m.group(1)), lng = Double.parseDouble(m.group(2));
                if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("lat", lat);
                    out.put("lng", lng);
                    return out;
                }
            }
        }
        return null;
    }
}
