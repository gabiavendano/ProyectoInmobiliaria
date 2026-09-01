import { useState, useEffect } from "react";

// =========================================================================
// 1. COMPONENTES UI REUTILIZABLES (Afuera para evitar pérdida de foco)
// =========================================================================

const Botones = ({ label, options, name, valorActual, onChange }) => (
  <div className="form-group">
    <label>{label}</label>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange({ target: { name, value: opt, type: 'text' } })}
          className={`btn ${valorActual === opt ? 'btn-rojo' : 'btn-outline'}`} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem' }}>
          {opt}
        </button>
      ))}
    </div>
  </div>
);

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

const GridChecks = ({ title, arrayName, options, valoresActuales = [], onChangeCheck }) => (
  <div style={{marginBottom: '20px'}}>
    <h6 style={{color: 'var(--color-rojo)', marginBottom: '10px'}}>{title}</h6>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px solid var(--color-gris-borde)' }}>
      {options.map(opt => (
        <div className="checkbox-group" key={opt} style={{margin: 0}}>
          <input type="checkbox" checked={valoresActuales.includes(opt)} onChange={(e) => onChangeCheck(arrayName, opt, e.target.checked)} />
          <label style={{fontSize: '0.85rem'}}>{opt}</label>
        </div>
      ))}
    </div>
  </div>
);

const AccordionH = ({ id, title, icon, isOpen, onToggle }) => (
  <div onClick={() => onToggle(id)} style={{padding: '18px 25px', backgroundColor: isOpen ? '#FFF8F8' : '#F8FAFC', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: isOpen ? '2px solid var(--color-rojo)' : 'none', borderTopLeftRadius: '12px', borderTopRightRadius: '12px'}}>
    <span style={{fontWeight: 800, fontSize: '1.1rem', color: isOpen ? 'var(--color-rojo)' : 'var(--color-negro)'}}><i className={`fa-solid ${icon}`}></i> {title}</span>
    <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`} style={{color: 'var(--color-gris-texto)'}}></i>
  </div>
);

// =========================================================================
// 2. CONSTANTES Y DICCIONARIOS
// =========================================================================
const RELACIONES_COMERCIALES = ["Propietario", "Comprador", "Locatario", "Inversor", "Interesado", "Otro"];
const MEDIOS_CONTACTO = ["WhatsApp", "Llamada Telefónica", "Email", "Presencial en Oficina"];
const EXTRAS_BUSQUEDA = ["Cochera", "Jardín", "Pileta", "Balcón", "Terraza", "Quincho", "Ascensor", "Seguridad 24hs", "Amenities", "Apto mascotas", "Apto profesional"];
const FORMAS_PAGO = ["Contado Efvo", "Financiación", "Permuta", "Parte de pago", "Crédito hipotecario", "A definir"];
const ESTADOS_CRM = ["Prospecto", "Activo", "En búsqueda", "En negociación", "Cliente", "Inactivo", "No contactar"];
const FUENTES_CRM = ["Referido", "Web Propia", "Instagram", "Facebook", "WhatsApp", "Portal (ZonaProp, etc)", "Oficina", "Cartel", "Otro"];
const NIVELES_BCRA = ["Normal (1)", "Con Seguimiento Especial (2)", "Con Problemas (3)", "Con Alto Riesgo (4)", "Irrecuperable (5)", "Desconocido"];

// =========================================================================
// 3. ESTADO INICIAL
// =========================================================================
const VACIO = {
  // 1. Identificación
  tipoCliente: "Persona humana",
  nombre: "", apellido: "", dni: "", cuitCuil: "", fechaNacimiento: "", nacionalidad: "Argentina",
  razonSocial: "", nombreComercial: "", cuitJuridica: "", tipoSocietario: "", actividad: "",

  // 2. Contacto & Preferencias
  telPrincipal: "", telSecundario: "", whatsapp: "", emailPrincipal: "", emailSecundario: "",
  medioContactoPref: "WhatsApp", horarioContactoPref: "", aceptaComunicacionesComerciales: true,

  // 3. Domicilio
  calle: "", numero: "", piso: "", departamento: "", localidad: "Villa Carlos Paz", provincia: "Córdoba", pais: "Argentina", codigoPostal: "5152",

  // 4. Comercial y Financiero (BCRA)
  relaciones: [], situacionBcra: "Desconocido", estaInhibido: false,

  // 5. Búsqueda Compra (Condicional)
  compTipoProp: "", compLocalidades: "Villa Carlos Paz", compBarrios: "", compPresupuestoMin: "", compPresupuestoMax: "", compMoneda: "USD",
  compDorms: "", compBanos: "", compAmbientes: "", compSupMin: "", compSupMax: "", compTerrenoMin: "", 
  compEstadoProp: "Indiferente", compAntiguedadMax: "", compExtras: [], compFormasPago: [], compPrioridades: "",

  // 6. Búsqueda Alquilar (Condicional)
  alqTipoProp: "", alqZona: "", alqPresupuesto: "", alqMoneda: "ARS", alqAmbientes: "", alqDorms: "", alqBanos: "",
  alqCochera: false, alqAmoblado: false, alqMascotas: true, alqFechaIngreso: "", alqPlazo: "2 Años", alqImprescindibles: "", alqDeseables: "",

  // 7. Perfil Cliente (CRM) y Seguimiento
  crmEstado: "Prospecto", crmPrioridad: "Media", crmAgente: "", crmFuente: "WhatsApp",
  segFechaPrimerContacto: new Date().toISOString().split('T')[0], 
  segFechaUltimo: "", 
  segFechaProximo: "", 
  segTareasPendientes: "",
  historial: [] 
};

function PersonaForm({ clienteEditar, onGuardado, onCancelar }) {
  const [form, setForm] = useState(VACIO);
  const [nuevaNota, setNuevaNota] = useState("");

  const [secciones, setSecciones] = useState({
    identificacion: true, contacto: false, perfil: false,
    compra: false, alquiler: false, crm: false
  });

  const toggleSec = (sec) => setSecciones({ ...secciones, [sec]: !secciones[sec] });

  // Lógica principal de cambios, incluyendo la alerta de inhibición BCRA
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    
    let updates = { [name]: val };

    // Regla de Negocio: BCRA >= 3 implica cliente Inhibido
    if (name === "situacionBcra") {
      const nivelStr = val.match(/\d+/);
      const nivel = nivelStr ? parseInt(nivelStr[0]) : 0;
      updates.estaInhibido = nivel >= 3;
    }

    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleArrayCheck = (arrayName, itemName, checked) => {
    setForm(prev => {
      const arr = prev[arrayName] || [];
      return { ...prev, [arrayName]: checked ? [...arr, itemName] : arr.filter(i => i !== itemName) };
    });
  };

  // Gestiona el array de "Relación" (Abre/Cierra secciones automáticamente)
  const handleRelacionChange = (relacion, checked) => {
    setForm(prev => {
      const arr = prev.relaciones || [];
      const nuevasRel = checked ? [...arr, relacion] : arr.filter(r => r !== relacion);
      
      if(checked && relacion === "Comprador") setSecciones(s => ({...s, compra: true}));
      if(checked && relacion === "Locatario") setSecciones(s => ({...s, alquiler: true}));

      return { ...prev, relaciones: nuevasRel };
    });
  };

  const agregarNotaHistorial = () => {
    if (!nuevaNota.trim()) return;
    const fechaActual = new Date().toLocaleDateString('es-AR') + " " + new Date().toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
    setForm(prev => ({
      ...prev,
      historial: [{ fecha: fechaActual, texto: nuevaNota }, ...prev.historial]
    }));
    setNuevaNota("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if(form.estaInhibido) {
      const confirmar = window.confirm("ATENCIÓN: Este cliente tiene nivel BCRA 3 o superior y está marcado como INHIBIDO. ¿Está seguro que desea guardarlo en la base de datos?");
      if(!confirmar) return;
    }
    console.log("Persona a BD:", form);
    alert("Ficha de persona guardada exitosamente.");
    if(onGuardado) onGuardado();
  };

  return (
    <div className="card animation-fade-in" style={{padding: 0, overflow: 'hidden'}}>
      
      <div className="card-header" style={{backgroundColor: form.estaInhibido ? 'var(--color-rojo)' : 'var(--color-negro)', color: 'white', margin: 0, padding: '20px 30px'}}>
        <span className="card-title" style={{fontSize: '1.3rem', color: 'white'}}>
          <i className="fa-solid fa-address-card"></i> Alta Detallada de Persona / Contacto
          {form.estaInhibido && " (INHIBIDO)"}
        </span>
        <button className="btn btn-blanco" onClick={handleSubmit} style={{color: 'var(--color-negro)'}}><i className="fa-solid fa-save"></i> Guardar Ficha</button>
      </div>

      <div style={{padding: '30px', backgroundColor: 'var(--color-gris-fondo)'}}>
        <form onSubmit={handleSubmit}>

          {/* =========================================================
              SEC 1: IDENTIFICACIÓN Y DOMICILIO
          ========================================================= */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="identificacion" title="1. Identificación y Domicilio" icon="fa-user" isOpen={secciones.identificacion} onToggle={toggleSec} />
             {secciones.identificacion && (
               <div style={{padding: '25px'}}>
                  <Botones label="Tipo de Cliente" name="tipoCliente" options={['Persona humana', 'Persona jurídica']} valorActual={form.tipoCliente} onChange={handleChange} />
                  
                  {form.tipoCliente === "Persona humana" ? (
                     <div className="form-row animation-fade-in" style={{marginTop: '20px'}}>
                        <InputG label="Nombre/s" name="nombre" valorActual={form.nombre} onChange={handleChange} />
                        <InputG label="Apellido/s" name="apellido" valorActual={form.apellido} onChange={handleChange} />
                        <InputG label="DNI" name="dni" type="number" valorActual={form.dni} onChange={handleChange} />
                        <InputG label="CUIT / CUIL" name="cuitCuil" valorActual={form.cuitCuil} onChange={handleChange} />
                        <InputG label="Fecha Nacimiento" name="fechaNacimiento" type="date" valorActual={form.fechaNacimiento} onChange={handleChange} />
                     </div>
                  ) : (
                     <div className="form-row animation-fade-in" style={{marginTop: '20px', backgroundColor: '#F4F6F8', padding: '15px', borderRadius: '8px', border: '1px solid #ccc'}}>
                        <InputG label="Razón Social" name="razonSocial" col={2} valorActual={form.razonSocial} onChange={handleChange} />
                        <InputG label="Nombre Comercial" name="nombreComercial" col={2} valorActual={form.nombreComercial} onChange={handleChange} />
                        <InputG label="CUIT" name="cuitJuridica" type="number" valorActual={form.cuitJuridica} onChange={handleChange} />
                        <InputG label="Tipo Societario" name="tipoSocietario" ph="Ej: S.A., S.R.L." valorActual={form.tipoSocietario} onChange={handleChange} />
                        <InputG label="Actividad / Rubro" name="actividad" col={2} valorActual={form.actividad} onChange={handleChange} />
                     </div>
                  )}

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}><i className="fa-solid fa-map-pin"></i> Domicilio (Base)</h6>
                  <div className="form-row">
                    <InputG label="Calle" name="calle" col={2} valorActual={form.calle} onChange={handleChange} />
                    <InputG label="Número" name="numero" valorActual={form.numero} onChange={handleChange} />
                    <InputG label="Piso/Dpto" name="departamento" valorActual={form.departamento} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Localidad" name="localidad" valorActual={form.localidad} onChange={handleChange} />
                    <InputG label="Provincia" name="provincia" valorActual={form.provincia} onChange={handleChange} />
                    <InputG label="País" name="pais" valorActual={form.pais} onChange={handleChange} />
                    <InputG label="Cód. Postal" name="codigoPostal" valorActual={form.codigoPostal} onChange={handleChange} />
                  </div>
               </div>
             )}
          </div>

          {/* =========================================================
              SEC 2: CONTACTO Y PREFERENCIAS
          ========================================================= */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="contacto" title="2. Datos de Contacto y Comunicación" icon="fa-address-book" isOpen={secciones.contacto} onToggle={toggleSec} />
             {secciones.contacto && (
               <div style={{padding: '25px'}}>
                  <div className="form-row">
                     <InputG label="Teléfono / Móvil Ppal." name="telPrincipal" type="tel" icon="fa-phone" valorActual={form.telPrincipal} onChange={handleChange} />
                     <InputG label="WhatsApp" name="whatsapp" type="tel" icon="fa-whatsapp" valorActual={form.whatsapp} onChange={handleChange} />
                     <InputG label="Teléfono Secundario" name="telSecundario" type="tel" valorActual={form.telSecundario} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                     <InputG label="Email Principal" name="emailPrincipal" type="email" icon="fa-envelope" valorActual={form.emailPrincipal} onChange={handleChange} />
                     <InputG label="Email Secundario" name="emailSecundario" type="email" valorActual={form.emailSecundario} onChange={handleChange} />
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}>Preferencias</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px'}}>
                     <div className="form-group"><label>Medio de contacto ideal</label><select name="medioContactoPref" value={form.medioContactoPref} onChange={handleChange}>{MEDIOS_CONTACTO.map(m => <option key={m}>{m}</option>)}</select></div>
                     <InputG label="Horario Preferido (Ej: 14 a 18hs)" name="horarioContactoPref" valorActual={form.horarioContactoPref} onChange={handleChange} />
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="aceptaComunicacionesComerciales" checked={form.aceptaComunicacionesComerciales} onChange={handleChange}/><label style={{fontWeight: 'bold', color: 'var(--color-rojo)'}}>Acepta Publicidad Inmobiliaria (Mailing)</label></div></div>
                  </div>
               </div>
             )}
          </div>

          {/* =========================================================
              SEC 3: PERFIL COMERCIAL Y BCRA (Con Alerta de Inhibición)
          ========================================================= */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="perfil" title="3. Relación Inmobiliaria y Situación Crediticia (BCRA)" icon="fa-handshake" isOpen={secciones.perfil} onToggle={toggleSec} />
             {secciones.perfil && (
               <div style={{padding: '25px'}}>
                  <div style={{backgroundColor: '#FFF8F8', padding: '20px', borderRadius: '8px', border: '1px solid #FFCDD2', marginBottom: '25px'}}>
                     <h6 style={{color: 'var(--color-rojo)', marginBottom: '15px'}}>¿Qué relación/es tiene esta persona con la Inmobiliaria? (Se abrirán las fichas correspondientes)</h6>
                     <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        {RELACIONES_COMERCIALES.map(rel => (
                           <div className="checkbox-group" key={rel} style={{margin: 0, backgroundColor: 'white', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc'}}>
                              <input type="checkbox" id={`rel_${rel}`} checked={form.relaciones.includes(rel)} onChange={(e) => handleRelacionChange(rel, e.target.checked)} style={{transform: 'scale(1.2)'}} />
                              <label htmlFor={`rel_${rel}`} style={{fontWeight: 'bold'}}>{rel}</label>
                           </div>
                        ))}
                     </div>
                  </div>

                  <h6 style={{color: 'var(--color-negro)', borderBottom: '1px solid #eee', paddingBottom: '5px'}}>Análisis Financiero</h6>
                  <div className="form-row" style={{alignItems: 'flex-end'}}>
                     <div className="form-group" style={{flex: 1}}>
                        <label>Estado BCRA Declarado/Revisado (Niveles 1 a 5)</label>
                        <select name="situacionBcra" value={form.situacionBcra} onChange={handleChange} style={{borderColor: form.estaInhibido ? 'var(--color-rojo)' : '#ccc', fontWeight: form.estaInhibido ? 'bold' : 'normal', color: form.estaInhibido ? 'var(--color-rojo)' : 'black'}}>
                           {NIVELES_BCRA.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                        </select>
                     </div>
                     <div className="form-group" style={{flex: 1}}>
                        <a href="https://www.bcra.gob.ar/situacion-crediticia/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{display: 'flex', alignItems: 'center', gap: '10px', height: '42px', justifyContent: 'center'}}>
                           <i className="fa-solid fa-building-columns"></i> Consultar CUIT/CUIL en Banco Central
                        </a>
                     </div>
                  </div>

                  {/* ALERTA MASIVA DE INHIBICIÓN */}
                  {form.estaInhibido && (
                     <div className="animation-fade-in" style={{backgroundColor: '#FFEBEE', color: '#C62828', padding: '20px', borderRadius: '8px', border: '2px solid #E53935', marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 10px rgba(229, 57, 53, 0.2)'}}>
                        <i className="fa-solid fa-triangle-exclamation" style={{fontSize: '2.5rem'}}></i>
                        <div>
                           <span style={{display: 'block', fontSize: '1.2rem', fontWeight: 900}}>¡ATENCIÓN! PERSONA INHIBIDA / CON RIESGO CREDITICIO</span>
                           <span style={{fontSize: '0.95rem'}}>El nivel de BCRA de este cliente es 3 o superior. Por políticas de seguridad, se recomienda <strong>NO AVANZAR</strong> con firma de contratos, alquileres o venta con financiación propia sin autorización de gerencia.</span>
                        </div>
                     </div>
                  )}

               </div>
             )}
          </div>

          {/* =========================================================
              SEC 4: PERFIL COMPRADOR (Condicional)
          ========================================================= */}
          {form.relaciones.includes("Comprador") && (
             <div className="accordion-section animation-fade-in" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', border: '2px solid #81C784', boxShadow: 'var(--sombra-flat)'}}>
                <AccordionH id="compra" title="4. 📍 Búsqueda Activa: COMPRA" icon="fa-house-circle-check" isOpen={secciones.compra} onToggle={toggleSec} />
                {secciones.compra && (
                  <div style={{padding: '25px', borderTop: '1px solid #eee'}}>
                     <div className="form-row">
                        <InputG label="Tipo de Propiedad Buscada" name="compTipoProp" ph="Ej: Casa, Lote, Duplex..." valorActual={form.compTipoProp} onChange={handleChange} col={2} />
                        <InputG label="Localidades Interés" name="compLocalidades" valorActual={form.compLocalidades} onChange={handleChange} />
                        <InputG label="Zonas / Barrios" name="compBarrios" valorActual={form.compBarrios} onChange={handleChange} />
                     </div>
                     <div className="form-row" style={{backgroundColor: '#E8F5E9', padding: '15px', borderRadius: '8px'}}>
                        <InputG label="Presupuesto Mín." name="compPresupuestoMin" type="number" valorActual={form.compPresupuestoMin} onChange={handleChange} />
                        <InputG label="Presupuesto Máx." name="compPresupuestoMax" type="number" valorActual={form.compPresupuestoMax} onChange={handleChange} />
                        <div className="form-group"><label>Moneda</label><select name="compMoneda" value={form.compMoneda} onChange={handleChange}><option>USD</option><option>ARS</option></select></div>
                        <div className="form-group"><label>Estado Aceptable</label><select name="compEstadoProp" value={form.compEstadoProp} onChange={handleChange}><option>Indiferente</option><option>A Estrenar</option><option>Excelente/Muy Bueno</option><option>A Refaccionar (Inversión)</option></select></div>
                     </div>
                     <div className="form-row" style={{marginTop: '15px'}}>
                        <InputG label="Ambientes" name="compAmbientes" type="number" valorActual={form.compAmbientes} onChange={handleChange} />
                        <InputG label="Dormitorios Mín." name="compDorms" type="number" valorActual={form.compDorms} onChange={handleChange} />
                        <InputG label="Baños Mín." name="compBanos" type="number" valorActual={form.compBanos} onChange={handleChange} />
                        <InputG label="Sup. Mínima (m2)" name="compSupMin" type="number" valorActual={form.compSupMin} onChange={handleChange} />
                     </div>
                     
                     <GridChecks title="Filtros y Comodidades Requeridas" arrayName="compExtras" options={EXTRAS_BUSQUEDA} valoresActuales={form.compExtras} onChangeCheck={handleArrayCheck} />
                     
                     <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Forma de Pago Dispuesta</h6>
                     <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        {FORMAS_PAGO.map(fp => (
                           <div className="checkbox-group" key={fp} style={{margin: 0}}><input type="checkbox" id={`fp_${fp}`} checked={form.compFormasPago.includes(fp)} onChange={(e) => handleArrayCheck("compFormasPago", fp, e.target.checked)} /><label htmlFor={`fp_${fp}`}>{fp}</label></div>
                        ))}
                     </div>

                     <div className="form-group"><label>Prioridades e Imprescindibles (Notas)</label><textarea name="compPrioridades" value={form.compPrioridades} onChange={handleChange} rows="2" placeholder="Ej: Es imprescindible que tenga patio para los perros..."></textarea></div>
                  </div>
                )}
             </div>
          )}

          {/* =========================================================
              SEC 5: PERFIL LOCATARIO (Alquiler) (Condicional)
          ========================================================= */}
          {form.relaciones.includes("Locatario") && (
             <div className="accordion-section animation-fade-in" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', border: '2px solid #64B5F6', boxShadow: 'var(--sombra-flat)'}}>
                <AccordionH id="alquiler" title="5. 📍 Búsqueda Activa: ALQUILER" icon="fa-key" isOpen={secciones.alquiler} onToggle={toggleSec} />
                {secciones.alquiler && (
                  <div style={{padding: '25px', borderTop: '1px solid #eee'}}>
                     <div className="form-row">
                        <InputG label="Tipo de Inmueble" name="alqTipoProp" ph="Departamento, Casa..." valorActual={form.alqTipoProp} onChange={handleChange} />
                        <InputG label="Zonas de Interés" name="alqZona" valorActual={form.alqZona} onChange={handleChange} />
                        <InputG label="Presupuesto Tope ($)" name="alqPresupuesto" type="number" valorActual={form.alqPresupuesto} onChange={handleChange} />
                        <div className="form-group"><label>Plazo / Contrato</label><select name="alqPlazo" value={form.alqPlazo} onChange={handleChange}><option>2 Años (Ley)</option><option>Comercial (3 Años)</option><option>Temporario (Días/Meses)</option></select></div>
                     </div>
                     <div className="form-row" style={{backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px'}}>
                        <InputG label="Ambientes" name="alqAmbientes" type="number" valorActual={form.alqAmbientes} onChange={handleChange} />
                        <InputG label="Dormitorios" name="alqDorms" type="number" valorActual={form.alqDorms} onChange={handleChange} />
                        <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="alqCochera" checked={form.alqCochera} onChange={handleChange}/><label>Requiere Cochera</label></div></div>
                        <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="alqAmoblado" checked={form.alqAmoblado} onChange={handleChange}/><label>Busca Amoblado</label></div></div>
                        <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="alqMascotas" checked={form.alqMascotas} onChange={handleChange}/><label>Tiene Mascotas</label></div></div>
                     </div>
                     <div className="form-row" style={{marginTop: '15px'}}>
                        <div className="form-group" style={{flex: 1}}><label>Características Imprescindibles</label><textarea name="alqImprescindibles" value={form.alqImprescindibles} onChange={handleChange} rows="2"></textarea></div>
                        <div className="form-group" style={{flex: 1}}><label>Características Deseables</label><textarea name="alqDeseables" value={form.alqDeseables} onChange={handleChange} rows="2"></textarea></div>
                     </div>
                  </div>
                )}
             </div>
          )}

          {/* =========================================================
              SEC 6: CRM, SEGUIMIENTO E HISTORIAL
          ========================================================= */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '30px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="crm" title="6. Gestión CRM, Status y Seguimiento" icon="fa-chart-line" isOpen={secciones.crm} onToggle={toggleSec} />
             {secciones.crm && (
               <div style={{padding: '25px'}}>
                  
                  <h6 style={{color: 'var(--color-negro)'}}>Status de la Persona en el Embudo</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px solid #ccc'}}>
                     <div className="form-group" style={{flex: 1}}>
                         <label>Estado CRM</label>
                         <select name="crmEstado" value={form.crmEstado} onChange={handleChange}>{ESTADOS_CRM.map(e=><option key={e}>{e}</option>)}</select>
                     </div>
                     <div style={{flex: 1}}>
                         <Botones label="Prioridad" name="crmPrioridad" options={['Baja', 'Media', 'Alta']} valorActual={form.crmPrioridad} onChange={handleChange} />
                     </div>
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Fechas y Tareas de Seguimiento</h6>
                  <div className="form-row">
                     <InputG label="Agente Asignado Responsable" name="crmAgente" valorActual={form.crmAgente} onChange={handleChange} col={2} />
                     <div className="form-group" style={{flex: 2}}><label>Fuente / Origen</label><select name="crmFuente" value={form.crmFuente} onChange={handleChange}>{FUENTES_CRM.map(f=><option key={f}>{f}</option>)}</select></div>
                  </div>
                  <div className="form-row">
                     <InputG label="Fecha 1° Contacto" name="segFechaPrimerContacto" type="date" valorActual={form.segFechaPrimerContacto} onChange={handleChange} />
                     <InputG label="Fecha Último Contacto" name="segFechaUltimo" type="date" valorActual={form.segFechaUltimo} onChange={handleChange} />
                     <InputG label="Fecha Próx. Contacto" name="segFechaProximo" type="date" valorActual={form.segFechaProximo} onChange={handleChange} />
                  </div>

                  <div className="form-group" style={{marginTop: '10px'}}>
                     <label><i className="fa-regular fa-calendar-check" style={{color: 'var(--color-rojo)'}}></i> Tareas Pendientes</label>
                     <textarea name="segTareasPendientes" value={form.segTareasPendientes} onChange={handleChange} rows="2" placeholder="Ej: Llamar el lunes para confirmar visita a la propiedad ID 142..." style={{backgroundColor: '#FFF3F3', borderColor: '#FFCDD2'}}></textarea>
                  </div>

                  {/* HISTORIAL CRM INTERACTIVO */}
                  <h6 style={{color: 'var(--color-negro)', marginTop: '25px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}><i className="fa-solid fa-list-check" style={{color: 'var(--color-rojo)'}}></i> Historial de Interacciones (Timeline)</h6>
                  
                  <div style={{display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px'}}>
                     <div className="form-group" style={{flex: 1, margin: 0}}>
                        <textarea rows="2" value={nuevaNota} onChange={(e) => setNuevaNota(e.target.value)} placeholder="Ej: Se comunicó por WhatsApp consultando por casas en el centro. Rechazó opciones por presupuesto..." style={{borderColor: 'var(--color-rojo)'}}></textarea>
                     </div>
                     <button type="button" className="btn btn-rojo" onClick={agregarNotaHistorial} style={{height: '65px'}}><i className="fa-solid fa-plus"></i> Agregar Nota</button>
                  </div>

                  <div style={{backgroundColor: '#FFF', border: '1px solid var(--color-gris-borde)', borderRadius: '8px', padding: '15px', maxHeight: '250px', overflowY: 'auto'}}>
                     {form.historial.length === 0 ? (
                        <p style={{color: '#999', fontStyle: 'italic', margin: 0, textAlign: 'center'}}>No hay notas en el historial.</p>
                     ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                           {form.historial.map((nota, idx) => (
                              <div key={idx} style={{backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '6px', borderLeft: '4px solid var(--color-rojo)'}}>
                                 <span style={{fontSize: '0.8rem', color: '#666', fontWeight: 'bold'}}>{nota.fecha}</span>
                                 <p style={{margin: '5px 0 0 0', fontSize: '0.95rem'}}>{nota.texto}</p>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>

               </div>
             )}
          </div>

        </form>
      </div>
    </div>
  );
}

export default PersonaForm;