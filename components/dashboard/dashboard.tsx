// @/components/orden/dashboard.tsx
"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"

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
import { AccountsPayableView, type Gasto } from "@/components/dashboard/AccountsPayableView"
import TasksView from "@/components/dashboard/tasks-view"
import BudgetEntryView from "@/components/dashboard/BudgetEntryView" 
import CalculatorView from "@/components/dashboard/CalculatorView" 
import { CurrencyToast } from "@/components/dashboard/CurrencyToast" 

// Iconos
import { 
    Plus, Users, CheckCircle, Calculator, Palette, Search, 
    LayoutDashboard, FileSpreadsheet, Clock, Zap, Hammer, 
    DollarSign, Menu, Building2, Bell, TrendingUp, Euro, 
    Coins, CheckCircle2, MessageSquareText, Trash2, MailOpen, 
    ChevronRight, ChevronLeft, Filter, ChevronDown
} from "lucide-react" 

// Servicios
import { type OrdenServicio } from "@/lib/types/orden"
import { subscribeToOrdenes, deleteOrden, updateOrdenStatus, createOrden, actualizarOrden } from "@/lib/services/ordenes-service"
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"
import { createGasto, subscribeToGastos } from "@/lib/services/gastos-service"
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"
import { 
    getLogoBase64, setLogoBase64, 
    getFirmaBase64, setFirmaBase64, 
    getSelloBase64, setSelloBase64 
} from "@/lib/logo-service" 
import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };
type ActiveView = "orders" | "clients" | "tasks" | "calculator" | "old_calculator" | "design_production" | "payable" | "notifications_full"

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
    
    // ESTADOS DEL TOAST
    const [showRateToast, setShowRateToast] = useState(false)
    const [rateToastMessage, setRateToastMessage] = useState("")

    // --- 2. ESTADOS DE DATOS ---
    const [currentBcvRate, setCurrentBcvRate] = useState<number>(0)
    const [eurRate, setEurRate] = useState<number>(0)
    const [parallelRate, setParallelRate] = useState<number>(0)
    const [assets, setAssets] = useState({ logo: "", firma: "", sello: "" })
    const [isNotiOpen, setIsNotiOpen] = useState(false)
    const [hasUnseenNotifications, setHasUnseenNotifications] = useState(false)
    const [systemEvents, setSystemEvents] = useState<Notification[]>([])
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [designers, setDesigners] = useState<Designer[]>([]) 
    const [gastos, setGastos] = useState<Gasto[]>([])

    // --- 3. NAV ITEMS ---
    const navItems = useMemo(() => [
    { id: 'orders', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }, 
    { id: 'design_production', label: 'Nómina Taller', icon: <Palette className="w-4 h-4" /> }, 
    { id: 'tasks', label: 'Tareas', icon: <CheckCircle className="w-4 h-4" /> },
    { 
        id: 'finances', 
        label: 'Cuentas', 
        icon: <DollarSign className="w-4 h-4" />,
        children: [
            { id: 'clients', label: 'Cobranza' },
            { id: 'payable', label: 'Cuentas x Pagar' },
        ]
    },
    { 
        id: 'tools', 
        label: 'Herramientas', 
        icon: <Calculator className="w-4 h-4" />,
        children: [
            { id: 'calculator', label: 'Presupuestos' },
            { id: 'old_calculator', label: 'Calculadora de Producción' }, // <-- Nombre actualizado aquí
        ]
    },
], []);

    // --- 4. MANEJADORES ---
    const handleDeleteNotification = useCallback((id: string) => {
        setSystemEvents(prev => prev.filter(n => n.id !== id));
    }, [systemEvents]);

    const handleToggleRead = useCallback((id: string) => {
        setSystemEvents(prev => prev.map(n => n.id === id ? { ...n, isRead: !n.isRead } : n));
    }, [systemEvents]);

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

    const handleUpdateRate = useCallback(async (label: string) => {
        let newValue = 0;
        try {
            if (label === "USD" || label === "EUR") {
                const data = await fetchBCVRateFromAPI();
                setCurrentBcvRate(data.usdRate); setEurRate(data.eurRate || 0);
                newValue = label === "USD" ? data.usdRate : data.eurRate;
            } else if (label === "USDT") {
                const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                const data = await res.json();
                if (data?.promedio) { setParallelRate(data.promedio); newValue = data.promedio; }
            }

            const msg = `Valor ${label} actualizado a Bs. ${newValue.toFixed(2)}`;
            setRateToastMessage(msg);
            setShowRateToast(true);
            setTimeout(() => setShowRateToast(false), 4000);

            const newEvent: Notification = {
                id: `bcv-up-${label}-${Date.now()}`, title: `Sincronización ${label}`,
                description: msg, type: 'warning',
                icon: <TrendingUp className="text-white w-4 h-4" />, timestamp: new Date(), isRead: false,
                metadata: { tasaNueva: newValue }
            };
            setSystemEvents(prev => [newEvent, ...prev]); setHasUnseenNotifications(true);
        } catch (error) { console.error(error); }
    }, [currentBcvRate, eurRate, parallelRate]);

    // --- 5. CARGA DE FIREBASE ---
    useEffect(() => {
        if (!currentUserId) return 
        fetchBCVRateFromAPI().then(data => { setCurrentBcvRate(data.usdRate); setEurRate(data.eurRate || 0); });
        fetch('https://ve.dolarapi.com/v1/dolares/paralelo').then(res => res.json()).then(data => { if (data?.promedio) setParallelRate(data.promedio); });
        
        Promise.all([getLogoBase64(), getFirmaBase64(), getSelloBase64()]).then(([l, f, s]) => { 
            setAssets({ logo: l || "", firma: f || "", sello: s || "" }); 
        });
        
        const unsubOrdenes = subscribeToOrdenes(currentUserId, (data) => setOrdenes(data));
        const unsubDesigners = subscribeToDesigners((data) => setDesigners(data));
        const unsubGastos = subscribeToGastos((data) => setGastos(data));

        return () => { unsubOrdenes(); unsubDesigners(); unsubGastos(); };
    }, [currentUserId]);

    // --- 6. LÓGICA DE ACTIVIDADES ---
    const allNotifications = useMemo(() => {
        let all: Notification[] = [...systemEvents];
        ordenes.forEach(o => {
            const clienteFinal = o.clienteNombre || o.nombreRazonSocial || (o.cliente as any)?.nombreRazonSocial || "Cliente S/N";
            const nOrdenStr = o.ordenNumero ? String(o.ordenNumero) : "S/N";

            if (o.fecha) {
                const date = typeof o.fecha === 'string' ? new Date(o.fecha) : (o.fecha as any).toDate?.();
                if (date && !isNaN(date.getTime())) {
                    all.push({
                        id: `orden-${o.id}`, title: "Orden Registrada",
                        description: `Orden #${nOrdenStr} — ${clienteFinal}`,
                        type: 'info', icon: <FileSpreadsheet />, timestamp: date,
                        metadata: { ordenNumero: nOrdenStr, cliente: clienteFinal }
                    });
                }
            }

            const pagos = (o as any).registroPagos || [];
            pagos.forEach((p: any, idx: number) => {
                const rawFecha = p.fechaRegistro || p.fecha || p.fechaPago;
                if (rawFecha && typeof rawFecha === 'string') {
                    const date = new Date(rawFecha);
                    if (!isNaN(date.getTime())) {
                        all.push({
                            id: `pago-${o.id}-${idx}`, title: "Abono Procesado",
                            description: `Recibido: $${p.montoUSD} — #${nOrdenStr} (${clienteFinal})`,
                            type: 'success', icon: <CheckCircle2 />, timestamp: date,
                            metadata: { monto: p.montoUSD, cliente: clienteFinal, ordenNumero: nOrdenStr }
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
            const cliente = String(o.clienteNombre || o.nombreRazonSocial || o.cliente?.nombreRazonSocial || "").toLowerCase();
            return nOrden.includes(term) || cliente.includes(term);
        });
    }, [ordenes, searchTerm]);

    const stats = useMemo(() => {
        const unfinished = ordenes.filter(o => o.estado !== "TERMINADO");
        return { total: unfinished.length, pendientes: unfinished.filter(o => o.estado === "PENDIENTE").length, proceso: unfinished.filter(o => o.estado === "PROCESO").length };
    }, [ordenes]);

    return (
      <div className="flex h-screen bg-[#f2f2f7] dark:bg-black overflow-hidden relative font-sans text-slate-900 dark:text-white">
        <Sidebar activeView={activeView} setActiveView={setActiveView as any} navItems={navItems} onLogout={logout} isMobileOpen={isSidebarOpen} setIsMobileOpen={setIsSidebarOpen} />
        
        <div className={cn("flex-1 flex flex-col relative transition-all duration-700 min-w-0 overflow-hidden", isSidebarOpen ? "lg:pl-72" : "lg:pl-0")}>
          
          <header className="sticky top-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/60 dark:bg-black/60 backdrop-blur-2xl z-50 w-full overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-black/5 dark:bg-white/10 shrink-0" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu className="h-5 w-5" /></Button>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight italic uppercase truncate max-w-[100px] sm:max-w-none">
                    {navItems.find(i => i.id === activeView)?.label || "Panel"}
                </h2>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <div className="hidden lg:flex items-center gap-2">
                    <TasaHeaderBadge label="USD" value={currentBcvRate} icon={<DollarSign className="w-3.5 h-3.5" />} color="emerald" onClick={() => handleUpdateRate("USD")} />
                    <TasaHeaderBadge label="EUR" value={eurRate} icon={<Euro className="w-3.5 h-3.5" />} color="indigo" onClick={() => handleUpdateRate("EUR")} />
                    <TasaHeaderBadge label="USDT" value={parallelRate} icon={<Coins className="w-3.5 h-3.5" />} color="orange" onClick={() => handleUpdateRate("USDT")} />
                </div>

                {/* TASAS MÓVIL (CORREGIDO CON EURO) */}
                <div className="lg:hidden flex items-center flex-shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 px-3 gap-2 rounded-2xl bg-white dark:bg-white/5 border-black/5 shadow-sm shrink-0">
                                <DollarSign className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-bold">{currentBcvRate.toFixed(2)}</span>
                                <ChevronDown className="w-3 h-3 opacity-40" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-[1.5rem] border-black/5 shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-black/90">
                            <DropdownMenuItem onClick={() => handleUpdateRate("USD")} className="flex justify-between items-center p-3 rounded-xl cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-500/10 rounded-lg"><DollarSign className="w-3.5 h-3.5 text-emerald-600" /></div>
                                    <span className="text-xs font-black uppercase opacity-60 tracking-widest">BCV USD</span>
                                </div>
                                <span className="text-sm font-bold">{currentBcvRate.toFixed(2)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRate("EUR")} className="flex justify-between items-center p-3 rounded-xl cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-500/10 rounded-lg"><Euro className="w-3.5 h-3.5 text-indigo-600" /></div>
                                    <span className="text-xs font-black uppercase opacity-60 tracking-widest">BCV EUR</span>
                                </div>
                                <span className="text-sm font-bold">{eurRate.toFixed(2)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRate("USDT")} className="flex justify-between items-center p-3 rounded-xl cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-orange-500/10 rounded-lg"><Coins className="w-3.5 h-3.5 text-orange-600" /></div>
                                    <span className="text-xs font-black uppercase opacity-60 tracking-widest">PARALELO</span>
                                </div>
                                <span className="text-sm font-bold">{parallelRate.toFixed(2)}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="relative shrink-0">
                    <Button variant="ghost" size="icon" className="rounded-2xl bg-black/5 dark:bg-white/10 h-10 w-10 relative shrink-0" onClick={() => { setIsNotiOpen(true); setHasUnseenNotifications(false); }}>
                        <Bell className="h-5 w-5" />
                        {hasUnseenNotifications && <motion.span layoutId="notification-dot" className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-black" />}
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
                        
                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-white/40 dark:bg-white/5 p-4 rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-sm">
                            <div className="relative w-full sm:max-w-md">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                                <input type="text" placeholder="Buscar orden o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-3 bg-white dark:bg-black/20 border border-black/5 rounded-[1.8rem] text-sm outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all" />
                            </div>
                            <Button onClick={() => { setEditingOrder(null); setIsWizardOpen(true); }} className="px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.8rem] font-bold text-sm gap-3 shrink-0"><Plus className="w-5 h-5" /> NUEVA ORDEN</Button>
                        </div>

                        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[2.5rem] border border-black/5 shadow-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <OrdersTable ordenes={filteredOrdenes} onDelete={deleteOrden} onStatusChange={updateOrdenStatus} onEdit={(o) => {setEditingOrder(o); setIsWizardOpen(true);}} smrLogoBase64={assets.logo} bcvRate={currentBcvRate} />
                            </div>
                        </div>
                    </div>
                )}

                {activeView === "design_production" && <DesignerPayrollView designers={designers} ordenes={ordenes} bcvRate={currentBcvRate} />}
                {activeView === "tasks" && <TasksView ordenes={ordenes} currentUserId={currentUserId || ""} />}
                {activeView === "clients" && <ClientsAndPaymentsView ordenes={ordenes} bcvRate={currentBcvRate} currentUserId={currentUserId || ""} onRegisterPayment={() => Promise.resolve()} />}
                {activeView === "payable" && <AccountsPayableView gastos={gastos} onCreateGasto={createGasto} bcvRate={currentBcvRate} />}
                
                {activeView === "calculator" && (
                    <BudgetEntryView 
                        currentBcvRate={currentBcvRate} pdfLogoBase64={assets.logo}
                        handleLogoUpload={(e: any) => handleFileUpload(e, 'logo')}
                        handleClearLogo={() => handleClearAsset('logo')}
                        firmaBase64={assets.firma}
                        handleFirmaUpload={(e: any) => handleFileUpload(e, 'firma')}
                        handleClearFirma={() => handleClearAsset('firma')}
                        selloBase64={assets.sello}
                        handleSelloUpload={(e: any) => handleFileUpload(e, 'sello')}
                        handleClearSello={() => handleClearAsset('sello')}
                    />
                )}
                
                {activeView === "old_calculator" && <CalculatorView />}

                {activeView === "notifications_full" && (
                    <div className="max-w-5xl mx-auto space-y-8 pb-20 px-2 sm:px-4">
                        <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase">Centro de <span className="text-blue-600">Actividades</span></h1>
                        <div className="relative">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                            <input 
                                type="text" placeholder="Buscar por cliente, orden o detalle..." 
                                value={notiSearch} onChange={(e) => {setNotiSearch(e.target.value); setCurrentPage(1);}} 
                                className="w-full pl-12 pr-6 py-4 bg-white dark:bg-white/5 border border-black/5 rounded-[2rem] text-sm outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 transition-all" 
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-white/5 p-1.5 rounded-2xl border border-black/5 shadow-sm overflow-x-auto no-scrollbar">
                            <FilterButton active={notiFilter === "all"} label="Todos" onClick={() => {setNotiFilter("all"); setCurrentPage(1);}} />
                            <FilterButton active={notiFilter === "info"} label="Órdenes" onClick={() => {setNotiFilter("info"); setCurrentPage(1);}} />
                            <FilterButton active={notiFilter === "success"} label="Pagos" onClick={() => {setNotiFilter("success"); setCurrentPage(1);}} />
                            <FilterButton active={notiFilter === "warning"} label="Tasas" onClick={() => {setNotiFilter("warning"); setCurrentPage(1);}} />
                        </div>
                        <div className="space-y-4">
                            {paginatedNotis.map((n) => <ActivityRow key={n.id} n={n} />)}
                        </div>
                        <div className="flex items-center justify-center gap-4 pt-8">
                            <Button variant="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-xl gap-2 font-bold uppercase text-[10px]"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Página {currentPage} de {totalPages || 1}</span>
                            <Button variant="ghost" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-xl gap-2 font-bold uppercase text-[10px]">Siguiente <ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* BOTTOM NAV PARA MÓVIL */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-t border-black/5 flex items-center justify-around px-2 z-50">
            {navItems.slice(0, 4).map((item) => (
                <button key={item.id} onClick={() => setActiveView(item.id as any)} className={cn("flex flex-col items-center gap-1 transition-all flex-1", activeView === item.id ? "text-blue-600 scale-105" : "text-slate-400")}>
                    {React.cloneElement(item.icon as React.ReactElement, { className: "w-5 h-5" })}
                    <span className="text-[9px] font-bold uppercase tracking-tighter">{item.label}</span>
                </button>
            ))}
        </nav>

        {/* TOAST DE MONEDA FUNCIONAL */}
        <CurrencyToast 
            show={showRateToast} 
            message={rateToastMessage} 
            onClose={() => setShowRateToast(false)} 
        />

        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogContent className="max-w-7xl w-[98vw] sm:w-full h-[95vh] p-0 overflow-hidden border-none bg-transparent shadow-none">
            <DialogTitle className="sr-only">{editingOrder ? "Editar Orden" : "Nueva Orden"}</DialogTitle>
            <OrderFormWizardV2 onClose={() => { setIsWizardOpen(false); setEditingOrder(null); }} initialData={editingOrder || undefined} currentUserId={currentUserId || ""} onCreate={createOrden} onUpdate={actualizarOrden} bcvRate={currentBcvRate} />
          </DialogContent>
        </Dialog>
      </div>
    )
}

function FilterButton({ active, label, onClick }: any) {
    return (
        <button onClick={onClick} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap", active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:bg-black/5 dark:hover:bg-white/5")}>{label}</button>
    )
}

function ActivityRow({ n }: { n: Notification }) {
    const colors: any = { success: "bg-emerald-500 shadow-emerald-500/20", info: "bg-blue-500 shadow-blue-500/20", warning: "bg-orange-500 shadow-orange-500/20" };
    return (
        <div className="group flex items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-white dark:bg-[#1c1c1e] rounded-[1.8rem] sm:rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-xl transition-all w-full min-w-0">
            <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0", colors[n.type])}>
                {n.icon && React.isValidElement(n.icon) ? React.cloneElement(n.icon as React.ReactElement, { className: "w-4 h-4 sm:w-5 sm:h-5 text-white" }) : null}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex justify-between items-center mb-1 gap-2">
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-40 truncate">{n.title}</span>
                    <time className="text-[9px] sm:text-[10px] font-bold opacity-30 shrink-0">{n.timestamp.toLocaleDateString('es-VE')}</time>
                </div>
                <h4 className="text-xs sm:text-sm font-bold truncate">{n.description}</h4>
            </div>
        </div>
    )
}

function TasaHeaderBadge({ label, value, icon, color, onClick }: any) {
    const colors: any = { emerald: "bg-emerald-500/10 text-emerald-600", indigo: "bg-indigo-500/10 text-indigo-600", orange: "bg-orange-500/10 text-orange-600" }
    return (
        <motion.div whileHover={{ y: -1, scale: 1.02 }} onClick={onClick} className="bg-white dark:bg-white/5 px-4 py-2 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3 cursor-pointer shrink-0">
            <div className={cn("p-1.5 rounded-xl", colors[color])}>{icon}</div>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-black/30 dark:text-white/30 uppercase leading-none mb-0.5">{label}</span>
                <span className="text-sm font-bold text-black dark:text-white leading-none tracking-tight">{value ? value.toFixed(2) : "---"}</span>
            </div>
        </motion.div>
    )
}

function StatCard({ label, value, icon, subtext, color, className }: any) {
    const theme: any = { blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", orange: "bg-orange-500/10 text-orange-600 border-orange-500/20", green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" }
    return (
        <Card className={cn("border shadow-sm rounded-3xl sm:rounded-[2.5rem] overflow-hidden bg-white dark:bg-[#1c1c1e] transition-all min-w-0 w-full", className)}>
            <CardContent className="p-3 sm:p-6 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-5 text-center sm:text-left">
                <div className={cn("p-3 sm:p-4 rounded-2xl sm:rounded-[1.8rem] shadow-inner shrink-0", theme[color])}>
                    {icon && React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 sm:w-8 sm:h-8" }) : null}
                </div>
                <div className="min-w-0 w-full">
                    <p className="text-[8px] sm:text-[10px] font-bold uppercase text-black/30 dark:text-white/30 mb-0.5 truncate">{label}</p>
                    <p className="text-2xl sm:text-3xl font-bold tracking-tighter leading-none mb-1 truncate">{value}</p>
                    <p className="text-[7px] sm:text-[9px] font-semibold text-black/40 dark:text-white/40 uppercase truncate">{subtext}</p>
                </div>
            </CardContent>
        </Card>
    )
}