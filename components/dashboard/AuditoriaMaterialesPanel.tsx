// @/components/dashboard/AuditoriaMaterialesPanel.tsx
//
// Ponerle a cada renglón de una orden el material que realmente gastó.
//
// Primero simula y enseña lo que va a hacer; solo escribe cuando se pulsa el
// botón. Los renglones cuya descripción no nombra ningún material quedan
// listados aparte para revisarlos a mano: es preferible una lista de
// pendientes a un balance que parece completo y no lo está.

"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ClipboardCheck, Loader2, Ruler, AlertTriangle, Check,
    ChevronDown, ChevronLeft, ChevronRight, ShieldAlert, ListTree,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    planificarAuditoria, aplicarAuditoria,
    type PlanAuditoria, type RenglonAuditado,
} from '@/lib/services/auditoria-materiales'
import { olvidarPresupuestosEnCache } from '@/lib/hooks/use-consumo-materiales'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const n2 = (v: number) => v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
    /**
     * El mes que manda, el de la pantalla.
     *
     * El panel tenia su propio mes y la pantalla el suyo: dos selectores a la
     * vista, con la misma pinta, y solo uno movia esto. Cambiabas el mes
     * arriba y la auditoria seguia mostrando otro sin decir nada.
     */
    anio?: number
    mes?: number
    /** Las flechas del panel mueven el mes de la pantalla, no uno aparte. */
    onCambiarMes?: (anio: number, mes: number) => void
}


/**
 * LOS DOS SELECTORES DE UN RENGLON.
 *
 * Listas y no texto libre: un nombre escrito a mano no cuadra con el catalogo
 * y ensucia el balance sin que se note.
 *
 * El uso solo aparece cuando el material elegido tiene usos dados de alta. Un
 * desplegable vacio se lee como "falta algo", y no falta nada.
 */
function SelectoresRenglon({ material, varianteId, opciones, onMaterial, onVariante, compacto }: {
    material: string
    varianteId?: string
    opciones: PlanAuditoria['opciones']
    onMaterial: (v: string) => void
    onVariante: (v: string) => void
    compacto?: boolean
}) {
    const op = opciones.find(o => o.nombre === material)
    const usos = op?.variantes || []

    const base = "shrink-0 h-7 rounded-lg px-2 text-[10px] font-black uppercase border outline-none"

    return (
        <>
            <select
                value={material}
                onChange={e => onMaterial(e.target.value)}
                className={cn(base, compacto ? "w-32" : "w-40",
                    material
                        ? "border-emerald-300 bg-white dark:bg-black/30 text-emerald-700 dark:text-emerald-400"
                        : "border-amber-300 bg-white/80 dark:bg-black/30 text-amber-700 dark:text-amber-500")}
            >
                <option value="">¿Qué material?</option>
                {opciones.map(o => (
                    <option key={o.nombre} value={o.nombre}>{o.nombre}</option>
                ))}
            </select>

            {usos.length > 0 && (
                <select
                    value={varianteId || ''}
                    onChange={e => onVariante(e.target.value)}
                    className={cn(base, compacto ? "w-32" : "w-36",
                        "border-indigo-200 bg-white dark:bg-black/30 text-indigo-700 dark:text-indigo-400")}
                >
                    <option value="">¿En qué se usó?</option>
                    {usos.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
            )}
        </>
    )
}

export function AuditoriaMaterialesPanel({ anio, mes, onCambiarMes }: Props = {}) {
    const { userData } = useAuth()
    const puedeAplicar = esAdmin(userData?.rol)

    // Sin mes de fuera se apana con el de hoy: asi el panel sigue sirviendo
    // suelto, sin que quien lo monte tenga que llevarle la cuenta.
    const [refPropia, setRefPropia] = useState(() => new Date())
    const ref = (anio != null && mes != null) ? new Date(anio, mes, 1) : refPropia
    const [plan, setPlan] = useState<PlanAuditoria | null>(null)
    const [calculando, setCalculando] = useState(true)
    const [aplicando, setAplicando] = useState(false)
    /**
     * La lista de los que hay que resolver a mano arranca ABIERTA.
     *
     * Estaba plegada y no se veia que se podian tocar: parecia un aviso y no
     * un sitio donde trabajar. Si hay renglones esperando decision, lo que
     * hace falta es verlos, no un titular que diga cuantos son.
     */
    const [verManuales, setVerManuales] = useState(true)
    const [verOrdenes, setVerOrdenes] = useState(false)

    /**
     * Lo que una persona corrigio, mientras no se guarda.
     *
     * Vale para cualquier renglon, no solo para los que la maquina no supo
     * leer: lo deducido de una descripcion se equivoca, y quien audita tiene
     * que poder decir "esto no era vinil, era clear" sin salir de aqui.
     *
     * La clave lleva la orden y la posicion del renglon dentro de ella: es lo
     * mismo con lo que se escribe despues, asi que no se pueden cruzar.
     */
    const [aMano, setAMano] = useState<Record<string, { material: string; varianteId?: string }>>({})

    const clave = (r: RenglonAuditado) => `${r.ordenId}:${r.indice}`

    /** Cambia el material de un renglon; al cambiarlo, el uso anterior deja de valer. */
    const ponerMaterial = (k: string, material: string) =>
        setAMano(prev => {
            const copia = { ...prev }
            if (material) copia[k] = { material }
            else delete copia[k]
            return copia
        })

    const ponerVariante = (k: string, varianteId: string) =>
        setAMano(prev => prev[k] ? { ...prev, [k]: { ...prev[k], varianteId: varianteId || undefined } } : prev)

    const calcular = useCallback(async (fecha: Date) => {
        setCalculando(true)
        try {
            setPlan(await planificarAuditoria(fecha.getFullYear(), fecha.getMonth()))
            // Lo elegido a mano era de otro mes: arrastrarlo escribiria
            // material en renglones que nadie miro.
            setAMano({})
        } catch (e) {
            console.error(e)
            toast.error('No se pudo leer las órdenes del mes')
            setPlan(null)
        } finally {
            setCalculando(false)
        }
    }, [])

    // Se mira el ano y el mes, no el objeto Date: cuando el mes viene de
    // fuera se construye uno nuevo en cada render y el efecto se dispararia
    // sin parar, releyendo las ordenes cada vez.
    const anioRef = ref.getFullYear()
    const mesRef = ref.getMonth()
    useEffect(() => { calcular(new Date(anioRef, mesRef, 1)) }, [anioRef, mesRef, calcular])

    const mover = (n: number) => {
        const destino = new Date(ref.getFullYear(), ref.getMonth() + n, 1)
        if (onCambiarMes) onCambiarMes(destino.getFullYear(), destino.getMonth())
        else setRefPropia(destino)
    }

    /**
     * El plan que de verdad se va a escribir: lo que leyo la maquina mas lo
     * que resolvio una persona.
     *
     * Los de a mano entran como los otros, pero marcados: en la orden queda
     * escrito quien puso el material.
     */
    const planFinal = useMemo(() => {
        if (!plan) return null

        const corregir = (r: RenglonAuditado): RenglonAuditado => {
            const puesto = aMano[clave(r)]
            if (!puesto) return r

            const op = plan.opciones.find(o => o.nombre === puesto.material)
            const va = op?.variantes.find(v => v.id === puesto.varianteId)

            return {
                ...r,
                material: puesto.material,
                productoId: op?.productoId ?? null,
                varianteId: va?.id ?? null,
                varianteNombre: va?.nombre ?? null,
                origen: 'manual' as const,
            }
        }

        // Los corregidos entran aunque ya estuvieran auditados: corregir un
        // material equivocado es justo lo que hay que poder volver a escribir.
        const tocados = new Set(Object.keys(aMano))
        const esTocado = (r: RenglonAuditado) => tocados.has(clave(r))

        const automaticos = [
            ...plan.automaticos.map(r => esTocado(r) ? { ...corregir(r), yaAuditado: false } : r),
            ...plan.manuales.filter(esTocado).map(corregir),
        ]

        return { ...plan, automaticos }
    }, [plan, aMano])

    const aplicar = async () => {
        if (!planFinal) return
        const pendientes = planFinal.automaticos.filter(r => !r.yaAuditado).length
        if (!pendientes) return toast.info('No hay nada nuevo que auditar en este mes')

        const ok = window.confirm(
            `Se va a escribir el material en ${pendientes} renglones de ${planFinal.ordenes} órdenes.\n\n` +
            `No se toca ningún precio ni ningún otro dato.\n\n¿Continuar?`
        )
        if (!ok) return

        setAplicando(true)
        try {
            const n = await aplicarAuditoria(planFinal)
            olvidarPresupuestosEnCache()
            toast.success(`${n} órdenes auditadas`)
            await calcular(new Date(anioRef, mesRef, 1))
        } catch (e) {
            console.error(e)
            toast.error('No se pudo guardar la auditoría')
        } finally {
            setAplicando(false)
        }
    }

    /**
     * Lo mismo, pero orden por orden.
     *
     * El resumen por material dice cuanto vinil sale del rollo, y eso sirve
     * para el balance. Pero para REVISAR antes de escribir hace falta lo otro:
     * ver una orden entera y comprobar que a sus renglones les toco lo que
     * les tocaba. En una tabla corrida de 118 renglones eso no se puede.
     *
     * Van de mas nueva a mas vieja: si algo esta mal, lo mas probable es que
     * este en lo de ayer.
     */
    const porOrden = useMemo(() => {
        if (!plan) return []

        const mapa = new Map<string, {
            ordenId: string
            numero: string | number
            fecha: string
            cliente: string
            renglones: (RenglonAuditado & { auto: boolean })[]
            m2: number
            sinMaterial: number
        }>()

        const meter = (r: RenglonAuditado, auto: boolean) => {
            let g = mapa.get(r.ordenId)
            if (!g) {
                g = { ordenId: r.ordenId, numero: r.ordenNumero, fecha: r.fecha,
                      cliente: r.cliente, renglones: [], m2: 0, sinMaterial: 0 }
                mapa.set(r.ordenId, g)
            }
            g.renglones.push({ ...r, auto })
            g.m2 += r.m2
            if (!auto) g.sinMaterial++
        }

        plan.automaticos.forEach(r => meter(r, true))
        plan.manuales.forEach(r => meter(r, false))

        return Array.from(mapa.values())
            .map(g => ({ ...g, m2: Math.round(g.m2 * 100) / 100 }))
            .sort((a, b) => Number(b.numero) - Number(a.numero))
    }, [plan])

    const pendientes = planFinal ? planFinal.automaticos.filter(r => !r.yaAuditado).length : 0
    const yaHechos = plan ? plan.automaticos.filter(r => r.yaAuditado).length : 0
    const resueltosAMano = Object.keys(aMano).length

    return (
        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Auditoría de Materiales</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Qué material gastó de verdad cada orden
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-white/5 p-1">
                    <Button variant="ghost" size="icon" onClick={() => mover(-1)} className="h-8 w-8 rounded-xl">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="px-2 text-[11px] font-black uppercase tracking-widest tabular-nums">
                        {MESES[ref.getMonth()]} {ref.getFullYear()}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => mover(1)} className="h-8 w-8 rounded-xl">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <p className="text-[11px] font-bold text-slate-400 leading-snug max-w-2xl">
                Los campos de material que trae el formulario vienen con un valor por defecto que
                casi nadie cambia, así que no sirven para contar. Esto lee la descripción y las
                medidas de cada renglón y escribe el material real. No toca precios.
                <br />
                <span className="text-slate-500 dark:text-slate-400">
                    Lo que la máquina dedujo mal se corrige aquí abajo, renglón por renglón,
                    antes de guardar.
                </span>
            </p>

            {calculando ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
            ) : !plan || plan.renglones === 0 ? (
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 text-center py-10">
                    No hay órdenes en {MESES[ref.getMonth()]}
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { v: plan.ordenes, t: 'Órdenes' },
                            { v: plan.renglones, t: 'Renglones' },
                            { v: n2(plan.m2Totales), t: 'm² a registrar', destacado: true },
                            { v: plan.manuales.length, t: 'A revisar a mano', alerta: plan.manuales.length > 0 },
                        ].map(c => (
                            <div key={c.t} className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3.5">
                                <p className={cn(
                                    "text-xl font-black tracking-tighter tabular-nums leading-none",
                                    c.destacado && "text-indigo-600",
                                    c.alerta && "text-amber-600"
                                )}>{c.v}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1.5">{c.t}</p>
                            </div>
                        ))}
                    </div>

                    {plan.porMaterial.length > 0 && (
                        <div className="rounded-2xl border border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
                            {plan.porMaterial.map(m => (
                                <div key={m.material} className="flex items-center gap-3 px-4 py-2.5">
                                    <Ruler className="w-3.5 h-3.5 shrink-0 text-slate-300" />
                                    <span className="flex-1 min-w-0 truncate text-xs font-black">{m.material}</span>
                                    <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
                                        {m.renglones} {m.renglones === 1 ? 'renglón' : 'renglones'}
                                    </span>
                                    <span className="text-sm font-black tabular-nums shrink-0 w-24 text-right">
                                        {m.m2 > 0 ? `${n2(m.m2)} m²` : <span className="text-slate-300">—</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {porOrden.length > 0 && (
                        <div className="rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setVerOrdenes(v => !v)}
                                className="w-full flex items-center gap-2.5 p-3.5 text-left"
                            >
                                <ListTree className="w-4 h-4 shrink-0 text-indigo-500" />
                                <span className="flex-1 min-w-0 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                    Corregir orden por orden — {porOrden.length} órdenes
                                </span>
                                <ChevronDown className={cn("w-4 h-4 shrink-0 text-slate-400 transition-transform", verOrdenes && "rotate-180")} />
                            </button>

                            <AnimatePresence initial={false}>
                                {verOrdenes && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-3.5 pb-3.5 max-h-[26rem] overflow-y-auto custom-scrollbar space-y-2.5">
                                            {porOrden.map(o => (
                                                <div key={o.ordenId} className="rounded-xl bg-slate-50 dark:bg-white/5 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-black/5 dark:border-white/5">
                                                        <span className="font-black tabular-nums text-xs shrink-0">#{o.numero}</span>
                                                        <span className="flex-1 min-w-0 truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                            {o.cliente}
                                                        </span>
                                                        {o.sinMaterial > 0 && (
                                                            <span className="shrink-0 text-[9px] font-black uppercase text-amber-600 bg-amber-100 dark:bg-amber-500/15 rounded-full px-2 py-0.5">
                                                                {o.sinMaterial} a mano
                                                            </span>
                                                        )}
                                                        <span className="shrink-0 text-[11px] font-black tabular-nums text-indigo-600 w-20 text-right">
                                                            {o.m2 > 0 ? `${n2(o.m2)} m²` : <span className="text-slate-300">—</span>}
                                                        </span>
                                                    </div>

                                                    <div className="divide-y divide-black/5 dark:divide-white/5">
                                                        {o.renglones.map((r, i) => (
                                                            <div key={`${r.ordenId}-${r.indice}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                                                                <span className="flex-1 min-w-0 truncate font-bold text-slate-600 dark:text-slate-300">
                                                                    {r.descripcion || <span className="text-slate-400 italic">sin descripción</span>}
                                                                </span>

                                                                {r.laminado && (
                                                                    <span className="shrink-0 text-[8px] font-black uppercase text-sky-600 bg-sky-100 dark:bg-sky-500/15 rounded-full px-1.5">
                                                                        laminado
                                                                    </span>
                                                                )}

                                                                {/* Editable, no una etiqueta.
                                                                    Lo que la maquina dedujo se equivoca, y quien
                                                                    audita tiene que poder decir "esto no era vinil,
                                                                    era clear" aqui mismo, viendo la orden entera. */}
                                                                <SelectoresRenglon
                                                                    compacto
                                                                    material={aMano[clave(r)]?.material ?? (r.material || '')}
                                                                    varianteId={aMano[clave(r)]?.varianteId ?? (r.varianteId || undefined)}
                                                                    opciones={plan.opciones}
                                                                    onMaterial={v => ponerMaterial(clave(r), v)}
                                                                    onVariante={v => ponerVariante(clave(r), v)}
                                                                />

                                                                {r.yaAuditado && !aMano[clave(r)] && (
                                                                    <span className="shrink-0 text-[8px] font-black uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 rounded-full px-1.5">
                                                                        guardado
                                                                    </span>
                                                                )}

                                                                <span className="shrink-0 tabular-nums text-slate-400 w-16 text-right">
                                                                    {r.m2 > 0 ? `${n2(r.m2)} m²` : (r.tiempo || '—')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {yaHechos > 0 && (
                        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-600">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            {yaHechos} {yaHechos === 1 ? 'renglón ya auditado' : 'renglones ya auditados'}; se dejan como están.
                        </div>
                    )}

                    {plan.manuales.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setVerManuales(v => !v)}
                                className="w-full flex items-center gap-2.5 p-3.5 text-left"
                            >
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                                <span className="flex-1 min-w-0 text-[11px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                                    {plan.manuales.length - resueltosAMano} de {plan.manuales.length} renglones
                                    no dicen de qué material son («corte», «negro», «separadores»).
                                    {resueltosAMano > 0
                                        ? ` Ya le pusiste material a ${resueltosAMano}; se guardan junto con el resto.`
                                        : ' Ábrelo y elige el material de cada uno.'}
                                </span>
                                <ChevronDown className={cn("w-4 h-4 shrink-0 text-amber-500 transition-transform", verManuales && "rotate-180")} />
                            </button>

                            <AnimatePresence initial={false}>
                                {verManuales && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-3.5 pb-3.5 max-h-96 overflow-y-auto custom-scrollbar space-y-1">
                                            {plan.manuales.map((r, i) => {
                                                const k = clave(r)
                                                const puesto = aMano[k]
                                                return (
                                                    <div key={`${r.ordenId}-${r.indice}-${i}`} className={cn(
                                                        "flex flex-wrap items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 transition-colors",
                                                        puesto ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-white/70 dark:bg-black/20"
                                                    )}>
                                                        <span className="font-black tabular-nums shrink-0 w-12">#{r.ordenNumero}</span>
                                                        <span className="flex-1 min-w-[8rem] truncate font-bold text-slate-600 dark:text-slate-300">
                                                            {r.descripcion || <span className="italic text-slate-400">sin descripción</span>}
                                                        </span>

                                                        <SelectoresRenglon
                                                            material={puesto?.material || ''}
                                                            varianteId={puesto?.varianteId}
                                                            opciones={plan.opciones}
                                                            onMaterial={v => ponerMaterial(k, v)}
                                                            onVariante={v => ponerVariante(k, v)}
                                                        />

                                                        {r.tiempo && <span className="shrink-0 text-slate-400 tabular-nums">{r.tiempo}</span>}
                                                        <span className="shrink-0 tabular-nums text-slate-500 w-14 text-right">${n2(r.montoUSD)}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {!puedeAplicar ? (
                        <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-slate-400 leading-snug">
                                Solo el administrador puede aplicar la auditoría. Cambia los datos
                                de las órdenes de todo el mes.
                            </p>
                        </div>
                    ) : (
                        <Button
                            onClick={aplicar}
                            disabled={aplicando || pendientes === 0}
                            className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg"
                        >
                            {aplicando
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Auditando</>
                                : pendientes === 0
                                    ? <><Check className="w-4 h-4" /> Mes ya auditado</>
                                    : <><ClipboardCheck className="w-4 h-4" /> Auditar {pendientes} renglones</>}
                        </Button>
                    )}
                </>
            )}
        </Card>
    )
}
