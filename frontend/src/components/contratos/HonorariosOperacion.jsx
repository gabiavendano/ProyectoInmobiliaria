import { InputG } from "../common/FormUI";
import { aplicarHonorarios, cambiarMonto, cambiarPorcentaje, totalHonorarios } from "../../utils/honorarios";
import OpcionesMoneda from "../common/OpcionesMoneda";
import { simboloMoneda } from "../../utils/monedas";

const ESTADOS = ["Pendiente", "Pactado", "Facturado", "Parcialmente abonado", "Abonado", "Anulado"];
const FORMAS = ["Efectivo", "Transferencia", "Cheque", "A convenir"];
const ROLES = {
  "Venta": ["Vendedor", "Comprador"], "Permuta": ["Parte A", "Parte B"],
  "Alquiler Anual": ["Locador", "Locatario"], "Temporario": ["Locador", "Huésped"],
};
const fmt = (n, moneda) => `${simboloMoneda(moneda)} ${Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

function TarjetaParte({ lado, titulo, color, form, setForm }) {
  const p = `honParte${lado}`;
  const estado = form[`${p}Estado`];
  const pideFactura = ["Facturado", "Parcialmente abonado", "Abonado"].includes(estado);
  const pideCobro = ["Parcialmente abonado", "Abonado"].includes(estado);
  const set = (campo, valor) => setForm(prev => ({ ...prev, [`${p}${campo}`]: valor }));
  const cambiarEstado = (valor) => setForm(prev => {
    const sig = { ...prev, [`${p}Estado`]: valor };
    // "Abonado" = se cobró todo; "Anulado" = nada
    if (valor === "Abonado") sig[`${p}Cobrado`] = prev[`${p}Monto`];
    if (valor === "Anulado" || valor === "Pendiente" || valor === "Pactado") {
      if (valor === "Anulado") sig[`${p}Cobrado`] = "";
    }
    return sig;
  });
  return (
    <div style={{ backgroundColor: "#F8FAFC", padding: "15px", borderRadius: "8px", border: "1px solid #E0E0E0", marginBottom: "15px", opacity: estado === "Anulado" ? 0.6 : 1 }}>
      <span style={{ fontWeight: "bold", display: "block", marginBottom: "10px", color }}>A cargo de: {titulo}</span>
      <div className="form-row" style={{ marginBottom: 0 }}>
        <InputG label="Porcentaje (%)" name={`${p}Porcentaje`} type="number" min="0" step="0.01" valorActual={form[`${p}Porcentaje`]}
          onChange={(e) => setForm(prev => cambiarPorcentaje(prev, lado, e.target.value))} />
        <InputG label="Monto a cobrar" name={`${p}Monto`} type="number" min="0" step="0.01" icon="fa-sack-dollar" valorActual={form[`${p}Monto`]}
          onChange={(e) => setForm(prev => cambiarMonto(prev, lado, e.target.value))} />
        <div className="form-group"><label>Forma de pago</label>
          <select value={form[`${p}FormaPago`]} onChange={(e) => set("FormaPago", e.target.value)}>{FORMAS.map(f => <option key={f}>{f}</option>)}</select>
        </div>
        <div className="form-group"><label>Estado</label>
          <select value={estado} onChange={(e) => cambiarEstado(e.target.value)}>{ESTADOS.map(f => <option key={f}>{f}</option>)}</select>
        </div>
      </div>
      {(pideFactura || pideCobro) && (
        <div className="form-row animation-fade-in" style={{ marginTop: "12px", marginBottom: 0 }}>
          {pideFactura && <InputG label="N° de comprobante (factura)" name={`${p}Comprobante`} maxLength={50} valorActual={form[`${p}Comprobante`]} onChange={(e) => set("Comprobante", e.target.value)} />}
          {pideFactura && <InputG label="Fecha de emisión" name={`${p}FechaEmision`} type="date" valorActual={form[`${p}FechaEmision`]} onChange={(e) => set("FechaEmision", e.target.value)} />}
          {pideCobro && <InputG label="Monto cobrado" name={`${p}Cobrado`} type="number" min="0" step="0.01" valorActual={form[`${p}Cobrado`]} onChange={(e) => set("Cobrado", e.target.value)} />}
          {pideCobro && <InputG label="Fecha de cobro" name={`${p}FechaCobro`} type="date" valorActual={form[`${p}FechaCobro`]} onChange={(e) => set("FechaCobro", e.target.value)} />}
        </div>
      )}
      {pideCobro && Number(form[`${p}Monto`]) > 0 && (
        <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "var(--color-gris-texto)" }}>
          Falta cobrar: <strong>{fmt(Math.max(Number(form[`${p}Monto`]) - Number(form[`${p}Cobrado`] || 0), 0), form.honMoneda)}</strong>
        </div>
      )}
    </div>
  );
}

/**
 * Honorarios profesionales de la operación.
 * Los porcentajes y montos se calculan SOLOS con la escala de la Ley 9.445 (art. 25) según el tipo de operación,
 * pero se pueden modificar; "Restablecer" vuelve a la escala legal.
 */
export default function HonorariosOperacion({ form, setForm, tab, propiedad }) {
  const [rolA, rolB] = ROLES[tab] || ROLES["Venta"];
  const total = totalHonorarios(form);
  const sinMatricula = total > 0 && !String(form.matriculaCorredor || "").trim();

  const restablecer = () => setForm(prev => aplicarHonorarios({ ...prev, honEditado: false }, tab, propiedad));

  return (
    <div style={{ padding: "25px", borderTop: "2px solid #eee", backgroundColor: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px", gap: "15px", flexWrap: "wrap" }}>
        <div>
          <h6 style={{ color: "var(--color-negro)", marginBottom: "5px", fontSize: "1.1rem" }}>
            <i className="fa-solid fa-scale-balanced" style={{ color: "var(--color-rojo)" }}></i> Honorarios Profesionales
          </h6>
          <p style={{ fontSize: "0.85rem", color: "#666", maxWidth: "720px", margin: 0 }}>
            Se calculan solos con la escala de la <strong>Ley Provincial N° 9.445, art. 25</strong> (los honorarios se pueden pactar libremente, art. 24): podés cambiar cualquier porcentaje o monto.
          </p>
        </div>
        <a href="https://www.afip.gob.ar/facturacion/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ borderColor: "#1565C0", color: "#1565C0", padding: "10px 15px" }}>
          <i className="fa-solid fa-file-invoice"></i> Facturar en ARCA (ex AFIP)
        </a>
      </div>

      <div style={{ background: "#EEF6FF", border: "1px solid #b9d7f5", borderRadius: "8px", padding: "12px 16px", marginBottom: "15px", fontSize: "0.88rem" }}>
        <div><i className="fa-solid fa-gavel"></i> <strong>Escala aplicada:</strong> {form.honEscala || "completá los datos de la operación para calcular"}</div>
        {Number(form.honBase) > 0 && <div style={{ marginTop: "4px" }}>Base de cálculo: <strong>{fmt(form.honBase, form.honMoneda)}</strong></div>}
        {form.honEditado ? (
          <div style={{ marginTop: "6px", color: "#8a5a00" }}>
            <i className="fa-solid fa-pen"></i> Modificaste los honorarios a mano: ya no se recalculan solos.{" "}
            <button type="button" className="btn btn-outline btn-sm" onClick={restablecer}><i className="fa-solid fa-rotate-left"></i> Volver a la escala legal</button>
          </div>
        ) : (
          <div style={{ marginTop: "6px", color: "#2E7D32" }}><i className="fa-solid fa-wand-magic-sparkles"></i> Calculados automáticamente: si cambiás el precio, las fechas o la propiedad, se actualizan.</div>
        )}
      </div>

      <TarjetaParte lado="A" titulo={rolA} color="#1565C0" form={form} setForm={setForm} />
      <TarjetaParte lado="B" titulo={rolB} color="#2E7D32" form={form} setForm={setForm} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "12px 16px", background: "#F1F8E9", borderRadius: "8px", border: "1px solid #C5E1A5" }}>
        <span style={{ fontWeight: "bold" }}>Honorarios totales de la inmobiliaria</span>
        <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>{fmt(total, form.honMoneda)}</span>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: "0.75rem" }}>Moneda</label>
          <select value={form.honMoneda} onChange={(e) => setForm(prev => ({ ...prev, honMoneda: e.target.value }))}><OpcionesMoneda /></select>
        </div>
      </div>

      {sinMatricula && (
        <p role="alert" style={{ marginTop: "12px", fontSize: "0.85rem", color: "#8a5a00", background: "#FFF8E1", padding: "10px 14px", borderRadius: "8px" }}>
          <i className="fa-solid fa-triangle-exclamation"></i> Ley 9.445: solo pueden cobrar honorarios los corredores matriculados en el Colegio (CPI). Cargá la matrícula del corredor en <em>"Datos legales y verificaciones"</em> (más abajo).
        </p>
      )}
    </div>
  );
}
