// @/components/dashboard/AparienciaPerfilPanel.tsx
//
// ELEGIR LA CARA DE TU CUENTA.
//
// La foto es opcional a propósito: en el taller la mitad de la gente no tiene
// una a mano y obligarles acabaría con seis avatares grises. El color, en
// cambio, lo tiene todo el mundo desde el primer día — de fábrica sale uno
// distinto por persona, sacado de su nombre, así que ya se distinguen sin
// haber tocado nada.

"use client"

import React, { useRef, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Camera, Loader2, Trash2, Check, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { uploadFileToCloudinary } from '@/lib/services/cloudinary-service'
import { AvatarUsuario } from '@/components/dashboard/AvatarUsuario'
import {
    DEGRADADOS, coloresDe, guardarApariencia, quitarFoto,
    type AparienciaPerfil,
} from '@/lib/services/perfil-apariencia'

export function AparienciaPerfilPanel() {
    const { user, userData } = useAuth()
    const archivo = useRef<HTMLInputElement>(null)

    const [subiendo, setSubiendo] = useState(false)
    const [guardando, setGuardando] = useState(false)

    // Lo elegido se ve al instante, antes de guardar: elegir un color a ciegas
    // y tener que guardar para saber si te gusta no es elegir.
    const [previa, setPrevia] = useState<AparienciaPerfil | null>(null)

    const actual: AparienciaPerfil = previa ?? {
        fotoUrl: userData?.fotoUrl,
        colorDesde: userData?.colorDesde,
        colorHasta: userData?.colorHasta,
    }

    const nombreCompleto = `${userData?.nombre || ''} ${userData?.apellido || ''}`
    const elegido = coloresDe(actual, nombreCompleto)

    const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f || !user?.uid) return

        // 4 MB: una foto de teléfono ronda los 2-3. Por encima suele ser un
        // archivo que nadie quiso subir.
        if (f.size > 4 * 1024 * 1024) {
            toast.error('La foto pesa más de 4 MB. Usa una más pequeña.')
            return
        }

        setSubiendo(true)
        try {
            const url = await uploadFileToCloudinary(f)
            await guardarApariencia(user.uid, { fotoUrl: url })
            setPrevia(p => ({ ...(p ?? actual), fotoUrl: url }))
            toast.success('Foto actualizada')
        } catch (err: any) {
            toast.error(`No se pudo subir: ${err?.message || err}`)
        } finally {
            setSubiendo(false)
            if (archivo.current) archivo.current.value = ''
        }
    }

    const borrarFoto = async () => {
        if (!user?.uid) return
        setSubiendo(true)
        try {
            await quitarFoto(user.uid)
            setPrevia(p => ({ ...(p ?? actual), fotoUrl: '' }))
            toast.success('Se quitó la foto; quedan tus iniciales')
        } catch (err: any) {
            toast.error(`No se pudo quitar: ${err?.message || err}`)
        } finally {
            setSubiendo(false)
        }
    }

    const elegirColor = async (desde: string, hasta: string) => {
        if (!user?.uid) return
        setPrevia(p => ({ ...(p ?? actual), colorDesde: desde, colorHasta: hasta }))

        setGuardando(true)
        try {
            await guardarApariencia(user.uid, { colorDesde: desde, colorHasta: hasta })
        } catch (err: any) {
            toast.error(`No se pudo guardar el color: ${err?.message || err}`)
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-6">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 flex items-center justify-center shrink-0">
                    <Palette className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Tu cara en el sistema</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Foto y color de tu cuenta
                    </p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="relative shrink-0">
                    <AvatarUsuario
                        nombre={userData?.nombre}
                        apellido={userData?.apellido}
                        apariencia={actual}
                        tamano={96}
                    />
                    {subiendo && (
                        <div className="absolute inset-0 rounded-[28%] bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                    <p className="text-sm font-black uppercase tracking-tight">
                        {userData?.nombre} {userData?.apellido}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 leading-snug">
                        La foto es opcional. Sin ella salen tus iniciales sobre el color que elijas,
                        que distingue igual de rápido y no depende de subir nada.
                    </p>

                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                        <input
                            ref={archivo}
                            type="file"
                            accept="image/*"
                            onChange={subirFoto}
                            className="hidden"
                        />
                        <Button
                            variant="outline"
                            onClick={() => archivo.current?.click()}
                            disabled={subiendo}
                            className="h-10 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            {actual.fotoUrl ? 'Cambiar foto' : 'Subir foto'}
                        </Button>

                        {actual.fotoUrl && (
                            <Button
                                variant="outline"
                                onClick={borrarFoto}
                                disabled={subiendo}
                                className="h-10 rounded-2xl px-3 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* LOS COLORES.

                Se eligen de una lista y no de una rueda porque la mitad de los
                colores que uno escoge a mano dejan las letras blancas
                ilegibles. Estos están comprobados con texto blanco encima. */}
            <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex-1">
                        Color de tu avatar
                    </Label>
                    {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                    {DEGRADADOS.map(d => {
                        const activo = elegido.desde === d.desde && elegido.hasta === d.hasta
                        return (
                            <button
                                key={d.id}
                                type="button"
                                onClick={() => elegirColor(d.desde, d.hasta)}
                                title={d.nombre}
                                className={cn(
                                    'relative h-12 rounded-2xl transition-all',
                                    activo
                                        ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-[#1c1c1e] scale-105'
                                        : 'hover:scale-105'
                                )}
                                style={{ background: `linear-gradient(135deg, ${d.desde} 0%, ${d.hasta} 100%)` }}
                            >
                                {activo && (
                                    <Check className="w-5 h-5 text-white absolute inset-0 m-auto drop-shadow" strokeWidth={3} />
                                )}
                            </button>
                        )
                    })}
                </div>

                <p className="text-[10px] font-bold text-slate-400 leading-snug">
                    Se guarda al tocarlo. Si nunca eliges uno, te toca uno fijo sacado de tu
                    nombre: así dos personas no salen del mismo color por defecto.
                </p>
            </div>
        </Card>
    )
}
