"use client"

// @/components/dashboard/TiposTrabajoPanel.tsx
//
// LOS TIPOS DE TRABAJO, EDITABLES.
//
// Lo que sale en el desplegable "Servicio" al añadir un ítem. Antes eran seis
// opciones escritas en el código; aquí se crean, se renombran, se ocultan y se
// ordenan. Cada tipo elige cómo se cobra —eso sí es fijo, es la lógica del
// programa— y en qué área cuenta para las estadísticas.

import React, { useEffect, useState } from 'react'
import {
    ListChecks, Loader2, Save, Plus, ShieldAlert, ChevronUp, ChevronDown, Eye, EyeOff, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    subscribeToTiposTrabajo, guardarTiposTrabajo, tiposDe, esTipoDeFabrica, nuevoIdTipo,
    MODOS_COBRO, AREAS_TRABAJO,
    unidadesDe, guardarUnidades, guardarExtras, motivoUnidadInvalida, esUnidadDeFabrica, type UnidadItem,
    type ConfigTiposTrabajo, type TipoTrabajo, type ModoCobro, type AreaTrabajo, type CatalogoDeTipo,
} from '@/lib/services/tipos-trabajo-service'
import {
    extrasDe, esExtraDeFabrica, nuevoIdExtra, motivoExtrasInvalidos, COBROS_EXTRA, MEDIDAS_LINEALES,
    type ExtraImpresion, type CobroExtra, type MedidaLineal,
} from '@/lib/utils/extras-impresion'

const selector = 'h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-[11px] font-black px-2 outline-none cursor-pointer'

export function TiposTrabajoPanel({ onAnadirOpcion }: {
    /** Abre la ficha nueva del catalogo ya asignada a ese tipo. */
    onAnadirOpcion?: (tipo: TipoTrabajo) => void
} = {}) {
    const { userData } = useAuth()
    const puedeEditar = esAdmin(userData?.rol)

    const [cfg, setCfg] = useState<ConfigTiposTrabajo>({})
    const [tipos, setTipos] = useState<TipoTrabajo[]>([])
    const [guardando, setGuardando] = useState(false)
    const [tocado, setTocado] = useState(false)
    const [unidades, setUnidades] = useState<UnidadItem[]>([])
    const [nuevaUnidad, setNuevaUnidad] = useState('')
    const [extras, setExtras] = useState<ExtraImpresion[]>([])

    const editarExtra = (id: string, cambio: Partial<ExtraImpresion>) => {
        setTocado(true)
        setExtras(prev => prev.map(x => x.id === id ? { ...x, ...cambio } : x))
    }

    const anadirUnidad = () => {
        const motivo = motivoUnidadInvalida(nuevaUnidad, unidades)
        if (motivo) return toast.error(motivo)
        const nombre = nuevaUnidad.trim()
        setTocado(true)
        setUnidades(prev => [...prev, { id: nombre, nombre, activo: true }])
        setNuevaUnidad('')
    }

    useEffect(() => subscribeToTiposTrabajo(setCfg), [])

    // Lo guardado solo pisa la pantalla mientras nadie esté editando.
    useEffect(() => {
        if (tocado) return
        setTipos(tiposDe(cfg).map(t => ({ ...t })))
        setUnidades(unidadesDe(cfg).map(u => ({ ...u })))
        setExtras(extrasDe(cfg.extras).map(x => ({ ...x })))
    }, [cfg, tocado])

    const editar = (id: string, cambio: Partial<TipoTrabajo>) => {
        setTocado(true)
        setTipos(prev => prev.map(t => t.id === id ? { ...t, ...cambio } : t))
    }

    const mover = (i: number, paso: -1 | 1) => {
        const j = i + paso
        if (j < 0 || j >= tipos.length) return
        setTocado(true)
        setTipos(prev => {
            const copia = [...prev]
            ;[copia[i], copia[j]] = [copia[j], copia[i]]
            return copia
        })
    }

    const guardar = async () => {
        if (tipos.some(t => !t.nombre.trim())) return toast.error('Todos los tipos necesitan nombre')
        if (!tipos.some(t => t.activo !== false)) return toast.error('Deja al menos un tipo visible')
        const motivoExtras = motivoExtrasInvalidos(extras)
        if (motivoExtras) return toast.error(motivoExtras)
        setGuardando(true)
        try {
            await guardarTiposTrabajo(tipos)
            await guardarUnidades(unidades)
            await guardarExtras(extras)
            toast.success('Tipos de trabajo guardados')
            setTocado(false)
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`)
        } finally {
            setGuardando(false)
        }
    }

    if (!puedeEditar) {
        return (
            <Card className="rounded-[2rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-slate-400 leading-snug">
                    Solo el administrador puede cambiar los tipos de trabajo: cambian lo que se
                    ofrece al facturar.
                </p>
            </Card>
        )
    }

    return (
        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <ListChecks className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Tipos de trabajo</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Lo que sale en "Servicio" al añadir un ítem
                        </p>
                    </div>
                </div>
                <Button
                    onClick={guardar}
                    disabled={guardando || !tocado}
                    className="h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[10px] gap-2"
                >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {tocado ? 'Guardar cambios' : 'Sin cambios'}
                </Button>
            </div>

            {/* El modo es lo único que no se inventa: es cómo el programa hace la
                cuenta. Todo lo demás lo decide el negocio. */}
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4 grid gap-1.5 sm:grid-cols-2">
                {MODOS_COBRO.map(m => (
                    <p key={m.id} className="text-[10px] font-bold text-slate-500 leading-snug">
                        <span className="font-black uppercase text-slate-700 dark:text-slate-200">{m.label}:</span> {m.ayuda}
                    </p>
                ))}
            </div>

            <div className="space-y-3">
                {tipos.map((t, i) => {
                    const fabrica = esTipoDeFabrica(t.id)
                    const oculto = t.activo === false
                    return (
                        <div
                            key={t.id}
                            className={cn(
                                'rounded-2xl border border-black/5 dark:border-white/5 p-3 space-y-2 transition-opacity',
                                oculto && 'opacity-50'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Input
                                    value={t.emoji}
                                    onChange={e => editar(t.id, { emoji: e.target.value })}
                                    maxLength={4}
                                    aria-label="Icono"
                                    className="h-10 w-12 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-center text-lg px-0"
                                />
                                <Input
                                    value={t.nombre}
                                    onChange={e => editar(t.id, { nombre: e.target.value })}
                                    placeholder="Nombre del tipo"
                                    className="h-10 flex-1 min-w-0 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-sm font-black"
                                />
                                <div className="flex items-center shrink-0">
                                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0}
                                        aria-label="Subir" className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => mover(i, 1)} disabled={i === tipos.length - 1}
                                        aria-label="Bajar" className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => editar(t.id, { activo: oculto })}
                                        aria-label={oculto ? 'Mostrar' : 'Ocultar'}
                                        title={oculto ? 'Oculto: no se ofrece al facturar' : 'Visible'}
                                        className="p-1.5 text-slate-400 hover:text-blue-600">
                                        {oculto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    {/* Los de fábrica los usan las órdenes viejas: se
                                        ocultan, no se borran. */}
                                    {!fabrica && (
                                        <button type="button"
                                            onClick={() => { setTocado(true); setTipos(prev => prev.filter(x => x.id !== t.id)) }}
                                            aria-label="Borrar" className="p-1.5 text-slate-300 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select value={t.modo} onChange={e => editar(t.id, { modo: e.target.value as ModoCobro })}
                                    aria-label="Cómo se cobra" className={selector}>
                                    {MODOS_COBRO.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                                <select value={t.area} onChange={e => editar(t.id, { area: e.target.value as AreaTrabajo })}
                                    aria-label="Área para estadísticas" className={selector}>
                                    {AREAS_TRABAJO.map(a => <option key={a.id} value={a.id}>Área: {a.label}</option>)}
                                </select>
                                {t.modo === 'catalogo' && (
                                    <select value={t.catalogo || 'ambos'}
                                        onChange={e => editar(t.id, { catalogo: e.target.value as CatalogoDeTipo })}
                                        aria-label="Qué ofrece del catálogo" className={selector}>
                                        <option value="producto">Ofrece productos</option>
                                        <option value="servicio">Ofrece servicios</option>
                                        <option value="ambos">Productos y servicios</option>
                                    </select>
                                )}
                                {/* Las opciones de un tipo son fichas del Catalogo: asi
                                    el precio vive en un solo sitio y lo vendido sigue
                                    contando en stock y estadisticas. Los de laser sacan
                                    sus materiales de Materiales de taller, y los de
                                    precio libre no tienen opciones. */}
                                {onAnadirOpcion && (t.modo === 'catalogo' || t.modo === 'medida') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Un tipo sin guardar puede descartarse, y la
                                            // ficha quedaria asignada a algo que no existe.
                                            if (tocado) return toast.error('Guarda los cambios antes de añadir opciones')
                                            onAnadirOpcion(t)
                                        }}
                                        className="h-10 px-3 rounded-xl border border-dashed border-blue-300 text-blue-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Añadir opción
                                    </button>
                                )}
                                {fabrica && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">De fábrica</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <Button
                variant="outline"
                onClick={() => {
                    setTocado(true)
                    setTipos(prev => [...prev, {
                        id: nuevoIdTipo(), nombre: '', emoji: '🏷️', modo: 'libre', area: 'OTROS', activo: true,
                    }])
                }}
                className="w-full h-11 rounded-2xl border-dashed font-black uppercase tracking-widest text-[10px] gap-2"
            >
                <Plus className="w-4 h-4" /> Añadir tipo
            </Button>

            {/* UNIDADES DE VENTA.

                Eran siete escritas en el codigo. Son solo el nombre que acompana
                a la cantidad: el calculo por m2 y por tiempo no depende de
                ellas. Las de fabrica se ocultan pero no se borran, porque hay
                ordenes que las usan. */}
            <div className="space-y-2 pt-4 border-t border-black/5 dark:border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unidades de venta</p>
                <p className="text-[10px] font-bold text-slate-400 leading-snug">
                    Cómo se cuenta lo que se vende por unidad. Es solo el nombre: el cálculo por m² y por tiempo no cambia.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    {unidades.map(u => {
                        const fabrica = esUnidadDeFabrica(u.id)
                        const oculta = u.activo === false
                        return (
                            <div key={u.id} className={cn('flex items-center gap-1 rounded-full bg-slate-50 dark:bg-white/5 pl-3 pr-1 h-8', oculta && 'opacity-50')}>
                                <span className="text-[10px] font-black uppercase">{u.nombre}</span>
                                <button type="button"
                                    onClick={() => { setTocado(true); setUnidades(prev => prev.map(x => x.id === u.id ? { ...x, activo: oculta } : x)) }}
                                    aria-label={oculta ? 'Mostrar' : 'Ocultar'}
                                    className="p-1 text-slate-400 hover:text-blue-600">
                                    {oculta ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                {!fabrica && (
                                    <button type="button"
                                        onClick={() => { setTocado(true); setUnidades(prev => prev.filter(x => x.id !== u.id)) }}
                                        aria-label="Borrar" className="p-1 text-slate-300 hover:text-red-500">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                    <div className="flex items-center gap-1">
                        <Input
                            value={nuevaUnidad}
                            onChange={e => setNuevaUnidad(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadirUnidad() } }}
                            placeholder="Caja, Galón…"
                            className="h-8 w-32 rounded-full bg-white dark:bg-black/20 border border-dashed text-[10px] font-bold"
                        />
                        <Button type="button" size="icon" variant="ghost" onClick={anadirUnidad} className="h-8 w-8 rounded-full" aria-label="Añadir unidad">
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* EXTRAS DE IMPRESION.

                Las casillas de los trabajos que se cobran por medida. Los siete de
                fabrica se renombran u ocultan y calculan como siempre: pegado y
                laminado con su panel de precio, los demas solo quedan anotados.
                Los propios llevan su precio, y cada ficha del Catalogo puede
                quitar los que no van con ese material. */}
            <div className="space-y-2 pt-4 border-t border-black/5 dark:border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Extras de impresión</p>
                <p className="text-[10px] font-bold text-slate-400 leading-snug">
                    Las casillas de los trabajos por medida. Los de fábrica se renombran u ocultan; los tuyos llevan su precio.
                    En la ficha de cada material del Catálogo puedes quitar los que no le van.
                </p>
                <div className="space-y-2">
                    {extras.map(x => {
                        const fabrica = esExtraDeFabrica(x.id)
                        const oculto = x.activo === false
                        return (
                            <div key={x.id} className={cn('rounded-2xl border border-black/5 dark:border-white/5 p-3 space-y-2 transition-opacity', oculto && 'opacity-50')}>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={x.nombre}
                                        onChange={e => editarExtra(x.id, { nombre: e.target.value })}
                                        placeholder="Nombre del extra"
                                        className="h-10 flex-1 min-w-0 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-sm font-black"
                                    />
                                    <button type="button" onClick={() => editarExtra(x.id, { activo: oculto })}
                                        aria-label={oculto ? 'Mostrar' : 'Ocultar'}
                                        title={oculto ? 'Oculto: no se ofrece al facturar' : 'Visible'}
                                        className="p-1.5 text-slate-400 hover:text-blue-600">
                                        {oculto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    {/* Los de fabrica estan marcados en ordenes viejas: se ocultan. */}
                                    {!fabrica && (
                                        <button type="button"
                                            onClick={() => { setTocado(true); setExtras(prev => prev.filter(e => e.id !== x.id)) }}
                                            aria-label="Borrar" className="p-1.5 text-slate-300 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {fabrica ? (
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                                        De fábrica · {x.id === 'pegado' || x.id === 'laminado' ? 'su precio se pone en el ítem' : 'sin precio, queda anotado'}
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select value={x.cobro || 'fijo'}
                                            onChange={e => editarExtra(x.id, { cobro: e.target.value as CobroExtra })}
                                            aria-label="Cómo se cobra" className={selector}>
                                            {COBROS_EXTRA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                        </select>
                                        {x.cobro === 'lineal' && (
                                            <select value={x.medida || 'perimetro'}
                                                onChange={e => editarExtra(x.id, { medida: e.target.value as MedidaLineal })}
                                                aria-label="Qué metros cuenta" className={selector}>
                                                {MEDIDAS_LINEALES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                            </select>
                                        )}
                                        <Input
                                            type="number" min={0} step="0.01"
                                            value={x.precio ?? ''}
                                            onChange={e => editarExtra(x.id, { precio: e.target.value === '' ? undefined : Number(e.target.value) })}
                                            placeholder="Precio"
                                            aria-label="Precio"
                                            className="h-10 w-28 rounded-xl bg-slate-50 dark:bg-white/5 border-none text-[11px] font-black"
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        setTocado(true)
                        setExtras(prev => [...prev, { id: nuevoIdExtra(), nombre: '', activo: true, cobro: 'fijo', precio: 0 }])
                    }}
                    className="w-full h-11 rounded-2xl border-dashed font-black uppercase tracking-widest text-[10px] gap-2"
                >
                    <Plus className="w-4 h-4" /> Añadir extra
                </Button>
            </div>
        </Card>
    )
}
