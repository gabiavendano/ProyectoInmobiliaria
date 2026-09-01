import axios from "axios";
const BASE = "http://localhost:8080/api/personas";

export const getPersonas     = ()        => axios.get(BASE);
export const getPersonaById  = (id)      => axios.get(`${BASE}/${id}`);
export const createPersona   = (data)    => axios.post(BASE, data);
export const updatePersona   = (id, d)   => axios.put(`${BASE}/${id}`, d);
export const deletePersona   = (id)      => axios.delete(`${BASE}/${id}`);