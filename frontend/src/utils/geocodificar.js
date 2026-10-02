// Convierte una dirección en coordenadas (latitud / longitud): primero con Google Maps (si el servidor tiene clave) y,
// si no, con el buscador de OpenStreetMap (Nominatim).
// Es gratuito y no necesita clave. Su política pide como máximo 1 consulta por segundo, por eso entre un intento
// y otro se espera un poco, y solo se busca cuando hace falta (no en cada tecla).
import { geocodificarGoogle } from "../services/api";

const URL_BUSQUEDA = "https://nominatim.openstreetmap.org/search";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const limpio = (v) => String(v ?? "").trim();

async function consultar(q) {
  const params = new URLSearchParams({
    q, format: "jsonv2", limit: "1", addressdetails: "1", countrycodes: "ar", "accept-language": "es",
  });
  const res = await fetch(`${URL_BUSQUEDA}?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`El servicio de mapas respondió ${res.status}`);
  const data = await res.json();
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), etiqueta: r.display_name || "", conNumero: !!r.address?.house_number };
}

/**
 * Busca la dirección yendo de lo más preciso a lo menos: calle + altura, solo la calle, solo el barrio.
 * Devuelve { lat, lng, etiqueta, precision } con precision "exacta" | "calle" | "barrio", o null si no la encuentra.
 * Si el servicio no responde (sin internet, etc.) lanza un error.
 */
export async function geocodificarDireccion({ calle, numero, barrio, localidad, provincia }) {
  const c = limpio(calle), n = limpio(numero), b = limpio(barrio), l = limpio(localidad), p = limpio(provincia);

  // 1) Google Maps (vía el servidor, si tiene la clave configurada): entiende mucho mejor las calles de Argentina
  if (c || b) {
    try {
      const dir = [[c, n].filter(Boolean).join(" "), c ? "" : b, l, p, "Argentina"].filter(Boolean).join(", ");
      const { data } = await geocodificarGoogle(dir);
      const g = data?.resultado;
      if (data?.configurado && g && Number.isFinite(g.lat) && Number.isFinite(g.lng)) {
        return { lat: Number(g.lat.toFixed(6)), lng: Number(g.lng.toFixed(6)), etiqueta: g.etiqueta || "", precision: g.precision || "calle" };
      }
    } catch { /* si Google no responde se usa el buscador libre de abajo */ }
  }

  // 2) Respaldo: OpenStreetMap
  const zona = [l, p, "Argentina"].filter(Boolean).join(", ");

  const intentos = [];
  if (c && n) intentos.push({ q: `${c} ${n}, ${zona}`, precision: "exacta" });
  if (c) intentos.push({ q: `${c}, ${zona}`, precision: "calle" });
  if (b) intentos.push({ q: `${b}, ${zona}`, precision: "barrio" });

  for (let i = 0; i < intentos.length; i++) {
    if (i > 0) await esperar(1100);
    const r = await consultar(intentos[i].q);
    if (r) {
      // Si se pidió con altura pero el mapa no conoce ese número, el punto cae sobre la calle
      const precision = intentos[i].precision === "exacta" && !r.conNumero ? "calle" : intentos[i].precision;
      return { lat: r.lat, lng: r.lng, etiqueta: r.etiqueta, precision };
    }
  }
  return null;
}
