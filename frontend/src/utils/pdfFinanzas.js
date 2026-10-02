import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtMonto, nombreMes, etiquetaCobro } from "./finanzas";
import { textoMonedaPdf } from "./monedas";

const cargarLogo = () => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = "/Logo Inmobiliaria.jpg";
});

const fecha = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("es-AR") : "");

// Seña / saldo de una estadía temporaria: el recibo indica las fechas de la estadía
const esCobroEstadia = (l) => !!l.contrato?.tempCheckIn && (l.concepto === "Seña de estadía" || l.concepto === "Saldo de estadía");
const conceptoRecibo = (l) => (esCobroEstadia(l) ? `${l.concepto} (${fecha(l.contrato.tempCheckIn)} al ${fecha(l.contrato.tempCheckOut)})` : etiquetaCobro(l));

/** Recibo oficial (original + duplicado) a partir de un cobro guardado. */
export async function pdfRecibo(liq) {
  const doc = new jsPDF();
  const logo = await cargarLogo();
  const mon = liq.moneda || "ARS";
  const prop = liq.contrato?.propiedad?.titulo || "Propiedad";
  const inq = liq.contrato?.compradorInquilino?.nombreCompleto || "";

  const cuerpo = (copia, y) => {
    if (logo) doc.addImage(logo, "JPEG", 15, y + 4, 22, 22);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(20, 20, 20);
    doc.text("RECIBO OFICIAL", logo ? 42 : 15, y + 10);
    doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(copia, logo ? 42 : 15, y + 15);
    doc.setFontSize(11); doc.setTextColor(211, 47, 47);
    doc.text(liq.numeroRecibo ? `N° ${liq.numeroRecibo}` : "N° (se asigna al confirmar)", 195, y + 10, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text(`Villa Carlos Paz, ${fecha(liq.fechaPagoReal)}`, 195, y + 16, { align: "right" });
    doc.setDrawColor(211, 47, 47); doc.setLineWidth(0.8); doc.line(15, y + 28, 195, y + 28);

    doc.setFillColor(248, 250, 252); doc.setDrawColor(224, 228, 232); doc.setLineWidth(0.3);
    doc.roundedRect(15, y + 31, 180, 28, 2, 2, "FD");
    doc.setTextColor(50, 50, 50);
    doc.text("Recibimos de:", 18, y + 37); doc.setFont("helvetica", "bold"); doc.text(inq, 43, y + 37);
    doc.setFont("helvetica", "normal"); doc.text("Propiedad:", 18, y + 43); doc.setFont("helvetica", "bold"); doc.text(prop, 38, y + 43);
    doc.setFont("helvetica", "normal"); doc.text("Concepto:", 18, y + 49); doc.setFont("helvetica", "bold");
    doc.text(conceptoRecibo(liq), 38, y + 49);
    doc.setFont("helvetica", "normal"); doc.text("Forma de pago:", 18, y + 55); doc.setFont("helvetica", "bold");
    doc.text(liq.medioPago || "—", 45, y + 55);

    const filas = [[conceptoRecibo(liq), fmtMonto(liq.montoAlquilerBase, mon)]];
    if (Number(liq.montoMoraCalculado) > 0) filas.push([`Intereses por mora (${liq.diasAtraso} días)`, fmtMonto(liq.montoMoraCalculado, mon)]);
    if (liq.serviciosDetalle) {
      const rs = liq.serviciosDetalle.split("\n").filter(Boolean).map((r) => r.split("|"));
      if (rs.length <= 3) rs.forEach(([desc, monto]) => filas.push([`Servicios y Expensas: ${desc}`, fmtMonto(monto, mon)]));
      else filas.push([`Servicios y Expensas (${rs.length} conceptos): ${rs.map((r) => r[0]).join(", ")}`, fmtMonto(rs.reduce((t, r) => t + Number(r[1]), 0), mon)]);
    }
    autoTable(doc, {
      startY: y + 62, head: [["Concepto", "Importe"]], body: filas,
      foot: [["TOTAL:", fmtMonto(liq.totalAbonadoInquilino, mon)]], theme: "grid",
      headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      footStyles: { fillColor: [245, 247, 250], textColor: [211, 47, 47], fontStyle: "bold", fontSize: 11 },
      columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: "right" } },
      margin: { left: 15, right: 15 }, tableWidth: 180,
    });
    let fy = doc.lastAutoTable.finalY + 9;
    if (liq.pagoParcial && Number(liq.saldoAlquilerPendiente) > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(183, 28, 28);
      doc.text(esCobroEstadia(liq)
        ? `Saldo pendiente de la estadía: ${fmtMonto(liq.saldoAlquilerPendiente, mon)}`
        : `Saldo pendiente del alquiler de ${nombreMes(liq.mesAnoLiquidado)}: ${fmtMonto(liq.saldoAlquilerPendiente, mon)}`, 15, fy - 2);
      fy += 6;
    }
    doc.setDrawColor(180, 180, 180); doc.line(35, fy, 85, fy); doc.line(125, fy, 175, fy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(esCobroEstadia(liq) ? "Firma y Aclaración (Huésped)" : "Firma y Aclaración (Locatario)", 60, fy + 4, { align: "center" });
    doc.text("Por Inmobiliaria Del Castillo", 150, fy + 4, { align: "center" });
  };

  cuerpo("ORIGINAL", 4);
  doc.setDrawColor(150, 150, 150); doc.setLineDash([1.5, 1.5], 0); doc.line(10, 148.5, 200, 148.5); doc.setLineDash();
  cuerpo("DUPLICADO", 152);
  return doc;
}

const ROJO = [211, 47, 47];
const NEGRO = [20, 20, 20];

/** Texto legible para cada línea guardada de la rendición. */
const concepto = (d) => {
  const t = String(d || "");
  if (/^Alquiler/i.test(t)) return "Alquiler";
  if (/^Pago a cuenta de alquiler/i.test(t)) return "Pago a cuenta de alquiler";
  if (/^Saldo de alquiler/i.test(t)) return "Saldo de alquiler";
  const h = t.match(/^Honorarios de administraci[oó]n \((.*)\)$/i);
  if (h) return `Administración (${h[1]})`;
  if (/^Servicios: /i.test(t)) return t.replace(/^Servicios: /i, "");
  return t;
};
const signo = (v, mon) => `${Number(v) < 0 ? "- " : ""}${fmtMonto(Math.abs(Number(v)), mon)}`;

/**
 * Rendición de cuentas al propietario (A4 vertical): encabezado con logo, una tarjeta por unidad
 * (alquiler, servicios, administración, total), resumen general, gastos, transferencias y resto.
 */
export async function pdfRendicion(r) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const mon = r.moneda || "ARS";
  const logo = await cargarLogo();
  const W = 210, M = 15;

  // ── Encabezado
  if (logo) doc.addImage(logo, "JPEG", M, 9, 24, 24);
  const xt = logo ? M + 30 : M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...NEGRO);
  doc.text("RENDICIÓN DE ALQUILERES", xt, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text("Estado de cuenta al propietario", xt, 23.5);
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...ROJO);
  doc.text(r.comprobante || "", W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
  doc.text(`Villa Carlos Paz, ${fecha(r.fechaRender)}`, W - M, 19.5, { align: "right" });
  doc.setDrawColor(...ROJO); doc.setLineWidth(0.8); doc.line(M, 36, W - M, 36);

  doc.setFillColor(248, 250, 252); doc.setDrawColor(224, 228, 232); doc.setLineWidth(0.3);
  doc.roundedRect(M, 40, W - 2 * M, 16, 2, 2, "FD");
  doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  doc.text("Propietario:", M + 4, 47); doc.setFont("helvetica", "bold"); doc.text(r.propietario?.nombreCompleto || "", M + 26, 47);
  doc.setFont("helvetica", "normal"); doc.text("Período:", M + 4, 52.5); doc.setFont("helvetica", "bold"); doc.text(nombreMes(r.mesAno), M + 26, 52.5);
  doc.setFont("helvetica", "normal"); doc.text("Moneda:", 125, 47); doc.setFont("helvetica", "bold"); doc.text(textoMonedaPdf(mon), 140, 47);

  // ── Tarjetas por unidad
  const grupos = new Map();
  (r.lineas || []).forEach((l) => {
    const [unidad, ...resto] = String(l.descripcion).split(" — ");
    if (!grupos.has(unidad)) grupos.set(unidad, []);
    grupos.get(unidad).push({ desc: concepto(resto.join(" — ") || l.descripcion), monto: Number(l.monto) });
  });
  const unidades = [...grupos.entries()].map(([nombre, items]) => {
    const m = nombre.match(/^(.*?)(?: \((.*)\))?$/);
    return { titulo: m[1], locatario: m[2] || "", items, total: items.reduce((t, c) => t + c.monto, 0) };
  });

  let y = 63;
  const ancho = 87, xs = [M, W - M - ancho];
  const pie = 280;
  const tarjeta = (u, x, y0) => {
    autoTable(doc, {
      startY: y0, margin: { left: x, right: W - x - ancho }, tableWidth: ancho, theme: "grid",
      head: [[{ content: u.titulo, colSpan: 2, styles: { halign: "center", fillColor: ROJO, textColor: 255, fontStyle: "bold", fontSize: 10 } }]],
      body: [
        ...(u.locatario ? [[{ content: `Locatario: ${u.locatario}`, colSpan: 2, styles: { fontSize: 7.5, textColor: [120, 120, 120], fontStyle: "italic" } }]] : []),
        ...u.items.map((c) => [c.desc, { content: signo(c.monto, mon), styles: { halign: "right", textColor: c.monto < 0 ? [183, 28, 28] : [50, 50, 50] } }]),
      ],
      foot: [["TOTAL", { content: fmtMonto(u.total, mon), styles: { halign: "right" } }]],
      bodyStyles: { fontSize: 8.5, textColor: [50, 50, 50], cellPadding: 1.4 },
      footStyles: { fillColor: [245, 247, 250], textColor: ROJO, fontStyle: "bold", fontSize: 9.5, cellPadding: 1.6 },
      styles: { lineColor: [210, 214, 220], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 35 } },
    });
    return doc.lastAutoTable.finalY;
  };
  const altoEst = (u) => (u.items.length + (u.locatario ? 1 : 0) + 2) * 6.4;
  for (let i = 0; i < unidades.length; i += 2) {
    const par = unidades.slice(i, i + 2);
    if (y + Math.max(...par.map(altoEst)) > pie) { doc.addPage(); y = 20; }
    const fin = par.map((u, k) => tarjeta(u, xs[k], y));
    y = Math.max(...fin) + 5;
  }

  // ── Resumen
  const gastos = r.gastosGenerales || [];
  const adel = r.transferenciasParciales || [];
  const bruto = unidades.reduce((t, u) => t + u.total, 0);
  const totG = gastos.reduce((t, g) => t + Number(g.monto), 0);
  const totT = adel.reduce((t, g) => t + Number(g.monto), 0);
  const aRendir = bruto - totG;

  const filasResumen = [
    ...unidades.map((u) => [u.titulo, fmtMonto(u.total, mon)]),
    ...gastos.map((g) => [`${g.descripcion} (gasto a descontar)`, `- ${fmtMonto(g.monto, mon)}`]),
  ];
  if (y + (filasResumen.length + 3) * 6.4 > pie) { doc.addPage(); y = 20; }
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, tableWidth: W - 2 * M, theme: "grid",
    head: [[{ content: "RESUMEN DE LA RENDICIÓN", colSpan: 2, styles: { halign: "center", fillColor: ROJO, textColor: 255, fontStyle: "bold" } }]],
    body: filasResumen,
    foot: [["TOTAL A RENDIR", fmtMonto(aRendir, mon)]],
    bodyStyles: { fontSize: 9, textColor: [50, 50, 50], cellPadding: 1.4 },
    footStyles: { fillColor: NEGRO, textColor: 255, fontStyle: "bold", fontSize: 10.5 },
    styles: { lineColor: [210, 214, 220], lineWidth: 0.2 },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: "right" } },
    didParseCell: (d) => { if (d.section === "foot" && d.column.index === 1) d.cell.styles.halign = "right"; },
  });
  y = doc.lastAutoTable.finalY + 5;

  // ── Transferencias y resto
  if (adel.length) {
    if (y + (adel.length + 3) * 6.4 > pie) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, tableWidth: W - 2 * M, theme: "grid",
      head: [[{ content: "TRANSFERENCIAS REALIZADAS", colSpan: 2, styles: { halign: "center", fillColor: [90, 90, 90], textColor: 255, fontStyle: "bold" } }]],
      body: adel.map((t) => [t.descripcion, { content: fmtMonto(t.monto, mon), styles: { halign: "right" } }]),
      foot: [["Total transferido", fmtMonto(totT, mon)], ["RESTO A TRANSFERIR", fmtMonto(r.totalNeto, mon)]],
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50], cellPadding: 2 },
      footStyles: { fillColor: [245, 247, 250], textColor: [50, 50, 50], fontStyle: "bold", fontSize: 9.5 },
      styles: { lineColor: [210, 214, 220], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "foot") { if (d.column.index === 1) d.cell.styles.halign = "right"; if (d.row.index === 1) { d.cell.styles.fillColor = [255, 243, 205]; d.cell.styles.textColor = NEGRO; } }
      },
    });
  } else {
    if (y > pie - 14) { doc.addPage(); y = 20; }
    doc.setFillColor(232, 245, 233); doc.setDrawColor(165, 214, 167); doc.roundedRect(M, y, W - 2 * M, 12, 2, 2, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(27, 94, 32);
    doc.text("TOTAL A DEPOSITAR", M + 5, y + 8);
    doc.text(fmtMonto(r.totalNeto, mon), W - M - 5, y + 8, { align: "right" });
  }

  // ── Marca de agua + pie de página en todas las hojas
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    if (r.estado === "Anulada") {
      doc.setTextColor(235, 190, 190); doc.setFont("helvetica", "bold"); doc.setFontSize(70);
      doc.text("ANULADA", 105, 160, { align: "center", angle: 35 });
    }
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(M, 285, W - M, 285);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    doc.text("Inmobiliaria Del Castillo - Villa Carlos Paz, Córdoba", M, 290);
    doc.text(`Página ${p} de ${n}`, W - M, 290, { align: "right" });
  }
  return doc;
}
