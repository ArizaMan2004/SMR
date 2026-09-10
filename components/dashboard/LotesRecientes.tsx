"use client"

// @/components/dashboard/LotesRecientes.tsx
//
// LO QUE SE COMPRÓ, LOTE A LOTE.
//
// Lo que no se podía ver antes: el costo del lote anterior se pisaba con el
// del nuevo, así que no había forma de saber si la tinta subió. Aquí cada
// compra se queda con su precio por unidad, y al lado sale cuánto cambió
// frente a la compra anterior del mismo producto.

import React, { useEffect, useMemo, useState } from "react"
import { Boxes, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { abrevUnidad } from "@/lib/services/catalog-service"
import { subscribeToLotes, type CompraLote } from "@/lib/services/compras-lote-service"

interface Props {
    /** "YYYY-MM" o "ALL", el mismo selector de meses de Insumos. */
    mes: string
}

const mesDe = (fecha: any): string | null => {
    const d = fecha?.toDate ? fecha.toDate() : fecha?.seconds ? new Date(fecha.seconds * 1000) : new Date(fecha)
    if (!d || isNaN(d.getTime())) return null
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const diaDe = (fecha: any): string => {
    const d = fecha?.toDate ? fecha.toDate() : fecha?.seconds ? new Date(fecha.seconds * 1000) : null
    return d ? d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" }) : "—"
}

export function LotesRecientes({ mes }: Props) {
    const [lotes, setLotes] = useState<CompraLote[]>([])

    useEffect(() => subscribeToLotes(setLotes), [])

    /**
     * Cuánto cambió cada lote frente al anterior del MISMO producto y
     * variante. Se calcula sobre todos los lotes, no solo los del mes: el
     * anterior de una compra de septiembre puede ser de julio.
     */
    const variacion = useMemo(() => {
        const porClave = new Map<string, CompraLote[]>()
        for (const l of lotes) {
            const k = `${l.productoId}|${l.varianteId || ""}`
            if (!porClave.has(k)) porClave.set(k, [])
            porClave.get(k)!.push(l) // ya vienen del más nuevo al más viejo
        }
        const salida = new Map<string, number | null>()
        for (const grupo of porClave.values()) {
            grupo.forEach((l, i) => {
                const anterior = grupo[i + 1]
                salida.set(
                    l.id!,
                    anterior && anterior.costoUnitarioUSD > 0
                        ? ((l.costoUnitarioUSD / anterior.costoUnitarioUSD) - 1) * 100
                        : null
                )
            })
        }
        return salida
    }, [lotes])

    const delMes = useMemo(
        () => (mes === "ALL" ? lotes : lotes.filter(l => mesDe(l.fecha) === mes)),
        [lotes, mes]
    )
    const gastado = delMes.reduce((t, l) => t + (Number(l.montoUSD) || 0), 0)

    return (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 dark:border-white/5 p-5 sm:p-8">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <Boxes className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-black uppercase italic tracking-tighter text-lg leading-none">Compras por lote</h3>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                            Lo que costó cada unidad, compra a compra
                        </p>
                    </div>
                </div>
                {delMes.length > 0 && (
                    <span className="text-sm font-black tabular-nums text-emerald-600 shrink-0">
                        ${gastado.toFixed(2)}
                    </span>
                )}
            </div>

            {delMes.length === 0 ? (
                <p className="text-[11px] font-bold text-slate-400 py-6 text-center">
                    {lotes.length === 0
                        ? "Todavía no hay compras por lote. Se registran desde Catálogo, con el botón Compra de cada producto."
                        : "Ninguna compra por lote en este periodo."}
                </p>
            ) : (
                <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-[11px] min-w-[520px]">
                        <thead>
                            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-left">
                                <th className="py-2 px-1">Fecha</th>
                                <th className="py-2 px-1">Producto</th>
                                <th className="py-2 px-1 text-right">Llegó</th>
                                <th className="py-2 px-1 text-right">Total</th>
                                <th className="py-2 px-1 text-right">c/u</th>
                                <th className="py-2 px-1 text-right">vs. anterior</th>
                            </tr>
                        </thead>
                        <tbody>
                            {delMes.map(l => {
                                const v = variacion.get(l.id!)
                                return (
                                    <tr key={l.id} className="border-t border-black/5 dark:border-white/5">
                                        <td className="py-2 px-1 font-bold text-slate-500 whitespace-nowrap">{diaDe(l.fecha)}</td>
                                        <td className="py-2 px-1">
                                            <p className="font-black uppercase truncate max-w-[14rem]">
                                                {l.productoNombre}{l.varianteNombre ? ` — ${l.varianteNombre}` : ""}
                                            </p>
                                            {l.proveedor && <p className="text-[9px] text-slate-400">{l.proveedor}</p>}
                                        </td>
                                        <td className="py-2 px-1 text-right tabular-nums whitespace-nowrap text-slate-500">
                                            {l.paquetes} {l.presentacion} · {l.unidadesTotales} {abrevUnidad(l.unidad)}
                                        </td>
                                        <td className="py-2 px-1 text-right tabular-nums font-black">${Number(l.montoUSD).toFixed(2)}</td>
                                        <td className="py-2 px-1 text-right tabular-nums font-black text-blue-600">
                                            ${Number(l.costoUnitarioUSD).toFixed(l.costoUnitarioUSD < 1 ? 4 : 2)}
                                        </td>
                                        <td className="py-2 px-1 text-right whitespace-nowrap">
                                            {v == null ? (
                                                <span className="text-slate-300">—</span>
                                            ) : Math.abs(v) < 0.5 ? (
                                                <span className="text-slate-400 font-bold">igual</span>
                                            ) : (
                                                <span className={cn(
                                                    "inline-flex items-center gap-0.5 font-black tabular-nums",
                                                    // Que suba el costo es la mala noticia.
                                                    v > 0 ? "text-rose-600" : "text-emerald-600"
                                                )}>
                                                    {v > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                    {Math.abs(v).toFixed(1)}%
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
