import { MONEDAS } from "../../utils/monedas";

/** <option> de todas las monedas, para usar dentro de un <select>. */
export default function OpcionesMoneda() {
  return MONEDAS.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo}</option>);
}
