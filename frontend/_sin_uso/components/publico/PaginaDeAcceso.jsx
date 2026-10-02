// src/components/publico/PaginaDeAcceso.jsx
// Pantalla de acceso público con dos portales separados: Agentes y Clientes
import React, { useState, useEffect } from 'react';
import { login, setToken } from '../../services/api';
import ClientePortal from './ClientePortal';

const WHATSAPP_NUM = "5493541557179";

// ── Pantalla de Acceso Público ───────────────────────────────────────────────
// Muestra dos botones separados: "Iniciar Sesión como Agente" y "Acceso Cliente"
export default function PaginaDeAcceso({ onGoToAdmin }) {
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [loginTipo, setLoginTipo] = useState("agente"); // 'agente' o 'cliente'
    
    // Estado para login modal
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setCargando(true);
        try {
            const res = await login({ username: email, password });
            if (res.status === 200) {
                const data = res.data;
                setToken(data.token);
                localStorage.setItem('inmobiliaria_token', data.token);
                
                // Si es cliente, mostrar vista cliente
                if (data.usuario.rol === "CLIENTE") {
                    onGoToAdmin(false); // false = modo cliente, no admin
                    window.location.reload(); // Recargar para entrar en modo cliente
                } else {
                    // Agente/Admin → cierra modal y va al panel
                    setShowLoginModal(false);
                    onGoToAdmin(true);
                }
            } else {
                setError(res.data?.error || "Credenciales inválidas");
            }
        } catch (err) {
            setError(err.response?.data?.error || "Error de conexión");
        } finally {
            setCargando(false);
        }
    };

    const openLoginModal = (tipo) => {
        setLoginTipo(tipo);
        setShowLoginModal(true);
        setError("");
        setEmail("");
        setPassword("");
    };

    const closeLoginModal = () => {
        setShowLoginModal(false);
        setError("");
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: 'white'
        }}>
            {/* Logo y header */}
            <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                <img src="/Logo Inmobiliaria.jpg" alt="Logo" style={{ height: '100px', marginBottom: '15px' }} />
                <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    Inmobiliaria Del Castillo
                </h1>
                <p style={{ fontSize: '1.1rem', color: '#a8b5c8', marginTop: '8px', fontWeight: 300 }}>
                    Gestión Inmobiliaria Integral — Villa Carlos Paz, Córdoba
                </p>
            </div>

            {/* Panel de acceso con dos columnas */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '25px',
                maxWidth: '800px',
                width: '100%'
            }}>
                {/* ── Portal de Agentes ── */}
                <div style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    padding: '35px 30px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    cursor: 'pointer',
                    textAlign: 'center'
                }}
                onClick={() => openLoginModal("agente")}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>
                        <i className="fa-solid fa-building" style={{ color: '#FF6B6B' }}></i>
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px', color: 'white' }}>
                        Portal de Agentes
                    </h2>
                    <p style={{ fontSize: '0.95rem', color: '#a8b5c8', margin: '0 0 20px', lineHeight: '1.5' }}>
                        Acceso al panel completo de gestión inmobiliaria:
                        clientes, propiedades, contratos, finanzas, rendiciones y más.
                    </p>
                    <div style={{ background: 'rgba(255,107,107,0.15)', borderRadius: '8px', padding: '12px 15px', marginBottom: '20px' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#FF8A8A', fontWeight: 500 }}>
                            <i className="fa-solid fa-lock" style={{ marginRight: '6px' }}></i>
                            Requiere credenciales de agente o administrador
                        </p>
                    </div>
                    <span style={{ color: '#FF6B6B', fontWeight: 600, fontSize: '0.95rem' }}>
                        Ingresar como Agente →
                    </span>
                </div>

                {/* ── Portal de Clientes ── */}
                <div style={{
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    padding: '35px 30px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    cursor: 'pointer',
                    textAlign: 'center'
                }}
                onClick={() => openLoginModal("cliente")}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>
                        <i className="fa-solid fa-house-chimney" style={{ color: '#4ECDC4' }}></i>
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 10px', color: 'white' }}>
                        Acceso de Cliente
                    </h2>
                    <p style={{ fontSize: '0.95rem', color: '#a8b5c8', margin: '0 0 20px', lineHeight: '1.5' }}>
                        Explorá el catálogo de propiedades en mapa interactivo,
                        contactá por WhatsApp, guardá tus favoritos y filtrados por tus criterios.
                    </p>
                    <div style={{ background: 'rgba(78,205,196,0.15)', borderRadius: '8px', padding: '12px 15px', marginBottom: '20px' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#6EDDC4', fontWeight: 500 }}>
                            <i className="fa-solid fa-info" style={{ marginRight: '6px' }}></i>
                            Acceso gratuito — Podés registrarte con tu email
                        </p>
                    </div>
                    <span style={{ color: '#4ECDC4', fontWeight: 600, fontSize: '0.95rem' }}>
                        Acceder como Cliente →
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '40px', textAlign: 'center', color: '#5a6a7e', fontSize: '0.85rem' }}>
                <p>Villa Carlos Paz, Córdoba, Argentina</p>
                <p style={{ marginTop: '5px' }}>
                    <a href={`https://wa.me/${WHATSAPP_NUM}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4ECDC4' }}>
                        <i className="fa-brands fa-whatsapp"></i> Contactanos por WhatsApp
                    </a>
                </p>
            </div>

            {/* ── Modal de Login ── */}
            {showLoginModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '35px 40px',
                        width: '100%',
                        maxWidth: '420px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }}>
                        {/* Header del modal */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className={`fa-solid ${loginTipo === "agente" ? "fa-building" : "fa-user"}`}
                                    style={{ fontSize: '1.3rem', color: loginTipo === "agente" ? "#FF6B6B" : "#4ECDC4" }}></i>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                                    {loginTipo === "agente" ? "Login de Agente" : "Login de Cliente"}
                                </h3>
                            </div>
                            <button onClick={closeLoginModal} style={{
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#999'
                            }}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Indicador de tipo */}
                        <div style={{
                            padding: '10px 15px',
                            background: loginTipo === "agente" 
                                ? 'rgba(255,107,107,0.1)' 
                                : 'rgba(78,205,196,0.1)',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            borderLeft: `3px solid ${loginTipo === "agente" ? "#FF6B6B" : "#4ECDC4"}`
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                                {loginTipo === "agente" 
                                    ? "Ingredí con tus credenciales de agente o administrador."
                                    : "Ingredí con tu email registrado como cliente."}
                            </p>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleLoginSubmit}>
                            <div style={{ marginBottom: '18px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>
                                    Email / Usuario
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '12px 15px',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {error && (
                                <div style={{
                                    background: '#FFF3F3',
                                    color: '#D32F2F',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    marginBottom: '15px',
                                    fontSize: '0.85rem',
                                    border: '1px solid #FFCDD2'
                                }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={cargando}
                                style={{
                                    width: '100%',
                                    padding: '13px',
                                    background: loginTipo === "agente" ? "#FF6B6B" : "#4ECDC4",
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    cursor: cargando ? 'not-allowed' : 'pointer',
                                    opacity: cargando ? 0.7 : 1
                                }}
                            >
                                {cargando ? "Ingresando..." : `Iniciar Sesión ${loginTipo === "agente" ? "como Agente" : "como Cliente"}`}
                            </button>
                        </form>

                        {/* Footer del modal */}
                        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: '#999' }}>
                            ¿No tenés cuenta? 
                            <button onClick={() => {
                                // Navegar al registro — en este caso simplemente cambiamos de tipo
                                setLoginTipo(loginTipo === "agente" ? "cliente" : "agente");
                                setEmail("");
                                setPassword("");
                                setError("");
                            }} style={{ background: 'none', border: 'none', color: loginTipo === "agente" ? "#4ECDC4" : "#FF6B6B", cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                Cambiar a {loginTipo === "agente" ? "Cliente" : "Agente"}
                            </button>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
