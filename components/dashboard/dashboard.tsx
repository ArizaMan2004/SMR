// @/components/orden/dashboard.tsx
"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"

// --- IMPORTACIONES PARA FIREBASE ---
import { db } from "@/lib/firebase"
import { doc, updateDoc, arrayUnion, collection, onSnapshot } from "firebase/firestore"

// UI - Shadcn
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner" 

// Componentes SMR
import Sidebar from "@/components/dashboard/sidebar"
import { OrdersTable } from "@/components/orden/orders-table"
import { ClientsAndPaymentsView } from "@/components/dashboard/ClientsAndPaymentsView"
import { NotificationCenter, type Notification } from "@/components/dashboard/NotificationCenter"
import { OrderFormWizardV2 } from "@/components/orden/order-form-wizard"
import { DesignerPayrollView } from "@/components/dashboard/DesignerPayrollView" 
import TasksView from "@/components/dashboard/tasks-view"
import BudgetEntryView from "@/components/dashboard/BudgetEntryView" 
import CalculatorView from "@/components/dashboard/CalculatorView" 
import { CurrencyToast } from "@/components/dashboard/CurrencyToast" 
import { WalletsView } from "@/components/dashboard/WalletsView"
import { PaymentEditModal } from "@/components/dashboard/PaymentEditModal"
import { PaymentAuditView } from "@/components/dashboard/PaymentAuditView"
import { NewsBar, type NewsAction } from "@/components/dashboard/news-bar" 
import { OrderDetailModal } from "@/components/orden/order-detail-modal" 

// --- IMPORTACIONES DE HERRAMIENTAS IA Y DISEÑO ---
import { BackgroundRemoverView } from "@/components/dashboard/BackgroundRemoverView" 
import { UpscaleView } from "@/components/dashboard/UpscaleView"
import { FormatConverterView } from "@/components/dashboard/FormatConverterView" 

// Componentes Administrativos y de Perfil
import { GastosFijosView } from "@/components/dashboard/gastos-fijos-view"
import { InsumosView } from "@/components/dashboard/InsumosView"
import InventoryView from "@/components/dashboard/inventoryView" 
import { EmpleadosView } from "@/components/dashboard/empleados-view"
import { EstadisticasDashboard } from "@/components/dashboard/estadisticas-dashboard"
import { NotificationCenterExpenses, type NotificationGasto } from "@/components/dashboard/notification-center-expenses"
import { UsersManagementView } from "@/components/dashboard/UsersManagementView" 
import { ProfileSettingsView } from "@/components/dashboard/ProfileSettingsView"
import { EmployeeFinancesView } from "@/components/dashboard/EmployeeFinancesView"

// Controlador del Tutorial
import { startTour } from "@/components/dashboard/TutorialController" 

// Iconos
import { 
    Plus, CheckCircle, Calculator, LayoutDashboard, FileSpreadsheet, Clock, 
    Building2, Bell, CheckCircle2, ChevronLeft, Menu, DollarSign, Euro, Coins, 
    Wallet, Search, HelpCircle, AlertCircle, Loader2, ShieldCheck 
} from "lucide-react" 

// Servicios
import { type OrdenServicio } from "@/lib/types/orden"
import { 
    subscribeToOrdenes, deleteOrden, createOrden, actualizarOrden, 
    getTotalOrdenesCount, buscarOrdenEspecifica, getOrdenesStatsFromServer,
    buscarOrdenesHistoricas 
} from "@/lib/services/ordenes-service"
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"
import { 
    subscribeToPagos, subscribeToGastos, subscribeToGastosFijos, 
    subscribeToEmpleados, subscribeToNotifications, deleteGastoInsumo, 
    createNotification, deleteNotification, updateNotificationStatus, createGasto 
} from "@/lib/services/gastos-service"
import { subscribeToClients } from "@/lib/services/clientes-service"
import { syncAllOrdersClientStatus } from "@/lib/services/maintenance-service"

import { fetchBCVRateFromAPI, getBCVRateFromStorage } from "@/lib/services/bcv-service"
import { 
    getLogoBase64, setLogoBase64, getFirmaBase64, setFirmaBase64, 
    getSelloBase64, setSelloBase64 
} from "@/lib/logo-service" 
import { cn } from "@/lib/utils"
import type { GastoFijo, Empleado, PagoEmpleado } from "@/lib/types/gastos"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };
type ActiveView = string; 

export default function Dashboard() {
    const { user, userData, logout } = useAuth()
    const currentUserId = user?.uid

    // --- 1. ESTADOS DE UI ---
    const [activeView, setActiveView] = useState<ActiveView>("orders") 
    const [isSidebarOpen, setIsSidebarOpen] = useState(true) 
    
    // REDIRECCIÓN MÁGICA
    useEffect(() => {
        if (userData) {
            const productionRoles = ['DISENADOR', 'IMPRESOR', 'OPERADOR_LASER', 'PRODUCCION', 'EMPLEADO'];
            if (productionRoles.includes(userData.rol)) {
                if (activeView === "orders") {
                    setActiveView("tasks_taller");
                }
            }
        }
    }, [userData, activeView]);
    
    const [searchTerm, setSearchTerm] = useState("") 
    const [isSearchingDeep, setIsSearchingDeep] = useState(false)

    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [editingOrder, setEditingOrder] = useState<OrdenServicio | null>(null)
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [selectedOrdenForPayment, setSelectedOrdenForPayment] = useState<OrdenServicio | null>(null)

    const [cardModalState, setCardModalState] = useState<{ isOpen: boolean, type: 'total' | 'sinPagar' | 'abonadas' | 'pagadas' | null }>({ isOpen: false, type: null })
    const [cardSortBy, setCardSortBy] = useState<'reciente' | 'mayor_deuda' | 'mayor_abono' | 'numero_orden' | 'cliente'>('reciente')

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<OrdenServicio | null>(null)

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
    
    // ESTADOS DE ÓRDENES Y BÚSQUEDA HISTÓRICA
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [ordenesHistoricas, setOrdenesHistoricas] = useState<OrdenServicio[]>([]) // <-- ESTADO BLINDADO
    
    const [totalHistoricoOrdenes, setTotalHistoricoOrdenes] = useState<number>(0) 
    const [realBillingStats, setRealBillingStats] = useState<{sinPagar: number, abonadas: number, pagadas: number} | null>(null)

    const [designers, setDesigners] = useState<Designer[]>([]) 
    const [gastos, setGastos] = useState<any[]>([])
    const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [pagos, setPagos] = useState<PagoEmpleado[]>([]) 
    const [clientes, setClientes] = useState<any[]>([])
    const [movimientosCaja, setMovimientosCaja] = useState<any[]>([]) 

    // --- 3. NAV ITEMS ---
    const navItems = useMemo(() => [
        { id: 'orders', label: 'Facturación y Cierre', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['ADMIN', 'VENDEDOR'] },
        { id: 'tasks_taller', label: 'Taller de Producción', icon: <CheckCircle className="w-4 h-4" /> },
        { id: 'my_finances', label: 'Mis Finanzas', icon: <Wallet className="w-4 h-4" /> },
        {
            id: 'admin_group',
            label: 'Administración SMR',
            icon: <Building2 className="w-4 h-4" />,
            roles: ['ADMIN'],
            children: [
                { id: 'wallets', label: 'Billeteras & Caja' },
                { id: 'payment_audit', label: 'Auditoría de Pagos' },
                { id: 'financial_stats', label: 'Balance y Estadísticas' },
                { id: 'clients', label: 'Cobranza' },
                { id: 'design_production', label: 'Pago Diseños' },
                { id: 'fixed_expenses', label: 'Gastos Fijos' },
                { id: 'insumos_mgmt', label: 'Insumos y Materiales' },
                { id: 'inventory_general', label: 'Inventario General' },
                { id: 'employees_mgmt', label: 'Gestión de Personal' },
            ]
        },
        { id: 'users_auth', label: 'Accesos y Roles', icon: <ShieldCheck className="w-4 h-4" />, roles: ['ADMIN'] },
        {
            id: 'tools_group',
            label: 'Herramientas',
            icon: <Calculator className="w-4 h-4" />, 
            children: [
                { id: 'calculator', label: 'Presupuestos (PDF)', roles: ['ADMIN', 'VENDEDOR'] },
                { id: 'old_calculator', label: 'Calculadora de Producción' },
                { id: 'ai_background', label: 'IA Quita Fondos' },
                { id: 'ai_upscale', label: 'IA Upscale (HD)' },
                { id: 'format_converter', label: 'Convertidor Formatos' },
            ]
        },
    ], []);

    // --- 4. SÚPER LISTA UNIFICADA ---
    const todasLasOrdenes = useMemo(() => {
        const map = new Map<string, OrdenServicio>();
        // Históricas primero
        ordenesHistoricas.forEach(o => map.set(o.id, o));
        // Recientes (sobreescriben si hay duplicados, para tener la data más fresca)
        ordenes.forEach(o => map.set(o.id, o)); 
        
        return Array.from(map.values()).sort((a, b) => (b.ordenNumero || 0) - (a.ordenNumero || 0));
    }, [ordenes, ordenesHistoricas]);

    // --- 5. MANEJADORES ---
    const handleOpenPaymentModal = useCallback((orden: OrdenServicio) => {
        setSelectedOrdenForPayment(orden);
        setIsPaymentModalOpen(true);
    }, []);

    const handleOpenOrderDetails = useCallback((orden: OrdenServicio) => {
        setSelectedOrderForDetails(orden);
        setIsDetailModalOpen(true);
    }, []);

    const handleNewsAction = useCallback((action: NewsAction) => {
        if (action.type === 'NAVIGATE') {
            setActiveView(action.payload);
        } else if (action.type === 'OPEN_ORDER') {
            handleOpenPaymentModal(action.payload);
        } else if (action.type === 'VIEW_ORDER_DETAILS') {
            handleOpenOrderDetails(action.payload);
        }
    }, [handleOpenPaymentModal, handleOpenOrderDetails]);

    const handleSendCalcToOrder = (calc: any, type: 'area' | 'laser') => {
        const mappedItems = type === 'area' 
            ? calc.mediciones.map((m: any) => ({
                nombre: m.name || "Pieza de Área", cantidad: m.cantidad || 1, precioUnitario: m.precioDolar,
                medidaXCm: m.cmAncho, medidaYCm: m.cmAlto, unidad: 'm2', tipoServicio: 'OTROS'
              }))
            : (calc.tiempos || calc.items).map((t: any) => {
                const isService = t.type === 'service';
                return {
                    nombre: t.name || "Trabajo Láser", cantidad: isService ? t.qty : 1,
                    precioUnitario: isService ? t.unitPrice : ((t.minutes + t.seconds/60) * 0.80 + (t.materialCost || 0)),
                    unidad: 'und', tipoServicio: 'CORTE_LASER'
                };
              });

        setEditingOrder({
            cliente: { nombreRazonSocial: calc.name.toUpperCase(), tipoCliente: "REGULAR" },
            items: mappedItems, descripcionDetallada: `CÁLCULO DE ${type === 'area' ? 'ÁREA' : 'LÁSER'} IMPORTADO AUTOMÁTICAMENTE.`
        } as any);
        setIsWizardOpen(true);
        toast.success("Cálculo cargado en el terminal de ventas");
    };

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

    const handleDeleteNotification = useCallback(async (id: string) => await deleteNotification(id), []);

    const handleToggleRead = useCallback(async (id: string) => {
        const noti = systemEvents.find(n => n.id === id);
        if (noti) await updateNotificationStatus(id, !noti.isRead);
    }, [systemEvents]);

    const handleUpdateRate = useCallback(async (label: string) => {
        if (!currentUserId) return;
        let newValue = 0;
        try {
            if (label === "USD" || label === "EUR") {
                const data = await fetchBCVRateFromAPI();
                setCurrentBcvRate(data.usd); setEurRate(data.eur || 0);
                newValue = label === "USD" ? data.usd : data.eur;
            } else if (label === "USDT") {
                const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                const data = await res.json();
                if (data?.promedio) { setParallelRate(data.promedio); newValue = data.promedio; }
            }
            setRateToastMessage(`Valor ${label} actualizado a Bs. ${newValue.toFixed(2)}`);
            setShowRateToast(true); setTimeout(() => setShowRateToast(false), 4000);
        } catch (error) { console.error(error); }
    }, [currentUserId]);

    const handleRegisterOrderPayment = async (ordenId: string, monto: number, nota?: string, imagenUrl?: string, metodo?: string, descuento?: number) => {
        try {
            // Usamos la súper lista para encontrar la orden
            const ordenActual = todasLasOrdenes.find(o => o.id === ordenId);
            if (!ordenActual) return;
            
            const ordenRef = doc(db, "ordenes", ordenId);
            const montoPagadoAnterior = Number(ordenActual.montoPagadoUSD) || 0;
            const descuentoAplicado = descuento || 0;
            const nuevoMontoTotalPagado = montoPagadoAnterior + monto + descuentoAplicado;
            const saldoRestante = ordenActual.totalUSD - nuevoMontoTotalPagado;
            const nuevoEstadoPago = saldoRestante <= 0.01 ? "PAGADO" : "ABONADO";

            const pagosAGuardar = [{
                montoUSD: monto, fecha: new Date().toISOString(), nota: nota || "",
                imagenUrl: imagenUrl || "", tasaBCV: currentBcvRate, metodo: metodo || "Efectivo USD" 
            }];

            if (descuentoAplicado > 0) {
                pagosAGuardar.push({
                    montoUSD: descuentoAplicado, fecha: new Date().toISOString(), nota: "Ajuste/Descuento por cierre de orden",
                    imagenUrl: "", tasaBCV: 0, metodo: "DESCUENTO" 
                });
            }

            await updateDoc(ordenRef, {
                montoPagadoUSD: nuevoMontoTotalPagado,
                estadoPago: nuevoEstadoPago,
                registroPagos: arrayUnion(...pagosAGuardar)
            });
            
            let descNoti = `Ingreso de $${monto} (${metodo || "Caja"}) - Orden #${ordenActual.ordenNumero}`;
            if(descuentoAplicado > 0) descNoti += ` + Ajuste de $${descuentoAplicado.toFixed(2)}`;

            await createNotification({ title: "Pago Registrado", description: descNoti, type: 'success', category: 'system' });
            toast.success("Pago registrado correctamente");
            setIsPaymentModalOpen(false); 
        } catch (error) {
            console.error("❌ Error al registrar pago:", error);
            toast.error("Error al registrar el pago");
        }
    };

    const handleDeepSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.trim() !== '') {
            setIsSearchingDeep(true);
            try {
                const resultados = await buscarOrdenesHistoricas(searchTerm);

                if (resultados && resultados.length > 0) {
                    toast.success(`Se encontraron ${resultados.length} coincidencias en el historial.`);
                    
                    // Inyectamos resultados en el estado blindado
                    setOrdenesHistoricas(prev => {
                        const nuevas = [...prev];
                        resultados.forEach(res => {
                            if (!nuevas.find(o => o.id === res.id)) nuevas.push(res);
                        });
                        return nuevas;
                    });

                    // Si es solo una orden y es un número exacto, abrimos el detalle directo
                    if (resultados.length === 1 && !isNaN(Number(searchTerm))) {
                        handleOpenOrderDetails(resultados[0]);
                    }
                } else {
                    toast.error(`No se encontraron registros históricos para "${searchTerm}".`);
                }
            } catch (error) {
                console.error("Error en búsqueda profunda:", error);
                toast.error("Error al conectar con la base de datos histórica.");
            } finally {
                setIsSearchingDeep(false);
            }
        }
    };

    // --- 6. CARGA DE DATOS ---
    useEffect(() => {
        const cached = getBCVRateFromStorage();
        if (cached.usd > 0) { setCurrentBcvRate(cached.usd); setEurRate(cached.eur || 0); }

        fetchBCVRateFromAPI().then(data => { setCurrentBcvRate(data.usd); setEurRate(data.eur || 0); });
        fetch('https://ve.dolarapi.com/v1/dolares/paralelo').then(res => res.json()).then(data => { if (data?.promedio) setParallelRate(data.promedio); });
        
        Promise.all([getLogoBase64(), getFirmaBase64(), getSelloBase64()]).then(([l, f, s]) => { setAssets({ logo: l || "", firma: f || "", sello: s || "" }); });

        getTotalOrdenesCount().then(total => { if (total > 0) setTotalHistoricoOrdenes(total); });
        getOrdenesStatsFromServer().then(stats => { if (stats) setRealBillingStats(stats); });

        const unsubNotis = subscribeToNotifications((data) => {
            setSystemEvents(data.filter(n => n.category !== 'expense'));
            setExpenseEvents(data.filter(n => n.category === 'expense') as any);
        });

        return () => unsubNotis();
    }, []);

    // Escuchador en tiempo real para las Órdenes Históricas (Blindaje de Búsqueda)
    useEffect(() => {
        if (ordenesHistoricas.length === 0) return;
        
        const unsubs = ordenesHistoricas.map(ord => 
            onSnapshot(doc(db, "ordenes", ord.id), (docSnap) => {
                if (docSnap.exists()) {
                    const dataActualizada = { id: docSnap.id, ...docSnap.data() } as OrdenServicio;
                    setOrdenesHistoricas(prev => prev.map(o => o.id === ord.id ? dataActualizada : o));
                }
            })
        );

        return () => unsubs.forEach(unsub => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ordenesHistoricas.map(o => o.id).join(',')]);

    useEffect(() => {
        const viewsRequiringOrders = ["orders", "financial_stats", "wallets", "payment_audit", "design_production", "clients", "notifications_full", "tasks_taller"];
        let unsubOrdenes = () => {};
        let unsubClientes = () => {};

        if (viewsRequiringOrders.includes(activeView)) {
            unsubOrdenes = subscribeToOrdenes("", (data) => setOrdenes(data));
            unsubClientes = subscribeToClients((data) => setClientes(data));
        }
        return () => { unsubOrdenes(); unsubClientes(); };
    }, [activeView]);

    useEffect(() => {
        const viewsRequiringGastos = ["orders", "fixed_expenses", "insumos_mgmt", "financial_stats", "wallets", "payment_audit"];
        let unsubGastos = () => {};
        let unsubGastosFijos = () => {};

        if (viewsRequiringGastos.includes(activeView)) {
            unsubGastos = subscribeToGastos((data) => setGastos(data));
            unsubGastosFijos = subscribeToGastosFijos((data) => setGastosFijos(data));
        }
        return () => { unsubGastos(); unsubGastosFijos(); };
    }, [activeView]);

    useEffect(() => {
        let unsubEmpleados = () => {};
        let unsubPagos = () => {};
        let unsubDesigners = () => {};
        let unsubMovimientosCaja = () => {};

        if (["orders", "employees_mgmt", "financial_stats", "wallets", "payment_audit", "my_finances"].includes(activeView)) {
            unsubEmpleados = subscribeToEmpleados((data) => setEmpleados(data));
            unsubPagos = subscribeToPagos((data) => setPagos(data));
        }
        
        if (["orders", "design_production"].includes(activeView)) {
            unsubDesigners = subscribeToDesigners((data) => setDesigners(data));
        }

        if (activeView === "wallets") {
            unsubMovimientosCaja = onSnapshot(collection(db, "movimientos_caja"), (snapshot) => {
                setMovimientosCaja(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        }
        return () => { unsubEmpleados(); unsubPagos(); unsubDesigners(); unsubMovimientosCaja(); };
    }, [activeView]);


    // --- 7. LÓGICA DE NOTIFICACIONES Y FILTROS ---
    const allNotifications = useMemo(() => {
        let all: Notification[] = [...systemEvents];
        // Utilizamos la súper lista
        todasLasOrdenes.forEach(o => {
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
    }, [todasLasOrdenes, systemEvents]);

    const filteredOrdenes = useMemo(() => {
        const term = searchTerm.toLowerCase();
        // Usamos la súper lista
        return todasLasOrdenes.filter((o) => {
            const nOrden = String(o.ordenNumero || "");
            const cliente = String(o.cliente?.nombreRazonSocial || "").toLowerCase();
            return nOrden.includes(term) || cliente.includes(term);
        });
    }, [todasLasOrdenes, searchTerm]);

    const billingStats = useMemo(() => {
        // Usamos la súper lista
        const total = todasLasOrdenes.length;
        const sinPagar = todasLasOrdenes.filter(o => !o.montoPagadoUSD || o.montoPagadoUSD === 0).length;
        const abonadas = todasLasOrdenes.filter(o => (o.montoPagadoUSD || 0) > 0 && (o.montoPagadoUSD || 0) < (o.totalUSD || 0)).length;
        const pagadas = todasLasOrdenes.filter(o => (o.montoPagadoUSD || 0) >= (o.totalUSD || 0) && (o.totalUSD || 0) > 0).length;
        
        return { total, sinPagar, abonadas, pagadas };
    }, [todasLasOrdenes]);

    const cardModalFilteredOrders = useMemo(() => {
        if (!cardModalState.type) return [];
        // Usamos la súper lista
        let result = [...todasLasOrdenes];
        
        if (cardModalState.type === 'sinPagar') {
            result = result.filter(o => !o.montoPagadoUSD || o.montoPagadoUSD === 0);
        } else if (cardModalState.type === 'abonadas') {
            result = result.filter(o => (o.montoPagadoUSD || 0) > 0 && (o.montoPagadoUSD || 0) < (o.totalUSD || 0));
        } else if (cardModalState.type === 'pagadas') {
            result = result.filter(o => (o.montoPagadoUSD || 0) >= (o.totalUSD || 0) && (o.totalUSD || 0) > 0);
        }

        result.sort((a, b) => {
            const deudaA = (a.totalUSD || 0) - (a.montoPagadoUSD || 0);
            const deudaB = (b.totalUSD || 0) - (b.montoPagadoUSD || 0);

            switch (cardSortBy) {
                case 'mayor_deuda': return deudaB - deudaA;
                case 'mayor_abono': return (b.montoPagadoUSD || 0) - (a.montoPagadoUSD || 0);
                case 'numero_orden': return (b.ordenNumero || 0) - (a.ordenNumero || 0);
                case 'cliente':
                    const clienteA = (a.cliente?.nombreRazonSocial || '').toLowerCase();
                    const clienteB = (b.cliente?.nombreRazonSocial || '').toLowerCase();
                    return clienteA.localeCompare(clienteB);
                case 'reciente':
                default:
                    const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
                    const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
                    return dateB - dateA;
            }
        });

        return result;
    }, [todasLasOrdenes, cardModalState.type, cardSortBy]);

    const isRoleAdminOrSales = userData?.rol === 'ADMIN' || userData?.rol === 'VENDEDOR';

    return (
      <div className="flex h-screen bg-[#f2f2f7] dark:bg-black overflow-hidden relative font-sans text-slate-900 dark:text-white">
        
        <div id="main-sidebar" className={cn("fixed top-0 left-0 h-full z-40 transition-all duration-300", isSidebarOpen ? "w-72" : "w-0 lg:w-20")}>
            <Sidebar activeView={activeView} setActiveView={setActiveView as any} navItems={navItems as any} onLogout={logout} isMobileOpen={isSidebarOpen} setIsMobileOpen={setIsSidebarOpen} />
            <div className="absolute inset-0 pointer-events-none" />
        </div>
        
        <div className={cn("flex-1 flex flex-col relative transition-all duration-700 min-w-0 overflow-hidden", isSidebarOpen ? "lg:pl-72" : "lg:pl-0")}>
          
          <header id="dashboard-header" className="sticky top-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/60 dark:bg-black/60 backdrop-blur-2xl z-50 w-full overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-black/5 dark:bg-white/10 shrink-0" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu className="h-5 w-5" /></Button>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight italic uppercase truncate max-w-[150px] sm:max-w-none">
                    {activeView === "tasks_taller" ? "Taller" : 
                     activeView === "profile_settings" ? "Configuración" :
                     activeView === "my_finances" ? "Mis Finanzas" :
                     navItems.find(i => i.id === activeView)?.label || 
                     (activeView === "design_production" ? "Pago Diseños" : "Panel")}
                </h2>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <div id="tasas-container" className="hidden lg:flex items-center gap-2">
                    <TasaHeaderBadge label="USD" value={currentBcvRate} icon={<DollarSign className="w-3.5 h-3.5" />} color="emerald" onClick={() => handleUpdateRate("USD")} />
                    <TasaHeaderBadge label="EUR" value={eurRate} icon={<Euro className="w-3.5 h-3.5" />} color="blue" onClick={() => handleUpdateRate("EUR")} />
                    <TasaHeaderBadge label="USDT" value={parallelRate} icon={<Coins className="w-3.5 h-3.5" />} color="orange" onClick={() => handleUpdateRate("USDT")} />
                </div>
                
                <Button variant="ghost" size="icon" className="rounded-2xl bg-blue-500/10 h-10 w-10 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors" onClick={() => startTour(activeView)} title="Ver Tutorial"><HelpCircle className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="rounded-2xl bg-orange-500/10 h-10 w-10 text-orange-600" onClick={() => setIsExpenseNotiOpen(true)}><Clock className="h-5 w-5" /></Button>

                <div id="notification-bell" className="relative">
                    <Button variant="ghost" size="icon" className="rounded-2xl bg-black/5 dark:bg-white/10 h-10 w-10 relative" onClick={() => { setIsNotiOpen(true); setHasUnseenNotifications(false); }}>
                        <Bell className="h-5 w-5" />
                        {(hasUnseenNotifications || allNotifications.some(n => !n.isRead)) && <motion.span layoutId="notification-dot" className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-black" />}
                    </Button>
                </div>
            </div>
          </header>

          <NotificationCenter isOpen={isNotiOpen} onClose={() => setIsNotiOpen(false)} activeNotifications={allNotifications} onMarkAllRead={() => setHasUnseenNotifications(false)} onDeleteNotification={handleDeleteNotification} onToggleRead={handleToggleRead} onMaximize={() => { setIsNotiOpen(false); setActiveView("notifications_full"); }} />
          <NotificationCenterExpenses isOpen={isExpenseNotiOpen} onClose={() => setIsExpenseNotiOpen(false)} activeNotifications={expenseEvents} onMarkAllRead={() => {}} onDeleteNotification={(id) => deleteNotification(id)} onToggleRead={(id) => { const n = expenseEvents.find(x => x.id === id); if(n) updateNotificationStatus(id, !n.isRead); }} />

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={activeView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={springConfig} className="h-full">
                
                {activeView === "orders" && isRoleAdminOrSales && (
                    <motion.div layout className="max-w-7xl mx-auto space-y-6 md:space-y-8">
                        
                        <NewsBar rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} gastosFijos={gastosFijos} empleados={empleados} ordenes={todasLasOrdenes} designers={designers} gastos={gastos} onAction={handleNewsAction} />

                        <motion.div layout id="stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full">
                            <motion.div layout><StatCard label="Órdenes Totales" value={totalHistoricoOrdenes || billingStats.total} icon={<FileSpreadsheet />} color="blue" subtext="Histórico Real" onClick={() => setCardModalState({ isOpen: true, type: 'total' })} /></motion.div>
                            <motion.div layout><StatCard label="Sin Pagar" value={realBillingStats ? realBillingStats.sinPagar : billingStats.sinPagar} icon={<AlertCircle />} color="red" subtext="Cero abonos" onClick={() => setCardModalState({ isOpen: true, type: 'sinPagar' })} /></motion.div>
                            <motion.div layout><StatCard label="Abonadas" value={realBillingStats ? realBillingStats.abonadas : billingStats.abonadas} icon={<Clock />} color="orange" subtext="Saldo pendiente" onClick={() => setCardModalState({ isOpen: true, type: 'abonadas' })} /></motion.div>
                            <motion.div layout><StatCard label="Pagadas" value={realBillingStats ? realBillingStats.pagadas : billingStats.pagadas} icon={<CheckCircle2 />} color="green" subtext="Liquidadas" onClick={() => setCardModalState({ isOpen: true, type: 'pagadas' })} /></motion.div>
                        </motion.div>

                        <motion.div layout className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-white/40 dark:bg-white/5 p-4 rounded-[2rem] border border-black/5 shadow-sm">
                            <div className="relative w-full sm:max-w-md">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar N° de Orden o cliente... (Presiona Enter)" 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    onKeyDown={handleDeepSearch}
                                    className="w-full pl-12 pr-10 py-3 bg-white dark:bg-black/20 border border-black/5 rounded-[1.8rem] text-sm outline-none transition-all focus:border-blue-500/50" 
                                />
                                {isSearchingDeep && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />}
                            </div>
                            <Button id="btn-new-order" onClick={() => { setEditingOrder(null); setIsWizardOpen(true); }} className="px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.8rem] font-bold text-sm gap-3 shrink-0"><Plus /> NUEVA ORDEN</Button>
                        </motion.div>

                        <motion.div layout className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] border border-black/5 shadow-2xl overflow-hidden">
                            <OrdersTable 
                                ordenes={filteredOrdenes} 
                                onDelete={deleteOrden} 
                                onEdit={(o) => {setEditingOrder(o); setIsWizardOpen(true);}} 
                                onRegisterPayment={(o: any) => { 
                                    // Failsafe: soporta si envían el ID o el objeto completo de la orden
                                    if (typeof o === 'string') {
                                        const ord = todasLasOrdenes.find(x => x.id === o);
                                        if (ord) handleOpenPaymentModal(ord);
                                    } else {
                                        handleOpenPaymentModal(o);
                                    }
                                }} 
                                currentUserId={currentUserId || ""}
                                rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
                                pdfLogoBase64={assets.logo}
                                firmaBase64={assets.firma}
                                selloBase64={assets.sello}
                                onSyncStatus={syncAllOrdersClientStatus}
                            />
                        </motion.div>
                    </motion.div>
                )}

                {activeView === "profile_settings" && <ProfileSettingsView />}
                {activeView === "my_finances" && <EmployeeFinancesView empleados={empleados} pagos={pagos} currentUserId={currentUserId} rates={{ usd: currentBcvRate, eur: eurRate }} />}
                {activeView === "tasks_taller" && <TasksView ordenes={todasLasOrdenes} currentUserId={currentUserId || ""} />}
                {activeView === "users_auth" && <UsersManagementView />}
                
                {activeView === "fixed_expenses" && (
                    <GastosFijosView gastos={gastosFijos} rates={{ usd: currentBcvRate, eur: eurRate }} onNotification={(t, d) => { setRateToastMessage(d); setShowRateToast(true); setTimeout(() => setShowRateToast(false), 4000); createNotification({ title: t, description: d, type: 'warning', category: 'expense' }); }} />
                )}
                
                {activeView === "insumos_mgmt" && <InsumosView gastos={gastos} currentBcvRate={currentBcvRate} currentUserId={currentUserId || ""} onCreateGasto={createGasto} onDeleteGasto={deleteGastoInsumo} />}
                {activeView === "inventory_general" && <InventoryView />}
                {activeView === "financial_stats" && <EstadisticasDashboard gastosInsumos={gastos as any} gastosFijos={gastosFijos} empleados={empleados} pagosEmpleados={pagos} cobranzas={todasLasOrdenes.map(o => ({id: o.id, montoUSD: (o as any).totalUSD || 0, montoBs: (o as any).totalBs || 0, estado: o.estadoPago === 'PAGADO' ? 'pagado' : 'pendiente', fecha: o.fecha })) as any} ordenes={todasLasOrdenes} clientes={clientes} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} />}
                {activeView === "employees_mgmt" && <EmpleadosView empleados={empleados} pagos={pagos} rates={{ usd: currentBcvRate, eur: eurRate }} />}
                {activeView === "wallets" && <WalletsView ordenes={todasLasOrdenes} gastos={gastos} gastosFijos={gastosFijos} pagosEmpleados={pagos} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} movimientosManuales={movimientosCaja} />}
                {activeView === "payment_audit" && <PaymentAuditView ordenes={todasLasOrdenes} gastos={[...gastos, ...gastosFijos]} pagosEmpleados={pagos} />}
                {activeView === "design_production" && <DesignerPayrollView designers={designers} ordenes={todasLasOrdenes} bcvRate={currentBcvRate} />}
                
                {/* Cobranzas */}
                {activeView === "clients" && <ClientsAndPaymentsView ordenes={todasLasOrdenes} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} onRegisterPayment={handleOpenPaymentModal} pdfLogoBase64={assets.logo} firmaBase64={assets.firma} selloBase64={assets.sello} />}

                {activeView === "calculator" && isRoleAdminOrSales && (
                    <BudgetEntryView currentUserId={currentUserId} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} currentBcvRate={currentBcvRate} pdfLogoBase64={assets.logo} handleLogoUpload={(e: any) => handleFileUpload(e, 'logo')} handleClearLogo={() => handleClearAsset('logo')} firmaBase64={assets.firma} handleFirmaUpload={(e: any) => handleFileUpload(e, 'firma')} handleClearFirma={() => handleClearAsset('firma')} selloBase64={assets.sello} handleSelloUpload={(e: any) => handleFileUpload(e, 'sello')} handleClearSello={() => handleClearAsset('sello')} />
                )}
                
                {activeView === "old_calculator" && <CalculatorView onSendToProduction={handleSendCalcToOrder} />}
                {activeView === "ai_background" && <BackgroundRemoverView />}
                {activeView === "ai_upscale" && <UpscaleView />}
                {activeView === "format_converter" && <FormatConverterView />}

                {activeView === "notifications_full" && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-8">
                            <div><h2 className="text-3xl font-extrabold tracking-tight">Centro de Actividades</h2><p className="text-muted-foreground">Historial completo de eventos y notificaciones del sistema</p></div>
                            <Button variant="outline" onClick={() => setActiveView("orders")} className="rounded-2xl gap-2"><ChevronLeft className="w-4 h-4" /> Volver al Panel</Button>
                        </div>
                        <div className="flex flex-col gap-4">
                            {allNotifications.length > 0 ? (allNotifications.map((noti) => <ActivityRow key={noti.id} n={noti} />)) : (<div className="text-center py-20 bg-white/50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-black/10"><Bell className="w-12 h-12 mx-auto mb-4 opacity-20" /><p className="text-muted-foreground font-medium">No hay notificaciones para mostrar</p></div>)}
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

        {selectedOrdenForPayment && (
            <PaymentEditModal
                key={selectedOrdenForPayment.id}
                isOpen={isPaymentModalOpen}
                onClose={() => { setIsPaymentModalOpen(false); setTimeout(() => setSelectedOrdenForPayment(null), 300); }}
                orden={selectedOrdenForPayment}
                rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
                onSave={async (amount, note, img, method, discount) => { await handleRegisterOrderPayment(selectedOrdenForPayment.id, amount, note, img, method, discount); }}
                currentUserId={currentUserId || ""}
            />
        )}

        <Dialog open={cardModalState.isOpen} onOpenChange={(open) => !open && setCardModalState({ isOpen: false, type: null })}>
            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-[2rem] p-0 shadow-2xl">
                <div className="p-6 pb-0 flex flex-col gap-4">
                    <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                        {cardModalState.type === 'total' && "Todas las Órdenes"}
                        {cardModalState.type === 'sinPagar' && "Órdenes Sin Pagar"}
                        {cardModalState.type === 'abonadas' && "Órdenes Abonadas"}
                        {cardModalState.type === 'pagadas' && "Órdenes Pagadas"}
                    </DialogTitle>

                    <div className="flex items-center gap-3 pb-4 border-b border-black/5 dark:border-white/5 overflow-x-auto custom-scrollbar">
                        <span className="text-sm font-semibold opacity-50 shrink-0">Ordenar por:</span>
                        <select value={cardSortBy} onChange={(e) => setCardSortBy(e.target.value as any)} className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-sm rounded-xl px-4 py-2 outline-none font-medium cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                            <option value="reciente">Más reciente</option>
                            <option value="mayor_deuda">Mayor deuda</option>
                            <option value="mayor_abono">Mayor pago / abono</option>
                            <option value="numero_orden">Número de orden</option>
                            <option value="cliente">Cliente (A-Z)</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-3 custom-scrollbar">
                    {cardModalFilteredOrders.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center justify-center opacity-50"><AlertCircle className="w-12 h-12 mb-4" /><p className="font-semibold text-lg">No hay órdenes en esta categoría.</p></div>
                    ) : (
                        cardModalFilteredOrders.map(o => {
                            const deuda = (o.totalUSD || 0) - (o.montoPagadoUSD || 0);
                            return (
                                <div key={o.id} onClick={() => handleOpenOrderDetails(o)} className="cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-white dark:bg-black/40 border border-black/5 dark:border-white/5 shadow-sm rounded-2xl gap-4 hover:border-blue-500 hover:shadow-md transition-all">
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm truncate text-blue-600 dark:text-blue-400">#{o.ordenNumero} - {o.cliente?.nombreRazonSocial || "Cliente S/N"}</div>
                                        <div className="text-xs font-semibold opacity-60 mt-1">{o.fecha ? (typeof o.fecha === 'string' ? new Date(o.fecha).toLocaleDateString() : (o.fecha as any).toDate?.().toLocaleDateString() || 'Sin fecha') : 'Sin fecha'}</div>
                                    </div>
                                    <div className="flex gap-4 sm:gap-6 text-sm sm:text-right shrink-0">
                                        <div><div className="text-[10px] uppercase font-bold opacity-50">Total</div><div className="font-bold">${(o.totalUSD || 0).toFixed(2)}</div></div>
                                        <div><div className="text-[10px] uppercase font-bold opacity-50">Pagado</div><div className="font-bold text-emerald-600">${(o.montoPagadoUSD || 0).toFixed(2)}</div></div>
                                        <div><div className="text-[10px] uppercase font-bold opacity-50">Deuda</div><div className={cn("font-bold", deuda > 0.01 ? "text-red-500" : "text-slate-500")}>${deuda > 0.01 ? deuda.toFixed(2) : '0.00'}</div></div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>

        <OrderDetailModal open={isDetailModalOpen} onClose={() => { setIsDetailModalOpen(false); setTimeout(() => setSelectedOrderForDetails(null), 300); }} orden={selectedOrderForDetails} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} />
      </div>
    )
}

function TasaHeaderBadge({ label, value, icon, color, onClick }: any) {
    const colors: any = { emerald: "bg-emerald-500/10 text-emerald-600", orange: "bg-orange-500/10 text-orange-600", blue: "bg-blue-500/10 text-blue-600" }
    return (
        <motion.div whileHover={{ y: -1, scale: 1.02 }} onClick={onClick} className="bg-white dark:bg-white/5 px-4 py-2 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3 cursor-pointer shrink-0">
            <div className={cn("p-1.5 rounded-xl", colors[color])}>{icon}</div>
            <div className="flex flex-col"><span className="text-[9px] font-bold text-black/30 dark:text-white/30 uppercase leading-none mb-0.5">{label}</span><span className="text-sm font-bold">{value ? value.toFixed(2) : "---"}</span></div>
        </motion.div>
    )
}

function StatCard({ label, value, icon, subtext, color, className, onClick }: any) {
    const theme: any = { blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", orange: "bg-orange-500/10 text-orange-600 border-orange-500/20", green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", red: "bg-red-500/10 text-red-600 border-red-500/20" }
    return (
        <Card onClick={onClick} className={cn("border shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-[#1c1c1e] transition-all w-full", onClick && "cursor-pointer hover:shadow-lg hover:-translate-y-1 duration-300 hover:border-black/10 dark:hover:border-white/10", className)}>
            <CardContent className="p-4 sm:p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-[1.8rem] shadow-inner shrink-0", theme[color])}>{icon && React.cloneElement(icon as any, { className: "w-8 h-8" })}</div>
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase text-black/30 dark:text-white/30 truncate">{label}</p><p className="text-3xl font-bold tracking-tighter truncate">{value}</p><p className="text-[9px] font-semibold text-black/40 dark:text-white/40 uppercase truncate">{subtext}</p></div>
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
                <div className="flex justify-between items-center mb-1 gap-2"><span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-40 truncate">{n.title}</span><time className="text-[9px] sm:text-[10px] font-bold opacity-30 shrink-0">{displayDate.toLocaleDateString('es-VE')}</time></div>
                <h4 className="text-xs sm:text-sm font-bold truncate text-slate-900 dark:text-white">{n.description}</h4>
            </div>
        </div>
    )
}