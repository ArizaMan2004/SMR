// @/components/orden/dashboard.tsx

"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import React from 'react'; 
// UI
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// Componentes
import Sidebar from "@/components/dashboard/sidebar"
import TrialExpirationModal from "@/components/dashboard/trial-expiration-modal"
import { OrderFormWizardV2 } from "@/components/orden/order-form-wizard"
import { OrdersTable } from "@/components/orden/orders-table"
import { BCVRateWidget } from "@/components/orden/bvc-rate-widget" 
import { ClientsAndPaymentsView } from "@/components/dashboard/ClientsAndPaymentsView"
import { PaymentEditModal } from "@/components/dashboard/PaymentEditModal" 
import { type PagoTransaction } from "@/components/orden/PaymentHistoryView" 
import TasksView from "@/components/dashboard/tasks-view"
import BudgetEntryView from "@/components/dashboard/BudgetEntryView" 
import CalculatorView from "@/components/dashboard/CalculatorView" 

// Iconos
import { 
    Plus, Users, CheckCircle, FileText, Calculator 
} from "lucide-react" 

// Servicios y Tipos
import { type OrdenServicio, EstadoOrden, EstadoPago, type PaymentLog } from "@/lib/types/orden"
import { 
    subscribeToOrdenes, 
    deleteOrden, 
    updateOrdenStatus, 
    createOrden, 
    updateOrdenPaymentLog,
    actualizarOrden
} from "@/lib/services/ordenes-service"
import { getBCVRate } from "@/lib/bcv-service"
import { 
    getLogoBase64, setLogoBase64, 
    getFirmaBase64, setFirmaBase64, 
    getSelloBase64, setSelloBase64       
} from "@/lib/logo-service" 
import { generateOrderPDF, type PDFOptions } from "@/lib/services/pdf-generator"; 

type ActiveView = "orders" | "clients" | "tasks" | "calculator" | "old_calculator" 

export default function Dashboard() {
    const { user, logout } = useAuth() 
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [currentBcvRate, setCurrentBcvRate] = useState<number>(() => getBCVRate().rate || 0); 
    const [activeView, setActiveView] = useState<ActiveView>("orders") 
    
    // --- ESTADOS DE MODALES Y EDICIÓN ---
    const [isWizardOpen, setIsWizardOpen] = useState(false) 
    const [editingOrder, setEditingOrder] = useState<OrdenServicio | null>(null) 
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false) 
    const [ordenForPayment, setOrdenForPayment] = useState<OrdenServicio | null>(null) 

    const currentUserId = user?.uid || "mock-user-admin-123"
    
    // Assets PDF
    const [pdfLogoBase64, setPdfLogoBase64] = useState<string | undefined>(undefined); 
    const [firmaBase64, setFirmaBase64State] = useState<string | undefined>(undefined); 
    const [selloBase64, setSelloBase64State] = useState<string | undefined>(undefined); 

    // --- EFECTOS ---
    useEffect(() => {
        if (!user) return 
        
        getBCVRate().rate ? setCurrentBcvRate(getBCVRate().rate) : null;
        getLogoBase64().then(setPdfLogoBase64);
        setFirmaBase64State(getFirmaBase64()); 
        setSelloBase64State(getSelloBase64()); 
        
        const unsubscribe = subscribeToOrdenes(
            currentUserId, 
            (ordenesData, error) => {
                if (error) {
                    console.error("Error suscripción:", error);
                    setOrdenes([]); 
                    return;
                }
                setOrdenes(ordenesData);
            }
        )
        return () => unsubscribe()
    }, [user, currentUserId])
    
    // --- HANDLERS DE ORDENES ---

    const handleOpenCreate = () => {
        setEditingOrder(null); 
        setIsWizardOpen(true);
    }

    const handleEditOrder = (orden: OrdenServicio) => {
        setEditingOrder(orden); 
        setIsWizardOpen(true);
    }

    const handleSaveOrder = async (data: any) => {
        try {
            if (editingOrder) {
                await actualizarOrden(editingOrder.id, data);
                console.log("Orden actualizada:", data);
            } else {
                await createOrden(data);
                console.log("Orden creada:", data);
            }
            setIsWizardOpen(false);
            setEditingOrder(null);
        } catch (error) {
            console.error("Error guardando orden:", error);
            alert("Hubo un error al guardar la orden.");
        }
    }

    const handleDeleteOrden = (id: string) => {
        if (window.confirm("¿Estás seguro de eliminar esta orden?")) {
            deleteOrden(id).catch(error => console.error("Error eliminar:", error))
        }
    }

    const handleUpdateStatus = (id: string, nuevoEstado: EstadoOrden) => {
        updateOrdenStatus(id, nuevoEstado).catch(error => console.error("Error estado:", error))
    }
    
    // --- HANDLERS DE PAGOS ---

    const handleOpenPaymentModal = (orden: OrdenServicio) => {
        setOrdenForPayment(orden)
        setIsPaymentModalOpen(true) 
    }
    
    const handlePaymentUpdate = (abonoUSD: number, nota: string | undefined, imagenUrl?: string) => {
        if (!ordenForPayment) return;
        handleRegisterPaymentGlobal(ordenForPayment.id, abonoUSD, nota, imagenUrl)
            .then(() => {
                 setIsPaymentModalOpen(false); 
                 setOrdenForPayment(null);
            });
    }

    // 🔥 CORREGIDO: Evitamos pasar 'undefined' a Firebase
    const handleRegisterPaymentGlobal = async (ordenId: string, monto: number, nota?: string, imagenUrl?: string) => {
        const orden = ordenes.find(o => o.id === ordenId);
        if (!orden) return;

        const newTransaction: PagoTransaction = {
            montoUSD: monto,
            fechaRegistro: new Date().toISOString(),
            registradoPorUserId: currentUserId,
            nota: nota || null,
            // ⬇️ SOLUCIÓN: Usamos '|| null' para que nunca sea undefined
            // @ts-ignore
            imagenUrl: imagenUrl || null 
        };

        // @ts-ignore
        const currentHistorial: PagoTransaction[] = (orden as any).registroPagos || []; 
        const nuevoHistorial = [...currentHistorial, newTransaction];
        
        const nuevoMontoPagadoUSD = nuevoHistorial.reduce((sum, t) => sum + t.montoUSD, 0);

        let nuevoEstadoPago: EstadoPago = EstadoPago.PENDIENTE;
        if (nuevoMontoPagadoUSD >= (orden.totalUSD - 0.01)) {
            nuevoEstadoPago = EstadoPago.PAGADO;
        } else if (nuevoMontoPagadoUSD > 0.01) {
            nuevoEstadoPago = EstadoPago.ABONADO;
        }
        
        try {
            await updateOrdenPaymentLog(
                orden.id, 
                nuevoEstadoPago, 
                nuevoMontoPagadoUSD, 
                nuevoHistorial as PaymentLog[] 
            );
            console.log(`Pago registrado para orden ${orden.ordenNumero}`);
        } catch (error) {
             console.error("Fallo pago Firebase:", error);
             alert("Error al registrar el pago en la base de datos: " + (error as any).message);
             throw error;
        }
    }
    
    // --- UTILIDADES PDF ---
    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>, name: string, setState: any, setService: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 2*1024*1024) return alert("Máx 2MB");
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = reader.result as string;
            setState(b64); setService(b64); 
            alert(`${name} cargado.`);
          };
          reader.readAsDataURL(file);
        }
    };
    
    const handleGeneratePDF = (orden: OrdenServicio) => {
        if (!pdfLogoBase64) return alert("Falta logo para PDF.");
        const opts: PDFOptions = { bcvRate: currentBcvRate, firmaBase64, selloBase64 };
        generateOrderPDF(orden, pdfLogoBase64, opts);
    };

    // --- RENDER ---
    const navItems = [
      { id: 'orders', label: 'Órdenes de Servicio', icon: <FileText className="w-5 h-5" /> }, 
      { id: 'tasks', label: 'Mis Tareas', icon: <CheckCircle className="w-5 h-5" /> },
      { id: 'clients', label: 'Clientes y Cobranza', icon: <Users className="w-5 h-5" /> }, 
      { id: 'calculator', label: 'Presupuestos', icon: <Calculator className="w-5 h-5" /> }, 
      { id: 'old_calculator', label: 'Calculadora', icon: <Calculator className="w-5 h-5" /> }, 
    ];

    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar 
          activeView={activeView} 
          setActiveView={setActiveView as (view: string) => void} 
          navItems={navItems}
          onLogout={logout}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          
          <header className="flex justify-between items-center p-4 border-b bg-white dark:bg-gray-800">
            <h1 className="text-2xl font-bold pl-12 lg:pl-0">
              {navItems.find(i => i.id === activeView)?.label || "Dashboard"}
            </h1>
          </header>
          
          <main className="flex-1 overflow-y-auto">
              
              {activeView === "calculator" && (
                <div className="p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        <h2 className="text-3xl font-bold">Generador de Presupuestos</h2>
                        <BudgetEntryView 
                            currentBcvRate={currentBcvRate}
                            pdfLogoBase64={pdfLogoBase64}
                            handleLogoUpload={(e) => handleAssetUpload(e, 'Logo', setPdfLogoBase64, setLogoBase64)}
                            handleClearLogo={() => {setPdfLogoBase64(undefined); setLogoBase64(undefined);}}
                            firmaBase64={firmaBase64}
                            handleFirmaUpload={(e) => handleAssetUpload(e, 'Firma', setFirmaBase64State, setFirmaBase64)}
                            handleClearFirma={() => {setFirmaBase64State(undefined); setFirmaBase64(undefined);}}
                            selloBase64={selloBase64}
                            handleSelloUpload={(e) => handleAssetUpload(e, 'Sello', setSelloBase64State, setSelloBase64)}
                            handleClearSello={() => {setSelloBase64State(undefined); setSelloBase64(undefined);}}
                        />
                    </div>
                </div>
              )}
              
              {activeView === "old_calculator" && (
                <div className="p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        <h2 className="text-3xl font-bold">Calculadora de Produccion</h2>
                        <CalculatorView /> 
                    </div>
                </div>
              )}
              
              {activeView === "tasks" && (
                  <div className="p-4 lg:p-8">
                      <div className="max-w-7xl mx-auto">
                          <TasksView ordenes={ordenes} />
                      </div>
                  </div>
              )}
          
            {activeView === "orders" && (
              <div className="p-4 lg:p-8">
                <div className="max-w-7xl mx-auto">
                  
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Gestión de Órdenes de Servicio</h2>
                  </div>
                  
                  <div className="mb-6 w-full">
                      <BCVRateWidget initialRate={currentBcvRate} onRateChange={setCurrentBcvRate} />
                  </div>
                  
                  <div className="mb-8 flex justify-end">
                      <Button onClick={handleOpenCreate} className="h-10 px-4 py-2" size="sm">
                        <span className="flex items-center">
                            <Plus className="w-5 h-5 mr-2" /> Nueva Orden
                        </span>
                      </Button>
                  </div>
                  
                  <OrdersTable
                    ordenes={ordenes}
                    onDelete={handleDeleteOrden} 
                    onStatusChange={handleUpdateStatus}
                    onEdit={handleEditOrder} 
                    smrLogoBase64={pdfLogoBase64}
                    bcvRate={currentBcvRate}
                  />
                </div>
              </div>
            )}

            {activeView === "clients" && (
              <div className="p-4 lg:p-8">
                <div className="max-w-7xl mx-auto">
                  <ClientsAndPaymentsView 
                      ordenes={ordenes} 
                      onRegisterPayment={handleRegisterPaymentGlobal} 
                      bcvRate={currentBcvRate} 
                      currentUserId={currentUserId} 
                  />
                </div>
              </div>
            )}
            
          </main>
        </div>
        
        {/* --- MODAL WIZARD UNIFICADO (CREAR/EDITAR) --- */}
        <Dialog open={isWizardOpen} onOpenChange={(open) => {
            setIsWizardOpen(open);
            if(!open) setEditingOrder(null); 
        }}>
            <DialogContent className="max-w-6xl w-[95vw] h-full max-h-[95vh] sm:max-h-[95vh] sm:max-w-4xl lg:max-w-6xl p-6 sm:p-8 flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-2xl font-bold">
                        {editingOrder ? `Editar Orden #${editingOrder.ordenNumero}` : 'Crear Nueva Orden'}
                    </DialogTitle>
                </DialogHeader>
                <OrderFormWizardV2 
                    onSave={handleSaveOrder} 
                    onClose={() => { setIsWizardOpen(false); setEditingOrder(null); }}
                    ordenToEdit={editingOrder} 
                    className="flex-grow"
                />
            </DialogContent>
        </Dialog>

        {/* MODAL PAGO (Para la vista de órdenes) */}
        {ordenForPayment && (
          <PaymentEditModal
            isOpen={isPaymentModalOpen}
            orden={ordenForPayment}
            onClose={() => {setIsPaymentModalOpen(false); setOrdenForPayment(null);}}
            onSave={(abonoUSD, nota, imagenUrl) => handlePaymentUpdate(abonoUSD, nota, imagenUrl)}
            currentUserId={currentUserId} 
            // @ts-ignore
            historialPagos={(ordenForPayment as any).registroPagos} 
          />
        )}
        
        <TrialExpirationModal />
      </div>
    )
}