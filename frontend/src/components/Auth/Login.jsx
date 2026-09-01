import { useState } from "react";

function Login({ onLogin }) {
  const [esRegistro, setEsRegistro] = useState(false);
  const [credenciales, setCredenciales] = useState({ email: "", password: "", nombre: "" });

  const handleChange = (e) => {
    setCredenciales({ ...credenciales, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí a futuro harás la conexión con tu backend (ej. axios.post('/api/login', credenciales))
    // Por ahora, simulamos un ingreso exitoso
    onLogin({ 
      nombre: esRegistro ? credenciales.nombre : "Administrador", 
      iniciales: esRegistro ? credenciales.nombre.substring(0, 2).toUpperCase() : "AD" 
    });
  };

  return (
    <div className="login-container animation-fade-in">
      <div className="login-card">
        <div className="login-logo-container">
           {/* El logo se llama directamente desde la carpeta public */}
           <img src="/Logo Inmobiliaria.jpg" alt="Inmobiliaria Del Castillo" className="login-logo" />
        </div>
        
        <h2 style={{textAlign: 'center', marginBottom: '25px', color: 'var(--color-negro)', fontSize: '1.4rem'}}>
          {esRegistro ? "Crear Nueva Cuenta" : "Iniciar Sesión"}
        </h2>

        <form onSubmit={handleSubmit}>
          {esRegistro && (
            <div className="form-group mb-4">
              <label>Nombre Completo</label>
              <div className="input-with-icon">
                <i className="fa-regular fa-user"></i>
                <input type="text" name="nombre" placeholder="Ej: Juan Pérez" value={credenciales.nombre} onChange={handleChange} required />
              </div>
            </div>
          )}

          <div className="form-group mb-4">
            <label>Correo Electrónico</label>
            <div className="input-with-icon">
              <i className="fa-regular fa-envelope"></i>
              <input type="email" name="email" placeholder="correo@inmobiliaria.com" value={credenciales.email} onChange={handleChange} required />
            </div>
          </div>

          <div className="form-group mb-4">
            <label>Contraseña</label>
            <div className="input-with-icon">
              <i className="fa-solid fa-lock"></i>
              <input type="password" name="password" placeholder="••••••••" value={credenciales.password} onChange={handleChange} required />
            </div>
          </div>

          <button type="submit" className="btn btn-rojo w-100" style={{justifyContent: 'center', padding: '12px', fontSize: '1rem'}}>
            {esRegistro ? "Registrar Usuario" : "Ingresar al Sistema"}
          </button>
        </form>

        <div style={{textAlign: 'center', marginTop: '20px', fontSize: '0.9rem', color: 'var(--color-gris-texto)'}}>
          {esRegistro ? "¿Ya tienes cuenta? " : "¿Necesitas acceso? "}
          <span style={{color: 'var(--color-rojo)', fontWeight: '600', cursor: 'pointer'}} onClick={() => setEsRegistro(!esRegistro)}>
            {esRegistro ? "Inicia Sesión aquí" : "Crea un usuario"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Login;