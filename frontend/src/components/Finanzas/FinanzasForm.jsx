import { useState, useEffect } from "react";
import { getPersonas, getPropiedades, crearMovimiento, editarMovimiento } from "../../services/api";
import { InputG } from "../common/FormUI";
import { soloClientesReales } from "../../utils/personas";
import OpcionesMoneda from "../common/OpcionesMoneda";
import { avisar } from "../../utils/avisos";

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

// Datos del formulario a partir de un movimiento existente (edición)
const desdeMovimiento = (m) => ({
  ...VACIO,
  fecha: m.fecha || VACIO.fecha,
  idPropiedad: m.propiedad?.idPropiedad ?? "", idPersona: m.persona?.idPersona ?? "",
  monto: String(m.monto ?? ""), moneda: m.moneda || "ARS", medioPago: m.medioPago || VACIO.medioPago,
  estado: m.estado || "Completado",
  conceptoIngreso: m.conceptoIngreso || VACIO.conceptoIngreso, conceptoEgreso: m.conceptoEgreso || VACIO.conceptoEgreso,
  requiereAutorizacion: !!m.requiereAutorizacion, bancoDestino: m.bancoDestino || "", cbuAlias: m.cbuAlias || "",
  observaciones: m.observaciones || "",
});

function FinanzasForm({ movimiento, onGuardado, onCancelar }) {
  const editando = !!movimiento;
  const [tabActual, setTabActual] = useState(movimiento?.tipo || "Ingreso");
  const [form, setForm] = useState(movimiento ? desdeMovimiento(movimiento) : VACIO);
  const [personas, setPersonas] = useState([]);
  const [errores, setErrores] = useState({});
  const [propiedades, setPropiedades] = useState([]);

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getPersonas().then(r => setPersonas(soloClientesReales(r.data))).catch(err => console.error("Error cargando personas:", err));
    getPropiedades().then(r => setPropiedades(r.data)).catch(err => console.error("Error cargando propiedades:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    setErrores(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleTab = (tab) => {
    if (editando) return;   // al editar no se cambia el tipo de movimiento
    setTabActual(tab);
    setForm(prev => ({ ...prev, estado: tab === 'Transferencia' ? 'Programado' : 'Completado' }));
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (guardando) return;
    const faltan = {};
    if (!(Number(form.monto) > 0)) faltan.monto = "Ingresá un monto mayor a cero.";
    if (tabActual !== 'Egreso' && !form.idPersona)
      faltan.idPersona = tabActual === 'Ingreso' ? "Elegí quién realizó el pago." : "Elegí el propietario a liquidar.";
    setErrores(faltan);
    if (Object.keys(faltan).length) {
      avisar("Faltan datos obligatorios: revisá los campos marcados en rojo.", "error");
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
      return;
    }

    const payload = {
      fecha: form.fecha || null,
      tipo: tabActual,
      idPropiedad: form.idPropiedad || null,
      idPersona: form.idPersona || null,
      monto: Number(form.monto),
      moneda: form.moneda,
      medioPago: tabActual === 'Transferencia' ? "Transferencia Bancaria" : form.medioPago,
      estado: form.estado,
      conceptoIngreso: tabActual === 'Egreso' ? null : form.conceptoIngreso,
      conceptoEgreso: tabActual === 'Egreso' ? form.conceptoEgreso : null,
      requiereAutorizacion: tabActual === 'Egreso' && !!form.requiereAutorizacion,
      bancoDestino: tabActual === 'Transferencia' ? (form.bancoDestino || null) : null,
      cbuAlias: tabActual === 'Transferencia' ? (form.cbuAlias || null) : null,
      observaciones: form.observaciones || null
    };

    setGuardando(true);
    try {
      if (editando) await editarMovimiento(movimiento.idMovimiento, {
        ...payload,
        propiedad: payload.idPropiedad ? { idPropiedad: Number(payload.idPropiedad) } : null,
        persona: payload.idPersona ? { idPersona: Number(payload.idPersona) } : null,
      });
      else await crearMovimiento(payload);
      avisar(editando ? "Movimiento actualizado." : `Movimiento de ${tabActual} registrado correctamente.`);
      setForm(VACIO);
      if (onGuardado) onGuardado();
    } catch (err) {
      avisar(`No se pudo registrar el movimiento: ${err.response?.data?.error || err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="card animation-fade-in" style={{padding: 0, overflow: 'hidden'}}>
      
      {/* ======================= ENCABEZADO CON BOTÓN VOLVER ======================= */}
      <div className="card-header" style={{backgroundColor: 'var(--color-negro)', color: 'white', margin: 0, padding: '20px 30px'}}>
        <span className="card-title" style={{fontSize: '1.3rem', color: 'white'}}>
           <i className="fa-solid fa-money-bill-transfer"></i> {editando ? "Editar Movimiento Financiero" : "Carga de Movimiento Financiero"}
        </span>
        <div style={{display: 'flex', gap: '15px'}}>
           <button type="button" className="btn btn-outline" style={{backgroundColor: 'white', borderColor: 'transparent'}} onClick={onCancelar}>
              <i className="fa-solid fa-arrow-left"></i> Volver a Finanzas
           </button>
           <button type="button" className="btn btn-rojo" onClick={handleSubmit} disabled={guardando}>
              <i className="fa-solid fa-save"></i> {guardando ? "Guardando..." : (editando ? "Guardar cambios" : "Registrar Movimiento")}
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
                   {propiedades.map(p => <option key={p.idPropiedad} value={p.idPropiedad}>{p.titulo}</option>)}
                </select>
             </div>

             <div className="form-group">
                <label>Estado del Movimiento</label>
                <select name="estado" value={form.estado} onChange={handleChange}>
                   <option>Completado</option>
                   <option>Pendiente de Pago</option>
                   <option>Programado</option>
                </select>
             </div>
          </div>
        </div>

        {tabActual === 'Ingreso' && (
          <div className="tab-content active animation-fade-in" style={{padding: '25px', backgroundColor: '#fff', marginTop: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-flat)'}}>
            <h6 style={{color: '#2E7D32'}}><i className="fa-solid fa-user-check"></i> Origen del Dinero</h6>
            <div className="form-row">
              <div className="form-group" style={{flex: 2}}>
                 <label>Locatario / Pagador<span className="req" aria-hidden="true">*</span></label>
                 <select name="idPersona" value={form.idPersona} onChange={handleChange} aria-invalid={errores.idPersona ? "true" : undefined}>
                    <option value="">Seleccione Cliente...</option>
                    {personas.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
                 </select>
                 {errores.idPersona && <small className="campo-error" role="alert">{errores.idPersona}</small>}
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
              <InputG label="Monto Cobrado" name="monto" type="number" min="0" requerido error={errores.monto} valorActual={form.monto} onChange={handleChange} icon="fa-plus" />
              <div className="form-group"><label>Moneda</label><select name="moneda" value={form.moneda} onChange={handleChange}><OpcionesMoneda /></select></div>
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
                      <option value="">Sin proveedor registrado / Gasto general</option>
                      {personas.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
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
                <InputG label="Monto Pagado" name="monto" type="number" min="0" requerido error={errores.monto} valorActual={form.monto} onChange={handleChange} icon="fa-minus" />
                <div className="form-group"><label>Moneda</label><select name="moneda" value={form.moneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                <div className="form-group"><label>Medio de Pago</label><select name="medioPago" value={form.medioPago} onChange={handleChange}>{MEDIOS_PAGO.map(m=><option key={m}>{m}</option>)}</select></div>
             </div>
          </div>
        )}

        {tabActual === 'Transferencia' && (
          <div className="tab-content active animation-fade-in" style={{padding: '25px', backgroundColor: '#fff', marginTop: '15px', borderRadius: '12px', boxShadow: 'var(--sombra-flat)'}}>
            <h6 style={{color: '#1565C0'}}><i className="fa-solid fa-user-tie"></i> Propietario a Liquidar</h6>
            <div className="form-row">
              <div className="form-group" style={{flex: 2}}>
                 <label>Titular de la Cuenta<span className="req" aria-hidden="true">*</span></label>
                 <select name="idPersona" value={form.idPersona} onChange={handleChange} aria-invalid={errores.idPersona ? "true" : undefined}>
                    <option value="">Seleccione Propietario...</option>
                    {personas.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
                 </select>
                 {errores.idPersona && <small className="campo-error" role="alert">{errores.idPersona}</small>}
              </div>

            </div>

            <h6 style={{color: '#1565C0', marginTop: '20px'}}><i className="fa-solid fa-building-columns"></i> Datos Bancarios y Monto</h6>
            <div className="form-row" style={{backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px', border: '1px solid #90CAF9'}}>
               <InputG label="Monto a Transferir (Neto)" name="monto" type="number" min="0" requerido error={errores.monto} valorActual={form.monto} onChange={handleChange} icon="fa-paper-plane" />
               <div className="form-group"><label>Moneda</label><select name="moneda" value={form.moneda} onChange={handleChange}><OpcionesMoneda /></select></div>
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
                <i className="fa-solid fa-paperclip" style={{color: 'var(--color-rojo)'}}></i> Respaldo y observaciones
            </h6>
            <p style={{fontSize: '0.85rem', color: 'var(--color-gris-texto)', marginBottom: '15px'}}>
               {tabActual === 'Egreso' ? "Conservá la factura (AFIP A/B/C) o ticket del proveedor para la rendición al propietario y anotá su número en Observaciones." :
                "Conservá el comprobante y anotá su número en Observaciones. (La carga de archivos adjuntos todavía no se guarda desde este formulario.)"}
            </p>

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
