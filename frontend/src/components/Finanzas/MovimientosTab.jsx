import { useState, useEffect, useMemo } from "react";
import { getMovimientos, anularMovimiento } from "../../services/api";
import { fmtMonto, mesActual } from "../../utils/finanzas";
import { fmtFecha } from "../../utils/personas";
import { normalizarMoneda } from "../../utils/monedas";

const msgError = (e) => e?.response?.data?.error || e?.message || "Error inesperado";
const COLOR = { Ingreso: "#2E7D32", Egreso: "#E65100", Transferencia: "#1565C0" };

export default function MovimientosTab({ version, onNuevo, onEditar }) {
  const [movs, setMovs] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState("");
  const [f, setF] = useState({ mes: mesActual(), tipo: "", estado: "", texto: "" });

  useEffect(() => {
    let vivo = true;
    getMovimientos()
      .then((r) => { if (vivo) setMovs(r.data); })
      .catch((e) => { if (vivo) setAviso("No se pudieron cargar los movimientos: " + msgError(e)); });
    return () => { vivo = false; };
  }, [recarga, version]);

  const lista = useMemo(() => movs
    .filter((m) => (!f.mes || String(m.fecha).startsWith(f.mes)) && (!f.tipo || m.tipo === f.tipo) && (!f.estado || m.estado === f.estado)
      && (!f.texto || `${m.persona?.nombreCompleto || ""} ${m.propiedad?.titulo || ""} ${m.conceptoIngreso || ""} ${m.conceptoEgreso || ""} ${m.observaciones || ""}`.toLowerCase().includes(f.texto.toLowerCase())))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.idMovimiento - a.idMovimiento), [movs, f]);

  // Totales solo de lo efectivamente realizado (Completado)
  const totales = useMemo(() => {
    const t = {};
    lista.filter((m) => m.estado === "Completado").forEach((m) => {
      const mon = normalizarMoneda(m.moneda);
      t[mon] = t[mon] || { Ingreso: 0, Egreso: 0, Transferencia: 0 };
      t[mon][m.tipo] += Number(m.monto) || 0;
    });
    return t;
  }, [lista]);

  const esManual = (m) => !m.origen || m.origen === "Manual";
  const anular = async (m) => {
    const motivo = window.prompt("Motivo de la anulación:");
    if (!motivo || !motivo.trim()) return;
    try { await anularMovimiento(m.idMovimiento, motivo.trim()); setAviso("Movimiento anulado."); setRecarga((x) => x + 1); }
    catch (e) { setAviso(msgError(e)); }
  };

  const celda = { padding: "10px", textAlign: "left" };
  return (
    <div className="card tab-content active">
      <div className="card-header">
        <span className="card-title"><i className="fa-solid fa-list"></i> Movimientos de caja</span>
        <button className="btn btn-rojo" onClick={onNuevo}><i className="fa-solid fa-plus"></i> Nuevo movimiento</button>
      </div>

      <div className="form-row" style={{ alignItems: "flex-end" }}>
        <div className="form-group"><label>Mes</label><input type="month" value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></div>
        <div className="form-group"><label>Tipo</label><select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Todos</option><option>Ingreso</option><option>Egreso</option><option>Transferencia</option></select></div>
        <div className="form-group"><label>Estado</label><select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Todos</option><option>Completado</option><option>Pendiente de Pago</option><option>Programado</option><option>Anulado</option></select></div>
        <div className="form-group" style={{ flex: 2 }}><label>Buscar</label><input type="text" placeholder="Persona, propiedad, concepto..." value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} /></div>
      </div>

      <div style={{ display: "flex", gap: 30, flexWrap: "wrap", margin: "5px 0 15px" }}>
        {Object.keys(totales).length === 0 && <span style={{ color: "#777" }}>Sin movimientos completados en este filtro.</span>}
        {Object.entries(totales).map(([mon, t]) => (
          <span key={mon}><strong>{mon}:</strong> ingresos <span style={{ color: COLOR.Ingreso }}>{fmtMonto(t.Ingreso, mon)}</span> · egresos <span style={{ color: COLOR.Egreso }}>{fmtMonto(t.Egreso, mon)}</span> · transferencias <span style={{ color: COLOR.Transferencia }}>{fmtMonto(t.Transferencia, mon)}</span> · saldo <strong>{fmtMonto(t.Ingreso - t.Egreso - t.Transferencia, mon)}</strong></span>
        ))}
      </div>

      {aviso && <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", padding: "10px 14px", borderRadius: 8, marginBottom: 10 }}>{aviso}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860, fontSize: "0.9rem" }}>
          <thead style={{ backgroundColor: "#f1f1f1" }}>
            <tr><th style={celda}>Fecha</th><th style={celda}>Tipo</th><th style={celda}>Concepto</th><th style={celda}>Persona</th><th style={celda}>Propiedad</th><th style={celda}>Monto</th><th style={celda}>Estado</th><th style={celda}></th></tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan="8" style={{ ...celda, textAlign: "center" }}>No hay movimientos con este filtro.</td></tr>}
            {lista.map((m) => (
              <tr key={m.idMovimiento} style={{ borderBottom: "1px solid #eee", opacity: m.estado === "Anulado" ? 0.5 : 1, textDecoration: m.estado === "Anulado" ? "line-through" : "none" }}>
                <td style={celda}>{fmtFecha(m.fecha)}</td>
                <td style={{ ...celda, color: COLOR[m.tipo], fontWeight: "bold" }}>{m.tipo}</td>
                <td style={celda}>{m.tipo === "Egreso" ? m.conceptoEgreso : m.conceptoIngreso}{!esManual(m) && <small style={{ color: "#777" }}> · {m.origen}</small>}</td>
                <td style={celda}>{m.persona?.nombreCompleto || "—"}</td>
                <td style={celda}>{m.propiedad?.titulo || "—"}</td>
                <td style={celda}>{fmtMonto(m.monto, m.moneda)}</td>
                <td style={celda}>{m.estado}</td>
                <td style={celda}>
                  {esManual(m) && m.estado !== "Anulado" && <>
                    <button className="btn btn-outline" style={{ padding: "3px 8px" }} onClick={() => onEditar(m)} title="Editar"><i className="fa-solid fa-pen"></i></button>{" "}
                    <button className="btn btn-outline" style={{ padding: "3px 8px", color: "#C62828" }} onClick={() => anular(m)} title="Anular"><i className="fa-solid fa-ban"></i></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
