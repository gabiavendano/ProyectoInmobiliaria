import { useMemo, useState } from "react";
import { nochesEntreFechas } from "../../utils/fechas";

// Calendario de disponibilidad de un alquiler temporario.
// Las noches ocupadas van de "desde" (check-in) a "hasta" (check-out) SIN incluir el día de salida:
// el día de check-out de una estadía puede ser el check-in de la siguiente.

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const partes = (s) => s.split("-").map(Number);
const sumarDias = (s, n) => { const [y, m, d] = partes(s); const f = new Date(y, m - 1, d + n); return iso(f.getFullYear(), f.getMonth(), f.getDate()); };
const hoyIso = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth(), n.getDate()); };
const fmt = (s) => { const [y, m, d] = partes(s); return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`; };

/** Conjunto con todas las noches (YYYY-MM-DD) cubiertas por una lista de rangos. */
function nochesDe(rangos) {
  const set = new Set();
  (rangos || []).forEach(r => {
    if (!r?.desde || !r?.hasta) return;
    let d = r.desde, guarda = 0;
    while (d < r.hasta && guarda++ < 800) { set.add(d); d = sumarDias(d, 1); }
  });
  return set;
}

// Paleta del sistema: solo se destacan en rojo las noches ocupadas; lo libre queda neutro.
const COLORES = {
  libre:    { bg: "#FFFFFF", fg: "#222222", borde: "1px solid #D9D9D9" },
  ocupada:  { bg: "var(--color-rojo, #C8102E)", fg: "#FFFFFF", borde: "1px solid transparent" },
  tentativa:{ bg: "#FDECEC", fg: "#C8102E", borde: "1px dashed #C8102E" },
  elegida:  { bg: "#1A1A1A", fg: "#FFFFFF", borde: "1px solid #1A1A1A" },
  pasada:   { bg: "transparent", fg: "#9E9E9E", borde: "1px solid transparent" },
};

function Mes({ anio, mes, ocupadas, tentativas, seleccion, hoy, onClic }) {
  const primero = new Date(anio, mes, 1);
  const offset = (primero.getDay() + 6) % 7;            // semana que empieza en lunes
  const dias = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= dias; d++) celdas.push(iso(anio, mes, d));
  const elegidas = nochesDe(seleccion?.desde && seleccion?.hasta ? [seleccion] : []);

  return (
    <div style={{ flex: "1 1 250px", minWidth: 240 }}>
      <div style={{ textAlign: "center", fontWeight: 600, marginBottom: 6 }}>{MESES[mes]} {anio}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {DIAS.map(d => <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", opacity: 0.6 }}>{d}</div>)}
        {celdas.map((f, i) => {
          if (!f) return <div key={`v${i}`} />;
          const pasado = f < hoy;
          const ocupada = ocupadas.has(f);
          const tentativa = !ocupada && tentativas.has(f);
          const esDesde = seleccion?.desde === f;
          const esHasta = seleccion?.hasta === f;
          const enRango = elegidas.has(f);
          const estado = pasado ? "pasada" : (esDesde || esHasta || enRango) ? "elegida" : ocupada ? "ocupada" : tentativa ? "tentativa" : "libre";
          const c = COLORES[estado];
          const titulo = pasado ? "Fecha pasada" : ocupada ? "Ocupado" : tentativa ? "Reservado (sin confirmar)" : esDesde ? "Llegada" : esHasta ? "Salida" : "Libre";
          return (
            <button key={f} type="button" disabled={pasado || !onClic} onClick={() => onClic(f)} title={`${fmt(f)} · ${titulo}`}
              aria-label={`${fmt(f)}: ${titulo}`}
              style={{ border: esDesde || esHasta ? "2px solid #000000" : c.borde, borderRadius: 6, padding: "6px 0", fontSize: "0.8rem", background: c.bg, color: c.fg,
                       textDecoration: ocupada && !pasado ? "line-through" : "none", cursor: pasado || !onClic ? "default" : "pointer", fontWeight: f === hoy ? 700 : 400 }}>
              {partes(f)[2]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ocupadas: [{ desde, hasta, estado? }]  (estado "Borrador" = reserva sin confirmar, se pinta en rojo claro con borde punteado)
 * seleccion: { desde, hasta } (opcional)    onSeleccion({ desde, hasta }) (opcional: si no se pasa, el calendario es solo de consulta)
 */
export default function CalendarioDisponibilidad({ ocupadas = [], seleccion, onSeleccion, cargando = false }) {
  const hoy = hoyIso();
  const [y0, m0] = partes(hoy);
  const [base, setBase] = useState({ anio: y0, mes: m0 - 1 });
  const [aviso, setAviso] = useState("");

  const confirmadas = useMemo(() => nochesDe(ocupadas.filter(r => r.estado !== "Borrador")), [ocupadas]);
  const tentativas = useMemo(() => nochesDe(ocupadas.filter(r => r.estado === "Borrador")), [ocupadas]);
  const bloqueadas = useMemo(() => new Set([...confirmadas]), [confirmadas]);   // los borradores no impiden elegir fechas

  const mover = (n) => setBase(b => { const f = new Date(b.anio, b.mes + n, 1); return { anio: f.getFullYear(), mes: f.getMonth() }; });
  const siguiente = new Date(base.anio, base.mes + 1, 1);
  const puedeRetroceder = base.anio > y0 || (base.anio === y0 && base.mes > m0 - 1);

  const clic = (f) => {
    setAviso("");
    const { desde, hasta } = seleccion || {};
    if (!desde || (desde && hasta)) {
      if (bloqueadas.has(f)) return setAviso("Esa noche ya está ocupada: elegí otra fecha de llegada.");
      return onSeleccion({ desde: f, hasta: "" });
    }
    if (f <= desde) {
      if (bloqueadas.has(f)) return setAviso("Esa noche ya está ocupada: elegí otra fecha de llegada.");
      return onSeleccion({ desde: f, hasta: "" });
    }
    // La estadía cubre las noches [desde, f): ninguna puede estar ocupada
    let d = desde;
    while (d < f) {
      if (bloqueadas.has(d)) {
        // El rango pisa noches ocupadas: si la fecha tocada está libre, se toma como nueva llegada
        if (!bloqueadas.has(f)) { setAviso("Ese rango incluye noches ocupadas: tomé esta fecha como nueva llegada. Ahora elegí la salida."); return onSeleccion({ desde: f, hasta: "" }); }
        return setAviso("Ese rango incluye noches ocupadas. Elegí otras fechas.");
      }
      d = sumarDias(d, 1);
    }
    onSeleccion({ desde, hasta: f });
  };

  const noches = nochesEntreFechas(seleccion?.desde, seleccion?.hasta);
  const boton = { border: "1px solid #BDBDBD", background: "transparent", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "inherit" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button type="button" style={{ ...boton, opacity: puedeRetroceder ? 1 : 0.4 }} disabled={!puedeRetroceder} onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{cargando ? "" : ocupadas.length ? `${ocupadas.length} estadía${ocupadas.length === 1 ? "" : "s"} próxima${ocupadas.length === 1 ? "" : "s"}` : "Sin estadías cargadas: todas las fechas están libres"}</span>
        <button type="button" style={boton} onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Mes anio={base.anio} mes={base.mes} ocupadas={confirmadas} tentativas={tentativas} seleccion={seleccion} hoy={hoy} onClic={onSeleccion ? clic : null} />
        <Mes anio={siguiente.getFullYear()} mes={siguiente.getMonth()} ocupadas={confirmadas} tentativas={tentativas} seleccion={seleccion} hoy={hoy} onClic={onSeleccion ? clic : null} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.75rem", marginTop: 10 }}>
        {[["libre", "Libre"], ["ocupada", "Ocupado"], ...(tentativas.size ? [["tentativa", "Sin confirmar"]] : []), ...(onSeleccion ? [["elegida", "Tu selección"]] : [])].map(([k, t]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORES[k].bg, border: COLORES[k].borde }} /> {t}
          </span>
        ))}
        <span style={{ opacity: 0.65 }}>El día de salida puede ser la llegada de otra estadía.</span>
      </div>

      {aviso && <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "8px 0 0" }}>{aviso}</p>}
      {onSeleccion && seleccion?.desde && (
        <p style={{ fontSize: "0.85rem", margin: "8px 0 0" }}>
          {seleccion.hasta
            ? <>Del <strong>{fmt(seleccion.desde)}</strong> al <strong>{fmt(seleccion.hasta)}</strong> · <strong>{noches} noche{noches === 1 ? "" : "s"}</strong> · <button type="button" onClick={() => { setAviso(""); onSeleccion({ desde: "", hasta: "" }); }} style={{ ...boton, padding: "1px 8px", fontSize: "0.75rem" }}>Borrar</button></>
            : <>Llegada: <strong>{fmt(seleccion.desde)}</strong>. Ahora elegí el día de salida. <button type="button" onClick={() => { setAviso(""); onSeleccion({ desde: "", hasta: "" }); }} style={{ ...boton, padding: "1px 8px", fontSize: "0.75rem" }}>Borrar</button></>}
        </p>
      )}
    </div>
  );
}
