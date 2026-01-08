// @/components/dashboard/ClientsAndPaymentsView.tsx
"use client"

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type OrdenServicio, EstadoPago } from '@/lib/types/orden'
import { formatCurrency, formatBsCurrency } from '@/lib/utils/order-utils' 
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
    Wallet, Search, Filter, ArrowUpRight, 
    CheckCircle2, ChevronDown, ChevronUp, DollarSign, 
    CalendarClock, Activity, AlertCircle, Sparkles
} from 'lucide-react'

import { PaymentHistoryView } from '@/components/orden/PaymentHistoryView' 
import { PaymentEditModal } from '@/components/dashboard/PaymentEditModal'
import { cn } from '@/lib/utils'

interface ClientSummary {
    key: string
    nombre: string
    rif: string
    totalOrdenes: number
    totalPendienteUSD: number
    ordenesPendientes: OrdenServicio[]
}

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, staggerChildren: 0.1 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
}

export function ClientsAndPaymentsView({ ordenes, currentUserId, bcvRate, onRegisterPayment }: any) {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<'ALL' | EstadoPago>('ALL')
    const [currentPage, setCurrentPage] = useState(1)
    const [expandedOrdenId, setExpandedOrdenId] = useState<string | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [selectedOrdenForPayment, setSelectedOrdenForPayment] = useState<OrdenServicio | null>(null)

    const { clientSummaries, pagadasCompletamente, totalPendienteGlobal } = useMemo(() => {
        const summaryMap = new Map<string, ClientSummary>()
        let totalPendienteGlobal = 0;
        const lowerCaseSearch = searchTerm.toLowerCase();

        const pagadas = ordenes
            .filter((o: any) => {
                const esPagada = (o.estadoPago === EstadoPago.PAGADO) || (o.totalUSD - (o.montoPagadoUSD || 0) <= 0.01);
                const coincideBusqueda = !searchTerm || 
                    o.cliente.nombreRazonSocial.toLowerCase().includes(lowerCaseSearch) ||
                    (o.ordenNumero || '').toString().includes(lowerCaseSearch);
                return esPagada && coincideBusqueda && o.estadoPago !== EstadoPago.ANULADO;
            })
            .sort((a: any, b: any) => {
                const dateA = a.updatedAt || a.fecha || 0;
                const dateB = b.updatedAt || b.fecha || 0;
                return new Date(dateB as any).getTime() - new Date(dateA as any).getTime();
            });

        ordenes.forEach((orden: any) => {
            const estadoSeguro = orden.estadoPago ?? EstadoPago.PENDIENTE;
            const montoPagado = orden.montoPagadoUSD || 0;
            const pendiente = orden.totalUSD - montoPagado;
            const coincideEstado = filterStatus === 'ALL' || estadoSeguro === filterStatus;
            const coincideBusqueda = !searchTerm || 
                orden.cliente.nombreRazonSocial.toLowerCase().includes(lowerCaseSearch) ||
                (orden.ordenNumero || '').toString().includes(lowerCaseSearch);

            if (!coincideBusqueda || orden.estadoPago === EstadoPago.ANULADO) return;
            if (pendiente > 0.01) totalPendienteGlobal += pendiente;

            if (pendiente > 0.01 && coincideEstado) {
                const key = orden.cliente.rifCedula.trim().toUpperCase() || orden.cliente.nombreRazonSocial.trim().toUpperCase();
                if (!summaryMap.has(key)) {
                    summaryMap.set(key, {
                        key, nombre: orden.cliente.nombreRazonSocial, rif: orden.cliente.rifCedula,
                        totalOrdenes: 0, totalPendienteUSD: 0, ordenesPendientes: []
                    });
                }
                const s = summaryMap.get(key)!;
                s.totalPendienteUSD += pendiente;
                s.totalOrdenes += orden.totalUSD;
                s.ordenesPendientes.push(orden);
            }
        });

        return { 
            clientSummaries: Array.from(summaryMap.values()).sort((a, b) => b.totalPendienteUSD - a.totalPendienteUSD), 
            pagadasCompletamente: pagadas, 
            totalPendienteGlobal 
        };
    }, [ordenes, searchTerm, filterStatus]);

    const totalBs = formatBsCurrency(totalPendienteGlobal, bcvRate);

    return (
        <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-10 p-2 font-sans selection:bg-blue-100"
        >
            {/* Header Pro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white flex items-center gap-3">
                        <Wallet className="w-10 h-10 text-blue-600 drop-shadow-lg"/> Cobranzas <span className="text-blue-600">Pro</span>
                    </h2>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Gestión de flujo y liquidez</p>
                </div>
                
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl p-2 rounded-[2rem] border border-white/20 shadow-2xl flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                        <Input
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-6 w-full md:w-[300px] bg-white dark:bg-slate-900 border-0 rounded-[1.5rem] shadow-inner focus-visible:ring-blue-500/30"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                        <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900 border-0 rounded-[1.5rem] py-6 shadow-inner font-bold uppercase text-[10px] tracking-widest">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-0 shadow-2xl uppercase text-[10px] font-bold">
                            <SelectItem value="ALL">Deudores</SelectItem>
                            <SelectItem value={EstadoPago.PENDIENTE}>Pendientes</SelectItem>
                            <SelectItem value={EstadoPago.ABONADO}>Abonados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* KPI Island */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div variants={itemVariants} className="md:col-span-1">
                    <Card className="rounded-[3rem] border-0 bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-2xl shadow-rose-500/30 overflow-hidden relative">
                        <Activity className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12" />
                        <CardContent className="p-8 space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Cuentas por cobrar</p>
                            <div>
                                <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(totalPendienteGlobal)}</h3>
                                <p className="text-xs font-bold opacity-80 mt-2">≈ {totalBs}</p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants} className="md:col-span-2">
                    <Card className="rounded-[3rem] border-0 bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl shadow-2xl shadow-indigo-500/10 flex items-center p-8">
                        <div className="grid grid-cols-2 w-full gap-8">
                            <div className="border-r border-slate-200/50 dark:border-white/10 pr-8">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Órdenes Activas</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{clientSummaries.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Liquidez Proyectada</p>
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-blue-500" />
                                    <p className="text-3xl font-black text-blue-600 tracking-tighter">Healthy</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* Deudores Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 ml-2">
                    <div className="p-2 bg-rose-100 dark:bg-rose-500/20 rounded-xl text-rose-600">
                        <CalendarClock className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black tracking-tight uppercase italic">Cartera Pendiente</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <AnimatePresence mode="popLayout">
                        {clientSummaries.slice((currentPage-1)*5, currentPage*5).map((summary) => (
                            <motion.div
                                key={summary.key}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="group"
                            >
                                <Card className="rounded-[2.5rem] border-0 bg-white dark:bg-slate-900 shadow-xl group-hover:shadow-2xl transition-all duration-500 overflow-hidden">
                                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center gap-6 border-b border-slate-50 dark:border-white/5">
                                        <div className="flex items-center gap-6">
                                            <div className="h-16 w-16 rounded-[1.5rem] bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-white font-black text-2xl shadow-inner">
                                                {summary.nombre.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 uppercase italic">{summary.nombre}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{summary.rif}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Deuda Total</p>
                                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(summary.totalPendienteUSD)}</p>
                                        </div>
                                    </div>
                                    <Table>
                                        <TableBody>
                                            {summary.ordenesPendientes.map((orden) => (
                                                <TableRow key={orden.id} className="border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <TableCell className="pl-10 font-black text-slate-400 text-xs">ORDEN #{orden.ordenNumero || 'S/N'}</TableCell>
                                                    <TableCell className="text-right font-black text-rose-600 text-lg tracking-tight">
                                                        {formatCurrency(orden.totalUSD - (orden.montoPagadoUSD || 0))}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={cn(
                                                            "rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-widest border-0",
                                                            orden.estadoPago === EstadoPago.ABONADO ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                                                        )}>
                                                            {orden.estadoPago}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pr-10 text-right">
                                                        <Button 
                                                            onClick={() => { setSelectedOrdenForPayment(orden); setIsPaymentModalOpen(true); }}
                                                            className="bg-slate-900 dark:bg-white dark:text-black rounded-2xl hover:scale-105 transition-transform font-bold px-6 text-xs uppercase italic tracking-widest"
                                                        >
                                                            <DollarSign className="w-3 h-3 mr-2"/> Liquidar
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* History Section */}
            <div className="pt-10 space-y-6 pb-20">
                <div className="flex items-center gap-4 ml-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black tracking-tight uppercase italic">Historial Pro</h3>
                </div>

                <Card className="rounded-[3rem] border-0 bg-white/40 dark:bg-slate-900/20 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-100/50 dark:bg-white/5">
                            <TableRow className="border-0">
                                <TableHead className="pl-10 uppercase text-[10px] font-black text-slate-400 py-6">N° Orden</TableHead>
                                <TableHead className="uppercase text-[10px] font-black text-slate-400 py-6">Cliente</TableHead>
                                <TableHead className="text-right uppercase text-[10px] font-black text-slate-400 py-6">Inversión Total</TableHead>
                                <TableHead className="text-center uppercase text-[10px] font-black text-slate-400 py-6">Estado</TableHead>
                                <TableHead className="text-center uppercase text-[10px] font-black text-slate-400 py-6 pr-10">Detalles</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <AnimatePresence>
                                {pagadasCompletamente.slice(0, 10).map((orden: any) => (
                                    <React.Fragment key={orden.id}>
                                        <TableRow className="border-b border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-white/5 transition-all">
                                            <TableCell className="pl-10 font-black text-slate-900 dark:text-white text-xs">#{orden.ordenNumero || 'NaN'}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 dark:text-white tracking-tight italic uppercase text-xs">{orden.cliente.nombreRazonSocial}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{orden.cliente.rifCedula}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-emerald-600 text-lg tracking-tighter">
                                                {formatCurrency(orden.totalUSD)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 px-4 py-2 rounded-full w-fit mx-auto">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Liquidada</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center pr-10">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => setExpandedOrdenId(expandedOrdenId === orden.id ? null : orden.id)}
                                                    className="rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-transform group-hover:scale-110"
                                                >
                                                    {expandedOrdenId === orden.id ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                        <AnimatePresence>
                                            {expandedOrdenId === orden.id && (
                                                <TableRow className="bg-slate-50/50 dark:bg-white/5">
                                                    <TableCell colSpan={5} className="p-10">
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                        >
                                                            <PaymentHistoryView historial={orden.registroPagos || []} totalOrdenUSD={orden.totalUSD} montoPagadoUSD={orden.montoPagadoUSD || 0} />
                                                        </motion.div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                ))}
                            </AnimatePresence>
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {selectedOrdenForPayment && (
                <PaymentEditModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => { setIsPaymentModalOpen(false); setSelectedOrdenForPayment(null); }}
                    orden={selectedOrdenForPayment}
                    onSave={async (a, n, i) => { await onRegisterPayment(selectedOrdenForPayment.id, a, n, i); setIsPaymentModalOpen(false); }} 
                    currentUserId={currentUserId}
                />
            )}
        </motion.div>
    )
}