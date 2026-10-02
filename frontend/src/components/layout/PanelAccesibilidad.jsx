import { useEffect, useRef, useState } from 'react';
import { TAMANOS, OPCIONES_INICIALES, leerAccesibilidad, guardarAccesibilidad, aplicarAccesibilidad } from '../../utils/accesibilidad';

const INTERRUPTORES = [
  ['oscuro', 'Modo oscuro', 'Fondo oscuro y letras claras, más descansado para la vista.'],
  ['contraste', 'Alto contraste', 'Colores más oscuros y bordes marcados.'],
  ['sinAnimaciones', 'Reducir animaciones', 'Quita movimientos y transiciones.'],
  ['espaciado', 'Más espacio en el texto', 'Más separación entre líneas, letras y palabras.'],
  ['fuenteSimple', 'Letra simple', 'Usa una tipografía más neutra (Arial).'],
  ['focoGrande', 'Foco más grueso', 'Resalta con más fuerza el elemento seleccionado con el teclado.'],
];

/** Botón de la barra superior que abre el panel de opciones de accesibilidad. */
export default function PanelAccesibilidad() {
  const [abierto, setAbierto] = useState(false);
  const [opts, setOpts] = useState(leerAccesibilidad);
  const contenedor = useRef(null);
  const boton = useRef(null);

  // Escape y clic afuera cierran el panel
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    const alHacerClic = (e) => { if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('keydown', alTeclear);
    document.addEventListener('mousedown', alHacerClic);
    return () => { document.removeEventListener('keydown', alTeclear); document.removeEventListener('mousedown', alHacerClic); };
  }, [abierto]);

  const cambiar = (parcial) => {
    const nuevas = { ...opts, ...parcial };
    setOpts(nuevas);
    guardarAccesibilidad(nuevas);
    aplicarAccesibilidad(nuevas);
  };
  const restablecer = () => cambiar({ ...OPCIONES_INICIALES });
  const hayCambios = JSON.stringify(opts) !== JSON.stringify(OPCIONES_INICIALES);

  return (
    <div ref={contenedor} className="a11y-wrap">
      <button ref={boton} type="button" className="a11y-toggle" aria-expanded={abierto} aria-controls="panel-accesibilidad"
        aria-label="Opciones de accesibilidad" title="Opciones de accesibilidad" onClick={() => setAbierto(!abierto)}>
        <i className="fa-solid fa-universal-access" aria-hidden="true"></i>
      </button>

      {abierto && (
        <div id="panel-accesibilidad" className="a11y-panel animation-fade-in" role="dialog" aria-label="Opciones de accesibilidad">
          <h2 className="a11y-titulo"><i className="fa-solid fa-universal-access" aria-hidden="true"></i> Accesibilidad</h2>

          <fieldset className="a11y-grupo">
            <legend>Tamaño del texto</legend>
            <div className="a11y-tamanos">
              {TAMANOS.map(t => (
                <button key={t.valor} type="button" aria-pressed={opts.tamano === t.valor}
                  className={`a11y-tamano ${opts.tamano === t.valor ? 'activo' : ''}`} onClick={() => cambiar({ tamano: t.valor })}>
                  <span style={{ fontSize: `${0.8 + (t.valor - 100) / 250}rem`, fontWeight: 700 }}>A</span>
                  <small>{t.etiqueta}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-grupo">
            <legend>Visualización</legend>
            {INTERRUPTORES.map(([clave, titulo, ayuda]) => (
              <label key={clave} className="a11y-opcion">
                <input type="checkbox" checked={opts[clave]} onChange={(e) => cambiar({ [clave]: e.target.checked })} />
                <span><strong>{titulo}</strong><small>{ayuda}</small></span>
              </label>
            ))}
          </fieldset>

          <div className="a11y-pie">
            <small>Se guarda en este navegador.</small>
            <button type="button" className="btn btn-outline" style={{ padding: "7px 14px", fontSize: "0.85rem" }} onClick={restablecer} disabled={!hayCambios}>Restablecer</button>
          </div>
        </div>
      )}
    </div>
  );
}
