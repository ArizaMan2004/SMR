// @/components/dashboard/SubItemsModal.tsx
//
// Desglose interno de un renglón del presupuesto.
//
// Aquí se dice qué material del catálogo se gastó de verdad en ese renglón y
// cuántos metros cuadrados. El cliente nunca ve esto: no sale en el PDF ni en
// la nota de entrega. Existe para que el balance sepa que detrás de
// "Señalización del local, $450" había 12 m² de vinil impreso y 3 de corte
// láser, y para que el stock de rollos deje de mentir.
//
// El precio no se toca. El renglón vale lo que dice el presupuesto; esto solo
// dice de dónde salió la mercancía.

"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Layers, Plus, Trash2, Ruler, Package, Save, Search,
    AlertTriangle, EyeOff, Boxes,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
    m2DeMedida, m2DeSubItems, nuevoSubItemId,
    type SubItemInterno,
} from '@/lib/services/subitems-service'
import type { CatalogoProducto, CatalogoVariante } from '@/lib/services/catalog-service'

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    /** El renglón que se está desglosando. */
    item: { id: number; descripcion: string; cantidad: number; totalUSD: number; subItems?: SubItemInterno[] } | null
    productos: CatalogoProducto[]
    onGuardar: (itemId: number, subItems: SubItemInterno[]) => void
    /** Solo lectura cuando el presupuesto ya no admite cambios. */
    soloLectura?: boolean
}

const vacio = {
    productoId: '',
    varianteId: '',
    cantidad: '1',
    anchoCm: '',
    altoCm: '',
    m2Manual: '',
    nota: '',
}

export function SubItemsModal({ open, onOpenChange, item, productos, onGuardar, soloLectura }: Props) {
    const [lista, setLista] = useState<SubItemInterno[]>([])
    const [form, setForm] = useState(vacio)
    const [busqueda, setBusqueda] = useState('')

    useEffect(() => {
        if (open) {
            setLista((item?.subItems || []).map(s => ({ ...s })))
            setForm(vacio)
            setBusqueda('')
        }
    }, [open, item])

    const activos = useMemo(
        () => productos.filter(p => p.activo !== false),
        [productos]
    )

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase()
        if (!q) return activos
        return activos.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.variantes || []).some(v => v.nombre.toLowerCase().includes(q))
        )
    }, [activos, busqueda])

    const producto = activos.find(p => p.id === form.productoId)
    const variantes: CatalogoVariante[] = producto?.tieneVariantes ? (producto.variantes || []) : []
    const esPorM2 = producto?.tipoVenta === 'metro_cuadrado'

    // Los m² salen de la medida, salvo que se escriban a mano. Muchas veces el
    // que factura tiene el dato de metros del plóter y no la medida de cada
    // pieza; obligarle a inventarse un ancho y un alto solo mete ruido.
    const m2Calculado = m2DeMedida(Number(form.anchoCm), Number(form.altoCm), Number(form.cantidad))
    const m2Final = form.m2Manual.trim() !== '' ? Number(form.m2Manual) || 0 : m2Calculado

    const agregar = () => {
        if (!producto) return toast.error('Elige el material')
        if (producto.tieneVariantes && !form.varianteId) return toast.error('Elige el servicio derivado')

        const cantidad = Number(form.cantidad) || 0
        if (cantidad <= 0) return toast.error('La cantidad tiene que ser mayor que cero')
        if (esPorM2 && m2Final <= 0) {
            return toast.error('Pon la medida en centímetros o los metros cuadrados a mano')
        }

        const variante = variantes.find(v => v.id === form.varianteId)

        setLista(p => [...p, {
            id: nuevoSubItemId(),
            productoId: producto.id!,
            productoNombre: producto.nombre,
            varianteId: variante?.id,
            varianteNombre: variante?.nombre,
            tipoVenta: producto.tipoVenta,
            cantidad,
            anchoCm: Number(form.anchoCm) || undefined,
            altoCm: Number(form.altoCm) || undefined,
            m2Total: esPorM2 ? m2Final : 0,
            nota: form.nota.trim() || undefined,
        }])

        // Se conserva el material elegido: lo normal es cargar varias piezas
        // del mismo vinil seguidas.
        setForm(p => ({ ...vacio, productoId: p.productoId, varianteId: p.varianteId }))
    }

    const guardar = () => {
        if (!item) return
        onGuardar(item.id, lista)
        onOpenChange(false)
    }

    const totalM2 = m2DeSubItems(lista)
    const totalUnidades = lista.filter(s => s.tipoVenta === 'unidad').reduce((t, s) => t + s.cantidad, 0)

    if (!item) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                <DialogHeader className="p-5 sm:p-7 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <DialogTitle className="text-lg sm:text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2.5">
                        <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                        <span className="min-w-0 truncate">Desglose interno</span>
                    </DialogTitle>
                    <p className="text-[11px] font-bold text-slate-500 mt-1 line-clamp-2 normal-case">
                        {item.descripcion}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <EyeOff className="w-3 h-3 shrink-0" />
                        No sale en el PDF · solo alimenta el balance y el stock
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-5">

                    {/* --- LO YA CARGADO --- */}
                    <div className="space-y-2">
                        <AnimatePresence initial={false}>
                            {lista.map(s => (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3"
                                >
                                    <div className="w-9 h-9 shrink-0 rounded-xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-indigo-600">
                                        {s.tipoVenta === 'metro_cuadrado' ? <Ruler className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                                            {s.productoNombre}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 truncate">
                                            {s.varianteNombre || 'Material base'}
                                            {s.anchoCm && s.altoCm ? ` · ${s.anchoCm}x${s.altoCm}cm` : ''}
                                            {` · x${s.cantidad}`}
                                            {s.nota ? ` · ${s.nota}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {s.tipoVenta === 'metro_cuadrado' ? (
                                            <p className="text-sm font-black tabular-nums text-indigo-600">
                                                {s.m2Total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                <span className="text-[9px] ml-0.5">m²</span>
                                            </p>
                                        ) : (
                                            <p className="text-sm font-black tabular-nums text-slate-600 dark:text-slate-300">
                                                {s.cantidad}<span className="text-[9px] ml-0.5">und</span>
                                            </p>
                                        )}
                                    </div>
                                    {!soloLectura && (
                                        <Button
                                            variant="ghost" size="icon" title="Quitar"
                                            onClick={() => setLista(p => p.filter(x => x.id !== s.id))}
                                            className="h-8 w-8 shrink-0 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {lista.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 p-4 flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                                    Este renglón todavía no dice qué material consumió. Mientras siga
                                    así, sus metros no entran en el balance ni descuentan del rollo.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* --- AÑADIR --- */}
                    {!soloLectura && (
                        <div className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Boxes className="w-4 h-4 text-slate-400 shrink-0" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Añadir material del catálogo
                                </p>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    placeholder="Buscar material o servicio…"
                                    className="pl-9 h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Material</Label>
                                    <select
                                        value={form.productoId}
                                        onChange={e => setForm(p => ({ ...p, productoId: e.target.value, varianteId: '' }))}
                                        className="w-full h-10 px-3 rounded-xl text-sm font-bold shadow-sm outline-none cursor-pointer bg-white text-slate-900 dark:bg-slate-800 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                    >
                                        <option value="">Elige el material…</option>
                                        {filtrados.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.nombre}{p.tipoVenta === 'metro_cuadrado' ? ' (m²)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        Servicio derivado
                                    </Label>
                                    <select
                                        value={form.varianteId}
                                        onChange={e => setForm(p => ({ ...p, varianteId: e.target.value }))}
                                        disabled={variantes.length === 0}
                                        className="w-full h-10 px-3 rounded-xl text-sm font-bold shadow-sm outline-none cursor-pointer bg-white text-slate-900 dark:bg-slate-800 dark:text-white [color-scheme:light] dark:[color-scheme:dark] disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <option value="">
                                            {variantes.length === 0 ? 'Este material no tiene' : 'Elige el servicio…'}
                                        </option>
                                        {variantes.map(v => (
                                            <option key={v.id} value={v.id}>{v.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={cn("grid gap-3", esPorM2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cantidad</Label>
                                    <Input
                                        type="number" min="0" step="1"
                                        value={form.cantidad}
                                        onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))}
                                        className="h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
                                    />
                                </div>

                                {esPorM2 && (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ancho (cm)</Label>
                                            <Input
                                                type="number" min="0" step="0.1"
                                                value={form.anchoCm}
                                                onChange={e => setForm(p => ({ ...p, anchoCm: e.target.value }))}
                                                className="h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alto (cm)</Label>
                                            <Input
                                                type="number" min="0" step="0.1"
                                                value={form.altoCm}
                                                onChange={e => setForm(p => ({ ...p, altoCm: e.target.value }))}
                                                className="h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                m² a mano
                                            </Label>
                                            <Input
                                                type="number" min="0" step="0.01"
                                                value={form.m2Manual}
                                                onChange={e => setForm(p => ({ ...p, m2Manual: e.target.value }))}
                                                placeholder={m2Calculado > 0 ? m2Calculado.toFixed(2) : '0.00'}
                                                className="h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <Input
                                value={form.nota}
                                onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
                                placeholder="Nota interna (opcional): «laminado», «doble cara»…"
                                className="h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
                            />

                            <div className="flex items-center justify-between gap-3">
                                {esPorM2 ? (
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Consume{' '}
                                        <span className="text-indigo-600 tabular-nums">
                                            {m2Final.toLocaleString(undefined, { maximumFractionDigits: 4 })} m²
                                        </span>
                                        {form.m2Manual.trim() !== '' && m2Calculado > 0 && (
                                            <span className="text-slate-300 normal-case font-bold">
                                                {' '}(la medida daba {m2Calculado.toFixed(2)})
                                            </span>
                                        )}
                                    </p>
                                ) : <span />}

                                <Button
                                    onClick={agregar}
                                    className="h-10 shrink-0 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase text-[10px] tracking-widest gap-1.5 px-4"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Añadir
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 sm:p-7 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total del renglón</span>
                        <div className="flex items-center gap-2">
                            {totalM2 > 0 && (
                                <Badge className="rounded-full border-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 text-[10px] font-black tabular-nums px-2.5 h-6">
                                    {totalM2.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²
                                </Badge>
                            )}
                            {totalUnidades > 0 && (
                                <Badge className="rounded-full border-0 bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 text-[10px] font-black tabular-nums px-2.5 h-6">
                                    {totalUnidades} und
                                </Badge>
                            )}
                            {totalM2 === 0 && totalUnidades === 0 && (
                                <Badge className="rounded-full border-0 bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 h-6">
                                    Sin clasificar
                                </Badge>
                            )}
                        </div>
                    </div>

                    {!soloLectura && (
                        <Button
                            onClick={guardar}
                            className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg"
                        >
                            <Save className="w-4 h-4" /> Guardar desglose
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
