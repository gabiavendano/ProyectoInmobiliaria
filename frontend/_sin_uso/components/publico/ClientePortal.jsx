// src/components/publico/ClientePortal.jsx
// Portal completo para clientes logueados: Mapa + Favoritos + WhatsApp + Filtros
// Este es el destino cuando un cliente inicia sesión desde la PaginaDeAcceso
import React, { useState, useEffect, useRef } from 'react';
import { fotosPublicas } from '../../utils/fotos';
import { etiquetaOperacion, etiquetaTipo, TIPOS_INMUEBLE } from '../../utils/propiedad';
import MapaInteractivo from './MapaInteractivo';
import { getPropiedadesPublicas, getFavoritos, agregarFavorito, quitarFavorito } from '../../services/api';

const WHATSAPP_NUM = "5493541557179";

// ── Iconos de Leaflet (para que no haya advertencias) ──
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corregir la ruta de iconos por defecto de Leaflet en bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function ClientePortal({ usuario = { nombre: '', username: '' }, onLogout }) {
    const [isLoginModalOpen, setLoginModalOpen] = useState(false);
    const [view, setView] = useState('map'); // 'map' o 'list'
    const [previousView, setPreviousView] = useState('map');
    const [showFavPanel, setShowFavPanel] = useState(false);
    const [expandedFilters, setExpandedFilters] = useState(false);
    const [darkMode, setDarkMode] = useState(() => JSON.parse(localStorage.getItem('delcastillo_dark_mode')) || false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileData, setProfileData] = useState({
        nombre: usuario?.nombre || '',
        apellido: '',
        username: usuario?.username || '',
        telefono: '',
        foto: ''
    });
    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const [cargando, setCargando] = useState(false);

    const [filters, setFilters] = useState({
        op: 'all', type: 'all', zone: 'all', minP: '', maxP: '', beds: '0', baths: '0', amenities: []
    });
    const [sortMethod, setSortMethod] = useState('recent');

    const [sidebarProp, setSidebarProp] = useState(null);
    const [mainImageIdx, setMainImageIdx] = useState(0);

    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const clusterGroupRef = useRef(null);

    const BASE_API = "http://localhost:8080/api";

    const [propiedades, setPropiedades] = useState([]);
    const [filteredProps, setFilteredProps] = useState([]);
    const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('delcastillo_favorites_v2')) || []);

    // ── Login modal handler ──
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoginError("");
        setCargando(true);
        try {
            const res = await login({ username: email, password });
            if (res.status === 200) {
                const data = res.data;
                setToken(data.token);
                localStorage.setItem('inmobiliaria_token', data.token);
                // Si el login devolvió rol CLIENTE, cerramos modal y seguimos
                setLoginModalOpen(false);
                window.location.reload(); // Recargar para asegurar el estado
            } else {
                setLoginError(res.data?.error || "Credenciales inválidas");
            }
        } catch (err) {
            setLoginError(err.response?.data?.error || "Error de conexión");
        } finally {
            setCargando(false);
        }
    };

    // ── Carga de propiedades desde API real ──
    useEffect(() => {
        const cargar = async () => {
            try {
                const res = await fetch(`${BASE_API}/propiedades/publicas`);
                if (res.ok) {
                    const data = await res.json();
                    const formatted = data.map(p => ({
                        id: p.idPropiedad,
                        operation: etiquetaOperacion(p.tipoOperacion),
                        propertyType: etiquetaTipo(p.tipoInmueble),
                        zone: p.zona || "Sin zona",
                        lat: p.latitud,
                        lng: p.longitud,
                        showExactLocation: p.showExactLocation !== false,
                        title: p.titulo,
                        priceStr: p.priceStr || (p.moneda === "USD" ? `U$${p.precio}` : `$${p.precio}`),
                        priceNum: p.precio || 0,
                        dateAdded: p.dateAdded || "2023-01-01",
                        beds: p.cantDormitorios || 0,
                        baths: p.cantBanos || 0,
                        sqft: p.superficieTotalM2 || 0,
                        agent: p.agent || "Inmobiliaria Del Castillo",
                        amenities: p.amenities || [],
                        aiSummary: p.aiSummary || "",
                        desc: p.descripcion || "",
                        imgs: fotosPublicas(p.fotos),
                        isComplex: p.esComplejo === true,
                        unitsAvailable: p.unidadesDisponibles || 0,
                        units: (p.unidades || []).map(u => ({
                            id: u.idPropiedad,
                            name: u.identificador || `Unidad ${u.idPropiedad}`,
                            priceStr: u.priceStr || (u.moneda === "USD" ? `U$${u.precio}` : `$${u.precio}`),
                            rooms: u.cantAmbientes || 0,
                            beds: u.cantDormitorios || 0,
                            baths: u.cantBanos || 0,
                            sqft: u.superficieTotalM2 || 0,
                            type: etiquetaTipo(u.tipoInmueble)
                        }))
                    }));
                    setPropiedades(formatted);
                } else {
                    // Si hay error, usar datos hardcodeados como fallback
                    cargarDatosHardcoded();
                }
            } catch (e) {
                console.error("Error cargando propiedades:", e);
                cargarDatosHardcoded();
            }
        };
        cargar();
    }, []);

    const cargarDatosHardcoded = () => {
        // Fallback con datos por defecto del MapaInteractivo
        setPropiedades([
            { id: 1, operation: "Venta", propertyType: "Casa", zone: "Centro", lat: -31.4180, lng: -64.4990, showExactLocation: true, title: "Exclusivo Chalet Céntrico de Categoría", priceStr: "U$S 120.000", priceNum: 120000, beds: 3, baths: 2, sqft: 180, agent: "Lic. Avendaño", amenities: ["Pileta","Cochera","Asador","Gas Natural"], imgs: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9"] },
            { id: 2, operation: "Alquiler Temporario", propertyType: "Departamento", zone: "Costa Azul", lat: -31.4050, lng: -64.4800, showExactLocation: false, title: "Departamento Premium Frente al Lago", priceStr: "$ 55.000 / día", priceNum: 55000, beds: 2, baths: 1, sqft: 75, agent: "Martillero Flores", amenities: ["Pileta","Cochera","Vista al Lago","Amoblado"], imgs: ["https://images.unsplash.com/photo-1502672260266-1c1f5523a5d1"] },
            { id: 3, operation: "Alquiler Anual", propertyType: "Casa", zone: "San Antonio", lat: -31.4350, lng: -64.5100, showExactLocation: true, title: "Clásica Casa Familiar en Barrio Residencial", priceStr: "$ 420.000 / mes", priceNum: 420000, beds: 4, baths: 3, sqft: 220, agent: "Asesor Toledo", amenities: ["Cochera","Asador","Gas Natural"], imgs: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6"] },
            { id: 4, operation: "Venta", propertyType: "Terreno", zone: "Villa del Lago", lat: -31.3900, lng: -64.5100, showExactLocation: false, title: "Lote Apto Dúplex con Vista Panorámica", priceStr: "U$S 48.000", priceNum: 48000, sqft: 950, agent: "Lic. Avendaño", amenities: ["Vista al Lago"], imgs: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef"] },
        ]);
    };

    // ── Filtrado ──
    useEffect(() => {
        const resultado = propiedades.filter(p => {
            if (filters.op !== 'all' && p.operation !== filters.op) return false;
            if (filters.type !== 'all' && p.propertyType !== filters.type) return false;
            if (filters.zone !== 'all' && p.zone !== filters.zone) return false;
            if (filters.minP && p.priceNum < Number(filters.minP)) return false;
            if (filters.maxP && p.priceNum > Number(filters.maxP)) return false;
            if (p.beds < Number(filters.beds)) return false;
            if (p.baths < Number(filters.baths)) return false;
            for (let am of filters.amenities) {
                if (!p.amenities.includes(am)) return false;
            }
            return true;
        }).sort((a, b) => {
            if (sortMethod === 'priceAsc') return a.priceNum - b.priceNum;
            if (sortMethod === 'priceDesc') return b.priceNum - a.priceNum;
            return new Date(b.dateAdded) - new Date(a.dateAdded);
        });
        setFilteredProps(resultado);
    }, [propiedades, filters, sortMethod]);

    // ── Favoritos ──
    const isFav = (id) => favorites.includes(id);
    const toggleFav = (id, e) => {
        e.stopPropagation();
        const newFavs = isFav(id)
            ? favorites.filter(f => f !== id)
            : [...favorites, id];
        setFavorites(newFavs);
        localStorage.setItem('delcastillo_favorites_v2', JSON.stringify(newFavs));
    };

    // ── Handler de marca para mapa ──
    const handleMarkerClick = (prop) => {
        setSidebarProp(prop);
        setMainImageIdx(0);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* ── Header ── */}
            <header style={{ background: '#1a1a2e', color: 'white', padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', boxShadow: '0 2px 20px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/Logo Inmobiliaria.jpg" alt="Logo" style={{ height: '40px' }} />
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: '#4ECDC4' }}>
                        Inmobiliaria Del Castillo
                    </span>
                    {usuario && <span style={{ fontSize: '0.8rem', color: '#a8b5c8', marginLeft: '15px', padding: '4px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                        Bienvenido, {usuario.nombre}
                    </span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Toggle vista */}
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px' }}>
                        <button
                            onClick={() => setView('map')}
                            style={{
                                padding: '8px 14px',
                                background: view === 'map' ? '#4ECDC4' : 'transparent',
                                color: view === 'map' ? 'white' : '#ccc',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            <i className="fa-solid fa-map"></i>
                        </button>
                        <button
                            onClick={() => setView('list')}
                            style={{
                                padding: '8px 14px',
                                background: view === 'list' ? '#4ECDC4' : 'transparent',
                                color: view === 'list' ? 'white' : '#ccc',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            <i className="fa-solid fa-list"></i>
                        </button>
                    </div>

                    {/* Favoritos */}
                    <button
                        onClick={() => setShowFavPanel(!showFavPanel)}
                        style={{
                            position: 'relative',
                            padding: '8px 14px',
                            background: 'rgba(255,107,107,0.2)',
                            color: '#FF6B6B',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        <i className="fa-solid fa-heart"></i>
                        {favorites.length > 0 && (
                            <span style={{
                                position: 'absolute', top: '-5px', right: '-5px',
                                background: '#FF6B6B', color: 'white',
                                borderRadius: '50%',
                                width: '18px', height: '18px',
                                fontSize: '0.65rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {favorites.length}
                            </span>
                        )}
                    </button>

                    {/* Botón de perfil (dropdown) */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                            style={{
                                padding: '8px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <i className="fa-solid fa-user"></i>
                            {usuario ? usuario.nombre.split(' ')[0] : 'Perfil'}
                            <i className={`fa-solid fa-chevron-down ${showProfileDropdown ? 'fa-rotate-180' : ''}`} style={{ fontSize: '0.7rem' }}></i>
                        </button>

                        {showProfileDropdown && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '5px',
                                background: 'white',
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
                                        color: '#1a1a2e',
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
                                <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '4px 0' }} />
                                <button
                                    onClick={() => { onLogout(); setShowProfileDropdown(false); }}
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
                </div>
            </header>

            {/* ── Main Content ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Sidebar izquierda (listado de propiedades) */}
                {(view === 'list' || sidebarProp) && (
                    <div style={{ width: '380px', background: 'white', overflowY: 'auto', flexShrink: 0 }} className="sidebar">
                        {/* Filtros */}
                        <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>
                                    <i className="fa-solid fa-sliders"></i> Filtros
                                </span>
                                <button
                                    onClick={() => setExpandedFilters(!expandedFilters)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ECDC4', fontSize: '0.8rem' }}
                                >
                                    {expandedFilters ? '<i className="fa-solid fa-chevron-up"></i>' : '<i className="fa-solid fa-chevron-down"></i>'}
                                </button>
                            </div>
                            {expandedFilters && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                                    <div>
                                        <label>Operación</label>
                                        <select value={filters.op} onChange={(e) => setFilters({...filters, op: e.target.value})} style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <option value="all">Todas</option>
                                            <option value="Venta">Venta</option>
                                            <option value="Alquiler Anual">Alquiler Anual</option>
                                            <option value="Alquiler Temporario">Alquiler Temporario</option>
                                            <option value="Permuta">Permuta</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Tipo</label>
                                        <select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})} style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <option value="all">Todos</option>
                                            {TIPOS_INMUEBLE.map(([, t]) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label>Zona</label>
                                        <select value={filters.zone} onChange={(e) => setFilters({...filters, zone: e.target.value})} style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <option value="all">Todas</option>
                                            {[...new Set(propiedades.map(p => p.zone).filter(Boolean))].sort((x, y) => x.localeCompare(y, "es")).map(z => <option key={z} value={z}>{z}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label>Tipo cambio</label>
                                        <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <option value="recent">Más recientes</option>
                                            <option value="priceAsc">Menor precio</option>
                                            <option value="priceDesc">Mayor precio</option>
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1/-1' }}>
                                        <label style={{ display: 'block', marginBottom: '4px' }}>Rango de precio</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input type="number" placeholder="Mín" value={filters.minP} onChange={(e) => setFilters({...filters, minP: e.target.value})} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                            <input type="number" placeholder="Máx" value={filters.maxP} onChange={(e) => setFilters({...filters, maxP: e.target.value})} style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Lista de propiedades filtradas */}
                        <div style={{ padding: '15px 20px' }}>
                            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>
                                {filteredProps.length} propiedades encontradas
                            </p>
                            {filteredProps.map(prop => (
                                <div
                                    key={prop.id}
                                    onClick={() => { setSidebarProp(prop); setMainImageIdx(0); }}
                                    style={{
                                        display: 'flex', gap: '12px', padding: '10px 0',
                                        borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <img src={prop.imgs[0]} alt="" style={{ width: '70px', height: '52px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.7rem', color: '#888', display: 'flex', gap: '8px', marginBottom: '2px' }}>
                                            <span>{prop.operation}</span>
                                            <span>{prop.propertyType}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {prop.title}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#4ECDC4', fontWeight: 500 }}>
                                            {prop.priceStr}{prop.isComplex && prop.unitsAvailable > 0 ? ` · ${prop.unitsAvailable} unid. disp.` : ""}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => toggleFav(prop.id, e)}
                                        style={{
                                            background: isFav(prop.id) ? '#FF6B6B' : 'transparent',
                                            color: isFav(prop.id) ? 'white' : '#ccc',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px 6px',
                                            borderRadius: '4px',
                                            flexShrink: 0
                                        }}
                                    >
                                        <i className={isFav(prop.id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
                                    </button>
                                </div>
                            ))}
                            {filteredProps.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '30px 0', color: '#999' }}>
                                    <i className="fa-solid fa-house-circle-xmark" style={{ fontSize: '2rem', marginBottom: '10px' }}></i>
                                    <p>No se encontraron propiedades</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Mapa (ocupa el resto) */}
                <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                    {/* Mapa */}
                    <div id="map-container" style={{ width: '100%', height: '100%' }}></div>
                </div>
            </div>

            {/* ── Panel de favoritos (overlay) ── */}
            {showFavPanel && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: '350px',
                    background: 'white', boxShadow: '-5px 0 30px rgba(0,0,0,0.1)',
                    zIndex: 100, display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}><i className="fa-solid fa-heart" style={{ color: '#FF6B6B', marginRight: '8px' }}></i>Mis Favoritos</h3>
                        <button onClick={() => setShowFavPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#999' }}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '15px 20px' }}>
                        {favorites.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', color: '#999' }}>
                                <i className="fa-solid fa-heart" style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.3 }}></i>
                                <p>No tenés propiedades favoritas aún.</p>
                                <p style={{ fontSize: '0.8rem' }}>Hacé clic en el corazón de cualquier propiedad para guardarla.</p>
                            </div>
                        ) : (
                            favorites.map(id => {
                                const prop = propiedades.find(p => p.id === id);
                                if (!prop) return null;
                                return (
                                    <div key={id} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <img src={prop.imgs[0]} alt="" style={{ width: '60px', height: '45px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {prop.title}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#4ECDC4' }}>{prop.priceStr}</div>
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                                <a href={whatsappLink(prop)} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#25D366' }}>
                                                    <i className="fa-brands fa-whatsapp"></i> Contactar
                                                </a>
                                                <button
                                                    onClick={() => {
                                                        toggleFav(prop.id, { stopPropagation: () => {} });
                                                        setShowFavPanel(false);
                                                    }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF6B6B', padding: 0 }}
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ── Modal de login ── */}
            {isLoginModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '30px 35px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Iniciar Sesión</h3>
                            <button onClick={() => { setLoginModalOpen(false); setLoginError(""); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#999' }}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleLoginSubmit}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com"
                                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Contraseña</label>
                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"
                                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }} />
                            </div>
                            {loginError && <div style={{ background: '#FFF3F3', color: '#D32F2F', padding: '10px 14px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem', border: '1px solid #FFCDD2' }}>{loginError}</div>}
                            <button type="submit" disabled={cargando} style={{
                                width: '100%', padding: '12px', background: '#4ECDC4', color: 'white', border: 'none',
                                borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.7 : 1
                            }}>
                                {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
                            </button>
                        </form>
                        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '0.8rem', color: '#999' }}>
                            ¿No tenés cuenta? Podés registrarte desde el portal de clientes.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Modal de perfil de cliente ── */}
            {showProfileModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '30px 35px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e' }}>Mi Perfil</h3>
                            <button onClick={() => setShowProfileModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#999' }}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                            <div style={{
                                width: '90px', height: '90px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #4ECDC4, #44a08d)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto', fontSize: '2.5rem', color: 'white', fontWeight: 700
                            }}>
                                {profileData.foto ? (
                                    <img src={profileData.foto} alt="Foto" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    <i className="fa-solid fa-user"></i>
                                )}
                            </div>
                            <p style={{ marginTop: '8px', fontSize: '0.85rem', color: '#888' }}>Hacé clic en la foto para cambiarla</p>
                            <input type="file" accept="image/*" onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setProfileData({ ...profileData, foto: reader.result });
                                    reader.readAsDataURL(file);
                                }
                            }} style={{ display: 'none' }} id="foto-input" />
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                // Guardar datos del perfil en localStorage
                                const perfilCompleto = {
                                    ...profileData,
                                    apellido: profileData.apellido,
                                    telefono: profileData.telefono,
                                    foto: profileData.foto
                                };
                                localStorage.setItem('cliente_perfil', JSON.stringify(perfilCompleto));

                                // Actualizar nombre en backend
                                const res = await fetch(`${BASE_API}/auth/me`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${localStorage.getItem('inmobiliaria_token')}`
                                    },
                                    body: JSON.stringify({
                                        nombre: profileData.nombre + ' ' + profileData.apellido
                                    })
                                });
                                if (res.ok) {
                                    alert('Perfil actualizado correctamente');
                                    setShowProfileModal(false);
                                } else {
                                    alert('Error al actualizar. Intenta de nuevo.');
                                }
                            } catch (err) {
                                alert('Error de conexión');
                            }
                        }}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Nombre *</label>
                                <input type="text" value={profileData.nombre} onChange={(e) => setProfileData({ ...profileData, nombre: e.target.value })} required placeholder="Ej: Juan"
                                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Apellido *</label>
                                <input type="text" value={profileData.apellido} onChange={(e) => setProfileData({ ...profileData, apellido: e.target.value })} required placeholder="Ej: Pérez"
                                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Usuario (email) *</label>
                                <input type="email" value={profileData.username} onChange={(e) => setProfileData({ ...profileData, username: e.target.value })} required placeholder="tu@email.com"
                                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>Teléfono</label>
                                <input type="tel" value={profileData.telefono} onChange={(e) => setProfileData({ ...profileData, telefono: e.target.value })} placeholder="+54 3541 123456"
                                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '0.95rem' }} />
                            </div>
                            <button type="submit" style={{
                                width: '100%', padding: '12px', background: '#FF6B6B', color: 'white', border: 'none',
                                borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer'
                            }}>
                                Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Footer ── */}
            <footer style={{ background: '#1a1a2e', color: '#a8b5c8', padding: '15px 30px', textAlign: 'center', fontSize: '0.8rem' }}>
                <p>Inmobiliaria Del Castillo — Villa Carlos Paz, Córdoba, Argentina</p>
                <p style={{ marginTop: '5px' }}>
                    <a href={`https://wa.me/${WHATSAPP_NUM}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4ECDC4' }}>
                        <i className="fa-brands fa-whatsapp"></i> WhatsApp: {WHATSAPP_NUM}
                    </a>
                </p>
            </footer>

            <style>{`
                .sidebar::-webkit-scrollbar { width: 4px; }
                .sidebar::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
                .sidebar::-webkit-scrollbar-track { background: transparent; }
                #map-container { min-height: 300px; }
            `}</style>
        </div>
    );
}

// Helper para link de WhatsApp
function whatsappLink(prop) {
    const text = `Hola, me interesa el inmueble "${prop.title}" (${prop.operation} a ${prop.priceStr}) en ${prop.zone}. ¿Podría brindarme más detalles?`;
    return `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(text)}`;
}
