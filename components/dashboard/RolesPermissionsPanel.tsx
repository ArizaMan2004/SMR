// @/components/dashboard/RolesPermissionsPanel.tsx
//
// Pantalla donde el admin decide qué ve cada rango, y crea rangos nuevos.
// Lo que se guarda aquí es lo que lee el menú y el render del dashboard.

"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    ShieldCheck, Plus, Trash2, Save, Loader2, Lock, Check, Users, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { usePermisos } from '@/lib/contexts/permisos-context'
import {
    VIEW_CATALOG,
    COLORES_ROL,
    COLOR_ROL_POR_DEFECTO,
    ROL_ADMIN,
    ROL_POR_DEFECTO,
    type RolDefinicion,
    type ViewId,
    type ViewMeta,
} from '@/lib/roles'
import {
    guardarRol,
    eliminarRol,
    generarIdDeRol,
    reasignarUsuariosDeRol,
} from '@/lib/services/roles-service'

/** Orden en que se muestran los bloques de vistas. */
const ORDEN_GRUPOS: ViewMeta['grupo'][] = ['Operación', 'Ventas', 'Administración', 'Personal', 'Herramientas']

interface Props {
    /** Para avisar cuántas personas usan cada rango antes de borrarlo. */
    usuarios: any[]
}

export function RolesPermissionsPanel({ usuarios }: Props) {
    const { roles } = usePermisos()

    const [rolSeleccionadoId, setRolSeleccionadoId] = useState<string>(ROL_POR_DEFECTO)
    const [vistasEditadas, setVistasEditadas] = useState<Set<ViewId>>(new Set())
    const [esProduccionEditado, setEsProduccionEditado] = useState(false)
    const [guardando, setGuardando] = useState(false)

    const [dialogoNuevo, setDialogoNuevo] = useState(false)
    const [nombreNuevo, setNombreNuevo] = useState('')
    const [colorNuevo, setColorNuevo] = useState(COLOR_ROL_POR_DEFECTO)

    const [dialogoBorrar, setDialogoBorrar] = useState(false)
    const [rolDestino, setRolDestino] = useState(ROL_POR_DEFECTO)

    const rolSeleccionado: RolDefinicion | undefined = useMemo(
        () => roles.find(r => r.id === rolSeleccionadoId),
        [roles, rolSeleccionadoId]
    )

    // Al cambiar de rango, se carga su configuración guardada en el editor.
    useEffect(() => {
        if (!rolSeleccionado) return
        setVistasEditadas(new Set(rolSeleccionado.vistas))
        setEsProduccionEditado(!!rolSeleccionado.esProduccion)
    }, [rolSeleccionado])

    const esAdminSeleccionado = rolSeleccionadoId === ROL_ADMIN

    const hayCambios = useMemo(() => {
        if (!rolSeleccionado || esAdminSeleccionado) return false
        const original = new Set(rolSeleccionado.vistas)
        if (original.size !== vistasEditadas.size) return true
        if (!!rolSeleccionado.esProduccion !== esProduccionEditado) return true
        for (const v of vistasEditadas) if (!original.has(v)) return true
        return false
    }, [rolSeleccionado, vistasEditadas, esProduccionEditado, esAdminSeleccionado])

    const contarUsuarios = (rolId: string) => usuarios.filter(u => u.rol === rolId).length

    const alternarVista = (vista: ViewId) => {
        setVistasEditadas(prev => {
            const siguiente = new Set(prev)
            if (siguiente.has(vista)) siguiente.delete(vista)
            else siguiente.add(vista)
            return siguiente
        })
    }

    const handleGuardar = async () => {
        if (!rolSeleccionado) return
        setGuardando(true)
        try {
            await guardarRol({
                ...rolSeleccionado,
                vistas: Array.from(vistasEditadas),
                esProduccion: esProduccionEditado,
            })
            toast.success(`Permisos de "${rolSeleccionado.label}" actualizados`)
        } catch (e) {
            console.error(e)
            toast.error('No se pudieron guardar los permisos')
        } finally {
            setGuardando(false)
        }
    }

    const handleCrearRango = async () => {
        const nombre = nombreNuevo.trim()
        if (!nombre) return toast.error('Ponle un nombre al rango')

        const id = generarIdDeRol(nombre)
        if (!id) return toast.error('Ese nombre no genera un identificador válido')
        if (roles.some(r => r.id === id)) return toast.error('Ya existe un rango con ese nombre')

        setGuardando(true)
        try {
            // Nace sin permisos: el admin marca lo que debe ver. Es más seguro
            // empezar cerrado y abrir, que empezar abierto y tener que acordarse de cerrar.
            await guardarRol({ id, label: nombre, color: colorNuevo, vistas: [], esSistema: false })
            toast.success(`Rango "${nombre}" creado. Ahora elige qué puede ver.`)
            setRolSeleccionadoId(id)
            setDialogoNuevo(false)
            setNombreNuevo('')
            setColorNuevo(COLOR_ROL_POR_DEFECTO)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo crear el rango')
        } finally {
            setGuardando(false)
        }
    }

    const handleBorrarRango = async () => {
        if (!rolSeleccionado || rolSeleccionado.esSistema) return
        setGuardando(true)
        try {
            const movidos = await reasignarUsuariosDeRol(rolSeleccionado.id, rolDestino)
            await eliminarRol(rolSeleccionado.id)
            toast.success(
                movidos > 0
                    ? `Rango eliminado. ${movidos} persona(s) pasaron a ${rolDestino}.`
                    : 'Rango eliminado'
            )
            setRolSeleccionadoId(ROL_POR_DEFECTO)
            setDialogoBorrar(false)
        } catch (e: any) {
            console.error(e)
            toast.error(e?.message || 'No se pudo eliminar el rango')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* --- COLUMNA IZQUIERDA: LISTA DE RANGOS --- */}
            <Card className="lg:col-span-4 rounded-[2rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-4 sm:p-5 h-fit">
                <div className="flex items-center justify-between mb-4 px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Rangos ({roles.length})
                    </p>
                    <Button
                        size="sm"
                        onClick={() => setDialogoNuevo(true)}
                        className="h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[9px] tracking-widest gap-1.5 px-3"
                    >
                        <Plus className="w-3 h-3" /> Nuevo
                    </Button>
                </div>

                <div className="space-y-1.5">
                    {roles.map(rol => {
                        const activo = rol.id === rolSeleccionadoId
                        const cantidad = contarUsuarios(rol.id)
                        return (
                            <button
                                key={rol.id}
                                onClick={() => setRolSeleccionadoId(rol.id)}
                                className={cn(
                                    'w-full text-left px-3 py-3 rounded-2xl transition-all flex items-center justify-between gap-2',
                                    activo
                                        ? 'bg-slate-900 dark:bg-white/10 shadow-lg'
                                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                                )}
                            >
                                <div className="min-w-0">
                                    <p className={cn(
                                        'text-xs font-black uppercase tracking-wide truncate',
                                        activo ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                                    )}>
                                        {rol.label}
                                    </p>
                                    <p className={cn(
                                        'text-[9px] font-bold uppercase tracking-widest mt-0.5',
                                        activo ? 'text-white/50' : 'text-slate-400'
                                    )}>
                                        {rol.id === ROL_ADMIN
                                            ? 'Acceso total'
                                            : `${rol.vistas.length} vista(s)`}
                                        {cantidad > 0 && ` · ${cantidad} persona(s)`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {!rol.esSistema && (
                                        <Badge className="rounded-full px-2 py-0 text-[8px] font-black uppercase border-0 bg-blue-100 text-blue-600">
                                            Propio
                                        </Badge>
                                    )}
                                    <span className={cn('w-3 h-3 rounded-full', rol.color.split(' ')[0])} />
                                </div>
                            </button>
                        )
                    })}
                </div>
            </Card>

            {/* --- COLUMNA DERECHA: VISTAS DEL RANGO --- */}
            <Card className="lg:col-span-8 rounded-[2rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7">
                {!rolSeleccionado ? (
                    <p className="text-center py-16 text-xs font-bold uppercase text-slate-400">
                        Elige un rango a la izquierda
                    </p>
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                            <div className="min-w-0">
                                <h3 className="text-lg font-black uppercase italic tracking-tight truncate">
                                    {rolSeleccionado.label}
                                </h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                                    Identificador: {rolSeleccionado.id}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {!rolSeleccionado.esSistema && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setRolDestino(ROL_POR_DEFECTO); setDialogoBorrar(true) }}
                                        className="h-10 rounded-xl text-red-500 hover:bg-red-50 font-black uppercase text-[10px] tracking-widest gap-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </Button>
                                )}
                                <Button
                                    onClick={handleGuardar}
                                    disabled={!hayCambios || guardando}
                                    className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 px-5 disabled:opacity-40"
                                >
                                    {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    {hayCambios ? 'Guardar cambios' : 'Guardado'}
                                </Button>
                            </div>
                        </div>

                        {esAdminSeleccionado ? (
                            <div className="flex items-start gap-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-2xl p-5">
                                <Lock className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-black text-purple-800 dark:text-purple-300 uppercase">
                                        El administrador siempre lo ve todo
                                    </p>
                                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-1">
                                        No se le pueden recortar permisos a propósito: si pudieras quitarte
                                        el acceso a esta misma pantalla, te quedarías fuera de tu propia
                                        aplicación sin forma de volver a entrar.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-white/5 rounded-2xl p-4 mb-6">
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                            Es personal de taller
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            Se le abre directamente el Taller al entrar, en vez de Facturación.
                                        </p>
                                    </div>
                                    <Switch checked={esProduccionEditado} onCheckedChange={setEsProduccionEditado} />
                                </div>

                                <div className="space-y-6">
                                    {ORDEN_GRUPOS.map(grupo => {
                                        const vistas = VIEW_CATALOG.filter(v => v.grupo === grupo)
                                        if (vistas.length === 0) return null

                                        return (
                                            <div key={grupo}>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                    {grupo}
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {vistas.map(vista => {
                                                        const fijada = !!vista.siempre
                                                        const marcada = fijada || vistasEditadas.has(vista.id)
                                                        return (
                                                            <motion.label
                                                                key={vista.id}
                                                                whileTap={fijada ? undefined : { scale: 0.98 }}
                                                                className={cn(
                                                                    'flex items-start gap-3 p-3 rounded-2xl border transition-colors',
                                                                    fijada
                                                                        ? 'border-transparent bg-slate-50 dark:bg-white/5 opacity-60 cursor-not-allowed'
                                                                        : marcada
                                                                            ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 cursor-pointer'
                                                                            : 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer'
                                                                )}
                                                            >
                                                                <Checkbox
                                                                    checked={marcada}
                                                                    disabled={fijada}
                                                                    onCheckedChange={() => !fijada && alternarVista(vista.id)}
                                                                    className="mt-0.5"
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 leading-tight">
                                                                        {vista.label}
                                                                    </p>
                                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                                                                        {fijada ? 'Siempre disponible para todos' : vista.descripcion}
                                                                    </p>
                                                                </div>
                                                            </motion.label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </>
                )}
            </Card>

            {/* --- DIÁLOGO: NUEVO RANGO --- */}
            <Dialog open={dialogoNuevo} onOpenChange={setDialogoNuevo}>
                <DialogContent className="rounded-[2rem] max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase italic tracking-tight flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-600" /> Nuevo rango
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-slate-400">
                            Nace sin permisos. Después marcas qué puede ver.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Nombre del rango
                            </Label>
                            <Input
                                value={nombreNuevo}
                                onChange={e => setNombreNuevo(e.target.value)}
                                placeholder="Ej: Ayudante de Taller"
                                className="h-12 rounded-2xl border-none bg-slate-50 dark:bg-white/5 font-bold"
                            />
                            {nombreNuevo.trim() && (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Identificador: {generarIdDeRol(nombreNuevo) || '—'}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Color de la etiqueta
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {COLORES_ROL.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => setColorNuevo(c.value)}
                                        title={c.label}
                                        className={cn(
                                            'w-9 h-9 rounded-xl transition-all flex items-center justify-center',
                                            c.value.split(' ')[0],
                                            colorNuevo === c.value ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white' : ''
                                        )}
                                    >
                                        {colorNuevo === c.value && <Check className="w-4 h-4 text-slate-700" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogoNuevo(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCrearRango}
                            disabled={guardando || !nombreNuevo.trim()}
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest gap-2"
                        >
                            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Crear rango
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- DIÁLOGO: ELIMINAR RANGO --- */}
            <Dialog open={dialogoBorrar} onOpenChange={setDialogoBorrar}>
                <DialogContent className="rounded-[2rem] max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase italic tracking-tight flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" /> Eliminar rango
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-slate-400">
                            {rolSeleccionado && contarUsuarios(rolSeleccionado.id) > 0
                                ? `${contarUsuarios(rolSeleccionado.id)} persona(s) tienen este rango. Elige a cuál pasan.`
                                : 'Nadie tiene este rango asignado.'}
                        </DialogDescription>
                    </DialogHeader>

                    {rolSeleccionado && contarUsuarios(rolSeleccionado.id) > 0 && (
                        <div className="space-y-2 py-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" /> Pasarlos al rango
                            </Label>
                            <Select value={rolDestino} onValueChange={setRolDestino}>
                                <SelectTrigger className="h-12 rounded-2xl border-none bg-slate-50 dark:bg-white/5 font-bold text-xs uppercase">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {roles
                                        .filter(r => r.id !== rolSeleccionado.id)
                                        .map(r => (
                                            <SelectItem key={r.id} value={r.id} className="text-xs font-bold uppercase">
                                                {r.label}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogoBorrar(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleBorrarRango}
                            disabled={guardando}
                            className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest gap-2"
                        >
                            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
