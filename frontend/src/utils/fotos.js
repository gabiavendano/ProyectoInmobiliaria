import { API_ORIGIN } from "../config";
// Las fotos subidas al servidor vienen como ruta relativa ("/api/archivos/fotos/3/abc.jpg").
// Este helper las convierte en una dirección completa para poder mostrarlas.
const ORIGEN_API = API_ORIGIN;
export const FOTO_POR_DEFECTO = "/sin-foto.svg";

export const urlFoto = (u) => (typeof u === "string" && u.startsWith("/") ? ORIGEN_API + u : u);

/** Lista de fotos para el sitio público; si la propiedad no tiene, una imagen de relleno. */
export const fotosPublicas = (fotos) => {
  const lista = Array.isArray(fotos) ? fotos.filter(Boolean).map(urlFoto) : [];
  return lista.length ? lista : [FOTO_POR_DEFECTO];
};
