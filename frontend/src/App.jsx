import { useState } from "react";
import Login from "./components/auth/Login";
import Layout from "./components/layout/Layout";
import PersonaList from "./components/personas/PersonaList";
import PropiedadList from "./components/propiedades/PropiedadList";
import ContratoForm from "./components/contratos/ContratoForm";
import FinanzasList from "./components/finanzas/FinanzasList";
import FinanzasForm from "./components/Finanzas/FinanzasForm";

function App() {
  const [usuario, setUsuario] = useState(null); // Estado global de sesión
  const [vista, setVista] = useState("dashboard");

  // Guardia: Si no hay usuario logueado, forzamos la vista de Login
  if (!usuario) {
    return <Login onLogin={(datosUsuario) => setUsuario(datosUsuario)} />;
  }

  // Cierre de sesión y retorno a pantalla de Login
  const handleLogout = () => {
    setUsuario(null);
    setVista("dashboard");
  };

  return (
    <Layout vistaActual={vista} setVista={setVista} usuarioActual={usuario} onLogout={handleLogout}>
      {vista === "dashboard" && (
         <div className="view-section active">
         <div className="stat-card-container">
           <div className="stat-card red">
               <div className="stat-info"><h3>Propiedades Disponibles</h3><p>42</p><span><i className="fa-solid fa-arrow-trend-up" style={{color:'#2E7D32'}}></i> +3 este mes</span></div>
               <div className="stat-icon"><i className="fa-solid fa-building"></i></div>
           </div>
           <div className="stat-card black">
               <div className="stat-info"><h3>Operaciones Activas</h3><p>18</p><span>Contratos vigentes</span></div>
               <div className="stat-icon"><i className="fa-solid fa-handshake"></i></div>
           </div>
           <div className="stat-card green">
               <div className="stat-info"><h3>Clientes Registrados</h3><p>156</p><span>Propietarios e Inquilinos</span></div>
               <div className="stat-icon"><i className="fa-solid fa-user-tie"></i></div>
           </div>
         </div>
         <div className="card">
           <div className="card-header"><span className="card-title"><i className="fa-solid fa-circle-info"></i> Bienvenido al Sistema</span></div>
           <p style={{color: 'var(--color-gris-texto)', lineHeight: '1.6'}}>
               Sesión iniciada como <strong>{usuario.nombre}</strong>. Utilice el menú lateral para gestionar los procesos de Inmobiliaria Del Castillo. El diseño corporativo "Flat Design" le permite una navegación intuitiva y rápida.
           </p>
         </div>
       </div>
      )}
      {vista === "personas" && <PersonaList />}
      {vista === "propiedades" && <PropiedadList />}
      {vista === "contratos" && <ContratoForm />}
      {vista === "finanzas" && <FinanzasList />}
    </Layout>
  );
}

export default App;