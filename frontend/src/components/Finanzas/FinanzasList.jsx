import { useState } from "react";
import FinanzasForm from "./FinanzasForm";
import MovimientosTab from "./MovimientosTab";
import CobranzaTab from "./CobranzaTab";
import CobranzaEstadias from "./CobranzaEstadias";
import ServiciosTab from "./ServiciosTab";
import RendicionesTab from "./RendicionesTab";
import AlertasFinanzas from "./AlertasFinanzas";

/**
 * Gestión Financiera (Finanzas y Cobros). Todo se guarda en el backend:
 *  - Propietarios y Rendiciones: estado de cuenta, historial por propiedad y rendición mensual.
 *  - Carga Servicios / Prorrateo: servicios por unidad que se suman al cobro del inquilino.
 *  - Cobranza Inquilino: liquidación mensual con mora, servicios y recibo oficial correlativo.
 *  - Movimientos: caja manual (ingresos, egresos, transferencias) con edición y anulación.
 */
function FinanzasList() {
  const [tabActual, setTabActual] = useState("Cuentas");
  const [form, setForm] = useState(null);        // null = lista, {} = nuevo, {movimiento} = edición
  const [version, setVersion] = useState(0);
  const cambio = () => setVersion((v) => v + 1);

  if (form) {
    return (
      <div className="animation-fade-in">
        <FinanzasForm movimiento={form.movimiento} onCancelar={() => setForm(null)} onGuardado={() => { setForm(null); cambio(); setTabActual("Movimientos"); }} />
      </div>
    );
  }

  return (
    <div className="animation-fade-in">
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 15 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="https://www.afip.gob.ar/facturacion/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ borderColor: "#1565C0", color: "#1565C0", backgroundColor: "white" }}>
            <i className="fa-solid fa-file-invoice"></i> ARCA
          </a>
          <button className="btn btn-rojo" onClick={() => setForm({})}><i className="fa-solid fa-plus"></i> Manual</button>
        </div>
      </div>

      <AlertasFinanzas version={version} />

      <div className="tabs">
        <button className={`tab-btn ${tabActual === "Cuentas" ? "active" : ""}`} onClick={() => setTabActual("Cuentas")}><i className="fa-solid fa-chart-line"></i> Propietarios y Rendiciones</button>
        <button className={`tab-btn ${tabActual === "Servicios" ? "active" : ""}`} onClick={() => setTabActual("Servicios")}><i className="fa-solid fa-bolt"></i> Carga Servicios / Prorrateo</button>
        <button className={`tab-btn ${tabActual === "Cobro" ? "active" : ""}`} onClick={() => setTabActual("Cobro")}><i className="fa-solid fa-hand-holding-dollar"></i> Cobranza Inquilino</button>
        <button className={`tab-btn ${tabActual === "Estadias" ? "active" : ""}`} onClick={() => setTabActual("Estadias")}><i className="fa-solid fa-suitcase-rolling"></i> Cobranza Estadías</button>
        <button className={`tab-btn ${tabActual === "Movimientos" ? "active" : ""}`} onClick={() => setTabActual("Movimientos")}><i className="fa-solid fa-list"></i> Movimientos</button>
      </div>

      {tabActual === "Cuentas" && <RendicionesTab onCambio={cambio} />}
      {tabActual === "Servicios" && <ServiciosTab />}
      {tabActual === "Cobro" && <CobranzaTab onCambio={cambio} />}
      {tabActual === "Estadias" && <CobranzaEstadias onCambio={cambio} />}
      {tabActual === "Movimientos" && <MovimientosTab version={version} onNuevo={() => setForm({})} onEditar={(m) => setForm({ movimiento: m })} />}
    </div>
  );
}

export default FinanzasList;
