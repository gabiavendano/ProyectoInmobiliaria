import { useCallback, useEffect, useRef, useState } from "react";
import { geocodificarDireccion } from "../../utils/geocodificar";

// Centro de Villa Carlos Paz (vista inicial cuando todavía no hay ubicación)
const CENTRO = [-31.4241, -64.4978];

const hayNumero = (v) => v !== "" && v !== null && v !== undefined && Number.isFinite(Number(v));
const redondear = (n) => Number(Number(n).toFixed(6));

const ICONO_PIN = `<div style="width:26px;height:26px;background:#D32F2F;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>`;

const COLORES = {
  buscando: { fondo: "#E3F2FD", texto: "#1565C0" },
  ok: { fondo: "#E8F5E9", texto: "#2E7D32" },
  aprox: { fondo: "#FFF3E0", texto: "#E65100" },
  manual: { fondo: "#E8F5E9", texto: "#2E7D32" },
  falta: { fondo: "#F4F6F8", texto: "#555" },
  nada: { fondo: "#FFEBEE", texto: "#C62828" },
  error: { fondo: "#FFEBEE", texto: "#C62828" },
};

/**
 * Ubicación de la propiedad en el mapa. La latitud y la longitud se completan solas a partir de la dirección
 * (calle, altura, barrio, localidad y provincia); no hace falta escribirlas. Si el punto no cae justo,
 * se puede arrastrar el pin o tocar el mapa para corregirlo.
 */
export default function UbicacionMapa({ calle, numero, barrio, localidad, provincia, latitud, longitud, onCambio }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const pin = useRef(null);
  const ultima = useRef({});          // valores más recientes, para usarlos dentro de temporizadores y eventos del mapa
  const manual = useRef(false);       // true cuando alguien movió el pin a mano: no se lo pisa al cambiar la dirección
  const secuencia = useRef(0);        // descarta respuestas viejas si se lanzó otra búsqueda
  const claveInicial = useRef(null);
  const [estado, setEstado] = useState({ tipo: "falta", texto: "Completá la calle y la localidad: el punto se ubica solo en el mapa." });

  useEffect(() => {
    ultima.current = { calle, numero, barrio, localidad, provincia, latitud, longitud, onCambio };
  });

  const tieneUbicacion = hayNumero(latitud) && hayNumero(longitud);
  const leafletListo = typeof window !== "undefined" && !!window.L;

  // ── Búsqueda de la dirección ───────────────────────────────────────────
  const buscar = useCallback(async () => {
    const d = ultima.current;
    if (!String(d.calle ?? "").trim() || !String(d.localidad ?? "").trim()) {
      setEstado({ tipo: "falta", texto: "Completá la calle y la localidad: el punto se ubica solo en el mapa." });
      return;
    }
    const mio = ++secuencia.current;
    setEstado({ tipo: "buscando", texto: "Buscando la dirección en el mapa..." });
    try {
      const r = await geocodificarDireccion(d);
      if (mio !== secuencia.current) return;
      if (!r) {
        setEstado({ tipo: "nada", texto: "No encontramos esa dirección. Revisá la calle, la altura y la localidad, o tocá el mapa para marcar el punto." });
        return;
      }
      d.onCambio(r.lat, r.lng);
      if (r.precision === "exacta") setEstado({ tipo: "ok", texto: `Ubicación encontrada. Si el pin no cae justo, arrastralo. (${r.etiqueta})` });
      else if (r.precision === "calle") setEstado({ tipo: "aprox", texto: "Encontramos la calle pero no la altura exacta: el pin quedó sobre la calle. Arrastralo hasta la propiedad." });
      else setEstado({ tipo: "aprox", texto: "Solo pudimos ubicar el barrio. Arrastrá el pin hasta la propiedad." });
    } catch {
      if (mio !== secuencia.current) return;
      setEstado({ tipo: "error", texto: "No se pudo consultar el servicio de mapas (¿sin internet?). Podés tocar el mapa para marcar el punto." });
    }
  }, []);

  // Búsqueda automática: al terminar de escribir la dirección (o al abrir una propiedad que todavía no tiene ubicación)
  const clave = [calle, numero, barrio, localidad, provincia].map(v => String(v ?? "").trim().toLowerCase()).join("|");
  useEffect(() => {
    if (claveInicial.current === null) claveInicial.current = clave;
    const d = ultima.current;
    if (manual.current) return;
    if (!String(d.calle ?? "").trim() || !String(d.localidad ?? "").trim()) return;
    const conCoordenadas = hayNumero(d.latitud) && hayNumero(d.longitud);
    if (conCoordenadas && clave === claveInicial.current) return;   // edición sin tocar la dirección: se respeta lo guardado
    const t = setTimeout(buscar, clave === claveInicial.current ? 300 : 1200);
    return () => clearTimeout(t);
  }, [clave, buscar]);

  // ── Mapa ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const L = window.L;
    if (!L || !contenedor.current) return;
    const m = L.map(contenedor.current, { scrollWheelZoom: false }).setView(CENTRO, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(m);
    m.on("click", (e) => {
      manual.current = true;
      ultima.current.onCambio(redondear(e.latlng.lat), redondear(e.latlng.lng));
      setEstado({ tipo: "manual", texto: "Punto marcado a mano en el mapa. Arrastrá el pin para ajustarlo." });
    });
    mapa.current = m;
    const t = setTimeout(() => m.invalidateSize(), 200);
    return () => { clearTimeout(t); m.remove(); mapa.current = null; pin.current = null; };
  }, []);

  // El pin sigue a las coordenadas (vengan de la búsqueda, de un clic o de un arrastre)
  useEffect(() => {
    const L = window.L;
    const m = mapa.current;
    if (!L || !m) return;
    if (!(hayNumero(latitud) && hayNumero(longitud))) {
      if (pin.current) { pin.current.remove(); pin.current = null; }
      return;
    }
    const pos = [Number(latitud), Number(longitud)];
    if (!pin.current) {
      pin.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({ className: "", html: ICONO_PIN, iconSize: [26, 26], iconAnchor: [13, 30] }),
      }).addTo(m);
      pin.current.on("dragend", () => {
        const p = pin.current.getLatLng();
        manual.current = true;
        ultima.current.onCambio(redondear(p.lat), redondear(p.lng));
        setEstado({ tipo: "manual", texto: "Ubicación ajustada a mano." });
      });
    } else {
      pin.current.setLatLng(pos);
    }
    m.setView(pos, Math.max(m.getZoom(), 16));
  }, [latitud, longitud]);

  const buscarDeNuevo = () => { manual.current = false; buscar(); };
  const quitar = () => { manual.current = false; secuencia.current++; onCambio("", ""); setEstado({ tipo: "falta", texto: "Ubicación quitada. Completá la dirección o tocá el mapa para marcar el punto." }); };

  const color = COLORES[estado.tipo] || COLORES.falta;

  return (
    <div style={{ marginTop: "15px" }}>
      <div style={{ backgroundColor: color.fondo, color: color.texto, padding: "10px 14px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "10px" }}>
        <i className={`fa-solid ${estado.tipo === "buscando" ? "fa-spinner fa-spin" : estado.tipo === "ok" || estado.tipo === "manual" ? "fa-circle-check" : estado.tipo === "nada" || estado.tipo === "error" ? "fa-triangle-exclamation" : "fa-location-dot"}`}></i> {estado.texto}
      </div>

      {leafletListo ? (
        <div ref={contenedor} style={{ height: "300px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--color-gris-borde)", zIndex: 0 }}></div>
      ) : (
        <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#eee", borderRadius: "8px", color: "#666", textAlign: "center", padding: "10px" }}>
          El mapa no se pudo cargar (revisá la conexión a internet). La ubicación igual se completa sola al guardar.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginTop: "10px" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-gris-texto)", fontVariantNumeric: "tabular-nums" }}>
          {tieneUbicacion
            ? <>Latitud <strong>{Number(latitud).toFixed(6)}</strong> · Longitud <strong>{Number(longitud).toFixed(6)}</strong> (se completan solas)</>
            : "Todavía sin coordenadas: la propiedad no aparece como punto en el mapa público."}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={buscarDeNuevo}><i className="fa-solid fa-magnifying-glass-location"></i> Buscar de nuevo por la dirección</button>
          {tieneUbicacion && <button type="button" className="btn btn-outline btn-sm" onClick={quitar}><i className="fa-solid fa-eraser"></i> Quitar</button>}
        </span>
      </div>
    </div>
  );
}
