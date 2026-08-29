// @/components/dashboard/NotificationCenter.tsx
//
// Centro de Notificaciones: la vista completa de la bandeja.
//
// Lee del MISMO contexto que la campana, así que lo que se marca como leído en
// un sitio se refleja en el otro al instante. Antes eran dos sistemas separados
// leyendo campos distintos de la misma colección, y cada uno enseñaba solo la
// mitad de los avisos.

"use client"

import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Bell, BellRing, CheckCheck, Trash2, Search, X, Inbox,
    Monitor, AlertCircle, Loader2, Filter, ArrowRight, ShieldAlert,
} from "lucide-react"
import { cn } from "@/lib/utils"

import { useNotifications } from "@/lib/contexts/notification-context"
import {
    CATEGORIA_META, TIPO_META,
    type Notificacion, type NotifCategoria, type NotifTipo,
} from "@/lib/types/notificaciones"

interface Props {
    onNavigate?: (view: string) => void
}

type FiltroLectura = 'todas' | 'sin_leer' | 'leidas'

const CATEGORIAS: NotifCategoria[] = [
    'orden', 'pago', 'gasto', 'empleado', 'tarea', 'inventario', 'sistema',
]

const TIPOS: NotifTipo[] = ['error', 'warning', 'success', 'info']

/** Agrupa por cercanía en el tiempo: es como la gente busca un aviso. */
function grupoDe(fecha: Date): 'Hoy' | 'Ayer' | 'Esta semana' | 'Anteriores' {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const dia = new Date(fecha); dia.setHours(0, 0, 0, 0)
    const diffDias = Math.round((hoy.getTime() - dia.getTime()) / 86400000)

    if (diffDias <= 0) return 'Hoy'
    if (diffDias === 1) return 'Ayer'
    if (diffDias <= 7) return 'Esta semana'
    return 'Anteriores'
}

const ORDEN_GRUPOS = ['Hoy', 'Ayer', 'Esta semana', 'Anteriores'] as const

function horaCorta(fecha: Date): string {
    return fecha.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function fechaCorta(fecha: Date): string {
    return fecha.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
}

export function NotificationCenter({ onNavigate }: Props) {
    const {
        notifications, unreadCount, countsPorCategoria, cargando, error,
        markAsRead, markAllRead, dismiss, dismissAll,
        canPushNotify, pushBloqueado, requestPermission,
    } = useNotifications()

    const [busqueda, setBusqueda] = useState('')
    const [filtroLectura, setFiltroLectura] = useState<FiltroLectura>('todas')
    const [categoriasActivas, setCategoriasActivas] = useState<Set<NotifCategoria>>(new Set())
    const [tiposActivos, setTiposActivos] = useState<Set<NotifTipo>>(new Set())

    const alternar = <T,>(set: Set<T>, valor: T, aplicar: (s: Set<T>) => void) => {
        const siguiente = new Set(set)
        if (siguiente.has(valor)) siguiente.delete(valor)
        else siguiente.add(valor)
        aplicar(siguiente)
    }

    const hayFiltros = filtroLectura !== 'todas' || categoriasActivas.size > 0 || tiposActivos.size > 0 || busqueda.trim() !== ''

    const limpiarFiltros = () => {
        setBusqueda('')
        setFiltroLectura('todas')
        setCategoriasActivas(new Set())
        setTiposActivos(new Set())
    }

    const filtradas = useMemo(() => {
        const texto = busqueda.trim().toLowerCase()

        return notifications.filter(n => {
            if (filtroLectura === 'sin_leer' && n.leida) return false
            if (filtroLectura === 'leidas' && !n.leida) return false
            if (categoriasActivas.size > 0 && !categoriasActivas.has(n.categoria)) return false
            if (tiposActivos.size > 0 && !tiposActivos.has(n.tipo)) return false
            if (texto && !(`${n.titulo} ${n.cuerpo}`.toLowerCase().includes(texto))) return false
            return true
        })
    }, [notifications, busqueda, filtroLectura, categoriasActivas, tiposActivos])

    const agrupadas = useMemo(() => {
        const grupos: Record<string, Notificacion[]> = {}
        filtradas.forEach(n => {
            const g = grupoDe(n.fecha)
            if (!grupos[g]) grupos[g] = []
            grupos[g].push(n)
        })
        return grupos
    }, [filtradas])

    const abrir = async (n: Notificacion) => {
        if (!n.leida) await markAsRead(n.id)
        if (n.link && onNavigate) onNavigate(n.link)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto space-y-5 pb-24 px-2 sm:px-4"
        >
            {/* --- CABECERA --- */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/40 dark:bg-white/5 backdrop-blur-3xl p-4 sm:p-6 rounded-[2rem] border border-white/20 shadow-2xl gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                        <Bell className="text-white w-5 h-5 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">
                            Notificaciones
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mt-1">
                            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {unreadCount > 0 && (
                        <Button
                            onClick={markAllRead}
                            className="h-10 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase text-[10px] tracking-widest gap-2 px-4"
                        >
                            <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                        </Button>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (window.confirm('¿Vaciar toda la bandeja? No se puede deshacer.')) dismissAll()
                            }}
                            className="h-10 rounded-xl text-red-500 hover:bg-red-50 font-black uppercase text-[10px] tracking-widest gap-2 px-4"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Vaciar
                        </Button>
                    )}
                </div>
            </header>

            {/* --- AVISO SI FIRESTORE FALLA --- */}
            {error && (
                <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4">
                    <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
                            No se pudieron cargar las notificaciones
                        </p>
                        <p className="text-[11px] font-bold text-rose-500 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* --- ACTIVAR AVISOS DEL SISTEMA --- */}
            {!canPushNotify && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4">
                    <Monitor className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                            Avisos del sistema desactivados
                        </p>
                        <p className="text-[11px] font-bold text-blue-500 mt-0.5">
                            {pushBloqueado
                                ? 'Están bloqueados en este navegador. Actívalos desde el candado de la barra de direcciones.'
                                : 'Actívalos para enterarte de órdenes y pagos aunque no tengas la pestaña abierta.'}
                        </p>
                    </div>
                    {!pushBloqueado && (
                        <Button
                            onClick={requestPermission}
                            className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 px-4 shrink-0"
                        >
                            <BellRing className="w-3.5 h-3.5" /> Activar
                        </Button>
                    )}
                </div>
            )}

            {/* --- FILTROS --- */}
            <Card className="rounded-[2rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar en las notificaciones..."
                            className="h-11 pl-11 rounded-2xl border-none bg-slate-50 dark:bg-white/5 font-bold text-xs"
                        />
                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl p-1">
                        {([
                            { id: 'todas', label: 'Todas' },
                            { id: 'sin_leer', label: 'Sin leer' },
                            { id: 'leidas', label: 'Leídas' },
                        ] as const).map(op => (
                            <button
                                key={op.id}
                                onClick={() => setFiltroLectura(op.id)}
                                className={cn(
                                    'px-4 h-9 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all',
                                    filtroLectura === op.id
                                        ? 'bg-white dark:bg-white/10 text-blue-600 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600'
                                )}
                            >
                                {op.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Categorías */}
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                        <Filter className="w-3 h-3" /> Categoría
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {CATEGORIAS.map(cat => {
                            const meta = CATEGORIA_META[cat]
                            const activa = categoriasActivas.has(cat)
                            const sinLeer = countsPorCategoria[cat] || 0
                            return (
                                <button
                                    key={cat}
                                    onClick={() => alternar(categoriasActivas, cat, setCategoriasActivas)}
                                    className={cn(
                                        'px-3 h-8 rounded-xl font-black uppercase text-[10px] tracking-wide transition-all flex items-center gap-1.5 border',
                                        activa
                                            ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                            : 'border-transparent bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'
                                    )}
                                >
                                    <span>{meta.icono}</span>
                                    {meta.label}
                                    {sinLeer > 0 && (
                                        <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 rounded-full">
                                            {sinLeer}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Prioridad */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Prioridad</p>
                    {TIPOS.map(tipo => {
                        const meta = TIPO_META[tipo]
                        const activo = tiposActivos.has(tipo)
                        return (
                            <button
                                key={tipo}
                                onClick={() => alternar(tiposActivos, tipo, setTiposActivos)}
                                className={cn(
                                    'px-3 h-8 rounded-xl font-black uppercase text-[10px] tracking-wide transition-all flex items-center gap-1.5 border',
                                    activo
                                        ? 'border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white'
                                        : 'border-transparent bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'
                                )}
                            >
                                <span className={cn('w-2 h-2 rounded-full', meta.punto)} />
                                {meta.label}
                            </button>
                        )
                    })}

                    {hayFiltros && (
                        <button
                            onClick={limpiarFiltros}
                            className="ml-auto px-3 h-8 rounded-xl font-black uppercase text-[10px] tracking-widest text-red-500 hover:bg-red-50 flex items-center gap-1.5"
                        >
                            <X className="w-3 h-3" /> Limpiar filtros
                        </button>
                    )}
                </div>
            </Card>

            {/* --- LISTA --- */}
            {cargando ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : filtradas.length === 0 ? (
                <Card className="rounded-[2rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] py-16 flex flex-col items-center gap-3">
                    <Inbox className="w-12 h-12 text-slate-200 dark:text-slate-700" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        {hayFiltros ? 'Nada coincide con estos filtros' : 'No hay notificaciones'}
                    </p>
                    {hayFiltros && (
                        <Button
                            variant="ghost"
                            onClick={limpiarFiltros}
                            className="rounded-xl font-black uppercase text-[10px] tracking-widest text-blue-600"
                        >
                            Quitar filtros
                        </Button>
                    )}
                </Card>
            ) : (
                <div className="space-y-6">
                    {ORDEN_GRUPOS.map(grupo => {
                        const items = agrupadas[grupo]
                        if (!items || items.length === 0) return null

                        return (
                            <div key={grupo}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-2">
                                    {grupo} · {items.length}
                                </p>
                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {items.map(n => {
                                            const catMeta = CATEGORIA_META[n.categoria]
                                            const tipoMeta = TIPO_META[n.tipo]

                                            return (
                                                <motion.div
                                                    key={n.id}
                                                    layout
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className={cn(
                                                        'group flex items-start gap-3 p-4 rounded-2xl border transition-colors',
                                                        n.leida
                                                            ? 'bg-slate-50/60 dark:bg-white/[0.02] border-transparent'
                                                            : 'bg-white dark:bg-[#1c1c1e] border-slate-100 dark:border-white/5 shadow-sm'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base relative',
                                                        catMeta.color
                                                    )}>
                                                        {catMeta.icono}
                                                        {!n.leida && (
                                                            <span className={cn(
                                                                'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#1c1c1e]',
                                                                tipoMeta.punto
                                                            )} />
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => abrir(n)}
                                                        className="flex-1 min-w-0 text-left"
                                                    >
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className={cn(
                                                                'text-xs font-black leading-tight',
                                                                n.leida ? 'text-slate-500' : 'text-slate-900 dark:text-white'
                                                            )}>
                                                                {n.titulo}
                                                            </p>
                                                            <Badge className="rounded-full px-2 py-0 text-[8px] font-black uppercase border-0 bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
                                                                {catMeta.label}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5 leading-snug break-words">
                                                            {n.cuerpo}
                                                        </p>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600 mt-1.5 flex items-center gap-2">
                                                            {grupo === 'Hoy' ? horaCorta(n.fecha) : `${fechaCorta(n.fecha)} · ${horaCorta(n.fecha)}`}
                                                            {n.link && (
                                                                <span className="text-blue-500 flex items-center gap-0.5">
                                                                    Abrir <ArrowRight className="w-2.5 h-2.5" />
                                                                </span>
                                                            )}
                                                        </p>
                                                    </button>

                                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            onClick={() => markAsRead(n.id, !n.leida)}
                                                            title={n.leida ? 'Marcar como no leída' : 'Marcar como leída'}
                                                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                        >
                                                            <CheckCheck className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            onClick={() => dismiss(n.id)}
                                                            title="Eliminar"
                                                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </motion.div>
    )
}

export default NotificationCenter
