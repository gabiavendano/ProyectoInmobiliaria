import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { fmtMonto, nombreMes } from "../../utils/finanzas";
import { mesesReferencia, calcularPorIndices, obtenerIpc } from "../../utils/ajuste";

const pct = (x) => `${x >= 0 ? "+" : ""}${x.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
const num = (x) => Number(x).toLocaleString("es-AR", { maximumFractionDigits: 4 });
const aNumero = (s) => Number(String(s ?? "").replace(/\./g, "").replace(",", ".")) || 0;

/**
 * Calculadora de ajuste por IPC / ICL. Solo PROPONE un monto: el usuario decide si lo usa.
 * - IPC: trae el índice del INDEC automáticamente (con carga manual si no se puede).
 * - ICL: el BCRA no se puede consultar desde acá, se cargan los dos valores a mano.
 */
export default function CalcularAjuste({ indice, mesAjuste, n, alquilerActual, moneda, onUsar, onCerrar }) {
  const ref = useMemo(() => mesesReferencia(mesAjuste, n), [mesAjuste, n]);
  const [desde, setDesde] = useState(ref.desde);
  const [hasta, setHasta] = useState(ref.hasta);
  const [base, setBase] = useState(String(alquilerActual || ""));
  const [m0, setM0] = useState(null);   // valores corregidos a mano (null = usar los del INDEC)
  const [m1, setM1] = useState(null);
  const [resp, setResp] = useState(null);   // { clave, serie } | { clave, error }

  const esIpc = indice === "IPC";
  const rangoOk = /^\d{4}-\d{2}$/.test(desde) && /^\d{4}-\d{2}$/.test(hasta) && desde < hasta;
  const clave = `${desde}|${hasta}`;
  useEffect(() => {
    if (!esIpc || !rangoOk) return undefined;
    let vivo = true;
    obtenerIpc(desde, hasta)
      .then((serie) => { if (vivo) { setResp({ clave, serie }); setM0(null); setM1(null); } })
      .catch(() => { if (vivo) setResp({ clave, error: true }); });
    return () => { vivo = false; };
  }, [esIpc, rangoOk, desde, hasta, clave]);

  const actual = resp && resp.clave === clave ? resp : null;
  const cargando = esIpc && rangoOk && !actual;
  const auto = actual?.serie && actual.serie[desde] && actual.serie[hasta] ? { i0: actual.serie[desde], i1: actual.serie[hasta] } : null;
  let aviso = "";
  if (esIpc && !rangoOk) aviso = "El mes inicial debe ser anterior al mes final.";
  else if (actual?.error) aviso = "No se pudo consultar el INDEC desde acá. Cargá los dos valores a mano (los publica el INDEC en datos.gob.ar).";
  else if (actual?.serie && !auto) {
    const falta = [!actual.serie[desde] && nombreMes(desde), !actual.serie[hasta] && nombreMes(hasta)].filter(Boolean).join(" y ");
    aviso = `El INDEC todavía no publicó el índice de ${falta}. Podés elegir otros meses o cargar los valores a mano.`;
  }
  const i0 = m0 ?? (auto ? String(auto.i0).replace(".", ",") : "");
  const i1 = m1 ?? (auto ? String(auto.i1).replace(".", ",") : "");
  const setI0 = setM0, setI1 = setM1;

  const baseNum = aNumero(base);
  const res = calcularPorIndices(baseNum, aNumero(i0), aNumero(i1));
  const etiqueta = esIpc ? "Índice IPC (INDEC)" : "Valor del ICL (BCRA)";
  const campoMes = esIpc ? "mes" : "día";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 5000, display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }} role="dialog" aria-modal="true" aria-label="Calcular ajuste">
      <div style={{ backgroundColor: "white", padding: 25, borderRadius: 10, width: "100%", maxWidth: 560, maxHeight: "96vh", overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "var(--color-negro)" }}><i className="fa-solid fa-calculator" style={{ color: "var(--color-rojo)" }}></i> Calcular ajuste por {indice}</h3>
          <button onClick={onCerrar} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#666" }} aria-label="Cerrar"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#555" }}>
          Ajuste de {nombreMes(mesAjuste)}, cada {n} meses. Alquiler nuevo = alquiler actual × (índice final ÷ índice inicial).
        </p>

        <div className="form-group"><label>Alquiler actual ({moneda})</label><input type="number" min="0" value={base} onChange={(e) => setBase(e.target.value)} /></div>

        {esIpc ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}><label>Mes inicial</label><input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: 150 }}><label>Mes final</label><input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>El ICL lo publica el BCRA día por día. Cargá el valor del día inicial y del día final que fija tu contrato.</p>
        )}

        {cargando && <div style={{ fontSize: "0.85rem", color: "#555" }} role="status">Consultando INDEC…</div>}
        {aviso && <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", padding: "8px 12px", borderRadius: 6, fontSize: "0.85rem" }}>{aviso}</div>}
        {auto && m0 == null && m1 == null && <div style={{ fontSize: "0.8rem", color: "#555" }}>Valores obtenidos del INDEC (datos.gob.ar). Podés corregirlos si hace falta.</div>}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}><label>{etiqueta} inicial{esIpc ? ` (${nombreMes(desde)})` : ` (${campoMes} inicial)`}</label><input inputMode="decimal" value={i0} onChange={(e) => setI0(e.target.value)} placeholder="Ej: 11826,41" /></div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}><label>{etiqueta} final{esIpc ? ` (${nombreMes(hasta)})` : ` (${campoMes} final)`}</label><input inputMode="decimal" value={i1} onChange={(e) => setI1(e.target.value)} placeholder="Ej: 12276,77" /></div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, background: "#fafafa" }} aria-live="polite">
          {res ? (
            <>
              <div style={{ fontSize: "0.9rem" }}>Coeficiente: {num(aNumero(i1))} ÷ {num(aNumero(i0))} = <strong>{res.coeficiente.toLocaleString("es-AR", { maximumFractionDigits: 6 })}</strong> ({pct(res.variacionPct)})</div>
              <div style={{ fontSize: "0.9rem", marginTop: 6 }}>Aumento: {fmtMonto(res.diferencia, moneda)}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 6, color: "var(--color-negro)" }}>Alquiler propuesto: {fmtMonto(res.nuevo, moneda)}</div>
            </>
          ) : <div style={{ fontSize: "0.9rem", color: "#555" }}>Completá el alquiler y los dos valores del índice para ver el cálculo.</div>}
        </div>

        <a href={esIpc ? "https://www.indec.gob.ar/Nivel4/Tema/3/5/31" : "https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables_datos.asp"} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", height: 42 }}>
          <i className="fa-solid fa-arrow-up-right-from-square"></i> {esIpc ? "Ver el IPC en el INDEC" : "Ver el ICL en el BCRA (Principales variables)"}
        </a>

        <p style={{ margin: 0, fontSize: "0.78rem", color: "#666" }}>Es una propuesta de cálculo: verificá siempre la cláusula de ajuste del contrato (meses de referencia, topes, redondeos). No constituye asesoramiento legal.</p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-rojo" disabled={!res} onClick={() => { onUsar(res.nuevo); onCerrar(); }}><i className="fa-solid fa-check"></i> Usar este monto</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
