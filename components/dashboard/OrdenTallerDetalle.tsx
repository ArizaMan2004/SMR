// @/components/dashboard/OrdenTallerDetalle.tsx
//
// LA ORDEN DE TRABAJO, PARA MIRARLA Y PARA IRLA TACHANDO.
//
// Antes esto era el mismo formulario de crear puesto en solo-lectura. Se veía
// como un formulario: campos, recuadros y dos casillas de Medidas vacías —
// vacías porque las medidas ya vienen escritas en cada renglón desde que la
// orden se manda desde facturación. Un recuadro vacío en medio de la pantalla
// no dice "esto no aplica", dice "aquí falta algo".
//
// Un formulario y un visor no son la misma cosa. El formulario pregunta; el
// visor contesta. Este contesta.
//
// LO QUE CAMBIA DE VERDAD: LA LISTA SE TACHA
//
// Un trabajo de cinco impresiones era un párrafo. Quien lo hacía tenía que
// acordarse de por dónde iba, y cuando lo dejaba a medias para atender algo
// urgente, al volver no sabía qué llevaba hecho.
//
// Cada renglón es ahora una casilla que se marca. Se guarda al instante, así
// que lo ve quien entre después y sobrevive a cerrar la pantalla.

"use client"

import React, { useMemo, useState } from 'react'

import {
    Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    X, Check, Pencil, Trash2, Phone, User, Calendar, Ruler, Layers,
    CheckCircle2, ArrowRight, Loader2, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { db } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    orden: any | null
    areas: { id: string; label: string; icon: any }[]
    puedeEditar: boolean
    onEditar: () => void
    onMover: (area: string) => void
    onCompletar: () => void
    onEliminar: () => void
}

/** Cada línea de la descripción es una tarea. Las vacías no cuentan. */
const tareasDe = (descripcion?: string): string[] =>
    String(descripcion || '').split('\n').map(l => l.trim()).filter(Boolean)

export function OrdenTallerDetalle({
    open, onOpenChange, orden, areas, puedeEditar,
    onEditar, onMover, onCompletar, onEliminar,
}: Props) {
    const [guardando, setGuardando] = useState(false)

    const tareas = useMemo(() => tareasDe(orden?.descripcion), [orden?.descripcion])
    const hechas: number[] = useMemo(
        () => Array.isArray(orden?.tareasHechas) ? orden.tareasHechas : [],
        [orden?.tareasHechas]
    )

    if (!orden) return null

    const area = areas.find(a => a.id === orden.areaActual)
    const terminada = orden.estado === 'COMPLETADO'
    const total = tareas.length
    const listas = hechas.filter(i => i < total).length
    const pct = total > 0 ? Math.round((listas / total) * 100) : 0

    /**
     * Marca o desmarca un renglón.
     *
     * Se guarda al instante y no al cerrar: quien tacha algo en el taller deja
     * el teléfono y sigue trabajando, y si hubiera que confirmar se perdería.
     */
    const alternar = async (i: number) => {
        if (!orden.id || terminada) return

        const nuevas = hechas.includes(i) ? hechas.filter(x => x !== i) : [...hechas, i].sort((a, b) => a - b)

        setGuardando(true)
        try {
            await updateDoc(doc(db, 'ordenes_servicio', orden.id), { tareasHechas: nuevas })
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`)
        } finally {
            setGuardando(false)
        }
    }

    const marcarTodo = async () => {
        if (!orden.id || terminada) return
        const todas = listas === total ? [] : tareas.map((_, i) => i)
        setGuardando(true)
        try {
            await updateDoc(doc(db, 'ordenes_servicio', orden.id), { tareasHechas: todas })
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[92vh] p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">Detalle de la orden de trabajo</DialogTitle>

                {/* CABECERA. El número primero: es por donde se pregunta. */}
                <header className={cn(
                    'p-5 sm:p-6 flex items-start justify-between gap-3 text-white',
                    terminada ? 'bg-emerald-600' : 'bg-slate-900'
                )}>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            {orden.ordenNumero && (
                                <span className="text-lg font-black tabular-nums">#{orden.ordenNumero}</span>
                            )}
                            <Badge className="bg-white/20 text-white border-0 text-[9px] font-black uppercase tracking-widest px-2">
                                {terminada ? 'Terminada' : area?.label || 'Taller'}
                            </Badge>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight leading-tight mt-1 truncate">
                            {orden.cliente || 'Sin cliente'}
                        </h2>
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full text-white/70 hover:text-white hover:bg-white/10 shrink-0">
                        <X className="w-5 h-5" />
                    </Button>
                </header>

                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">

                    {/* LA LISTA. Es lo que se viene a ver, así que va primero. */}
                    {total > 0 && (
                        <section className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex-1">
                                    Qué hay que hacer
                                </p>
                                {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
                                <span className={cn(
                                    'text-[10px] font-black tabular-nums',
                                    listas === total ? 'text-emerald-600' : 'text-slate-400'
                                )}>
                                    {listas} de {total}
                                </span>
                            </div>

                            {/* La barra dice de un vistazo cuánto falta; el número
                                solo no se lee igual de rápido. */}
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                                <div
                                    className={cn('h-full rounded-full transition-all', listas === total ? 'bg-emerald-500' : 'bg-blue-500')}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                {tareas.map((t, i) => {
                                    const hecha = hechas.includes(i)
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => alternar(i)}
                                            disabled={terminada}
                                            className={cn(
                                                'w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors',
                                                hecha
                                                    ? 'bg-emerald-50 dark:bg-emerald-500/10'
                                                    : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10',
                                                terminada && 'cursor-default'
                                            )}
                                        >
                                            <span className={cn(
                                                'w-5 h-5 rounded-lg border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                                                hecha
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'border-slate-300 dark:border-white/20'
                                            )}>
                                                {hecha && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                            </span>

                                            <span className={cn(
                                                'text-sm font-bold leading-snug flex-1 min-w-0',
                                                hecha
                                                    ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70'
                                                    : 'text-slate-700 dark:text-slate-200'
                                            )}>
                                                {t}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {!terminada && total > 1 && (
                                <button
                                    onClick={marcarTodo}
                                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                                >
                                    {listas === total ? 'Desmarcar todo' : 'Marcar todo'}
                                </button>
                            )}
                        </section>
                    )}

                    {/* OBSERVACIONES. Justo debajo de la lista: es lo que cambia
                        cómo se hace el trabajo, no un pie de página. */}
                    {orden.observaciones?.trim() && (
                        <section className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">Ojo con esto</p>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-400 leading-snug whitespace-pre-wrap">
                                {orden.observaciones}
                            </p>
                        </section>
                    )}

                    {/* MATERIAL Y ACABADOS, como etiquetas y no como casillas:
                        aquí no se elige nada, se lee lo que ya se eligió. */}
                    {(orden.materiales?.length > 0 || orden.notaMaterial || orden.adicionales?.length > 0) && (
                        <section className="space-y-3">
                            {orden.materiales?.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Material</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {orden.materiales.map((m: string) => (
                                            <span key={m} className="h-7 px-3 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-[10px] font-black uppercase flex items-center">
                                                {m}
                                            </span>
                                        ))}
                                    </div>
                                    {orden.notaMaterial && (
                                        <p className="text-[11px] font-bold text-slate-500 mt-2">{orden.notaMaterial}</p>
                                    )}
                                </div>
                            )}

                            {orden.adicionales?.length > 0 && (
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Acabados</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {orden.adicionales.map((a: string) => (
                                            <span key={a} className="h-7 px-3 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase flex items-center">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* LOS DATOS. Abajo porque se consultan una vez, no cada rato. */}
                    <section className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4 grid grid-cols-2 gap-4">
                        <Dato icon={<User className="w-3 h-3" />} et="Responsable" v={orden.responsable} />
                        <Dato
                            icon={<Phone className="w-3 h-3" />}
                            et="Teléfono"
                            v={orden.telefono}
                            href={orden.telefono ? `tel:${String(orden.telefono).replace(/\s/g, '')}` : undefined}
                        />
                        <Dato icon={<Calendar className="w-3 h-3" />} et="Entrega" v={orden.fechaEntrega} />
                        <Dato icon={<Calendar className="w-3 h-3" />} et="Entró al taller" v={orden.fechaInicio} />

                        {/* Solo si las tiene. Las órdenes que vienen de facturación
                            llevan la medida en cada renglón, y enseñar dos cajas
                            vacías se lee como que falta algo. */}
                        {(orden.medidas?.alto || orden.medidas?.ancho) && (
                            <Dato
                                icon={<Ruler className="w-3 h-3" />}
                                et="Medidas"
                                v={`${orden.medidas.alto || '?'} × ${orden.medidas.ancho || '?'} cm`}
                            />
                        )}
                    </section>
                </div>

                {/* ACCIONES. Lo que se hace desde aquí, sin volver a la lista. */}
                <footer className="p-4 border-t border-black/5 dark:border-white/10 bg-slate-50 dark:bg-white/5 space-y-2">
                    {!terminada && (
                        <div className="flex flex-wrap gap-2">
                            {areas.filter(a => a.id !== orden.areaActual).map(a => (
                                <Button
                                    key={a.id}
                                    variant="outline"
                                    onClick={() => { onMover(a.id); onOpenChange(false) }}
                                    className="h-10 flex-1 min-w-[7rem] rounded-xl font-black uppercase text-[9px] tracking-widest gap-1.5"
                                >
                                    <ArrowRight className="w-3.5 h-3.5" /> {a.label}
                                </Button>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2">
                        {!terminada && (
                            <Button
                                onClick={() => { onCompletar(); onOpenChange(false) }}
                                className="h-11 flex-1 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {listas < total ? `Terminar (faltan ${total - listas})` : 'Terminar'}
                            </Button>
                        )}

                        {puedeEditar && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => { onEditar(); onOpenChange(false) }}
                                    className="h-11 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 px-4"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> Editar
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => { onEliminar(); onOpenChange(false) }}
                                    className="h-11 rounded-2xl px-3 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    )
}

function Dato({ icon, et, v, href }: { icon: React.ReactNode; et: string; v?: string; href?: string }) {
    const contenido = (
        <p className={cn('text-xs font-black truncate mt-0.5', href && 'text-blue-600')}>{v || '—'}</p>
    )
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">{icon} {et}</p>
            {href ? <a href={href}>{contenido}</a> : contenido}
        </div>
    )
}
