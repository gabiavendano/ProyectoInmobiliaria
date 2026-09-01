import React, { useState, useEffect } from "react";
import { createContrato } from "../../services/contratoService";
import { getPersonas } from "../../services/personaService";
import { getPropiedades } from "../../services/propiedadService";

// =========================================================================
// COMPONENTES UI REUTILIZABLES
// =========================================================================
const InputG = ({ label, name, type = "text", ph = "", col = 1, valorActual, onChange, icon }) => (
  <div className="form-group" style={{ flex: col }}>
    <label>{label}</label>
    {icon ? (
      <div className="input-with-icon"><i className={`fa-solid ${icon}`}></i><input type={type} name={name} value={valorActual || ""} onChange={onChange} placeholder={ph} /></div>
    ) : (
      <input type={type} name={name} value={valorActual || ""} onChange={onChange} placeholder={ph} />
    )}
  </div>
);

// =========================================================================
// ESTADO INICIAL
// =========================================================================
const VACIO = {
  // Datos Generales
  numeroInterno: "", fechaAlta: new Date().toISOString().split('T')[0], 
  estadoOperacion: "Borrador", usuarioResponsable: "Admin",
  
  idPropiedad: "", 

  // Venta
  venPrecio: "", venMoneda: "USD", venFormaPago: "Contado", venAnticipo: "", venCuotas: "", venMontoCuota: "",
  venMontoReserva: "", venFechaPosesion: "", venEscribano: "",

  // Permuta
  perBienesA: "", perBienesB: "", perDiferenciaMonto: "", perDiferenciaMoneda: "USD", perQuienPagaDiferencia: "Parte A",

  // Alquiler Anual
  alqFechaInicio: "", alqFechaFin: "", alqDestino: "Vivienda", alqCanonMonto: "", alqCanonMoneda: "ARS", 
  alqIndiceAjuste: "ICL", alqFrecuenciaAjuste: "Trimestral", alqMontoDeposito: "",

  // Temporario
  tempCheckIn: "", tempCheckOut: "", tempHuespedes: 2, tempPrecioNoche: "", tempPrecioTotal: "", tempMoneda: "ARS",

  // Honorarios (Ajustado a Ley 9.445 y CPI Córdoba)
  honMoneda: "USD", honMontoTotal: "",
  honParteAMonto: "", honParteAEstado: "Pendiente", honParteAFormaPago: "Efectivo",
  honParteBMonto: "", honParteBEstado: "Pendiente", honParteBFormaPago: "Efectivo",
  
  hayCoCorretaje: false, coNombre: "", coMatricula: "", coIntervencion: "Representa Comprador"
};

function ContratoForm({ onGuardado }) {
  const [tabActual, setTabActual] = useState("Venta");
  const [form, setForm] = useState(VACIO);
  const [personas, setPersonas] = useState([]);
  const [propiedades, setPropiedades] = useState([]);

  // Carga inicial de datos desde la base
  useEffect(() => {
    getPersonas().then(r => setPersonas(r.data));
    getPropiedades().then(r => setPropiedades(r.data));
  }, []);

  // Lógica de Autocompletado: Al seleccionar una propiedad, traemos sus datos pero permitimos edición.
  useEffect(() => {
    if (form.idPropiedad && propiedades.length > 0) {
      const propiedadSeleccionada = propiedades.find(p => p.idPropiedad.toString() === form.idPropiedad.toString());
      
      if (propiedadSeleccionada) {
        setForm(prev => ({
          ...prev,
          // Si el campo está vacío, lo autocompleta con el valor de la base de datos de la propiedad
          venPrecio: prev.venPrecio || propiedadSeleccionada.precio || "",
          alqCanonMonto: prev.alqCanonMonto || propiedadSeleccionada.precio || "",
          venMoneda: propiedadSeleccionada.moneda || prev.venMoneda,
          alqCanonMoneda: propiedadSeleccionada.moneda || prev.alqCanonMoneda,
        }));
      }
    }
  }, [form.idPropiedad, propiedades]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleTab = (tab) => {
    setTabActual(tab);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(`Guardando Operación de ${tabActual}:`, form);
    alert("Operación registrada correctamente.");
    if(onGuardado) onGuardado();
  };

  return (
    <div className="card animation-fade-in">
      <div className="card-header">
        <span className="card-title"><i className="fa-solid fa-file-contract"></i> Generación de Operación / Contrato</span>
        <button className="btn btn-rojo" onClick={handleSubmit}><i className="fa-solid fa-save"></i> Guardar Operación</button>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tabActual === 'Venta' ? 'active' : ''}`} onClick={() => handleTab('Venta')}><i className="fa-solid fa-tags"></i> Venta</button>
        <button className={`tab-btn ${tabActual === 'Permuta' ? 'active' : ''}`} onClick={() => handleTab('Permuta')}><i className="fa-solid fa-right-left"></i> Permuta</button>
        <button className={`tab-btn ${tabActual === 'Alquiler Anual' ? 'active' : ''}`} onClick={() => handleTab('Alquiler Anual')}><i className="fa-solid fa-calendar-days"></i> Alquiler Anual</button>
        <button className={`tab-btn ${tabActual === 'Temporario' ? 'active' : ''}`} onClick={() => handleTab('Temporario')}><i className="fa-solid fa-umbrella-beach"></i> Alq. Temporario</button>
        <button className={`tab-btn ${tabActual === 'Modelos de Contratos' ? 'active' : ''}`} onClick={() => handleTab('Modelos de Contratos')} style={{marginLeft: 'auto', borderLeft: '1px solid #ddd', color: 'var(--color-rojo)'}}><i className="fa-regular fa-file-pdf"></i> Modelos de Contratos</button>
      </div>

      <form onSubmit={(e) => e.preventDefault()}>
        
        {/* =========================================================
            PESTAÑA: MODELOS DE CONTRATOS
        ========================================================= */}
        {tabActual === 'Modelos de Contratos' ? (
          <div className="tab-content active" style={{padding: '40px 25px', textAlign: 'center'}}>
            <i className="fa-solid fa-file-signature" style={{fontSize: '3rem', color: '#D32F2F', marginBottom: '20px'}}></i>
            <h3 style={{color: 'var(--color-negro)', marginBottom: '10px'}}>Plantillas y Modelos Legales</h3>
            <p style={{color: 'var(--color-gris-texto)', maxWidth: '600px', margin: '0 auto 30px auto'}}>
              Descarga los modelos base para redactar tus contratos bajo la normativa vigente del Código Civil y Comercial.
            </p>
            
            <div style={{display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap'}}>
                <a href="/CONTRATO DE LOCACIÓN MODELO.pdf" download="CONTRATO DE LOCACIÓN MODELO.pdf" className="btn btn-outline" style={{padding: '15px 30px', fontSize: '1.05rem', borderColor: 'var(--color-rojo)', color: 'var(--color-rojo)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <i className="fa-regular fa-file-pdf" style={{fontSize: '1.5rem'}}></i> 
                    <div style={{textAlign: 'left'}}>
                       <span style={{display: 'block', fontWeight: 'bold'}}>Contrato de Locación</span>
                       <span style={{fontSize: '0.8rem', color: '#666'}}>Modelo Estándar (Vivienda)</span>
                    </div>
                </a>

                {/* Nuevo Botón: Reserva Ad Referendum */}
                <a href="/RESERVA AD REFERENDUM.doc" download="RESERVA AD REFERENDUM.doc" className="btn btn-outline" style={{padding: '15px 30px', fontSize: '1.05rem', borderColor: 'var(--color-rojo)', color: 'var(--color-rojo)', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <i className="fa-regular fa-file-word" style={{fontSize: '1.5rem'}}></i> 
                    <div style={{textAlign: 'left'}}>
                       <span style={{display: 'block', fontWeight: 'bold'}}>Reserva Ad Referendum</span>
                       <span style={{fontSize: '0.8rem', color: '#666'}}>Modelo Estandar (Reserva de Venta)</span>
                    </div>
                </a>
            </div>
          </div>
        ) : (
          /* =========================================================
              CONTENIDO DE OPERACIONES
          ========================================================= */
          <>
            <div style={{padding: '20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #eee'}}>
              <div className="form-row" style={{marginBottom: 0}}>
                 <div className="form-group" style={{flex: 2}}>
                    <label>Propiedad Involucrada (Autocompleta los datos económicos)</label>
                    <select name="idPropiedad" value={form.idPropiedad} onChange={handleChange} style={{fontWeight: 'bold', borderColor: 'var(--color-rojo)'}}>
                       <option value="">Seleccionar Propiedad...</option>
                       {propiedades.map(p => <option key={p.idPropiedad} value={p.idPropiedad}>{p.titulo}</option>)}
                    </select>
                 </div>
                 <div className="form-group">
                    <label>Estado de la Operación</label>
                    <select name="estadoOperacion" value={form.estadoOperacion} onChange={handleChange}>
                       <option>Borrador</option><option>En preparación</option><option>Documentación pendiente</option>
                       <option>Lista para contrato</option><option>Firmada</option><option>Vigente</option>
                    </select>
                 </div>
                 <InputG label="Fecha de Alta" name="fechaAlta" type="date" valorActual={form.fechaAlta} onChange={handleChange} />
              </div>
            </div>

            {/* TAB: VENTA */}
            {tabActual === 'Venta' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Partes Intervinientes</h6>
                <div className="form-row">
                  <div className="form-group"><label>Vendedor/es (Propietarios)</label><select multiple style={{height: '80px'}}><option>Seleccione desde base...</option></select></div>
                  <div className="form-group"><label>Comprador/es</label><select multiple style={{height: '80px'}}><option>Seleccione desde base...</option></select></div>
                </div>
                
                <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-money-bill-wave"></i> Condiciones Económicas</h6>
                <div className="form-row" style={{backgroundColor: '#E8F5E9', padding: '15px', borderRadius: '8px'}}>
                  <InputG label="Precio Total Acordado" name="venPrecio" type="number" valorActual={form.venPrecio} onChange={handleChange} />
                  <div className="form-group"><label>Moneda</label><select name="venMoneda" value={form.venMoneda} onChange={handleChange}><option>USD</option><option>ARS</option></select></div>
                  <div className="form-group"><label>Forma de Pago</label><select name="venFormaPago" value={form.venFormaPago} onChange={handleChange}><option>Contado</option><option>Financiación</option><option>Permuta parcial</option></select></div>
                </div>

                {form.venFormaPago === "Financiación" && (
                  <div className="form-row animation-fade-in" style={{marginTop: '15px'}}>
                     <InputG label="Anticipo" name="venAnticipo" type="number" valorActual={form.venAnticipo} onChange={handleChange} />
                     <InputG label="Cant. Cuotas" name="venCuotas" type="number" valorActual={form.venCuotas} onChange={handleChange} />
                     <InputG label="Monto por Cuota" name="venMontoCuota" type="number" valorActual={form.venMontoCuota} onChange={handleChange} />
                  </div>
                )}

                <div className="form-row" style={{marginTop: '15px'}}>
                   <InputG label="Monto Reserva/Seña" name="venMontoReserva" type="number" valorActual={form.venMontoReserva} onChange={handleChange} />
                   <InputG label="Fecha Est. Posesión" name="venFechaPosesion" type="date" valorActual={form.venFechaPosesion} onChange={handleChange} />
                   <InputG label="Escribano Designado" name="venEscribano" valorActual={form.venEscribano} onChange={handleChange} />
                </div>
              </div>
            )}

            {/* TAB: PERMUTA */}
            {tabActual === 'Permuta' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                 <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Partes Intervinientes</h6>
                 <div className="form-row">
                    <div className="form-group"><label>Parte A</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                    <div className="form-group"><label>Parte B</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                 </div>

                 <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-right-left"></i> Intercambio de Bienes</h6>
                 <div className="form-row">
                    <InputG label="Bienes Entregados por A" name="perBienesA" ph="Ej: Dpto Centro + Auto" valorActual={form.perBienesA} onChange={handleChange} col={2} />
                    <InputG label="Bienes Entregados por B" name="perBienesB" ph="Ej: Lote San Ignacio" valorActual={form.perBienesB} onChange={handleChange} col={2} />
                 </div>
                 
                 <div className="form-row" style={{backgroundColor: '#FFF3E0', padding: '15px', borderRadius: '8px'}}>
                    <InputG label="Diferencia en Efectivo" name="perDiferenciaMonto" type="number" valorActual={form.perDiferenciaMonto} onChange={handleChange} icon="fa-money-bill-transfer" />
                    <div className="form-group"><label>Moneda Diferencia</label><select name="perDiferenciaMoneda" value={form.perDiferenciaMoneda} onChange={handleChange}><option>USD</option><option>ARS</option></select></div>
                    <div className="form-group"><label>Quién abona</label><select name="perQuienPagaDiferencia" value={form.perQuienPagaDiferencia} onChange={handleChange}><option>Parte A</option><option>Parte B</option></select></div>
                 </div>
              </div>
            )}

            {/* TAB: ALQUILER ANUAL */}
            {tabActual === 'Alquiler Anual' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Partes Intervinientes</h6>
                <div className="form-row">
                  <div className="form-group"><label>Locador/es</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                  <div className="form-group"><label>Locatario/s</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                  <div className="form-group"><label>Garante/s / Fiador/es</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                </div>

                <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-file-invoice-dollar"></i> Condiciones del Contrato</h6>
                <div className="form-row">
                  <InputG label="Inicio Contrato" name="alqFechaInicio" type="date" valorActual={form.alqFechaInicio} onChange={handleChange} />
                  <InputG label="Fin Contrato" name="alqFechaFin" type="date" valorActual={form.alqFechaFin} onChange={handleChange} />
                  <div className="form-group"><label>Destino</label><select name="alqDestino" value={form.alqDestino} onChange={handleChange}><option>Vivienda</option><option>Comercial</option></select></div>
                </div>
                
                <div className="form-row" style={{backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px'}}>
                  <InputG label="Canon Mensual Acordado" name="alqCanonMonto" type="number" valorActual={form.alqCanonMonto} onChange={handleChange} icon="fa-money-bill" />
                  <div className="form-group"><label>Moneda</label><select name="alqCanonMoneda" value={form.alqCanonMoneda} onChange={handleChange}><option>ARS</option><option>USD</option></select></div>
                  <div className="form-group"><label>Índice Ajuste</label><select name="alqIndiceAjuste" value={form.alqIndiceAjuste} onChange={handleChange}><option>ICL</option><option>IPC</option><option>Fijo</option></select></div>
                  <div className="form-group"><label>Frecuencia Ajuste</label><select name="alqFrecuenciaAjuste" value={form.alqFrecuenciaAjuste} onChange={handleChange}><option>Trimestral</option><option>Cuatrimestral</option><option>Semestral</option></select></div>
                </div>
              </div>
            )}

            {/* TAB: TEMPORARIO */}
            {tabActual === 'Temporario' && (
              <div className="tab-content active" style={{padding: '25px'}}>
                <h6 style={{color: 'var(--color-rojo)'}}><i className="fa-solid fa-users"></i> Locador y Huéspedes</h6>
                <div className="form-row">
                  <div className="form-group"><label>Locador/es</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                  <div className="form-group"><label>Huésped/es Titular</label><select multiple style={{height: '80px'}}><option>Seleccione...</option></select></div>
                </div>

                <h6 style={{color: 'var(--color-rojo)', marginTop: '20px'}}><i className="fa-solid fa-calendar-check"></i> Fechas y Tarifas</h6>
                <div className="form-row">
                  <InputG label="Check-in" name="tempCheckIn" type="date" valorActual={form.tempCheckIn} onChange={handleChange} />
                  <InputG label="Check-out" name="tempCheckOut" type="date" valorActual={form.tempCheckOut} onChange={handleChange} />
                  <InputG label="Huéspedes Totales" name="tempHuespedes" type="number" valorActual={form.tempHuespedes} onChange={handleChange} />
                </div>
                <div className="form-row" style={{backgroundColor: '#F3E5F5', padding: '15px', borderRadius: '8px'}}>
                  <InputG label="Precio por Noche" name="tempPrecioNoche" type="number" valorActual={form.tempPrecioNoche} onChange={handleChange} />
                  <InputG label="Precio Total" name="tempPrecioTotal" type="number" valorActual={form.tempPrecioTotal} onChange={handleChange} icon="fa-wallet" />
                  <div className="form-group"><label>Moneda</label><select name="tempMoneda" value={form.tempMoneda} onChange={handleChange}><option>ARS</option><option>USD</option></select></div>
                </div>
              </div>
            )}

            {/* =========================================================
                MÓDULO TRANSVERSAL: HONORARIOS (Ley 9.445 y CPI Córdoba)
            ========================================================= */}
            <div style={{padding: '25px', borderTop: '2px solid #eee', backgroundColor: '#fff'}}>
                
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px'}}>
                   <div>
                      <h6 style={{color: 'var(--color-negro)', marginBottom: '5px', fontSize: '1.1rem'}}>
                         <i className="fa-solid fa-scale-balanced" style={{color: 'var(--color-rojo)'}}></i> Honorarios Profesionales
                      </h6>
                      <p style={{fontSize: '0.85rem', color: '#666', maxWidth: '700px', margin: 0}}>
                        Marco legal: <strong>Ley Provincial N° 9.445</strong> y pautas del <strong>CPI Córdoba</strong>. <br/>
                        <em>Sugeridos: Compraventas (3% comprador / 3% vendedor). Locaciones (5% del monto total del contrato).</em>
                      </p>
                   </div>
                   
                   <a href="https://www.afip.gob.ar/facturacion/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{borderColor: '#1565C0', color: '#1565C0', padding: '10px 15px'}}>
                      <i className="fa-solid fa-file-invoice"></i> Facturar en ARCA (ex AFIP)
                   </a>
                </div>
                
                <div className="form-row">
                    <div className="form-group" style={{flex: 1}}>
                       <label>Moneda Base</label>
                       <select name="honMoneda" value={form.honMoneda} onChange={handleChange}><option>USD</option><option>ARS</option></select>
                    </div>
                    <InputG label="Honorarios Totales (Inmobiliaria)" name="honMontoTotal" type="number" valorActual={form.honMontoTotal} onChange={handleChange} icon="fa-sack-dollar" />
                </div>

                {/* Desglose: Parte Vendedora / Locadora */}
                <div style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px solid #E0E0E0', marginBottom: '15px'}}>
                   <span style={{fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#1565C0'}}>A cargo del Vendedor / Locador</span>
                   <div className="form-row" style={{marginBottom: 0}}>
                      <InputG label="Monto a cobrar (Ej: 3%)" name="honParteAMonto" type="number" valorActual={form.honParteAMonto} onChange={handleChange} />
                      <div className="form-group"><label>Forma de Pago</label><select name="honParteAFormaPago" value={form.honParteAFormaPago} onChange={handleChange}><option>Efectivo</option><option>Transferencia</option><option>Cheque</option><option>A convenir</option></select></div>
                      <div className="form-group"><label>Estado</label><select name="honParteAEstado" value={form.honParteAEstado} onChange={handleChange}><option>Pendiente</option><option>Pactado</option><option>Facturado</option><option>Parcialmente abonado</option><option>Abonado</option><option>Anulado</option></select></div>
                   </div>
                </div>

                {/* Desglose: Parte Compradora / Locataria */}
                <div style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px solid #E0E0E0'}}>
                   <span style={{fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#2E7D32'}}>A cargo del Comprador / Locatario</span>
                   <div className="form-row" style={{marginBottom: 0}}>
                      <InputG label="Monto a cobrar (Ej: 3%)" name="honParteBMonto" type="number" valorActual={form.honParteBMonto} onChange={handleChange} />
                      <div className="form-group"><label>Forma de Pago</label><select name="honParteBFormaPago" value={form.honParteBFormaPago} onChange={handleChange}><option>Efectivo</option><option>Transferencia</option><option>Cheque</option><option>A convenir</option></select></div>
                      <div className="form-group"><label>Estado</label><select name="honParteBEstado" value={form.honParteBEstado} onChange={handleChange}><option>Pendiente</option><option>Pactado</option><option>Facturado</option><option>Parcialmente abonado</option><option>Abonado</option><option>Anulado</option></select></div>
                   </div>
                </div>

                {/* =========================================================
                    MÓDULO TRANSVERSAL: CO-CORRETAJE
                ========================================================= */}
                <div style={{backgroundColor: '#FFF8F8', padding: '20px', borderRadius: '8px', border: '1px solid #FFCDD2', marginTop: '20px'}}>
                    <div className="checkbox-group" style={{margin: 0}}>
                        <input type="checkbox" id="hayCoCorretaje" name="hayCoCorretaje" checked={form.hayCoCorretaje} onChange={handleChange} style={{transform: 'scale(1.2)'}} />
                        <label htmlFor="hayCoCorretaje" style={{fontWeight: 'bold', color: 'var(--color-rojo)'}}>Habilitar Co-Corretaje (Inmobiliaria Colega Externa)</label>
                    </div>
                    
                    {form.hayCoCorretaje && (
                        <div className="animation-fade-in" style={{marginTop: '20px', borderTop: '1px dashed #FFCDD2', paddingTop: '15px'}}>
                            <div className="form-row" style={{marginBottom: 0}}>
                                <InputG label="Inmobiliaria / Agente Externa" name="coNombre" valorActual={form.coNombre} onChange={handleChange} col={2} />
                                <InputG label="Matrícula" name="coMatricula" valorActual={form.coMatricula} onChange={handleChange} />
                                <div className="form-group"><label>Intervención</label><select name="coIntervencion" value={form.coIntervencion} onChange={handleChange}><option>Representa Comprador/Locatario</option><option>Representa Vendedor/Locador</option></select></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================================
                MÓDULO TRANSVERSAL: DOCUMENTACIÓN
            ========================================================= */}
            <div style={{backgroundColor: '#F8FAFC', padding: '25px', borderRadius: '8px', margin: '25px', border: '1px solid var(--color-gris-borde)', textAlign: 'center'}}>
                <h6 style={{marginBottom: '15px', color: 'var(--color-negro)'}}><i className="fa-solid fa-folder-open" style={{color:'#D32F2F'}}></i> Documentación de la Operación</h6>
                <p style={{fontSize: '0.85rem', color: 'var(--color-gris-texto)', marginBottom: '15px'}}>Suba aquí DNIs, garantías, escrituras o contratos firmados correspondientes a esta operación.</p>
                <input type="file" accept=".pdf" multiple className="btn btn-outline" style={{backgroundColor: 'white', width: '100%', maxWidth: '400px'}} />
            </div>
          </>
        )}

      </form>
    </div>
  );
}
export default ContratoForm;