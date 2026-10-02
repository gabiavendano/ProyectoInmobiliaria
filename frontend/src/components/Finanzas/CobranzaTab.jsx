import { useState, useEffect, useMemo } from "react";
import { getPropiedades, getContratos, getCobros, getCargos, registrarCobro, anularCobro } from "../../services/api";
import { fmtMonto, mesActual, hoyIso, fechaVencimiento, difMeses, sumarMeses, nombreMes, calcularCobro, estadoMes, esAlquilerMes, etiquetaCobro } from "../../utils/finanzas";
import { fmtFecha } from "../../utils/personas";
import { esContenedor } from "../../utils/propiedad";
import { pdfRecibo } from "../../utils/pdfFinanzas";
import PdfModal from "./PdfModal";
import CalcularAjuste from "./CalcularAjuste";
import { monedaDeContrato } from "../../utils/monedas";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const MEDIOS = ["Transferencia Bancaria", "Efectivo (Caja)", "Cheque", "Mercado Pago"];
const esAlquilerAnual = (c) => c.tipoContrato === "Locacion" && c.estadoContrato === "Vigente" && !(c.tempCheckIn || c.tempCheckOut);
const mesDe = (iso) => String(iso || "").slice(0, 7);
const msgError = (e) => e?.response?.data?.error || e?.message || "Error inesperado";

/** Cobranza Inquilino: liquidación mensual (alquiler + mora + servicios) con recibo oficial correlativo. */
export default function CobranzaTab({ onCambio }) {
  const [propiedades, setPropiedades] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [error, setError] = useState("");
  const [recarga, setRecarga] = useState(0);

  const [propId, setPropId] = useState("");
  const [unidadId, setUnidadId] = useState("");
  const [mes, setMes] = useState(mesActual());
  const [vencManual, setVencManual] = useState(null);
  const [fechaPago, setFechaPago] = useState(hoyIso());
  const [verAjuste, setVerAjuste] = useState(false);
  const [esperadoManual, setEsperadoManual] = useState(null);   // alquiler total del mes (si se corrige a mano)
  const [importeManual, setImporteManual] = useState(null);     // lo que se cobra en este pago
  const [concepto, setConcepto] = useState("Alquiler");         // Alquiler | Indemnización por rescisión | Otro
  const [otroTexto, setOtroTexto] = useState("");
  const [pctManual, setPctManual] = useState(null);
  const [moraInmo, setMoraInmo] = useState(false);
  const [medioPago, setMedioPago] = useState(MEDIOS[0]);
  const [obs, setObs] = useState("");
  const [excluidos, setExcluidos] = useState([]);       // servicios que NO se cobran este mes
  const [guardando, setGuardando] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [aviso, setAviso] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([getPropiedades(), getContratos(), getCobros(), getCargos("Pendiente")])
      .then(([p, c, l, g]) => { if (!vivo) return; setPropiedades(p.data); setContratos(c.data.filter(esAlquilerAnual)); setCobros(l.data); setCargos(g.data); setError(""); })
      .catch((e) => { if (vivo) setError("No se pudieron cargar los datos: " + msgError(e)); });
    return () => { vivo = false; };
  }, [recarga]);

  const vigentes = useMemo(() => cobros.filter((l) => !l.anulada), [cobros]);
  const contratoDe = (idProp) => contratos.find((c) => c.propiedad?.idPropiedad === idProp) || null;

  // Propiedad / Complejo -> Unidad / Locatario
  const opciones = useMemo(() => {
    const complejos = propiedades.filter(esContenedor).map((p) => ({ p, unidades: propiedades.filter((u) => u.idComplejo === p.idPropiedad).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "es", { numeric: true })) }));
    const sueltas = propiedades.filter((p) => !esContenedor(p) && !p.idComplejo && contratos.some((c) => c.propiedad?.idPropiedad === p.idPropiedad)).map((p) => ({ p, unidades: [p] }));
    return [...complejos, ...sueltas];
  }, [propiedades, contratos]);
  const opcion = opciones.find((o) => String(o.p.idPropiedad) === String(propId)) || opciones[0] || null;
  const unidad = opcion ? (opcion.unidades.find((u) => String(u.idPropiedad) === String(unidadId)) || opcion.unidades[0] || null) : null;
  const contrato = unidad ? contratoDe(unidad.idPropiedad) : null;
  const inquilino = contrato?.compradorInquilino?.nombreCompleto || null;
  const mon = monedaDeContrato(contrato);

  const esAlq = concepto === "Alquiler";
  const ultimoCobro = contrato ? vigentes.filter((l) => l.contrato?.idOperacion === contrato.idOperacion && esAlquilerMes(l))
    .sort((a, b) => b.mesAnoLiquidado.localeCompare(a.mesAnoLiquidado) || b.idLiquidacion - a.idLiquidacion)[0] : null;
  const baseSugerida = contrato ? (ultimoCobro ? Number(ultimoCobro.montoAlquilerMes ?? ultimoCobro.montoAlquilerBase) : Number(contrato.alqCanonMonto || contrato.montoTotalOperacion || 0)) : 0;

  // Estado del alquiler del mes: un mes puede cobrarse en varios pagos (a cuenta y saldo)
  const est = contrato ? estadoMes(vigentes, contrato.idOperacion, mes, baseSugerida) : null;
  const esperado = esperadoManual != null ? (Number(esperadoManual) || 0) : (est ? est.esperado : 0);
  const pagadoMes = est ? est.pagado : 0;
  const saldo = Math.max(0, r2(esperado - pagadoMes));
  const completo = !!est && est.cobros.length > 0 && saldo <= 0.005;
  const bloqueado = !contrato || (esAlq && completo);
  const importe = importeManual ?? (esAlq ? (saldo > 0 ? String(saldo) : "") : "");
  const pct = pctManual ?? String(contrato?.alqPorcentajeAdministracion ?? 10);
  const venc = esAlq ? (vencManual ?? (contrato ? fechaVencimiento(mes, contrato.alqDiaVencimiento || 10) : "")) : fechaPago;
  const mesEnvio = esAlq ? mes : String(fechaPago).slice(0, 7);
  const conceptoEnviado = esAlq ? "Alquiler" : (concepto === "Otro" ? otroTexto.trim() : concepto);

  // Ajuste de índice
  const ini = mesDe(contrato?.alqFechaInicio || contrato?.fechaInicio);
  const n = Number(contrato?.frecuenciaAjusteMeses) || 0;
  const indice = contrato?.indiceAjuste;
  const usaIndice = contrato && ini && n > 0 && (indice === "ICL" || indice === "IPC");
  const k = usaIndice ? difMeses(ini, mes) : 0;
  const requiereActualizacion = usaIndice && k > 0 && k % n === 0;
  const proximoAumento = usaIndice ? sumarMeses(ini, (Math.floor(Math.max(k, 0) / n) + (k % n === 0 && k > 0 ? 0 : 1)) * n) : null;

  // Meses anteriores con saldo sin cobrar (deuda previa)
  const adeudados = [];
  let deudaPrevia = 0;
  if (contrato) for (let i = 1; i <= 12; i++) {
    const m = sumarMeses(mes, -i);
    if (ini && m < ini) break;
    const e = estadoMes(vigentes, contrato.idOperacion, m, baseSugerida);
    if (!e.completo) { adeudados.push(m); deudaPrevia += e.saldo; }
  }

  const cargosUnidad = esAlq && unidad ? cargos.filter((g) => g.propiedad?.idPropiedad === unidad.idPropiedad) : [];
  const serviciosSel = cargosUnidad.filter((g) => !excluidos.includes(g.idCargo));
  const montoServicios = serviciosSel.reduce((t, g) => t + Number(g.monto), 0);

  const calc = contrato ? calcularCobro({ base: importe, vencimiento: venc, fechaPago, tasaMora: esAlq ? contrato.interestMoraDiario : 0, pctHonorarios: pct, moraInmobiliaria: esAlq && moraInmo, coCorretaje: !!contrato.esCoCorretaje }) : null;
  const totalCobrar = calc ? calc.total + montoServicios : 0;

  const reiniciar = () => { setVencManual(null); setEsperadoManual(null); setImporteManual(null); setExcluidos([]); setAviso(""); };
  const cambiarPropiedad = (v) => { setPropId(v); setUnidadId(""); reiniciar(); };
  const cambiarUnidad = (v) => { setUnidadId(v); reiniciar(); };
  const cambiarMes = (v) => { if (v) { setMes(v); reiniciar(); } };

  // Borrador del recibo con la forma de un cobro guardado (el N° se asigna recién al confirmar)
  const borrador = () => ({
    numeroRecibo: null, moneda: mon, fechaPagoReal: fechaPago, mesAnoLiquidado: mesEnvio, medioPago,
    concepto: conceptoEnviado, pagoParcial: esAlq && Number(importe) < esperado - 0.005,
    saldoAlquilerPendiente: esAlq ? Math.max(0, r2(esperado - pagadoMes - Number(importe))) : null,
    montoAlquilerBase: Number(importe), montoMoraCalculado: calc.mora, diasAtraso: calc.dias,
    serviciosDetalle: serviciosSel.map((g) => `${g.concepto} ${nombreMes(g.periodoMesAnio)}|${g.monto}`).join("\n"),
    totalAbonadoInquilino: totalCobrar, contrato,
  });
  const limpio = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const nombreArchivo = (num) => `Recibo_${num || mesEnvio}_${limpio(unidad?.titulo)}_${limpio(inquilino)}.pdf`;

  // Paso 1: validar y mostrar la vista previa del recibo (todavía no se guarda nada)
  const generarVistaPrevia = async () => {
    if (guardando || !contrato || !calc) return;
    if (!(Number(importe) > 0)) { setAviso(esAlq ? "Indicá el importe que se cobra ahora (mayor a cero)." : "El importe debe ser mayor a cero."); return; }
    if (esAlq && !(esperado > 0)) { setAviso("Indicá el alquiler total del mes."); return; }
    if (esAlq && Number(importe) > saldo + 0.005) { setAviso(`El importe supera lo que falta cobrar del mes (${fmtMonto(saldo, mon)}).`); return; }
    if (!esAlq && concepto === "Otro" && (otroTexto.trim().length < 3 || /^alquiler$/i.test(otroTexto.trim()))) { setAviso("Describí el concepto del cobro (ej: reparación, multa)."); return; }
    if (esAlq && !venc) { setAviso("Indicá la fecha de vencimiento."); return; }
    if (!fechaPago) { setAviso("Indicá la fecha de pago."); return; }
    const p = Number(pct);
    if (!(p >= 0 && p <= 100)) { setAviso("Los honorarios deben estar entre 0 y 100 %."); return; }
    setAviso("");
    setPdf({ doc: await pdfRecibo(borrador()), titulo: "Vista Previa del Recibo Oficial", archivo: nombreArchivo(), preview: true });
  };

  // Paso 2: confirmar en la vista previa -> registra el cobro, descarga el recibo definitivo
  const confirmar = async () => {
    if (guardando || !contrato) return;
    setGuardando(true);
    try {
      const r = await registrarCobro(contrato.idOperacion, {
        mesAnoLiquidado: mesEnvio, fechaVencimiento: venc, fechaPagoReal: fechaPago,
        concepto: conceptoEnviado, montoAlquilerMes: esAlq ? esperado : null,
        montoAlquilerBase: Number(importe), porcentajeHonorariosAdministracion: Number(pct),
        moraParaInmobiliaria: esAlq && moraInmo, medioPago, observaciones: obs || null,
        cargosIds: serviciosSel.map((g) => g.idCargo),
      });
      const docFinal = await pdfRecibo(r.data);
      docFinal.save(nombreArchivo(r.data.numeroRecibo));
      reiniciar(); setObs(""); setRecarga((x) => x + 1); onCambio?.();
      setPdf(null);
      setAviso(`Cobro registrado. Recibo N° ${r.data.numeroRecibo} descargado.${r.data.pagoParcial && Number(r.data.saldoAlquilerPendiente) > 0 ? ` Queda un saldo de ${fmtMonto(r.data.saldoAlquilerPendiente, mon)} del alquiler de ${nombreMes(r.data.mesAnoLiquidado)}.` : ""}`);
    } catch (e) {
      setPdf((p) => (p ? { ...p, error: "No se pudo registrar el cobro: " + msgError(e) } : p));
    } finally { setGuardando(false); }
  };

  const verRecibo = async (l) => setPdf({ doc: await pdfRecibo(l), archivo: `Recibo_${l.numeroRecibo}.pdf`, titulo: `Recibo Oficial N° ${l.numeroRecibo}` });

  const anular = async (l) => {
    const motivo = window.prompt(`Motivo de la anulación del recibo ${l.numeroRecibo}:`);
    if (!motivo || !motivo.trim()) return;
    try { await anularCobro(l.idLiquidacion, motivo.trim()); setRecarga((x) => x + 1); onCambio?.(); setAviso("Cobro anulado. El ingreso asociado y los servicios quedaron liberados."); }
    catch (e) { setAviso("No se pudo anular: " + msgError(e)); }
  };

  const lista = cobros.filter((l) => verTodos || l.mesAnoLiquidado === mes).sort((a, b) => b.idLiquidacion - a.idLiquidacion);
  const th = { padding: "10px", textAlign: "left" };

  return (
    <div className="card tab-content active">
      <div className="card-header"><span className="card-title"><i className="fa-solid fa-calculator"></i> Liquidación Mensual al Inquilino</span></div>

      {error && <div style={{ background: "#FFEBEE", border: "1px solid #EF9A9A", padding: "10px 14px", borderRadius: 8, marginBottom: 15 }}>{error}</div>}
      {aviso && <div style={{ background: "#E3F2FD", border: "1px solid #90CAF9", padding: "10px 14px", borderRadius: 8, marginBottom: 15 }}>{aviso}</div>}

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}><label>1. Seleccionar Propiedad</label>
          <select value={opcion?.p.idPropiedad ?? ""} onChange={(e) => cambiarPropiedad(e.target.value)}>
            {opciones.length === 0 && <option value="">No hay alquileres vigentes</option>}
            {opciones.map((o) => <option key={o.p.idPropiedad} value={o.p.idPropiedad}>{o.p.titulo} ({esContenedor(o.p) ? o.unidades.length : 1} uni.)</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 2 }}><label>2. Seleccionar Unidad / Locatario</label>
          <select value={unidad?.idPropiedad ?? ""} onChange={(e) => cambiarUnidad(e.target.value)}>
            {(opcion?.unidades || []).map((u, i) => <option key={u.idPropiedad} value={u.idPropiedad}>Unidad {i + 1} - {contratoDe(u.idPropiedad)?.compradorInquilino?.nombreCompleto || `${u.titulo} (sin inquilino)`}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}><label>Mes</label><input type="month" value={mes} onChange={(e) => cambiarMes(e.target.value)} style={{ fontWeight: "bold" }} /></div>
      </div>

      {contrato ? (
        <div style={{ backgroundColor: requiereActualizacion ? "#FFF3E0" : "#F5F5F5", padding: 15, borderRadius: 8, marginBottom: 15, border: `1px solid ${requiereActualizacion ? "#FFCC80" : "#ddd"}` }}>
          <h6 style={{ margin: "0 0 10px 0", color: requiereActualizacion ? "#E65100" : "var(--color-negro)" }}><i className="fa-solid fa-file-contract"></i> Datos del Contrato Activo</h6>
          <div style={{ display: "flex", gap: 20, fontSize: "0.9rem", flexWrap: "wrap" }}>
            <span><strong>Ajuste:</strong> {usaIndice ? `Cada ${n} meses (${indice})` : "Sin ajuste (canon fijo)"}</span>
            {usaIndice && <span><strong>Próximo Aumento:</strong> <span style={{ color: requiereActualizacion ? "#D32F2F" : "inherit", fontWeight: requiereActualizacion ? "bold" : "normal", marginLeft: 5 }}>{nombreMes(proximoAumento)}</span></span>}
            <span><strong>Mora diaria:</strong> {(Number(contrato.interestMoraDiario || 0) * 100).toLocaleString("es-AR", { maximumFractionDigits: 4 })} %</span>
            <span><strong>Administración:</strong> {Number(contrato.alqPorcentajeAdministracion ?? 10).toLocaleString("es-AR")} %</span>
            {requiereActualizacion && <span style={{ color: "#D32F2F", fontWeight: "bold" }}><i className="fa-solid fa-triangle-exclamation"></i> ¡Requiere actualizar índice este mes! Corregí el alquiler del mes.</span>}
          </div>
          {usaIndice && !bloqueado && <button type="button" className={requiereActualizacion ? "btn btn-rojo" : "btn btn-outline"} style={{ marginTop: 10 }} onClick={() => setVerAjuste(true)}><i className="fa-solid fa-calculator"></i> Calcular ajuste</button>}
          {verAjuste && <CalcularAjuste indice={indice} mesAjuste={mes} n={n} alquilerActual={baseSugerida} moneda={mon} onUsar={(m) => { setEsperadoManual(String(m)); setImporteManual(null); }} onCerrar={() => setVerAjuste(false)} />}
        </div>
      ) : (
        <div style={{ padding: 15, backgroundColor: "#FFEBEE", color: "#C62828", borderRadius: 8, marginBottom: 15 }}>
          <i className="fa-solid fa-triangle-exclamation"></i> No hay un contrato activo registrado para esta unidad.
        </div>
      )}

      {contrato && esAlq && est && est.cobros.length > 0 && (
        <div style={{ padding: 15, backgroundColor: completo ? "#E8F5E9" : "#FFF8E1", border: `1px solid ${completo ? "#A5D6A7" : "#FFE082"}`, borderRadius: 8, marginBottom: 15 }}>
          <div style={{ color: completo ? "#2E7D32" : "#E65100", fontWeight: "bold" }}>
            <i className={`fa-solid ${completo ? "fa-circle-check" : "fa-hourglass-half"}`}></i>{" "}
            {completo ? `El alquiler de ${nombreMes(mes)} está cobrado por completo (${fmtMonto(pagadoMes, mon)}).` : `Alquiler de ${nombreMes(mes)}: cobrado ${fmtMonto(pagadoMes, mon)} de ${fmtMonto(esperado, mon)} — saldo ${fmtMonto(saldo, mon)}.`}
          </div>
          {est.cobros.map((l) => (
            <div key={l.idLiquidacion} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8, fontSize: "0.9rem" }}>
              <span>Recibo N° {l.numeroRecibo} · {fmtFecha(l.fechaPagoReal)} · {etiquetaCobro(l)} · <strong>{fmtMonto(l.totalAbonadoInquilino, mon)}</strong></span>
              <span style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" style={{ padding: "3px 10px" }} onClick={() => verRecibo(l)}><i className="fa-solid fa-eye"></i> Ver recibo</button>
                {!l.idRendicion && <button className="btn btn-outline" style={{ padding: "3px 10px", color: "#C62828" }} onClick={() => anular(l)}><i className="fa-solid fa-ban"></i> Anular</button>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}><label>Concepto del cobro</label>
          <select value={concepto} onChange={(e) => { setConcepto(e.target.value); reiniciar(); }} disabled={!contrato}>
            <option value="Alquiler">Alquiler del mes</option>
            <option>Indemnización por rescisión</option>
            <option value="Otro">Otro concepto</option>
          </select>
        </div>
        {concepto === "Otro" && <div className="form-group" style={{ flex: 2 }}><label>Descripción del concepto</label><input type="text" maxLength={80} placeholder="Ej: Reparación a cargo del inquilino" value={otroTexto} onChange={(e) => setOtroTexto(e.target.value)} /></div>}
      </div>

      <div className="form-row" style={{ backgroundColor: "#F8FAFC", padding: 20, borderRadius: 8, border: "1px solid var(--color-gris-borde)", opacity: bloqueado ? 0.6 : 1 }}>
        {esAlq && <div className="form-group"><label>Alquiler del mes ({mon})</label><input type="number" min="0" value={esperadoManual ?? String(esperado || "")} disabled={bloqueado} onChange={(e) => { setEsperadoManual(e.target.value); setImporteManual(null); }} /></div>}
        <div className="form-group"><label>{esAlq ? `Importe a cobrar ahora (${mon})` : `Importe (${mon})`}</label><input type="number" min="0" value={importe} disabled={bloqueado} onChange={(e) => setImporteManual(e.target.value)} style={{ fontWeight: "bold" }} /></div>
        {esAlq && <div className="form-group"><label>Vencimiento</label><input type="date" value={venc} disabled={bloqueado} onChange={(e) => setVencManual(e.target.value)} /></div>}
        <div className="form-group"><label>Fecha Pago</label><input type="date" max={hoyIso()} value={fechaPago} disabled={bloqueado} onChange={(e) => setFechaPago(e.target.value)} /></div>
      </div>
      {esAlq && contrato && !completo && Number(importe) > 0 && Number(importe) < saldo - 0.005 && (
        <p style={{ color: "#E65100", fontSize: "0.85rem", margin: "8px 0 0" }}><i className="fa-solid fa-circle-info"></i> Pago a cuenta: después de este cobro quedan <strong>{fmtMonto(r2(saldo - Number(importe)), mon)}</strong> pendientes del alquiler de {nombreMes(mes)}. El recibo lo va a indicar.</p>
      )}

      {esAlq && (
        <div className="form-row" style={{ marginTop: 25, alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 0.5 }}><label>Días Mora</label><input type="text" value={calc ? calc.dias : 0} disabled style={{ fontWeight: "bold", textAlign: "center" }} /></div>
          <div className="form-group"><label>Interés de Mora</label><input type="text" value={fmtMonto(calc ? calc.mora : 0, mon)} disabled style={{ color: "var(--color-rojo)", fontWeight: "bold" }} /></div>
          <div className="form-group">
            <label>Servicios Prorrateados <span style={{ fontSize: "0.7rem", color: "green" }}>(Importado aut.)</span></label>
            <input type="text" value={fmtMonto(montoServicios, mon)} disabled style={{ color: "#E65100", fontWeight: "bold" }} />
          </div>
          <div className="form-group">
            <label>Deuda Previa <span style={{ fontSize: "0.7rem", color: "#C62828" }}>({adeudados.length} mes(es), se cobra aparte)</span></label>
            <input type="text" value={fmtMonto(deudaPrevia, mon)} disabled style={{ color: "#C62828", fontWeight: "bold" }} />
          </div>
        </div>
      )}

      {contrato && esAlq && !bloqueado && calc && calc.dias > 0 && !(Number(contrato.interestMoraDiario) > 0) && (
        <p style={{ color: "#E65100", fontSize: "0.85rem", margin: "8px 0 0" }}><i className="fa-solid fa-circle-info"></i> El pago está {calc.dias} día(s) vencido, pero este contrato no tiene interés de mora diario cargado (0 %). Editá el contrato si corresponde cobrar mora.</p>
      )}

      {esAlq && adeudados.length > 0 && !bloqueado && (
        <p style={{ color: "#C62828", fontSize: "0.85rem", margin: "8px 0 0" }}><i className="fa-solid fa-triangle-exclamation"></i> Meses anteriores con saldo sin cobrar: {adeudados.slice().reverse().map(nombreMes).join(", ")}. Elegí cada mes en el campo "Mes" para cobrarlo con su propia mora y recibo.</p>
      )}

      {cargosUnidad.length > 0 && !bloqueado && (
        <div style={{ background: "#FFF3E0", border: "1px solid #FFCC80", borderRadius: 8, padding: "12px 15px", marginTop: 15 }}>
          <strong style={{ color: "#E65100" }}><i className="fa-solid fa-bolt"></i> Servicios y expensas pendientes de este inquilino</strong>
          {cargosUnidad.map((g) => (
            <div className="checkbox-group" key={g.idCargo} style={{ margin: "6px 0 0" }}>
              <input type="checkbox" id={`cg${g.idCargo}`} checked={!excluidos.includes(g.idCargo)}
                onChange={(e) => setExcluidos(e.target.checked ? excluidos.filter((x) => x !== g.idCargo) : [...excluidos, g.idCargo])} />
              <label htmlFor={`cg${g.idCargo}`}>{g.concepto} {nombreMes(g.periodoMesAnio)} — <strong>{fmtMonto(g.monto, mon)}</strong>{g.medicion != null ? ` (${g.medicion} ${g.unidadMedida || ""})` : ""}</label>
            </div>
          ))}
        </div>
      )}

      {contrato && !bloqueado && (
        <details style={{ marginTop: 15 }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#1565C0" }}>Liquidación al propietario y datos del cobro</summary>
          <div className="form-row" style={{ marginTop: 10 }}>
            <div className="form-group"><label>Forma de pago</label><select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>{MEDIOS.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div className="form-group"><label>Honorarios de administración (%)</label><input type="number" min="0" max="100" step="0.5" value={pct} onChange={(e) => setPctManual(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 2 }}><label>Observaciones</label><input type="text" maxLength={400} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </div>
          {esAlq && (
            <div className="checkbox-group" style={{ margin: "5px 0" }}>
              <input type="checkbox" id="moraInmo" checked={moraInmo} onChange={(e) => setMoraInmo(e.target.checked)} />
              <label htmlFor="moraInmo">La inmobiliaria retiene la mora (solo si el contrato de administración lo autoriza expresamente; si no, la mora es del propietario)</label>
            </div>
          )}
          {calc && <p style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>Honorarios: <strong>{fmtMonto(calc.hon, mon)}</strong> · Neto para el propietario: <strong>{fmtMonto(calc.neto, mon)}</strong></p>}
        </details>
      )}

      <div style={{ marginTop: 30, padding: 25, backgroundColor: "#E8F5E9", border: "2px dashed #2E7D32", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#2E7D32", fontWeight: 600 }}>TOTAL A COBRAR ({inquilino || "N/A"})</p>
          <h2 style={{ margin: 0, color: "#1B5E20", fontSize: "2.2rem" }}>{fmtMonto(totalCobrar, mon)}</h2>
        </div>
        <button type="button" className="btn btn-rojo" style={{ padding: "15px 30px", fontSize: "1.1rem" }} onClick={generarVistaPrevia} disabled={bloqueado || guardando}>
          <i className="fa-solid fa-eye"></i> Generar Recibo PDF (Vista Previa)
        </button>
      </div>

      <h5 style={{ marginTop: 30 }}>Cobros registrados {verTodos ? "(todos los meses)" : `de ${nombreMes(mes)}`}
        <label style={{ fontWeight: "normal", fontSize: "0.85rem", marginLeft: 15 }}><input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} /> ver todos</label></h5>
      <div className="table-responsive">
        <table style={{ fontSize: "0.9rem" }}>
          <thead><tr><th style={th}>Recibo</th><th style={th}>Concepto</th><th style={th}>Propiedad</th><th style={th}>Cobrado</th><th style={th}>Mora</th><th style={th}>Servicios</th><th style={th}>Honorarios</th><th style={th}>Neto propietario</th><th style={th}>Rendición</th><th style={th}>Registró</th><th style={th}></th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan="11" style={{ ...th, textAlign: "center" }}>Todavía no hay cobros registrados.</td></tr>}
            {lista.map((l) => (
              <tr key={l.idLiquidacion} style={{ borderBottom: "1px solid #eee", opacity: l.anulada ? 0.5 : 1, textDecoration: l.anulada ? "line-through" : "none" }}>
                <td style={th}>{l.numeroRecibo || "—"}</td><td style={th}>{etiquetaCobro(l)}</td><td style={th}>{l.contrato?.propiedad?.titulo}</td>
                <td style={th}>{fmtMonto(l.totalAbonadoInquilino, l.moneda)}</td>
                <td style={th}>{Number(l.montoMoraCalculado) > 0 ? fmtMonto(l.montoMoraCalculado, l.moneda) : "—"}</td>
                <td style={th}>{Number(l.montoServicios) > 0 ? fmtMonto(l.montoServicios, l.moneda) : "—"}</td>
                <td style={th}>{fmtMonto(l.montoComisionInmobiliaria, l.moneda)}</td>
                <td style={th}>{fmtMonto(l.montoNetoARendir, l.moneda)}</td>
                <td style={th} title={l.anulada ? `Anulado por ${l.anuladoPor || "—"}: ${l.motivoAnulacion || ""}` : undefined}>{l.anulada ? "Anulado" : l.idRendicion ? "Rendido" : "Pendiente de rendir"}</td>
                <td style={th}>{l.registradoPor || "—"}</td>
                <td style={th}>
                  {!l.anulada && <button className="btn btn-outline" style={{ padding: "3px 8px" }} onClick={() => verRecibo(l)} title="Ver recibo"><i className="fa-solid fa-file-pdf"></i></button>}{" "}
                  {!l.anulada && !l.idRendicion && <button className="btn btn-outline" style={{ padding: "3px 8px", color: "#C62828" }} onClick={() => anular(l)} title="Anular cobro"><i className="fa-solid fa-ban"></i></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pdf && <PdfModal doc={pdf.doc} titulo={pdf.titulo} archivo={pdf.archivo} onCerrar={() => !guardando && setPdf(null)}
        confirmar={pdf.preview ? { texto: "Confirmar cobro y guardar PDF", onClick: confirmar, ocupado: guardando, aviso: pdf.error || "Al confirmar se registra el cobro, se asigna el N° de recibo y se descarga el PDF definitivo." } : undefined} />}
    </div>
  );
}
