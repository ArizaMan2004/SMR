// @/components/dashboard/CatalogInventoryView.tsx
"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
    Package, Plus, Search, Trash2, Pencil, Tag, Layers,
    ShoppingCart, History, DollarSign, Ruler, Box, X,
    ChevronRight, AlertTriangle, CheckCircle2, Banknote,
    Receipt, Percent, BarChart3, Palette, Grid3X3,
    ArrowUpCircle, ArrowDownCircle, RefreshCw, Settings2,
    CircleDollarSign, TrendingUp, FileText, Eye, FileDown,
    User, Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { subscribeToClients } from '@/lib/services/clientes-service'
import { generateCatalogSalePDF } from '@/lib/services/pdf-generator'
import {
    subscribeToCatalogoCategories,
    subscribeToCatalogoProducts,
    subscribeToVentasCatalogo,
    saveCatalogoCategory,
    deleteCatalogoCategory,
    saveCatalogoProduct,
    deleteCatalogoProduct,
    updateStockSimple,
    updateStockVariante,
    updateRollosEnStock,
    createVentaCatalogo,
    anularVentaCatalogo,
    calcPrecioM2,
    type CatalogoCategoria,
    type CatalogoProducto,
    type CatalogoVariante,
    type CartItem,
    type VentaCatalogo,
    type ItemVentaCatalogo,
    type TipoCliente,
} from '@/lib/services/catalog-service'

// ============================================================
// TIPOS LOCALES
// ============================================================
type Moneda = 'USD' | 'EUR' | 'USDT' | 'BS'

interface CatalogInventoryViewProps {
    currentUser: any
    rates: { usd: number; eur: number; usdt: number }
    pdfLogoBase64?: string
    firmaBase64?: string
    selloBase64?: string
}

// ============================================================
// CONSTANTES
// ============================================================
const COLORES_CATEGORIA: { value: string; label: string; bg: string; text: string; border: string }[] = [
    { value: 'blue',    label: 'Azul',     bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300' },
    { value: 'emerald', label: 'Verde',    bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    { value: 'orange',  label: 'Naranja',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300' },
    { value: 'purple',  label: 'Morado',   bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-300' },
    { value: 'rose',    label: 'Rosa',     bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300' },
    { value: 'amber',   label: 'Ámbar',    bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300' },
    { value: 'cyan',    label: 'Cyan',     bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300' },
    { value: 'slate',   label: 'Gris',     bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300' },
]

const getColorStyle = (color: string) =>
    COLORES_CATEGORIA.find(c => c.value === color) || COLORES_CATEGORIA[0]

const MONEDAS: { value: Moneda; label: string }[] = [
    { value: 'USD',  label: 'USD (1:1)' },
    { value: 'EUR',  label: 'EUR (BCV)' },
    { value: 'USDT', label: 'USDT (Paralelo)' },
    { value: 'BS',   label: 'Bolívares (BCV)' },
]

const METODOS_PAGO = ['Efectivo USD', 'Efectivo Bs', 'Pago Móvil', 'Zelle', 'USDT', 'Transferencia', 'Tarjeta']
const UNIDADES_LABEL = ['unidad', 'lámina', 'rollo', 'metro', 'pieza', 'paquete', 'caja', 'kit']

const formatUSD = (n: number) => `$${n.toFixed(2)}`
const formatDate = (ts: any): string => {
    if (!ts) return '—'
    try {
        const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts)
        return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch { return '—' }
}

// ============================================================
// DEFAULTS
// ============================================================
const PROD_DEFAULT: CatalogoProducto = {
    categoriaId: '', nombre: '', descripcion: '', tipoVenta: 'unidad',
    precioBase: 0, precioPublicista: 0, unidadLabel: 'unidad', tieneVariantes: false,
    variantes: [], stockSimple: 0, stockMinimo: 0, rollosEnStock: 0, activo: true
}

const CAT_DEFAULT: CatalogoCategoria = { nombre: '', color: 'blue', descripcion: '', orden: 0 }

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function CatalogInventoryView({ currentUser, rates, pdfLogoBase64, firmaBase64, selloBase64 }: CatalogInventoryViewProps) {
    const isAdmin = ['ADMIN', 'PRODUCCION'].includes(currentUser?.rol)

    // Datos
    const [categorias, setCategorias] = useState<CatalogoCategoria[]>([])
    const [productos, setProductos] = useState<CatalogoProducto[]>([])
    const [ventas, setVentas] = useState<VentaCatalogo[]>([])
    const [clientes, setClientes] = useState<any[]>([])

    // UI
    const [activeTab, setActiveTab] = useState('catalogo')
    const [searchTerm, setSearchTerm] = useState('')
    const [catFilter, setCatFilter] = useState('TODOS')
    const [isCartOpen, setIsCartOpen] = useState(false)

    // Carrito
    const [cart, setCart] = useState<CartItem[]>([])
    const [metodoPago, setMetodoPago] = useState('Efectivo USD')
    const [moneda, setMoneda] = useState<Moneda>('USD')
    const [notasVenta, setNotasVenta] = useState('')

    // Cliente seleccionado
    const [clienteSearch, setClienteSearch] = useState('')
    const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
    const [showClienteDropdown, setShowClienteDropdown] = useState(false)

    // Modales
    const [isProdModalOpen, setIsProdModalOpen] = useState(false)
    const [isCatModalOpen, setIsCatModalOpen] = useState(false)
    const [isCartItemModalOpen, setIsCartItemModalOpen] = useState(false)
    const [isReceiptOpen, setIsReceiptOpen] = useState(false)
    const [isStockModalOpen, setIsStockModalOpen] = useState(false)

    // Estado de edición
    const [editingProd, setEditingProd] = useState<CatalogoProducto | null>(null)
    const [editingCat, setEditingCat] = useState<CatalogoCategoria | null>(null)
    const [configProduct, setConfigProduct] = useState<CatalogoProducto | null>(null)
    const [stockProduct, setStockProduct] = useState<CatalogoProducto | null>(null)
    const [selectedVenta, setSelectedVenta] = useState<VentaCatalogo | null>(null)

    // Config cart item (para m², variantes y tipo de cliente)
    const [cartConfig, setCartConfig] = useState({
        varianteId: '', cantidad: 1, cmAlto: 0, cmAncho: 0,
        tipoCliente: 'general' as TipoCliente
    })

    // Stock edit
    const [stockEdits, setStockEdits] = useState<Record<string, number>>({})

    // Forms
    const [prodForm, setProdForm] = useState<CatalogoProducto>({ ...PROD_DEFAULT })
    const [catForm, setCatForm] = useState<CatalogoCategoria>({ ...CAT_DEFAULT })
    const [prodVarianteInput, setProdVarianteInput] = useState({ nombre: '', stock: 0, stockMinimo: 0 })

    // ============================================================
    // FIRESTORE LISTENERS
    // ============================================================
    useEffect(() => {
        const u1 = subscribeToCatalogoCategories(setCategorias)
        const u2 = subscribeToCatalogoProducts(setProductos)
        const u3 = subscribeToVentasCatalogo(setVentas)
        const u4 = subscribeToClients(setClientes)
        return () => { u1(); u2(); u3(); u4() }
    }, [])

    // ============================================================
    // DERIVADOS
    // ============================================================
    const clientesFiltrados = useMemo(() => {
        if (!clienteSearch.trim()) return clientes.slice(0, 8)
        const q = clienteSearch.toLowerCase()
        return clientes.filter(c =>
            (c.nombreRazonSocial || '').toLowerCase().includes(q) ||
            (c.rifCedulaCompleto || '').toLowerCase().includes(q) ||
            (c.telefonoCompleto || '').toLowerCase().includes(q)
        ).slice(0, 8)
    }, [clientes, clienteSearch])

    const handleSeleccionarCliente = (cliente: any) => {
        setClienteSeleccionado(cliente)
        setClienteSearch(cliente.nombreRazonSocial)
        setShowClienteDropdown(false)
    }

    const handleLimpiarCliente = () => {
        setClienteSeleccionado(null)
        setClienteSearch('')
    }

    const productosFiltrados = useMemo(() => {
        return productos.filter(p => {
            const matchSearch = !searchTerm ||
                p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase())
            const matchCat = catFilter === 'TODOS' || p.categoriaId === catFilter
            return matchSearch && matchCat && p.activo
        })
    }, [productos, searchTerm, catFilter])

    const cartTotal = useMemo(() => cart.reduce((acc, i) => acc + i.subtotalUSD, 0), [cart])

    const getRateForMoneda = (m: Moneda) => {
        if (m === 'EUR') return rates.eur
        if (m === 'USDT') return rates.usdt
        if (m === 'BS') return rates.usd
        return 1
    }
    const getCurrencySymbol = (m: Moneda) => m === 'EUR' ? '€' : m === 'BS' ? 'Bs.' : '$'
    const convertAmount = (usd: number, m: Moneda) => m === 'USD' ? usd : usd * getRateForMoneda(m)

    const kpis = useMemo(() => {
        const totalProductos = productos.filter(p => p.activo).length
        const stockBajo = productos.filter(p => {
            if (p.tipoVenta === 'metro_cuadrado') return false  // m² no tiene stock de unidades
            if (p.tieneVariantes) return p.variantes.some(v => v.stock <= v.stockMinimo)
            return p.stockSimple <= p.stockMinimo
        }).length
        const ventasHoy = ventas.filter(v => {
            if (v.estado === 'ANULADA') return false
            try {
                const d = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha)
                return d.toDateString() === new Date().toDateString()
            } catch { return false }
        })
        const ingresoHoy = ventasHoy.reduce((acc, v) => acc + v.totalUSD, 0)
        const ingresoMes = ventas.filter(v => {
            if (v.estado === 'ANULADA') return false
            try {
                const d = v.fecha?.toDate ? v.fecha.toDate() : new Date(v.fecha)
                const now = new Date()
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            } catch { return false }
        }).reduce((acc, v) => acc + v.totalUSD, 0)
        return { totalProductos, stockBajo, ingresoHoy, ingresoMes }
    }, [productos, ventas])

    // ============================================================
    // ACCIONES — PRODUCTOS
    // ============================================================
    const openNewProduct = () => {
        setEditingProd(null)
        setProdForm({ ...PROD_DEFAULT, categoriaId: categorias[0]?.id || '' })
        setIsProdModalOpen(true)
    }

    const openEditProduct = (p: CatalogoProducto) => {
        setEditingProd(p)
        setProdForm({ ...p })
        setIsProdModalOpen(true)
    }

    const handleSaveProd = async () => {
        if (!prodForm.nombre.trim()) return toast.error('El nombre es obligatorio')
        if (!prodForm.categoriaId) return toast.error('Selecciona una categoría')
        if (prodForm.precioBase <= 0) return toast.error('El precio debe ser mayor a 0')
        const tid = toast.loading('Guardando producto...')
        try {
            await saveCatalogoProduct(prodForm, editingProd?.id)
            toast.dismiss(tid)
            toast.success(editingProd ? 'Producto actualizado' : 'Producto creado')
            setIsProdModalOpen(false)
        } catch (err: any) {
            toast.dismiss(tid); toast.error(`Error: ${err?.message}`)
        }
    }

    const handleDeleteProd = async (p: CatalogoProducto) => {
        if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return
        try {
            await deleteCatalogoProduct(p.id!)
            toast.success('Producto eliminado')
        } catch (err: any) { toast.error(`Error: ${err?.message}`) }
    }

    const addVarianteToForm = () => {
        if (!prodVarianteInput.nombre.trim()) return
        const nueva: CatalogoVariante = {
            id: `var_${Date.now()}`,
            nombre: prodVarianteInput.nombre.trim(),
            stock: Number(prodVarianteInput.stock) || 0,
            stockMinimo: Number(prodVarianteInput.stockMinimo) || 0
        }
        setProdForm(p => ({ ...p, variantes: [...p.variantes, nueva] }))
        setProdVarianteInput({ nombre: '', stock: 0, stockMinimo: 0 })
    }

    const removeVarianteFromForm = (varId: string) => {
        setProdForm(p => ({ ...p, variantes: p.variantes.filter(v => v.id !== varId) }))
    }

    // ============================================================
    // ACCIONES — CATEGORÍAS
    // ============================================================
    const handleSaveCat = async () => {
        if (!catForm.nombre.trim()) return toast.error('El nombre es obligatorio')
        const tid = toast.loading('Guardando...')
        try {
            await saveCatalogoCategory(
                { ...catForm, orden: editingCat ? catForm.orden : categorias.length },
                editingCat?.id
            )
            toast.dismiss(tid); toast.success('Categoría guardada')
            setIsCatModalOpen(false)
        } catch (err: any) {
            toast.dismiss(tid); toast.error(`Error: ${err?.message}`)
        }
    }

    const handleDeleteCat = async (cat: CatalogoCategoria) => {
        if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return
        try {
            await deleteCatalogoCategory(cat.id!)
            toast.success('Categoría eliminada')
        } catch (err: any) { toast.error(`Error: ${err?.message}`) }
    }

    // ============================================================
    // ACCIONES — CARRITO
    // ============================================================
    const openCartConfig = (prod: CatalogoProducto) => {
        setConfigProduct(prod)
        setCartConfig({
            varianteId: prod.tieneVariantes && prod.variantes.length > 0 ? prod.variantes[0].id : '',
            cantidad: 1,
            cmAlto: 0,
            cmAncho: 0,
            tipoCliente: 'general'
        })
        setIsCartItemModalOpen(true)
    }

    // Devuelve { precio: number, moneda: 'USD'|'EUR', subtotalUSD: number }
    const calcularPrecioCart = () => {
        if (!configProduct) return { precio: 0, moneda: 'USD' as const, subtotalUSD: 0 }

        const esPublicista = cartConfig.tipoCliente === 'publicista'
        const precioElegido = esPublicista && configProduct.precioPublicista
            ? configProduct.precioPublicista
            : configProduct.precioBase
        const monedaPrecio: 'USD' | 'EUR' = esPublicista ? 'EUR' : 'USD'
        const varianteActual = configProduct.tieneVariantes
            ? configProduct.variantes.find(v => v.id === cartConfig.varianteId)
            : null
        const precioConAjuste = precioElegido + (varianteActual?.precioAjuste || 0)

        let subtotalEnMoneda: number
        if (configProduct.tipoVenta === 'metro_cuadrado') {
            const { subtotal } = calcPrecioM2(precioConAjuste, cartConfig.cmAlto, cartConfig.cmAncho, cartConfig.cantidad)
            subtotalEnMoneda = subtotal
        } else {
            subtotalEnMoneda = precioConAjuste * cartConfig.cantidad
        }

        // Convertir a USD para el total interno (EUR→Bs→USD usando ambas tasas bolivares)
        const subtotalUSD = esPublicista
            ? subtotalEnMoneda * ((rates.eur || 1) / (rates.usd || 1))
            : subtotalEnMoneda
        return { precio: precioConAjuste, moneda: monedaPrecio, subtotalUSD, subtotalEnMoneda }
    }

    const calcularSubtotalCart = () => calcularPrecioCart().subtotalUSD

    const addToCart = () => {
        if (!configProduct) return
        if (cartConfig.cantidad <= 0) return toast.error('Cantidad inválida')
        if (configProduct.tipoVenta === 'metro_cuadrado' && (cartConfig.cmAlto <= 0 || cartConfig.cmAncho <= 0))
            return toast.error('Ingresa las medidas')
        if (configProduct.tieneVariantes && !cartConfig.varianteId)
            return toast.error('Selecciona una variante')

        const variante = configProduct.tieneVariantes
            ? configProduct.variantes.find(v => v.id === cartConfig.varianteId) : null

        const { precio, moneda, subtotalUSD } = calcularPrecioCart()

        let m2Data: Partial<CartItem> = {}
        if (configProduct.tipoVenta === 'metro_cuadrado') {
            const calc = calcPrecioM2(precio, cartConfig.cmAlto, cartConfig.cmAncho, cartConfig.cantidad)
            m2Data = { cmAlto: cartConfig.cmAlto, cmAncho: cartConfig.cmAncho, m2Unitario: calc.m2Unitario, m2Total: calc.m2Total }
        }

        const newItem: CartItem = {
            key: `${configProduct.id}_${cartConfig.varianteId || 'base'}_${cartConfig.tipoCliente}_${Date.now()}`,
            productoId: configProduct.id!,
            productoNombre: configProduct.nombre,
            categoriaId: configProduct.categoriaId,
            varianteId: cartConfig.varianteId || undefined,
            varianteNombre: variante?.nombre,
            tipoVenta: configProduct.tipoVenta,
            tipoCliente: cartConfig.tipoCliente,
            cantidad: cartConfig.cantidad,
            precioBase: precio,
            monedaPrecio: moneda,
            subtotalUSD,
            ...m2Data
        }

        setCart(prev => [...prev, newItem])
        setIsCartItemModalOpen(false)
        toast.success(`"${configProduct.nombre}" añadido al carrito`)
    }

    const removeFromCart = (key: string) => setCart(prev => prev.filter(i => i.key !== key))
    const clearCart = () => { if (confirm('¿Limpiar el carrito?')) setCart([]) }

    const handleGenerarPDF = async (venta: VentaCatalogo) => {
        const currency = moneda === 'BS'
            ? { rate: rates.usd, label: 'Tasa BCV', symbol: 'Bs.' }
            : moneda === 'EUR'
            ? { rate: rates.eur, label: 'Tasa EUR', symbol: '€' }
            : { rate: 1, label: 'USD', symbol: '$' }
        try {
            await generateCatalogSalePDF(venta, pdfLogoBase64 || '', {
                firmaBase64, selloBase64,
                currency: { rate: (venta as any).tasaCambio || 1, label: 'Tasa', symbol: (venta as any).moneda === 'BS' ? 'Bs.' : (venta as any).moneda === 'EUR' ? '€' : '$' }
            })
        } catch (e) {
            toast.error('Error al generar PDF')
        }
    }

    // ============================================================
    // ACCIONES — CHECKOUT
    // ============================================================
    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error('El carrito está vacío')
        const rate = getRateForMoneda(moneda)
        const totalLocal = moneda === 'USD' ? cartTotal : cartTotal * rate

        const ventaItems: ItemVentaCatalogo[] = cart.map(i => ({
            productoId: i.productoId,
            productoNombre: i.productoNombre,
            categoriaId: i.categoriaId,
            varianteId: i.varianteId,
            varianteNombre: i.varianteNombre,
            tipoVenta: i.tipoVenta,
            tipoCliente: i.tipoCliente,
            cantidad: i.cantidad,
            cmAlto: i.cmAlto,
            cmAncho: i.cmAncho,
            m2Unitario: i.m2Unitario,
            m2Total: i.m2Total,
            precioBase: i.precioBase,
            monedaPrecio: i.monedaPrecio,
            subtotalUSD: i.subtotalUSD,
        }))

        const venta: Omit<VentaCatalogo, 'id'> = {
            fecha: new Date(),
            clienteNombre: clienteSeleccionado?.nombreRazonSocial || clienteSearch.trim() || undefined,
            clienteId: clienteSeleccionado?.id || undefined,
            clienteRif: clienteSeleccionado?.rifCedulaCompleto || undefined,
            clienteTelefono: clienteSeleccionado?.telefonoCompleto || undefined,
            items: ventaItems,
            totalUSD: cartTotal,
            moneda,
            tasaCambio: rate,
            totalLocal,
            metodoPago,
            notas: notasVenta.trim() || undefined,
            registradoPor: currentUser?.nombre || currentUser?.email || 'Admin',
            estado: 'COMPLETADA',
        }

        const tid = toast.loading('Procesando venta...')
        try {
            await createVentaCatalogo(venta, productos)
            toast.dismiss(tid)
            toast.success(`Venta de ${getCurrencySymbol(moneda)}${convertAmount(cartTotal, moneda).toFixed(2)} registrada`)
            // Reset
            setCart([])
            setClienteSearch('')
            setClienteSeleccionado(null)
            setNotasVenta('')
            setIsCartOpen(false)
            setActiveTab('historial')
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error al procesar: ${err?.code || err?.message}`)
        }
    }

    // ============================================================
    // ACCIONES — STOCK MANAGEMENT
    // ============================================================
    const openStockModal = (p: CatalogoProducto) => {
        setStockProduct(p)
        if (p.tieneVariantes) {
            const edits: Record<string, number> = {}
            p.variantes.forEach(v => { edits[v.id] = v.stock })
            setStockEdits(edits)
        } else {
            setStockEdits({ simple: p.stockSimple })
        }
        setIsStockModalOpen(true)
    }

    const handleSaveStock = async () => {
        if (!stockProduct) return
        const tid = toast.loading('Actualizando stock...')
        try {
            if (stockProduct.tieneVariantes) {
                const variantes = stockProduct.variantes.map(v => ({
                    ...v,
                    stock: stockEdits[v.id] ?? v.stock
                }))
                await saveCatalogoProduct({ ...stockProduct, variantes }, stockProduct.id)
            } else {
                await updateStockSimple(stockProduct.id!, stockEdits['simple'] ?? stockProduct.stockSimple)
            }
            toast.dismiss(tid); toast.success('Stock actualizado')
            setIsStockModalOpen(false)
        } catch (err: any) {
            toast.dismiss(tid); toast.error(`Error: ${err?.message}`)
        }
    }

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="space-y-8 max-w-7xl mx-auto font-sans">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter dark:text-white flex items-center gap-3">
                        <Package className="w-10 h-10 text-blue-600" />
                        Catálogo e Inventario
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Lista de precios · Stock · Ventas · Facturación
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex gap-3 flex-wrap">
                        <Button variant="outline" onClick={() => { setEditingCat(null); setCatForm({ ...CAT_DEFAULT }); setIsCatModalOpen(true) }}
                            className="h-12 rounded-2xl border-black/10 dark:border-white/10 font-black uppercase text-xs px-4">
                            <Tag className="w-4 h-4 mr-2" /> Categorías
                        </Button>
                        <Button onClick={openNewProduct}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl px-5 font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
                        </Button>
                    </div>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={<Package className="w-6 h-6" />} label="Productos Activos" value={kpis.totalProductos.toString()} color="blue" />
                <KpiCard icon={<AlertTriangle className="w-6 h-6" />} label="Stock Bajo" value={kpis.stockBajo.toString()} color={kpis.stockBajo > 0 ? 'amber' : 'emerald'} />
                <KpiCard icon={<Receipt className="w-6 h-6" />} label="Vendido Hoy" value={formatUSD(kpis.ingresoHoy)} color="emerald" />
                <KpiCard icon={<TrendingUp className="w-6 h-6" />} label="Ventas del Mes" value={formatUSD(kpis.ingresoMes)} color="indigo" />
            </div>

            {/* FAB CARRITO — siempre visible cuando hay ítems */}
            <AnimatePresence>
                {cart.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setIsCartOpen(true)}
                        className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3.5 rounded-[2rem] shadow-2xl shadow-blue-500/40 font-black uppercase text-sm transition-colors"
                    >
                        <div className="relative">
                            <ShoppingCart className="w-5 h-5" />
                            <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-blue-600 text-[9px] font-black rounded-full flex items-center justify-center">
                                {cart.length}
                            </span>
                        </div>
                        <span>{formatUSD(cartTotal)}</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* TABS */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-200/50 dark:bg-white/5 p-1.5 rounded-2xl mb-6 h-auto gap-1 flex-wrap">
                    {[
                        { value: 'catalogo',   label: 'Catálogo',     icon: <Grid3X3 className="w-3.5 h-3.5" /> },
                        { value: 'inventario', label: 'Inventario',   icon: <Box className="w-3.5 h-3.5" /> },
                        { value: 'historial',  label: 'Historial',    icon: <History className="w-3.5 h-3.5" /> },
                    ].map(t => (
                        <TabsTrigger key={t.value} value={t.value}
                            className="rounded-xl px-5 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm flex items-center gap-1.5">
                            {t.icon}{t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ========== TAB: CATÁLOGO ========== */}
                <TabsContent value="catalogo" className="mt-0 space-y-6">
                    {/* Filtros */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input placeholder="Buscar producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="h-12 pl-12 rounded-[2rem] bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 font-bold shadow-sm" />
                        </div>
                    </div>

                    {/* Categoría pills */}
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setCatFilter('TODOS')}
                            className={cn('px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all border',
                                catFilter === 'TODOS' ? 'bg-blue-600 text-white border-transparent' : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-blue-300')}>
                            Todos
                        </button>
                        {categorias.map(cat => {
                            const cs = getColorStyle(cat.color)
                            return (
                                <button key={cat.id} onClick={() => setCatFilter(catFilter === cat.id ? 'TODOS' : cat.id!)}
                                    className={cn('px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all border',
                                        catFilter === cat.id ? `${cs.bg} ${cs.text} ${cs.border}` : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-blue-300')}>
                                    {cat.nombre}
                                </button>
                            )
                        })}
                    </div>

                    {/* Grid de productos */}
                    {productosFiltrados.length === 0 ? (
                        <div className="text-center py-20 opacity-40">
                            <Package className="w-12 h-12 mx-auto mb-3" />
                            <p className="font-bold uppercase text-xs">No hay productos. {isAdmin ? 'Crea el primero.' : ''}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            <AnimatePresence mode="popLayout">
                                {productosFiltrados.map(prod => {
                                    const cat = categorias.find(c => c.id === prod.categoriaId)
                                    const cs = getColorStyle(cat?.color || 'slate')
                                    const esM2 = prod.tipoVenta === 'metro_cuadrado'
                                    const stockTotal = prod.tieneVariantes
                                        ? prod.variantes.reduce((acc, v) => acc + v.stock, 0)
                                        : prod.stockSimple
                                    const stockBajo = !esM2 && (prod.tieneVariantes
                                        ? prod.variantes.some(v => v.stock <= v.stockMinimo)
                                        : prod.stockSimple <= prod.stockMinimo)
                                    return (
                                        <motion.div key={prod.id} layout
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] p-5 shadow-sm border border-black/5 dark:border-white/5 hover:shadow-md transition-all flex flex-col gap-4">
                                            <div className="flex justify-between items-start">
                                                <Badge className={cn('text-[8px] uppercase font-black border-none', cs.bg, cs.text)}>
                                                    {cat?.nombre || '—'}
                                                </Badge>
                                                {isAdmin && (
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => openEditProduct(prod)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteProd(prod)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <h3 className="font-black text-base uppercase italic dark:text-white leading-tight">{prod.nombre}</h3>
                                                {prod.descripcion && <p className="text-[10px] text-slate-400 mt-1 leading-tight">{prod.descripcion}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase text-slate-400">
                                                            {esM2 ? 'Precio / m²' : `Precio / ${prod.unidadLabel}`}
                                                        </p>
                                                        <p className="text-2xl font-black italic text-blue-600">{formatUSD(prod.precioBase)}</p>
                                                        {prod.precioPublicista ? (
                                                            <p className="text-[9px] font-black text-violet-500 mt-0.5">€{prod.precioPublicista} publicista</p>
                                                        ) : null}
                                                    </div>
                                                    {esM2 ? (
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black uppercase text-slate-400">Rollos</p>
                                                            <p className="text-lg font-black text-blue-500">
                                                                {prod.rollosEnStock ?? 0}
                                                            </p>
                                                            <p className="text-[7px] text-slate-400 font-black uppercase">en stock</p>
                                                        </div>
                                                    ) : (
                                                        <div className="text-right">
                                                            <p className="text-[8px] font-black uppercase text-slate-400">Stock</p>
                                                            <p className={cn('text-lg font-black', stockBajo ? 'text-amber-500' : 'text-emerald-600')}>
                                                                {stockTotal} {prod.unidadLabel}
                                                            </p>
                                                            {stockBajo && <p className="text-[7px] text-amber-500 font-black uppercase">Stock bajo</p>}
                                                        </div>
                                                    )}
                                                </div>

                                                {prod.tieneVariantes && prod.variantes.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {prod.variantes.slice(0, 4).map(v => (
                                                            <span key={v.id} className="text-[7px] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md font-bold text-slate-500 uppercase">
                                                                {v.nombre} ({v.stock})
                                                            </span>
                                                        ))}
                                                        {prod.variantes.length > 4 && (
                                                            <span className="text-[7px] text-slate-400 font-bold">+{prod.variantes.length - 4} más</span>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex gap-2 mt-2">
                                                    {isAdmin && (
                                                        <Button variant="outline" size="sm" onClick={() => openStockModal(prod)}
                                                            className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase border-black/10 dark:border-white/10">
                                                            <Box className="w-3 h-3 mr-1" /> Stock
                                                        </Button>
                                                    )}
                                                    <Button size="sm" onClick={() => openCartConfig(prod)}
                                                        className="flex-1 h-9 rounded-xl text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white">
                                                        <ShoppingCart className="w-3 h-3 mr-1" /> Añadir
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </TabsContent>

                {/* ========== TAB: INVENTARIO ========== */}
                <TabsContent value="inventario" className="mt-0">
                    <div className="space-y-4">
                        {productos.length === 0 ? (
                            <div className="text-center py-20 opacity-40">
                                <Box className="w-12 h-12 mx-auto mb-3" />
                                <p className="font-bold uppercase text-xs">Sin productos en el inventario</p>
                            </div>
                        ) : (
                            categorias.map(cat => {
                                const prods = productos.filter(p => p.categoriaId === cat.id)
                                if (prods.length === 0) return null
                                const cs = getColorStyle(cat.color)
                                return (
                                    <div key={cat.id} className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] overflow-hidden border border-black/5 dark:border-white/5">
                                        <div className={cn('px-6 py-4 flex items-center gap-3', cs.bg)}>
                                            <Tag className={cn('w-4 h-4', cs.text)} />
                                            <h3 className={cn('font-black text-sm uppercase tracking-widest', cs.text)}>{cat.nombre}</h3>
                                            <Badge className={cn('text-[8px] border-none', cs.bg, cs.text)}>{prods.length} producto(s)</Badge>
                                        </div>
                                        <div className="divide-y divide-black/5 dark:divide-white/5">
                                            {prods.map(p => {
                                                const esM2 = p.tipoVenta === 'metro_cuadrado'
                                                const stockTotal = p.tieneVariantes
                                                    ? p.variantes.reduce((acc, v) => acc + v.stock, 0) : p.stockSimple
                                                const stockBajo = !esM2 && (p.tieneVariantes
                                                    ? p.variantes.some(v => v.stock <= v.stockMinimo)
                                                    : p.stockSimple <= p.stockMinimo)
                                                return (
                                                    <div key={p.id} className="px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-black text-sm uppercase italic dark:text-white">{p.nombre}</h4>
                                                                <Badge className="text-[7px] uppercase border-none bg-slate-100 dark:bg-white/5 text-slate-500">
                                                                    {esM2 ? `$${p.precioBase}/m²` : `$${p.precioBase}/${p.unidadLabel}`}
                                                                </Badge>
                                                                {p.precioPublicista ? (
                                                                    <Badge className="text-[7px] uppercase border-none bg-violet-100 dark:bg-violet-500/20 text-violet-600">
                                                                        €{p.precioPublicista} pub
                                                                    </Badge>
                                                                ) : null}
                                                                {stockBajo && <Badge className="text-[7px] bg-amber-100 text-amber-600 border-none">⚠ Stock bajo</Badge>}
                                                            </div>
                                                            {esM2 ? (
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    Rollos: <span className="font-black text-blue-500">{p.rollosEnStock ?? 0}</span>
                                                                    <span className="text-[8px] ml-1">(contador manual)</span>
                                                                </p>
                                                            ) : p.tieneVariantes ? (
                                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                                    {p.variantes.map(v => (
                                                                        <span key={v.id} className={cn(
                                                                            'text-[8px] px-2.5 py-1 rounded-lg font-black uppercase',
                                                                            v.stock <= v.stockMinimo ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                                                                        )}>
                                                                            {v.nombre}: {v.stock} {v.stock <= v.stockMinimo ? '⚠' : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    Stock: <span className={cn('font-black', stockBajo ? 'text-amber-500' : 'text-emerald-600')}>{stockTotal} {p.unidadLabel}</span>
                                                                    {' · '}Mínimo: {p.stockMinimo}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {isAdmin && (
                                                            <div className="flex gap-2 shrink-0">
                                                                {esM2 ? (
                                                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
                                                                        <button onClick={() => updateRollosEnStock(p.id!, (p.rollosEnStock ?? 1) - 1)}
                                                                            className="w-7 h-7 rounded-lg bg-white dark:bg-black/20 font-black text-base shadow-sm flex items-center justify-center">−</button>
                                                                        <span className="px-2 font-black text-sm">{p.rollosEnStock ?? 0}</span>
                                                                        <button onClick={() => updateRollosEnStock(p.id!, (p.rollosEnStock ?? 0) + 1)}
                                                                            className="w-7 h-7 rounded-lg bg-white dark:bg-black/20 font-black text-base shadow-sm flex items-center justify-center">+</button>
                                                                    </div>
                                                                ) : (
                                                                    <Button variant="outline" size="sm" onClick={() => openStockModal(p)}
                                                                        className="h-9 rounded-xl text-[9px] font-black uppercase border-black/10 px-4">
                                                                        <ArrowUpCircle className="w-3 h-3 mr-1" /> Editar Stock
                                                                    </Button>
                                                                )}
                                                                <Button variant="outline" size="sm" onClick={() => openEditProduct(p)}
                                                                    className="h-9 rounded-xl text-[9px] font-black uppercase border-black/10 px-4">
                                                                    <Pencil className="w-3 h-3 mr-1" /> Editar
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </TabsContent>

                {/* ============================================================
                    SHEET: CARRITO — accesible desde cualquier tab (portal)
                ============================================================ */}
                <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-slate-50 dark:bg-[#111] border-0 p-6 flex flex-col gap-5">
                        <SheetHeader>
                            <SheetTitle className="font-black text-xl uppercase italic tracking-tighter flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5" /> Carrito · {cart.length} ítem(s)
                                {cart.length > 0 && (
                                    <Button variant="ghost" size="sm" onClick={clearCart} className="ml-auto text-red-500 text-[10px] font-black uppercase rounded-xl h-8">
                                        <X className="w-3 h-3 mr-1" /> Limpiar
                                    </Button>
                                )}
                            </SheetTitle>
                        </SheetHeader>

                        {/* Lista de ítems */}
                        <div className="space-y-3 flex-1">
                            {cart.length === 0 ? (
                                <div className="text-center py-16 opacity-40 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem]">
                                    <ShoppingCart className="w-12 h-12 mx-auto mb-3" />
                                    <p className="font-bold uppercase text-xs">Carrito vacío</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Ve al Catálogo y añade productos</p>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {cart.map(item => (
                                        <motion.div key={item.key}
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-white dark:bg-[#1c1c1e] p-4 rounded-[1.5rem] shadow-sm border border-black/5 dark:border-white/5 flex justify-between items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-sm uppercase italic dark:text-white">{item.productoNombre}</h4>
                                                {item.varianteNombre && <p className="text-[9px] text-slate-400 font-bold uppercase">{item.varianteNombre}</p>}
                                                {item.tipoVenta === 'metro_cuadrado' && (
                                                    <p className="text-[9px] text-blue-500 font-black uppercase mt-0.5">
                                                        {item.cmAlto}×{item.cmAncho}cm · {item.m2Total?.toFixed(2)} m²
                                                    </p>
                                                )}
                                                <p className="text-[9px] text-slate-400 mt-0.5">
                                                    {item.cantidad} × {item.monedaPrecio === 'EUR' ? `€${item.precioBase}` : formatUSD(item.precioBase)}
                                                    {item.tipoVenta === 'metro_cuadrado' ? '/m²' : ''}
                                                    {item.tipoCliente === 'publicista' && <span className="ml-1 text-violet-500 font-black">·Pub</span>}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <p className={cn("font-black text-lg", item.tipoCliente === 'publicista' ? "text-violet-600" : "text-blue-600")}>
                                                    {item.monedaPrecio === 'EUR' ? `€${(item.subtotalUSD * (rates.usd || 1) / (rates.eur || 1)).toFixed(2)}` : formatUSD(item.subtotalUSD)}
                                                </p>
                                                <button onClick={() => removeFromCart(item.key)} className="p-1.5 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}

                            <Button variant="outline" onClick={() => { setIsCartOpen(false) }}
                                className="w-full h-12 rounded-[2rem] border-dashed border-black/20 dark:border-white/20 font-black uppercase text-xs text-slate-500">
                                <Plus className="w-4 h-4 mr-2" /> Añadir más productos
                            </Button>
                        </div>

                        {/* Checkout */}
                        <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] shadow-sm border border-black/5 dark:border-white/5 space-y-5">
                            <h3 className="font-black text-base uppercase italic tracking-tighter">Resumen de Venta</h3>

                            {/* Buscador de cliente */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">
                                    <User className="w-3 h-3 inline-block mr-1" /> Cliente
                                </Label>
                                <div className="relative">
                                    {clienteSeleccionado ? (
                                        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 p-3 rounded-2xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm text-blue-800 dark:text-blue-300 truncate">{clienteSeleccionado.nombreRazonSocial}</p>
                                                <div className="flex gap-3 mt-0.5">
                                                    {clienteSeleccionado.rifCedulaCompleto && (
                                                        <span className="text-[9px] text-slate-500 font-bold">{clienteSeleccionado.rifCedulaCompleto}</span>
                                                    )}
                                                    {clienteSeleccionado.telefonoCompleto && (
                                                        <span className="text-[9px] text-slate-500 font-bold">
                                                            <Phone className="w-2.5 h-2.5 inline-block mr-0.5" />{clienteSeleccionado.telefonoCompleto}
                                                        </span>
                                                    )}
                                                    {clienteSeleccionado.tipoCliente === 'ALIADO' && (
                                                        <Badge className="text-[7px] bg-violet-100 text-violet-600 border-none">Aliado</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={handleLimpiarCliente} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                                <Input
                                                    placeholder="Buscar por nombre, RIF o teléfono..."
                                                    value={clienteSearch}
                                                    onChange={e => { setClienteSearch(e.target.value); setShowClienteDropdown(true) }}
                                                    onFocus={() => setShowClienteDropdown(true)}
                                                    className="h-12 pl-9 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-sm"
                                                />
                                            </div>
                                            {showClienteDropdown && clientesFiltrados.length > 0 && (
                                                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
                                                    {clientesFiltrados.map(c => (
                                                        <button key={c.id} onClick={() => handleSeleccionarCliente(c)}
                                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 last:border-0">
                                                            <p className="font-black text-sm dark:text-white">{c.nombreRazonSocial}</p>
                                                            <div className="flex gap-3 mt-0.5">
                                                                <span className="text-[9px] text-slate-400">{c.rifCedulaCompleto}</span>
                                                                <span className="text-[9px] text-slate-400">{c.telefonoCompleto}</span>
                                                                {c.tipoCliente === 'ALIADO' && <span className="text-[9px] text-violet-500 font-bold">Aliado</span>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                    <button onClick={() => setShowClienteDropdown(false)}
                                                        className="w-full px-4 py-2 text-center text-[9px] text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5">
                                                        Cerrar
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Método de pago */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Método de Pago</Label>
                                <Select value={metodoPago} onValueChange={setMetodoPago}>
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        {METODOS_PAGO.map(m => <SelectItem key={m} value={m} className="font-bold text-xs">{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Moneda */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Moneda de Cobro</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MONEDAS.map(m => (
                                        <button key={m.value} onClick={() => setMoneda(m.value)}
                                            className={cn('px-3 py-2.5 rounded-xl border font-black text-[9px] uppercase transition-all',
                                                moneda === m.value
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                    : 'border-black/10 dark:border-white/10 text-slate-500 hover:border-blue-300')}>
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Notas (opcional)</Label>
                                <Textarea placeholder="Observaciones..."
                                    value={notasVenta} onChange={e => setNotasVenta(e.target.value)}
                                    className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none text-sm resize-none min-h-[60px]" />
                            </div>

                            {/* Total */}
                            <div className="bg-slate-900 dark:bg-white text-white dark:text-black p-5 rounded-[2rem] space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="opacity-60 font-bold">Total USD</span>
                                    <span className="font-black">{formatUSD(cartTotal)}</span>
                                </div>
                                {moneda !== 'USD' && (
                                    <div className="flex justify-between border-t border-white/10 dark:border-black/10 pt-3">
                                        <span className="opacity-60 font-bold text-sm">Total {moneda}</span>
                                        <span className="font-black text-2xl">{getCurrencySymbol(moneda)}{convertAmount(cartTotal, moneda).toFixed(2)}</span>
                                    </div>
                                )}
                                {moneda !== 'USD' && (
                                    <p className="text-[9px] opacity-50 text-center">
                                        Tasa: 1 USD = {getRateForMoneda(moneda).toFixed(2)} {moneda}
                                    </p>
                                )}
                                <Button onClick={handleCheckout} disabled={cart.length === 0}
                                    className="w-full h-14 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest disabled:opacity-50">
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    Confirmar Venta
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

                {/* ========== TAB: HISTORIAL ========== */}
                <TabsContent value="historial" className="mt-0 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-base uppercase italic tracking-tighter">
                            <History className="w-5 h-5 inline-block mr-2" />
                            {ventas.length} venta(s) registrada(s)
                        </h3>
                    </div>

                    {ventas.length === 0 ? (
                        <div className="text-center py-20 opacity-40">
                            <History className="w-12 h-12 mx-auto mb-3" />
                            <p className="font-bold uppercase text-xs">Sin ventas todavía</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {ventas.map(venta => (
                                <motion.div key={venta.id}
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        'bg-white dark:bg-[#1c1c1e] p-5 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5',
                                        venta.estado === 'ANULADA' && 'opacity-50'
                                    )}>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-black text-sm uppercase italic dark:text-white">
                                                    {venta.clienteNombre || 'Cliente Anónimo'}
                                                </p>
                                                <Badge className={cn('text-[7px] border-none font-black uppercase',
                                                    venta.estado === 'ANULADA' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}>
                                                    {venta.estado}
                                                </Badge>
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                                                {formatDate(venta.fecha)} · {venta.metodoPago} · {venta.items.length} ítem(s)
                                            </p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">
                                                Registrado por: {venta.registradoPor}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className="font-black text-xl text-emerald-600">{formatUSD(venta.totalUSD)}</p>
                                                {venta.moneda !== 'USD' && (
                                                    <p className="text-[9px] text-slate-400">
                                                        {getCurrencySymbol(venta.moneda as Moneda)}{venta.totalLocal.toFixed(2)} {venta.moneda}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => { setSelectedVenta(venta); setIsReceiptOpen(true) }}
                                                    className="h-9 rounded-xl text-[9px] font-black uppercase border-black/10 px-3">
                                                    <Eye className="w-3 h-3 mr-1" /> Recibo
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleGenerarPDF(venta)}
                                                    className="h-9 rounded-xl text-[9px] font-black uppercase border-black/10 px-3">
                                                    <FileDown className="w-3 h-3 mr-1" /> PDF
                                                </Button>
                                                {isAdmin && venta.estado !== 'ANULADA' && (
                                                    <Button variant="outline" size="sm"
                                                        onClick={async () => { if (confirm('¿Anular esta venta?')) { await anularVentaCatalogo(venta.id!); toast.success('Venta anulada') } }}
                                                        className="h-9 rounded-xl text-[9px] font-black uppercase border-red-200 text-red-500 hover:bg-red-50 px-3">
                                                        <X className="w-3 h-3 mr-1" /> Anular
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </TabsContent>
            </Tabs>

            {/* ============================================================
                MODAL: CONFIGURAR ÍTEM PARA CARRITO
            ============================================================ */}
            <Dialog open={isCartItemModalOpen} onOpenChange={setIsCartItemModalOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">
                            {configProduct?.nombre}
                        </DialogTitle>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {configProduct?.tipoVenta === 'metro_cuadrado' ? `$${configProduct.precioBase}/m²` : `$${configProduct?.precioBase}/${configProduct?.unidadLabel}`}
                            {configProduct?.precioPublicista ? ` · €${configProduct.precioPublicista} publicista` : ''}
                        </p>
                    </DialogHeader>
                    {configProduct && (
                        <div className="space-y-4">
                            {/* Tipo de cliente */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setCartConfig(p => ({ ...p, tipoCliente: 'general' }))}
                                    className={cn(
                                        "h-12 rounded-2xl font-black text-xs uppercase tracking-wider transition-all",
                                        cartConfig.tipoCliente === 'general'
                                            ? "bg-blue-600 text-white shadow-lg scale-[1.02]"
                                            : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                                    )}
                                >
                                    <DollarSign className="w-3.5 h-3.5 inline-block mr-1" />
                                    General (USD)
                                </button>
                                <button
                                    onClick={() => setCartConfig(p => ({ ...p, tipoCliente: 'publicista' }))}
                                    disabled={!configProduct.precioPublicista}
                                    className={cn(
                                        "h-12 rounded-2xl font-black text-xs uppercase tracking-wider transition-all",
                                        cartConfig.tipoCliente === 'publicista'
                                            ? "bg-violet-600 text-white shadow-lg scale-[1.02]"
                                            : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10",
                                        !configProduct.precioPublicista && "opacity-40 cursor-not-allowed"
                                    )}
                                >
                                    <span className="mr-1 font-black">€</span>
                                    Publicista
                                </button>
                            </div>

                            {/* Selector de variante */}
                            {configProduct.tieneVariantes && configProduct.variantes.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Variante / Color *</Label>
                                    <Select value={cartConfig.varianteId} onValueChange={v => setCartConfig(p => ({ ...p, varianteId: v }))}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            {configProduct.variantes.map(v => (
                                                <SelectItem key={v.id} value={v.id} className="font-bold text-xs">
                                                    {v.nombre} — Stock: {v.stock}
                                                    {v.precioAjuste && v.precioAjuste !== 0 ? ` (${v.precioAjuste > 0 ? '+' : ''}$${v.precioAjuste})` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Medidas para m² */}
                            {configProduct.tipoVenta === 'metro_cuadrado' && (
                                <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-2xl space-y-3">
                                    <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest">
                                        <Ruler className="w-3 h-3 inline-block mr-1" />
                                        Medidas (se calcula igual que la calculadora)
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase text-slate-400 ml-1">Alto (cm)</Label>
                                            <Input type="number" placeholder="Ej. 100"
                                                value={cartConfig.cmAlto || ''} onChange={e => setCartConfig(p => ({ ...p, cmAlto: parseFloat(e.target.value) || 0 }))}
                                                className="h-12 rounded-xl bg-white dark:bg-black/20 border-none font-black text-center" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase text-slate-400 ml-1">Ancho (cm)</Label>
                                            <Input type="number" placeholder="Ej. 200"
                                                value={cartConfig.cmAncho || ''} onChange={e => setCartConfig(p => ({ ...p, cmAncho: parseFloat(e.target.value) || 0 }))}
                                                className="h-12 rounded-xl bg-white dark:bg-black/20 border-none font-black text-center" />
                                        </div>
                                    </div>
                                    {cartConfig.cmAlto > 0 && cartConfig.cmAncho > 0 && (() => {
                                        const { precio, moneda } = calcularPrecioCart()
                                        const { m2Unitario, precioUnitario } = calcPrecioM2(precio, cartConfig.cmAlto, cartConfig.cmAncho)
                                        const simbol = moneda === 'EUR' ? '€' : '$'
                                        return (
                                            <div className={cn("text-white px-4 py-2 rounded-xl flex justify-between items-center text-sm", cartConfig.tipoCliente === 'publicista' ? "bg-violet-500" : "bg-blue-500")}>
                                                <span className="font-bold text-[9px] opacity-80 uppercase">{m2Unitario.toFixed(3)} m² × {simbol}{precio}</span>
                                                <span className="font-black">{simbol}{precioUnitario.toFixed(2)}</span>
                                            </div>
                                        )
                                    })()}
                                </div>
                            )}

                            {/* Cantidad */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cantidad</Label>
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-white/5 rounded-2xl p-2">
                                    <button onClick={() => setCartConfig(p => ({ ...p, cantidad: Math.max(1, p.cantidad - 1) }))}
                                        className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 font-black text-xl shadow-sm flex items-center justify-center">−</button>
                                    <span className="flex-1 text-center font-black text-xl">{cartConfig.cantidad}</span>
                                    <button onClick={() => setCartConfig(p => ({ ...p, cantidad: p.cantidad + 1 }))}
                                        className="w-10 h-10 rounded-xl bg-white dark:bg-black/20 font-black text-xl shadow-sm flex items-center justify-center">+</button>
                                </div>
                            </div>

                            {/* Subtotal preview */}
                            {calcularSubtotalCart() > 0 && (() => {
                                const { moneda, subtotalEnMoneda } = calcularPrecioCart() as any
                                const isPublicista = cartConfig.tipoCliente === 'publicista'
                                return (
                                    <div className={cn("text-white px-5 py-4 rounded-2xl flex justify-between items-center", isPublicista ? "bg-violet-600" : "bg-emerald-500")}>
                                        <div>
                                            <span className="text-[9px] font-black uppercase opacity-80">Subtotal</span>
                                            {isPublicista && <p className="text-[8px] opacity-70 font-bold">Precio Publicista</p>}
                                        </div>
                                        <span className="text-2xl font-black italic">
                                            {moneda === 'EUR' ? `€${(subtotalEnMoneda ?? 0).toFixed(2)}` : formatUSD(subtotalEnMoneda ?? 0)}
                                        </span>
                                    </div>
                                )
                            })()}

                            <Button onClick={addToCart} className="w-full h-14 rounded-[2rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest">
                                <ShoppingCart className="w-4 h-4 mr-2" /> Añadir al Carrito
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ============================================================
                MODAL: CREAR / EDITAR PRODUCTO
            ============================================================ */}
            <Dialog open={isProdModalOpen} onOpenChange={v => { setIsProdModalOpen(v); if (!v) setEditingProd(null) }}>
                <DialogContent className="sm:max-w-xl rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
                            {editingProd ? 'Editar Producto' : 'Nuevo Producto'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nombre *</Label>
                            <Input value={prodForm.nombre} onChange={e => setProdForm(p => ({ ...p, nombre: e.target.value }))}
                                placeholder="Ej. Vinil Adhesivo, Acrílico 3mm..."
                                className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                        </div>

                        {/* Descripción */}
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Descripción (opcional)</Label>
                            <Textarea value={prodForm.descripcion || ''} onChange={e => setProdForm(p => ({ ...p, descripcion: e.target.value }))}
                                placeholder="Detalles del producto..."
                                className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none resize-none min-h-[60px] text-sm" />
                        </div>

                        {/* Categoría */}
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Categoría *</Label>
                            <Select value={prodForm.categoriaId} onValueChange={v => setProdForm(p => ({ ...p, categoriaId: v }))}>
                                <SelectTrigger className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                    <SelectValue placeholder="Seleccionar categoría..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {categorias.map(c => <SelectItem key={c.id} value={c.id!} className="font-bold text-xs">{c.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tipo de venta */}
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setProdForm(p => ({ ...p, tipoVenta: 'unidad' }))}
                                className={cn('p-4 rounded-2xl border text-left transition-all',
                                    prodForm.tipoVenta === 'unidad' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-black/10 dark:border-white/10')}>
                                <p className="font-black text-xs uppercase text-blue-600">Por Unidad</p>
                                <p className="text-[9px] text-slate-400">Piezas, láminas, rollos</p>
                            </button>
                            <button onClick={() => setProdForm(p => ({ ...p, tipoVenta: 'metro_cuadrado' }))}
                                className={cn('p-4 rounded-2xl border text-left transition-all',
                                    prodForm.tipoVenta === 'metro_cuadrado' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-black/10 dark:border-white/10')}>
                                <p className="font-black text-xs uppercase text-blue-600">Por m²</p>
                                <p className="text-[9px] text-slate-400">Vinil, banner, impresión</p>
                            </button>
                        </div>

                        {/* Precio y etiqueta */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">
                                    Precio General (USD) {prodForm.tipoVenta === 'metro_cuadrado' ? '/ m²' : '/ unidad'} *
                                </Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <Input type="number" placeholder="0.00" value={prodForm.precioBase || ''}
                                        onChange={e => setProdForm(p => ({ ...p, precioBase: parseFloat(e.target.value) || 0 }))}
                                        className="h-12 pl-8 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">
                                    Precio Publicista (EUR) {prodForm.tipoVenta === 'metro_cuadrado' ? '/ m²' : '/ unidad'}
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-violet-400">€</span>
                                    <Input type="number" placeholder="0.00" value={prodForm.precioPublicista || ''}
                                        onChange={e => setProdForm(p => ({ ...p, precioPublicista: parseFloat(e.target.value) || 0 }))}
                                        className="h-12 pl-8 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border-none font-black" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Etiqueta de Unidad</Label>
                                <Select value={prodForm.unidadLabel} onValueChange={v => setProdForm(p => ({ ...p, unidadLabel: v }))}>
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        {UNIDADES_LABEL.map(u => <SelectItem key={u} value={u} className="font-bold text-xs capitalize">{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Stock mínimo (solo para productos sin variantes) */}
                        {/* Stock: lógica diferente según tipo de venta */}
                        {prodForm.tipoVenta === 'metro_cuadrado' ? (
                            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 p-4 rounded-2xl space-y-3">
                                <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest">
                                    📦 Inventario de Rollos (opcional)
                                </p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                    Los materiales por m² (vinil, banner) no llevan conteo de m² — solo puedes registrar cuántos rollos físicos tienes. El contador de rollos es manual.
                                </p>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Rollos en Stock</Label>
                                    <Input type="number" placeholder="0" value={prodForm.rollosEnStock || ''}
                                        onChange={e => setProdForm(p => ({ ...p, rollosEnStock: parseInt(e.target.value) || 0 }))}
                                        className="h-12 rounded-2xl bg-white dark:bg-black/20 border-none font-black text-center" />
                                </div>
                            </div>
                        ) : !prodForm.tieneVariantes && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Stock Inicial</Label>
                                    <Input type="number" value={prodForm.stockSimple || ''}
                                        onChange={e => setProdForm(p => ({ ...p, stockSimple: parseInt(e.target.value) || 0 }))}
                                        className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black text-center" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Stock Mínimo</Label>
                                    <Input type="number" value={prodForm.stockMinimo || ''}
                                        onChange={e => setProdForm(p => ({ ...p, stockMinimo: parseInt(e.target.value) || 0 }))}
                                        className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black text-center" />
                                </div>
                            </div>
                        )}

                        {/* Toggle variantes */}
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                            <div>
                                <p className="font-black text-xs uppercase">Tiene variantes / colores</p>
                                <p className="text-[9px] text-slate-400">Ej. Acrílico blanco, negro, transparente</p>
                            </div>
                            <Switch checked={prodForm.tieneVariantes} onCheckedChange={v => setProdForm(p => ({ ...p, tieneVariantes: v }))} />
                        </div>

                        {/* Gestión de variantes */}
                        {prodForm.tieneVariantes && (
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl space-y-3">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Variantes / Colores / Tamaños</p>

                                {prodForm.variantes.map(v => (
                                    <div key={v.id} className="flex items-center gap-2 bg-white dark:bg-black/20 p-3 rounded-xl border border-black/5">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-xs uppercase truncate">{v.nombre}</p>
                                            <p className="text-[8px] text-slate-400">Stock: {v.stock} · Mín: {v.stockMinimo}</p>
                                        </div>
                                        <button onClick={() => removeVarianteFromForm(v.id)} className="text-red-400 hover:text-red-600 p-1 rounded-lg transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}

                                <div className="grid grid-cols-5 gap-2">
                                    <div className="col-span-2">
                                        <Input placeholder="Nombre variante" value={prodVarianteInput.nombre}
                                            onChange={e => setProdVarianteInput(p => ({ ...p, nombre: e.target.value }))}
                                            className="h-10 rounded-xl bg-white dark:bg-black/20 border-none text-xs font-bold" />
                                    </div>
                                    <div>
                                        <Input type="number" placeholder="Stock" value={prodVarianteInput.stock || ''}
                                            onChange={e => setProdVarianteInput(p => ({ ...p, stock: parseInt(e.target.value) || 0 }))}
                                            className="h-10 rounded-xl bg-white dark:bg-black/20 border-none text-xs font-black text-center" />
                                    </div>
                                    <div>
                                        <Input type="number" placeholder="Mín." value={prodVarianteInput.stockMinimo || ''}
                                            onChange={e => setProdVarianteInput(p => ({ ...p, stockMinimo: parseInt(e.target.value) || 0 }))}
                                            className="h-10 rounded-xl bg-white dark:bg-black/20 border-none text-xs font-black text-center" />
                                    </div>
                                    <Button onClick={addVarianteToForm} size="sm"
                                        className="h-10 rounded-xl bg-blue-600 text-white font-black">
                                        <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                                <p className="text-[8px] text-slate-400">Nombre · Stock inicial · Stock mínimo</p>
                            </div>
                        )}

                        <Button onClick={handleSaveProd}
                            className="w-full h-14 rounded-[2rem] bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-black uppercase tracking-widest">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> {editingProd ? 'Guardar Cambios' : 'Crear Producto'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ============================================================
                MODAL: CATEGORÍAS
            ============================================================ */}
            <Dialog open={isCatModalOpen} onOpenChange={v => { setIsCatModalOpen(v); if (!v) setEditingCat(null) }}>
                <DialogContent className="sm:max-w-lg rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Gestionar Categorías</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5">
                        {/* Lista de categorías existentes */}
                        {categorias.length > 0 && (
                            <div className="space-y-2">
                                {categorias.map(cat => {
                                    const cs = getColorStyle(cat.color)
                                    const prodCount = productos.filter(p => p.categoriaId === cat.id).length
                                    return (
                                        <div key={cat.id} className={cn('flex items-center justify-between p-3 rounded-2xl', cs.bg)}>
                                            <div className="flex items-center gap-3">
                                                <div className={cn('w-3 h-3 rounded-full', `bg-${cat.color}-500`)} />
                                                <div>
                                                    <p className={cn('font-black text-sm uppercase', cs.text)}>{cat.nombre}</p>
                                                    <p className={cn('text-[8px]', cs.text, 'opacity-60')}>{prodCount} producto(s)</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingCat(cat); setCatForm({ ...cat }); }}
                                                    className={cn('p-1.5 rounded-lg', cs.text, 'hover:opacity-70 transition-opacity')}>
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteCat(cat)}
                                                    className="p-1.5 rounded-lg text-red-500 hover:opacity-70 transition-opacity">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Form nueva / editar categoría */}
                        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl space-y-3">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                {editingCat ? `Editando: ${editingCat.nombre}` : 'Nueva Categoría'}
                            </p>
                            <div className="space-y-2">
                                <Input placeholder="Nombre de la categoría" value={catForm.nombre}
                                    onChange={e => setCatForm(p => ({ ...p, nombre: e.target.value }))}
                                    className="h-12 rounded-2xl bg-white dark:bg-black/20 border-none font-bold" />
                                <Input placeholder="Descripción (opcional)" value={catForm.descripcion || ''}
                                    onChange={e => setCatForm(p => ({ ...p, descripcion: e.target.value }))}
                                    className="h-10 rounded-2xl bg-white dark:bg-black/20 border-none text-sm" />
                            </div>
                            <div>
                                <p className="text-[8px] font-black uppercase text-slate-400 mb-2">Color</p>
                                <div className="flex flex-wrap gap-2">
                                    {COLORES_CATEGORIA.map(c => (
                                        <button key={c.value} onClick={() => setCatForm(p => ({ ...p, color: c.value }))}
                                            className={cn('w-8 h-8 rounded-xl border-2 transition-all', c.bg,
                                                catForm.color === c.value ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent')}
                                            title={c.label} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {editingCat && (
                                    <Button variant="outline" onClick={() => { setEditingCat(null); setCatForm({ ...CAT_DEFAULT }) }}
                                        className="flex-1 h-12 rounded-2xl border-black/10 font-black text-xs uppercase">
                                        Cancelar
                                    </Button>
                                )}
                                <Button onClick={handleSaveCat} className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs">
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    {editingCat ? 'Actualizar' : 'Crear Categoría'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ============================================================
                MODAL: EDITAR STOCK
            ============================================================ */}
            <Dialog open={isStockModalOpen} onOpenChange={v => { setIsStockModalOpen(v); if (!v) setStockProduct(null) }}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Editar Stock</DialogTitle>
                        {stockProduct && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{stockProduct.nombre}</p>}
                    </DialogHeader>
                    {stockProduct && (
                        <div className="space-y-4">
                            {stockProduct.tieneVariantes ? (
                                stockProduct.variantes.map(v => (
                                    <div key={v.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                        <div className="flex-1">
                                            <p className="font-black text-xs uppercase">{v.nombre}</p>
                                            <p className="text-[8px] text-slate-400">Mínimo: {v.stockMinimo}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setStockEdits(p => ({ ...p, [v.id]: Math.max(0, (p[v.id] ?? v.stock) - 1) }))}
                                                className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 font-black text-xl shadow-sm flex items-center justify-center">−</button>
                                            <Input type="number" value={stockEdits[v.id] ?? v.stock}
                                                onChange={e => setStockEdits(p => ({ ...p, [v.id]: parseInt(e.target.value) || 0 }))}
                                                className="w-16 h-9 rounded-xl text-center font-black border-none bg-white dark:bg-black/20" />
                                            <button onClick={() => setStockEdits(p => ({ ...p, [v.id]: (p[v.id] ?? v.stock) + 1 }))}
                                                className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 font-black text-xl shadow-sm flex items-center justify-center">+</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                    <div className="flex-1">
                                        <p className="font-black text-xs uppercase">Stock actual</p>
                                        <p className="text-[8px] text-slate-400">Mínimo: {stockProduct.stockMinimo}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setStockEdits(p => ({ ...p, simple: Math.max(0, (p.simple ?? stockProduct.stockSimple) - 1) }))}
                                            className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 font-black text-xl shadow-sm flex items-center justify-center">−</button>
                                        <Input type="number" value={stockEdits['simple'] ?? stockProduct.stockSimple}
                                            onChange={e => setStockEdits(p => ({ ...p, simple: parseInt(e.target.value) || 0 }))}
                                            className="w-16 h-9 rounded-xl text-center font-black border-none bg-white dark:bg-black/20" />
                                        <button onClick={() => setStockEdits(p => ({ ...p, simple: (p.simple ?? stockProduct.stockSimple) + 1 }))}
                                            className="w-9 h-9 rounded-xl bg-white dark:bg-black/20 font-black text-xl shadow-sm flex items-center justify-center">+</button>
                                    </div>
                                </div>
                            )}
                            <Button onClick={handleSaveStock} className="w-full h-14 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Guardar Stock
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ============================================================
                MODAL: RECIBO DE VENTA
            ============================================================ */}
            <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-0 overflow-hidden max-h-[90vh]">
                    {selectedVenta && (
                        <div>
                            <div className="bg-slate-900 p-6 text-white text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Recibo de Venta</p>
                                <h3 className="text-xl font-black italic tracking-tighter">{selectedVenta.clienteNombre || 'Cliente Anónimo'}</h3>
                                <p className="text-[9px] text-slate-400 mt-1">{formatDate(selectedVenta.fecha)} · {selectedVenta.metodoPago}</p>
                                <Badge className={cn('mt-2 text-[7px] border-none font-black uppercase',
                                    selectedVenta.estado === 'ANULADA' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')}>
                                    {selectedVenta.estado}
                                </Badge>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                                <div className="space-y-2">
                                    {selectedVenta.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-start py-2 border-b border-black/5 dark:border-white/5">
                                            <div className="flex-1 min-w-0 pr-4">
                                                <p className="font-black text-xs uppercase">{item.productoNombre}</p>
                                                {item.varianteNombre && <p className="text-[9px] text-slate-400">{item.varianteNombre}</p>}
                                                {item.tipoVenta === 'metro_cuadrado' ? (
                                                    <p className="text-[9px] text-blue-500">{item.cmAlto}×{item.cmAncho}cm · {item.m2Total?.toFixed(2)} m²</p>
                                                ) : (
                                                    <p className="text-[9px] text-slate-400">{item.cantidad} × {formatUSD(item.precioBase)}</p>
                                                )}
                                            </div>
                                            <p className="font-black text-sm shrink-0">{formatUSD(item.subtotalUSD)}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-60">Total USD</span>
                                        <span className="font-black">{formatUSD(selectedVenta.totalUSD)}</span>
                                    </div>
                                    {selectedVenta.moneda !== 'USD' && (
                                        <div className="flex justify-between border-t border-white/10 pt-2">
                                            <span className="opacity-60 text-sm">Total {selectedVenta.moneda}</span>
                                            <span className="font-black text-lg">
                                                {getCurrencySymbol(selectedVenta.moneda as Moneda)}{selectedVenta.totalLocal.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {selectedVenta.notas && (
                                    <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-2xl">
                                        <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Notas</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300">{selectedVenta.notas}</p>
                                    </div>
                                )}
                                <p className="text-center text-[9px] text-slate-400 uppercase tracking-widest">
                                    Registrado por {selectedVenta.registradoPor}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ============================================================
// SUB-COMPONENTE KPI
// ============================================================
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const map: Record<string, string> = {
        blue:    'bg-blue-100 dark:bg-blue-500/10 text-blue-600',
        emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600',
        amber:   'bg-amber-100 dark:bg-amber-500/10 text-amber-600',
        indigo:  'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600',
    }
    return (
        <Card className="rounded-[2rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm p-5 flex items-center gap-4">
            <div className={cn('p-3 rounded-[1.2rem] shrink-0', map[color] || map.blue)}>{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
                <p className="text-xl font-black italic tracking-tighter truncate">{value}</p>
            </div>
        </Card>
    )
}
