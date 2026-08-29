// @/components/dashboard/UserPermissionsDialog.tsx
//
// Permisos sueltos para UNA persona concreta, por encima de lo que le da su rango.
// Sirve para el caso típico: "este empleado es diseñador, pero además quiero que
// vea el catálogo" sin tener que inventarle un rango nuevo para él solo.

"use client"

import React, { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Save, RotateCcw, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { usePermisos } from '@/lib/contexts/permisos-context'
import { VIEW_CATALOG, ROL_ADMIN, type ViewId, type ViewMeta } from '@/lib/roles'
import { guardarOverridesUsuario } from '@/lib/services/roles-service'

const ORDEN_GRUPOS: ViewMeta['grupo'][] = ['Operación', 'Ventas', 'Administración', 'Personal', 'Herramientas']

interface Props {
    usuario: any | null
    onClose: () => void
}

export function UserPermissionsDialog({ usuario, onClose }: Props) {
    const { roles } = usePermisos()

    const [extra, setExtra] = useState<Set<ViewId>>(new Set())
    const [bloqueadas, setBloqueadas] = useState<Set<ViewId>>(new Set())
    const [guardando, setGuardando] = useState(false)

    const rol = useMemo(() => roles.find(r => r.id === usuario?.rol), [roles, usuario?.rol])
    const vistasDelRango = useMemo(() => new Set<ViewId>(rol?.vistas ?? []), [rol])

    useEffect(() => {
        if (!usuario) return
        setExtra(new Set((usuario.vistasExtra ?? []) as ViewId[]))
        setBloqueadas(new Set((usuario.vistasBloqueadas ?? []) as ViewId[]))
    }, [usuario])

    const tieneAcceso = (vista: ViewId) =>
        !bloqueadas.has(vista) && (vistasDelRango.has(vista) || extra.has(vista))

    const esPersonalizado = (vista: ViewId) => extra.has(vista) || bloqueadas.has(vista)

    const alternar = (vista: ViewId) => {
        const daRango = vistasDelRango.has(vista)
        const activo = tieneAcceso(vista)

        const nuevoExtra = new Set(extra)
        const nuevoBloq = new Set(bloqueadas)

        if (activo) {
            // Quitarle el acceso: si venía del rango hay que bloquearlo
            // explícitamente; si era un permiso suelto, basta con retirarlo.
            if (daRango) nuevoBloq.add(vista)
            nuevoExtra.delete(vista)
        } else {
            // Dárselo: si el rango ya lo daba, era un bloqueo que ahora se levanta.
            nuevoBloq.delete(vista)
            if (!daRango) nuevoExtra.add(vista)
        }

        setExtra(nuevoExtra)
        setBloqueadas(nuevoBloq)
    }

    const restablecer = () => {
        setExtra(new Set())
        setBloqueadas(new Set())
    }

    const totalPersonalizados = extra.size + bloqueadas.size

    const handleGuardar = async () => {
        if (!usuario) return
        setGuardando(true)
        try {
            await guardarOverridesUsuario(usuario.id, {
                vistasExtra: Array.from(extra),
                vistasBloqueadas: Array.from(bloqueadas),
            })
            toast.success(`Permisos de ${usuario.nombre} actualizados`)
            onClose()
        } catch (e) {
            console.error(e)
            toast.error('No se pudieron guardar los permisos')
        } finally {
            setGuardando(false)
        }
    }

    const esAdmin = usuario?.rol === ROL_ADMIN

    return (
        <Dialog open={!!usuario} onOpenChange={abierto => !abierto && onClose()}>
            <DialogContent className="rounded-[2rem] max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase italic tracking-tight flex items-center gap-2">
                        <UserCog className="w-5 h-5 text-blue-600" />
                        Permisos de {usuario?.nombre} {usuario?.apellido}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold text-slate-400">
                        Rango: {rol?.label ?? usuario?.rol}. Aquí solo se ajustan las
                        excepciones de esta persona; lo demás lo hereda de su rango.
                    </DialogDescription>
                </DialogHeader>

                {esAdmin ? (
                    <div className="bg-purple-50 dark:bg-purple-500/10 rounded-2xl p-5 my-2">
                        <p className="text-sm font-black text-purple-800 dark:text-purple-300 uppercase">
                            Es administrador
                        </p>
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">
                            Ve todo el sistema por definición y no admite excepciones.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5 py-2">
                        {totalPersonalizados > 0 && (
                            <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                    {totalPersonalizados} excepción(es) sobre su rango
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={restablecer}
                                    className="h-8 rounded-xl text-amber-700 hover:bg-amber-100 font-black uppercase text-[9px] tracking-widest gap-1.5"
                                >
                                    <RotateCcw className="w-3 h-3" /> Volver al rango
                                </Button>
                            </div>
                        )}

                        {ORDEN_GRUPOS.map(grupo => {
                            const vistas = VIEW_CATALOG.filter(v => v.grupo === grupo && !v.siempre)
                            if (vistas.length === 0) return null

                            return (
                                <div key={grupo}>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                        {grupo}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {vistas.map(vista => {
                                            const activo = tieneAcceso(vista.id)
                                            const personalizado = esPersonalizado(vista.id)
                                            return (
                                                <label
                                                    key={vista.id}
                                                    className={cn(
                                                        'flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors',
                                                        personalizado
                                                            ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10'
                                                            : activo
                                                                ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                                                                : 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={activo}
                                                        onCheckedChange={() => alternar(vista.id)}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 leading-tight">
                                                                {vista.label}
                                                            </p>
                                                            {personalizado && (
                                                                <Badge className="rounded-full px-1.5 py-0 text-[8px] font-black uppercase border-0 bg-amber-200 text-amber-800">
                                                                    {extra.has(vista.id) ? 'Extra' : 'Quitado'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                                                            {vistasDelRango.has(vista.id) ? 'Incluida en su rango' : 'No incluida en su rango'}
                                                        </p>
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="rounded-xl font-black uppercase text-[10px] tracking-widest">
                        Cancelar
                    </Button>
                    {!esAdmin && (
                        <Button
                            onClick={handleGuardar}
                            disabled={guardando}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest gap-2"
                        >
                            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Guardar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
