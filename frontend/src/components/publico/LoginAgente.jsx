import { useState } from "react";
import CampoContrasena from "../common/CampoContrasena";
import { login, marcarSesion } from "../../services/api";

/**
 * Pantalla de ingreso al Panel de Gestión (agentes y administradores).
 * onIngreso(usuario) se llama cuando el login fue correcto; onVolver() vuelve al mapa público.
 */
export default function LoginAgente({ onIngreso, onVolver }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !password) { setError("Completá el usuario y la contraseña."); return; }
    setError("");
    setCargando(true);
    try {
      const res = await login({ username: usuario.trim(), password });
      marcarSesion();
      onIngreso(res.data.usuario);
    } catch (err) {
      const status = err.response?.status;
      setError(err.response?.data?.error
        || (status ? "No se pudo ingresar. Probá de nuevo." : "No hay conexión con el servidor."));
    } finally {
      setCargando(false);
    }
  };

  const campo = { padding: "12px 14px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "0.95rem" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: "16px" }}>
      <div style={{ background: "white", borderRadius: "16px", padding: "35px 40px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <img src="/Logo Inmobiliaria.jpg" alt="Logo" style={{ height: "60px", marginBottom: "10px" }} />
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#1a1a2e" }}>Portal de Agentes Inmobiliarios</h2>
          <p style={{ fontSize: "0.85rem", color: "#888", marginTop: "5px" }}>Ingresá con tus credenciales de agente o administrador</p>
        </div>

        <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input type="text" autoComplete="username" placeholder="Email / Usuario" value={usuario}
                 onChange={(e) => setUsuario(e.target.value)} style={campo} />
          <CampoContrasena autoComplete="current-password" placeholder="Contraseña" value={password}
                 onChange={(e) => setPassword(e.target.value)} style={campo} />
          {error && (
            <div role="alert" style={{ background: "#fdecea", color: "#a61b1b", borderRadius: "8px", padding: "10px 12px", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={cargando}
                  style={{ padding: "12px", background: "#FF6B6B", color: "white", border: "none", borderRadius: "8px", fontSize: "0.95rem", fontWeight: 600, cursor: cargando ? "wait" : "pointer", opacity: cargando ? 0.7 : 1 }}>
            {cargando ? "Ingresando..." : "Ingresar al Panel de Gestión"}
          </button>
          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#999", margin: 0 }}>
            ¿No tenés credenciales? Contactá a un administrador.
          </p>
        </form>

        <button type="button" onClick={onVolver}
                style={{ marginTop: "20px", width: "100%", padding: "10px", background: "none", border: "1px solid #ddd", borderRadius: "8px", color: "#666", cursor: "pointer", fontSize: "0.9rem" }}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: "6px" }}></i>
          Volver al Mapa Público
        </button>
      </div>
    </div>
  );
}
