// @/components/dashboard/news-bar.tsx
"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { 
    ChevronDown, Megaphone, TrendingUp, TrendingDown, 
    AlertTriangle, Clock, Palette, Users, CheckCircle,
    Package, ChevronRight, Landmark, Receipt,
    Eye, DollarSign
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export type NewsAction = 
    | { type: 'NAVIGATE', payload: string }
    | { type: 'OPEN_ORDER', payload: any }
    | { type: 'VIEW_ORDER_DETAILS', payload: any };

interface AlertAction {
    label: string;
    action: NewsAction;
    icon?: any;
    primary?: boolean;
}

interface AlertItem {
    id: string;
    title: string;          // Usado ahora para el Nombre del Cliente (Principal)
    subtitle?: string;      // Usado para el Número de Orden
    description: string;    // Usado para Montos y Atrasos
    summary?: string;       // Usado para el desglose completo de ítems
    icon: any;
    color: string;
    action?: NewsAction;
    actions?: AlertAction[]; 
}

interface ModuleData {
    id: string;
    title: string;
    summary: string;
    icon: any;
    color: string;
    bgColor: string;
    alerts: AlertItem[];
}

interface NewsBarProps {
    rates?: { usd: number, eur: number, usdt: number };
    gastosFijos?: any[];
    empleados?: any[];
    ordenes?: any[];
    designers?: any[];
    gastos?: any[];
    onAction?: (action: NewsAction) => void; 
}

// --- VARIANTES DE ANIMACIÓN ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
}

const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30 } }
}

export function NewsBar({ 
    rates = { usd: 0, eur: 0, usdt: 0 }, 
    gastosFijos = [], 
    empleados = [], 
    ordenes = [], 
    designers = [],
    gastos = [],
    onAction
}: NewsBarProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedModule, setSelectedModule] = useState<ModuleData | null>(null);
    const [prevRates, setPrevRates] = useState<{ usd: number, eur: number, usdt: number }>({ usd: 0, eur: 0, usdt: 0 });

    useEffect(() => {
        const stored = localStorage.getItem("lastKnownRates");
        if (stored) setPrevRates(JSON.parse(stored));
    }, []);

    useEffect(() => {
        if (rates.usd > 0) localStorage.setItem("lastKnownRates", JSON.stringify(rates));
    }, [rates]);

    const modulos = useMemo(() => {
        const result: ModuleData[] = [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // 1. ALERTAS DE MONEDAS
        const alertasMoneda: AlertItem[] = [];
        const compareRate = (current: number, prev: number, label: string) => {
            if (!current || !prev) return;
            const diff = current - prev;
            if (diff > 0.05) {
                alertasMoneda.push({ id: `rate-up-${label}`, title: `${label} al alza`, description: `Subió a Bs. ${current.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' });
            } else if (diff < -0.05) {
                alertasMoneda.push({ id: `rate-down-${label}`, title: `${label} a la baja`, description: `Bajó a Bs. ${current.toFixed(2)}`, icon: TrendingDown, color: 'text-red-500 bg-red-50 dark:bg-red-500/10' });
            }
        };
        compareRate(rates.usd, prevRates.usd, "Dólar BCV");
        compareRate(rates.eur, prevRates.eur, "Euro BCV");
        compareRate(rates.usdt, prevRates.usdt, "Dólar Paralelo");
        
        if (alertasMoneda.length > 0) {
            result.push({ id: 'tasas', title: 'Cambios de Moneda', summary: `${alertasMoneda.length} actualizaciones en tasas`, icon: TrendingUp, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-500/10', alerts: alertasMoneda });
        }

        // 2. DEUDAS CRÍTICAS
        const alertasDeuda: AlertItem[] = [];
        ordenes.forEach(o => {
            if (o.estadoPago === 'ANULADO') return;
            const deuda = (Number(o.totalUSD) || 0) - (Number(o.montoPagadoUSD) || 0);
            
            if (deuda > 0.01) {
                let lastDate = new Date(o.fecha || 0);
                if (o.registroPagos && o.registroPagos.length > 0) {
                    const latestPayment = o.registroPagos.reduce((latest: Date, p: any) => {
                        const pDate = new Date(p.fecha || p.fechaRegistro || 0);
                        return pDate > latest ? pDate : latest;
                    }, new Date(0));
                    lastDate = latestPayment;
                }
                const diffDays = Math.floor((hoy.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diffDays > 15) {
                    // Resumen visual de ítems
                    const itemsSummary = o.items?.map((i: any) => `${i.cantidad}x ${i.nombre}`).join(' • ') || 'Sin ítems registrados';

                    alertasDeuda.push({ 
                        id: `critica-${o.id}`, 
                        title: o.cliente?.nombreRazonSocial || 'Cliente Desconocido', 
                        subtitle: `Orden #${o.ordenNumero}`,
                        description: `Debe $${deuda.toFixed(2)} (Atraso: ${diffDays} días)`, 
                        summary: `📦 ${itemsSummary}`,
                        icon: AlertTriangle, 
                        color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10',
                        actions: [
                            { label: 'Detalles', action: { type: 'VIEW_ORDER_DETAILS', payload: o }, icon: Eye },
                            { label: 'Facturar', action: { type: 'OPEN_ORDER', payload: o }, icon: DollarSign, primary: true }
                        ]
                    });
                }
            }
        });
        if (alertasDeuda.length > 0) {
            result.push({ id: 'deudas', title: 'Cobranza Crítica', summary: `${alertasDeuda.length} facturas con atraso severo`, icon: Receipt, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-500/10', alerts: alertasDeuda });
        }

        // 3. GASTOS FIJOS
        const alertasGasto: AlertItem[] = [];
        gastosFijos.forEach(gasto => {
            if (!gasto.proximoPago) return;
            const fechaProx = gasto.proximoPago instanceof Date ? gasto.proximoPago : (gasto.proximoPago as any).toDate?.() || new Date(gasto.proximoPago);
            fechaProx.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((fechaProx.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                alertasGasto.push({ id: `gasto-vencido-${gasto.id}`, title: gasto.nombre, subtitle: 'Servicio Vencido', description: `Atraso de ${Math.abs(diffDays)} días ($${gasto.monto})`, icon: AlertTriangle, color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', action: { type: 'NAVIGATE', payload: 'fixed_expenses' } });
            } else if (diffDays === 0) {
                alertasGasto.push({ id: `gasto-hoy-${gasto.id}`, title: gasto.nombre, subtitle: 'Vence Hoy', description: `Monto a liquidar: $${gasto.monto}`, icon: Clock, color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', action: { type: 'NAVIGATE', payload: 'fixed_expenses' } });
            } else if (diffDays <= 5) {
                alertasGasto.push({ id: `gasto-prox-${gasto.id}`, title: gasto.nombre, subtitle: `Vence en ${diffDays} días`, description: `Monto a liquidar: $${gasto.monto}`, icon: Clock, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10', action: { type: 'NAVIGATE', payload: 'fixed_expenses' } });
            }
        });
        if (alertasGasto.length > 0) {
            result.push({ id: 'gastos', title: 'Servicios Fijos', summary: `${alertasGasto.length} compromisos operativos pendientes`, icon: Landmark, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-500/10', alerts: alertasGasto });
        }

        // 4. EMPLEADOS
        const alertasEmpleado: AlertItem[] = [];
        const mesActual = hoy.toISOString().slice(0, 7);
        empleados.forEach(emp => {
            const esSemanal = emp.frecuenciaPago === 'Semanal';
            let cobrado = false;

            if (esSemanal) {
                if (emp.ultimoPagoIso) {
                    const lastP = new Date(emp.ultimoPagoIso);
                    lastP.setHours(0,0,0,0);
                    if (Math.floor((hoy.getTime() - lastP.getTime()) / 86400000) < 6) cobrado = true;
                }
            } else {
                if (emp.ultimoPagoMes === mesActual) cobrado = true;
            }

            if (!cobrado) {
                let diffDays = 0;
                let diaBase = parseInt(emp.diaPago) || 15;
                if (esSemanal) {
                    let diff = diaBase - hoy.getDay();
                    if (diff > 0) diff -= 7; 
                    diffDays = diff;
                } else {
                    const fechaPago = new Date(hoy.getFullYear(), hoy.getMonth(), diaBase);
                    fechaPago.setHours(0,0,0,0);
                    diffDays = Math.ceil((fechaPago.getTime() - hoy.getTime()) / 86400000);
                }

                const comisiones = emp.comisiones?.reduce((a:number,c:any)=>a+c.monto,0) || 0;
                const total = emp.montoSueldo + comisiones;

                if (diffDays < 0) {
                    alertasEmpleado.push({ id: `emp-atraso-${emp.id}`, title: emp.nombre, subtitle: 'Nómina Atrasada', description: `Atraso por ${Math.abs(diffDays)} días ($${total})`, icon: AlertTriangle, color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', action: { type: 'NAVIGATE', payload: 'employees_mgmt' } });
                } else if (diffDays === 0) {
                    alertasEmpleado.push({ id: `emp-hoy-${emp.id}`, title: emp.nombre, subtitle: 'Cobro Hoy', description: `Monto a liquidar: $${total}`, icon: Clock, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', action: { type: 'NAVIGATE', payload: 'employees_mgmt' } });
                } else if (diffDays <= 3 && diffDays > 0) {
                    alertasEmpleado.push({ id: `emp-prox-${emp.id}`, title: emp.nombre, subtitle: `Cobro en ${diffDays} días`, description: `Monto a liquidar: $${total}`, icon: Clock, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10', action: { type: 'NAVIGATE', payload: 'employees_mgmt' } });
                }
            }
        });
        if (alertasEmpleado.length > 0) {
            result.push({ id: 'nomina', title: 'Nómina General', summary: `${alertasEmpleado.length} pagos de personal por atender`, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-500/10', alerts: alertasEmpleado });
        }

        // 5. DISEÑO
        const alertasDiseno: AlertItem[] = [];
        ordenes.forEach(orden => {
            (orden.items || []).forEach((item: any, idx: number) => {
                const serviceType = (item.tipoServicio || "").toUpperCase();
                const isPaid = item.designPaymentStatus?.toUpperCase() === 'PAGADO' || !!item.paymentReference;
                const assigned = item.empleadoAsignado && item.empleadoAsignado !== "Sin Asignar" && item.empleadoAsignado !== "N/A";

                if ((serviceType === 'DISENO' || serviceType === 'DISEÑO') && !isPaid && assigned) {
                    const price = item.costoInterno !== undefined ? item.costoInterno : (item.precioUnitario || 0);
                    const total = price * (item.cantidad || 1);
                    alertasDiseno.push({ 
                        id: `diseno-${orden.id}-${idx}`, 
                        title: item.empleadoAsignado,
                        subtitle: `Diseño • Orden #${orden.ordenNumero}`, 
                        description: `Pendiente de liquidar: $${total.toFixed(2)}`, 
                        icon: Palette, color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10', 
                        action: { type: 'NAVIGATE', payload: 'design_production' } 
                    });
                }
            });
        });
        if (alertasDiseno.length > 0) {
            result.push({ id: 'diseno', title: 'Nómina Diseñadores', summary: `${alertasDiseno.length} liquidaciones de diseño pendientes`, icon: Palette, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-500/10', alerts: alertasDiseno });
        }

        // 6. INSUMOS RECIENTES
        const alertasInsumo: AlertItem[] = [];
        const sevenDaysAgo = new Date(hoy);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        gastos.forEach(g => {
            const cat = (g.categoria || "").toLowerCase();
            const tipo = (g.tipo || "").toUpperCase();
            if (cat !== 'gasto fijo' && cat !== 'servicios' && tipo !== 'FIJO' && tipo !== 'NOMINA' && !(g.nombre || "").toUpperCase().startsWith('[PAGO')) {
                const gDate = new Date(g.fecha || g.createdAt || 0);
                if (gDate >= sevenDaysAgo) {
                    alertasInsumo.push({
                        id: `insumo-${g.id}`,
                        title: g.nombre,
                        subtitle: `Adquisición Reciente`,
                        description: `Comprado el ${gDate.toLocaleDateString()} por $${(Number(g.montoUSD) || Number(g.monto) || 0).toFixed(2)}`,
                        icon: Package, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
                        action: { type: 'NAVIGATE', payload: 'insumos_mgmt' }
                    });
                }
            }
        });
        if (alertasInsumo.length > 0) {
            result.push({ id: 'insumos', title: 'Inventario y Compras', summary: `${alertasInsumo.length} adquisiciones recientes`, icon: Package, color: 'text-indigo-600', bgColor: 'bg-indigo-50 dark:bg-indigo-500/10', alerts: alertasInsumo });
        }

        return result.sort((a, b) => {
            if (a.id === 'deudas') return -1;
            if (b.id === 'deudas') return 1;
            return b.alerts.length - a.alerts.length;
        });

    }, [rates, prevRates, gastosFijos, empleados, ordenes, gastos]);

    const marqueeText = modulos.length > 0 
        ? modulos.map(m => `🔔 ${m.title}: ${m.summary}`).join("   •   ")
        : "✨ Asistente Gerencial: Todo al día. Sin deudas críticas ni tareas urgentes.";

    const handleActionClick = (action: NewsAction) => {
        if (onAction) onAction(action);
        if (action.type === 'NAVIGATE') {
            setSelectedModule(null);
            setIsExpanded(false);
        }
    };

    return (
        <LayoutGroup>
            <motion.div 
                layout 
                className="w-full bg-white/70 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl border border-blue-500/20 rounded-[2rem] overflow-hidden mb-6 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
            >
                <motion.div 
                    layout
                    className="flex items-center px-6 py-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <motion.div layout className="bg-blue-600/10 dark:bg-blue-500/20 p-2.5 rounded-2xl mr-4 shrink-0 group-hover:scale-110 transition-transform">
                        <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </motion.div>

                    <div className="flex-1 overflow-hidden whitespace-nowrap relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
                        <motion.div 
                            className={cn("inline-block text-sm font-bold tracking-wide", modulos.some(m => m.id === 'deudas') ? "text-rose-600 dark:text-rose-400" : modulos.length > 0 ? "text-slate-700 dark:text-slate-300" : "text-emerald-600 dark:text-emerald-400")}
                            animate={{ x: ["100%", "-100%"] }}
                            transition={{ repeat: Infinity, ease: "linear", duration: modulos.length > 0 ? 45 : 15 }}
                        >
                            {marqueeText}
                        </motion.div>
                    </div>

                    <motion.div layout className="flex items-center gap-3 pl-4 shrink-0">
                        <AnimatePresence>
                            {modulos.length > 0 && (
                                <motion.span 
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md"
                                >
                                    {modulos.reduce((acc, m) => acc + m.alerts.length, 0)} Alertas
                                </motion.span>
                            )}
                        </AnimatePresence>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                        </motion.div>
                    </motion.div>
                </motion.div>

                {/* RESUMEN POR MÓDULOS */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: "auto", opacity: 1 }} 
                            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
                            className="border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 overflow-hidden"
                        >
                            <div className="px-6 py-6">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-5 tracking-[0.2em]">Panel de Control Inteligente</h4>
                                
                                {modulos.length > 0 ? (
                                    <motion.div 
                                        variants={containerVariants} 
                                        initial="hidden" 
                                        animate="visible" 
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                                    >
                                        {modulos.map((modulo) => {
                                            const ModuleIcon = modulo.icon;
                                            return (
                                                <motion.div 
                                                    variants={itemVariants}
                                                    whileHover={{ scale: 1.02, y: -2 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    key={modulo.id} 
                                                    onClick={() => setSelectedModule(modulo)}
                                                    className="group cursor-pointer flex flex-col justify-center bg-white dark:bg-slate-900/80 p-5 rounded-[1.5rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-blue-200/50 transition-all"
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className={cn("p-2.5 rounded-xl shadow-inner", modulo.bgColor, modulo.color)}>
                                                            <ModuleIcon className="w-5 h-5" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{modulo.alerts.length}</span>
                                                    </div>
                                                    <h5 className="font-black text-sm uppercase text-slate-800 dark:text-slate-200 mb-1">{modulo.title}</h5>
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">{modulo.summary}</p>
                                                </motion.div>
                                            )
                                        })}
                                    </motion.div>
                                ) : (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center flex-col gap-3 py-10 opacity-60">
                                        <CheckCircle className="w-12 h-12 text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Todo el ecosistema está al día.</span>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* MODAL DETALLADO DEL MÓDULO SELECCIONADO (MÁS ANCHO Y DISEÑO LIMPIO) */}
            <Dialog open={!!selectedModule} onOpenChange={(open) => !open && setSelectedModule(null)}>
                <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl bg-slate-50 dark:bg-[#121212] rounded-[2rem] border-0 p-0 shadow-2xl flex flex-col h-[85vh] overflow-hidden">
                    <AnimatePresence mode="wait">
                        {selectedModule && (
                            <motion.div
                                key={selectedModule.id}
                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="flex flex-col h-full w-full"
                            >
                                <DialogHeader className="p-6 pb-5 shrink-0 border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#1c1c1e] z-10 relative overflow-hidden">
                                    <div className={cn("absolute inset-0 opacity-10 blur-3xl", selectedModule.bgColor)} />
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0", selectedModule.bgColor, selectedModule.color)}>
                                                <selectedModule.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-2xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white leading-none">{selectedModule.title}</DialogTitle>
                                                <DialogDescription className="text-xs font-bold uppercase tracking-widest mt-1.5 opacity-80">
                                                    {selectedModule.alerts.length} Elementos en revisión
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </div>
                                </DialogHeader>

                                {/* CONTENEDOR CON SCROLL */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-slate-50/50 dark:bg-black/10">
                                    <motion.div 
                                        variants={containerVariants} 
                                        initial="hidden" 
                                        animate="visible" 
                                        className="space-y-4"
                                    >
                                        {selectedModule.alerts.map(alert => {
                                            const AlertIcon = alert.icon;
                                            const isClickableRow = !!alert.action && !alert.actions;

                                            return (
                                                <motion.div 
                                                    variants={itemVariants}
                                                    key={alert.id}
                                                    onClick={() => isClickableRow && handleActionClick(alert.action!)}
                                                    className={cn(
                                                        "group flex flex-col md:flex-row md:items-center justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] shadow-sm transition-all gap-4",
                                                        isClickableRow && "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md"
                                                    )}
                                                >
                                                    {/* LADO IZQUIERDO: ICONO Y TEXTOS */}
                                                    <div className="flex items-start gap-4 flex-1 w-full min-w-0">
                                                        <div className={cn("shrink-0 p-3 rounded-xl", alert.color)}>
                                                            <AlertIcon className="w-5 h-5" />
                                                        </div>
                                                        
                                                        {/* CONTENEDOR DE TEXTO (Asegura el truncado sin romper el Flexbox) */}
                                                        <div className="flex flex-col w-full min-w-0 pr-2">
                                                            {/* NOMBRE DEL CLIENTE GRANDE (Y Truncado si es súper largo) */}
                                                            <h6 className="font-black text-lg md:text-xl text-slate-900 dark:text-white uppercase leading-tight truncate">
                                                                {alert.title}
                                                            </h6>
                                                            
                                                            {/* SUBTÍTULO (Orden y Deuda inline) */}
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                                                {alert.subtitle && (
                                                                    <span className="text-[11px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                                        {alert.subtitle}
                                                                    </span>
                                                                )}
                                                                {alert.subtitle && <span className="text-slate-300 dark:text-slate-700">•</span>}
                                                                <span className="text-[11px] md:text-xs font-bold text-rose-500">
                                                                    {alert.description}
                                                                </span>
                                                            </div>

                                                            {/* RESUMEN DE ÍTEMS (Cajita gris debajo) */}
                                                            {alert.summary && (
                                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 w-fit line-clamp-2 max-w-full">
                                                                    {alert.summary}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* LADO DERECHO: BOTONES */}
                                                    {alert.actions && alert.actions.length > 0 && (
                                                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center mt-2 md:mt-0">
                                                            {alert.actions.map((act, idx) => {
                                                                const ActIcon = act.icon;
                                                                return (
                                                                    <button 
                                                                        key={idx}
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            handleActionClick(act.action); 
                                                                        }}
                                                                        className={cn(
                                                                            "flex items-center justify-center gap-2 px-5 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                                                            act.primary 
                                                                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20" 
                                                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                                                        )}
                                                                    >
                                                                        {ActIcon && <ActIcon className="w-3.5 h-3.5" />}
                                                                        {act.label}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Flecha simple si es fila navegable (Ej. Nómina) */}
                                                    {isClickableRow && (
                                                        <div className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors self-end md:self-center">
                                                            <ChevronRight className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )
                                        })}
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </DialogContent>
            </Dialog>
        </LayoutGroup>
    )
}