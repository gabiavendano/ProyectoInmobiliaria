import React, { useState } from 'react';

function Layout({ vistaActual, setVista, usuarioActual, onLogout, children }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [dropdownUsuario, setDropdownUsuario] = useState(false);

  const links = [
    { id: "dashboard",   label: "Panel General", icon: "fa-chart-pie" },
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

  return (
    <>
      <div className={`sidebar-overlay ${menuAbierto ? 'active' : ''}`} onClick={() => setMenuAbierto(false)}></div>
      
      <aside className={`sidebar ${menuAbierto ? 'open' : ''}`}>
        <div className="sidebar-header">
          {/* Logo cargado correctamente */}
          <img src="/Logo Inmobiliaria.jpg" alt="Inmobiliaria Del Castillo" className="sidebar-logo" />
        </div>
        <nav className="nav-menu">
          {links.map(({ id, label, icon }) => (
            <div key={id} className={`nav-item ${vistaActual === id ? "active" : ""}`} onClick={() => cambiarVista(id)}>
              <i className={`fa-solid ${icon}`}></i> {label}
            </div>
          ))}
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="topbar">
          <div style={{display: 'flex', alignItems: 'center'}}>
            <button className="menu-toggle" onClick={() => setMenuAbierto(!menuAbierto)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <h1 id="page-title"><i className={`fa-solid ${vistaActiva.icon}`} style={{color: "var(--color-rojo)"}}></i> {vistaActiva.label}</h1>
          </div>
          
          {/* Perfil y Menú Desplegable (Cerrar Sesión) */}
          <div style={{position: 'relative'}}>
            <div className="user-profile" onClick={() => setDropdownUsuario(!dropdownUsuario)}>
              <div className="avatar">{usuarioActual?.iniciales || "AD"}</div>
              <span>{usuarioActual?.nombre || "Administrador"}</span>
              <i className={`fa-solid fa-chevron-${dropdownUsuario ? 'up' : 'down'}`} style={{fontSize: "0.8rem", color: "var(--color-gris-texto)"}}></i>
            </div>
            
            {dropdownUsuario && (
              <div className="user-dropdown animation-fade-in">
                 <div className="user-dropdown-item" onClick={() => { setDropdownUsuario(false); onLogout(); }}>
                    <i className="fa-solid fa-right-from-bracket"></i> Cambiar Usuario / Salir
                 </div>
              </div>
            )}
          </div>
        </header>
        
        <section className="content-area">
          {children}
        </section>
      </main>
    </>
  );
}

export default Layout;