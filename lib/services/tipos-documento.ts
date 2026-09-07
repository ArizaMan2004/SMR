// @/lib/services/tipos-documento.ts
//
// QUÉ LLEVA CADA TIPO DE DOCUMENTO.
//
// Tres papeles con la misma hoja: presupuesto, nota de entrega y factura. Lo
// que cambia entre ellos no es el diseño, es lo que dicen y lo que la ley les
// exige, y eso vive aquí para que la hoja solo tenga que dibujar.
//
// La leyenda del pie no es decoración: una nota de entrega que no diga que no
// genera crédito fiscal se puede confundir con una factura, y esa confusión la
// paga el cliente cuando su contador la rechaza.
//
// AVISO: esto cubre la estructura del documento. La validez fiscal depende
// además de trámites que no son código —imprenta autorizada, correlativos
// declarados, y la revisión de un contador— y nada de esto sustituye esa
// asesoría.

export type TipoImpreso = "PRESUPUESTO" | "NOTA_DE_ENTREGA" | "FACTURA";

export const TIPOS: { id: TipoImpreso; titulo: string; explicacion: string }[] = [
    {
        id: "PRESUPUESTO",
        titulo: "Presupuesto",
        explicacion: "Lo que le pasas al cliente mientras decide. No es una venta.",
    },
    {
        id: "NOTA_DE_ENTREGA",
        titulo: "Nota de entrega",
        explicacion: "Respalda que el trabajo salió. No traslada IVA.",
    },
    {
        id: "FACTURA",
        titulo: "Factura",
        explicacion: "El documento fiscal, con desglose de impuesto.",
    },
];

export interface ReglasImpreso {
    titulo: string;
    etiquetaNumero: string;
    /** Si se separa la base imponible del impuesto. */
    desglosaIva: boolean;
    /** Si se enseña lo cobrado y lo que queda debiendo. */
    muestraCobros: boolean;
    /** El texto legal del pie. */
    leyenda: string;
    /** Cómo se encabeza al destinatario. */
    etiquetaCliente: string;
    /** Qué se firma en la segunda línea. */
    etiquetaConforme: string;
}

export function reglasDe(tipo: TipoImpreso): ReglasImpreso {
    if (tipo === "PRESUPUESTO") {
        return {
            titulo: "PRESUPUESTO",
            etiquetaNumero: "Presupuesto N°",
            desglosaIva: true,
            muestraCobros: false,
            leyenda: "Este documento no es una factura ni obliga a la entrega.",
            etiquetaCliente: "Señores",
            etiquetaConforme: "Conforme del cliente",
        };
    }

    if (tipo === "NOTA_DE_ENTREGA") {
        return {
            titulo: "NOTA DE ENTREGA",
            etiquetaNumero: "Nota N°",
            // Una nota de entrega no traslada impuesto: desglosarlo sería
            // decir que genera un crédito fiscal que no genera.
            desglosaIva: false,
            muestraCobros: true,
            leyenda: "Este documento no es una factura y no genera crédito fiscal.",
            etiquetaCliente: "Cliente",
            etiquetaConforme: "Recibí conforme",
        };
    }

    return {
        titulo: "FACTURA",
        etiquetaNumero: "Factura N°",
        desglosaIva: true,
        muestraCobros: true,
        leyenda: "Documento emitido conforme a la Providencia SNAT/2011/00071.",
        etiquetaCliente: "Cliente",
        etiquetaConforme: "Recibí conforme",
    };
}

/**
 * Lo que falta para poder emitir este documento.
 *
 * Son avisos para quien factura, nunca salen en el papel. Una factura sin el
 * RIF del cliente no vale, y es mejor decirlo antes de imprimirla que después
 * de que el cliente se haya ido con ella.
 */
export function problemasPara(
    tipo: TipoImpreso,
    emisor: { nombre?: string; rif?: string; direccion?: string },
    cliente: { nombre?: string; documento?: string }
): string[] {
    const avisos: string[] = [];

    if (!emisor.nombre?.trim()) avisos.push("Falta el nombre fiscal de la empresa (Ajustes → Documentos PDF).");
    if (!emisor.rif?.trim()) avisos.push("Falta el RIF de la empresa (Ajustes → Documentos PDF).");
    if (!emisor.direccion?.trim()) avisos.push("Falta la dirección fiscal (Ajustes → Documentos PDF).");
    if (!cliente.nombre?.trim()) avisos.push("El documento no tiene nombre de cliente.");

    if (tipo === "FACTURA" && !cliente.documento?.trim()) {
        avisos.push("Una factura necesita el RIF o la cédula del cliente.");
    }

    return avisos;
}

/** Un nombre de archivo que dice qué es sin abrirlo: tipo, número y cliente. */
export function nombreArchivo(tipo: TipoImpreso, numero: string, cliente: string): string {
    const base =
        tipo === "FACTURA" ? "factura" : tipo === "PRESUPUESTO" ? "presupuesto" : "nota-entrega";
    const nombreCliente = (cliente || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return [base, numero, nombreCliente].filter(Boolean).join("-");
}
