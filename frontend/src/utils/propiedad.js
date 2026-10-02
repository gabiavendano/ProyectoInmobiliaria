// Nombres que se muestran en pantalla para los valores que guarda el sistema.
// (Adentro el sistema guarda "AlquilerPermanente", "Terreno", "Cabana"...; la gente ve "Alquiler Anual", "Terreno", "Cabaña"...)
export const OPERACIONES = [
  ["Venta", "Venta"],
  ["AlquilerPermanente", "Alquiler Anual"],
  ["AlquilerTemporario", "Alquiler Temporario"],
  ["Permuta", "Permuta"],
];

export const TIPOS_INMUEBLE = [
  ["Casa", "Casa"],
  ["Departamento", "Departamento"],
  ["Terreno", "Terreno"],
  ["Local", "Local"],
  ["Oficina", "Oficina"],
  ["Cabana", "Cabaña"],
  ["Galpan", "Galpón"],
];

const MAPA_OP = Object.fromEntries(OPERACIONES);
const MAPA_TIPO = Object.fromEntries(TIPOS_INMUEBLE);

export const etiquetaOperacion = (v) => MAPA_OP[v] || v || "";
// Operaciones en las que se ofrece una propiedad: la principal + las adicionales
export const operacionesDe = (p) => {
  const out = [];
  if (p?.tipoOperacion) out.push(p.tipoOperacion);
  (p?.operacionesAdicionales || []).forEach(o => { if (o && !out.includes(o)) out.push(o); });
  return out;
};
export const ofreceOperacion = (p, op) => operacionesDe(p).includes(op);
// Pestaña del contrato -> operación de la propiedad que la habilita
export const OPERACION_DE_TAB = { "Venta": "Venta", "Alquiler Anual": "AlquilerPermanente", "Temporario": "AlquilerTemporario", "Permuta": "Permuta" };

export const etiquetaTipo = (v) => MAPA_TIPO[v] || v || "";

// Ícono del mapa según el tipo (ya con el nombre que se muestra)
export const ICONO_TIPO = {
  Casa: "fa-house", Departamento: "fa-building", Terreno: "fa-leaf", Local: "fa-store",
  Oficina: "fa-briefcase", "Cabaña": "fa-house-chimney", "Galpón": "fa-warehouse",
};

// Un complejo con unidades cargadas es solo el "contenedor": lo que se alquila o vende son sus unidades.
export const esContenedor = (p) => !!p && p.esComplejo === true && Number(p.cantUnidades) > 0;
