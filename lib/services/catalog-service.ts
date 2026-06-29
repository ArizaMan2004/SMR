// @/lib/services/catalog-service.ts
import { db } from "@/lib/firebase"
import {
    collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc,
    doc, serverTimestamp, runTransaction, Timestamp
} from "firebase/firestore"

// ============================================================
// TIPOS
// ============================================================

export interface CatalogoCategoria {
    id?: string
    nombre: string
    color: string       // "blue" | "emerald" | "orange" | "purple" | "rose" | "amber" | "cyan" | "slate"
    descripcion?: string
    orden: number
    createdAt?: any
}

export interface CatalogoVariante {
    id: string
    nombre: string      // "Blanco", "Media Lámina - Negro", "Cuarto - Transparente", etc.
    stock: number
    stockMinimo: number
    precioAjuste?: number   // extra sobre el precio base (puede ser negativo)
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
