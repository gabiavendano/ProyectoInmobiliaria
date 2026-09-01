import { useEffect, useState } from "react";
import { getPersonas, deletePersona } from "../../services/personaService";
import PersonaForm from "./PersonaForm";

const BADGE_ROL = {
  Propietario: "badge-blue",
  Inquilino:   "badge-green",
  Comprador:   "badge-warning",
  Colega:      "badge-red",
};

function PersonaList() {
  const [personas, setPersonas]   = useState([]);
  const [editando, setEditando]   = useState(null);
  const [cargando, setCargando]   = useState(true);

  const cargar = () => {
    setCargando(true);
    getPersonas()
      .then(res => setPersonas(res.data))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const handleEliminar = (id, nombre) => {
    if (!window.confirm(`¿Está seguro de que desea dar de baja a ${nombre}?`)) return;
    deletePersona(id).then(cargar);
  };

  return (
    <div>
      <PersonaForm
        personaEditar={editando}
        onGuardado={() => { setEditando(null); cargar(); }}
        onCancelar={() => setEditando(null)}
      />
      <div className="card">
        <div className="card-header">
          <span className="card-title"><i className="fa-solid fa-list-ul"></i> Listado de Clientes y Propietarios</span>
          <span className="badge badge-blue">{personas.length} registrados</span>
        </div>
        <div className="table-responsive">
          {cargando ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>Cargando datos...</p>
          ) : personas.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>No hay personas cargadas todavía.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>DNI/CUIT</th>
                  <th>Rol / Contacto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personas.map(p => (
                  <tr key={p.idPersona}>
                    <td>{p.idPersona}</td>
                    <td style={{fontWeight: '600'}}>{p.nombreCompleto}</td>
                    <td>{p.dniCuit}</td>
                    <td>
                      <span className={`badge ${BADGE_ROL[p.rolPrincipal] || "badge-blue"}`} style={{marginBottom: '5px'}}>
                        {p.rolPrincipal}
                      </span>
                      <div style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)'}}>{p.telefono || "Sin teléfono"}</div>
                    </td>
                    <td>
                      {p.inhibido 
                        ? <span className="badge badge-red">Inhibido</span>
                        : <span className="badge badge-green">Apto (BCRA: {p.estadoBcra || 1})</span>
                      }
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn-outline btn-sm" onClick={() => setEditando(p)} title="Editar">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn btn-rojo btn-sm" onClick={() => handleEliminar(p.idPersona, p.nombreCompleto)} title="Eliminar">
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

export default PersonaList;