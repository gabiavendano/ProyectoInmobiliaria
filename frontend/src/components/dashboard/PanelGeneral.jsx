import { useEffect, useMemo, useState } from "react";
import {
  getPropiedades, getContratos, getPersonas, getConsultas, getMovimientos, getFacturasVencidasHoy, getCobros
} from "../../services/api";
import { soloClientesReales, fmtFecha } from "../../utils/personas";
import GraficoFinanzas from "./GraficoFinanzas";
import { esContenedor, operacionesDe } from "../../utils/propiedad";
import { comoBoton } from "../../utils/accesibilidad";
import { estadoMes } from "../../utils/finanzas";
import { MONEDAS, normalizarMoneda, nombreMoneda } from "../../utils/monedas";

// Color de las barras de la cartera (una sola serie → un solo color)
const COLOR_CARTERA = "#2a78d6";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ESTADO_LABEL = { EnObra: "En obra", Disponible: "Disponible", Reservada: "Reservada", Alquilada: "Alquilada", Vendida: "Vendida", Permutada: "Permutada", Inactiva: "Inactiva", Suspendida: "Suspendida" };
const OPERACION_LABEL = { Venta: "Venta", AlquilerPermanente: "Alquiler Anual", AlquilerTemporario: "Alq. temporario", Permuta: "Permuta" };

// ── Fechas (siempre en hora local, sin desfasajes por zona horaria) ─────────
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aUTC = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
// Días desde hoy hasta la fecha (negativo = ya pasó)
const diasHasta = (iso, hoyIso) => {
  const a = aUTC(iso), b = aUTC(hoyIso);
  return a === null || b === null ? null : Math.round((a - b) / 86400000);
};
const ultimosMeses = (n, hoy) => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push({
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: `${MESES[d.getMonth()]}${d.getMonth() === 0 || i === n - 1 ? ` ${String(d.getFullYear()).slice(2)}` : ""}`
    });
  }
  return out;
};

const esPendiente = (mv) => /^pendiente/i.test(mv.estado || "");
const esValido = (mv) => !esPendiente(mv) && !/^(anulad|cancelad)/i.test(mv.estado || "");   // movimiento efectivamente realizado
const monedaDe = (mv) => normalizarMoneda(mv.moneda);
// Símbolo corto para los importes del panel: "US$", "€" o "$"
const simboloPanel = (mo) => ({ USD: "US$", EUR: "€" }[mo] || "$");
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Tarjetas de "Finanzas del mes"
const PANEL = { border: "1px solid var(--color-gris-borde)", borderRadius: "10px", padding: "14px 16px" };
const TITULO_PANEL = { fontSize: "0.75rem", fontWeight: 700, color: "var(--color-gris-texto)", textTransform: "uppercase", letterSpacing: "0.03em" };
function Fila({ et, valor, fuerte, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", padding: "5px 0", borderTop: fuerte ? "1px solid var(--color-gris-borde)" : "none", marginTop: fuerte ? 4 : 0 }}>
      <span style={{ fontSize: "0.88rem" }}>{et}</span>
      <span style={{ fontSize: fuerte ? "1.15rem" : "1rem", fontWeight: fuerte ? 800 : 600, color: color || "var(--color-negro)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{valor}</span>
    </div>
  );
}

function BarrasHorizontales({ filas, vacio, unidad = "propiedades", nombre }) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  if (filas.length === 0) return <p style={{ color: "var(--color-gris-texto)", margin: 0 }}>{vacio}</p>;
  return (
    <ul aria-label={nombre} style={{ display: "flex", flexDirection: "column", gap: "10px", listStyle: "none", margin: 0, padding: 0 }}>
      {filas.map(f => (
        <li key={f.etiqueta} title={`${f.etiqueta}: ${f.valor}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Para lectores de pantalla: una frase completa en lugar de la barra dibujada */}
          <span className="sr-only">{`${f.etiqueta}: ${f.valor} ${f.valor === 1 && unidad.endsWith("s") ? unidad.slice(0, -1) : unidad}`}</span>
          <span aria-hidden="true" style={{ width: "110px", flexShrink: 0, fontSize: "0.85rem", color: "var(--color-negro)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.etiqueta}</span>
          <div aria-hidden="true" style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
            <div style={{ width: `calc((100% - 36px) * ${f.valor / max})`, minWidth: f.valor > 0 ? "3px" : 0, height: "16px", backgroundColor: COLOR_CARTERA, borderRadius: "0 4px 4px 0" }}></div>
            <span style={{ marginLeft: "8px", fontSize: "0.85rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{f.valor}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PanelGeneral({ usuario, setVista }) {
  const [datos, setDatos] = useState(null);
  const [moneda, setMoneda] = useState("ARS");

  useEffect(() => {
    let activo = true;
    const fuentes = [getPropiedades(), getContratos(), getPersonas(), getConsultas(), getMovimientos(), getFacturasVencidasHoy(), getCobros()];
    Promise.allSettled(fuentes).then((res) => {
      if (!activo) return;
      const lista = (i) => (res[i].status === "fulfilled" && Array.isArray(res[i].value.data) ? res[i].value.data : []);
      // Moneda inicial: la que más movimientos completados tuvo en los últimos 6 meses (si no hay, pesos)
      const desde = ultimosMeses(6, new Date())[0].clave;
      const porMoneda = {};
      lista(4).forEach(mv => { if (esValido(mv) && String(mv.fecha || "").slice(0, 7) >= desde) porMoneda[monedaDe(mv)] = (porMoneda[monedaDe(mv)] || 0) + 1; });
      const mejor = MONEDAS.map(m => m.codigo).reduce((a, b) => ((porMoneda[b] || 0) > (porMoneda[a] || 0) ? b : a), "ARS");
      setMoneda(mejor);
      setDatos({
        propiedades: lista(0), contratos: lista(1), personas: lista(2), consultas: lista(3), movimientos: lista(4), facturas: lista(5), cobros: lista(6),
        fallaron: ["propiedades", "contratos", "clientes", "consultas", "finanzas", "facturas", "cobros"].filter((_, i) => res[i].status !== "fulfilled")
      });
    });
    return () => { activo = false; };
  }, []);

  // El día se renueva solo: si el panel queda abierto pasada la medianoche (o la pestaña vuelve a estar a la vista),
  // los vencimientos y los gráficos se recalculan con la fecha real.
  const [hoy, setHoy] = useState(() => new Date());
  useEffect(() => {
    const revisar = () => setHoy(prev => { const ahora = new Date(); return isoLocal(ahora) === isoLocal(prev) ? prev : ahora; });
    const timer = setInterval(revisar, 60000);
    document.addEventListener("visibilitychange", revisar);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", revisar); };
  }, []);
  const hoyIso = isoLocal(hoy);

  // ── Indicadores generales ──────────────────────────────────────────────
  const resumen = useMemo(() => {
    if (!datos) return null;
    return {
      disponibles: datos.propiedades.filter(x => x.estadoPropiedad === "Disponible" && !esContenedor(x)).length,
      totalPropiedades: datos.propiedades.filter(x => !esContenedor(x)).length,
      vigentes: datos.contratos.filter(x => x.estadoContrato === "Vigente").length,
      clientes: soloClientesReales(datos.personas).length,
      consultasNuevas: datos.consultas.filter(x => x.estado === "Nueva").length,
    };
  }, [datos]);

  // ── Requiere atención ──────────────────────────────────────────────────
  const atencion = useMemo(() => {
    if (!datos) return [];
    const items = [];
    const nombres = (arr, max = 2) => arr.slice(0, max).join(" · ") + (arr.length > max ? ` y ${arr.length - max} más` : "");

    const nuevas = datos.consultas.filter(c => c.estado === "Nueva");
    if (nuevas.length) items.push({
      id: "consultas", icono: "fa-bullseye", tono: "warn", vista: "leads", cta: "Ver consultas",
      titulo: `${plural(nuevas.length, "consulta nueva", "consultas nuevas")} de la web sin responder`,
      detalle: nombres(nuevas.map(c => c.nombre || c.email || "Sin nombre"))
    });

    const contratos = datos.contratos
      .filter(c => c.estadoContrato === "Vigente" && !c.tempCheckIn)   // una estadía temporaria que termina no es un contrato por vencer
      .map(c => ({ c, dias: diasHasta(c.fechaFin || c.alqFechaFin, hoyIso) }))
      .filter(x => x.dias !== null && x.dias <= 60)
      .sort((a, b) => a.dias - b.dias);
    const vencidos = contratos.filter(x => x.dias < 0);
    if (contratos.length) items.push({
      id: "contratos", icono: "fa-file-signature", tono: vencidos.length ? "red" : "warn", vista: "contratos", cta: "Ver contratos",
      titulo: vencidos.length
        ? `${plural(contratos.length, "contrato vencido o por vencer", "contratos vencidos o por vencer")} en 60 días (${vencidos.length} ya vencido${vencidos.length === 1 ? "" : "s"})`
        : `${plural(contratos.length, "contrato vence", "contratos vencen")} en los próximos 60 días`,
      detalle: nombres(contratos.map(x => `${x.c.propiedad?.titulo || `Operación #${x.c.idOperacion}`} (${x.dias < 0 ? "vencido" : x.dias === 0 ? "vence hoy" : `en ${x.dias} d`})`))
    });

    // Contratos cargados como borrador que todavía no se firmaron
    const borradores = datos.contratos.filter(c => c.estadoContrato === "Borrador");
    if (borradores.length) items.push({
      id: "borradores", icono: "fa-file-pen", tono: "warn", vista: "contratos", cta: "Ver borradores",
      titulo: `${plural(borradores.length, "contrato en borrador sin firmar", "contratos en borrador sin firmar")}`,
      detalle: nombres(borradores.map(c => c.propiedad?.titulo || `Operación #${c.idOperacion}`))
    });

    // Alquileres temporarios: llegadas, salidas y cobros de seña / saldo
    const estadias = datos.contratos.filter(c => c.tipoContrato === "Locacion" && c.tempCheckIn);
    const huesped = (c) => c.compradorInquilino?.nombreCompleto || "huésped";
    const llegadas = estadias.filter(c => c.estadoContrato === "Vigente")
      .map(c => ({ c, dias: diasHasta(c.tempCheckIn, hoyIso) })).filter(x => x.dias !== null && x.dias >= 0 && x.dias <= 3)
      .sort((a, b) => a.dias - b.dias);
    if (llegadas.length) items.push({
      id: "llegadas", icono: "fa-suitcase-rolling", tono: "warn", vista: "contratos", cta: "Ver estadías",
      titulo: `${plural(llegadas.length, "llegada", "llegadas")} de huéspedes hoy o en los próximos 3 días`,
      detalle: nombres(llegadas.map(x => `${x.c.propiedad?.titulo || "Propiedad"} · ${huesped(x.c)} (${x.dias === 0 ? "hoy" : x.dias === 1 ? "mañana" : `en ${x.dias} d`})`))
    });
    const salidas = estadias.filter(c => c.estadoContrato === "Vigente" && diasHasta(c.tempCheckOut, hoyIso) === 0);
    if (salidas.length) items.push({
      id: "salidas", icono: "fa-door-open", tono: "warn", vista: "contratos", cta: "Ver estadías",
      titulo: `${plural(salidas.length, "salida", "salidas")} de huéspedes hoy (check-out)`,
      detalle: nombres(salidas.map(c => `${c.propiedad?.titulo || "Propiedad"} · ${huesped(c)}`))
    });
    const senSin = estadias.filter(c => c.estadoContrato === "Vigente" && Number(c.tempSenia) > 0 && !c.tempSeniaCobradaFecha && !c.tempSaldoCobradoFecha && (diasHasta(c.tempCheckIn, hoyIso) ?? -1) >= 0);
    if (senSin.length) items.push({
      id: "seniasTemp", icono: "fa-piggy-bank", tono: "warn", vista: "contratos", cta: "Ver estadías",
      titulo: `${plural(senSin.length, "estadía con la seña sin registrar", "estadías con la seña sin registrar")}`,
      detalle: nombres(senSin.map(c => `${c.propiedad?.titulo || "Propiedad"} · ${huesped(c)} (llega ${fmtFecha(c.tempCheckIn)})`))
    });
    const pendTemp = {};
    const salSin = estadias.filter(c => {
      if (!["Vigente", "Finalizado"].includes(c.estadoContrato) || c.tempSaldoCobradoFecha) return false;
      const dIn = diasHasta(c.tempCheckIn, hoyIso), dOut = diasHasta(c.tempCheckOut, hoyIso);
      return dIn !== null && dIn <= 0 && dOut !== null && dOut >= -90 && Number(c.tempPrecioTotal) > 0;   // ya llegó (el saldo se cobra al ingresar); se mira hasta 90 días después de la salida
    });
    salSin.forEach(c => {
      // Con recibos emitidos manda lo cobrado de verdad; si solo hay una fecha cargada a mano, se descuenta la seña
      const cobradoReal = datos.cobros.filter(l => !l.anulada && l.contrato?.idOperacion === c.idOperacion && (l.concepto === "Seña de estadía" || l.concepto === "Saldo de estadía"))
        .reduce((t, l) => t + Number(l.montoAlquilerBase || 0), 0);
      const falta = Math.max(Number(c.tempPrecioTotal) - (cobradoReal > 0 ? cobradoReal : (c.tempSeniaCobradaFecha ? Number(c.tempSenia) || 0 : 0)), 0);
      const mo = normalizarMoneda(c.tempMoneda); pendTemp[mo] = (pendTemp[mo] || 0) + falta;
    });
    if (salSin.length) items.push({
      id: "saldosTemp", icono: "fa-hand-holding-dollar", tono: "red", vista: "contratos", cta: "Ver estadías",
      titulo: `${plural(salSin.length, "estadía con el saldo sin cobrar", "estadías con el saldo sin cobrar")}: ${MONEDAS.filter(m => pendTemp[m.codigo] > 0).map(m => `${m.simbolo} ${pendTemp[m.codigo].toLocaleString("es-AR")}`).join(" y ")}`,
      detalle: nombres(salSin.map(c => `${c.propiedad?.titulo || "Propiedad"} · ${huesped(c)}`))
    });

    // Honorarios profesionales que todavía no se cobraron (operaciones vigentes o finalizadas; las anuladas no cuentan)
    const pendHon = {};
    const conHonPend = [];
    datos.contratos.filter(c => c.estadoContrato === "Vigente" || c.estadoContrato === "Finalizado").forEach(c => {
      const falta = ["A", "B"].filter(l => c[`honParte${l}Estado`] !== "Anulado")
        .reduce((t, l) => t + Math.max(Number(c[`honParte${l}Monto`] || 0) - Number(c[`honParte${l}Cobrado`] || 0), 0), 0);
      if (falta > 0) { const mo = normalizarMoneda(c.honMoneda); pendHon[mo] = (pendHon[mo] || 0) + falta; conHonPend.push(c); }
    });
    if (conHonPend.length) {
      const partes = MONEDAS.filter(m => pendHon[m.codigo] > 0).map(m => `${m.simbolo} ${pendHon[m.codigo].toLocaleString("es-AR")}`).join(" y ");
      items.push({
        id: "honorarios", icono: "fa-scale-balanced", tono: "warn", vista: "contratos", cta: "Ver operaciones",
        titulo: `Honorarios por cobrar: ${partes} en ${plural(conHonPend.length, "operación", "operaciones")}`,
        detalle: nombres(conHonPend.map(c => c.propiedad?.titulo || `Operación #${c.idOperacion}`))
      });
    }

    const facturas = datos.facturas.filter(f => !f.estadoPago || f.estadoPago === "Pendiente");
    if (facturas.length) items.push({
      id: "facturas", icono: "fa-file-invoice-dollar", tono: "red", vista: "finanzas", cta: "Ver finanzas",
      titulo: `${plural(facturas.length, "factura de servicios", "facturas de servicios")} sin pagar con vencimiento hoy o vencido`,
      detalle: nombres(facturas.map(f => `${f.tipoServicio || "Servicio"} · ${f.propiedad?.titulo || "Propiedad"}`))
    });

    // Alquileres anuales vigentes cuyo vencimiento de este mes ya pasó sin cobro registrado
    const mesHoy = hoyIso.slice(0, 7);
    const sinCobrar = datos.contratos.filter(c => {
      if (c.tipoContrato !== "Locacion" || c.estadoContrato !== "Vigente" || c.tempCheckIn || c.tempCheckOut) return false;
      const ini = String(c.alqFechaInicio || c.fechaInicio || "").slice(0, 7), fin = String(c.alqFechaFin || c.fechaFin || "").slice(0, 7);
      if ((ini && ini > mesHoy) || (fin && fin < mesHoy)) return false;
      const dia = Math.min(c.alqDiaVencimiento || 10, 28);
      if (hoyIso <= `${mesHoy}-${String(dia).padStart(2, "0")}`) return false;
      return !estadoMes(datos.cobros, c.idOperacion, mesHoy, Number(c.alqCanonMonto || c.montoTotalOperacion || 0)).completo;
    });
    if (sinCobrar.length) items.push({
      id: "alquileres", icono: "fa-hand-holding-dollar", tono: "red", vista: "finanzas", cta: "Ir a cobranza",
      titulo: `${plural(sinCobrar.length, "alquiler vencido sin cobrar", "alquileres vencidos sin cobrar")} este mes`,
      detalle: nombres(sinCobrar.map(c => `${c.propiedad?.titulo || "Propiedad"} (${c.compradorInquilino?.nombreCompleto || "inquilino"})`))
    });

    // Sin contar dos veces la misma plata: un ingreso pendiente de una propiedad que ya figura arriba como
    // "alquiler sin cobrar" (o, si es de honorarios/comisión, como "honorarios por cobrar") no se repite acá.
    const idsRenta = new Set(sinCobrar.map(c => c.propiedad?.idPropiedad).filter(Boolean));
    const idsHon = new Set(conHonPend.map(c => c.propiedad?.idPropiedad).filter(Boolean));
    const esConceptoHon = (m) => /honorario|comisi/i.test(m.conceptoIngreso || "");
    const atrasados = datos.movimientos.filter(m => {
      if (m.tipo !== "Ingreso" || !esPendiente(m) || !m.fecha || m.fecha >= hoyIso) return false;
      const idProp = m.propiedad?.idPropiedad;
      if (idProp && esConceptoHon(m) && idsHon.has(idProp)) return false;
      if (idProp && !esConceptoHon(m) && idsRenta.has(idProp)) return false;
      return true;
    });
    if (atrasados.length) {
      const porMoneda = {};
      atrasados.forEach(m => { porMoneda[monedaDe(m)] = (porMoneda[monedaDe(m)] || 0) + (Number(m.monto) || 0); });
      const total = Object.entries(porMoneda).map(([mo, v]) => `${simboloPanel(mo)} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v)}`).join(" + ");
      items.push({
        id: "cobros", icono: "fa-hand-holding-dollar", tono: "red", vista: "finanzas", cta: "Ver cobros",
        titulo: `${plural(atrasados.length, "otro cobro atrasado", "otros cobros atrasados")} (${total})`,
        detalle: nombres(atrasados.map(m => m.persona?.nombreCompleto || m.propiedad?.titulo || `Movimiento #${m.idMovimiento}`))
      });
    }

    const exclus = datos.propiedades
      .filter(p => p.tieneExclusividad && p.fechaVencimientoExclusividad && ["Disponible", "Reservada"].includes(p.estadoPropiedad))
      .map(p => ({ p, dias: diasHasta(p.fechaVencimientoExclusividad, hoyIso) }))
      .filter(x => x.dias !== null && x.dias <= 30)
      .sort((a, b) => a.dias - b.dias);
    if (exclus.length) items.push({
      id: "exclusividad", icono: "fa-handshake", tono: exclus.some(x => x.dias < 0) ? "red" : "warn", vista: "propiedades", cta: "Ver propiedades",
      titulo: `${plural(exclus.length, "exclusividad por vencer", "exclusividades por vencer")} (30 días o menos)`,
      detalle: nombres(exclus.map(x => `${x.p.titulo || `Propiedad #${x.p.idPropiedad}`} (${x.dias < 0 ? "vencida" : x.dias === 0 ? "vence hoy" : `en ${x.dias} d`})`))
    });

    const contactos = soloClientesReales(datos.personas)
      .filter(p => p.segFechaProximo && p.segFechaProximo <= hoyIso && !["Inactivo", "No contactar"].includes(p.crmEstado))
      .sort((a, b) => a.segFechaProximo.localeCompare(b.segFechaProximo));
    if (contactos.length) items.push({
      id: "contactos", icono: "fa-phone-volume", tono: "warn", vista: "personas", cta: "Ver clientes",
      titulo: `${plural(contactos.length, "cliente", "clientes")} para contactar hoy o con el contacto atrasado`,
      detalle: nombres(contactos.map(p => `${p.nombreCompleto} (${fmtFecha(p.segFechaProximo)})`))
    });

    return items;
  }, [datos, hoyIso]);

  // ── Finanzas del mes y últimos 6 meses ─────────────────────────────────
  const finanzas = useMemo(() => {
    if (!datos) return null;
    const meses = ultimosMeses(6, hoy).map(m => ({ ...m, ingresos: 0, egresos: 0 }));
    const idx = Object.fromEntries(meses.map((m, i) => [m.clave, i]));
    let porCobrar = 0, porPagar = 0;
    datos.movimientos.forEach(mv => {
      if (monedaDe(mv) !== moneda) return;
      const monto = Number(mv.monto) || 0;
      if (esPendiente(mv)) {
        if (mv.tipo === "Ingreso") porCobrar += monto;
        else if (mv.tipo === "Egreso") porPagar += monto;
        return;
      }
      if (!esValido(mv)) return;
      const i = idx[String(mv.fecha || "").slice(0, 7)];
      if (i === undefined) return;
      if (mv.tipo === "Ingreso") meses[i].ingresos += monto;
      else if (mv.tipo === "Egreso") meses[i].egresos += monto;
    });
    const actual = meses[meses.length - 1];

    // ── Lo que se queda la inmobiliaria en el mes (no incluye lo que se rinde a los propietarios) ──
    const mesClave = actual.clave;
    const esEstadia = (c) => c.tipoContrato === "Locacion" && !!c.tempCheckIn;
    let comisiones = 0, aPropietarios = 0, honorarios = 0;
    const comisionPorEstadia = {};   // lo ya retenido al propietario en cada estadía (para no contarlo dos veces)
    datos.cobros.forEach(l => {
      if (l.anulada || normalizarMoneda(l.moneda) !== moneda) return;
      if ((l.concepto === "Seña de estadía" || l.concepto === "Saldo de estadía") && l.contrato?.idOperacion != null)
        comisionPorEstadia[l.contrato.idOperacion] = (comisionPorEstadia[l.contrato.idOperacion] || 0) + (Number(l.montoComisionInmobiliaria) || 0);
      if (String(l.fechaPagoReal || "").slice(0, 7) !== mesClave) return;
      comisiones += Number(l.montoComisionInmobiliaria) || 0;
      aPropietarios += Number(l.montoNetoARendir) || 0;
    });
    // Honorarios de las operaciones (venta, permuta, locación, huésped): lo cobrado, en el mes de la fecha de cobro cargada
    datos.contratos.forEach(c => {
      if (normalizarMoneda(c.honMoneda) !== moneda) return;
      ["A", "B"].forEach(p => {
        if (c[`honParte${p}Estado`] === "Anulado") return;
        if (String(c[`honParte${p}FechaCobro`] || "").slice(0, 7) !== mesClave) return;
        let cobrado = Number(c[`honParte${p}Cobrado`]) || 0;
        // En una estadía, la parte del propietario se retiene en cada cobro y ya está sumada arriba
        if (p === "A" && esEstadia(c)) cobrado = Math.max(cobrado - (comisionPorEstadia[c.idOperacion] || 0), 0);
        honorarios += cobrado;
      });
    });
    const inmo = { comisiones, honorarios, total: comisiones + honorarios, aPropietarios };
    return { meses, actual, porCobrar, porPagar, inmo };
  }, [datos, moneda, hoy]);

  // ── Cartera de propiedades ─────────────────────────────────────────────
  const cartera = useMemo(() => {
    if (!datos) return null;
    const cuenta = (arr, fn) => {
      const m = {};
      arr.forEach(x => { const k = fn(x); m[k] = (m[k] || 0) + 1; });
      return Object.entries(m).map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor);
    };
    // Mismo criterio que las tarjetas: un complejo con unidades es solo el contenedor; cuentan sus unidades.
    const reales = datos.propiedades.filter(p => !esContenedor(p));
    const disponibles = reales.filter(p => p.estadoPropiedad === "Disponible");
    const zonas = cuenta(reales, p => p.zona || "Sin zona");
    // Disponibles por operación: una propiedad ofrecida en varias operaciones cuenta en cada una
    const porOp = {};
    disponibles.forEach(p => {
      const ops = operacionesDe(p);
      (ops.length ? ops : ["Sin operación"]).forEach(o => { const k = OPERACION_LABEL[o] || o; porOp[k] = (porOp[k] || 0) + 1; });
    });
    return {
      porEstado: cuenta(reales, p => ESTADO_LABEL[p.estadoPropiedad] || p.estadoPropiedad || "Sin estado"),
      porOperacion: Object.entries(porOp).map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor),
      zonas: zonas.slice(0, 6),
      // Un alquiler temporario nunca se "ocupa" (sigue Disponible aunque tenga estadías): no sirve para medir cuánto tarda en colocarse
      masViejas: disponibles
        .filter(p => p.tipoOperacion !== "AlquilerTemporario")
        .map(p => ({ p, dias: -diasHasta(p.dateAdded, hoyIso) }))
        .filter(x => Number.isFinite(x.dias) && x.dias > 0)
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 5)
    };
  }, [datos, hoyIso]);

  const fmtMoneda = (v) => simboloPanel(moneda) + " " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(v);
  const balance = finanzas ? finanzas.actual.ingresos - finanzas.actual.egresos : 0;
  const mesActual = finanzas ? finanzas.actual.etiqueta.split(" ")[0] : "";

  const colorTono = { red: "#C62828", warn: "#E65100" };
  const fondoTono = { red: "#FFEBEE", warn: "#FFF3E0" };

  return (
    <div className="view-section active">
      {/* Aviso para lectores de pantalla: cuando los datos terminan de cargar bien (si falla algo, avisa el cartel naranja) */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {datos && datos.fallaron.length === 0 ? "Datos del panel cargados." : ""}
      </div>

      {/* ── Tarjetas principales ─────────────────────────────────────── */}
      <div className="stat-card-container">
        <div className="stat-card red" {...comoBoton(() => setVista("propiedades"), { "aria-label": "Propiedades disponibles: ir a Propiedades" })} style={{ cursor: "pointer" }}>
          <div className="stat-info"><h2>Propiedades Disponibles</h2><p>{resumen ? resumen.disponibles : "…"}</p><span>{resumen ? `de ${resumen.totalPropiedades} cargadas` : ""}</span></div>
          <div className="stat-icon"><i className="fa-solid fa-building"></i></div>
        </div>
        <div className="stat-card black" {...comoBoton(() => setVista("contratos"), { "aria-label": "Operaciones activas: ir a Operaciones y Contratos" })} style={{ cursor: "pointer" }}>
          <div className="stat-info"><h2>Operaciones Activas</h2><p>{resumen ? resumen.vigentes : "…"}</p><span>Contratos vigentes</span></div>
          <div className="stat-icon"><i className="fa-solid fa-handshake"></i></div>
        </div>
        <div className="stat-card red" {...comoBoton(() => setVista("leads"), { "aria-label": "Consultas nuevas (web): ver los leads" })} style={{ cursor: "pointer" }}>
          <div className="stat-info"><h2>Consultas Nuevas (Web)</h2><p>{resumen ? resumen.consultasNuevas : "…"}</p><span>Clic para ver los leads</span></div>
          <div className="stat-icon"><i className="fa-solid fa-bullseye"></i></div>
        </div>
        <div className="stat-card green" {...comoBoton(() => setVista("personas"), { "aria-label": "Clientes registrados: ir a Gestión de Clientes" })} style={{ cursor: "pointer" }}>
          <div className="stat-info"><h2>Clientes Registrados</h2><p>{resumen ? resumen.clientes : "…"}</p><span>Propietarios e Inquilinos</span></div>
          <div className="stat-icon"><i className="fa-solid fa-user-tie"></i></div>
        </div>
      </div>

      {datos && datos.fallaron.length > 0 && (
        <div role="alert" style={{ backgroundColor: "#FFF3E0", color: "#E65100", padding: "10px 15px", borderRadius: "8px", marginBottom: "20px", fontSize: "0.9rem" }}>
          <i className="fa-solid fa-triangle-exclamation"></i> No se pudieron cargar algunos datos ({datos.fallaron.join(", ")}). Los números de esas secciones pueden estar incompletos.
        </div>
      )}

      {/* ── Acceso rápido ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "25px" }}>
        <button type="button" className="btn btn-rojo" onClick={() => setVista("propiedades")}><i className="fa-solid fa-plus"></i> Nueva propiedad</button>
        <button type="button" className="btn btn-outline" onClick={() => setVista("personas")}><i className="fa-solid fa-user-plus"></i> Nuevo cliente</button>
        <button type="button" className="btn btn-outline" onClick={() => setVista("contratos")}><i className="fa-solid fa-file-signature"></i> Nuevo contrato</button>
        <button type="button" className="btn btn-outline" onClick={() => setVista("finanzas")}><i className="fa-solid fa-wallet"></i> Registrar movimiento</button>
      </div>

      {/* ── Requiere atención ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "25px" }}>
        <div className="card-header">
          <h2 className="card-title"><i className="fa-solid fa-bell" aria-hidden="true"></i> Requiere atención</h2>
          {datos && atencion.length > 0 && <span className="badge badge-warning">{plural(atencion.length, "tema", "temas")}</span>}
        </div>
        {!datos ? (
          null
        ) : atencion.length === 0 ? (
          <p style={{ color: "#2E7D32", margin: 0 }}><i className="fa-solid fa-circle-check"></i> Todo al día: no hay consultas sin responder, vencimientos cercanos ni cobros atrasados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {atencion.map(it => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", border: "1px solid var(--color-gris-borde)", borderLeft: `4px solid ${colorTono[it.tono]}`, borderRadius: "8px", flexWrap: "wrap" }}>
                <span style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: fondoTono[it.tono], color: colorTono[it.tono], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className={`fa-solid ${it.icono}`}></i>
                </span>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <div style={{ fontWeight: 600 }}>{it.titulo}</div>
                  {it.detalle && <div style={{ fontSize: "0.85rem", color: "var(--color-gris-texto)" }}>{it.detalle}</div>}
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setVista(it.vista)}>{it.cta} <i className="fa-solid fa-arrow-right"></i></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Finanzas del mes ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "25px" }}>
        <div className="card-header">
          <h2 className="card-title"><i className="fa-solid fa-chart-column" aria-hidden="true"></i> Finanzas del mes</h2>
          <div style={{ display: "flex", gap: "6px" }} role="group" aria-label="Moneda">
            {MONEDAS.map(({ codigo: mo }) => (
              <button key={mo} type="button" onClick={() => setMoneda(mo)} className={`btn btn-sm ${moneda === mo ? "btn-rojo" : "btn-outline"}`}>
                {nombreMoneda(mo)}
              </button>
            ))}
          </div>
        </div>
        {!finanzas ? (
          null
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", marginBottom: "18px" }}>
              {/* Lo más importante: lo que queda para la inmobiliaria */}
              <div style={{ ...PANEL, borderLeft: "5px solid var(--color-rojo)", background: "#FAFAFA" }}>
                <div style={TITULO_PANEL}>Lo que se queda la inmobiliaria · {mesActual}</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-rojo)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, margin: "4px 0 10px" }}>{fmtMoneda(finanzas.inmo.total)}</div>
                <Fila et="Comisiones de alquileres y estadías" valor={fmtMoneda(finanzas.inmo.comisiones)} />
                <Fila et="Honorarios de operaciones" valor={fmtMoneda(finanzas.inmo.honorarios)} />
              </div>

              <div style={PANEL}>
                <div style={TITULO_PANEL}>Caja del mes (movimientos)</div>
                <Fila et="Ingresos" valor={fmtMoneda(finanzas.actual.ingresos)} />
                <Fila et="Egresos" valor={fmtMoneda(finanzas.actual.egresos)} />
                <Fila et="Balance" fuerte color={balance < 0 ? "var(--color-rojo)" : "var(--color-negro)"} valor={(balance < 0 ? "−" : balance > 0 ? "+" : "") + fmtMoneda(Math.abs(balance))} />
              </div>

              <div style={PANEL}>
                <div style={TITULO_PANEL}>Alquileres cobrados en {mesActual}</div>
                <Fila et="Para los propietarios" valor={fmtMoneda(finanzas.inmo.aPropietarios)} />
                <Fila et="Comisión de la inmobiliaria" valor={fmtMoneda(finanzas.inmo.comisiones)} />
                <div style={{ fontSize: "0.78rem", color: "var(--color-gris-texto)", marginTop: 6 }}>Lo de los propietarios se les rinde en «Propietarios y Rendiciones».</div>
              </div>

              <div style={PANEL}>
                <div style={TITULO_PANEL}>Pendientes</div>
                <Fila et="Por cobrar" valor={fmtMoneda(finanzas.porCobrar)} />
                <Fila et="Por pagar" valor={fmtMoneda(finanzas.porPagar)} />
              </div>
            </div>
            <details style={{ fontSize: "0.82rem", color: "var(--color-gris-texto)", margin: "0 0 18px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>¿Cómo se calcula «Lo que se queda la inmobiliaria»?</summary>
              <p style={{ margin: "8px 0 0" }}>
                Suma dos cosas: <strong>(1)</strong> la comisión que se descuenta en cada cobro de alquiler o estadía del mes, y <strong>(2)</strong> los honorarios de ventas, permutas y alquileres que figuran como cobrados en cada contrato, en el mes de su fecha de cobro.
                Los honorarios de operaciones salen de lo cargado en el contrato: no aparecen en «Caja del mes» salvo que también los hayas registrado como ingreso en Movimientos. Lo de «Para los propietarios» no es dinero de la inmobiliaria: es lo que hay que rendirles.
              </p>
            </details>
            <GraficoFinanzas datos={finanzas.meses} moneda={moneda} />
            <p style={{ fontSize: "0.78rem", color: "var(--color-gris-texto)", margin: "14px 0 0" }}>
              Solo cuenta movimientos completados. Cada moneda (pesos, dólares y euros) se muestra por separado para no mezclarlas.
            </p>
          </>
        )}
      </div>

      {/* ── Cartera de propiedades ───────────────────────────────────── */}
      <div className="card" style={{ marginBottom: "25px" }}>
        <div className="card-header">
          <h2 className="card-title"><i className="fa-solid fa-house-chimney" aria-hidden="true"></i> Cartera de propiedades</h2>
          {resumen && <span className="badge badge-blue">{resumen.totalPropiedades} en total</span>}
        </div>
        {!cartera ? (
          null
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "30px" }}>
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: "0.67em" }}>Por estado</h3>
              <BarrasHorizontales filas={cartera.porEstado} nombre="Propiedades por estado" vacio="Todavía no hay propiedades cargadas." />
              {cartera.porOperacion.length > 0 && (
                <p style={{ fontSize: "0.85rem", color: "var(--color-gris-texto)", margin: "16px 0 0" }}>
                  Disponibles por operación: {cartera.porOperacion.map(o => `${o.etiqueta} ${o.valor}`).join(" · ")} (una propiedad ofrecida en varias operaciones se cuenta en cada una)
                </p>
              )}
            </div>
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: "0.67em" }}>Zonas con más propiedades</h3>
              <BarrasHorizontales filas={cartera.zonas} nombre="Zonas con más propiedades" vacio="Sin datos de zona." />
            </div>
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: "0.67em" }}>Más tiempo disponibles</h3>
              {cartera.masViejas.length === 0 ? (
                <p style={{ color: "var(--color-gris-texto)", margin: 0 }}>No hay propiedades disponibles con fecha de alta (los alquileres temporarios no se incluyen).</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {cartera.masViejas.map(({ p, dias }) => (
                    <div key={p.idPropiedad} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "0.88rem", borderBottom: "1px solid #F0EFEC", paddingBottom: "6px" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo || `Propiedad #${p.idPropiedad}`}</span>
                      <span style={{ color: "var(--color-gris-texto)", flexShrink: 0 }}>{dias} días</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <p style={{ color: "var(--color-gris-texto)", fontSize: "0.85rem" }}>
        Sesión iniciada como <strong>{usuario?.nombre}</strong>. Usá el menú lateral para gestionar los procesos de Inmobiliaria Del Castillo.
      </p>
    </div>
  );
}

export default PanelGeneral;
