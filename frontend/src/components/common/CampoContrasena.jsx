import { useState } from "react";

const OjoAbierto = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const OjoCerrado = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a19.8 19.8 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-3.17 4.19" />
    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Campo de contraseña con botón "ojo" para ver u ocultar lo que se escribe.
 * Acepta las mismas props que un <input>; el margen inferior del `style` se aplica al contenedor.
 */
export default function CampoContrasena({ style = {}, className, ...props }) {
  const [ver, setVer] = useState(false);
  const { marginBottom, ...estiloInput } = style;
  return (
    <div style={{ position: "relative", marginBottom, width: "100%" }}>
      <input {...props} type={ver ? "text" : "password"} className={className}
             style={{ ...estiloInput, width: "100%", boxSizing: "border-box", paddingRight: 46 }} />
      <button type="button" onClick={() => setVer(v => !v)}
              aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={ver}
              title={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent",
                       border: "none", padding: 8, cursor: "pointer", color: "#555", display: "flex", alignItems: "center", lineHeight: 0 }}>
        {ver ? <OjoCerrado /> : <OjoAbierto />}
      </button>
    </div>
  );
}
