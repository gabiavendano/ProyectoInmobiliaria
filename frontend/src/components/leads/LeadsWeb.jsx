import { useEffect, useMemo, useState } from "react";
import { getLeads, getConsultas, actualizarConsulta, convertirLead } from "../../services/api";
import { fmtFecha, numeroWhatsApp } from "../../utils/personas";
import { avisar } from "../../utils/avisos";

const ESTADOS = ["Todas", "Nueva", "Contactada", "Descartada"];
const BADGE_ESTADO = { Nueva: "badge-warning", Contactada: "badge-green", Descartada: "badge-red" };

const fmtHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : `${fmtFecha(String(iso).slice(0, 10))} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
};
const errMsg = (err) => err.response?.data?.error || err.message;

function LeadsWeb({ onVerClientes }) {
  const [tab, setTab] = useState("consultas");
  const [consultas, setConsultas] = useState([]);
  const [leads, setLeads] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("Nueva");
  const [convirtiendo, setConvirtiendo] = useState(null);   // lead que se está por convertir
  const [dni, setDni] = useState("");
  const [tel, setTel] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () =>
    Promise.all([getConsultas(), getLeads()])
      .then(([c, l]) => { setConsultas(c.data); setLeads(l.data); })
      .catch(err => avisar(`No se pudieron cargar los leads: ${errMsg(err)}`))
      .finally(() => setCargando(false));

  useEffect(() => { cargar(); }, []);

  const nuevas = useMemo(() => consultas.filter(c => c.estado === "Nueva").length, [consultas]);
  const visibles = useMemo(
    () => consultas.filter(c => filtro === "Todas" || c.estado === filtro),
    [consultas, filtro]
  );
  const leadDe = (idUsuario) => leads.find(l => l.idUsuario === idUsuario);

  const cambiarEstado = async (c, estado) => {
    try {
      const { data } = await actualizarConsulta(c.idConsulta, { estado });
      setConsultas(prev => prev.map(x => x.idConsulta === c.idConsulta ? data : x));
    } catch (err) { avisar(`No se pudo actualizar: ${errMsg(err)}`); }
  };

  const editarNota = async (c) => {
    const nota = window.prompt("Nota interna sobre esta consulta (la ve solo el equipo):", c.notaAgente || "");
    if (nota === null) return;
    try {
      const { data } = await actualizarConsulta(c.idConsulta, { notaAgente: nota });
      setConsultas(prev => prev.map(x => x.idConsulta === c.idConsulta ? data : x));
    } catch (err) { avisar(`No se pudo guardar la nota: ${errMsg(err)}`); }
  };

  const abrirConversion = (idUsuario) => {
    const lead = leadDe(idUsuario);
    if (!lead) return;
    setConvirtiendo(lead);
    setDni("");
    setTel(lead.telefono || "");
  };

  const confirmarConversion = async (e) => {
    e.preventDefault();
    if (guardando || !convirtiendo) return;
    setGuardando(true);
    try {
      const { data } = await convertirLead(convirtiendo.idUsuario, { dni, telefono: tel });
      avisar(`${data.nombreCompleto} ya es cliente (ficha #${data.idPersona}). Podés completar sus datos en "Gestión de Clientes".`);
      setConvirtiendo(null);
      cargar();
    } catch (err) {
      avisar(`No se pudo convertir: ${errMsg(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const botonConvertir = (idUsuario) => {
    const lead = leadDe(idUsuario);
    if (!lead) return null;
    if (lead.convertido) {
      return <button type="button" className="btn btn-outline btn-sm" onClick={onVerClientes}><i className="fa-solid fa-address-card"></i> Ya es cliente (ficha #{lead.idPersona})</button>;
    }
    return <button type="button" className="btn btn-rojo btn-sm" onClick={() => abrirConversion(idUsuario)}><i className="fa-solid fa-user-plus"></i> Convertir en cliente</button>;
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === "consultas" ? "active" : ""}`} onClick={() => setTab("consultas")}>
          <i className="fa-regular fa-envelope"></i> Consultas {nuevas > 0 && <span className="badge badge-warning">{nuevas} nueva{nuevas === 1 ? "" : "s"}</span>}
        </button>
        <button className={`tab-btn ${tab === "usuarios" ? "active" : ""}`} onClick={() => setTab("usuarios")}>
          <i className="fa-solid fa-users"></i> Usuarios registrados en la web <span className="badge badge-blue">{leads.length}</span>
        </button>
      </div>

      {cargando ? (
        null
      ) : tab === "consultas" ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fa-regular fa-envelope"></i> Consultas recibidas desde la web</span>
            <select className="select-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: "180px" }}>
              {ESTADOS.map(s => <option key={s} value={s}>{s === "Todas" ? "Todas" : `${s}s`}</option>)}
            </select>
          </div>
          {visibles.length === 0 ? (
            <p style={{ textAlign: "center", padding: "20px", color: "var(--color-gris-texto)" }}>
              {consultas.length === 0 ? "Todavía no llegaron consultas. Aparecen acá cuando un cliente registrado toca \"Enviar consulta\" en una propiedad." : "No hay consultas con ese estado."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", padding: "20px" }}>
              {visibles.map(c => {
                const wa = numeroWhatsApp(c.telefono);
                return (
                  <div key={c.idConsulta} style={{ border: "1px solid var(--color-gris-borde)", borderLeft: `4px solid ${c.estado === "Nueva" ? "#E65100" : c.estado === "Contactada" ? "#2E7D32" : "#999"}`, borderRadius: "8px", padding: "15px", backgroundColor: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <strong style={{ fontSize: "1.05rem" }}>{c.nombre || "Sin nombre"}</strong>
                        <span className={`badge ${BADGE_ESTADO[c.estado] || "badge-blue"}`} style={{ marginLeft: "10px" }}>{c.estado}</span>
                        <div style={{ fontSize: "0.85rem", color: "var(--color-gris-texto)" }}>{fmtHora(c.fecha)}</div>
                      </div>
                      <div style={{ fontSize: "0.85rem", textAlign: "right" }}>
                        {c.email && <div><i className="fa-regular fa-envelope"></i> <a href={`mailto:${c.email}`}>{c.email}</a></div>}
                        {c.telefono && <div><i className="fa-solid fa-phone"></i> {c.telefono}</div>}
                      </div>
                    </div>

                    {c.propiedadTitulo && (
                      <div style={{ marginTop: "8px", fontSize: "0.9rem" }}><i className="fa-solid fa-house"></i> Consulta por: <strong>{c.propiedadTitulo}</strong> <span style={{ color: "#888" }}>(ID {c.idPropiedad})</span></div>
                    )}
                    <p style={{ margin: "10px 0", backgroundColor: "#F8FAFC", padding: "10px 12px", borderRadius: "6px", whiteSpace: "pre-wrap" }}>{c.mensaje}</p>
                    {c.horarioPreferido && <div style={{ fontSize: "0.85rem", marginBottom: "8px" }}><i className="fa-regular fa-clock"></i> Mejor horario: {c.horarioPreferido}</div>}
                    {c.notaAgente && <div style={{ fontSize: "0.85rem", marginBottom: "8px", color: "#555" }}><i className="fa-regular fa-note-sticky"></i> Nota interna: {c.notaAgente}</div>}

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      {wa && (
                        <a className="btn btn-outline btn-sm" target="_blank" rel="noreferrer"
                          href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${c.nombre || ""}, te escribimos de Inmobiliaria Del Castillo por tu consulta${c.propiedadTitulo ? ` sobre "${c.propiedadTitulo}"` : ""}.`)}`}>
                          <i className="fa-solid fa-comment-dots"></i> WhatsApp
                        </a>
                      )}
                      {c.estado !== "Contactada" && <button type="button" className="btn btn-outline btn-sm" onClick={() => cambiarEstado(c, "Contactada")}><i className="fa-solid fa-check"></i> Marcar contactada</button>}
                      {c.estado !== "Descartada" && <button type="button" className="btn btn-outline btn-sm" onClick={() => cambiarEstado(c, "Descartada")}><i className="fa-solid fa-ban"></i> Descartar</button>}
                      {c.estado !== "Nueva" && <button type="button" className="btn btn-outline btn-sm" onClick={() => cambiarEstado(c, "Nueva")}><i className="fa-solid fa-rotate-left"></i> Volver a nueva</button>}
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => editarNota(c)}><i className="fa-regular fa-pen-to-square"></i> Nota</button>
                      <span style={{ marginLeft: "auto" }}>{botonConvertir(c.idUsuario)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fa-solid fa-users"></i> Usuarios que se registraron en la página</span>
          </div>
          <div className="table-responsive">
            {leads.length === 0 ? (
              <p style={{ textAlign: "center", padding: "20px", color: "var(--color-gris-texto)" }}>Todavía no se registró ningún cliente en la web.</p>
            ) : (
              <table>
                <thead>
                  <tr><th>Usuario</th><th>Contacto</th><th>Favoritos</th><th>Consultas</th><th>Última actividad</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {leads.map(l => (
                    <tr key={l.idUsuario}>
                      <td style={{ fontWeight: 600 }}>{[l.nombre, l.apellido].filter(Boolean).join(" ") || "Sin nombre"}</td>
                      <td>
                        <div style={{ fontSize: "0.85rem" }}>{l.email}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--color-gris-texto)" }}>{l.telefono || "Sin teléfono"}</div>
                      </td>
                      <td>
                        {l.favoritos.length === 0 ? <span style={{ color: "#999" }}>—</span> : (
                          <div title={l.favoritos.map(f => f.titulo).join("\n")}>
                            <span className="badge badge-blue">{l.favoritos.length} guardada{l.favoritos.length === 1 ? "" : "s"}</span>
                            <div style={{ fontSize: "0.75rem", color: "var(--color-gris-texto)", marginTop: "3px", maxWidth: "240px" }}>
                              {l.favoritos.slice(0, 2).map(f => f.titulo).join(" · ")}{l.favoritos.length > 2 ? ` y ${l.favoritos.length - 2} más` : ""}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {l.totalConsultas === 0 ? <span style={{ color: "#999" }}>—</span> : (
                          <span className={`badge ${l.consultasNuevas > 0 ? "badge-warning" : "badge-green"}`}>
                            {l.totalConsultas}{l.consultasNuevas > 0 ? ` (${l.consultasNuevas} nueva${l.consultasNuevas === 1 ? "" : "s"})` : ""}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{l.ultimaActividad ? fmtHora(l.ultimaActividad) : <span style={{ color: "#999" }}>Sin actividad</span>}</td>
                      <td>{botonConvertir(l.idUsuario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {convirtiendo && (
        <div onClick={() => !guardando && setConvirtiendo(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={confirmarConversion}
            style={{ background: "white", borderRadius: "12px", padding: "25px", width: "min(94vw, 430px)", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 5px" }}>Convertir en cliente</h3>
            <p style={{ margin: "0 0 15px", color: "var(--color-gris-texto)", fontSize: "0.9rem" }}>
              {[convirtiendo.nombre, convirtiendo.apellido].filter(Boolean).join(" ")} · {convirtiendo.email}<br />
              Se crea su ficha en "Gestión de Clientes" como <strong>Prospecto</strong> (origen: Web Propia), con una nota que resume sus favoritos y consultas.
            </p>
            <div className="form-group">
              <label>DNI o CUIT * (solo números)</label>
              <input type="text" inputMode="numeric" value={dni} autoFocus maxLength={11}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))} placeholder="Ej: 30123456" />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="tel" value={tel} maxLength={20} onChange={(e) => setTel(e.target.value)} placeholder="Ej: 351 123 4567" />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "10px" }}>
              <button type="button" className="btn btn-outline" disabled={guardando} onClick={() => setConvirtiendo(null)}>Cancelar</button>
              <button type="submit" className="btn btn-rojo" disabled={guardando || dni.length < 7}>{guardando ? "Guardando..." : "Convertir"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default LeadsWeb;
