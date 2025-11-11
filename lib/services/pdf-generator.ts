// @/lib/services/pdf-generator.ts
"use client";

import type { OrdenServicio } from "@/lib/types/orden";
import { formatCurrency, formatDate } from "@/lib/utils/order-utils";

// --- CONSTANTES ---
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
}

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

/**
 * 🔹 Genera el documento PDF de la orden de servicio.
 */
export async function generateOrderPDF(
  orden: OrdenServicio,
  SMRLogoBase64: string,
  options: PDFOptions = {}
) {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");

  const pdfMake = pdfMakeModule.default ? pdfMakeModule.default : pdfMakeModule;
  pdfMake.vfs = (pdfFontsModule as any).default || pdfFontsModule;
  pdfMake.fonts = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalics.ttf",
    },
  };

  const { bcvRate = 1, firmaBase64, selloBase64 } = options;

  const totalUSD = orden.totalUSD;
  const totalVES = totalUSD * bcvRate;

  // ... [LÓGICA DE TABLAS (itemRows, emptySpacerCell, emptyRows, customTableLayout) SE MANTIENE] ...
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

  const emptySpacerCell = {
    text: " ",
    margin: [0, 8, 0, 8],
  };

  const emptyRows = [[emptySpacerCell, "", "", ""], [emptySpacerCell, "", "", ""]];

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
  // ... [FIN DE LÓGICA DE TABLAS] ...


  // 🔑 LÓGICA REESTRUCTURADA PARA LA FIRMA Y EL SELLO (Lado a lado, centrado, con línea ABAJO)
  const signatureBlockContent = [
    {
      text: "SIN MAS QUE HACER REFERENCIA...",
      style: "farewellText",
      alignment: "center",
      margin: [0, 20, 0, 30], // Margen inferior aumentado para separar de la firma/sello
    },
    {
      // Usamos columns para colocar la firma y el sello lado a lado y centrar el conjunto
      columns: [
        // Columna 1: Espaciador Izquierdo para centrar
        { width: "*", text: "" },
              { width: "*", text: "" },
                
        // Columna 2: Contenedor Principal (Firma y Sello Lado a Lado)
        {
          width: 250, // Ancho fijo para el contenedor principal (ajusta este valor si es necesario)
          alignment: "center",
          
          columns: [
            // Subcolumna A: Firma (Izquierda)
            {
              width: 150, // Ancho fijo para la firma
              alignment: "center",
              stack: [
                // 1. Imagen de la firma (si existe)
                firmaBase64
                  ? {
                      image: firmaBase64,
                      width: 120,
                      height: 40,
                      alignment: "center",
                      margin: [0, 0, 0, 0],
                    }
                  : { text: " ", margin: [0, 0, 0, 0] }, // Espacio si no hay firma
 // 3. LÍNEA DE FIRMA (ABajo del texto)
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
                  // El margen superior empuja la línea un poco hacia abajo del texto
                  margin: [0, 2, 0, 0], 
                },
                // 2. Información de Contacto (Texto)
                { text: "JOSUE LEAL", style: "contactName", margin: [0, 5, 0, 0] },
                { text: `C.I: 19448046`, style: "contactInfo" },
                { text: `Cel. 04246118494`, style: "contactInfo" },

               
              ],
            },

            // Subcolumna B: Sello (Derecha)
            {
              width: "*", // Ocupa el espacio restante en esta columna
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
          columnGap: 10, // Espacio entre firma y sello
        },
        
        // Columna 3: Espaciador Derecho para centrar
        { width: "*", text: "" },
      ],
      margin: [0, 0, 0, 0],
    },
  ];

  // ... [El resto de docDefinition se mantiene] ...
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
        text: "PRESUPUESTO",
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
          widths: [60, "*", 100, 70],
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

      // 🔑 Insertamos el bloque de firma y sello centrado y reestructurado
      ...signatureBlockContent,
    ],

    styles: {
      title: { fontSize: 16, bold: true, color: "#333333" },
      clientInfo: { fontSize: 10, bold: true, color: "#333333" },
      dateInfo: { fontSize: 10, color: "#333333" },

      tableHeader: { bold: true, fontSize: 10, color: "black", fillColor: "#EEEEEE" },
      itemsTable: { margin: [0, 5, 0, 5] },
      itemText: { fontSize: 9 },
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