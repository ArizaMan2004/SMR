// @/components/orden/dashboard.tsx

"use client"

import { useAuth } from "@/lib/auth-context"
import { useEffect, useState } from "react"
import React from 'react'; 
// --- Importaciones de UI ---
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"


// Componentes de Vistas y Layout
import Sidebar from "@/components/dashboard/sidebar"
import TrialExpirationModal from "@/components/dashboard/trial-expiration-modal"
import { OrderFormWizardV2 } from "@/components/orden/order-form-wizard"
import { OrdersTable } from "@/components/orden/orders-table"
import { BCVRateWidget } from "@/components/orden/bvc-rate-widget" 
// VISTAS DE PAGO
import { ClientsAndPaymentsView } from "@/components/dashboard/ClientsAndPaymentsView"
import { PaymentEditModal } from "@/components/dashboard/PaymentEditModal" 
import { type PagoTransaction } from "@/components/orden/PaymentHistoryView" 

// NUEVO: Importación de la vista de tareas
import TasksView from "@/components/dashboard/tasks-view"
// 🔑 MODIFICACIÓN: Importamos la nueva vista de Presupuestos
import BudgetEntryView from "@/components/dashboard/BudgetEntryView" 
// ✅ RE-IMPORTACIÓN: Importamos la vista original de la Calculadora (Ajusta la ruta si es necesario)
import CalculatorView from "@/components/dashboard/CalculatorView" 

// Iconos
import { 
    Plus, DollarSign, Users, Upload, Trash2, LogOut, Image, Handshake, Stamp, 
    CheckCircle, FileText, Package, BarChart, Activity, ClipboardList,
    Calculator 
} from "lucide-react" 

// Tipos y Servicios 
import { type OrdenServicio, EstadoOrden, EstadoPago, type PaymentLog } from "@/lib/types/orden"
import { subscribeToOrdenes, deleteOrden, updateOrdenStatus, createOrden, updateOrdenPaymentLog } from "@/lib/services/ordenes-service"
import { getBCVRate } from "@/lib/bcv-service"
import { 
    getLogoBase64, setLogoBase64, 
    getFirmaBase64, setFirmaBase64, 
    getSelloBase64, setSelloBase64      
} from "@/lib/logo-service" 

import { generateOrderPDF, type PDFOptions } from "@/lib/services/pdf-generator"; 

// --- TIPOS ---
// 💡 CAMBIO 1: Se añade 'old_calculator' para separar las vistas en la navegación
type ActiveView = "orders" | "clients" | "tasks" | "calculator" | "old_calculator" 
type OrdenEditable = OrdenServicio | null


export default function Dashboard() {
    const { user, logout } = useAuth() 
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [currentBcvRate, setCurrentBcvRate] = useState<number>(() => getBCVRate().rate || 0); 
    const [activeView, setActiveView] = useState<ActiveView>("orders") 
    const [isModalOpen, setIsModalOpen] = useState(false) 
    const [isPaymentModalOpen, setIsPaymentModal] = useState(false) 
    const [ordenToModify, setOrdenToModify] = useState<OrdenEditable>(null) 
    const currentUserId = user?.uid || "mock-user-admin-123"
    
    // Estados para Logo, Firma y Sello
    const [pdfLogoBase64, setPdfLogoBase64] = useState<string | undefined>(undefined); 
    const [firmaBase64, setFirmaBase64State] = useState<string | undefined>(undefined); 
    const [selloBase64, setSelloBase64State] = useState<string | undefined>(undefined); 

    // --- LÓGICA DE DATOS Y EFECTOS ---
    useEffect(() => {
        // 💡 CAMBIO 2: Se incluye 'old_calculator' en la lista para asegurar que el efecto corra 
        // y cargue el BCV Rate y los assets de PDF, que son necesarios para ambas vistas.
        if (!user || (activeView !== "orders" && activeView !== "clients" && activeView !== "tasks" && activeView !== "calculator" && activeView !== "old_calculator")) return 
        
        getBCVRate().rate ? setCurrentBcvRate(getBCVRate().rate) : null;
        getLogoBase64().then(setPdfLogoBase64);
        setFirmaBase64State(getFirmaBase64()); 
        setSelloBase64State(getSelloBase64()); 
        
        const unsubscribe = subscribeToOrdenes(
            currentUserId, 
            (ordenesData, error) => {
                if (error) {
                    console.error("Error en la suscripción de órdenes:", error);
                    setOrdenes([]); 
                    return;
                }
                setOrdenes(ordenesData);
            }
        )
        
        return () => unsubscribe()
    }, [user, activeView, currentUserId])
    
    const handleDeleteOrden = (id: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta orden?")) {
            deleteOrden(id).catch(error => console.error("Error al eliminar:", error))
        }
    }

    const handleUpdateStatus = (id: string, nuevoEstado: EstadoOrden) => {
        updateOrdenStatus(id, nuevoEstado).catch(error => console.error("Error al actualizar estado:", error))
    }
    
    const handleEditOrden = (orden: OrdenServicio) => {
        setOrdenToModify(orden)
        setIsModalOpen(true)
    }

    const handleEditPayment = (orden: OrdenServicio) => {
        setOrdenToModify(orden)
        setIsPaymentModal(true) 
    }
    
    const handlePaymentUpdate = (abonoUSD: number, nota: string | undefined) => {
        if (!ordenToModify) return;

        const newTransaction: PagoTransaction = {
            montoUSD: abonoUSD,
            fechaRegistro: new Date().toISOString(),
            registradoPorUserId: currentUserId,
            nota: nota || null,
        };

        // @ts-ignore
        const currentHistorial: PagoTransaction[] = (ordenToModify as any).registroPagos || []; 
        const nuevoHistorial = [...currentHistorial, newTransaction];
        
        const nuevoMontoPagadoUSD = nuevoHistorial.reduce((sum, t) => sum + t.montoUSD, 0);

        let nuevoEstadoPago: EstadoPago = EstadoPago.PENDIENTE;
        if (nuevoMontoPagadoUSD >= ordenToModify.totalUSD) {
            nuevoEstadoPago = EstadoPago.PAGADO;
        } else if (nuevoMontoPagadoUSD > 0) {
            nuevoEstadoPago = EstadoPago.ABONADO;
        }
        
        updateOrdenPaymentLog(
            ordenToModify.id, 
            nuevoEstadoPago, 
            nuevoMontoPagadoUSD, 
            nuevoHistorial as PaymentLog[] 
        )
            .then(() => {
                setIsPaymentModal(false); 
                setOrdenToModify(null);
            })
            .catch(error => {
                console.error("Fallo al guardar el pago en Firebase:", error);
            })
    }
    
    
    // 🔑 Función genérica de carga de archivos
    const handleAssetUpload = (
        event: React.ChangeEvent<HTMLInputElement>,
        assetName: 'Logo' | 'Firma' | 'Sello',
        setState: React.Dispatch<React.SetStateAction<string | undefined>>,
        setService: (base64: string | undefined) => void
    ) => {
        const file = event.target.files?.[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) { 
              alert(`El archivo de ${assetName} es demasiado grande (máx 2MB).`);
              return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            setState(base64String);
            setService(base64String); 
            alert(`${assetName} cargado y listo para usar en los PDFs.`);
            event.target.value = ''; 
          };
          reader.readAsDataURL(file);
        }
    };
    
    // Funciones de conveniencia para LOGO
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleAssetUpload(event, 'Logo', setPdfLogoBase64, setLogoBase64);
    };
    const handleClearLogo = () => {
        if(window.confirm("¿Estás seguro de que quieres eliminar el logo guardado para los PDFs?")) {
          setPdfLogoBase64(undefined);
          setLogoBase64(undefined);
          alert("Logo PDF eliminado.");
        }
    };
    
    // 🔑 Funciones de conveniencia para FIRMA
    const handleFirmaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleAssetUpload(event, 'Firma', setFirmaBase64State, setFirmaBase64);
    };
    const handleClearFirma = () => {
        if(window.confirm("¿Estás seguro de que quieres eliminar la firma guardada para los PDFs?")) {
          setFirmaBase64State(undefined);
          setFirmaBase64(undefined);
          alert("Firma PDF eliminada.");
        }
    };
    
    // 🔑 Funciones de conveniencia para SELLO
    const handleSelloUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleAssetUpload(event, 'Sello', setSelloBase64State, setSelloBase64);
    };
    const handleClearSello = () => {
        if(window.confirm("¿Estás seguro de que quieres eliminar el sello guardado para los PDFs?")) {
          setSelloBase64State(undefined);
          setSelloBase64(undefined);
          alert("Sello PDF eliminado.");
        }
    };
    
    // 🔑 FUNCIÓN PARA GENERAR EL PDF
    const handleGeneratePDF = (orden: OrdenServicio) => {
        if (!pdfLogoBase64) {
            console.error("El logo Base64 no está cargado.");
            alert("No se puede generar el PDF: Falta el logo de la compañía.");
            return;
        }

        const pdfOptions: PDFOptions = {
            bcvRate: currentBcvRate,
            firmaBase64: firmaBase64, 
            selloBase64: selloBase64, 
        };

        generateOrderPDF(
            orden,
            pdfLogoBase64, 
            pdfOptions
        );
    };

    
    // Manejador para cerrar sesión
    const handleLogout = () => {
        logout();
    }
    
    // Definición del menú de navegación.
    const navItems = [
      { id: 'orders', label: 'Órdenes de Servicio', icon: <FileText className="w-5 h-5" /> }, 
      { id: 'tasks', label: 'Mis Tareas', icon: <CheckCircle className="w-5 h-5" /> },
      { id: 'clients', label: 'Clientes y Cobranza', icon: <Users className="w-5 h-5" /> }, 
      // 💡 CAMBIO 3: 'Presupuestos' ahora es solo para el nuevo componente
      { id: 'calculator', label: 'Presupuestos', icon: <Calculator className="w-5 h-5" /> }, 
      // 💡 CAMBIO 3: Se añade un nuevo ítem de navegación para la vista original
      { id: 'old_calculator', label: 'Calculadora', icon: <Calculator className="w-5 h-5" /> }, 
    ];
    

    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar 
          activeView={activeView} 
          setActiveView={setActiveView as (view: string) => void} 
          navItems={navItems}
          onLogout={handleLogout}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          
          <header className="flex justify-between items-center p-4 border-b bg-white dark:bg-gray-800">
            <h1 className="text-2xl font-bold">
              {navItems.find(i => i.id === activeView)?.label || "Dashboard"}
            </h1>
          </header>
          
          <main className="flex-1 overflow-y-auto">
              
              {/* 🎯 SECCIÓN PRESUPUESTOS (NUEVA VISTA) - Únicamente BudgetEntryView */}
              {/* 💡 CAMBIO 4: Este bloque ahora solo renderiza BudgetEntryView */}
              {activeView === "calculator" && (
                <div className="p-4 lg:p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-8">
                        
                        <h2 className="text-3xl font-bold">Generador de Presupuestos</h2>
                        <BudgetEntryView 
                            currentBcvRate={currentBcvRate}
                            pdfLogoBase64={pdfLogoBase64}
                            handleLogoUpload={handleLogoUpload}
                            handleClearLogo={handleClearLogo}
                            firmaBase64={firmaBase64}
                            handleFirmaUpload={handleFirmaUpload}
                            handleClearFirma={handleClearFirma}
                            selloBase64={selloBase64}
                            handleSelloUpload={handleSelloUpload}
                            handleClearSello={handleClearSello}
                        />
                    </div>
                </div>
              )}
              
              {/* 🎯 SECCIÓN CALCULADORA ORIGINAL - Únicamente CalculatorView */}
              {/* 💡 CAMBIO 4: Nuevo bloque para la calculadora original */}
              {activeView === "old_calculator" && (
                <div className="p-4 lg:p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-8">
                        <h2 className="text-3xl font-bold">Calculadora de Produccion</h2>
                        <CalculatorView /> 
                    </div>
                </div>
              )}
              
              {/* VISTA: MIS TAREAS */}
              {activeView === "tasks" && (
                  <div className="p-4 lg:p-8 overflow-y-auto">
                      <div className="max-w-7xl mx-auto">
                          <TasksView ordenes={ordenes} />
                      </div>
                  </div>
              )}
          
            {/* VISTA DE ÓRDENES DE SERVICIO */}
            {activeView === "orders" && (
              <div className="p-4 lg:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                  
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Gestión de Órdenes de Servicio</h2>
                  </div>
                  
                  {/* BCV Rate Widget - A ancho completo */}
                  <div className="mb-6 w-full">
                      <BCVRateWidget initialRate={currentBcvRate} onRateChange={setCurrentBcvRate} />
                  </div>
                  
                  {/* Contenedor de solo el botón Nueva Orden */}
                  <div className="mb-8 flex justify-end">
                      
                      {/* Botón de Nueva Orden */}
                      <Dialog open={isModalOpen && !ordenToModify} onOpenChange={setIsModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-10 px-4 py-2 flex-shrink-0" size="sm">
                              <span className="flex items-center">
                                  <Plus className="w-5 h-5 mr-2" /> Nueva Orden
                              </span>
                            </Button>
                        </DialogTrigger>
                        
                        <DialogContent 
                          className="max-w-6xl w-[95vw] h-full max-h-[95vh] sm:max-h-[95vh] sm:max-w-4xl lg:max-w-6xl p-6 sm:p-8 flex flex-col"
                        > 
                          <DialogHeader className="flex-shrink-0">
                            <DialogTitle className="text-2xl font-bold">Crear Nueva Orden de Servicio</DialogTitle>
                          </DialogHeader>
                          <OrderFormWizardV2 
                            onSave={(data) => {createOrden(data); setIsModalOpen(false);}} 
                            onClose={() => setIsModalOpen(false)}
                            className="flex-grow"
                          />
                        </DialogContent>
                      </Dialog>
                  </div>
                  {/* Fin Contenedor del Botón */}
                  
                  <OrdersTable
                    ordenes={ordenes}
                    onDelete={handleDeleteOrden} 
                    onStatusChange={handleUpdateStatus}
                    onGeneratePDF={handleGeneratePDF} 
                    onEditOrder={handleEditOrden} 
                    onOpenPaymentModal={handleEditPayment} 
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
                      onEditPayment={handleEditPayment} 
                      bcvRate={currentBcvRate} 
                      currentUserId={currentUserId} 
                  />
                </div>
              </div>
            )}
            
          </main>
        </div>
        
        {/* MODAL DE EDICIÓN DE ORDEN */}
        <Dialog open={isModalOpen && !!ordenToModify} onOpenChange={(open) => {setIsModalOpen(open); if(!open) setOrdenToModify(null);}}>
            {ordenToModify && (
                <DialogContent className="max-w-6xl w-[95vw] h-full max-h-[95vh] sm:max-h-[95vh] sm:max-w-4xl lg:max-w-6xl p-6 sm:p-8 flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-2xl font-bold">Editar Orden de Servicio #{ordenToModify.ordenNumero}</DialogTitle>
                    </DialogHeader>
                    <OrderFormWizardV2 
                        initialData={ordenToModify} 
                        onSave={(data) => { console.log("Guardando edición:", data); setIsModalOpen(false); setOrdenToModify(null);}} 
                        onClose={() => {setIsModalOpen(false); setOrdenToModify(null);}} 
                        className="flex-grow"
                    />
                </DialogContent>
            )}
        </Dialog>

        {/* MODAL DE EDICIÓN DE PAGO */}
        {ordenToModify && (
          <PaymentEditModal
            isOpen={isPaymentModalOpen}
            orden={ordenToModify}
            onClose={() => {setIsPaymentModal(false); setOrdenToModify(null);}}
            onSave={(abonoUSD, nota) => handlePaymentUpdate(abonoUSD, nota)}
            currentUserId={currentUserId} 
            // @ts-ignore
            historialPagos={(ordenToModify as any).registroPagos} 
          />
        )}
        
        <TrialExpirationModal />
      </div>
    )
}