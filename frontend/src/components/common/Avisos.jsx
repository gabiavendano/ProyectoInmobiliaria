import { useEffect, useState } from "react";

/** Se monta una sola vez en la raíz de la app y muestra los avisos de utils/avisos.js */
export default function Avisos() {
  const [lista, setLista] = useState([]);

  useEffect(() => {
    let n = 0;
    const alLlegar = (e) => {
      const id = ++n;
      const aviso = { id, ...e.detail };
      setLista((l) => [...l.slice(-3), aviso]);
      setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), aviso.tipo === "error" ? 9000 : 4500);
    };
    window.addEventListener("app-aviso", alLlegar);
    return () => window.removeEventListener("app-aviso", alLlegar);
  }, []);

  if (!lista.length) return null;
  return (
    <div className="avisos-contenedor" aria-live="polite">
      {lista.map((a) => (
        <div key={a.id} className={`aviso aviso-${a.tipo}`} role={a.tipo === "error" ? "alert" : "status"}>
          <i className={`fa-solid ${a.tipo === "error" ? "fa-circle-exclamation" : a.tipo === "ok" ? "fa-circle-check" : "fa-circle-info"}`} aria-hidden="true"></i>
          <span>{a.texto}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setLista((l) => l.filter((x) => x.id !== a.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
