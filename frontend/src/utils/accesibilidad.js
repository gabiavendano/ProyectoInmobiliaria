// Opciones de accesibilidad del usuario (se guardan en este navegador y se aplican al abrir la aplicación).
const CLAVE = 'inmobiliaria_accesibilidad';

export const TAMANOS = [
  { valor: 100, etiqueta: 'Normal' },
  { valor: 115, etiqueta: 'Grande' },
  { valor: 130, etiqueta: 'Muy grande' },
  { valor: 150, etiqueta: 'Máximo' },
];

export const OPCIONES_INICIALES = {
  tamano: 100,            // % del tamaño de letra
  oscuro: false,          // modo oscuro
  contraste: false,       // alto contraste
  sinAnimaciones: false,  // reducir animaciones
  espaciado: false,       // más espacio entre líneas, letras y palabras
  fuenteSimple: false,    // tipografía simple (Arial)
  focoGrande: false,      // contorno de foco más grueso
};

export function leerAccesibilidad() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE));
    if (!g || typeof g !== 'object') return { ...OPCIONES_INICIALES };
    return {
      tamano: TAMANOS.some(t => t.valor === g.tamano) ? g.tamano : 100,
      oscuro: g.oscuro === true,
      contraste: g.contraste === true,
      sinAnimaciones: g.sinAnimaciones === true,
      espaciado: g.espaciado === true,
      fuenteSimple: g.fuenteSimple === true,
      focoGrande: g.focoGrande === true,
    };
  } catch {
    return { ...OPCIONES_INICIALES };
  }
}

export function guardarAccesibilidad(o) {
  try { localStorage.setItem(CLAVE, JSON.stringify(o)); } catch { /* sin almacenamiento: queda solo en esta sesión */ }
}

/** Aplica las opciones a la página (tamaño de letra y clases que activan los estilos de index.css). */
export function aplicarAccesibilidad(o) {
  const r = document.documentElement;
  r.style.fontSize = o.tamano === 100 ? '' : `${o.tamano}%`;
  r.classList.toggle('a11y-oscuro', !!o.oscuro);
  r.classList.toggle('a11y-contraste', !!o.contraste);
  r.classList.toggle('a11y-sin-animaciones', !!o.sinAnimaciones);
  r.classList.toggle('a11y-espaciado', !!o.espaciado);
  r.classList.toggle('a11y-fuente-simple', !!o.fuenteSimple);
  r.classList.toggle('a11y-foco-grande', !!o.focoGrande);
}

/** Para elementos que se comportan como botón pero no son <button>: los hace alcanzables con Tab y activables con Enter o Espacio. */
export function comoBoton(accion, extra = {}) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: accion,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); accion(); }
    },
    ...extra,
  };
}
