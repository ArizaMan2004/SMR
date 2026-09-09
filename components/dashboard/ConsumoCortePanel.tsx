"use client"

// @/components/dashboard/ConsumoCortePanel.tsx
//
// QUÉ TUVO LA MÁQUINA OCUPADA Y QUÉ PLANCHA SE GASTÓ.
//
// Son dos preguntas distintas y por eso hay dos columnas. Un material puede ser
// el primero en minutos y el último en piezas: una sola tapa de MDF puede
// llevar más láser que doscientas medallas. Sumarlos en un número daría un
// ranking que no sirve para decidir nada.
//
// La barra compara contra el que más tiene, no contra el total: lo que se
// quiere ver de un vistazo es quién manda, no qué porcentaje del mes es.

import React, { useState } from "react"
import { Scissors, Timer, Package, User, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { tiempoLegible, type ConsumoCorte } from "@/lib/services/corte-service"

interface Props {
    datos: ConsumoCorte[]
    /** Sin marco ni título, para meterlo dentro de otra tarjeta. */
    embebido?: boolean
}

export function ConsumoCortePanel({ datos, embebido }: Props) {
    const [abierto, setAbierto] = useState<string | null>(null)

    if (!datos.length) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <Scissors className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-[11px] font-bold text-slate-400">
                    Ningún corte registrado en este periodo
                </p>
                <p className="text-[9px] text-slate-400 mt-1 max-w-[16rem]">
                    Aparecen aquí los ítems marcados como Corte Láser, con el material que se eligió.
                </p>
            </div>
        )
    }

    const topMinutos = Math.max(...datos.map(d => d.minutos), 1)
    const topPiezas = Math.max(...datos.map(d => d.piezas), 1)

    return (
        <div className={cn("space-y-2", !embebido && "p-4")}>
            <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Timer className="w-3 h-3" /> Máquina
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Piezas
                </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[260px] custom-scrollbar pr-1">
                {datos.map(m => {
                    const desplegado = abierto === m.material
                    return (
                        <div
                            key={m.material}
                            className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 overflow-hidden"
                        >
                            <button
                                onClick={() => setAbierto(desplegado ? null : m.material)}
                                className="w-full p-3 text-left"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-black uppercase truncate">
                                        {m.material}
                                    </span>
                                    <span className="flex items-center gap-3 shrink-0">
                                        <span className="text-[11px] font-black text-orange-600 tabular-nums">
                                            {tiempoLegible(m.minutos)}
                                        </span>
                                        <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 tabular-nums">
                                            {m.piezas}
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                "w-3.5 h-3.5 text-slate-400 transition-transform",
                                                desplegado && "rotate-180"
                                            )}
                                        />
                                    </span>
                                </div>

                                {/* Dos barras, una por pregunta. */}
                                <div className="mt-2 space-y-1">
                                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 rounded-full"
                                            style={{ width: `${(m.minutos / topMinutos) * 100}%` }}
                                        />
                                    </div>
                                    <div className="h-1.5 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-slate-400 rounded-full"
                                            style={{ width: `${(m.piezas / topPiezas) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Lo que puso el cliente no salió de nuestro almacén.
                                    Solo se dice cuando lo hay: una línea que casi
                                    siempre marca cero deja de leerse. */}
                                {m.piezasDelCliente > 0 && (
                                    <p className="mt-2 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {m.piezasDelCliente} de {m.piezas} con material del cliente
                                        {" · "}
                                        no salió de tu stock
                                    </p>
                                )}

                                {/* Lo de antes de que se preguntara. Se dice, en vez de
                                    repartirlo a un lado: un hueco reconocido se rellena,
                                    un dato inventado se cree. */}
                                {m.piezasSinEspecificar > 0 && (
                                    <p className="mt-1 text-[9px] font-bold text-amber-600/80">
                                        {m.piezasSinEspecificar === m.piezas
                                            ? "Sin registrar quién puso el material"
                                            : `${m.piezasSinEspecificar} sin registrar quién puso el material`}
                                    </p>
                                )}
                            </button>

                            {desplegado && (
                                <div className="px-3 pb-3 space-y-1 border-t border-black/5 dark:border-white/5 pt-2">
                                    {m.detalle.map(d => (
                                        <div
                                            key={d.clave}
                                            className="flex items-center justify-between gap-2 text-[10px]"
                                        >
                                            <span className="font-bold text-slate-500 truncate">{d.clave}</span>
                                            <span className="flex items-center gap-3 shrink-0 tabular-nums">
                                                <span className="text-orange-600 font-black">
                                                    {tiempoLegible(d.minutos)}
                                                </span>
                                                <span className="font-black text-slate-500">{d.piezas}</span>
                                            </span>
                                        </div>
                                    ))}
                                    <p className="text-[9px] text-slate-400 pt-1">
                                        {m.trabajos} {m.trabajos === 1 ? "trabajo" : "trabajos"}
                                        {m.ingresosUSD > 0 && ` · $${m.ingresosUSD.toFixed(2)}`}
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
