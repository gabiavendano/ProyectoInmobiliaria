// Dirección del backend. En desarrollo usa localhost:8080; en producción se define
// con la variable VITE_API_URL (por ejemplo en frontend/.env.production):
//   VITE_API_URL=https://api.tu-dominio.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "");
export const API_BASE = `${API_ORIGIN}/api`;
