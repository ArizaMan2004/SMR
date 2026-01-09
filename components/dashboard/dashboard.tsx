// @/components/orden/dashboard.tsx
"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"

// --- IMPORTACIONES PARA FIREBASE ---
import { db } from "@/lib/firebase"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"

// UI - Shadcn
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Componentes SMR/Siskoven
import Sidebar from "@/components/dashboard/sidebar"
import { OrdersTable } from "@/components/orden/orders-table"
import { ClientsAndPaymentsView } from "@/components/dashboard/ClientsAndPaymentsView"
import { NotificationCenter, type Notification } from "@/components/dashboard/NotificationCenter"
import { OrderFormWizardV2 } from "@/components/orden/order-form-wizard"
import { DesignerPayrollView } from "@/components/dashboard/DesignerPayrollView" 
// CORRECCIÓN: Se eliminó AccountsPayableView
import TasksView from "@/components/dashboard/tasks-view"
import BudgetEntryView from "@/components/dashboard/BudgetEntryView" 
import CalculatorView from "@/components/dashboard/CalculatorView" 
import { CurrencyToast } from "@/components/dashboard/CurrencyToast" 

// Componentes Administrativos
import { GastosFijosView } from "@/components/dashboard/gastos-fijos-view"
import { InsumosView } from "@/components/dashboard/InsumosView"
import { EmpleadosView } from "@/components/dashboard/empleados-view"
import { EstadisticasDashboard } from "@/components/dashboard/estadisticas-dashboard"
import { NotificationCenterExpenses, type NotificationGasto } from "@/components/dashboard/notification-center-expenses"

// Iconos
import { 
    Plus, Users, CheckCircle, Calculator, Palette, Search, 
    LayoutDashboard, FileSpreadsheet, Clock, Zap, Hammer, 
    DollarSign, Menu, Building2, Bell, TrendingUp, Euro, 
    Coins, CheckCircle2, MessageSquareText, Trash2, MailOpen, 
    ChevronRight, ChevronLeft, Filter, ChevronDown, X, Briefcase, BarChart3, Package
} from "lucide-react" 

// Servicios
import { type OrdenServicio } from "@/lib/types/orden"
import { subscribeToOrdenes, deleteOrden, updateOrdenStatus, createOrden, actualizarOrden } from "@/lib/services/ordenes-service"
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"
import { 
    createGasto, 
    subscribeToGastos, 
    subscribeToGastosFijos, 
    subscribeToEmpleados,
    subscribeToPagos,
    deleteGastoInsumo,
    createNotification,
    subscribeToNotifications,
    deleteNotification,
    updateNotificationStatus
} from "@/lib/services/gastos-service"
import { fetchBCVRateFromAPI, getBCVRateFromStorage } from "@/lib/services/bcv-service"
import { 
    getLogoBase64, setLogoBase64, 
    getFirmaBase64, setFirmaBase64, 
    getSelloBase64, setSelloBase64 
} from "@/lib/logo-service" 
import { cn } from "@/lib/utils"

// Tipos adicionales
import type { GastoFijo, Empleado, PagoEmpleado } from "@/lib/types/gastos"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };

type ActiveView = string; 

export default function Dashboard() {
    const { user, logout } = useAuth()
    const currentUserId = user?.uid

    // --- 1. ESTADOS DE UI ---
    const [activeView, setActiveView] = useState<ActiveView>("orders") 
    const [isSidebarOpen, setIsSidebarOpen] = useState(true) 
    const [searchTerm, setSearchTerm] = useState("") 
    const [notiSearch, setNotiSearch] = useState("") 
    const [notiFilter, setNotiFilter] = useState<"all" | "info" | "success" | "warning">("all")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [editingOrder, setEditingOrder] = useState<OrdenServicio | null>(null)
    
    // NOTIFICACIONES Y PANELES
    const [isNotiOpen, setIsNotiOpen] = useState(false)
    const [isExpenseNotiOpen, setIsExpenseNotiOpen] = useState(false)
    const [hasUnseenNotifications, setHasUnseenNotifications] = useState(false)
    const [showRateToast, setShowRateToast] = useState(false)
    const [rateToastMessage, setRateToastMessage] = useState("")

    // --- 2. ESTADOS DE DATOS ---
    const [currentBcvRate, setCurrentBcvRate] = useState<number>(0)
    const [eurRate, setEurRate] = useState<number>(0)
    const [parallelRate, setParallelRate] = useState<number>(0)
    const [assets, setAssets] = useState({ logo: "", firma: "", sello: "" })
    
    const [systemEvents, setSystemEvents] = useState<Notification[]>([])
    const [expenseEvents, setExpenseEvents] = useState<NotificationGasto[]>([])
    
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [designers, setDesigners] = useState<Designer[]>([]) 
    const [gastos, setGastos] = useState<any[]>([])
    const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [pagos, setPagos] = useState<PagoEmpleado[]>([]) 

    // --- 3. NAV ITEMS (AJUSTADO) ---
    const navItems = useMemo(() => [
        { id: 'orders', label: 'Facturación', icon: <LayoutDashboard className="w-4 h-4" /> }, 
        { 
            id: 'tasks_group', 
            label: 'Producción', 
            icon: <CheckCircle className="w-4 h-4" />,
            children: [
                { id: 'tasks_AVISO_CORPOREO', label: 'Producción' },
                { id: 'tasks_DISENO', label: 'Diseño' },
                { id: 'tasks_IMPRESION', label: 'Impresión' },
                { id: 'tasks_CORTE_LASER', label: 'Corte Láser' },
                { id: 'tasks_ROTULACION', label: 'Rotulación' },
                { id: 'tasks_INSTALACION', label: 'Instalación' },
            ]
        },
        {
            id: 'admin_group',
            label: 'Administración',
            icon: <Building2 className="w-4 h-4" />,
            children: [
                { id: 'financial_stats', label: 'Balance y Estadísticas' },
                { id: 'clients', label: 'Cobranza' }, // Movido desde Cuentas
                { id: 'design_production', label: 'Pago Diseños' }, // Renombrado y movido aquí
                { id: 'fixed_expenses', label: 'Gastos Fijos' },
                { id: 'insumos_mgmt', label: 'Insumos y Materiales' },
                { id: 'employees_mgmt', label: 'Gestión de Personal' },

            ]
        },
        {
            id: 'tools_group',
            label: 'Herramientas',
            icon: <Calculator className="w-4 h-4" />,
            children: [
                { id: 'calculator', label: 'Presupuestos' },
                { id: 'old_calculator', label: 'Calculadora de Producción' }, 
            ]
        },
    ], []);

    // --- 4. MANEJADORES ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'firma' | 'sello') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            if (type === 'logo') await setLogoBase64(base64);
            if (type === 'firma') await setFirmaBase64(base64);
            if (type === 'sello') await setSelloBase64(base64);
            setAssets(prev => ({ ...prev, [type]: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleClearAsset = async (type: 'logo' | 'firma' | 'sello') => {
        if (type === 'logo') await setLogoBase64("");
        if (type === 'firma') await setFirmaBase64("");
        if (type === 'sello') await setSelloBase64("");
        setAssets(prev => ({ ...prev, [type]: "" }));
    };

    const handleDeleteNotification = useCallback(async (id: string) => {
        await deleteNotification(id);
    }, []);

    const handleToggleRead = useCallback(async (id: string) => {
        const noti = systemEvents.find(n => n.id === id);
        if (noti) {
            await updateNotificationStatus(id, !noti.isRead);
        }
    }, [systemEvents]);

    const handleUpdateRate = useCallback(async (label: string) => {
        if (!currentUserId) return;
        let newValue = 0;
        try {
            if (label === "USD" || label === "EUR") {
                const data = await fetchBCVRateFromAPI();
                setCurrentBcvRate(data.usd); 
                setEurRate(data.eur || 0);
                newValue = label === "USD" ? data.usd : data.eur;
            } else if (label === "USDT") {
                const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                const data = await res.json();
                if (data?.promedio) { setParallelRate(data.promedio); newValue = data.promedio; }
            }
            const msg = `Valor ${label} actualizado a Bs. ${newValue.toFixed(2)}`;
            setRateToastMessage(msg); setShowRateToast(true);
            setTimeout(() => setShowRateToast(false), 4000);

            await createNotification(currentUserId, {
                title: `Sincronización ${label}`,
                description: msg,
                type: 'info',
                category: 'system'
            });
            
            setHasUnseenNotifications(true);
        } catch (error) { console.error(error); }
    }, [currentUserId]);

    const handleRegisterOrderPayment = async (ordenId: string, monto: number, nota?: string, imagenUrl?: string) => {
        if (!currentUserId) return;
        try {
            const ordenActual = ordenes.find(o => o.id === ordenId);
            if (!ordenActual) return;
            const ordenRef = doc(db, "ordenes", ordenId);
            const montoPagadoAnterior = Number(ordenActual.montoPagadoUSD) || 0;
            const nuevoMontoTotalPagado = montoPagadoAnterior + monto;
            const saldoRestante = ordenActual.totalUSD - nuevoMontoTotalPagado;
            const nuevoEstadoPago = saldoRestante <= 0.01 ? "PAGADO" : "ABONADO";
            const nuevoRecibo = {
                montoUSD: monto,
                fecha: new Date().toISOString(),
                nota: nota || "",
                imagenUrl: imagenUrl || "",
                tasaBCV: currentBcvRate
            };
            await updateDoc(ordenRef, {
                montoPagadoUSD: nuevoMontoTotalPagado,
                estadoPago: nuevoEstadoPago,
                registroPagos: arrayUnion(nuevoRecibo)
            });
            await createNotification(currentUserId, {
                title: "Pago Registrado",
                description: `Se recibió un pago de $${monto} para la Orden #${ordenActual.ordenNumero}`,
                type: 'success',
                category: 'system'
            });
        } catch (error) {
            console.error("❌ Error al registrar pago:", error);
        }
    };

    // --- 5. CARGA DE DATOS ---
    useEffect(() => {
        if (!currentUserId) return 

        const cached = getBCVRateFromStorage();
        if (cached.usd > 0) {
            setCurrentBcvRate(cached.usd);
            setEurRate(cached.eur || 0);
        }

        fetchBCVRateFromAPI().then(data => { 
            setCurrentBcvRate(data.usd); 
            setEurRate(data.eur || 0); 
        });

        fetch('https://ve.dolarapi.com/v1/dolares/paralelo').then(res => res.json()).then(data => { if (data?.promedio) setParallelRate(data.promedio); });
        Promise.all([getLogoBase64(), getFirmaBase64(), getSelloBase64()]).then(([l, f, s]) => { 
            setAssets({ logo: l || "", firma: f || "", sello: s || "" }); 
        });

        const unsubOrdenes = subscribeToOrdenes(currentUserId, (data) => setOrdenes(data));
        const unsubDesigners = subscribeToDesigners((data) => setDesigners(data));
        const unsubGastos = subscribeToGastos(currentUserId, (data) => setGastos(data));
        const unsubGastosFijos = subscribeToGastosFijos(currentUserId, (data) => setGastosFijos(data));
        const unsubEmpleados = subscribeToEmpleados(currentUserId, (data) => setEmpleados(data));
        const unsubPagos = subscribeToPagos(currentUserId, (data) => setPagos(data)); 
        
        const unsubNotis = subscribeToNotifications(currentUserId, (data) => {
            setSystemEvents(data.filter(n => n.category !== 'expense'));
            setExpenseEvents(data.filter(n => n.category === 'expense') as any);
        });

        return () => { 
            unsubOrdenes(); unsubDesigners(); unsubGastos(); 
            unsubGastosFijos(); unsubEmpleados(); unsubPagos(); unsubNotis();
        };
    }, [currentUserId]);

    // --- 6. LÓGICA DE NOTIFICACIONES Y FILTROS ---
    const allNotifications = useMemo(() => {
        let all: Notification[] = [...systemEvents];
        ordenes.forEach(o => {
            const clienteFinal = o.cliente?.nombreRazonSocial || "Cliente S/N";
            const nOrdenStr = o.ordenNumero ? String(o.ordenNumero) : "S/N";
            if (o.fecha) {
                const date = typeof o.fecha === 'string' ? new Date(o.fecha) : (o.fecha as any).toDate?.();
                if (date && !isNaN(date.getTime())) {
                    all.push({
                        id: `orden-${o.id}`, title: "Orden Registrada",
                        description: `Orden #${nOrdenStr} — ${clienteFinal}`,
                        type: 'info', icon: <FileSpreadsheet />, timestamp: date, isRead: true
                    });
                }
            }
            const pagosReg = (o as any).registroPagos || [];
            pagosReg.forEach((p: any, idx: number) => {
                const rawFecha = p.fechaRegistro || p.fecha || p.fechaPago;
                if (rawFecha) {
                    const date = typeof rawFecha === 'string' ? new Date(rawFecha) : (rawFecha as any).toDate?.();
                    if (date && !isNaN(date.getTime())) {
                        all.push({
                            id: `pago-${o.id}-${idx}`, title: "Abono Procesado",
                            description: `Recibido: $${p.montoUSD} — #${nOrdenStr} (${clienteFinal})`,
                            type: 'success', icon: <CheckCircle2 />, timestamp: date, isRead: true
                        });
                    }
                }
            });
        });
        return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [ordenes, systemEvents]);

    const paginatedNotis = useMemo(() => {
        const filtered = allNotifications.filter(n => {
            const matchesSearch = n.description.toLowerCase().includes(notiSearch.toLowerCase()) || 
                                n.title.toLowerCase().includes(notiSearch.toLowerCase());
            const matchesFilter = notiFilter === "all" || n.type === notiFilter;
            return matchesSearch && matchesFilter;
        });
        const start = (currentPage - 1) * itemsPerPage;
        return filtered.slice(start, start + itemsPerPage);
    }, [allNotifications, notiSearch, notiFilter, currentPage]);

    const totalPages = Math.ceil(allNotifications.filter(n => {
        const matchesSearch = n.description.toLowerCase().includes(notiSearch.toLowerCase()) || 
                            n.title.toLowerCase().includes(notiSearch.toLowerCase());
        const matchesFilter = notiFilter === "all" || n.type === notiFilter;
        return matchesSearch && matchesFilter;
    }).length / itemsPerPage);

    const filteredOrdenes = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return ordenes.filter((o) => {
            const nOrden = String(o.ordenNumero || "");
            const cliente = String(o.cliente?.nombreRazonSocial || "").toLowerCase();
            return nOrden.includes(term) || cliente.includes(term);
        });
    }, [ordenes, searchTerm]);

    const stats = useMemo(() => {
        const unfinished = ordenes.filter(o => o.estado !== "TERMINADO");
        return { total: unfinished.length, pendientes: unfinished.filter(o => o.estado === "PENDIENTE").length, proceso: unfinished.filter(o => o.estado === "PROCESO").length };
    }, [ordenes]);

    return (
      <div className="flex h-screen bg-[#f2f2f7] dark:bg-black overflow-hidden relative font-sans text-slate-900 dark:text-white">
        <Sidebar 
            activeView={activeView} 
            setActiveView={setActiveView as any} 
            navItems={navItems as any} 
            onLogout={logout} 
            isMobileOpen={isSidebarOpen} 
            setIsMobileOpen={setIsSidebarOpen} 
        />
        
        <div className={cn("flex-1 flex flex-col relative transition-all duration-700 min-w-0 overflow-hidden", isSidebarOpen ? "lg:pl-72" : "lg:pl-0")}>
          <header className="sticky top-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/60 dark:bg-black/60 backdrop-blur-2xl z-50 w-full overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-black/5 dark:bg-white/10 shrink-0" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu className="h-5 w-5" /></Button>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight italic uppercase truncate max-w-[150px] sm:max-w-none">
                    {activeView.startsWith("tasks_") ? "Taller" : navItems.find(i => i.id === activeView)?.label || 
                     (activeView === "design_production" ? "Pago Diseños" : "Panel")}
                </h2>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <div className="hidden lg:flex items-center gap-2">
                    <TasaHeaderBadge label="USD" value={currentBcvRate} icon={<DollarSign className="w-3.5 h-3.5" />} color="emerald" onClick={() => handleUpdateRate("USD")} />
                    <TasaHeaderBadge label="EUR" value={eurRate} icon={<Euro className="w-3.5 h-3.5" />} color="blue" onClick={() => handleUpdateRate("EUR")} />
                    <TasaHeaderBadge label="USDT" value={parallelRate} icon={<Coins className="w-3.5 h-3.5" />} color="orange" onClick={() => handleUpdateRate("USDT")} />
                </div>
                
                <Button variant="ghost" size="icon" className="rounded-2xl bg-orange-500/10 h-10 w-10 text-orange-600" onClick={() => setIsExpenseNotiOpen(true)}>
                    <Clock className="h-5 w-5" />
                </Button>

                <div className="relative">
                    <Button variant="ghost" size="icon" className="rounded-2xl bg-black/5 dark:bg-white/10 h-10 w-10 relative" onClick={() => { setIsNotiOpen(true); setHasUnseenNotifications(false); }}>
                        <Bell className="h-5 w-5" />
                        {(hasUnseenNotifications || allNotifications.some(n => !n.isRead)) && <motion.span layoutId="notification-dot" className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-black" />}
                    </Button>
                </div>
            </div>
          </header>

          <NotificationCenter 
              isOpen={isNotiOpen} onClose={() => setIsNotiOpen(false)} 
              activeNotifications={allNotifications} onMarkAllRead={() => setHasUnseenNotifications(false)} 
              onDeleteNotification={handleDeleteNotification} onToggleRead={handleToggleRead} 
              onMaximize={() => { setIsNotiOpen(false); setActiveView("notifications_full"); }} 
          />

          <NotificationCenterExpenses 
              isOpen={isExpenseNotiOpen} onClose={() => setIsExpenseNotiOpen(false)} 
              activeNotifications={expenseEvents} onMarkAllRead={() => {}} 
              onDeleteNotification={(id) => deleteNotification(id)} 
              onToggleRead={(id) => {
                  const n = expenseEvents.find(x => x.id === id);
                  if(n) updateNotificationStatus(id, !n.isRead);
              }} 
          />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={activeView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={springConfig} className="h-full">
                
                {activeView === "orders" && (
                    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 w-full">
                            <StatCard label="Taller" value={stats.total} icon={<Hammer />} color="blue" subtext="Activas" />
                            <StatCard label="Pendientes" value={stats.pendientes} icon={<Clock />} color="orange" subtext="Por iniciar" />
                            <StatCard label="En Proceso" value={stats.proceso} icon={<Zap />} color="green" subtext="Ejecución" className="col-span-2 md:col-span-1" />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-white/40 dark:bg-white/5 p-4 rounded-[2rem] border border-black/5 shadow-sm">
                            <div className="relative w-full sm:max-w-md">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                                <input type="text" placeholder="Buscar orden o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-white dark:bg-black/20 border border-black/5 rounded-[1.8rem] text-sm outline-none" />
                            </div>
                            <Button onClick={() => { setEditingOrder(null); setIsWizardOpen(true); }} className="px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.8rem] font-bold text-sm gap-3 shrink-0"><Plus /> NUEVA ORDEN</Button>
                        </div>
                        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] border border-black/5 shadow-2xl overflow-hidden">
                            

<OrdersTable 
    ordenes={filteredOrdenes} 
    onDelete={deleteOrden} 
    onEdit={(o) => {setEditingOrder(o); setIsWizardOpen(true);}} 
    onRegisterPayment={handleRegisterOrderPayment}
    currentUserId={currentUserId || ""}
    bcvRate={currentBcvRate} 
    // NUEVOS CAMPOS REQUERIDOS:
    pdfLogoBase64={assets.logo}
    firmaBase64={assets.firma}
    selloBase64={assets.sello}
/>
                        </div>
                    </div>
                )}

                {activeView === "fixed_expenses" && (
                    <GastosFijosView 
                        gastos={gastosFijos} 
                        empresaId={currentUserId || ""} 
                        rates={{ usd: currentBcvRate, eur: eurRate }} 
                        onNotification={(t, d) => { 
                            setRateToastMessage(d); 
                            setShowRateToast(true);
                            setTimeout(() => setShowRateToast(false), 4000);
                            createNotification(currentUserId!, { title: t, description: d, type: 'warning', category: 'expense' });
                        }} 
                    />
                )}
                
                {activeView === "insumos_mgmt" && (
                    <InsumosView 
                        gastos={gastos} 
                        currentBcvRate={currentBcvRate} 
                        currentUserId={currentUserId || ""} 
                        onCreateGasto={createGasto} 
                        onDeleteGasto={deleteGastoInsumo} 
                    />
                )}

                {activeView === "employees_mgmt" && (
                    <EmpleadosView 
                        empleados={empleados} 
                        empresaId={currentUserId || ""} 
                        rates={{ usd: currentBcvRate, eur: eurRate }} 
                    />
                )}

                {activeView === "financial_stats" && (
                    <EstadisticasDashboard 
                        gastosInsumos={gastos as any} 
                        gastosFijos={gastosFijos} 
                        empleados={empleados} 
                        pagosEmpleados={pagos} 
                        cobranzas={ordenes.map(o => ({
                            id: o.id, montoUSD: (o as any).totalUSD || 0, montoBs: (o as any).totalBs || 0,
                            estado: o.estadoPago === 'PAGADO' ? 'pagado' : 'pendiente'
                        })) as any}
                    />
                )}

                {activeView === "calculator" && (
                    <BudgetEntryView 
                        currentBcvRate={currentBcvRate} pdfLogoBase64={assets.logo} 
                        handleLogoUpload={(e: any) => handleFileUpload(e, 'logo')} handleClearLogo={() => handleClearAsset('logo')}
                        firmaBase64={assets.firma} handleFirmaUpload={(e: any) => handleFileUpload(e, 'firma')} handleClearFirma={() => handleClearAsset('firma')}
                        selloBase64={assets.sello} handleSelloUpload={(e: any) => handleFileUpload(e, 'sello')} handleClearSello={() => handleClearAsset('sello')}
                        currentUserId={currentUserId} // CORRECCIÓN: Se añade el ID de usuario
                    />
                )}
                {activeView.startsWith("tasks_") && <TasksView ordenes={ordenes} currentUserId={currentUserId || ""} areaPriorizada={activeView.replace("tasks_", "")} />}
                {activeView === "design_production" && <DesignerPayrollView designers={designers} ordenes={ordenes} bcvRate={currentBcvRate} />}
                {activeView === "clients" && (
                    <ClientsAndPaymentsView 
                        ordenes={ordenes} 
                        bcvRate={currentBcvRate} 
                        currentUserId={currentUserId || ""} 
                        onRegisterPayment={handleRegisterOrderPayment} 
                    />
                )}
                {activeView === "old_calculator" && <CalculatorView />}
                {/* --- VISTA DE NOTIFICACIONES COMPLETA --- */}
{activeView === "notifications_full" && (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Centro de Actividades</h2>
                <p className="text-muted-foreground">Historial completo de eventos y notificaciones del sistema</p>
            </div>
            <Button 
                variant="outline" 
                onClick={() => setActiveView("orders")}
                className="rounded-2xl gap-2"
            >
                <ChevronLeft className="w-4 h-4" /> Volver al Panel
            </Button>
        </div>

        <div className="flex flex-col gap-4">
            {allNotifications.length > 0 ? (
                allNotifications.map((noti) => (
                    <ActivityRow key={noti.id} n={noti} />
                ))
            ) : (
                <div className="text-center py-20 bg-white/50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-black/10">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground font-medium">No hay notificaciones para mostrar</p>
                </div>
            )}
        </div>
    </div>
)}

              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <CurrencyToast show={showRateToast} message={rateToastMessage} onClose={() => setShowRateToast(false)} />

        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogContent className="w-full max-w-[95vw] lg:max-w-7xl h-auto p-0 border-none bg-transparent shadow-none focus:outline-none overflow-visible">
            <DialogTitle className="sr-only">{editingOrder ? "Editar Orden" : "Nueva Orden"}</DialogTitle>
            <OrderFormWizardV2 onClose={() => { setIsWizardOpen(false); setEditingOrder(null); }} initialData={editingOrder || undefined} currentUserId={currentUserId || ""} onCreate={createOrden} onUpdate={actualizarOrden} bcvRate={currentBcvRate} />
          </DialogContent>
        </Dialog>
      </div>
    )
}

// Subcomponentes auxiliares
function TasaHeaderBadge({ label, value, icon, color, onClick }: any) {
    const colors: any = { emerald: "bg-emerald-500/10 text-emerald-600", orange: "bg-orange-500/10 text-orange-600", blue: "bg-blue-500/10 text-blue-600" }
    return (
        <motion.div whileHover={{ y: -1, scale: 1.02 }} onClick={onClick} className="bg-white dark:bg-white/5 px-4 py-2 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3 cursor-pointer shrink-0">
            <div className={cn("p-1.5 rounded-xl", colors[color])}>{icon}</div>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-black/30 dark:text-white/30 uppercase leading-none mb-0.5">{label}</span>
                <span className="text-sm font-bold">{value ? value.toFixed(2) : "---"}</span>
            </div>
        </motion.div>
    )
}

function StatCard({ label, value, icon, subtext, color, className }: any) {
    const theme: any = { blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", orange: "bg-orange-500/10 text-orange-600 border-orange-500/20", green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" }
    return (
        <Card className={cn("border shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-[#1c1c1e] transition-all w-full", className)}>
            <CardContent className="p-4 sm:p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-[1.8rem] shadow-inner shrink-0", theme[color])}>{icon && React.cloneElement(icon as any, { className: "w-8 h-8" })}</div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-black/30 dark:text-white/30 truncate">{label}</p>
                    <p className="text-3xl font-bold tracking-tighter truncate">{value}</p>
                    <p className="text-[9px] font-semibold text-black/40 dark:text-white/40 uppercase truncate">{subtext}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function ActivityRow({ n }: { n: Notification }) {
    const colors: any = { success: "bg-emerald-500 shadow-emerald-500/20", info: "bg-blue-500 shadow-blue-500/20", warning: "bg-orange-500 shadow-orange-500/20", urgent: "bg-red-500 shadow-red-500/20", neutral: "bg-slate-500" };
    const displayDate = n.timestamp instanceof Date ? n.timestamp : (n.timestamp as any)?.toDate ? (n.timestamp as any).toDate() : new Date();
    return (
        <div className="group flex items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-white dark:bg-[#1c1c1e] rounded-[1.8rem] sm:rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-xl transition-all w-full min-w-0">
            <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0", colors[n.type] || colors.neutral)}>
                {n.icon && React.isValidElement(n.icon) ? React.cloneElement(n.icon as React.ReactElement, { className: "w-4 h-4 sm:w-5 sm:h-5 text-white" }) : <Bell className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex justify-between items-center mb-1 gap-2">
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-40 truncate">{n.title}</span>
                    <time className="text-[9px] sm:text-[10px] font-bold opacity-30 shrink-0">{displayDate.toLocaleDateString('es-VE')}</time>
                </div>
                <h4 className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white">{n.description}</h4>
            </div>
        </div>
    )
}