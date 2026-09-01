import axios from "axios";
const BASE = "http://localhost:8080/api/propiedades";

export const getPropiedades    = ()       => axios.get(BASE);
export const getPropiedadById  = (id)     => axios.get(`${BASE}/${id}`);
export const createPropiedad   = (data)   => axios.post(BASE, data);
export const updatePropiedad   = (id, d)  => axios.put(`${BASE}/${id}`, d);
export const deletePropiedad   = (id)     => axios.delete(`${BASE}/${id}`);