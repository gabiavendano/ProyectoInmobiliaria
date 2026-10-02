// Reglas de texto de nombres y usuarios (las mismas que valida el backend)
const tieneProhibidos = (t) => Array.from(String(t ?? "")).some(ch => ch === "<" || ch === ">" || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);

/** Mensaje del problema de un nombre o apellido, o "" si es válido. */
export const validarNombre = (valor, campo = "nombre") =>
  tieneProhibidos(valor) ? `El ${campo} no puede contener los símbolos < ni >.` : "";

/** Mensaje del problema de un usuario (letras, números y . _ @ + -), o "" si es válido. */
export const validarUsuario = (u) =>
  /^[A-Za-z0-9._@+-]{3,100}$/.test(String(u ?? "").trim()) ? "" : "El usuario solo puede tener letras, números y los símbolos . _ @ + - (de 3 a 100 caracteres).";
