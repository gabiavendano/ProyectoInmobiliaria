function Navbar({ vistaActual, setVista }) {
  const links = [
    { id: "personas",    label: "Personas" },
    { id: "propiedades", label: "Propiedades" },
    { id: "contratos",   label: "Contratos" },
  ];

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <span className="navbar-brand fw-bold">🏠 Inmobiliaria Del Castillo</span>
        <div className="navbar-nav ms-auto">
          {links.map(({ id, label }) => (
            <button key={id}
              className={`nav-link btn btn-link text-decoration-none ms-2 ${
                vistaActual === id ? "fw-bold text-white" : "text-secondary"
              }`}
              onClick={() => setVista(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
export default Navbar;