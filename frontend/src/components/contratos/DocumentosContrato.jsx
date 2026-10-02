import { useEffect, useRef, useState } from "react";
import { getDocsContrato, subirDocContrato, eliminarDocContrato, abrirDocContrato } from "../../services/api";
import { avisar } from "../../utils/avisos";

const MAX_DOCS = 30;
const MAX_PDF_MB = 15;
const TIPOS_DOC_CONTRATO = ["DNI", "Garantía", "Escritura", "Contrato firmado", "Reserva", "Comprobante", "Otro"];

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
const errorDe = (err) => err.response?.data?.error || err.message;

/**
 * Documentos PDF de una operación. Arrastrá los archivos (o hacé clic).
 * - Operación ya guardada (idOperacion): se suben y guardan en el acto.
 * - Operación nueva: quedan en espera (docsPend) y se suben al tocar "Guardar Operación".
 */
export default function DocumentosContrato({ idOperacion, docsPend, setDocsPend }) {
  const [docs, setDocs] = useState([]);
  const [aviso, setAviso] = useState("");
  const [ok, setOk] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("DNI");
  const input = useRef(null);
  const pend = docsPend || [];

  useEffect(() => {
    if (!idOperacion) return undefined;
    let vivo = true;
    getDocsContrato(idOperacion).then(r => { if (vivo) setDocs(r.data); }).catch(() => {});
    return () => { vivo = false; };
  }, [idOperacion]);

  const procesar = async (lista) => {
    setOk("");
    const problemas = [];
    let buenos = [];
    for (const f of lista) {
      const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!esPdf) problemas.push(`"${f.name}" no es un PDF.`);
      else if (f.size > MAX_PDF_MB * 1024 * 1024) problemas.push(`"${f.name}" pesa ${mb(f.size)} MB (máximo ${MAX_PDF_MB} MB).`);
      else buenos.push(f);
    }
    const lugar = Math.max(MAX_DOCS - docs.length - pend.length, 0);
    if (buenos.length > lugar) { problemas.push(`Solo entran ${lugar} documento(s) más (máximo ${MAX_DOCS}).`); buenos = buenos.slice(0, lugar); }
    if (buenos.length > 0) {
      if (idOperacion) {
        setSubiendo(true);
        let subidos = 0;
        for (const f of buenos) {
          try { await subirDocContrato(idOperacion, f, tipoDoc, ""); subidos++; }
          catch (err) { problemas.push(`"${f.name}": ${errorDe(err)}`); }
        }
        try { const r = await getDocsContrato(idOperacion); setDocs(r.data); } catch { /* se actualiza al reabrir */ }
        if (subidos > 0) setOk(`${subidos} documento(s) guardado(s) como "${tipoDoc}".`);
        setSubiendo(false);
      } else {
        setDocsPend([...pend, ...buenos.map(f => ({ file: f, tipo: tipoDoc, descripcion: "" }))]);
      }
    }
    setAviso(problemas.join("\n"));
  };

  const soltar = (e) => { e.preventDefault(); setSobre(false); procesar(Array.from(e.dataTransfer?.files || [])); };
  const elegir = (e) => { const l = Array.from(e.target.files || []); e.target.value = ""; procesar(l); };

  const borrar = async (d) => {
    if (!window.confirm(`¿Borrar el documento "${d.nombre}"? Se elimina del servidor.`)) return;
    setOcupado(true);
    try { await eliminarDocContrato(idOperacion, d.idDocumento); setDocs(docs.filter(x => x.idDocumento !== d.idDocumento)); }
    catch (err) { avisar(`No se pudo borrar el documento: ${errorDe(err)}`); }
    finally { setOcupado(false); }
  };
  const abrir = async (d) => {
    try { await abrirDocContrato(idOperacion, d.idDocumento); }
    catch (err) { avisar(`No se pudo abrir el documento: ${errorDe(err)}`); }
  };

  const zona = {
    border: `2px dashed ${sobre ? "var(--color-rojo)" : "#b8bfc7"}`, backgroundColor: sobre ? "#FFF0F0" : "#fff",
    borderRadius: "10px", padding: "22px 15px", textAlign: "center", cursor: subiendo ? "progress" : "pointer", color: "var(--color-gris-texto)",
  };
  const nota = idOperacion ? "Se guardan en el momento en que los soltás." : "Como la operación es nueva, quedan en espera y se guardan al tocar Guardar Operación.";

  return (
    <div>
      {docs.length > 0 && (
        <table style={{ width: "100%", marginBottom: "12px" }}>
          <thead><tr><th>Documento</th><th>Tipo</th><th>Acciones</th></tr></thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.idDocumento}>
                <td><i className="fa-solid fa-file-pdf" style={{ color: "var(--color-rojo)" }}></i> {d.nombre}</td>
                <td>{d.tipo}</td>
                <td><div className="action-btns">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => abrir(d)} title="Abrir"><i className="fa-solid fa-eye"></i></button>
                  <button type="button" className="btn btn-rojo btn-sm" disabled={ocupado} onClick={() => borrar(d)} title="Borrar"><i className="fa-solid fa-trash"></i></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pend.map((d, i) => (
        <div key={`${d.file.name}-${i}`} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", padding: "8px 10px", marginBottom: "8px", border: "1px dashed var(--color-rojo)", borderRadius: "8px", background: "#fff" }}>
          <span style={{ flex: "1 1 200px", fontSize: "0.9rem", textAlign: "left" }}><i className="fa-solid fa-file-pdf" style={{ color: "var(--color-rojo)" }}></i> {d.file.name} <small>({mb(d.file.size)} MB · en espera)</small></span>
          <select value={d.tipo} onChange={(e) => setDocsPend(pend.map((x, k) => k === i ? { ...x, tipo: e.target.value } : x))} style={{ maxWidth: "190px" }}>
            {TIPOS_DOC_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDocsPend(pend.filter((_, k) => k !== i))} title="Quitar"><i className="fa-solid fa-xmark"></i></button>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px", justifyContent: "center" }}>
        <label style={{ margin: 0, fontSize: "0.9rem" }}>Tipo de los documentos que subas:</label>
        <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} style={{ maxWidth: "200px" }}>
          {TIPOS_DOC_CONTRATO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={zona} role="button" tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={soltar}
        onClick={() => { if (!subiendo) input.current?.click(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}>
        <i className={`fa-solid ${subiendo ? "fa-spinner fa-spin" : "fa-file-arrow-up"}`} style={{ fontSize: "1.6rem", color: "var(--color-rojo)" }}></i>
        <div style={{ fontWeight: 600, marginTop: "6px" }}>{subiendo ? "Subiendo documentos..." : sobre ? "Soltá los PDF acá" : "Arrastrá los PDF acá o hacé clic para elegirlos"}</div>
        <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>Solo PDF · hasta {MAX_PDF_MB} MB cada uno · {docs.length + pend.length} de {MAX_DOCS} · privados. {nota}</div>
      </div>
      <input ref={input} type="file" multiple accept="application/pdf,.pdf" onChange={elegir} style={{ display: "none" }} />
      {ok && <div style={{ fontSize: "0.85rem", color: "#1B5E20", background: "#E8F5E9", padding: "10px 14px", borderRadius: "8px", marginTop: "12px" }}><i className="fa-solid fa-circle-check"></i> {ok}</div>}
      {aviso && <div style={{ whiteSpace: "pre-line", fontSize: "0.85rem", color: "#D32F2F", background: "#FDECEA", padding: "10px 14px", borderRadius: "8px", marginTop: "12px" }}><i className="fa-solid fa-triangle-exclamation"></i> {aviso}</div>}
    </div>
  );
}
