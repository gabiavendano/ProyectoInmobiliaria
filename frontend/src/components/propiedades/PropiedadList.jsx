import { useEffect, useMemo, useRef, useState } from "react";
import { getPropiedades, getPropiedadById, deletePropiedad, cambiarEstadoPropiedad } from "../../services/api";
import PropiedadForm from "./PropiedadForm";
import { urlFoto } from "../../utils/fotos";
import { OPERACIONES as OPS, etiquetaOperacion, etiquetaTipo, ofreceOperacion } from "../../utils/propiedad";
import { simboloMoneda } from "../../utils/monedas";
import { avisar } from "../../utils/avisos";

const BADGE_ESTADO = {
  Disponible: "badge-green",
  Reservada:  "badge-warning",
  EnObra:     "badge-warning",
  Suspendida: "badge-warning",
  Alquilada:  "badge-blue",
  Vendida:    "badge-blue",
  Permutada:  "badge-blue",
  Inactiva:   "badge-red",
};

const ESTADOS = ["Todos", "Disponible", "Reservada", "Alquilada", "Vendida", "Permutada", "EnObra", "Suspendida", "Inactiva"];
const OPERACIONES = [["Todas", "Todas las operaciones"], ...OPS];
const ORDENES = [["reciente", "Más recientes primero"], ["antiguo", "Más antiguas primero"], ["precio-desc", "Precio: mayor a menor"], ["precio-asc", "Precio: menor a mayor"], ["titulo", "Título A-Z"]];

// Saca tildes y mayúsculas para que "cordoba" encuentre "Córdoba"
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function PropiedadList() {
  const [propiedades, setPropiedades] = useState([]);
  const [editando, setEditando]       = useState(null);
  const [cargando, setCargando]       = useState(true);
  const [busqueda, setBusqueda]       = useState("");
  const [estado, setEstado]           = useState("Todos");
  const [operacion, setOperacion]     = useState("Todas");
  const [orden, setOrden]             = useState("reciente");
  const formRef = useRef(null);

  const cargar = () => {
    return getPropiedades()
      .then(r => setPropiedades(r.data))
      .catch(err => avisar(`No se pudo cargar el inventario: ${err.response?.data?.error || err.message}`))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  // Al tocar "editar" el formulario queda arriba: subimos hasta él para que se note
  useEffect(() => {
    if (editando && formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editando]);

  const handleEliminar = (id, titulo) => {
    if (!window.confirm(`¿Eliminar la propiedad "${titulo}" de forma PERMANENTE?\n\nSi solo querés sacarla del mapa público, usá "Dar de baja" (queda guardada como Inactiva y se puede reactivar).`)) return;
    deletePropiedad(id)
      .then(() => { if (editando?.idPropiedad === id) setEditando(null); cargar(); })
      .catch(err => avisar(`No se pudo eliminar: ${err.response?.data?.error || "la propiedad tiene contratos o movimientos asociados. Usá \"Dar de baja\" para sacarla del mapa."}`));
  };

  const handleBaja = (id, titulo) => {
    if (!window.confirm(`¿Dar de baja "${titulo}"?\n\nQueda como Inactiva: deja de verse en el mapa público pero se conserva todo su historial.`)) return;
    cambiarEstadoPropiedad(id, "Inactiva")
      .then(cargar)
      .catch(err => avisar(`No se pudo dar de baja: ${err.response?.data?.error || err.message}`));
  };

  const handleReactivar = (id) => {
    cambiarEstadoPropiedad(id, "Disponible")
      .then(cargar)
      .catch(err => avisar(`No se pudo reactivar: ${err.response?.data?.error || err.message}`));
  };

  // Abre otra ficha (una unidad o su complejo) pidiéndola al servidor para que los datos estén al día
  const editarPorId = async (id) => {
    const enLista = propiedades.find(x => x.idPropiedad === id);
    try { const r = await getPropiedadById(id); setEditando(r.data); }
    catch { if (enLista) setEditando(enLista); else avisar("No se pudo abrir esa ficha."); }
  };

  const visibles = useMemo(() => {
    const q = norm(busqueda.trim());
    const lista = propiedades.filter(p => {
      if (estado !== "Todos" && p.estadoPropiedad !== estado) return false;
      if (operacion !== "Todas" && !ofreceOperacion(p, operacion)) return false;
      if (!q) return true;
      return [p.titulo, p.zona, p.barrio, p.calle, p.localidad, p.tipoInmueble, p.propietarioActual?.nombreCompleto, String(p.idPropiedad)]
        .some(v => norm(v).includes(q));
    });
    const porFecha = (a, b) => String(b.dateAdded || "").localeCompare(String(a.dateAdded || "")) || (b.idPropiedad - a.idPropiedad);
    const cmp = {
      reciente: porFecha,
      antiguo: (a, b) => porFecha(b, a),
      "precio-desc": (a, b) => Number(b.precio || 0) - Number(a.precio || 0),
      "precio-asc": (a, b) => Number(a.precio || 0) - Number(b.precio || 0),
      titulo: (a, b) => String(a.titulo || "").localeCompare(String(b.titulo || ""), "es"),
    }[orden];
    const ordenada = [...lista].sort(cmp);
    // Las unidades se muestran justo debajo de su complejo (si el complejo no está entre los resultados, quedan sueltas)
    const ids = new Set(ordenada.map(x => x.idPropiedad));
    const hijos = {};
    ordenada.forEach(x => { if (x.idComplejo != null && ids.has(x.idComplejo)) (hijos[x.idComplejo] ||= []).push(x); });
    const resultado = [];
    ordenada.forEach(x => {
      if (x.idComplejo != null && ids.has(x.idComplejo)) return;
      resultado.push(x);
      (hijos[x.idPropiedad] || []).sort((a, b) => a.idPropiedad - b.idPropiedad).forEach(h => resultado.push(h));
    });
    return resultado;
  }, [propiedades, busqueda, estado, operacion, orden]);

  return (
    <div>
      <div ref={formRef} style={{ scrollMarginTop: '80px' }}>
        <PropiedadForm
          key={editando?.idPropiedad ?? "nueva"}
          propiedadEditar={editando}
          onGuardado={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
          onEditarOtra={editarPorId}
          onCambioUnidades={cargar}
          complejoPadre={editando?.idComplejo ? propiedades.find(x => x.idPropiedad === editando.idComplejo) : null}
        />
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title"><i className="fa-solid fa-building"></i> Inventario de Propiedades</span>
          <span className="badge badge-blue">
            {visibles.length === propiedades.length ? `${propiedades.length} inmuebles` : `${visibles.length} de ${propiedades.length}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--color-gris-borde)' }}>
          <div className="input-with-icon" style={{ flex: '1 1 260px' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por título, barrio, calle, propietario o ID..." />
          </div>
          <select className="select-filtro" value={estado} onChange={(e) => setEstado(e.target.value)} style={{ maxWidth: '170px' }}>
            {ESTADOS.map(e => <option key={e} value={e}>{e === "Todos" ? "Todos los estados" : e}</option>)}
          </select>
          <select className="select-filtro" value={operacion} onChange={(e) => setOperacion(e.target.value)} style={{ maxWidth: '200px' }}>
            {OPERACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <select className="select-filtro" value={orden} onChange={(e) => setOrden(e.target.value)} style={{ maxWidth: '210px' }}>
            {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        <div className="table-responsive">
          {cargando ? (
            null
          ) : propiedades.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>No hay propiedades cargadas.</p>
          ) : visibles.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>Ninguna propiedad coincide con la búsqueda o los filtros.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Propietario</th>
                  <th>Tipo / Operación</th>
                  <th>Zona / Superficie</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(p => (
                  <tr key={p.idPropiedad} style={editando?.idPropiedad === p.idPropiedad ? { backgroundColor: '#FFF8F8' } : undefined}>
                    <td>{p.idPropiedad}</td>
                    <td style={{fontWeight: '600', paddingLeft: p.idComplejo != null ? '28px' : undefined}}>
                      {p.idComplejo != null && <i className="fa-solid fa-turn-up fa-rotate-90" style={{color: 'var(--color-gris-texto)', marginRight: '6px', fontSize: '0.75rem'}}></i>}
                      {(p.imagenes || []).length > 0 && (
                        <img src={urlFoto((p.imagenes.find(i => i.esFotoPrincipal) || p.imagenes[0]).urlImagen)} alt="" style={{ width: '52px', height: '40px', objectFit: 'cover', borderRadius: '6px', marginRight: '8px', verticalAlign: 'middle' }} />
                      )}
                      {p.titulo}
                      {p.esComplejo && (
                        <div><span className="badge badge-blue" style={{fontSize: '0.7rem'}}>Complejo · {propiedades.filter(x => x.idComplejo === p.idPropiedad).length} unidades ({propiedades.filter(x => x.idComplejo === p.idPropiedad && x.estadoPropiedad === "Disponible").length} disp.)</span></div>
                      )}
                      {(p.latitud == null || p.longitud == null) && (
                        <div><span className="badge badge-warning" style={{fontSize: '0.7rem'}} title="No aparece como punto en el mapa público porque no tiene coordenadas. Abrí la ficha para ubicarla.">Sin ubicación en mapa</span></div>
                      )}
                      {(p.imagenes || []).length === 0 && (
                        <div><span className="badge badge-warning" style={{fontSize: '0.7rem'}} title="Todavía no tiene fotos cargadas.">Sin fotos</span></div>
                      )}
                    </td>
                    <td>{p.propietarioActual?.nombreCompleto || "—"}</td>
                    <td>
                      <div>{etiquetaTipo(p.tipoInmueble)}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)'}}>{etiquetaOperacion(p.tipoOperacion)}</div>
                    </td>
                    <td>
                      <div>{p.zona || "—"}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)'}}>{p.superficieTotalM2 ? `${p.superficieTotalM2} m²` : "Sin superficie"}</div>
                    </td>
                    <td style={{fontWeight: '700'}}>
                      {simboloMoneda(p.moneda)} {Number(p.precio).toLocaleString("es-AR")}
                    </td>
                    <td>
                      <span className={`badge ${BADGE_ESTADO[p.estadoPropiedad] || "badge-blue"}`}>
                        {p.estadoPropiedad}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => setEditando(p)} title="Editar">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        {p.estadoPropiedad === "Inactiva" ? (
                          <button className="btn btn-outline btn-sm" onClick={() => handleReactivar(p.idPropiedad)} title="Reactivar (vuelve a Disponible)">
                            <i className="fa-solid fa-rotate-left"></i>
                          </button>
                        ) : (
                          <button className="btn btn-outline btn-sm" onClick={() => handleBaja(p.idPropiedad, p.titulo)} title="Dar de baja (queda Inactiva, no se pierde nada)">
                            <i className="fa-solid fa-eye-slash"></i>
                          </button>
                        )}
                        <button className="btn btn-rojo btn-sm" onClick={() => handleEliminar(p.idPropiedad, p.titulo)} title="Eliminar definitivamente">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropiedadList;
