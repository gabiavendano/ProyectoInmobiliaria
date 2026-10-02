import { useState, useEffect } from "react";
import { getPersonas, createPropiedad, updatePropiedad, subirFotosPropiedad, subirDocPropiedad, coordenadasDeLinkMaps } from "../../services/api";
import { Botones, InputG, GridChecks, AccordionH } from "../common/FormUI";
import { soloClientesReales } from "../../utils/personas";
import { geocodificarDireccion } from "../../utils/geocodificar";
import UbicacionMapa from "./UbicacionMapa";
import MultimediaPropiedad from "./MultimediaPropiedad";
import UnidadesComplejo from "./UnidadesComplejo";
import { OPERACIONES, TIPOS_INMUEBLE, etiquetaTipo } from "../../utils/propiedad";
import { validarLinkGoogleMaps, coordenadasDeLink, LINK_MAPS_AYUDA } from "../../utils/googleMaps";
import OpcionesMoneda from "../common/OpcionesMoneda";
import { simboloMoneda } from "../../utils/monedas";
import { avisar } from "../../utils/avisos";

// =========================================================================
// 1. COMPONENTES UI REUTILIZABLES (Afuera para evitar pérdida de foco)
// =========================================================================

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

// Campos que el backend espera como número / fecha (se arman a partir del modelo Propiedad)
const CAMPOS_NUM = new Set(["anioAmpliacion", "anioConstruccion", "anioRemodelacion", "antiguedad", "cantAmbientes", "cantBanos", "cantCocheras", "cantCocinas", "cantComedores", "cantDormitorios", "cantLivings", "cantPlantas", "cantSuites", "cantToilettes", "cantUnidades", "comisionPactada", "couExpensas", "deudaExpensas", "deudaInmobiliario", "deudaMuni", "ediCantPisos", "ediCantUnidades", "ediExpensas", "ocpMonto", "precio", "rurHectareas", "supCatastro", "supComunes", "supConstruida", "supCubierta", "supDescubierta", "supHabitable", "supMensura", "supPH", "supPlano", "supPropia", "supRelevada", "supSemicubierta", "supTitulo", "supTotal", "terFondo", "terFondo2", "terFrente", "terFrente2", "terLimDerecho", "terLimFondo", "terLimFrente", "terLimIzquierdo", "terSup", "terSupEsquina"]);
const CAMPOS_FECHA = new Set(["fechaColocacionCartel", "fechaVencimientoExclusividad", "ocpFechaVencimiento"]);
// Campos del formulario que el backend no tiene
const NO_ENVIAR = new Set(["catDepto", "catNomenclatura", "catPedania", "catSubLote", "catSubparcela", "idPropietarioActual"]);

const ESTADOS_FICHA = ["Activa", "En carga", "Archivada"];
const ESTADOS_VERIF = ["En revisión", "Verificada", "Sin verificar"];
const FUENTES_VERIF = ["Declaración", "Documentación", "Visita a la propiedad", "Catastro / Registro"];
const FORMAS_TERRENO = ["", "Regular", "Irregular", "Rectangular", "Cuadrado", "Triangular", "En L"];
// Si la ficha trae un valor que no está en la lista (cargado antes), se agrega para no perderlo al guardar
const opcionesCon = (lista, actual) => (actual && !lista.includes(actual) ? [...lista, actual] : lista);

const sinTexto = (v) => v === undefined || v === null || String(v).trim() === "";

// Convierte lo que hay en el formulario en el JSON que entiende el backend (entidad Propiedad)
const armarPropiedad = (f) => {
  const p = {};
  for (const [k, v] of Object.entries(f)) {
    if (NO_ENVIAR.has(k)) continue;
    if (CAMPOS_NUM.has(k)) {
      const n = sinTexto(v) ? null : Number(String(v).replace(",", "."));
      p[k] = Number.isFinite(n) ? n : null;
    } else if (CAMPOS_FECHA.has(k)) {
      p[k] = sinTexto(v) ? null : v;
    } else if (typeof v === "string") {
      p[k] = v.trim() === "" ? null : v.trim();
    } else {
      p[k] = v;
    }
  }
  if (p.subtipo === "- Estándar -") p.subtipo = null;
  // Si el check está apagado no se guarda el tipo que quedó elegido por defecto
  if (!f.tieneClimatizacion) p.climatizacionTipo = null;
  if (!f.tieneInternet) { p.internetTipo = null; p.internetProveedor = null; }
  if (!f.tienePileta) { p.piletaTipo = null; p.piletaMedidas = null; }
  p.linkGoogleMaps = validarLinkGoogleMaps(f.linkGoogleMaps).ok ? (String(f.linkGoogleMaps || "").trim() || null) : null;

  // Coordenadas del mapa público
  const lat = sinTexto(f.latitud) ? null : Number(String(f.latitud).replace(",", "."));
  const lng = sinTexto(f.longitud) ? null : Number(String(f.longitud).replace(",", "."));
  p.latitud = Number.isFinite(lat) ? lat : null;
  p.longitud = Number.isFinite(lng) ? lng : null;

  // Título: si no lo escriben se arma solo
  p.titulo = sinTexto(f.titulo)
    ? `${etiquetaTipo(f.tipoInmueble)} en ${f.barrio || f.localidad || "Villa Carlos Paz"}`
    : f.titulo.trim();

  // Propietario: el backend espera el objeto, no el id suelto
  p.propietarioActual = f.idPropietarioActual ? { idPersona: Number(f.idPropietarioActual) } : null;

  // Datos que usa el sitio público (mapa y listado)
  const sup = Math.round(Number(f.supTotal) || Number(f.terSup) || Number(f.supCubierta) || 0);
  p.superficieTotalM2 = sup || null;
  p.superficieCubiertaM2 = Math.round(Number(f.supCubierta) || 0) || null;
  p.descripcion = p.descGral;
  p.zona = f.barrio || f.localidad || null;
  p.showExactLocation = !!f.dirExactaPublica;
  p.tieneGarage = Number(f.cantCocheras) > 0;
  p.tienePileta = !!f.tienePileta;
  p.vistaAlLago = (f.caractDestacadas || []).includes("Vista al lago");
  p.tieneGasNatural = (f.caractAguaGas || []).includes("Gas natural");
  p.tieneAsador = (f.caractExteriores || []).some(x => x === "Parrilla" || x === "Quincho");
  p.amenities = [...(f.caractDestacadas || []), ...(f.tienePileta ? ["Pileta"] : [])];

  const precio = Number(p.precio) || 0;
  const simbolo = simboloMoneda(f.moneda);
  const sufijo = f.tipoOperacion === "AlquilerPermanente" ? " / mes" : f.tipoOperacion === "AlquilerTemporario" ? " / noche" : "";
  p.priceStr = `${simbolo} ${precio.toLocaleString("es-AR")}${sufijo}`;
  return p;
};

// Largos máximos de las columnas de texto del backend
const LARGOS = {
  titulo: [150, "Título"], calle: [150, "Calle"], numero: [20, "Número"], barrio: [100, "Barrio"],
  localidad: [100, "Localidad"], provincia: [50, "Provincia"], subBarrio: [100, "Sub-barrio"],
  terForma: [50, "Forma del terreno"], torre: [20, "Torre"], bloque: [20, "Bloque"], uf: [20, "UF"], uc: [20, "UC"], catFinca: [50, "Finca"],
  codigoPostal: [10, "Código postal"], departamentoProv: [50, "Departamento"], legLitigios: [200, "Litigios"], servidumbres: [200, "Servidumbres"],
  ocpGarantia: [200, "Garantía"], obsSuperficies: [200, "Observaciones de superficies"],
  ubicacionLlaves: [200, "Ubicación de llaves"], legRestricciones: [200, "Restricciones"], legMedidasCautelares: [200, "Medidas cautelares"],
};
const ETIQUETA_NUM = {
  precio: "Precio", terLimFrente: "Límite frente", terLimFondo: "Límite fondo", terLimDerecho: "Lat. derecho", terLimIzquierdo: "Lat. izquierdo", supTitulo: "Sup. según título", supCatastro: "Sup. según catastro", supPlano: "Sup. según plano", supRelevada: "Sup. relevada",
  terSup: "Superficie del terreno", terFrente: "Frente", terFondo: "Fondo", supCubierta: "Sup. cubierta", supSemicubierta: "Sup. semicubierta",
  supDescubierta: "Sup. descubierta", supHabitable: "Sup. habitable", cantPlantas: "Plantas", cantAmbientes: "Ambientes", cantDormitorios: "Dormitorios",
  cantSuites: "Suites", cantBanos: "Baños", cantToilettes: "Toilettes", cantCocheras: "Cocheras", ediCantPisos: "Cant. pisos", ediExpensas: "Expensas",
  couExpensas: "Expensas", deudaInmobiliario: "Deuda inmobiliario", deudaMuni: "Deuda municipal", deudaExpensas: "Deuda expensas",
  rurHectareas: "Hectáreas", comisionPactada: "Honorarios", cantUnidades: "Cantidad de unidades",
  supTotal: "Sup. total", supConstruida: "Sup. construida", supPropia: "Sup. propia", supComunes: "Sup. común", supPH: "Sup. PH", supMensura: "Sup. según mensura",
  terFrente2: "Frente 2", terFondo2: "Fondo 2", terSupEsquina: "Sup. esquina", cantCocinas: "Cocinas", cantComedores: "Comedores", cantLivings: "Livings",
  antiguedad: "Antigüedad", ocpMonto: "Monto de ocupación", ediCantUnidades: "Unidades del edificio",
};

// Devuelve el primer problema del formulario (o "" si está todo bien)
const validarFormulario = (f) => {
  for (const [k, [max, nombre]] of Object.entries(LARGOS)) {
    if (String(f[k] ?? "").length > max) return `"${nombre}" es demasiado largo (máximo ${max} caracteres).`;
  }
  for (const [k, nombre] of Object.entries(ETIQUETA_NUM)) {
    if (sinTexto(f[k])) continue;
    const n = Number(String(f[k]).replace(",", "."));
    if (!Number.isFinite(n)) return `"${nombre}" tiene que ser un número.`;
    if (n < 0) return `"${nombre}" no puede ser negativo.`;
  }
  if (Number(f.comisionPactada) > 100) return "Los honorarios no pueden superar el 100%.";
  const anioMax = new Date().getFullYear() + 5;
  for (const [k, nombre] of [["anioConstruccion", "Año de construcción"], ["anioRemodelacion", "Año de remodelación"], ["anioAmpliacion", "Año de ampliación"]]) {
    if (sinTexto(f[k])) continue;
    const n = Number(f[k]);
    if (!Number.isInteger(n) || n < 1500 || n > anioMax) return `"${nombre}" no es un año válido.`;
  }
  const lm = validarLinkGoogleMaps(f.linkGoogleMaps);
  if (!lm.ok) return `Link de Google Maps: ${lm.error}`;
  return "";
};

// =========================================================================
// 3. ESTADO INICIAL BASE DE DATOS
// =========================================================================
const VACIO = {
  titulo: "", latitud: "", longitud: "",
  idPropietarioActual: "", esComplejo: false, cantUnidades: 0, unidadIdentificador: "",
  
  estadoFicha: "Activa", observacionesGenerales: "",
  tipoInmueble: "Casa", subtipo: "- Estándar -", usoActual: "Residencial", usoPotencial: "",
  tipoOperacion: "Venta", operacionesAdicionales: [], estadoPropiedad: "Disponible", 
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
  tieneInternet: false, internetTipo: "Fibra Óptica", internetProveedor: "",
  tieneClimatizacion: false, climatizacionTipo: "Calefacción Central (Radiadores)",
  
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

// Arma el estado del formulario a partir de una propiedad existente (modo edición)
const formDesdePropiedad = (pe) => {
  if (!pe) return VACIO;
  const base = { ...VACIO };
  Object.keys(VACIO).forEach(k => {
    const v = pe[k];
    if (v !== undefined && v !== null) base[k] = v;
  });
  base.idPropietarioActual = pe.propietarioActual?.idPersona ?? "";
  return base;
};

function PropiedadForm({ propiedadEditar, onGuardado, onCancelar, onEditarOtra, onCambioUnidades, complejoPadre }) {
  const [form, setForm] = useState(() => formDesdePropiedad(propiedadEditar));
  const [propietarios, setPropietarios] = useState([]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  
  const [fotosPend, setFotosPend] = useState([]);   // fotos elegidas que se suben al guardar
  const [docsPend, setDocsPend] = useState([]);     // PDF elegidos que se suben al guardar

  const [secciones, setSecciones] = useState({
    identificacion: true, ubicacion: false, catastro: false, terreno: false, construccion: false,
    ambientes: false, instalaciones: false, extras: false, legal: false, rural: false, descripcion: false, 
    comercial: false, multimedia: false
  });

  const linkMaps = validarLinkGoogleMaps(form.linkGoogleMaps);

  const [leyendoLink, setLeyendoLink] = useState(false);
  // Toma las coordenadas del link de Google Maps (primero directo; si es un link corto, el servidor lo abre)
  const coordenadasDelLink = async (link) => {
    const directas = coordenadasDeLink(link);
    if (directas) return directas;
    try {
      const { data } = await coordenadasDeLinkMaps(link);
      return data?.resultado || null;
    } catch { return null; }
  };
  const usarUbicacionDelLink = async () => {
    setLeyendoLink(true);
    const c = await coordenadasDelLink(linkMaps.link);
    setLeyendoLink(false);
    if (c) setForm(prev => ({ ...prev, latitud: c.lat, longitud: c.lng }));
    else avisar("No pude sacar la ubicación de ese link. Probá con el link largo (abrilo en Google Maps y copiá la dirección de la barra) o marcá el punto tocando el mapa.");
  };

  const toggleSec = (sec) => setSecciones({ ...secciones, [sec]: !secciones[sec] });

  useEffect(() => {
    getPersonas()
      .then(r => setPropietarios(soloClientesReales(r.data).map(p => ({
        idPersona: p.idPersona,
        nombreCompleto: p.dniCuit ? `${p.nombreCompleto} (${p.dniCuit})` : p.nombreCompleto
      }))))
      .catch(err => console.error("Error cargando propietarios:", err));
  }, []);

  // Al entrar en modo edición, sube a la parte de arriba donde está el formulario
  useEffect(() => {
    if (!propiedadEditar) return;
    document.querySelector('.main-content')?.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [propiedadEditar]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    if (name === "tipoOperacion") {
      // la principal no puede repetirse entre las adicionales
      setForm(prev => ({ ...prev, tipoOperacion: val, operacionesAdicionales: (prev.operacionesAdicionales || []).filter(o => o !== val) }));
      setErrores(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
      return;
    }
    setForm(prev => ({ ...prev, [name]: val }));
    setErrores(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));

    if (name === "esComplejo" && !checked) { setForm(prev => ({...prev, cantUnidades: 0})); }
    
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

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (guardando) return;
    const faltan = {};
    if (!form.idPropietarioActual) faltan.idPropietarioActual = "Elegí el propietario / comitente.";
    if (!(Number(form.precio) > 0)) faltan.precio = "Ingresá un precio mayor a cero.";
    if (!form.tipoInmueble) faltan.tipoInmueble = "Elegí el tipo de inmueble.";
    if (!form.tipoOperacion) faltan.tipoOperacion = "Elegí la operación.";
    setErrores(faltan);
    if (Object.keys(faltan).length) {
      setSecciones(sec => ({ ...sec, identificacion: true }));
      avisar("Faltan datos obligatorios: revisá los campos marcados en rojo.", "error");
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
      return;
    }

    const problema = validarFormulario(form);
    if (problema) { avisar(problema); return; }
    setGuardando(true);
    try {
      // Si todavía no tiene ubicación en el mapa, se busca sola a partir de la dirección
      let formFinal = form;
      let sinUbicar = false;
      const sinCoordenadas = sinTexto(form.latitud) || sinTexto(form.longitud);
      const hayDireccion = !sinTexto(form.calle) && !sinTexto(form.localidad);
      const lm = validarLinkGoogleMaps(form.linkGoogleMaps);
      if (sinCoordenadas && lm.ok && lm.link) {
        const c = await coordenadasDelLink(lm.link);
        if (c) formFinal = { ...form, latitud: c.lat, longitud: c.lng };
      }
      const siguenSinCoordenadas = sinTexto(formFinal.latitud) || sinTexto(formFinal.longitud);
      if (siguenSinCoordenadas && hayDireccion) {
        try {
          const r = await geocodificarDireccion(form);
          if (r) formFinal = { ...form, latitud: r.lat, longitud: r.lng };
          else sinUbicar = true;
        } catch {
          sinUbicar = true;
        }
      } else if (siguenSinCoordenadas) {
        sinUbicar = true;
      }

      const payload = armarPropiedad(formFinal);
      let idGuardada = propiedadEditar?.idPropiedad;
      if (idGuardada) {
        await updatePropiedad(idGuardada, payload);
      } else {
        const r = await createPropiedad(payload);
        idGuardada = r.data?.idPropiedad;
      }
      // Fotos y PDF elegidos: se suben ahora que la ficha ya tiene número
      const fallos = [];
      if (idGuardada && fotosPend.length > 0) {
        try { await subirFotosPropiedad(idGuardada, fotosPend); }
        catch (err) { fallos.push(`Fotos: ${err.response?.data?.error || err.message}`); }
      }
      if (idGuardada) {
        for (const d of docsPend) {
          try { await subirDocPropiedad(idGuardada, d.file, d.tipo, d.descripcion); }
          catch (err) { fallos.push(`"${d.file.name}": ${err.response?.data?.error || err.message}`); }
        }
      }
      avisar(`Propiedad "${payload.titulo}" guardada correctamente.` + (fallos.length ? `\n\nLa ficha se guardó, pero no se pudo subir:\n- ${fallos.join("\n- ")}\nAbrí la ficha otra vez para volver a intentarlo.` : "") + (sinUbicar
        ? "\n\nOjo: no pudimos ubicarla en el mapa, así que todavía no aparece como punto en el mapa público. Abrí la sección \"Ubicación\" y revisá la calle y la localidad, o tocá el mapa para marcar el punto."
        : ""));
      setForm(VACIO);
      setFotosPend([]);
      setDocsPend([]);
      if (onGuardado) onGuardado();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      avisar(`No se pudo guardar la propiedad: ${msg}`);
    } finally {
      setGuardando(false);
    }
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
        <span className="card-title" style={{fontSize: '1.3rem', color: 'white'}}><i className="fa-solid fa-building-circle-check"></i> {propiedadEditar ? "Editando Ficha Inmobiliaria" : "Alta Detallada de Ficha Inmobiliaria"}</span>
        <div style={{display: "flex", gap: "10px"}}>
          {propiedadEditar && <button type="button" className="btn btn-outline" style={{backgroundColor: "white"}} onClick={() => { setForm(VACIO); if (onCancelar) onCancelar(); }}>Cancelar edición</button>}
          <button type="button" className="btn btn-rojo" onClick={handleSubmit} disabled={guardando}><i className="fa-solid fa-save"></i> {guardando ? "Guardando..." : "Guardar Ficha"}</button>
        </div>
      </div>

      <div style={{padding: '30px', backgroundColor: 'var(--color-gris-fondo)'}}>
        
        {/* COMPLEJOS */}
        <div style={{backgroundColor: '#FFF', padding: '20px', borderRadius: '12px', border: form.esComplejo ? '2px solid var(--color-rojo)' : '1px solid var(--color-gris-borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '25px', boxShadow: 'var(--sombra-flat)'}}>
           <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
              <div style={{width: '45px', height: '45px', backgroundColor: form.esComplejo ? 'var(--color-rojo)' : '#eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: form.esComplejo ? 'white' : '#999', fontSize: '1.2rem'}}><i className="fa-solid fa-hotel"></i></div>
              <div><h4 style={{margin: 0}}>¿Es un Complejo o Emprendimiento?</h4><p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-gris-texto)'}}>Después de guardarla vas a poder crear sus unidades (Deptos, Cabañas…), cada una con su precio, fotos y estado.</p></div>
           </div>
           <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
              <div className="checkbox-group"><input type="checkbox" name="esComplejo" checked={form.esComplejo} onChange={handleChange} disabled={!!propiedadEditar?.idComplejo || Number(propiedadEditar?.cantUnidades) > 0} title={Number(propiedadEditar?.cantUnidades) > 0 ? "Para dejar de ser complejo primero eliminá sus unidades" : undefined} style={{transform: 'scale(1.5)'}} /><label style={{fontWeight: 'bold'}}>Activar Complejo</label></div>
              {propiedadEditar?.esComplejo && Number(propiedadEditar?.cantUnidades) > 0 && <span className="badge badge-blue">{propiedadEditar.cantUnidades} unidades</span>}
           </div>
        </div>

        {form.esComplejo && propiedadEditar?.esComplejo && propiedadEditar?.idPropiedad && (
          <UnidadesComplejo idComplejo={propiedadEditar.idPropiedad} moneda={form.moneda} onEditarUnidad={(id) => onEditarOtra && onEditarOtra(id)} onCambio={onCambioUnidades} />
        )}
        {form.esComplejo && !(propiedadEditar?.esComplejo && propiedadEditar?.idPropiedad) && (
          <p style={{fontSize: '0.85rem', color: '#8a5a00', background: '#FFF8E1', padding: '10px 14px', borderRadius: '8px', marginBottom: '25px'}}><i className="fa-solid fa-circle-info"></i> Guardá la ficha del complejo (dirección, precio base, propietario). Después, al abrirla de nuevo, vas a poder crear sus unidades: cada una con su precio, fotos y estado.</p>
        )}
        {propiedadEditar?.idComplejo && (
          <div style={{background: '#EEF6FF', border: '1px solid #b9d7f5', padding: '12px 16px', borderRadius: '10px', marginBottom: '25px', display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'}}>
            <span><i className="fa-solid fa-hotel"></i> Esta ficha es una <b>unidad</b> del complejo <b>{complejoPadre?.titulo || `#${propiedadEditar.idComplejo}`}</b>. La dirección y el punto del mapa se cambian desde el complejo.</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onEditarOtra && onEditarOtra(propiedadEditar.idComplejo)}><i className="fa-solid fa-arrow-left"></i> Volver al complejo</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* SEC 1: IDENTIFICACIÓN, OPERACIÓN Y PRECIO */}
          <div className="accordion-section" style={{backgroundColor: '#fff', borderRadius: '12px', marginBottom: '15px', boxShadow: 'var(--sombra-flat)'}}>
             <AccordionH id="identificacion" title="1. Identificación, Precio y Operación" icon="fa-tag" isOpen={secciones.identificacion} onToggle={toggleSec} />
             {secciones.identificacion && (
               <div style={{padding: '25px'}}>
                  <div className="form-row">
                    {propiedadEditar?.idComplejo && <InputG label="Identificador de la unidad (Ej: Depto 3B)" name="unidadIdentificador" maxLength={50} valorActual={form.unidadIdentificador} onChange={handleChange} />}
                    <InputG label="Título del aviso (si lo dejás vacío se arma solo)" name="titulo" col={3} ph="Ej: Chalet moderno a 3 cuadras de la peatonal" maxLength={150} valorActual={form.titulo} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{flex: 2}}>
                       <label>Propietario / Comitente<span className="req" aria-hidden="true">*</span></label>
                       <select name="idPropietarioActual" value={form.idPropietarioActual} onChange={handleChange} aria-invalid={errores.idPropietarioActual ? "true" : undefined}>
                          <option value="">- Asignar Cliente -</option>
                          {propietarios.map(p => <option key={p.idPersona} value={p.idPersona}>{p.nombreCompleto}</option>)}
                       </select>
                       {errores.idPropietarioActual && <small className="campo-error" role="alert">{errores.idPropietarioActual}</small>}
                    </div>
                  </div>

                  <div className="form-row" style={{backgroundColor: '#FFF8F8', padding: '15px', borderRadius: '8px', border: '1px solid #FFCDD2'}}>
                    <div className="form-group">
                       <label style={{color: 'var(--color-rojo)', fontWeight: 'bold'}}>Precio Base<span className="req" aria-hidden="true">*</span></label>
                       <div className="input-with-icon">
                          <i className="fa-solid fa-money-bill-wave"></i>
                          <input type="number" min="0" name="precio" aria-invalid={errores.precio ? "true" : undefined} onKeyDown={(e) => { if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault(); }} value={form.precio} onChange={handleChange} placeholder="Ej: 150000" />
                       </div>
                       {errores.precio && <small className="campo-error" role="alert">{errores.precio}</small>}
                    </div>
                    <div className="form-group">
                       <label style={{color: 'var(--color-rojo)', fontWeight: 'bold'}}>Moneda</label>
                       <select name="moneda" value={form.moneda} onChange={handleChange} style={{borderColor: '#FFCDD2'}}>
                          <option value="ARS">ARS - Pesos Argentinos</option>
                          <option value="USD">USD - Dólares</option>
                          <option value="EUR">EUR - Euros</option>
                       </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                       <label>Operación<span className="req" aria-hidden="true">*</span></label>
                       <select name="tipoOperacion" value={form.tipoOperacion} onChange={handleChange} aria-invalid={errores.tipoOperacion ? "true" : undefined}>
                          {OPERACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                       </select>
                       {errores.tipoOperacion && <small className="campo-error" role="alert">{errores.tipoOperacion}</small>}
                       <div style={{marginTop: 8, fontSize: '0.85rem'}}>
                         <span style={{color: 'var(--color-gris-texto)'}}>También se ofrece en (opcional):</span>
                         <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4}}>
                           {OPERACIONES.filter(([v]) => v !== form.tipoOperacion).map(([v, t]) => (
                             <label key={v} style={{display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'normal', cursor: 'pointer', margin: 0, whiteSpace: 'nowrap'}}>
                               <input type="checkbox" style={{width: 18, height: 18, minWidth: 18, padding: 0, margin: 0, flex: 'none', accentColor: 'var(--color-rojo)', cursor: 'pointer'}} checked={(form.operacionesAdicionales || []).includes(v)}
                                 onChange={(e) => setForm(prev => {
                                   const act = prev.operacionesAdicionales || [];
                                   return { ...prev, operacionesAdicionales: e.target.checked ? [...act, v] : act.filter(x => x !== v) };
                                 })} />
                               {t}
                             </label>
                           ))}
                         </div>
                         <small style={{color: 'var(--color-gris-texto)'}}>La operación principal define el precio y la ficha; las demás habilitan la propiedad para contratos de ese tipo.</small>
                       </div>
                    </div>
                    <div className="form-group">
                       <label>Estado de Propiedad</label>
                       <select name="estadoPropiedad" value={form.estadoPropiedad} onChange={handleChange}>
                          <option>Disponible</option><option>Reservada</option><option>Alquilada</option><option>Vendida</option><option>Permutada</option><option>Inactiva</option><option>Suspendida</option><option>EnObra</option>
                       </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group"><label>Tipo Inmueble<span className="req" aria-hidden="true">*</span></label><select name="tipoInmueble" value={form.tipoInmueble} onChange={handleChange} aria-invalid={errores.tipoInmueble ? "true" : undefined}>{TIPOS_INMUEBLE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>{errores.tipoInmueble && <small className="campo-error" role="alert">{errores.tipoInmueble}</small>}</div>
                    <div className="form-group"><label>Subtipo</label><select name="subtipo" value={form.subtipo} onChange={handleChange}>{SUBTIPOS_INMUEBLE.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="form-group"><label>Uso Actual</label><select name="usoActual" value={form.usoActual} onChange={handleChange}>{TIPOS_USO.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <InputG label="Uso Potencial" name="usoPotencial" valorActual={form.usoPotencial} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Estado de la ficha</label><select name="estadoFicha" value={form.estadoFicha} onChange={handleChange}>{opcionesCon(ESTADOS_FICHA, form.estadoFicha).map(o => <option key={o}>{o}</option>)}</select></div>
                    <div className="form-group"><label>Verificación de los datos</label><select name="estadoVerificacion" value={form.estadoVerificacion} onChange={handleChange}>{opcionesCon(ESTADOS_VERIF, form.estadoVerificacion).map(o => <option key={o}>{o}</option>)}</select></div>
                    <div className="form-group"><label>Fuente de la verificación</label><select name="fuenteVerificacion" value={form.fuenteVerificacion} onChange={handleChange}>{opcionesCon(FUENTES_VERIF, form.fuenteVerificacion).map(o => <option key={o}>{o}</option>)}</select></div>
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
                    <InputG label="Provincia" name="provincia" maxLength={50} valorActual={form.provincia} onChange={handleChange} />
                    <InputG label="Localidad / Ciudad" name="localidad" maxLength={100} valorActual={form.localidad} onChange={handleChange} />
                    <InputG label="Barrio" name="barrio" maxLength={100} valorActual={form.barrio} onChange={handleChange} list="listaBarrios" />
                    <InputG label="Sub-Barrio" name="subBarrio" maxLength={100} valorActual={form.subBarrio} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Calle Principal" name="calle" col={2} maxLength={150} valorActual={form.calle} onChange={handleChange} />
                    <InputG label="Número / Altura" name="numero" maxLength={20} valorActual={form.numero} onChange={handleChange} />
                    <InputG label="Piso" name="pisoDpto" valorActual={form.pisoDpto} onChange={handleChange} />
                    <InputG label="Depto/Unidad" name="casaUnidad" valorActual={form.casaUnidad} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Torre" name="torre" maxLength={20} valorActual={form.torre} onChange={handleChange} />
                    <InputG label="Bloque" name="bloque" maxLength={20} valorActual={form.bloque} onChange={handleChange} />
                    <InputG label="Código Postal" name="codigoPostal" maxLength={10} valorActual={form.codigoPostal} onChange={handleChange} />
                    <InputG label="Departamento (provincial)" name="departamentoProv" maxLength={50} valorActual={form.departamentoProv} onChange={handleChange} />
                  </div>
                  
                  <UbicacionMapa
                    calle={form.calle} numero={form.numero} barrio={form.barrio} localidad={form.localidad} provincia={form.provincia}
                    latitud={form.latitud} longitud={form.longitud}
                    onCambio={(lat, lng) => setForm(prev => ({ ...prev, latitud: lat, longitud: lng }))}
                  />

                  <GridChecks title="Características de la Ubicación" arrayName="caractUbicacion" options={CHK_CARACT_UBICACION} valoresActuales={form.caractUbicacion} onChangeCheck={handleArrayCheck} />

                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc'}}>
                     <div className="form-group" style={{flex: 2}}>
                        <label>Link de Google Maps (opcional)</label>
                        <input type="text" name="linkGoogleMaps" value={form.linkGoogleMaps ?? ""} onChange={handleChange} maxLength={500}
                          placeholder="https://maps.app.goo.gl/..." autoComplete="off" spellCheck={false}
                          style={!linkMaps.ok ? { borderColor: '#D32F2F' } : undefined} />
                        {!linkMaps.ok && <small style={{color: '#D32F2F', display: 'block', marginTop: '5px'}}><i className="fa-solid fa-triangle-exclamation"></i> {linkMaps.error}</small>}
                        {linkMaps.ok && linkMaps.link && (
                          <small style={{display: 'block', marginTop: '5px'}}>
                            <a href={linkMaps.link} target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-arrow-up-right-from-square"></i> Abrir en Google Maps</a>
                            <button type="button" className="btn btn-outline btn-sm" style={{marginLeft: '10px'}} disabled={leyendoLink} onClick={usarUbicacionDelLink}>
                                <i className="fa-solid fa-location-crosshairs"></i> {leyendoLink ? "Leyendo link..." : "Usar la ubicación de este link en el mapa"}
                              </button>
                          </small>
                        )}
                        {!form.linkGoogleMaps && <small style={{color: 'var(--color-gris-texto)', display: 'block', marginTop: '5px'}}>{LINK_MAPS_AYUDA}</small>}
                     </div>
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="dirExactaPublica" checked={form.dirExactaPublica} onChange={handleChange} /><label>Mostrar dirección exacta al público</label></div></div>
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
                  <div className="form-row">
                    <InputG label="Finca" name="catFinca" maxLength={50} valorActual={form.catFinca} onChange={handleChange} />
                    <InputG label="UF (unidad funcional)" name="uf" maxLength={20} valorActual={form.uf} onChange={handleChange} />
                    <InputG label="UC (unidad complementaria)" name="uc" maxLength={20} valorActual={form.uc} onChange={handleChange} />
                  </div>

                  {form.difSuperficies && (
                     <div className="animation-fade-in" style={{backgroundColor: '#FFF3E0', color: '#E65100', padding: '15px', borderRadius: '8px', border: '1px solid #FFCC80', marginBottom: '20px', fontWeight: 'bold'}}>
                        ⚠️ Se detectaron diferencias entre la superficie catastral y la relevada.
                     </div>
                  )}

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Superficies (M2)</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px'}}>
                    <InputG label="Sup. Según Título" name="supTitulo" type="number" min="0" valorActual={form.supTitulo} onChange={handleChange} />
                    <InputG label="Sup. Según Catastro" name="supCatastro" type="number" min="0" valorActual={form.supCatastro} onChange={handleChange} />
                    <InputG label="Sup. Según Plano" name="supPlano" type="number" min="0" valorActual={form.supPlano} onChange={handleChange} />
                    <InputG label="Sup. Relevada Real" name="supRelevada" type="number" min="0" valorActual={form.supRelevada} onChange={handleChange} />
                  </div>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', marginTop: '10px'}}>
                    <InputG label="Sup. según Mensura" name="supMensura" type="number" min="0" valorActual={form.supMensura} onChange={handleChange} />
                    <InputG label="Sup. PH" name="supPH" type="number" min="0" valorActual={form.supPH} onChange={handleChange} />
                    <InputG label="Observaciones de superficies" name="obsSuperficies" maxLength={200} valorActual={form.obsSuperficies} onChange={handleChange} />
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
                    <InputG label="Superficie Terreno (m2)" name="terSup" type="number" min="0" valorActual={form.terSup} onChange={handleChange} />
                    <InputG label="Frente (m)" name="terFrente" type="number" min="0" valorActual={form.terFrente} onChange={handleChange} />
                    <InputG label="Fondo (m)" name="terFondo" type="number" min="0" valorActual={form.terFondo} onChange={handleChange} />
                    <div className="form-group"><label>Orientación</label><select name="terOrientacion" value={form.terOrientacion} onChange={handleChange}><option>Norte</option><option>Sur</option><option>Este</option><option>Oeste</option><option>Noreste</option><option>Noroeste</option><option>Sudeste</option><option>Sudoeste</option></select></div>
                  </div>
                  
                  <div className="form-row">
                    <InputG label="Límite Frente" name="terLimFrente" type="number" min="0" valorActual={form.terLimFrente} onChange={handleChange} />
                    <InputG label="Límite Fondo" name="terLimFondo" type="number" min="0" valorActual={form.terLimFondo} onChange={handleChange} />
                    <InputG label="Lat. Derecho" name="terLimDerecho" type="number" min="0" valorActual={form.terLimDerecho} onChange={handleChange} />
                    <InputG label="Lat. Izquierdo" name="terLimIzquierdo" type="number" min="0" valorActual={form.terLimIzquierdo} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Frente 2 (esquina) (m)" name="terFrente2" type="number" min="0" valorActual={form.terFrente2} onChange={handleChange} />
                    <InputG label="Fondo 2 (esquina) (m)" name="terFondo2" type="number" min="0" valorActual={form.terFondo2} onChange={handleChange} />
                    <InputG label="Sup. de esquina (m2)" name="terSupEsquina" type="number" min="0" valorActual={form.terSupEsquina} onChange={handleChange} />
                    <div className="form-group"><label>Forma del terreno</label><select name="terForma" value={form.terForma} onChange={handleChange}>{opcionesCon(FORMAS_TERRENO, form.terForma).map(o => <option key={o}>{o}</option>)}</select></div>
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
                    <InputG label="Sup. Cubierta" name="supCubierta" type="number" min="0" valorActual={form.supCubierta} onChange={handleChange} />
                    <InputG label="Sup. Semicubierta" name="supSemicubierta" type="number" min="0" valorActual={form.supSemicubierta} onChange={handleChange} />
                    <InputG label="Sup. Descubierta" name="supDescubierta" type="number" min="0" valorActual={form.supDescubierta} onChange={handleChange} />
                    <InputG label="Sup. Habitable" name="supHabitable" type="number" min="0" valorActual={form.supHabitable} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Sup. Total" name="supTotal" type="number" min="0" valorActual={form.supTotal} onChange={handleChange} />
                    <InputG label="Sup. Construida" name="supConstruida" type="number" min="0" valorActual={form.supConstruida} onChange={handleChange} />
                    <InputG label="Sup. Propia" name="supPropia" type="number" min="0" valorActual={form.supPropia} onChange={handleChange} />
                    <InputG label="Sup. Común" name="supComunes" type="number" min="0" valorActual={form.supComunes} onChange={handleChange} />
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Antigüedad y Estado</h6>
                  <div className="form-row">
                    <div className="form-group"><label>Estado Conservación</label><select name="estadoConservacion" value={form.estadoConservacion} onChange={handleChange}>{ESTADOS_CONSERVACION.map(e => <option key={e}>{e}</option>)}</select></div>
                    <InputG label="Año Construcción" name="anioConstruccion" type="number" valorActual={form.anioConstruccion} onChange={handleChange} />
                    <InputG label="Año Remodelación" name="anioRemodelacion" type="number" valorActual={form.anioRemodelacion} onChange={handleChange} />
                    <div className="form-group"><label>Situación Construcción</label><select name="sitConstruccionRegistrada" value={form.sitConstruccionRegistrada} onChange={handleChange}><option>Registrada</option><option>Parcialmente Registrada</option><option>No registrada</option></select></div>
                  </div>
                  <div className="form-row">
                    <InputG label="Antigüedad (años)" name="antiguedad" type="number" min="0" valorActual={form.antiguedad} onChange={handleChange} />
                    <InputG label="Año Ampliación" name="anioAmpliacion" type="number" valorActual={form.anioAmpliacion} onChange={handleChange} />
                    <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="sitFinalObra" checked={form.sitFinalObra} onChange={handleChange}/><label>Tiene final de obra</label></div></div>
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Distribución (Cantidades)</h6>
                  <div className="form-row" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))'}}>
                    <InputG label="Plantas" name="cantPlantas" type="number" min="0" valorActual={form.cantPlantas} onChange={handleChange} />
                    <InputG label="Ambientes" name="cantAmbientes" type="number" min="0" valorActual={form.cantAmbientes} onChange={handleChange} />
                    <InputG label="Dormitorios" name="cantDormitorios" type="number" min="0" valorActual={form.cantDormitorios} onChange={handleChange} />
                    <InputG label="Suites" name="cantSuites" type="number" min="0" valorActual={form.cantSuites} onChange={handleChange} />
                    <InputG label="Baños" name="cantBanos" type="number" min="0" valorActual={form.cantBanos} onChange={handleChange} />
                    <InputG label="Toilettes" name="cantToilettes" type="number" min="0" valorActual={form.cantToilettes} onChange={handleChange} />
                    <InputG label="Cocheras" name="cantCocheras" type="number" min="0" valorActual={form.cantCocheras} onChange={handleChange} />
                    <InputG label="Cocinas" name="cantCocinas" type="number" min="0" valorActual={form.cantCocinas} onChange={handleChange} />
                    <InputG label="Comedores" name="cantComedores" type="number" min="0" valorActual={form.cantComedores} onChange={handleChange} />
                    <InputG label="Livings" name="cantLivings" type="number" min="0" valorActual={form.cantLivings} onChange={handleChange} />
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
                        <InputG label="Unidades del Edificio" name="ediCantUnidades" type="number" min="0" valorActual={form.ediCantUnidades} onChange={handleChange} />
                        <InputG label="Cant. Pisos Edificio" name="ediCantPisos" type="number" min="0" valorActual={form.ediCantPisos} onChange={handleChange} />
                        <InputG label="Expensas Comunes ($)" name="ediExpensas" type="number" min="0" valorActual={form.ediExpensas} onChange={handleChange} />
                        <InputG label="Amenities Edificio" name="ediAmenities" col={2} ph="Ej: SUM, Pileta..." valorActual={form.ediAmenities} onChange={handleChange} />
                     </div>
                  )}

                  {form.esParteDe === 'Barrio Privado / Country' && (
                     <div className="form-row animation-fade-in" style={{backgroundColor: '#F0F8FF', padding: '15px', borderRadius: '8px', marginTop: '15px', border: '1px solid #90CAF9'}}>
                        <InputG label="Nombre del Barrio" name="couNombre" valorActual={form.couNombre} onChange={handleChange} />
                        <InputG label="Lote N° / Etapa" name="couLote" valorActual={form.couLote} onChange={handleChange} />
                        <InputG label="Expensas ($)" name="couExpensas" type="number" min="0" valorActual={form.couExpensas} onChange={handleChange} />
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
                    <InputG label="Restricciones / Servidumbres" name="legRestricciones" maxLength={200} valorActual={form.legRestricciones} onChange={handleChange} />
                    <InputG label="Medidas Cautelares / Embargos" name="legMedidasCautelares" maxLength={200} valorActual={form.legMedidasCautelares} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <InputG label="Litigios" name="legLitigios" maxLength={200} valorActual={form.legLitigios} onChange={handleChange} />
                    <InputG label="Servidumbres" name="servidumbres" maxLength={200} valorActual={form.servidumbres} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{flex: 1}}><label>Observaciones legales</label><textarea name="obsLegales" value={form.obsLegales} onChange={handleChange} rows="3"></textarea></div>
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
                    <InputG label="Deuda Inmobiliario ($)" name="deudaInmobiliario" type="number" min="0" valorActual={form.deudaInmobiliario} onChange={handleChange} />
                    <InputG label="Deuda Municipal ($)" name="deudaMuni" type="number" min="0" valorActual={form.deudaMuni} onChange={handleChange} />
                    <InputG label="Deuda Expensas ($)" name="deudaExpensas" type="number" min="0" valorActual={form.deudaExpensas} onChange={handleChange} />
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
                        <InputG label="Total Hectáreas" name="rurHectareas" type="number" min="0" valorActual={form.rurHectareas} onChange={handleChange} />
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
                  {form.ocpEstado === "Alquilado" && (
                    <div className="form-row animation-fade-in" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', marginBottom: '20px'}}>
                      <InputG label="Monto del alquiler actual" name="ocpMonto" type="number" min="0" valorActual={form.ocpMonto} onChange={handleChange} />
                      <div className="form-group"><label>Moneda</label><select name="ocpMoneda" value={form.ocpMoneda} onChange={handleChange}><OpcionesMoneda /></select></div>
                      <InputG label="Garantía" name="ocpGarantia" maxLength={200} valorActual={form.ocpGarantia} onChange={handleChange} />
                    </div>
                  )}

                  <h6 style={{color: 'var(--color-negro)'}}>Descripciones Segmentadas</h6>
                  <div className="form-row">
                     <div className="form-group" style={{flex: 1}}><label>Descripción Pública General</label><textarea name="descGral" value={form.descGral} onChange={handleChange} rows="3"></textarea></div>
                     <div className="form-group" style={{flex: 1}}><label>Observaciones Internas (Privadas)</label><textarea name="obsInternas" value={form.obsInternas} onChange={handleChange} rows="3" style={{backgroundColor: '#FFF8F8', borderColor: '#FFCDD2'}}></textarea></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{flex: 1}}><label>Descripción de la construcción</label><textarea name="descConst" value={form.descConst} onChange={handleChange} rows="3"></textarea></div>
                    <div className="form-group" style={{flex: 1}}><label>Descripción de la ubicación / entorno</label><textarea name="descUbicacion" value={form.descUbicacion} onChange={handleChange} rows="3"></textarea></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{flex: 1}}><label>Observaciones técnicas</label><textarea name="obsTecnicas" value={form.obsTecnicas} onChange={handleChange} rows="3"></textarea></div>
                    <div className="form-group" style={{flex: 1}}><label>Observaciones generales</label><textarea name="observacionesGenerales" value={form.observacionesGenerales} onChange={handleChange} rows="3"></textarea></div>
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
                     <InputG label="Honorarios Profesionales (%)" name="comisionPactada" type="number" min="0" valorActual={form.comisionPactada} onChange={handleChange} />
                     <div className="form-group" style={{justifyContent: 'center'}}><div className="checkbox-group"><input type="checkbox" name="tieneExclusividad" checked={form.tieneExclusividad} onChange={handleChange}/><label>Exclusividad de Venta/Alquiler</label></div></div>
                     {form.tieneExclusividad && (
                        <div className="animation-fade-in" style={{flex: 1}}>
                           <InputG label="Vencimiento Exclusividad" name="fechaVencimientoExclusividad" type="date" valorActual={form.fechaVencimientoExclusividad} onChange={handleChange} />
                        </div>
                     )}
                  </div>

                  <h6 style={{color: 'var(--color-negro)', marginTop: '20px'}}>Cartelería y Acceso Físico</h6>
                  <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px'}}>
                     <InputG label="Ubicación de Llaves" name="ubicacionLlaves" ph="Ej: Llavero 45, Portería..." maxLength={200} valorActual={form.ubicacionLlaves} onChange={handleChange} col={2} />
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
                  <MultimediaPropiedad
                    idPropiedad={propiedadEditar?.idPropiedad}
                    fotosPend={fotosPend} setFotosPend={setFotosPend}
                    docsPend={docsPend} setDocsPend={setDocsPend}
                  />
               </div>
             )}
          </div>

        </form>
      </div>

    </div>
  );
}

export default PropiedadForm;
