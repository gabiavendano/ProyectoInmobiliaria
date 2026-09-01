import React, { useState, useEffect } from "react";

const InputG = ({ label, name, type = "text", ph = "", col = 1, valorActual, onChange, icon }) => (
  <div className="form-group" style={{ flex: col }}>
    <label>{label}</label>
    {icon ? (
      <div className="input-with-icon">
         <i className={`fa-solid ${icon}`}></i>
         <input type={type} name={name} value={valorActual || ""} onChange={onChange} placeholder={ph} />
      </div>
    ) : (
      <input type={type} name={name} value={valorActual || ""} onChange={onChange} placeholder={ph} />
    )}
  </div>
);

const VACIO = {
  fecha: new Date().toISOString().split('T')[0],
  idPropiedad: "", idPersona: "", monto: "", moneda: "ARS",
  medioPago: "Transferencia Bancaria", estado: "Completado",
  conceptoIngreso: "Alquiler", conceptoEgreso: "Mantenimiento / Reparación", requiereAutorizacion: false,
  bancoDestino: "", cbuAlias: "", observaciones: ""
};

const CATEGORIAS_INGRESO = ["Alquiler", "Reserva", "Seña", "Depósito en Garantía", "Recupero de Gasto", "Intereses / Mora", "Penalidad", "Otro"];
const CATEGORIAS_EGRESO = ["Expensas Ordinarias", "Expensas Extraordinarias", "Impuestos (Rentas/Muni)", "Servicios (Luz/Gas/Agua)", "Reparación / Plomería", "Electricidad", "Mantenimiento / Jardinería", "Honorarios Profesionales", "Seguro", "Otro"];
const MEDIOS_PAGO = ["Transferencia Bancaria", "Efectivo (Caja)", "Cheque", "Mercado Pago", "Retención / Descuento"];

function FinanzasForm({ onGuardado, onCancelar }) {
  const [tabActual, setTabActual] = useState("Ingreso");
  const [form, setForm] = useState(VACIO);
  const [personas, setPersonas] = useState([]);
  const [propiedades, setPropiedades] = useState([]);

  useEffect(() => {
    // getPersonas().then(r => setPersonas(r.data));
    // getPropiedades().then(r => setPropiedades(r.data));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleTab = (tab) => {
    setTabActual(tab);
    setForm(prev => ({ ...prev, estado: tab === 'Transferencia' ? 'Pendiente' : 'Completado' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(`Guardando ${tabActual}:`, form);
    alert(`Movimiento de ${tabActual} registrado correctamente en la cuenta corriente.`);
    if(onGuardado) onGuardado();
  };

  return (
    <div className="card animation-fade-in" style={{padding: 0, overflow: 'hidden'}}>
      
      {/* ======================= ENCABEZADO CON BOTÓN VOLVER ======================= */}
      <div className="card-header" style={{backgroundColor: 'var(--color-negro)', color: 'white', margin: 0, padding: '20px 30px'}}>
        <span className="card-title" style={{fontSize: '1.3rem', color: 'white'}}>
           <i className="fa-solid fa-money-bill-transfer"></i> Carga de Movimiento Financiero
        </span>
        <div style={{display: 'flex', gap: '15px'}}>
           <button type="button" className="btn btn-outline" style={{backgroundColor: 'white', borderColor: 'transparent'}} onClick={onCancelar}>
              <i className="fa-solid fa-arrow-left"></i> Volver a Finanzas
           </button>
           <button type="button" className="btn btn-rojo" onClick={handleSubmit}>
              <i className="fa-solid fa-save"></i> Registrar Movimiento
           </button>
        </div>
      </div>

      <div className="tabs" style={{backgroundColor: 'white', padding: '0 20px', borderBottom: '1px solid #ddd'}}>
        <button className={`tab-btn ${tabActual === 'Ingreso' ? 'active' : ''}`} onClick={() => handleTab('Ingreso')}>
           <i className="fa-solid fa-arrow-right-to-bracket" style={{color: tabActual === 'Ingreso' ? '#2E7D32' : 'inherit'}}></i> Ingreso (Cobro)
        </button>
        <button className={`tab-btn ${tabActual === 'Egreso' ? 'active' : ''}`} onClick={() => handleTab('Egreso')}>
           <i className="fa-solid fa-arrow-right-from-bracket" style={{color: tabActual === 'Egreso' ? '#E65100' : 'inherit'}}></i> Egreso (Gasto)
        </button>
        <button className={`tab-btn ${tabActual === 'Transferencia' ? 'active' : ''}`} onClick={() => handleTab('Transferencia')}>
           <i className="fa-solid fa-building-columns" style={{color: tabActual === 'Transferencia' ? '#1565C0' : 'inherit'}}></i> Liquidación a Propietario
        </button>
      </div>

      <form onSubmit={(e) => e.preventDefault()} style={{padding: '30px', backgroundColor: 'var(--color-gris-fondo)'}}>
        
        <div style={{padding: '25px', backgroundColor: '#fff', borderRadius: '12px', borderBottom: '1px solid #eee', boxShadow: 'var(--sombra-flat)'}}>
          <div className="form-row" style={{marginBottom: 0}}>
             <InputG label="Fecha del Movimiento" name="fecha" type="date" valorActual={form.fecha} onChange={handleChange} />
             
             <div className="form-group" style={{flex: 2}}>
                <label>Propiedad Asociada (Opcional si es gasto general)</label>
                <select name="idPropiedad" value={form.idPropiedad} onChange={handleChange} style={{fontWeight: 'bold', borderColor: 'var(--color-rojo)'}}>
                   <option value="">Ninguna / Gasto de Inmobiliaria</option>
                   <option value="1">Complejo Los Troncos - Depto 1</option>
                   <option value="2">Casa en Villa del Lago</option>
                   {propiedades.map(p => <option key={p.idPropiedad} value={p.idPropiedad}>{p.titulo}</option>)}
                </select>
             </div>

             <div className="form-group">
                <label>Estado del Movimiento</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                   <option>Completado</option>
                   <option>Pendiente de Pago</option>
                   <option>Programado</option>
                   <option>Anulado</option>
                </select>
             </div>
          </div>
        </div>

        {tabActual === 'Ingreso' && (
          <div className="tab-content active animation-fade-in" style={{padding: '25px', backgroundColor: '#fff', marginTop: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-flat)'}}>
            <h6 style={{color: '#2E7D32'}}><i className="fa-solid fa-user-check"></i> Origen del Dinero</h6>
            <div className="form-row">
              <div className="form-group" style={{flex: 2}}>
                 <label>Locatario / Pagador</label>
                 <select name="idPersona" value={form.idPersona} onChange={handleChange}>
                    <option value="">Seleccione Cliente...</option>
                    <option value="1">Gómez, Martín (Inquilino)</option>
                    {personas.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
                 </select>
              </div>
              <div className="form-group" style={{flex: 1}}>
                 <label>Concepto Comercial</label>
                 <select name="conceptoIngreso" value={form.conceptoIngreso} onChange={handleChange}>
                    {CATEGORIAS_INGRESO.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
            </div>
            
            <h6 style={{color: '#2E7D32', marginTop: '20px'}}><i className="fa-solid fa-money-bill-wave"></i> Detalles Económicos</h6>
            <div className="form-row" style={{backgroundColor: '#E8F5E9', padding: '15px', borderRadius: '8px', border: '1px solid #A5D6A7'}}>
              <InputG label="Monto Cobrado" name="monto" type="number" valorActual={form.monto} onChange={handleChange} icon="fa-plus" />
              <div className="form-group"><label>Moneda</label><select name="moneda" value={form.moneda} onChange={handleChange}><option>ARS</option><option>USD</option></select></div>
              <div className="form-group"><label>Medio de Pago</label><select name="medioPago" value={form.medioPago} onChange={handleChange}>{MEDIOS_PAGO.map(m=><option key={m}>{m}</option>)}</select></div>
            </div>
          </div>
        )}

        {tabActual === 'Egreso' && (
          <div className="tab-content active animation-fade-in" style={{padding: '25px', backgroundColor: '#fff', marginTop: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-flat)'}}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                <h6 style={{color: '#E65100'}}><i className="fa-solid fa-toolbox"></i> Destino del Dinero (Proveedor)</h6>
                <div className="checkbox-group" style={{margin: 0, padding: '5px 10px', backgroundColor: '#FFF3E0', borderRadius: '6px', border: '1px solid #FFCC80'}}>
                   <input type="checkbox" id="reqAut" name="requiereAutorizacion" checked={form.requiereAutorizacion} onChange={handleChange} />
                   <label htmlFor="reqAut" style={{color: '#E65100', fontWeight: 'bold'}}>Requiere Autorización del Propietario</label>
                </div>
             </div>
             <div className="form-row" style={{marginTop: '15px'}}>
                <div className="form-group" style={{flex: 2}}>
                   <label>Proveedor / Destinatario</label>
                   <select name="idPersona" value={form.idPersona} onChange={handleChange}>
                      <option value="">Seleccione Proveedor o Escriba...</option>
                      <option value="99">Juan Pérez (Plomería)</option>
                      <option value="100">EPEC (Empresa de Energía)</option>
                   </select>
                </div>
                <div className="form-group" style={{flex: 1}}>
                   <label>Categoría del Gasto</label>
                   <select name="conceptoEgreso" value={form.conceptoEgreso} onChange={handleChange}>
                      {CATEGORIAS_EGRESO.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
             </div>
             
             <h6 style={{color: '#E65100', marginTop: '20px'}}><i className="fa-solid fa-money-bill-wave"></i> Detalles Económicos</h6>
             <div className="form-row" style={{backgroundColor: '#FFF3E0', padding: '15px', borderRadius: '8px', border: '1px solid #FFCC80'}}>
                <InputG label="Monto Pagado" name="monto" type="number" valorActual={form.monto} onChange={handleChange} icon="fa-minus" />
                <div className="form-group"><label>Moneda</label><select name="moneda" value={form.moneda} onChange={handleChange}><option>ARS</option><option>USD</option></select></div>
                <div className="form-group"><label>Medio de Pago</label><select name="medioPago" value={form.medioPago} onChange={handleChange}>{MEDIOS_PAGO.map(m=><option key={m}>{m}</option>)}</select></div>
             </div>
          </div>
        )}

        {tabActual === 'Transferencia' && (
          <div className="tab-content active animation-fade-in" style={{padding: '25px', backgroundColor: '#fff', marginTop: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-flat)'}}>
            <h6 style={{color: '#1565C0'}}><i className="fa-solid fa-user-tie"></i> Propietario a Liquidar</h6>
            <div className="form-row">
              <div className="form-group" style={{flex: 2}}>
                 <label>Titular de la Cuenta</label>
                 <select name="idPersona" value={form.idPersona} onChange={handleChange}>
                    <option value="">Seleccione Propietario...</option>
                    <option value="50">Pérez, Juan (Propietario)</option>
                    {personas.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
                 </select>
              </div>
              <div className="form-group" style={{flex: 1}}>
                 <label>Estado de Liquidación</label>
                 <select name="estado" value={form.estado} onChange={handleChange}>
                    <option>Pendiente / A programar</option>
                    <option>Enviada (Acreditación 24hs)</option>
                    <option>Completada</option>
                 </select>
              </div>
            </div>

            <h6 style={{color: '#1565C0', marginTop: '20px'}}><i className="fa-solid fa-building-columns"></i> Datos Bancarios y Monto</h6>
            <div className="form-row" style={{backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px', border: '1px solid #90CAF9'}}>
               <InputG label="Monto a Transferir (Neto)" name="monto" type="number" valorActual={form.monto} onChange={handleChange} icon="fa-paper-plane" />
               <div className="form-group"><label>Moneda</label><select name="moneda" value={form.moneda} onChange={handleChange}><option>ARS</option><option>USD</option></select></div>
               <InputG label="Banco Destino" name="bancoDestino" ph="Ej: Santander, Galicia..." valorActual={form.bancoDestino} onChange={handleChange} />
            </div>
            
            <div className="form-row" style={{marginTop: '15px'}}>
               <InputG label="CBU / CVU / Alias" name="cbuAlias" valorActual={form.cbuAlias} onChange={handleChange} icon="fa-barcode" col={2} />
               <InputG label="Concepto (Referencia bancaria)" name="conceptoIngreso" ph="Ej: Liq. Alquiler Agosto" valorActual={form.conceptoIngreso} onChange={handleChange} col={2} />
            </div>
          </div>
        )}

        <div style={{backgroundColor: '#fff', padding: '25px', borderRadius: '12px', marginTop: '15px', boxShadow: 'var(--sombra-flat)'}}>
            <h6 style={{color: 'var(--color-negro)'}}>
                <i className="fa-solid fa-paperclip" style={{color: 'var(--color-rojo)'}}></i> Documentación Respaldatoria
            </h6>
            <div style={{backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px dashed #ccc', textAlign: 'center', marginBottom: '20px'}}>
                <p style={{fontSize: '0.85rem', color: 'var(--color-gris-texto)', marginBottom: '15px'}}>
                   {tabActual === 'Ingreso' ? "Suba aquí comprobantes de transferencias recibidas o recibos físicos firmados." : 
                    tabActual === 'Egreso' ? "Es obligatorio subir la Factura AFIP (A/B/C) o ticket del proveedor para la rendición al propietario." : 
                    "Suba aquí el comprobante bancario de la transferencia realizada al propietario."}
                </p>
                <input type="file" accept=".pdf, image/*" multiple className="btn btn-outline" style={{backgroundColor: 'white', width: '100%', maxWidth: '400px'}} />
            </div>

            <div className="form-group" style={{margin: 0}}>
                <label>Observaciones internas (No visibles para el propietario/inquilino)</label>
                <textarea 
                   name="observaciones" 
                   value={form.observaciones} 
                   onChange={handleChange} 
                   rows="2" 
                   placeholder="Anotaciones sobre este movimiento..."
                   style={{borderColor: '#ddd'}}
                ></textarea>
            </div>
        </div>

      </form>
    </div>
  );
}
export default FinanzasForm;