// @/lib/services/pdf-generator.ts
"use client";

import type { OrdenServicio } from "@/lib/types/orden";
import { formatCurrency, formatDate, formatBsCurrency } from "@/lib/utils/order-utils";

// --- HELPER PARA CARGA DINÁMICA DE PDFMAKE ---
async function loadPdfDependencies() {
    if (typeof window === 'undefined') {
        return null; 
    }
    
    const [pdfMakeImport, pdfFontsImport] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
    ]);

    const pdfMake = pdfMakeImport.default || pdfMakeImport;
    const pdfFontsModule = pdfFontsImport.default || pdfFontsImport;

    let vfsObject = null;

    if (pdfFontsModule && pdfFontsModule.pdfMake && pdfFontsModule.pdfMake.vfs) {
        vfsObject = pdfFontsModule.pdfMake.vfs;
    } 
    else if (pdfFontsModule && Object.keys(pdfFontsModule).some(key => key.endsWith('.ttf'))) {
        vfsObject = pdfFontsModule;
    }
    else if (pdfFontsModule && pdfFontsModule.vfs) {
        vfsObject = pdfFontsModule.vfs;
    }
    
    if (vfsObject) {
        pdfMake.vfs = vfsObject;
    } else {
        console.error("Error: Estructura de pdfFonts/vfs_fonts no encontrada.");
        return null;
    }
    
    pdfMake.fonts = {
        Roboto: {
            normal: "Roboto-Regular.ttf",
            bold: "Roboto-Medium.ttf",
            italics: "Roboto-Italic.ttf",
            bolditalics: "Roboto-MediumItalics.ttf",
        },
    };
    
    return pdfMake;
}

// --- CONSTANTES DE NEGOCIO ---
const PRECIO_LASER_POR_MINUTO = 0.8;
const NOTAS_LEGALES = [
  "LOS PRECIOS NO INCLUYEN IVA, SOLO FACTURA NOTA DE ENTREGA.",
  "TIEMPO DE ELABORACIÓN 5 DÍAS A PARTIR DE LA ENTREGA DE LA INICIAL",
  "FORMA DE PAGO 60% PARA INICIAR 40% EL FINALIZAR",
];
const FALLBACK_LOGO_PRINCIPAL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwAChwGAf60MhQAAAABJRU5ErkJggg==";

// --- INTERFACES ---
export interface PDFOptions {
  bcvRate?: number;
  firmaBase64?: string;
  selloBase64?: string;
  // Configuración de moneda para reportes dinámicos
  currency?: {
      rate: number;
      label: string; // Ej: "Tasa BCV (EUR)"
      symbol: string; // Ej: "Bs."
  };
}

interface BudgetItem {
    descripcion: string;
    cantidad: number;
    precioUnitarioUSD: number; 
    totalUSD: number;
}

interface BudgetData {
    titulo: string;
    clienteNombre: string;
    clienteCedula?: string;
    items: BudgetItem[];
    totalUSD: number;
    fechaCreacion: string;
}

export interface ConsolidatedItem {
    parentOrder: string;
    nombre: string;
    cantidad: number;
    medidasTiempo: string; 
    precioUnitario: number;
    totalUSD: number;
}

export interface GeneralAccountStatusData {
    clienteNombre: string;
    clienteRIF: string;
    items: ConsolidatedItem[];
    totalPendienteUSD: number;
    fechaReporte: string;
}

// --- LÓGICA DE CÁLCULO TÉCNICO ---
/**
 * Calcula el subtotal real priorizando el valor guardado en el Wizard (redondeos).
 */
const calculateItemSubtotal = (item: any): number => {
  if (item.subtotal !== undefined && item.subtotal !== null) {
    return parseFloat(item.subtotal);
  }
  if (item.totalAjustado !== undefined) {
      return parseFloat(item.totalAjustado);
  }

  const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item;
  const finalCantidad = parseFloat(cantidad) || 0;
  const finalPrecio = parseFloat(precioUnitario) || 0;

  if (unidad === "und") {
    return finalCantidad * finalPrecio;
  } else if (unidad === "m2") {
    const x = parseFloat(medidaXCm) || 0;
    const y = parseFloat(medidaYCm) || 0;
    if (x > 0 && y > 0) {
      return (x / 100) * (y / 100) * finalPrecio * finalCantidad;
    }
  } else if (unidad === "tiempo") {
    if (tiempoCorte && tiempoCorte !== "N/A") {
      const [minutesStr, secondsStr] = tiempoCorte.split(":");
      const minutes = parseInt(minutesStr) || 0;
      const seconds = parseInt(secondsStr) || 0;
      const totalMinutes = minutes + seconds / 60;
      return totalMinutes * PRECIO_LASER_POR_MINUTO * finalCantidad;
    }
  }
  return finalCantidad * finalPrecio;
};

// --- DISEÑO ---
const customTableLayout = {
    hLineWidth: (i: number) => 1,
    vLineWidth: (i: number) => 1,
    hLineColor: () => "black",
    vLineColor: () => "black",
    fillColor: (i: number) => (i === 0 ? "#EEEEEE" : null),
    paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6,
};

const getSignatureBlockContent = (firmaBase64: string | undefined, selloBase64: string | undefined) => ([
    {
        text: "SIN MAS QUE HACER REFERENCIA...",
        style: "farewellText",
        alignment: "center",
        margin: [0, 20, 0, 30], 
    },
    {
        columns: [
            { width: "*", text: "" },
            { width: "*", text: "" },
            {
                width: 250, 
                alignment: "center",
                columns: [
                    {
                        width: 150, 
                        stack: [
                            firmaBase64 ? { image: firmaBase64, width: 120, height: 40, alignment: "center" } : { text: " " },
                            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1 }], margin: [0, 2, 0, 0] },
                            { text: "JOSUE LEAL", style: "contactName", margin: [0, 5, 0, 0] },
                            { text: `C.I: 19448046`, style: "contactInfo" },
                            { text: `Cel. 04246118494`, style: "contactInfo" },
                        ],
                    },
                    {
                        width: "*",
                        stack: selloBase64 ? [{ image: selloBase64, width: 150, height: 150, alignment: "right" }] : [],
                    },
                ],
                columnGap: 10,
            },
            { width: "*", text: "" },
        ],
    },
]);

// --- 1. ORDEN DE SERVICIO (Factura Individual) ---
export async function generateOrderPDF(orden: OrdenServicio, SMRLogoBase64: string, options: PDFOptions = {}) {
  const pdfMake = await loadPdfDependencies();
  if (!pdfMake) return;

  // Configuración de moneda por defecto si no viene
  const { 
      firmaBase64, 
      selloBase64,
      currency = { rate: options.bcvRate || 1, label: "Tasa BCV", symbol: "Bs." }
  } = options;

  const totalUSD = orden.totalUSD;
    
  const itemRows = orden.items.map((item: any) => {
    const subtotal = calculateItemSubtotal(item);
    let med = "N/A";
    if (item.unidad === "m2") med = `${item.medidaXCm}x${item.medidaYCm}cm`;
    else if (item.tiempoCorte) med = item.tiempoCorte;

    let desc = item.nombre;
    const mat = item.materialDetalleCorte || item.materialDeImpresion;
    if (mat) desc += `\n(${mat})`;

    return [
      { text: item.cantidad, style: "itemText" },
      { text: desc, style: "itemText" },
      { text: med, style: "itemText", alignment: "center" },
      { text: formatCurrency(subtotal), style: "itemTotal", alignment: "right" },
    ];
  });

  const docDefinition: any = {
    pageSize: "LETTER",
    content: [
      { text: `${orden.cliente.ciudad || "Coro"}, ${formatDate(orden.fecha)}`, alignment: "right", style: "dateInfo" },
      { image: SMRLogoBase64 || FALLBACK_LOGO_PRINCIPAL, width: 150, alignment: "left", margin: [0, 0, 0, 10] },
      { text: "PRESUPUESTO", style: "title", alignment: "center", margin: [0, 10] },
      // SOLO NOMBRE (RIF ELIMINADO)
      { text: `Cliente: ${orden.cliente.nombreRazonSocial}`, style: "clientInfo", margin: [0, 10] },
      {
        table: {
          widths: [55, "*", 100, 70],
          body: [
            [{ text: "Cant.", style: "tableHeader" }, { text: "Descripción", style: "tableHeader" }, { text: "Medida/Tiempo", style: "tableHeader", alignment: "center" }, { text: "Monto", style: "tableHeader", alignment: "right" }],
            ...itemRows,
            [{ text: "TOTAL", colSpan: 3, style: "finalTotalLabelBig", alignment: "right" }, {}, {}, { text: formatCurrency(totalUSD), style: "finalTotalValueBig", alignment: "right" }]
          ]
        },
        layout: customTableLayout,
        margin: [0, 5, 0, 15]
      },
      {
        columns: [
            // SI LA TASA ES > 1, SE MUESTRA. SI ES 1 (SOLO USD), SE OCULTA CON ESPACIO VACÍO
            { width: "50%", text: currency.rate > 1 ? `${currency.label}: ${currency.rate.toFixed(2)}` : " ", style: "bcvRate" },
            { width: "50%", text: currency.rate > 1 ? `Total en ${currency.symbol}: ${formatBsCurrency(totalUSD, currency.rate)}` : " ", alignment: "right", style: "totalVesRef" }
        ],
        margin: [0, 0, 0, 15]
      },
      { stack: [{ text: "NOTA:", bold: true, fontSize: 10 }, { ul: NOTAS_LEGALES, fontSize: 9 }] },
      ...getSignatureBlockContent(firmaBase64, selloBase64)
    ],
    styles: {
        title: { fontSize: 16, bold: true, color: "#333333" },
        tableHeader: { bold: true, fontSize: 10, fillColor: "#EEEEEE" },
        itemText: { fontSize: 9, bold: true },
        itemTotal: { fontSize: 9, bold: true },
        finalTotalValueBig: { fontSize: 14, bold: true, color: "#007bff" },
        finalTotalLabelBig: { fontSize: 10, bold: true, color: "#000000" },
        dateInfo: { fontSize: 10 },
        clientInfo: { fontSize: 10, bold: true },
        contactName: { fontSize: 10, bold: true },
        contactInfo: { fontSize: 9 },
        bcvRate: { fontSize: 9, color: "#666666" },
        totalVesRef: { fontSize: 11, color: "#666666" },
        farewellText: { fontSize: 9, italics: true }
    },
    defaultStyle: { font: "Roboto" }
  };
  pdfMake.createPdf(docDefinition).open();
}

// --- 2. PRESUPUESTO (Calculadora) ---
export async function generateBudgetPDF(budgetData: BudgetData, SMRLogoBase64: string, options: PDFOptions = {}) {
    const pdfMake = await loadPdfDependencies();
    if (!pdfMake) return; 
    
    const { 
        firmaBase64, 
        selloBase64,
        currency = { rate: options.bcvRate || 1, label: "Tasa BCV", symbol: "Bs." }
    } = options;

    const itemRows = budgetData.items.map(item => {
        const subtotal = item.totalUSD;
        const qty = item.cantidad || 1;
        const unitPrice = subtotal / qty;

        return [
            { text: item.cantidad, style: "itemText" },
            { text: item.descripcion, style: "itemText" },
            { text: formatCurrency(unitPrice), style: "itemText", alignment: "right" },
            { text: formatCurrency(subtotal), style: "itemTotal", alignment: "right" },
        ];
    });

    const docDefinition: any = {
        pageSize: "LETTER",
        content: [
            { text: budgetData.fechaCreacion, alignment: "right", style: "dateInfo" },
            { image: SMRLogoBase64 || FALLBACK_LOGO_PRINCIPAL, width: 150, alignment: "left", margin: [0, 0, 0, 10] },
            { text: "PRESUPUESTO", style: "title", alignment: "center", margin: [0, 10] },
            // SOLO NOMBRE (RIF ELIMINADO)
            { text: `Cliente: ${budgetData.clienteNombre}`, style: "clientInfo", margin: [0, 10] },
            {
                table: {
                    widths: [55, "*", 70, 70],
                    body: [
                        [{ text: "Cant.", style: "tableHeader" }, { text: "Descripción", style: "tableHeader" }, { text: "P. Unit", style: "tableHeader", alignment: "right" }, { text: "Total", style: "tableHeader", alignment: "right" }],
                        ...itemRows,
                        [{ text: "TOTAL", colSpan: 3, style: "finalTotalLabelBig", alignment: "right" }, {}, {}, { text: formatCurrency(budgetData.totalUSD), style: "finalTotalValueBig", alignment: "right" }]
                    ]
                },
                layout: customTableLayout,
                margin: [0, 5, 0, 15]
            },
            // SECCIÓN DE CONVERSIÓN AGREGADA
            {
                columns: [
                    { width: "50%", text: currency.rate > 1 ? `${currency.label}: ${currency.rate.toFixed(2)}` : " ", style: "dateInfo" },
                    { width: "50%", text: currency.rate > 1 ? `Total en ${currency.symbol}: ${formatBsCurrency(budgetData.totalUSD, currency.rate)}` : " ", alignment: "right", style: "totalVesRef" }
                ],
                margin: [0, 0, 0, 15]
            },
            ...getSignatureBlockContent(firmaBase64, selloBase64)
        ],
        styles: { 
            title: { fontSize: 16, bold: true, color: "#333333" }, 
            tableHeader: { fontSize: 10, bold: true, fillColor: "#EEEEEE" }, 
            itemText: { fontSize: 9, bold: true },
            itemTotal: { fontSize: 9, bold: true },
            finalTotalValueBig: { fontSize: 14, bold: true, color: "#007bff" },
            finalTotalLabelBig: { fontSize: 10, bold: true },
            dateInfo: { fontSize: 10, color: "#666666" },
            clientInfo: { fontSize: 10, bold: true },
            totalVesRef: { fontSize: 11, color: "#666666" },
            farewellText: { fontSize: 9, italics: true }
        },
        defaultStyle: { font: "Roboto" }
    };
    pdfMake.createPdf(docDefinition).open();
}

// --- 3. RECIBO GENERAL (Estado de Cuenta) ---
export async function generateGeneralAccountStatusPDF(data: GeneralAccountStatusData, SMRLogoBase64: string, options: PDFOptions = {}) {
    const pdfMake = await loadPdfDependencies();
    if (!pdfMake) return;

    const { 
        firmaBase64, 
        selloBase64, 
        currency = { rate: options.bcvRate || 1, label: "Tasa BCV", symbol: "Bs." } 
    } = options;

    const itemRows = data.items.map((item) => {
        const subtotal = item.totalUSD;
        // SIN PRECIO UNITARIO VISUALIZADO

        return [
            { text: item.parentOrder, style: "itemText", alignment: "center" },
            { text: item.cantidad, style: "itemText", alignment: "center" },
            { text: item.nombre, style: "itemText" },
            { text: item.medidasTiempo || "N/A", style: "itemText", alignment: "center" },
            { text: formatCurrency(subtotal), style: "itemTotal", alignment: "right" },
        ];
    });

    const docDefinition: any = {
        pageSize: "LETTER",
        content: [
            { text: `Corte al: ${data.fechaReporte}`, style: "dateInfo", alignment: "right", margin: [0, 0, 0, 5] },
            { image: SMRLogoBase64 || FALLBACK_LOGO_PRINCIPAL, width: 150, alignment: "left", margin: [0, 0, 0, 10] },
            { text: "ESTADO DE CUENTA CONSOLIDADO", style: "title", alignment: "center", margin: [0, 5, 0, 15] },
            {
                stack: [
                    // SOLO NOMBRE, SIN RIF
                    { text: `CLIENTE: ${data.clienteNombre.toUpperCase()}`, style: "clientInfo" },
                ],
                margin: [0, 0, 0, 20],
            },
            {
                style: "itemsTable",
                table: {
                    headerRows: 1,
                    // ANCHOS AJUSTADOS (Sin columna P.Unit)
                    widths: [55, 35, "*", 90, 80],
                    body: [
                        [
                            { text: "Orden", style: "tableHeader", alignment: "center" }, 
                            { text: "Cant.", style: "tableHeader", alignment: "center" }, 
                            { text: "Descripción", style: "tableHeader" }, 
                            { text: "Medida/Tiempo", style: "tableHeader", alignment: "center" }, 
                            { text: "Subtotal", style: "tableHeader", alignment: "right" }
                        ],
                        ...itemRows,
                        [
                            // COLSPAN AJUSTADO A 4
                            { text: "SALDO TOTAL PENDIENTE", style: "finalTotalLabelBig", colSpan: 4, alignment: "right" },
                            {}, {}, {}, 
                            { text: formatCurrency(data.totalPendienteUSD), style: "finalTotalValueBig", alignment: "right" },
                        ],
                    ],
                },
                layout: customTableLayout,
                margin: [0, 5, 0, 15]
            },
            {
                columns: [
                    { width: "50%", text: currency.rate > 1 ? `${currency.label}: ${currency.rate.toFixed(2)}` : " ", style: "dateInfo" },
                    { width: "50%", text: currency.rate > 1 ? `Total en ${currency.symbol}: ${formatBsCurrency(data.totalPendienteUSD, currency.rate)}` : " ", alignment: "right", style: "totalVesRef" }
                ],
                margin: [0, 0, 0, 20]
            },
            ...getSignatureBlockContent(firmaBase64, selloBase64)
        ],
        styles: {
            title: { fontSize: 14, bold: true, color: "#1e40af" },
            clientInfo: { fontSize: 10, bold: true, color: "#333333" },
            dateInfo: { fontSize: 9, color: "#666666" },
            tableHeader: { bold: true, fontSize: 9, color: "black", fillColor: "#f3f4f6" },
            itemText: { fontSize: 8, bold: true },
            itemTotal: { fontSize: 8, bold: true },
            finalTotalLabelBig: { fontSize: 10, bold: true, color: "#000000" },
            finalTotalValueBig: { fontSize: 12, bold: true, color: "#e11d48" },
            totalVesRef: { fontSize: 11, color: "#666666" },
            contactName: { fontSize: 10, bold: true, color: "#333333" },
            contactInfo: { fontSize: 9, color: "#666666" },
            farewellText: { fontSize: 9, italics: true, color: "#333333" }
        },
        defaultStyle: { font: "Roboto" }
    };

    pdfMake.createPdf(docDefinition).open();
}