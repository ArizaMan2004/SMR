// @/lib/services/compras-lote-service.ts
//
// LO QUE SE COMPRA, POR LOTES.
//
// Hasta ahora una compra se apuntaba en tres sitios que no se hablaban:
//
//   Insumos y Materiales   el dinero que salió            (y nada más)
//   Catálogo → Stock       las unidades, tecleadas a mano (sin decir de dónde)
//   Catálogo → Costo       lo que costó el ÚLTIMO lote    (el anterior se pisa)
//
// Así no se podía responder a lo que de verdad se pregunta: cuánto me costó
// cada termo de esta caja, cuántas tintas me quedan de cada una, si la tinta me
// subió desde la última vez. Cada dato estaba, pero en un sitio distinto y sin
// relación con los otros.
//
// Aquí la compra es UNA cosa. Se registra una vez y de ella sale todo:
//
//   1. el LOTE queda guardado, con lo que costó cada unidad de ESE lote
//   2. el STOCK del producto sube
//   3. el COSTO del producto pasa a ser el de este lote (para el precio sugerido)
//   4. el GASTO aparece en Insumos, sin tener que apuntarlo aparte
//
// Y las cuatro van en una transacción: o entran todas o ninguna. Un lote
// registrado con el stock sin subir es peor que no registrarlo, porque el
// número de stock parece bueno y no lo es.
//
// SE COMPRA EN UNA UNIDAD Y SE CUENTA EN OTRA
//
// Eso es lo que "por lote" significa de verdad: 1 caja trae 100 termos. La
// caja es como se compra; el termo es como se cuenta y como se vende. Por eso
// el lote guarda las dos cosas —cuántos paquetes y cuántas unidades trae cada
// uno— y el stock se mueve siempre en la unidad del producto (unidad, kilo,
// litro...), nunca en cajas.
//
// LOS ROLLOS SE CUENTAN EN OTRA PARTE
//
// Un rollo de vinil no se saca a medir con cinta métrica cada vez que entra
// uno: se cuenta, "me llegaron tres". Pero ese conteo no es de aquí. El rollo
// es materia prima —no se vende— y vive en el depósito, en Materia Prima. Esta
// ficha es la de venta; sumar los rollos en los dos sitios dejaría dos números
// distintos y ninguno de fiar.
//
// Lo que sí se queda de una compra de rollos es la CUENTA DEL PRECIO: con el
// ancho y los metros sale a cómo queda el m², y con eso se puede decir cuánto
// se gana con el precio que ya está puesto.

import { db } from "@/lib/firebase";
import {
    collection, doc, onSnapshot, orderBy, query, runTransaction, where,
    Timestamp, serverTimestamp,
} from "firebase/firestore";
import { unidadDe, type CatalogoProducto, type UnidadVenta } from "@/lib/services/catalog-service";

const LOTES_COL = "compras_lote";
const PROD_COL = "catalogo_productos";
const GASTOS_COL = "gastos_insumos";

export interface CompraLote {
    id?: string;
    productoId: string;
    /** Copiado al comprar: si el producto se renombra, el lote sigue legible. */
    productoNombre: string;
    varianteId?: string | null;
    varianteNombre?: string | null;

    /** Cómo vino: "caja", "bulto", "galón". Texto libre, es para leerlo. */
    presentacion: string;
    /** Cuántas cajas/bultos. */
    paquetes: number;
    /** Cuántas unidades trae cada paquete. */
    unidadesPorPaquete: number;
    /** paquetes × unidadesPorPaquete: lo que entra al stock. */
    unidadesTotales: number;
    /** En qué se cuentan esas unidades. */
    unidad: UnidadVenta;

    /**
     * Si lo que llegó fueron rollos: el ancho en cm y los metros de cada uno.
     *
     * De ahí salió `unidadesPorPaquete`, pero se guardan los dos números como
     * se preguntaron: "137 × 50" se lee, y 68,5 m² hay que creérselo.
     */
    anchoCm?: number;
    metrosRollo?: number;

    montoUSD: number;
    /** Lo que se pagó en bolívares, si se pagó en bolívares. */
    montoBs?: number;
    tasa?: number;
    /** montoUSD / unidadesTotales. Lo que costó CADA unidad de ESTE lote. */
    costoUnitarioUSD: number;

    proveedor?: string;
    nota?: string;
    /** El gasto que se apuntó en Insumos por esta compra. */
    gastoId?: string;
    fecha: any;
    creadoPor?: string;
}

export interface DatosCompra {
    producto: CatalogoProducto;
    varianteId?: string | null;
    presentacion: string;
    paquetes: number;
    /**
     * Unidades de venta que trae cada paquete.
     *
     * Con rollos no se teclea: sale de `anchoCm` y `metrosRollo` con
     * `unidadesDeRollo`, que es la misma cuenta que hace el "¿Precio
     * estimado?" de las demás pantallas.
     */
    unidadesPorPaquete: number;
    /** Ancho del rollo en cm, si lo que se compró fue un rollo. */
    anchoCm?: number;
    /** Metros de largo de cada rollo, si lo que se compró fue un rollo. */
    metrosRollo?: number;
    montoUSD: number;
    tasa?: number;
    proveedor?: string;
    nota?: string;
    /** Margen para el precio sugerido. Sin él se conserva el que ya tenía. */
    margenPct?: number;
    /**
     * Precio de venta nuevo, si se decide cambiarlo con esta compra.
     *
     * Va dentro de la misma transacción: si la compra no entra, el precio
     * tampoco cambia. Sin valor, el precio de venta no se toca — el sugerido
     * es una propuesta, no una orden.
     */
    nuevoPrecioBase?: number;
    creadoPor?: string;
    /** Categoría del gasto en Insumos. */
    categoriaGasto?: "insumos" | "materiales";
}

const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};

/** A cuánto sale cada unidad, redondeado a cuatro decimales. */
export const costoPorUnidad = (montoUSD: number, unidades: number): number =>
    n(unidades) > 0 ? Math.round((n(montoUSD) / n(unidades)) * 10000) / 10000 : 0;

/**
 * Qué está mal en una compra antes de guardarla, o null si está bien.
 *
 * Mejor decirlo aquí que dejar entrar un lote de cero unidades: el costo
 * unitario saldría infinito y el precio sugerido, basura.
 */
export const problemaDeCompra = (d: Partial<DatosCompra>): string | null => {
    if (!d.producto?.id) return "Elige qué producto se compró";
    if (d.producto.tieneVariantes && !d.varianteId) return "Elige de cuál variante";
    if (!(n(d.paquetes) > 0)) return "¿Cuántos paquetes llegaron?";
    if (!(n(d.unidadesPorPaquete) > 0)) {
        // Con rollos ese número no se teclea, sale del ancho y los metros. Decir
        // "faltan las unidades por paquete" señalaría un campo que no existe en
        // esa pantalla, así que se pregunta por el que de verdad está vacío.
        const u = unidadDe(d.producto);
        if (u === "metro_lineal") return "¿Cuántos metros trae el rollo?";
        if (u === "metro_cuadrado") {
            return n(d.metrosRollo) > 0
                ? "¿Cuánto mide de ancho el rollo?"
                : "¿Cuántos metros trae el rollo?";
        }
        return "¿Cuántas unidades trae cada paquete?";
    }
    if (!(n(d.montoUSD) > 0)) return "¿Cuánto costó en total?";
    return null;
};

/**
 * Registra la compra.
 *
 * Todo en una transacción: el lote, el stock, el costo y el gasto. Si
 * cualquiera falla no se guarda ninguno, y el que pulsó se entera.
 */
export const registrarCompra = async (d: DatosCompra): Promise<{ loteId: string; costoUnitarioUSD: number }> => {
    const problema = problemaDeCompra(d);
    if (problema) throw new Error(problema);

    const producto = d.producto;
    const paquetes = n(d.paquetes);
    const porPaquete = n(d.unidadesPorPaquete);
    const unidades = paquetes * porPaquete;
    const monto = n(d.montoUSD);
    const unitario = costoPorUnidad(monto, unidades);
    const tasa = n(d.tasa);

    const unidad: UnidadVenta =
        producto.unidadVenta || (producto.tipoVenta === "metro_cuadrado" ? "metro_cuadrado" : "unidad");
    const variante = (producto.variantes || []).find(v => v.id === d.varianteId);

    const loteRef = doc(collection(db, LOTES_COL));
    const gastoRef = doc(collection(db, GASTOS_COL));
    const prodRef = doc(db, PROD_COL, producto.id!);
    const ahora = Timestamp.now();

    await runTransaction(db, async tx => {
        // Se lee el producto DENTRO de la transacción: si dos personas
        // registran compras a la vez, cada una suma sobre el stock que dejó la
        // otra, no sobre el que había cuando abrió la pantalla.
        const snap = await tx.get(prodRef);
        if (!snap.exists()) throw new Error("Ese producto ya no existe en el catálogo");
        const actual = snap.data() as CatalogoProducto;

        // ---- 2. el stock
        //
        // Los rollos NO se cuentan aquí. Viven en Materia Prima, que es el
        // depósito; esta ficha es la de venta, y un rollo de vinil no se vende.
        // Sumarlos en los dos sitios dejaría dos números distintos y ninguno de
        // fiar. De la compra de un rollo, esta pantalla se queda con lo único
        // que usa para vender: a cómo sale el metro.
        const cambios: Record<string, any> = { updatedAt: serverTimestamp() };
        const deRollo = unidad === "metro_cuadrado" || unidad === "metro_lineal";
        if (!deRollo) {
            if (actual.tieneVariantes && d.varianteId) {
                cambios.variantes = (actual.variantes || []).map(v =>
                    v.id === d.varianteId ? { ...v, stock: n(v.stock) + unidades } : v
                );
            } else {
                cambios.stockSimple = n(actual.stockSimple) + unidades;
            }
        }

        // ---- 3. el costo pasa a ser el de este lote
        //
        // El margen se conserva si no se da uno nuevo: quien lo puso sabía por
        // qué, y comprar otra caja no es motivo para olvidarlo.
        //
        // Con rollos se guarda lo que costó UN rollo, no la compra entera.
        //
        // La ficha del producto habla de uno solo —"costó el rollo", "trae 50
        // metros"—, así que si aquí se guardara el total, al abrirla se vería
        // el monto de tres rollos junto a las medidas de uno y el costo por m²
        // saldría por las nubes. El costo unitario es el mismo de las dos
        // formas; lo que cambia es que así la ficha se puede leer.
        const porRollo = n(d.metrosRollo) > 0;
        cambios.costo = {
            montoLoteUSD: porRollo ? Math.round((monto / paquetes) * 10000) / 10000 : monto,
            unidadesLote: porRollo ? porPaquete : unidades,
            margenPct: d.margenPct != null ? n(d.margenPct) : n(actual.costo?.margenPct),
            // Y las medidas, para que la ficha pueda volver a enseñar
            // "137 × 50" en vez de un 68,5 sin explicación.
            ...(porRollo && n(d.anchoCm) > 0 ? { anchoCm: n(d.anchoCm) } : {}),
            ...(porRollo ? { metrosRollo: n(d.metrosRollo) } : {}),
            actualizadoEn: new Date().toISOString(),
        };
        if (n(d.nuevoPrecioBase) > 0) cambios.precioBase = n(d.nuevoPrecioBase);
        tx.update(prodRef, cambios);

        // ---- 4. el gasto, con la forma que ya lee Insumos
        const nombreGasto = [
            producto.nombre,
            variante?.nombre,
        ].filter(Boolean).join(" — ");
        tx.set(gastoRef, {
            nombre: `${nombreGasto} (${paquetes} ${d.presentacion || "paq."})`,
            descripcion: [
                porRollo
                    // "1,37 × 50 m" se reconoce al leer el gasto; "68,5" no.
                    ? `${paquetes} de ${n(d.anchoCm) > 0 ? `${(n(d.anchoCm) / 100).toFixed(2)} × ` : ""}${n(d.metrosRollo)} m · ${unidades} ${unidad === "metro_lineal" ? "m.l." : "m²"} a $${unitario.toFixed(4)} c/u`
                    : `${unidades} unidades a $${unitario.toFixed(4)} c/u`,
                d.proveedor ? `Proveedor: ${d.proveedor}` : "",
                d.nota || "",
            ].filter(Boolean).join(" · "),
            monto,
            montoBs: tasa > 0 ? Math.round(monto * tasa * 100) / 100 : 0,
            tasaDolar: tasa,
            categoria: d.categoriaGasto || "insumos",
            estado: "pagado",
            loteId: loteRef.id,
            productoId: producto.id,
            fecha: ahora,
            createdAt: ahora,
            updatedAt: ahora,
        });

        // ---- 1. el lote
        const lote: Omit<CompraLote, "id"> = {
            productoId: producto.id!,
            productoNombre: producto.nombre,
            varianteId: d.varianteId || null,
            varianteNombre: variante?.nombre || null,
            presentacion: d.presentacion || "",
            paquetes,
            unidadesPorPaquete: porPaquete,
            unidadesTotales: unidades,
            unidad,
            ...(porRollo && n(d.anchoCm) > 0 ? { anchoCm: n(d.anchoCm) } : {}),
            ...(porRollo ? { metrosRollo: n(d.metrosRollo) } : {}),
            montoUSD: monto,
            ...(tasa > 0 ? { tasa, montoBs: Math.round(monto * tasa * 100) / 100 } : {}),
            costoUnitarioUSD: unitario,
            ...(d.proveedor ? { proveedor: d.proveedor.trim() } : {}),
            ...(d.nota ? { nota: d.nota.trim() } : {}),
            gastoId: gastoRef.id,
            fecha: ahora,
            ...(d.creadoPor ? { creadoPor: d.creadoPor } : {}),
        };
        tx.set(loteRef, lote);
    });

    return { loteId: loteRef.id, costoUnitarioUSD: unitario };
};

/** Los lotes, del más nuevo al más viejo. Con producto, solo los suyos. */
export const subscribeToLotes = (
    cb: (lotes: CompraLote[]) => void,
    productoId?: string
) => {
    const base = collection(db, LOTES_COL);
    const q = productoId
        ? query(base, where("productoId", "==", productoId))
        : query(base, orderBy("fecha", "desc"));

    return onSnapshot(
        q,
        snap => {
            const lotes = snap.docs.map(d => ({ ...(d.data() as CompraLote), id: d.id }));
            // Con filtro por producto no se pide orden al servidor —haría
            // falta un índice compuesto que no existe— y se ordena aquí.
            if (productoId) {
                lotes.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
            }
            cb(lotes);
        },
        err => {
            console.error("No se pudieron leer los lotes:", err);
            cb([]);
        }
    );
};

export interface ResumenLotes {
    lotes: number;
    unidadesCompradas: number;
    gastadoUSD: number;
    /** Lo que costó una unidad, ponderado por cuántas trajo cada lote. */
    costoPromedioUSD: number;
    ultimoUSD: number;
    /** Variación del último lote frente al anterior, en %. Null si no hay dos. */
    variacionPct: number | null;
}

/**
 * Lo que dicen los lotes de un producto juntos.
 *
 * El promedio es PONDERADO: un lote de 100 a $2 y otro de 10 a $5 no dan
 * $3,50 de media, dan $2,27. La media simple haría creer que la unidad cuesta
 * mucho más de lo que costó casi todo lo que se compró.
 */
export const resumenLotes = (lotes: CompraLote[]): ResumenLotes => {
    const unidades = lotes.reduce((t, l) => t + n(l.unidadesTotales), 0);
    const gastado = lotes.reduce((t, l) => t + n(l.montoUSD), 0);
    const [ultimo, anterior] = lotes; // ya vienen del más nuevo al más viejo

    return {
        lotes: lotes.length,
        unidadesCompradas: unidades,
        gastadoUSD: Math.round(gastado * 100) / 100,
        costoPromedioUSD: costoPorUnidad(gastado, unidades),
        ultimoUSD: n(ultimo?.costoUnitarioUSD),
        variacionPct:
            ultimo && anterior && n(anterior.costoUnitarioUSD) > 0
                ? Math.round(((n(ultimo.costoUnitarioUSD) / n(anterior.costoUnitarioUSD)) - 1) * 1000) / 10
                : null,
    };
};
