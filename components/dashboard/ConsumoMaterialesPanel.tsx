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

import type { ConsumoDelPeriodo } from '@/lib/hooks/use-consumo-materiales'

interface Props {
    /** Ya calculado por useConsumoMateriales, que es quien lee de Firestore. */
    datos: ConsumoDelPeriodo
    cargando?: boolean
    /** El panel vive dentro de una vista de área y solo enseña la suya. */
    area: 'IMPRESION' | 'CORTE'
    /**
     * Sin tarjeta ni cabecera propias, para meterlo dentro de un panel que ya
     * las tiene. Se usa así en Estadísticas: el desglose de materiales que ya
     * existía se queda donde está y solo cambia de dónde saca los números.
     */
    embebido?: boolean
}

const formatoM2 = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ConsumoMaterialesPanel({ datos, cargando, area, embebido }: Props) {
    const [abierto, setAbierto] = useState<string | null>(null)

    const consumo = datos.materiales
    const totalM2 = datos.m2Totales
    const sinClasificarEnPeriodo = datos.presupuestosSinDesglosar
    const sinAuditar = datos.ordenesSinAuditar
    const estimados = datos.m2Estimados || 0
    const categoriasSinArea = datos.categoriasSinArea

    // Mas y menos pedidos. Solo tiene sentido enfrentarlos cuando hay al menos
    // dos materiales: con uno solo, es a la vez el mas y el menos pedido.
    const { masPedido, menosPedido } = useMemo(() => {
        const conMovimiento = consumo.filter(m => m.m2Totales > 0 || m.unidadesTotales > 0)
        if (conMovimiento.length < 2) return { masPedido: null, menosPedido: null }
        return { masPedido: conMovimiento[0], menosPedido: conMovimiento[conMovimiento.length - 1] }
    }, [consumo])

    const Envoltorio: any = embebido ? 'div' : Card
    const claseEnvoltorio = embebido
        ? 'space-y-3'
        : 'rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-5'

    return (
        <Envoltorio className={claseEnvoltorio}>
            {embebido ? (
                // Dentro de otra tarjeta basta con el total: el titulo ya lo pone
                // el panel que lo contiene.
                totalM2 > 0 && (
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Total del periodo
                        </span>
                        <span className="text-xl font-black tracking-tighter text-indigo-600 tabular-nums">
                            {formatoM2(totalM2)} <span className="text-[10px] opacity-60">m²</span>
                        </span>
                    </div>
                )
            ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                            <Boxes className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Consumo de Material</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {area === 'CORTE' ? 'Corte láser' : 'Impresión'} · mostrador + presupuestos
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
            )}

            {categoriasSinArea.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                    <p className="text-[11px] font-bold text-slate-500 leading-snug">
                        {categoriasSinArea.length === 1
                            ? `La categoría «${categoriasSinArea[0]}» no tiene área asignada.`
                            : `${categoriasSinArea.length} categorías no tienen área asignada.`}
                        {' '}Mientras tanto se reparten por el tipo de venta, que es una suposición.
                        Se arregla en Insumos y Materiales → Categorías.
                    </p>
                </div>
            )}

            {estimados > 0.005 && (
                <div className="rounded-2xl border border-sky-200 dark:border-sky-500/20 bg-sky-50/70 dark:bg-sky-500/5 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-sky-500 mt-0.5" />
                    <p className="text-[11px] font-bold text-sky-700 dark:text-sky-400 leading-snug">
                        {estimados.toLocaleString(undefined, { maximumFractionDigits: 2 })} m² de este
                        total salen de leer la descripción de {sinAuditar}{' '}
                        {sinAuditar === 1 ? 'renglón sin auditar' : 'renglones sin auditar'}, no de un
                        material confirmado. Audítalos en Auditoría de Pagos → Materiales.
                    </p>
                </div>
            )}

            {sinClasificarEnPeriodo > 0 && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                        {sinClasificarEnPeriodo === 1
                            ? 'Hay 1 presupuesto de este periodo sin desglosar.'
                            : `Hay ${sinClasificarEnPeriodo} presupuestos de este periodo sin desglosar.`}
                        {' '}Sus metros no cuentan hasta que se facturen, así que este total se queda corto.
                    </p>
                </div>
            )}

            {/* Más y menos pedidos */}
            {masPedido && menosPedido && (
                <div className={cn("grid gap-3", embebido ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
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
                        Sin consumo de {area === 'CORTE' ? 'corte' : 'impresión'} en este periodo
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 max-w-sm mx-auto leading-snug">
                        Aparece aquí lo vendido por el catálogo y lo que se haya desglosado
                        en los presupuestos.
                    </p>
                </div>
            ) : (
                <div className={cn(
                    "grid gap-3",
                    embebido
                        ? "grid-cols-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1"
                        : "grid-cols-1 sm:grid-cols-2"
                )}>
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
                                        {/* CUANTOS SERVICIOS SE SABEN.

                                            Decia "1 servicio" cuando lo unico
                                            que habia era un bloque de metros
                                            sin clasificar. Eso no es un
                                            servicio: es la falta de uno, y
                                            contarlo afirma algo que no se
                                            sabe. Ahora se cuentan solo los
                                            conocidos y se dice aparte cuanto
                                            queda por desglosar. */}
                                        {(() => {
                                            const conocidos = mat.porServicio.filter(x => !x.sinClasificar)
                                            const m2Sin = mat.porServicio
                                                .filter(x => x.sinClasificar)
                                                .reduce((t, x) => t + x.m2, 0)

                                            return (
                                                <p className="text-[10px] font-bold text-slate-400">
                                                    {conocidos.length > 0 && (
                                                        <span>
                                                            {conocidos.length} {conocidos.length === 1 ? 'servicio' : 'servicios'}
                                                        </span>
                                                    )}
                                                    {conocidos.length > 0 && m2Sin > 0.005 && <span> · </span>}
                                                    {m2Sin > 0.005 && (
                                                        <span className="text-amber-600">
                                                            {formatoM2(m2Sin)} m² sin desglosar
                                                        </span>
                                                    )}
                                                    {conocidos.length === 0 && m2Sin <= 0.005 && <span>Sin desglosar</span>}
                                                </p>
                                            )
                                        })()}

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
                                                        <span className={cn(
                                                            "flex-1 min-w-0 truncate font-bold",
                                                            s.sinClasificar
                                                                ? "text-amber-600 italic"
                                                                : "text-slate-500 dark:text-slate-400"
                                                        )}>
                                                            {s.sinClasificar ? 'Sin decir en qué se usó' : s.nombre}
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
        </Envoltorio>
    )
}
