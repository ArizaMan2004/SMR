// @/components/dashboard/EmployeeFinancesView.tsx
"use client"

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet, Calendar, Clock, ReceiptText, AlertCircle, TrendingUp,
    CheckCircle2, Star, ListChecks, Hourglass
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBs } from "@/lib/services/bcv-service";

const TIPO_TAREA_LABEL: Record<string, string> = {
    SERVICIO: 'Servicio',
    CORTE_LASER: 'Corte Láser',
    DISENO: 'Diseño',
    OTRO: 'Otro',
};

export function EmployeeFinancesView({ empleados, pagos, tareas = [], currentUserId, rates }: any) {

    const myProfile = useMemo(() =>
        empleados.find((e: any) => e.usuarioId === currentUserId)
    , [empleados, currentUserId]);

    const myPayments = useMemo(() => {
        if (!myProfile) return [];
        return pagos
            .filter((p: any) => p.usuarioId === currentUserId || p.empleadoId === myProfile.id)
            .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [pagos, currentUserId, myProfile]);

    const myTareas = useMemo(() => {
        if (!myProfile) return [];
        return tareas.filter((t: any) =>
            t.usuarioId === currentUserId || t.empleadoDbId === myProfile.id
        );
    }, [tareas, currentUserId, myProfile]);

    const tareasAprobadas = useMemo(() =>
        myTareas.filter((t: any) => t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE')
    , [myTareas]);

    const tareasPendienteAprobacion = useMemo(() =>
        myTareas.filter((t: any) => t.estado === 'PENDIENTE')
    , [myTareas]);

    const tareasPagadas = useMemo(() =>
        myTareas.filter((t: any) => t.estadoPago === 'PAGADO').slice(0, 10)
    , [myTareas]);

    const taskComPendiente = useMemo(() =>
        tareasAprobadas.reduce((s: number, t: any) => s + (t.montoComision || 0), 0)
    , [tareasAprobadas]);

    const totalPagadoEsteMes = useMemo(() => {
        const mesActual = new Date().toISOString().slice(0, 7);
        return myPayments
            .filter((p: any) => (p.mesRelativo === mesActual) || (p.fecha && p.fecha.startsWith(mesActual)))
            .reduce((sum: number, p: any) => sum + (Number(p.totalUSD) || 0), 0);
    }, [myPayments]);

    if (!myProfile) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] opacity-50 text-center px-4">
                <AlertCircle className="w-24 h-24 mb-6 text-slate-400" />
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Cuenta No Vinculada</h2>
                <p className="font-bold text-slate-500 mt-2 max-w-md">
                    Tu usuario aún no ha sido enlazado a un perfil de nómina. Solicita al administrador que vincule tu cuenta en Gestión de Personal.
                </p>
            </div>
        );
    }

    const mesActualStr = new Date().toISOString().slice(0, 7);
    const esSemanal = myProfile.frecuenciaPago === 'Semanal';
    const comisionesManuales = myProfile.comisiones?.reduce((a: any, c: any) => a + c.monto, 0) || 0;

    let sueldoPendiente = myProfile.montoSueldo;
    if (esSemanal) {
        if (myProfile.ultimoPagoIso) {
            const diffDays = Math.floor((new Date().getTime() - new Date(myProfile.ultimoPagoIso).getTime()) / 86400000);
            if (diffDays < 6) sueldoPendiente = 0;
        }
    } else {
        if (myProfile.ultimoPagoMes === mesActualStr) sueldoPendiente = 0;
    }

    const totalPendienteUSD = sueldoPendiente + comisionesManuales + taskComPendiente;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-24">

            {/* HEADER */}
            <div className="flex items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20 shrink-0">
                    <Wallet size={32} />
                </div>
                <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        Mis Finanzas
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
                        {myProfile.nombre} · {myProfile.cargo}
                    </p>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 rounded-[3rem] p-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-none shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10"><Clock size={120} /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 relative z-10">Saldo Pendiente por Cobrar</p>
                    <h3 className="text-6xl font-black tracking-tighter italic relative z-10">${totalPendienteUSD.toFixed(2)}</h3>
                    {rates?.usd > 0 && (
                        <p className="text-sm font-bold mt-2 relative z-10 opacity-60">{formatBs(totalPendienteUSD, rates.usd)}</p>
                    )}
                    <div className="mt-6 flex flex-wrap gap-3 relative z-10">
                        <div className="bg-white/10 dark:bg-black/5 px-4 py-2 rounded-2xl">
                            <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Sueldo Base</p>
                            <p className="font-black text-lg">${sueldoPendiente.toFixed(2)}</p>
                        </div>
                        {comisionesManuales > 0 && (
                            <div className="bg-white/10 dark:bg-black/5 px-4 py-2 rounded-2xl">
                                <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Comisiones</p>
                                <p className="font-black text-lg text-emerald-400 dark:text-emerald-600">${comisionesManuales.toFixed(2)}</p>
                            </div>
                        )}
                        {taskComPendiente > 0 && (
                            <div className="bg-purple-500/20 dark:bg-purple-500/10 px-4 py-2 rounded-2xl border border-purple-300/20">
                                <p className="text-[9px] uppercase tracking-widest text-purple-300 dark:text-purple-500 font-bold">Bonos Tareas</p>
                                <p className="font-black text-lg text-purple-300 dark:text-purple-600">${taskComPendiente.toFixed(2)}</p>
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="rounded-[3rem] p-8 bg-emerald-500 text-white border-none shadow-xl flex flex-col justify-center items-center text-center">
                    <CheckCircle2 size={40} className="mb-3 opacity-80" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Cobrado este mes</p>
                    <h3 className="text-4xl font-black italic">${totalPagadoEsteMes.toFixed(2)}</h3>
                    <p className="text-[9px] font-bold uppercase mt-4 opacity-70">Total de recibos liquidados</p>
                </Card>
            </div>

            {/* SECCIÓN DE TAREAS Y BONOS */}
            {myTareas.length > 0 && (
                <div className="space-y-4 pt-2">
                    <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2 px-2">
                        <ListChecks className="text-purple-500" /> Bonos y Tareas
                    </h3>

                    {/* TAREAS APROBADAS: por cobrar */}
                    {tareasAprobadas.length > 0 && (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] border border-black/5 overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-black/5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                                    <Star size={16} className="text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600">Aprobadas · Por Cobrar</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{tareasAprobadas.length} tarea(s) · Total ${taskComPendiente.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="divide-y divide-black/5">
                                {tareasAprobadas.map((t: any) => (
                                    <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-4 flex justify-between items-center gap-4">
                                        <div className="min-w-0">
                                            <p className="font-black text-sm text-slate-900 dark:text-white truncate">{t.nombreTarea || TIPO_TAREA_LABEL[t.tipoTarea] || t.tipoTarea}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                {t.detalles?.descripcion && <span>{t.detalles.descripcion} · </span>}
                                                {t.fechaAprobacion?.seconds && `Aprobada ${new Date(t.fechaAprobacion.seconds * 1000).toLocaleDateString('es-VE')}`}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-lg text-purple-600">${(t.montoComision || 0).toFixed(2)}</p>
                                            {t.porcentajeAsignado && (
                                                <p className="text-[9px] text-slate-400 font-bold">{t.porcentajeAsignado}% de ${(t.valorBaseUSD || 0).toFixed(2)}</p>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAREAS PENDIENTES DE APROBACIÓN */}
                    {tareasPendienteAprobacion.length > 0 && (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] border border-amber-100 dark:border-amber-500/20 overflow-hidden shadow-sm">
                            <div className="px-6 py-4 border-b border-amber-100 dark:border-amber-500/20 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                                    <Hourglass size={16} className="text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pendiente de Aprobación</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{tareasPendienteAprobacion.length} tarea(s) en revisión por el administrador</p>
                                </div>
                            </div>
                            <div className="divide-y divide-black/5">
                                {tareasPendienteAprobacion.map((t: any) => (
                                    <div key={t.id} className="px-6 py-4 flex justify-between items-center gap-4 opacity-70">
                                        <div className="min-w-0">
                                            <p className="font-black text-sm text-slate-900 dark:text-white truncate">{t.nombreTarea || TIPO_TAREA_LABEL[t.tipoTarea] || t.tipoTarea}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{t.detalles?.descripcion || 'Sin descripción adicional'}</p>
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-black uppercase shrink-0">En Revisión</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HISTORIAL DE TAREAS PAGADAS */}
                    {tareasPagadas.length > 0 && (
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] border border-black/5 overflow-hidden shadow-sm opacity-80">
                            <div className="px-6 py-4 border-b border-black/5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
                                    <CheckCircle2 size={16} className="text-slate-400" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bonos Cobrados (últimos {tareasPagadas.length})</p>
                            </div>
                            <div className="divide-y divide-black/5">
                                {tareasPagadas.map((t: any) => (
                                    <div key={t.id} className="px-6 py-3 flex justify-between items-center gap-4">
                                        <p className="font-bold text-sm text-slate-500 dark:text-slate-400 truncate">{t.nombreTarea || TIPO_TAREA_LABEL[t.tipoTarea] || t.tipoTarea}</p>
                                        <p className="font-black text-sm text-slate-400">${(t.montoComision || 0).toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* HISTORIAL DE RECIBOS */}
            <div className="space-y-4 pt-2">
                <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2 px-2">
                    <ReceiptText className="text-slate-400" /> Historial de Recibos
                </h3>

                <div className="grid gap-4">
                    <AnimatePresence>
                        {myPayments.length > 0 ? myPayments.map((pago: any) => (
                            <motion.div
                                key={pago.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] shadow-sm border border-black/5 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                            <TrendingUp size={20} />
                                        </div>
                                        <div>
                                            <p className="font-black uppercase tracking-widest text-slate-900 dark:text-white text-sm">Pago Recibido</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                                <Calendar size={10} /> {new Date(pago.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-1">Vía {pago.metodoPago}</p>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white italic">+ ${Number(pago.totalUSD).toFixed(2)}</p>
                                        {pago.totalVES > 0 && (
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Bs. {Number(pago.totalVES).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
                                        )}
                                    </div>
                                </div>

                                {pago.conceptos?.length > 0 && (
                                    <div className="px-6 pb-5 border-t border-black/5 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {pago.conceptos.map((c: any, i: number) => (
                                            <div key={i} className={`rounded-xl px-3 py-2 text-center ${c.tipo === 'Bono Tarea' ? 'bg-purple-50 dark:bg-purple-500/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${c.tipo === 'Bono Tarea' ? 'text-purple-500' : 'text-slate-400'}`}>{c.tipo}</p>
                                                <p className="text-[10px] font-black dark:text-white">${Number(c.monto).toFixed(2)}</p>
                                                <p className="text-[8px] text-slate-400 truncate italic">{c.motivo}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )) : (
                            <div className="text-center py-16 bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-black/5">
                                <ReceiptText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No tienes historial de pagos aún.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
