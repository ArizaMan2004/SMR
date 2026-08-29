// @/components/dashboard/HorariosView.tsx
//
// Horario estándar del personal.
//
// Una sola pantalla: cada persona y su semana tipo. Sin navegación de semanas
// ni plantillas que aplicar, porque el horario del taller no cambia cada
// semana — se define una vez y se repite. Sigue admitiendo turno partido
// (varios bloques el mismo día) para los que estudian.

"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
    CalendarClock, Plus, Trash2, Loader2, Save, Clock, Users, X,
    Sun, Copy, CircleDot, AlertTriangle, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
    subscribeToHorarios, guardarHorario, guardarDia,
} from '@/lib/services/horarios-service'
import {
    asistenciaDe, bloquesDelDia, horasSemanales, horaAMinutos,
    formatoAmPm, seSolapan, resumenBloques,
    NOMBRES_DIAS, NOMBRES_DIAS_CORTO, SEMANA_LABORAL, TURNOS_RAPIDOS,
    HORARIO_CASA, DIAS_LABORABLES,
    type HorarioEstandar, type BloqueHorario,
} from '@/lib/types/horarios'

interface Props {
    empleados: any[]
    /** Solo quien supervisa puede editar; el resto solo consulta su horario. */
    puedeEditar?: boolean
}

export function HorariosView({ empleados, puedeEditar = true }: Props) {
    const [horarios, setHorarios] = useState<HorarioEstandar[]>([])
    const [cargando, setCargando] = useState(true)
    const [ocupado, setOcupado] = useState(false)

    /** Día que se está editando: persona + día de la semana. */
    const [editando, setEditando] = useState<{ horario: HorarioEstandar; dia: number } | null>(null)
    const [bloquesEdit, setBloquesEdit] = useState<BloqueHorario[]>([])

    useEffect(() => {
        const unsub = subscribeToHorarios(lista => { setHorarios(lista); setCargando(false) })
        return () => unsub()
    }, [])

    const nombreDe = (e: any) => `${e.nombre || ''} ${e.apellido || ''}`.trim() || 'Sin nombre'

    const activos = useMemo(() => empleados.filter(e => e.activo !== false), [empleados])

    /** Cada empleado con su horario; si aún no tiene, uno vacío listo para llenar. */
    const filas = useMemo(() => activos.map(emp => {
        const existente = horarios.find(h => h.empleadoId === emp.id)
        return existente ?? {
            id: emp.id, empleadoId: emp.id, empleadoNombre: nombreDe(emp),
            dias: {}, activo: true,
        } as HorarioEstandar
    }), [activos, horarios])

    const hoy = useMemo(() => asistenciaDe(filas), [filas])
    const diaHoy = new Date().getDay()

    // --- EDICIÓN ---

    const abrirDia = (horario: HorarioEstandar, dia: number) => {
        if (!puedeEditar) return
        setEditando({ horario, dia })
        setBloquesEdit(bloquesDelDia(horario, dia))
    }

    const cambiarBloque = (i: number, campo: 'inicio' | 'fin', valor: string) => {
        setBloquesEdit(prev => prev.map((b, idx) => idx === i ? { ...b, [campo]: valor } : b))
    }

    const guardar = async () => {
        if (!editando) return

        for (const b of bloquesEdit) {
            if (horaAMinutos(b.fin) <= horaAMinutos(b.inicio)) {
                return toast.error('La hora de salida debe ser posterior a la de entrada')
            }
        }
        for (let i = 0; i < bloquesEdit.length; i++) {
            for (let j = i + 1; j < bloquesEdit.length; j++) {
                if (seSolapan(bloquesEdit[i], bloquesEdit[j])) {
                    return toast.error('Hay dos tramos que se pisan en el mismo día')
                }
            }
        }

        setOcupado(true)
        try {
            await guardarDia(editando.horario, editando.dia, bloquesEdit)
            toast.success(`${NOMBRES_DIAS[editando.dia]} actualizado`)
            setEditando(null)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo guardar el horario')
        } finally {
            setOcupado(false)
        }
    }

    /** Copia el día que se está editando al resto de días que abre el taller. */
    const copiarASemana = async () => {
        if (!editando || bloquesEdit.length === 0) return
        setOcupado(true)
        try {
            const dias = { ...(editando.horario.dias || {}) }
            for (const d of DIAS_LABORABLES) dias[d] = bloquesEdit
            await guardarHorario({
                empleadoId: editando.horario.empleadoId,
                empleadoNombre: editando.horario.empleadoNombre,
                dias, activo: editando.horario.activo, nota: editando.horario.nota,
            })
            toast.success('Aplicado de lunes a sábado')
            setEditando(null)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo aplicar a la semana')
        } finally {
            setOcupado(false)
        }
    }

    /**
     * Pone el horario de la casa (8:00–12:30 y 14:00–18:00, de lunes a sábado)
     * a todo el equipo de una vez.
     *
     * Es el caso normal: casi todos cumplen el mismo horario y solo unos pocos
     * son la excepción. Sale más rápido aplicarlo a todos y luego retocar a los
     * tres o cuatro distintos, que rellenar once fichas una por una.
     */
    const aplicarHorarioCasa = async () => {
        const cuantos = filas.length
        if (!window.confirm(
            `Se pondrá el horario de la casa (8:00–12:30 y 2:00–6:00, de lunes a sábado) a ${cuantos} persona(s).\n\n` +
            `Sobrescribe lo que tengan ahora. Después puedes ajustar a mano las excepciones.\n\n¿Continuar?`
        )) return

        setOcupado(true)
        try {
            const dias: Record<number, BloqueHorario[]> = {}
            for (const d of DIAS_LABORABLES) dias[d] = HORARIO_CASA.map(b => ({ ...b }))

            await Promise.all(filas.map(h => guardarHorario({
                empleadoId: h.empleadoId,
                empleadoNombre: h.empleadoNombre,
                dias,
                activo: h.activo,
                nota: h.nota,
            })))
            toast.success(`Horario de la casa aplicado a ${cuantos} persona(s)`)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo aplicar el horario a todos')
        } finally {
            setOcupado(false)
        }
    }

    const alternarActivo = async (h: HorarioEstandar) => {
        if (!puedeEditar) return
        try {
            await guardarHorario({
                empleadoId: h.empleadoId, empleadoNombre: h.empleadoNombre,
                dias: h.dias, activo: !(h.activo !== false), nota: h.nota,
            })
        } catch { toast.error('No se pudo cambiar el estado') }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-24 px-2 sm:px-4"
        >
            {/* --- CABECERA --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/40 dark:bg-white/5 backdrop-blur-3xl p-4 sm:p-6 rounded-[2rem] border border-white/20 shadow-2xl gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                        <CalendarClock className="text-white w-5 h-5 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase truncate">
                            Horarios
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mt-1">
                            Semana tipo del equipo
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    {puedeEditar && filas.length > 0 && (
                        <Button
                            onClick={aplicarHorarioCasa}
                            disabled={ocupado}
                            title="8:00–12:30 y 2:00–6:00, de lunes a sábado"
                            className="h-11 flex-1 sm:flex-none rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-black uppercase text-[10px] tracking-widest gap-2 px-4 shadow-lg active:scale-95 transition-all"
                        >
                            {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Horario de la casa
                        </Button>
                    )}
                    <Badge className="rounded-2xl bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-0 px-4 py-2.5 font-black uppercase text-[10px] tracking-widest shadow-sm shrink-0">
                        {NOMBRES_DIAS[diaHoy]}
                    </Badge>
                </div>
            </header>

            {/* --- QUIÉN VIENE HOY --- */}
            <Card className="rounded-[2rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Hoy vienen {hoy.length} de {filas.length}
                    </p>
                </div>

                {hoy.length === 0 ? (
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 py-2">
                        Nadie tiene horario asignado para hoy
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {hoy.map(a => (
                            <motion.div
                                key={a.empleadoId}
                                layout
                                className={cn(
                                    'flex items-center gap-2.5 rounded-2xl pl-2.5 pr-4 py-2.5 border transition-colors',
                                    a.presenteAhora
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                        : 'bg-slate-50 dark:bg-white/5 border-transparent'
                                )}
                            >
                                <div className={cn(
                                    'w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0',
                                    a.presenteAhora ? 'bg-emerald-500 text-white' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                                )}>
                                    {a.empleadoNombre.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-800 dark:text-white capitalize truncate leading-tight flex items-center gap-1.5">
                                        {a.empleadoNombre}
                                        {a.presenteAhora && <CircleDot className="w-3 h-3 text-emerald-500 shrink-0" />}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-wide whitespace-nowrap">
                                        {resumenBloques(a.bloques)}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </Card>

            {/* --- SEMANA TIPO --- */}
            <Card className="rounded-[2rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                {cargando ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                ) : filas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Users className="w-10 h-10 text-slate-300" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin empleados activos</p>
                        <p className="text-[11px] font-bold text-slate-400">Regístralos en Gestión de Personal.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <div className="min-w-[860px]">
                            {/* Encabezado */}
                            <div className="grid grid-cols-[190px_repeat(7,1fr)_80px] bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                                <div className="px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Empleado</p>
                                </div>
                                {SEMANA_LABORAL.map(d => (
                                    <div key={d} className={cn('px-2 py-3 text-center', d === diaHoy && 'bg-blue-50 dark:bg-blue-500/10')}>
                                        <p className={cn(
                                            'text-[10px] font-black uppercase tracking-widest',
                                            d === diaHoy ? 'text-blue-600' : 'text-slate-400'
                                        )}>
                                            {NOMBRES_DIAS_CORTO[d]}
                                        </p>
                                    </div>
                                ))}
                                <div className="px-2 py-3 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horas</p>
                                </div>
                            </div>

                            {/* Filas */}
                            {filas.map(h => {
                                const horas = horasSemanales(h)
                                const inactivo = h.activo === false
                                return (
                                    <div
                                        key={h.empleadoId}
                                        className={cn(
                                            'grid grid-cols-[190px_repeat(7,1fr)_80px] border-b border-slate-50 dark:border-white/5 transition-colors',
                                            inactivo ? 'opacity-45' : 'hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
                                        )}
                                    >
                                        <div className="px-4 py-3 flex items-center gap-2.5 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center font-black text-slate-500 uppercase text-xs shrink-0">
                                                {h.empleadoNombre.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white capitalize truncate leading-tight">
                                                    {h.empleadoNombre}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                                    {inactivo ? 'De baja' : `${horas.toFixed(1)} h/semana`}
                                                </p>
                                            </div>
                                            {puedeEditar && (
                                                <Switch
                                                    checked={!inactivo}
                                                    onCheckedChange={() => alternarActivo(h)}
                                                    className="shrink-0 scale-75"
                                                />
                                            )}
                                        </div>

                                        {SEMANA_LABORAL.map(d => {
                                            const bloques = bloquesDelDia(h, d)
                                            return (
                                                <button
                                                    key={d}
                                                    onClick={() => abrirDia(h, d)}
                                                    disabled={!puedeEditar}
                                                    title={puedeEditar ? `Editar ${NOMBRES_DIAS[d]}` : undefined}
                                                    className={cn(
                                                        'px-1.5 py-2 border-l border-slate-50 dark:border-white/5 min-h-[62px] flex flex-col gap-1 items-stretch justify-center transition-colors',
                                                        d === diaHoy && 'bg-blue-50/40 dark:bg-blue-500/[0.06]',
                                                        puedeEditar && 'hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer'
                                                    )}
                                                >
                                                    {bloques.length === 0 ? (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200 dark:text-slate-700">
                                                            —
                                                        </span>
                                                    ) : bloques.map((b, i) => (
                                                        <span
                                                            key={i}
                                                            className="rounded-lg px-1.5 py-1 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/60 dark:border-emerald-500/25 text-[9px] font-black text-emerald-700 dark:text-emerald-300 leading-tight whitespace-nowrap"
                                                        >
                                                            {formatoAmPm(b.inicio)}<br />{formatoAmPm(b.fin)}
                                                        </span>
                                                    ))}
                                                </button>
                                            )
                                        })}

                                        <div className="px-2 py-3 flex items-center justify-center border-l border-slate-50 dark:border-white/5">
                                            <Badge className={cn(
                                                'rounded-full px-2.5 py-1 text-[10px] font-black border-0',
                                                horas > 0
                                                    ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                                                    : 'bg-transparent text-slate-300'
                                            )}>
                                                {horas > 0 ? `${horas.toFixed(0)}h` : '—'}
                                            </Badge>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </Card>

            {/* --- EDITAR UN DÍA --- */}
            <Dialog open={!!editando} onOpenChange={a => !a && setEditando(null)}>
                <DialogContent className="rounded-[2rem] max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase italic tracking-tight flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-600" />
                            {editando && NOMBRES_DIAS[editando.dia]}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-slate-400 capitalize">
                            {editando?.horario.empleadoNombre}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        {/* Turnos de un toque */}
                        <div>
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Turnos rápidos
                            </Label>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {TURNOS_RAPIDOS.map(t => (
                                    <button
                                        key={t.label}
                                        onClick={() => setBloquesEdit(t.bloques.map(b => ({ ...b })))}
                                        className="px-3 h-8 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-600 dark:text-slate-300 hover:text-blue-600 font-black uppercase text-[9px] tracking-wide transition-colors"
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Bloques */}
                        <div className="space-y-2">
                            <AnimatePresence initial={false}>
                                {bloquesEdit.map((b, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }}
                                        className="flex items-center gap-2"
                                    >
                                        <Input
                                            type="time" value={b.inicio}
                                            onChange={e => cambiarBloque(i, 'inicio', e.target.value)}
                                            className="h-11 rounded-xl border-none bg-slate-50 dark:bg-white/5 font-black text-center text-xs"
                                        />
                                        <span className="text-slate-300 font-black">—</span>
                                        <Input
                                            type="time" value={b.fin}
                                            onChange={e => cambiarBloque(i, 'fin', e.target.value)}
                                            className="h-11 rounded-xl border-none bg-slate-50 dark:bg-white/5 font-black text-center text-xs"
                                        />
                                        <Button
                                            variant="ghost" size="icon"
                                            onClick={() => setBloquesEdit(prev => prev.filter((_, x) => x !== i))}
                                            className="h-10 w-10 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            <button
                                onClick={() => setBloquesEdit(prev => [...prev, { inicio: '08:00', fin: '12:00' }])}
                                className="w-full h-11 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-slate-400 hover:text-blue-600 hover:border-blue-300 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" /> Añadir tramo
                            </button>
                        </div>

                        {bloquesEdit.length > 1 && (
                            <div className="flex items-start gap-2 bg-slate-50 dark:bg-white/5 rounded-xl p-2.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-slate-400 leading-snug">
                                    Turno partido: entra, se va y vuelve.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
                        {bloquesEdit.length > 0 && (
                            <Button
                                variant="ghost" onClick={copiarASemana} disabled={ocupado}
                                className="rounded-xl text-blue-600 hover:bg-blue-50 font-black uppercase text-[10px] tracking-widest gap-2 sm:mr-auto"
                            >
                                <Copy className="w-3.5 h-3.5" /> Lunes a sábado
                            </Button>
                        )}
                        <Button
                            variant="ghost" onClick={() => setEditando(null)}
                            className="rounded-xl font-black uppercase text-[10px] tracking-widest"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={guardar} disabled={ocupado}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest gap-2"
                        >
                            {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
