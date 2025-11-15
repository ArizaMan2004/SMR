// @/lib/services/pdf-generator.ts
"use client";

import type { OrdenServicio } from "@/lib/types/orden";
import { formatCurrency, formatDate } from "@/lib/utils/order-utils";

// --- HELPER PARA CARGA DINÁMICA DE PDFMAKE (FIX ROBUSTO) ---
async function loadPdfDependencies() {
    if (typeof window === 'undefined') {
        return null; 
    }
    
    // Carga dinámica de las librerías
    const [pdfMakeImport, pdfFontsImport] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts'),
    ]);

    // Obtener los objetos principales (verificando .default)
    const pdfMake = pdfMakeImport.default || pdfMakeImport;
    const pdfFontsModule = pdfFontsImport.default || pdfFontsImport;

    let vfsObject = null;

    // Lógica robusta para encontrar el objeto VFS
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
        console.error("Error: Estructura de pdfFonts/vfs_fonts no encontrada. No se pudo inicializar pdfmake.vfs.");
        return null;
    }
    
    // Configuración de fuentes (mantenida del original)
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

// --- CONSTANTES ---
const PRECIO_LASER_POR_MINUTO = 0.8;
const NOTAS_LEGALES = [
  "LOS PRECIOS NO INCLUYEN IVA, SOLO FACTURA NOTA DE ENTREGA.",
  "TIEMPO DE ELABORACIÓN 5 DÍAS A PARTIR DE LA ENTREGA DE LA INICIAL",
  "FORMA DE PAGO 60% PARA INICIAR 40% EL FINALIZAR",
];
const FALLBACK_LOGO_PRINCIPAL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwAChwGAf60MhQAAAABJRU5ErkJggg==";

// --- INTERFACES GLOBALES ---
export interface PDFOptions {
  bcvRate?: number;
  firmaBase64?: string;
  selloBase64?: string;
}

// 🔑 INTERFACES SIMPLIFICADAS PARA PRESUPUESTO
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


// --- FUNCIONES Y LÓGICA DE CÁLCULO ORIGINALES ---

/**
 * 🔹 Calcula el subtotal de un ítem (Lógica para Corte Láser).
 */
const calculateItemSubtotal = (item: any): number => {
  const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item;

  const finalCantidad = cantidad || 0;
  const finalPrecio = precioUnitario || 0;

  if (unidad === "und") {
    return finalCantidad * finalPrecio;
  } else if (unidad === "m2") {
    if (medidaXCm && medidaYCm) {
      const areaM2 = (medidaXCm / 100) * (medidaYCm / 100);
      return areaM2 * finalPrecio * finalCantidad;
    }
  } else if (unidad === "tiempo") {
    if (tiempoCorte) {
      const [minutesStr, secondsStr] = tiempoCorte.split(":");
      const minutes = parseInt(minutesStr) || 0;
      const seconds = parseInt(secondsStr) || 0;

      const totalMinutes = minutes + seconds / 60;
      return totalMinutes * PRECIO_LASER_POR_MINUTO * finalCantidad;
    }
  }
  return 0;
};


// --- LÓGICA DE TABLAS ORIGINAL (Reutilizada) ---

const emptySpacerCell = {
    text: " ",
    margin: [0, 8, 0, 8],
};

const emptyRows = [[emptySpacerCell, "", ""], [emptySpacerCell, "", ""]];

const customTableLayout = {
    hLineWidth: function (i: number, node: any) {
        return i === 0 || i === node.table.body.length ? 1 : 1;
    },
    vLineWidth: function (i: number, node: any) {
        return i === 0 || i === node.table.widths.length ? 1 : 1;
    },
    hLineColor: function (i: number, node: any) {
        return "black";
    },
    vLineColor: function (i: number, node: any) {
        return "black";
    },
    fillColor: function (i: number, node: any) {
        return i === 0 ? "#EEEEEE" : null;
    },
    paddingLeft: function (i: number, node: any) {
        return 8;
    },
    paddingRight: function (i: number, node: any) {
        return 8;
    },
    paddingTop: function (i: number, node: any) {
        return 6;
    },
    paddingBottom: function (i: number, node: any) {
        return 6;
    },
};


// --- BLOQUE DE FIRMA Y SELLO ORIGINAL (Reutilizado) ---
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
                        alignment: "center",
                        stack: [
                            firmaBase64
                                ? {
                                    image: firmaBase64,
                                    width: 120,
                                    height: 40,
                                    alignment: "center",
                                    margin: [0, 0, 0, 0],
                                }
                                : { text: " ", margin: [0, 0, 0, 0] }, 
                            {
                                canvas: [
                                    {
                                        type: "line",
                                        x1: 0,
                                        y1: 0,
                                        x2: 120,
                                        y2: 0,
                                        lineWidth: 1,
                                        lineColor: "black",
                                    },
                                ],
                                margin: [0, 2, 0, 0],
                            },
                            { text: "JOSUE LEAL", style: "contactName", margin: [0, 5, 0, 0] },
                            { text: `C.I: 19448046`, style: "contactInfo" },
                            { text: `Cel. 04246118494`, style: "contactInfo" },
                        ],
                    },

                    {
                        width: "*",
                        alignment: "right",
                        stack: [
                            ...(selloBase64
                                ? [
                                    {
                                        image: selloBase64,
                                        width: 150,
                                        height: 150,
                                        alignment: "right",
                                        margin: [0, 5, 0, 0],
                                    },
                                ]
                                : []),
                        ],
                    },
                ],
                columnGap: 10,
            },
            
            { width: "*", text: "" },
        ],
        margin: [0, 0, 0, 0],
    },
]);


// --- FUNCIÓN 1: GENERACIÓN DE ORDEN DE SERVICIO PDF (SIN CAMBIOS EN EL TÍTULO) ---
/**
 * 🔹 Genera el documento PDF de la orden de servicio.
 */
export async function generateOrderPDF(
  orden: OrdenServicio,
  SMRLogoBase64: string,
  options: PDFOptions = {}
) {
  const pdfMake = await loadPdfDependencies();
  if (!pdfMake) return;

  const { bcvRate = 1, firmaBase64, selloBase64 } = options;

  const totalUSD = orden.totalUSD;
  const totalVES = totalUSD * bcvRate;
    
  const itemRows = orden.items.map((item) => {
    const itemAny = item as any;
    const subtotal = calculateItemSubtotal(itemAny);

    let medidasTiempoDisplay = "";
    if (itemAny.unidad === "tiempo" && itemAny.tiempoCorte) {
      medidasTiempoDisplay = `Tiempo de Corte:\n ${itemAny.tiempoCorte}`;
    } else if (itemAny.unidad === "m2" && itemAny.medidaXCm && itemAny.medidaYCm) {
      const areaM2 = (itemAny.medidaXCm / 100) * (itemAny.medidaYCm / 100);
      medidasTiempoDisplay = `${itemAny.medidaXCm}cm x ${itemAny.medidaYCm}cm\n ${areaM2.toFixed(
        2
      )} m²`;
    } else {
      medidasTiempoDisplay = "N/A";
    }

    const material = itemAny.materialDetalleCorte || itemAny.materialDeImpresion;

    let descripcionDisplay = itemAny.nombre;
    if (material && material.trim() !== "") {
      descripcionDisplay += `\n(${material})`;
    }

    return [
      { text: itemAny.cantidad, alignment: "left", style: "itemText" },
      { text: descripcionDisplay, style: "itemText" },
      { text: medidasTiempoDisplay, alignment: "center", style: "itemText" },
      { text: formatCurrency(subtotal), alignment: "right", style: "itemTotal" },
    ];
  });


  const signatureBlockContent = getSignatureBlockContent(firmaBase64, selloBase64);

  const docDefinition = {
    pageSize: "LETTER",
    content: [
      {
        text: `${orden.cliente.ciudad || "Santa Ana de Coro"}, ${formatDate(
          orden.fecha
        )}`,
        style: "dateInfo",
        alignment: "right",
        margin: [0, 0, 0, 5],
      },

      {
        image: SMRLogoBase64 || FALLBACK_LOGO_PRINCIPAL,
        width: 150,
        alignment: "left",
        margin: [0, 0, 0, 10],
      },

      {
        text: "PRESUPUESTO", // Título ya es "PRESUPUESTO"
        style: "title",
        alignment: "center",
        margin: [0, 0, 0, 10],
      },

      {
        text: `Cliente: ${
          orden.cliente.nombreRazonSocial || orden.cliente.rifCedula || "N/A"
        }`,
        style: "clientInfo",
        alignment: "left",
        margin: [0, 0, 0, 15],
      },

      {
        style: "itemsTable",
        table: {
          headerRows: 1,
          // Ancho de Cantidad: 55
          widths: [55, "*", 100, 70],
          body: [
            [
              { text: "Cantidad", style: "tableHeader", alignment: "left" },
              { text: "Descripción", style: "tableHeader" },
              { text: "Medidas / Tiempo", style: "tableHeader", alignment: "center" },
              { text: "Monto (USD)", style: "tableHeader", alignment: "right" },
            ],
            ...itemRows,
            ...emptyRows,
            [
              {
                text: "TOTAL",
                style: "finalTotalLabelBig",
                alignment: "right",
                colSpan: 3,
              },
              {},
              {},
              { text: formatCurrency(totalUSD), style: "finalTotalValueBig", alignment: "right" },
            ],
          ],
        },
        layout: customTableLayout,
        margin: [0, 5, 0, 15],
      },

      {
        columns: [
          {
            width: "50%",
            text: `Tasa BCV Referencial: 1 USD = ${formatCurrency(bcvRate)} VES`,
            style: "bcvRate",
            margin: [0, 0, 0, 10],
          },
          {
            width: "50%",
            alignment: "right",
            text: `Total en Bolívares: ${formatCurrency(totalVES)} VES`,
            style: "totalVesRef",
            margin: [0, 0, 0, 10],
          },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 15],
      },

      {
        stack: [
          { text: "NOTA:", style: "notesHeader", margin: [0, 0, 0, 5] },
          {
            ul: NOTAS_LEGALES,
            fontSize: 9,
            margin: [5, 0, 0, 20],
          },
        ],
        alignment: "left",
      },

      ...signatureBlockContent,
    ],

    styles: {
      title: { fontSize: 16, bold: true, color: "#333333" },
      clientInfo: { fontSize: 10, bold: true, color: "#333333" },
      dateInfo: { fontSize: 10, color: "#333333" },

      tableHeader: { bold: true, fontSize: 10, color: "black", fillColor: "#EEEEEE" },
      itemsTable: { margin: [0, 5, 0, 5] },
      itemText: { fontSize: 9, bold: true }, 
      itemTotal: { fontSize: 9, bold: true },

      finalTotalLabelBig: { fontSize: 13, bold: true, color: "#000000", alignment: "right" },
      finalTotalValueBig: { fontSize: 14, bold: true, color: "#007bff", alignment: "right" },

      bcvRate: { fontSize: 9, bold: false, color: "#666666" },
      totalVesRef: { fontSize: 11, bold: false, color: "#666666" },

      notesHeader: { fontSize: 11, bold: true, color: "#333333" },
      farewellText: { fontSize: 9, italics: true, color: "#333333" },
      contactName: { fontSize: 10, bold: true, color: "#333333", margin: [0, 5, 0, 0] },
      contactInfo: { fontSize: 9, color: "#666666" },
    },
    defaultStyle: {
      font: "Roboto",
    },
  };

  pdfMake.createPdf(docDefinition).open();
}


// --- FUNCIÓN 2: GENERACIÓN DE PRESUPUESTO PDF (TÍTULO MODIFICADO) ---
/**
 * 🔹 Genera el documento PDF del presupuesto con la tabla corregida y interfaces simplificadas.
 */
export async function generateBudgetPDF( 
    budgetData: BudgetData,
    SMRLogoBase64: string,
    options: PDFOptions = {}
) {
    const pdfMake = await loadPdfDependencies();
    if (!pdfMake) return; 
    
    const { bcvRate = 1, firmaBase64, selloBase64 } = options;
    
    const totalUSD = budgetData.totalUSD;
    const totalVES = totalUSD * bcvRate;
    
    // Se usa la interfaz BudgetItem simplificada. Se elimina item.precioUnitarioUSD
    const itemRows = budgetData.items.map((item) => ([
        { text: item.cantidad, alignment: "left", style: "itemText" },
        { text: item.descripcion, style: "itemText" },
        { text: formatCurrency(item.totalUSD), alignment: "right", style: "itemTotal" },
    ]));
    
    const signatureBlockContent = getSignatureBlockContent(firmaBase64, selloBase64);
    
    // Se usa la interfaz BudgetData simplificada (sin subtotal, sin nota)
    const docDefinition = {
        pageSize: "LETTER",
        content: [
            {
                text: `${budgetData.fechaCreacion}`, 
                style: "dateInfo",
                alignment: "right",
                margin: [0, 0, 0, 5],
            },

            {
                image: SMRLogoBase64 || FALLBACK_LOGO_PRINCIPAL,
                width: 150,
                alignment: "left",
                margin: [0, 0, 0, 10],
            },

            {
                // 🛠️ Cambiado de budgetData.titulo.toUpperCase() a "PRESUPUESTO"
                text: "PRESUPUESTO", 
                style: "title",
                alignment: "center",
                margin: [0, 0, 0, 10],
            },

            {
                text: `Cliente: ${budgetData.clienteNombre || budgetData.clienteCedula || "N/A"}`,
                style: "clientInfo",
                alignment: "left",
                margin: [0, 0, 0, 15],
            },

            {
                style: "itemsTable",
                table: {
                    headerRows: 1,
                    // Ancho de Cantidad: 55
                    widths: [55, "*", 70], 
                    body: [
                        [
                            { text: "Cantidad", style: "tableHeader", alignment: "left" },
                            { text: "Descripción", style: "tableHeader" },
                            // Se eliminó la columna "Precio Unit. (USD)"
                            { text: "Total (USD)", style: "tableHeader", alignment: "right" }, 
                        ],
                        ...itemRows,
                        ...emptyRows,
                        [
                            {
                                text: "TOTAL",
                                style: "finalTotalLabelBig",
                                alignment: "right",
                                // colSpan ajustado a 2 para abarcar Cantidad y Descripción
                                colSpan: 2, 
                            },
                            {}, 
                            { text: formatCurrency(totalUSD), style: "finalTotalValueBig", alignment: "right" },
                        ],
                    ],
                },
                layout: customTableLayout,
                margin: [0, 5, 0, 15],
            },
            
            // Sección de Totales en Bs
            {
                columns: [
                    {
                        width: "50%",
                        text: `Tasa BCV Referencial: 1 USD = ${formatCurrency(bcvRate)} VES`,
                        style: "bcvRate",
                        margin: [0, 0, 0, 10],
                    },
                    {
                        width: "50%",
                        alignment: "right",
                        text: `Total en Bolívares: ${formatCurrency(totalVES)} VES`,
                        style: "totalVesRef",
                        margin: [0, 0, 0, 10],
                    },
                ],
                columnGap: 10,
                margin: [0, 0, 0, 15],
            },

            // Notas Legales
            {
                stack: [
                    { text: "NOTA:", style: "notesHeader", margin: [0, 0, 0, 5] },
                    {
                        ul: NOTAS_LEGALES,
                        fontSize: 9,
                        margin: [5, 0, 0, 20],
                    },
                ],
                alignment: "left",
            },

            // Bloque de Firma y Sello
            ...signatureBlockContent,
        ],

        // ESTILOS REUTILIZADOS DEL CÓDIGO ORIGINAL
        styles: {
            title: { fontSize: 16, bold: true, color: "#333333" },
            clientInfo: { fontSize: 10, bold: true, color: "#333333" },
            dateInfo: { fontSize: 10, color: "#333333" },

            tableHeader: { bold: true, fontSize: 10, color: "black", fillColor: "#EEEEEE" },
            itemsTable: { margin: [0, 5, 0, 5] },
            itemText: { fontSize: 9, bold: true }, 
            itemTotal: { fontSize: 9, bold: true },

            finalTotalLabelBig: { fontSize: 13, bold: true, color: "#000000", alignment: "right" },
            finalTotalValueBig: { fontSize: 14, bold: true, color: "#007bff", alignment: "right" },

            bcvRate: { fontSize: 9, bold: false, color: "#666666" },
            totalVesRef: { fontSize: 11, bold: false, color: "#666666" },

            notesHeader: { fontSize: 11, bold: true, color: "#333333" },
            farewellText: { fontSize: 9, italics: true, color: "#333333" },
            contactName: { fontSize: 10, bold: true, color: "#333333", margin: [0, 5, 0, 0] },
            contactInfo: { fontSize: 9, color: "#666666" },
        },
        defaultStyle: {
            font: "Roboto",
        },
    };

    // Usamos .open() para mostrar el PDF en una nueva pestaña.
    pdfMake.createPdf(docDefinition).open();
}