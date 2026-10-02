// Escala de honorarios del Corredor Público Inmobiliario de Córdoba — Ley Provincial 9.445, art. 25.
// El art. 24 dice que los honorarios se pactan libremente y que la escala rige si hay controversia:
// por eso el sistema propone estos porcentajes SOLOS, pero se pueden modificar en cada operación.
// Si la escala cambia, se corrige acá (un solo lugar).
//   a = parte vendedora / locadora / Parte A      b = parte compradora / locataria / Parte B
export const ESCALA_LEY_9445 = {
  venta:     { a: 3,  b: 3,  texto: "Venta (casas, departamentos, campos, oficinas, locales, cocheras): 3 % a cargo de cada parte" },
  loteo:     { a: 5,  b: 5,  texto: "Terrenos urbanos, loteos y fraccionamientos: 5 % a cargo de cada parte" },
  permuta:   { a: 3,  b: 3,  texto: "Permuta: se aplica la escala de la venta (3 % a cada parte) sobre el valor de la propiedad. Criterio a confirmar con el Colegio" },
  alquiler:  { a: 0,  b: 5,  texto: "Alquiler (urbano o rural): 5 % del monto total del contrato a cargo del locatario" },
  temporada: { a: 10, b: 10, texto: "Alquiler por temporada: 10 % a cargo de cada parte" },
};

const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Meses de un contrato de alquiler (un mes = 30,4375 días; 1/1/2026 al 1/1/2028 = 24)
export const mesesEntre = (ini, fin) => {
  if (!ini || !fin) return 0;
  const dias = (new Date(fin) - new Date(ini)) / 86400000;
  return dias > 0 ? Math.max(1, Math.round(dias / 30.4375)) : 0;
};

/**
 * Qué escala corresponde, sobre qué importe y en qué moneda, según la pestaña y la propiedad elegida.
 * Devuelve null si todavía faltan datos para calcular.
 */
export function baseYEscala(tab, form, prop) {
  const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  let clave, base, moneda, detalle;
  if (tab === "Venta") {
    clave = prop?.tipoInmueble === "Terreno" ? "loteo" : "venta";
    base = num(form.venPrecio); moneda = form.venMoneda; detalle = "precio de venta";
  } else if (tab === "Permuta") {
    clave = "permuta";
    base = num(prop?.precio); moneda = prop?.moneda || form.perDiferenciaMoneda; detalle = "valor de la propiedad";
  } else if (tab === "Alquiler Anual") {
    clave = "alquiler";
    const meses = mesesEntre(form.alqFechaInicio, form.alqFechaFin);
    base = redondear(num(form.alqCanonMonto) * meses); moneda = form.alqCanonMoneda;
    detalle = `canon × ${meses} mes${meses === 1 ? "" : "es"} (monto total del contrato)`;
  } else if (tab === "Temporario") {
    clave = "temporada";
    base = num(form.tempPrecioTotal); moneda = form.tempMoneda; detalle = "precio total de la estadía";
  } else return null;
  return { clave, escala: ESCALA_LEY_9445[clave], base, moneda, detalle };
}

const aTexto = (n) => (n === null || n === undefined || Number.isNaN(n) ? "" : String(n));

/**
 * Aplica la escala al formulario: porcentajes, montos y total.
 * Si alguien ya modificó los honorarios a mano (honEditado) no se pisan: solo se recalcula el total.
 */
export function aplicarHonorarios(form, tab, prop) {
  const r = baseYEscala(tab, form, prop);
  if (!r) return form;
  const out = { ...form, honBase: aTexto(r.base || ""), honEscala: r.escala.texto };
  if (!form.honEditado) {
    const a = r.base > 0 ? redondear(r.base * r.escala.a / 100) : "";
    const b = r.base > 0 ? redondear(r.base * r.escala.b / 100) : "";
    out.honParteAPorcentaje = aTexto(r.escala.a);
    out.honParteBPorcentaje = aTexto(r.escala.b);
    out.honParteAMonto = aTexto(a);
    out.honParteBMonto = aTexto(b);
    if (r.moneda) out.honMoneda = r.moneda;
  }
  return out;
}

/** Cambió el porcentaje de una parte → recalcula su monto sobre la base. */
export function cambiarPorcentaje(form, lado, valor) {
  const base = Number(form.honBase) || 0;
  const pct = Number(String(valor).replace(",", "."));
  const monto = base > 0 && Number.isFinite(pct) && valor !== "" ? String(redondear(base * pct / 100)) : "";
  return { ...form, [`honParte${lado}Porcentaje`]: valor, [`honParte${lado}Monto`]: monto, honEditado: true };
}

/** Cambió el monto de una parte → recalcula su porcentaje sobre la base (si hay base). */
export function cambiarMonto(form, lado, valor) {
  const base = Number(form.honBase) || 0;
  const m = Number(String(valor).replace(",", "."));
  const pct = base > 0 && Number.isFinite(m) && valor !== "" ? String(redondear(m / base * 100)) : form[`honParte${lado}Porcentaje`];
  return { ...form, [`honParte${lado}Monto`]: valor, [`honParte${lado}Porcentaje`]: pct, honEditado: true };
}

/** Total de honorarios = suma de las partes que no están anuladas. */
export function totalHonorarios(form) {
  const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const a = form.honParteAEstado === "Anulado" ? 0 : n(form.honParteAMonto);
  const b = form.honParteBEstado === "Anulado" ? 0 : n(form.honParteBMonto);
  return redondear(a + b);
}
