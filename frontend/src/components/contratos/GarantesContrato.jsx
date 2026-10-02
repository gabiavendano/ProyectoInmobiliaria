import { useState } from "react";
import { createPersona } from "../../services/api";

/**
 * Garantes / fiadores del alquiler anual.
 * Se agregan de a uno (los que hagan falta), se quitan con la ✕ y, si la persona todavía no está
 * cargada, se crea acá mismo sin salir del contrato.
 */
export default function GarantesContrato({ personas, seleccionados, onChange, onCreada }) {
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ nombreCompleto: "", dniCuit: "", telefono: "", email: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const ids = seleccionados.map(String);
  const porId = (id) => personas.find(p => String(p.idPersona) === String(id));
  const disponibles = personas.filter(p => !ids.includes(String(p.idPersona)));

  const agregar = (id) => { if (id && !ids.includes(String(id))) onChange([...ids, String(id)]); };
  const quitar = (id) => onChange(ids.filter(x => x !== String(id)));

  const crear = async () => {
    setError("");
    if (!nuevo.nombreCompleto.trim()) return setError("Escribí el nombre completo del garante.");
    if (!nuevo.dniCuit.trim()) return setError("Escribí el DNI o CUIT del garante.");
    setGuardando(true);
    try {
      const { data } = await createPersona({
        nombreCompleto: nuevo.nombreCompleto.trim(),
        dniCuit: nuevo.dniCuit.trim(),
        telPrincipal: nuevo.telefono.trim() || null,
        email: nuevo.email.trim() || null,
        tipoCliente: "Persona humana",
        rolPrincipal: "Inquilino",
        relaciones: ["Garante"],
      });
      onCreada(data);
      agregar(data.idPersona);
      setNuevo({ nombreCompleto: "", dniCuit: "", telefono: "", email: "" });
      setNuevoAbierto(false);
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || "No se pudo crear el garante. Revisá los datos (el DNI/CUIT no puede estar repetido).");
    } finally { setGuardando(false); }
  };

  const campo = (k, label, ph, type = "text") => (
    <div className="form-group">
      <label>{label}</label>
      <input type={type} value={nuevo[k]} placeholder={ph} onChange={(e) => setNuevo(n => ({ ...n, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div className="form-group" style={{ flexBasis: "100%" }}>
      <label>Garantes / Fiadores ({ids.length})</label>

      {ids.length === 0 && (
        <p style={{ fontSize: "0.85rem", color: "var(--color-gris-texto)", margin: "4px 0 8px" }}>
          Todavía no hay garantes. Agregá todos los que pida el contrato (también puede pactarse otra garantía, como un seguro de caución).
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "6px 0 10px" }}>
        {ids.map(id => {
          const p = porId(id);
          const riesgo = p && ((p.estadoBcra != null && p.estadoBcra >= 2) || p.inhibido);
          return (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: riesgo ? "#FFEBEE" : "#E8F5E9", border: `1px solid ${riesgo ? "#EF9A9A" : "#A5D6A7"}`, borderRadius: "20px", padding: "5px 6px 5px 12px", fontSize: "0.85rem" }}>
              <i className="fa-solid fa-user-shield"></i>
              <span>{p ? `${p.nombreCompleto} — ${p.dniCuit}` : `Persona #${id}`}</span>
              {riesgo && <span className="badge badge-red" style={{ fontSize: "0.65rem" }}>{p.inhibido ? "inhibido" : `BCRA ${p.estadoBcra}`}</span>}
              <button type="button" onClick={() => quitar(id)} title="Quitar garante" aria-label={`Quitar ${p?.nombreCompleto || id}`}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "1rem", lineHeight: 1, color: "#C62828" }}>✕</button>
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <select aria-label="Agregar garante" value="" onChange={(e) => agregar(e.target.value)} style={{ flex: "1 1 260px" }}>
          <option value="">+ Agregar un garante ya cargado…</option>
          {disponibles.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto} — {p.dniCuit}</option>)}
        </select>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setNuevoAbierto(v => !v)}>
          <i className="fa-solid fa-user-plus"></i> {nuevoAbierto ? "Cancelar" : "Nuevo garante"}
        </button>
      </div>

      {nuevoAbierto && (
        <div style={{ marginTop: "10px", padding: "12px", border: "1px dashed #90A4AE", borderRadius: "8px", background: "#FAFAFA" }}>
          <div className="form-row">
            {campo("nombreCompleto", "Nombre completo *", "Ej: Laura Pérez")}
            {campo("dniCuit", "DNI o CUIT *", "Solo números")}
          </div>
          <div className="form-row">
            {campo("telefono", "Teléfono", "Ej: 3541 123456")}
            {campo("email", "Email", "garante@correo.com", "email")}
          </div>
          {error && <p style={{ color: "#C62828", fontSize: "0.85rem", margin: "4px 0" }}>{error}</p>}
          <button type="button" className="btn btn-sm btn-rojo" onClick={crear} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar y agregar como garante"}
          </button>
          <p style={{ fontSize: "0.78rem", color: "var(--color-gris-texto)", marginTop: "8px" }}>
            Queda registrado en Personas. Completá ahí su situación crediticia (BCRA) y sus datos; al guardar el contrato se verifica que no esté inhibido.
          </p>
        </div>
      )}
    </div>
  );
}
