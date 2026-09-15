"use client"

// @/components/ui/precio-estimado-boton.tsx
//
// "¿QUIERES UN PRECIO ESTIMADO?"
//
// Un botón pequeño al lado de cada campo de precio. No es obligatorio y no
// cambia nada si no se usa: es una guía para quien empieza y todavía no sabe
// sacar cuánto le cuesta un metro de un rollo o una pieza de un lote.
//
// Pregunta cómo se compra —rollo, unidad o lote—, pide solo lo que hace falta
// para esa forma, propone un margen y rellena el campo si se quiere.

import React, { useMemo, useState } from "react"
import { Calculator, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    estimarPrecio, faltaParaEstimar, MARGEN_RECOMENDADO, type FormaDeCompra,
} from "@/lib/utils/precio-estimado"

interface Props {
    /** Rellena el campo de precio con lo que se elija. */
    onUsar: (precio: number) => void
    /** El precio que se está poniendo se cobra por metro lineal. */
    porMetroLineal?: boolean
    /** Formas que tienen sentido aquí. Sin decirlo, las tres. */
    formas?: FormaDeCompra[]
    moneda?: string
    className?: string
    /** Texto del enlace, cuando hay dos juntos (regular y aliado). */
    texto?: string
    /** Solo el icono, para huecos pequenos. */
    soloIcono?: boolean
    /** Como se llama lo que se compra entero: "rollo", "lamina". */
    nombreRollo?: string
}

const FORMAS: { id: FormaDeCompra; titulo: string; pie: string }[] = [
    { id: "rollo", titulo: "Por rollo", pie: "Vinil, banner, lona…" },
    { id: "unidad", titulo: "Por unidad", pie: "Cada pieza suelta" },
    { id: "lote", titulo: "Por lote", pie: "Una caja de muchas" },
]

const num = (v: string) => {
    const x = parseFloat(String(v).replace(",", "."))
    return Number.isFinite(x) ? x : 0
}

export function PrecioEstimadoBoton({ onUsar, porMetroLineal, formas, moneda = "$", className, texto, soloIcono, nombreRollo = "rollo" }: Props) {
    const [abierto, setAbierto] = useState(false)
    const disponibles = FORMAS
        .filter(f => !formas || formas.includes(f.id))
        .map(f => f.id === "rollo" && nombreRollo !== "rollo"
            ? { ...f, titulo: `Por ${nombreRollo}`, pie: "Largo × ancho" }
            : f)
    const [forma, setForma] = useState<FormaDeCompra>(disponibles[0]?.id || "unidad")
    const [costo, setCosto] = useState("")
    const [largo, setLargo] = useState("")
    const [ancho, setAncho] = useState("")
    const [unidades, setUnidades] = useState("")
    const [margen, setMargen] = useState(String(MARGEN_RECOMENDADO))

    const datos = {
        forma, costo: num(costo), largoM: num(largo), anchoM: num(ancho),
        unidades: num(unidades), margenPct: num(margen), porMetroLineal,
    }
    // Los mensajes de la cuenta hablan de "rollo"; aqui se dice lo que es.
    const falta = (faltaParaEstimar(datos) || "")
        .replace("el rollo", `cada ${nombreRollo}`) || null
    const r = useMemo(() => estimarPrecio(datos), [forma, costo, largo, ancho, unidades, margen, porMetroLineal])

    const campo = "h-11 rounded-xl border-none bg-slate-50 dark:bg-white/5 font-black"
    const etiqueta = "text-[9px] font-black uppercase tracking-widest text-slate-400"
    const dinero = (x: number) => `${moneda}${x.toFixed(x < 1 ? 4 : 2)}`

    return (
        <>
            <button
                type="button"
                onClick={() => setAbierto(true)}
                title="Sacar un precio desde lo que costó"
                className={cn(
                    "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700",
                    className
                )}
            >
                {soloIcono
                    ? <Calculator className="w-3.5 h-3.5" />
                    : <><Calculator className="w-3 h-3" /> {texto || "¿Precio estimado?"}</>}
            </button>

            <Dialog open={abierto} onOpenChange={setAbierto}>
                <DialogContent className="sm:max-w-md rounded-[2rem] bg-white dark:bg-[#1c1c1e] border-0 p-6 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-blue-600" /> Precio estimado
                        </DialogTitle>
                        <p className="text-[11px] font-bold text-slate-400 leading-snug">
                            Una guía para sacar el precio desde lo que te costó. No es obligatoria.
                        </p>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <p className={etiqueta}>¿Cómo lo compras?</p>
                            <div className={cn("grid gap-2", disponibles.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                                {disponibles.map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setForma(f.id)}
                                        className={cn(
                                            "p-2.5 rounded-2xl border text-left transition-all",
                                            forma === f.id
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                                                : "border-black/10 dark:border-white/10"
                                        )}
                                    >
                                        <p className="text-[10px] font-black uppercase">{f.titulo}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">{f.pie}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <p className={etiqueta}>
                                {forma === "rollo" ? `¿Cuánto costó cada ${nombreRollo}?` : forma === "lote" ? "¿Cuánto costó el lote?" : "¿Cuánto costó cada unidad?"}
                            </p>
                            <Input type="number" min="0" step="0.01" value={costo} onChange={e => setCosto(e.target.value)} placeholder="0.00" className={campo} />
                        </div>

                        {forma === "rollo" && (
                            <div className={cn("grid gap-3", porMetroLineal ? "grid-cols-1" : "grid-cols-2")}>
                                <div className="space-y-1.5">
                                    <p className={etiqueta}>Largo (metros)</p>
                                    <Input type="number" min="0" step="0.01" value={largo} onChange={e => setLargo(e.target.value)} placeholder="50" className={campo} />
                                </div>
                                {!porMetroLineal && (
                                    <div className="space-y-1.5">
                                        <p className={etiqueta}>Ancho (metros)</p>
                                        <Input type="number" min="0" step="0.01" value={ancho} onChange={e => setAncho(e.target.value)} placeholder="1.37" className={campo} />
                                    </div>
                                )}
                            </div>
                        )}

                        {forma === "lote" && (
                            <div className="space-y-1.5">
                                <p className={etiqueta}>¿Cuántas unidades trae?</p>
                                <Input type="number" min="0" value={unidades} onChange={e => setUnidades(e.target.value)} placeholder="100" className={campo} />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <p className={etiqueta}>¿Cuánto quieres ganarle? (%)</p>
                            <Input type="number" min="0" value={margen} onChange={e => setMargen(e.target.value)} className={campo} />
                            <p className="text-[10px] font-bold text-slate-400 leading-snug">
                                Un {MARGEN_RECOMENDADO} % sobre lo que te costó es un buen punto de partida.
                                Sobre el costo: si costó {moneda}10, se vende a {moneda}13.
                            </p>
                        </div>

                        {r ? (
                            <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-4 space-y-2">
                                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                    <span>Te costó cada {r.unidad}</span>
                                    <span className="tabular-nums">{dinero(r.costoUnitario)}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Precio sugerido</span>
                                    <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                                        {moneda}{r.precioSugerido.toFixed(2)}
                                        <span className="text-[10px] font-bold opacity-70"> /{r.unidad}</span>
                                    </span>
                                </div>
                                <p className="text-[10px] font-black text-emerald-600">
                                    Ganas {moneda}{r.gananciaPorUnidad.toFixed(2)} por {r.unidad}
                                </p>
                                <Button
                                    type="button"
                                    onClick={() => { onUsar(r.precioSugerido); setAbierto(false) }}
                                    className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] gap-2"
                                >
                                    <Check className="w-4 h-4" /> Usar este precio
                                </Button>
                            </div>
                        ) : (
                            <p className="text-[11px] font-bold text-slate-400 text-center py-2">{falta}</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
