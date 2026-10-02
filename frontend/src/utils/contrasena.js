// Reglas de contraseña (las mismas que valida el backend en el registro)
export const MIN_CONTRASENA = 8;
export const AYUDA_CONTRASENA = "Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.";

/** Devuelve el mensaje del primer problema, o "" si la contraseña es válida. */
export const validarContrasena = (p, usuario = "") => {
  const v = String(p ?? "");
  if (v.length < MIN_CONTRASENA) return `La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`;
  if (v.length > 72) return "La contraseña es demasiado larga (máximo 72 caracteres).";
  if (!/[a-zñáéíóú]/.test(v)) return "La contraseña debe incluir al menos una letra minúscula.";
  if (!/[A-ZÑÁÉÍÓÚ]/.test(v)) return "La contraseña debe incluir al menos una letra mayúscula.";
  if (!/\d/.test(v)) return "La contraseña debe incluir al menos un número.";
  if (usuario && v.toLowerCase() === String(usuario).trim().toLowerCase()) return "La contraseña no puede ser igual al usuario.";
  return "";
};
