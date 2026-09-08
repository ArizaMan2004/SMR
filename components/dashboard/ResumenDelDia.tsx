// @/components/dashboard/ResumenDelDia.tsx
//
// Resumen del día para la portada del panel.
//
// Las tarjetas de siempre (Órdenes Totales, Sin Pagar...) responden a "cómo va
// el negocio en general". Esto responde a otra pregunta, la que uno se hace al
// abrir el sistema por la mañana: qué pasa HOY. Quién viene a trabajar, qué hay
// que entregar, cuánto entró y cuánto falta por cobrar.
//
// Se añade encima de lo que ya existía: no sustituye ni oculta nada.

"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { AvatarUsuario } from '@/components/dashboard/AvatarUsuario'
import { nombreDePila } from '@/lib/services/perfil-apariencia'

import { cn } from '@/lib/utils'
import {
    Users, PackageCheck, TrendingUp, AlertTriangle,
    CircleDot, Clock, ArrowRight, Sparkles,
} from 'lucide-react'

import { asistenciaDe, resumenBloques, type HorarioEstandar } from '@/lib/types/horarios'
import { saldoDeOrden, esAnulada } from '@/lib/utils/estados'
import { claveFechaLocal, aFecha } from '@/lib/utils/fechas'
import { getDeudaTotalFromServer } from '@/lib/services/ordenes-service'

interface Props {
    ordenes: any[]
    horarios: HorarioEstandar[]
    onNavigate?: (vista: string) => void
    onVerOrden?: (orden: any) => void
}

const contenedor = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const tarjeta = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
}

/** Saludo según la hora: pequeño detalle que hace que se sienta vivo. */
const saludo = (): string => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
}

export function ResumenDelDia({ ordenes, horarios, onNavigate, onVerOrden }: Props) {
    const { userData } = useAuth()
    const miNombre = nombreDePila(userData?.nombre)
    const hoyClave = claveFechaLocal()

    const equipo = useMemo(() => asistenciaDe(horarios), [horarios])
    const enTaller = equipo.filter(e => e.presenteAhora).length

    /** Órdenes cuya fecha de entrega es hoy y que aún no están terminadas. */
    const entregasHoy = useMemo(() => {
        return ordenes.filter(o => {
            if (esAnulada(o)) return false
            const f = aFecha(o.fechaEntrega)
            if (!f) return false
            return claveFechaLocal(f) === hoyClave
        })
    }, [ordenes, hoyClave])

    /** Cobrado hoy, sumando los abonos registrados con fecha de hoy. */
    const cobradoHoy = useMemo(() => {
        let total = 0
        ordenes.forEach(o => {
            const pagos = Array.isArray(o.registroPagos) ? o.registroPagos : []
            pagos.forEach((p: any) => {
                const f = aFecha(p.fechaRegistro || p.fecha || p.fechaPago)
                if (f && claveFechaLocal(f) === hoyClave) total += Number(p.montoUSD) || 0
            })
        })
        return total
    }, [ordenes, hoyClave])

    /**
     * Deuda de TODO el historial, no solo de las órdenes cargadas.
     *
     * Sumar `ordenes` daba una cifra corta: en memoria hay 150 de 1.800. La
     * suma la hace el servidor con una consulta de agregación, que se factura
     * como una lectura por cada 1.000 documentos: unas 4 en total.
     */
    const [porCobrar, setPorCobrar] = useState<number | null>(null)
    const [ordenesConDeuda, setOrdenesConDeuda] = useState<number | null>(null)

    useEffect(() => {
        let vivo = true
        getDeudaTotalFromServer().then(r => {
            if (!vivo || !r) return
            setPorCobrar(r.deudaUSD)
            setOrdenesConDeuda(r.ordenesConDeuda)
        })
        return () => { vivo = false }
    }, [])

    return (
        <motion.section
            variants={contenedor}
            initial="hidden"
            animate="visible"
            className="space-y-3 sm:space-y-4"
        >
{/* SALUDO.

                Antes era una linea gris con la hora y la fecha. Decir el nombre
                de quien esta dentro cuesta lo mismo y contesta la pregunta que
                importa cuando seis personas comparten pantallas: ¿con que
                cuenta estoy? La cara al lado lo confirma sin leer. */}
            <motion.div variants={tarjeta} className="flex items-center gap-3 px-1">
                {userData && (
                    <AvatarUsuario
                        nombre={userData.nombre}
                        apellido={userData.apellido}
                        apariencia={userData}
                        tamano={44}
                    />
                )}
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter leading-none truncate">
                        {miNombre ? <>Hola, {miNombre}</> : saludo()}
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-blue-500 shrink-0" />
                        {saludo()} · {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

                {/* --- EQUIPO DE HOY --- */}
                <motion.button
                    variants={tarjeta}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onNavigate?.('horarios')}
                    className="lg:col-span-2 text-left bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-5 sm:p-6 shadow-sm hover:shadow-xl border border-black/5 dark:border-white/5 transition-shadow group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 flex items-center justify-center">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">
                                    Equipo de hoy
                                </p>
                                <p className="text-sm font-black text-slate-800 dark:text-white mt-1 leading-none">
                                    {equipo.length === 0
                                        ? 'Sin horarios cargados'
                                        : `${equipo.length} en turno${enTaller > 0 ? ` · ${enTaller} ahora` : ''}`}
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>

                    {equipo.length === 0 ? (
                        <p className="text-[11px] font-bold text-slate-400">
                            Define la semana tipo del equipo para verlo aquí cada día.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {equipo.slice(0, 6).map(a => (
                                <div
                                    key={a.empleadoId}
                                    className={cn(
                                        'flex items-center gap-2 rounded-2xl pl-1.5 pr-3 py-1.5 border',
                                        a.presenteAhora
                                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                                            : 'bg-slate-50 dark:bg-white/5 border-transparent'
                                    )}
                                >
                                    <div className={cn(
                                        'w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] uppercase shrink-0',
                                        a.presenteAhora ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-white/10 text-slate-500'
                                    )}>
                                        {a.empleadoNombre.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 capitalize leading-none flex items-center gap-1">
                                            {a.empleadoNombre.split(' ')[0]}
                                            {a.presenteAhora && <CircleDot className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 leading-none whitespace-nowrap">
                                            {resumenBloques(a.bloques)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {equipo.length > 6 && (
                                <div className="flex items-center px-3 rounded-2xl bg-slate-50 dark:bg-white/5">
                                    <span className="text-[10px] font-black text-slate-400">+{equipo.length - 6}</span>
                                </div>
                            )}
                        </div>
                    )}
                </motion.button>

                {/* --- DINERO DE HOY --- */}
                <motion.div
                    variants={tarjeta}
                    className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-[2rem] p-5 sm:p-6 shadow-lg shadow-emerald-500/15 text-white relative overflow-hidden"
                >
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 opacity-70" />
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Cobrado hoy</p>
                        </div>
                        <p className="text-3xl sm:text-4xl font-black tracking-tighter italic leading-none">
                            ${cobradoHoy.toFixed(2)}
                        </p>

                    </div>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
                        className="absolute -right-7 -bottom-7 opacity-10 pointer-events-none"
                    >
                        <TrendingUp size={130} />
                    </motion.div>
                </motion.div>

                {/* --- ENTREGAS DE HOY --- */}
                <motion.div
                    variants={tarjeta}
                    className="lg:col-span-2 bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-5 sm:p-6 shadow-sm border border-black/5 dark:border-white/5"
                >
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <PackageCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">
                                Entregas de hoy
                            </p>
                            <p className="text-sm font-black text-slate-800 dark:text-white mt-1 leading-none">
                                {entregasHoy.length === 0
                                    ? 'Nada para hoy'
                                    : `${entregasHoy.length} ${entregasHoy.length > 1 ? 'órdenes' : 'orden'}`}
                            </p>
                        </div>
                    </div>

                    {entregasHoy.length === 0 ? (
                        <p className="text-[11px] font-bold text-slate-400">
                            Ninguna orden vence hoy en las cargadas.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {entregasHoy.slice(0, 4).map(o => {
                                const debe = Math.max(0, saldoDeOrden(o))
                                return (
                                    <button
                                        key={o.id}
                                        onClick={() => onVerOrden?.(o)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left group"
                                    >
                                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate leading-none">
                                                #{o.ordenNumero} · {o.cliente?.nombreRazonSocial || 'Sin cliente'}
                                            </p>
                                        </div>
                                        <span className={cn(
                                            'text-[10px] font-black shrink-0',
                                            debe > 0 ? 'text-rose-500' : 'text-emerald-500'
                                        )}>
                                            {debe > 0 ? `debe $${debe.toFixed(2)}` : 'pagada'}
                                        </span>
                                    </button>
                                )
                            })}
                            {entregasHoy.length > 4 && (
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1 pl-3">
                                    y {entregasHoy.length - 4} más
                                </p>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* --- POR COBRAR --- */}
                <motion.button
                    variants={tarjeta}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onNavigate?.('clients')}
                    className="text-left bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-5 sm:p-6 shadow-sm hover:shadow-xl border border-black/5 dark:border-white/5 transition-shadow group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Por cobrar</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-3xl sm:text-4xl font-black tracking-tighter italic text-slate-900 dark:text-white leading-none">
                        ${porCobrar === null ? "—" : porCobrar.toFixed(2)}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 mt-1.5">
                        {porCobrar === null
                            ? 'Consultando historial…'
                            : ordenesConDeuda
                                ? `Historial completo · ${ordenesConDeuda} órdenes deben`
                                : 'Historial completo'}
                    </p>
                </motion.button>
            </div>
        </motion.section>
    )
}
