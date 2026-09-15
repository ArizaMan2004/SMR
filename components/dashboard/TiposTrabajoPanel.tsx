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
    type ConfigTiposTrabajo, type TipoTrabajo, type ModoCobro, type AreaTrabajo, type CatalogoDeTipo,
} from '@/lib/services/tipos-trabajo-service'

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

    useEffect(() => subscribeToTiposTrabajo(setCfg), [])

    // Lo guardado solo pisa la pantalla mientras nadie esté editando.
    useEffect(() => {
        if (tocado) return
        setTipos(tiposDe(cfg).map(t => ({ ...t })))
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
        setGuardando(true)
        try {
            await guardarTiposTrabajo(tipos)
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
        </Card>
    )
}
