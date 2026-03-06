// @/components/dashboard/news-bar.tsx
"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { 
    ChevronDown, Megaphone, TrendingUp, TrendingDown, 
    AlertTriangle, Clock, Palette, Users, CheckCircle,
    Package, ChevronRight, Landmark, Receipt
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export type NewsAction = 
    | { type: 'NAVIGATE', payload: string }
    | { type: 'OPEN_ORDER', payload: any };

interface NewsBarProps {
    rates?: { usd: number, eur: number, usdt: number };
    gastosFijos?: any[];
    empleados?: any[];
    ordenes?: any[];
    designers?: any[];
    gastos?: any[];
    onAction?: (action: NewsAction) => void; 
}

interface AlertItem {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string;
    action?: NewsAction;
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

// --- VARIANTES DE ANIMACIÓN ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
}

const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
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
                alertasMoneda.push({ id: `rate-up-${label}`, title: `${label} al alza`, description: `Subió a Bs. ${current.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-500' });
            } else if (diff < -0.05) {
                alertasMoneda.push({ id: `rate-down-${label}`, title: `${label} a la baja`, description: `Bajó a Bs. ${current.toFixed(2)}`, icon: TrendingDown, color: 'text-red-500' });
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
                    alertasDeuda.push({ 
                        id: `critica-${o.id}`, 
                        title: `Orden #${o.ordenNumero} - ${o.cliente?.nombreRazonSocial || 'S/N'}`, 
                        description: `Debe $${deuda.toFixed(2)} (Atraso: ${diffDays} días)`, 
                        icon: AlertTriangle, color: 'text-rose-600',
                        action: { type: 'OPEN_ORDER', payload: o } 
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
                alertasGasto.push({ id: `gasto-vencido-${gasto.id}`, title: `Vencido: ${gasto.nombre}`, description: `Atraso de ${Math.abs(diffDays)} días ($${gasto.monto})`, icon: AlertTriangle, color: 'text-rose-600', action: { type: 'NAVIGATE', payload: 'fixed_expenses' } });
            } else if (diffDays === 0) {
                alertasGasto.push({ id: `gasto-hoy-${gasto.id}`, title: `Vence Hoy: ${gasto.nombre}`, description: `Monto a liquidar: $${gasto.monto}`, icon: Clock, color: 'text-orange-500', action: { type: 'NAVIGATE', payload: 'fixed_expenses' } });
            } else if (diffDays <= 5) {
                alertasGasto.push({ id: `gasto-prox-${gasto.id}`, title: `Próximo: ${gasto.nombre}`, description: `Vence en ${diffDays} días ($${gasto.monto})`, icon: Clock, color: 'text-blue-500', action: { type: 'NAVIGATE', payload: 'fixed_expenses' } });
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
                    alertasEmpleado.push({ id: `emp-atraso-${emp.id}`, title: `Atraso: ${emp.nombre}`, description: `Nómina atrasada por ${Math.abs(diffDays)} días ($${total})`, icon: AlertTriangle, color: 'text-rose-600', action: { type: 'NAVIGATE', payload: 'employees_mgmt' } });
                } else if (diffDays === 0) {
                    alertasEmpleado.push({ id: `emp-hoy-${emp.id}`, title: `Cobro Hoy: ${emp.nombre}`, description: `Monto a liquidar: $${total}`, icon: Clock, color: 'text-emerald-600', action: { type: 'NAVIGATE', payload: 'employees_mgmt' } });
                } else if (diffDays <= 3 && diffDays > 0) {
                    alertasEmpleado.push({ id: `emp-prox-${emp.id}`, title: `Próximo: ${emp.nombre}`, description: `Cobra en ${diffDays} días ($${total})`, icon: Clock, color: 'text-blue-500', action: { type: 'NAVIGATE', payload: 'employees_mgmt' } });
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
                        title: `Diseño - Orden #${orden.ordenNumero}`, 
                        description: `${item.empleadoAsignado} tiene pendiente cobrar $${total.toFixed(2)}`, 
                        icon: Palette, color: 'text-purple-600', 
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
                        title: `Adquisición: ${g.nombre}`,
                        description: `Comprado el ${gDate.toLocaleDateString()} por $${(Number(g.montoUSD) || Number(g.monto) || 0).toFixed(2)}`,
                        icon: Package, color: 'text-indigo-600',
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
        setSelectedModule(null);
        setIsExpanded(false);
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

            {/* MODAL DETALLADO DEL MÓDULO SELECCIONADO */}
            <Dialog open={!!selectedModule} onOpenChange={(open) => !open && setSelectedModule(null)}>
                <DialogContent className="max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border-0 p-0 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <AnimatePresence mode="wait">
                        {selectedModule && (
                            <motion.div
                                key={selectedModule.id}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="flex flex-col h-full"
                            >
                                <DialogHeader className="p-8 pb-6 shrink-0 border-b border-black/5 dark:border-white/5 relative overflow-hidden">
                                    <div className={cn("absolute inset-0 opacity-10 blur-2xl", selectedModule.bgColor)} />
                                    <div className="flex items-center gap-5 relative z-10">
                                        <div className={cn("w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-lg", selectedModule.bgColor, selectedModule.color)}>
                                            <selectedModule.icon className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">{selectedModule.title}</DialogTitle>
                                            <DialogDescription className="text-xs font-bold uppercase tracking-widest mt-1 opacity-80">
                                                {selectedModule.alerts.length} Elementos en revisión
                                            </DialogDescription>
                                        </div>
                                    </div>
                                </DialogHeader>

                                <ScrollArea className="flex-1 p-6 md:p-8 bg-slate-50/50 dark:bg-black/10">
                                    <motion.div 
                                        variants={containerVariants} 
                                        initial="hidden" 
                                        animate="visible" 
                                        className="space-y-3"
                                    >
                                        {selectedModule.alerts.map(alert => {
                                            const AlertIcon = alert.icon;
                                            const isClickable = !!alert.action;

                                            return (
                                                <motion.div 
                                                    variants={itemVariants}
                                                    key={alert.id}
                                                    onClick={() => isClickable && handleActionClick(alert.action!)}
                                                    className={cn(
                                                        "group flex items-center justify-between p-5 bg-white dark:bg-slate-900/80 border border-black/5 dark:border-white/5 rounded-[1.5rem] shadow-sm transition-all duration-300",
                                                        isClickable && "cursor-pointer hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-1"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={cn("shrink-0 p-2.5 rounded-xl bg-slate-50 dark:bg-black/40", alert.color)}>
                                                            <AlertIcon className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h6 className="font-bold text-sm text-slate-900 dark:text-white truncate">{alert.title}</h6>
                                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">{alert.description}</p>
                                                        </div>
                                                    </div>

                                                    {isClickable && (
                                                        <div className="shrink-0 ml-4 p-2 bg-slate-50 dark:bg-white/5 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-all transform group-hover:translate-x-1">
                                                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )
                                        })}
                                    </motion.div>
                                </ScrollArea>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </DialogContent>
            </Dialog>
        </LayoutGroup>
    )
}