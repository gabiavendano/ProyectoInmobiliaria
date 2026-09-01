import React, { useState, useEffect } from "react";
import FinanzasForm from "./FinanzasForm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// =========================================================
// BASE DE DATOS SIMULADA
// =========================================================
const PROPIEDADES_BD = [
  { id: 1, nombre: "Complejo Los Troncos", unidades: 4, inquilinos: ["Gómez, Martín", "Pérez, Lucía", "Sánchez, Roberto", "Vacío (Propietario)"] },
  { id: 2, nombre: "Edificio Centro Sur", unidades: 6, inquilinos: ["Depto 1A", "Depto 1B", "Depto 2A", "Depto 2B", "Depto 3A", "Depto 3B"] },
  { id: 3, nombre: "Casa en Villa del Lago", unidades: 1, inquilinos: ["Martínez, Jorge"] },
  { id: 4, nombre: "Local Comercial San Martín", unidades: 1, inquilinos: ["Boutique Lola"] }
];

const PROPIETARIOS_BD = [
  {
    id: 101, nombre: "Ebole, Marcela",
    propiedadesActivas: [
      { 
        nombre: "D1", inquilino: "Gómez, A.", total: 466081,
        conceptos: [{ desc: "Alquiler Mensual", monto: 517781, signo: 1 }, { desc: "Honorarios Administración (10%)", monto: 51700, signo: -1 }],
        historial: [
          { mes: "Julio 2026", fecha: "10/07/2026", estado: "Abonado", neto: 466081, comprobante: "#00140-D1" },
          { mes: "Junio 2026", fecha: "08/06/2026", estado: "Abonado", neto: 450000, comprobante: "#00125-D1" }
        ]
      },
      { 
        nombre: "D2", inquilino: "Pérez, J.", total: 450000,
        conceptos: [{ desc: "Alquiler Mensual", monto: 500000, signo: 1 }, { desc: "Honorarios Administración (10%)", monto: 50000, signo: -1 }],
        historial: [
          { mes: "Julio 2026", fecha: "10/07/2026", estado: "Abonado", neto: 450000, comprobante: "#00140-D2" }
        ]
      },
      { 
        nombre: "D3", inquilino: "Sánchez, M.", total: 424763,
        conceptos: [{ desc: "Alquiler Mensual", monto: 471963, signo: 1 }, { desc: "Honorarios Administración (10%)", monto: 47200, signo: -1 }],
        historial: []
      },
      { 
        nombre: "Los Alamos", inquilino: "Martínez, L.", total: 421177,
        conceptos: [{ desc: "Alquiler Mensual", monto: 430821, signo: 1 }, { desc: "Reintegro Agua", monto: 33456, signo: 1 }, { desc: "Honorarios Administración (10%)", monto: 43100, signo: -1 }],
        historial: [
          { mes: "Julio 2026", fecha: "10/07/2026", estado: "Abonado", neto: 420000, comprobante: "#00140-LA" }
        ]
      }
    ],
    gastosGenerales: [{ desc: "Luz Áreas Comunes (EPEC)", monto: 8875 }, { desc: "Agua y Cloacas (Global)", monto: 169611 }, { desc: "Seguro Incendio Anual", monto: 18366 }],
    transferenciasParciales: [{ desc: "Anticipo Solicitado (04/08/2026)", monto: 1000000 }]
  },
  {
    id: 102, nombre: "Pérez, Juan",
    propiedadesActivas: [
      { 
        nombre: "Casa en Villa del Lago", inquilino: "Martínez, Jorge", total: 332500,
        conceptos: [{ desc: "Alquiler Mensual", monto: 350000, signo: 1 }, { desc: "Honorarios Administración (5%)", monto: 17500, signo: -1 }], 
        historial: [
          { mes: "Julio 2026", fecha: "05/07/2026", estado: "Abonado", neto: 332500, comprobante: "#00139" }
        ]
      }
    ],
    gastosGenerales: [{ desc: "Reparación Plomería (Fact. #1244)", monto: 25000 }],
    transferenciasParciales: []
  }
];

function FinanzasList() {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tabActual, setTabActual] = useState("Cuentas");
  const [deudasInquilinos, setDeudasInquilinos] = useState({ "3-0": 18500 });

  // Estados para el Modal de Vista Previa (Recibo Inquilino)
  const [mostrarModalPreview, setMostrarModalPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfDocActual, setPdfDocActual] = useState(null);

  // Estados para el Modal de Vista Previa (Rendición Propietario)
  const [mostrarModalPreviewRendicion, setMostrarModalPreviewRendicion] = useState(false);
  const [pdfPreviewUrlRendicion, setPdfPreviewUrlRendicion] = useState(null);
  const [pdfDocRendicion, setPdfDocRendicion] = useState(null);

  // =========================================================
  // GENERADOR NATIVO DE RECIBO (CON VISTA PREVIA Y LOGO)
  // =========================================================
  const generarPDFRecibo = () => {
    const doc = new jsPDF();
    const nombrePropiedad = propiedadCobro.nombre.split(' -')[0];
    
    const img = new Image();
    img.src = "/Logo Inmobiliaria.jpg";

    img.onload = () => {
      ejecutarGeneracion(img);
    };

    img.onerror = () => {
      ejecutarGeneracion(null);
    };

    const ejecutarGeneracion = (logoImg) => {
      const dibujarCuerpoRecibo = (tipoCopia, posY) => {
        if (logoImg) {
          doc.addImage(logoImg, 'JPEG', 15, posY + 4, 22, 22);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        doc.text("RECIBO OFICIAL", logoImg ? 42 : 15, posY + 10);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(tipoCopia, logoImg ? 42 : 15, posY + 15);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(211, 47, 47);
        doc.text("N° 0001-0000145", 195, posY + 10, { align: 'right' });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(`Villa Carlos Paz, ${new Date(fechaPago).toLocaleDateString('es-AR')}`, 195, posY + 16, { align: 'right' });

        doc.setDrawColor(211, 47, 47);
        doc.setLineWidth(0.8);
        doc.line(15, posY + 28, 195, posY + 28);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(224, 228, 232);
        doc.setLineWidth(0.3);
        doc.roundedRect(15, posY + 31, 180, 22, 2, 2, 'FD');

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text("Recibimos de:", 18, posY + 37);
        doc.setFont("helvetica", "bold");
        doc.text(`${inquilinoCobro}`, 43, posY + 37);

        doc.setFont("helvetica", "normal");
        doc.text("Propiedad:", 18, posY + 43);
        doc.setFont("helvetica", "bold");
        doc.text(`${propiedadCobro.nombre} ${propiedadCobro.unidades > 1 ? `- Unidad ${cobroUnidadIndex + 1}` : ''}`, 38, posY + 43);

        doc.setFont("helvetica", "normal");
        doc.text("Período abonado:", 18, posY + 49);
        doc.setFont("helvetica", "bold");
        doc.text("Agosto 2026", 46, posY + 49);

        const conceptosArr = [["Alquiler Mensual Base", `$ ${montoBase.toLocaleString('es-AR')}`]];
        if (diasAtraso > 0) conceptosArr.push([`Intereses por Mora (${diasAtraso} días)`, `$ ${montoMora.toLocaleString('es-AR')}`]);
        if (deudaAcumulada > 0) conceptosArr.push(["Saldo Pendiente (Meses Anteriores)", `$ ${deudaAcumulada.toLocaleString('es-AR')}`]);
        if (montoServiciosImportados > 0) conceptosArr.push(["Servicios y Expensas (Importado)", `$ ${montoServiciosImportados.toLocaleString('es-AR')}`]);

        autoTable(doc, {
          startY: posY + 56,
          head: [["Concepto", "Importe"]],
          body: conceptosArr,
          foot: [["TOTAL:", `$ ${totalCobrar.toLocaleString('es-AR')}`]],
          theme: 'grid',
          headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
          footStyles: { fillColor: [245, 247, 250], textColor: [211, 47, 47], fontStyle: 'bold', fontSize: 11 },
          columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: 'right' } },
          margin: { left: 15, right: 15 },
          tableWidth: 180
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(35, finalY, 85, finalY);
        doc.line(125, finalY, 175, finalY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Firma y Aclaración (Locatario)", 60, finalY + 4, { align: 'center' });
        doc.text("Por Inmobiliaria Del Castillo", 150, finalY + 4, { align: 'center' });
      };

      dibujarCuerpoRecibo("ORIGINAL", 4);

      doc.setDrawColor(150, 150, 150);
      doc.setLineDash([1.5, 1.5], 0);
      doc.line(10, 148.5, 200, 148.5);
      doc.setLineDash();

      dibujarCuerpoRecibo("DUPLICADO", 152);

      const pdfBlobUrl = doc.output('bloburl');
      setPdfPreviewUrl(pdfBlobUrl);
      setPdfDocActual(doc);
      setMostrarModalPreview(true);
    };
  };

  // =========================================================
  // GENERADOR NATIVO DE RENDICIÓN PROPIETARIO (CON VISTA PREVIA)
  // =========================================================
  const generarPDFRendicion = () => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(18);
    doc.text("ESTADO DE CUENTA - RENDICIÓN", 15, 15);

    doc.setFontSize(11);
    doc.text(`Propietario: ${propietarioSeleccionado.nombre}`, 15, 23);
    doc.text(`Período Liquidado: Agosto 2026`, 15, 29);

    let startY = 38;

    propietarioSeleccionado.propiedadesActivas.forEach((u) => {
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Unidad: ${u.nombre} (Locatario: ${u.inquilino})`, 15, startY);

      const rows = u.conceptos.map(c => [c.desc, `${c.signo < 0 ? '-' : ''}$ ${c.monto.toLocaleString('es-AR')}`]);
      rows.push(["Subtotal Unidad", `$ ${u.total.toLocaleString('es-AR')}`]);

      autoTable(doc, {
        startY: startY + 3,
        head: [["Concepto", "Monto"]],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 15, right: 15 },
        tableWidth: 267
      });

      startY = doc.lastAutoTable.finalY + 10;
    });

    const gastosRows = propietarioSeleccionado.gastosGenerales.map(g => [g.desc, `$ ${g.monto.toLocaleString('es-AR')}`]);
    const transfRows = propietarioSeleccionado.transferenciasParciales.map(t => [t.desc, `$ ${t.monto.toLocaleString('es-AR')}`]);

    const subtotalProps = propietarioSeleccionado.propiedadesActivas.reduce((acc, curr) => acc + curr.total, 0);
    const totalGastos = propietarioSeleccionado.gastosGenerales.reduce((acc, curr) => acc + curr.monto, 0);
    const totalTransf = propietarioSeleccionado.transferenciasParciales.reduce((acc, curr) => acc + curr.monto, 0);
    const netoFinal = subtotalProps - totalGastos - totalTransf;

    if (startY > 160) { doc.addPage(); startY = 20; }

    autoTable(doc, {
      startY: startY,
      head: [["Gastos Comunes a Descontar", "Monto"], ["Transferencias Entregadas", "Monto"]],
      body: [
        ...gastosRows.map(g => [g[0], g[1], "", ""]),
        ...transfRows.map(t => ["", "", t[0], t[1]])
      ],
      theme: 'grid',
      headStyles: { fillColor: [192, 57, 43] },
      margin: { left: 15, right: 15 },
      tableWidth: 267
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(39, 174, 96);
    doc.text(`Suma Bruta Propiedades: $ ${subtotalProps.toLocaleString('es-AR')}`, 15, finalY);
    doc.setFontSize(14);
    doc.text(`TOTAL A DEPOSITAR: $ ${netoFinal.toLocaleString('es-AR')}`, 15, finalY + 8);

    const pdfBlobUrl = doc.output('bloburl');
    setPdfPreviewUrlRendicion(pdfBlobUrl);
    setPdfDocRendicion(doc);
    setMostrarModalPreviewRendicion(true);
  };

  // =========================================================
  // ESTADOS: RENDICIONES PROPIETARIOS
  // =========================================================
  const [propietarioSeleccionado, setPropietarioSeleccionado] = useState(PROPIETARIOS_BD[0]);
  const [propiedadOwnerSeleccionada, setPropiedadOwnerSeleccionada] = useState(PROPIETARIOS_BD[0].propiedadesActivas[0]);
  
  useEffect(() => {
     setPropiedadOwnerSeleccionada(propietarioSeleccionado.propiedadesActivas[0]);
  }, [propietarioSeleccionado]);

  // =========================================================
  // ESTADOS: CARGA DE SERVICIOS Y PRORRATEO
  // =========================================================
  const [propiedadProrrateo, setPropiedadProrrateo] = useState(PROPIEDADES_BD[0]);
  const [archivosFacturas, setArchivosFacturas] = useState(null);
  const [listaServiciosUnifamiliar, setListaServiciosUnifamiliar] = useState([]);
  const [nuevoServicio, setNuevoServicio] = useState({ tipo: "Luz", monto: "", medida: "", unidadMedida: "KWh" });
  
  const [facturaProrrateo, setFacturaProrrateo] = useState({ tipo: "Luz (EPEC)", monto: "", consumoTotal: "", unidadMedida: "KWh" });
  const [consumosIngresados, setConsumosIngresados] = useState([]);
  const [listaServiciosComplejo, setListaServiciosComplejo] = useState([]);
  const [totalesAcumuladosComplejo, setTotalesAcumuladosComplejo] = useState([]);

  useEffect(() => {
    if (propiedadProrrateo && propiedadProrrateo.unidades > 1) {
       if (facturaProrrateo.tipo === 'Expensas') {
          const val = facturaProrrateo.monto || "";
          setConsumosIngresados(propiedadProrrateo.inquilinos.map(() => ({ consumo: "-", cuota: val })));
       } else {
          setConsumosIngresados(propiedadProrrateo.inquilinos.map(() => ({ consumo: "", cuota: 0 })));
       }
       setTotalesAcumuladosComplejo(propiedadProrrateo.inquilinos.map(inq => ({ inquilino: inq, totalAcumulado: 0 })));
       setListaServiciosComplejo([]);
    }
  }, [propiedadProrrateo]);

  useEffect(() => {
    if (propiedadProrrateo && propiedadProrrateo.unidades > 1) {
       if (facturaProrrateo.tipo === 'Expensas') {
          const val = facturaProrrateo.monto || "";
          setConsumosIngresados(propiedadProrrateo.inquilinos.map(() => ({ consumo: "-", cuota: val })));
       } else {
          setConsumosIngresados(propiedadProrrateo.inquilinos.map(() => ({ consumo: "", cuota: 0 })));
       }
    }
  }, [facturaProrrateo.tipo]);

  useEffect(() => {
    if (propiedadProrrateo?.unidades > 1) {
      if (facturaProrrateo.tipo === 'Expensas') {
        const montoExpensas = facturaProrrateo.monto || "";
        setConsumosIngresados(prev => prev.map(item => ({ ...item, cuota: montoExpensas })));
      } else {
        const montoTotal = parseFloat(facturaProrrateo.monto) || 0;
        const consTotal = parseFloat(facturaProrrateo.consumoTotal) || 0;

        if (montoTotal > 0 && consTotal > 0) {
          setConsumosIngresados(prev => prev.map(item => {
            const consumoUnit = parseFloat(item.consumo) || 0;
            const cuotaCalc = (consumoUnit * (montoTotal / consTotal)).toFixed(2);
            return { ...item, cuota: consumoUnit > 0 ? cuotaCalc : 0 };
          }));
        }
      }
    }
  }, [facturaProrrateo.monto, facturaProrrateo.consumoTotal, facturaProrrateo.tipo]);

  const handlePropiedadCambio = (e) => {
    const prop = PROPIEDADES_BD.find(p => p.id === parseInt(e.target.value));
    setPropiedadProrrateo(prop);
    setListaServiciosUnifamiliar([]);
  };

  const handleTipoServicioCambio = (e, esUnifamiliar = false) => {
    const tipo = e.target.value;
    let unidad = "KWh";
    if (tipo.includes("Agua") || tipo.includes("Gas") || tipo.includes("Cloacas")) unidad = "m3";
    if (tipo.includes("Expensas")) unidad = "Total";
    
    if (esUnifamiliar) {
      setNuevoServicio({ ...nuevoServicio, tipo, unidadMedida: unidad });
    } else {
      setFacturaProrrateo(prev => ({ ...prev, tipo, unidadMedida: unidad, consumoTotal: tipo === 'Expensas' ? "N/A" : "", monto: "" }));
    }
  };

  const agregarServicioUnifamiliar = () => {
    if (nuevoServicio.monto) {
      setListaServiciosUnifamiliar([...listaServiciosUnifamiliar, nuevoServicio]);
      setNuevoServicio({ tipo: "Luz", monto: "", medida: "", unidadMedida: "KWh" });
    }
  };

  const eliminarServicioUnifamiliar = (index) => {
    const nuevaLista = [...listaServiciosUnifamiliar];
    nuevaLista.splice(index, 1);
    setListaServiciosUnifamiliar(nuevaLista);
  };

  const confirmarCargaUnifamiliar = () => {
    if(listaServiciosUnifamiliar.length === 0) return alert("Debe añadir un servicio.");
    const total = listaServiciosUnifamiliar.reduce((acc, curr) => acc + parseFloat(curr.monto), 0);
    setDeudasInquilinos(prev => ({ ...prev, [`${propiedadProrrateo.id}-0`]: total }));
    alert("Servicios cargados exitosamente.");
    setListaServiciosUnifamiliar([]); setArchivosFacturas(null);
  };

  const handleConsumoChange = (index, valor) => {
    const nuevos = [...consumosIngresados];
    if (facturaProrrateo.tipo === 'Expensas') {
        nuevos[index].cuota = valor;
    } else {
        nuevos[index].consumo = valor;
        const montoTotal = parseFloat(facturaProrrateo.monto) || 0;
        const consTotal = parseFloat(facturaProrrateo.consumoTotal) || 1; 
        nuevos[index].cuota = valor ? (parseFloat(valor) * (montoTotal / consTotal)).toFixed(2) : 0;
    }
    setConsumosIngresados(nuevos);
  };

  const agregarProrrateoALista = () => {
     if(!facturaProrrateo.monto || (facturaProrrateo.tipo !== 'Expensas' && !facturaProrrateo.consumoTotal)) return alert("Faltan datos.");
     
     setListaServiciosComplejo([...listaServiciosComplejo, { tipo: facturaProrrateo.tipo, monto: facturaProrrateo.monto }]);
     
     const nuevosTotales = totalesAcumuladosComplejo.map((item, index) => {
        const cuotaSumar = parseFloat(consumosIngresados[index]?.cuota) || 0;
        return { ...item, totalAcumulado: item.totalAcumulado + cuotaSumar };
     });
     setTotalesAcumuladosComplejo(nuevosTotales);

     setFacturaProrrateo({ tipo: facturaProrrateo.tipo, monto: "", consumoTotal: "", unidadMedida: facturaProrrateo.unidadMedida });
     setConsumosIngresados(propiedadProrrateo.inquilinos.map(() => ({ consumo: "", cuota: 0 })));
  };

  const confirmarCargaProrrateoGeneral = () => {
     if(listaServiciosComplejo.length === 0) return alert("Debe añadir servicios a la lista.");
     const nuevasDeudas = { ...deudasInquilinos };
     totalesAcumuladosComplejo.forEach((item, index) => {
        nuevasDeudas[`${propiedadProrrateo.id}-${index}`] = item.totalAcumulado;
     });
     setDeudasInquilinos(nuevasDeudas);
     alert("Cargos distribuidos exitosamente a todas las unidades.");
     setListaServiciosComplejo([]); setArchivosFacturas(null);
     setTotalesAcumuladosComplejo(propiedadProrrateo.inquilinos.map(inq => ({ inquilino: inq, totalAcumulado: 0 })));
  };

  // =========================================================
  // ESTADOS: COBRANZA Y RECIBO INQUILINO
  // =========================================================
  const [cobroPropiedadId, setCobroPropiedadId] = useState(PROPIEDADES_BD[0].id);
  const [cobroUnidadIndex, setCobroUnidadIndex] = useState(0);
  const [fechaVencimiento, setFechaVencimiento] = useState("2026-08-10");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0]);
  
  const propiedadCobro = PROPIEDADES_BD.find(p => p.id === cobroPropiedadId);
  const inquilinoCobro = propiedadCobro ? propiedadCobro.inquilinos[cobroUnidadIndex] : "";
  const montoServiciosImportados = deudasInquilinos[`${cobroPropiedadId}-${cobroUnidadIndex}`] || 0;

  const montoBase = 350000;
  const interesDiario = 5000; 
  const deudaAcumulada = 45000; 

  let diasAtraso = 0; 
  let montoMora = 0;
  const fVenc = new Date(fechaVencimiento); 
  const fPago = new Date(fechaPago);
  
  if (fPago > fVenc) {
    diasAtraso = Math.ceil(Math.abs(fPago - fVenc) / (1000 * 60 * 60 * 24));
    montoMora = diasAtraso * interesDiario;
  }
  
  const totalCobrar = montoBase + montoMora + montoServiciosImportados + deudaAcumulada;

  if (mostrarForm) {
    return <div className="animation-fade-in"><FinanzasForm onGuardado={() => setMostrarForm(false)} onCancelar={() => setMostrarForm(false)} /></div>;
  }

  const esExpensas = facturaProrrateo.tipo === 'Expensas';

  return (
    <div className="animation-fade-in">
        
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px'}}>
         <h2 style={{margin: 0, color: 'var(--color-negro)', fontSize: '1.6rem'}}><i className="fa-solid fa-wallet" style={{color: 'var(--color-rojo)'}}></i> Gestión Financiera</h2>
         <div style={{display: 'flex', gap: '12px'}}>
            <a href="https://www.afip.gob.ar/facturacion/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{borderColor: '#1565C0', color: '#1565C0', backgroundColor: 'white'}}>
               <i className="fa-solid fa-file-invoice"></i> ARCA
            </a>
            <button className="btn btn-rojo" onClick={() => setMostrarForm(true)}><i className="fa-solid fa-plus"></i> Manual</button>
         </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tabActual === 'Cuentas' ? 'active' : ''}`} onClick={() => setTabActual('Cuentas')}><i className="fa-solid fa-chart-line"></i> Propietarios y Rendiciones</button>
        <button className={`tab-btn ${tabActual === 'Servicios' ? 'active' : ''}`} onClick={() => setTabActual('Servicios')}><i className="fa-solid fa-bolt"></i> Carga Servicios / Prorrateo</button>
        <button className={`tab-btn ${tabActual === 'Cobro' ? 'active' : ''}`} onClick={() => setTabActual('Cobro')}><i className="fa-solid fa-hand-holding-dollar"></i> Cobranza Inquilino</button>
      </div>

      {/* 1. CUENTAS PROPIETARIOS */}
      {tabActual === 'Cuentas' && (
        <div className="tab-content active">
          <div style={{backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-gris-borde)', marginBottom: '25px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px'}}>
             <div style={{flex: 1, minWidth: '220px'}}>
                <label style={{fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#1565C0'}}><i className="fa-solid fa-user-tie"></i> Propietario</label>
                <select className="form-control" style={{width: '100%', padding: '10px'}} value={propietarioSeleccionado.id} onChange={(e) => setPropietarioSeleccionado(PROPIETARIOS_BD.find(p => p.id === parseInt(e.target.value)))}>
                   {PROPIETARIOS_BD.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
             </div>
             <div style={{flex: 1.5, minWidth: '220px'}}>
                <label style={{fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#1565C0'}}><i className="fa-solid fa-building"></i> Ver Historial de la Propiedad</label>
                <select className="form-control" style={{width: '100%', padding: '10px'}} value={propiedadOwnerSeleccionada?.nombre} onChange={(e) => setPropiedadOwnerSeleccionada(propietarioSeleccionado.propiedadesActivas.find(p => p.nombre === e.target.value))}>
                   {propietarioSeleccionado.propiedadesActivas.map((p, i) => <option key={i} value={p.nombre}>{p.nombre} (Locatario: {p.inquilino})</option>)}
                </select>
             </div>
             <div style={{marginTop: '25px'}}>
                <button className="btn btn-rojo" style={{padding: '12px 25px'}} onClick={generarPDFRendicion}><i className="fa-solid fa-eye"></i> Ver Vista Previa de Rendición PDF</button>
             </div>
          </div>

          <div className="card">
             <div className="card-header"><span className="card-title"><i className="fa-solid fa-clock-rotate-left"></i> Facturación Histórica: {propiedadOwnerSeleccionada?.nombre}</span></div>
             <div className="table-responsive">
               <table>
                 <thead>
                   <tr><th>Período</th><th>Fecha de Rendición</th><th>Estado</th><th>Total Liquidado</th><th>Comprobante</th><th>Acción</th></tr>
                 </thead>
                 <tbody>
                   {propiedadOwnerSeleccionada?.historial.map((h, i) => (
                     <tr key={i}>
                       <td style={{fontWeight: 'bold'}}>{h.mes}</td>
                       <td>{h.fecha}</td>
                       <td><span style={{backgroundColor: '#E8F5E9', color: '#2E7D32', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}><i className="fa-solid fa-check"></i> {h.estado}</span></td>
                       <td style={{fontWeight: 'bold'}}>$ {h.neto.toLocaleString('es-AR')}</td>
                       <td>{h.comprobante}</td>
                       <td><button className="btn btn-outline" style={{padding: '5px 10px', fontSize: '0.85rem'}}><i className="fa-solid fa-eye"></i> Ver PDF</button></td>
                     </tr>
                   ))}
                   {(!propiedadOwnerSeleccionada?.historial || propiedadOwnerSeleccionada.historial.length === 0) && (
                      <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No hay rendiciones previas para esta unidad.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* 2. CARGA DE SERVICIOS Y PRORRATEO */}
      {tabActual === 'Servicios' && (
        <div className="card tab-content active">
          <div className="card-header"><span className="card-title"><i className="fa-solid fa-bolt"></i> Carga y Distribución de Servicios</span></div>
          
          <div className="form-row">
             <div className="form-group" style={{flex: 2}}><label>Seleccione Propiedad / Complejo</label>
               <select onChange={handlePropiedadCambio} value={propiedadProrrateo?.id || ""}>
                 {PROPIEDADES_BD.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.unidades} uni.)</option>)}
               </select>
             </div>
          </div>
          
          <div className="animation-fade-in" style={{backgroundColor: '#E3F2FD', padding: '25px', borderRadius: '8px', border: '1px solid #90CAF9', marginTop: '15px'}}>
             
             {propiedadProrrateo?.unidades === 1 && (
                <>
                  <div className="form-row" style={{alignItems: 'flex-end', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ccc'}}>
                     <div className="form-group"><label>Tipo de Servicio</label>
                        <select value={nuevoServicio.tipo} onChange={(e) => handleTipoServicioCambio(e, true)}>
                           <option>Luz</option><option>Agua</option><option>Gas</option><option>Cloacas</option><option>Expensas</option>
                        </select>
                     </div>
                     <div className="form-group"><label>Monto ($)</label><input type="number" placeholder="Ej: 15000" value={nuevoServicio.monto} onChange={e => setNuevoServicio({...nuevoServicio, monto: e.target.value})} /></div>
                     <div className="form-group"><label>Medición</label><input type="text" placeholder={`Ej: 1400`} value={nuevoServicio.medida} onChange={e => setNuevoServicio({...nuevoServicio, medida: e.target.value})} /></div>
                     <div className="form-group"><button className="btn btn-negro" onClick={agregarServicioUnifamiliar} disabled={!nuevoServicio.monto}><i className="fa-solid fa-plus"></i> Añadir</button></div>
                  </div>

                  {listaServiciosUnifamiliar.length > 0 && (
                     <div className="animation-fade-in" style={{marginTop: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ccc', overflow: 'hidden'}}>
                        <table style={{width: '100%', borderCollapse: 'collapse'}}>
                           <thead style={{backgroundColor: '#f1f1f1'}}>
                              <tr><th style={{padding: '10px'}}>Servicio</th><th style={{padding: '10px'}}>Monto</th><th style={{padding: '10px', textAlign: 'center'}}>Acción</th></tr>
                           </thead>
                           <tbody>
                              {listaServiciosUnifamiliar.map((s, idx) => (
                                 <tr key={idx} style={{borderBottom: '1px solid #eee'}}>
                                    <td style={{padding: '10px'}}>{s.tipo} {s.medida ? `(${s.medida})` : ''}</td>
                                    <td style={{padding: '10px', fontWeight: 'bold'}}>$ {parseFloat(s.monto).toLocaleString('es-AR')}</td>
                                    <td style={{padding: '10px', textAlign: 'center'}}><button onClick={() => eliminarServicioUnifamiliar(idx)} style={{background:'none', border:'none', color: '#D32F2F', cursor:'pointer'}}><i className="fa-solid fa-trash"></i></button></td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                        <div style={{padding: '20px', borderTop: '1px dashed #ccc', backgroundColor: '#F8FAFC'}}>
                           <label style={{fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#333'}}>Adjuntar Comprobantes (PDF/IMG)</label>
                           <input type="file" multiple className="btn btn-outline" style={{width: '100%', backgroundColor: 'white'}} onChange={(e) => setArchivosFacturas(e.target.files)} />
                           <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '20px'}}>
                               <button className="btn btn-rojo" style={{padding: '12px 25px'}} onClick={confirmarCargaUnifamiliar}>Confirmar y Guardar Servicios</button>
                           </div>
                        </div>
                     </div>
                  )}
                </>
             )}

             {propiedadProrrateo?.unidades > 1 && (
                <>
                   <div style={{backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ccc'}}>
                       <h5 style={{margin: '0 0 15px 0', color: '#1565C0'}}>1. Cargar Factura General de Complejo</h5>
                       <div className="form-row" style={{alignItems: 'flex-end', marginBottom: '15px'}}>
                          <div className="form-group"><label>Servicio / Gasto</label>
                             <select value={facturaProrrateo.tipo} onChange={(e) => handleTipoServicioCambio(e, false)}>
                                <option>Luz (EPEC)</option><option>Agua</option><option>Gas</option><option>Cloacas</option>
                                <option>Expensas</option>
                             </select>
                          </div>
                          
                          <div className="form-group">
                             <label>{esExpensas ? "Monto a cobrar por Unidad ($)" : "Monto Total de Factura ($)"}</label>
                             <input type="number" placeholder="Ej: 15000" value={facturaProrrateo.monto} onChange={e => setFacturaProrrateo({...facturaProrrateo, monto: e.target.value})} />
                          </div>
                          
                          {!esExpensas && (
                             <div className="form-group"><label>Consumo Total</label><input type="number" placeholder="Ej: 1200" value={facturaProrrateo.consumoTotal} onChange={e => setFacturaProrrateo({...facturaProrrateo, consumoTotal: e.target.value})} /></div>
                          )}
                       </div>
                       
                       {facturaProrrateo.monto && facturaProrrateo.consumoTotal && !esExpensas && (
                          <div style={{backgroundColor: '#FFF3E0', padding: '10px', borderRadius: '6px', textAlign: 'center', marginBottom: '15px'}}>
                             <span style={{color: '#E65100', fontWeight: 'bold'}}>Precio x 1 {facturaProrrateo.unidadMedida}: ${(parseFloat(facturaProrrateo.monto) / parseFloat(facturaProrrateo.consumoTotal)).toFixed(2)}</span>
                          </div>
                       )}

                       <div style={{width: '100%', overflowX: 'auto'}}>
                         <table style={{width: '100%', backgroundColor: '#F8FAFC', borderRadius: '6px', borderCollapse: 'collapse', minWidth: '400px'}}>
                            <thead style={{backgroundColor: '#E0E4E8'}}>
                               <tr>
                                   <th style={{padding: '8px', textAlign: 'left'}}>Unidad / Locatario</th>
                                   <th style={{padding: '8px'}}>{esExpensas ? 'Cuota Individual ($)' : `Medidor (${facturaProrrateo.unidadMedida})`}</th>
                                   <th style={{padding: '8px', textAlign: 'right'}}>A Cobrar</th>
                               </tr>
                            </thead>
                            <tbody>
                              {consumosIngresados.map((item, idx) => (
                                <tr key={idx} style={{borderBottom: '1px solid #EEE'}}>
                                   <td style={{padding: '8px'}}><strong>Unidad {idx+1}</strong> - {propiedadProrrateo.inquilinos[idx]}</td>
                                   <td style={{padding: '8px'}}>
                                      {esExpensas ? (
                                         <input type="number" style={{width: '100%', maxWidth: '100px', padding: '6px', boxSizing: 'border-box'}} value={item.cuota} onChange={(e) => handleConsumoChange(idx, e.target.value)} />
                                      ) : (
                                         <input type="number" style={{width: '100%', maxWidth: '100px', padding: '6px', boxSizing: 'border-box'}} value={item.consumo} onChange={(e) => handleConsumoChange(idx, e.target.value)} />
                                      )}
                                   </td>
                                   <td style={{padding: '8px', color: 'var(--color-rojo)', fontWeight: 'bold', textAlign: 'right'}}>$ {item.cuota || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                         </table>
                       </div>

                       <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '15px'}}>
                          <button className="btn btn-negro" onClick={agregarProrrateoALista} disabled={!facturaProrrateo.monto}><i className="fa-solid fa-plus"></i> Añadir Gasto a la Liquidación</button>
                       </div>
                   </div>

                   {listaServiciosComplejo.length > 0 && (
                      <div className="animation-fade-in" style={{marginTop: '25px', display: 'flex', flexWrap: 'wrap', gap: '20px'}}>
                          <div style={{flex: 1, minWidth: '280px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ccc'}}>
                             <h5 style={{margin: '0 0 10px 0'}}>Gastos Añadidos</h5>
                             <table style={{width: '100%', fontSize: '0.85rem'}}>
                                <tbody>
                                   {listaServiciosComplejo.map((s, idx) => (
                                      <tr key={idx} style={{borderBottom: '1px solid #eee'}}><td style={{padding: '5px 0'}}>{s.tipo}</td><td style={{textAlign: 'right', fontWeight: 'bold'}}>{s.tipo === 'Expensas' ? '(Fijo Unid.)' : `$ ${parseFloat(s.monto).toLocaleString('es-AR')}`}</td></tr>
                                   ))}
                                </tbody>
                             </table>
                          </div>
                          
                          <div style={{flex: 1.5, minWidth: '280px', backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #ccc'}}>
                             <h5 style={{margin: '0 0 10px 0', color: '#2E7D32'}}>Total Acumulado a Cobrar por Unidad</h5>
                             <table style={{width: '100%', fontSize: '0.85rem'}}>
                                <tbody>
                                   {totalesAcumuladosComplejo.map((t, idx) => (
                                      <tr key={idx} style={{borderBottom: '1px solid #eee'}}><td style={{padding: '5px 0'}}>Unidad {idx+1} ({t.inquilino})</td><td style={{textAlign: 'right', fontWeight: 'bold', color: '#1B5E20'}}>$ {t.totalAcumulado.toLocaleString('es-AR')}</td></tr>
                                   ))}
                                </tbody>
                             </table>
                             <div style={{marginTop: '20px', paddingTop: '15px', borderTop: '1px dashed #ccc'}}>
                                 <label style={{fontWeight: 'bold', display: 'block', marginBottom: '8px', color: '#333'}}><i className="fa-solid fa-paperclip" style={{color: 'var(--color-rojo)'}}></i> Adjuntar Facturas del Complejo (PDF / IMG)</label>
                                 <input type="file" multiple className="btn btn-outline" style={{width: '100%', backgroundColor: 'white'}} onChange={(e) => setArchivosFacturas(e.target.files)} />
                                 <div style={{marginTop: '15px', textAlign: 'right'}}>
                                     <button className="btn btn-rojo" onClick={confirmarCargaProrrateoGeneral}>Confirmar y Distribuir Totales</button>
                                 </div>
                             </div>
                          </div>
                      </div>
                   )}
                </>
             )}
          </div>
        </div>
      )}

      {/* 3. COBRANZA ALQUILER */}
      {tabActual === 'Cobro' && (
        <div className="card tab-content active">
          <div className="card-header"><span className="card-title"><i className="fa-solid fa-calculator"></i> Liquidación Mensual al Inquilino</span></div>
          
          <div className="form-row">
              <div className="form-group" style={{flex: 2}}><label>1. Seleccionar Propiedad</label>
                  <select value={cobroPropiedadId} onChange={(e) => { setCobroPropiedadId(parseInt(e.target.value)); setCobroUnidadIndex(0); }}>
                     {PROPIEDADES_BD.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.unidades} uni.)</option>)}
                  </select>
              </div>
              <div className="form-group" style={{flex: 2}}><label>2. Seleccionar Unidad / Locatario</label>
                  <select value={cobroUnidadIndex} onChange={(e) => setCobroUnidadIndex(parseInt(e.target.value))}>
                     {propiedadCobro?.inquilinos.map((inq, idx) => <option key={idx} value={idx}>Unidad {idx+1} - {inq}</option>)}
                  </select>
              </div>
              <div className="form-group" style={{flex: 1}}><label>Mes</label><input type="text" value="Agosto 2026" disabled style={{fontWeight: 'bold'}} /></div>
          </div>

          <div className="form-row" style={{backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-gris-borde)'}}>
              <div className="form-group"><label>Alquiler Base</label><input type="number" value={montoBase} disabled /></div>
              <div className="form-group"><label>Vencimiento</label><input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} /></div>
              <div className="form-group"><label>Fecha Pago</label><input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} /></div>
          </div>

          <div className="form-row" style={{marginTop: '25px', alignItems: 'flex-end'}}>
              <div className="form-group" style={{flex: 0.5}}><label>Días Mora</label><input type="text" value={diasAtraso} disabled style={{fontWeight: 'bold', textAlign: 'center'}} /></div>
              <div className="form-group"><label>Interés de Mora</label><input type="text" value={montoMora} disabled style={{color: 'var(--color-rojo)', fontWeight: 'bold'}} /></div>
              <div className="form-group">
                  <label>Servicios Prorrateados <span style={{fontSize:'0.7rem', color:'green'}}>(Importado aut.)</span></label>
                  <input type="text" value={montoServiciosImportados} disabled style={{color: '#E65100', fontWeight: 'bold'}} />
              </div>
              <div className="form-group"><label>Deuda Previa</label><input type="text" value={deudaAcumulada} disabled style={{color: '#C62828', fontWeight: 'bold'}} /></div>
          </div>
          
          <div style={{marginTop: '30px', padding: '25px', backgroundColor: '#E8F5E9', border: '2px dashed #2E7D32', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px'}}>
             <div>
               <p style={{margin: 0, fontSize: '0.9rem', color: '#2E7D32', fontWeight: 600}}>TOTAL A COBRAR ({inquilinoCobro})</p>
               <h2 style={{margin: 0, color: '#1B5E20', fontSize: '2.2rem'}}>$ {totalCobrar.toLocaleString('es-AR')}</h2>
             </div>
             <button type="button" className="btn btn-rojo" style={{padding: '15px 30px', fontSize: '1.1rem'}} onClick={generarPDFRecibo}>
                <i className="fa-solid fa-eye"></i> Ver Vista Previa del Recibo PDF
             </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE VISTA PREVIA DEL RECIBO PDF                     */}
      {/* ========================================================= */}
      {mostrarModalPreview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '100%', maxWidth: '850px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px'}}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{margin: 0, color: 'var(--color-negro)'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--color-rojo)'}}></i> Vista Previa del Recibo Oficial</h3>
                <button onClick={() => setMostrarModalPreview(false)} style={{background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#666'}}><i className="fa-solid fa-xmark"></i></button>
             </div>

             <div style={{width: '100%', height: '450px', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden'}}>
                <iframe src={pdfPreviewUrl} style={{width: '100%', height: '100%', border: 'none'}} title="Vista Previa Recibo PDF" />
             </div>

             <div style={{display: 'flex', justifyContent: 'flex-end', gap: '15px', flexWrap: 'wrap'}}>
                <button className="btn btn-outline" onClick={() => {
                  if (pdfPreviewUrl) {
                    window.open(pdfPreviewUrl, '_blank');
                  }
                }}>
                   <i className="fa-solid fa-print"></i> Imprimir / Abrir Externo
                </button>
                <button className="btn btn-rojo" onClick={() => {
                  if (pdfDocActual) {
                    const nombrePropiedad = propiedadCobro.nombre.split(' -')[0];
                    pdfDocActual.save(`Recibo_Agosto_2026_${nombrePropiedad}_${inquilinoCobro}.pdf`);
                    setMostrarModalPreview(false);
                  }
                }}>
                   <i className="fa-solid fa-download"></i> Guardar como PDF
                </button>
             </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE VISTA PREVIA DE LA RENDICIÓN PDF                */}
      {/* ========================================================= */}
      {mostrarModalPreviewRendicion && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '100%', maxWidth: '950px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px'}}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{margin: 0, color: 'var(--color-negro)'}}><i className="fa-solid fa-file-pdf" style={{color: 'var(--color-rojo)'}}></i> Vista Previa de la Rendición PDF</h3>
                <button onClick={() => setMostrarModalPreviewRendicion(false)} style={{background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#666'}}><i className="fa-solid fa-xmark"></i></button>
             </div>

             <div style={{width: '100%', height: '480px', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden'}}>
                <iframe src={pdfPreviewUrlRendicion} style={{width: '100%', height: '100%', border: 'none'}} title="Vista Previa Rendición PDF" />
             </div>

             <div style={{display: 'flex', justifyContent: 'flex-end', gap: '15px', flexWrap: 'wrap'}}>
                <button className="btn btn-outline" onClick={() => {
                  if (pdfPreviewUrlRendicion) {
                    window.open(pdfPreviewUrlRendicion, '_blank');
                  }
                }}>
                   <i className="fa-solid fa-print"></i> Imprimir / Abrir Externo
                </button>
                <button className="btn btn-rojo" onClick={() => {
                  if (pdfDocRendicion) {
                    pdfDocRendicion.save(`Rendicion_Agosto_2026_${propietarioSeleccionado.nombre}.pdf`);
                    setMostrarModalPreviewRendicion(false);
                  }
                }}>
                   <i className="fa-solid fa-download"></i> Guardar como PDF
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default FinanzasList;