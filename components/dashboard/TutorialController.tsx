// @/components/dashboard/TutorialController.tsx
"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { X, Play, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// DATOS DEL SISTEMA — cada sección explicada
// ============================================================
const FEATURES = [
    {
        id: 'orders',
        icon: '📋',
        color: 'blue',
        title: 'Órdenes de Servicio',
        tagline: 'Registro y seguimiento de pedidos',
        bullets: [
            'Crea órdenes con el wizard paso a paso: cliente → ítems → confirmación',
            'Sigue el estado de cada trabajo: Pendiente → En Proceso → Entregado → Pagado',
            'Exporta presupuestos en PDF con logo, firma y sello',
            'Gestiona pagos parciales y registra abonos en múltiples monedas',
        ],
        tip: 'El wizard calcula automáticamente el precio de impresión por m² igual que la calculadora.'
    },
    {
        id: 'catalogo_ventas',
        icon: '🛍️',
        color: 'violet',
        title: 'Catálogo & Ventas',
        tagline: 'Inventario y punto de venta integrado',
        bullets: [
            'Crea categorías y productos con foto, variantes de color/tamaño y stock',
            'Dos tipos de precio: por unidad (fijo) o por m² (misma fórmula que la calculadora)',
            'Precio general en USD y precio preferencial en EUR para publicistas/agencias',
            'El carrito flotante (botón azul) está disponible desde cualquier pestaña',
            'Genera notas de entrega en PDF con todos los detalles del cliente',
        ],
        tip: 'Las tasas USD, EUR y USDT son las tasas en bolívares que configuras en el encabezado.'
    },
    {
        id: 'clients',
        icon: '👥',
        color: 'emerald',
        title: 'Clientes',
        tagline: 'Base de datos de clientes y cobranza',
        bullets: [
            'Registra clientes con RIF, teléfono, domicilio fiscal y correo',
            'Marca clientes como "Aliado" para precios especiales o tratamiento preferencial',
            'Ve el estado de cuenta consolidado de cada cliente: deuda total, historial de pagos',
            'Exporta el estado de cuenta en PDF para entregárselo al cliente',
        ],
        tip: 'Los clientes registrados aquí aparecen automáticamente en el wizard de órdenes y en el catálogo.'
    },
    {
        id: 'budget',
        icon: '📄',
        color: 'amber',
        title: 'Presupuestos',
        tagline: 'Cotizaciones rápidas sin crear orden',
        bullets: [
            'Genera presupuestos directos en PDF sin necesidad de crear una orden',
            'Soporta presupuestos maestros: agrupa ítems por sub-cliente dentro de un mismo documento',
            'Configura moneda de cobro: USD, EUR, USDT o Bolívares',
            'El PDF incluye logo, notas legales, firma y sello automáticamente',
        ],
        tip: 'Útil cuando el cliente pide una cotización antes de comprometerse con la orden.'
    },
    {
        id: 'financial_stats',
        icon: '📊',
        color: 'indigo',
        title: 'Estadísticas',
        tagline: 'Análisis financiero en tiempo real',
        bullets: [
            'Tres vistas: General (todo el negocio), Impresión, y Corte Láser',
            'KPIs principales: Ingresos reales, Egresos operativos y Utilidad Neta del período',
            'Gráfico de flujo de caja: haz clic en las barras para ver el desglose del día',
            'Análisis de deuda: quién te debe, cuánto hace y antigüedad de la cuenta',
        ],
        tip: 'Los ingresos del Catálogo de Ventas también suman aquí en la vista General.'
    },
    {
        id: 'task_control',
        icon: '✅',
        color: 'rose',
        title: 'Control de Tareas',
        tagline: 'Asignación y seguimiento de trabajo',
        bullets: [
            'El admin asigna tareas a empleados con nombre, descripción y valor en USD',
            'Los empleados ven sus tareas pendientes y marcan cuáles completaron',
            'Las tareas "Requieren Atención" son trabajos completados que esperan validación del admin',
            'Elimina tareas creadas por error con el botón de papelera (solo admin)',
        ],
        tip: '"Requieren Atención" = el empleado terminó el trabajo y espera que el admin lo valide y libere el pago.'
    },
    {
        id: 'wallets',
        icon: '💰',
        color: 'green',
        title: 'Caja & Billeteras',
        tagline: 'Control del flujo de efectivo',
        bullets: [
            'Múltiples carteras: Cash USD, Cash Bs, Banesco, Zelle, USDT, etc.',
            'Cada ingreso y pago registrado en el sistema se refleja aquí automáticamente',
            'Registra movimientos manuales (retiros, depósitos, transferencias entre cuentas)',
            'Ves el saldo disponible en cada forma de pago en tiempo real',
        ],
        tip: 'Las ventas del catálogo también se registran en la cartera correspondiente al método de pago elegido.'
    },
    {
        id: 'employees_mgmt',
        icon: '👤',
        color: 'slate',
        title: 'Personal',
        tagline: 'Gestión del equipo de trabajo',
        bullets: [
            'Registra empleados con rol (Vendedor, Diseñador, Impresor, Operador Láser...)',
            'Registra pagos de nómina en USD o en Bs con registro de quién pagó',
            'El rol determina qué vistas del sistema puede ver cada empleado',
            'Los empleados inactivos no pueden iniciar sesión aunque tengan cuenta',
        ],
        tip: 'Los roles ADMIN y PRODUCCION tienen acceso completo; los demás solo ven su área de trabajo.'
    },
    {
        id: 'calculator',
        icon: '🧮',
        color: 'orange',
        title: 'Calculadora',
        tagline: 'Precios de impresión por m²',
        bullets: [
            'Calcula el precio de cualquier impresión: ingresa medidas en cm y precio/m²',
            'La fórmula: máx(1, (alto/100 × ancho/100) × precio) × cantidad',
            'La misma fórmula se usa en las órdenes y en el catálogo de ventas',
            'Soporte para múltiples ítems con cantidades distintas en un solo cálculo',
        ],
        tip: 'El precio mínimo por pieza siempre es $1, incluso si las dimensiones dan menos.'
    },
    {
        id: 'rates',
        icon: '💱',
        color: 'cyan',
        title: 'Tasas de Cambio',
        tagline: 'BCV y paralelo para todos los cálculos',
        bullets: [
            'USD = tasa BCV dólar (bolívares por dólar), usada en pagos estándar',
            'EUR = tasa BCV euro (bolívares por euro), usada en precios publicista',
            'USDT = tasa paralelo (bolívares por USDT), usada en cobros paralelo',
            'Haz clic en cualquier badge del encabezado para actualizar la tasa del día',
        ],
        tip: 'Las tasas NO son el precio de la moneda en USD — son cuántos bolívares vale cada una.'
    },
]

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; dot: string }> = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-500/10',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-200 dark:border-blue-500/30',   badge: 'bg-blue-600',   dot: 'bg-blue-400' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-500/30', badge: 'bg-violet-600', dot: 'bg-violet-400' },
    emerald:{ bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-500/30', badge: 'bg-emerald-600', dot: 'bg-emerald-400' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-500/30',  badge: 'bg-amber-500',  dot: 'bg-amber-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-500/30', badge: 'bg-indigo-600', dot: 'bg-indigo-400' },
    rose:   { bg: 'bg-rose-50 dark:bg-rose-500/10',   text: 'text-rose-700 dark:text-rose-300',   border: 'border-rose-200 dark:border-rose-500/30',   badge: 'bg-rose-600',   dot: 'bg-rose-400' },
    green:  { bg: 'bg-green-50 dark:bg-green-500/10',  text: 'text-green-700 dark:text-green-300',  border: 'border-green-200 dark:border-green-500/30',  badge: 'bg-green-600',  dot: 'bg-green-400' },
    slate:  { bg: 'bg-slate-100 dark:bg-white/5',     text: 'text-slate-700 dark:text-slate-300',  border: 'border-slate-200 dark:border-white/10',     badge: 'bg-slate-600',  dot: 'bg-slate-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-500/30', badge: 'bg-orange-500', dot: 'bg-orange-400' },
    cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-500/10',   text: 'text-cyan-700 dark:text-cyan-300',   border: 'border-cyan-200 dark:border-cyan-500/30',   badge: 'bg-cyan-600',   dot: 'bg-cyan-400' },
}

// ============================================================
// TOURS PASO A PASO (driver.js)
// ============================================================
const TOURS: Record<string, any[]> = {
    orders: [
        { element: "#dashboard-header", popover: { title: "Panel de Órdenes", description: "Desde aquí gestionas todos los pedidos de tus clientes.", side: "bottom", align: 'start' } },
        { element: "#main-sidebar",     popover: { title: "Menú de Navegación", description: "Accede a todas las secciones del sistema.", side: "right", align: 'start' } },
        { element: "#tasas-container",  popover: { title: "Tasas de Cambio", description: "USD = BCV dólar · EUR = BCV euro · USDT = paralelo (todos en bolívares).", side: "bottom", align: 'end' } },
        { element: "#stats-grid",       popover: { title: "Métricas Rápidas", description: "Órdenes activas, deuda pendiente y órdenes entregadas de un vistazo.", side: "top", align: 'start' } },
        { element: "#btn-new-order",    popover: { title: "Nueva Orden", description: "Abre el wizard de 4 pasos para registrar un pedido nuevo.", side: "left", align: 'center' } },
    ],
    inventory_general: [
        { element: "#inventory-header", popover: { title: "Inventario General", description: "Controla el stock de materiales e insumos del taller.", side: "bottom", align: 'start' } },
        { element: "#btn-edit-mode",    popover: { title: "Modo Edición", description: "Activa para poder eliminar ítems o ajustar cantidades rápidamente.", side: "bottom", align: 'start' } },
        { element: "#inventory-tabs",   popover: { title: "Historial", description: "Alterna entre existencias actuales e historial de movimientos.", side: "top", align: 'start' } },
    ],
    catalogo_ventas: [
        { element: "#catalog-kpis",   popover: { title: "KPIs del Catálogo", description: "Productos activos, alertas de stock bajo, ventas de hoy y del mes.", side: "bottom", align: 'start' } },
        { element: "#catalog-tabs",   popover: { title: "Pestañas", description: "Catálogo (productos), Inventario (stock por variante) e Historial (ventas).", side: "bottom", align: 'start' } },
        { element: "#catalog-search", popover: { title: "Búsqueda y Filtros", description: "Busca por nombre o filtra por categoría para encontrar productos rápidamente.", side: "bottom", align: 'start' } },
    ],
    financial_stats: [
        { element: "#stats-header",        popover: { title: "Centro Financiero", description: "Filtra por mes y cambia entre vista General, Impresión o Corte.", side: "bottom", align: 'start' } },
        { element: "#financial-kpis",      popover: { title: "Indicadores Clave", description: "Ingresos reales cobrados, egresos operativos y utilidad neta del período.", side: "top", align: 'start' } },
        { element: "#main-chart-section",  popover: { title: "Flujo de Caja", description: "Barras de ingresos vs gastos día a día. Haz clic para ver el detalle.", side: "left", align: 'center' } },
        { element: "#debt-analysis-section", popover: { title: "Cobranza", description: "Monitorea deudas activas y su antigüedad.", side: "top", align: 'start' } },
    ],
    clients: [
        { element: "#clients-header",  popover: { title: "Gestión de Clientes", description: "Base de datos completa con RIF, teléfono y correo.", side: "bottom", align: 'start' } },
        { element: "#clients-search",  popover: { title: "Búsqueda", description: "Busca por nombre, RIF o teléfono.", side: "bottom", align: 'start' } },
    ],
    task_control: [
        { element: "#task-header",   popover: { title: "Control de Tareas", description: "Asigna trabajo a tu equipo y haz seguimiento del avance.", side: "bottom", align: 'start' } },
        { element: "#task-tabs",     popover: { title: "Pestañas", description: "Pendientes = en espera · Completadas = terminadas · Requieren Atención = esperan validación admin.", side: "bottom", align: 'start' } },
        { element: "#btn-new-task",  popover: { title: "Nueva Tarea", description: "Asigna trabajo con nombre, descripción y valor en USD.", side: "left", align: 'center' } },
    ],
    wallets: [
        { element: "#wallets-header",  popover: { title: "Caja y Billeteras", description: "Saldos en tiempo real de cada forma de pago.", side: "bottom", align: 'start' } },
        { element: "#wallets-grid",    popover: { title: "Carteras", description: "Cash USD, Cash Bs, Banesco, Zelle, USDT y más. Cada pago registrado actualiza el saldo.", side: "top", align: 'start' } },
    ],
    employees_mgmt: [
        { element: "#employees-header", popover: { title: "Gestión de Personal", description: "Registro de empleados, roles y nómina.", side: "bottom", align: 'start' } },
        { element: "#employees-list",   popover: { title: "Lista de Empleados", description: "El rol de cada empleado determina qué secciones puede ver en el sistema.", side: "top", align: 'start' } },
    ],
}

// ============================================================
// FUNCIÓN DE TOUR RÁPIDO (driver.js)
// ============================================================
export const startTour = (viewId: string) => {
    const steps = TOURS[viewId] || TOURS['orders']
    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        doneBtnText: '¡Entendido!',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Atrás',
        progressText: '{{current}} / {{total}}',
        stagePadding: 8,
        overlayOpacity: 0.55,
        steps,
    })
    driverObj.drive()
}

// ============================================================
// COMPONENTE: HELP MODAL
// ============================================================
interface HelpModalProps {
    open: boolean
    onClose: () => void
    activeView: string
    onNavigate?: (view: string) => void
}

export function HelpModal({ open, onClose, activeView, onNavigate }: HelpModalProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selected = FEATURES.find(f => f.id === selectedId)

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="fixed inset-4 md:inset-8 z-50 bg-white dark:bg-[#111] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-black/5 dark:border-white/5 shrink-0">
                            <div>
                                <h2 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white">
                                    🗺️ Guía del Sistema
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    Explora todas las funciones · Haz clic en una tarjeta para más detalles
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { startTour(activeView); onClose() }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider transition-colors"
                                >
                                    <Play className="w-3.5 h-3.5" /> Tour de esta vista
                                </button>
                                <button onClick={onClose} className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Body — grid de tarjetas + detalle lateral */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* Grid */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {FEATURES.map(f => {
                                        const c = COLOR_MAP[f.color]
                                        const isActive = f.id === activeView
                                        const isSelected = f.id === selectedId
                                        return (
                                            <motion.button
                                                key={f.id}
                                                whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedId(isSelected ? null : f.id)}
                                                className={cn(
                                                    'text-left p-5 rounded-[2rem] border-2 transition-all',
                                                    isSelected
                                                        ? cn(c.bg, c.border, 'shadow-lg')
                                                        : 'bg-slate-50 dark:bg-white/5 border-transparent hover:border-slate-200 dark:hover:border-white/10'
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-3">
                                                    <span className="text-3xl">{f.icon}</span>
                                                    <div className="flex gap-1 flex-wrap justify-end">
                                                        {isActive && (
                                                            <span className={cn('text-[7px] font-black uppercase px-2 py-0.5 rounded-full text-white', c.badge)}>
                                                                Aquí ahora
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="font-black text-sm uppercase italic tracking-tighter dark:text-white leading-tight">{f.title}</h3>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1 leading-relaxed">{f.tagline}</p>
                                                <div className="flex items-center gap-1 mt-3">
                                                    <span className={cn('text-[8px] font-black uppercase', isSelected ? c.text : 'text-slate-400')}>
                                                        {isSelected ? 'Cerrar' : 'Ver detalles'}
                                                    </span>
                                                    <ChevronRight className={cn('w-3 h-3 transition-transform', isSelected ? 'rotate-90' : '', isSelected ? c.text : 'text-slate-400')} />
                                                </div>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Panel de detalle */}
                            <AnimatePresence>
                                {selected && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: 340, opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                        className="shrink-0 border-l border-black/5 dark:border-white/5 overflow-hidden"
                                    >
                                        <div className="w-[340px] h-full overflow-y-auto p-6 space-y-5">
                                            {(() => {
                                                const c = COLOR_MAP[selected.color]
                                                return (
                                                    <>
                                                        <div className={cn('p-5 rounded-[2rem]', c.bg, 'border', c.border)}>
                                                            <span className="text-4xl block mb-3">{selected.icon}</span>
                                                            <h3 className={cn('font-black text-lg uppercase italic tracking-tighter', c.text)}>{selected.title}</h3>
                                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">{selected.tagline}</p>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <p className="text-[9px] font-black uppercase text-slate-400 ml-1">Funciones principales</p>
                                                            {selected.bullets.map((b, i) => (
                                                                <div key={i} className="flex gap-2.5 items-start">
                                                                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', c.dot)} />
                                                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">{b}</p>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {selected.tip && (
                                                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
                                                                <p className="text-[8px] font-black uppercase text-amber-600 mb-1.5">💡 Tip</p>
                                                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 leading-relaxed">{selected.tip}</p>
                                                            </div>
                                                        )}

                                                        <div className="flex flex-col gap-2 pt-2">
                                                            {onNavigate && selected.id !== activeView && (
                                                                <button
                                                                    onClick={() => { onNavigate(selected.id); onClose() }}
                                                                    className={cn('w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider text-white transition-colors', c.badge, 'hover:opacity-90')}
                                                                >
                                                                    Ir a {selected.title}
                                                                </button>
                                                            )}
                                                            {TOURS[selected.id] && (
                                                                <button
                                                                    onClick={() => { startTour(selected.id); onClose() }}
                                                                    className="w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
                                                                >
                                                                    <Play className="w-3.5 h-3.5" /> Tour paso a paso
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between shrink-0">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                SMR Sistema — {FEATURES.length} módulos disponibles
                            </p>
                            <p className="text-[9px] font-bold text-slate-400">
                                Selecciona una tarjeta para ver los detalles · Usa el Tour para guía paso a paso
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default function TutorialController() { return null }
