// @/components/dashboard/ConsumoMaterialesPanel.tsx
//
// CUÁNTO MATERIAL SE GASTÓ ESTE MES.
//
// Una tarjeta por material con sus metros totales; al tocarla se despliegan
// los servicios derivados con los metros de cada uno. Es la pregunta de
// reposición: da igual que el vinil saliera como impresión mate, como
// stickers o cortado en plóter — sigue siendo vinil saliendo del rollo, y
// para reponer hace falta el total.
//
// Suma DOS fuentes que antes no se hablaban:
//
//   1. Las ventas del catálogo (mostrador), que ya traían el material.
//   2. El desglose interno de los presupuestos, que es lo que rescata los
//      trabajos grandes facturados como un solo renglón.
//
// Las dos devuelven el mismo formato a propósito, así que aquí solo hay que
// unirlas. Lo que no esté desglosado no aparece: por eso el panel avisa
// cuando hay presupuestos sin clasificar, para que no se lea un total bajo
// como "se imprimió poco" cuando en realidad es "falta cargarlo".

"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Ruler, ChevronDown, Package, TrendingUp, TrendingDown,
    AlertTriangle, Boxes, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { consumoPorMaterial, type ConsumoMaterial, type VentaCatalogo } from '@/lib/services/catalog-service'
import { consumoDesdePresupuestos, unirConsumos, itemsSinClasificar } from '@/lib/services/subitems-service'
import { loadBudgetsFromFirestore, type DbBudgetEntry } from '@/lib/firebase/firestore-budget-service'

interface Props {
    ventasCatalogo?: any[]
    /** Inicio y fin del periodo que se está mirando en el panel. */
    inicio: Date
    fin: Date
}

const enRango = (valor: any, inicio: Date, fin: Date): boolean => {
    if (!valor) return false
    // Firestore devuelve Timestamp en unas colecciones y cadena ISO en otras.
    const fecha = typeof valor?.toDate === 'function' ? valor.toDate() : new Date(valor)
    if (isNaN(fecha.getTime())) return false
    return fecha >= inicio && fecha <= fin
}

const formatoM2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ConsumoMaterialesPanel({ ventasCatalogo = [], inicio, fin }: Props) {
    const [budgets, setBudgets] = useState<DbBudgetEntry[]>([])
    const [cargando, setCargando] = useState(true)
    const [abierto, setAbierto] = useState<string | null>(null)

    // Una sola lectura al montar. El filtro por fechas se hace en memoria: el
    // historial completo son unos cientos de documentos y volver a Firestore
    // cada vez que se cambia de mes saldria mas caro que tenerlos aqui.
    useEffect(() => {
        let vivo = true
        loadBudgetsFromFirestore()
            .then(b => { if (vivo) setBudgets(b) })
            .catch(e => console.error('No se pudieron cargar los presupuestos para el consumo:', e))
            .finally(() => { if (vivo) setCargando(false) })
        return () => { vivo = false }
    }, [])

    const presupuestosDelPeriodo = useMemo(
        () => budgets.filter(b => enRango(b.dateCreated, inicio, fin)),
        [budgets, inicio, fin]
    )

    const consumo: ConsumoMaterial[] = useMemo(() => {
        const ventas = (ventasCatalogo as VentaCatalogo[]).filter(v => enRango(v?.fecha, inicio, fin))
        return unirConsumos(
            consumoPorMaterial(ventas),
            consumoDesdePresupuestos(presupuestosDelPeriodo)
        )
    }, [ventasCatalogo, presupuestosDelPeriodo, inicio, fin])

    // Cuántos presupuestos del periodo siguen sin decir qué material gastaron.
    // Sin esto, un total bajo se lee como poca produccion en vez de como un
    // dato incompleto.
    const sinClasificarEnPeriodo = useMemo(
        () => presupuestosDelPeriodo.filter(b => itemsSinClasificar(b) > 0).length,
        [presupuestosDelPeriodo]
    )

    const totalM2 = consumo.reduce((t, m) => t + m.m2Totales, 0)

    // Mas y menos pedidos. Solo tiene sentido enfrentarlos cuando hay al menos
    // dos materiales: con uno solo, es a la vez el mas y el menos pedido.
    const { masPedido, menosPedido } = useMemo(() => {
        const conMovimiento = consumo.filter(m => m.m2Totales > 0 || m.unidadesTotales > 0)
        if (conMovimiento.length < 2) return { masPedido: null, menosPedido: null }
        return {
            masPedido: conMovimiento[0],
            menosPedido: conMovimiento[conMovimiento.length - 1],
        }
    }, [consumo])

    return (
        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                        <Boxes className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Consumo de Material</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Mostrador + presupuestos desglosados
                        </p>
                    </div>
                </div>

                {totalM2 > 0 && (
                    <div className="text-right shrink-0">
                        <p className="text-2xl sm:text-3xl font-black tracking-tighter text-indigo-600 leading-none tabular-nums">
                            {formatoM2(totalM2)}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">m² del periodo</p>
                    </div>
                )}
            </div>

            {sinClasificarEnPeriodo > 0 && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                        {sinClasificarEnPeriodo === 1
                            ? 'Hay 1 presupuesto de este periodo sin desglosar.'
                            : `Hay ${sinClasificarEnPeriodo} presupuestos de este periodo sin desglosar.`}
                        {' '}Sus metros no están contados aquí, así que este total se queda corto.
                    </p>
                </div>
            )}

            {/* Más y menos pedidos */}
            {masPedido && menosPedido && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/15 p-3.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3" /> Más pedido
                        </p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1.5 truncate">
                            {masPedido.productoNombre}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                            {masPedido.m2Totales > 0
                                ? `${formatoM2(masPedido.m2Totales)} m²`
                                : `${masPedido.unidadesTotales} und`}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-3.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <TrendingDown className="w-3 h-3" /> Menos pedido
                        </p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1.5 truncate">
                            {menosPedido.productoNombre}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 tabular-nums">
                            {menosPedido.m2Totales > 0
                                ? `${formatoM2(menosPedido.m2Totales)} m²`
                                : `${menosPedido.unidadesTotales} und`}
                        </p>
                    </div>
                </div>
            )}

            {/* Tarjetas por material */}
            {cargando ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
            ) : consumo.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                    <Boxes className="w-10 h-10 mx-auto text-slate-200 dark:text-slate-700" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                        Sin consumo registrado en este periodo
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 max-w-sm mx-auto leading-snug">
                        Aparece aquí lo vendido por el catálogo y lo que se haya desglosado
                        en los presupuestos.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {consumo.map(mat => {
                        const desplegado = abierto === mat.productoId
                        const porM2 = mat.m2Totales > 0
                        // Cuánto pesa este material sobre el total del periodo:
                        // dice de un vistazo cuál se lleva el rollo.
                        const peso = totalM2 > 0 ? (mat.m2Totales / totalM2) * 100 : 0

                        return (
                            <div
                                key={mat.productoId}
                                className={cn(
                                    "rounded-[1.5rem] border transition-colors overflow-hidden",
                                    desplegado
                                        ? "border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5"
                                        : "border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03]"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => setAbierto(desplegado ? null : mat.productoId)}
                                    className="w-full text-left p-4 flex items-start gap-3"
                                >
                                    <div className="w-9 h-9 shrink-0 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-indigo-600">
                                        {porM2 ? <Ruler className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                                            {mat.productoNombre}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            {mat.porServicio.length} {mat.porServicio.length === 1 ? 'servicio' : 'servicios'}
                                        </p>

                                        <p className="text-xl font-black tracking-tighter text-slate-900 dark:text-white leading-none mt-1.5 tabular-nums">
                                            {porM2 ? formatoM2(mat.m2Totales) : mat.unidadesTotales}
                                            <span className="text-[10px] font-bold opacity-50 ml-1">
                                                {porM2 ? 'm²' : 'und'}
                                            </span>
                                        </p>

                                        {porM2 && peso > 0 && (
                                            <div className="mt-2 h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-indigo-500"
                                                    style={{ width: `${Math.min(100, peso)}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <ChevronDown className={cn(
                                        "w-4 h-4 shrink-0 text-slate-300 transition-transform mt-1",
                                        desplegado && "rotate-180"
                                    )} />
                                </button>

                                <AnimatePresence initial={false}>
                                    {desplegado && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-1.5 border-t border-black/5 dark:border-white/5 pt-3">
                                                {mat.porServicio.map(s => (
                                                    <div key={s.varianteId} className="flex items-center gap-2 text-[11px]">
                                                        <span className="flex-1 min-w-0 truncate font-bold text-slate-500 dark:text-slate-400">
                                                            {s.nombre}
                                                        </span>
                                                        <span className="shrink-0 font-black tabular-nums text-slate-700 dark:text-slate-200">
                                                            {s.m2 > 0
                                                                ? `${formatoM2(s.m2)} m²`
                                                                : `${s.unidades} und`}
                                                        </span>
                                                    </div>
                                                ))}

                                                {mat.ingresosUSD > 0 && (
                                                    <div className="flex items-center gap-2 pt-2 mt-1 border-t border-black/5 dark:border-white/5">
                                                        <span className="flex-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                            Facturado por catálogo
                                                        </span>
                                                        <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-black tabular-nums">
                                                            ${mat.ingresosUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            )}
        </Card>
    )
}
