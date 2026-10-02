import { useCallback, useEffect, useState } from "react";
import { getUnidadesComplejo, generarUnidades } from "../../services/api";
import { TIPOS_INMUEBLE, etiquetaTipo } from "../../utils/propiedad";
import { simboloMoneda } from "../../utils/monedas";

const BADGE = { Disponible: "badge-green", Reservada: "badge-warning", Alquilada: "badge-blue", Vendida: "badge-blue", Permutada: "badge-blue", Inactiva: "badge-red" };
const errorDe = (err) => err.response?.data?.error || err.message;

/**
 * Panel de unidades de un complejo. Cada unidad es una propiedad propia (con su precio, estado, fotos y contrato),
 * ligada al complejo: hereda dirección, punto del mapa, propietario y operación.
 */
export default function UnidadesComplejo({ idComplejo, moneda, onEditarUnidad, onCambio }) {
  const [unidades, setUnidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [generando, setGenerando] = useState(false);
  const [gen, setGen] = useState({ cantidad: "", prefijo: "Unidad", tipoInmueble: "", precio: "" });

  const cargar = useCallback(() => {
    return getUnidadesComplejo(idComplejo)
      .then(r => setUnidades(Array.isArray(r.data) ? r.data : []))
      .catch(err => setAviso(`No se pudieron cargar las unidades: ${errorDe(err)}`))
      .finally(() => setCargando(false));
  }, [idComplejo]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    setAviso("");
    const cantidad = parseInt(gen.cantidad, 10);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) { setAviso("Indicá cuántas unidades crear (entre 1 y 100)."); return; }
    setGenerando(true);
    try {
      const r = await generarUnidades(idComplejo, {
        cantidad,
        prefijo: gen.prefijo.trim() || "Unidad",
        tipoInmueble: gen.tipoInmueble || null,
        precio: gen.precio === "" ? null : gen.precio,
      });
      setUnidades(Array.isArray(r.data) ? r.data : []);
      setGen(g => ({ ...g, cantidad: "" }));
      setAviso(`Listo: se crearon ${cantidad} unidad(es). Tocá "Editar" en cada una para ponerle su precio, fotos y detalles.`);
      if (onCambio) onCambio();
    } catch (err) {
      setAviso(`No se pudieron crear: ${errorDe(err)}`);
    } finally {
      setGenerando(false);
    }
  };

  const libres = unidades.filter(u => u.estadoPropiedad === "Disponible").length;

  return (
    <div className="animation-fade-in" style={{ marginBottom: '30px', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px dashed var(--color-rojo)' }}>
      <h4 style={{ marginBottom: '6px' }}><i className="fa-solid fa-list-ol"></i> Unidades del complejo {unidades.length > 0 && <span className="badge badge-blue" style={{ marginLeft: 8 }}>{libres} disponibles de {unidades.length}</span>}</h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-gris-texto)', marginBottom: '14px' }}>
        Cada unidad es una propiedad propia: tiene su precio, estado, fotos y contrato. Hereda la dirección, el punto del mapa y el propietario del complejo,
        y en el sitio público aparece dentro del complejo mientras esté Disponible.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#F8FAFC', padding: '12px', borderRadius: '8px', marginBottom: '14px' }}>
        <div className="form-group" style={{ margin: 0, width: 110 }}><label>Cantidad</label><input type="number" min="1" max="100" value={gen.cantidad} onChange={e => setGen({ ...gen, cantidad: e.target.value })} placeholder="Ej: 10" /></div>
        <div className="form-group" style={{ margin: 0, width: 170 }}><label>Nombre (Ej: Depto, Cabaña)</label><input type="text" maxLength={35} value={gen.prefijo} onChange={e => setGen({ ...gen, prefijo: e.target.value })} /></div>
        <div className="form-group" style={{ margin: 0, width: 170 }}><label>Tipo</label>
          <select value={gen.tipoInmueble} onChange={e => setGen({ ...gen, tipoInmueble: e.target.value })}>
            <option value="">Igual al complejo</option>
            {TIPOS_INMUEBLE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, width: 160 }}><label>Precio ({moneda || "ARS"})</label><input type="number" min="0" step="any" value={gen.precio} onChange={e => setGen({ ...gen, precio: e.target.value })} placeholder="Igual al complejo" /></div>
        <button type="button" className="btn btn-rojo" onClick={crear} disabled={generando}><i className="fa-solid fa-plus"></i> {generando ? "Creando..." : "Crear unidades"}</button>
      </div>

      {aviso && <p role="status" style={{ fontSize: '0.85rem', background: '#FFF8E1', color: '#8a5a00', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>{aviso}</p>}

      {cargando ? null : unidades.length === 0 ? (
        <p style={{ color: 'var(--color-gris-texto)' }}>Todavía no tiene unidades. Creá las primeras con el formulario de arriba.</p>
      ) : (
        <div className="table-responsive">
          <table style={{ width: '100%' }}>
            <thead style={{ backgroundColor: '#F8FAFC' }}><tr><th>Unidad</th><th>Tipo</th><th>Amb.</th><th>m²</th><th>Precio</th><th>Fotos</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {unidades.map(u => (
                <tr key={u.idPropiedad}>
                  <td style={{ fontWeight: 'bold' }}>{u.identificador || u.titulo}</td>
                  <td>{etiquetaTipo(u.tipoInmueble)}</td>
                  <td>{u.cantAmbientes || "—"}</td>
                  <td>{u.superficieTotalM2 || "—"}</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--color-rojo)' }}>{simboloMoneda(u.moneda)} {Number(u.precio || 0).toLocaleString("es-AR")}</td>
                  <td>{u.cantFotos || 0}</td>
                  <td><span className={`badge ${BADGE[u.estadoPropiedad] || "badge-blue"}`}>{u.estadoPropiedad}</span></td>
                  <td><button type="button" className="btn btn-outline btn-sm" onClick={() => onEditarUnidad(u.idPropiedad)}><i className="fa-solid fa-pen"></i> Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
