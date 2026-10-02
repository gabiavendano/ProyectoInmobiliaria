// Validación del "Link de Google Maps" de una ficha.
// Regla de seguridad: solo se acepta un enlace https que apunte a Google Maps. Cualquier otra cosa
// (texto suelto, otra web, javascript:, la dirección de esta misma app, etc.) se rechaza.
// Además el link NUNCA se incrusta en la pantalla (ni en iframe): solo se ofrece como enlace externo.

const HOSTS = new Set([
  "google.com", "www.google.com", "maps.google.com", "google.com.ar", "www.google.com.ar",
  "maps.app.goo.gl", "goo.gl", "g.co",
]);

export const LINK_MAPS_AYUDA =
  "Pegá el enlace que te da Google Maps con “Compartir” (empieza con https://maps.app.goo.gl/ o https://www.google.com/maps/).";

/** @returns {{ok:boolean, link:string, error:string}} link ya limpio (sin espacios) cuando ok */
export function validarLinkGoogleMaps(valor) {
  const t = String(valor ?? "").trim();
  if (!t) return { ok: true, link: "", error: "" };
  if (t.length > 500) return { ok: false, link: t, error: "El enlace es demasiado largo (máximo 500 caracteres)." };
  if (/\s/.test(t)) return { ok: false, link: t, error: "Eso no parece un enlace: tiene espacios. " + LINK_MAPS_AYUDA };
  let u;
  try { u = new URL(t); } catch { return { ok: false, link: t, error: "No es un enlace válido. " + LINK_MAPS_AYUDA }; }
  if (u.protocol !== "https:") return { ok: false, link: t, error: "El enlace debe empezar con https://. " + LINK_MAPS_AYUDA };
  if (u.username || u.password) return { ok: false, link: t, error: "El enlace no es válido. " + LINK_MAPS_AYUDA };
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return { ok: false, link: t, error: "Ese enlace no es de Google Maps. " + LINK_MAPS_AYUDA };
  const necesitaMaps = host.startsWith("google.") || host.startsWith("www.google.") || host === "goo.gl";
  if (necesitaMaps && !u.pathname.startsWith("/maps"))
    return { ok: false, link: t, error: "Ese enlace es de Google pero no de Maps. " + LINK_MAPS_AYUDA };
  return { ok: true, link: t, error: "" };
}

/** Si el enlace largo trae coordenadas (@lat,lng  o  !3dlat!4dlng  o  ?q=lat,lng) las devuelve; si no, null. */
export function coordenadasDeLink(link) {
  const t = String(link ?? "");
  const pats = [/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/];
  for (const re of pats) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
