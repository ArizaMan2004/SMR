// @/components/dashboard/IdentidadEmpresaPanel.tsx
//
// Logo, firma y sello de la empresa.
//
// Se suben una vez a Cloudinary y quedan guardados para todos. Antes vivían en
// el localStorage de cada navegador: había que volver a cargarlos en cada PC y
// dos personas podían estar emitiendo PDF con sellos distintos.

"use client"

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, Trash2, ImageIcon, Check, Building2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    subscribeToIdentidad, guardarActivo, eliminarActivo,
    type IdentidadEmpresa, type TipoActivo,
} from '@/lib/services/identidad-service'

const ACTIVOS: { tipo: TipoActivo; titulo: string; ayuda: string; campo: keyof IdentidadEmpresa }[] = [
    { tipo: 'logo',  titulo: 'Logo',  ayuda: 'Cabecera de presupuestos y notas de entrega', campo: 'logoUrl' },
    { tipo: 'firma', titulo: 'Firma', ayuda: 'Va al pie, sobre la línea de firma',          campo: 'firmaUrl' },
    { tipo: 'sello', titulo: 'Sello', ayuda: 'Sello húmedo de la empresa',                   campo: 'selloUrl' },
]

/** Tope razonable: por encima de esto el PDF se vuelve pesado sin ganar nitidez. */
const MAX_MB = 3

export function IdentidadEmpresaPanel() {
    const { userData } = useAuth()
    const puedeEditar = esAdmin(userData?.rol)

    const [identidad, setIdentidad] = useState<IdentidadEmpresa>({})
    const [cargando, setCargando] = useState(true)
    const [subiendo, setSubiendo] = useState<TipoActivo | null>(null)
    const refs = useRef<Record<string, HTMLInputElement | null>>({})

    useEffect(() => {
        const unsub = subscribeToIdentidad(i => { setIdentidad(i); setCargando(false) })
        return () => unsub()
    }, [])

    const alElegir = async (tipo: TipoActivo, file?: File | null) => {
        if (!file) return

        if (!file.type.startsWith('image/')) {
            return toast.error('Tiene que ser una imagen (PNG o JPG)')
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            return toast.error(`La imagen supera ${MAX_MB} MB. Redúcela antes de subirla.`)
        }

        setSubiendo(tipo)
        try {
            await guardarActivo(tipo, file, userData?.email || userData?.nombre)
            toast.success(`${tipo[0].toUpperCase()}${tipo.slice(1)} actualizado para toda la empresa`)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo subir la imagen')
        } finally {
            setSubiendo(null)
        }
    }

    const alQuitar = async (tipo: TipoActivo) => {
        if (!window.confirm(`¿Quitar el ${tipo}? Dejará de salir en los PDF de todos.`)) return
        try {
            await eliminarActivo(tipo)
            toast.success(`${tipo} eliminado`)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo eliminar')
        }
    }

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-6 md:p-10 space-y-8">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tight">Identidad de la Empresa</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                        Se guardan en la nube, no en este equipo. Se suben una vez y salen en los
                        PDF de todo el mundo, desde cualquier computadora.
                    </p>
                </div>
            </div>

            {!puedeEditar && (
                <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                    <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-slate-400 leading-snug">
                        Solo el administrador puede cambiar estas imágenes. Son las que llevan
                        todos los documentos que salen de la empresa.
                    </p>
                </div>
            )}

            {cargando ? (
                <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {ACTIVOS.map(({ tipo, titulo, ayuda, campo }) => {
                        const url = identidad[campo] as string | undefined
                        const ocupado = subiendo === tipo

                        return (
                            <motion.div
                                key={tipo}
                                whileHover={puedeEditar ? { y: -2 } : undefined}
                                className="rounded-[2rem] border border-black/5 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 flex flex-col gap-3"
                            >
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                        {titulo}
                                    </p>
                                    {url && (
                                        <Badge className="rounded-full border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[8px] font-black uppercase px-2 gap-1">
                                            <Check className="w-2.5 h-2.5" /> Cargado
                                        </Badge>
                                    )}
                                </div>

                                {/* Vista previa sobre cuadros: firma y sello suelen ser PNG
                                    transparentes y sobre blanco no se distinguen bien. */}
                                <div
                                    className="h-28 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden"
                                    style={url ? {
                                        backgroundImage:
                                            'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
                                        backgroundSize: '12px 12px',
                                        backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
                                    } : undefined}
                                >
                                    {url ? (
                                        <img src={url} alt={titulo} className="max-h-full max-w-full object-contain" />
                                    ) : (
                                        <div className="text-center text-slate-300 dark:text-slate-600">
                                            <ImageIcon className="w-7 h-7 mx-auto mb-1" />
                                            <p className="text-[9px] font-black uppercase tracking-widest">Sin cargar</p>
                                        </div>
                                    )}
                                </div>

                                <p className="text-[10px] font-bold text-slate-400 leading-snug">{ayuda}</p>

                                {puedeEditar && (
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            className="hidden"
                                            ref={el => { refs.current[tipo] = el }}
                                            onChange={e => {
                                                alElegir(tipo, e.target.files?.[0])
                                                e.target.value = '' // permite volver a elegir el mismo archivo
                                            }}
                                        />
                                        <Button
                                            onClick={() => refs.current[tipo]?.click()}
                                            disabled={ocupado}
                                            className="flex-1 h-10 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase text-[9px] tracking-widest gap-1.5"
                                        >
                                            {ocupado
                                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Subiendo</>
                                                : <><Upload className="w-3 h-3" /> {url ? 'Cambiar' : 'Subir'}</>}
                                        </Button>
                                        {url && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => alQuitar(tipo)}
                                                disabled={ocupado}
                                                title="Quitar"
                                                className="h-10 w-10 shrink-0 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>
            )}

            {identidad.actualizadoEn && (
                <p className="text-[10px] font-bold text-slate-400">
                    Última actualización: {new Date(identidad.actualizadoEn).toLocaleString('es-VE')}
                    {identidad.actualizadoPor ? ` · ${identidad.actualizadoPor}` : ''}
                </p>
            )}
        </Card>
    )
}
