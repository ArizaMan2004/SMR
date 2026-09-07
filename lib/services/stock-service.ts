// @/lib/services/stock-service.ts
//
// DESCONTAR DEL INVENTARIO AL FACTURAR.
//
// Hasta ahora el stock del catálogo solo bajaba si alguien lo editaba a mano,
// así que el número de la ficha y las cajas del estante llevaban meses sin
// parecerse. Cuando se factura un llavero, ese llavero ya no está.
//
// QUÉ SE DESCUENTA Y QUÉ NO
//
// Se descuenta lo que se cuenta: la mercancía que se vende por piezas. No se
// descuentan los materiales por metro — el vinil y el banner salen de rollos
// enteros y ese recuento se lleva a mano, como pidió el taller: en la máquina
// se pierde en refilados, pruebas y sobrantes, y un descuento automático daría
// un número exacto que sería mentira.
//
// SE HACE UNA SOLA VEZ
//
// Una orden se guarda, se edita y se vuelve a guardar. Sin marca, cada
// guardado volvería a descontar y el inventario se iría a números negativos.
// Por eso la orden queda marcada, y el descuento se salta si ya lleva la marca.

import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, increment } from "firebase/firestore";

import { tipoEntradaDe, unidadDe, type CatalogoProducto } from "@/lib/services/catalog-service";

const PROD_COL = "catalogo_productos";

export interface MovimientoStock {
    productoId: string;
    productoNombre: string;
    cantidad: number;
    /** El stock que queda tras descontar, para poder avisar. */
    quedan: number;
}

export interface ResultadoDescuento {
    movimientos: MovimientoStock[];
    /** Los que se quedaron por debajo de su mínimo. */
    bajoMinimo: MovimientoStock[];
    /** Los que quedaron en negativo: se vendió más de lo que decía haber. */
    enNegativo: MovimientoStock[];
    /** Renglones que apuntaban a un producto que ya no existe. */
    noEncontrados: string[];
}

/** ¿A este producto le baja el stock cuando se vende? */
export const descuentaStock = (p?: CatalogoProducto): boolean => {
    if (!p) return false;
    // Lo que se mide en metros sale de un rollo: recuento manual.
    const u = unidadDe(p);
    if (u === "metro_cuadrado" || u === "metro_lineal") return false;
    // Un servicio no tiene existencias.
    return tipoEntradaDe(p) === "producto";
};

/**
 * Descuenta del inventario lo vendido en una orden.
 *
 * Usa `increment`, que es atómico en el servidor: dos cajas facturando a la
 * vez el último llavero no pueden leer ambas "queda 1" y dejarlo en 0 en vez
 * de en -1. El negativo se reporta, que es la señal de que el conteo físico
 * estaba mal, en vez de esconderlo.
 */
export async function descontarStockDeOrden(
    items: any[],
    productos: CatalogoProducto[]
): Promise<ResultadoDescuento> {
    const salida: ResultadoDescuento = {
        movimientos: [], bajoMinimo: [], enNegativo: [], noEncontrados: [],
    };

    // Varios renglones pueden vender el mismo producto: se suman antes de
    // escribir, para no mandar dos operaciones al mismo documento en un lote.
    const porProducto = new Map<string, number>();

    (items || []).forEach(item => {
        const id = item?.catalogoProductoId || item?.materialAuditado?.productoId;
        if (!id) return;
        const prod = productos.find(p => p.id === id);
        if (!prod) { salida.noEncontrados.push(item?.nombre || "renglón sin nombre"); return; }
        if (!descuentaStock(prod)) return;

        const cantidad = Number(item?.cantidad) || 0;
        if (cantidad <= 0) return;
        porProducto.set(id, (porProducto.get(id) || 0) + cantidad);
    });

    if (porProducto.size === 0) return salida;

    const lote = writeBatch(db);
    porProducto.forEach((cantidad, id) => {
        lote.update(doc(db, PROD_COL, id), { stockSimple: increment(-cantidad) });
    });
    await lote.commit();

    // Se relee para poder avisar con el número real, no con el que teníamos.
    for (const [id, cantidad] of porProducto) {
        const prod = productos.find(p => p.id === id)!;
        const snap = await getDoc(doc(db, PROD_COL, id));
        const quedan = Number((snap.data() as any)?.stockSimple) || 0;
        const mov: MovimientoStock = { productoId: id, productoNombre: prod.nombre, cantidad, quedan };

        salida.movimientos.push(mov);
        if (quedan < 0) salida.enNegativo.push(mov);
        else if (quedan <= (Number(prod.stockMinimo) || 0)) salida.bajoMinimo.push(mov);
    }

    return salida;
}

/**
 * Devuelve al inventario lo de una orden anulada.
 *
 * Sin esto, anular una orden dejaba el stock descontado para siempre y la
 * única forma de arreglarlo era editar la ficha a mano.
 */
export async function devolverStockDeOrden(
    items: any[],
    productos: CatalogoProducto[]
): Promise<number> {
    const porProducto = new Map<string, number>();

    (items || []).forEach(item => {
        const id = item?.catalogoProductoId || item?.materialAuditado?.productoId;
        if (!id) return;
        const prod = productos.find(p => p.id === id);
        if (!prod || !descuentaStock(prod)) return;
        const cantidad = Number(item?.cantidad) || 0;
        if (cantidad > 0) porProducto.set(id, (porProducto.get(id) || 0) + cantidad);
    });

    if (porProducto.size === 0) return 0;

    const lote = writeBatch(db);
    porProducto.forEach((cantidad, id) => {
        lote.update(doc(db, PROD_COL, id), { stockSimple: increment(cantidad) });
    });
    await lote.commit();

    return porProducto.size;
}
