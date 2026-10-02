import { useState, useEffect, useMemo } from "react";
import { getContratos, getCobros, registrarCobro, anularCobro } from "../../services/api";
import { fmtMonto, hoyIso } from "../../utils/finanzas";
import { fmtFecha } from "../../utils/personas";
import { pdfRecibo } from "../../utils/pdfFinanzas";
import { normalizarMoneda } from "../../utils/monedas";
import PdfModal from "./PdfModal";

const MEDIOS = ["Transferencia Bancaria", "Efectivo (Caja)", "Cheque", "Mercado Pago"];
export const SENIA = "Seña de estadía";
export const SALDO = "Saldo de estadía";
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const esEstadia = (c) => c.tipoContrato === "Locacion" && !!c.tempCheckIn && ["Vigente", "Finalizado"].includes(c.estadoContrato);
const esCobroEstadia = (l) => l.concepto === SENIA || l.concepto === SALDO;
const msgError = (e) => e?.response?.data?.error || e?.message || "Error inesperado";
const th = { padding: "10px", textAlign: "left" };

/** Cobranza de alquileres temporarios: seña y saldo de cada estadía, con recibo oficial, ingreso en caja y rendición al propietario. */
export default function CobranzaEstadias({ onCambio }) {
  const [contratos, setContratos] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [idSel, setIdSel] = useState("");
  const [verCobradas, setVerCobradas] = useState(false);
  const [concepto, setConcepto] = useState(null);       // null = automático (seña si falta, si no saldo)
  const [importeManual, setImporteManual] = useState(null);
  const [fechaPago, setFechaPago] = useState(hoyIso());
  const [medioPago, setMedioPago] = useState(MEDIOS[0]);
  const [obs, setObs] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [pdf, setPdf] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([getContratos(), getCobros()])
      .then(([c, l]) => { if (!vivo) return; setContratos(c.data.filter(esEstadia)); setCobros(l.data.filter((x) => esCobroEstadia(x))); setError(""); })
      .catch((e) => { if (vivo) setError("No se pudieron cargar los datos: " + msgError(e)); });
    return () => { vivo = false; };
  }, [recarga]);

  // Estado de cobro de cada estadía
  const info = useMemo(() => {
    const m = {};
    contratos.forEach((c) => {
      const propios = cobros.filter((l) => !l.anulada && l.contrato?.idOperacion === c.idOperacion);
      const pagado = r2(propios.reduce((t, l) => t + Number(l.montoAlquilerBase || 0), 0));
      const total = r2(c.tempPrecioTotal);
      m[c.idOperacion] = { propios, pagado, total, pendiente: Math.max(0, r2(total - pagado)), seniaCobrada: propios.some((l) => l.concepto === SENIA) };
    });
    return m;
  }, [contratos, cobros]);

  const lista = useMemo(() => contratos
    .filter((c) => verCobradas || info[c.idOperacion]?.pendiente > 0.005 || String(c.idOperacion) === String(idSel))
    .sort((a, b) => String(b.tempCheckIn).localeCompare(String(a.tempCheckIn))), [contratos, info, verCobradas, idSel]);

  const contrato = contratos.find((c) => String(c.idOperacion) === String(idSel)) || null;
  const est = contrato ? info[contrato.idOperacion] : null;
  const mon = contrato ? normalizarMoneda(contrato.tempMoneda || contrato.monedaOperacion) : "ARS";
  const seniaPactada = r2(contrato?.tempSenia);
  const faltaSenia = !!contrato && seniaPactada > 0 && !est.seniaCobrada;
  const conceptoEfectivo = concepto || (faltaSenia ? SENIA : SALDO);
  const sugerido = !contrato ? 0 : conceptoEfectivo === SENIA ? Math.min(seniaPactada, est.pendiente) : est.pendiente;
  const importe = importeManual ?? (sugerido > 0 ? String(sugerido) : "");
  const completo = !!contrato && est.pendiente <= 0.005;
  const bloqueado = !contrato || completo;

  // Honorarios a cargo del propietario (Parte A del contrato) y neto a rendir
  const pct = !contrato ? 0 : contrato.honParteAEstado === "Anulado" ? 0 : Number(contrato.honParteAPorcentaje ?? 10);
  let hon = r2(Number(importe || 0) * pct / 100);
  if (contrato?.esCoCorretaje) hon = r2(hon / 2);
  const neto = r2(Number(importe || 0) - hon);

  const reiniciar = () => { setImporteManual(null); setAviso(""); };
  const elegir = (v) => { setIdSel(v); setConcepto(null); reiniciar(); };

  const borrador = () => ({
    numeroRecibo: null, moneda: mon, fechaPagoReal: fechaPago, mesAnoLiquidado: String(fechaPago).slice(0, 7), medioPago,
    concepto: conceptoEfectivo, pagoParcial: est.pendiente - Number(importe) > 0.005,
    saldoAlquilerPendiente: Math.max(0, r2(est.pendiente - Number(importe))),
    montoAlquilerBase: Number(importe), montoMoraCalculado: 0, diasAtraso: 0, serviciosDetalle: "",
    totalAbonadoInquilino: Number(importe), contrato,
  });
  const nombreArchivo = (num) => `Recibo_${num || "estadia"}_${String(contrato?.propiedad?.titulo || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;

  const generarVistaPrevia = async () => {
    if (guardando || !contrato) return;
    const imp = Number(importe);
    if (!(imp > 0)) { setAviso("Indicá el importe que se cobra ahora (mayor a cero)."); return; }
    if (imp > est.pendiente + 0.005) { setAviso(`El importe supera lo que falta cobrar de la estadía (${fmtMonto(est.pendiente, mon)}).`); return; }
    if (conceptoEfectivo === SENIA && seniaPactada <= 0) { setAviso("Esta estadía no tiene seña pactada: cobrá directamente el saldo."); return; }
    if (conceptoEfectivo === SENIA && est.seniaCobrada) { setAviso("La seña de esta estadía ya fue cobrada."); return; }
    if (conceptoEfectivo === SENIA && imp > seniaPactada + 0.005) { setAviso(`La seña pactada es de ${fmtMonto(seniaPactada, mon)}: el importe no puede superarla.`); return; }
    if (!fechaPago) { setAviso("Indicá la fecha de pago."); return; }
    setAviso("");
    setPdf({ doc: await pdfRecibo(borrador()), titulo: "Vista Previa del Recibo Oficial", archivo: nombreArchivo(), preview: true });
  };

  const confirmar = async () => {
    if (guardando || !contrato) return;
    setGuardando(true);
    try {
      const r = await registrarCobro(contrato.idOperacion, {
        mesAnoLiquidado: String(fechaPago).slice(0, 7), fechaVencimiento: fechaPago, fechaPagoReal: fechaPago,
        concepto: conceptoEfectivo, montoAlquilerBase: Number(importe), porcentajeHonorariosAdministracion: pct,
        moraParaInmobiliaria: false, medioPago, observaciones: obs || null,
      });
      const docFinal = await pdfRecibo(r.data);
      docFinal.save(nombreArchivo(r.data.numeroRecibo));
      setPdf(null); setObs(""); setConcepto(null); reiniciar(); setRecarga((x) => x + 1); onCambio?.();
      setAviso(`Cobro registrado. Recibo N° ${r.data.numeroRecibo} descargado.${Number(r.data.saldoAlquilerPendiente) > 0 ? ` Queda un saldo de ${fmtMonto(r.data.saldoAlquilerPendiente, mon)} de la estadía.` : " La estadía quedó cobrada por completo."} El ingreso ya figura en Movimientos y queda pendiente de rendir al propietario.`);
    } catch (e) {
      setPdf((p) => (p ? { ...p, error: "No se pudo registrar el cobro: " + msgError(e) } : p));
    } finally { setGuardando(false); }
  };

  const verRecibo = async (l) => setPdf({ doc: await pdfRecibo(l), archivo: `Recibo_${l.numeroRecibo}.pdf`, titulo: `Recibo Oficial N° ${l.numeroRecibo}` });
  const anular = async (l) => {
    const motivo = window.prompt(`Motivo de la anulación del recibo ${l.numeroRecibo}:`);
    if (!motivo || !motivo.trim()) return;
    try { await anularCobro(l.idLiquidacion, motivo.trim()); setRecarga((x) => x + 1); onCambio?.(); setAviso("Cobro anulado. El ingreso asociado se anuló y la estadía volvió a quedar con ese importe pendiente."); }
    catch (e) { setAviso("No se pudo anular: " + msgError(e)); }
  };

  const todos = cobros.slice().sort((a, b) => b.idLiquidacion - a.idLiquidacion);

  return (
    <div className="card tab-content active">
      <div className="card-header"><span className="card-title"><i className="fa-solid fa-suitcase-rolling"></i> Cobranza de Estadías Temporarias</span></div>
      {error && <div role="alert" style={{ background: "#FFEBEE", border: "1px solid #EF9A9A", padding: "10px 14px", borderRadius: 8, marginBottom: 15 }}>{error}</div>}
      {aviso && <div role="status" style={{ background: "#F5F5F5", border: "1px solid #BDBDBD", padding: "10px 14px", borderRadius: 8, marginBottom: 15 }}>{aviso}</div>}

      <div className="form-row">
        <div className="form-group" style={{ flex: 3 }}><label>1. Estadía</label>
          <select value={idSel} onChange={(e) => elegir(e.target.value)}>
            <option value="">{lista.length ? "Seleccionar estadía..." : "No hay estadías con cobros pendientes"}</option>
            {lista.map((c) => {
              const i = info[c.idOperacion];
              return <option key={c.idOperacion} value={c.idOperacion}>{c.propiedad?.titulo} · {c.compradorInquilino?.nombreCompleto || "huésped"} · {fmtFecha(c.tempCheckIn)} al {fmtFecha(c.tempCheckOut)} · {i.pendiente > 0.005 ? `pendiente ${fmtMonto(i.pendiente, normalizarMoneda(c.tempMoneda || c.monedaOperacion))}` : "cobrada"}</option>;
            })}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1, justifyContent: "flex-end" }}>
          <div className="checkbox-group"><input type="checkbox" id="verCobradas" checked={verCobradas} onChange={(e) => setVerCobradas(e.target.checked)} /><label htmlFor="verCobradas">Incluir las ya cobradas</label></div>
        </div>
      </div>

      {contrato && (
        <div style={{ backgroundColor: "#F5F5F5", padding: 15, borderRadius: 8, marginBottom: 15, border: "1px solid #ddd" }}>
          <div style={{ display: "flex", gap: 20, fontSize: "0.9rem", flexWrap: "wrap" }}>
            <span><strong>Huésped:</strong> {contrato.compradorInquilino?.nombreCompleto || "—"}</span>
            <span><strong>Estadía:</strong> {fmtFecha(contrato.tempCheckIn)} al {fmtFecha(contrato.tempCheckOut)} ({contrato.estadoContrato})</span>
            <span><strong>Precio total:</strong> {fmtMonto(est.total, mon)}</span>
            <span><strong>Seña pactada:</strong> {seniaPactada > 0 ? `${fmtMonto(seniaPactada, mon)}${est.seniaCobrada ? " (cobrada)" : ""}` : "sin seña"}</span>
            <span><strong>Cobrado:</strong> {fmtMonto(est.pagado, mon)}</span>
            <span style={{ color: est.pendiente > 0.005 ? "#C62828" : "inherit", fontWeight: 700 }}>Pendiente: {fmtMonto(est.pendiente, mon)}</span>
          </div>
          {(contrato.tempSeniaCobradaFecha && !est.seniaCobrada) && (
            <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "var(--color-gris-texto)" }}><i className="fa-solid fa-circle-info"></i> La seña figura como cobrada el {fmtFecha(contrato.tempSeniaCobradaFecha)} pero sin recibo en el sistema. Si querés emitirlo, registrala acá.</p>
          )}
          {completo && <p style={{ margin: "8px 0 0", fontWeight: 700 }}><i className="fa-solid fa-circle-check"></i> Esta estadía está cobrada por completo.</p>}
        </div>
      )}

      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}><label>2. Concepto del cobro</label>
          <select value={conceptoEfectivo} disabled={bloqueado} onChange={(e) => { setConcepto(e.target.value); setImporteManual(null); setAviso(""); }}>
            <option value={SENIA}>Seña / reserva</option>
            <option value={SALDO}>Saldo de la estadía</option>
          </select>
        </div>
        <div className="form-group"><label>Importe a cobrar ahora ({mon})</label>
          <input type="number" min="0" value={importe} disabled={bloqueado} onChange={(e) => setImporteManual(e.target.value)} style={{ fontWeight: "bold" }} /></div>
        <div className="form-group"><label>Fecha de pago</label><input type="date" max={hoyIso()} value={fechaPago} disabled={bloqueado} onChange={(e) => setFechaPago(e.target.value)} /></div>
        <div className="form-group"><label>Forma de pago</label><select value={medioPago} disabled={bloqueado} onChange={(e) => setMedioPago(e.target.value)}>{MEDIOS.map((m) => <option key={m}>{m}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}><label>Observaciones</label><input type="text" maxLength={400} value={obs} disabled={bloqueado} onChange={(e) => setObs(e.target.value)} /></div>
      </div>

      {contrato && !bloqueado && Number(importe) > 0 && (
        <p style={{ fontSize: "0.9rem", margin: "4px 0 0" }}>
          Honorarios a cargo del propietario ({pct.toLocaleString("es-AR")} %{contrato.esCoCorretaje ? ", co-corretaje" : ""}): <strong>{fmtMonto(hon, mon)}</strong> · Neto para el propietario: <strong>{fmtMonto(neto, mon)}</strong>
          {Number(importe) < est.pendiente - 0.005 && <> · Después de este cobro queda un saldo de <strong>{fmtMonto(r2(est.pendiente - Number(importe)), mon)}</strong>.</>}
        </p>
      )}

      <div style={{ marginTop: 25, padding: 25, backgroundColor: "#F5F5F5", border: "2px dashed #1A1A1A", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>TOTAL A COBRAR ({contrato?.compradorInquilino?.nombreCompleto || "N/A"})</p>
          <h2 style={{ margin: 0, fontSize: "2.2rem" }}>{fmtMonto(Number(importe) || 0, mon)}</h2>
        </div>
        <button type="button" className="btn btn-rojo" style={{ padding: "15px 30px", fontSize: "1.1rem" }} onClick={generarVistaPrevia} disabled={bloqueado || guardando}>
          <i className="fa-solid fa-eye"></i> Generar Recibo PDF (Vista Previa)
        </button>
      </div>

      <h5 style={{ marginTop: 30 }}>Cobros de estadías registrados</h5>
      <div className="table-responsive">
        <table style={{ fontSize: "0.9rem" }}>
          <thead><tr><th style={th}>Recibo</th><th style={th}>Fecha</th><th style={th}>Concepto</th><th style={th}>Propiedad / Huésped</th><th style={th}>Cobrado</th><th style={th}>Honorarios</th><th style={th}>Neto propietario</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
          <tbody>
            {todos.length === 0 && <tr><td colSpan="9" style={{ ...th, textAlign: "center" }}>Todavía no hay cobros de estadías.</td></tr>}
            {todos.map((l) => (
              <tr key={l.idLiquidacion} style={{ borderBottom: "1px solid #eee", opacity: l.anulada ? 0.5 : 1, textDecoration: l.anulada ? "line-through" : "none" }}>
                <td style={th}>{l.numeroRecibo || "—"}</td><td style={th}>{fmtFecha(l.fechaPagoReal)}</td><td style={th}>{l.concepto}</td>
                <td style={th}>{l.contrato?.propiedad?.titulo} · {l.contrato?.compradorInquilino?.nombreCompleto || "huésped"}</td>
                <td style={th}>{fmtMonto(l.totalAbonadoInquilino, l.moneda)}</td>
                <td style={th}>{fmtMonto(l.montoComisionInmobiliaria, l.moneda)}</td>
                <td style={th}>{fmtMonto(l.montoNetoARendir, l.moneda)}</td>
                <td style={th} title={l.anulada ? `Anulado por ${l.anuladoPor || "—"}: ${l.motivoAnulacion || ""}` : undefined}>{l.anulada ? "Anulado" : l.idRendicion ? "Rendido" : "Pendiente de rendir"}</td>
                <td style={th}>
                  {!l.anulada && <button className="btn btn-outline" style={{ padding: "3px 8px" }} onClick={() => verRecibo(l)} title="Ver recibo"><i className="fa-solid fa-file-pdf"></i></button>}{" "}
                  {!l.anulada && !l.idRendicion && <button className="btn btn-outline" style={{ padding: "3px 8px", color: "#C62828" }} onClick={() => anular(l)} title="Anular cobro"><i className="fa-solid fa-ban"></i></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--color-gris-texto)", marginTop: 12 }}>
        Cada cobro genera un recibo correlativo y un ingreso en Movimientos. Para rendirlo al propietario, usá la pestaña «Propietarios y Rendiciones» con el mes del pago.
      </p>
      {pdf && <PdfModal doc={pdf.doc} titulo={pdf.titulo} archivo={pdf.archivo} onCerrar={() => !guardando && setPdf(null)}
        confirmar={pdf.preview ? { texto: "Confirmar cobro y guardar PDF", onClick: confirmar, ocupado: guardando, aviso: pdf.error || "Al confirmar se registra el cobro, se asigna el N° de recibo y se descarga el PDF definitivo." } : undefined} />}
    </div>
  );
}
