// @/components/orden/EnviarAlTallerModal.tsx
//
// DE LA FACTURA A LA MESA DE TRABAJO.
//
// Facturación y taller vivían separados: se cobraba una orden y después
// alguien volvía a escribir a mano, en otra pantalla, lo mismo que ya estaba
// escrito — cliente, teléfono, medidas, qué material, para cuándo. Se copiaba
// mal o no se copiaba, y entonces el taller trabajaba de lo que le contaran.
//
// Esto lo arma solo con lo que ya dice la orden y lo enseña ANTES de mandarlo,
// para poder corregirlo: el papel de facturación habla el idioma del cliente
// ("Aviso para la fachada") y el del taller necesita otro ("banner 2x1, ojales
// cada 50cm"). Son dos textos distintos y por eso este es editable.
//
// Lo que se manda no toca la orden facturada. Son documentos separados a
// propósito: si el taller anota "faltó material" eso no puede acabar en el
// recibo del cliente.

"use client"

import React, { useEffect, useMemo, useState } from 'react'

import {
    Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    Hammer, X, Loader2, Send, User, Phone, Calendar, Ruler, Layers, PenTool,
    Printer, Scissors, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { claveFechaLocal } from '@/lib/utils/fechas'
import { subscribeToEmpleados } from '@/lib/services/gastos-service'
import type { Empleado } from '@/lib/types/gastos'

/** Las mismas áreas del taller, con el mismo id: es la pantalla que lo recibe. */
const AREAS = [
    { id: 'DISENO', label: 'Diseño', icon: PenTool },
    { id: 'IMPRESION', label: 'Impresión', icon: Printer },
    { id: 'CORTE_LASER', label: 'Corte / Láser', icon: Scissors },
    { id: 'PRODUCCION', label: 'Producción (Armado)', icon: Layers },
]

/** Los mismos nombres cortos que usa el taller en sus casillas. */
const MATERIALES = ['Vinil', 'Banner', 'Micro', 'Clear', 'Stickers', 'V. Corte', 'DTF', 'V. Textil', 'Laser']
const ADICIONALES = ['Refilado', 'Bolsillos', 'Laminado', 'PVC', 'Ojales', 'Tubos', 'Otros']

/**
 * Qué material del taller nombra este renglón.
 *
 * Las casillas del taller son cortas ("Micro", "V. Corte") y la descripción de
 * la orden es libre, así que hay que traducir. Lo que no se reconoce no se
 * marca: una casilla mal puesta manda a cortar lo que no era.
 *
 * SOLO SE LEE EL NOMBRE DEL RENGLÓN. Los campos materialImpresion y
 * materialDetalleCorte traen el valor por defecto del formulario —"Vinil
 * Brillante", "Acrilico 3mm Transparente"— en casi todos los renglones, así
 * que leerlos marcaba Vinil en una orden que era toda banner. Un dato que
 * todos comparten no distingue nada.
 */
const materialesDeItems = (items: any[]): string[] => {
    const texto = items.map(i => String(i?.nombre || '')).join(' ').toLowerCase()

    const marcados = new Set<string>()
    const pon = (m: string) => marcados.add(m)

    if (/\bclear\b/.test(texto)) pon('Clear')
    if (/microperforado|micro\b/.test(texto)) pon('Micro')
    if (/banner|lona|mesh/.test(texto)) pon('Banner')
    if (/sticker|stiker|calcomania/.test(texto)) pon('Stickers')
    if (/\bdtf\b/.test(texto)) pon('DTF')
    if (/textil/.test(texto)) pon('V. Textil')
    if (/vinil con corte|corte de vinil|plotter|plóter/.test(texto)) pon('V. Corte')
    if (/laser|láser|acrilic|acrílic|\bmdf\b|grabado/.test(texto)) pon('Laser')
    if (/vinil|vinilo|rotulad/.test(texto) && !marcados.has('V. Corte')) pon('Vinil')

    return [...marcados]
}

/** Los acabados que la orden ya pidió. Salen de las casillas, no del texto. */
const adicionalesDeItems = (items: any[]): string[] => {
    const marcados = new Set<string>()
    items.forEach(i => {
        if (i?.impresionLaminado) marcados.add('Laminado')
        if (i?.impresionOjales) marcados.add('Ojales')
        if (i?.impresionTubos) marcados.add('Tubos')
        if (i?.impresionBolsillos) marcados.add('Bolsillos')
        if (i?.impresionPegado) marcados.add('PVC')
        if (i?.impresionRefilado) marcados.add('Refilado')
    })
    return [...marcados]
}

/**
 * El área por la que empieza.
 *
 * Si hay corte láser empieza por ahí y si no por impresión; el diseño lo pone
 * quien lo sepa. Es una propuesta: se cambia con un clic antes de mandarla.
 */
const areaInicial = (items: any[]): string => {
    const hayCorte = items.some(i =>
        String(i?.tipoServicio || '').toUpperCase().startsWith('CORTE') || i?.unidad === 'tiempo')
    return hayCorte ? 'CORTE_LASER' : 'IMPRESION'
}

/** El trabajo, renglón a renglón, como se lee en la mesa. */
const descripcionDeOrden = (orden: any): string =>
    (orden?.items || []).map((i: any) => {
        const cant = Number(i?.cantidad) || 1
        const x = Number(i?.medidaXCm) || 0
        const y = Number(i?.medidaYCm) || 0
        const medida = (x > 0 && y > 0) ? ` — ${x}x${y} cm` : ''
        const tiempo = i?.tiempoCorte && i.tiempoCorte !== 'Servicio' ? ` — ${i.tiempoCorte}` : ''
        return `${cant} x ${String(i?.nombre || 'Sin nombre').trim()}${medida}${tiempo}`
    }).join('\n')

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    orden: any | null
    responsablePorDefecto?: string
}

export function EnviarAlTallerModal({ open, onOpenChange, orden, responsablePorDefecto }: Props) {
    const [enviando, setEnviando] = useState(false)
    const [yaEnviada, setYaEnviada] = useState<number | null>(null)

    const [area, setArea] = useState('IMPRESION')
    const [responsable, setResponsable] = useState('')
    const [fechaEntrega, setFechaEntrega] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [materiales, setMateriales] = useState<string[]>([])
    const [adicionales, setAdicionales] = useState<string[]>([])
    const [observaciones, setObservaciones] = useState('')
    const [notaMaterial, setNotaMaterial] = useState('')

    /**
     * Quién lo hace sale de la gente registrada, no de escribirlo.
     *
     * Escrito a mano el mismo nombre acaba de cuatro formas —"Jose", "José",
     * "jose angel", "J. Angel"— y entonces no se puede contar cuánto hizo cada
     * quien ni buscar sus trabajos.
     */
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    useEffect(() => subscribeToEmpleados(setEmpleados), [])

    const nombresEmpleados = useMemo(
        () => empleados
            .map(e => [e.nombre, e.apellido].filter(Boolean).join(' ').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b)),
        [empleados]
    )

    const items = useMemo(() => (orden?.items || []) as any[], [orden])

    // Al abrir se rellena con lo que ya dice la orden. No se toca mientras el
    // modal está abierto: si no, escribir aquí y que algo lo sobrescriba.
    useEffect(() => {
        if (!open || !orden) return
        setArea(areaInicial(items))
        setResponsable(responsablePorDefecto || '')
        setFechaEntrega(String(orden.fechaEntrega || '').slice(0, 10))
        setDescripcion(descripcionDeOrden(orden))
        setMateriales(materialesDeItems(items))
        setAdicionales(adicionalesDeItems(items))
        setObservaciones('')
        setNotaMaterial('')
    }, [open, orden, items, responsablePorDefecto])

    /**
     * ¿Ya se mandó esta orden al taller?
     *
     * Mandarla dos veces la pone dos veces en la mesa, y el taller acaba
     * imprimiendo el doble. Se avisa, no se prohíbe: a veces se manda un
     * trabajo aparte de la misma orden y eso es correcto.
     */
    useEffect(() => {
        if (!open || !orden?.ordenNumero) { setYaEnviada(null); return }
        let vivo = true
        getDocs(query(
            collection(db, 'ordenes_servicio'),
            where('ordenNumero', '==', orden.ordenNumero)
        ))
            .then(s => { if (vivo) setYaEnviada(s.size) })
            .catch(() => { if (vivo) setYaEnviada(null) })
        return () => { vivo = false }
    }, [open, orden?.ordenNumero])

    const alternar = (lista: string[], set: (v: string[]) => void, v: string) =>
        set(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v])

    const enviar = async () => {
        if (!descripcion.trim()) return toast.error('Escribe qué hay que hacer')

        setEnviando(true)
        try {
            await addDoc(collection(db, 'ordenes_servicio'), {
                ordenNumero: orden?.ordenNumero ?? null,
                cliente: orden?.cliente?.nombreRazonSocial || 'Sin cliente',
                telefono: orden?.cliente?.telefono || '',
                responsable: responsable.trim(),
                fechaInicio: claveFechaLocal(),
                fechaEntrega,
                descripcion: descripcion.trim(),
                materiales,
                notaMaterial: notaMaterial.trim(),
                medidas: { alto: '', ancho: '' },
                adicionales,
                observaciones: observaciones.trim(),
                areaActual: area,
                estado: 'PENDIENTE',
                creadoEn: new Date().toISOString(),
            })
            toast.success(`Orden #${orden?.ordenNumero ?? ''} enviada al taller`)
            onOpenChange(false)
        } catch (e: any) {
            toast.error(`No se pudo enviar: ${e?.message || e}`)
        } finally {
            setEnviando(false)
        }
    }

    if (!orden) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] overflow-hidden max-h-[92vh] flex flex-col">
                <header className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50 dark:bg-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                            <Hammer className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-lg font-black uppercase italic tracking-tight leading-none">
                                Mandar a producir
                            </DialogTitle>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 truncate">
                                Orden #{orden.ordenNumero} · {orden.cliente?.nombreRazonSocial}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full text-slate-400 shrink-0">
                        <X className="w-4 h-4" />
                    </Button>
                </header>

                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
                    {yaEnviada != null && yaEnviada > 0 && (
                        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-3 flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                                Esta orden ya se mandó al taller {yaEnviada === 1 ? 'una vez' : `${yaEnviada} veces`}.
                                Si mandas otra, quedan las dos en la mesa.
                            </p>
                        </div>
                    )}

                    {/* Lo que ya se sabe de la orden. No se edita aquí: se
                        cambia en la orden, que es de donde sale. */}
                    <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4 grid grid-cols-2 gap-3">
                        <Dato icon={<User className="w-3 h-3" />} et="Cliente" v={orden.cliente?.nombreRazonSocial} />
                        <Dato icon={<Phone className="w-3 h-3" />} et="Teléfono" v={orden.cliente?.telefono || '—'} />
                        <Dato icon={<Ruler className="w-3 h-3" />} et="Renglones" v={`${items.length}`} />
                        <Dato icon={<Calendar className="w-3 h-3" />} et="Total" v={`$${Number(orden.totalUSD || 0).toFixed(2)}`} />
                    </div>

                    <Campo et="¿Por dónde empieza?">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {AREAS.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => setArea(a.id)}
                                    className={cn(
                                        'h-11 rounded-xl border font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors',
                                        area === a.id
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600'
                                            : 'border-black/10 dark:border-white/10 text-slate-400'
                                    )}
                                >
                                    <a.icon className="w-3.5 h-3.5" /> {a.label}
                                </button>
                            ))}
                        </div>
                    </Campo>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Campo et="Quién lo hace">
                            <select
                                value={responsable}
                                onChange={e => setResponsable(e.target.value)}
                                className="w-full h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold px-3 outline-none"
                            >
                                <option value="">Sin asignar</option>
                                {nombresEmpleados.map(n => <option key={n} value={n}>{n}</option>)}
                                {/* Un responsable escrito antes que ya no está en
                                    la lista no se pierde de vista al reabrir. */}
                                {responsable && !nombresEmpleados.includes(responsable) && (
                                    <option value={responsable}>{responsable}</option>
                                )}
                            </select>
                        </Campo>
                        <Campo et="Fecha de entrega">
                            <Input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                                className="h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold" />
                        </Campo>
                    </div>

                    {/* EL TRABAJO, EDITABLE.

                        Sale armado de los renglones de la orden, pero el papel
                        de facturación habla el idioma del cliente y la mesa
                        necesita otro. Por eso se puede reescribir. */}
                    <Campo et="Qué hay que hacer" ayuda="Sale de los renglones de la orden. Reescríbelo como se entienda en la mesa.">
                        <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
                            rows={Math.min(10, Math.max(3, descripcion.split('\n').length))}
                            className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold leading-relaxed" />
                    </Campo>

                    <Campo et="Material" ayuda="Marcado con lo que dice la orden. Lo que no se reconoce se deja sin marcar.">
                        <div className="flex flex-wrap gap-1.5">
                            {MATERIALES.map(m => (
                                <Pastilla key={m} activo={materiales.includes(m)} onClick={() => alternar(materiales, setMateriales, m)}>{m}</Pastilla>
                            ))}
                        </div>
                        <Input value={notaMaterial} onChange={e => setNotaMaterial(e.target.value)}
                            placeholder="Nota del material: color, grosor, de qué rollo..."
                            className="h-10 mt-2 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold" />
                    </Campo>

                    <Campo et="Acabados">
                        <div className="flex flex-wrap gap-1.5">
                            {ADICIONALES.map(a => (
                                <Pastilla key={a} activo={adicionales.includes(a)} onClick={() => alternar(adicionales, setAdicionales, a)}>{a}</Pastilla>
                            ))}
                        </div>
                    </Campo>

                    <Campo et="Observaciones para el taller" ayuda="No sale en ningún papel del cliente. Es para quien lo va a hacer.">
                        <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                            rows={3}
                            placeholder="Ej: el cliente trae el material · urgente para la mañana · confirmar color antes de cortar"
                            className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold leading-relaxed" />
                    </Campo>
                </div>

                <footer className="p-4 sm:p-5 border-t border-black/5 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                    <Button
                        onClick={enviar}
                        disabled={enviando}
                        className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg shadow-amber-500/20"
                    >
                        {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando</> : <><Send className="w-4 h-4" /> Enviar al taller</>}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    )
}

function Dato({ icon, et, v }: { icon: React.ReactNode; et: string; v?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">{icon} {et}</p>
            <p className="text-xs font-black truncate mt-0.5">{v || '—'}</p>
        </div>
    )
}

function Campo({ et, ayuda, children }: { et: string; ayuda?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{et}</Label>
            {ayuda && <p className="text-[10px] font-bold text-slate-400 leading-snug -mt-1">{ayuda}</p>}
            {children}
        </div>
    )
}

function Pastilla({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'h-8 px-3 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors',
                activo
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
            )}
        >
            {children}
        </button>
    )
}
