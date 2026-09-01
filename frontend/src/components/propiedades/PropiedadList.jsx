import { useEffect, useState } from "react";
import { getPropiedades, deletePropiedad } from "../../services/propiedadService";
import PropiedadForm from "./PropiedadForm";

const BADGE_ESTADO = {
  Disponible: "badge-green",   
  Reservada:  "badge-warning",
  Alquilada:  "badge-blue", 
  Vendida:    "badge-blue",
  Permutada:  "badge-blue",   
  Inactiva:   "badge-red",
};

function PropiedadList() {
  const [propiedades, setPropiedades] = useState([]);
  const [editando, setEditando]       = useState(null);
  const [cargando, setCargando]       = useState(true);

  const cargar = () => {
    setCargando(true);
    getPropiedades()
      .then(r => setPropiedades(r.data))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const handleEliminar = (id, titulo) => {
    if (!window.confirm(`¿Eliminar la propiedad "${titulo}" de forma permanente?`)) return;
    deletePropiedad(id).then(cargar);
  };

  return (
    <div>
      <PropiedadForm
        propiedadEditar={editando}
        onGuardado={() => { setEditando(null); cargar(); }}
        onCancelar={() => setEditando(null)}
      />
      <div className="card">
        <div className="card-header">
          <span className="card-title"><i className="fa-solid fa-building"></i> Inventario de Propiedades</span>
          <span className="badge badge-blue">{propiedades.length} inmuebles</span>
        </div>
        <div className="table-responsive">
          {cargando ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>Cargando inventario...</p>
          ) : propiedades.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>No hay propiedades cargadas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Propietario</th>
                  <th>Tipo / Operación</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {propiedades.map(p => (
                  <tr key={p.idPropiedad}>
                    <td>{p.idPropiedad}</td>
                    <td style={{fontWeight: '600'}}>{p.titulo}</td>
                    <td>{p.propietarioActual?.nombreCompleto || "—"}</td>
                    <td>
                      <div>{p.tipoInmueble}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)'}}>{p.tipoOperacion}</div>
                    </td>
                    <td style={{fontWeight: '700'}}>
                      {p.moneda === "USD" ? "U$S" : "$"} {Number(p.precio).toLocaleString("es-AR")}
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
                        <button className="btn btn-rojo btn-sm" onClick={() => handleEliminar(p.idPropiedad, p.titulo)} title="Eliminar">
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