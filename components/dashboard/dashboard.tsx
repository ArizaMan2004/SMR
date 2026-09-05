// @/components/orden/dashboard.tsx
"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"

// --- IMPORTACIONES PARA FIREBASE ---
import { db } from "@/lib/firebase"
import { doc, updateDoc, arrayUnion, collection, onSnapshot, runTransaction } from "firebase/firestore"

// UI - Shadcn
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner" 

// Componentes SMR (los que se ven siempre o casi siempre: viajan en el paquete
// principal porque hacen falta desde el primer segundo)
import Sidebar from "@/components/dashboard/sidebar"
import { OrdersTable } from "@/components/orden/orders-table"
import { NotificationCenter } from "@/components/dashboard/NotificationCenter"
import { NotificationBell } from "@/components/dashboard/NotificationBell"
import { OrderFormWizardV2 } from "@/components/orden/order-form-wizard"
import TasksView from "@/components/dashboard/tasks-view"
import { CurrencyToast } from "@/components/dashboard/CurrencyToast"
import { PaymentEditModal } from "@/components/dashboard/PaymentEditModal"
import { NewsBar, type NewsAction } from "@/components/dashboard/news-bar" 
import { OrderDetailModal } from "@/components/orden/order-detail-modal" 

// --- VISTAS QUE SE CARGAN SOLO AL ABRIRLAS ---
//
// Antes TODO esto entraba en el mismo paquete que el panel: TensorFlow y el
// upscaler, el quita-fondos de IA, las gráficas, los generadores de PDF...
// varios megas que descargaba hasta quien solo entra a marcar tareas en el
// taller. Con `dynamic` cada vista se descarga la primera vez que alguien la
// abre, y quien nunca la abre no la paga.
//
// `ssr: false` porque todas son pantallas de panel privado: no hay nada que
// renderizar en el servidor y varias tocan `window` al montarse.
const CargandoVista = () => (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="text-sm">Cargando sección...</span>
    </div>
)

const ClientsAndPaymentsView = dynamic(() => import("@/components/dashboard/ClientsAndPaymentsView").then(m => m.ClientsAndPaymentsView), { ssr: false, loading: CargandoVista })
const DesignerPayrollView = dynamic(() => import("@/components/dashboard/DesignerPayrollView").then(m => m.DesignerPayrollView), { ssr: false, loading: CargandoVista })
const BudgetEntryView = dynamic(() => import("@/components/dashboard/BudgetEntryView"), { ssr: false, loading: CargandoVista })
const CalculatorView = dynamic(() => import("@/components/dashboard/CalculatorView"), { ssr: false, loading: CargandoVista })
const WalletsView = dynamic(() => import("@/components/dashboard/WalletsView").then(m => m.WalletsView), { ssr: false, loading: CargandoVista })
const PaymentAuditView = dynamic(() => import("@/components/dashboard/PaymentAuditView").then(m => m.PaymentAuditView), { ssr: false, loading: CargandoVista })
const TaskControlView = dynamic(() => import("@/components/dashboard/TaskControlView").then(m => m.TaskControlView), { ssr: false, loading: CargandoVista })
const CatalogInventoryView = dynamic(() => import("@/components/dashboard/CatalogInventoryView").then(m => m.CatalogInventoryView), { ssr: false, loading: CargandoVista })

// Herramientas de IA y diseño: son las más pesadas de todo el sistema.
const BackgroundRemoverView = dynamic(() => import("@/components/dashboard/BackgroundRemoverView").then(m => m.BackgroundRemoverView), { ssr: false, loading: CargandoVista })
const UpscaleView = dynamic(() => import("@/components/dashboard/UpscaleView").then(m => m.UpscaleView), { ssr: false, loading: CargandoVista })
const FormatConverterView = dynamic(() => import("@/components/dashboard/FormatConverterView").then(m => m.FormatConverterView), { ssr: false, loading: CargandoVista })

// Administración y perfil.
const GastosFijosView = dynamic(() => import("@/components/dashboard/gastos-fijos-view").then(m => m.GastosFijosView), { ssr: false, loading: CargandoVista })
const InsumosView = dynamic(() => import("@/components/dashboard/InsumosView").then(m => m.InsumosView), { ssr: false, loading: CargandoVista })
const EmpleadosView = dynamic(() => import("@/components/dashboard/empleados-view").then(m => m.EmpleadosView), { ssr: false, loading: CargandoVista })
const EstadisticasDashboard = dynamic(() => import("@/components/dashboard/estadisticas-dashboard").then(m => m.EstadisticasDashboard), { ssr: false, loading: CargandoVista })
const UsersManagementView = dynamic(() => import("@/components/dashboard/UsersManagementView").then(m => m.UsersManagementView), { ssr: false, loading: CargandoVista })
const ProfileSettingsView = dynamic(() => import("@/components/dashboard/ProfileSettingsView").then(m => m.ProfileSettingsView), { ssr: false, loading: CargandoVista })
const EmployeeFinancesView = dynamic(() => import("@/components/dashboard/EmployeeFinancesView").then(m => m.EmployeeFinancesView), { ssr: false, loading: CargandoVista })
const HorariosView = dynamic(() => import("@/components/dashboard/HorariosView").then(m => m.HorariosView), { ssr: false, loading: CargandoVista })

// Controlador del Tutorial
import { HelpModal } from "@/components/dashboard/TutorialController"

// Iconos
import {
    Plus, CheckCircle, Calculator, LayoutDashboard, FileSpreadsheet, Clock,
    Building2, Bell, CheckCircle2, ChevronLeft, Menu, DollarSign, Euro, Coins,
    Wallet, Search, HelpCircle, AlertCircle, Loader2, ShieldCheck, Layers, ShoppingCart,
    CalendarClock
} from "lucide-react"

// Servicios
import { type OrdenServicio } from "@/lib/types/orden"
import { 
    subscribeToOrdenes, deleteOrden, createOrden, actualizarOrden, 
    getTotalOrdenesCount, getOrdenById, getOrdenesStatsFromServer,
    buscarOrdenesHistoricas 
} from "@/lib/services/ordenes-service"
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"
import { 
    subscribeToPagos, subscribeToGastos, subscribeToGastosFijos, 
    subscribeToEmpleados, deleteGastoInsumo, 
    createGasto
} from "@/lib/services/gastos-service"
import { subscribeToClients } from "@/lib/services/clientes-service"
import { subscribeToVentasCatalogo } from "@/lib/services/catalog-service"
import { syncAllOrdersClientStatus } from "@/lib/services/maintenance-service"

import { fetchBCVRateFromAPI, getBCVRateFromStorage } from "@/lib/services/bcv-service"
import {
    getLogoBase64, setLogoBase64, getFirmaBase64, setFirmaBase64,
    getSelloBase64, setSelloBase64
} from "@/lib/logo-service"
import { cn } from "@/lib/utils"
import type { GastoFijo, Empleado, PagoEmpleado } from "@/lib/types/gastos"
import { NotificationProvider } from "@/lib/contexts/notification-context"
import { usePermisos } from "@/lib/contexts/permisos-context"
import { puedeSupervisarTareas, esAdmin } from "@/lib/roles"
import { crearNotificacion, notificarNuevaOrden } from "@/lib/services/notificaciones-service"
import { estaSaldada, estaAbonada, aCentimos } from '@/lib/utils/estados'
import { subscribeToHorarios } from '@/lib/services/horarios-service'
import { ResumenDelDia } from '@/components/dashboard/ResumenDelDia'
import { subscribeToIdentidad, identidadParaPDF } from '@/lib/services/identidad-service'

const springConfig = { type: "spring" as const, stiffness: 300, damping: 30 } as const;
type ActiveView = string; 

export default function Dashboard() {
    const { user, userData, logout } = useAuth()
    const { puedeVer, vistaInicial } = usePermisos()
    const currentUserId = user?.uid

    // --- 1. ESTADOS DE UI ---
    const [activeView, setActiveView] = useState<ActiveView>("orders") 

    // Menú: abierto por defecto en escritorio, cerrado en móvil (evita que tape el contenido al cargar).
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
        if (typeof window === "undefined") return false
        return window.innerWidth >= 1024
    })

    // Sincroniza el estado del menú al cruzar el breakpoint (1024px): abre en escritorio, cierra en móvil.
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 1023px)")
        const apply = (isMobile: boolean) => setIsSidebarOpen(!isMobile)
        const handler = (e: MediaQueryListEvent) => apply(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    // Bloquea el scroll de fondo cuando el menú está abierto en pantallas pequeñas.
    useEffect(() => {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 1024
        if (isMobile && isSidebarOpen) {
            const prev = document.body.style.overflow
            document.body.style.overflow = "hidden"
            return () => { document.body.style.overflow = prev }
        }
    }, [isSidebarOpen])
    
    // Si la vista abierta no le corresponde a esta persona, la mandamos a la
    // primera que sí. Cubre el arranque (la gente de taller no debe aterrizar en
    // Facturación) y también el caso de que el admin le retire un permiso
    // mientras tiene la app abierta.
    useEffect(() => {
        if (!userData) return;
        if (!puedeVer(activeView)) setActiveView(vistaInicial);
    }, [userData, activeView, puedeVer, vistaInicial]);
    
    const [searchTerm, setSearchTerm] = useState("") 
    const [isSearchingDeep, setIsSearchingDeep] = useState(false)
    
    // --- NUEVO: ESTADOS Y LÓGICA PARA EL AUTOCOMPLETADO DE CLIENTES ---
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [editingOrder, setEditingOrder] = useState<OrdenServicio | null>(null)
    
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [selectedOrdenForPayment, setSelectedOrdenForPayment] = useState<OrdenServicio | null>(null)

    const [cardModalState, setCardModalState] = useState<{ isOpen: boolean, type: 'total' | 'sinPagar' | 'abonadas' | 'pagadas' | null }>({ isOpen: false, type: null })
    const [cardSortBy, setCardSortBy] = useState<'reciente' | 'mayor_deuda' | 'mayor_abono' | 'numero_orden' | 'cliente'>('reciente')

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<OrdenServicio | null>(null)

    const [showRateToast, setShowRateToast] = useState(false)
    const [rateToastMessage, setRateToastMessage] = useState("")
    const [isHelpOpen, setIsHelpOpen] = useState(false)

    // --- 2. ESTADOS DE DATOS ---
    const [currentBcvRate, setCurrentBcvRate] = useState<number>(0)
    const [eurRate, setEurRate] = useState<number>(0)
    const [parallelRate, setParallelRate] = useState<number>(0)
    const [assets, setAssets] = useState({ logo: "", firma: "", sello: "" })

    // Logo, firma y sello salen de la nube, no del navegador. Antes vivian en
    // localStorage: habia que recargarlos en cada PC y dos empleados podian
    // emitir PDF con sellos distintos sin saberlo. Ahora se suben una vez desde
    // Ajustes -> Identidad de Empresa y valen para toda la empresa.
    //
    // Va suscrito y no de una sola lectura: si el admin cambia el sello mientras
    // alguien tiene el dashboard abierto, el PDF sale ya con el nuevo.
    //
    // pdfmake necesita la imagen en base64 y no sabe ir a buscar una URL, asi
    // que se descargan y se convierten aqui.
    useEffect(() => {
        return subscribeToIdentidad(identidad => {
            identidadParaPDF(identidad)
                .then(({ logo, firma, sello }) => setAssets({ logo: logo || "", firma: firma || "", sello: sello || "" }))
                .catch(e => console.error("No se pudo preparar la identidad para los PDF:", e))
        })
    }, [])
    
    
    const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]) 
    const [totalHistoricoOrdenes, setTotalHistoricoOrdenes] = useState<number>(0) 
    const [realBillingStats, setRealBillingStats] = useState<{sinPagar: number, abonadas: number, pagadas: number} | null>(null)

    const [designers, setDesigners] = useState<Designer[]>([]) 
    const [gastos, setGastos] = useState<any[]>([])
    const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [pagos, setPagos] = useState<PagoEmpleado[]>([]) 
    const [clientes, setClientes] = useState<any[]>([])
    const [horarios, setHorarios] = useState<any[]>([])
    const [movimientosCaja, setMovimientosCaja] = useState<any[]>([])
    const [ventasCatalogo, setVentasCatalogo] = useState<any[]>([])
    const [tareasControl, setTareasControl] = useState<any[]>([]) 

    // --- AUTOCOMPLETADO DE CLIENTES (Memoizado) ---
    const suggestedClients = useMemo(() => {
        if (!searchTerm.trim() || searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        
        // Usamos un Map para evitar clientes duplicados si se registraron varias veces
        const uniqueClients = new Map();
        clientes.forEach(c => {
            if (c.nombreRazonSocial?.toLowerCase().includes(term) || c.rifCedula?.toLowerCase().includes(term)) {
                if (!uniqueClients.has(c.nombreRazonSocial)) {
                    uniqueClients.set(c.nombreRazonSocial, c);
                }
            }
        });
        
        // Devolvemos máximo 5 sugerencias para no saturar la pantalla
        return Array.from(uniqueClients.values()).slice(0, 5);
    }, [clientes, searchTerm]);

    // --- 3. NAV ITEMS ---
    // Aquí ya NO se decide quién ve qué: eso lo resuelve el contexto de permisos
    // (lib/roles.ts + lo que el admin configure). Esto es solo la estructura y el
    // orden del menú. Cada vista aparece UNA sola vez; los grupos se ocultan
    // solos cuando la persona no tiene acceso a ninguno de sus hijos.
    const navItems = useMemo(() => [
        {
            id: 'orders',
            label: 'Facturación y Cierre',
            icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
            id: 'tasks_taller',
            label: 'Taller de Producción',
            icon: <CheckCircle className="w-4 h-4" />,
        },
        {
            id: 'task_control',
            label: 'Control de Tareas (Bonos)',
            icon: <Layers className="w-4 h-4" />,
        },
        {
            id: 'my_finances',
            label: 'Mis Finanzas',
            icon: <Wallet className="w-4 h-4" />,
        },
        {
            id: 'horarios',
            label: 'Horarios del Personal',
            icon: <CalendarClock className="w-4 h-4" />,
        },
        {
            id: 'ventas_group',
            label: 'Ventas & Clientes',
            icon: <ShoppingCart className="w-4 h-4" />,
            children: [
                { id: 'catalogo_ventas', label: 'Catálogo & Ventas' },
                { id: 'clients', label: 'Clientes & Cobranza' },
                { id: 'calculator', label: 'Presupuestos / Cotizaciones' },
            ]
        },
        {
            id: 'admin_group',
            label: 'Administración SMR',
            icon: <Building2 className="w-4 h-4" />,
            children: [
                { id: 'wallets', label: 'Billeteras & Caja' },
                { id: 'payment_audit', label: 'Auditoría de Pagos' },
                { id: 'financial_stats', label: 'Balance y Estadísticas' },
                { id: 'design_production', label: 'Pago Diseños' },
                { id: 'fixed_expenses', label: 'Gastos Fijos' },
                { id: 'insumos_mgmt', label: 'Insumos y Materiales' },
                { id: 'employees_mgmt', label: 'Gestión de Personal' },
            ]
        },
        {
            id: 'users_auth',
            label: 'Accesos y Roles',
            icon: <ShieldCheck className="w-4 h-4" />,
        },
        {
            id: 'tools_group',
            label: 'Herramientas',
            icon: <Calculator className="w-4 h-4" />,
            children: [
                { id: 'old_calculator', label: 'Calculadora de Costos' },
                { id: 'ai_background', label: 'IA Quita Fondos' },
                { id: 'ai_upscale', label: 'IA Upscale (HD)' },
                { id: 'format_converter', label: 'Convertidor Formatos' },
            ]
        },
    ], []);

    // --- 4. MANEJADORES ---
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
            // Las alertas de nómina y gastos apuntan a vistas de administración.
            // Sin esto, un vendedor o cajero hacía clic y salía rebotado de vuelta.
            if (!puedeVer(action.payload)) {
                toast.error("No tienes acceso a esa sección. Pídeselo al administrador.");
                return;
            }
            setActiveView(action.payload);
        } else if (action.type === 'OPEN_ORDER') {
            handleOpenPaymentModal(action.payload);
        } else if (action.type === 'VIEW_ORDER_DETAILS') {
            handleOpenOrderDetails(action.payload);
        }
    }, [handleOpenPaymentModal, handleOpenOrderDetails, puedeVer]);

    const handleSendCalcToOrder = (calc: any, type: 'area' | 'laser') => {
        const mappedItems = type === 'area' 
            ? calc.mediciones.map((m: any) => ({
                nombre: m.name || "Pieza de Área",
                cantidad: m.cantidad || 1,
                precioUnitario: m.precioDolar,
                medidaXCm: m.cmAncho,
                medidaYCm: m.cmAlto,
                unidad: 'm2',
                tipoServicio: 'OTROS'
              }))
            : (calc.tiempos || calc.items).map((t: any) => {
                const isService = t.type === 'service';
                return {
                    nombre: t.name || "Trabajo Láser",
                    cantidad: isService ? t.qty : 1,
                    precioUnitario: isService 
                        ? t.unitPrice 
                        : ((t.minutes + t.seconds/60) * 0.80 + (t.materialCost || 0)),
                    unidad: 'und',
                    tipoServicio: 'CORTE_LASER'
                };
              });

        const initialOrderData = {
            cliente: { 
                nombreRazonSocial: calc.name.toUpperCase(),
                tipoCliente: "REGULAR" 
            },
            items: mappedItems,
            descripcionDetallada: `CÁLCULO DE ${type === 'area' ? 'ÁREA' : 'LÁSER'} IMPORTADO AUTOMÁTICAMENTE.`
        };

        setEditingOrder(initialOrderData as any);
        setIsWizardOpen(true);
        toast.success("Cálculo cargado en el terminal de ventas");
    };

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
                if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
                const data = await res.json();
                if (data?.promedio) { setParallelRate(data.promedio); newValue = data.promedio; }
            }
            const msg = `Valor ${label} actualizado a Bs. ${newValue.toFixed(2)}`;
            setRateToastMessage(msg); setShowRateToast(true);
            setTimeout(() => setShowRateToast(false), 4000);

        } catch (error) { console.error(error); }
    }, [currentUserId]);

    const handleRegisterOrderPayment = async (
        ordenId: string,
        monto: number,
        nota?: string,
        imagenUrl?: string,
        metodo?: string,
        descuento?: number,
        fechaPago?: string,
        // Por que cuenta concreta entro el dinero: "Banesco Corriente" y no
        // solo "Banco". Es lo que luego permite cuadrar banco por banco.
        cuentaId?: string
    ) => {
        const descuentoAplicado = descuento || 0;
        const fechaRecibo = fechaPago || new Date().toISOString();

        const pagosAGuardar: any[] = [
            {
                montoUSD: monto,
                fecha: fechaRecibo,
                nota: nota || "",
                imagenUrl: imagenUrl || "",
                tasaBCV: currentBcvRate,
                metodo: metodo || "Efectivo USD",
                cuentaId: cuentaId || "",
            },
        ];
        if (descuentoAplicado > 0) {
            pagosAGuardar.push({
                montoUSD: descuentoAplicado,
                fecha: new Date().toISOString(),
                nota: "Ajuste/Descuento por cierre de orden",
                imagenUrl: "",
                tasaBCV: 0,
                metodo: "DESCUENTO",
            });
        }

        try {
            const ordenRef = doc(db, "ordenes", ordenId);

            // Transacción: leer datos FRESCOS de Firestore → calcular → escribir de forma atómica.
            // Esto evita leer estado local desactualizado y previene registros duplicados por doble envío.
            const resultado = await runTransaction(db, async (tx) => {
                const snap = await tx.get(ordenRef);
                if (!snap.exists()) throw new Error("La orden no existe en la base de datos.");

                const data = snap.data() as any;
                const montoPagadoAnterior = Number(data.montoPagadoUSD) || 0;
                const totalUSD = Number(data.totalUSD) || 0;
                // Se redondea a céntimos al guardar: sin esto, cada abono arrastra
                // el resto de la coma flotante y acaban apareciendo montos como
                // 13.999999999999982 para un total de 14.
                const nuevoMonto = aCentimos(montoPagadoAnterior + monto + descuentoAplicado);
                const saldo = totalUSD - nuevoMonto;
                const nuevoEstado = saldo <= 0.01 ? "PAGADO" : "ABONADO";

                // Normalizar registroPagos (Firebase puede convertir arrays en objetos en edge cases)
                const registroActual: any[] = Array.isArray(data.registroPagos)
                    ? data.registroPagos
                    : data.registroPagos
                        ? Object.values(data.registroPagos)
                        : [];

                tx.update(ordenRef, {
                    montoPagadoUSD: nuevoMonto,
                    estadoPago: nuevoEstado,
                    // Concatenar en lugar de arrayUnion: en una transacción ya tenemos el array
                    // completo, así no se agregan duplicados por reintento de red.
                    registroPagos: [...registroActual, ...pagosAGuardar],
                });

                return {
                    nuevoMonto,
                    nuevoEstado,
                    ordenNumero: data.ordenNumero,
                    totalUSD,
                    registroPagosActualizado: [...registroActual, ...pagosAGuardar],
                    ordenCompleta: { id: ordenId, ...data },
                };
            });

            // Actualización local optimista: buscar la orden y actualizarla,
            // o AÑADIRLA si era tan vieja que no estaba en los 150 recientes.
            setOrdenes(prev => {
                const existe = prev.some(o => o.id === ordenId);
                const ordenActualizada = {
                    ...(resultado.ordenCompleta as any),
                    montoPagadoUSD: resultado.nuevoMonto,
                    estadoPago: resultado.nuevoEstado,
                    registroPagos: resultado.registroPagosActualizado,
                };
                if (existe) {
                    return prev.map(o => o.id === ordenId ? { ...o, ...ordenActualizada } : o);
                }
                // Orden vieja no estaba en la lista local → agregarla para que Cobranza la vea
                return [...prev, ordenActualizada];
            });

            let descNoti = `Ingreso de $${monto} (${metodo || "Caja"}) - Orden #${resultado.ordenNumero}`;
            if (descuentoAplicado > 0) descNoti += ` + Ajuste de $${descuentoAplicado.toFixed(2)}`;
            await crearNotificacion({ titulo: 'Pago Registrado', cuerpo: descNoti, tipo: 'success', categoria: 'pago', link: 'orders' });

            toast.success("Pago registrado correctamente");
            setIsPaymentModalOpen(false);
        } catch (error) {
            console.error("❌ Error al registrar pago:", error);
            toast.error("Error al registrar el pago");
        }
    };

    // --- NUEVOS INTERCEPTORES PARA ELIMINAR Y EDITAR ÓRDENES ---
    const handleDeleteOrden = async (id: string) => {
        await deleteOrden(id);
        // Actualizamos estado local optimista
        setOrdenes(prev => prev.filter(o => o.id !== id));
    };

    const handleUpdateOrden = async (ordenId: string, cambios: Partial<OrdenServicio>) => {
        await actualizarOrden(ordenId, cambios);
        // Si editamos una orden antigua, buscamos su versión fresca para la tabla local
        if (editingOrder?.id) {
            // Antes se llamaba a buscarOrdenEspecifica, que busca por NÚMERO de
            // orden: al pasarle el ID del documento siempre devolvía null y la
            // fila editada se quedaba con los datos viejos hasta recargar.
            const orderUpdated = await getOrdenById(editingOrder.id);
            if (orderUpdated) {
                setOrdenes(prev => prev.map(o => o.id === editingOrder?.id ? orderUpdated : o));
            }
        }
    };

    const handleCreateOrden = async (payload: any) => {
        const id = await createOrden(payload);
        try {
            await notificarNuevaOrden({
                ordenNumero: payload.ordenNumero ?? '?',
                cliente: payload.cliente,
                items: payload.items ?? [],
                totalUSD: payload.totalUSD ?? 0,
                id: typeof id === 'string' ? id : undefined,
            });
        } catch { /* no-op: notif failure doesn't block order creation */ }
        return id;
    };

    const handleDeepSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.trim() !== '') {
            setIsSearchDropdownOpen(false); // Cerramos el dropdown al buscar
            setIsSearchingDeep(true);
            try {
                // --- MAGIA: TRADUCTOR DE NOMBRES ---
                let terminoExacto = searchTerm.trim();

                // Si no es un número, adivinamos el cliente exacto usando la memoria de SMR
                if (isNaN(Number(terminoExacto))) {
                    const termLower = terminoExacto.toLowerCase();
                    const clienteGuardado = clientes.find(c => 
                        c.nombreRazonSocial?.toLowerCase().includes(termLower) || 
                        c.rifCedula?.toLowerCase().includes(termLower)
                    );
                    
                    if (clienteGuardado) {
                        // Cambiamos "mely" por "DRA MELY LARRARTE" automáticamente
                        terminoExacto = clienteGuardado.nombreRazonSocial;
                        toast.info(`Buscando historial de: ${terminoExacto}`);
                    }
                }

                // Buscamos en Firebase con el nombre exacto o el número perfecto
                const resultados = await buscarOrdenesHistoricas(terminoExacto);

                if (resultados && resultados.length > 0) {
                    toast.success(`Se encontraron ${resultados.length} coincidencias en el historial.`);
                    
                    // Inyectamos los resultados en el estado actual de la tabla
                    setOrdenes(prevOrdenes => {
                        const nuevasOrdenes = [...prevOrdenes];
                        
                        resultados.forEach(res => {
                            // Evitamos duplicados si la orden ya estaba en las 150 iniciales
                            if (!nuevasOrdenes.find(o => o.id === res.id)) {
                                nuevasOrdenes.push(res);
                            }
                        });
                        
                        return nuevasOrdenes;
                    });

                    // Si es solo una orden exacta y es un número, abrimos el detalle por comodidad
                    if (resultados.length === 1 && !isNaN(Number(searchTerm))) {
                        handleOpenOrderDetails(resultados[0]);
                    }

                } else {
                    toast.error(`No se encontraron registros para "${terminoExacto}".`);
                }
            } catch (error) {
                console.error("Error en búsqueda profunda:", error);
                toast.error("Error al conectar con la base de datos histórica.");
            } finally {
                setIsSearchingDeep(false);
            }
        }
    };

    // --- 5. CARGA DE DATOS OPTIMIZADA ---
    useEffect(() => {
        const cached = getBCVRateFromStorage();
        if (cached.usd > 0) { setCurrentBcvRate(cached.usd); setEurRate(cached.eur || 0); }

        fetchBCVRateFromAPI().then(data => { setCurrentBcvRate(data.usd); setEurRate(data.eur || 0); });
        fetch('https://ve.dolarapi.com/v1/dolares/paralelo').then(res => res.json()).then(data => { if (data?.promedio) setParallelRate(data.promedio); });

        getTotalOrdenesCount().then(total => {
            if (total > 0) setTotalHistoricoOrdenes(total);
        });

        getOrdenesStatsFromServer().then(stats => {
            if (stats) setRealBillingStats(stats);
        });

        // Las notificaciones ya no se cargan aqui: viven en NotificationProvider,
        // que es la unica suscripcion para toda la app.
    }, []);

    useEffect(() => {
        // "payment_audit" NO va aqui: esa vista consulta Firestore por su cuenta.
        // Suscribirla ademas gastaba ~250 lecturas por visita que se tiraban a la basura.
        const viewsRequiringOrders = ["orders", "financial_stats", "wallets", "design_production", "clients", "notifications_full"];
        const requiresOrders = viewsRequiringOrders.includes(activeView);

        let unsubOrdenes = () => {};
        let unsubClientes = () => {};

        if (requiresOrders) {
            unsubOrdenes = subscribeToOrdenes("", (newData) => {
                setOrdenes(prevOrdenes => {
                    const newDataIds = new Set(newData.map(o => o.id));
                    const ordenesHistoricas = prevOrdenes.filter(o => !newDataIds.has(o.id));
                    return [...newData, ...ordenesHistoricas];
                });
            });
            unsubClientes = subscribeToClients((data) => setClientes(data));
        }

        return () => { unsubOrdenes(); unsubClientes(); };
    }, [activeView]);

    useEffect(() => {
        const viewsRequiringGastos = ["orders", "fixed_expenses", "insumos_mgmt", "financial_stats", "wallets"];
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
        let unsubTareas = () => {};

        // Ahora my_finances y task_control necesitan empleados y pagos.
        // "horarios" también: sin la lista de empleados la agenda sale vacía.
        if (["orders", "employees_mgmt", "financial_stats", "wallets", "my_finances", "task_control", "horarios"].includes(activeView)) {
            unsubEmpleados = subscribeToEmpleados((data) => setEmpleados(data));
            unsubPagos = subscribeToPagos((data) => setPagos(data));
        }

        if (["employees_mgmt", "my_finances", "task_control"].includes(activeView)) {
            unsubTareas = onSnapshot(collection(db, "empleado_tareas"), (snap) => {
                setTareasControl(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        }

        // Coleccion diminuta (un documento por empleado): alimenta "Equipo de Hoy".
        let unsubHorarios = () => {};
        if (activeView === "orders") {
            unsubHorarios = subscribeToHorarios(setHorarios);
        }

        if (["orders", "design_production"].includes(activeView)) {
            unsubDesigners = subscribeToDesigners((data) => setDesigners(data));
        }

        if (activeView === "wallets") {
            unsubMovimientosCaja = onSnapshot(collection(db, "movimientos_caja"), (snapshot) => {
                setMovimientosCaja(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        }

        return () => { unsubEmpleados(); unsubPagos(); unsubDesigners(); unsubMovimientosCaja(); unsubTareas(); unsubHorarios(); };
    }, [activeView]);

    useEffect(() => {
        if (!["financial_stats", "catalogo_ventas"].includes(activeView)) return;
        const unsub = subscribeToVentasCatalogo(setVentasCatalogo);
        return unsub;
    }, [activeView]);


    // --- 6. FILTROS ---
    const filteredOrdenes = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return ordenes.filter((o) => {
            const nOrden = String(o.ordenNumero || "");
            
            // Buscamos en todas las posibles estructuras antiguas y nuevas
            const clienteNombre = String(
                o.cliente?.nombreRazonSocial || 
                (o as any).clienteNombre || 
                (o as any).nombreCliente || 
                ""
            ).toLowerCase();
            
            return nOrden.includes(term) || clienteNombre.includes(term);
        });
    }, [ordenes, searchTerm]);

    const billingStats = useMemo(() => {
        const total = ordenes.length;
        // Con tolerancia de un céntimo: comparar con `>=` exacto dejaba 47 órdenes
        // ya cobradas fuera del contador de "Pagadas" por restos de coma flotante.
        const sinPagar = ordenes.filter(o => !o.montoPagadoUSD || o.montoPagadoUSD === 0).length;
        const abonadas = ordenes.filter(o => estaAbonada(o)).length;
        const pagadas = ordenes.filter(o => estaSaldada(o)).length;
        
        return { total, sinPagar, abonadas, pagadas };
    }, [ordenes]);

    const cardModalFilteredOrders = useMemo(() => {
        if (!cardModalState.type) return [];

        let result = [...ordenes];
        
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
                // ordenNumero convive en la base como número y como texto: sin
                // Number() la resta daba NaN y el listado no se ordenaba.
                case 'numero_orden': return (Number(b.ordenNumero) || 0) - (Number(a.ordenNumero) || 0);
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
    }, [ordenes, cardModalState.type, cardSortBy]);

    return (
      <NotificationProvider>
      <div className="flex h-screen bg-[#f2f2f7] dark:bg-black overflow-hidden relative font-sans text-slate-900 dark:text-white">

        {/* SIDEBAR — se posiciona, anima y maneja su propio backdrop móvil internamente */}
        <div id="main-sidebar">
            <Sidebar
                activeView={activeView}
                setActiveView={setActiveView as any}
                navItems={navItems as any}
                onLogout={logout}
                isMobileOpen={isSidebarOpen}
                setIsMobileOpen={setIsSidebarOpen}
                onNavigate={(view) => setActiveView(view as any)}
            />
        </div>
        
        <div className={cn("flex-1 flex flex-col relative transition-[padding] duration-300 ease-in-out min-w-0 overflow-hidden", isSidebarOpen ? "lg:pl-72" : "lg:pl-0")}>
          
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
                
                <Button variant="ghost" size="icon" className="rounded-2xl bg-blue-500/10 h-10 w-10 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors" onClick={() => setIsHelpOpen(true)} title="Guía del Sistema">
                    <HelpCircle className="h-5 w-5" />
                </Button>

                {/* Una sola campana para todo, la misma del menú lateral: lee del
                    contexto unificado y su contador ya no puede descuadrarse. */}
                <div id="notification-bell" className="relative">
                    <NotificationBell onNavigate={(vista) => { if (puedeVer(vista)) setActiveView(vista); }} />
                </div>
            </div>
          </header>

          {/* Los dos paneles deslizantes que había aquí (uno para "sistema" y otro
              para "gastos") leían campos distintos de la misma colección y cada uno
              enseñaba solo la mitad de los avisos. Ahora hay una sola bandeja: la
              campana del menú lateral para la vista rápida, y el Centro de
              Notificaciones para el historial completo con filtros. */}

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={activeView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={springConfig} className="h-full">
                
                {/* Antes, una vista sin permiso simplemente no renderizaba nada y el
                    usuario se quedaba mirando una pantalla en blanco sin saber por qué. */}
                {!puedeVer(activeView) && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                            <ShieldCheck className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                            <p className="font-black uppercase tracking-widest text-sm text-slate-700 dark:text-slate-200">
                                Sin acceso a esta sección
                            </p>
                            <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm">
                                Tu rango no tiene habilitada esta vista. Si la necesitas, pídele
                                al administrador que te la active en Accesos y Roles.
                            </p>
                        </div>
                    </div>
                )}

                {activeView === "orders" && puedeVer("orders") && (
                    <motion.div layout className="max-w-7xl mx-auto space-y-6 md:space-y-8">
                        
                        <NewsBar 
                            rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} 
                            gastosFijos={gastosFijos} 
                            empleados={empleados} 
                            ordenes={ordenes} 
                            designers={designers}
                            horarios={horarios}
                            gastos={gastos}
                            onAction={handleNewsAction}
                        />

                        {/* Resumen del día: responde a "qué pasa HOY". Se añade
                            encima de las tarjetas de siempre, sin sustituirlas. */}
                        <ResumenDelDia
                            ordenes={ordenes}
                            horarios={horarios}
                            onNavigate={(vista) => { if (puedeVer(vista)) setActiveView(vista) }}
                            onVerOrden={handleOpenOrderDetails}
                        />

                        <motion.div layout id="stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full">
                            <motion.div layout><StatCard label="Órdenes Totales" value={totalHistoricoOrdenes || billingStats.total} icon={<FileSpreadsheet />} color="blue" subtext="Histórico Real" onClick={() => setCardModalState({ isOpen: true, type: 'total' })} /></motion.div>
                            <motion.div layout><StatCard label="Sin Pagar" value={realBillingStats ? realBillingStats.sinPagar : billingStats.sinPagar} icon={<AlertCircle />} color="red" subtext="Cero abonos" onClick={() => setCardModalState({ isOpen: true, type: 'sinPagar' })} /></motion.div>
                            <motion.div layout><StatCard label="Abonadas" value={realBillingStats ? realBillingStats.abonadas : billingStats.abonadas} icon={<Clock />} color="orange" subtext="Saldo pendiente" onClick={() => setCardModalState({ isOpen: true, type: 'abonadas' })} /></motion.div>
                            <motion.div layout><StatCard label="Pagadas" value={realBillingStats ? realBillingStats.pagadas : billingStats.pagadas} icon={<CheckCircle2 />} color="green" subtext="Liquidadas" onClick={() => setCardModalState({ isOpen: true, type: 'pagadas' })} /></motion.div>
                        </motion.div>

                        <motion.div layout className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-white/40 dark:bg-white/5 p-4 rounded-[2rem] border border-black/5 shadow-sm">
                            <div className="relative w-full sm:max-w-md z-40">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar N° de Orden o cliente... (Presiona Enter)" 
                                    value={searchTerm} 
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setIsSearchDropdownOpen(true);
                                    }} 
                                    onKeyDown={handleDeepSearch}
                                    onFocus={() => setIsSearchDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsSearchDropdownOpen(false), 200)}
                                    className={cn(
                                        "w-full pl-12 pr-10 py-3 bg-white dark:bg-black/20 border border-black/5 text-sm outline-none transition-all focus:border-blue-500/50",
                                        isSearchDropdownOpen && suggestedClients.length > 0 ? "rounded-t-[1.8rem]" : "rounded-[1.8rem]"
                                    )} 
                                />
                                {isSearchingDeep && (
                                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
                                )}

                                {/* DROPDOWN DE AUTOCOMPLETADO */}
                                <AnimatePresence>
                                    {isSearchDropdownOpen && suggestedClients.length > 0 && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: -5 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            exit={{ opacity: 0, y: -5 }} 
                                            className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 border border-t-0 border-black/5 dark:border-white/10 shadow-2xl rounded-b-[1.8rem] overflow-hidden"
                                        >
                                            <div className="p-2">
                                                <div className="px-3 py-1 mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Sugerencias de Clientes</div>
                                                {suggestedClients.map(c => (
                                                    <div 
                                                        key={c.id} 
                                                        onClick={() => { 
                                                            setSearchTerm(c.nombreRazonSocial); 
                                                            setIsSearchDropdownOpen(false);
                                                        }} 
                                                        className="flex justify-between items-center px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                                                    >
                                                        <span className="truncate">{c.nombreRazonSocial}</span>
                                                        {c.tipoCliente === 'ALIADO' && (
                                                            <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-600 text-[8px] uppercase tracking-widest font-black">
                                                                Aliado
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <Button id="btn-new-order" onClick={() => { setEditingOrder(null); setIsWizardOpen(true); }} className="px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.8rem] font-bold text-sm gap-3 shrink-0"><Plus /> NUEVA ORDEN</Button>
                        </motion.div>

                        <motion.div layout className="-mx-1 sm:mx-0">
                            <OrdersTable
                                ordenes={filteredOrdenes}
                                onDelete={handleDeleteOrden}
                                onEdit={(o) => {setEditingOrder(o); setIsWizardOpen(true);}}
                                onRegisterPayment={handleOpenPaymentModal}
                                onSavePayment={async (ordenId, amount, note, img, method, discount, fechaPago, cuentaId) => {
                                    await handleRegisterOrderPayment(ordenId, amount, note, img, method, discount, fechaPago, cuentaId);
                                }}
                                onUpdateOrden={async (ordenId, changes) => {
                                    await actualizarOrden(ordenId, changes);
                                    setOrdenes(prev => prev.map(o => o.id === ordenId ? { ...o, ...changes } : o));
                                    if ((changes as any).estadoProduccion) {
                                        const o = ordenes.find(x => x.id === ordenId);
                                        if (o) {
                                            try {
                                                const { notificarEstadoProduccion } = await import('@/lib/services/notificaciones-service');
                                                await notificarEstadoProduccion({ ordenNumero: o.ordenNumero, cliente: o.cliente, estadoProduccion: (changes as any).estadoProduccion, id: ordenId });
                                            } catch { /* no-op */ }
                                        }
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

                {/* VISTA DE CONFIGURACIÓN DE PERFIL */}
                {activeView === "profile_settings" && puedeVer("profile_settings") && (
                    <ProfileSettingsView />
                )}

                {/* VISTA DE FINANZAS PERSONALES DEL EMPLEADO */}
                {activeView === "my_finances" && puedeVer("my_finances") && (
                    <EmployeeFinancesView
                        empleados={empleados}
                        pagos={pagos}
                        tareas={tareasControl}
                        currentUserId={currentUserId}
                        rates={{ usd: currentBcvRate, eur: eurRate }}
                    />
                )}

                {/* VISTA DE CONTROL DE TAREAS Y BONOS */}
                {activeView === "task_control" && puedeVer("task_control") && (
                    <TaskControlView
                        currentUser={userData}
                        empleadosDb={empleados}
                        rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
                    />
                )}

                {/* VISTA DEL TALLER DE PRODUCCIÓN (El componente en sí filtra las áreas) */}
                {activeView === "tasks_taller" && puedeVer("tasks_taller") && (
                    <TasksView />
                )}

                {/* VISTAS ADMINISTRATIVAS */}
                {activeView === "users_auth" && puedeVer("users_auth") && <UsersManagementView />}

                
                {activeView === "fixed_expenses" && puedeVer("fixed_expenses") && (
                    <GastosFijosView 
                        gastos={gastosFijos} 
                        rates={{ usd: currentBcvRate, eur: eurRate }} 
                        onNotification={(t, d) => { 
                            setRateToastMessage(d); setShowRateToast(true); setTimeout(() => setShowRateToast(false), 4000);
                            crearNotificacion({ titulo: t, cuerpo: d, tipo: 'warning', categoria: 'gasto', link: 'fixed_expenses' });
                        }} 
                    />
                )}
                
                {activeView === "insumos_mgmt" && puedeVer("insumos_mgmt") && <InsumosView gastos={gastos} currentBcvRate={currentBcvRate} currentUserId={currentUserId || ""} onCreateGasto={createGasto} onDeleteGasto={deleteGastoInsumo} />}

                {activeView === "financial_stats" && puedeVer("financial_stats") && <EstadisticasDashboard gastosInsumos={gastos as any} gastosFijos={gastosFijos} empleados={empleados} pagosEmpleados={pagos} cobranzas={ordenes.map(o => ({id: o.id, montoUSD: (o as any).totalUSD || 0, montoBs: (o as any).totalBs || 0, estado: o.estadoPago === 'PAGADO' ? 'pagado' : 'pendiente', fecha: o.fecha })) as any} ordenes={ordenes} clientes={clientes} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} ventasCatalogo={ventasCatalogo} />}

                {activeView === "catalogo_ventas" && puedeVer("catalogo_ventas") && (
                    <CatalogInventoryView
                        currentUser={userData}
                        rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
                        pdfLogoBase64={assets.logo}
                        firmaBase64={assets.firma}
                        selloBase64={assets.sello}
                    />
                )}
                {/* Consultar el horario lo puede hacer cualquiera con la vista;
                    modificarlo, solo quien supervisa. */}
                {activeView === "horarios" && puedeVer("horarios") && (
                    <HorariosView
                        empleados={empleados}
                        puedeEditar={puedeSupervisarTareas(userData?.rol)}
                    />
                )}

                {activeView === "employees_mgmt" && puedeVer("employees_mgmt") && <EmpleadosView empleados={empleados} pagos={pagos} tareas={tareasControl} rates={{ usd: currentBcvRate, eur: eurRate }} />}
                {activeView === "wallets" && puedeVer("wallets") && /* WalletsView carga sus propios movimientos desde Firestore: las listas
                     que se le pasaban antes (ordenes, gastos, nomina...) las descartaba
                     React sin usarlas. */
                    <WalletsView rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} />}
                {activeView === "payment_audit" && puedeVer("payment_audit") && <PaymentAuditView />}
                {activeView === "design_production" && puedeVer("design_production") && <DesignerPayrollView designers={designers} ordenes={ordenes} bcvRate={currentBcvRate} eurRate={eurRate} usdtRate={parallelRate} />}
                {activeView === "clients" && puedeVer("clients") && <ClientsAndPaymentsView ordenes={ordenes} rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }} onRegisterPayment={handleOpenPaymentModal} pdfLogoBase64={assets.logo} firmaBase64={assets.firma} selloBase64={assets.sello} />}

                {/* VISTA DE PRESUPUESTOS (Solo Admin y Ventas) */}
                {activeView === "calculator" && puedeVer("calculator") && (
                    <BudgetEntryView 
                        currentUserId={currentUserId}
                        rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
                        currentBcvRate={currentBcvRate}
                        pdfLogoBase64={assets.logo}
                        firmaBase64={assets.firma}
                        selloBase64={assets.sello}
                    />
                )}
                
                {/* HERRAMIENTAS LIBRES */}
                {activeView === "old_calculator" && puedeVer("old_calculator") && <CalculatorView onSendToProduction={handleSendCalcToOrder} />}
                {activeView === "ai_background" && puedeVer("ai_background") && <BackgroundRemoverView />}
                {activeView === "ai_upscale" && puedeVer("ai_upscale") && <UpscaleView />}
                {activeView === "format_converter" && puedeVer("format_converter") && <FormatConverterView />}

                {/* Centro de Notificaciones unificado: mismos datos que la campana,
                    con búsqueda y filtros por categoría, prioridad y estado de lectura. */}
                {activeView === "notifications_full" && puedeVer("notifications_full") && (
                    <NotificationCenter onNavigate={(vista) => { if (puedeVer(vista)) setActiveView(vista); }} />
                )}

              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <CurrencyToast show={showRateToast} message={rateToastMessage} onClose={() => setShowRateToast(false)} />

        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogContent className="w-full max-w-[95vw] lg:max-w-7xl h-[92vh] p-0 border-none bg-transparent shadow-none focus:outline-none overflow-visible">
            <DialogTitle className="sr-only">{editingOrder ? "Editar Orden" : "Nueva Orden"}</DialogTitle>
            <OrderFormWizardV2
                onClose={() => { setIsWizardOpen(false); setEditingOrder(null); }}
                initialData={editingOrder || undefined}
                currentUserId={currentUserId || ""}
                onCreate={handleCreateOrden}
                onUpdate={handleUpdateOrden}
                bcvRate={currentBcvRate}
                eurRate={eurRate}
            />
          </DialogContent>
        </Dialog>

        {selectedOrdenForPayment && (
            <PaymentEditModal
                key={selectedOrdenForPayment.id}
                isOpen={isPaymentModalOpen}
                onClose={() => { 
                    setIsPaymentModalOpen(false); 
                    setTimeout(() => setSelectedOrdenForPayment(null), 300);
                }}
                orden={selectedOrdenForPayment}
                rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
                onSave={async (amount, note, img, method, discount, fechaPago) => {
                    await handleRegisterOrderPayment(selectedOrdenForPayment.id!, amount, note, img, method, discount, fechaPago); 
                }}
                currentUserId={currentUserId || ""}
            />
        )}

        {/* MODAL DE DESGLOSE PARA LAS TARJETAS ESTADÍSTICAS */}
        <Dialog open={cardModalState.isOpen} onOpenChange={(open) => !open && setCardModalState({ isOpen: false, type: null })}>
            <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-[2rem] p-0 shadow-2xl">
                <div className="p-6 pb-0 flex flex-col gap-4">
                    <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                        {cardModalState.type === 'total' && "Todas las Órdenes"}
                        {cardModalState.type === 'sinPagar' && "Órdenes Sin Pagar"}
                        {cardModalState.type === 'abonadas' && "Órdenes Abonadas"}
                        {cardModalState.type === 'pagadas' && "Órdenes Pagadas"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Lista filtrada de órdenes para revisión administrativa</DialogDescription>

                    {/* Controles de Filtro */}
                    <div className="flex items-center gap-3 pb-4 border-b border-black/5 dark:border-white/5 overflow-x-auto custom-scrollbar">
                        <span className="text-sm font-semibold opacity-50 shrink-0">Ordenar por:</span>
                        <select
                            value={cardSortBy}
                            onChange={(e) => setCardSortBy(e.target.value as any)}
                            className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-sm rounded-xl px-4 py-2 outline-none font-medium cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                            <option value="reciente">Más reciente</option>
                            <option value="mayor_deuda">Mayor deuda</option>
                            <option value="mayor_abono">Mayor pago / abono</option>
                            <option value="numero_orden">Número de orden</option>
                            <option value="cliente">Cliente (A-Z)</option>
                        </select>
                    </div>
                </div>

                {/* Lista de ordenes */}
                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-3 custom-scrollbar">
                    {cardModalFilteredOrders.length === 0 ? (
                        <div className="text-center py-16 flex flex-col items-center justify-center opacity-50">
                            <AlertCircle className="w-12 h-12 mb-4" />
                            <p className="font-semibold text-lg">No hay órdenes en esta categoría.</p>
                        </div>
                    ) : (
                        cardModalFilteredOrders.map(o => {
                            const deuda = (o.totalUSD || 0) - (o.montoPagadoUSD || 0);
                            return (
                                <div 
                                    key={o.id} 
                                    onClick={() => handleOpenOrderDetails(o)}
                                    className="cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-white dark:bg-black/40 border border-black/5 dark:border-white/5 shadow-sm rounded-2xl gap-4 hover:border-blue-500 hover:shadow-md transition-all"
                                >
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm truncate text-blue-600 dark:text-blue-400">#{o.ordenNumero} - {o.cliente?.nombreRazonSocial || "Cliente S/N"}</div>
                                        <div className="text-xs font-semibold opacity-60 mt-1">
                                            {o.fecha ? (typeof o.fecha === 'string' ? new Date(o.fecha).toLocaleDateString() : (o.fecha as any).toDate?.().toLocaleDateString() || 'Sin fecha') : 'Sin fecha'}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 sm:gap-6 text-sm sm:text-right shrink-0">
                                        <div>
                                            <div className="text-[10px] uppercase font-bold opacity-50">Total</div>
                                            <div className="font-bold">${(o.totalUSD || 0).toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-bold opacity-50">Pagado</div>
                                            <div className="font-bold text-emerald-600">${(o.montoPagadoUSD || 0).toFixed(2)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-bold opacity-50">Deuda</div>
                                            <div className={cn("font-bold", deuda > 0.01 ? "text-red-500" : "text-slate-500")}>${deuda > 0.01 ? deuda.toFixed(2) : '0.00'}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>

        {/* MODAL PARA MOSTRAR LOS DETALLES DE LA ORDEN */}
        <OrderDetailModal
            open={isDetailModalOpen}
            onClose={() => {
                setIsDetailModalOpen(false);
                setTimeout(() => setSelectedOrderForDetails(null), 300);
            }}
            orden={selectedOrderForDetails}
            rates={{ usd: currentBcvRate, eur: eurRate, usdt: parallelRate }}
        />

        {/* GUÍA DEL SISTEMA */}
        <HelpModal
            open={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
            activeView={activeView}
            onNavigate={(view) => { setActiveView(view); setIsHelpOpen(false) }}
        />

      </div>
      </NotificationProvider>
    )
}

// Sub-componentes visuales
function TasaHeaderBadge({ label, value, icon, color, onClick }: any) {
    const colors: any = { 
        emerald: "bg-emerald-500/10 text-emerald-600", 
        orange: "bg-orange-500/10 text-orange-600", 
        blue: "bg-blue-500/10 text-blue-600" 
    }
    return (
        <motion.div 
            whileHover={{ y: -1, scale: 1.02 }} 
            onClick={onClick} 
            className="bg-white dark:bg-white/5 px-4 py-2 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3 cursor-pointer shrink-0"
        >
            <div className={cn("p-1.5 rounded-xl", colors[color])}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-[9px] font-bold text-black/30 dark:text-white/30 uppercase leading-none mb-0.5">{label}</span>
                <span className="text-sm font-bold">{value ? value.toFixed(2) : "---"}</span>
            </div>
        </motion.div>
    )
}

function StatCard({ label, value, icon, subtext, color, className, onClick }: any) {
    const theme: any = { 
        blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", 
        orange: "bg-orange-500/10 text-orange-600 border-orange-500/20", 
        green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        red: "bg-red-500/10 text-red-600 border-red-500/20"
    }
    
    return (
        <Card 
            onClick={onClick}
            className={cn(
                "border shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-[#1c1c1e] transition-all w-full", 
                onClick && "cursor-pointer hover:shadow-lg hover:-translate-y-1 duration-300 hover:border-black/10 dark:hover:border-white/10",
                className
            )}
        >
            <CardContent className="p-4 sm:p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-[1.8rem] shadow-inner shrink-0", theme[color])}>
                    {icon && React.cloneElement(icon as any, { className: "w-8 h-8" })}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-black/30 dark:text-white/30 truncate">{label}</p>
                    <p className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tighter break-all leading-tight">{value}</p>
                    <p className="text-[9px] font-semibold text-black/40 dark:text-white/40 uppercase truncate">{subtext}</p>
                </div>
            </CardContent>
        </Card>
    )
}
