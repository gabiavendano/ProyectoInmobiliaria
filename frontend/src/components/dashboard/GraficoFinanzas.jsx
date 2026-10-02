import { useState } from "react";
import { nombreMonedaPlural } from "../../utils/monedas";

// Colores del gráfico: dos series categóricas validadas (azul / naranja), con contraste y separación para daltonismo.
export const COLOR_INGRESOS = "#2a78d6";
export const COLOR_EGRESOS = "#eb6834";

const Leyenda = ({ color, texto }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "16px", fontSize: "0.85rem", color: "var(--color-gris-texto)" }}>
    <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: color, display: "inline-block" }}></span>{texto}
  </span>
);

const ALTO_PLOT = 200;   // px de alto del área de barras

// Escala "linda": el tope es un múltiplo limpio (1, 2, 2.5, 5 × 10^n) con a lo sumo 5 divisiones
const escala = (max) => {
  if (!(max > 0)) return { tope: 1, ticks: [0, 1] };
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * exp).find(p => Math.ceil(max / p) <= 5);
  const tope = Math.ceil(max / paso) * paso;
  const ticks = [];
  for (let v = 0; v <= tope + paso / 1000; v += paso) ticks.push(Number(v.toFixed(6)));
  return { tope, ticks };
};

// Columnas agrupadas (Ingresos / Egresos por mes). Hecho con HTML para que se adapte a cualquier ancho de pantalla.
// datos: [{ clave, etiqueta, ingresos, egresos }]
export default function GraficoFinanzas({ datos, moneda }) {
  const [hover, setHover] = useState(null);
  const [verTabla, setVerTabla] = useState(false);

  const simbolo = ({ USD: "US$ ", EUR: "€ " }[moneda]) || "$ ";
  const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
  const completo = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
  const fmtEje = (v) => (v === 0 ? "0" : simbolo + compacto.format(v));
  const fmtMonto = (v) => simbolo + completo.format(v);

  const max = Math.max(0, ...datos.flatMap(d => [d.ingresos, d.egresos]));
  const { tope, ticks } = escala(max);
  const hayDatos = max > 0;

  const alto = (v) => (v > 0 ? `max(2px, ${(v / tope) * 100}%)` : "0");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        <div><Leyenda color={COLOR_INGRESOS} texto="Ingresos" /><Leyenda color={COLOR_EGRESOS} texto="Egresos" /></div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setVerTabla(v => !v)}>
          <i className={`fa-solid ${verTabla ? "fa-chart-simple" : "fa-table"}`}></i> {verTabla ? "Ver gráfico" : "Ver como tabla"}
        </button>
      </div>

      {verTabla ? (
        <div className="table-responsive">
          <table>
            <thead><tr><th>Mes</th><th style={{ textAlign: "right" }}>Ingresos</th><th style={{ textAlign: "right" }}>Egresos</th><th style={{ textAlign: "right" }}>Balance</th></tr></thead>
            <tbody>
              {datos.map(d => (
                <tr key={d.clave}>
                  <td>{d.etiqueta}</td>
                  <td style={{ textAlign: "right" }}>{fmtMonto(d.ingresos)}</td>
                  <td style={{ textAlign: "right" }}>{fmtMonto(d.egresos)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtMonto(d.ingresos - d.egresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !hayDatos ? (
        <p style={{ textAlign: "center", color: "var(--color-gris-texto)", padding: "50px 10px", margin: 0 }}>
          No hay ingresos ni egresos completados en {nombreMonedaPlural(moneda)} en los últimos meses.
        </p>
      ) : (
        <div style={{ display: "flex" }}>
          {/* Eje Y */}
          <div style={{ position: "relative", width: "58px", height: `${ALTO_PLOT}px`, flexShrink: 0 }}>
            {ticks.map(t => (
              <span key={t} style={{ position: "absolute", right: "8px", bottom: `${(t / tope) * 100}%`, transform: "translateY(50%)", fontSize: "0.72rem", color: "var(--color-gris-texto)", fontVariantNumeric: "tabular-nums" }}>
                {fmtEje(t)}
              </span>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: "relative", height: `${ALTO_PLOT}px` }} onMouseLeave={() => setHover(null)}>
              {/* Líneas de referencia */}
              {ticks.map(t => (
                <div key={t} style={{ position: "absolute", left: 0, right: 0, bottom: `${(t / tope) * 100}%`, borderTop: "1px solid #E6E5E1" }}></div>
              ))}

              {/* Grupos de barras */}
              <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                {datos.map((d, i) => (
                  <div
                    key={d.clave}
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.etiqueta}: ingresos ${fmtMonto(d.ingresos)}, egresos ${fmtMonto(d.egresos)}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "2px", outline: "none", backgroundColor: hover === i ? "rgba(0,0,0,0.04)" : "transparent", cursor: "default" }}
                  >
                    <div style={{ width: "100%", maxWidth: "24px", height: alto(d.ingresos), backgroundColor: COLOR_INGRESOS, borderRadius: "4px 4px 0 0", opacity: hover === null || hover === i ? 1 : 0.55 }}></div>
                    <div style={{ width: "100%", maxWidth: "24px", height: alto(d.egresos), backgroundColor: COLOR_EGRESOS, borderRadius: "4px 4px 0 0", opacity: hover === null || hover === i ? 1 : 0.55 }}></div>
                  </div>
                ))}
              </div>

              {/* Tooltip: el valor va primero, el nombre de la serie después */}
              {hover !== null && (
                <div style={{
                  position: "absolute", top: "-6px", pointerEvents: "none", zIndex: 5,
                  ...(hover === 0 ? { left: 0 } : hover === datos.length - 1 ? { right: 0 } : { left: `${((hover + 0.5) / datos.length) * 100}%`, transform: "translateX(-50%)" }),
                  background: "#fff", border: "1px solid #D9D8D3", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 4px 14px rgba(0,0,0,0.12)", whiteSpace: "nowrap", fontSize: "0.82rem"
                }}>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{datos[hover].etiqueta}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "12px", height: "3px", backgroundColor: COLOR_INGRESOS, borderRadius: "2px" }}></span>
                    <strong>{fmtMonto(datos[hover].ingresos)}</strong><span style={{ color: "var(--color-gris-texto)" }}>Ingresos</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "12px", height: "3px", backgroundColor: COLOR_EGRESOS, borderRadius: "2px" }}></span>
                    <strong>{fmtMonto(datos[hover].egresos)}</strong><span style={{ color: "var(--color-gris-texto)" }}>Egresos</span>
                  </div>
                </div>
              )}
            </div>

            {/* Eje X */}
            <div style={{ display: "flex", marginTop: "6px" }}>
              {datos.map(d => (
                <div key={d.clave} style={{ flex: 1, textAlign: "center", fontSize: "0.78rem", color: "var(--color-gris-texto)" }}>{d.etiqueta}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
