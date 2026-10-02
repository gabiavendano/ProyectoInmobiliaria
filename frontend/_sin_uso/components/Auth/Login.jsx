import { useState } from "react";
import { login, register, setToken } from "../../services/api";

function Login({ onLogin }) {
  const [esRegistro, setEsRegistro] = useState(false);
  const [tipoLogin, setTipoLogin] = useState("cliente"); // 'cliente' o 'agente'
  const [credenciales, setCredenciales] = useState({ email: "", password: "", nombre: "", rol: "CLIENTE" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setCredenciales({ ...credenciales, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (esRegistro) {
        const res = await register({
          username: credenciales.email,
          password: credenciales.password,
          nombre: credenciales.nombre.trim() || credenciales.email,
          rol: tipoLogin === "agente" ? "AGENTE" : "CLIENTE",
        });
        if (res.status === 200) {
          // Registro exitoso → iniciar sesión automáticamente con las mismas credenciales
          const loginRes = await login({
            username: credenciales.email,
            password: credenciales.password,
          });
          if (loginRes.status === 200) {
            const data = loginRes.data;
            setToken(data.token);
            onLogin({
              nombre: data.usuario.nombre,
              iniciales: data.usuario.iniciales,
              rol: data.usuario.rol,
            });
          } else {
            // Login después del registro falló: mostrar error y dejar en modo login
            setError(loginRes.data?.error || "Usuario registrado pero no se pudo iniciar sesión automáticamente. Intentá ingresar manualmente.");
            setEsRegistro(false);
          }
        } else {
          // Registro falló (ej: usuario ya existe)
          setError(res.data?.error || "Error al registrar. El usuario puede ya existir.");
        }
      } else {
        const res = await login({
          username: credenciales.email,
          password: credenciales.password,
        });
        if (res.status === 200) {
          const data = res.data;
          setToken(data.token);
          onLogin({
            nombre: data.usuario.nombre,
            iniciales: data.usuario.iniciales,
            rol: data.usuario.rol,
          });
        } else {
          // Login fallido: mostrar error explícito
          setError(res.data?.error || "Credenciales inválidas. Verifica usuario y contraseña.");
        }
      }
    } catch (err) {
      const msg = esRegistro
        ? err.response?.data?.error || "Error al crear la cuenta. El usuario puede ya existir."
        : err.response?.data?.error || "Credenciales inválidas. Verifica usuario y contraseña.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container animation-fade-in">
      <div className="login-card" style={{ maxWidth: '420px', margin: '40px auto', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)', padding: '25px 30px', textAlign: 'center', color: 'white' }}>
          <img src="/Logo Inmobiliaria.jpg" alt="Inmobiliaria Del Castillo" className="login-logo" style={{ maxWidth: '180px', marginBottom: '10px' }} />
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Inmobiliaria Del Castillo</h1>
          <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#aaa' }}>Gestión Inmobiliaria Integrata</p>
        </div>

        <div style={{ padding: '25px 30px', background: '#f8f9fa' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: 'var(--color-negro)', fontSize: '1.2rem', fontWeight: 700 }}>
            {esRegistro ? "Crear Nueva Cuenta" : "Iniciar Sesión"}
          </h2>

          {/* Selector de tipo de cuenta - solo en modo registro */}
          {esRegistro && (
            <div style={{ marginBottom: '20px', padding: '15px', background: 'white', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '12px', color: 'var(--color-negro)', fontSize: '0.9rem' }}>
                ¿Qué tipo de cuenta necesitas?
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setTipoLogin("cliente"); setError(""); setCredenciales({ ...credenciales, rol: "CLIENTE" }); }}
                  className={`btn ${tipoLogin === "cliente" ? "btn-rojo" : "btn-outline"}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  <i className="fa-solid fa-user"></i> Cliente
                </button>
                <button
                  type="button"
                  onClick={() => { setTipoLogin("agente"); setError(""); setCredenciales({ ...credenciales, rol: "AGENTE" }); }}
                  className={`btn ${tipoLogin === "agente" ? "btn-rojo" : "btn-outline"}`}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  <i className="fa-solid fa-building"></i> Agente / Admin
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: '#FFEAEA', color: '#C62828', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem', border: '1px solid #FFCDD2' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {esRegistro && (
              <div className="form-group mb-4">
                <label>Nombre Completo</label>
                <div className="input-with-icon">
                  <i className="fa-regular fa-user"></i>
                  <input
                    type="text"
                    name="nombre"
                    placeholder="Ej: Juan Pérez"
                    value={credenciales.nombre}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group mb-4">
              <label>Correo Electrónico (se usará como usuario)</label>
              <div className="input-with-icon">
                <i className="fa-regular fa-envelope"></i>
                <input
                  type="email"
                  name="email"
                  placeholder="correo@inmobiliaria.com"
                  value={credenciales.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group mb-4">
              <label>Contraseña</label>
              <div className="input-with-icon">
                <i className="fa-solid fa-lock"></i>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={credenciales.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-rojo w-100"
              style={{ justifyContent: 'center', padding: '12px', fontSize: '1rem' }}
              disabled={cargando}
            >
              {cargando ? "Procesando..." : (esRegistro ? "Registrar Cuenta" : "Ingresar al Sistema")}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: '#666' }}>
            {esRegistro ? "¿Ya tienes cuenta? " : "¿No tenés cuenta? "}
            <span
              style={{ color: 'var(--color-rojo)', fontWeight: '600', cursor: 'pointer' }}
              onClick={() => { setEsRegistro(!esRegistro); setError(""); }}
            >
              {esRegistro ? "Inicia Sesión aquí" : "Crea una cuenta ahora"}
            </span>
          </div>

          {/* Info adicional para agentes */}
          {!esRegistro && tipoLogin === "agente" && (
            <div style={{ marginTop: '20px', padding: '12px', background: '#FFF3E0', borderRadius: '8px', border: '1px solid #FFE0B2', fontSize: '0.8rem', color: '#E65100' }}>
              <strong>🔑 Acceso de Agente:</strong> El panel completo de gestión inmobiliaria (clientes, propiedades, contratos, finanzas) está disponible para usuarios con rol de Agente o Admin.
            </div>
          )}

          {/* Info adicional para clientes */}
          {!esRegistro && tipoLogin === "cliente" && (
            <div style={{ marginTop: '15px', padding: '12px', background: '#E8F5E9', borderRadius: '8px', border: '1px solid #C8E6C9', fontSize: '0.8rem', color: '#2E7D32' }}>
              <strong>🏠 Acceso de Cliente:</strong> Podes ver el mapa de propiedades, filtrar por tus criterios, guardar favoritos y contactarnos por WhatsApp.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
