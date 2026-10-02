import { validarNombre } from "../../utils/texto";
import { useState } from "react";
import { createPersona, updatePersona, agregarNotaPersona } from "../../services/api";
import { Botones, InputG, GridChecks, AccordionH } from "../common/FormUI";
import { soloDigitos, fmtFecha } from "../../utils/personas";
import OpcionesMoneda from "../common/OpcionesMoneda";
import { avisar } from "../../utils/avisos";

// =========================================================================
// 1. CONSTANTES Y DICCIONARIOS
// =========================================================================
const RELACIONES_COMERCIALES = ["Propietario", "Comprador", "Locatario", "Garante", "Inversor", "Interesado", "Otro"];
const MEDIOS_CONTACTO = ["WhatsApp", "Llamada Telefónica", "Email", "Presencial en Oficina"];
const EXTRAS_BUSQUEDA = ["Cochera", "Jardín", "Pileta", "Balcón", "Terraza", "Quincho", "Ascensor", "Seguridad 24hs", "Amenities", "Apto mascotas", "Apto profesional"];
const FORMAS_PAGO = ["Contado Efvo", "Financiación", "Permuta", "Parte de pago", "Crédito hipotecario", "A definir"];
const ESTADOS_CRM = ["Prospecto", "Activo", "En búsqueda", "En negociación", "Cliente", "Inactivo", "No contactar"];
const FUENTES_CRM = ["Referido", "Web Propia", "Instagram", "Facebook", "WhatsApp", "Portal (ZonaProp, etc)", "Oficina", "Cartel", "Otro"];
const NIVELES_BCRA = ["Normal (1)", "Con Seguimiento Especial (2)", "Con Problemas (3)", "Con Alto Riesgo (4)", "Irrecuperable (5)", "Desconocido"];
const PLAZOS_ALQUILER = ["2 Años (Ley)", "Comercial (3 Años)", "Temporario (Días/Meses)"];

const hoyISO = () => new Date().toISOString().split("T")[0];

// =========================================================================
// 2. ESTADO INICIAL (función: así la fecha de "primer contacto" siempre es la de hoy)
// =========================================================================
const vacio = () => ({
  // 1. Identificación
  tipoCliente: "Persona humana",
  nombre: "", apellido: "", dni: "", cuitCuil: "", fechaNacimiento: "", nacionalidad: "Argentina",
  razonSocial: "", nombreComercial: "", cuitJuridica: "", tipoSocietario: "", actividad: "",

  // 2. Contacto & Preferencias
  telPrincipal: "", telSecundario: "", whatsapp: "", emailPrincipal: "", emailSecundario: "",
  medioContactoPref: "WhatsApp", horarioContactoPref: "", aceptaComunicacionesComerciales: true,

  // 3. Domicilio
  calle: "", numero: "", piso: "", departamento: "", localidad: "Villa Carlos Paz", provincia: "Córdoba", pais: "Argentina", codigoPostal: "5152",

  // 4. Comercial y Financiero (BCRA). "Desconocido" = todavía no se consultó (no se guarda ningún nivel)
  relaciones: [], situacionBcra: "Desconocido", estaInhibido: false,

  // 5. Búsqueda Compra (Condicional)
  compTipoProp: "", compLocalidades: "Villa Carlos Paz", compBarrios: "", compPresupuestoMin: "", compPresupuestoMax: "", compMoneda: "USD",
  compDorms: "", compBanos: "", compAmbientes: "", compSupMin: "", compSupMax: "", compTerrenoMin: "",
  compEstadoProp: "Indiferente", compAntiguedadMax: "", compExtras: [], compFormasPago: [], compPrioridades: "",

  // 6. Búsqueda Alquilar (Condicional)
  alqTipoProp: "", alqZona: "", alqPresupuesto: "", alqMoneda: "ARS", alqAmbientes: "", alqDorms: "", alqBanos: "",
  alqCochera: false, alqAmoblado: false, alqMascotas: true, alqFechaIngreso: "", alqPlazo: PLAZOS_ALQUILER[0], alqImprescindibles: "", alqDeseables: "",

  // 7. Perfil Cliente (CRM) y Seguimiento
  crmEstado: "Prospecto", crmPrioridad: "Media", crmAgente: "", crmFuente: "WhatsApp",
  segFechaPrimerContacto: hoyISO(),
  segFechaUltimo: "",
  segFechaProximo: "",
  segTareasPendientes: "",
  historial: []
});

// Campos numéricos / de fecha del modelo Persona, y campos del formulario que NO viajan tal cual al backend
const CAMPOS_NUM = new Set(["alqAmbientes", "alqBanos", "alqDorms", "alqPresupuesto", "compAmbientes", "compAntiguedadMax", "compBanos", "compDorms", "compPresupuestoMax", "compPresupuestoMin", "compSupMax", "compSupMin", "compTerrenoMin"]);
const CAMPOS_FECHA = new Set(["alqFechaIngreso", "fechaNacimiento", "segFechaPrimerContacto", "segFechaProximo", "segFechaUltimo"]);
const CAMPOS_DOCUMENTO = new Set(["dni", "cuitCuil", "cuitJuridica"]);
// dni: se guarda en "dniCuit". estaInhibido: lo calcula el servidor según el nivel BCRA. historial: las notas van por otro camino.
const NO_ENVIAR = new Set(["dni", "estaInhibido", "historial"]);

const sinTexto = (v) => v === undefined || v === null || String(v).trim() === "";
const esJuridica = (f) => f.tipoCliente !== "Persona humana";

// El backend solo admite estos roles principales; las relaciones del formulario se traducen
const ROL_POR_RELACION = { Propietario: "Propietario", Comprador: "Comprador", Locatario: "Inquilino", Garante: "Inquilino", Inversor: "Comprador", Interesado: "Comprador", Otro: "Comprador" };
const rolPrincipalDe = (relaciones = []) => {
  if (relaciones.includes("Propietario")) return "Propietario";
  return ROL_POR_RELACION[relaciones[0]] || "Comprador";
};

// Nivel numérico (1 a 5) de un texto "Con Problemas (3)"; null si es "Desconocido"
const nivelBcraDe = (texto) => {
  const m = String(texto || "").match(/\((\d)\)/);
  return m ? parseInt(m[1], 10) : null;
};
const textoBcraDe = (estado) => NIVELES_BCRA.find(n => estado != null && n.includes(`(${estado})`)) || "Desconocido";

// Arma el estado del formulario a partir de una persona existente (modo edición)
const formDesdePersona = (pe) => {
  const base = vacio();
  if (!pe) return base;
  Object.keys(base).forEach(k => {
    const v = pe[k];
    if (v !== undefined && v !== null) base[k] = v;
  });
  base.relaciones = Array.isArray(pe.relaciones) ? pe.relaciones : [];
  base.compExtras = Array.isArray(pe.compExtras) ? pe.compExtras : [];
  base.compFormasPago = Array.isArray(pe.compFormasPago) ? pe.compFormasPago : [];
  if (!PLAZOS_ALQUILER.includes(base.alqPlazo)) base.alqPlazo = PLAZOS_ALQUILER[0];

  // El DNI de una persona humana vive en dniCuit; el de una jurídica es su CUIT
  if (esJuridica(base)) {
    if (!base.cuitJuridica) base.cuitJuridica = pe.dniCuit || "";
  } else {
    base.dni = pe.dniCuit || "";
  }

  // El nivel BCRA sale del número guardado (antes siempre volvía a "Desconocido" al editar)
  base.situacionBcra = textoBcraDe(pe.estadoBcra);
  base.estaInhibido = !!pe.inhibido || (pe.estadoBcra != null && pe.estadoBcra >= 3);

  // Notas guardadas, la más nueva primero
  base.historial = [...(pe.historialNotas || [])]
    .sort((a, b) => (b.idNota || 0) - (a.idNota || 0))
    .map(n => ({ id: n.idNota, fecha: n.fecha, texto: n.texto }));
  return base;
};

// Convierte el formulario en el JSON que espera el backend (entidad Persona)
const armarPersona = (f, esNueva) => {
  const p = {};
  for (const [k, v] of Object.entries(f)) {
    if (NO_ENVIAR.has(k)) continue;
    if (CAMPOS_NUM.has(k)) {
      const n = sinTexto(v) ? null : Number(String(v).replace(",", "."));
      p[k] = Number.isFinite(n) ? n : null;
    } else if (CAMPOS_FECHA.has(k)) {
      p[k] = sinTexto(v) ? null : v;
    } else if (CAMPOS_DOCUMENTO.has(k)) {
      p[k] = sinTexto(v) ? null : soloDigitos(v);
    } else if (typeof v === "string") {
      p[k] = v.trim() === "" ? null : v.trim();
    } else {
      p[k] = v;
    }
  }
  const juridica = esJuridica(f);
  p.nombreCompleto = juridica
    ? (f.razonSocial || f.nombreComercial || "").trim()
    : `${f.nombre || ""} ${f.apellido || ""}`.trim();
  p.dniCuit = juridica
    ? soloDigitos(f.cuitJuridica)
    : (soloDigitos(f.dni) || soloDigitos(f.cuitCuil));
  p.telefono = (f.telPrincipal || f.whatsapp || "").trim() || null;
  p.email = (f.emailPrincipal || "").trim() || null;
  p.direccionParticular = [
    [f.calle, f.numero].filter(Boolean).join(" "),
    f.piso && `Piso ${f.piso}`,
    f.departamento && `Dpto ${f.departamento}`,
    f.localidad,
    f.provincia,
  ].filter(Boolean).join(", ");
  // "Desconocido" => sin nivel (null). El servidor decide si queda inhibida (nivel 3 o más).
  p.estadoBcra = nivelBcraDe(f.situacionBcra);
  p.rolPrincipal = rolPrincipalDe(f.relaciones);
  // En el alta, las notas escritas antes de guardar viajan con la ficha
  if (esNueva) {
    p.historialNotas = f.historial.map(n => ({ fecha: n.fecha, texto: n.texto }));
  }
  return p;
};

const RE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RE_TEL = /^[0-9+()\-\s.]{0,20}$/;

// Devuelve { msg, sec } con el primer problema encontrado (sec = sección del formulario a abrir) o null
const validarFormulario = (f, payload) => {
  if (esJuridica(f)) {
    if (!payload.nombreCompleto) return { msg: "Completá la razón social (o el nombre comercial).", sec: "identificacion", campo: "razonSocial" };
    if (validarNombre(payload.nombreCompleto)) return { msg: validarNombre(payload.nombreCompleto), sec: "identificacion", campo: "razonSocial" };
    if (soloDigitos(f.cuitJuridica).length !== 11) return { msg: "El CUIT de la empresa debe tener 11 dígitos.", sec: "identificacion", campo: "cuitJuridica" };
  } else {
    if (!f.nombre.trim()) return { msg: "Completá el nombre.", sec: "identificacion", campo: "nombre" };
    if (!soloDigitos(f.dni) && !soloDigitos(f.cuitCuil)) return { msg: "Completá el DNI (o al menos el CUIT/CUIL).", sec: "identificacion", campo: "dni" };
    if (soloDigitos(f.dni) && !/^\d{7,11}$/.test(soloDigitos(f.dni))) return { msg: "El DNI debe tener entre 7 y 8 dígitos (solo números).", sec: "identificacion", campo: "dni" };
    if (soloDigitos(f.cuitCuil) && soloDigitos(f.cuitCuil).length !== 11) return { msg: "El CUIT/CUIL debe tener 11 dígitos.", sec: "identificacion", campo: "cuitCuil" };
    if (f.fechaNacimiento && f.fechaNacimiento > hoyISO()) return { msg: "La fecha de nacimiento no puede ser futura.", sec: "identificacion" };
  }
  if (payload.direccionParticular.length > 150) return { msg: "El domicilio es demasiado largo (máximo 150 caracteres en total).", sec: "identificacion" };

  for (const [campo, etiqueta] of [["telPrincipal", "El teléfono principal"], ["whatsapp", "El WhatsApp"], ["telSecundario", "El teléfono secundario"]]) {
    if (!RE_TEL.test(f[campo] || "")) return { msg: `${etiqueta} solo puede tener números, espacios y + ( ) - . (máximo 20 caracteres).`, sec: "contacto" };
  }
  for (const [campo, etiqueta] of [["emailPrincipal", "El email principal"], ["emailSecundario", "El email secundario"]]) {
    if (f[campo] && !RE_EMAIL.test(f[campo].trim())) return { msg: `${etiqueta} no es un email válido.`, sec: "contacto" };
  }

  for (const campo of CAMPOS_NUM) {
    if (!sinTexto(f[campo]) && !(Number(String(f[campo]).replace(",", ".")) >= 0)) {
      return { msg: "Los montos, cantidades y superficies no pueden ser negativos ni tener letras.", sec: campo.startsWith("alq") ? "alquiler" : "compra" };
    }
  }
  const min = Number(f.compPresupuestoMin), max = Number(f.compPresupuestoMax);
  if (!sinTexto(f.compPresupuestoMin) && !sinTexto(f.compPresupuestoMax) && min > max) {
    return { msg: "El presupuesto mínimo no puede ser mayor al máximo.", sec: "compra" };
  }
  return null;
};

function PersonaForm({ personaEditar, onGuardado, onCancelar }) {
  const [form, setForm] = useState(() => formDesdePersona(personaEditar));
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [nuevaNota, setNuevaNota] = useState("");

  const [secciones, setSecciones] = useState(() => ({
    identificacion: true, contacto: false, perfil: false,
    // al editar se abren las fichas de búsqueda que la persona ya tiene cargadas
    compra: !!personaEditar && (personaEditar.relaciones || []).includes("Comprador"),
    alquiler: !!personaEditar && (personaEditar.relaciones || []).includes("Locatario"),
    crm: false
  }));

  const toggleSec = (sec) => setSecciones(prev => ({ ...prev, [sec]: !prev[sec] }));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let val = type === "checkbox" ? checked : value;
    // DNI y CUIT/CUIL: solo números (se pueden pegar con guiones o puntos)
    if (CAMPOS_DOCUMENTO.has(name)) val = soloDigitos(val).slice(0, 11);

    setErrores(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
    const updates = { [name]: val };
    // Regla de negocio: BCRA nivel 3 o más implica cliente inhibido ("Desconocido" no lo es)
    if (name === "situacionBcra") {
      const nivel = nivelBcraDe(val);
      updates.estaInhibido = nivel !== null && nivel >= 3;
    }
    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleArrayCheck = (arrayName, itemName, checked) => {
    setForm(prev => {
      const arr = prev[arrayName] || [];
      return { ...prev, [arrayName]: checked ? [...arr, itemName] : arr.filter(i => i !== itemName) };
    });
  };

  // Gestiona el array de "Relación" (abre las fichas de búsqueda correspondientes)
  const handleRelacionChange = (relacion, checked) => {
    setForm(prev => {
      const arr = prev.relaciones || [];
      return { ...prev, relaciones: checked ? [...arr, relacion] : arr.filter(r => r !== relacion) };
    });
    if (checked && relacion === "Comprador") setSecciones(s => ({ ...s, compra: true }));
    if (checked && relacion === "Locatario") setSecciones(s => ({ ...s, alquiler: true }));
  };

  // Nota del historial: si la persona ya existe se guarda en el momento; si es un alta, viaja con la ficha
  const agregarNotaHistorial = async () => {
    const texto = nuevaNota.trim();
    if (!texto || guardandoNota) return;
    if (texto.length > 2000) { avisar("La nota es demasiado larga (máximo 2000 caracteres)."); return; }

    if (personaEditar?.idPersona) {
      setGuardandoNota(true);
      try {
        const { data } = await agregarNotaPersona(personaEditar.idPersona, texto);
        setForm(prev => ({ ...prev, historial: [{ id: data.idNota, fecha: data.fecha, texto: data.texto }, ...prev.historial] }));
        setNuevaNota("");
      } catch (err) {
        avisar(`No se pudo guardar la nota: ${err.response?.data?.error || err.message}`);
      } finally {
        setGuardandoNota(false);
      }
    } else {
      setForm(prev => ({ ...prev, historial: [{ fecha: hoyISO(), texto }, ...prev.historial] }));
      setNuevaNota("");
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (guardando) return;

    const esNueva = !personaEditar?.idPersona;
    const payload = armarPersona(form, esNueva);

    const problema = validarFormulario(form, payload);
    if (problema) {
      setSecciones(s => ({ ...s, [problema.sec]: true }));
      setErrores(problema.campo ? { [problema.campo]: problema.msg } : {});
      avisar(problema.campo ? "Revisá el campo marcado en rojo." : problema.msg, "error");
      if (problema.campo) setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
      return;
    }

    if (form.estaInhibido) {
      const confirmar = window.confirm("ATENCIÓN: Este cliente tiene nivel BCRA 3 o superior y está marcado como INHIBIDO. ¿Está seguro que desea guardarlo en la base de datos?");
      if (!confirmar) return;
    }

    setGuardando(true);
    try {
      if (esNueva) {
        await createPersona(payload);
      } else {
        await updatePersona(personaEditar.idPersona, payload);
      }
      avisar(`Ficha de ${payload.nombreCompleto} guardada correctamente.`);
      setForm(vacio());
      if (onGuardado) onGuardado();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      avisar(`No se pudo guardar: ${msg}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="card animation-fade-in" style={{padding: 0, overflow: 'hidden'}}>
      
      <div className="card-header" style={{backgroundColor: form.estaInhibido ? 'var(--color-rojo)' : 'var(--color-negro)', color: 'white', margin: 0, padding: '20px 30px'}}>
        <span className="card-title" style={{fontSize: '1.3rem', color: 'white'}}>
          <i className="fa-solid fa-address-card"></i> {personaEditar ? `Editando ficha: ${personaEditar.nombreCompleto}` : "Alta Detallada de Persona / Contacto"}
          {form.estaInhibido && " (INHIBIDO)"}
        </span>
        <div style={{display: 'flex', alignItems: 'center'}}>
          {personaEditar && <button type="button" className="btn btn-outline" style={{backgroundColor: 'white', marginRight: '10px'}} onClick={() => { setForm(vacio()); if (onCancelar) onCancelar(); }}>Cancelar edición</button>}
          <button type="submit" form="form-persona" className="btn btn-rojo" disabled={guardando}><i className="fa-solid fa-save"></i> {guardando ? "Guardando..." : "Guardar Ficha"}</button>
        </div>
      </div>

      <div style={{padding: '30px', backgroundColor: 'var(--color-gris-fondo)'}}>
        <form id="form-persona" onSubmit={handleSubmit} noValidate>

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
                        <InputG label="Nombre/s" name="nombre" requerido error={errores.nombre} valorActual={form.nombre} onChange={handleChange} maxLength={60} />
                        <InputG label="Apellido/s" name="apellido" valorActual={form.apellido} onChange={handleChange} maxLength={60} />
                        <InputG label="DNI" name="dni" requerido error={errores.dni} ph="Solo números" inputMode="numeric" valorActual={form.dni} onChange={handleChange} />
                        <InputG label="CUIT / CUIL" name="cuitCuil" error={errores.cuitCuil} ph="11 dígitos" inputMode="numeric" valorActual={form.cuitCuil} onChange={handleChange} />
                        <InputG label="Fecha Nacimiento" name="fechaNacimiento" type="date" valorActual={form.fechaNacimiento} onChange={handleChange} />
                        <InputG label="Nacionalidad" name="nacionalidad" valorActual={form.nacionalidad} onChange={handleChange} />
                     </div>
                  ) : (
                     <div className="form-row animation-fade-in" style={{marginTop: '20px', backgroundColor: '#F4F6F8', padding: '15px', borderRadius: '8px', border: '1px solid #ccc'}}>
                        <InputG label="Razón Social" name="razonSocial" requerido error={errores.razonSocial} col={2} valorActual={form.razonSocial} onChange={handleChange} />
                        <InputG label="Nombre Comercial" name="nombreComercial" col={2} valorActual={form.nombreComercial} onChange={handleChange} />
                        <InputG label="CUIT" name="cuitJuridica" requerido error={errores.cuitJuridica} ph="11 dígitos" inputMode="numeric" valorActual={form.cuitJuridica} onChange={handleChange} />
                        <InputG label="Tipo Societario" name="tipoSocietario" ph="Ej: S.A., S.R.L." valorActual={form.tipoSocietario} onChange={handleChange} />
                        <InputG label="Actividad / Rubro" name="actividad" col={2} valorActual={form.actividad} onChange={handleChange} />
                     </div>
                  )}

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px', borderBottom: '1px solid #eee', paddingBottom: '5px'}}><i className="fa-solid fa-map-pin"></i> Domicilio (Base)</h6>
                  <div className="form-row">
                    <InputG label="Calle" name="calle" col={2} valorActual={form.calle} onChange={handleChange} />
                    <InputG label="Número" name="numero" valorActual={form.numero} onChange={handleChange} />
                    <InputG label="Piso" name="piso" valorActual={form.piso} onChange={handleChange} maxLength={20} />
                    <InputG label="Dpto" name="departamento" valorActual={form.departamento} onChange={handleChange} maxLength={20} />
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
                     <InputG label="Teléfono / Móvil Ppal." name="telPrincipal" type="tel" maxLength={20} icon="fa-phone" valorActual={form.telPrincipal} onChange={handleChange} />
                     <InputG label="WhatsApp" name="whatsapp" type="tel" maxLength={20} icon="fa-comment-dots" valorActual={form.whatsapp} onChange={handleChange} />
                     <InputG label="Teléfono Secundario" name="telSecundario" type="tel" maxLength={20} valorActual={form.telSecundario} onChange={handleChange} />
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
                        <small style={{color: '#666', marginTop: '4px', display: 'block'}}>
                           {form.situacionBcra === "Desconocido"
                              ? "Sin verificar: no se guarda ningún nivel y la persona no se marca como inhibida."
                              : "Se guarda con la fecha de hoy como última auditoría. Nivel 3 o más = inhibido."}
                        </small>
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
                        <div className="form-group"><label>Moneda</label><select name="compMoneda" value={form.compMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                        <div className="form-group"><label>Estado Aceptable</label><select name="compEstadoProp" value={form.compEstadoProp} onChange={handleChange}><option>Indiferente</option><option>A Estrenar</option><option>Excelente/Muy Bueno</option><option>A Refaccionar (Inversión)</option></select></div>
                     </div>
                     <div className="form-row" style={{marginTop: '15px'}}>
                        <InputG label="Ambientes" name="compAmbientes" type="number" valorActual={form.compAmbientes} onChange={handleChange} />
                        <InputG label="Dormitorios Mín." name="compDorms" type="number" valorActual={form.compDorms} onChange={handleChange} />
                        <InputG label="Baños Mín." name="compBanos" type="number" valorActual={form.compBanos} onChange={handleChange} />
                        <InputG label="Sup. Mínima (m2)" name="compSupMin" type="number" valorActual={form.compSupMin} onChange={handleChange} />
                        <InputG label="Sup. Máxima (m2)" name="compSupMax" type="number" valorActual={form.compSupMax} onChange={handleChange} />
                        <InputG label="Terreno Mín. (m2)" name="compTerrenoMin" type="number" valorActual={form.compTerrenoMin} onChange={handleChange} />
                        <InputG label="Antigüedad Máx. (años)" name="compAntiguedadMax" type="number" valorActual={form.compAntiguedadMax} onChange={handleChange} />
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
                        <InputG label="Presupuesto Tope" name="alqPresupuesto" type="number" valorActual={form.alqPresupuesto} onChange={handleChange} />
                        <div className="form-group"><label>Moneda</label><select name="alqMoneda" value={form.alqMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                        <div className="form-group"><label>Plazo / Contrato</label><select name="alqPlazo" value={form.alqPlazo} onChange={handleChange}>{PLAZOS_ALQUILER.map(pl => <option key={pl}>{pl}</option>)}</select></div>
                     </div>
                     <div className="form-row" style={{backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px'}}>
                        <InputG label="Ambientes" name="alqAmbientes" type="number" valorActual={form.alqAmbientes} onChange={handleChange} />
                        <InputG label="Dormitorios" name="alqDorms" type="number" valorActual={form.alqDorms} onChange={handleChange} />
                        <InputG label="Baños" name="alqBanos" type="number" valorActual={form.alqBanos} onChange={handleChange} />
                        <InputG label="Fecha de Ingreso" name="alqFechaIngreso" type="date" valorActual={form.alqFechaIngreso} onChange={handleChange} />
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
                     <button type="button" className="btn btn-rojo" onClick={agregarNotaHistorial} disabled={guardandoNota} style={{height: '65px'}}><i className="fa-solid fa-plus"></i> {guardandoNota ? "Guardando..." : "Agregar Nota"}</button>
                  </div>
                  <small style={{display: 'block', color: '#666', margin: '-10px 0 15px'}}>
                     {personaEditar
                        ? "Las notas se guardan en el momento en que las agregás (no hace falta tocar \"Guardar Ficha\")."
                        : "Las notas se guardarán junto con la ficha cuando toques \"Guardar Ficha\"."}
                  </small>

                  <div style={{backgroundColor: '#FFF', border: '1px solid var(--color-gris-borde)', borderRadius: '8px', padding: '15px', maxHeight: '250px', overflowY: 'auto'}}>
                     {form.historial.length === 0 ? (
                        <p style={{color: '#999', fontStyle: 'italic', margin: 0, textAlign: 'center'}}>No hay notas en el historial.</p>
                     ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                           {form.historial.map((nota, idx) => (
                              <div key={nota.id ?? `n${idx}`} style={{backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '6px', borderLeft: '4px solid var(--color-rojo)'}}>
                                 <span style={{fontSize: '0.8rem', color: '#666', fontWeight: 'bold'}}>{fmtFecha(nota.fecha)}</span>
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