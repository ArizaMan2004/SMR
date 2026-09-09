"use client"

// @/components/dashboard/EntregasPorCliente.tsx
//
// QUÉ LE FALTA A ESTE CLIENTE.
//
// El problema no era que faltara información: era dónde estaba. El taller se
// mira POR ÁREA —lo de Impresión, lo de Corte, lo de Producción— porque así es
// como se trabaja. Pero el cliente no viene a preguntar por un área: viene a
// preguntar por lo suyo, y lo suyo está repartido en tres pestañas distintas.
//
// De ahí salía la confusión de "aquí dice que está todo listo": estaba listo lo
// de la pestaña que se miró. Los otros dos trabajos, en otra pestaña, seguían
// abiertos, y se entregaba media orden.
//
// Aquí se da la vuelta al mismo dato: se busca por cliente, y cada orden dice
// cuántos de sus trabajos están hechos. "3 de 5" no se puede leer como "todo
// listo".
//
// LOS TRES ESTADOS SON DE LA ORDEN, NO DEL TRABAJO
//
// Un trabajo del taller solo está pendiente o completado. La orden es la que
// tiene tres estados, y salen de contar los suyos:
//
//   TERMINADO    todos sus trabajos hechos. Se puede entregar entera.
//   EN PROCESO   algunos hechos y otros no. Es el caso peligroso.
//   PENDIENTE    ninguno empezado.

import React, { useMemo, useState } from "react"
import { Search, Package, CheckCircle2, Clock, AlertTriangle, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TrabajoTaller {
    id?: string
    cliente?: string
    ordenNumero?: number | string | null
    descripcion?: string
    areaActual?: string
    estado?: string
    fechaEntrega?: string
    responsable?: string
}

interface Props {
    trabajos: TrabajoTaller[]
    /** Cómo se lee cada área. */
    areas: { id: string; label: string }[]
    onVer?: (t: TrabajoTaller) => void
}

type EstadoOrden = "TERMINADO" | "PROCESO" | "PENDIENTE"

interface OrdenAgrupada {
    numero: string
    trabajos: TrabajoTaller[]
    hechos: number
    estado: EstadoOrden
    entrega: string
}

interface ClienteAgrupado {
    nombre: string
    ordenes: OrdenAgrupada[]
    sinTerminar: number
    aMedias: number
}

const sinTildes = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

const ROTULO: Record<EstadoOrden, { txt: string; clase: string; icono: React.ReactNode }> = {
    TERMINADO: {
        txt: "Listo", icono: <CheckCircle2 className="w-3 h-3" />,
        clase: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    },
    PROCESO: {
        txt: "A medias", icono: <AlertTriangle className="w-3 h-3" />,
        clase: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    },
    PENDIENTE: {
        txt: "Pendiente", icono: <Clock className="w-3 h-3" />,
        clase: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    },
}

export function EntregasPorCliente({ trabajos, areas, onVer }: Props) {
    const [busqueda, setBusqueda] = useState("")
    const [abierto, setAbierto] = useState<string | null>(null)

    const areaLabel = (id?: string) =>
        areas.find(a => a.id === id)?.label || id || "—"

    const clientes = useMemo<ClienteAgrupado[]>(() => {
        const porCliente = new Map<string, Map<string, TrabajoTaller[]>>()

        for (const t of trabajos || []) {
            const cliente = String(t.cliente || "").trim() || "Sin cliente"
            const numero = String(t.ordenNumero ?? "").trim() || "S/N"

            if (!porCliente.has(cliente)) porCliente.set(cliente, new Map())
            const ordenes = porCliente.get(cliente)!
            if (!ordenes.has(numero)) ordenes.set(numero, [])
            ordenes.get(numero)!.push(t)
        }

        const salida: ClienteAgrupado[] = []
        for (const [nombre, ordenes] of porCliente) {
            const lista: OrdenAgrupada[] = []

            for (const [numero, suyos] of ordenes) {
                const hechos = suyos.filter(t => t.estado === "COMPLETADO").length
                const estado: EstadoOrden =
                    hechos === suyos.length ? "TERMINADO"
                        : hechos === 0 ? "PENDIENTE"
                            : "PROCESO"

                // La más próxima de sus trabajos: es la que compromete.
                const entrega = suyos
                    .map(t => t.fechaEntrega || "")
                    .filter(Boolean)
                    .sort()[0] || ""

                lista.push({ numero, trabajos: suyos, hechos, estado, entrega })
            }

            // Lo que no está listo, primero; y dentro, lo que va a medias antes
            // que lo que ni se ha empezado: media orden entregada es el error
            // que hay que ver.
            const orden = { PROCESO: 0, PENDIENTE: 1, TERMINADO: 2 }
            lista.sort((a, b) =>
                (orden[a.estado] - orden[b.estado]) || b.numero.localeCompare(a.numero, "es", { numeric: true }))

            salida.push({
                nombre,
                ordenes: lista,
                sinTerminar: lista.filter(o => o.estado !== "TERMINADO").length,
                aMedias: lista.filter(o => o.estado === "PROCESO").length,
            })
        }

        return salida.sort((a, b) =>
            (b.aMedias - a.aMedias) || (b.sinTerminar - a.sinTerminar) || a.nombre.localeCompare(b.nombre, "es"))
    }, [trabajos])

    const filtrados = useMemo(() => {
        const q = sinTildes(busqueda.trim())
        if (!q) return clientes
        return clientes.filter(c =>
            sinTildes(c.nombre).includes(q) ||
            c.ordenes.some(o => o.numero.includes(q)))
    }, [clientes, busqueda])

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar cliente o número de orden..."
                    className="h-12 pl-11 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-sm"
                />
            </div>

            {filtrados.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="w-7 h-7 text-slate-300 mb-2" />
                    <p className="text-[12px] font-bold text-slate-400">
                        {busqueda ? "Ningún cliente con ese nombre" : "Todavía no hay trabajos en el taller"}
                    </p>
                </div>
            )}

            <div className="space-y-2">
                {filtrados.map(c => {
                    const desplegado = abierto === c.nombre
                    return (
                        <div
                            key={c.nombre}
                            className="rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-white/5 overflow-hidden"
                        >
                            <button
                                onClick={() => setAbierto(desplegado ? null : c.nombre)}
                                className="w-full p-4 flex items-center justify-between gap-3 text-left"
                            >
                                <div className="min-w-0">
                                    <p className="font-black text-[12px] uppercase truncate">{c.nombre}</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                        {c.ordenes.length} {c.ordenes.length === 1 ? "orden" : "órdenes"}
                                        {c.sinTerminar > 0 && ` · ${c.sinTerminar} sin terminar`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Solo se avisa de lo que puede salir mal. Un
                                        distintivo que aparece siempre deja de mirarse. */}
                                    {c.aMedias > 0 && (
                                        <Badge className="bg-amber-500 text-white border-0 text-[9px] font-black gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            {c.aMedias} a medias
                                        </Badge>
                                    )}
                                    <ChevronDown className={cn(
                                        "w-4 h-4 text-slate-400 transition-transform",
                                        desplegado && "rotate-180"
                                    )} />
                                </div>
                            </button>

                            {desplegado && (
                                <div className="px-4 pb-4 space-y-2 border-t border-black/5 dark:border-white/5 pt-3">
                                    {c.ordenes.map(o => {
                                        const r = ROTULO[o.estado]
                                        return (
                                            <div
                                                key={o.numero}
                                                className="rounded-xl bg-slate-50 dark:bg-black/20 p-3 space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-black text-[11px]">
                                                        Orden #{o.numero}
                                                    </span>
                                                    <span className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[10px] font-black text-slate-500 tabular-nums">
                                                            {o.hechos} de {o.trabajos.length}
                                                        </span>
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1",
                                                            r.clase
                                                        )}>
                                                            {r.icono} {r.txt}
                                                        </span>
                                                    </span>
                                                </div>

                                                {/* Trabajo por trabajo: es lo que evita decir
                                                    "está todo listo" mirando solo un area. */}
                                                <div className="space-y-1">
                                                    {o.trabajos.map((t, i) => {
                                                        const hecho = t.estado === "COMPLETADO"
                                                        return (
                                                            <button
                                                                key={t.id || i}
                                                                onClick={() => onVer?.(t)}
                                                                className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                                                            >
                                                                {hecho
                                                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                                    : <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                                                <span className={cn(
                                                                    "text-[10px] font-black uppercase shrink-0",
                                                                    hecho ? "text-slate-400" : "text-slate-600 dark:text-slate-300"
                                                                )}>
                                                                    {areaLabel(t.areaActual)}
                                                                </span>
                                                                <span className={cn(
                                                                    "text-[10px] truncate",
                                                                    hecho ? "text-slate-400 line-through" : "text-slate-500"
                                                                )}>
                                                                    {(t.descripcion || "").split("\n")[0] || "Sin descripción"}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {o.entrega && (
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Entrega: {o.entrega}
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
