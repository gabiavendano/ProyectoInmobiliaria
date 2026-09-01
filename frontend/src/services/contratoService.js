import axios from "axios";
const BASE = "http://localhost:8080/api/contratos";

export const getContratos         = ()        => axios.get(BASE);
export const getContratoById      = (id)      => axios.get(`${BASE}/${id}`);
export const createContrato       = (data)    => axios.post(BASE, data);
export const rescindirContrato    = (id)      => axios.patch(`${BASE}/${id}/rescindir`);
export const cerrarVenta          = (id)      => axios.patch(`${BASE}/${id}/cerrar-venta`);
export const getLiquidaciones     = (id)      => axios.get(`${BASE}/${id}/liquidaciones`);
export const registrarLiquidacion = (id, d)   => axios.post(`${BASE}/${id}/liquidaciones`, d);