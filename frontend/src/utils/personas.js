// Utilidades compartidas para trabajar con Personas (clientes / propietarios / inquilinos).

// Los usuarios que se registran solos desde la web pública se guardan en la tabla Personas
// con un DNI técnico "USR-<n>". No son clientes cargados por la inmobiliaria.
export const esUsuarioWeb = (p) => /^USR-/i.test(String(p?.dniCuit ?? ""));

// Personas reales (cargadas por la inmobiliaria), sin los usuarios web.
export const soloClientesReales = (lista = []) => lista.filter((p) => !esUsuarioWeb(p));

// Deja solo los dígitos: "20-12.345.678-9" -> "20123456789"
export const soloDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// "2026-09-30" -> "30/09/2026"
export const fmtFecha = (iso) => {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
};

/**
 * Arma el link de WhatsApp para un teléfono argentino. Los celulares necesitan el prefijo 549
 * (país 54 + el 9 de móviles), sin el 0 de la característica ni el 15 (ej. "0351 15-555-1234" → 5493515551234).
 * Devuelve "" si el número no parece válido.
 */
export const numeroWhatsApp = (tel) => {
  let d = String(tel ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2).replace(/^9/, "");
  if (d.length === 12) {                                   // característica + 15 + número
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15" && d.length - 2 === 10) { d = d.slice(0, area) + d.slice(area + 2); break; }
    }
  }
  return d.length === 10 ? "549" + d : "";
};
