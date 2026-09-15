"use client"

// @/components/dashboard/MateriaPrimaPanel.tsx
//
// EL DEPÓSITO.
//
// La pregunta de delante del estante: ¿cuánto queda de esto? Y la que viene
// detrás: ¿hay que pedir más antes del lunes?
//
// Por eso lo primero que se ve no es una tabla ordenada por nombre sino lo que
// se está acabando, arriba y en ámbar. Lo demás puede esperar; eso no.
//
// "Compra" sube lo que entró y apunta el gasto en Insumos, porque un lote de
// vinil o de tinta es la inversión con la que se produce y tiene que verse en
// los gastos del mes. Las dos cosas van juntas o no va ninguna.

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Boxes, Plus, Pencil, Trash2, AlertTriangle, PackageSearch, Search, Loader2, ArrowDownToLine, PackagePlus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
    guardarMateriaPrima, eliminarMateriaPrima, ajustarStock, seEstaAcabando,
    nombrarCantidad, problemaDeInsumo, registrarCompraInsumo, problemaDeCompraInsumo,
    PRESENTACIONES, INSUMO_NUEVO,
    type MateriaPrima, type PresentacionInsumo,
} from '@/lib/services/materia-prima-service'

interface Props {
    items: MateriaPrima[]
    isAdmin: boolean
    /** Tasa BCV del día, para que el gasto quede también en bolívares. */
    tasa?: number
    usuario?: string
    /**
     * Rollos que todavía están contados dentro de fichas del Catálogo.
     *
     * Vienen de cuando el conteo vivía ahí. Se ofrecen para traerlos una vez;
     * mientras no se traigan, ese número no lo mira nadie.
     */
    rollosSueltos: { nombre: string; rollos: number; anchoCm?: number }[]
    onTraerRollos: () => Promise<void>
}

export function MateriaPrimaPanel({ items, isAdmin, tasa = 0, usuario, rollosSueltos, onTraerRollos }: Props) {
    const [busqueda, setBusqueda] = useState('')
    const [abierto, setAbierto] = useState(false)
    const [editando, setEditando] = useState<MateriaPrima | null>(null)
    const [form, setForm] = useState<MateriaPrima>({ ...INSUMO_NUEVO })
    const [guardando, setGuardando] = useState(false)
    const [trayendo, setTrayendo] = useState(false)

    // La entrada: qué llegó y qué costó.
    const [comprando, setComprando] = useState<MateriaPrima | null>(null)
    const [cantidad, setCantidad] = useState('1')
    const [monto, setMonto] = useState('')
    const [provCompra, setProvCompra] = useState('')
    const [notaCompra, setNotaCompra] = useState('')
    const [registrando, setRegistrando] = useState(false)

    const num = (v: string) => {
        const x = parseFloat(String(v).replace(',', '.'))
        return Number.isFinite(x) ? x : 0
    }
    const unitario = num(cantidad) > 0 && num(monto) > 0 ? num(monto) / num(cantidad) : 0

    const { faltan, resto } = useMemo(() => {
        const q = busqueda.toLowerCase().trim()
        const visibles = items
            .filter(i => i.activo !== false)
            .filter(i => !q || i.nombre.toLowerCase().includes(q))
        return {
            faltan: visibles.filter(seEstaAcabando),
            resto: visibles.filter(i => !seEstaAcabando(i)),
        }
    }, [items, busqueda])

    const abrirNuevo = () => {
        setEditando(null)
        setForm({ ...INSUMO_NUEVO })
        setAbierto(true)
    }

    const abrirEditar = (i: MateriaPrima) => {
        setEditando(i)
        setForm({ ...i })
        setAbierto(true)
    }

    const guardar = async () => {
        const problema = problemaDeInsumo(form)
        if (problema) { toast.error(problema); return }
        setGuardando(true)
        try {
            await guardarMateriaPrima(form, editando?.id)
            toast.success(editando ? 'Actualizado' : `"${form.nombre.trim()}" añadido al depósito`)
            setAbierto(false)
        } catch (e: any) {
            toast.error(`No se guardó: ${e?.message || e}`)
        } finally {
            setGuardando(false)
        }
    }

    const borrar = async (i: MateriaPrima) => {
        if (!confirm(`¿Quitar "${i.nombre}" del depósito? No se puede deshacer.`)) return
        try {
            await eliminarMateriaPrima(i.id!)
            toast.success('Quitado del depósito')
        } catch (e: any) { toast.error(`No se pudo: ${e?.message || e}`) }
    }

    const mover = async (i: MateriaPrima, delta: number) => {
        try { await ajustarStock(i.id!, delta, i.stock) }
        catch (e: any) { toast.error(`No se pudo: ${e?.message || e}`) }
    }

    const abrirCompra = (i: MateriaPrima) => {
        setComprando(i)
        setCantidad('1')
        setMonto('')
        setProvCompra(i.proveedor || '')
        setNotaCompra('')
    }

    const registrarCompra = async () => {
        if (!comprando) return
        const datos = {
            insumo: comprando,
            cantidad: num(cantidad),
            montoUSD: num(monto),
            tasa,
            proveedor: provCompra,
            nota: notaCompra,
            creadoPor: usuario,
        }
        const problema = problemaDeCompraInsumo(datos)
        if (problema) { toast.error(problema); return }

        setRegistrando(true)
        try {
            const r = await registrarCompraInsumo(datos)
            toast.success(
                `Entraron ${nombrarCantidad(num(cantidad), comprando.presentacion)} a $${r.costoUnitarioUSD.toFixed(2)} c/u · el gasto quedó en Insumos`
            )
            setComprando(null)
        } catch (e: any) {
            toast.error(`No se registró nada: ${e?.message || e}`)
        } finally { setRegistrando(false) }
    }

    const traer = async () => {
        setTrayendo(true)
        try {
            await onTraerRollos()
            toast.success('Los rollos ya están en el depósito')
        } catch (e: any) {
            toast.error(`No se pudieron traer: ${e?.message || e}`)
        } finally { setTrayendo(false) }
    }

    const campo = 'h-11 rounded-xl border-none bg-slate-50 dark:bg-white/5 font-black'
    const etiqueta = 'text-[9px] font-black uppercase text-slate-400 tracking-widest'

    /**
     * Una ficha del depósito.
     *
     * Es una función que devuelve JSX, no un componente declarado aquí dentro:
     * uno declarado dentro nace distinto en cada render y React lo trata como
     * otro tipo, así que desmontaría y volvería a montar todas las tarjetas con
     * cada letra que se escribe en el buscador —y la animación de entrada se
     * repetiría entera cada vez.
     */
    const ficha = (i: MateriaPrima) => {
        const bajo = seEstaAcabando(i)
        return (
            <motion.div layout key={i.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                className={cn(
                    'bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-5 shadow-sm border flex flex-col gap-3',
                    bajo ? 'border-amber-300 dark:border-amber-500/40' : 'border-black/5 dark:border-white/5'
                )}>
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h4 className="font-black text-sm uppercase italic dark:text-white leading-tight">{i.nombre}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {PRESENTACIONES.find(p => p.valor === i.presentacion)?.etiqueta || i.presentacion}
                            {/* "El de 137" es como se pide por teléfono. */}
                            {i.anchoCm ? ` · ${i.anchoCm} cm` : ''}
                            {i.metrosRollo ? ` × ${i.metrosRollo} m` : ''}
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                            <button onClick={() => abrirEditar(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => borrar(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-end justify-between gap-3">
                    <div>
                        <p className="text-[8px] font-black uppercase text-slate-400">Quedan</p>
                        <p className={cn('text-3xl font-black italic leading-none', bajo ? 'text-amber-500' : 'text-emerald-600')}>
                            {i.stock}
                        </p>
                        {i.stockMinimo > 0 && (
                            <p className="text-[8px] font-bold text-slate-400 mt-1">Avisa en {i.stockMinimo}</p>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
                            <button onClick={() => mover(i, -1)} disabled={i.stock <= 0}
                                className="w-8 h-8 rounded-lg bg-white dark:bg-black/20 font-black text-lg shadow-sm flex items-center justify-center disabled:opacity-30">−</button>
                            <button onClick={() => mover(i, 1)}
                                className="w-8 h-8 rounded-lg bg-white dark:bg-black/20 font-black text-lg shadow-sm flex items-center justify-center">+</button>
                        </div>
                    )}
                </div>

                {bajo && (
                    <p className="text-[9px] font-black uppercase text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Hay que pedir más
                    </p>
                )}

                {/* Los +/− corrigen el conteo; Compra dice DE DÓNDE salió lo que
                    entró y manda el gasto a Insumos. */}
                {isAdmin && (
                    <Button variant="outline" onClick={() => abrirCompra(i)}
                        className="h-9 rounded-xl text-[9px] font-black uppercase border-black/10 dark:border-white/10 w-full">
                        <PackagePlus className="w-3 h-3 mr-1" /> Registrar compra
                    </Button>
                )}
                {i.ultimoCostoUSD ? (
                    <p className="text-[9px] font-bold text-slate-400">
                        La última te salió a ${i.ultimoCostoUSD.toFixed(2)} c/u
                    </p>
                ) : null}
                {i.proveedor && (
                    <p className="text-[9px] font-bold text-slate-400 truncate">Se le compra a {i.proveedor}</p>
                )}
                {i.nota && <p className="text-[9px] text-slate-400 leading-snug">{i.nota}</p>}
            </motion.div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar en el depósito…"
                        className="h-12 pl-11 rounded-2xl bg-white dark:bg-[#1c1c1e] border-none font-bold text-sm shadow-sm" />
                </div>
                {isAdmin && (
                    <Button onClick={abrirNuevo} className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-5 shrink-0">
                        <Plus className="w-4 h-4 mr-1" /> Añadir al depósito
                    </Button>
                )}
            </div>

            {/* Los rollos que se quedaron contados en las fichas del Catálogo.
                Se ofrece traerlos una vez, con el número delante: nadie acepta
                una mudanza a ciegas. */}
            {isAdmin && rollosSueltos.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-[2rem] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                            Hay rollos contados en el Catálogo
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug mt-1">
                            El conteo de rollos vivía dentro de las fichas de venta. Ahora vive aquí.
                            Se traen {rollosSueltos.map(r => `${r.nombre} (${r.rollos})`).join(', ')} y
                            la ficha deja de contarlos.
                        </p>
                    </div>
                    <Button onClick={traer} disabled={trayendo}
                        className="h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-5 shrink-0">
                        {trayendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowDownToLine className="w-4 h-4 mr-1" /> Traerlos</>}
                    </Button>
                </div>
            )}

            {faltan.length === 0 && resto.length === 0 ? (
                <div className="text-center py-20 opacity-40">
                    <PackageSearch className="w-12 h-12 mx-auto mb-3" />
                    <p className="font-bold uppercase text-xs">
                        {busqueda ? 'No hay nada con ese nombre' : 'El depósito está vacío'}
                    </p>
                    {!busqueda && (
                        <p className="text-[10px] font-bold mt-1 max-w-sm mx-auto leading-snug">
                            Aquí va lo que se compra para poder trabajar y no se vende: rollos de vinil
                            y banner, tinta, cinta. El Catálogo es lo que se cobra; esto es lo que hace
                            falta tener.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {faltan.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" /> Se está acabando · {faltan.length}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {faltan.map(i => ficha(i))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {resto.length > 0 && (
                        <div className="space-y-3">
                            {faltan.length > 0 && (
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                    <Boxes className="w-3.5 h-3.5" /> Hay de sobra · {resto.length}
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {resto.map(i => ficha(i))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* REGISTRAR UNA ENTRADA.
                Sube el depósito y apunta el gasto, las dos en una transacción.
                Se avisa de la otra puerta: el mismo rollo apuntado aquí y en el
                Catálogo saldría dos veces en los gastos del mes. */}
            <Dialog open={!!comprando} onOpenChange={v => !registrando && !v && setComprando(null)}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 p-7 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                            <PackagePlus className="w-5 h-5 text-blue-600" /> Registrar compra
                        </DialogTitle>
                        {comprando && (
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{comprando.nombre}</p>
                        )}
                    </DialogHeader>

                    {comprando && (
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className={etiqueta}>
                                        ¿Cuántos {PRESENTACIONES.find(p => p.valor === comprando.presentacion)?.plural || 'entraron'}?
                                    </Label>
                                    <Input type="number" min="0" step="0.01" value={cantidad} onChange={e => setCantidad(e.target.value)}
                                        className={cn(campo, 'text-center')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={etiqueta}>Costó en total (USD)</Label>
                                    <Input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
                                        placeholder="200" className={cn(campo, 'text-emerald-600')} />
                                </div>
                            </div>

                            {unitario > 0 && (
                                <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-4 space-y-1.5">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                            Cada uno te sale a
                                        </span>
                                        <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                                            ${unitario.toFixed(unitario < 1 ? 4 : 2)}
                                        </span>
                                    </div>
                                    {comprando.ultimoCostoUSD ? (
                                        <p className={cn('text-[10px] font-black',
                                            unitario > comprando.ultimoCostoUSD ? 'text-rose-600' : 'text-emerald-600')}>
                                            {unitario > comprando.ultimoCostoUSD ? 'Subió' : unitario < comprando.ultimoCostoUSD ? 'Bajó' : 'Igual que'} desde
                                            los ${comprando.ultimoCostoUSD.toFixed(2)} de la vez pasada
                                            {unitario !== comprando.ultimoCostoUSD &&
                                                ` · ${Math.abs(((unitario / comprando.ultimoCostoUSD) - 1) * 100).toFixed(0)} %`}
                                        </p>
                                    ) : null}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className={etiqueta}>¿A quién se le compró?</Label>
                                <Input value={provCompra} onChange={e => setProvCompra(e.target.value)}
                                    placeholder="Opcional" className={campo} />
                            </div>

                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Nota</Label>
                                <Input value={notaCompra} onChange={e => setNotaCompra(e.target.value)}
                                    placeholder="Factura, lote, lo que sirva para encontrarla" className={campo} />
                            </div>

                            <p className="text-[9px] font-bold text-slate-400 leading-snug">
                                Al registrar: suben las existencias y el gasto aparece en Insumos como
                                materiales. Todo junto o nada. Si esta misma compra ya la apuntaste desde
                                el Catálogo, no la apuntes aquí: el gasto quedaría dos veces.
                            </p>

                            <Button onClick={registrarCompra} disabled={registrando}
                                className="w-full h-14 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-[10px]">
                                {registrando
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <><CheckCircle2 className="w-4 h-4 mr-2" /> Registrar compra</>}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={abierto} onOpenChange={v => !guardando && setAbierto(v)}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 p-7 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                            <Boxes className="w-5 h-5 text-blue-600" />
                            {editando ? 'Editar' : 'Añadir al depósito'}
                        </DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 leading-snug">
                            Lo que se compra para poder trabajar y no se vende. Aquí se apunta qué es y
                            cuánto hay; lo que costó va después, en «Registrar compra».
                        </p>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label className={etiqueta}>¿Qué es?</Label>
                            <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                placeholder="Vinil blanco 137" className={campo} />
                        </div>

                        <div className="space-y-1.5">
                            <Label className={etiqueta}>¿En qué se cuenta?</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {PRESENTACIONES.map(p => (
                                    <button key={p.valor} type="button"
                                        onClick={() => setForm(f => ({ ...f, presentacion: p.valor as PresentacionInsumo }))}
                                        className={cn('p-2.5 rounded-xl border text-center transition-all',
                                            form.presentacion === p.valor
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                                : 'border-black/10 dark:border-white/10')}>
                                        <p className="text-[10px] font-black uppercase">{p.etiqueta}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Solo para reconocerlo: dos viniles del mismo nombre con
                            anchos distintos no son lo mismo. */}
                        {form.presentacion === 'rollo' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className={etiqueta}>Ancho (cm)</Label>
                                    <Input type="number" min="0" value={form.anchoCm || ''}
                                        onChange={e => setForm(f => ({ ...f, anchoCm: parseFloat(e.target.value) || 0 }))}
                                        placeholder="137" className={cn(campo, 'text-center')} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={etiqueta}>Metros</Label>
                                    <Input type="number" min="0" value={form.metrosRollo || ''}
                                        onChange={e => setForm(f => ({ ...f, metrosRollo: parseFloat(e.target.value) || 0 }))}
                                        placeholder="50" className={cn(campo, 'text-center')} />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>¿Cuántos hay?</Label>
                                <Input type="number" min="0" value={form.stock || ''}
                                    onChange={e => setForm(f => ({ ...f, stock: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0" className={cn(campo, 'text-center')} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Avisar cuando queden</Label>
                                <Input type="number" min="0" value={form.stockMinimo || ''}
                                    onChange={e => setForm(f => ({ ...f, stockMinimo: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0" className={cn(campo, 'text-center')} />
                            </div>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 leading-snug -mt-1">
                            En cero no avisa nunca. {form.stockMinimo > 0
                                ? `Con ${nombrarCantidad(form.stockMinimo, form.presentacion)} o menos sale en ámbar arriba del todo.`
                                : 'Pon el número con el que todavía te da tiempo a pedir más.'}
                        </p>

                        <div className="space-y-1.5">
                            <Label className={etiqueta}>¿A quién se le compra?</Label>
                            <Input value={form.proveedor || ''} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                                placeholder="Opcional" className={campo} />
                        </div>

                        <div className="space-y-1.5">
                            <Label className={etiqueta}>Nota</Label>
                            <Input value={form.nota || ''} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                                placeholder="Dónde está guardado, con qué máquina va…" className={campo} />
                        </div>

                        <Button onClick={guardar} disabled={guardando}
                            className="w-full h-13 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-[10px]">
                            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : editando ? 'Guardar cambios' : 'Añadir al depósito'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
