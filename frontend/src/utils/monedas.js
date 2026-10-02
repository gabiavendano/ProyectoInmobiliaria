// Monedas del sistema. Para agregar otra: sumarla acá y en el enum Moneda del backend (y en service/Monedas.java).
export const MONEDAS = [
  { codigo: "ARS", simbolo: "$",    nombre: "Pesos",   plural: "pesos",   pdf: "Pesos (ARS)" },
  { codigo: "USD", simbolo: "U$S",  nombre: "Dólares", plural: "dólares", pdf: "Dólares (USD)" },
  { codigo: "EUR", simbolo: "€",    nombre: "Euros",   plural: "euros",   pdf: "Euros (EUR)" },
];

const POR_CODIGO = Object.fromEntries(MONEDAS.map((m) => [m.codigo, m]));

/** "ARS" | "USD" | "EUR" (cualquier otro valor o vacío se toma como pesos). */
export const normalizarMoneda = (c) => (POR_CODIGO[c] ? c : "ARS");

/** Símbolo para mostrar importes: "$", "U$S" o "€". */
export const simboloMoneda = (c) => POR_CODIGO[normalizarMoneda(c)].simbolo;

/** "Pesos", "Dólares" o "Euros". */
export const nombreMoneda = (c) => POR_CODIGO[normalizarMoneda(c)].nombre;

/** "pesos", "dólares" o "euros" (para frases). */
export const nombreMonedaPlural = (c) => POR_CODIGO[normalizarMoneda(c)].plural;

/** Texto de moneda para PDFs: "Pesos (ARS)". */
export const textoMonedaPdf = (c) => POR_CODIGO[normalizarMoneda(c)].pdf;

/** Moneda de un contrato (igual que el servidor: primero la del canon, si no la de la operación). */
export const monedaDeContrato = (c) => normalizarMoneda(c?.alqCanonMoneda || c?.monedaOperacion);
