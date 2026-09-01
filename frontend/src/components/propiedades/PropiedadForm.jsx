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

const InputG = ({ label, name, type = "text", ph = "", col = 1, valorActual, onChange, list }) => (
  <div className="form-group" style={{ flex: col }}>
    <label>{label}</label>
    <input type={type} name={name} value={valorActual || ""} onChange={onChange} placeholder={ph} list={list} />
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
const SUBTIPOS_INMUEBLE = ["- Estándar -", "Dúplex", "Tríplex", "PH", "Loft", "Semipiso", "Piso Completo", "Chalet", "Cabaña", "Casa Quinta", "Nave Industrial"];
const TIPOS_USO = ["Residencial", "Comercial", "Profesional", "Industrial", "Logístico", "Rural", "Turístico", "Mixto", "Otro"];
const TIPOS_INTERNET = ["Fibra Óptica", "Cable / ADSL", "Por Aire (Antena)", "Satelital", "Red Celular"];
const ESTADOS_CONSERVACION = ["A estrenar", "Excelente", "Muy bueno", "Bueno", "Regular", "A reciclar", "A refaccionar", "A demoler", "En construcción", "Sin terminar"];
const TIPOS_CARTEL = ["Balcón", "Tierra", "Marquesina", "Pegatina", "Lona Frontal", "Otro"];

const CHK_CARACT_UBICACION = ["Frente a avenida", "Frente a calle", "Frente a ruta", "Esquina", "Interno", "Contrafrente", "Primera línea", "Segunda línea", "Cul-de-sac", "Acceso por pasaje"];
const CHK_TERRENO_CARACT = ["Plano", "Inclinado", "Pendiente ascendente", "Pendiente descendente", "Quebrado", "Terraza natural", "Nivel de calle", "Bajo nivel", "Sobre nivel"];
const CHK_AMBIENTES_ESP = ["Playroom", "Sala de juegos", "Estudio", "Biblioteca", "Gimnasio", "Cine", "Taller", "Vestidor", "Altillo", "Sótano", "Bodega", "Baulera"];
const CHK_COCINA = ["Independiente", "Integrada", "Comedor", "Industrial", "Isla", "Barra", "Muebles bajo mesada", "Alacenas", "Anafe", "Horno eléctrico", "Horno a gas", "Campana", "Lavavajillas", "Despensa"];
const CHK_EXTERIORES = ["Patio", "Jardín", "Patio interno", "Terraza", "Balcón", "Galería", "Quincho", "Parrilla", "Horno de barro", "Fogonero", "Solarium", "Deck", "Huerta"];
const CHK_ABERTURAS = ["Madera", "Aluminio", "PVC", "Hierro", "DVH", "Vidrio templado", "Persianas", "Blackout", "Mosquiteros", "Automatización"];
const CHK_PISOS = ["Cerámico", "Porcelanato", "Madera", "Parquet", "Flotante", "Vinílico", "Cemento alisado", "Mármol", "Microcemento"];
const CHK_AGUA_GAS = ["Agua corriente", "Agua de pozo", "Cisterna", "Bomba", "Termotanque", "Calefón", "Gas natural", "Gas envasado", "Zeppelín"];
const CHK_DESAGUES = ["Cloacas", "Pozo negro", "Cámara séptica", "Biodigestor", "Desagüe pluvial"];
const CHK_SEGURIDAD = ["Alarma", "Alarma monitoreada", "Cámaras", "Portero eléctrico", "Cerco eléctrico", "Rejas", "Puerta blindada", "Seguridad privada", "Cerradura inteligente"];
const CHK_DESTACADAS = ["Vista al lago", "Vista al río", "Vista a la montaña", "Frente al agua", "Bosque", "Excelente luminosidad", "Muy silencioso", "Apto mascotas", "Apto profesional", "Apto comercial"];
const CHK_ACCESIBILIDAD = ["Acceso sin escalones", "Ascensor", "Ascensor apto silla ruedas", "Rampas", "Puertas amplias", "Baño adaptado", "Cochera accesible"];
const CHK_RIESGOS = ["Zona inundable", "Riesgo hídrico", "Deslizamiento", "Zona sísmica", "Riesgo ambiental", "Arroyo", "Barranca"];

// =========================================================================
// 3. ESTADO INICIAL BASE DE DATOS
// =========================================================================
const VACIO = {
  idPropietarioActual: "", esComplejo: false, cantUnidades: 0,
  
  estadoFicha: "Activa", observacionesGenerales: "",
  tipoInmueble: "Casa", subtipo: "", usoActual: "", usoPotencial: "",
  tipoOperacion: "Venta", estadoPropiedad: "Disponible", 
  precio: "", moneda: "USD", // <- Campos de precio asegurados
  
  provincia: "Córdoba", departamentoProv: "Punilla", localidad: "Villa Carlos Paz", 
  barrio: "", subBarrio: "", calle: "", numero: "", pisoDpto: "", torre: "", bloque: "", casaUnidad: "", codigoPostal: "5152",
  dirExactaPublica: true, ubicacionAproxPublica: true, linkGoogleMaps: "",

  catNomenclatura: "", catDepto: "", catPedania: "", catCircunscripcion: "", catSeccion: "", catManzana: "",
  catParcela: "", catSubparcela: "", catLote: "", catSubLote: "", catPartida: "", catCuentaTributaria: "", catMatricula: "",
  catFolio: "", catFinca: "", uf: "", uc: "",
  supTitulo: "", supCatastro: "", supPlano: "", supMensura: "", supPH: "", supRelevada: "", difSuperficies: false, obsSuperficies: "",

  terSup: "", terFrente: "", terFondo: "", terFrente2: "", terFondo2: "", terSupEsquina: "", terForma: "", terOrientacion: "Norte",
  terLimFrente: "", terLimFondo: "", terLimDerecho: "", terLimIzquierdo: "",

  supCubierta: "", supSemicubierta: "", supDescubierta: "", supTotal: "", supConstruida: "", supHabitable: "", supComunes: "", supPropia: "",
  anioConstruccion: "", antiguedad: "", anioRemodelacion: "", anioAmpliacion: "", estadoConservacion: "Excelente",
  
  cantAmbientes: 0, cantPlantas: 1, cantDormitorios: 0, cantSuites: 0, cantBanos: 0, cantToilettes: 0, cantCocinas: 1, cantLivings: 1, cantComedores: 1, cantCocheras: 0,

  caractUbicacion: [], caractTerreno: [], ambientesEsp: [], caractCocina: [], caractExteriores: [],
  caractAberturas: [], caractPisos: [], caractAguaGas: [], caractDesagues: [], caractSeguridad: [], caractDestacadas: [], caractAccesibilidad: [], caractRiesgos: [],

  tienePileta: false, piletaTipo: "", piletaMedidas: "", piletaClimatizada: false,
  tieneInternet: false, internetTipo: "", internetProveedor: "",
  tieneClimatizacion: false, climatizacionTipo: "",
  
  esParteDe: "Ninguno", 
  ediCantPisos: "", ediCantUnidades: "", ediExpensas: "", ediAmenities: "",
  couNombre: "", couLote: "", couExpensas: "", couAmenities: "",

  legDominio: "Dominio", legRestricciones: "", legMedidasCautelares: "", legLitigios: "",
  ctaEpec: "", ctaGas: "", ctaAgua: "", ctaMuni: "",
  deudaInmobiliario: "", deudaMuni: "", deudaExpensas: "", libreDeudaDisponible: false, servidumbres: "",

  ocpEstado: "Desocupado", ocpFechaVencimiento: "", ocpMonto: "", ocpMoneda: "ARS", ocpGarantia: "", ocpSeVendeConContrato: false,
  sitConstruccionRegistrada: "Registrada", sitFinalObra: false,
  esRural: false, rurHectareas: "", rurAptitud: "", rurMejoras: "",

  descGral: "", descConst: "", descUbicacion: "", obsTecnicas: "", obsLegales: "", obsInternas: "",
  estadoVerificacion: "En revisión", fuenteVerificacion: "Declaración",

  comisionPactada: "", tieneExclusividad: false, fechaVencimientoExclusividad: "",
  ubicacionLlaves: "", tieneCartel: false, tipoCartel: "Balcón", fechaColocacionCartel: ""
};

function PropiedadForm({ propiedadEditar, onGuardado, onCancelar }) {
  const [form, setForm] = useState(VACIO);
  const [propietarios, setPropietarios] = useState([]);
  
  const [unidades, setUnidades] = useState([]);
  const [unidadEditando, setUnidadEditando] = useState(null);

  const [secciones, setSecciones] = useState({
    identificacion: true, ubicacion: false, catastro: false, terreno: false, construccion: false,
    ambientes: false, instalaciones: false, extras: false, legal: false, rural: false, descripcion: false, 
    comercial: false, multimedia: false
  });

  const toggleSec = (sec) => setSecciones({ ...secciones, [sec]: !secciones[sec] });

  useEffect(() => {
    setPropietarios([
      { idPersona: 1, nombreCompleto: "María González (DNI: 27334445558)" },
      { idPersona: 2, nombreCompleto: "Inversiones Vallegrande S.A." }
    ]);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setForm(prev => ({ ...prev, [name]: val }));

    if (name === "cantUnidades") {
      const cant = parseInt(value) || 0;
      setUnidades(Array.from({ length: cant }, (_, i) => ({ idTemp: i+1, titulo: `Unidad ${i+1}`, tipoInmueble: "Departamento", precio: "", cantAmbientes: 1 })));
    }
    if (name === "esComplejo" && !checked) { setForm(prev => ({...prev, cantUnidades: 0})); setUnidades([]); }
    
    if (name === "supCatastro" || name === "supRelevada") {
      setForm(prev => ({ ...prev, difSuperficies: prev.supCatastro !== prev.supRelevada && prev.supCatastro !== "" && prev.supRelevada !== "" }));
    }

    if (name === "tieneExclusividad" && !checked) { setForm(prev => ({...prev, fechaVencimientoExclusividad: ""})); }
    if (name === "tieneCartel" && !checked) { setForm(prev => ({...prev, fechaColocacionCartel: "", tipoCartel: "Balcón"})); }
  };

  const handleArrayCheck = (arrayName, itemName, checked) => {
    setForm(prev => {
      const arr = prev[arrayName] || [];
      return { ...prev, [arrayName]: checked ? [...arr, itemName] : arr.filter(i => i !== itemName) };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Datos a BD:", form, "Unidades:", unidades);
    alert("Ficha de propiedad guardada exitosamente.");
    if(onGuardado) onGuardado();
  };

  return (
    <div className="card animation-fade-in" style={{padding: 0, overflow: 'hidden'}}>
      
      {/* DATALIST PARA AUTOCOMPLETADO DE BARRIOS */}
      <datalist id="listaBarrios">
         <option value="Centro" />
         <option value="Villa Domínguez" />
         <option value="Santa Rita" />
         <option value="Costa Azul" />
         <option value="Villa del Lago" />
         <option value="Playas de Oro" />
         <option value="San Ignacio" />
         <option value="La Quinta" />
         <option value="Los Manantiales" />
         <option value="El Fantasio" />
         <option value="Sol y Lago" />
      </datalist>

      <div className="card-header" style={{backgroundColor: 'var(--color-negro)', color: 'white', margin: 0, padding: '20px 30px'}}>
        <span className="card-title" style={{fontSize: '1.3rem', color: 'white'}}><i className="fa-solid fa-building-circle-check"></i> Alta Detallada de Ficha Inmobiliaria</span>
        <button className="btn btn-rojo" onClick={handleSubmit}><i className="fa-solid fa-save"></i> Guardar Ficha</button>
      </div>

      <div style={{padding: '30px', backgroundColor: 'var(--color-gris-fondo)'}}>
        
        {/* COMPLEJOS */}
        <div style={{backgroundColor: '#FFF', padding: '20px', borderRadius: '12px', border: form.esComplejo ? '2px solid var(--color-rojo)' : '1px solid var(--color-gris-borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', boxShadow: 'var(--sombra-flat)'}}>
           <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
              <div style={{width: '45px', height: '45px', backgroundColor: form.esComplejo ? 'var(--color-rojo)' : '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: form.esComplejo ? 'white' : '#999', fontSize: '1.2rem'}}><i className="fa-solid fa-hotel"></i></div>
              <div><h4 style={{margin: 0}}>¿Es un Complejo o Emprendimiento?</h4><p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-gris-texto)'}}>Habilita la carga múltiple de unidades (Deptos, Cabañas).</p></div>
           </div>
           <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
              <div className="checkbox-group"><input type="checkbox" name="esComplejo" checked={form.esComplejo} onChange={handleChange} style={{transform: 'scale(1.5)'}} /><label style={{fontWeight: 'bold'}}>Activar Complejo</label></div>
              {form.esComplejo && <div className="animation-fade-in"><input type="number" name="cantUnidades" value={form.cantUnidades} onChange={handleChange} min="1" placeholder="N° Unidades" style={{padding: '10px', borderRadius: '8px', border: '1px solid var(--color-rojo)', width: '120px'}}/></div>}
           </div>
        </div>

        {form.esComplejo && unidades.length > 0 && (
          <div className="animation-fade-in" style={{marginBottom: '30px', backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px dashed var(--color-rojo)'}}>
            <h4 style={{marginBottom: '15px'}}><i className="fa-solid fa-list-ol"></i> Unidades Disponibles</h4>
            <div className="table-responsive">
              <table style={{width: '100%'}}>
                <thead style={{backgroundColor: '#F8FAFC'}}><tr><th>Identificador</th><th>Tipo</th><th>Precio</th><th>Acción</th></tr></thead>
                <tbody>
                  {unidades.map(u => (
                    <tr key={u.idTemp}>
                      <td style={{fontWeight: 'bold'}}>{u.titulo}</td><td>{u.tipoInmueble}</td>
                      <td style={{color: 'var(--color-rojo)', fontWeight: 'bold'}}>{form.moneda} {u.precio || "0"}</td>
                      <td><button className="btn btn-outline btn-sm" onClick={() => setUnidadEditando({...u})}><i className="fa-solid fa-sliders"></i> Detalle Unidad</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* SEC 1: IDENTIFICACIÓN, OPERACIÓN Y PRECIO */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="identificacion" title="1. Identificación, Precio y Operación" icon="fa-tag" isOpen={secciones.identificacion} onToggle={toggleSec} />
             {secciones.identificacion && (
               <div style={{padding: '25px'}}>
                  <div className="form-row">
                    <div className="form-group" style={{flex: 2}}>
                       <label>Propietario / Comitente</label>
                       <select name="idPropietarioActual" value={form.idPropietarioActual} onChange={handleChange}>
                          <option value="">- Asignar Cliente -</option>
                          {propietarios.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
                       </select>
                    </div>
                  </div>

                  <div className="form-row" style={{backgroundColor: '#FFF8F8', padding: '15px', borderRadius: '8px', border: '1px solid #FFCDD2'}}>
                    <div className="form-group">
                       <label style={{color: 'var(--color-rojo)', fontWeight: 'bold'}}>Precio Base</label>
                       <div className="input-with-icon">
                          <i className="fa-solid fa-money-bill-wave"></i>
                          <input type="number" name="precio" value={form.precio} onChange={handleChange} placeholder="Ej: 150000" />
                       </div>
                    </div>
                    <div className="form-group">
                       <label style={{color: 'var(--color-rojo)', fontWeight: 'bold'}}>Moneda</label>
                       <select name="moneda" value={form.moneda} onChange={handleChange} style={{borderColor: '#FFCDD2'}}>
                          <option value="USD">USD - Dólares</option>
                          <option value="ARS">ARS - Pesos Argentinos</option>
                          <option value="USDT">USDT - Cripto (Tether)</option>
                          <option value="EUR">EUR - Euros</option>
                          <option value="BRL">BRL - Reales</option>
                          <option value="CLP">CLP - Pesos Chilenos</option>
                       </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                       <label>Operación</label>
                       <select name="tipoOperacion" value={form.tipoOperacion} onChange={handleChange}>
                          <option>Venta</option><option>Alquiler</option><option>Temporario</option>
                       </select>
                    </div>
                    <div className="form-group">
                       <label>Estado de Propiedad</label>
                       <select name="estadoPropiedad" value={form.estadoPropiedad} onChange={handleChange}>
                          <option>Disponible</option><option>Reservada</option><option>Vendida</option><option>Alquilada</option><option>Suspendida</option>
                       </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group"><label>Tipo Inmueble</label><select name="tipoInmueble" value={form.tipoInmueble} onChange={handleChange} disabled={form.esComplejo}><option>Casa</option><option>Departamento</option><option>Terreno</option><option>Local</option><option>Oficina</option><option>Cabaña</option><option>Galpón</option></select></div>
                    <div className="form-group"><label>Subtipo</label><select name="subtipo" value={form.subtipo} onChange={handleChange}>{SUBTIPOS_INMUEBLE.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="form-group"><label>Uso Actual</label><select name="usoActual" value={form.usoActual} onChange={handleChange}>{TIPOS_USO.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <InputG label="Uso Potencial" name="usoPotencial" valorActual={form.usoPotencial} onChange={handleChange} />
                  </div>
               </div>
             )}
          </div>

          {/* SEC 2: UBICACIÓN */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="ubicacion" title="2. Ubicación Geográfica" icon="fa-map-location-dot" isOpen={secciones.ubicacion} onToggle={toggleSec} />
             {secciones.ubicacion && (
               <div style={{padding: '25px'}}>
                  <div className="form-row">
                    <InputG label="Provincia" name="provincia" valorActual={form.provincia} onChange={handleChange} />
                    <InputG label="Localidad / Ciudad" name="localidad" valorActual={form.localidad} onChange={handleChange} />
                    <InputG label="Barrio" name="barrio" valorActual={form.barrio} onChange={handleChange} list="listaBarrios" />
                    <InputG label="Sub-Barrio" name="subBarrio" valorActual={form.subBarrio} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Calle Principal" name="calle" col={2} valorActual={form.calle} onChange={handleChange} />
                    <InputG label="Número / Altura" name="numero" valorActual={form.numero} onChange={handleChange} />
                    <InputG label="Piso" name="pisoDpto" valorActual={form.pisoDpto} onChange={handleChange} />
                    <InputG label="Depto/Unidad" name="casaUnidad" valorActual={form.casaUnidad} onChange={handleChange} />
                  </div>
                  
                  <GridChecks title="Características de la Ubicación" arrayName="caractUbicacion" options={CHK_CARACT_UBICACION} valoresActuales={form.caractUbicacion} onChangeCheck={handleArrayCheck} />

                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc'}}>
                     <InputG label="Link Google Maps (Iframe URL)" name="linkGoogleMaps" col={2} ph="Pegue enlace embebido..." valorActual={form.linkGoogleMaps} onChange={handleChange} />
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="dirExactaPublica" checked={form.dirExactaPublica} onChange={handleChange} /><label>Mostrar dirección exacta al público</label></div></div>
                  </div>
                  <div style={{height: '250px', backgroundColor: '#eee', borderRadius: '8px', overflow: 'hidden', marginTop: '15px'}}>
                     <iframe title="map" src={form.linkGoogleMaps || `https://maps.google.com/maps?q=${encodeURIComponent(`${form.calle} ${form.numero}, ${form.localidad}`)}&output=embed`} width="100%" height="100%" style={{border:0}}></iframe>
                  </div>
               </div>
             )}
          </div>

          {/* SEC 3: CATASTRO */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="catastro" title="3. Catastro, Planos y Sup. Documentales" icon="fa-file-contract" isOpen={secciones.catastro} onToggle={toggleSec} />
             {secciones.catastro && (
               <div style={{padding: '25px'}}>
                  <h6 style={{color: 'var(--color-negro)'}}>Nomenclatura Completa</h6>
                  <div className="form-row">
                    <InputG label="Circunscripción" name="catCircunscripcion" valorActual={form.catCircunscripcion} onChange={handleChange} />
                    <InputG label="Sección" name="catSeccion" valorActual={form.catSeccion} onChange={handleChange} />
                    <InputG label="Manzana" name="catManzana" valorActual={form.catManzana} onChange={handleChange} />
                    <InputG label="Parcela" name="catParcela" valorActual={form.catParcela} onChange={handleChange} />
                    <InputG label="Lote" name="catLote" valorActual={form.catLote} onChange={handleChange} />
                  </div>
                  
                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Identificadores Registrales</h6>
                  <div className="form-row">
                    <InputG label="Partida Inmobiliaria" name="catPartida" valorActual={form.catPartida} onChange={handleChange} />
                    <InputG label="Cuenta Tributaria" name="catCuentaTributaria" valorActual={form.catCuentaTributaria} onChange={handleChange} />
                    <InputG label="Matrícula" name="catMatricula" valorActual={form.catMatricula} onChange={handleChange} />
                    <InputG label="Folio" name="catFolio" valorActual={form.catFolio} onChange={handleChange} />
                  </div>

                  {form.difSuperficies && (
                     <div className="animation-fade-in" style={{backgroundColor: '#FFF3E0', color: '#E65100', padding: '15px', borderRadius: '8px', border: '1px solid #FFCC80', marginBottom: '20px', fontWeight: 'bold'}}>
                        ⚠️ Se detectaron diferencias entre la superficie catastral y la relevada.
                     </div>
                  )}

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Superficies (M2)</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px'}}>
                    <InputG label="Sup. Según Título" name="supTitulo" type="number" valorActual={form.supTitulo} onChange={handleChange} />
                    <InputG label="Sup. Según Catastro" name="supCatastro" type="number" valorActual={form.supCatastro} onChange={handleChange} />
                    <InputG label="Sup. Según Plano" name="supPlano" type="number" valorActual={form.supPlano} onChange={handleChange} />
                    <InputG label="Sup. Relevada Real" name="supRelevada" type="number" valorActual={form.supRelevada} onChange={handleChange} />
                  </div>
               </div>
             )}
          </div>

          {/* SEC 4: TERRENO */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="terreno" title="4. Terreno y Dimensiones" icon="fa-tree" isOpen={secciones.terreno} onToggle={toggleSec} />
             {secciones.terreno && (
               <div style={{padding: '25px'}}>
                  <div className="form-row">
                    <InputG label="Superficie Terreno (m2)" name="terSup" type="number" valorActual={form.terSup} onChange={handleChange} />
                    <InputG label="Frente (m)" name="terFrente" type="number" valorActual={form.terFrente} onChange={handleChange} />
                    <InputG label="Fondo (m)" name="terFondo" type="number" valorActual={form.terFondo} onChange={handleChange} />
                    <div className="form-group"><label>Orientación</label><select name="terOrientacion" value={form.terOrientacion} onChange={handleChange}><option>Norte</option><option>Sur</option><option>Este</option><option>Oeste</option><option>Noreste</option><option>Noroeste</option><option>Sudeste</option><option>Sudoeste</option></select></div>
                  </div>
                  
                  <div className="form-row">
                    <InputG label="Límite Frente" name="terLimFrente" valorActual={form.terLimFrente} onChange={handleChange} />
                    <InputG label="Límite Fondo" name="terLimFondo" valorActual={form.terLimFondo} onChange={handleChange} />
                    <InputG label="Lat. Derecho" name="terLimDerecho" valorActual={form.terLimDerecho} onChange={handleChange} />
                    <InputG label="Lat. Izquierdo" name="terLimIzquierdo" valorActual={form.terLimIzquierdo} onChange={handleChange} />
                  </div>

                  <GridChecks title="Características del Terreno / Lote" arrayName="caractTerreno" options={CHK_TERRENO_CARACT} valoresActuales={form.caractTerreno} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Riesgos / Afectaciones" arrayName="caractRiesgos" options={CHK_RIESGOS} valoresActuales={form.caractRiesgos} onChangeCheck={handleArrayCheck} />
               </div>
             )}
          </div>

          {/* SEC 5: CONSTRUCCIÓN */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="construccion" title="5. Construcción y Distribución" icon="fa-trowel-bricks" isOpen={secciones.construccion} onToggle={toggleSec} />
             {secciones.construccion && (
               <div style={{padding: '25px'}}>
                  <h6 style={{color: 'var(--color-negro)'}}>Superficies Construidas (M2)</h6>
                  <div className="form-row">
                    <InputG label="Sup. Cubierta" name="supCubierta" type="number" valorActual={form.supCubierta} onChange={handleChange} />
                    <InputG label="Sup. Semicubierta" name="supSemicubierta" type="number" valorActual={form.supSemicubierta} onChange={handleChange} />
                    <InputG label="Sup. Descubierta" name="supDescubierta" type="number" valorActual={form.supDescubierta} onChange={handleChange} />
                    <InputG label="Sup. Habitable" name="supHabitable" type="number" valorActual={form.supHabitable} onChange={handleChange} />
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Antigüedad y Estado</h6>
                  <div className="form-row">
                    <div className="form-group"><label>Estado Conservación</label><select name="estadoConservacion" value={form.estadoConservacion} onChange={handleChange}>{ESTADOS_CONSERVACION.map(e => <option key={e}>{e}</option>)}</select></div>
                    <InputG label="Año Construcción" name="anioConstruccion" type="number" valorActual={form.anioConstruccion} onChange={handleChange} />
                    <InputG label="Año Remodelación" name="anioRemodelacion" type="number" valorActual={form.anioRemodelacion} onChange={handleChange} />
                    <div className="form-group"><label>Situación Construcción</label><select name="sitConstruccionRegistrada" value={form.sitConstruccionRegistrada} onChange={handleChange}><option>Registrada</option><option>Parcialmente Registrada</option><option>No registrada</option></select></div>
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Distribución (Cantidades)</h6>
                  <div className="form-row" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))'}}>
                    <InputG label="Plantas" name="cantPlantas" type="number" valorActual={form.cantPlantas} onChange={handleChange} />
                    <InputG label="Ambientes" name="cantAmbientes" type="number" valorActual={form.cantAmbientes} onChange={handleChange} />
                    <InputG label="Dormitorios" name="cantDormitorios" type="number" valorActual={form.cantDormitorios} onChange={handleChange} />
                    <InputG label="Suites" name="cantSuites" type="number" valorActual={form.cantSuites} onChange={handleChange} />
                    <InputG label="Baños" name="cantBanos" type="number" valorActual={form.cantBanos} onChange={handleChange} />
                    <InputG label="Toilettes" name="cantToilettes" type="number" valorActual={form.cantToilettes} onChange={handleChange} />
                    <InputG label="Cocheras" name="cantCocheras" type="number" valorActual={form.cantCocheras} onChange={handleChange} />
                  </div>
               </div>
             )}
          </div>

          {/* SEC 6: AMBIENTES DETALLADOS */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="ambientes" title="6. Ambientes Detallados (Materiales y Extras)" icon="fa-couch" isOpen={secciones.ambientes} onToggle={toggleSec} />
             {secciones.ambientes && (
               <div style={{padding: '25px'}}>
                  <GridChecks title="Ambientes Especiales (Playroom, Sótano, etc)" arrayName="ambientesEsp" options={CHK_AMBIENTES_ESP} valoresActuales={form.ambientesEsp} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Características Cocina" arrayName="caractCocina" options={CHK_COCINA} valoresActuales={form.caractCocina} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Exteriores, Patios y Terrazas" arrayName="caractExteriores" options={CHK_EXTERIORES} valoresActuales={form.caractExteriores} onChangeCheck={handleArrayCheck} />
                  
                  <div style={{backgroundColor: '#F0F8FF', padding: '15px', borderRadius: '8px', border: '1px solid #90CAF9', marginBottom: '20px'}}>
                     <div className="checkbox-group" style={{marginBottom: form.tienePileta ? '15px' : '0'}}><input type="checkbox" name="tienePileta" checked={form.tienePileta} onChange={handleChange} /><label style={{fontWeight: 'bold', color: '#1565C0'}}>Tiene Pileta / Piscina</label></div>
                     {form.tienePileta && (
                        <div className="form-row animation-fade-in" style={{marginBottom: 0}}>
                           <InputG label="Tipo/Material" name="piletaTipo" ph="Ej: Material, Fibra..." valorActual={form.piletaTipo} onChange={handleChange} />
                           <InputG label="Medidas" name="piletaMedidas" ph="Ej: 8x4m" valorActual={form.piletaMedidas} onChange={handleChange} />
                           <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="piletaClimatizada" checked={form.piletaClimatizada} onChange={handleChange}/><label>Es Climatizada</label></div></div>
                        </div>
                     )}
                  </div>

                  <GridChecks title="Aberturas y Ventanas" arrayName="caractAberturas" options={CHK_ABERTURAS} valoresActuales={form.caractAberturas} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Revestimiento de Pisos" arrayName="caractPisos" options={CHK_PISOS} valoresActuales={form.caractPisos} onChangeCheck={handleArrayCheck} />
               </div>
             )}
          </div>

          {/* SEC 7: INSTALACIONES Y SERVICIOS */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="instalaciones" title="7. Instalaciones, Agua, Gas y Conectividad" icon="fa-faucet-drip" isOpen={secciones.instalaciones} onToggle={toggleSec} />
             {secciones.instalaciones && (
               <div style={{padding: '25px'}}>
                  <GridChecks title="Agua, Gas y Termos" arrayName="caractAguaGas" options={CHK_AGUA_GAS} valoresActuales={form.caractAguaGas} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Desagües y Cloacas" arrayName="caractDesagues" options={CHK_DESAGUES} valoresActuales={form.caractDesagues} onChangeCheck={handleArrayCheck} />
                  
                  <div style={{backgroundColor: '#FFF3E0', padding: '15px', borderRadius: '8px', border: '1px solid #FFCC80', marginBottom: '20px'}}>
                     <div className="checkbox-group" style={{marginBottom: form.tieneClimatizacion ? '15px' : '0'}}><input type="checkbox" name="tieneClimatizacion" checked={form.tieneClimatizacion} onChange={handleChange} /><label style={{fontWeight: 'bold', color: '#E65100'}}>Tiene Sistema de Climatización / Calefacción</label></div>
                     {form.tieneClimatizacion && (
                        <div className="form-row animation-fade-in" style={{marginBottom: 0}}>
                           <div className="form-group" style={{flex: 2}}>
                              <label>Tipo de Sistema</label>
                              <select name="climatizacionTipo" value={form.climatizacionTipo} onChange={handleChange}>
                                 <option>Calefacción Central (Radiadores)</option><option>Losa Radiante</option><option>Split Frio/Calor</option><option>Tiro Balanceado</option>
                              </select>
                           </div>
                        </div>
                     )}
                  </div>

                  <div style={{backgroundColor: '#F4F6F8', padding: '15px', borderRadius: '8px', border: '1px solid #C1C7CD'}}>
                     <div className="checkbox-group" style={{marginBottom: form.tieneInternet ? '15px' : '0'}}><input type="checkbox" name="tieneInternet" checked={form.tieneInternet} onChange={handleChange} /><label style={{fontWeight: 'bold'}}>Conectividad Internet Disponible</label></div>
                     {form.tieneInternet && (
                        <div className="form-row animation-fade-in" style={{marginBottom: 0}}>
                           <div className="form-group"><label>Tipo de Conexión</label><select name="internetTipo" value={form.internetTipo} onChange={handleChange}>{TIPOS_INTERNET.map(t=><option key={t}>{t}</option>)}</select></div>
                           <InputG label="Proveedor (Ej: Personal, Claro)" name="internetProveedor" valorActual={form.internetProveedor} onChange={handleChange} />
                        </div>
                     )}
                  </div>
               </div>
             )}
          </div>

          {/* SEC 8: SEGURIDAD Y EDIFICIO */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="extras" title="8. Seguridad, Accesibilidad y Country/Edificio" icon="fa-building-shield" isOpen={secciones.extras} onToggle={toggleSec} />
             {secciones.extras && (
               <div style={{padding: '25px'}}>
                  <GridChecks title="Seguridad y Tecnología" arrayName="caractSeguridad" options={CHK_SEGURIDAD} valoresActuales={form.caractSeguridad} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Accesibilidad" arrayName="caractAccesibilidad" options={CHK_ACCESIBILIDAD} valoresActuales={form.caractAccesibilidad} onChangeCheck={handleArrayCheck} />
                  <GridChecks title="Características Destacadas" arrayName="caractDestacadas" options={CHK_DESTACADAS} valoresActuales={form.caractDestacadas} onChangeCheck={handleArrayCheck} />

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}>¿Pertenece a un complejo mayor?</h6>
                  <Botones label="Es parte de:" name="esParteDe" options={['Ninguno', 'Edificio', 'Barrio Privado / Country']} valorActual={form.esParteDe} onChange={handleChange} />
                  
                  {form.esParteDe === 'Edificio' && (
                     <div className="form-row animation-fade-in" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', marginTop: '15px'}}>
                        <InputG label="Cant. Pisos Edificio" name="ediCantPisos" type="number" valorActual={form.ediCantPisos} onChange={handleChange} />
                        <InputG label="Expensas Comunes ($)" name="ediExpensas" type="number" valorActual={form.ediExpensas} onChange={handleChange} />
                        <InputG label="Amenities Edificio" name="ediAmenities" col={2} ph="Ej: SUM, Pileta..." valorActual={form.ediAmenities} onChange={handleChange} />
                     </div>
                  )}

                  {form.esParteDe === 'Barrio Privado / Country' && (
                     <div className="form-row animation-fade-in" style={{backgroundColor: '#F0F8FF', padding: '15px', borderRadius: '8px', marginTop: '15px', border: '1px solid #90CAF9'}}>
                        <InputG label="Nombre del Barrio" name="couNombre" valorActual={form.couNombre} onChange={handleChange} />
                        <InputG label="Lote N° / Etapa" name="couLote" valorActual={form.couLote} onChange={handleChange} />
                        <InputG label="Expensas ($)" name="couExpensas" type="number" valorActual={form.couExpensas} onChange={handleChange} />
                        <InputG label="Amenities del Barrio" name="couAmenities" col={2} valorActual={form.couAmenities} onChange={handleChange} />
                     </div>
                  )}
               </div>
             )}
          </div>

          {/* SEC 9: LEGAL */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="legal" title="9. Legal, Registral, Cuentas y Deudas" icon="fa-scale-balanced" isOpen={secciones.legal} onToggle={toggleSec} />
             {secciones.legal && (
               <div style={{padding: '25px'}}>
                  <h6 style={{color: 'var(--color-negro)'}}>Situación Jurídica</h6>
                  <div className="form-row">
                    <div className="form-group"><label>Tipo de Dominio</label><select name="legDominio" value={form.legDominio} onChange={handleChange}><option>Dominio</option><option>Condominio</option><option>Usufructo</option><option>Posesión</option></select></div>
                    <InputG label="Restricciones / Servidumbres" name="legRestricciones" valorActual={form.legRestricciones} onChange={handleChange} />
                    <InputG label="Medidas Cautelares / Embargos" name="legMedidasCautelares" valorActual={form.legMedidasCautelares} onChange={handleChange} />
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Cuentas y Servicios</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px'}}>
                    <InputG label="N° Cuenta Luz (EPEC)" name="ctaEpec" valorActual={form.ctaEpec} onChange={handleChange} />
                    <InputG label="N° Cuenta Gas (EcoGas)" name="ctaGas" valorActual={form.ctaGas} onChange={handleChange} />
                    <InputG label="N° Cuenta Agua" name="ctaAgua" valorActual={form.ctaAgua} onChange={handleChange} />
                    <InputG label="N° Cuenta Muni" name="ctaMuni" valorActual={form.ctaMuni} onChange={handleChange} />
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Deudas Asociadas</h6>
                  <div className="form-row">
                    <InputG label="Deuda Inmobiliario ($)" name="deudaInmobiliario" type="number" valorActual={form.deudaInmobiliario} onChange={handleChange} />
                    <InputG label="Deuda Municipal ($)" name="deudaMuni" type="number" valorActual={form.deudaMuni} onChange={handleChange} />
                    <InputG label="Deuda Expensas ($)" name="deudaExpensas" type="number" valorActual={form.deudaExpensas} onChange={handleChange} />
                    <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="libreDeudaDisponible" checked={form.libreDeudaDisponible} onChange={handleChange}/><label>Libre Deuda Disponible</label></div></div>
                  </div>
               </div>
             )}
          </div>

          {/* SEC 10: RURAL */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="rural" title="10. Propiedad Rural / Campo" icon="fa-tractor" isOpen={secciones.rural} onToggle={toggleSec} />
             {secciones.rural && (
               <div style={{padding: '25px'}}>
                  <div className="checkbox-group" style={{marginBottom: '20px'}}><input type="checkbox" name="esRural" checked={form.esRural} onChange={handleChange}/><label style={{fontWeight: 'bold'}}>Es Propiedad Rural (Campo, Chacra)</label></div>
                  {form.esRural && (
                     <div className="form-row animation-fade-in">
                        <InputG label="Total Hectáreas" name="rurHectareas" type="number" valorActual={form.rurHectareas} onChange={handleChange} />
                        <InputG label="Aptitud (Agrícola, Ganadera...)" name="rurAptitud" valorActual={form.rurAptitud} onChange={handleChange} />
                        <InputG label="Mejoras (Alambrados, Molinos...)" name="rurMejoras" col={2} valorActual={form.rurMejoras} onChange={handleChange} />
                     </div>
                  )}
               </div>
             )}
          </div>

          {/* SEC 11: DESCRIPCIONES */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="descripcion" title="11. Ocupación y Descripciones" icon="fa-align-left" isOpen={secciones.descripcion} onToggle={toggleSec} />
             {secciones.descripcion && (
               <div style={{padding: '25px'}}>
                  <h6 style={{color: 'var(--color-negro)'}}>Estado de Ocupación</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', marginBottom: '20px'}}>
                     <div className="form-group"><label>Ocupación</label><select name="ocpEstado" value={form.ocpEstado} onChange={handleChange}><option>Desocupado</option><option>Alquilado</option><option>Ocupado por propietario</option><option>Intrusión</option></select></div>
                     <InputG label="Vencimiento Contrato" name="ocpFechaVencimiento" type="date" valorActual={form.ocpFechaVencimiento} onChange={handleChange} />
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="ocpSeVendeConContrato" checked={form.ocpSeVendeConContrato} onChange={handleChange}/><label>Se vende con contrato</label></div></div>
                  </div>

                  <h6 style={{color: 'var(--color-negro)'}}>Descripciones Segmentadas</h6>
                  <div className="form-row">
                     <div className="form-group" style={{flex: 1}}><label>Descripción Pública General</label><textarea name="descGral" value={form.descGral} onChange={handleChange} rows="3"></textarea></div>
                     <div className="form-group" style={{flex: 1}}><label>Observaciones Internas (Privadas)</label><textarea name="obsInternas" value={form.obsInternas} onChange={handleChange} rows="3" style={{backgroundColor: '#FFF8F8', borderColor: '#FFCDD2'}}></textarea></div>
                  </div>
               </div>
             )}
          </div>

          {/* SEC 12: CONDICIONES COMERCIALES Y OPERATIVAS */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="comercial" title="12. Condiciones Comerciales y Operativas" icon="fa-handshake" isOpen={secciones.comercial} onToggle={toggleSec} />
             {secciones.comercial && (
               <div style={{padding: '25px'}}>
                  <h6 style={{color: 'var(--color-negro)'}}>Acuerdos con el Propietario</h6>
                  <div className="form-row">
                     <InputG label="Honorarios Profesionales (%)" name="comisionPactada" type="number" valorActual={form.comisionPactada} onChange={handleChange} />
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="tieneExclusividad" checked={form.tieneExclusividad} onChange={handleChange}/><label>Exclusividad de Venta/Alquiler</label></div></div>
                     {form.tieneExclusividad && (
                        <div className="animation-fade-in" style={{flex: 1}}>
                           <InputG label="Vencimiento Exclusividad" name="fechaVencimientoExclusividad" type="date" valorActual={form.fechaVencimientoExclusividad} onChange={handleChange} />
                        </div>
                     )}
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Cartelería y Acceso Físico</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px'}}>
                     <InputG label="Ubicación de Llaves" name="ubicacionLlaves" ph="Ej: Llavero 45, Portería..." valorActual={form.ubicacionLlaves} onChange={handleChange} col={2} />
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="tieneCartel" checked={form.tieneCartel} onChange={handleChange}/><label>Cartel Colocado</label></div></div>
                  </div>
                  
                  {form.tieneCartel && (
                     <div className="form-row animation-fade-in" style={{marginTop: '15px'}}>
                        <div className="form-group">
                           <label>Tipo de Cartel</label>
                           <select name="tipoCartel" value={form.tipoCartel} onChange={handleChange}>
                              {TIPOS_CARTEL.map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                        <InputG label="Fecha de Colocación" name="fechaColocacionCartel" type="date" valorActual={form.fechaColocacionCartel} onChange={handleChange} />
                     </div>
                  )}
               </div>
             )}
          </div>

          {/* SEC 13: MULTIMEDIA Y DOCUMENTOS PDF */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '30px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="multimedia" title="13. Multimedia y Documentación PDF" icon="fa-images" isOpen={secciones.multimedia} onToggle={toggleSec} />
             {secciones.multimedia && (
               <div style={{padding: '25px'}}>
                  <h6 style={{color: 'var(--color-negro)', marginBottom: '10px'}}><i className="fa-solid fa-camera" style={{color: 'var(--color-rojo)'}}></i> Imágenes y Videos de la Propiedad</h6>
                  <div className="form-group" style={{backgroundColor: '#F8FAFC', padding: '30px 20px', borderRadius: '8px', border: '2px dashed var(--color-gris-borde)', textAlign: 'center', marginBottom: '25px'}}>
                     <label style={{display: 'block', marginBottom: '15px', color: 'var(--color-gris-texto)'}}>Arrastre los archivos aquí o haga clic para seleccionar (Formatos: JPG, PNG, MP4)</label>
                     <input type="file" multiple accept="image/*,video/*" style={{padding: '10px', width: '100%', maxWidth: '400px', cursor: 'pointer', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #ccc'}}/>
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginBottom: '10px'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--color-rojo)'}}></i> Documentos Legales (Escrituras, Planos, Recibos)</h6>
                  <div className="form-group" style={{backgroundColor: '#F8FAFC', padding: '30px 20px', borderRadius: '8px', border: '2px dashed var(--color-gris-borde)', textAlign: 'center'}}>
                     <label style={{display: 'block', marginBottom: '15px', color: 'var(--color-gris-texto)'}}>Arrastre los documentos respaldatorios aquí (Formato: PDF)</label>
                     <input type="file" multiple accept=".pdf" style={{padding: '10px', width: '100%', maxWidth: '400px', cursor: 'pointer', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #ccc'}}/>
                  </div>
               </div>
             )}
          </div>

        </form>
      </div>

      {/* MODAL DETALLADO PARA UNIDADES DEL COMPLEJO */}
      {unidadEditando && (
        <div className="modal-overlay active" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)'}}>
          <div className="modal-box animation-fade-in" style={{width: '700px', backgroundColor: '#fff', borderRadius: '12px', padding: '0', overflow: 'hidden'}}>
            
            <div style={{backgroundColor: 'var(--color-negro)', color: '#fff', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
               <h3 style={{margin: 0}}><i className="fa-solid fa-pen-ruler" style={{color: 'var(--color-rojo)'}}></i> Detalle de Unidad: {unidadEditando.titulo}</h3>
               <button onClick={() => setUnidadEditando(null)} style={{background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer'}}><i className="fa-solid fa-xmark"></i></button>
            </div>

            <div style={{padding: '30px', maxHeight: '70vh', overflowY: 'auto'}}>
               <div className="form-row">
                  <div className="form-group" style={{flex: 2}}><label>Identificador (Ej: Depto 1A)</label><input type="text" value={unidadEditando.titulo} onChange={e => setUnidadEditando({...unidadEditando, titulo: e.target.value})} /></div>
                  <div className="form-group"><label>Tipo Inmueble</label><select value={unidadEditando.tipoInmueble} onChange={e => setUnidadEditando({...unidadEditando, tipoInmueble: e.target.value})}><option>Departamento</option><option>Cabaña</option><option>Local</option></select></div>
               </div>
               
               <div className="form-row">
                  <div className="form-group"><label>Moneda</label><select value={unidadEditando.moneda} onChange={e => setUnidadEditando({...unidadEditando, moneda: e.target.value})}><option>USD</option><option>ARS</option></select></div>
                  <div className="form-group" style={{flex: 2}}><label>Precio Base</label><div className="input-with-icon"><i className="fa-solid fa-tag"></i><input type="number" value={unidadEditando.precio} onChange={e => setUnidadEditando({...unidadEditando, precio: e.target.value})} /></div></div>
               </div>

               <h5 style={{marginTop: '15px', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}>Distribución y Superficie</h5>
               <div className="form-row">
                  <div className="form-group"><label>Ambientes</label><input type="number" value={unidadEditando.cantAmbientes} onChange={e => setUnidadEditando({...unidadEditando, cantAmbientes: e.target.value})} min="1"/></div>
                  <div className="form-group"><label>Dormitorios</label><input type="number" value={unidadEditando.cantDormitorios} onChange={e => setUnidadEditando({...unidadEditando, cantDormitorios: e.target.value})} min="0"/></div>
                  <div className="form-group"><label>Baños</label><input type="number" value={unidadEditando.cantBanos} onChange={e => setUnidadEditando({...unidadEditando, cantBanos: e.target.value})} min="1"/></div>
                  <div className="form-group"><label>Sup. Cubierta (m2)</label><input type="number" value={unidadEditando.supCubierta} onChange={e => setUnidadEditando({...unidadEditando, supCubierta: e.target.value})} /></div>
               </div>

               <div className="form-group" style={{marginTop: '15px'}}>
                  <label>Observaciones o Amenities Especiales de esta unidad</label>
                  <textarea rows="3" value={unidadEditando.observaciones || ""} onChange={e => setUnidadEditando({...unidadEditando, observaciones: e.target.value})} placeholder="Ej: Esta cabaña tiene cochera techada individual..."></textarea>
               </div>
            </div>

            <div style={{backgroundColor: '#F8FAFC', padding: '20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '15px'}}>
                <button type="button" className="btn btn-outline" onClick={() => setUnidadEditando(null)}>Cerrar sin guardar</button>
                <button type="button" className="btn btn-rojo" onClick={() => { setUnidades(unidades.map(u => u.idTemp === unidadEditando.idTemp ? unidadEditando : u)); setUnidadEditando(null); }}><i className="fa-solid fa-check"></i> Aplicar Cambios a Unidad</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropiedadForm;