// src/App.jsx
// Arquitectura simplificada: el MapaInteractivo es la vista principal para todos
// - No logueado: ve el mapa sin funcionalidades de cliente (favoritos bloqueados)
// - Logueado como cliente: se queda en el mapa con favoritos habilitados
// - Logueado como agente/admin: se redirige al panel de gestión
import { lazy, Suspense, startTransition, useState, useEffect } from 'react';
import { cerrarSesion, limpiarSesion, haySesion, me } from './services/api';
import LoginAgente from './components/publico/LoginAgente';

// Cada módulo del panel se descarga la primera vez que se usa. Para que el cambio de módulo no deje la pantalla en blanco:
//  1) todos se precargan en segundo plano apenas se abre el login o el panel, y
//  2) el cambio de módulo se hace con startTransition: si algo todavía no llegó, se sigue viendo el módulo anterior hasta que esté listo.
const cargadores = {
  layout: () => import('./components/layout/Layout'),
  personas: () => import('./components/personas/PersonaList'),
  leads: () => import('./components/leads/LeadsWeb'),
  dashboard: () => import('./components/dashboard/PanelGeneral'),
  propiedades: () => import('./components/propiedades/PropiedadList'),
  contratos: () => import('./components/contratos/ContratoList'),
  finanzas: () => import('./components/Finanzas/FinanzasList'),
};
const precargarPanel = () => Object.values(cargadores).forEach(cargar => { cargar().catch(() => { /* sin red: se reintenta al entrar */ }); });

const Layout = lazy(cargadores.layout);
const PersonaList = lazy(cargadores.personas);
const LeadsWeb = lazy(cargadores.leads);
const PanelGeneral = lazy(cargadores.dashboard);
const PropiedadList = lazy(cargadores.propiedades);
const ContratoList = lazy(cargadores.contratos);
const FinanzasList = lazy(cargadores.finanzas);
import MapaInteractivo from './components/publico/MapaInteractivo';

function App() {
  // Solo se restaura el panel si la sesión se abrió desde "Ingresá como Agente"
  const hayToken = haySesion() && localStorage.getItem('inmobiliaria_panel') === '1';
  const [appMode, setAppMode] = useState(hayToken ? 'admin' : 'mapa');   // 'mapa' | 'login' | 'admin'
  const [usuario, setUsuario] = useState(null);
  const [vista, setVistaActual] = useState('dashboard');
  // El cambio de módulo es una "transición": no se pasa por una pantalla en blanco mientras llega el módulo nuevo
  const setVista = (v) => startTransition(() => setVistaActual(v));
  const [cargandoUsuario, setCargandoUsuario] = useState(hayToken);

  // Precarga de los módulos del panel mientras se ve el login o el panel
  useEffect(() => {
    if (appMode === 'login' || appMode === 'admin') precargarPanel();
  }, [appMode]);

  // Sesión vencida o inválida (la dispara el interceptor de api.js ante un 401)
  useEffect(() => {
    const onExpired = () => {
      limpiarSesion();
      localStorage.removeItem('inmobiliaria_panel');
      setUsuario(null);
      setAppMode('login');
    };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  // Cargar datos del usuario cuando se entra al modo admin (por ejemplo al recargar la página)
  useEffect(() => {
    if (appMode === 'admin' && !usuario && haySesion()) {
      me()
        .then(({ data }) => {
          const u = data.usuario || data;
          if (u.rol === 'ADMIN' || u.rol === 'AGENTE') {
            setUsuario({ nombre: u.nombre || u.username || '', iniciales: u.iniciales || '', rol: u.rol || '', id: u.id });
          } else {
            // Es un cliente: se queda en el mapa (su sesión sirve para favoritos)
            localStorage.removeItem('inmobiliaria_panel');
            setAppMode('mapa');
          }
        })
        .catch((err) => {
          // 401: el interceptor ya limpió la sesión. Otro error (red, servidor caído): no se pierde el token, se vuelve al mapa.
          console.error('No se pudo cargar la sesión', err?.response?.status || err?.message);
          if (err?.response?.status === 401) limpiarSesion();
          setAppMode('mapa');
        })
        .finally(() => setCargandoUsuario(false));
    }
  }, [appMode, usuario]);

  // Mientras se verifica la sesión: pantalla en blanco (sin carteles)
  if (cargandoUsuario) {
    return <div style={{ minHeight: '100vh', background: '#f5f5f5' }} />;
  }

  // Panel de Administración / Agentes
  if (appMode === 'admin' && usuario) {
    return (
      <Suspense fallback={null}>
      <Layout vistaActual={vista} setVista={setVista} usuarioActual={usuario} onLogout={() => {
        cerrarSesion();
        localStorage.removeItem('inmobiliaria_panel');
        setUsuario(null);
        setAppMode('mapa');
      }}>
        <Suspense fallback={null}>
          {vista === 'dashboard' && <PanelGeneral usuario={usuario} setVista={setVista} />}
          {vista === 'leads' && <LeadsWeb onVerClientes={() => setVista('personas')} />}
          {vista === 'personas' && <PersonaList />}
          {vista === 'propiedades' && <PropiedadList />}
          {vista === 'contratos' && <ContratoList />}
          {vista === 'finanzas' && <FinanzasList />}
        </Suspense>
      </Layout>
      </Suspense>
    );
  }

  // Pantalla de login
  if (appMode === 'login') {
    return (
      <LoginAgente
        onVolver={() => setAppMode('mapa')}
        onIngreso={(u) => {
          const esStaff = u.rol === 'ADMIN' || u.rol === 'AGENTE';
          if (esStaff) {
            // Esta marca hace que, al recargar la página, se vuelva a abrir el panel
            try { localStorage.setItem('inmobiliaria_panel', '1'); } catch { /* sin almacenamiento */ }
            setUsuario({ nombre: u.nombre, iniciales: u.iniciales, rol: u.rol, id: u.id });
            startTransition(() => setAppMode('admin'));   // se sigue viendo el login hasta que el panel esté listo
          } else {
            setAppMode('mapa');   // un cliente sigue en el mapa (su sesión sirve para favoritos)
          }
        }}
      />
    );
  }

  // Vista pública: Mapa interactivo
  return (
    <MapaInteractivo
      onGoToAdmin={(yaLogueado) =>
        setAppMode(yaLogueado === true || localStorage.getItem('inmobiliaria_panel') === '1' ? 'admin' : 'login')
      }
    />
  );
}

export default App;
