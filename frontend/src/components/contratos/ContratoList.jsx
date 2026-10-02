import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getContratos, rescindirContrato, cerrarVenta, cerrarPermuta, activarContrato, finalizarContrato, getPersonas, getPropiedades
} from "../../services/api";
import ContratoForm from "./ContratoForm";
import DocumentosContrato from "./DocumentosContrato";
import { simboloMoneda } from "../../utils/monedas";
import { avisar } from "../../utils/avisos";

const BADGE_TIPO   = { "Compraventa": "badge-green", "Permuta": "badge-warning", "Locacion": "badge-blue" };
const ETIQUETA_TIPO = { "Compraventa": "Venta", "Permuta": "Permuta", "Locacion": "Alquiler" };
const BADGE_ESTADO = { "Borrador": "badge-warning", "Vigente": "badge-green", "Finalizado": "badge-outline", "Rescindido": "badge-red" };
const ESTADOS = ["Todos", "Borrador", "Vigente", "Finalizado", "Rescindido"];
const TIPOS = [["Todos", "Todos los tipos"], ["Compraventa", "Venta"], ["Locacion", "Alquiler"], ["Permuta", "Permuta"]];

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtFecha = (f) => { if (!f) return "—"; const [a, m, d] = String(f).slice(0, 10).split("-"); return d && m && a ? `${d}/${m}/${a}` : f; };
const fmtMonto = (monto, moneda) => (monto === null || monto === undefined || monto === "") ? "—" : `${simboloMoneda(moneda)} ${Number(monto).toLocaleString("es-AR")}`;
const esTemporario = (c) => c.tipoContrato === "Locacion" && !!c.tempCheckIn;
const etiquetaTipo = (c) => esTemporario(c) ? "Alq. Temporario" : c.tipoContrato === "Locacion" ? "Alq. Anual" : (ETIQUETA_TIPO[c.tipoContrato] || c.tipoContrato);
const diasHasta = (f) => { if (!f) return null; const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((new Date(`${String(f).slice(0, 10)}T00:00:00`) - h) / 86400000); };

// Honorarios de una operación: total, cobrado y pendiente (las partes anuladas no cuentan)
const resumenHonorarios = (c) => {
  const partes = ["A", "B"].filter(l => c[`honParte${l}Estado`] !== "Anulado");
  const total = partes.reduce((t, l) => t + Number(c[`honParte${l}Monto`] || 0), 0);
  const cobrado = partes.reduce((t, l) => t + Number(c[`honParte${l}Cobrado`] || 0), 0);
  return { total, cobrado, pendiente: Math.max(total - cobrado, 0) };
};

function Dato({ etiqueta, valor }) {
  if (valor === null || valor === undefined || valor === "" || valor === "—") return null;
  return <div style={{ minWidth: 170, flex: "1 1 170px" }}><div style={{ fontSize: "0.75rem", color: "var(--color-gris-texto)" }}>{etiqueta}</div><div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{valor}</div></div>;
}
function Bloque({ titulo, children }) {
  const hijos = React.Children.toArray(children).filter(Boolean);
  return (
    <div style={{ marginBottom: 16 }}>
      <h6 style={{ color: "var(--color-rojo)", marginBottom: 8 }}>{titulo}</h6>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px" }}>{hijos}</div>
    </div>
  );
}

function DetalleContrato({ c, personas, propiedades }) {
  const nombre = (id) => { const p = personas.find(x => x.idPersona === id); return p ? `${p.nombreCompleto} (${p.dniCuit})` : `Persona #${id}`; };
  const nombrePropiedad = (id) => propiedades.find(x => x.idPropiedad === id)?.titulo;
  const m = c.monedaOperacion;
  return (
    <div>
      <Bloque titulo="Partes">
        <Dato etiqueta="Vendedor / Locador" valor={c.vendedorPropietario?.nombreCompleto} />
        <Dato etiqueta="Comprador / Locatario" valor={c.compradorInquilino?.nombreCompleto} />
        <Dato etiqueta="Garante/s" valor={(c.garantesAdicionales || []).length ? c.garantesAdicionales.map(nombre).join(", ") : null} />
        <Dato etiqueta="Responsable" valor={c.usuarioResponsable} />
      </Bloque>
      {c.tipoContrato === "Compraventa" && (
        <Bloque titulo="Venta">
          <Dato etiqueta="Precio" valor={fmtMonto(c.venPrecio, c.venMoneda)} />
          <Dato etiqueta="Forma de pago" valor={c.venFormaPago} />
          <Dato etiqueta="Anticipo" valor={c.venAnticipo != null ? fmtMonto(c.venAnticipo, c.venMoneda) : null} />
          <Dato etiqueta="Cuotas" valor={c.venCuotas ? `${c.venCuotas} de ${fmtMonto(c.venMontoCuota, c.venMoneda)}` : null} />
          <Dato etiqueta="Reserva / seña" valor={c.venMontoReserva != null ? fmtMonto(c.venMontoReserva, c.venMoneda) : null} />
          <Dato etiqueta="Posesión estimada" valor={c.venFechaPosesion ? fmtFecha(c.venFechaPosesion) : null} />
          <Dato etiqueta="Escribano" valor={c.venEscribano} />
        </Bloque>
      )}
      {c.tipoContrato === "Permuta" && (
        <Bloque titulo="Permuta">
          <Dato etiqueta="Entrega A" valor={c.perBienesA} />
          <Dato etiqueta="Entrega B" valor={c.perBienesB} />
          <Dato etiqueta="Propiedad de B en el sistema" valor={c.perPropiedadBId ? (nombrePropiedad(c.perPropiedadBId) || `Propiedad #${c.perPropiedadBId}`) : null} />
          <Dato etiqueta="Diferencia en efectivo" valor={Number(c.perDiferenciaMonto) > 0 ? fmtMonto(c.perDiferenciaMonto, c.perDiferenciaMoneda) : "Sin diferencia en efectivo"} />
          <Dato etiqueta="Quién abona" valor={Number(c.perDiferenciaMonto) > 0 ? c.perQuienPagaDiferencia : null} />
        </Bloque>
      )}
      {c.tipoContrato === "Locacion" && !esTemporario(c) && (
        <Bloque titulo="Alquiler anual">
          <Dato etiqueta="Vigencia" valor={`${fmtFecha(c.alqFechaInicio || c.fechaInicio)} al ${fmtFecha(c.alqFechaFin || c.fechaFin)}`} />
          <Dato etiqueta="Destino" valor={c.alqDestino} />
          <Dato etiqueta="Canon mensual" valor={fmtMonto(c.alqCanonMonto, c.alqCanonMoneda || m)} />
          <Dato etiqueta="Ajuste" valor={c.indiceAjuste && c.indiceAjuste !== "Ninguno" ? `${c.indiceAjuste} · ${c.frecuenciaAjusteMeses ? (c.frecuenciaAjusteMeses === 1 ? "cada mes" : `cada ${c.frecuenciaAjusteMeses} meses`) : (c.alqFrecuenciaAjuste || "")}` : "Sin ajuste (canon fijo)"} />
          <Dato etiqueta="Depósito" valor={c.alqMontoDeposito != null ? fmtMonto(c.alqMontoDeposito, c.alqCanonMoneda || m) : null} />
          <Dato etiqueta="Interés diario por mora" valor={c.interestMoraDiario != null ? `${(Number(c.interestMoraDiario) * 100).toLocaleString("es-AR", { maximumFractionDigits: 4 })} %` : null} />
        </Bloque>
      )}
      {esTemporario(c) && (
        <Bloque titulo="Alquiler temporario">
          <Dato etiqueta="Check-in" valor={fmtFecha(c.tempCheckIn)} />
          <Dato etiqueta="Check-out" valor={fmtFecha(c.tempCheckOut)} />
          <Dato etiqueta="Noches" valor={c.tempCheckIn && c.tempCheckOut ? Math.round((new Date(c.tempCheckOut) - new Date(c.tempCheckIn)) / 86400000) : null} />
          <Dato etiqueta="Huéspedes" valor={c.tempHuespedes} />
          <Dato etiqueta="Precio por noche" valor={c.tempPrecioNoche != null ? fmtMonto(c.tempPrecioNoche, c.tempMoneda) : null} />
          <Dato etiqueta="Precio total" valor={fmtMonto(c.tempPrecioTotal, c.tempMoneda)} />
          <Dato etiqueta={c.tempSeniaPorcentaje != null ? `Seña / reserva (${Number(c.tempSeniaPorcentaje)} %)` : "Seña / reserva"} valor={c.tempSenia != null ? fmtMonto(c.tempSenia, c.tempMoneda) : null} />
          <Dato etiqueta="Saldo a cobrar" valor={c.tempSenia != null && c.tempPrecioTotal != null ? fmtMonto(Math.max(Number(c.tempPrecioTotal) - Number(c.tempSenia), 0), c.tempMoneda) : null} />
          <Dato etiqueta="Seña cobrada el" valor={c.tempSeniaCobradaFecha ? fmtFecha(c.tempSeniaCobradaFecha) : (c.tempSenia > 0 ? "Sin registrar" : null)} />
          <Dato etiqueta="Saldo cobrado el" valor={c.tempSaldoCobradoFecha ? fmtFecha(c.tempSaldoCobradoFecha) : "Sin registrar"} />
          <Dato etiqueta="Depósito en garantía" valor={c.tempDeposito != null ? fmtMonto(c.tempDeposito, c.tempMoneda) : null} />
        </Bloque>
      )}
      <Bloque titulo="Honorarios profesionales">
        <Dato etiqueta="Total" valor={c.honMontoTotal != null ? fmtMonto(c.honMontoTotal, c.honMoneda) : null} />
        <Dato etiqueta="Base de cálculo" valor={c.honBaseCalculo != null ? fmtMonto(c.honBaseCalculo, c.honMoneda) : null} />
        <Dato etiqueta="Escala" valor={c.honEscala ? `${c.honEscala}${c.honEditadoManual ? " (modificada a mano)" : ""}` : (c.honEditadoManual ? "Modificada a mano" : null)} />
        <Dato etiqueta="Vendedor / Locador" valor={c.honParteAMonto != null ? `${c.honParteAPorcentaje != null ? `${c.honParteAPorcentaje} % · ` : ""}${fmtMonto(c.honParteAMonto, c.honMoneda)} · ${c.honParteAEstado} · ${c.honParteAFormaPago}` : null} />
        <Dato etiqueta="Cobrado (vendedor / locador)" valor={c.honParteACobrado ? `${fmtMonto(c.honParteACobrado, c.honMoneda)}${c.honParteAFechaCobro ? ` el ${fmtFecha(c.honParteAFechaCobro)}` : ""}` : null} />
        <Dato etiqueta="Comprobante (vendedor / locador)" valor={c.honParteAComprobante ? `${c.honParteAComprobante}${c.honParteAFechaEmision ? ` · ${fmtFecha(c.honParteAFechaEmision)}` : ""}` : null} />
        <Dato etiqueta="Comprador / Locatario" valor={c.honParteBMonto != null ? `${c.honParteBPorcentaje != null ? `${c.honParteBPorcentaje} % · ` : ""}${fmtMonto(c.honParteBMonto, c.honMoneda)} · ${c.honParteBEstado} · ${c.honParteBFormaPago}` : null} />
        <Dato etiqueta="Cobrado (comprador / locatario)" valor={c.honParteBCobrado ? `${fmtMonto(c.honParteBCobrado, c.honMoneda)}${c.honParteBFechaCobro ? ` el ${fmtFecha(c.honParteBFechaCobro)}` : ""}` : null} />
        <Dato etiqueta="Comprobante (comprador / locatario)" valor={c.honParteBComprobante ? `${c.honParteBComprobante}${c.honParteBFechaEmision ? ` · ${fmtFecha(c.honParteBFechaEmision)}` : ""}` : null} />
      </Bloque>
      {c.esCoCorretaje && (
        <Bloque titulo="Co-corretaje">
          <Dato etiqueta="Inmobiliaria / agente" valor={c.coNombre} />
          <Dato etiqueta="Matrícula" valor={c.coMatricula} />
          <Dato etiqueta="Intervención" valor={c.coIntervencion} />
          <Dato etiqueta="Reparto de honorarios" valor={c.honColegaPorcentaje != null && c.honMontoTotal != null ? `Colega ${c.honColegaPorcentaje} % (${fmtMonto(Math.round(Number(c.honMontoTotal) * Number(c.honColegaPorcentaje)) / 100, c.honMoneda)}) · Inmobiliaria ${fmtMonto(Math.round(Number(c.honMontoTotal) * (100 - Number(c.honColegaPorcentaje))) / 100, c.honMoneda)}` : null} />
        </Bloque>
      )}
      <Bloque titulo="Datos legales">
        <Dato etiqueta="Matrícula del corredor" valor={c.matriculaCorredor} />
        <Dato etiqueta="Profesión" valor={c.profesionCorredor} />
        <Dato etiqueta="N° de matriz" valor={c.numeroMatriz} />
        <Dato etiqueta="Domicilio del corredor" valor={c.domicilioCorredor} />
        <Dato etiqueta="Fecha de firma" valor={c.fechaFirma ? fmtFecha(c.fechaFirma) : null} />
        <Dato etiqueta="Certificado de dominio" valor={c.certDominioInmueble} />
        <Dato etiqueta="Certificado de garantías" valor={c.certGarantias} />
        <Dato etiqueta="Condiciones del negocio" valor={c.condicionesNegocio} />
        <Dato etiqueta="Minuta" valor={c.minutaOperacion} />
      </Bloque>
      <h6 style={{ color: "var(--color-rojo)", marginBottom: 8 }}>Documentos</h6>
      <DocumentosContrato idOperacion={c.idOperacion} />
      {c.tipoContrato === "Locacion" && (
        <p style={{ marginTop: 14, fontSize: "0.85rem", color: "var(--color-gris-texto)" }}>
          <i className="fa-solid fa-coins"></i> Los cobros mensuales, la mora y las rendiciones de este alquiler se gestionan en <strong>Finanzas y Cobros</strong>.
        </p>
      )}
    </div>
  );
}

function ContratoList() {
  const [contratos, setContratos] = useState([]);
  const [personas, setPersonas]   = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [editando, setEditando]   = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState("");
  const [busqueda, setBusqueda]   = useState("");
  const [estado, setEstado]       = useState("Todos");
  const [tipo, setTipo]           = useState("Todos");
  const formRef = useRef(null);

  const cargar = () => {
    return getContratos()
      .then(r => { setContratos(r.data); setError(""); })
      .catch(err => setError(`No se pudieron cargar las operaciones: ${err.response?.data?.error || err.message}. Revisá que el servidor esté encendido.`))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { getPersonas().then(r => setPersonas(r.data)).catch(() => {}); }, []);
  useEffect(() => { getPropiedades().then(r => setPropiedades(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (editando && formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editando]);

  const accion = (promesa, fallo) => promesa.then(cargar).catch(e => avisar(e.response?.data?.error || fallo, "error"));

  const handleRescindir = (c) => {
    const esBorrador = c.estadoContrato === "Borrador";
    if (!window.confirm(esBorrador ? "¿Anular este borrador? No se toca la propiedad." : "¿Rescindir este contrato? La propiedad vuelve a estar Disponible. El histórico y la documentación se conservan.")) return;
    accion(rescindirContrato(c.idOperacion), "No se pudo rescindir el contrato.");
  };
  const handleCerrarVenta = (c) => {
    if (!window.confirm("¿Cerrar venta y transferir la propiedad al comprador?")) return;
    accion(cerrarVenta(c.idOperacion), "No se pudo cerrar la venta.");
  };
  const handleCerrarPermuta = (c) => {
    if (!window.confirm("¿Cerrar la permuta? Cada propiedad pasa a nombre de la otra parte y la operación queda finalizada.")) return;
    accion(cerrarPermuta(c.idOperacion), "No se pudo cerrar la permuta.");
  };
  const handleActivar = (c) => {
    if (!window.confirm(`¿Activar la operación #${c.idOperacion}? La propiedad "${c.propiedad?.titulo}" pasará a estar ocupada/reservada y saldrá del mapa público.`)) return;
    accion(activarContrato(c.idOperacion), "No se pudo activar la operación.");
  };
  const handleFinalizar = (c) => {
    if (!window.confirm("¿Dar por finalizado este alquiler? La propiedad vuelve a estar Disponible.")) return;
    accion(finalizarContrato(c.idOperacion), "No se pudo finalizar el contrato.");
  };

  const visibles = useMemo(() => {
    const q = norm(busqueda.trim());
    return contratos
      .filter(c => (estado === "Todos" || c.estadoContrato === estado) && (tipo === "Todos" || c.tipoContrato === tipo))
      .filter(c => !q || [c.propiedad?.titulo, c.compradorInquilino?.nombreCompleto, c.vendedorPropietario?.nombreCompleto, c.numeroInterno, String(c.idOperacion)].some(v => norm(v).includes(q)))
      .sort((a, b) => b.idOperacion - a.idOperacion);
  }, [contratos, busqueda, estado, tipo]);

  const vencimiento = (c) => {
    const fin = c.fechaFin;
    if (!fin || c.tipoContrato !== "Locacion") return <span>—</span>;
    const d = c.estadoContrato === "Vigente" ? diasHasta(fin) : null;
    if (esTemporario(c) && c.estadoContrato === "Vigente") {
      const hastaIn = diasHasta(c.tempCheckIn);
      const etiqueta = hastaIn > 0 ? `llega en ${hastaIn} d` : d < 0 ? "estadía terminada" : "en curso";
      return (
        <div>
          <div>{fmtFecha(c.tempCheckIn)} → {fmtFecha(fin)}</div>
          <span className={`badge ${hastaIn > 0 ? "badge-blue" : "badge-green"}`} style={{ fontSize: "0.7rem" }}>{etiqueta}</span>
        </div>
      );
    }
    return (
      <div>
        <div>{fmtFecha(fin)}</div>
        {d !== null && <span className={`badge ${d < 0 ? "badge-red" : d <= 60 ? "badge-warning" : "badge-green"}`} style={{ fontSize: "0.7rem" }}>{d < 0 ? `venció hace ${-d} d` : d === 0 ? "vence hoy" : `faltan ${d} d`}</span>}
      </div>
    );
  };

  return (
    <div>
      <div ref={formRef} style={{ scrollMarginTop: "80px" }}>
        <ContratoForm
          key={editando?.idOperacion ?? "nueva"}
          contratoEditar={editando}
          onGuardado={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <div className="card-header">
          <span className="card-title"><i className="fa-solid fa-folder-open"></i> Operaciones y Contratos Registrados</span>
          <span className="badge badge-blue">{visibles.length === contratos.length ? contratos.length : `${visibles.length} de ${contratos.length}`}</span>
        </div>

        {error && <div role="alert" style={{ margin: "15px 20px 0", padding: "10px 14px", background: "#FDECEA", color: "#D32F2F", borderRadius: "8px", fontSize: "0.9rem" }}><i className="fa-solid fa-triangle-exclamation"></i> {error}</div>}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", padding: "15px 20px", borderBottom: "1px solid var(--color-gris-borde)" }}>
          <div className="input-with-icon" style={{ flex: "1 1 260px" }}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por propiedad, persona, N° interno o ID..." />
          </div>
          <select className="select-filtro" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ maxWidth: "190px" }}>
            {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <select className="select-filtro" value={estado} onChange={(e) => setEstado(e.target.value)} style={{ maxWidth: "170px" }}>
            {ESTADOS.map(e => <option key={e} value={e}>{e === "Todos" ? "Todos los estados" : e}</option>)}
          </select>
        </div>

        <div className="table-responsive">
          {cargando ? (
            null
          ) : contratos.length === 0 ? (
            <p style={{ textAlign: "center", padding: "20px", color: "var(--color-gris-texto)" }}>{error ? "No se pudieron cargar las operaciones." : "No hay operaciones registradas."}</p>
          ) : visibles.length === 0 ? (
            <p style={{ textAlign: "center", padding: "20px", color: "var(--color-gris-texto)" }}>Ninguna operación coincide con la búsqueda o los filtros.</p>
          ) : (
            <table>
              <thead>
                <tr><th>ID / Tipo</th><th>Propiedad</th><th>Partes</th><th>Monto</th><th>Honorarios</th><th>Vence</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {visibles.map(c => {
                  const abierto = expandido === c.idOperacion;
                  const editable = c.estadoContrato === "Borrador" || c.estadoContrato === "Vigente";
                  return (
                    <React.Fragment key={c.idOperacion}>
                      <tr style={editando?.idOperacion === c.idOperacion ? { backgroundColor: "#FFF8F8" } : undefined}>
                        <td>
                          <span style={{ fontSize: "0.8rem", color: "#666", display: "block" }}>#{c.idOperacion}</span>
                          <span className={`badge ${BADGE_TIPO[c.tipoContrato]}`}>{etiquetaTipo(c)}</span>
                        </td>
                        <td><strong>{c.propiedad?.titulo}</strong></td>
                        <td style={{ fontSize: "0.85rem" }}>
                          <div><i className="fa-solid fa-user-tie" title="Vendedor / locador"></i> {c.vendedorPropietario?.nombreCompleto || "—"}</div>
                          <div><i className="fa-solid fa-user-tag" title="Comprador / locatario"></i> {c.compradorInquilino?.nombreCompleto || "—"}</div>
                        </td>
                        <td style={{ fontWeight: "bold" }}>{c.tipoContrato === "Permuta" && !(Number(c.montoTotalOperacion) > 0) ? <span style={{ fontWeight: 400, fontSize: "0.8rem" }}>Sin diferencia en efectivo</span> : fmtMonto(c.montoTotalOperacion, c.monedaOperacion)}{c.tipoContrato === "Locacion" && !esTemporario(c) && <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--color-gris-texto)" }}> /mes</span>}</td>
                        <td style={{ fontSize: "0.85rem" }}>
                          {(() => {
                            const h = resumenHonorarios(c);
                            if (h.total <= 0) return <span style={{ color: "var(--color-gris-texto)" }}>—</span>;
                            return (
                              <div>
                                <div style={{ fontWeight: 600 }}>{fmtMonto(h.total, c.honMoneda)}</div>
                                <span className={`badge ${h.pendiente <= 0 ? "badge-green" : h.cobrado > 0 ? "badge-warning" : "badge-outline"}`} style={{ fontSize: "0.7rem" }}>
                                  {h.pendiente <= 0 ? "cobrados" : h.cobrado > 0 ? `faltan ${fmtMonto(h.pendiente, c.honMoneda)}` : "pendientes"}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td>{vencimiento(c)}</td>
                        <td><span className={`badge ${BADGE_ESTADO[c.estadoContrato] || "badge-blue"}`}>{c.estadoContrato}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="btn btn-sm btn-outline" onClick={() => setExpandido(abierto ? null : c.idOperacion)} title="Ver detalle y documentos"><i className={`fa-solid ${abierto ? "fa-chevron-up" : "fa-eye"}`}></i></button>
                            {editable && <button className="btn btn-sm btn-outline" onClick={() => setEditando(c)} title="Editar datos"><i className="fa-solid fa-pen"></i></button>}
                            {c.estadoContrato === "Borrador" && (
                              <button className="btn btn-sm btn-outline" style={{ borderColor: "#2E7D32", color: "#2E7D32" }} onClick={() => handleActivar(c)} title="Activar: la operación se firmó"><i className="fa-solid fa-circle-check"></i> Activar</button>
                            )}
                            {c.estadoContrato === "Vigente" && c.tipoContrato === "Compraventa" && (
                              <button className="btn btn-sm btn-outline" style={{ borderColor: "#1565C0", color: "#1565C0" }} onClick={() => handleCerrarVenta(c)}><i className="fa-solid fa-handshake"></i> Cerrar venta</button>
                            )}
                            {c.estadoContrato === "Vigente" && c.tipoContrato === "Permuta" && (
                              <button className="btn btn-sm btn-outline" style={{ borderColor: "#1565C0", color: "#1565C0" }} onClick={() => handleCerrarPermuta(c)}><i className="fa-solid fa-right-left"></i> Cerrar permuta</button>
                            )}
                            {c.estadoContrato === "Vigente" && c.tipoContrato === "Locacion" && (
                              <button className="btn btn-sm btn-outline" onClick={() => handleFinalizar(c)} title="El alquiler terminó normalmente"><i className="fa-solid fa-flag-checkered"></i> Finalizar</button>
                            )}
                            {editable && (
                              <button className="btn btn-sm btn-rojo" onClick={() => handleRescindir(c)} title={c.estadoContrato === "Borrador" ? "Anular borrador" : "Rescindir"}><i className="fa-solid fa-ban"></i> {c.estadoContrato === "Borrador" ? "Anular" : "Rescindir"}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {abierto && (
                        <tr style={{ backgroundColor: "#F8FAFC" }}>
                          <td colSpan="8" style={{ padding: "25px", borderBottom: "2px solid var(--color-negro)" }}>
                            <DetalleContrato c={c} personas={personas} propiedades={propiedades} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContratoList;
