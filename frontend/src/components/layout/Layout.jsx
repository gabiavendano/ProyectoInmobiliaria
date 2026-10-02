import { useEffect, useRef, useState } from 'react';
import PanelAccesibilidad from './PanelAccesibilidad';

function Layout({ vistaActual, setVista, usuarioActual, onLogout, children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [dropdownUsuario, setDropdownUsuario] = useState(false);
  const zonaUsuario = useRef(null);
  const botonUsuario = useRef(null);
  const botonMenu = useRef(null);
  const menuLateral = useRef(null);

  const links = [
    { id: "dashboard",   label: "Panel General", icon: "fa-chart-pie" },
    { id: "leads",       label: "Leads Web", icon: "fa-bullseye" },
    { id: "personas",    label: "Gestión de Clientes", icon: "fa-users" },
    { id: "propiedades", label: "Propiedades", icon: "fa-house-chimney" },
    { id: "contratos",   label: "Operaciones y Contratos", icon: "fa-file-signature" },
    { id: "finanzas",    label: "Finanzas y Cobros", icon: "fa-wallet" }
  ];
  const vistaActiva = links.find(l => l.id === vistaActual) || links[0]; 

  const cambiarVista = (id) => {
    setVista(id);
    setMenuAbierto(false); 
  };

  // Escape cierra el menú del usuario y el menú lateral del celular (y devuelve el foco al botón que lo abrió)
  useEffect(() => {
    if (!dropdownUsuario && !menuAbierto) return;
    const alTeclear = (e) => {
      if (e.key !== 'Escape') return;
      if (dropdownUsuario) { setDropdownUsuario(false); botonUsuario.current?.focus(); }
      else { setMenuAbierto(false); botonMenu.current?.focus(); }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [dropdownUsuario, menuAbierto]);

  // Un clic afuera cierra el menú del usuario
  useEffect(() => {
    if (!dropdownUsuario) return;
    const alHacerClic = (e) => { if (zonaUsuario.current && !zonaUsuario.current.contains(e.target)) setDropdownUsuario(false); };
    document.addEventListener('mousedown', alHacerClic);
    return () => document.removeEventListener('mousedown', alHacerClic);
  }, [dropdownUsuario]);

  const alternarMenu = () => {
    const abrir = !menuAbierto;
    setMenuAbierto(abrir);
    // Al abrir el menú en el celular, el foco pasa al primer ítem
    if (abrir) setTimeout(() => menuLateral.current?.querySelector('.nav-item')?.focus(), 50);
  };

  return (
    <>
      <a href="#contenido-principal" className="skip-link">Saltar al contenido</a>
      <div className={`sidebar-overlay ${menuAbierto ? 'active' : ''}`} onClick={() => setMenuAbierto(false)} aria-hidden="true"></div>
      
      <aside id="menu-lateral" ref={menuLateral} className={`sidebar ${menuAbierto ? 'open' : ''}`}>
        <div className="sidebar-header">
          {/* Logo cargado correctamente */}
          <img src="/Logo Inmobiliaria.jpg" alt="Inmobiliaria Del Castillo" className="sidebar-logo" />
        </div>
        <nav className="nav-menu" aria-label="Secciones del panel">
          {links.map(({ id, label, icon }) => (
            <button type="button" key={id} className={`nav-item ${vistaActual === id ? "active" : ""}`}
              aria-current={vistaActual === id ? "page" : undefined} onClick={() => cambiarVista(id)}>
              <i className={`fa-solid ${icon}`} aria-hidden="true"></i> {label}
            </button>
          ))}
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="topbar">
          <div style={{display: 'flex', alignItems: 'center'}}>
            <button ref={botonMenu} type="button" className="menu-toggle" onClick={alternarMenu}
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuAbierto} aria-controls="menu-lateral">
              <i className="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
            <h1 id="page-title"><i className={`fa-solid ${vistaActiva.icon}`} aria-hidden="true" style={{color: "var(--color-rojo)"}}></i> {vistaActiva.label}</h1>
          </div>
          
          <div className="topbar-acciones">
            <PanelAccesibilidad />

            {/* Perfil y Menú Desplegable (Cerrar Sesión) */}
            <div ref={zonaUsuario} style={{position: 'relative'}}>
              <button ref={botonUsuario} type="button" className="user-profile" onClick={() => setDropdownUsuario(!dropdownUsuario)}
                aria-label={`${usuarioActual?.nombre || "Administrador"}, menú de usuario`} aria-haspopup="menu" aria-expanded={dropdownUsuario} aria-controls="menu-usuario">
                <small className="avatar" aria-hidden="true">{usuarioActual?.iniciales || "AD"}</small>
                <span>{usuarioActual?.nombre || "Administrador"}</span>
                <i className={`fa-solid fa-chevron-${dropdownUsuario ? 'up' : 'down'}`} aria-hidden="true" style={{fontSize: "0.8rem", color: "var(--color-gris-texto)"}}></i>
              </button>
              
              {dropdownUsuario && (
                <div id="menu-usuario" className="user-dropdown animation-fade-in" role="menu">
                   <button type="button" role="menuitem" className="user-dropdown-item" autoFocus
                     onClick={() => { setDropdownUsuario(false); onLogout(); }}>
                      <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Cambiar Usuario / Salir
                   </button>
                </div>
              )}
            </div>
          </div>
        </header>
        
        <section id="contenido-principal" className="content-area" tabIndex={-1}>
          {children}
        </section>
      </main>
    </>
  );
}

export default Layout;
