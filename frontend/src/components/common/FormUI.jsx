// Componentes de formulario compartidos por Personas, Propiedades, Contratos y Finanzas.
// Viven afuera de los formularios para que React no los recree en cada tecla (si no, el input pierde el foco).
import { comoBoton } from '../../utils/accesibilidad';

export const Botones = ({ label, options, name, valorActual, onChange }) => (
  <div className="form-group">
    <label>{label}</label>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange({ target: { name, value: opt, type: 'text' } })}
          className={`btn ${valorActual === opt ? 'btn-rojo' : 'btn-outline'}`} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem' }}>
          {opt}
        </button>
      ))}
    </div>
  </div>
);

export const InputG = ({ label, name, type = "text", ph = "", col = 1, valorActual, onChange, icon, list, inputMode, maxLength, min, max, step, requerido, error }) => {
  // En campos numéricos con mínimo 0 no se puede tipear el signo menos ni la notación científica
  const sinNegativos = type === "number" && min !== undefined && Number(min) >= 0;
  const bloquear = sinNegativos ? (e) => { if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") e.preventDefault(); } : undefined;
  const input = (
    <input type={type} name={name} value={valorActual ?? ""} onChange={onChange} placeholder={ph}
      list={list} inputMode={inputMode} maxLength={maxLength} min={min} max={max} step={step} onKeyDown={bloquear}
      aria-invalid={error ? "true" : undefined} aria-required={requerido ? "true" : undefined} />
  );
  return (
    <div className="form-group" style={{ flex: col }}>
      <label>{label}{requerido && <span className="req" aria-hidden="true">*</span>}</label>
      {icon ? (
        <div className="input-with-icon"><i className={`fa-solid ${icon}`}></i>{input}</div>
      ) : input}
      {error && <small className="campo-error" role="alert">{error}</small>}
    </div>
  );
};

export const GridChecks = ({ title, arrayName, options, valoresActuales = [], onChangeCheck }) => (
  <div style={{ marginBottom: '20px' }}>
    <h6 style={{ color: 'var(--color-rojo)', marginBottom: '10px' }}>{title}</h6>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px solid var(--color-gris-borde)' }}>
      {options.map(opt => (
        <div className="checkbox-group" key={opt} style={{ margin: 0 }}>
          <input type="checkbox" id={`${arrayName}_${opt}`} checked={valoresActuales.includes(opt)} onChange={(e) => onChangeCheck(arrayName, opt, e.target.checked)} />
          <label htmlFor={`${arrayName}_${opt}`} style={{ fontSize: '0.85rem' }}>{opt}</label>
        </div>
      ))}
    </div>
  </div>
);

export const AccordionH = ({ id, title, icon, isOpen, onToggle }) => (
  <div {...comoBoton(() => onToggle(id), { 'aria-expanded': !!isOpen })} style={{ padding: '18px 25px', backgroundColor: isOpen ? '#FFF8F8' : '#F8FAFC', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: isOpen ? '2px solid var(--color-rojo)' : 'none', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: isOpen ? 'var(--color-rojo)' : 'var(--color-negro)' }}><i className={`fa-solid ${icon}`}></i> {title}</span>
    <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ color: 'var(--color-gris-texto)' }}></i>
  </div>
);
