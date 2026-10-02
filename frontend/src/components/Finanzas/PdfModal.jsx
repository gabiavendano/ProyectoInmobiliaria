import { useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Vista previa de un PDF (jsPDF), con el mismo formato del módulo original:
 * "Imprimir / Abrir Externo" y "Guardar como PDF". Si se pasa `confirmar`
 * (vista previa ANTES de guardar) se muestra un botón extra que registra la operación.
 */
export default function PdfModal({ doc, titulo, archivo, onCerrar, confirmar }) {
  const url = useMemo(() => (doc ? doc.output("bloburl") : null), [doc]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!doc) return null;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 5000, display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
      <div style={{ backgroundColor: "white", padding: 25, borderRadius: 10, width: "100%", maxWidth: 950, maxHeight: "96vh", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "var(--color-negro)" }}><i className="fa-solid fa-file-pdf" style={{ color: "var(--color-rojo)" }}></i> {titulo}</h3>
          <button onClick={onCerrar} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#666" }} aria-label="Cerrar"><i className="fa-solid fa-xmark"></i></button>
        </div>
        {confirmar?.aviso && <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", padding: "8px 12px", borderRadius: 6, fontSize: "0.9rem" }}>{confirmar.aviso}</div>}
        <div style={{ width: "100%", height: "min(520px, 62vh)", border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
          <iframe src={url} style={{ width: "100%", height: "100%", border: "none" }} title={titulo} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 15, flexWrap: "wrap" }}>
          {confirmar && <button className="btn btn-outline" onClick={onCerrar} disabled={confirmar.ocupado}>Volver y corregir</button>}
          <button className="btn btn-outline" onClick={() => window.open(url, "_blank")}><i className="fa-solid fa-print"></i> Imprimir / Abrir Externo</button>
          {confirmar
            ? <button className="btn btn-rojo" onClick={confirmar.onClick} disabled={confirmar.ocupado}><i className="fa-solid fa-check"></i> {confirmar.ocupado ? "Guardando..." : confirmar.texto}</button>
            : <button className="btn btn-rojo" onClick={() => { doc.save(archivo || "documento.pdf"); onCerrar(); }}><i className="fa-solid fa-download"></i> Guardar como PDF</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
