// Avisos en pantalla (reemplazan a los alert() del navegador: no bloquean y se ven en el diseño del sistema).
// Uso: avisar("Texto")  ·  avisar("Texto", "error" | "ok" | "info")
// Si no se indica el tipo, se deduce por el texto (errores: "No se pudo…", "Elegí…", "⚠️…", etc.).
const RE_ERROR = /^\s*(⚠|❌|error|no se pudo|no pude|no hay|elegí|ingresá|completá|escribí|el .* (debe|no puede)|la .* (debe|no puede)|.*demasiad)/i;
const RE_OK = /^\s*(✅|.*(guardad[ao]|actualizad[ao]|registrad[ao]|cread[ao]|eliminad[ao]|enviad[ao]))/i;

export function avisar(mensaje, tipo) {
  const texto = String(mensaje ?? "").replace(/^(?:\u26A0\uFE0F?|\u2705|\u274C|\s)+/u, "").trim();
  if (!texto) return;
  const t = tipo || (RE_ERROR.test(String(mensaje)) ? "error" : RE_OK.test(String(mensaje)) ? "ok" : "info");
  window.dispatchEvent(new CustomEvent("app-aviso", { detail: { texto, tipo: t } }));
}
