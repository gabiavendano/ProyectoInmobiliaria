// Utilidades de Finanzas y Cobros (formato de montos, meses, cálculo de mora).

export const fmtMonto = (v, moneda = "ARS") =>
  ({ USD: "US$ ", EUR: "€ " }[moneda] || "$ ") +
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

export const pad2 = (n) => String(n).padStart(2, "0");

export const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const mesActual = () => hoyIso().slice(0, 7);

/** "2026-09" + día 10 -> "2026-09-10" (el día se acota al largo del mes) */
export const fechaVencimiento = (mes, dia = 10) => {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return `${mes}-${pad2(Math.min(Number(dia) || 10, ultimo))}`;
};

/** Diferencia en meses entre dos "AAAA-MM" (b - a) */
export const difMeses = (a, b) => {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};

export const sumarMeses = (mes, n) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

export const nombreMes = (mes) => {
  if (!mes) return "";
  const [a, m] = mes.split("-").map(Number);
  const nombre = new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long" });
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${a}`;
};

export const diasEntre = (desde, hasta) => Math.round((new Date(hasta + "T00:00:00") - new Date(desde + "T00:00:00")) / 86400000);

/**
 * Vista previa del cobro (el servidor recalcula y es quien manda).
 * Mora = días de atraso × tasa diaria × alquiler base. La mora es del propietario salvo cláusula expresa.
 */
export const calcularCobro = ({ base, vencimiento, fechaPago, tasaMora, pctHonorarios, moraInmobiliaria, coCorretaje }) => {
  const b = Number(base) || 0;
  const dias = fechaPago && vencimiento && fechaPago > vencimiento ? diasEntre(vencimiento, fechaPago) : 0;
  const mora = Math.round(dias * (Number(tasaMora) || 0) * b * 100) / 100;
  const total = b + mora;
  let hon = Math.round(b * (Number(pctHonorarios) || 0)) / 100;
  if (coCorretaje) hon = Math.round(hon * 50) / 100;
  if (moraInmobiliaria) hon += mora;
  hon = Math.round(hon * 100) / 100;
  return { dias, mora, total, hon, neto: Math.round((total - hon) * 100) / 100 };
};

// ── Cobros del alquiler: un mes puede cobrarse en varios pagos (a cuenta / saldo) ──
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** true si el cobro es el alquiler del mes (los cobros viejos sin concepto también lo son). */
export const esAlquilerMes = (l) => !l.concepto || l.concepto === "Alquiler";

/** Estado del alquiler de un mes de un contrato: cuánto se cobró, cuánto corresponde y cuánto falta. */
export const estadoMes = (cobros, idOperacion, mes, esperadoPorDefecto = 0) => {
  const del = cobros
    .filter((l) => !l.anulada && l.contrato?.idOperacion === idOperacion && l.mesAnoLiquidado === mes && esAlquilerMes(l))
    .sort((a, b) => a.idLiquidacion - b.idLiquidacion);
  const pagado = r2(del.reduce((t, l) => t + Number(l.montoAlquilerBase || 0), 0));
  const ult = del[del.length - 1];
  const esperado = ult ? r2(ult.montoAlquilerMes ?? ult.montoAlquilerBase) : r2(esperadoPorDefecto);
  const saldo = Math.max(0, r2(esperado - pagado));
  return { cobros: del, pagado, esperado, saldo, completo: del.length > 0 && saldo <= 0.005 };
};

/** Texto del concepto cobrado, igual al que arma el servidor para el movimiento y la rendición. */
export const etiquetaCobro = (l) => {
  if (l.concepto && l.concepto !== "Alquiler") return l.concepto;
  const mes = nombreMes(l.mesAnoLiquidado);
  if (l.pagoParcial) return `${Number(l.saldoAlquilerPendiente) === 0 ? "Saldo de alquiler" : "Pago a cuenta de alquiler"} ${mes}`;
  return `Alquiler ${mes}`;
};
