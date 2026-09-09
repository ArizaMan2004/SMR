// @/lib/services/documento-renglones.ts
//
// CÓMO SE ESCRIBE UN RENGLÓN EN UN DOCUMENTO.
//
// El mismo trabajo se imprime desde cinco sitios —la tabla de órdenes, el
// estado de cuenta, el presupuesto, la venta de catálogo— y cada uno armaba el
// renglón a su manera. Eso significa que el mismo banner salía distinto según
// por dónde se pidiera el PDF, y que arreglar algo había que arreglarlo cinco
// veces. Aquí se decide una sola vez.
//
// LAS TRES REGLAS
//
// 1. LA CANTIDAD ES CUÁNTAS PIEZAS SON, no metros.
//
//    Se ponía "1 m²" cuando en la orden hay UNA pieza. El número era el de
//    piezas y la etiqueta era de área: dos impresiones que juntas dan un metro
//    salían como "2 m²", que se lee como dos metros. La columna ya se titula
//    "Cantidad", así que va el número solo.
//
// 2. EL PRECIO UNITARIO ES LO QUE CUESTA UNA PIEZA, no el metro cuadrado.
//
//    Un banner de 50×80 a $15/m² salía con "P. unitario $15,00" e "Importe
//    $6,00". El cliente lee que le cobran quince y le suman seis, y llama a
//    preguntar. Lo que quiere saber es cuánto vale una pieza.
//
// 3. LA MEDIDA SE ESCRIBE.
//
//    Sin ella "Banner — $6,00" no se puede comprobar ni reclamar, y el precio
//    por metro, que es la información que se perdió en la regla 2, deja de
//    hacer falta: con la medida y el importe se saca solo.

/** Lo que entiende el documento. */
export interface RenglonDocumento {
    descripcion: string;
    cantidad: number;
    /** "50 × 80 cm". Vacío si el renglón no se mide. */
    medida?: string;
    precioUnitario: number;
    total: number;
    grupo?: string;
}

/** Lo que trae cualquiera de los cinco sitios, con los nombres que use cada uno. */
export interface ItemCrudo {
    descripcion?: string;
    cantidad?: number;
    /** Los ítems de orden y presupuesto los llaman así. */
    medidaXCm?: number;
    medidaYCm?: number;
    /** Las ventas de catálogo, así. */
    cmAncho?: number;
    cmAlto?: number;
    total: number;
    grupo?: string;
}

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * "50 × 80 cm", o vacío si no hay medida.
 *
 * Sin decimales cuando son enteros: "50 × 80" y no "50.00 × 80.00", que en una
 * hoja impresa es ruido.
 */
export const medidaLegible = (anchoCm?: number, altoCm?: number): string => {
    const a = num(anchoCm);
    const b = num(altoCm);
    if (a <= 0 || b <= 0) return "";
    // Coma decimal, como el resto del documento: "83,01 x 19,56" al lado de
    // "$1,95". Mezclar los dos separadores en la misma hoja se lee como un
    // error de la hoja, no como una convencion.
    const limpio = (n: number) =>
        Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
    return `${limpio(a)} × ${limpio(b)} cm`;
};

/**
 * ¿La descripción ya trae la medida escrita a mano?
 *
 * El nombre del renglón lo teclea una persona, y hay quien escribe "Banner
 * 50x80". Repetirla debajo queda mal y hace dudar de cuál es la buena.
 */
const yaLaDice = (texto: string, anchoCm?: number, altoCm?: number): boolean => {
    const a = num(anchoCm);
    const b = num(altoCm);
    if (a <= 0 || b <= 0) return false;
    // Se ignoran espacios y el separador: "50x80", "50 × 80", "50 X 80 cm".
    const plano = texto.toLowerCase().replace(/\s+/g, "");
    return plano.includes(`${a}x${b}`) || plano.includes(`${a}×${b}`)
        || plano.includes(`${b}x${a}`) || plano.includes(`${b}×${a}`);
};

/** Convierte un ítem de donde sea en el renglón que se imprime. */
export const renglonDeDocumento = (item: ItemCrudo): RenglonDocumento => {
    const descripcion = String(item.descripcion || "").trim() || "—";
    const total = num(item.total);

    // Piezas, nunca cero: un renglón sin cantidad es una pieza, y dividir
    // entre cero dejaría el precio unitario en Infinity.
    const cantidad = Math.max(num(item.cantidad), 0);
    const piezas = cantidad > 0 ? cantidad : 1;

    const ancho = item.medidaXCm ?? item.cmAncho;
    const alto = item.medidaYCm ?? item.cmAlto;
    const medida = yaLaDice(descripcion, ancho, alto) ? "" : medidaLegible(ancho, alto);

    return {
        descripcion,
        cantidad: piezas,
        ...(medida ? { medida } : {}),
        precioUnitario: total / piezas,
        total,
        ...(item.grupo ? { grupo: item.grupo } : {}),
    };
};
