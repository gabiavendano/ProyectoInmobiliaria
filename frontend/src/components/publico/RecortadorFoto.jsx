// src/components/publico/RecortadorFoto.jsx
// Editor de recorte para la foto de perfil: arrastrá la imagen para elegir qué parte
// queda dentro del círculo y usá el zoom para acercar o alejar.
// Devuelve un JPEG cuadrado de 256x256 (data URL) listo para guardar en el perfil.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { avisar } from "../../utils/avisos";

const VISOR = 280;      // tamaño del recuadro de edición (px)
const SALIDA = 256;     // tamaño final de la foto (px)
const ZOOM_MAX = 4;

export default function RecortadorFoto({ src, onCancel, onConfirm }) {
    const [img, setImg] = useState(null);             // { el, w, h }
    const [zoom, setZoom] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });   // desplazamiento del centro de la imagen respecto al centro del visor
    const arrastre = useRef(null);
    const [moviendo, setMoviendo] = useState(false);   // solo para el cursor

    useEffect(() => {
        const el = new Image();
        el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight });
        el.onerror = () => { avisar('No se pudo leer la imagen'); onCancel(); };
        el.src = src;
    }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

    // La imagen siempre cubre todo el visor (escala mínima = "cover")
    const base = img ? VISOR / Math.min(img.w, img.h) : 1;
    const escala = base * zoom;
    const anchoImg = img ? img.w * escala : 0;
    const altoImg = img ? img.h * escala : 0;

    const limitar = (p, esc = escala) => {
        if (!img) return p;
        const maxX = Math.max(0, (img.w * esc - VISOR) / 2);
        const maxY = Math.max(0, (img.h * esc - VISOR) / 2);
        return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
    };

    const cambiarZoom = (nuevo) => {
        const z = Math.min(ZOOM_MAX, Math.max(1, nuevo));
        setZoom(z);
        // Al cambiar el zoom, reacomoda para no dejar bordes vacíos
        setPos(p => limitar(p, base * z));
    };

    const onPointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        arrastre.current = { x: e.clientX, y: e.clientY, pos };
        setMoviendo(true);
    };
    const onPointerMove = (e) => {
        if (!arrastre.current) return;
        const dx = e.clientX - arrastre.current.x;
        const dy = e.clientY - arrastre.current.y;
        setPos(limitar({ x: arrastre.current.pos.x + dx, y: arrastre.current.pos.y + dy }));
    };
    const onPointerUp = () => { arrastre.current = null; setMoviendo(false); };
    const onWheel = (e) => { cambiarZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1)); };

    const confirmar = () => {
        if (!img) return;
        // Zona de la imagen original que queda dentro del visor
        const lado = VISOR / escala;
        const sx = (0 - VISOR / 2 - pos.x) / escala + img.w / 2;
        const sy = (0 - VISOR / 2 - pos.y) / escala + img.h / 2;
        const canvas = document.createElement('canvas');
        canvas.width = SALIDA; canvas.height = SALIDA;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, SALIDA, SALIDA);
        ctx.drawImage(img.el, sx, sy, lado, lado, 0, 0, SALIDA, SALIDA);
        onConfirm(canvas.toDataURL('image/jpeg', 0.85));
    };

    const frenar = (e) => e.stopPropagation();

    return createPortal(
        <div
            onClick={frenar} onMouseDown={frenar}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2147483000,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
            }}
        >
            <div style={{
                background: 'white', borderRadius: 16, padding: 22, width: 'min(94vw, 360px)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)', textAlign: 'center'
            }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>Ajustá tu foto</h3>
                <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#777' }}>
                    Arrastrá la imagen para elegir qué parte querés mostrar.
                </p>

                <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onWheel={onWheel}
                    style={{
                        position: 'relative', width: VISOR, height: VISOR, margin: '0 auto',
                        overflow: 'hidden', background: '#ddd', borderRadius: 12,
                        cursor: moviendo ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none'
                    }}
                >
                    {img && (
                        <img
                            src={src} alt="" draggable={false}
                            style={{
                                position: 'absolute', maxWidth: 'none', pointerEvents: 'none',
                                width: anchoImg, height: altoImg,
                                left: VISOR / 2 + pos.x - anchoImg / 2,
                                top: VISOR / 2 + pos.y - altoImg / 2
                            }}
                        />
                    )}
                    {/* Fuera del círculo se ve opaco: lo que queda adentro es lo que se guarda */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'radial-gradient(circle closest-side, transparent 98%, rgba(0,0,0,0.55) 100%)'
                    }} />
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.9)'
                    }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 4px 6px' }}>
                    <i className="fa-solid fa-magnifying-glass-minus" style={{ color: '#888' }}></i>
                    <input
                        type="range" min="1" max={ZOOM_MAX} step="0.01" value={zoom}
                        onChange={e => cambiarZoom(parseFloat(e.target.value))}
                        aria-label="Zoom"
                        style={{ flex: 1 }}
                    />
                    <i className="fa-solid fa-magnifying-glass-plus" style={{ color: '#888' }}></i>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                    <button
                        type="button" onClick={onCancel}
                        style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#555' }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button" onClick={confirmar} disabled={!img}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#111', color: 'white', cursor: 'pointer' }}
                    >
                        <i className="fa-solid fa-check"></i> Usar esta foto
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
