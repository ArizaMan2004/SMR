// @/components/dashboard/MaterialesTallerPanel.tsx
//
// LOS MATERIALES DEL TALLER, CONFIGURABLES.
//
// Estaban escritos a mano en el formulario de ítems: cinco materiales de
// corte, doce grosores del 1mm al 12mm iguales para todos, y una lista de
// colores que no distinguía de qué material eran. Quien toma la orden tenía
// que saberse de memoria qué existe de verdad, y cuando se equivocaba el
// error quedaba escrito en la orden.
//
// Aquí cada material trae SUS colores y SUS grosores, y cada grosor su precio
// por m² como base rígida. El formulario solo ofrece lo que existe.

"use client"

import { MuestraMaterial } from "@/components/taller/MuestraMaterial"
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"
import { FAMILIAS_COLOR, tonoDeColor, type ColorMaterial, type FamiliaColor } from "@/lib/services/materiales-taller"
import React, { useEffect, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Layers, Plus, X, Save, Loader2, Scissors, Box, ShieldAlert, Palette, Ruler,
    ImagePlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    subscribeToMaterialesTaller, guardarMaterialesTaller, materialesDe,
    nuevoIdMaterial,
    type ConfigMaterialesTaller, type MaterialTaller,
} from '@/lib/services/materiales-taller'

const num = (v: any) => {
    const n = parseFloat(String(v).replace(',', '.'))
    return isNaN(n) ? 0 : n
}

export function MaterialesTallerPanel() {
    const { userData } = useAuth()
    const puedeEditar = esAdmin(userData?.rol)

    const [cfg, setCfg] = useState<ConfigMaterialesTaller>({})
    const [materiales, setMateriales] = useState<MaterialTaller[]>([])
    const [fondoBlanco, setFondoBlanco] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [tocado, setTocado] = useState(false)

    useEffect(() => subscribeToMaterialesTaller(setCfg), [])

    // Lo guardado sobrescribe lo que hay en pantalla solo mientras nadie esté
    // editando: si no, un cambio de otra pestaña borra lo que se está tecleando.
    useEffect(() => {
        if (tocado) return
        setMateriales(materialesDe(cfg).map(m => ({ ...m })))
        setFondoBlanco(cfg.fondoBlancoM2 ? String(cfg.fondoBlancoM2) : '')
    }, [cfg, tocado])

    const editar = (id: string, cambio: Partial<MaterialTaller>) => {
        setTocado(true)
        setMateriales(prev => prev.map(m => m.id === id ? { ...m, ...cambio } : m))
    }

    const guardar = async () => {
        setGuardando(true)
        try {
            await guardarMaterialesTaller(materiales, { fondoBlancoM2: num(fondoBlanco) })
            toast.success('Materiales guardados')
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
                    Solo el administrador puede tocar los materiales del taller. Cambian los
                    precios de todas las órdenes nuevas.
                </p>
            </Card>
        )
    }

    return (
        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Materiales del taller</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Qué se corta, qué se pega y a cómo
                        </p>
                    </div>
                </div>

                <Button
                    onClick={guardar}
                    disabled={guardando || !tocado}
                    className="h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[10px] gap-2"
                >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {tocado ? 'Guardar cambios' : 'Sin cambios'}
                </Button>
            </div>

            {/* EL FONDO BLANCO.

                Un clear sobre acrílico no se ve si no lleva fondo: el blanco es
                lo que hace que el color se lea. Es material aparte del sustrato
                y se cobra aparte. */}
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4 flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fondo de vinil blanco</p>
                    <p className="text-[10px] font-bold text-slate-400 leading-snug mt-0.5">
                        El blanco que va detrás de un clear para que el color se lea. Se cobra por m²
                        de la pieza, aparte del sustrato.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-slate-400">$</span>
                    <Input
                        value={fondoBlanco}
                        onChange={e => { setFondoBlanco(e.target.value); setTocado(true) }}
                        placeholder="0.00"
                        inputMode="decimal"
                        className="h-10 w-24 rounded-xl bg-white dark:bg-black/20 border-none text-xs font-black text-right"
                    />
                    <span className="text-[10px] font-black uppercase text-slate-400">/ m²</span>
                </div>
            </div>

            <div className="space-y-4">
                {materiales.map(m => (
                    <MaterialFila key={m.id} m={m} onEditar={editar} onBorrar={() => {
                        setTocado(true)
                        setMateriales(prev => prev.filter(x => x.id !== m.id))
                    }} />
                ))}
            </div>

            <Button
                variant="outline"
                onClick={() => {
                    setTocado(true)
                    setMateriales(prev => [...prev, {
                        id: nuevoIdMaterial(),
                        nombre: '',
                        seCorta: true,
                        colores: [],
                        grosores: [],
                    }])
                }}
                className="w-full h-11 rounded-2xl border-dashed font-black uppercase tracking-widest text-[10px] gap-2"
            >
                <Plus className="w-4 h-4" /> Añadir material
            </Button>
        </Card>
    )
}

function MaterialFila({ m, onEditar, onBorrar }: {
    m: MaterialTaller
    onEditar: (id: string, cambio: Partial<MaterialTaller>) => void
    onBorrar: () => void
}) {
    const [color, setColor] = useState('')
    const [grosor, setGrosor] = useState('')
    const [subiendo, setSubiendo] = useState(false)

    const anadirColor = (nombre: string) => {
        const limpio = nombre.trim()
        if (!limpio) return
        // El tono y la familia se deducen del nombre al crearlo: escribir
        // "Dorado" ya deja un dorado, y se retoca solo si hace falta.
        const { hex, familia } = tonoDeColor({ id: '', nombre: limpio })
        onEditar(m.id, {
            colores: [...(m.colores || []), { id: nuevoIdMaterial('co'), nombre: limpio, hex, familia }],
        })
        setColor('')
    }

    const editarColor = (id: string, cambio: Partial<ColorMaterial>) =>
        onEditar(m.id, { colores: (m.colores || []).map(c => c.id === id ? { ...c, ...cambio } : c) })

    return (
        <div className="rounded-2xl border border-black/5 dark:border-white/5 p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    value={m.nombre}
                    onChange={e => onEditar(m.id, { nombre: e.target.value })}
                    placeholder="Ej. Acrílico, PVC Rígido"
                    className="h-11 flex-1 min-w-[10rem] rounded-xl bg-slate-50 dark:bg-white/5 border-none text-sm font-black"
                />

                {/* Dónde se ofrece. Un material puede hacer las dos cosas: el
                    acrílico se corta y también se pega detrás de una impresión. */}
                {([
                    { k: 'seCorta' as const, txt: 'Se corta', icon: <Scissors className="w-3 h-3" /> },
                    { k: 'sePega' as const, txt: 'Se pega', icon: <Box className="w-3 h-3" /> },
                ]).map(o => (
                    <button
                        key={o.k}
                        type="button"
                        onClick={() => onEditar(m.id, { [o.k]: !m[o.k] } as Partial<MaterialTaller>)}
                        className={cn(
                            'h-11 px-3 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-colors',
                            m[o.k]
                                ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600'
                                : 'border-black/10 dark:border-white/10 text-slate-400'
                        )}
                    >
                        {o.icon} {o.txt}
                    </button>
                ))}

                <button onClick={onBorrar} className="h-11 w-11 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* LA FOTO: UNA SOLA PARA TODOS LOS COLORES.

                No se sube una por color. Se sube la del material en BLANCO y
                cada color la tine. Veinte colores de acrilico se ensenan con
                una imagen en vez de veinte, y un color nuevo no hay que
                fotografiarlo para poder venderlo.

                Tiene que ser clara: el tenido multiplica, asi que lo oscuro se
                queda oscuro y sobre una foto negra no sale un amarillo. */}
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-white/5 p-3">
                <MuestraMaterial material={m} color={(m.colores || [])[0]} tam={52} />
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Muestra del material
                    </p>
                    <p className="text-[10px] text-slate-400 leading-snug">
                        Una foto en blanco o gris claro. El sistema la pinta de cada color.
                    </p>
                </div>
                <label className={cn(
                    'h-9 px-3 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shrink-0',
                    subiendo ? 'opacity-50 pointer-events-none' : 'hover:bg-white dark:hover:bg-white/10'
                )}>
                    <ImagePlus className="w-3.5 h-3.5" />
                    {subiendo ? 'Subiendo...' : m.fotoUrl ? 'Cambiar' : 'Subir foto'}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async e => {
                            const f = e.target.files?.[0]
                            e.target.value = ''
                            if (!f) return
                            setSubiendo(true)
                            try {
                                onEditar(m.id, { fotoUrl: await uploadFileToCloudinary(f) })
                                toast.success('Muestra actualizada')
                            } catch (err: any) {
                                toast.error(err?.message || 'No se pudo subir la imagen')
                            } finally {
                                setSubiendo(false)
                            }
                        }}
                    />
                </label>
                {m.fotoUrl && (
                    <button
                        onClick={() => onEditar(m.id, { fotoUrl: '' })}
                        title="Quitar la foto y volver al color plano"
                        className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-500 flex items-center justify-center shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* GROSORES.

                El precio vive aquí y no en el material porque un PVC de 5mm no
                vale lo mismo que uno de 3mm. Solo se pide cuando el material se
                pega: para cortar, el grosor no cambia lo que se cobra —eso lo
                decide el tiempo de máquina—. */}
            <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                    <Ruler className="w-3 h-3" /> Grosores {m.sePega && <span className="text-indigo-500">· con su precio por m² pegado</span>}
                </Label>

                <div className="flex flex-wrap gap-2">
                    {(m.grosores || []).map(g => (
                        <div key={g.id} className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-white/5 pl-3 pr-1 h-9">
                            <span className="text-[11px] font-black">{g.nombre}</span>
                            {m.sePega && (
                                <>
                                    <span className="text-[10px] font-black text-slate-300">$</span>
                                    <Input
                                        value={g.precioPegadoM2 ?? ''}
                                        onChange={e => onEditar(m.id, {
                                            grosores: m.grosores.map(x => x.id === g.id
                                                ? { ...x, precioPegadoM2: num(e.target.value) }
                                                : x),
                                        })}
                                        placeholder="0.00"
                                        inputMode="decimal"
                                        className="h-7 w-16 rounded-lg bg-white dark:bg-black/20 border-none text-[11px] font-black text-right px-2"
                                    />
                                </>
                            )}
                            <button
                                onClick={() => onEditar(m.id, { grosores: m.grosores.filter(x => x.id !== g.id) })}
                                className="text-slate-300 hover:text-red-500 p-1"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}

                    <div className="flex items-center gap-1">
                        <Input
                            value={grosor}
                            onChange={e => setGrosor(e.target.value)}
                            onKeyDown={e => {
                                if (e.key !== 'Enter' || !grosor.trim()) return
                                e.preventDefault()
                                onEditar(m.id, { grosores: [...(m.grosores || []), { id: nuevoIdMaterial('gr'), nombre: grosor.trim() }] })
                                setGrosor('')
                            }}
                            placeholder="3mm"
                            className="h-9 w-24 rounded-xl bg-white dark:bg-black/20 border border-dashed text-[11px] font-bold"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                                if (!grosor.trim()) return
                                onEditar(m.id, { grosores: [...(m.grosores || []), { id: nuevoIdMaterial('gr'), nombre: grosor.trim() }] })
                                setGrosor('')
                            }}
                            className="h-9 w-9 rounded-xl"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* COLORES.

                El MDF crudo no viene en colores y pedirlos sería inventarse un
                dato, así que la lista puede quedar vacía sin que falte nada. */}
            <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                    <Palette className="w-3 h-3" /> Colores
                </Label>

                <div className="flex flex-wrap gap-2">
                    {(m.colores || []).map(c => {
                        const { hex, familia } = tonoDeColor(c)
                        return (
                            <div key={c.id} className="flex items-center gap-1.5 rounded-full bg-slate-50 dark:bg-white/5 pl-1.5 pr-1 h-9">
                                <MuestraMaterial material={m} color={c} tam={24} className="rounded-full" />

                                {/* El selector nativo: sin dependencias y con el
                                    cuentagotas del sistema, que es como se saca
                                    el tono exacto de una plancha real. */}
                                <input
                                    type="color"
                                    value={hex}
                                    onChange={e => editarColor(c.id, { hex: e.target.value })}
                                    title={`Tono de ${c.nombre}`}
                                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-none p-0 shrink-0"
                                />

                                <span className="text-[10px] font-black uppercase">{c.nombre}</span>

                                {/* Solido, translucido o metalizado. No es
                                    decoracion: un translucido deja pasar la luz
                                    y eso cambia el trabajo, no el aspecto. */}
                                <select
                                    value={familia}
                                    onChange={e => editarColor(c.id, { familia: e.target.value as FamiliaColor })}
                                    className="h-6 rounded-full bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 text-[9px] font-black uppercase px-1 cursor-pointer"
                                >
                                    {FAMILIAS_COLOR.map(f => (
                                        <option key={f.id} value={f.id}>{f.label}</option>
                                    ))}
                                </select>

                                <button
                                    onClick={() => onEditar(m.id, { colores: m.colores.filter(x => x.id !== c.id) })}
                                    className="text-slate-300 hover:text-red-500 p-1"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )
                    })}

                    <div className="flex items-center gap-1">
                        <Input
                            value={color}
                            onChange={e => setColor(e.target.value)}
                            onKeyDown={e => {
                                if (e.key !== 'Enter') return
                                e.preventDefault()
                                anadirColor(color)
                            }}
                            placeholder="Turquesa"
                            className="h-8 w-28 rounded-full bg-white dark:bg-black/20 border border-dashed text-[10px] font-bold"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => anadirColor(color)}
                            className="h-8 w-8 rounded-full"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
