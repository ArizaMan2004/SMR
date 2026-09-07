// @/lib/services/catalog-service.ts
import { db } from "@/lib/firebase"
import {
    collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, runTransaction, Timestamp
} from "firebase/firestore"

// ============================================================
// TIPOS
// ============================================================

/**
 * Cómo se mide lo que se vende.
 *
 * `tipoVenta` solo distinguía unidad de metro cuadrado, y eso deja fuera cosas
 * que el taller vende de verdad: el laminado va por metro lineal de rollo, la
 * resina por kilo, la tinta por litro. Cada unidad pide datos distintos al
 * facturar, así que el formulario cambia según esta.
 */
export type UnidadVenta =
    | "unidad"
    | "metro_cuadrado"
    | "metro_lineal"
    | "kilo"
    | "litro"

/** Qué es esta entrada del catálogo, para separarla en pestañas. */
export type TipoEntrada =
    /** Sale de un rollo o una lámina: vinil, banner, acrílico. */
    | "material"
    /** Mano de obra o acabado: diseño, instalación, laminado. */
    | "servicio"
    /** Mercancía que se compra hecha y se cuenta: llaveros, tazas. */
    | "producto"

export const UNIDADES: { valor: UnidadVenta; etiqueta: string; abrev: string; ayuda: string }[] = [
    { valor: "unidad",         etiqueta: "Unidad",        abrev: "und",  ayuda: "Se cuenta por piezas" },
    { valor: "metro_cuadrado", etiqueta: "Metro cuadrado", abrev: "m²",  ayuda: "Se cobra por área: ancho × alto" },
    { valor: "metro_lineal",   etiqueta: "Metro lineal",   abrev: "m.l.", ayuda: "Sale de un rollo de ancho fijo; se cobra el largo" },
    { valor: "kilo",           etiqueta: "Kilo",           abrev: "kg",  ayuda: "Se pesa" },
    { valor: "litro",          etiqueta: "Litro",          abrev: "L",   ayuda: "Se mide en volumen" },
]

/**
 * Lo que costó traer la mercancía, para saber a cómo sale cada unidad.
 *
 * Es la cuenta que se hacía a mano y de cabeza: llegó una caja de doce a
 * cuarenta dólares, salen a tres treinta y tres, ¿a cómo lo vendo? El sistema
 * la hace y propone un precio, pero el que manda es el que se escriba: hay
 * razones para cobrar distinto que ninguna fórmula conoce.
 */
export interface CostoCompra {
    /** Lo que costó el lote entero. */
    montoLoteUSD: number
    /** Cuántas unidades trae el lote. */
    unidadesLote: number
    /** Margen que se quiere ganar, en porcentaje. */
    margenPct?: number
    /** Cuándo se actualizó, porque los costos envejecen. */
    actualizadoEn?: string
}

/** A cómo sale cada unidad del lote. */
export const costoUnitario = (c?: CostoCompra): number => {
    const monto = Number(c?.montoLoteUSD) || 0
    const uds = Number(c?.unidadesLote) || 0
    if (monto <= 0 || uds <= 0) return 0
    return Math.round((monto / uds) * 10000) / 10000
}

/**
 * Precio que se sugiere cobrar. Solo es una propuesta: el precio de venta es
 * el que esté escrito en la ficha, no este.
 */
export const precioRecomendado = (c?: CostoCompra): number => {
    const unitario = costoUnitario(c)
    if (unitario <= 0) return 0
    const margen = Number(c?.margenPct) || 0
    // Se redondea a cinco céntimos: nadie cobra 3,3267.
    return Math.round((unitario * (1 + margen / 100)) * 20) / 20
}

/** Las dos áreas del taller. 'AMBAS' para lo que se usa en las dos. */
export type AreaTaller = 'IMPRESION' | 'CORTE' | 'AMBAS'

export interface CatalogoCategoria {
    id?: string
    nombre: string
    /**
     * Categoría padre, para poder anidar.
     *
     * Con una sola lista plana todo acababa mezclado: los rollos de impresión
     * junto a las láminas de corte y junto a la mercancía que se vende por
     * unidad. Una subcategoría es una categoría normal que apunta a otra; se
     * anida un nivel, que es lo que hace falta y lo que se sigue entendiendo
     * de un vistazo en el mostrador.
     */
    padreId?: string
    color: string       // "blue" | "emerald" | "orange" | "purple" | "rose" | "amber" | "cyan" | "slate"
    descripcion?: string
    orden: number

    /**
     * A qué área del taller pertenecen los materiales de esta categoría.
     *
     * Antes el balance repartía los materiales entre impresión y corte
     * adivinando por el nombre del ítem ("si dice vinil es impresión"). Con
     * nombres escritos a mano eso falla en cuanto alguien escribe algo raro, y
     * un material mal repartido descuadra los metros de las dos áreas a la vez.
     *
     * Aquí se dice y ya está. Sin definir, se decide por el tipo de venta.
     */
    area?: AreaTaller

    createdAt?: any
}

/**
 * SERVICIO DERIVADO de un material.
 *
 * Todo lo que vende el taller sale de un material base. Del vinil salen el
 * vinil solo, la impresión en vinil mate, la brillante, la blackout, el corte
 * en plóter, los stickers... Cada uno se cobra distinto, pero todos consumen
 * metros cuadrados DEL MISMO material, así que agrupándolos bajo el material
 * se sabe cuánto vinil se gastó de verdad, sin importar cómo se vendió.
 *
 * (Se sigue llamando "variante" en el código porque así se llamaba y hay datos
 * guardados con ese nombre; en pantalla se presenta como servicio derivado.)
 */
export interface CatalogoVariante {
    id: string
    nombre: string      // "Vinil solo", "Impresión en vinil mate", "Stickers"...
    stock: number
    stockMinimo: number

    /**
     * Precio propio del servicio, por m² o por unidad según el material.
     * Si no se define, se usa el del material base.
     */
    precioGeneral?: number
    /** Precio para aliados y publicistas. Si falta, se cobra el general. */
    precioAliado?: number

    /**
     * Forma antigua: un extra sumado al precio base. Se conserva para no
     * romper lo ya guardado, pero los precios propios mandan sobre él.
     */
    precioAjuste?: number
}

/**
 * ACABADO de un material: el rollo concreto del que sale.
 *
 * Es un eje distinto del de las formas de venta. El vinil mate, el brillante y
 * el blackout son rollos separados pero siguen siendo vinil, y valen lo mismo
 * se venda como impresión, como stickers o cortado en plóter. Por eso el
 * acabado no lleva precio: solo sirve para saber de qué rollo salió el trabajo
 * y cuál se está gastando más.
 *
 * Con un solo eje habría que multiplicar acabados por formas de venta y el
 * catálogo se llenaría de entradas como "impresión en vinil mate", "impresión
 * en vinil brillante", "stickers en vinil mate"…
 */
export interface CatalogoAcabado {
    id: string
    nombre: string
    /** Un acabado que se deja de traer se archiva: los trabajos viejos lo nombran. */
    activo?: boolean
}

/**
 * Qué se le puede hacer a un material al crear una orden.
 *
 * Antes esto estaba escrito a fuego en el formulario de ítems: unas funciones
 * miraban el nombre del material y decidían («si dice banner, enseña ojales»;
 * «si dice vinil y no dice textil, enseña pegado»). Funcionaba mientras la
 * lista de materiales fuera fija, pero cualquier material nuevo nacía sin
 * opciones y había que tocar el código para dárselas.
 *
 * Ahora lo decide el propio material. Añadir una forma de imprimir es dar de
 * alta un material y marcarle sus casillas, sin programar nada.
 */
export interface OpcionesImpresion {
    /** Ojales, bolsillos y tubos: lo típico de un banner colgado. */
    ojales?: boolean
    bolsillos?: boolean
    tubos?: boolean
    /** Refilado al corte. */
    refilado?: boolean
    /** Admite laminado encima. */
    laminado?: boolean
    /** Se puede pegar sobre PVC o acrílico. */
    pegado?: boolean
    /** El corte de plóter es obligatorio (los stickers siempre van cortados). */
    corteObligatorio?: boolean
    /** Se puede pedir con corte de plóter, pero no obliga. */
    corteOpcional?: boolean
}

export interface CatalogoProducto {
    id?: string
    categoriaId: string
    nombre: string
    descripcion?: string
    tipoVenta: 'unidad' | 'metro_cuadrado'
    precioBase: number          // precio por unidad O precio por m²
    unidadLabel: string         // "lámina", "rollo", "metro", "pieza", "unidad"
    tieneVariantes: boolean
    /** Las formas de venta: impresión, corte en plóter, stickers, vinil solo… */
    variantes: CatalogoVariante[]
    /** Los acabados o rollos: mate, brillante, blackout, cara negra… */
    acabados?: CatalogoAcabado[]
    /** Qué extras admite este material al crear una orden. */
    opcionesImpresion?: OpcionesImpresion

    /** Material, servicio o producto de stock. Sin definir se deduce. */
    tipoEntrada?: TipoEntrada
    /**
     * Cómo se mide al venderlo. Convive con `tipoVenta`, que solo sabía de
     * unidades y metros cuadrados: cuando falta, se deduce de aquel.
     */
    unidadVenta?: UnidadVenta
    /**
     * Ancho del rollo en centímetros, para lo que se vende por metro lineal.
     *
     * El rollo se corta a lo largo y la tira que sobra a lo ancho no se
     * reaprovecha, así que el consumo real es el ancho entero por el largo
     * usado, aunque la pieza sea estrecha.
     */
    anchoBaseCm?: number
    /** Foto para reconocerlo de un vistazo al facturar. */
    fotoUrl?: string
    /** Lo que costó traerlo, para calcular el precio sugerido. */
    costo?: CostoCompra
    // Solo aplica para tipoVenta === 'unidad':
    stockSimple: number
    stockMinimo: number
    // Solo aplica para tipoVenta === 'metro_cuadrado' (vinil, banner, etc.):
    rollosEnStock?: number      // contador manual de rollos físicos en stock
    activo: boolean
    precioPublicista?: number   // precio preferencial en EUR (para publicistas/agencias)
    createdAt?: any
    updatedAt?: any
}

export type TipoCliente = 'general' | 'publicista'

export interface CartItem {
    key: string             // unique cart key
    productoId: string
    productoNombre: string
    categoriaId: string
    varianteId?: string
    varianteNombre?: string
    tipoVenta: 'unidad' | 'metro_cuadrado'
    tipoCliente: TipoCliente
    cantidad: number
    cmAlto?: number
    cmAncho?: number
    m2Unitario?: number
    m2Total?: number
    precioBase: number      // per unit or per m² — USD (general) o EUR (publicista)
    monedaPrecio: 'USD' | 'EUR'
    subtotalUSD: number     // siempre en USD para poder sumar el total
}

export interface ItemVentaCatalogo {
    productoId: string
    productoNombre: string
    categoriaId: string
    varianteId?: string
    varianteNombre?: string
    tipoVenta: 'unidad' | 'metro_cuadrado'
    tipoCliente: TipoCliente
    cantidad: number
    cmAlto?: number
    cmAncho?: number
    m2Unitario?: number
    m2Total?: number
    precioBase: number
    monedaPrecio: 'USD' | 'EUR'
    subtotalUSD: number
}

export interface VentaCatalogo {
    id?: string
    fecha: any
    clienteNombre?: string
    clienteId?: string
    clienteRif?: string
    clienteTelefono?: string
    items: ItemVentaCatalogo[]
    totalUSD: number
    moneda: 'USD' | 'EUR' | 'USDT' | 'BS'
    tasaCambio: number
    totalLocal: number
    metodoPago: string
    notas?: string
    registradoPor: string
    estado: 'COMPLETADA' | 'ANULADA'
    anuladoAt?: any
}

// ============================================================
// FÓRMULA M² — igual que la calculadora del sistema
// ============================================================
/**
 * Precio que se cobra por un servicio derivado, según el tipo de cliente.
 *
 * Orden de preferencia:
 *   1. El precio propio del servicio (lo normal a partir de ahora).
 *   2. El precio del material base más el ajuste antiguo, si lo tenía.
 *   3. El precio del material base a secas.
 *
 * Para aliados, si el servicio no tiene precio preferencial se le cobra el
 * general: es mejor cobrar de más que regalar el trabajo por un hueco en la
 * ficha, y así se nota en seguida que falta configurarlo.
 */
export const precioDeServicio = (
    producto: Pick<CatalogoProducto, 'precioBase' | 'precioPublicista'>,
    variante: CatalogoVariante | null | undefined,
    tipoCliente: TipoCliente = 'general'
): number => {
    const esAliado = tipoCliente === 'publicista'

    if (variante) {
        const propio = esAliado
            ? (variante.precioAliado ?? variante.precioGeneral)
            : variante.precioGeneral
        if (typeof propio === 'number' && propio > 0) return propio

        const base = esAliado
            ? (producto.precioPublicista ?? producto.precioBase)
            : producto.precioBase
        return Math.max(0, (Number(base) || 0) + (Number(variante.precioAjuste) || 0))
    }

    const base = esAliado
        ? (producto.precioPublicista ?? producto.precioBase)
        : producto.precioBase
    return Number(base) || 0
}

export interface ConsumoMaterial {
    productoId: string
    productoNombre: string
    m2Totales: number
    unidadesTotales: number
    ingresosUSD: number
    /** Desglose por servicio derivado, de mayor a menor consumo. */
    porServicio: {
        varianteId: string
        nombre: string
        m2: number
        unidades: number
        ingresosUSD: number
    }[]
}

/**
 * Cuántos metros cuadrados se gastaron de cada MATERIAL, sumando todos sus
 * servicios derivados.
 *
 * Es la pregunta que no se podía responder antes: da igual que el vinil se
 * vendiera como impresión mate, como stickers o cortado en plóter — sigue
 * siendo vinil saliendo del rollo, y para reponer hace falta el total.
 */
export const consumoPorMaterial = (ventas: VentaCatalogo[]): ConsumoMaterial[] => {
    const mapa = new Map<string, ConsumoMaterial>()

    ventas.forEach(venta => {
        // Una venta anulada no consumió material.
        if ((venta as any)?.estado === 'ANULADA') return

        ;(venta.items || []).forEach(item => {
            if (!item?.productoId) return

            if (!mapa.has(item.productoId)) {
                mapa.set(item.productoId, {
                    productoId: item.productoId,
                    productoNombre: item.productoNombre || 'Sin nombre',
                    m2Totales: 0,
                    unidadesTotales: 0,
                    ingresosUSD: 0,
                    porServicio: [],
                })
            }

            const material = mapa.get(item.productoId)!
            const m2 = Number(item.m2Total) || 0
            const uds = Number(item.cantidad) || 0
            const importe = Number(item.subtotalUSD) || 0

            material.m2Totales += m2
            material.unidadesTotales += uds
            material.ingresosUSD += importe

            const claveServicio = item.varianteId || '__base__'
            let servicio = material.porServicio.find(s => s.varianteId === claveServicio)
            if (!servicio) {
                servicio = {
                    varianteId: claveServicio,
                    nombre: item.varianteNombre || 'Sin servicio derivado',
                    m2: 0, unidades: 0, ingresosUSD: 0,
                }
                material.porServicio.push(servicio)
            }
            servicio.m2 += m2
            servicio.unidades += uds
            servicio.ingresosUSD += importe
        })
    })

    const salida = Array.from(mapa.values())
    salida.forEach(m => m.porServicio.sort((a, b) => (b.m2 - a.m2) || (b.unidades - a.unidades)))
    return salida.sort((a, b) => (b.m2Totales - a.m2Totales) || (b.ingresosUSD - a.ingresosUSD))
}

export const calcPrecioM2 = (
    precioPorM2: number,
    cmAlto: number,
    cmAncho: number,
    cantidad: number = 1
) => {
    const m2Unitario = (cmAlto / 100) * (cmAncho / 100)
    const precioUnitario = Math.max(1, m2Unitario * precioPorM2)
    return {
        m2Unitario,
        m2Total: m2Unitario * cantidad,
        precioUnitario,
        subtotal: precioUnitario * cantidad
    }
}

// ============================================================
// CONSTANTES DE COLECCIONES
// ============================================================
const CAT_COL = "catalogo_categorias"
const PROD_COL = "catalogo_productos"
const VENTAS_COL = "ventas_catalogo"

// ============================================================
// CATEGORÍAS
// ============================================================
export const subscribeToCatalogoCategories = (cb: (cats: CatalogoCategoria[]) => void) =>
    onSnapshot(
        query(collection(db, CAT_COL), orderBy("orden", "asc")),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogoCategoria))),
        err => console.error("[catalog] categorías:", err)
    )

export const saveCatalogoCategory = async (data: Omit<CatalogoCategoria, 'id' | 'createdAt'>, id?: string) => {
    if (id) {
        await updateDoc(doc(db, CAT_COL, id), { ...data, updatedAt: serverTimestamp() })
    } else {
        await addDoc(collection(db, CAT_COL), { ...data, createdAt: serverTimestamp() })
    }
}

export const deleteCatalogoCategory = async (id: string) =>
    deleteDoc(doc(db, CAT_COL, id))

// ============================================================
// PRODUCTOS
// ============================================================
export const subscribeToCatalogoProducts = (cb: (prods: CatalogoProducto[]) => void) =>
    onSnapshot(
        query(collection(db, PROD_COL), orderBy("nombre", "asc")),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogoProducto))),
        err => console.error("[catalog] productos:", err)
    )

export const saveCatalogoProduct = async (data: CatalogoProducto, id?: string) => {
    const { id: _id, createdAt: _c, ...toSave } = data as any
    if (id) {
        await updateDoc(doc(db, PROD_COL, id), { ...toSave, updatedAt: serverTimestamp() })
    } else {
        await addDoc(collection(db, PROD_COL), { ...toSave, createdAt: serverTimestamp() })
    }
}

export const deleteCatalogoProduct = async (id: string) =>
    deleteDoc(doc(db, PROD_COL, id))

// Actualizar stock de un producto sin variantes
export const updateStockSimple = async (productoId: string, nuevoStock: number) =>
    updateDoc(doc(db, PROD_COL, productoId), { stockSimple: nuevoStock, updatedAt: serverTimestamp() })

// Actualizar stock de una variante
export const updateStockVariante = async (productoId: string, varianteId: string, nuevoStock: number, allVariantes: CatalogoVariante[]) => {
    const variantes = allVariantes.map(v => v.id === varianteId ? { ...v, stock: nuevoStock } : v)
    await updateDoc(doc(db, PROD_COL, productoId), { variantes, updatedAt: serverTimestamp() })
}

// ============================================================
// VENTAS — con transacción para actualizar stock
// ============================================================
export const subscribeToVentasCatalogo = (cb: (ventas: VentaCatalogo[]) => void) =>
    onSnapshot(
        query(collection(db, VENTAS_COL), orderBy("fecha", "desc")),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as VentaCatalogo))),
        err => console.error("[catalog] ventas:", err)
    )

export const createVentaCatalogo = async (
    venta: Omit<VentaCatalogo, 'id'>,
    productos: CatalogoProducto[]
) => {
    await runTransaction(db, async (transaction) => {
        // 1. Crear registro de venta
        const ventaRef = doc(collection(db, VENTAS_COL))
        transaction.set(ventaRef, { ...venta, fecha: serverTimestamp() })

        // 2. Actualizar stock por ítem — solo para productos tipo 'unidad'
        // Los productos tipo 'metro_cuadrado' (vinil, banner) no decrementan stock
        // ya que el consumo real de material es variable y se gestiona por rollos manualmente
        for (const item of venta.items) {
            if (item.tipoVenta === 'metro_cuadrado') continue

            const prodRef = doc(db, PROD_COL, item.productoId)
            const prodDoc = await transaction.get(prodRef)
            if (!prodDoc.exists()) continue

            const prod = prodDoc.data() as CatalogoProducto

            if (prod.tieneVariantes && item.varianteId) {
                const variantes = (prod.variantes || []).map(v =>
                    v.id === item.varianteId
                        ? { ...v, stock: Math.max(0, v.stock - item.cantidad) }
                        : v
                )
                transaction.update(prodRef, { variantes })
            } else {
                const nuevo = Math.max(0, (prod.stockSimple || 0) - item.cantidad)
                transaction.update(prodRef, { stockSimple: nuevo })
            }
        }
    })
}

export const updateRollosEnStock = async (productoId: string, rollos: number) =>
    updateDoc(doc(db, PROD_COL, productoId), { rollosEnStock: Math.max(0, rollos) })

export const anularVentaCatalogo = async (ventaId: string) =>
    updateDoc(doc(db, VENTAS_COL, ventaId), {
        estado: 'ANULADA',
        anuladoAt: serverTimestamp()
    })

/**
 * A qué área pertenece un material.
 *
 * Manda lo que diga su categoría. Si la categoría no lo tiene puesto todavía,
 * se decide por el tipo de venta: lo que se mide por m² sale de un rollo y es
 * impresión; lo que se cuenta por unidades es corte. Es un apaño para que la
 * pantalla no se quede vacía mientras se configuran las categorías, no un
 * criterio en el que confiar.
 */
export const areaDeProducto = (
    producto: Pick<CatalogoProducto, "categoriaId" | "tipoVenta"> | undefined,
    categorias: CatalogoCategoria[]
): AreaTaller => {
    const propia = categorias.find(c => c.id === producto?.categoriaId)?.area;
    if (propia) return propia;
    return producto?.tipoVenta === "unidad" ? "CORTE" : "IMPRESION";
};

/** ¿Se muestra este material en la vista de esta área? */
export const materialEsDelArea = (area: AreaTaller, vista: "IMPRESION" | "CORTE"): boolean =>
    area === "AMBAS" || area === vista;

/**
 * Los materiales que se ofrecen al crear una orden, ya filtrados y ordenados.
 *
 * `area` decide de qué lista salen: el formulario de impresión no debe ofrecer
 * acrílico, ni el de corte ofrecer banner.
 */
export const materialesDelArea = (
    productos: CatalogoProducto[],
    categorias: CatalogoCategoria[],
    area: "IMPRESION" | "CORTE"
): CatalogoProducto[] =>
    productos
        .filter(p => p.activo !== false && materialEsDelArea(areaDeProducto(p, categorias), area))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

/** Los acabados que siguen en uso de un material. */
export const acabadosActivos = (producto?: CatalogoProducto): CatalogoAcabado[] =>
    (producto?.acabados || []).filter(a => a.activo !== false);

/**
 * Las opciones de un material, con los valores de siempre para los que
 * todavía no las tienen configuradas.
 *
 * Sin esto, al pasar el formulario a leer del catálogo, los materiales ya
 * dados de alta se quedarían de golpe sin ojales ni laminado.
 */
export const opcionesDe = (producto?: CatalogoProducto): Required<OpcionesImpresion> => {
    const o = producto?.opcionesImpresion || {};
    return {
        ojales: o.ojales ?? false,
        bolsillos: o.bolsillos ?? false,
        tubos: o.tubos ?? false,
        refilado: o.refilado ?? true,
        laminado: o.laminado ?? true,
        pegado: o.pegado ?? false,
        corteObligatorio: o.corteObligatorio ?? false,
        corteOpcional: o.corteOpcional ?? true,
    };
};

// ============================================================
// UNIDADES Y TIPOS — lectura tolerante de lo ya guardado
// ============================================================

/** La unidad de un producto, deduciéndola de `tipoVenta` si aún no la tiene. */
export const unidadDe = (p?: Pick<CatalogoProducto, "unidadVenta" | "tipoVenta">): UnidadVenta =>
    p?.unidadVenta || (p?.tipoVenta === "metro_cuadrado" ? "metro_cuadrado" : "unidad");

export const abrevUnidad = (u: UnidadVenta): string =>
    UNIDADES.find(x => x.valor === u)?.abrev || "und";

/**
 * Qué es una entrada del catálogo cuando nadie se lo ha dicho todavía.
 *
 * Lo que se mide por área o por metro de rollo sale de un rollo: es material.
 * Lo demás se cuenta, y eso es mercancía. Es una suposición para no dejar la
 * pantalla vacía mientras se clasifica; en cuanto se marca a mano, manda eso.
 */
export const tipoEntradaDe = (p?: CatalogoProducto): TipoEntrada => {
    if (p?.tipoEntrada) return p.tipoEntrada;
    const u = unidadDe(p);
    return u === "metro_cuadrado" || u === "metro_lineal" ? "material" : "producto";
};

/** Las categorías de primer nivel. */
export const categoriasRaiz = (cats: CatalogoCategoria[]): CatalogoCategoria[] =>
    cats.filter(c => !c.padreId).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

/** Las subcategorías de una categoría. */
export const subcategoriasDe = (cats: CatalogoCategoria[], padreId?: string): CatalogoCategoria[] =>
    cats.filter(c => c.padreId === padreId).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

/**
 * El área de una subcategoría la hereda de su padre si no la tiene propia.
 *
 * Así basta con decir una vez que "Impresión" es del área de impresión para
 * que todo lo que cuelgue de ella cuente en el balance correcto.
 */
export const areaDeCategoria = (
    categoria: CatalogoCategoria | undefined,
    todas: CatalogoCategoria[]
): AreaTaller | undefined => {
    if (!categoria) return undefined;
    if (categoria.area) return categoria.area;
    const padre = todas.find(c => c.id === categoria.padreId);
    return padre?.area;
};

/**
 * Metros lineales que consume una pieza, contando el ancho entero del rollo.
 *
 * El rollo tiene un ancho fijo y se corta a lo largo. La pieza se gira para
 * que su lado menor quepa en ese ancho, y lo que se gasta es el largo — la
 * tira que sobra al lado no se reaprovecha. Por eso una pieza estrecha y larga
 * consume igual que una que ocupe todo el ancho.
 *
 * Devuelve también los metros cuadrados de rollo que se van de verdad, que es
 * lo que hay que descontar del stock aunque al cliente se le cobre el largo.
 */
export const consumoMetroLineal = (
    anchoRolloCm: number,
    piezaAnchoCm: number,
    piezaAltoCm: number,
    cantidad = 1
): { metrosLineales: number; m2Rollo: number; cabe: boolean; pasadas: number } => {
    const rollo = Number(anchoRolloCm) || 0;
    const a = Number(piezaAnchoCm) || 0;
    const b = Number(piezaAltoCm) || 0;
    const uds = Number(cantidad) || 0;
    if (rollo <= 0 || a <= 0 || b <= 0 || uds <= 0) {
        return { metrosLineales: 0, m2Rollo: 0, cabe: false, pasadas: 0 };
    }

    // Se gira la pieza para que el lado corto vaya a lo ancho del rollo.
    const corto = Math.min(a, b);
    const largo = Math.max(a, b);

    // Si ni girada cabe, hay que partirla en varias pasadas.
    const cabe = corto <= rollo;
    const pasadas = cabe ? 1 : Math.ceil(corto / rollo);

    const metrosLineales = Math.round((largo / 100) * pasadas * uds * 10000) / 10000;
    const m2Rollo = Math.round((rollo / 100) * metrosLineales * 10000) / 10000;

    return { metrosLineales, m2Rollo, cabe, pasadas };
};
