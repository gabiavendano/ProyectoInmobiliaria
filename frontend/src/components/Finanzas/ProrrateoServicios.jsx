import { useState, useEffect, useMemo } from "react";
import { getPropiedades, getContratos, getCargos, crearCargosLote, anularCargo, subirDocPropiedad } from "../../services/api";
import { fmtMonto, mesActual, nombreMes } from "../../utils/finanzas";
import { esContenedor } from "../../utils/propiedad";
import jsPDF from "jspdf";

const msgError = (e) => e?.response?.data?.error || e?.message || "Error inesperado";
const unidadPorDefecto = (tipo) => (tipo.includes("Expensas") ? "Total" : /Agua|Gas|Cloacas/.test(tipo) ? "m3" : "KWh");
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** El sistema guarda los comprobantes como PDF: una foto o imagen se convierte a PDF antes de subirla. */
const imagenAPdf = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const maxW = 190, maxH = 277;
      const k = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * k, h = img.height * k;
      const fmt = /png/i.test(file.type) ? "PNG" : "JPEG";
      doc.addImage(img, fmt, (210 - w) / 2, 10, w, h);
      const blob = doc.output("blob");
      resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".pdf", { type: "application/pdf" }));
    } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
  img.src = url;
});
const esAlquilerVigente = (c) => c.tipoContrato === "Locacion" && c.estadoContrato === "Vigente" && !(c.tempCheckIn || c.tempCheckOut);

/**
 * Carga de servicios y prorrateo (tal como estaba planteado), ahora guardando:
 *  - Propiedad única: lista de servicios del inquilino.
 *  - Complejo: factura general repartida por consumo (o cuota fija en expensas) entre las unidades alquiladas.
 * Los cargos quedan pendientes y se suman solos al próximo cobro del inquilino (pestaña Cobranza).
 */
export default function ProrrateoServicios() {
  const [propiedades, setPropiedades] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const [idSel, setIdSel] = useState("");
  const [periodo, setPeriodo] = useState(mesActual());
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [archivos, setArchivos] = useState([]);

  // Propiedad única
  const [lista1, setLista1] = useState([]);
  const [nuevo, setNuevo] = useState({ tipo: "Luz", monto: "", medida: "", unidadMedida: "KWh" });

  // Complejo
  const [factura, setFactura] = useState({ tipo: "Luz (EPEC)", monto: "", consumoTotal: "", unidadMedida: "KWh" });
  const [entradas, setEntradas] = useState({});          // idPropiedad -> consumo (o cuota en expensas)
  const [gastos, setGastos] = useState([]);              // gastos ya añadidos a la liquidación

  useEffect(() => {
    let vivo = true;
    Promise.all([getPropiedades(), getContratos(), getCargos("Pendiente")])
      .then(([p, c, g]) => { if (vivo) { setPropiedades(p.data); setContratos(c.data.filter(esAlquilerVigente)); setPendientes(g.data); } })
      .catch((e) => { if (vivo) setAviso("No se pudieron cargar los datos: " + msgError(e)); });
    return () => { vivo = false; };
  }, [recarga]);

  const inquilinoDe = (idProp) => contratos.find((c) => c.propiedad?.idPropiedad === idProp)?.compradorInquilino?.nombreCompleto || null;

  // Opciones: complejos con unidades + propiedades sueltas con alquiler vigente
  const opciones = useMemo(() => {
    const complejos = propiedades.filter(esContenedor).map((p) => ({ p, unidades: propiedades.filter((u) => u.idComplejo === p.idPropiedad).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "es", { numeric: true })) }));
    const sueltas = propiedades.filter((p) => !esContenedor(p) && !p.idComplejo && contratos.some((c) => c.propiedad?.idPropiedad === p.idPropiedad)).map((p) => ({ p, unidades: [p] }));
    return [...complejos, ...sueltas];
  }, [propiedades, contratos]);

  const sel = opciones.find((o) => String(o.p.idPropiedad) === String(idSel)) || null;
  const esComplejo = sel && esContenedor(sel.p);
  const esExpensas = factura.tipo === "Expensas";

  const cambiarSeleccion = (v) => { setIdSel(v); setLista1([]); setGastos([]); setEntradas({}); setArchivos([]); setAviso(""); };

  // ── Propiedad única ──
  const cambiarTipo1 = (tipo) => setNuevo({ ...nuevo, tipo, unidadMedida: unidadPorDefecto(tipo) });
  const agregar1 = () => {
    if (!(Number(nuevo.monto) > 0)) { setAviso("Ingresá un monto mayor a cero."); return; }
    setLista1([...lista1, nuevo]); setNuevo({ tipo: "Luz", monto: "", medida: "", unidadMedida: "KWh" }); setAviso("");
  };

  // ── Complejo: cuota de cada unidad (derivada, no se guarda) ──
  const precioUnidad = Number(factura.monto) > 0 && Number(factura.consumoTotal) > 0 ? Number(factura.monto) / Number(factura.consumoTotal) : 0;
  const cuotaDe = (u) => {
    if (!inquilinoDe(u.idPropiedad)) return 0;
    if (esExpensas) return r2(entradas[u.idPropiedad] ?? factura.monto);
    return r2((Number(entradas[u.idPropiedad]) || 0) * precioUnidad);
  };
  const consumoAsignado = sel && !esExpensas ? sel.unidades.reduce((t, u) => t + (Number(entradas[u.idPropiedad]) || 0), 0) : 0;

  const cambiarTipoComplejo = (tipo) => { setFactura({ tipo, monto: "", consumoTotal: tipo === "Expensas" ? "" : factura.consumoTotal, unidadMedida: unidadPorDefecto(tipo) }); setEntradas({}); };

  const agregarGasto = () => {
    if (!(Number(factura.monto) > 0) || (!esExpensas && !(Number(factura.consumoTotal) > 0))) { setAviso("Faltan datos: completá el monto y el consumo total."); return; }
    const cuotas = sel.unidades.map((u) => ({ idPropiedad: u.idPropiedad, consumo: esExpensas ? null : Number(entradas[u.idPropiedad]) || 0, cuota: cuotaDe(u) })).filter((c) => c.cuota > 0);
    if (cuotas.length === 0) { setAviso("Ninguna unidad tiene importe a cobrar: cargá los medidores."); return; }
    setGastos([...gastos, { tipo: factura.tipo, monto: Number(factura.monto), unidadMedida: factura.unidadMedida, esExpensas, cuotas }]);
    setFactura({ tipo: factura.tipo, monto: "", consumoTotal: "", unidadMedida: factura.unidadMedida });
    setEntradas({}); setAviso("");
  };

  const totalesUnidad = sel ? sel.unidades.map((u) => ({ u, total: r2(gastos.reduce((t, g) => t + (g.cuotas.find((c) => c.idPropiedad === u.idPropiedad)?.cuota || 0), 0)) })) : [];

  // ── Guardar ──
  const subirComprobantes = async (idProp, descripcion) => {
    let ok = 0; const fallos = [];
    for (const f of archivos) {
      try { const pdf = f.type.startsWith("image/") ? await imagenAPdf(f) : f; await subirDocPropiedad(idProp, pdf, "Recibo", descripcion); ok++; } catch (e) { fallos.push(`${f.name}: ${msgError(e)}`); }
    }
    return { ok, fallos };
  };

  const confirmar = async (items, descripcion, idPropAdjuntos) => {
    if (guardando) return;
    setGuardando(true);
    try {
      await crearCargosLote({ periodoMesAnio: periodo, items });
      let extra = "";
      if (archivos.length) {
        const r = await subirComprobantes(idPropAdjuntos, descripcion);
        extra = ` Comprobantes guardados: ${r.ok}${r.fallos.length ? `. No se pudieron guardar: ${r.fallos.join("; ")}` : ""}.`;
      }
      setAviso(`Servicios cargados: ${items.length} cargo(s) quedaron pendientes y se suman al próximo cobro de cada inquilino.${extra}`);
      setLista1([]); setGastos([]); setEntradas({}); setArchivos([]); setRecarga((x) => x + 1);
    } catch (e) { setAviso("No se pudo guardar: " + msgError(e)); }
    finally { setGuardando(false); }
  };

  const confirmar1 = () => {
    if (lista1.length === 0) { setAviso("Debe añadir un servicio."); return; }
    confirmar(lista1.map((s) => ({ idPropiedad: sel.p.idPropiedad, concepto: s.tipo, monto: Number(s.monto), medicion: s.medida || null, unidadMedida: s.medida ? s.unidadMedida : null })),
      `Servicios ${periodo}`, sel.p.idPropiedad);
  };

  const confirmarComplejo = () => {
    if (gastos.length === 0) { setAviso("Debe añadir servicios a la lista."); return; }
    const items = gastos.flatMap((g) => g.cuotas.map((c) => ({ idPropiedad: c.idPropiedad, concepto: g.tipo, monto: c.cuota, medicion: c.consumo, unidadMedida: g.esExpensas ? null : g.unidadMedida })));
    confirmar(items, `Facturas del complejo ${periodo}`, sel.p.idPropiedad);
  };

  const anular = async (g) => {
    if (!window.confirm(`¿Anular el cargo ${g.concepto} de ${g.propiedad?.titulo}?`)) return;
    try { await anularCargo(g.idCargo); setRecarga((x) => x + 1); } catch (e) { setAviso(msgError(e)); }
  };

  const adjuntos = (
    <div style={{ marginTop: 15 }}>
      <label style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}><i className="fa-solid fa-paperclip" style={{ color: "var(--color-rojo)" }}></i> Adjuntar comprobantes (PDF o imagen, hasta 15 MB cada uno)</label>
      <input type="file" multiple accept="application/pdf,image/jpeg,image/png" className="btn btn-outline" style={{ width: "100%", backgroundColor: "white" }} onChange={(e) => setArchivos([...e.target.files])} />
      {archivos.length > 0 && <small>{archivos.length} archivo(s) se guardarán en los documentos de {sel?.p.titulo}.</small>}
    </div>
  );

  const th = { padding: 8, textAlign: "left" };
  return (
    <div>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}><label>Seleccione Propiedad / Complejo</label>
          <select value={idSel} onChange={(e) => cambiarSeleccion(e.target.value)}>
            <option value="">Seleccione...</option>
            {opciones.map((o) => <option key={o.p.idPropiedad} value={o.p.idPropiedad}>{o.p.titulo} ({esContenedor(o.p) ? o.unidades.length : 1} uni.)</option>)}
          </select></div>
        <div className="form-group"><label>Período de los servicios</label><input type="month" value={periodo} onChange={(e) => e.target.value && setPeriodo(e.target.value)} /></div>
      </div>
      {opciones.length === 0 && <p style={{ color: "#777" }}>No hay propiedades con alquiler anual vigente para cargarles servicios.</p>}
      {aviso && <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", padding: "10px 14px", borderRadius: 8, margin: "10px 0" }}>{aviso}</div>}

      {sel && (
        <div className="animation-fade-in" style={{ backgroundColor: "#E3F2FD", padding: 25, borderRadius: 8, border: "1px solid #90CAF9", marginTop: 15 }}>
          {!esComplejo && (
            <>
              <p style={{ marginTop: 0 }}>Inquilino: <strong>{inquilinoDe(sel.p.idPropiedad)}</strong></p>
              <div className="form-row" style={{ alignItems: "flex-end", backgroundColor: "white", padding: 15, borderRadius: 8, border: "1px solid #ccc" }}>
                <div className="form-group"><label>Tipo de Servicio</label>
                  <select value={nuevo.tipo} onChange={(e) => cambiarTipo1(e.target.value)}><option>Luz</option><option>Agua</option><option>Gas</option><option>Cloacas</option><option>Expensas</option></select></div>
                <div className="form-group"><label>Monto ($)</label><input type="number" min="0" placeholder="Ej: 15000" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })} /></div>
                <div className="form-group"><label>Medición ({nuevo.unidadMedida})</label><input type="number" min="0" placeholder="Ej: 1400" value={nuevo.medida} onChange={(e) => setNuevo({ ...nuevo, medida: e.target.value })} /></div>
                <div className="form-group"><button className="btn btn-negro" onClick={agregar1} disabled={!nuevo.monto}><i className="fa-solid fa-plus"></i> Añadir</button></div>
              </div>
              {lista1.length > 0 && (
                <div className="animation-fade-in" style={{ marginTop: 20, backgroundColor: "white", borderRadius: 8, border: "1px solid #ccc", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f1f1f1" }}><tr><th style={th}>Servicio</th><th style={th}>Monto</th><th style={{ ...th, textAlign: "center" }}>Acción</th></tr></thead>
                    <tbody>
                      {lista1.map((s, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={th}>{s.tipo} {s.medida ? `(${s.medida} ${s.unidadMedida})` : ""}</td>
                          <td style={{ ...th, fontWeight: "bold" }}>{fmtMonto(s.monto)}</td>
                          <td style={{ ...th, textAlign: "center" }}><button onClick={() => setLista1(lista1.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#D32F2F", cursor: "pointer" }}><i className="fa-solid fa-trash"></i></button></td>
                        </tr>
                      ))}
                      <tr><td style={{ ...th, fontWeight: "bold" }}>Total a cobrar</td><td style={{ ...th, fontWeight: "bold" }}>{fmtMonto(lista1.reduce((t, s) => t + Number(s.monto), 0))}</td><td></td></tr>
                    </tbody>
                  </table>
                  <div style={{ padding: 20, borderTop: "1px dashed #ccc", backgroundColor: "#F8FAFC" }}>
                    {adjuntos}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                      <button className="btn btn-rojo" style={{ padding: "12px 25px" }} onClick={confirmar1} disabled={guardando}>{guardando ? "Guardando..." : "Confirmar y Guardar Servicios"}</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {esComplejo && (
            <>
              <div style={{ backgroundColor: "white", padding: 20, borderRadius: 8, border: "1px solid #ccc" }}>
                <h5 style={{ margin: "0 0 15px 0", color: "#1565C0" }}>1. Cargar Factura General de Complejo</h5>
                <div className="form-row" style={{ alignItems: "flex-end", marginBottom: 15 }}>
                  <div className="form-group"><label>Servicio / Gasto</label>
                    <select value={factura.tipo} onChange={(e) => cambiarTipoComplejo(e.target.value)}><option>Luz (EPEC)</option><option>Agua</option><option>Gas</option><option>Cloacas</option><option>Expensas</option></select></div>
                  <div className="form-group"><label>{esExpensas ? "Monto a cobrar por Unidad ($)" : "Monto Total de Factura ($)"}</label>
                    <input type="number" min="0" placeholder="Ej: 15000" value={factura.monto} onChange={(e) => setFactura({ ...factura, monto: e.target.value })} /></div>
                  {!esExpensas && <div className="form-group"><label>Consumo Total ({factura.unidadMedida})</label>
                    <input type="number" min="0" placeholder="Ej: 1200" value={factura.consumoTotal} onChange={(e) => setFactura({ ...factura, consumoTotal: e.target.value })} /></div>}
                </div>

                {precioUnidad > 0 && !esExpensas && (
                  <div style={{ backgroundColor: "#FFF3E0", padding: 10, borderRadius: 6, textAlign: "center", marginBottom: 15 }}>
                    <span style={{ color: "#E65100", fontWeight: "bold" }}>Precio x 1 {factura.unidadMedida}: {fmtMonto(precioUnidad)}</span>
                  </div>
                )}

                <div style={{ width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", backgroundColor: "#F8FAFC", borderRadius: 6, borderCollapse: "collapse", minWidth: 400 }}>
                    <thead style={{ backgroundColor: "#E0E4E8" }}>
                      <tr><th style={th}>Unidad / Locatario</th><th style={th}>{esExpensas ? "Cuota Individual ($)" : `Medidor (${factura.unidadMedida})`}</th><th style={{ ...th, textAlign: "right" }}>A Cobrar</th></tr>
                    </thead>
                    <tbody>
                      {sel.unidades.map((u, i) => {
                        const inq = inquilinoDe(u.idPropiedad);
                        return (
                          <tr key={u.idPropiedad} style={{ borderBottom: "1px solid #EEE", opacity: inq ? 1 : 0.5 }}>
                            <td style={th}><strong>Unidad {i + 1}</strong> - {u.titulo} {inq ? `(${inq})` : "(sin inquilino)"}</td>
                            <td style={th}><input type="number" min="0" disabled={!inq} style={{ width: "100%", maxWidth: 100, padding: 6, boxSizing: "border-box" }}
                              value={esExpensas ? (entradas[u.idPropiedad] ?? factura.monto) : (entradas[u.idPropiedad] ?? "")}
                              onChange={(e) => setEntradas({ ...entradas, [u.idPropiedad]: e.target.value })} /></td>
                            <td style={{ ...th, color: "var(--color-rojo)", fontWeight: "bold", textAlign: "right" }}>{fmtMonto(cuotaDe(u))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!esExpensas && Number(factura.consumoTotal) > 0 && (
                  <p style={{ fontSize: "0.85rem", margin: "10px 0 0", color: consumoAsignado > Number(factura.consumoTotal) ? "#C62828" : "#555" }}>
                    Consumo asignado a unidades: <strong>{consumoAsignado} {factura.unidadMedida}</strong> de {factura.consumoTotal}
                    {consumoAsignado > Number(factura.consumoTotal) ? " — ¡supera el consumo total de la factura!" : ` — diferencia ${r2(Number(factura.consumoTotal) - consumoAsignado)} ${factura.unidadMedida} (áreas comunes / unidades vacías, a cargo del propietario)`}
                  </p>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 15 }}>
                  <button className="btn btn-negro" onClick={agregarGasto} disabled={!factura.monto || (!esExpensas && consumoAsignado > Number(factura.consumoTotal))}><i className="fa-solid fa-plus"></i> Añadir Gasto a la Liquidación</button>
                </div>
              </div>

              {gastos.length > 0 && (
                <div className="animation-fade-in" style={{ marginTop: 25, display: "flex", flexWrap: "wrap", gap: 20 }}>
                  <div style={{ flex: 1, minWidth: 280, backgroundColor: "white", padding: 15, borderRadius: 8, border: "1px solid #ccc" }}>
                    <h5 style={{ margin: "0 0 10px 0" }}>Gastos Añadidos</h5>
                    <table style={{ width: "100%", fontSize: "0.85rem" }}>
                      <tbody>
                        {gastos.map((g, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "5px 0" }}>{g.tipo}</td>
                            <td style={{ textAlign: "right", fontWeight: "bold" }}>{g.esExpensas ? "(Fijo Unid.)" : fmtMonto(g.monto)} <button onClick={() => setGastos(gastos.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#D32F2F", cursor: "pointer" }}><i className="fa-solid fa-xmark"></i></button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ flex: 1.5, minWidth: 280, backgroundColor: "white", padding: 15, borderRadius: 8, border: "1px solid #ccc" }}>
                    <h5 style={{ margin: "0 0 10px 0", color: "#2E7D32" }}>Total Acumulado a Cobrar por Unidad</h5>
                    <table style={{ width: "100%", fontSize: "0.85rem" }}>
                      <tbody>
                        {totalesUnidad.map(({ u, total }, i) => (
                          <tr key={u.idPropiedad} style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "5px 0" }}>Unidad {i + 1} ({inquilinoDe(u.idPropiedad) || "sin inquilino"})</td>
                            <td style={{ textAlign: "right", fontWeight: "bold", color: "#1B5E20" }}>{fmtMonto(total)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 20, paddingTop: 15, borderTop: "1px dashed #ccc" }}>
                      {adjuntos}
                      <div style={{ marginTop: 15, textAlign: "right" }}>
                        <button className="btn btn-rojo" onClick={confirmarComplejo} disabled={guardando}>{guardando ? "Guardando..." : "Confirmar y Distribuir Totales"}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <h5 style={{ marginTop: 30 }}>Cargos pendientes de cobrar <small style={{ fontWeight: "normal" }}>(se suman solos al próximo cobro de cada inquilino)</small></h5>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead style={{ backgroundColor: "#f1f1f1" }}><tr><th style={th}>Unidad</th><th style={th}>Inquilino</th><th style={th}>Concepto</th><th style={th}>Período</th><th style={th}>Monto</th><th style={th}></th></tr></thead>
          <tbody>
            {pendientes.length === 0 && <tr><td colSpan="6" style={{ ...th, textAlign: "center" }}>No hay cargos pendientes.</td></tr>}
            {pendientes.map((g) => (
              <tr key={g.idCargo} style={{ borderBottom: "1px solid #eee" }}>
                <td style={th}>{g.propiedad?.titulo}</td><td style={th}>{inquilinoDe(g.propiedad?.idPropiedad) || "—"}</td>
                <td style={th}>{g.concepto}{g.medicion != null ? ` (${g.medicion} ${g.unidadMedida || ""})` : ""}</td><td style={th}>{nombreMes(g.periodoMesAnio)}</td>
                <td style={{ ...th, fontWeight: "bold" }}>{fmtMonto(g.monto)}</td>
                <td style={th}><button className="btn btn-outline" style={{ padding: "3px 8px", color: "#C62828" }} onClick={() => anular(g)} title="Anular cargo"><i className="fa-solid fa-ban"></i></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
