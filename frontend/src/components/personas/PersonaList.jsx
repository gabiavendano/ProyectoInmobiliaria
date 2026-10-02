import { useEffect, useMemo, useRef, useState } from "react";
import { getPersonas, deletePersona } from "../../services/api";
import { esUsuarioWeb } from "../../utils/personas";
import PersonaForm from "./PersonaForm";
import { avisar } from "../../utils/avisos";

const BADGE_ROL = {
  Propietario: "badge-blue",
  Inquilino:   "badge-green",
  Comprador:   "badge-warning",
  Colega:      "badge-red",
};

const ROLES_FILTRO = ["Todos", "Propietario", "Inquilino", "Comprador", "Colega"];

// Saca tildes y mayúsculas para que "perez" encuentre "Pérez"
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function PersonaList() {
  const [personas, setPersonas]   = useState([]);
  const [editando, setEditando]   = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [busqueda, setBusqueda]   = useState("");
  const [rol, setRol]             = useState("Todos");
  const [verWeb, setVerWeb]       = useState(false);
  const formRef = useRef(null);

  const cargar = () => {
    setCargando(true);
    getPersonas()
      .then(res => setPersonas(res.data))
      .catch(err => avisar(`No se pudo cargar el listado: ${err.response?.data?.error || err.message}`))
      .finally(() => setCargando(false));
  };

  // Carga inicial (cargando ya arranca en true). Los estados se cambian solo dentro de las respuestas.
  useEffect(() => {
    let activo = true;
    getPersonas()
      .then(res => { if (activo) setPersonas(res.data); })
      .catch(err => { if (activo) avisar(`No se pudo cargar el listado: ${err.response?.data?.error || err.message}`); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  // Al tocar "editar" el formulario queda arriba: subimos hasta él para que se note el cambio
  useEffect(() => {
    if (editando && formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editando]);

  const handleEliminar = (id, nombre) => {
    if (!window.confirm(`¿Está seguro de que desea dar de baja a ${nombre}?`)) return;
    deletePersona(id)
      .then(() => { if (editando?.idPersona === id) setEditando(null); cargar(); })
      .catch(err => avisar(`No se pudo eliminar: ${err.response?.data?.error || "la persona tiene propiedades, contratos o movimientos asociados"}`));
  };

  const cantWeb = useMemo(() => personas.filter(esUsuarioWeb).length, [personas]);

  const visibles = useMemo(() => {
    const q = norm(busqueda.trim());
    return personas.filter(p => {
      if (!verWeb && esUsuarioWeb(p)) return false;
      if (rol !== "Todos" && p.rolPrincipal !== rol) return false;
      if (!q) return true;
      return [p.nombreCompleto, p.dniCuit, p.cuitCuil, p.telefono, p.email, p.emailPrincipal]
        .some(v => norm(v).includes(q));
    });
  }, [personas, busqueda, rol, verWeb]);

  const totalReales = personas.length - cantWeb;

  return (
    <div>
      <div ref={formRef} style={{ scrollMarginTop: '80px' }}>
        <PersonaForm
          key={editando?.idPersona ?? "nueva"}
          personaEditar={editando}
          onGuardado={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title"><i className="fa-solid fa-list-ul"></i> Listado de Clientes y Propietarios</span>
          <span className="badge badge-blue">
            {visibles.length === totalReales || (verWeb && visibles.length === personas.length)
              ? `${visibles.length} registrados`
              : `${visibles.length} de ${verWeb ? personas.length : totalReales}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--color-gris-borde)' }}>
          <div className="input-with-icon" style={{ flex: '1 1 260px' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, DNI/CUIT, teléfono o email..." />
          </div>
          <select className="select-filtro" value={rol} onChange={(e) => setRol(e.target.value)} style={{ maxWidth: '190px' }}>
            {ROLES_FILTRO.map(r => <option key={r} value={r}>{r === "Todos" ? "Todos los roles" : r}</option>)}
          </select>
          {cantWeb > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={verWeb} onChange={(e) => setVerWeb(e.target.checked)} />
              Mostrar usuarios registrados en la web ({cantWeb})
            </label>
          )}
        </div>

        <div className="table-responsive">
          {cargando ? (
            null
          ) : personas.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>No hay personas cargadas todavía.</p>
          ) : visibles.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>Ninguna persona coincide con la búsqueda o el filtro.</p>
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
                {visibles.map(p => {
                  const web = esUsuarioWeb(p);
                  const relaciones = (p.relaciones || []).filter(r => r !== p.rolPrincipal);
                  return (
                    <tr key={p.idPersona} style={editando?.idPersona === p.idPersona ? { backgroundColor: '#FFF8F8' } : undefined}>
                      <td>{p.idPersona}</td>
                      <td style={{fontWeight: '600'}}>
                        {p.nombreCompleto}
                        {web && <span className="badge badge-blue" style={{ marginLeft: '8px', fontSize: '0.7rem' }}>Usuario web</span>}
                      </td>
                      <td>
                        {web ? <span style={{ color: '#999' }}>—</span> : p.dniCuit}
                        {!web && p.cuitCuil && <div style={{ fontSize: '0.75rem', color: 'var(--color-gris-texto)' }}>CUIT/CUIL {p.cuitCuil}</div>}
                      </td>
                      <td>
                        <span className={`badge ${BADGE_ROL[p.rolPrincipal] || "badge-blue"}`} style={{marginBottom: '5px'}}>
                          {p.rolPrincipal}
                        </span>
                        {relaciones.length > 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-gris-texto)', marginLeft: '6px' }}>+ {relaciones.join(", ")}</span>
                        )}
                        <div style={{fontSize: '0.8rem', color: 'var(--color-gris-texto)'}}>{p.telefono || p.telPrincipal || p.whatsapp || "Sin teléfono"}</div>
                      </td>
                      <td>
                        {p.inhibido
                          ? <span className="badge badge-red">Inhibido (BCRA {p.estadoBcra})</span>
                          : p.estadoBcra == null
                            ? <span className="badge badge-warning">Sin verificar</span>
                            : <span className="badge badge-green">Apto (BCRA: {p.estadoBcra})</span>
                        }
                      </td>
                      <td>
                        <div className="action-btns">
                          {!web && (
                            <button className="btn btn-outline btn-sm" onClick={() => setEditando(p)} title="Editar">
                              <i className="fa-solid fa-pen"></i>
                            </button>
                          )}
                          <button className="btn btn-rojo btn-sm" onClick={() => handleEliminar(p.idPersona, p.nombreCompleto)} title="Eliminar">
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonaList;
