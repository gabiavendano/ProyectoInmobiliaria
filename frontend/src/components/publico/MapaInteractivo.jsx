// src/components/publico/MapaInteractivo.jsx
import { API_BASE } from "../../config";
import { normalizarMoneda, simboloMoneda } from "../../utils/monedas";
import { apiFetch, haySesion, marcarSesion, limpiarSesion, cerrarSesion } from "../../services/api";
import RecortadorFoto from './RecortadorFoto';
import { fotosPublicas } from '../../utils/fotos';
import { etiquetaOperacion, etiquetaTipo, TIPOS_INMUEBLE, ICONO_TIPO } from '../../utils/propiedad';
import ConsultaModal from './ConsultaModal';
import CampoContrasena from '../common/CampoContrasena';
import { validarContrasena, AYUDA_CONTRASENA } from '../../utils/contrasena';
import { validarNombre, validarUsuario } from '../../utils/texto';
import CalendarioDisponibilidad from '../common/CalendarioDisponibilidad';
import { nochesEntreFechas } from '../../utils/fechas';
import { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import './MapaInteractivo.css';

const WHATSAPP_NUM = import.meta.env.VITE_WHATSAPP || "5493541557179";
const VCP_CENTER = [-31.4201, -64.4993];
const LS_FAV_KEY = 'delcastillo_favorites_v2';
const LS_THEME_KEY = 'delcastillo_dark_mode';

// ── Utilidades ───────────────────────────────────────────────────────────
const leerJSON = (clave, porDefecto) => {
    try { const v = JSON.parse(localStorage.getItem(clave)); return v ?? porDefecto; } catch { return porDefecto; }
};
const guardarJSON = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } };
const formatoMonto = new Intl.NumberFormat('es-AR');
const textoPrecio = (precio, moneda, priceStr) =>
    priceStr || `${simboloMoneda(moneda)} ${formatoMonto.format(precio || 0)}`;
// Resumen de la descripción para la ficha del mapa (sin IA): las primeras oraciones que entran en el largo
// máximo; si la primera ya es más larga, se corta en una palabra y se agrega "…"
const resumenDescripcion = (t, max = 220) => {
    const x = String(t || '').replace(/\s+/g, ' ').trim();
    if (x.length <= max) return x;
    const oraciones = x.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
    let acumulado = '';
    for (const o of oraciones) {
        if ((acumulado + o).trim().length > max) break;
        acumulado += o;
    }
    if (acumulado.trim().length >= 60) return acumulado.trim();
    return x.slice(0, max).replace(/\s+\S*$/, '') + '…';
};

// Convierte lo que manda el servidor al formato que usa la pantalla
const formatearPropiedad = (p) => {
    const moneda = normalizarMoneda(p.moneda);
    return {
        id: p.idPropiedad,
        operation: etiquetaOperacion(p.tipoOperacion),
        operations: (p.operaciones && p.operaciones.length ? p.operaciones : [p.tipoOperacion]).map(etiquetaOperacion),
        propertyType: etiquetaTipo(p.tipoInmueble),
        zone: p.zona || 'Sin zona',
        lat: p.latitud,
        lng: p.longitud,
        showExactLocation: p.showExactLocation !== false,
        title: p.titulo,
        moneda,
        priceStr: textoPrecio(p.precio, moneda, p.priceStr),
        priceNum: p.precio || 0,
        dateAdded: p.dateAdded || '',
        beds: p.cantDormitorios || 0,
        baths: p.cantBanos || 0,
        sqft: p.superficieTotalM2 || 0,
        agent: p.agent || 'Inmobiliaria Del Castillo',
        amenities: p.amenities || [],
        desc: p.descripcion || '',
        imgs: fotosPublicas(p.fotos),
        isComplex: p.esComplejo === true,
        unitsAvailable: p.unidadesDisponibles || 0,
        units: (p.unidades || []).map(u => {
            const mu = normalizarMoneda(u.moneda);
            return {
                id: u.idPropiedad,
                name: u.identificador || `Unidad ${u.idPropiedad}`,
                priceStr: textoPrecio(u.precio, mu, u.priceStr),
                rooms: u.cantAmbientes || 0,
                beds: u.cantDormitorios || 0,
                baths: u.cantBanos || 0,
                sqft: u.superficieTotalM2 || 0,
                type: etiquetaTipo(u.tipoInmueble)
            };
        })
    };
};

// Link directo a una propiedad: #/propiedad/12 (sirve para compartir y para el botón "atrás")
const RUTA_PROP = /^#\/propiedad\/(\d+)/;
const leerHash = () => (typeof window === 'undefined' ? '' : window.location.hash);
const suscribirHash = (cb) => {
    window.addEventListener('hashchange', cb);
    window.addEventListener('popstate', cb);
    return () => { window.removeEventListener('hashchange', cb); window.removeEventListener('popstate', cb); };
};
const idDesdeHash = (h) => { const m = RUTA_PROP.exec(h || ''); return m ? Number(m[1]) : null; };
const navegarHash = (h, reemplazar = false) => {
    const url = window.location.pathname + window.location.search + h;
    if (reemplazar) window.history.replaceState(null, '', url);
    else window.history.pushState({ dentro: true }, '', url);
    window.dispatchEvent(new Event('popstate'));
};
const linkPropiedad = (id) => `${window.location.origin}${window.location.pathname}#/propiedad/${id}`;
const ORDEN_MONEDA = { USD: 0, EUR: 1, ARS: 2 };
const FILTROS_VACIOS = { op: 'all', type: 'all', zone: 'all', minP: '', maxP: '', monedaP: 'USD', beds: '0', baths: '0', amenities: [] };

// Función Helper para WhatsApp
const fechaCorta = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };
const generateWA = (prop, fechas) => {
    const reserva = fechas?.desde && fechas?.hasta ? ` Quisiera reservar del ${fechaCorta(fechas.desde)} al ${fechaCorta(fechas.hasta)} (${nochesEntreFechas(fechas.desde, fechas.hasta)} noches).` : '';
    const text = `Hola ${prop.agent}, me interesa el inmueble "${prop.title}" (Ref: ${prop.id}) ubicado en ${prop.zone}. Operación: ${prop.operation} a ${prop.priceStr}.${reserva} ¿Podría brindarme más detalles? ${linkPropiedad(prop.id)}`;
    return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(text)}`;
};

// Componente de Tarjeta con Carrusel
const PropertyCard = ({ prop, isFav, onToggleFav, onOpenDetail }) => {
    const [imgIdx, setImgIdx] = useState(0);

    const nextImg = (e) => { e.stopPropagation(); setImgIdx((prev) => (prev + 1) % prop.imgs.length); };
    const prevImg = (e) => { e.stopPropagation(); setImgIdx((prev) => (prev - 1 + prop.imgs.length) % prop.imgs.length); };

    return (
        <div className="card" role="button" tabIndex={0} aria-label={`${prop.title}, ${prop.priceStr}`}
             onClick={() => onOpenDetail(prop)}
             onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenDetail(prop); } }}>
            <button className={`btn-fav ${isFav ? 'active' : ''}`} style={{position: 'absolute', top: 12, right: 12}}
                    aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'} aria-pressed={isFav}
                    onClick={(e) => onToggleFav(prop.id, e)}>
                <i className={`${isFav ? 'fa-solid' : 'fa-regular'} fa-heart`}></i>
            </button>
            <div className="card-img-box">
                <img src={prop.imgs[imgIdx]} loading="lazy" alt={prop.title} />
                <div className="card-badge">{prop.operation} | {prop.propertyType}</div>
                {prop.imgs.length > 1 && (
                    <>
                        <button className="carousel-btn left" aria-label="Foto anterior" onClick={prevImg}><i className="fa-solid fa-chevron-left"></i></button>
                        <button className="carousel-btn right" aria-label="Foto siguiente" onClick={nextImg}><i className="fa-solid fa-chevron-right"></i></button>
                        <div className="carousel-indicators">
                            {prop.imgs.map((_, i) => <span key={i} className={i === imgIdx ? 'active' : ''}></span>)}
                        </div>
                    </>
                )}
            </div>
            <div className="card-info">
                <div className="card-zone"><i className={`fa-solid ${prop.showExactLocation ? 'fa-location-dot' : 'fa-map'}`}></i> {prop.zone} {!prop.showExactLocation && "(Zona Aprox.)"}</div>
                <div className="card-price">{prop.priceStr}</div>
                <div className="card-title">{prop.title}</div>
                <div className="card-features">
                    {prop.isComplex && prop.unitsAvailable > 0 && <span><i className="fa-solid fa-hotel"></i> {prop.unitsAvailable} unidad{prop.unitsAvailable === 1 ? "" : "es"} disponible{prop.unitsAvailable === 1 ? "" : "s"}</span>}
                    <span><i className="fa-solid fa-ruler-combined"></i> {prop.sqft}m²</span>
                    {prop.beds > 0 && <span><i className="fa-solid fa-bed"></i> {prop.beds}</span>}
                    {prop.baths > 0 && <span><i className="fa-solid fa-bath"></i> {prop.baths}</span>}
                </div>
            </div>
        </div>
    );
};

// Datos de la ficha (m², dormitorios, baños): solo los que tienen valor; un complejo muestra sus unidades
const datosFicha = (p) => {
    if (p.isComplex) return p.unitsAvailable > 0 ? [['fa-hotel', `${p.unitsAvailable} unidad${p.unitsAvailable === 1 ? '' : 'es'} disponible${p.unitsAvailable === 1 ? '' : 's'}`]] : [];
    return [
        p.sqft > 0 ? ['fa-ruler-combined', `${p.sqft} m²`] : null,
        p.beds > 0 ? ['fa-bed', `${p.beds} dor.`] : null,
        p.baths > 0 ? ['fa-bath', `${p.baths} bñ.`] : null
    ].filter(Boolean);
};

export default function MapaInteractivo({ onGoToAdmin }) {
    const [vista, setVista] = useState('map');                       // map | list | fav | about (el detalle sale del link #/propiedad/ID)
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [isClientLoggedIn, setIsClientLoggedIn] = useState(() => {
        return haySesion();
    });
    const [loginView, setLoginView] = useState('cliente'); // 'cliente' | 'agente'
    const [clienteModalMode, setClienteModalMode] = useState('login'); // 'login' | 'register'
    const [clienteEmail, setClienteEmail] = useState('');
    const [clientePassword, setClientePassword] = useState('');
    const [clienteNombre, setClienteNombre] = useState('');
    const [clientePassword2, setClientePassword2] = useState('');
    const [agenteEmail, setAgenteEmail] = useState('');
    const [agentePassword, setAgentePassword] = useState('');
    const [loginMsg, setLoginMsg] = useState('');
    const [loginCargando, setLoginCargando] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [fotoParaRecortar, setFotoParaRecortar] = useState(null);   // foto elegida, pendiente de recorte
    const [profileData, setProfileData] = useState({
        nombre: '',
        apellido: '',
        username: haySesion() ? 'loading...' : '',
        telefono: '',
        foto: ''
    });
    const [favorites, setFavorites] = useState(() => (haySesion() ? leerJSON(LS_FAV_KEY, []) : []));
    const [expandedFilters, setExpandedFilters] = useState(false);
    const [darkMode, setDarkMode] = useState(() => leerJSON(LS_THEME_KEY, false));

    const [filters, setFilters] = useState(FILTROS_VACIOS);
    const [sortMethod, setSortMethod] = useState('recent');

    const [sidebarProp, setSidebarProp] = useState(null);
    const [consultaProp, setConsultaProp] = useState(null);   // propiedad sobre la que se está escribiendo una consulta
    const [imgSel, setImgSel] = useState({ id: null, idx: 0 });
    const [ocupacionDetalle, setOcupacionDetalle] = useState({ id: null, datos: [] });   // calendario de alquiler temporario
    const [fechasSel, setFechasSel] = useState({ id: null, desde: '', hasta: '' });

    const [propiedades, setPropiedades] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(false);
    const [recarga, setRecarga] = useState(0);
    const [aviso, setAviso] = useState(null);

    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const clusterGroupRef = useRef(null);
    const favoriteMapRef = useRef({}); // Mapea idPropiedad → idFavorito del backend
    const ajustarRef = useRef(false);  // true cuando el usuario cambió un filtro: el mapa se reencuadra sobre los resultados
    const avisoTimer = useRef(null);

    // Mensaje corto flotante (reemplaza a los alert())
    const avisar = useCallback((texto) => {
        setAviso(texto);
        clearTimeout(avisoTimer.current);
        avisoTimer.current = setTimeout(() => setAviso(null), 3800);
    }, []);

    // Cierra la sesión de cliente en este navegador
    const cerrarSesionLocal = () => {
        limpiarSesion();
        ['inmobiliaria_panel', 'inmobiliaria_user', 'cliente_id', 'cliente_nombre',
         'cliente_apellido', 'cliente_telefono', 'cliente_foto', LS_FAV_KEY].forEach(k => {
            try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ }
        });
        favoriteMapRef.current = {};
        setFavorites([]);
        setIsClientLoggedIn(false);
        setShowProfileDropdown(false);
        setShowProfileModal(false);
        setProfileData({ nombre: '', apellido: '', username: '', telefono: '', foto: '' });
    };

    // ── Propiedad abierta (viene del link #/propiedad/ID) ──────────────────
    const hash = useSyncExternalStore(suscribirHash, leerHash, () => '');
    const idHash = idDesdeHash(hash);
    const detailProp = useMemo(
        () => (idHash === null ? null : propiedades.find(p => p.id === idHash) || null),
        [idHash, propiedades]
    );
    const view = detailProp ? 'detail' : vista;
    const idDetalle = detailProp ? detailProp.id : null;
    const opDetalle = detailProp ? detailProp.operation : null;
    const mainImageIdx = imgSel.id === idDetalle ? imgSel.idx : 0;
    const fechasElegidas = fechasSel.id === idDetalle ? fechasSel : { desde: '', hasta: '' };

    // Carga el perfil si ya hay una sesión abierta
    useEffect(() => {
        if (haySesion() && profileData.username === 'loading...') {
            apiFetch('/auth/me')
            .then(res => {
                if (res.status === 401) { cerrarSesionLocal(); return null; }
                return res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status));
            })
            .then(data => {
                if (data && data.username) {
                    setProfileData({
                        username: data.username,
                        nombre: data.nombre || '',
                        apellido: data.apellido || '',
                        telefono: data.telefono || '',
                        foto: data.foto || ''
                    });
                }
            })
            .catch(err => console.error('Error cargando perfil:', err));
        }
    }, [profileData.username]);

    // Propiedades publicadas (si el servidor falla se muestra un aviso con "Reintentar", nunca datos de ejemplo)
    useEffect(() => {
        let activo = true;
        fetch(`${API_BASE}/propiedades/publicas`)
            .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(data => {
                if (!activo) return;
                setPropiedades(Array.isArray(data) ? data.map(formatearPropiedad) : []);
                setErrorCarga(false);
            })
            .catch(() => { if (activo) setErrorCarga(true); })
            .finally(() => { if (activo) setCargando(false); });
        return () => { activo = false; };
    }, [recarga]);

    const reintentarCarga = () => { setCargando(true); setErrorCarga(false); setRecarga(n => n + 1); };

    // Favoritos del usuario (se piden al servidor: es la fuente de verdad)
    const cargarFavoritos = useCallback(async () => {
        try {
            const res = await apiFetch('/favoritos/mios');
            if (!res.ok) return;
            const lista = await res.json();
            const mapa = {};
            const ids = [];
            (Array.isArray(lista) ? lista : []).forEach(f => {
                const id = f.idPropiedad ?? f.propiedad?.id;
                if (id != null) { ids.push(id); mapa[id] = f.idFavorito; }
            });
            favoriteMapRef.current = mapa;
            setFavorites(ids);
            guardarJSON(LS_FAV_KEY, ids);
        } catch { /* sin conexión: quedan los de este dispositivo */ }
    }, []);

    useEffect(() => {
        if (!haySesion()) return;
        const t = setTimeout(() => cargarFavoritos(), 0);
        return () => clearTimeout(t);
    }, [cargarFavoritos]);

    useEffect(() => { guardarJSON(LS_THEME_KEY, darkMode); }, [darkMode]);

    // Escape cierra lo que esté abierto (de arriba hacia abajo)
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape' || consultaProp || fotoParaRecortar) return;
            if (showProfileModal) setShowProfileModal(false);
            else if (isLoginModalOpen) setLoginModalOpen(false);
            else if (showProfileDropdown) setShowProfileDropdown(false);
            else if (sidebarProp) setSidebarProp(null);
            else if (expandedFilters) setExpandedFilters(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [consultaProp, fotoParaRecortar, showProfileModal, isLoginModalOpen, showProfileDropdown, sidebarProp, expandedFilters]);

    // Un link a una propiedad que ya no está publicada vuelve al inicio con un aviso
    useEffect(() => {
        if (cargando || errorCarga || idHash === null || detailProp) return;
        navegarHash('', true);
        setTimeout(() => avisar('Esa propiedad ya no está disponible.'), 0);
    }, [cargando, errorCarga, idHash, detailProp, avisar]);

    useEffect(() => {
        document.title = detailProp ? `${detailProp.title} · Inmobiliaria Del Castillo` : 'Inmobiliaria Del Castillo';
    }, [detailProp]);

    // Fechas ocupadas del alquiler temporario abierto
    useEffect(() => {
        if (idDetalle === null || opDetalle !== 'Alquiler Temporario' || !Number.isInteger(idDetalle)) return;
        let activo = true;
        fetch(`${API_BASE}/propiedades/publicas/${idDetalle}/ocupacion`)
            .then(r => (r.ok ? r.json() : []))
            .catch(() => [])
            .then(datos => { if (activo) setOcupacionDetalle({ id: idDetalle, datos: Array.isArray(datos) ? datos : [] }); });
        return () => { activo = false; };
    }, [idDetalle, opDetalle]);

    // El mapa se redibuja bien al volver a mostrarse
    useEffect(() => {
        if (view !== 'map') return;
        const t = setTimeout(() => mapRef.current?.invalidateSize(), 120);
        return () => clearTimeout(t);
    }, [view]);

    const cambiarFiltros = (nuevos) => { ajustarRef.current = true; setFilters(nuevos); };

    const amenidadesDisponibles = useMemo(
        () => [...new Set(propiedades.flatMap(p => p.amenities))].sort((a, b) => a.localeCompare(b, 'es')),
        [propiedades]
    );

    const zonas = useMemo(
        () => [...new Set(propiedades.map(p => p.zone).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es')),
        [propiedades]
    );

    // Filtrado de propiedades (usando datos de la API)
    const filteredProps = useMemo(() => {
        const hayPrecio = filters.minP !== '' || filters.maxP !== '';
        return propiedades.filter(p => {
            if (filters.op !== 'all' && !(p.operations || [p.operation]).includes(filters.op)) return false;
            if (filters.type !== 'all' && p.propertyType !== filters.type) return false;
            if (filters.zone !== 'all' && p.zone !== filters.zone) return false;
            if (hayPrecio) {
                if (p.moneda !== filters.monedaP) return false;     // no se comparan monedas distintas entre sí
                if (filters.minP !== '' && p.priceNum < Number(filters.minP)) return false;
                if (filters.maxP !== '' && p.priceNum > Number(filters.maxP)) return false;
            }
            if (p.beds < Number(filters.beds)) return false;
            if (p.baths < Number(filters.baths)) return false;
            if (filters.amenities.length) {
                const tiene = p.amenities.map(x => String(x).toLowerCase());
                if (!filters.amenities.every(a => tiene.includes(a.toLowerCase()))) return false;
            }
            return true;
        }).sort((a, b) => {
            if (sortMethod === 'priceAsc' || sortMethod === 'priceDesc') {
                const m = (ORDEN_MONEDA[a.moneda] ?? 3) - (ORDEN_MONEDA[b.moneda] ?? 3);   // primero dólares, después euros y por último pesos
                if (m !== 0) return m;
                return sortMethod === 'priceAsc' ? a.priceNum - b.priceNum : b.priceNum - a.priceNum;
            }
            return (b.dateAdded || '').localeCompare(a.dateAdded || '');
        });
    }, [propiedades, filters, sortMethod]);

    const handleMarkerClick = (prop) => {
        setSidebarProp(prop);
        if (!mapRef.current || !Number.isFinite(prop.lat) || !Number.isFinite(prop.lng)) return;
        const mapa = mapRef.current;
        if (window.innerWidth > 768) {
            mapa.panTo([prop.lat, prop.lng - 0.008], {animate: true, duration: 0.5});
        } else {
            // En el celular la ficha tapa la parte de abajo: el pin queda en la parte de arriba
            const z = mapa.getZoom();
            const punto = mapa.project([prop.lat, prop.lng], z).add([0, window.innerHeight * 0.17]);
            mapa.panTo(mapa.unproject(punto, z), {animate: true, duration: 0.5});
        }
    };

    // Inicialización y actualización de Leaflet con soporte mixto (Exacto + Zona)
    useEffect(() => {
        if (!window.L) return;

        const tileUrl = darkMode 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3sqn_1_2055a536ea9bed4114189ae2' 
            : 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3sqn_1_2055a536ea9bed4114189ae2';

        if (!mapRef.current && document.getElementById('map-container')) {
            mapRef.current = window.L.map('map-container', { zoomControl: false }).setView(VCP_CENTER, 14);
            window.L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
            window.L.tileLayer(tileUrl, { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(mapRef.current);

            mapRef.current.on('click', () => setSidebarProp(null));
        } else if (mapRef.current) {
            mapRef.current.eachLayer(layer => {
                if (layer instanceof window.L.TileLayer) {
                    layer.setUrl(tileUrl);
                }
            });
        }

        // Limpiar capas previas
        if (clusterGroupRef.current && mapRef.current) {
            mapRef.current.removeLayer(clusterGroupRef.current);
        }
        markersRef.current.forEach(layer => {
            if (mapRef.current && mapRef.current.hasLayer(layer)) {
                mapRef.current.removeLayer(layer);
            }
        });
        markersRef.current = [];
        clusterGroupRef.current = null;

        let currentCluster = null;
        if (window.L.markerClusterGroup) {
            currentCluster = window.L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 40 });
            clusterGroupRef.current = currentCluster;
        }

        const puntos = [];
        // Procesar cada propiedad según su configuración de ubicación
        filteredProps.forEach(prop => {
            // Sin coordenadas válidas la propiedad sigue en el listado, pero no se dibuja en el mapa
            if (!Number.isFinite(prop.lat) || !Number.isFinite(prop.lng)) return;
            puntos.push([prop.lat, prop.lng]);
            let typeClass = prop.operation.replace(/\s+/g, '');
            let iconSymbol = ICONO_TIPO[prop.propertyType] || 'fa-house';

            const icon = window.L.divIcon({
                className: 'custom-marker',
                html: `<div class="custom-marker-icon marker-${typeClass}"><i class="fa-solid ${iconSymbol}"></i></div>`,
                iconSize: [36, 36], iconAnchor: [18, 36]
            });

            if (prop.showExactLocation !== false) {
                // UBICACIÓN EXACTA: Solo pin directo
                const marker = window.L.marker([prop.lat, prop.lng], { icon: icon }).on('click', () => handleMarkerClick(prop));
                if (currentCluster) {
                    currentCluster.addLayer(marker);
                } else if (mapRef.current) {
                    marker.addTo(mapRef.current);
                    markersRef.current.push(marker);
                }
            } else {
                // UBICACIÓN APROXIMADA: Círculo de zona + pin en el centro
                let typeColor = '#D32F2F';
                if(prop.operation === 'Alquiler Anual') typeColor = '#1976D2';
                if(prop.operation === 'Alquiler Temporario') typeColor = '#F57C00';
                if(prop.operation === 'Permuta') typeColor = '#7B1FA2';

                const circle = window.L.circle([prop.lat, prop.lng], { 
                    color: typeColor, fillColor: typeColor, fillOpacity: 0.18, weight: 2, radius: 450 
                }).on('click', () => handleMarkerClick(prop));
                
                if (mapRef.current) {
                    circle.addTo(mapRef.current);
                    markersRef.current.push(circle);
                }

                const centerMarker = window.L.marker([prop.lat, prop.lng], { icon: icon }).on('click', () => handleMarkerClick(prop));
                if (currentCluster) {
                    currentCluster.addLayer(centerMarker);
                } else if (mapRef.current) {
                    centerMarker.addTo(mapRef.current);
                    markersRef.current.push(centerMarker);
                }
            }
        });

        if (currentCluster && mapRef.current) {
            mapRef.current.addLayer(currentCluster);
        }

        // Si el usuario cambió un filtro, el mapa se acomoda para mostrar los resultados
        if (ajustarRef.current && view === 'map' && mapRef.current) {
            ajustarRef.current = false;
            if (puntos.length === 1) mapRef.current.setView(puntos[0], 16);
            else if (puntos.length > 1) mapRef.current.fitBounds(puntos, { padding: [70, 70], maxZoom: 16 });
        }

    }, [filteredProps, view, darkMode]);

    const switchView = (nueva) => {
        if (idDesdeHash(window.location.hash) !== null) navegarHash('', true);
        setVista(nueva);
        if (nueva !== 'map') setSidebarProp(null);
    };

    // Favoritos: el servidor es la fuente de verdad; si algo falla, se avisa y no se cambia nada
    const toggleFavorite = async (id, e) => {
        if (e) e.stopPropagation();
        if (!isClientLoggedIn) return setLoginModalOpen(true);

        if (!haySesion()) { cerrarSesionLocal(); return setLoginModalOpen(true); }

        const esFav = favorites.includes(id);
        try {
            let nuevos;
            if (esFav) {
                let favId = favoriteMapRef.current[id];
                if (!favId) { await cargarFavoritos(); favId = favoriteMapRef.current[id]; }
                if (favId) {
                    const r = await apiFetch(`/favoritos/${favId}`, { method: 'DELETE' });
                    if (r.status === 401) { cerrarSesionLocal(); setLoginModalOpen(true); return; }
                    if (!r.ok && r.status !== 400) throw new Error('HTTP ' + r.status);
                }
                const resto = { ...favoriteMapRef.current };
                delete resto[id];
                favoriteMapRef.current = resto;
                nuevos = favorites.filter(f => f !== id);
            } else {
                const r = await apiFetch('/favoritos/agregar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idPropiedad: id })
                });
                if (r.status === 401) { cerrarSesionLocal(); setLoginModalOpen(true); return; }
                const data = await r.json().catch(() => ({}));
                if (!r.ok) { avisar(data.error || 'No se pudo guardar el favorito.'); return; }
                if (data.favorito?.idFavorito) favoriteMapRef.current = { ...favoriteMapRef.current, [id]: data.favorito.idFavorito };
                nuevos = [...favorites, id];
            }
            setFavorites(nuevos);
            guardarJSON(LS_FAV_KEY, nuevos);
        } catch {
            avisar('No pudimos actualizar tus favoritos. Revisá tu conexión e intentá de nuevo.');
        }
    };

    // Consultar por una propiedad: hay que estar logueado (así el agente sabe quién es y puede responderle)
    const abrirConsulta = (prop) => {
        if (!isClientLoggedIn) return setLoginModalOpen(true);
        setConsultaProp(prop);
    };

    const openDetail = (prop) => {
        setSidebarProp(null);
        navegarHash('#/propiedad/' + prop.id);
    };

    const volverDelDetalle = () => {
        if (window.history.state && window.history.state.dentro) window.history.back();
        else navegarHash('', true);
    };

    const compartir = async (prop) => {
        const url = linkPropiedad(prop.id);
        try {
            if (navigator.share) { await navigator.share({ title: prop.title, text: prop.title, url }); return; }
            await navigator.clipboard.writeText(url);
            avisar('Link copiado. Ya podés pegarlo donde quieras.');
        } catch { /* el usuario canceló */ }
    };

    // ── Acceso (login / registro) ───────────────────────────────────────────
    const postJson = async (ruta, cuerpo) => {
        const res = await apiFetch(ruta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    };
    const mensajeError = (r, porDefecto) =>
        r.data?.error || (r.status === 429 ? 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' : porDefecto);

    // Actualizar datos del usuario en UI después del login
    const actualizarUsuario = () => {
        if (!haySesion()) return;
        apiFetch('/auth/me')
            .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
            .then(data => {
                const usuario = data.usuario || data;
                if (usuario.username) {
                    localStorage.setItem('inmobiliaria_user', JSON.stringify({ id: usuario.id, username: usuario.username, rol: usuario.rol }));
                    setIsClientLoggedIn(true);
                    setProfileData({
                        nombre: usuario.nombre || '',
                        apellido: usuario.apellido || '',
                        username: usuario.username || '',
                        telefono: usuario.telefono || '',
                        foto: usuario.foto || ''
                    });
                }
            })
            .catch(() => setIsClientLoggedIn(true));
    };

    // Devuelve '' si salió bien o el mensaje de error
    const iniciarSesionCliente = async (email, password) => {
        const r = await postJson('/auth/login', { username: email, password });
        if (!r.ok) return mensajeError(r, 'Credenciales inválidas');
        marcarSesion();
        localStorage.removeItem('inmobiliaria_panel');
        setIsClientLoggedIn(true);
        setLoginModalOpen(false);
        actualizarUsuario();
        cargarFavoritos();
        return '';
    };

    const enviarCliente = async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get('email') || '').trim();
        const password = String(f.get('password') || '');
        setLoginMsg('');
        if (clienteModalMode === 'register') {
            if (!clienteNombre.trim()) { setLoginMsg('Escribí tu nombre.'); return; }
            const problemaTexto = validarNombre(clienteNombre, 'nombre') || validarUsuario(email);
            if (problemaTexto) { setLoginMsg(problemaTexto); return; }
            const problemaClave = validarContrasena(password, email);
            if (problemaClave) { setLoginMsg(problemaClave); return; }
            if (password !== clientePassword2) { setLoginMsg('Las contraseñas no coinciden.'); return; }
        }
        setLoginCargando(true);
        try {
            if (clienteModalMode === 'register') {
                const r = await postJson('/auth/register', { username: email, password, nombre: clienteNombre.trim(), rol: 'CLIENTE' });
                if (!r.ok) { setLoginMsg(mensajeError(r, 'No se pudo crear la cuenta.')); return; }
            }
            const err = await iniciarSesionCliente(email, password);
            if (err) { setClienteModalMode('login'); setLoginMsg(clienteModalMode === 'register' ? `Tu cuenta se creó, pero no pudimos ingresar: ${err}` : err); }
            else { setClienteNombre(''); setClientePassword(''); setClientePassword2(''); }
        } catch {
            setLoginMsg('No hay conexión con el servidor. Probá de nuevo en un momento.');
        } finally {
            setLoginCargando(false);
        }
    };

    const enviarAgente = async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setLoginMsg('');
        setLoginCargando(true);
        try {
            const r = await postJson('/auth/login', { username: String(f.get('email') || '').trim(), password: String(f.get('password') || '') });
            if (!r.ok) { setLoginMsg(mensajeError(r, 'Credenciales inválidas')); return; }
            const rol = r.data.usuario?.rol;
            if (rol !== 'ADMIN' && rol !== 'AGENTE') { setLoginMsg('Esta cuenta no tiene acceso al Panel de Agentes. Usá el acceso de clientes.'); return; }
            marcarSesion();
            localStorage.setItem('inmobiliaria_panel', '1');
            setLoginModalOpen(false);
            onGoToAdmin(true);
        } catch {
            setLoginMsg('No hay conexión con el servidor. Probá de nuevo en un momento.');
        } finally {
            setLoginCargando(false);
        }
    };

    const abrirLogin = (modo = 'login') => {
        setLoginMsg('');
        setLoginView('cliente');
        setClienteModalMode(modo);
        setLoginModalOpen(true);
    };

    const sinMapa = typeof window !== 'undefined' && !window.L;

    return (
        <div className={`public-app-body ${darkMode ? 'dark-theme' : ''}`}>
            {/* TOPBAR */}
            <header className="topbar">
                <div className="topbar-left">
                    <img src="/Logo Inmobiliaria.jpg" alt="Inmobiliaria Del Castillo" className="topbar-logo" />
                    <span className="brand-title">Inmobiliaria Del Castillo</span>
                </div>
                <div className="topbar-center">
                    <button className={`nav-btn ${view === 'map' ? 'active' : ''}`} onClick={() => switchView('map')}><i className="fa-solid fa-map-location-dot"></i> <span>Mapa</span></button>
                    <button className={`nav-btn ${view === 'list' ? 'active' : ''}`} onClick={() => switchView('list')}><i className="fa-solid fa-border-all"></i> <span>Listado</span></button>
                    <button className={`nav-btn ${view === 'fav' ? 'active' : ''}`} onClick={() => switchView('fav')}><i className="fa-regular fa-heart"></i> <span>Favoritos</span></button>
                    <button className={`nav-btn ${view === 'about' ? 'active' : ''}`} onClick={() => switchView('about')}><i className="fa-solid fa-circle-info"></i> <span>Nosotros</span></button>
                </div>
                <div className="topbar-right" style={{ gap: '15px' }}>
                    <button className={`btn-dark-mode`} onClick={() => setDarkMode(!darkMode)} title="Alternar modo oscuro" aria-label="Alternar modo oscuro" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid var(--color-gris-borde)', borderRadius: '8px', padding: '6px 10px' }}>
                        <i className={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
                    </button>
                    {isClientLoggedIn ? (
                        // DROPDOWN DE PERFIL PARA CLIENTE LOGUEADO
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => {
                                    if (showProfileModal) {
                                        setShowProfileModal(false);
                                    } else {
                                        setShowProfileDropdown(!showProfileDropdown);
                                    }
                                }}
                                style={{
                                    padding: '8px 12px',
                                    background: 'var(--color-blanco)',
                                    color: 'var(--color-negro)',
                                    border: '1px solid var(--color-gris-borde)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <i className="fa-solid fa-user"></i>
                                Mi Perfil
                                <i className={`fa-solid fa-chevron-down ${showProfileDropdown ? 'fa-rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                            </button>

                            {showProfileDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '5px',
                                    background: 'var(--color-blanco)',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                                    minWidth: '180px',
                                    padding: '8px 0',
                                    overflow: 'hidden',
                                    zIndex: 1000
                                }}>
                                    <button
                                        onClick={() => { setShowProfileDropdown(false); setShowProfileModal(true); }}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--color-negro)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <i className="fa-solid fa-user-circle" style={{ fontSize: '1.2rem', color: '#4ECDC4' }}></i>
                                        Ver Perfil
                                    </button>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-gris-borde)', margin: '4px 0' }} />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            cerrarSesion();
                                            cerrarSesionLocal();
                                            abrirLogin();
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#FF6B6B',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <i className="fa-solid fa-right-from-bracket"></i>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button className={`btn btn-negro`} onClick={() => abrirLogin()}>
                            <i className="fa-solid fa-user"></i> Ingresar
                        </button>
                    )}
                </div>
            </header>

            <main className="app-container">
                {/* BUSCADOR */}
                {(view === 'map' || view === 'list') && (
                    <div className="search-container">
                        <div className="unified-search-bar">
                            <div className="search-field">
                                <label className="search-label">Operación</label>
                                <select className="search-select" value={filters.op} onChange={e => cambiarFiltros({...filters, op: e.target.value})}>
                                    <option value="all">Cualquiera</option><option value="Venta">Venta</option><option value="Alquiler Anual">Alquiler Anual</option><option value="Alquiler Temporario">Alq. Temporario</option><option value="Permuta">Permuta</option>
                                </select>
                            </div>
                            <div className="search-field">
                                <label className="search-label">Inmueble</label>
                                <select className="search-select" value={filters.type} onChange={e => cambiarFiltros({...filters, type: e.target.value})}>
                                    <option value="all">Cualquiera</option>{TIPOS_INMUEBLE.map(([, t]) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="search-field" style={{borderRight: 'none'}}>
                                <label className="search-label">Zona</label>
                                <select className="search-select" value={filters.zone} onChange={e => cambiarFiltros({...filters, zone: e.target.value})}>
                                    <option value="all">Todas</option>{zonas.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                            <button className={`btn-more-filters ${expandedFilters ? 'active' : ''}`} onClick={() => setExpandedFilters(!expandedFilters)}>
                                <i className="fa-solid fa-sliders"></i> Filtros
                            </button>
                        </div>

                        <div className={`expanded-filters ${expandedFilters ? 'active' : ''}`}>
                             <div className="filter-group">
                                <h4>Rango de Precio</h4>
                                <div className="price-inputs">
                                    <select className="search-select form-input price-currency" aria-label="Moneda" style={{marginBottom: 0, width: 'auto', flex: '0 0 auto'}} value={filters.monedaP} onChange={e => cambiarFiltros({...filters, monedaP: e.target.value})}>
                                        {Object.keys(ORDEN_MONEDA).map(c => <option key={c} value={c}>{simboloMoneda(c)}</option>)}
                                    </select>
                                    <input type="number" min="0" inputMode="numeric" aria-label="Precio mínimo" placeholder="Mínimo" value={filters.minP} onChange={e => cambiarFiltros({...filters, minP: e.target.value})} className="form-input" style={{marginBottom: 0}} />
                                    <span>-</span>
                                    <input type="number" min="0" inputMode="numeric" aria-label="Precio máximo" placeholder="Máximo" value={filters.maxP} onChange={e => cambiarFiltros({...filters, maxP: e.target.value})} className="form-input" style={{marginBottom: 0}} />
                                </div>
                            </div>
                            <div className="filter-group">
                                <h4>Dormitorios y baños</h4>
                                <div className="price-inputs">
                                    <select className="search-select form-input" aria-label="Dormitorios" style={{marginBottom: 0}} value={filters.beds} onChange={e => cambiarFiltros({...filters, beds: e.target.value})}>
                                        <option value="0">Dormitorios</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option>
                                    </select>
                                    <select className="search-select form-input" aria-label="Baños" style={{marginBottom: 0}} value={filters.baths} onChange={e => cambiarFiltros({...filters, baths: e.target.value})}>
                                        <option value="0">Baños</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option>
                                    </select>
                                </div>
                            </div>
                            {amenidadesDisponibles.length > 0 && (
                            <div className="filter-group" style={{gridColumn: '1 / -1'}}>
                                <h4>Amenities</h4>
                                <div className="amenities-grid">
                                    {amenidadesDisponibles.map(am => (
                                        <label key={am} className="checkbox-lbl">
                                            <input type="checkbox" checked={filters.amenities.includes(am)} onChange={() => {
                                                const ams = filters.amenities;
                                                cambiarFiltros({...filters, amenities: ams.includes(am) ? ams.filter(a => a !== am) : [...ams, am]});
                                            }} /> {am}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            )}
                            <div className="filters-actions" style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--color-gris-borde)', paddingTop: 15}}>
                                <button className="btn btn-outline" onClick={() => cambiarFiltros(FILTROS_VACIOS)}>Limpiar</button>
                                <button className="btn btn-rojo" onClick={() => setExpandedFilters(false)}>Aplicar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1. MAP VIEW */}
                <div id="view-map" className={`view ${view === 'map' ? 'active' : ''}`}>
                    <div id="map-container" style={{ width: '100%', height: '100%' }}></div>

                    {sidebarProp && (
                        <aside className="property-sidebar active">
                            <div className="sidebar-header-img">
                                <div className="sidebar-actions">
                                    <button className={`btn-fav ${favorites.includes(sidebarProp.id) ? 'active' : ''}`} aria-label={favorites.includes(sidebarProp.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'} aria-pressed={favorites.includes(sidebarProp.id)} onClick={() => toggleFavorite(sidebarProp.id)}>
                                        <i className={`${favorites.includes(sidebarProp.id) ? 'fa-solid' : 'fa-regular'} fa-heart`}></i>
                                    </button>
                                    <button className="close-sidebar" aria-label="Cerrar" onClick={() => setSidebarProp(null)}><i className="fa-solid fa-xmark"></i></button>
                                </div>
                                <img src={sidebarProp.imgs[0]} alt={sidebarProp.title} />
                                <span className="badge-type">{sidebarProp.operation}</span>
                            </div>
                            <div className="sidebar-content">
                                <div className="prop-zone"><i className={`fa-solid ${sidebarProp.showExactLocation ? 'fa-location-dot' : 'fa-map'}`}></i> {sidebarProp.zone} {!sidebarProp.showExactLocation && "(Zona Aprox.)"}</div>
                                <h2 className="prop-title">{sidebarProp.title}</h2>
                                <div className="prop-price">{sidebarProp.priceStr}</div>
                                {datosFicha(sidebarProp).length > 0 && (
                                    <div className="sidebar-feats">
                                        {datosFicha(sidebarProp).map(([ic, t]) => <span key={ic}><i className={`fa-solid ${ic}`}></i> {t}</span>)}
                                    </div>
                                )}
                                {sidebarProp.desc && (
                                    <div className="prop-desc-summary">
                                        <span>{resumenDescripcion(sidebarProp.desc)}</span>
                                    </div>
                                )}
                                <div style={{marginTop: 20}}>
                                    <a href={generateWA(sidebarProp)} target="_blank" rel="noreferrer" className="btn-whatsapp">
                                        <i className="fa-brands fa-whatsapp"></i> Contactar Agente
                                    </a>
                                    <button className="btn-details" onClick={() => abrirConsulta(sidebarProp)}><i className="fa-regular fa-envelope"></i> Enviar consulta</button>
                                    <button className="btn-details" onClick={() => openDetail(sidebarProp)}>Ver Detalles</button>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>

                {/* 2. LIST VIEW */}
                {view === 'list' && (
                    <div className="view active view-scrollable">
                        <div className="list-container">
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 25}}>
                                <div style={{fontWeight: 600}}>{filteredProps.length} propiedades</div>
                                <select className="form-input" style={{width:'auto', marginBottom:0, padding:'8px 16px', borderRadius:20}} value={sortMethod} onChange={e => setSortMethod(e.target.value)}>
                                    <option value="recent">Más recientes</option><option value="priceAsc">Menor a Mayor</option><option value="priceDesc">Mayor a Menor</option>
                                </select>
                            </div>
                            {filteredProps.length === 0 ? <div className="empty-state"><h3>No se encontraron resultados</h3></div> : (
                                <div className="properties-grid">{filteredProps.map(p => <PropertyCard key={p.id} prop={p} isFav={favorites.includes(p.id)} onToggleFav={toggleFavorite} onOpenDetail={openDetail} />)}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. FAV VIEW */}
                {view === 'fav' && (
                    <div className="view active view-scrollable">
                        <div className="list-container" style={{paddingTop: 40}}>
                            <h2 style={{marginBottom: 25}}><i className="fa-solid fa-heart" style={{color: 'var(--color-fav)'}}></i> Guardadas</h2>
                            {favorites.length === 0 ? <div className="empty-state"><h3>Todavía no guardaste favoritos</h3></div> : (
                                <div className="properties-grid">{propiedades.filter(p => favorites.includes(p.id)).map(p => <PropertyCard key={p.id} prop={p} isFav={true} onToggleFav={toggleFavorite} onOpenDetail={openDetail} />)}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. ABOUT VIEW */}
                {view === 'about' && (
                    <div className="view active view-scrollable">
                        <div className="list-container" style={{maxWidth: 1000, padding: '40px 20px'}}>
                            <div style={{textAlign: 'center', marginBottom: 50}}>
                                <img src="/Logo Inmobiliaria.jpg" alt="Logo Inmobiliaria" style={{ height: '140px', objectFit: 'contain', marginBottom: '25px', borderRadius: 8 }} />
                                <h1 style={{fontSize: '2.5rem', marginBottom: 30}}>Inmobiliaria Del Castillo</h1>
                                <div className="about-text" style={{maxWidth: 800, margin: '0 auto', textAlign: 'justify', display: 'flex', flexDirection: 'column', gap: '20px'}}>
                                    <p>La <strong>Inmobiliaria Del Castillo</strong> es una organización del sector de servicios inmobiliarios fundada en el año 2000 en la ciudad de Villa Carlos Paz, Provincia de Córdoba, por su actual propietaria y martillera responsable, Mariela Del Castillo.</p>
                                    <p>La firma se especializa como intermediaria crítica en el mercado inmobiliario local, llevando a cabo operaciones complejas de compra, venta, alquiler (tanto residencial como comercial), administración a largo plazo y permutas de diversos tipos de inmuebles, incluyendo casas, departamentos, complejos habitacionales y terrenos.</p>
                                    <p>Su ventaja competitiva radica históricamente en el <em>"asesoramiento de autor"</em>, basado en un modelo de trato personalizado, transparente y de estrecha cercanía con el cliente regional. Sin embargo, su evolución tecnológica se ha mantenido en una escala elemental, dependiendo principalmente de herramientas de oficina aisladas como Microsoft Word, planillas de Excel no automatizadas y canales de redes sociales tradicionales (Facebook, WhatsApp) para la captación y promoción de su oferta.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. DETAIL VIEW */}
                {view === 'detail' && detailProp && (
                    <div className="view active view-scrollable">
                        <div className="detail-wrapper">
                            <div style={{marginBottom: 25, display: 'flex', justifyContent: 'space-between'}}>
                                <button onClick={volverDelDetalle} className="btn-volver">
                                    <i className="fa-solid fa-arrow-left"></i> Volver
                                </button>
                                <div style={{display: 'flex', gap: 10}}>
                                    <button className="btn-fav" aria-label="Compartir esta propiedad" title="Compartir" onClick={() => compartir(detailProp)} style={{position:'static', boxShadow:'var(--sombra-flat)'}}>
                                        <i className="fa-solid fa-share-nodes"></i>
                                    </button>
                                    <button className={`btn-fav ${favorites.includes(detailProp.id) ? 'active' : ''}`} aria-label={favorites.includes(detailProp.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'} aria-pressed={favorites.includes(detailProp.id)} onClick={() => toggleFavorite(detailProp.id)} style={{position:'static', boxShadow:'var(--sombra-flat)'}}>
                                        <i className={`${favorites.includes(detailProp.id) ? 'fa-solid' : 'fa-regular'} fa-heart`}></i>
                                    </button>
                                </div>
                            </div>
                            <div className="ml-layout">
                                <div className="ml-left">
                                    <div className="ml-gallery">
                                        <div className="ml-thumbs">
                                            {detailProp.imgs.map((src, idx) => (
                                                <img key={idx} src={src} className={`ml-thumb-img ${mainImageIdx === idx ? 'active' : ''}`} onClick={() => setImgSel({ id: idDetalle, idx })} alt={`Foto ${idx + 1}`} />
                                            ))}
                                        </div>
                                        <div className="ml-main-img-box"><img src={detailProp.imgs[mainImageIdx]} alt={detailProp.title} /></div>
                                    </div>
                                    <div className="ml-desc-box">
                                        <h3 style={{fontSize: '1.5rem', marginBottom: 25}}>Descripción Completa</h3>
                                        <p style={{whiteSpace: 'pre-line', color: 'var(--color-gris-texto)', lineHeight: 1.7}}>{detailProp.desc || 'Sin descripción cargada. Consultanos y te contamos todos los detalles.'}</p>
                                        {detailProp.isComplex && detailProp.units.length > 0 && (
                                            <div style={{marginTop: 30}}>
                                                <h3 style={{fontSize: '1.3rem', marginBottom: 15}}>Unidades disponibles ({detailProp.unitsAvailable})</h3>
                                                <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                                                    {detailProp.units.map(u => (
                                                        <div key={u.id} style={{display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 14px', border: '1px solid var(--color-gris-borde)', borderRadius: 8}}>
                                                            <span><strong>{u.name}</strong> <span style={{color: 'var(--color-gris-texto)', fontSize: '0.85rem'}}>{[u.type, u.rooms ? `${u.rooms} amb.` : null, u.sqft ? `${u.sqft} m²` : null].filter(Boolean).join(' · ')}</span></span>
                                                            <strong style={{color: 'var(--color-rojo)'}}>{u.priceStr}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {(detailProp.operations || [detailProp.operation]).includes('Alquiler Temporario') && (
                                            <div style={{marginTop: 30}}>
                                                <h3 style={{fontSize: '1.3rem', marginBottom: 6}}>Disponibilidad</h3>
                                                <p style={{fontSize: '0.9rem', color: 'var(--color-gris-texto)', marginBottom: 14}}>Elegí tu día de llegada y el de salida para ver si hay lugar y consultar esas fechas.</p>
                                                <CalendarioDisponibilidad
                                                    ocupadas={ocupacionDetalle.id === detailProp.id ? ocupacionDetalle.datos : []}
                                                    cargando={ocupacionDetalle.id !== detailProp.id}
                                                    seleccion={fechasElegidas}
                                                    onSeleccion={(f) => setFechasSel({ id: idDetalle, ...f })}
                                                />
                                            </div>
                                        )}
                                        <div style={{display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap'}}>
                                            {detailProp.amenities.map(am => <span key={am} className="badge-amenity"><i className="fa-solid fa-check"></i> {am}</span>)}
                                        </div>
                                    </div>
                                </div>
                                <div className="ml-right">
                                    <p style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-gris-texto)', fontWeight: 500, marginBottom: 12}}>
                                        <span>{detailProp.propertyType} | <strong style={{color: 'var(--color-rojo)'}}>{detailProp.operation}</strong></span>
                                        <span><i className={`fa-solid ${detailProp.showExactLocation ? 'fa-location-dot' : 'fa-map'}`}></i> {detailProp.zone}</span>
                                    </p>
                                    <h1 style={{fontSize: '1.5rem', marginBottom: 25}}>{detailProp.title}</h1>
                                    <div className="detail-price">{detailProp.priceStr}</div>
                                    <div className="detail-grid">
                                        {detailProp.sqft > 0 && <div><i className="fa-solid fa-ruler-combined"></i> {detailProp.sqft} m²</div>}
                                        {detailProp.beds > 0 && <div><i className="fa-solid fa-bed"></i> {detailProp.beds} Dor.</div>}
                                        {detailProp.baths > 0 && <div><i className="fa-solid fa-bath"></i> {detailProp.baths} Baños</div>}
                                        <div><i className="fa-solid fa-hashtag"></i> ID: {detailProp.id}</div>
                                    </div>
                                    
                                    <a href={generateWA(detailProp, fechasElegidas)} target="_blank" rel="noreferrer" className="btn-whatsapp-large">
                                        <i className="fa-brands fa-whatsapp" style={{fontSize: '1.4rem'}}></i> {(detailProp.operations || [detailProp.operation]).includes('Alquiler Temporario') && fechasElegidas.desde && fechasElegidas.hasta ? 'Consultar estas fechas por WhatsApp' : 'Contactar por WhatsApp'}
                                    </a>

                                    <div className="contact-form-box">
                                        <h4 style={{marginBottom: 10}}>Consultar a la inmobiliaria</h4>
                                        <p style={{fontSize: '0.9rem', color: 'var(--color-gris-texto)', marginBottom: 15}}>
                                            {isClientLoggedIn
                                                ? "Dejanos tu consulta y un agente se comunica con vos."
                                                : "Ingresá o registrate gratis para enviar tu consulta y guardar tus propiedades favoritas."}
                                        </p>
                                        <button type="button" className="btn-rojo" style={{width: '100%'}} onClick={() => abrirConsulta(detailProp)}>
                                            {isClientLoggedIn ? "Enviar consulta" : "Ingresar para consultar"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {(errorCarga || sinMapa) && (view === 'map' || view === 'list') && (
                <div className="estado-carga" role="status">
                    <p>{sinMapa ? 'No se pudo cargar el mapa. Revisá tu conexión a internet.' : 'No pudimos cargar las propiedades. Revisá tu conexión e intentá de nuevo.'}</p>
                    <button className="btn btn-rojo" onClick={sinMapa ? () => window.location.reload() : reintentarCarga}>Reintentar</button>
                </div>
            )}

            {aviso && <div className="toast-aviso" role="status">{aviso}</div>}

            <nav className="mobile-nav" aria-label="Secciones">
                {[['map', 'fa-map-location-dot', 'Mapa'], ['list', 'fa-border-all', 'Listado'], ['fav', 'fa-heart', 'Favoritos'], ['about', 'fa-circle-info', 'Nosotros']].map(([v, ic, t]) => (
                    <button key={v} className={view === v ? 'active' : ''} aria-current={view === v ? 'page' : undefined} onClick={() => switchView(v)}>
                        <i className={`${v === 'fav' && view !== 'fav' ? 'fa-regular' : 'fa-solid'} ${ic}`}></i><span>{t}</span>
                    </button>
                ))}
            </nav>

            {consultaProp && (
                <ConsultaModal
                    prop={consultaProp}
                    telefonoInicial={profileData.telefono}
                    onClose={() => setConsultaProp(null)}
                />
            )}

            {/* MODAL LOGIN */}
            <div className={`modal-overlay ${isLoginModalOpen ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setLoginModalOpen(false); }}>
                <div className="login-box" role="dialog" aria-modal="true" aria-label="Acceso">
                    <button className="btn-close-modal" aria-label="Cerrar" onClick={() => setLoginModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                    
                    {/* ===== VISTA 1: LOGIN CLIENTE (por defecto) ===== */}
                    {loginView === 'cliente' && (
                        <div style={{ padding: '10px 0' }}>
                            {/* Encabezado */}
                            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                <img src="/Logo Inmobiliaria.jpg" alt="Logo" style={{ maxWidth: 120, marginBottom: 10 }} />
                                <h3 style={{ fontSize: '1.4rem', marginBottom: 5, color: 'var(--color-negro)' }}>
                                    {clienteModalMode === 'register' ? 'Creá tu cuenta' : 'Iniciá Sesión como Cliente'}
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-gris-texto)' }}>
                                    {clienteModalMode === 'register' ? 'Guardá favoritos y consultá por tus propiedades' : 'Ingresá con tu correo y contraseña'}
                                </p>
                            </div>
                            
                            {/* Formulario de Login/Registro de Cliente */}
                            <form onSubmit={enviarCliente}>
                                {clienteModalMode === 'register' && (
                                    <input
                                        name="nombre" type="text" placeholder="Tu nombre" autoComplete="given-name"
                                        value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)}
                                        required className="form-input"
                                        style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: 15, border: '1px solid var(--color-gris-borde)', borderRadius: 8, fontSize: '0.95rem' }}
                                    />
                                )}
                                <input
                                    name="email" autoComplete="username" type="email" placeholder="tu@correo.com"
                                    value={clienteEmail}
                                    onChange={(e) => setClienteEmail(e.target.value)}
                                    required className="form-input"
                                    style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: 15, border: '1px solid var(--color-gris-borde)', borderRadius: 8, fontSize: '0.95rem' }}
                                />
                                <CampoContrasena
                                    name="password" placeholder={clienteModalMode === 'register' ? 'Contraseña' : '••••••••'}
                                    autoComplete={clienteModalMode === 'register' ? 'new-password' : 'current-password'}
                                    value={clientePassword}
                                    onChange={(e) => setClientePassword(e.target.value)}
                                    required className="form-input"
                                    style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: clienteModalMode === 'register' ? 15 : 20, border: '1px solid var(--color-gris-borde)', borderRadius: 8, fontSize: '0.95rem' }}
                                />
                                {clienteModalMode === 'register' && (
                                    <p style={{ fontSize: '0.8rem', color: '#555', margin: '-8px 0 12px' }}>{AYUDA_CONTRASENA}</p>
                                )}
                                {clienteModalMode === 'register' && (
                                    <CampoContrasena
                                        name="password2" placeholder="Repetí la contraseña" autoComplete="new-password"
                                        value={clientePassword2} onChange={(e) => setClientePassword2(e.target.value)}
                                        required className="form-input"
                                        style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: 20, border: '1px solid var(--color-gris-borde)', borderRadius: 8, fontSize: '0.95rem' }}
                                    />
                                )}
                                {loginMsg && <div className="form-error" role="alert">{loginMsg}</div>}
                                <button type="submit" className="btn-negro" disabled={loginCargando} style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 600 }}>
                                    {loginCargando ? 'Un momento…' : clienteModalMode === 'register' ? 'Crear cuenta' : 'Ingresar'}
                                </button>
                            </form>
                            
                            {/* Toggle login/registro */}
                            <div style={{ textAlign: 'center', marginTop: 15, fontSize: '0.9rem', color: 'var(--color-gris-texto)' }}>
                                {clienteModalMode === 'register' ? (
                                    <>¿Ya tenés cuenta? <span style={{ color: 'var(--color-rojo)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setLoginMsg(''); setClienteModalMode('login'); }}>Iniciá sesión aquí</span></>
                                ) : (
                                    <>¿No tenés cuenta? <span style={{ color: 'var(--color-rojo)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setLoginMsg(''); setClienteModalMode('register'); }}>Creá una aquí</span></>
                                )}
                            </div>
                            
                            {/* Separador */}
                            <hr style={{ border: 'none', borderTop: '1px solid var(--color-gris-borde)', margin: '25px 0' }} />
                            
                            {/* Enlace al Portal de Agentes */}
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-gris-texto)', marginBottom: 12 }}>
                                    <i className="fa-solid fa-user-tie" style={{ marginRight: 6 }}></i>
                                    ¿Eres asesor de Inmobiliaria Del Castillo?
                                </p>
                                <button
                                    onClick={() => { setLoginMsg(''); setLoginView('agente'); }}
                                    style={{
                                        padding: '12px 24px',
                                        border: '2px solid var(--color-rojo)',
                                        borderRadius: 8,
                                        background: 'transparent',
                                        color: 'var(--color-rojo)',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}
                                >
                                    <i className="fa-solid fa-user-tie"></i>
                                    Ingresá como Agente
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* ===== VISTA 2: LOGIN AGENTE ===== */}
                    {loginView === 'agente' && (
                        <div style={{ padding: '10px 0' }}>
                            {/* Encabezado */}
                            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                <i className="fa-solid fa-user-tie" style={{ fontSize: '2.5rem', color: 'var(--color-rojo)', marginBottom: 10 }}></i>
                                <h3 style={{ fontSize: '1.4rem', marginBottom: 5, color: 'var(--color-negro)' }}>
                                    Portal de Agentes
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-gris-texto)' }}>
                                    Accedé a la administración de Inmobiliaria Del Castillo
                                </p>
                            </div>
                            
                            {/* Formulario de Login de Agente */}
                            <form onSubmit={enviarAgente}>
                                <input
                                    name="email" type="email" placeholder="tu@correo.com" autoComplete="username"
                                    value={agenteEmail}
                                    onChange={(e) => setAgenteEmail(e.target.value)}
                                    required className="form-input"
                                    style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: 15, border: '1px solid var(--color-gris-borde)', borderRadius: 8, fontSize: '0.95rem' }}
                                />
                                <CampoContrasena
                                    name="password" placeholder="••••••••" autoComplete="current-password"
                                    value={agentePassword}
                                    onChange={(e) => setAgentePassword(e.target.value)}
                                    required className="form-input"
                                    style={{ display: 'block', width: '100%', padding: '12px 14px', marginBottom: 20, border: '1px solid var(--color-gris-borde)', borderRadius: 8, fontSize: '0.95rem' }}
                                />
                                {loginMsg && <div className="form-error" role="alert">{loginMsg}</div>}
                                <button type="submit" className="btn-negro" disabled={loginCargando} style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 600 }}>
                                    <i className="fa-solid fa-lock" style={{ marginRight: 8 }}></i>
                                    {loginCargando ? 'Un momento…' : 'Ingresar al Panel'}
                                </button>
                            </form>
                            
                            {/* Botón volver a cliente */}
                            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 15, borderTop: '1px solid var(--color-gris-borde)' }}>
                                <button
                                    onClick={() => { setLoginMsg(''); setLoginView('cliente'); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-gris-texto)',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        padding: 5
                                    }}
                                >
                                    <i className="fa-solid fa-arrow-left" style={{ marginRight: 5 }}></i>
                                    Volver al acceso de clientes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showProfileModal && (
                                <div
                                    style={{
                                        position: 'fixed',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        background: 'rgba(0,0,0,0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 2000,
                                        backdropFilter: 'blur(4px)'
                                    }}
                                    onClick={() => setShowProfileModal(false)}
                                >
                                <div
                                    role="dialog" aria-modal="true" aria-label="Mi perfil"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        background: 'var(--color-blanco)',
                                        borderRadius: 16,
                                        padding: 25,
                                        width: 'min(92vw, 520px)',
                                        maxHeight: '90vh',
                                        overflowY: 'auto',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                                    }}
                                >
                                <div style={{ textAlign: 'center', marginBottom: 25 }}>
                                    {profileData.foto ? (
                                        <img
                                            src={profileData.foto}
                                            alt="Foto del cliente"
                                            style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '4px solid #4ECDC4' }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: 100, height: 100, borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #4ECDC4 0%, #292F36 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 10px', fontSize: '2rem', color: 'white', fontWeight: 'bold',
                                                border: '4px solid #4ECDC4'
                                            }}
                                        >
                                            {profileData.nombre?.charAt(0)?.toUpperCase() || '?'}
                                            {profileData.apellido?.charAt(0)?.toUpperCase() || ''}
                                    </div>
                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/png,image/jpeg,image/webp,image/gif';
                                            input.onchange = e => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                if (!file.type.startsWith('image/')) { avisar('Elegí un archivo de imagen'); return; }
                                                if (file.size > 8 * 1024 * 1024) { avisar('La imagen supera los 8 MB'); return; }
                                                const reader = new FileReader();
                                                reader.onload = ev => setFotoParaRecortar(ev.target.result);
                                                reader.readAsDataURL(file);
                                            };
                                            input.click();
                                        }}
                                        style={{
                                            marginTop: 10, padding: '8px 16px', borderRadius: 20,
                                            border: '1px solid var(--color-gris-borde)', background: 'var(--color-blanco)', cursor: 'pointer',
                                            fontSize: '0.8rem', color: 'var(--color-gris-texto)', display: 'inline-flex', alignItems: 'center', gap: 5
                                        }}
                                    >
                                        <i className='fa-solid fa-camera'></i> Cambiar foto
                                    </button>
                                    {profileData.foto && (
                                        <button
                                            type="button"
                                            onClick={() => setProfileData(prev => ({ ...prev, foto: '' }))}
                                            style={{
                                                marginTop: 10, marginLeft: 8, padding: '8px 16px', borderRadius: 20,
                                                border: '1px solid var(--color-gris-borde)', background: 'var(--color-blanco)', cursor: 'pointer',
                                                fontSize: '0.8rem', color: '#c0392b'
                                            }}
                                        >
                                            <i className='fa-solid fa-trash'></i> Quitar
                                        </button>
                                    )}
                                </div>

                                {fotoParaRecortar && (
                                    <RecortadorFoto
                                        src={fotoParaRecortar}
                                        onCancel={() => setFotoParaRecortar(null)}
                                        onConfirm={(dataUrl) => {
                                            setProfileData(prev => ({ ...prev, foto: dataUrl }));
                                            setFotoParaRecortar(null);
                                        }}
                                    />
                                )}

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        try {
                                            const problemaNombre = validarNombre(profileData.nombre, 'nombre') || validarNombre(profileData.apellido, 'apellido');
                                            if (problemaNombre) { avisar(problemaNombre); return; }
                                            if (!haySesion()) { avisar('Tu sesión venció. Volvé a iniciar sesión.'); return; }
                                            const res = await apiFetch('/auth/me', {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    nombre: profileData.nombre,
                                                    apellido: profileData.apellido,
                                                    telefono: profileData.telefono || '',
                                                    foto: profileData.foto || ''
                                                })
                                            });
                                            const data = await res.json().catch(() => ({}));
                                            if (!res.ok) {
                                                avisar(data.error || 'No se pudo guardar el perfil');
                                                return;
                                            }
                                            setProfileData({
                                                username: data.username || profileData.username,
                                                nombre: data.nombre || '',
                                                apellido: data.apellido || '',
                                                telefono: data.telefono || '',
                                                foto: data.foto || ''
                                            });
                                            setShowProfileModal(false);
                                            avisar('Perfil actualizado correctamente');
                                        } catch {
                                            avisar('No se pudo actualizar el perfil. Revisá tu conexión.');
                                        }
                                    }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
                                >
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-gris-texto)', marginBottom: 4 }}>Nombre *</label>
                                            <input
                                                type="text"
                                                value={profileData.nombre}
                                                onChange={e => setProfileData({ ...profileData, nombre: e.target.value })}
                                                required
                                                className="form-input"
                                                style={{ padding: '10px 13px', borderRadius: 8, border: '1px solid var(--color-gris-borde)', fontSize: '0.9rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-gris-texto)', marginBottom: 4 }}>Apellido *</label>
                                            <input
                                                type="text"
                                                value={profileData.apellido}
                                                onChange={e => setProfileData({ ...profileData, apellido: e.target.value })}
                                                required
                                                className="form-input"
                                                style={{ padding: '10px 13px', borderRadius: 8, border: '1px solid var(--color-gris-borde)', fontSize: '0.9rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-gris-texto)', marginBottom: 4 }}>Usuario (email)</label>
                                        <input
                                            type="email"
                                            value={profileData.username}
                                            readOnly
                                            style={{
                                                padding: '10px 13px', borderRadius: 8,
                                                border: '1px solid var(--color-gris-borde)',
                                                background: 'var(--color-gris-fondo)',
                                                color: 'var(--color-gris-texto)',
                                                fontSize: '0.9rem',
                                                cursor: 'default'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-gris-texto)', marginBottom: 4 }}>Teléfono</label>
                                        <input
                                            type="tel"
                                            placeholder="Ej: +54 11 1234-5678"
                                            value={profileData.telefono}
                                            onChange={e => setProfileData({ ...profileData, telefono: e.target.value })}
                                            className="form-input"
                                            style={{ padding: '10px 13px', borderRadius: 8, border: '1px solid var(--color-gris-borde)', fontSize: '0.9rem' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 5 }}>
                                        <button
                                            type="button"
                                            onClick={() => { setShowProfileModal(false); setProfileData(prev => ({ ...prev, username: 'loading...' })); }}
                                            style={{
                                                padding: '10px 20px', borderRadius: 8,
                                                border: '1px solid var(--color-gris-borde)', background: 'var(--color-blanco)',
                                                cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-negro-claro)'
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-negro"
                                            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--color-negro)', color: 'var(--color-blanco)', cursor: 'pointer', fontSize: '0.9rem' }}
                                        >
                                            <i className="fa-solid fa-check"></i> Guardar Cambios
                                        </button>
                                    </div>
                                </form>

                                {/* BOTÓN DE CERRAR SESIÓN */}
                                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-gris-borde)' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            cerrarSesion();
                                            cerrarSesionLocal();
                                            abrirLogin();
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            background: '#FF6B6B',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 8,
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8
                                        }}
                                    >
                                        <i className="fa-solid fa-right-from-bracket"></i>
                                        Cerrar Sesión
                                    </button>
                                </div>
                                    </div>
                                </div>
            )}
        </div>
    );
}

// Inmobiliaria Del Castillo - Villa Carlos Paz - Córdoba, Argentina