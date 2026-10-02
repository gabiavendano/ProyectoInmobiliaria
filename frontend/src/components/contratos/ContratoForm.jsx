import { useState, useEffect } from "react";
import { crearContrato, actualizarContrato, subirDocContrato, getPropiedades, getOcupacionPropiedad } from "../../services/api";
import DocumentosContrato from "./DocumentosContrato";
import GarantesContrato from "./GarantesContrato";
import CalendarioDisponibilidad from "../common/CalendarioDisponibilidad";
import HonorariosOperacion from "./HonorariosOperacion";
import { aplicarHonorarios, totalHonorarios, mesesEntre } from "../../utils/honorarios";
import { getPersonas } from "../../services/api";
import { InputG } from "../common/FormUI";
import { soloClientesReales } from "../../utils/personas";
import { ofreceOperacion, OPERACION_DE_TAB } from "../../utils/propiedad";
import { esContenedor } from "../../utils/propiedad";
import OpcionesMoneda from "../common/OpcionesMoneda";
import { simboloMoneda } from "../../utils/monedas";
import { avisar } from "../../utils/avisos";

// =========================================================================
// COMPONENTES UI REUTILIZABLES
// =========================================================================

// =========================================================================
// ESTADO INICIAL
// =========================================================================
const VACIO = {
  // Datos Generales
  numeroInterno: "", fechaAlta: new Date().toISOString().split('T')[0], 
  estadoOperacion: "Borrador", 
  
  idPropiedad: "",
  idComprador: "",      // comprador / locatario / huésped / parte B (persona)
  garantes: [],         // ids de personas garantes (solo alquiler anual)
  interesMoraDiario: "0.0005",   // fracción diaria: 0.0005 = 0,05 % por día de atraso

  // Venta
  venPrecio: "", venMoneda: "USD", venFormaPago: "Contado", venAnticipo: "", venCuotas: "", venMontoCuota: "",
  venMontoReserva: "", venFechaPosesion: "", venEscribano: "",

  // Permuta
  perBienesA: "", perBienesB: "", perDiferenciaMonto: "", perDiferenciaMoneda: "USD", perQuienPagaDiferencia: "Parte A", perPropiedadBId: "",

  // Alquiler Anual
  alqFechaInicio: "", alqFechaFin: "", alqDestino: "Vivienda", alqCanonMonto: "", alqCanonMoneda: "ARS", 
  alqIndiceAjuste: "ICL", alqFrecuenciaAjuste: "Trimestral", alqMontoDeposito: "", alqDiaVencimiento: "10", alqPorcentajeAdministracion: "10",

  // Temporario
  tempCheckIn: "", tempCheckOut: "", tempHuespedes: 2, tempPrecioNoche: "", tempPrecioTotal: "", tempMoneda: "ARS", tempSenia: "", tempSeniaPorcentaje: "", tempDeposito: "", tempSeniaCobradaFecha: "", tempSaldoCobradoFecha: "",

  // Honorarios (Ajustado a Ley 9.445 y CPI Córdoba)
  honMoneda: "USD", honBase: "", honEscala: "", honEditado: false,
  honParteAPorcentaje: "", honParteAMonto: "", honParteAEstado: "Pendiente", honParteAFormaPago: "Efectivo",
  honParteACobrado: "", honParteAFechaCobro: "", honParteAComprobante: "", honParteAFechaEmision: "",
  honParteBPorcentaje: "", honParteBMonto: "", honParteBEstado: "Pendiente", honParteBFormaPago: "Efectivo",
  honParteBCobrado: "", honParteBFechaCobro: "", honParteBComprobante: "", honParteBFechaEmision: "",
  honColegaPorcentaje: "50",
  
  hayCoCorretaje: false, coNombre: "", coMatricula: "", coIntervencion: "Representa Comprador",

  // Datos legales del corredor y verificaciones (Ley 25.028)
  matriculaCorredor: "", domicilioCorredor: "", numeroMatriz: "", profesionCorredor: "",
  certDominioInmueble: "", certGarantias: "", fechaFirma: "", condicionesNegocio: "", minutaOperacion: ""
};

// Estados de la operación que todavía son "preparación": NO bloquean la propiedad (el servidor usa la misma lista)
const ESTADOS_PREPARACION = ["Borrador", "En preparación", "Documentación pendiente", "Lista para contrato"];
const ESTADOS_ACTIVOS = ["Firmada", "Vigente"];

// Convierte un contrato guardado al estado del formulario (modo edición)
const formDesdeContrato = (c) => {
  const f = { ...VACIO };
  const copiar = (k, v) => { if (v !== undefined && v !== null) f[k] = v; };
  Object.keys(VACIO).forEach(k => copiar(k, c[k]));
  copiar("interesMoraDiario", c.interestMoraDiario);
  copiar("honBase", c.honBaseCalculo); copiar("honEscala", c.honEscala);
  copiar("honParteAPorcentaje", c.honParteAPorcentaje); copiar("honParteBPorcentaje", c.honParteBPorcentaje);
  copiar("honColegaPorcentaje", c.honColegaPorcentaje);
  ["A", "B"].forEach(l => {
    copiar(`honParte${l}Cobrado`, c[`honParte${l}Cobrado`]); copiar(`honParte${l}FechaCobro`, c[`honParte${l}FechaCobro`]);
    copiar(`honParte${l}Comprobante`, c[`honParte${l}Comprobante`]); copiar(`honParte${l}FechaEmision`, c[`honParte${l}FechaEmision`]);
  });
  // Operaciones anteriores a la escala automática (sin base guardada) o editadas a mano: no se recalculan solas
  f.honEditado = !!c.honEditadoManual || (c.honBaseCalculo == null && (c.honParteAMonto != null || c.honParteBMonto != null));
  f.idPropiedad = String(c.propiedad?.idPropiedad ?? "");
  f.idComprador = String(c.compradorInquilino?.idPersona ?? "");
  f.garantes = (c.garantesAdicionales || []).map(String);
  f.perPropiedadBId = c.perPropiedadBId ? String(c.perPropiedadBId) : "";
  f.hayCoCorretaje = !!c.esCoCorretaje;
  if (c.estadoOperacion) f.estadoOperacion = c.estadoOperacion;
  // Seña de un temporario cargada antes en dinero: se muestra como porcentaje del precio total
  if (c.tempSeniaPorcentaje == null && Number(c.tempSenia) > 0 && Number(c.tempPrecioTotal) > 0)
    f.tempSeniaPorcentaje = String(Math.round(Number(c.tempSenia) / Number(c.tempPrecioTotal) * 10000) / 100);
  // Alquiler anual: el ajuste real sale del índice y la frecuencia guardados (no de los textos de la pantalla)
  if (c.tipoContrato === "Locacion" && !c.tempCheckIn) {
    f.alqIndiceAjuste = c.indiceAjuste === "ICL" || c.indiceAjuste === "IPC" ? c.indiceAjuste : SIN_AJUSTE;
    if (c.frecuenciaAjusteMeses && FRECUENCIA_POR_MESES[c.frecuenciaAjusteMeses]) f.alqFrecuenciaAjuste = FRECUENCIA_POR_MESES[c.frecuenciaAjusteMeses];
    if (c.alqCanonMonto == null && c.montoTotalOperacion != null) f.alqCanonMonto = c.montoTotalOperacion;
    if (c.alqCanonMoneda == null && c.monedaOperacion) f.alqCanonMoneda = c.monedaOperacion;
    if (!c.alqFechaInicio && c.fechaInicio) f.alqFechaInicio = c.fechaInicio;
    if (!c.alqFechaFin && c.fechaFin) f.alqFechaFin = c.fechaFin;
  }
  return f;
};
const tabDeContrato = (c) => c.tipoContrato === "Compraventa" ? "Venta" : c.tipoContrato === "Permuta" ? "Permuta" : (c.tempCheckIn ? "Temporario" : "Alquiler Anual");

// Noches entre check-in y check-out
const nochesEntre = (a, b) => {
  if (!a || !b) return 0;
  const d = Math.round((new Date(b) - new Date(a)) / 86400000);
  return d > 0 ? d : 0;
};
const hoyLocalISO = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const totalTemporario = (f) => {
  const n = nochesEntre(f.tempCheckIn, f.tempCheckOut);
  const p = Number(f.tempPrecioNoche);
  return n > 0 && p > 0 ? String(Math.round(n * p * 100) / 100) : "";
};

// Pestaña del formulario → tipo de contrato del backend
const TIPO_POR_TAB = { "Venta": "Compraventa", "Permuta": "Permuta", "Alquiler Anual": "Locacion", "Temporario": "Locacion" };
// Desde el DNU 70/2023 el índice y la frecuencia de ajuste se pactan libremente
const MESES_POR_FRECUENCIA = { Mensual: 1, Bimestral: 2, Trimestral: 3, Cuatrimestral: 4, Semestral: 6, Anual: 12 };
const FRECUENCIA_POR_MESES = Object.fromEntries(Object.entries(MESES_POR_FRECUENCIA).map(([k, v]) => [v, k]));
const SIN_AJUSTE = "Sin ajuste";

// Duración del alquiler y fecha del primer ajuste (para mostrar al cargar el contrato)
const sumarMeses = (iso, n) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString("es-AR");
};

const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const txt = (v) => (v === "" || v === undefined ? null : v);

/**
 * Convierte el estado plano del formulario al JSON que espera el backend
 * (ContratoOperacion: propiedad / vendedorPropietario / compradorInquilino anidados + tipo).
 * Devuelve { error } si falta algún dato obligatorio.
 */
function armarContrato(form, tab, propiedades) {
  const tipoContrato = TIPO_POR_TAB[tab];
  if (!tipoContrato) return { error: "Elegí una pestaña de operación (Venta, Permuta, Alquiler o Temporario)." };

  const prop = propiedades.find(p => String(p.idPropiedad) === String(form.idPropiedad));
  if (!prop) return { error: "Seleccioná la propiedad involucrada." };
  const idVendedor = prop.propietarioActual?.idPersona;
  if (!idVendedor) return { error: "La propiedad seleccionada no tiene propietario cargado." };
  if (!form.idComprador) {
    const rol = tab === "Venta" ? "el comprador" : tab === "Permuta" ? "la Parte B" : tab === "Temporario" ? "el huésped titular" : "el locatario";
    return { error: `Seleccioná ${rol}.` };
  }

  // Moneda, monto y fechas según la pestaña
  let moneda, monto, fechaInicio, fechaFin = null;
  if (tab === "Venta") {
    moneda = form.venMoneda; monto = num(form.venPrecio);
    fechaInicio = txt(form.venFechaPosesion) || txt(form.fechaAlta);
    if (!monto || monto <= 0) return { error: "Completá el precio total de la venta." };
  } else if (tab === "Permuta") {
    moneda = form.perDiferenciaMoneda; monto = num(form.perDiferenciaMonto) ?? 0;
    fechaInicio = txt(form.fechaAlta);
    if (!txt(form.perBienesB) && !form.perPropiedadBId) return { error: "Permuta: indicá qué entrega la Parte B (elegí una propiedad cargada o describí el bien)." };
    if (monto < 0) return { error: "La diferencia en efectivo no puede ser negativa." };
    if (String(form.perPropiedadBId) === String(form.idPropiedad)) return { error: "La propiedad de la Parte B no puede ser la misma que la de la Parte A." };
  } else if (tab === "Alquiler Anual") {
    moneda = form.alqCanonMoneda; monto = num(form.alqCanonMonto);
    fechaInicio = txt(form.alqFechaInicio); fechaFin = txt(form.alqFechaFin);
    if (!fechaInicio || !fechaFin) return { error: "Completá las fechas de inicio y fin del contrato." };
    if (fechaFin <= fechaInicio) return { error: "La fecha de fin debe ser posterior a la de inicio." };
    if (!monto || monto <= 0) return { error: "Completá el canon mensual." };
    if (num(form.alqMontoDeposito) !== null && num(form.alqMontoDeposito) < 0) return { error: "El depósito no puede ser negativo." };
  } else {
    moneda = form.tempMoneda; monto = num(form.tempPrecioTotal);
    fechaInicio = txt(form.tempCheckIn); fechaFin = txt(form.tempCheckOut);
    if (!fechaInicio || !fechaFin) return { error: "Completá check-in y check-out." };
    if (fechaFin <= fechaInicio) return { error: "El check-out debe ser posterior al check-in." };
    if (!monto || monto <= 0) return { error: "Completá el precio total de la estadía (o el precio por noche)." };
    if (!(Number(form.tempHuespedes) >= 1)) return { error: "Indicá cuántos huéspedes son (al menos 1)." };
    const pctSenia = num(form.tempSeniaPorcentaje);
    if (pctSenia !== null && (!Number.isFinite(pctSenia) || pctSenia < 0 || pctSenia > 100)) return { error: "La seña debe estar entre 0 y 100 % del precio total de la estadía." };
    if ((num(form.tempDeposito) ?? 0) < 0) return { error: "El depósito no puede ser negativo." };
    const fSen = txt(form.tempSeniaCobradaFecha), fSal = txt(form.tempSaldoCobradoFecha), hoyL = hoyLocalISO();
    if (fSen && !(pctSenia > 0)) return { error: "No hay seña pactada: cargá el porcentaje antes de registrar su cobro." };
    if ((fSen && fSen > hoyL) || (fSal && fSal > hoyL)) return { error: "Las fechas de cobro no pueden ser futuras." };
    if (fSen && fSal && fSal < fSen) return { error: "El saldo no puede cobrarse antes que la seña." };
  }
  if (!fechaInicio) return { error: "Completá la fecha de inicio / alta." };

  // Ajuste (solo alquiler anual): "Fijo" = sin índice
  const esAnual = tab === "Alquiler Anual";
  // ARS: ICL / IPC / sin ajuste (monto fijo). En dólares no se ajusta.
  const ajusta = esAnual && moneda === "ARS" && (form.alqIndiceAjuste === "ICL" || form.alqIndiceAjuste === "IPC");
  const indiceAjuste = ajusta ? form.alqIndiceAjuste : "Ninguno";
  if (esAnual && (form.garantes || []).map(String).includes(String(form.idComprador)))
    return { error: "El locatario no puede ser su propio garante." };

  const c = {
    propiedad: { idPropiedad: Number(form.idPropiedad) },
    vendedorPropietario: { idPersona: idVendedor },
    compradorInquilino: { idPersona: Number(form.idComprador) },
    garantesAdicionales: esAnual ? [...new Set((form.garantes || []).map(Number))] : [],
    tipoContrato,
    estadoOperacion: form.estadoOperacion,
    numeroInterno: txt(form.numeroInterno),
    fechaAlta: txt(form.fechaAlta),
    fechaInicio, fechaFin,
    montoTotalOperacion: monto,
    monedaOperacion: moneda,
    indiceAjuste,
    frecuenciaAjusteMeses: esAnual && indiceAjuste !== "Ninguno" ? MESES_POR_FRECUENCIA[form.alqFrecuenciaAjuste] : null,
    interesMoraDiario: esAnual ? (num(form.interesMoraDiario) ?? 0) : 0,

    // Venta
    venPrecio: num(form.venPrecio), venMoneda: txt(form.venMoneda), venFormaPago: txt(form.venFormaPago),
    venAnticipo: num(form.venAnticipo), venCuotas: num(form.venCuotas), venMontoCuota: num(form.venMontoCuota),
    venMontoReserva: num(form.venMontoReserva), venFechaPosesion: txt(form.venFechaPosesion), venEscribano: txt(form.venEscribano),
    // Permuta
    perBienesA: txt(form.perBienesA) || prop.titulo || null,
    perBienesB: txt(form.perBienesB) || propiedades.find(x => String(x.idPropiedad) === String(form.perPropiedadBId))?.titulo || null,
    perDiferenciaMonto: tipoContrato === "Permuta" ? (num(form.perDiferenciaMonto) ?? 0) : null,
    perDiferenciaMoneda: tipoContrato === "Permuta" ? txt(form.perDiferenciaMoneda) : null,
    perQuienPagaDiferencia: tipoContrato === "Permuta" && Number(form.perDiferenciaMonto) > 0 ? txt(form.perQuienPagaDiferencia) : null,
    perPropiedadBId: tipoContrato === "Permuta" && form.perPropiedadBId ? Number(form.perPropiedadBId) : null,
    // Alquiler anual
    alqFechaInicio: txt(form.alqFechaInicio), alqFechaFin: txt(form.alqFechaFin), alqDestino: txt(form.alqDestino),
    alqCanonMonto: num(form.alqCanonMonto), alqCanonMoneda: txt(form.alqCanonMoneda),
    alqIndiceAjuste: ajusta ? form.alqIndiceAjuste : SIN_AJUSTE, alqFrecuenciaAjuste: ajusta ? txt(form.alqFrecuenciaAjuste) : null, alqMontoDeposito: num(form.alqMontoDeposito),
    alqDiaVencimiento: esAnual ? (num(form.alqDiaVencimiento) ?? 10) : null,
    alqPorcentajeAdministracion: esAnual ? (num(form.alqPorcentajeAdministracion) ?? 10) : null,
    // Temporario
    tempCheckIn: txt(form.tempCheckIn), tempCheckOut: txt(form.tempCheckOut), tempHuespedes: num(form.tempHuespedes),
    tempPrecioNoche: num(form.tempPrecioNoche), tempPrecioTotal: num(form.tempPrecioTotal), tempMoneda: txt(form.tempMoneda),
    tempSeniaPorcentaje: num(form.tempSeniaPorcentaje),
    tempSenia: num(form.tempSeniaPorcentaje) !== null && num(form.tempPrecioTotal) ? Math.round(num(form.tempPrecioTotal) * num(form.tempSeniaPorcentaje)) / 100 : null,
    tempDeposito: num(form.tempDeposito),
    tempSeniaCobradaFecha: txt(form.tempSeniaCobradaFecha), tempSaldoCobradoFecha: txt(form.tempSaldoCobradoFecha),
    // Honorarios
    honMoneda: txt(form.honMoneda), honMontoTotal: totalHonorarios(form),
    honBaseCalculo: num(form.honBase), honEscala: txt(form.honEscala), honEditadoManual: !!form.honEditado,
    honParteAPorcentaje: num(form.honParteAPorcentaje), honParteAMonto: num(form.honParteAMonto), honParteAEstado: txt(form.honParteAEstado), honParteAFormaPago: txt(form.honParteAFormaPago),
    honParteACobrado: num(form.honParteACobrado), honParteAFechaCobro: txt(form.honParteAFechaCobro), honParteAComprobante: txt(form.honParteAComprobante), honParteAFechaEmision: txt(form.honParteAFechaEmision),
    honParteBPorcentaje: num(form.honParteBPorcentaje), honParteBMonto: num(form.honParteBMonto), honParteBEstado: txt(form.honParteBEstado), honParteBFormaPago: txt(form.honParteBFormaPago),
    honParteBCobrado: num(form.honParteBCobrado), honParteBFechaCobro: txt(form.honParteBFechaCobro), honParteBComprobante: txt(form.honParteBComprobante), honParteBFechaEmision: txt(form.honParteBFechaEmision),
    honColegaPorcentaje: form.hayCoCorretaje ? num(form.honColegaPorcentaje) : null,
    // Co-corretaje
    esCoCorretaje: !!form.hayCoCorretaje,
    coNombre: form.hayCoCorretaje ? txt(form.coNombre) : null,
    coMatricula: form.hayCoCorretaje ? txt(form.coMatricula) : null,
    coIntervencion: form.hayCoCorretaje ? txt(form.coIntervencion) : null,
    // Datos legales
    matriculaCorredor: txt(form.matriculaCorredor), domicilioCorredor: txt(form.domicilioCorredor),
    numeroMatriz: txt(form.numeroMatriz), profesionCorredor: txt(form.profesionCorredor),
    certDominioInmueble: txt(form.certDominioInmueble), certGarantias: txt(form.certGarantias),
    fechaFirma: txt(form.fechaFirma), condicionesNegocio: txt(form.condicionesNegocio), minutaOperacion: txt(form.minutaOperacion),
  };
  return { contrato: c };
}

function ContratoForm({ onGuardado, contratoEditar, onCancelar }) {
  const editando = !!contratoEditar;
  const [tabActual, setTabActual] = useState(() => contratoEditar ? tabDeContrato(contratoEditar) : "Venta");
  const [form, setForm] = useState(() => contratoEditar ? formDesdeContrato(contratoEditar) : VACIO);
  const [docsPend, setDocsPend] = useState([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [legalAbierto, setLegalAbierto] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [propiedades, setPropiedades] = useState([]);

  // Carga inicial de datos desde la base
  useEffect(() => {
    const fallas = [];
    getPersonas().then(r => setPersonas(soloClientesReales(r.data))).catch(() => { setPersonas([]); fallas.push("personas"); setErrorCarga(`No se pudieron cargar: ${fallas.join(" y ")}. Revisá que el servidor esté encendido y recargá la página.`); });
    getPropiedades().then(r => setPropiedades(r.data)).catch(() => { setPropiedades([]); fallas.push("propiedades"); setErrorCarga(`No se pudieron cargar: ${fallas.join(" y ")}. Revisá que el servidor esté encendido y recargá la página.`); });
  }, []);

  // Calendario del alquiler temporario: estadías ya cargadas de la propiedad elegida (sin contar esta operación si se está editando)
  const [ocupacion, setOcupacion] = useState({ id: "", datos: [] });
  const idOcupacion = tabActual === "Temporario" ? String(form.idPropiedad || "") : "";
  useEffect(() => {
    if (!idOcupacion) return;
    let vigente = true;
    getOcupacionPropiedad(idOcupacion, contratoEditar?.idOperacion)
      .then(r => { if (vigente) setOcupacion({ id: idOcupacion, datos: r.data || [] }); })
      .catch(() => { if (vigente) setOcupacion({ id: idOcupacion, datos: [] }); });
    return () => { vigente = false; };
  }, [idOcupacion, contratoEditar?.idOperacion]);
  const ocupadas = ocupacion.id === idOcupacion ? ocupacion.datos : [];

  // Solo se pueden contratar propiedades disponibles (lo exige el backend)
  const propiedadesDisponibles = propiedades.filter(p => (!p.estadoPropiedad || p.estadoPropiedad === "Disponible") && !esContenedor(p));
  // En el selector principal solo aparecen las que se ofrecen para la operación de la pestaña elegida
  const opDeTab = OPERACION_DE_TAB[tabActual];
  const propiedadesParaTab = propiedadesDisponibles.filter(p => ofreceOperacion(p, opDeTab));
  const propiedadSel = propiedades.find(p => String(p.idPropiedad) === String(form.idPropiedad));
  const duenio = propiedadSel?.propietarioActual;
  const nombreDuenio = duenio ? duenio.nombreCompleto : (form.idPropiedad ? "La propiedad no tiene propietario" : "Se completa al elegir la propiedad");
  const personasSinDuenio = personas.filter(p => !duenio || p.idPersona !== duenio.idPersona);

  // Campos de partes (reemplazan a los selectores de relleno)
  const campoVendedor = (label) => (
    <div className="form-group"><label>{label}</label><input readOnly value={nombreDuenio} style={{ background: '#f1f5f9' }} /></div>
  );
  const campoComprador = (label) => (
    <div className="form-group">
      <label>{label}</label>
      <select name="idComprador" value={form.idComprador} onChange={handleChange}>
        <option value="">Seleccionar persona...</option>
        {personasSinDuenio.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto} — {p.dniCuit}</option>)}
      </select>
    </div>
  );
  const campoGarantes = (
    <GarantesContrato
      personas={personasSinDuenio.filter(p => String(p.idPersona) !== String(form.idComprador))}
      seleccionados={form.garantes || []}
      onChange={(ids) => setForm(prev => ({ ...prev, garantes: ids }))}
      onCreada={(p) => setPersonas(prev => [...prev, p])}
    />
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setForm(prev => {
      const next = { ...prev, [name]: val };
      // Al cambiar de propiedad se traen SIEMPRE su precio y su moneda (así no queda el de la anterior)
      if (name === "idPropiedad") {
        const p = propiedades.find(x => String(x.idPropiedad) === String(val));
        const precio = p?.precio ?? "";
        // El canon solo se sugiere si la propiedad está publicada para alquiler (si está en venta, su precio NO es un canon)
        const esAlquiler = String(p?.tipoOperacion || "").startsWith("Alquiler");
        next.venPrecio = precio; next.alqCanonMonto = esAlquiler ? precio : "";
        // Si la propiedad se publica por temporada, su precio es el de cada noche
        next.tempPrecioNoche = p?.tipoOperacion === "AlquilerTemporario" ? precio : "";
        next.tempPrecioTotal = totalTemporario(next);
        if (p?.moneda) { next.venMoneda = p.moneda; next.alqCanonMoneda = p.moneda; next.tempMoneda = p.moneda; next.honMoneda = p.moneda; }
      }
      // Quien pasa a ser locatario / Parte B no puede seguir figurando como garante ni como propiedad de B de otra persona
      if (name === "idComprador") {
        next.garantes = (prev.garantes || []).filter(g => String(g) !== String(val));
        next.perPropiedadBId = "";
      }
      // Los honorarios se cobran en la misma moneda que la operación (se puede cambiar después)
      if (["venMoneda", "alqCanonMoneda", "tempMoneda", "perDiferenciaMoneda"].includes(name)) next.honMoneda = val;
      // Alquiler temporario: precio total = noches × precio por noche (mientras no lo hayas escrito a mano)
      if (["tempCheckIn", "tempCheckOut", "tempPrecioNoche"].includes(name)) {
        const anterior = totalTemporario(prev);
        if (prev.tempPrecioTotal === "" || String(prev.tempPrecioTotal) === anterior) next.tempPrecioTotal = totalTemporario(next);
      }
      // Honorarios: escala de la Ley 9.445 (se recalculan solos mientras no se toquen a mano)
      if (!name.startsWith("hon") && !name.startsWith("co") && name !== "hayCoCorretaje") {
        const prop = propiedades.find(x => String(x.idPropiedad) === String(next.idPropiedad)) || contratoEditar?.propiedad;
        return aplicarHonorarios(next, tabActual, prop);
      }
      return next;
    });
  };

  const [verModelos, setVerModelos] = useState(false);
  const handleTab = (tab) => {
    if (editando) return;           // el tipo de operación no se cambia una vez guardada
    setTabActual(tab);
    setVerModelos(false);
    // Si la propiedad ya elegida no se ofrece para esta operación, se deselecciona (el selector solo lista las que sí)
    const actual = propiedades.find(x => String(x.idPropiedad) === String(form.idPropiedad));
    if (actual && !ofreceOperacion(actual, OPERACION_DE_TAB[tab])) {
      avisar(`"${actual.titulo}" no está ofrecida para esta operación. Elegí otra propiedad o activá esa operación en su ficha.`);
      setForm(prev => ({ ...prev, idPropiedad: "", venPrecio: "", alqCanonMonto: "", tempPrecioNoche: "", tempPrecioTotal: "" }));
      return;
    }
    setForm(prev => {
      const p = propiedades.find(x => String(x.idPropiedad) === String(prev.idPropiedad));
      const next = { ...prev };
      // Al pasar a Alquiler Anual con la propiedad ya elegida, se sugiere su canon si está publicada para alquiler
      if (tab === "Alquiler Anual" && (prev.alqCanonMonto === "" || prev.alqCanonMonto == null) && String(p?.tipoOperacion || "").startsWith("Alquiler")) {
        next.alqCanonMonto = p?.precio ?? "";
        if (p?.moneda) next.alqCanonMoneda = p.moneda;
      }
      if (tab === "Temporario" && (prev.tempPrecioNoche === "" || prev.tempPrecioNoche == null) && p?.tipoOperacion === "AlquilerTemporario") {
        next.tempPrecioNoche = p.precio ?? "";
        if (p.moneda) next.tempMoneda = p.moneda;
        next.tempPrecioTotal = totalTemporario(next);
      }
      return aplicarHonorarios(next, tab, p);
    });
  };

  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (guardando) return;

    const { contrato, error } = armarContrato(form, tabActual, propiedades);
    if (error) {
      avisar(`⚠️ ${error}`);
      return;
    }

    setGuardando(true);
    try {
      const prep = ESTADOS_PREPARACION.includes(form.estadoOperacion);
      if (editando) {
        await actualizarContrato(contratoEditar.idOperacion, contrato);
        avisar(`✅ Operación #${contratoEditar.idOperacion} actualizada.`);
      } else {
        const r = await crearContrato(contrato);
        const idNuevo = r.data?.idOperacion;
        const fallos = [];
        if (idNuevo) {
          for (const d of docsPend) {
            try { await subirDocContrato(idNuevo, d.file, d.tipo, d.descripcion); }
            catch (err) { fallos.push(`"${d.file.name}": ${err.response?.data?.error || err.message}`); }
          }
        }
        avisar(`✅ Operación de ${tabActual} guardada` + (prep
          ? " como BORRADOR: la propiedad sigue disponible. Cuando se firme, abrila con \"Editar\" o usá \"Activar\" en el listado."
          : ". La propiedad quedó reservada/alquilada según el tipo de operación.")
          + (fallos.length ? `\n\nNo se pudo subir:\n- ${fallos.join("\n- ")}\nAbrí la operación con "Editar" para volver a intentarlo.` : ""));
        setForm(VACIO);
        setDocsPend([]);
        // refrescar propiedades: la contratada puede haber cambiado de estado
        getPropiedades().then(r2 => setPropiedades(r2.data)).catch(() => {});
      }
      if (onGuardado) onGuardado();
    } catch (err) {
      const msg = err.response?.data?.error || `Error: ${err.message}`;
      avisar(`❌ Error al guardar: ${msg}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="card animation-fade-in">
      <div className="card-header">
        <span className="card-title"><i className="fa-solid fa-file-contract"></i> {editando ? `Editando Operación #${contratoEditar.idOperacion}` : "Generación de Operación / Contrato"}</span>
        <div style={{display: 'flex', gap: '10px'}}>
          {editando && <button type="button" className="btn btn-outline" onClick={() => onCancelar && onCancelar()}>Cancelar edición</button>}
          <button className="btn btn-rojo" onClick={handleSubmit} disabled={guardando}><i className="fa-solid fa-save"></i> {guardando ? "Guardando..." : editando ? "Guardar Cambios" : "Guardar Operación"}</button>
        </div>
      </div>
      {errorCarga && <div role="alert" style={{margin: '15px 20px 0', padding: '10px 14px', background: '#FDECEA', color: '#D32F2F', borderRadius: '8px', fontSize: '0.9rem'}}><i className="fa-solid fa-triangle-exclamation"></i> {errorCarga}</div>}

      <div className="tabs">
        <button className={`tab-btn ${!verModelos && tabActual === 'Venta' ? 'active' : ''}`} disabled={editando && tabActual !== 'Venta'} onClick={() => handleTab('Venta')}><i className="fa-solid fa-tags"></i> Venta</button>
        <button className={`tab-btn ${!verModelos && tabActual === 'Permuta' ? 'active' : ''}`} disabled={editando && tabActual !== 'Permuta'} onClick={() => handleTab('Permuta')}><i className="fa-solid fa-right-left"></i> Permuta</button>
        <button className={`tab-btn ${!verModelos && tabActual === 'Alquiler Anual' ? 'active' : ''}`} disabled={editando && tabActual !== 'Alquiler Anual'} onClick={() => handleTab('Alquiler Anual')}><i className="fa-solid fa-calendar-days"></i> Alquiler Anual</button>
        <button className={`tab-btn ${!verModelos && tabActual === 'Temporario' ? 'active' : ''}`} disabled={editando && tabActual !== 'Temporario'} onClick={() => handleTab('Temporario')}><i className="fa-solid fa-umbrella-beach"></i> Alq. Temporario</button>
        <button className={`tab-btn ${verModelos ? 'active' : ''}`} onClick={() => setVerModelos(true)} style={{marginLeft: 'auto', borderLeft: '1px solid #ddd', color: 'var(--color-rojo)'}}><i className="fa-regular fa-file-pdf"></i> Modelos de Contratos</button>
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        
        {/* =========================================================
            PESTAÑA: MODELOS DE CONTRATOS
        ========================================================= */}
        {verModelos ? (
          <div className="tab-content active" style={{padding: '40px 25px', textAlign: 'center'}}>
            <i className="fa-solid fa-file-signature" style={{fontSize: '3rem', color: '#D32F2F', marginBottom: '20px'}}></i>
            <h3 style={{color: 'var(--color-negro)', marginBottom: '10px'}}>Plantillas y Modelos Legales</h3>
            <p style={{color: 'var(--color-gris-texto)', maxWidth: '600px', margin: '0 auto 30px auto'}}>
              Descarga los modelos base para redactar tus contratos bajo la normativa vigente del Código Civil y Comercial.
            </p>
            
            <div style={{display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap'}}>
                <a href="/CONTRATO DE LOCACIÓN MODELO.pdf" download="CONTRATO DE LOCACIÓN MODELO.pdf" className="btn btn-outline" style={{padding: '15px 30px', fontSize: '1.05rem', borderColor: 'var(--color-rojo)', color: 'var(--color-rojo)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <i className="fa-regular fa-file-pdf" style={{fontSize: '1.5rem'}}></i> 
                    <div style={{textAlign: 'left'}}>
                       <span style={{display: 'block', fontWeight: 'bold'}}>Contrato de Locación</span>
                       <span style={{fontSize: '0.8rem', color: '#666'}}>Modelo Estándar (Vivienda)</span>
                    </div>
                </a>

                {/* Nuevo Botón: Reserva Ad Referendum */}
                <a href="/RESERVA AD REFERENDUM.doc" download="RESERVA AD REFERENDUM.doc" className="btn btn-outline" style={{padding: '15px 30px', fontSize: '1.05rem', borderColor: 'var(--color-rojo)', color: 'var(--color-rojo)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <i className="fa-regular fa-file-word" style={{fontSize: '1.5rem'}}></i> 
                    <div style={{textAlign: 'left'}}>
                       <span style={{display: 'block', fontWeight: 'bold'}}>Reserva Ad Referendum</span>
                       <span style={{fontSize: '0.8rem', color: '#666'}}>Modelo Estandar (Reserva de Venta)</span>
                    </div>
                </a>
            </div>
          </div>
        ) : (
          /* =========================================================
              CONTENIDO DE OPERACIONES
          ========================================================= */
          <>
            <div style={{padding: '20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #eee'}}>
              <div className="form-row" style={{marginBottom: 0}}>
                 <div className="form-group" style={{flex: 2}}>
                    <label>{editando ? "Propiedad (no se puede cambiar)" : "Propiedad Involucrada (trae su precio y moneda)"}</label>
                    {editando ? (
                      <input readOnly value={propiedadSel?.titulo || contratoEditar.propiedad?.titulo || ""} style={{fontWeight: 'bold', background: '#f1f5f9'}} />
                    ) : (
                    <select name="idPropiedad" value={form.idPropiedad} onChange={handleChange} style={{fontWeight: 'bold', borderColor: 'var(--color-rojo)'}}>
                       <option value="">Seleccionar Propiedad...</option>
                       {propiedadesParaTab.map(p => <option key={p.idPropiedad} value={p.idPropiedad}>{p.titulo}</option>)}
                    </select>
                    )}
                 </div>
                 <div className="form-group">
                    <label>Estado de la Operación</label>
                    <select name="estadoOperacion" value={form.estadoOperacion} onChange={handleChange} title="Borrador, En preparación, Documentación pendiente y Lista para contrato NO bloquean la propiedad. Firmada y Vigente la bloquean.">
                       <optgroup label="En preparación (no bloquea la propiedad)">
                          {ESTADOS_PREPARACION.map(e => <option key={e}>{e}</option>)}
                       </optgroup>
                       <optgroup label="Operación firmada (bloquea la propiedad)">
                          {ESTADOS_ACTIVOS.map(e => <option key={e}>{e}</option>)}
                       </optgroup>
                    </select>
                 </div>
                 <InputG label="Fecha de Alta" name="fechaAlta" type="date" valorActual={form.fechaAlta} onChange={handleChange} />
              </div>
            </div>

            {/* TAB: VENTA */}
            {tabActual === 'Venta' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Partes Intervinientes</h6>
                <div className="form-row">
                  {campoVendedor("Vendedor (Propietario de la propiedad)")}
                  {campoComprador("Comprador")}
                </div>
                
                <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-money-bill-wave"></i> Condiciones Económicas</h6>
                <div className="form-row" style={{backgroundColor: '#E8F5E9', padding: '15px', borderRadius: '8px'}}>
                  <InputG label="Precio Total Acordado" name="venPrecio" type="number" valorActual={form.venPrecio} onChange={handleChange} />
                  <div className="form-group"><label>Moneda</label><select name="venMoneda" value={form.venMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                  <div className="form-group"><label>Forma de Pago</label><select name="venFormaPago" value={form.venFormaPago} onChange={handleChange}><option>Contado</option><option>Financiación</option><option>Permuta parcial</option></select></div>
                </div>

                {form.venFormaPago === "Financiación" && (
                  <div className="form-row animation-fade-in" style={{marginTop: '15px'}}>
                     <InputG label="Anticipo" name="venAnticipo" type="number" valorActual={form.venAnticipo} onChange={handleChange} />
                     <InputG label="Cant. Cuotas" name="venCuotas" type="number" valorActual={form.venCuotas} onChange={handleChange} />
                     <InputG label="Monto por Cuota" name="venMontoCuota" type="number" valorActual={form.venMontoCuota} onChange={handleChange} />
                  </div>
                )}

                <div className="form-row" style={{marginTop: '15px'}}>
                   <InputG label="Monto Reserva/Seña" name="venMontoReserva" type="number" valorActual={form.venMontoReserva} onChange={handleChange} />
                   <InputG label="Fecha Est. Posesión" name="venFechaPosesion" type="date" valorActual={form.venFechaPosesion} onChange={handleChange} />
                   <InputG label="Escribano Designado" name="venEscribano" valorActual={form.venEscribano} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* TAB: PERMUTA */}
            {tabActual === 'Permuta' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                 <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Partes Intervinientes</h6>
                 <div className="form-row">
                    {campoVendedor("Parte A (Propietario de la propiedad)")}
                    {campoComprador("Parte B")}
                 </div>

                 <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-right-left"></i> Intercambio de Bienes</h6>
                 {(() => {
                   // Propiedades ya cargadas que figuran a nombre de la Parte B y están libres
                   const deB = propiedadesDisponibles.filter(x => form.idComprador && String(x.propietarioActual?.idPersona) === String(form.idComprador) && String(x.idPropiedad) !== String(form.idPropiedad));
                   return (
                     <div className="form-row">
                       <div className="form-group" style={{flex: 2}}>
                         <label>Propiedad que entrega la Parte B (si ya está cargada en el sistema)</label>
                         <select name="perPropiedadBId" value={form.perPropiedadBId} onChange={handleChange} disabled={!form.idComprador}>
                           <option value="">{form.idComprador ? (deB.length ? "Ninguna: entrega otro bien (describirlo abajo)" : "La Parte B no tiene propiedades libres cargadas") : "Primero elegí la Parte B"}</option>
                           {deB.map(x => <option key={x.idPropiedad} value={x.idPropiedad}>{x.titulo}</option>)}
                         </select>
                         <small style={{color: 'var(--color-gris-texto)'}}>Al firmar, las dos propiedades quedan como "Permutadas" y al cerrar la permuta cada una pasa a nombre de la otra parte.</small>
                       </div>
                     </div>
                   );
                 })()}
                 <div className="form-row">
                    <InputG label="Bienes Entregados por A" name="perBienesA" ph={propiedadSel ? `Por defecto: ${propiedadSel.titulo}` : "Ej: Dpto Centro + Auto"} valorActual={form.perBienesA} onChange={handleChange} col={2} />
                    <InputG label={form.perPropiedadBId ? "Otros bienes entregados por B (opcional)" : "Bienes Entregados por B *"} name="perBienesB" ph="Ej: Lote San Ignacio" valorActual={form.perBienesB} onChange={handleChange} col={2} />
                 </div>

                 <div className="form-row" style={{backgroundColor: '#FFF3E0', padding: '15px', borderRadius: '8px'}}>
                    <InputG label="Diferencia en Efectivo (0 si no hay)" name="perDiferenciaMonto" type="number" min="0" valorActual={form.perDiferenciaMonto} onChange={handleChange} icon="fa-money-bill-transfer" />
                    {Number(form.perDiferenciaMonto) > 0 && (<>
                      <div className="form-group"><label>Moneda Diferencia</label><select name="perDiferenciaMoneda" value={form.perDiferenciaMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                      <div className="form-group"><label>Quién abona</label><select name="perQuienPagaDiferencia" value={form.perQuienPagaDiferencia} onChange={handleChange}><option>Parte A</option><option>Parte B</option></select></div>
                    </>)}
                 </div>
                 <p style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)', marginTop: '8px'}}>
                   <i className="fa-solid fa-circle-info"></i> Los honorarios se calculan por defecto sobre el valor de la propiedad de la Parte A ({propiedadSel?.precio ? `${(simboloMoneda(propiedadSel.moneda) + " ")}${Number(propiedadSel.precio).toLocaleString("es-AR")}` : "elegila arriba"}). Podés corregir porcentaje y monto en la sección de honorarios.
                 </p>
              </div>
            )}

            {/* TAB: ALQUILER ANUAL */}
            {tabActual === 'Alquiler Anual' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Partes Intervinientes</h6>
                <div className="form-row">
                  {campoVendedor("Locador (Propietario)")}
                  {campoComprador("Locatario")}
                  {campoGarantes}
                </div>

                <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-file-invoice-dollar"></i> Condiciones del Contrato</h6>
                <div className="form-row">
                  <InputG label="Inicio Contrato" name="alqFechaInicio" type="date" valorActual={form.alqFechaInicio} onChange={handleChange} />
                  <InputG label="Fin Contrato" name="alqFechaFin" type="date" valorActual={form.alqFechaFin} onChange={handleChange} />
                  <div className="form-group"><label>Destino</label><select name="alqDestino" value={form.alqDestino} onChange={handleChange}><option>Vivienda</option><option>Comercial</option></select></div>
                </div>
                
                <div className="form-row" style={{backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px'}}>
                  <InputG label="Canon Mensual Acordado" name="alqCanonMonto" type="number" valorActual={form.alqCanonMonto} onChange={handleChange} icon="fa-money-bill" />
                  <div className="form-group"><label>Moneda</label><select name="alqCanonMoneda" value={form.alqCanonMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                  {form.alqCanonMoneda === "ARS" && (<>
  <div className="form-group"><label>Índice Ajuste</label><select name="alqIndiceAjuste" value={form.alqIndiceAjuste} onChange={handleChange}><option>ICL</option><option>IPC</option><option>Sin ajuste</option></select></div>
<div className="form-group"><label>Frecuencia Ajuste</label><select name="alqFrecuenciaAjuste" value={form.alqFrecuenciaAjuste} onChange={handleChange} disabled={form.alqIndiceAjuste === "Sin ajuste"}>{Object.keys(MESES_POR_FRECUENCIA).map(f => <option key={f}>{f}</option>)}</select></div>
                  </>)}
                </div>
                {(() => {
                  const meses = mesesEntre(form.alqFechaInicio, form.alqFechaFin);
                  if (!meses) return null;
                  const canon = Number(form.alqCanonMonto) || 0;
                  const ajusta = form.alqCanonMoneda === "ARS" && form.alqIndiceAjuste !== "Sin ajuste";
                  const cada = MESES_POR_FRECUENCIA[form.alqFrecuenciaAjuste];
                  return (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-gris-texto)', margin: '8px 0 12px' }}>
                      <i className="fa-solid fa-circle-info"></i> Duración: <strong>{meses} meses</strong>
                      {canon > 0 && <> · Total a canon inicial: <strong>{(simboloMoneda(form.alqCanonMoneda) + " ")}{(canon * meses).toLocaleString("es-AR")}</strong></>}
                      {ajusta && cada && meses > cada && <> · Primer ajuste ({form.alqIndiceAjuste}): <strong>{sumarMeses(form.alqFechaInicio, cada)}</strong></>}
                      {!ajusta && <> · Canon fijo durante todo el contrato</>}
                    </p>
                  );
                })()}
                <div className="form-row">
                  <InputG label="Depósito en garantía" name="alqMontoDeposito" type="number" valorActual={form.alqMontoDeposito} onChange={handleChange} />
                  <InputG label="Interés diario por mora (0.0005 = 0,05 % por día)" name="interesMoraDiario" type="number" valorActual={form.interesMoraDiario} onChange={handleChange} />
                  <InputG label="Día de vencimiento del pago (1 a 28)" name="alqDiaVencimiento" type="number" min="1" step="1" valorActual={form.alqDiaVencimiento} onChange={handleChange} />
                  <InputG label="Honorarios de administración (% del alquiler cobrado)" name="alqPorcentajeAdministracion" type="number" min="0" max="100" step="0.5" valorActual={form.alqPorcentajeAdministracion} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* TAB: TEMPORARIO */}
            {tabActual === 'Temporario' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Locador y Huéspedes</h6>
                <div className="form-row">
                  {campoVendedor("Locador (Propietario)")}
                  {campoComprador("Huésped Titular")}
                </div>

                <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-calendar-check"></i> Fechas y Tarifas</h6>
                {form.idPropiedad ? (
                  <div style={{marginBottom: '15px', padding: '12px', border: '1px solid var(--color-gris-borde, #ddd)', borderRadius: '8px'}}>
                    <strong style={{fontSize: '0.9rem'}}><i className="fa-solid fa-calendar-days"></i> Disponibilidad de esta propiedad</strong>
                    <p style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)', margin: '2px 0 10px'}}>Tocá el día de llegada y después el de salida para cargar las fechas. Las noches en rojo ya están confirmadas.</p>
                    <CalendarioDisponibilidad
                      ocupadas={ocupadas}
                      seleccion={{ desde: form.tempCheckIn, hasta: form.tempCheckOut }}
                      onSeleccion={({ desde, hasta }) => {
                        handleChange({ target: { name: "tempCheckIn", value: desde, type: "text" } });
                        handleChange({ target: { name: "tempCheckOut", value: hasta, type: "text" } });
                      }}
                    />
                  </div>
                ) : (
                  <p style={{fontSize: '0.85rem', color: 'var(--color-gris-texto)'}}><i className="fa-solid fa-circle-info"></i> Elegí la propiedad para ver su calendario de disponibilidad.</p>
                )}
                <div className="form-row">
                  <InputG label="Check-in" name="tempCheckIn" type="date" valorActual={form.tempCheckIn} onChange={handleChange} />
                  <InputG label="Check-out" name="tempCheckOut" type="date" valorActual={form.tempCheckOut} onChange={handleChange} />
                  <InputG label="Huéspedes Totales" name="tempHuespedes" type="number" min="1" valorActual={form.tempHuespedes} onChange={handleChange} />
                </div>
                <div className="form-row" style={{backgroundColor: '#F5F5F5', border: '1px solid #ddd', padding: '15px', borderRadius: '8px'}}>
                  <InputG label="Precio por Noche" name="tempPrecioNoche" type="number" min="0" valorActual={form.tempPrecioNoche} onChange={handleChange} />
                  <InputG label="Precio Total" name="tempPrecioTotal" type="number" min="0" valorActual={form.tempPrecioTotal} onChange={handleChange} icon="fa-wallet" />
                  <div className="form-group"><label>Moneda</label><select name="tempMoneda" value={form.tempMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                </div>
                <div className="form-row">
                  <InputG label="Seña / reserva (% del precio total)" name="tempSeniaPorcentaje" type="number" min="0" max="100" step="0.01" ph="Ej: 30" icon="fa-percent" valorActual={form.tempSeniaPorcentaje} onChange={handleChange} />
                  <InputG label="Depósito reembolsable en garantía" name="tempDeposito" type="number" min="0" valorActual={form.tempDeposito} onChange={handleChange} />
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-gris-texto)', margin: '0 0 6px' }}><i className="fa-solid fa-circle-info"></i> Estas fechas se completan solas al emitir el recibo en Finanzas y Cobros, pestaña «Cobranza Estadías». Cargalas a mano solo si el pago ya se hizo antes y no necesitás recibo.</p>
                <div className="form-row">
                  <InputG label="Seña cobrada el (opcional)" name="tempSeniaCobradaFecha" type="date" max={hoyLocalISO()} valorActual={form.tempSeniaCobradaFecha} onChange={handleChange} />
                  <InputG label="Saldo cobrado el (opcional)" name="tempSaldoCobradoFecha" type="date" max={hoyLocalISO()} valorActual={form.tempSaldoCobradoFecha} onChange={handleChange} />
                </div>
                {(() => {
                  const noches = nochesEntre(form.tempCheckIn, form.tempCheckOut);
                  if (!noches) return null;
                  const total = Number(form.tempPrecioTotal) || 0;
                  const pctSenia = Number(form.tempSeniaPorcentaje) || 0;
                  const senia = Math.round(total * pctSenia) / 100;
                  const sim = (simboloMoneda(form.tempMoneda) + " ");
                  return (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-gris-texto)', margin: '8px 0 12px' }}>
                      <i className="fa-solid fa-circle-info"></i> <strong>{noches} noche{noches === 1 ? "" : "s"}</strong>
                      {total > 0 && senia > 0 && <> · Seña ({pctSenia} %): <strong>{sim}{senia.toLocaleString("es-AR")}</strong></>}
                      {total > 0 && <> · Saldo a cobrar: <strong>{sim}{Math.max(total - senia, 0).toLocaleString("es-AR")}</strong></>}
                      {!editando && form.tempCheckIn && form.tempCheckIn < hoyLocalISO() && <span style={{ color: '#E65100' }}> · Atención: el check-in es una fecha pasada.</span>}
                      {noches > 90 && <span style={{ color: '#E65100' }}> · Atención: son más de 90 noches; verificá si corresponde tratarlo como un alquiler anual.</span>}
                      <br />Varias estadías pueden cargarse sobre la misma propiedad si sus fechas no se pisan: el temporario no la bloquea.
                    </p>
                  );
                })()}
              </div>
            )}

            <HonorariosOperacion form={form} setForm={setForm} tab={tabActual} propiedad={propiedadSel} />

            <div style={{padding: '0 25px 25px', backgroundColor: '#fff'}}>
                {/* =========================================================
                    MÓDULO TRANSVERSAL: CO-CORRETAJE
                ========================================================= */}
                <div style={{backgroundColor: '#FFF8F8', padding: '20px', borderRadius: '8px', border: '1px solid #FFCDD2', marginTop: '20px'}}>
                    <div className="checkbox-group" style={{margin: 0}}>
                        <input type="checkbox" id="hayCoCorretaje" name="hayCoCorretaje" checked={form.hayCoCorretaje} onChange={handleChange} style={{transform: 'scale(1.2)'}} />
                        <label htmlFor="hayCoCorretaje" style={{fontWeight: 'bold', color: 'var(--color-rojo)'}}>Habilitar Co-Corretaje (Inmobiliaria Colega Externa)</label>
                    </div>
                    
                    {form.hayCoCorretaje && (
                        <div className="animation-fade-in" style={{marginTop: '20px', borderTop: '1px dashed #FFCDD2', paddingTop: '15px'}}>
                            <div className="form-row" style={{marginBottom: 0}}>
                                <InputG label="Inmobiliaria / Agente Externa" name="coNombre" valorActual={form.coNombre} onChange={handleChange} col={2} />
                                <InputG label="Matrícula" name="coMatricula" valorActual={form.coMatricula} onChange={handleChange} />
                                <div className="form-group"><label>Intervención</label><select name="coIntervencion" value={form.coIntervencion} onChange={handleChange}><option>Representa Comprador/Locatario</option><option>Representa Vendedor/Locador</option></select></div>
                            </div>
                            <div className="form-row" style={{marginTop: '12px', marginBottom: 0, alignItems: 'flex-end'}}>
                                <InputG label="Parte de los honorarios para la colega (%)" name="honColegaPorcentaje" type="number" min="0" step="0.01" valorActual={form.honColegaPorcentaje} onChange={handleChange} />
                                <div className="form-group" style={{flex: 2, fontSize: '0.9rem'}}>
                                    {(() => {
                                        const tot = totalHonorarios(form);
                                        const pct = Math.min(Math.max(Number(form.honColegaPorcentaje) || 0, 0), 100);
                                        const colega = Math.round(tot * pct) / 100;
                                        const simbolo = simboloMoneda(form.honMoneda);
                                        return <span>Para la colega: <strong>{simbolo} {colega.toLocaleString("es-AR")}</strong> · Te quedan: <strong>{simbolo} {(Math.round((tot - colega) * 100) / 100).toLocaleString("es-AR")}</strong></span>;
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================
                DATOS LEGALES DEL CORREDOR (Art. 32 a 36 Ley 25.028) — opcional
            ========================================================= */}
            <div style={{padding: '15px 25px', borderTop: '2px solid #eee', backgroundColor: '#fff'}}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setLegalAbierto(v => !v)}>
                  <i className={`fa-solid ${legalAbierto ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i> Datos legales y verificaciones del corredor (opcional)
                </button>
                {legalAbierto && (
                  <div className="animation-fade-in" style={{marginTop: '15px'}}>
                    <div className="form-row">
                      <InputG label="Matrícula del corredor" name="matriculaCorredor" maxLength={50} valorActual={form.matriculaCorredor} onChange={handleChange} />
                      <InputG label="Profesión" name="profesionCorredor" maxLength={100} valorActual={form.profesionCorredor} onChange={handleChange} />
                      <InputG label="N° de matriz (libro de registro)" name="numeroMatriz" maxLength={50} valorActual={form.numeroMatriz} onChange={handleChange} />
                    </div>
                    <div className="form-row">
                      <InputG label="Domicilio del corredor" name="domicilioCorredor" maxLength={200} col={2} valorActual={form.domicilioCorredor} onChange={handleChange} />
                      <InputG label="Fecha de firma" name="fechaFirma" type="date" valorActual={form.fechaFirma} onChange={handleChange} />
                    </div>
                    <div className="form-row">
                      <InputG label="Certificado de dominio (N° / referencia)" name="certDominioInmueble" maxLength={200} valorActual={form.certDominioInmueble} onChange={handleChange} />
                      <InputG label="Certificado de garantías (N° / referencia)" name="certGarantias" maxLength={200} valorActual={form.certGarantias} onChange={handleChange} />
                    </div>
                    <div className="form-group"><label>Condiciones del negocio</label><textarea name="condicionesNegocio" rows="3" value={form.condicionesNegocio} onChange={handleChange} placeholder="Acuerdos particulares, plazos, entrega de llaves, etc."></textarea></div>
                    <div className="form-group"><label>Minuta de la operación</label><textarea name="minutaOperacion" rows="3" value={form.minutaOperacion} onChange={handleChange} placeholder="Resumen de lo acordado entre las partes"></textarea></div>
                  </div>
                )}
            </div>

            {/* =========================================================
                MÓDULO TRANSVERSAL: DOCUMENTACIÓN
            ========================================================= */}
            <div style={{backgroundColor: '#F8FAFC', padding: '25px', borderRadius: '8px', margin: '25px', border: '1px solid var(--color-gris-borde)', textAlign: 'center'}}>
                <h6 style={{marginBottom: '15px', color: 'var(--color-negro)'}}><i className="fa-solid fa-folder-open" style={{color:'#D32F2F'}}></i> Documentación de la Operación</h6>
                <p style={{fontSize: '0.85rem', color: 'var(--color-gris-texto)', marginBottom: '15px'}}>DNIs, garantías, escrituras, reserva o contrato firmado (solo PDF). Arrastralos o elegilos: quedan guardados en el servidor.</p>
                <DocumentosContrato idOperacion={editando ? contratoEditar.idOperacion : null} docsPend={docsPend} setDocsPend={setDocsPend} />
            </div>
          </>
        )}

      </form>
    </div>
  );
}
export default ContratoForm;
