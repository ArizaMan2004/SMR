// @/components/orden/dashboard.tsx
"use client"

import React, { useEffect, useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"

// UI - Shadcn
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

// Componentes SMR/Siskoven
import Sidebar from "@/components/dashboard/sidebar"
import { OrderFormWizardV2 } from "@/components/orden/order-form-wizard"
import { OrdersTable } from "@/components/orden/orders-table"
import { BCVRateWidget } from "@/components/orden/bvc-rate-widget" 
import { ClientsAndPaymentsView } from "@/components/dashboard/ClientsAndPaymentsView"
import { DesignerPayrollView } from "@/components/dashboard/DesignerPayrollView" 
import TasksView from "@/components/dashboard/tasks-view"
import BudgetEntryView from "@/components/dashboard/BudgetEntryView" 
import CalculatorView from "@/components/dashboard/CalculatorView" 

// Iconos
import { 
    Plus, Users, CheckCircle, Calculator,
    Palette, Search, ChevronDown, Landmark, 
    LayoutDashboard, FileSpreadsheet, Clock, Zap, Hammer,
    DollarSign, Euro, Menu 
} from "lucide-react" 

// Servicios
import { type OrdenServicio } from "@/lib/types/orden"
import { 
    subscribeToOrdenes, deleteOrden, updateOrdenStatus, 
    createOrden, actualizarOrden
} from "@/lib/services/ordenes-service"
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"
import { getBCVRate, fetchBCVRateFromAPI } from "@/lib/bcv-service"
import { getLogoBase64 } from "@/lib/logo-service" 
import { cn } from "@/lib/utils"

type ActiveView = "orders" | "clients" | "tasks" | "calculator" | "old_calculator" | "design_production"

export default function Dashboard() {
    const { user, logout } = useAuth() 
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [designers, setDesigners] = useState<Designer[]>([]) 
    const [searchTerm, setSearchTerm] = useState("") 
    const [activeView, setActiveView] = useState<ActiveView>("orders") 
    const [showBCV, setShowBCV] = useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true) 
    
    const [isWizardOpen, setIsWizardOpen] = useState(false) 
    const [editingOrder, setEditingOrder] = useState<OrdenServicio | null>(null) 
    
    const [currentBcvRate, setCurrentBcvRate] = useState<number>(() => getBCVRate().rate || 0)
    const [eurRate, setEurRate] = useState<number>(0)
    
    const currentUserId = user?.uid || "mock-user-admin-123"
    const [pdfLogoBase64, setPdfLogoBase64] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (!user) return 
        fetchBCVRateFromAPI().then(data => {
            setCurrentBcvRate(data.usdRate)
            setEurRate(data.eurRate || 0)
        })
        getLogoBase64().then(setPdfLogoBase64)
        const unsubOrdenes = subscribeToOrdenes(currentUserId, (data, err) => {
            if (err) return setOrdenes([])
            setOrdenes(data)
        })
        const unsubDesigners = subscribeToDesigners((data) => {
            setDesigners(data)
        })
        return () => { unsubOrdenes(); unsubDesigners(); }
    }, [user, currentUserId])

    const stats = useMemo(() => {
        const unfinished = ordenes.filter(o => 
            o.estado?.toUpperCase() !== "TERMINADO" && o.estado?.toUpperCase() !== "CANCELADO"
        )
        return {
            totalTaller: unfinished.length,
            pendientes: unfinished.filter(o => o.estado?.toUpperCase() === "PENDIENTE").length,
            enProceso: unfinished.filter(o => o.estado?.toUpperCase() === "PROCESO").length
        }
    }, [ordenes])

    const filteredOrdenes = useMemo(() => {
        return ordenes.filter((o) => {
          const term = searchTerm.toLowerCase()
          const nOrden = String(o.ordenNumero || "").toLowerCase()
          const cliente = (o.cliente?.nombreRazonSocial || o.clienteNombre || "").toLowerCase()
          return nOrden.includes(term) || cliente.includes(term)
        })
    }, [ordenes, searchTerm])

    const handleOpenCreate = () => { setEditingOrder(null); setIsWizardOpen(true); }
    const handleEditOrder = (orden: OrdenServicio) => { setEditingOrder(orden); setIsWizardOpen(true); }
    const handleSaveOrder = async (data: any) => {
        try {
            editingOrder ? await actualizarOrden(editingOrder.id, data) : await createOrden(data)
            setIsWizardOpen(false); setEditingOrder(null)
        } catch (e) { alert("Error al guardar.") }
    }

    const navItems = [
      { id: 'orders', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }, 
      { id: 'design_production', label: 'Nómina Taller', icon: <Palette className="w-4 h-4" /> }, 
      { id: 'tasks', label: 'Tareas', icon: <CheckCircle className="w-4 h-4" /> },
      { id: 'clients', label: 'Cobranza', icon: <Users className="w-4 h-4" /> }, 
      { id: 'calculator', label: 'Presupuestos', icon: <FileSpreadsheet className="w-4 h-4" /> }, 
      { id: 'old_calculator', label: 'Medidas', icon: <Calculator className="w-4 h-4" /> }, 
    ]

    return (
      <div className="flex h-screen bg-[#f8fafc] dark:bg-[#020617] overflow-hidden relative">
        <Sidebar 
            activeView={activeView} 
            setActiveView={setActiveView as any} 
            navItems={navItems} 
            onLogout={logout} 
            isMobileOpen={isSidebarOpen}
            setIsMobileOpen={setIsSidebarOpen}
        />
        
        <div className={cn(
            "flex-1 flex flex-col relative overflow-hidden transition-all duration-500 ease-in-out",
            isSidebarOpen ? "lg:pl-72" : "lg:pl-0"
        )}>
          <header className="flex justify-between items-center px-4 py-3 md:px-10 md:py-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl z-20">
            <div className="flex items-center gap-3">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
                    <Button 
                        variant="outline"
                        size="icon"
                        className="rounded-xl border-slate-200/50 bg-white dark:bg-slate-900 shadow-sm" 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </Button>
                </motion.div>

                <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {navItems.find(i => i.id === activeView)?.label || "Panel"}
                </h2>
            </div>
            
            <div className="flex items-center gap-1.5 md:gap-3">
                <TasaHeaderBadge label="USD" value={currentBcvRate} icon={<DollarSign className="text-emerald-600 w-3.5 h-3.5 md:w-4 md:h-4" />} color="emerald" />
                <TasaHeaderBadge label="EUR" value={eurRate} icon={<Euro className="text-indigo-600 w-3.5 h-3.5 md:w-4 md:h-4" />} color="indigo" />
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 md:p-12">
            <AnimatePresence mode="wait">
              <motion.div 
                key={activeView} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="space-y-5 md:space-y-10"
              >
                {activeView === "orders" && (
                    <div className="max-w-7xl mx-auto space-y-5 md:space-y-10">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8">
                            <div className="col-span-2 md:col-span-1">
                                <StatCard label="En Taller" value={stats.totalTaller} icon={<Hammer />} color="blue" subtext="Órdenes activas" />
                            </div>
                            <StatCard label="Por Iniciar" value={stats.pendientes} icon={<Clock />} color="orange" subtext="En espera" />
                            <StatCard label="En Proceso" value={stats.enProceso} icon={<Zap />} color="green" subtext="Activas" />
                        </div>

                        <motion.section 
                            whileHover={{ y: -2 }}
                            className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-sm"
                        >
                            <button onClick={() => setShowBCV(!showBCV)} className="flex items-center justify-between w-full p-3.5 md:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all outline-none">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 md:p-3 bg-white dark:bg-slate-800 rounded-lg md:rounded-2xl border border-slate-200 shadow-sm"><Landmark className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" /></div>
                                    <h3 className="text-sm md:text-lg font-bold text-slate-800 dark:text-white">Ajustar Tasas</h3>
                                </div>
                                <motion.div animate={{ rotate: showBCV ? 180 : 0 }}>
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                </motion.div>
                            </button>
                            <AnimatePresence>
                                {showBCV && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4 md:px-6 md:pb-6 overflow-hidden">
                                        <BCVRateWidget initialRate={currentBcvRate} onRateChange={setCurrentBcvRate} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.section>

                        <div className="flex flex-col md:flex-row gap-3 md:gap-6 items-center justify-between bg-white dark:bg-slate-900 p-3 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-200">
                            <div className="relative w-full md:max-w-xl">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input type="text" placeholder="Buscar orden o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 md:py-4 bg-slate-100/50 dark:bg-slate-800/50 border-none rounded-xl md:rounded-[1.5rem] text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                            </div>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full md:w-auto">
                                <Button onClick={handleOpenCreate} className="w-full px-8 py-6 md:py-7 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl shadow-lg shadow-blue-500/25 font-black text-sm md:text-lg gap-2">
                                    <Plus className="w-5 h-5" /> Nueva Orden
                                </Button>
                            </motion.div>
                        </div>

                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                            <OrdersTable ordenes={filteredOrdenes} onDelete={deleteOrden} onStatusChange={updateOrdenStatus} onEdit={handleEditOrder} smrLogoBase64={pdfLogoBase64} bcvRate={currentBcvRate} />
                        </div>
                    </div>
                )}

                {activeView === "design_production" && <DesignerPayrollView ordenes={ordenes} designers={designers} bcvRate={currentBcvRate} eurRate={eurRate} />}
                {activeView === "old_calculator" && <CalculatorView />}
                {activeView === "calculator" && <BudgetEntryView currentBcvRate={currentBcvRate} />}
                {activeView === "tasks" && <TasksView ordenes={ordenes} />}
                {activeView === "clients" && <ClientsAndPaymentsView ordenes={ordenes} bcvRate={currentBcvRate} currentUserId={currentUserId} onRegisterPayment={() => {}} />}
                
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
            <DialogContent className="max-w-[100vw] w-full md:max-w-[92vw] h-full md:h-[92vh] md:rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-950 flex flex-col">
                <div className="bg-slate-900 p-4 md:p-6 text-white flex-shrink-0"><DialogTitle className="text-lg md:text-2xl font-black uppercase tracking-tighter">{editingOrder ? 'Editar Orden' : 'Nueva Orden'}</DialogTitle></div>
                <div className="flex-1 overflow-y-auto p-5 md:p-10"><OrderFormWizardV2 onSave={handleSaveOrder} onClose={() => setIsWizardOpen(false)} ordenToEdit={editingOrder} /></div>
            </DialogContent>
        </Dialog>
      </div>
    )
}

function TasaHeaderBadge({ label, value, icon, color }: any) {
    const colors: any = {
        emerald: "bg-emerald-100 dark:bg-emerald-500/20",
        indigo: "bg-indigo-100 dark:bg-indigo-500/20"
    }
    return (
        <motion.div 
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white dark:bg-slate-900 px-2 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-2xl border border-slate-200/50 shadow-sm flex items-center gap-1.5 md:gap-3 cursor-pointer"
        >
            <div className={`p-1 md:p-1.5 rounded-md ${colors[color]}`}>{icon}</div>
            <div className="flex flex-col">
                <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase leading-none mb-0.5">{label}</span>
                <span className="text-[11px] md:text-sm font-black text-slate-800 dark:text-white leading-none">{value ? value.toFixed(2) : "---"}</span>
            </div>
        </motion.div>
    )
}

function StatCard({ label, value, icon, subtext, color = "blue" }: any) {
    const theme: any = {
        blue: "text-blue-600 bg-blue-50/50 dark:bg-blue-500/5 border-blue-100/50",
        orange: "text-orange-600 bg-orange-50/50 dark:bg-orange-500/5 border-orange-100/50",
        green: "text-emerald-600 bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100/50"
    }
    return (
        <motion.div
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
            <Card className={`border shadow-sm rounded-2xl md:rounded-[2.5rem] overflow-hidden cursor-default transition-colors ${theme[color]}`}>
                <CardContent className="p-3.5 md:p-8 flex items-center gap-3 md:gap-6">
                    <div className="p-2.5 md:p-5 rounded-xl md:rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-inherit">
                        {React.cloneElement(icon, { className: "w-5 h-5 md:w-8 md:h-8" })}
                    </div>
                    <div>
                        <p className="text-[8px] md:text-[11px] font-black uppercase tracking-widest opacity-60 mb-0.5">{label}</p>
                        <p className="text-xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1">{value}</p>
                        <p className="text-[7px] md:text-[10px] font-bold opacity-50 uppercase truncate max-w-[80px] md:max-w-none">{subtext}</p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}