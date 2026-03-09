// @/components/dashboard/EmployeeFinancesView.tsx
"use client"

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Calendar, Clock, ReceiptText, AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { formatBs } from "@/lib/services/bcv-service";
import { Badge } from "@/components/ui/badge";

export function EmployeeFinancesView({ empleados, pagos, currentUserId, rates }: any) {
    
    // 1. Encontrar el perfil de nómina vinculado a este usuario
    const myProfile = useMemo(() => {
        return empleados.find((e: any) => e.usuarioId === currentUserId);
    }, [empleados, currentUserId]);

    // 2. Encontrar todos los pagos realizados a este usuario
    // Mejoramos el filtro para que use tanto el ID vinculado como el nombre si el ID falta en registros viejos
    const myPayments = useMemo(() => {
        if (!myProfile) return [];
        return pagos
            .filter((p: any) => p.usuarioId === currentUserId || p.empleadoId === myProfile.id)
            .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [pagos, currentUserId, myProfile]);

    // 3. Calcular el total pagado este mes
    const totalPagadoEsteMes = useMemo(() => {
        const mesActual = new Date().toISOString().slice(0, 7);
        return myPayments
            .filter((p: any) => (p.mesRelativo === mesActual) || (p.fecha && p.fecha.startsWith(mesActual)))
            .reduce((sum: number, p: any) => sum + (Number(p.totalUSD) || 0), 0);
    }, [myPayments]);

    // Pantalla de error si el Admin aún no lo ha vinculado
    if (!myProfile) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] opacity-50 text-center px-4">
                <AlertCircle className="w-24 h-24 mb-6 text-slate-400" />
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Cuenta No Vinculada</h2>
                <p className="font-bold text-slate-500 mt-2 max-w-md">
                    Tu usuario aún no ha sido enlazado a un perfil de nómina. Por favor, solicita al administrador que vincule tu cuenta en la Gestión de Personal.
                </p>
            </div>
        );
    }

    // 4. Calcular el saldo pendiente por cobrar
    const mesActualStr = new Date().toISOString().slice(0, 7);
    const esSemanal = myProfile.frecuenciaPago === 'Semanal';
    const comisiones = myProfile.comisiones?.reduce((a:any, c:any) => a + c.monto, 0) || 0;
    
    let sueldoPendiente = myProfile.montoSueldo;
    if (esSemanal) {
        if (myProfile.ultimoPagoIso) {
            const diffDays = Math.floor((new Date().getTime() - new Date(myProfile.ultimoPagoIso).getTime()) / 86400000);
            if (diffDays < 6) sueldoPendiente = 0; 
        }
    } else {
        if (myProfile.ultimoPagoMes === mesActualStr) sueldoPendiente = 0; 
    }

    const totalPendienteUSD = sueldoPendiente + comisiones;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            
            <div className="flex items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-black shadow-lg shadow-emerald-500/20 shrink-0">
                    <Wallet size={32} />
                </div>
                <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        Mis Finanzas
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
                        Resumen de Pagos y Comisiones
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Saldo Pendiente */}
                <Card className="md:col-span-2 rounded-[3rem] p-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-none shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10"><Clock size={120} /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 relative z-10">Saldo Pendiente por Cobrar</p>
                    <h3 className="text-6xl font-black tracking-tighter italic relative z-10">${totalPendienteUSD.toLocaleString()}</h3>
                    
                    <div className="mt-6 flex gap-4 relative z-10">
                        <div className="bg-white/10 dark:bg-black/5 px-4 py-2 rounded-2xl">
                            <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Base</p>
                            <p className="font-black text-lg">${sueldoPendiente}</p>
                        </div>
                        <div className="bg-white/10 dark:bg-black/5 px-4 py-2 rounded-2xl">
                            <p className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Comisiones</p>
                            <p className="font-black text-lg text-emerald-400 dark:text-emerald-600">${comisiones}</p>
                        </div>
                    </div>
                </Card>

                {/* Pagado este mes */}
                <Card className="rounded-[3rem] p-8 bg-emerald-500 text-white border-none shadow-xl flex flex-col justify-center items-center text-center">
                    <CheckCircle2 size={40} className="mb-3 opacity-80" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Pagado este mes</p>
                    <h3 className="text-4xl font-black italic">${totalPagadoEsteMes.toLocaleString()}</h3>
                    <p className="text-[9px] font-bold uppercase mt-4 opacity-70">Total de recibos liquidados</p>
                </Card>
            </div>

            <div className="space-y-4 pt-6">
                <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2 px-2">
                    <ReceiptText className="text-slate-400" /> Historial de Recibos
                </h3>
                
                <div className="grid gap-4">
                    {myPayments.length > 0 ? myPayments.map((pago: any) => (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={pago.id} className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-6 shadow-sm border border-black/5 flex flex-col sm:flex-row justify-between items-center gap-6 hover:shadow-md transition-shadow">
                            
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="font-black uppercase tracking-widest text-slate-900 dark:text-white text-sm">Pago Recibido</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                        <Calendar size={10}/> {new Date(pago.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:items-end w-full sm:w-auto bg-slate-50 dark:bg-white/5 p-4 rounded-2xl sm:bg-transparent sm:p-0 sm:border-none border border-black/5">
                                <p className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white italic">
                                    + ${Number(pago.totalUSD).toFixed(2)}
                                </p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mt-1">
                                    Vía {pago.metodoPago}
                                </p>
                            </div>
                        </motion.div>
                    )) : (
                        <div className="text-center py-16 bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-black/5">
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No tienes historial de pagos aún.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    )
}