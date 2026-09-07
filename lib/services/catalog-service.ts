// @/lib/services/catalog-service.ts
import { db } from "@/lib/firebase"
import {
    collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, runTransaction, Timestamp
} from "firebase/firestore"

// ============================================================
// TIPOS
// ============================================================

/** Las dos áreas del taller. 'AMBAS' para lo que se usa en las dos. */
export type AreaTaller = 'IMPRESION' | 'CORTE' | 'AMBAS'

export interface CatalogoCategoria {
    id?: string
    nombre: string
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

export interface CatalogoProducto {
    id?: string
    categoriaId: string
    nombre: string
    descripcion?: string
    tipoVenta: 'unidad' | 'metro_cuadrado'
    precioBase: number          // precio por unidad O precio por m²
    unidadLabel: string         // "lámina", "rollo", "metro", "pieza", "unidad"
    tieneVariantes: boolean
    variantes: CatalogoVariante[]
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
