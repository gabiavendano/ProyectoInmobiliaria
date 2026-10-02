import { useState, useEffect } from "react";
import { getContratos, getCobros } from "../../services/api";
import { fmtMonto, mesActual, hoyIso, fechaVencimiento, difMeses, sumarMeses, nombreMes, estadoMes } from "../../utils/finanzas";
import { fmtFecha } from "../../utils/personas";
import { monedaDeContrato } from "../../utils/monedas";

const mesDe = (iso) => String(iso || "").slice(0, 7);

/** Panel de alertas: inquilinos con deuda y contratos que requieren actualizar el índice. Se calcula con datos reales. */
export default function AlertasFinanzas({ version }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([getContratos(), getCobros()])
      .then(([c, l]) => { if (vivo) setDatos({ contratos: c.data.filter((x) => x.tipoContrato === "Locacion" && x.estadoContrato === "Vigente" && !(x.tempCheckIn || x.tempCheckOut)), cobros: l.data.filter((x) => !x.anulada) }); })
      .catch(() => { if (vivo) setDatos({ contratos: [], cobros: [] }); });
    return () => { vivo = false; };
  }, [version]);

  if (!datos) return null;
  const hoy = hoyIso(), mes = mesActual();
  const deudores = [], ajustes = [];
  datos.contratos.forEach((c) => {
    const ini = mesDe(c.alqFechaInicio || c.fechaInicio), fin = mesDe(c.alqFechaFin || c.fechaFin);
    const base = Number(c.alqCanonMonto || c.montoTotalOperacion || 0);
    const mon = monedaDeContrato(c);
    let meses = 0, monto = 0;
    for (let i = 0; i <= 12; i++) {
      const m = sumarMeses(mes, -i);
      if ((ini && m < ini) || (fin && m > fin)) continue;
      if (fechaVencimiento(m, c.alqDiaVencimiento || 10) >= hoy) continue;
      const est = estadoMes(datos.cobros, c.idOperacion, m, base);
      if (!est.completo) { meses++; monto += est.saldo; }
    }
    if (meses > 0) deudores.push({ inquilino: c.compradorInquilino?.nombreCompleto, propiedad: c.propiedad?.titulo, meses, monto, mon });
    const n = Number(c.frecuenciaAjusteMeses) || 0;
    if (ini && n > 0 && (c.indiceAjuste === "ICL" || c.indiceAjuste === "IPC")) {
      const k = difMeses(ini, mes);
      if (k > 0 && k % n === 0) ajustes.push({ inquilino: c.compradorInquilino?.nombreCompleto, propiedad: c.propiedad?.titulo, indice: c.indiceAjuste, desde: `${sumarMeses(ini, k)}-${String(c.alqFechaInicio || c.fechaInicio).slice(8, 10) || "01"}` });
    }
  });
  if (!deudores.length && !ajustes.length) return null;

  return (
    <div style={{ display: "flex", gap: 20, marginBottom: 25, flexWrap: "wrap" }}>
      {deudores.length > 0 && (
        <div style={{ flex: 1, minWidth: 300, backgroundColor: "#FFEBEE", borderLeft: "5px solid #D32F2F", padding: 15, borderRadius: 4, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
          <h5 style={{ margin: "0 0 10px 0", color: "#B71C1C" }}><i className="fa-solid fa-circle-exclamation"></i> Inquilinos con Deuda / Saldos</h5>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9rem", color: "#424242" }}>
            {deudores.map((d, i) => (
              <li key={i} style={{ marginBottom: 5 }}><strong>{d.inquilino}</strong> ({d.propiedad}) — {d.meses} mes(es) sin cobrar: <span style={{ color: "#D32F2F", fontWeight: "bold" }}>{fmtMonto(d.monto, d.mon)}</span></li>
            ))}
          </ul>
        </div>
      )}
      {ajustes.length > 0 && (
        <div style={{ flex: 1, minWidth: 300, backgroundColor: "#FFF8E1", borderLeft: "5px solid #FFA000", padding: 15, borderRadius: 4, boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
          <h5 style={{ margin: "0 0 10px 0", color: "#FF8F00" }}><i className="fa-solid fa-file-contract"></i> Contratos a Actualizar Índice</h5>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9rem", color: "#424242" }}>
            {ajustes.map((a, i) => (
              <li key={i} style={{ marginBottom: 5 }}><strong>{a.inquilino}</strong> ({a.propiedad}) - Ajuste {a.indice} desde: <strong>{fmtFecha(a.desde)}</strong> ({nombreMes(a.desde.slice(0, 7))})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
