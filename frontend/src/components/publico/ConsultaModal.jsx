// src/components/publico/ConsultaModal.jsx
// Formulario para que un cliente registrado le envíe una consulta a la inmobiliaria sobre una propiedad.
// Se guarda en el backend (POST /api/consultas) y aparece en el panel de agentes, en "Leads Web".
import { apiFetch } from "../../services/api";
import { useState, useEffect } from 'react';



export default function ConsultaModal({ prop, telefonoInicial = '', onClose, onEnviada }) {
    const [mensaje, setMensaje] = useState(
        prop ? `Hola, me interesa "${prop.title}" (Ref: ${prop.id}). ¿Podrían darme más información?` : ''
    );
    const [horario, setHorario] = useState('');
    const [telefono, setTelefono] = useState(telefonoInicial || '');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [listo, setListo] = useState(false);

    const frenar = (e) => e.stopPropagation();

    // Escape cierra la ventana
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const enviar = async (e) => {
        e.preventDefault();
        if (enviando) return;
        setError('');
        if (!mensaje.trim()) { setError('Escribí tu consulta.'); return; }
        if (!/^[0-9+()\-\s.]{0,30}$/.test(telefono)) { setError('El teléfono solo puede tener números, espacios y + ( ) - .'); return; }

        setEnviando(true);
        try {
            const res = await apiFetch('/consultas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idPropiedad: prop?.id ?? null,
                    mensaje: mensaje.trim(),
                    horarioPreferido: horario.trim() || null,
                    telefono: telefono.trim() || null
                })
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401 || res.status === 403) { setError('Tu sesión venció. Cerrá esta ventana, volvé a ingresar y enviá la consulta de nuevo.'); return; }
            if (res.status === 429) { setError('Enviaste muchas consultas seguidas. Esperá unos minutos e intentá de nuevo.'); return; }
            if (!res.ok) { setError(data.error || 'No se pudo enviar la consulta. Probá de nuevo.'); return; }
            setListo(true);
            if (onEnviada) onEnviada(data);
        } catch {
            setError('No se pudo conectar con el servidor.');
        } finally {
            setEnviando(false);
        }
    };

    const estiloInput = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-gris-borde)', background: 'var(--color-blanco)', color: 'var(--color-negro)', marginBottom: 12, fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' };

    return (
        <div onClick={frenar} onMouseDown={frenar}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div role="dialog" aria-modal="true" aria-label="Enviar consulta" style={{ background: 'var(--color-blanco)', color: 'var(--color-negro)', borderRadius: 16, padding: 24, width: 'min(94vw, 440px)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                {listo ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                        <i className="fa-solid fa-circle-check" style={{ fontSize: '3rem', color: '#2e7d32', marginBottom: 12 }}></i>
                        <h3 style={{ margin: '0 0 8px' }}>¡Consulta enviada!</h3>
                        <p style={{ color: 'var(--color-gris-texto)', margin: '0 0 18px' }}>Un agente de Inmobiliaria Del Castillo se va a comunicar con vos a la brevedad.</p>
                        <button type="button" className="btn-rojo" style={{ width: '100%' }} onClick={onClose}>Cerrar</button>
                    </div>
                ) : (
                    <form onSubmit={enviar}>
                        <h3 style={{ margin: '0 0 4px' }}>Enviar consulta</h3>
                        {prop && <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: 'var(--color-gris-texto)' }}>{prop.title} · {prop.priceStr}</p>}

                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tu consulta</label>
                        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} maxLength={1000} style={estiloInput} />

                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Teléfono de contacto (opcional)</label>
                        <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} placeholder="Ej: 351 123 4567" style={estiloInput} />

                        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>¿Cuándo te queda cómodo que te contactemos? (opcional)</label>
                        <input type="text" value={horario} onChange={(e) => setHorario(e.target.value)} maxLength={100} placeholder="Ej: lunes a viernes por la tarde" style={estiloInput} />

                        {error && <div role="alert" style={{ background: '#FFEBEE', color: '#C62828', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" className="btn-details" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
                            <button type="submit" className="btn-rojo" style={{ flex: 1 }} disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar consulta'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
