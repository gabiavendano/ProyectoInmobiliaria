import { useState, useEffect, useMemo } from "react";
import { getContratos, getRendiciones, previewRendicion, generarRendicion, marcarRendicionTransferida, anularRendicion } from "../../services/api";
import { fmtMonto, mesActual, nombreMes, hoyIso } from "../../utils/finanzas";
import { fmtFecha } from "../../utils/personas";
import { pdfRendicion } from "../../utils/pdfFinanzas";
import PdfModal from "./PdfModal";
import OpcionesMoneda from "../common/OpcionesMoneda";
import { monedaDeContrato } from "../../utils/monedas";

const msgError = (e) => e?.response?.data?.error || e?.message || "Error inesperado";
const ESTADO = {
  Transferida: { fondo: "#E8F5E9", color: "#2E7D32", icono: "fa-check", texto: "Transferida" },
  Pendiente: { fondo: "#FFF3E0", color: "#E65100", icono: "fa-clock", texto: "Pendiente de transferir" },
  Anulada: { fondo: "#EEEEEE", color: "#757575", icono: "fa-ban", texto: "Anulada" },
};

/** Propietarios y Rendiciones: estado de cuenta por propietario, historial por propiedad y generación de la rendición mensual. */
export default function RendicionesTab({ onCambio }) {
  const [contratos, setContratos] = useState([]);
  const [rendiciones, setRendiciones] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const [idProp, setIdProp] = useState("");
  const [propiedadSel, setPropiedadSel] = useState("");
  const [mes, setMes] = useState(mesActual());
  const [monedaSel, setMonedaSel] = useState(null);
  const [prev, setPrev] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [adelantos, setAdelantos] = useState([]);
  const [nuevo, setNuevo] = useState({ gasto: { descripcion: "", monto: "" }, adelanto: { descripcion: "", monto: "", fecha: hoyIso() } });
  const [incluirServicios, setIncluirServicios] = useState(true);
  const [crearTransf, setCrearTransf] = useState(true);
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [pdf, setPdf] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([getContratos(), getRendiciones()])
      .then(([c, r]) => { if (vivo) { setContratos(c.data.filter((x) => x.tipoContrato === "Locacion")); setRendiciones(r.data); } })
      .catch((e) => { if (vivo) setAviso("No se pudieron cargar los datos: " + msgError(e)); });
    return () => { vivo = false; };
  }, [recarga]);

  const propietarios = useMemo(() => {
    const m = new Map();
    contratos.forEach((c) => { const p = c.vendedorPropietario; if (p) m.set(p.idPersona, p.nombreCompleto); });
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [contratos]);

  // Selección derivada: si no se eligió nada, se usa el primero
  const propietario = propietarios.find((p) => String(p.id) === String(idProp)) || propietarios[0] || null;
  const susPropiedades = useMemo(() => {
    if (!propietario) return [];
    const m = new Map();
    contratos.filter((c) => c.vendedorPropietario?.idPersona === propietario.id && c.propiedad)
      .forEach((c) => m.set(c.propiedad.idPropiedad, { id: c.propiedad.idPropiedad, titulo: c.propiedad.titulo, locatario: c.compradorInquilino?.nombreCompleto }));
    return [...m.values()];
  }, [contratos, propietario]);
  const propiedad = susPropiedades.find((p) => String(p.id) === String(propiedadSel)) || susPropiedades[0] || null;

  // Moneda por defecto: la de los alquileres del propietario (si todos están en una misma moneda, esa; si no, pesos)
  const monedasProp = new Set(contratos.filter((c) => c.vendedorPropietario?.idPersona === propietario?.id).map(monedaDeContrato));
  const moneda = monedaSel || (monedasProp.size === 1 ? [...monedasProp][0] : "ARS");

  const cambiarPropietario = (v) => { setIdProp(v); setMonedaSel(null); setPropiedadSel(""); setPrev(null); setAviso(""); };

  const rendDelPropietario = rendiciones.filter((r) => r.propietario?.idPersona === propietario?.id);
  // Historial de la propiedad: las rendiciones que la incluyen, con el total de ESA propiedad
  const historial = useMemo(() => {
    if (!propiedad) return [];
    return rendDelPropietario
      .filter((r) => (r.propiedadesNombres || []).includes(propiedad.titulo))
      .map((r) => ({ r, total: (r.lineas || []).filter((l) => String(l.descripcion).startsWith(propiedad.titulo)).reduce((t, l) => t + Number(l.monto), 0) }))
      .sort((a, b) => b.r.idRendicion - a.r.idRendicion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendiciones, propiedad, propietario]);

  const suma = (a) => a.reduce((t, x) => t + x.monto, 0);
  const total = prev ? Number(prev.subtotal) - suma(gastos) - suma(adelantos) : 0;

  // Rendición "en borrador" con la forma de una guardada, para ver el PDF antes de confirmar
  const borrador = () => ({
    propietario: { nombreCompleto: propietario?.nombre }, mesAno: mes, moneda, comprobante: "VISTA PREVIA (sin guardar)",
    fechaRender: new Date().toISOString().slice(0, 10), estado: "Pendiente", totalNeto: total,
    lineas: [], gastosGenerales: [], transferenciasParciales: [],
  });

  const calcular = async () => {
    setAviso(""); setPrev(null);
    if (!propietario) { setAviso("No hay propietarios con alquileres cargados."); return null; }
    try {
      const r = await previewRendicion({ idPropietario: propietario.id, mesAno: mes, moneda, incluirServicios });
      setPrev(r.data); setGastos([]); setAdelantos([]);
      if (r.data.cobros === 0) setAviso(`No hay cobros de ${nombreMes(mes)} (${moneda}) pendientes de rendir para ${propietario.nombre}. Primero registrá los cobros en Cobranza Inquilino (alquileres anuales) o en Cobranza Estadías (temporarios).`);
      return r.data;
    } catch (e) { setAviso(msgError(e)); return null; }
  };

  // Un solo clic: calcula (si hace falta) y abre la vista previa del PDF
  const verPreviewPdf = async () => {
    let datos = prev;
    if (!datos || datos.cobros === 0) { datos = await calcular(); if (!datos || datos.cobros === 0) return; }
    const g = datos === prev ? gastos : [], a = datos === prev ? adelantos : [];
    const tot = Number(datos.subtotal) - suma(g) - suma(a);
    setPdf({
      doc: await pdfRendicion({ ...borrador(), lineas: datos.lineas, gastosGenerales: g, transferenciasParciales: a, totalNeto: tot }),
      archivo: `Rendicion_${mes}_${String(propietario?.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`, titulo: "Vista Previa de la Rendición PDF", preview: true,
    });
  };

  const agregar = (tipo) => {
    const it = nuevo[tipo];
    if (!it.descripcion.trim() || !(Number(it.monto) > 0)) { setAviso("Completá descripción y un monto mayor a cero."); return; }
    const item = { descripcion: it.descripcion.trim() + (tipo === "adelanto" && it.fecha ? ` (${fmtFecha(it.fecha)})` : ""), monto: Number(it.monto) };
    if (tipo === "gasto") setGastos([...gastos, item]); else setAdelantos([...adelantos, item]);
    setNuevo({ ...nuevo, [tipo]: { ...it, descripcion: "", monto: "" } });
    setAviso("");
  };

  const confirmar = async () => {
    if (guardando || !prev || prev.cobros === 0) return;
    if (total < 0) { setAviso("El total a depositar es negativo: los gastos y adelantos superan lo cobrado."); return; }
    setGuardando(true);
    try {
      const r = await generarRendicion({ idPropietario: propietario.id, mesAno: mes, moneda, gastos, transferencias: adelantos, crearTransferencia: crearTransf, incluirServicios });
      setPrev(null); setGastos([]); setAdelantos([]); setRecarga((x) => x + 1); onCambio?.();
      setAviso(`Rendición ${r.data.comprobante} guardada y descargada.`);
      (await pdfRendicion(r.data)).save(`${r.data.comprobante}.pdf`);
      setPdf(null);
    } catch (e) {
      const m = "No se pudo generar la rendición: " + msgError(e);
      setAviso(m); setPdf((p) => (p ? { ...p, error: m } : p));
    }
    finally { setGuardando(false); }
  };

  const ver = async (r) => setPdf({ doc: await pdfRendicion(r), archivo: `${r.comprobante}.pdf`, titulo: `Rendición ${r.comprobante}` });

  const transferida = async (r) => {
    if (!window.confirm(`¿Confirmás que ya se transfirió ${fmtMonto(r.totalNeto, r.moneda)} a ${r.propietario?.nombreCompleto}?`)) return;
    try { await marcarRendicionTransferida(r.idRendicion); setRecarga((x) => x + 1); onCambio?.(); setAviso("Rendición marcada como transferida."); }
    catch (e) { setAviso(msgError(e)); }
  };

  const anular = async (r) => {
    const motivo = window.prompt(`Motivo de la anulación de ${r.comprobante} (los cobros volverán a quedar pendientes de rendir):`);
    if (!motivo || !motivo.trim()) return;
    try { await anularRendicion(r.idRendicion, motivo.trim()); setRecarga((x) => x + 1); onCambio?.(); setAviso("Rendición anulada."); }
    catch (e) { setAviso(msgError(e)); }
  };

  const itemForm = (tipo, titulo, lista, setLista) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <h6>{titulo}</h6>
      {lista.map((g, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee" }}>
          <span>{g.descripcion}</span><span>{fmtMonto(g.monto, moneda)} <button onClick={() => setLista(lista.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#C62828", cursor: "pointer" }}><i className="fa-solid fa-xmark"></i></button></span>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input type="text" placeholder={tipo === "adelanto" ? "Ej: Transferido" : "Descripción"} value={nuevo[tipo].descripcion} onChange={(e) => setNuevo({ ...nuevo, [tipo]: { ...nuevo[tipo], descripcion: e.target.value } })} style={{ flex: 2 }} />
        {tipo === "adelanto" && <input type="date" max={hoyIso()} value={nuevo.adelanto.fecha} onChange={(e) => setNuevo({ ...nuevo, adelanto: { ...nuevo.adelanto, fecha: e.target.value } })} style={{ flex: 1.2 }} title="Fecha de la transferencia" />}
        <input type="number" placeholder="Monto" min="0" value={nuevo[tipo].monto} onChange={(e) => setNuevo({ ...nuevo, [tipo]: { ...nuevo[tipo], monto: e.target.value } })} style={{ flex: 1 }} />
        <button className="btn btn-negro" onClick={() => agregar(tipo)}><i className="fa-solid fa-plus"></i></button>
      </div>
    </div>
  );

  const th = { padding: 10, textAlign: "left" };
  return (
    <div className="tab-content active">
      <div style={{ backgroundColor: "white", padding: 20, borderRadius: 8, border: "1px solid var(--color-gris-borde)", marginBottom: 25, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: 8, color: "#1565C0" }}><i className="fa-solid fa-user-tie"></i> Propietario</label>
          <select className="form-control" style={{ width: "100%", padding: 10 }} value={propietario?.id ?? ""} onChange={(e) => cambiarPropietario(e.target.value)}>
            {propietarios.length === 0 && <option value="">Sin propietarios con alquileres</option>}
            {propietarios.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div style={{ flex: 1.5, minWidth: 220 }}>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: 8, color: "#1565C0" }}><i className="fa-solid fa-building"></i> Ver Historial de la Propiedad</label>
          <select className="form-control" style={{ width: "100%", padding: 10 }} value={propiedad?.id ?? ""} onChange={(e) => setPropiedadSel(e.target.value)}>
            {susPropiedades.map((p) => <option key={p.id} value={p.id}>{p.titulo} (Locatario: {p.locatario})</option>)}
          </select>
        </div>
        <div style={{ minWidth: 150 }}>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: 8, color: "#1565C0" }}>Mes cobrado</label>
          <input type="month" value={mes} style={{ padding: 9 }} onChange={(e) => { e.target.value && setMes(e.target.value); setPrev(null); }} />
        </div>
        <div style={{ minWidth: 90 }}>
          <label style={{ fontWeight: "bold", display: "block", marginBottom: 8, color: "#1565C0" }}>Moneda</label>
          <select style={{ padding: 10 }} value={moneda} onChange={(e) => { setMonedaSel(e.target.value); setPrev(null); }}><OpcionesMoneda /></select>
        </div>
        <div style={{ marginTop: 25 }}>
          <button className="btn btn-rojo" style={{ padding: "12px 25px" }} onClick={verPreviewPdf}><i className="fa-solid fa-eye"></i> Ver Vista Previa de Rendición PDF</button>
        </div>
      </div>

      <div className="checkbox-group" style={{ margin: "-10px 0 20px" }}>
        <input type="checkbox" id="incServ" checked={incluirServicios} onChange={(e) => { setIncluirServicios(e.target.checked); setPrev(null); }} />
        <label htmlFor="incServ">Rendir al propietario los servicios y expensas cobrados a los inquilinos (sin honorarios). Destildar si la inmobiliaria paga esas facturas al consorcio o ente.</label>
      </div>

      {aviso && <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", padding: "10px 14px", borderRadius: 8, margin: "0 0 20px" }}>{aviso}</div>}

      {prev && prev.cobros > 0 && (
        <div className="card animation-fade-in" style={{ marginBottom: 25 }}>
          <div className="card-header"><span className="card-title"><i className="fa-solid fa-file-invoice-dollar"></i> Rendición de {nombreMes(mes)}: {prev.cobros} cobro(s) a rendir</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <tbody>
              {prev.lineas.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}><td style={th}>{l.descripcion}</td>
                  <td style={{ ...th, textAlign: "right", color: Number(l.monto) < 0 ? "#C62828" : undefined }}>{fmtMonto(l.monto, moneda)}</td></tr>
              ))}
              <tr><td style={{ ...th, fontWeight: "bold" }}>Subtotal cobros (neto de honorarios)</td><td style={{ ...th, textAlign: "right", fontWeight: "bold" }}>{fmtMonto(prev.subtotal, moneda)}</td></tr>
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginTop: 15 }}>
            {itemForm("gasto", "Gastos Comunes a Descontar (reparaciones, expensas, servicios pagados por la inmobiliaria)", gastos, setGastos)}
            {itemForm("adelanto", "Transferencias Entregadas (adelantos al propietario)", adelantos, setAdelantos)}
          </div>
          <div className="checkbox-group" style={{ margin: "15px 0" }}>
            <input type="checkbox" id="crearTransf" checked={crearTransf} onChange={(e) => setCrearTransf(e.target.checked)} />
            <label htmlFor="crearTransf">Programar la transferencia al propietario en Movimientos</label>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ margin: 0, color: total < 0 ? "#C62828" : "#1B5E20" }}>TOTAL A DEPOSITAR: {fmtMonto(total, moneda)}</h3>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-outline" onClick={verPreviewPdf}><i className="fa-solid fa-eye"></i> Ver vista previa PDF</button>
              <button className="btn btn-rojo" onClick={confirmar} disabled={guardando || total < 0}>{guardando ? "Guardando..." : "Confirmar y guardar rendición"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title"><i className="fa-solid fa-clock-rotate-left"></i> Facturación Histórica: {propiedad?.titulo || "—"}</span></div>
        <div className="table-responsive">
          <table>
            <thead><tr><th>Período</th><th>Fecha de Rendición</th><th>Estado</th><th>Total Liquidado</th><th>Comprobante</th><th>Generada por</th><th>Acción</th></tr></thead>
            <tbody>
              {historial.map(({ r, total: t }) => {
                const e = ESTADO[r.estado] || ESTADO.Pendiente;
                return (
                  <tr key={r.idRendicion} style={{ opacity: r.estado === "Anulada" ? 0.6 : 1 }}>
                    <td style={{ fontWeight: "bold" }}>{nombreMes(r.mesAno)}</td>
                    <td>{fmtFecha(r.fechaRender)}</td>
                    <td><span style={{ backgroundColor: e.fondo, color: e.color, padding: "4px 8px", borderRadius: 4, fontSize: "0.8rem", fontWeight: "bold" }}><i className={`fa-solid ${e.icono}`}></i> {e.texto}</span></td>
                    <td style={{ fontWeight: "bold" }}>{fmtMonto(t, r.moneda)}</td>
                    <td>{r.comprobante}</td>
                    <td title={r.estado === "Anulada" ? `Anulada por ${r.anuladaPor || "—"}` : r.transferidaPor ? `Transferida (marcada por ${r.transferidaPor})` : undefined}>{r.generadaPor || "—"}</td>
                    <td>
                      <button className="btn btn-outline" style={{ padding: "5px 10px", fontSize: "0.85rem" }} onClick={() => ver(r)}><i className="fa-solid fa-eye"></i> Ver PDF</button>{" "}
                      {r.estado === "Pendiente" && <>
                        <button className="btn btn-outline" style={{ padding: "5px 10px", fontSize: "0.85rem" }} onClick={() => transferida(r)}>Marcar transferida</button>{" "}
                        <button className="btn btn-outline" style={{ padding: "5px 10px", fontSize: "0.85rem", color: "#C62828" }} onClick={() => anular(r)} title="Anular"><i className="fa-solid fa-ban"></i></button>
                      </>}
                    </td>
                  </tr>
                );
              })}
              {historial.length === 0 && <tr><td colSpan="7" style={{ textAlign: "center", padding: 20 }}>No hay rendiciones previas para esta unidad.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {pdf && <PdfModal doc={pdf.doc} titulo={pdf.titulo} archivo={pdf.archivo} onCerrar={() => !guardando && setPdf(null)}
        confirmar={pdf.preview ? { texto: "Confirmar y guardar rendición", onClick: confirmar, ocupado: guardando, aviso: pdf.error || (total < 0 ? "El total es negativo: corregí los gastos/adelantos." : "Al confirmar se guarda la rendición, se marcan los cobros como rendidos y se descarga el PDF definitivo.") } : undefined} />}
    </div>
  );
}
