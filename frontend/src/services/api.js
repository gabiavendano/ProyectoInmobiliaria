import axios from "axios";
import { API_BASE } from "../config";

const BASE_PROP = `${API_BASE}/propiedades`;
const BASE_PERS = `${API_BASE}/personas`;
const BASE_CONT = `${API_BASE}/contratos`;
const BASE_FIN  = `${API_BASE}/finanzas`;
const BASE_REND = `${API_BASE}/rendiciones`;
const BASE_INQ  = `${API_BASE}/inquilinos-contratos`;
const BASE_AUTH = `${API_BASE}/auth`;

// ── AUTH ──────────────────────────────────────────────────────────────
// El token de sesión vive en una cookie HttpOnly que pone el servidor: el JavaScript
// de la página NO puede leerlo (un ataque XSS no puede robarlo). Acá solo se guarda
// una marca "hay sesión" (no es un secreto) para saber si conviene preguntarle al servidor.
const SESION_KEY = "inmobiliaria_sesion";

export const marcarSesion = () => { try { localStorage.setItem(SESION_KEY, "1"); } catch { /* storage no disponible */ } };
export const haySesion    = () => { try { return localStorage.getItem(SESION_KEY) === "1"; } catch { return false; } };
export const limpiarSesion = () => { try { localStorage.removeItem(SESION_KEY); } catch { /* nada */ } };

// Versiones anteriores guardaban el token real en localStorage: se borra si quedó alguno.
try { localStorage.removeItem("inmobiliaria_token"); } catch { /* nada */ }

// Todas las llamadas llevan la cookie de sesión y el header que exige el servidor contra CSRF.
axios.defaults.withCredentials = true;
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";

/** fetch() hacia la API con la cookie de sesión (para los componentes que no usan axios). */
export const apiFetch = (ruta, opciones = {}) =>
  fetch(`${API_BASE}${ruta}`, {
    ...opciones,
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest", ...(opciones.headers || {}) },
  });

/** Cierra la sesión: el servidor borra la cookie y se limpia la marca local. */
export const cerrarSesion = async () => {
  try { await axios.post(`${BASE_AUTH}/logout`); } catch { /* sin conexión: igual se cierra acá */ }
  limpiarSesion();
};

// Si el backend dice 401 (token vencido o inválido) limpiamos la sesión y avisamos a la app.
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const esAuth = url.includes("/auth/login") || url.includes("/auth/register");
    if (status === 401 && !esAuth) {
      limpiarSesion();
      window.dispatchEvent(new Event("auth-expired"));
    }
    return Promise.reject(error);
  }
);

export const login                = (data)   => axios.post(`${BASE_AUTH}/login`, data);
export const register             = (data)   => axios.post(`${BASE_AUTH}/register`, data);
export const me                   = ()       => axios.get(`${BASE_AUTH}/me`);

// ── AUTH FIREBASE ──────────────────────────────────────────────────────
export const loginConFirebase     = (idToken) => axios.post(`${BASE_AUTH}/firebase/login`, { idToken });
export const registrarDesdeFirebase = (data)  => axios.post(`${BASE_AUTH}/firebase/register`, data);
export const getUsuarioFirebase   = (uid)     => axios.get(`${BASE_AUTH}/firebase/usuario/${uid}`);
export const upsertUsuarioFirebase = (uid, data) => axios.post(`${BASE_AUTH}/firebase/usuario/${uid}`, data);

// ── PROPIEDADES ────────────────────────────────────────────────────────
export const getPropiedades          = ()            => axios.get(BASE_PROP);
export const getPropiedadesPublicas  = ()            => axios.get(`${BASE_PROP}/publicas`);
export const getPropiedadById        = (id)          => axios.get(`${BASE_PROP}/${id}`);
export const createPropiedad         = (data)        => axios.post(BASE_PROP, data);
export const updatePropiedad         = (id, d)       => axios.put(`${BASE_PROP}/${id}`, d);
export const deletePropiedad         = (id)          => axios.delete(`${BASE_PROP}/${id}`);
export const geocodificarGoogle      = (direccion)   => axios.get(`${BASE_PROP}/geocodificar`, { params: { direccion } });
export const coordenadasDeLinkMaps   = (link)        => axios.get(`${BASE_PROP}/coordenadas-link`, { params: { link } });
// Fotos y documentos PDF de la propiedad (se guardan en el servidor)
export const getFotosPropiedad       = (id)             => axios.get(`${BASE_PROP}/${id}/fotos`);
export const subirFotosPropiedad     = (id, archivos)   => { const fd = new FormData(); archivos.forEach(a => fd.append("archivos", a)); return axios.post(`${BASE_PROP}/${id}/fotos/archivos`, fd); };
export const fotoPrincipalPropiedad  = (id, idImagen)   => axios.put(`${BASE_PROP}/${id}/fotos/${idImagen}/principal`, {});
export const eliminarFotoPropiedad   = (id, idImagen)   => axios.delete(`${BASE_PROP}/${id}/fotos/${idImagen}`);
export const getDocsPropiedad        = (id)             => axios.get(`${BASE_PROP}/${id}/documentos`);
export const subirDocPropiedad       = (id, archivo, tipo, descripcion) => { const fd = new FormData(); fd.append("archivo", archivo); fd.append("tipo", tipo || "Otro"); if (descripcion) fd.append("descripcion", descripcion); return axios.post(`${BASE_PROP}/${id}/documentos`, fd); };
export const eliminarDocPropiedad    = (id, idDoc)      => axios.delete(`${BASE_PROP}/${id}/documentos/${idDoc}`);
export const abrirDocPropiedad       = async (id, idDoc) => {
  const res = await axios.get(`${BASE_PROP}/${id}/documentos/${idDoc}/archivo`, { responseType: "blob" });
  window.open(URL.createObjectURL(res.data), "_blank", "noopener");
};
// Complejos: cada unidad es una propiedad propia ligada al complejo
export const getUnidadesComplejo     = (id)          => axios.get(`${BASE_PROP}/${id}/unidades`);
export const generarUnidades         = (id, datos)   => axios.post(`${BASE_PROP}/${id}/unidades/generar`, datos);
export const cambiarEstadoPropiedad  = (id, estado)  => axios.patch(`${BASE_PROP}/${id}/estado`, { estado });

// ── PERSONAS ────────────────────────────────────────────────────────────
export const getPersonas             = ()            => axios.get(BASE_PERS);
export const getPersonaById          = (id)          => axios.get(`${BASE_PERS}/${id}`);
export const createPersona           = (data)        => axios.post(BASE_PERS, data);
export const updatePersona           = (id, d)       => axios.put(`${BASE_PERS}/${id}`, d);
export const deletePersona           = (id)          => axios.delete(`${BASE_PERS}/${id}`);
export const agregarNotaPersona      = (id, texto)   => axios.post(`${BASE_PERS}/${id}/notas`, { texto });

// ── LEADS WEB / CONSULTAS ──────────────────────────────────────────────────
const BASE_LEADS = `${API_BASE}/leads`;
const BASE_CONS  = `${API_BASE}/consultas`;
export const getLeads           = ()         => axios.get(BASE_LEADS);
export const convertirLead      = (id, data) => axios.post(`${BASE_LEADS}/${id}/convertir`, data);
export const getConsultas       = ()         => axios.get(BASE_CONS);
export const actualizarConsulta = (id, data) => axios.patch(`${BASE_CONS}/${id}`, data);

// ── CONTRATOS ────────────────────────────────────────────────────────────
export const getContratos            = ()            => axios.get(BASE_CONT);
export const getContratoById         = (id)          => axios.get(`${BASE_CONT}/${id}`);
export const crearContrato           = (data)        => axios.post(BASE_CONT, data);
export const rescindirContrato       = (id)          => axios.patch(`${BASE_CONT}/${id}/rescindir`, {});
export const cerrarVenta             = (id)          => axios.patch(`${BASE_CONT}/${id}/cerrar-venta`, {});
export const cerrarPermuta           = (id)          => axios.patch(`${BASE_CONT}/${id}/cerrar-permuta`, {});
export const getOcupacionPropiedad    = (id, excluir) => axios.get(`${BASE_CONT}/ocupacion/${id}`, { params: excluir ? { excluir } : {} });
export const actualizarContrato      = (id, data)    => axios.put(`${BASE_CONT}/${id}`, data);
export const activarContrato         = (id)          => axios.patch(`${BASE_CONT}/${id}/activar`, {});
export const finalizarContrato       = (id)          => axios.patch(`${BASE_CONT}/${id}/finalizar`, {});
// Documentos PDF de la operación (se guardan en el servidor)
export const getDocsContrato         = (id)          => axios.get(`${BASE_CONT}/${id}/documentos`);
export const subirDocContrato        = (id, archivo, tipo, descripcion) => { const fd = new FormData(); fd.append("archivo", archivo); fd.append("tipo", tipo || "Otro"); if (descripcion) fd.append("descripcion", descripcion); return axios.post(`${BASE_CONT}/${id}/documentos`, fd); };
export const eliminarDocContrato     = (id, idDoc)   => axios.delete(`${BASE_CONT}/${id}/documentos/${idDoc}`);
export const abrirDocContrato        = async (id, idDoc) => {
  const res = await axios.get(`${BASE_CONT}/${id}/documentos/${idDoc}/archivo`, { responseType: "blob" });
  window.open(URL.createObjectURL(res.data), "_blank", "noopener");
};
export const getLiquidaciones        = (id)          => axios.get(`${BASE_CONT}/${id}/liquidaciones`);
export const registrarLiquidacion   = (id, d)       => axios.post(`${BASE_CONT}/${id}/liquidaciones`, d);

// ── MOVIMIENTOS FINANCIEROS ───────────────────────────────────────────────
export const getMovimientos          = ()            => axios.get(BASE_FIN);
export const getMovimientosPorProp   = (id)          => axios.get(`${BASE_FIN}/propiedad/${id}`);
export const getMovimientosPorPers   = (id)          => axios.get(`${BASE_FIN}/persona/${id}`);
export const getMovimientosPorTipo   = (tipo)        => axios.get(`${BASE_FIN}/tipo/${tipo}`);
export const getMovimientosPorEst    = (estado)      => axios.get(`${BASE_FIN}/estado/${estado}`);
export const getMovimientosRango     = (inicio, fin) => axios.get(`${BASE_FIN}/rango`, { params: { inicio, fin } });
export const crearMovimiento         = (data)        => axios.post(`${BASE_FIN}/crear`, data);
export const eliminarMovimiento      = (id)          => axios.delete(`${BASE_FIN}/${id}`);

export const editarMovimiento        = (id, data)    => axios.put(`${BASE_FIN}/${id}`, data);
export const anularMovimiento        = (id, motivo)  => axios.patch(`${BASE_FIN}/${id}/anular`, { motivo });

// ── COBRANZA DE ALQUILERES Y RENDICIONES (Finanzas y Cobros) ──────────────────
const BASE_COB = `${BASE_FIN}/cobranza`;
export const getCobros               = ()            => axios.get(`${BASE_COB}/liquidaciones`);
export const registrarCobro          = (idContrato, d) => axios.post(`${BASE_COB}/contratos/${idContrato}/cobro`, d);
export const anularCobro             = (id, motivo)  => axios.patch(`${BASE_COB}/liquidaciones/${id}/anular`, { motivo });
export const previewRendicion        = (params)      => axios.get(`${BASE_COB}/rendiciones/preview`, { params });
export const generarRendicion        = (d)           => axios.post(`${BASE_COB}/rendiciones`, d);
export const marcarRendicionTransferida = (id)       => axios.patch(`${BASE_COB}/rendiciones/${id}/transferida`, {});
export const anularRendicion         = (id, motivo)  => axios.patch(`${BASE_COB}/rendiciones/${id}/anular`, { motivo });

export const getCargos               = (estado)      => axios.get(`${BASE_FIN}/cargos`, { params: estado ? { estado } : {} });
export const crearCargosLote         = (data)        => axios.post(`${BASE_FIN}/cargos/lote`, data);
export const anularCargo             = (id)          => axios.patch(`${BASE_FIN}/cargos/${id}/anular`, {});

// ── RENDICIONES ────────────────────────────────────────────────────────────
export const getRendiciones          = ()                         => axios.get(BASE_REND);
export const getRendicionesPorPers   = (id)                       => axios.get(`${BASE_REND}/propietario/${id}`);
export const getEstructuraPropietario = (id)                     => axios.get(`${BASE_REND}/propietario/${id}/estructura`);
export const crearRendicion          = (idPropietario, data)     => axios.post(`${BASE_REND}/crear/${idPropietario}`, data);
export const crearRendicionDesdeObj  = (data)                   => axios.post(BASE_REND, data);
export const eliminarRendicion       = (id)                     => axios.delete(`${BASE_REND}/${id}`);

// ── INQUILINOS / CONTRATOS ──────────────────────────────────────────────────
export const getInquilinosContratos       = ()                         => axios.get(BASE_INQ);
export const getInquilinosPorRendicion    = (id)                       => axios.get(`${BASE_INQ}/rendicion/${id}`);
export const getInquilinosPorPropiedad    = (id)                       => axios.get(`${BASE_INQ}/propiedad/${id}`);
export const buscarInquilinoContrato     = (idProp, nombre)          => axios.get(`${BASE_INQ}/propiedad/${idProp}/${encodeURIComponent(nombre)}`);
export const getInquilinosPorContrato    = (id)                       => axios.get(`${BASE_INQ}/contrato/${id}`);
export const crearInquilinoContrato      = (data)                     => axios.post(`${BASE_INQ}/crear`, data);
export const eliminarInquilinoContrato    = (id)                     => axios.delete(`${BASE_INQ}/${id}`);

// ── DOCUMENTOS ─────────────────────────────────────────────────────────────

// ── FACTURAS DE SERVICIOS ───────────────────────────────────────────────────
const BASE_FACT = `${API_BASE}/finanzas/facturas-servicios`;
export const getFacturas                   = ()              => axios.get(BASE_FACT);
export const getFacturasPorEstado          = (estado)        => axios.get(`${BASE_FACT}/estado/${estado}`);
export const getFacturasPorServicio        = (servicio)      => axios.get(`${BASE_FACT}/servicio/${servicio}`);
export const buscarFacturas               = (q)             => axios.get(`${BASE_FACT}/buscar`, { params: { q } });
export const getTotalFacturasPropiedad    = (idProp)        => axios.get(`${BASE_FACT}/total/${idProp}`);
export const validarFacturasPendientes    = (idProp)        => axios.get(`${BASE_FACT}/validar-pendientes/${idProp}`);
export const marcarFacturaPagada          = (idFact, formaPago, pagadoPor) => axios.post(`${BASE_FACT}/marcar-pagado/${idFact}`, { formaPago, pagadoPor });
export const crearFacturaDesdeComprobante = (data)          => axios.post(`${BASE_FACT}/crear-desde-comprobante`, data);
export const getFacturasVencidasHoy       = ()              => axios.get(`${BASE_FACT}/reportes/vencidas`);
export const getFacturasAgrupadasPorTipo  = ()              => axios.get(`${BASE_FACT}/reportes/grupo-por-tipo`);
export const actualizarFactura            = (id, d)         => axios.put(`${BASE_FACT}/${id}`, d);
export const eliminarFactura              = (id)            => axios.delete(`${BASE_FACT}/${id}`);

// ── FAVORITOS (para clientes) ──────────────────────────────────────────────
export const getFavoritos        = (idCliente) => axios.get(`${BASE_PROP.replace('/api/propiedades', '/api/favoritos')}/${idCliente}`);
export const agregarFavorito     = (data)      => axios.post(`${BASE_PROP.replace('/api/propiedades', '/api/favoritos')}/agregar`, data);
export const quitarFavorito      = (idFavorito) => axios.delete(`${BASE_PROP.replace('/api/propiedades', '/api/favoritos')}/${idFavorito}`);
