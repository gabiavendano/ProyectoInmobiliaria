import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Avisos from './components/common/Avisos'
import { leerAccesibilidad, aplicarAccesibilidad } from './utils/accesibilidad'

// Opciones de accesibilidad guardadas por el usuario (tamaño de letra, contraste, etc.)
aplicarAccesibilidad(leerAccesibilidad())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Avisos />
  </StrictMode>,
)