import { useEffect, useMemo, useRef, useState } from "react";
import {
  getFotosPropiedad, subirFotosPropiedad, fotoPrincipalPropiedad, eliminarFotoPropiedad,
  getDocsPropiedad, subirDocPropiedad, eliminarDocPropiedad, abrirDocPropiedad,
} from "../../services/api";
import { urlFoto } from "../../utils/fotos";
import { avisar } from "../../utils/avisos";

// Límites (los mismos que controla el servidor)
const MAX_FOTOS = 20;
const MAX_DOCS = 30;
const MAX_FOTO_MB = 10;
const MAX_PDF_MB = 15;
const TIPOS_DOC = ["Escritura", "Plano", "Informe de dominio", "Recibo", "Otro"];
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
const errorDe = (err) => err.response?.data?.error || err.message;

/**
 * Sección "Multimedia y documentos" de la ficha.
 * - Se puede ARRASTRAR los archivos sobre cada recuadro (o hacer clic para elegirlos).
 * - Si la ficha ya existe, al soltar el archivo se sube y se guarda en el acto.
 * - Si la ficha es nueva (todavía sin número), quedan en espera y se suben al tocar "Guardar Ficha".
 */
export default function MultimediaPropiedad({ idPropiedad, fotosPend, setFotosPend, docsPend, setDocsPend }) {
  const [fotos, setFotos] = useState([]);
  const [docs, setDocs] = useState([]);
  const [avisoFotos, setAvisoFotos] = useState("");
  const [avisoDocs, setAvisoDocs] = useState("");
  const [okFotos, setOkFotos] = useState("");
  const [okDocs, setOkDocs] = useState("");
  const [subiendoFotos, setSubiendoFotos] = useState(false);
  const [subiendoDocs, setSubiendoDocs] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [sobreFotos, setSobreFotos] = useState(false);
  const [sobreDocs, setSobreDocs] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("Escritura");
  const inputFotos = useRef(null);
  const inputDocs = useRef(null);

  // Lo que ya está en el servidor
  useEffect(() => {
    if (!idPropiedad) return undefined;
    let vivo = true;
    getFotosPropiedad(idPropiedad).then(r => { if (vivo) setFotos(r.data); }).catch(() => {});
    getDocsPropiedad(idPropiedad).then(r => { if (vivo) setDocs(r.data); }).catch(() => {});
    return () => { vivo = false; };
  }, [idPropiedad]);

  // Miniaturas de las fotos que todavía no se subieron
  const previas = useMemo(() => fotosPend.map(f => ({ f, url: URL.createObjectURL(f) })), [fotosPend]);
  useEffect(() => () => previas.forEach(p => URL.revokeObjectURL(p.url)), [previas]);

  // ── FOTOS: valida, y sube en el acto (ficha existente) o deja en espera (ficha nueva) ──
  const procesarFotos = async (lista) => {
    setOkFotos("");
    const problemas = [];
    let buenas = [];
    for (const f of lista) {
      if (!TIPOS_FOTO.includes(f.type)) problemas.push(`"${f.name}" no es una imagen válida (JPG, PNG, WEBP o GIF).`);
      else if (f.size > MAX_FOTO_MB * 1024 * 1024) problemas.push(`"${f.name}" pesa ${mb(f.size)} MB (máximo ${MAX_FOTO_MB} MB).`);
      else buenas.push(f);
    }
    const lugar = Math.max(MAX_FOTOS - fotos.length - fotosPend.length, 0);
    if (buenas.length > lugar) {
      problemas.push(`Solo entran ${lugar} foto(s) más (máximo ${MAX_FOTOS} por propiedad).`);
      buenas = buenas.slice(0, lugar);
    }
    if (buenas.length > 0) {
      if (idPropiedad) {
        setSubiendoFotos(true);
        try {
          const r = await subirFotosPropiedad(idPropiedad, buenas);
          setFotos(r.data);
          setOkFotos(`${buenas.length} foto(s) guardada(s).`);
        } catch (err) {
          problemas.push(`No se pudieron guardar las fotos: ${errorDe(err)}`);
        } finally {
          setSubiendoFotos(false);
        }
      } else {
        setFotosPend([...fotosPend, ...buenas]);
      }
    }
    setAvisoFotos(problemas.join("\n"));
  };

  // ── DOCUMENTOS ──
  const procesarDocs = async (lista) => {
    setOkDocs("");
    const problemas = [];
    let buenos = [];
    for (const f of lista) {
      const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!esPdf) problemas.push(`"${f.name}" no es un PDF.`);
      else if (f.size > MAX_PDF_MB * 1024 * 1024) problemas.push(`"${f.name}" pesa ${mb(f.size)} MB (máximo ${MAX_PDF_MB} MB).`);
      else buenos.push(f);
    }
    const lugar = Math.max(MAX_DOCS - docs.length - docsPend.length, 0);
    if (buenos.length > lugar) {
      problemas.push(`Solo entran ${lugar} documento(s) más (máximo ${MAX_DOCS} por propiedad).`);
      buenos = buenos.slice(0, lugar);
    }
    if (buenos.length > 0) {
      if (idPropiedad) {
        setSubiendoDocs(true);
        let subidos = 0;
        for (const f of buenos) {
          try { await subirDocPropiedad(idPropiedad, f, tipoDoc, ""); subidos++; }
          catch (err) { problemas.push(`"${f.name}": ${errorDe(err)}`); }
        }
        try { const r = await getDocsPropiedad(idPropiedad); setDocs(r.data); } catch { /* se actualiza al reabrir la ficha */ }
        if (subidos > 0) setOkDocs(`${subidos} documento(s) guardado(s) como "${tipoDoc}".`);
        setSubiendoDocs(false);
      } else {
        setDocsPend([...docsPend, ...buenos.map(f => ({ file: f, tipo: tipoDoc, descripcion: "" }))]);
      }
    }
    setAvisoDocs(problemas.join("\n"));
  };

  const soltarFotos = (e) => { e.preventDefault(); setSobreFotos(false); procesarFotos(Array.from(e.dataTransfer?.files || [])); };
  const soltarDocs = (e) => { e.preventDefault(); setSobreDocs(false); procesarDocs(Array.from(e.dataTransfer?.files || [])); };
  const elegirFotos = (e) => { const l = Array.from(e.target.files || []); e.target.value = ""; procesarFotos(l); };
  const elegirDocs = (e) => { const l = Array.from(e.target.files || []); e.target.value = ""; procesarDocs(l); };

  const borrarFoto = async (img) => {
    if (!window.confirm("¿Borrar esta foto? Se elimina del servidor y del sitio público.")) return;
    setOcupado(true);
    try { const r = await eliminarFotoPropiedad(idPropiedad, img.idImagen); setFotos(r.data); }
    catch (err) { avisar(`No se pudo borrar la foto: ${errorDe(err)}`); }
    finally { setOcupado(false); }
  };

  const hacerPrincipal = async (img) => {
    setOcupado(true);
    try { const r = await fotoPrincipalPropiedad(idPropiedad, img.idImagen); setFotos(r.data); }
    catch (err) { avisar(`No se pudo cambiar la foto principal: ${errorDe(err)}`); }
    finally { setOcupado(false); }
  };

  const borrarDoc = async (d) => {
    if (!window.confirm(`¿Borrar el documento "${d.nombre}"? Se elimina del servidor.`)) return;
    setOcupado(true);
    try { await eliminarDocPropiedad(idPropiedad, d.idDocumento); setDocs(docs.filter(x => x.idDocumento !== d.idDocumento)); }
    catch (err) { avisar(`No se pudo borrar el documento: ${errorDe(err)}`); }
    finally { setOcupado(false); }
  };

  const abrirDoc = async (d) => {
    try { await abrirDocPropiedad(idPropiedad, d.idDocumento); }
    catch (err) { avisar(`No se pudo abrir el documento: ${errorDe(err)}`); }
  };

  const caja = { backgroundColor: "#F8FAFC", padding: "20px", borderRadius: "8px", border: "1px solid var(--color-gris-borde)", marginBottom: "25px" };
  const miniatura = { position: "relative", width: "130px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--color-gris-borde)", background: "#fff" };
  const imgStyle = { width: "100%", height: "95px", objectFit: "cover", display: "block" };
  const zona = (activa, ocupada) => ({
    border: `2px dashed ${activa ? "var(--color-rojo)" : "#b8bfc7"}`,
    backgroundColor: activa ? "#FFF0F0" : "#fff",
    borderRadius: "10px", padding: "22px 15px", textAlign: "center", cursor: ocupada ? "progress" : "pointer",
    color: "var(--color-gris-texto)", transition: "background-color .15s, border-color .15s",
  });
  const cartelError = { whiteSpace: "pre-line", fontSize: "0.85rem", color: "#D32F2F", background: "#FDECEA", padding: "10px 14px", borderRadius: "8px", marginTop: "12px" };
  const cartelOk = { fontSize: "0.85rem", color: "#1B5E20", background: "#E8F5E9", padding: "10px 14px", borderRadius: "8px", marginTop: "12px" };
  const nota = idPropiedad
    ? "Se guardan en el momento en que los soltás."
    : "Como la ficha es nueva, quedan en espera y se guardan al tocar Guardar Ficha.";

  return (
    <div>
      <h6 style={{ color: "var(--color-negro)", marginBottom: "10px" }}><i className="fa-solid fa-camera" style={{ color: "var(--color-rojo)" }}></i> Fotos de la Propiedad</h6>
      <div style={caja}>
        {(fotos.length > 0 || previas.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "15px" }}>
            {fotos.map(img => (
              <div key={img.idImagen} style={miniatura}>
                <img src={urlFoto(img.url)} alt="Foto de la propiedad" style={imgStyle} />
                {img.principal && <span className="badge badge-warning" style={{ position: "absolute", top: "5px", left: "5px", fontSize: "0.65rem" }}><i className="fa-solid fa-star"></i> Principal</span>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px" }}>
                  <button type="button" className="btn btn-outline btn-sm" disabled={ocupado || img.principal} onClick={() => hacerPrincipal(img)} title="Usar como foto principal"><i className="fa-solid fa-star"></i></button>
                  <button type="button" className="btn btn-rojo btn-sm" disabled={ocupado} onClick={() => borrarFoto(img)} title="Borrar foto"><i className="fa-solid fa-trash"></i></button>
                </div>
              </div>
            ))}
            {previas.map((p, i) => (
              <div key={p.url} style={{ ...miniatura, borderStyle: "dashed", borderColor: "var(--color-rojo)" }}>
                <img src={p.url} alt="Foto en espera" style={imgStyle} />
                <span className="badge badge-blue" style={{ position: "absolute", top: "5px", left: "5px", fontSize: "0.65rem" }}>En espera</span>
                <div style={{ padding: "5px", textAlign: "right" }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setFotosPend(fotosPend.filter((_, k) => k !== i))} title="Quitar"><i className="fa-solid fa-xmark"></i></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={zona(sobreFotos, subiendoFotos)}
          onDragOver={(e) => { e.preventDefault(); setSobreFotos(true); }}
          onDragLeave={() => setSobreFotos(false)}
          onDrop={soltarFotos}
          onClick={() => { if (!subiendoFotos) inputFotos.current?.click(); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputFotos.current?.click(); } }}
        >
          <i className={`fa-solid ${subiendoFotos ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} style={{ fontSize: "1.6rem", color: "var(--color-rojo)" }}></i>
          <div style={{ fontWeight: 600, marginTop: "6px" }}>{subiendoFotos ? "Subiendo fotos..." : sobreFotos ? "Soltá las fotos acá" : "Arrastrá las fotos acá o hacé clic para elegirlas"}</div>
          <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>JPG, PNG, WEBP o GIF · hasta {MAX_FOTO_MB} MB cada una · {fotos.length + fotosPend.length} de {MAX_FOTOS}. {nota}</div>
        </div>
        <input ref={inputFotos} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={elegirFotos} style={{ display: "none" }} />
        {okFotos && <div style={cartelOk}><i className="fa-solid fa-circle-check"></i> {okFotos}</div>}
        {avisoFotos && <div style={cartelError}><i className="fa-solid fa-triangle-exclamation"></i> {avisoFotos}</div>}
      </div>

      <h6 style={{ color: "var(--color-negro)", marginBottom: "10px" }}><i className="fa-solid fa-file-pdf" style={{ color: "var(--color-rojo)" }}></i> Documentos Legales (Escrituras, Planos, Recibos)</h6>
      <div style={caja}>
        {docs.length > 0 && (
          <table style={{ width: "100%", marginBottom: "12px" }}>
            <thead><tr><th>Documento</th><th>Tipo</th><th>Acciones</th></tr></thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.idDocumento}>
                  <td><i className="fa-solid fa-file-pdf" style={{ color: "var(--color-rojo)" }}></i> {d.nombre}{d.descripcion && <div style={{ fontSize: "0.8rem", color: "var(--color-gris-texto)" }}>{d.descripcion}</div>}</td>
                  <td>{d.tipo}</td>
                  <td>
                    <div className="action-btns">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => abrirDoc(d)} title="Abrir"><i className="fa-solid fa-eye"></i></button>
                      <button type="button" className="btn btn-rojo btn-sm" disabled={ocupado} onClick={() => borrarDoc(d)} title="Borrar"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {docsPend.map((d, i) => (
          <div key={`${d.file.name}-${i}`} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", padding: "8px 10px", marginBottom: "8px", border: "1px dashed var(--color-rojo)", borderRadius: "8px", background: "#fff" }}>
            <span style={{ flex: "1 1 200px", fontSize: "0.9rem" }}><i className="fa-solid fa-file-pdf" style={{ color: "var(--color-rojo)" }}></i> {d.file.name} <small>({mb(d.file.size)} MB · en espera)</small></span>
            <select value={d.tipo} onChange={(e) => setDocsPend(docsPend.map((x, k) => k === i ? { ...x, tipo: e.target.value } : x))} style={{ maxWidth: "190px" }}>
              {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={d.descripcion} maxLength={255} placeholder="Descripción (opcional)" onChange={(e) => setDocsPend(docsPend.map((x, k) => k === i ? { ...x, descripcion: e.target.value } : x))} style={{ flex: "1 1 180px" }} />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setDocsPend(docsPend.filter((_, k) => k !== i))} title="Quitar"><i className="fa-solid fa-xmark"></i></button>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          <label style={{ margin: 0, fontSize: "0.9rem" }}>Tipo de los documentos que subas:</label>
          <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} style={{ maxWidth: "200px" }}>
            {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div
          style={zona(sobreDocs, subiendoDocs)}
          onDragOver={(e) => { e.preventDefault(); setSobreDocs(true); }}
          onDragLeave={() => setSobreDocs(false)}
          onDrop={soltarDocs}
          onClick={() => { if (!subiendoDocs) inputDocs.current?.click(); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputDocs.current?.click(); } }}
        >
          <i className={`fa-solid ${subiendoDocs ? "fa-spinner fa-spin" : "fa-file-arrow-up"}`} style={{ fontSize: "1.6rem", color: "var(--color-rojo)" }}></i>
          <div style={{ fontWeight: 600, marginTop: "6px" }}>{subiendoDocs ? "Subiendo documentos..." : sobreDocs ? "Soltá los PDF acá" : "Arrastrá los PDF acá o hacé clic para elegirlos"}</div>
          <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>Solo PDF · hasta {MAX_PDF_MB} MB cada uno · {docs.length + docsPend.length} de {MAX_DOCS} · privados (solo personal del panel). {nota}</div>
        </div>
        <input ref={inputDocs} type="file" multiple accept="application/pdf,.pdf" onChange={elegirDocs} style={{ display: "none" }} />
        {okDocs && <div style={cartelOk}><i className="fa-solid fa-circle-check"></i> {okDocs}</div>}
        {avisoDocs && <div style={cartelError}><i className="fa-solid fa-triangle-exclamation"></i> {avisoDocs}</div>}
      </div>
    </div>
  );
}
