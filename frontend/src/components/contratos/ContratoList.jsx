import React, { useEffect, useState } from "react";
import {
  getContratos, rescindirContrato, cerrarVenta,
  getLiquidaciones, registrarLiquidacion
} from "../../services/contratoService";
import ContratoForm from "./ContratoForm";

const BADGE_TIPO   = { 
  "Venta": "badge-green", 
  "Permuta": "badge-warning", 
  "Alquiler anual": "badge-blue", 
  "Alquiler temporario": "badge-purple" 
};

const BADGE_ESTADO = { 
  "Borrador": "badge-outline", 
  "En preparación": "badge-outline", 
  "Documentación pendiente": "badge-warning", 
  "Lista para contrato": "badge-blue", 
  "Contrato generado": "badge-blue", 
  "Pendiente de firma": "badge-warning", 
  "Firmada": "badge-green", 
  "Vigente": "badge-green", 
  "Finalizada": "badge-outline", 
  "Cancelada": "badge-red" 
};

const LIQ_VACIO = { mesAnoLiquidado: "", fechaVencimiento: "", fechaPagoReal: "", montoAlquilerBase: "" };

function ContratoList() {
  const [contratos, setContratos]     = useState([]);
  const [expandido, setExpandido]     = useState(null);
  const [liquidaciones, setLiqs]      = useState([]);
  const [formLiq, setFormLiq]         = useState(LIQ_VACIO);
  const [errorLiq, setErrorLiq]       = useState("");
  const [cargando, setCargando]       = useState(true);

  const cargar = () => {
    setCargando(true);
    getContratos().then(r => setContratos(r.data)).finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);

  const handleExpandir = (id) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    getLiquidaciones(id).then(r => setLiqs(r.data));
  };

  const handleRescindir = (id) => {
    if (!window.confirm("¿Rescindir este contrato? El histórico y la documentación se conservan.")) return;
    rescindirContrato(id).then(cargar);
  };

  const handleCerrarVenta = (id) => {
    if (!window.confirm("¿Cerrar venta y transferir la propiedad al comprador?")) return;
    cerrarVenta(id).then(cargar).catch(e => alert(e.response?.data?.error));
  };

  const handleLiquidacion = async (idContrato) => {
    setErrorLiq("");
    try {
      await registrarLiquidacion(idContrato, {
        contrato: { idOperacion: idContrato }, ...formLiq
      });
      setFormLiq(LIQ_VACIO);
      getLiquidaciones(idContrato).then(r => setLiqs(r.data));
    } catch (e) {
      setErrorLiq(e.response?.data?.error || "Error al registrar pago.");
    }
  };

  return (
    <div>
      <ContratoForm onGuardado={cargar} />

      <div className="card" style={{marginTop: '20px'}}>
        <div className="card-header">
          <span className="card-title"><i className="fa-solid fa-folder-open"></i> Operaciones y Contratos Registrados</span>
          <span className="badge badge-blue">{contratos.length}</span>
        </div>
        
        <div className="table-responsive">
          {cargando ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>Cargando operaciones...</p>
          ) : contratos.length === 0 ? (
            <p style={{textAlign: 'center', padding: '20px', color: 'var(--color-gris-texto)'}}>No hay operaciones registradas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID / Tipo</th>
                  <th>Propiedad</th>
                  <th>Partes Involucradas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map(c => (
                  <React.Fragment key={c.idOperacion}>
                    <tr>
                      <td>
                        <span style={{fontSize: '0.8rem', color: '#666', display: 'block'}}>#{c.idOperacion}</span>
                        <span className={`badge ${BADGE_TIPO[c.tipoContrato]}`}>{c.tipoContrato}</span>
                      </td>
                      <td><strong>{c.propiedad?.titulo}</strong></td>
                      <td>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-negro-claro)'}}>
                          <i className="fa-solid fa-user-tag"></i> {c.compradorInquilino?.nombreCompleto} <br/>
                          <span style={{fontWeight: 'bold', color: 'var(--color-negro)'}}>
                            {c.monedaOperacion === "USD" ? "U$D" : "$"} {Number(c.montoTotalOperacion).toLocaleString("es-AR")}
                          </span>
                        </div>
                      </td>
                      <td><span className={`badge ${BADGE_ESTADO[c.estadoContrato]}`}>{c.estadoContrato}</span></td>
                      <td>
                        <div className="action-btns">
                           {c.estadoContrato === "Vigente" && (
                            <>
                              <button className="btn btn-sm btn-outline" onClick={() => handleExpandir(c.idOperacion)}>
                                <i className="fa-solid fa-coins"></i> {expandido === c.idOperacion ? "Cerrar" : "Liquidaciones"}
                              </button>
                              {c.tipoContrato === "Venta" && (
                                <button className="btn btn-sm btn-outline" style={{borderColor: '#1565C0', color: '#1565C0'}} onClick={() => handleCerrarVenta(c.idOperacion)}>
                                  <i className="fa-solid fa-handshake"></i> Cerrar venta
                                </button>
                              )}
                              <button className="btn btn-sm btn-rojo" onClick={() => handleRescindir(c.idOperacion)}>
                                <i className="fa-solid fa-ban"></i> Rescindir
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Panel expandible de liquidaciones */}
                    {expandido === c.idOperacion && (
                      <tr style={{backgroundColor: '#F8FAFC'}}>
                        <td colSpan="5" style={{padding: '25px', borderBottom: '2px solid var(--color-negro)'}}>
                          <h4 style={{marginBottom: '15px', fontSize: '1rem', color: 'var(--color-negro)'}}>
                            <i className="fa-solid fa-cash-register" style={{color: '#2E7D32'}}></i> Registrar Cobro de Operación #{c.idOperacion}
                          </h4>

                          {errorLiq && <div style={{padding: '10px', backgroundColor: 'var(--color-rojo-claro)', color: 'var(--color-rojo)', borderRadius: '6px', marginBottom: '15px'}}>{errorLiq}</div>}

                          <div className="form-row" style={{marginBottom: '20px'}}>
                            <div className="form-group">
                              <input placeholder="Período (ej: Mayo 2026)" value={formLiq.mesAnoLiquidado} onChange={e => setFormLiq({ ...formLiq, mesAnoLiquidado: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <input type="date" title="Fecha vencimiento" value={formLiq.fechaVencimiento} onChange={e => setFormLiq({ ...formLiq, fechaVencimiento: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <input type="date" title="Fecha pago real" value={formLiq.fechaPagoReal} onChange={e => setFormLiq({ ...formLiq, fechaPagoReal: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <div className="input-with-icon">
                                 <i className="fa-solid fa-dollar-sign"></i>
                                 <input type="number" placeholder="Monto base" value={formLiq.montoAlquilerBase} onChange={e => setFormLiq({ ...formLiq, montoAlquilerBase: e.target.value })} />
                              </div>
                            </div>
                            <div className="form-group" style={{justifyContent: 'flex-end'}}>
                              <button className="btn btn-negro" onClick={() => handleLiquidacion(c.idOperacion)}>
                                <i className="fa-solid fa-check"></i> Registrar
                              </button>
                            </div>
                          </div>

                          {liquidaciones.length === 0 ? (
                            <p style={{color: 'var(--color-gris-texto)', fontSize: '0.9rem'}}>Sin liquidaciones registradas.</p>
                          ) : (
                            <div className="table-responsive">
                              <table style={{backgroundColor: 'white'}}>
                                <thead>
                                  <tr>
                                    <th>Período</th><th>Base</th><th>Mora</th>
                                    <th>Total cobrado</th><th>Neto propietario</th><th>Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {liquidaciones.map(l => (
                                    <tr key={l.idLiquidacion} style={l.diasAtraso > 0 ? {backgroundColor: '#FFF3E0'} : {}}>
                                      <td>{l.mesAnoLiquidado}</td>
                                      <td>$ {Number(l.montoAlquilerBase).toLocaleString("es-AR")}</td>
                                      <td style={l.montoMoraCalculado > 0 ? {color: 'var(--color-rojo)', fontWeight: 'bold'} : {}}>
                                        {l.montoMoraCalculado > 0 ? `$ ${Number(l.montoMoraCalculado).toLocaleString("es-AR")} (${l.diasAtraso}d)` : "—"}
                                      </td>
                                      <td>$ {Number(l.totalAbonadoInquilino).toLocaleString("es-AR")}</td>
                                      <td style={{fontWeight: 'bold', color: '#2E7D32'}}>$ {Number(l.montoNetoARendir).toLocaleString("es-AR")}</td>
                                      <td><span className="badge badge-green">{l.estadoRendicion}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContratoList;