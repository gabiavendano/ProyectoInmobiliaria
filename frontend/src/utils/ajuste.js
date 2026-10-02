import { sumarMeses } from "./finanzas";

/**
 * Cálculo de ajuste de alquiler por índice (IPC o ICL).
 *   nuevo alquiler = alquiler actual × (índice final ÷ índice inicial)
 * Con IPC es lo mismo que multiplicar (1 + variación mensual) de cada mes (NO se suman).
 * Es una PROPUESTA: la cláusula del contrato prevalece. No es asesoramiento legal.
 */

export const SERIE_IPC = "148.3_INIVELNAL_DICI_M_26"; // IPC Nacional, nivel general (INDEC, base dic-2016=100)
const URL_SERIE = "https://apis.datos.gob.ar/series/api/series";

const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Meses de referencia por defecto para ajustar en `mesAjuste` cada `n` meses. */
export function mesesReferencia(mesAjuste, n) {
  return { desde: sumarMeses(mesAjuste, -(n + 1)), hasta: sumarMeses(mesAjuste, -1) };
}

/** Calcula con dos valores del índice (inicial y final). Devuelve null si los datos no sirven. */
export function calcularPorIndices(alquilerActual, indiceInicial, indiceFinal) {
  const a = Number(alquilerActual), i0 = Number(indiceInicial), i1 = Number(indiceFinal);
  if (!(a > 0) || !(i0 > 0) || !(i1 > 0)) return null;
  const coeficiente = i1 / i0;
  const nuevo = r2(a * coeficiente);
  return { coeficiente, variacionPct: (coeficiente - 1) * 100, nuevo, diferencia: r2(nuevo - a) };
}

/** Calcula a partir de variaciones mensuales (en %), componiéndolas. */
export function calcularPorVariaciones(alquilerActual, variacionesPct) {
  const a = Number(alquilerActual);
  if (!(a > 0) || !variacionesPct?.length || variacionesPct.some((v) => !Number.isFinite(Number(v)))) return null;
  const coeficiente = variacionesPct.reduce((acc, v) => acc * (1 + Number(v) / 100), 1);
  const nuevo = r2(a * coeficiente);
  return { coeficiente, variacionPct: (coeficiente - 1) * 100, nuevo, diferencia: r2(nuevo - a) };
}

/** Interpreta la respuesta de la API de series de datos.gob.ar → { "YYYY-MM": valor }. */
export function parsearSerie(json) {
  const out = {};
  for (const fila of json?.data || []) {
    const [fecha, valor] = fila || [];
    if (fecha && valor != null && Number.isFinite(Number(valor))) out[String(fecha).slice(0, 7)] = Number(valor);
  }
  return out;
}

/** Descarga el nivel del IPC (INDEC) entre dos meses. Lanza error si no hay red/CORS/datos. */
export async function obtenerIpc(desde, hasta, { fetchFn = fetch, timeoutMs = 8000 } = {}) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const url = `${URL_SERIE}?ids=${SERIE_IPC}&start_date=${desde}&end_date=${hasta}&format=json`;
    const resp = await fetchFn(url, { signal: ctl?.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return parsearSerie(await resp.json());
  } finally { if (t) clearTimeout(t); }
}
