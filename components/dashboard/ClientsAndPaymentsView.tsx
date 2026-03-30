// @/components/dashboard/ClientsAndPaymentsView.tsx
"use client"

import React, { useMemo, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type OrdenServicio, EstadoPago } from '@/lib/types/orden'
import { formatCurrency } from '@/lib/utils/order-utils' 
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { 
    Wallet, Search, 
    CheckCircle2, ChevronDown, ChevronUp, DollarSign, 
    CalendarClock, Activity, Sparkles,
    ChevronLeft, ChevronRight, Layers, CreditCard,
    UploadCloud, X, Loader2,
    Printer, Banknote, History, Trash2, Eye, EyeOff,
    Lock, Unlock, ExternalLink, ImageIcon, Landmark, Coins
} from 'lucide-react'

// Servicios y Utilidades
import { PaymentHistoryView } from '@/components/orden/PaymentHistoryView' 
import { OrderDetailModal } from '@/components/orden/order-detail-modal' 
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"
import { generateGeneralAccountStatusPDF } from "@/lib/services/pdf-generator"
import { buscarOrdenesHistoricas } from "@/lib/services/ordenes-service" 
import { getFrequentClients } from "@/lib/firebase/clientes" // <-- NUEVA IMPORTACIÓN
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// FIREBASE
import { db } from "@/lib/firebase"
import { collection, doc, updateDoc, arrayUnion, writeBatch, query, where, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore"

interface ClientSummary {
    key: string
    nombre: string
    rif: string
    totalOrdenes: number
    totalPendienteUSD: number
    ordenesPendientes: OrdenServicio[]
}

interface ClientsAndPaymentsViewProps {
    ordenes?: any[]; 
    rates: {
        usd: number;
        eur: number;
        usdt: number;
    };
    onRegisterPayment: (orden: OrdenServicio) => void; 
    pdfLogoBase64?: string;
    firmaBase64?: string;
    selloBase64?: string;
}

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } }
}

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
}

export function ClientsAndPaymentsView({ 
    rates, 
    onRegisterPayment,
    pdfLogoBase64,
    firmaBase64,
    selloBase64 
}: ClientsAndPaymentsViewProps) {
    
    // --- ESTADOS AUTÓNOMOS DE LA VISTA (Ahorro de Cuota) ---
    const [localUnpaidOrders, setLocalUnpaidOrders] = useState<any[]>([]);
    const [localPaidOrders, setLocalPaidOrders] = useState<any[]>([]);
    const [historicasBusqueda, setHistoricasBusqueda] = useState<any[]>([]); 
    const [isLoadingCobranzas, setIsLoadingCobranzas] = useState(true);

    // --- ESTADOS DE UI Y FILTROS ---
    const [searchTerm, setSearchTerm] = useState('')
    const [isSearchingDeep, setIsSearchingDeep] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 5
    const [expandedOrdenId, setExpandedOrdenId] = useState<string | null>(null);
    const [frequentClients, setFrequentClients] = useState<any[]>([]); // <-- NUEVO ESTADO
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // <-- NUEVO ESTADO

    // --- ESTADOS DE PRIVACIDAD ---
    const [showTotalDeuda, setShowTotalDeuda] = useState(false);

    // --- ESTADOS DE MODAL GLOBAL (Pago) ---
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false)
    const [selectedClientForGlobal, setSelectedClientForGlobal] = useState<ClientSummary | null>(null)
    const [selectedOrdersForGlobal, setSelectedOrdersForGlobal] = useState<string[]>([])
    const [globalPaymentData, setGlobalPaymentData] = useState({ nota: '', imagenUrl: '' })
    
    // --- NUEVOS ESTADOS: CÁLCULO DE TASAS GLOBALES Y BILLETERAS ---
    const [globalWallet, setGlobalWallet] = useState('cash_usd'); 
    const [globalCurrencyMode, setGlobalCurrencyMode] = useState<'USD' | 'BS'>('USD');
    const [globalCalculationBase, setGlobalCalculationBase] = useState<'USD' | 'EUR' | 'USDT'>('USD');
    const [globalAmountUSD, setGlobalAmountUSD] = useState<string>('');
    const [globalAmountBS, setGlobalAmountBS] = useState<string>('');
    
    // --- ESTADOS DE HISTORIAL Y VISOR ---
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false) 
    const [viewingImage, setViewingImage] = useState<string | null>(null)
    const [viewingOrderDetails, setViewingOrderDetails] = useState<OrdenServicio | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null) 
    const [isGlobalUploading, setIsGlobalUploading] = useState(false) 
    const globalFileInputRef = useRef<HTMLInputElement>(null)

    // ==============================================================
    // FETCH AUTÓNOMO (LA PIEZA MAESTRA DEL AHORRO) Y CLIENTES
    // ==============================================================
    useEffect(() => {
        setIsLoadingCobranzas(true);
        
        // Cargar clientes frecuentes para el autocompletado
        getFrequentClients().then(clients => {
            setFrequentClients(clients.map(c => ({
                id: c.id!, nombreRazonSocial: c.nombreRazonSocial, 
                tipoCliente: c.tipoCliente || "REGULAR", rifCedula: c.rifCedulaCompleto, 
                telefono: c.telefonoCompleto
            })));
        }).catch(err => console.error("Error al cargar clientes:", err));

        // 1. CARTERA EN MORA
        const qUnpaid = query(
            collection(db, "ordenes"), 
            where("estadoPago", "in", ["PENDIENTE", "ABONADO"])
        );
        
        const unsubUnpaid = onSnapshot(qUnpaid, (snap) => {
            setLocalUnpaidOrders(snap.docs.map(d => ({id: d.id, ...d.data()})));
            setIsLoadingCobranzas(false);
        });

        // 2. LIQUIDADAS
        const qPaid = query(
            collection(db, "ordenes"), 
            where("estadoPago", "==", "PAGADO"), 
            orderBy("fecha", "desc"), 
            limit(50)
        );

        const unsubPaid = onSnapshot(qPaid, (snap) => {
            setLocalPaidOrders(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });

        return () => { unsubUnpaid(); unsubPaid(); };
    }, []);

    // ==============================================================
    // TIEMPO REAL PARA ÓRDENES HISTÓRICAS (BLINDAJE)
    // ==============================================================
    useEffect(() => {
        if (historicasBusqueda.length === 0) return;
        
        const unsubs = historicasBusqueda.map(ord => 
            onSnapshot(doc(db, "ordenes", ord.id), (docSnap) => {
                if (docSnap.exists()) {
                    const dataActualizada = { id: docSnap.id, ...docSnap.data() };
                    setHistoricasBusqueda(prev => prev.map(o => o.id === ord.id ? dataActualizada : o));
                }
            })
        );

        return () => unsubs.forEach(unsub => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historicasBusqueda.map(o => o.id).join(',')]);

    // ==============================================================
    // BÚSQUEDA PROFUNDA EN HISTORIAL 
    // ==============================================================
    const handleDeepSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchTerm.trim() !== '') {
            setIsDropdownOpen(false); // Cierra el menú al hacer Enter
            setIsSearchingDeep(true);
            try {
                const resultados = await buscarOrdenesHistoricas(searchTerm);

                if (resultados && resultados.length > 0) {
                    toast.success(`Se encontraron ${resultados.length} facturas históricas.`);
                    
                    setHistoricasBusqueda(prev => {
                        const updated = [...prev];
                        resultados.forEach(res => {
                            if (!updated.find(o => o.id === res.id)) updated.push(res);
                        });
                        return updated;
                    });

                } else {
                    toast.error(`No hay registros históricos para "${searchTerm}".`);
                }
            } catch (error) {
                console.error("Error en búsqueda profunda:", error);
                toast.error("Error al buscar en la base de datos.");
            } finally {
                setIsSearchingDeep(false);
            }
        }
    };

    // --- AUTOCOMPLETADO DE CLIENTES ---
    const filteredClientsDropdown = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerTerm = searchTerm.toLowerCase();
        return frequentClients.filter(c => 
            (c.nombreRazonSocial && c.nombreRazonSocial.toLowerCase().includes(lowerTerm)) ||
            (c.rifCedula && c.rifCedula.toLowerCase().includes(lowerTerm))
        ).slice(0, 8); // Top 8 resultados para no saturar
    }, [frequentClients, searchTerm]);

    // ==============================================================
    // LÓGICA INTELIGENTE DE BILLETERAS Y TASAS
    // ==============================================================
    useEffect(() => {
        if (globalWallet === 'bank_bs') { setGlobalCurrencyMode('BS'); setGlobalCalculationBase('USD'); } 
        else { setGlobalCurrencyMode('USD'); }
        setGlobalAmountUSD(''); setGlobalAmountBS('');
    }, [globalWallet])

    const getActiveRate = (base: string) => base === 'USD' ? rates.usd : base === 'EUR' ? rates.eur : rates.usdt;

    const handleAmountUSDChange = (valStr: string) => {
        setGlobalAmountUSD(valStr);
        const valUsd = parseFloat(valStr);
        if (!isNaN(valUsd)) setGlobalAmountBS((valUsd * getActiveRate(globalCalculationBase)).toFixed(2));
        else setGlobalAmountBS('');
    };

    const handleAmountBSChange = (valStr: string) => {
        setGlobalAmountBS(valStr);
        const valBs = parseFloat(valStr);
        if (!isNaN(valBs)) setGlobalAmountUSD((valBs / getActiveRate(globalCalculationBase)).toFixed(2));
        else setGlobalAmountUSD('');
    };

    const handleRateChange = (newBase: 'USD' | 'EUR' | 'USDT') => {
        setGlobalCalculationBase(newBase);
        const currentUsd = parseFloat(globalAmountUSD);
        if (!isNaN(currentUsd) && currentUsd > 0) setGlobalAmountBS((currentUsd * getActiveRate(newBase)).toFixed(2));
    };

    useEffect(() => {
        if (isGlobalModalOpen && selectedClientForGlobal) {
            const sumUSD = selectedClientForGlobal.ordenesPendientes
                .filter(o => selectedOrdersForGlobal.includes(o.id))
                .reduce((acc, orden) => {
                    const deuda = Number(orden.totalUSD) - (Number(orden.montoPagadoUSD) || 0);
                    return acc + Math.max(0, deuda);
                }, 0);

            if (sumUSD > 0) {
                setGlobalAmountUSD(sumUSD.toFixed(2));
                setGlobalAmountBS((sumUSD * getActiveRate(globalCalculationBase)).toFixed(2));
            } else { setGlobalAmountUSD(''); setGlobalAmountBS(''); }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrdersForGlobal]); 

    // --- PROCESAMIENTO DE DATOS LOCALES ---
    const { clientSummaries, pagadasCompletamente, totalPendienteGlobal } = useMemo(() => {
        const summaryMap = new Map<string, ClientSummary>()
        let totalPendGlobal = 0;
        const lowerCaseSearch = searchTerm.toLowerCase().trim();

        // 1. UNIFICAR LISTAS (Firebase + Históricas Ancladas)
        const mapUnpaid = new Map<string, any>();
        localUnpaidOrders.forEach(o => mapUnpaid.set(o.id, o));
        historicasBusqueda.filter(o => o.estadoPago === 'PENDIENTE' || o.estadoPago === 'ABONADO').forEach(o => mapUnpaid.set(o.id, o));
        const todasUnpaid = Array.from(mapUnpaid.values());

        const mapPaid = new Map<string, any>();
        localPaidOrders.forEach(o => mapPaid.set(o.id, o));
        historicasBusqueda.filter(o => o.estadoPago === 'PAGADO').forEach(o => mapPaid.set(o.id, o));
        const todasPaid = Array.from(mapPaid.values());

        // 2. PROCESAR PAGADAS
        const pagadas = todasPaid
            .filter((o: any) => {
                const nombreCliente = (o.cliente?.nombreRazonSocial || '').toLowerCase();
                const numOrden = String(o.ordenNumero || '');
                const coincideBusqueda = !lowerCaseSearch || nombreCliente.includes(lowerCaseSearch) || numOrden.includes(lowerCaseSearch);
                return coincideBusqueda && o.estadoPago !== 'ANULADO';
            });

        // 3. PROCESAR MOROSAS
        todasUnpaid.forEach((orden: any) => {
            if (orden.estado === 'ANULADO' || orden.estadoPago === 'ANULADO') return;

            const total = Number(orden.totalUSD) || 0;
            const pagado = Number(orden.montoPagadoUSD) || 0;
            const pendiente = Math.max(0, total - pagado);
            
            const nombreCliente = (orden.cliente?.nombreRazonSocial || '').toLowerCase();
            const numOrden = String(orden.ordenNumero || '');
            const coincideBusqueda = !lowerCaseSearch || nombreCliente.includes(lowerCaseSearch) || numOrden.includes(lowerCaseSearch);

            if (pendiente > 0.01 && coincideBusqueda) {
                totalPendGlobal += pendiente;
                const key = (orden.cliente?.nombreRazonSocial || 'S/N').trim().toUpperCase();
                
                if (!summaryMap.has(key)) {
                    summaryMap.set(key, { key, nombre: orden.cliente?.nombreRazonSocial || 'Cliente sin nombre', rif: orden.cliente?.rifCedula || 'S/N', totalOrdenes: 0, totalPendienteUSD: 0, ordenesPendientes: [] });
                }
                const s = summaryMap.get(key)!;
                s.totalPendienteUSD += pendiente;
                s.totalOrdenes += total;
                s.ordenesPendientes.push(orden);
            }
        });

        summaryMap.forEach(s => s.ordenesPendientes.sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()));

        return { 
            clientSummaries: Array.from(summaryMap.values()).sort((a, b) => b.totalPendienteUSD - a.totalPendienteUSD), 
            pagadasCompletamente: pagadas, 
            totalPendienteGlobal: totalPendGlobal 
        };
    }, [localUnpaidOrders, localPaidOrders, historicasBusqueda, searchTerm]);

    const totalPages = Math.ceil(clientSummaries.length / itemsPerPage);
    const paginatedClients = useMemo(() => clientSummaries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [clientSummaries, currentPage]);

    const getItemTotal = (item: any) => {
        const qty = parseFloat(item.cantidad?.toString()) || 0;
        const x = parseFloat(item.medidaXCm) || 0;
        const y = parseFloat(item.medidaYCm) || 0;
        const price = parseFloat(item.precioUnitario?.toString()) || 0;

        if (item.subtotal) return parseFloat(item.subtotal);
        if (item.unidad === "m2" && x > 0 && y > 0) return (x / 100) * (y / 100) * price * qty;
        return price * qty;
    };

    // --- REPORTES PDF ---
    const handleGenerateGeneralReceipt = (summary: ClientSummary, rateType: 'USD' | 'EUR' | 'USDT' | 'USD_ONLY') => {
        try {
            toast.loading(`Generando estado de cuenta...`);
            let selectedCurrency = { rate: rates.usd, label: "Tasa BCV ($)", symbol: "Bs." };
            if (rateType === 'EUR') selectedCurrency = { rate: rates.eur, label: "Tasa BCV (€)", symbol: "Bs." };
            if (rateType === 'USDT') selectedCurrency = { rate: rates.usdt, label: "Tasa Monitor", symbol: "Bs." };
            if (rateType === 'USD_ONLY') selectedCurrency = { rate: 1, label: "", symbol: "" };

            const consolidatedItems = summary.ordenesPendientes.flatMap(orden => 
                (orden.items || []).map((item: any) => {
                    const qty = parseFloat(item.cantidad?.toString()) || 0;
                    const x = parseFloat(item.medidaXCm) || 0;
                    const y = parseFloat(item.medidaYCm) || 0;
                    let itemSubtotal = 0;
                    
                    if (item.subtotal !== undefined && item.subtotal !== null) itemSubtotal = parseFloat(item.subtotal);
                    else if (item.totalAjustado !== undefined) itemSubtotal = parseFloat(item.totalAjustado);
                    else {
                        const price = parseFloat(item.precioUnitario?.toString()) || 0;
                        if (item.unidad === "m2" && x > 0 && y > 0) itemSubtotal = (x / 100) * (y / 100) * price * qty;
                        else itemSubtotal = price * qty;
                    }

                    return { parentOrder: `#${orden.ordenNumero || 'S/N'}`, nombre: item.nombre, cantidad: qty, medidasTiempo: item.unidad === "m2" ? `${x}x${y}cm` : (item.tiempoCorte || "N/A"), precioUnitario: qty > 0 ? (itemSubtotal / qty) : 0, totalUSD: itemSubtotal };
                })
            );

            generateGeneralAccountStatusPDF(
                { clienteNombre: summary.nombre, clienteRIF: summary.rif, items: consolidatedItems, totalPendienteUSD: summary.totalPendienteUSD, fechaReporte: new Date().toLocaleDateString('es-VE') },
                pdfLogoBase64 || "", { firmaBase64, selloBase64, currency: selectedCurrency }
            );
            toast.dismiss(); toast.success("PDF Generado");
        } catch (error) { toast.dismiss(); toast.error("Error al generar reporte"); }
    };

    // --- MANEJO DE ABONO GLOBAL ---
    const handleGlobalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setPreviewUrl(URL.createObjectURL(file));
            setIsGlobalUploading(true);
            toast.loading("Subiendo comprobante...");
            const url = await uploadFileToCloudinary(file);
            setGlobalPaymentData(prev => ({ ...prev, imagenUrl: url }));
            toast.dismiss(); toast.success("Comprobante cargado");
        } catch (error) {
            toast.dismiss(); toast.error("Error al subir imagen"); setPreviewUrl(null);
        } finally { setIsGlobalUploading(false); if (globalFileInputRef.current) globalFileInputRef.current.value = ''; }
    };

    const handleProcessGlobalPayment = async () => {
        const finalAmountUSD = parseFloat(globalAmountUSD || '0');

        if (!selectedClientForGlobal || finalAmountUSD <= 0 || isGlobalUploading || selectedOrdersForGlobal.length === 0) return;
        
        let remaining = finalAmountUSD;
        let finalNota = globalPaymentData.nota;

        if (globalCurrencyMode === 'BS') {
            const activeRate = getActiveRate(globalCalculationBase);
            const symbol = globalCalculationBase === 'USD' ? '$' : globalCalculationBase === 'EUR' ? '€' : '₮';
            const autoNote = ` [Ref: Bs. ${parseFloat(globalAmountBS).toLocaleString('es-VE')} @ ${activeRate.toFixed(2)} (${symbol})]`;
            finalNota = (finalNota + autoNote).trim();
        }

        let metodoLegible = "Efectivo USD";
        if (globalWallet === 'bank_bs') metodoLegible = "Pago Móvil / Bs";
        if (globalWallet === 'zelle') metodoLegible = "Zelle";
        if (globalWallet === 'usdt') metodoLegible = "Binance USDT";
        if (globalWallet === 'cash_usd' && globalCurrencyMode === 'BS') metodoLegible = "Efectivo Bs";

        const metodoFinal = `${metodoLegible} (Abono Global)`;
        
        try {
            toast.loading("Distribuyendo abono...");
            const batch = writeBatch(db); 
            const ordersToProcess = selectedClientForGlobal.ordenesPendientes.filter(o => selectedOrdersForGlobal.includes(o.id));

            for (const orden of ordersToProcess) {
                if (remaining <= 0.009) break;

                const saldoOrden = Number(orden.totalUSD) - (Number(orden.montoPagadoUSD) || 0);
                const aPagar = Math.min(remaining, saldoOrden);

                if (aPagar > 0.009) {
                    const ordenRef = doc(db, "ordenes", orden.id);
                    const nuevoMontoPagado = (Number(orden.montoPagadoUSD) || 0) + aPagar;
                    const nuevoEstado = (Number(orden.totalUSD) - nuevoMontoPagado) <= 0.01 ? "PAGADO" : "ABONADO";

                    const nuevoRecibo = { montoUSD: aPagar, fecha: new Date().toISOString(), nota: finalNota, imagenUrl: globalPaymentData.imagenUrl || "", tasaBCV: rates.usd, metodo: metodoFinal };

                    batch.update(ordenRef, { montoPagadoUSD: nuevoMontoPagado, estadoPago: nuevoEstado, registroPagos: arrayUnion(nuevoRecibo) });
                    remaining -= aPagar;
                }
            }

            await batch.commit(); 

            toast.dismiss(); toast.success("Abono global aplicado correctamente");
            closeGlobalModal();
        } catch (error) { console.error(error); toast.dismiss(); toast.error("Error al procesar el pago global"); }
    };

    const closeGlobalModal = () => {
        setIsGlobalModalOpen(false); setPreviewUrl(null); setGlobalPaymentData({ nota: '', imagenUrl: '' });
        setSelectedOrdersForGlobal([]); setGlobalAmountUSD(''); setGlobalAmountBS('');
        setGlobalCurrencyMode('USD'); setGlobalCalculationBase('USD'); setGlobalWallet('cash_usd'); 
    };

    // --- REVERSIÓN DE ABONOS ---
    const handleRevertGlobalBatch = async (group: any, fullOrdersReference: any[]) => {
        if (!confirm(`¿Estás seguro de revertir este abono global de ${formatCurrency(group.totalMonto)}?\n\nSe restará el saldo de ${group.distribucion.length} órdenes y se eliminará este registro.`)) return;
    
        try {
            toast.loading("Revirtiendo abonos...");
            const batch = writeBatch(db);
            let operationsCount = 0;
    
            for (const item of group.distribucion) {
                const ordenOriginal = fullOrdersReference.find((o: any) => o.id === item.ordenId);
                if (!ordenOriginal) continue;
    
                const ordenRef = doc(db, "ordenes", item.ordenId);
                const nuevoMontoPagado = Math.max(0, (Number(ordenOriginal.montoPagadoUSD) || 0) - item.montoAbonado);
                const nuevoEstado = (Number(ordenOriginal.totalUSD) - nuevoMontoPagado) <= 0.01 ? "PAGADO" : (nuevoMontoPagado > 0 ? "ABONADO" : "PENDIENTE");
    
                const nuevoHistorial = (ordenOriginal.registroPagos || []).filter((p: any) => {
                    if (group.imagenUrl && p.imagenUrl === group.imagenUrl) return false;
                    const isSameDate = p.fecha === item.pagoRef.fecha || p.fechaRegistro === item.pagoRef.fechaRegistro;
                    const isSameAmount = parseFloat(p.montoUSD) === item.montoAbonado;
                    const isSameNote = p.nota === item.pagoRef.nota;
                    if (isSameDate && isSameAmount && isSameNote) return false; 
                    return true; 
                });
    
                batch.update(ordenRef, { montoPagadoUSD: nuevoMontoPagado, estadoPago: nuevoEstado, registroPagos: nuevoHistorial });
                operationsCount++;
            }
    
            if (operationsCount > 0) {
                await batch.commit();
                toast.dismiss(); toast.success("Abono global revertido correctamente");
                setIsHistoryModalOpen(false); 
            } else { toast.dismiss(); toast.error("No se encontraron órdenes para revertir."); }
    
        } catch (error) { toast.dismiss(); toast.error("Error al revertir el abono"); }
    };

    const formatBs = (amount: number, rate: number) => { return `Bs. ${(amount * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative space-y-10 p-2 font-sans selection:bg-blue-100 min-h-[500px]">
            
            {/* SPINNER DE PROTECCIÓN */}
            {isLoadingCobranzas && (
                <div className="absolute inset-0 z-50 bg-white/50 dark:bg-[#1c1c1e]/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-[3rem]">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                    <p className="text-sm font-black uppercase text-slate-500 tracking-widest">Sincronizando Cartera...</p>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white flex items-center gap-3">
                        <Wallet className="w-10 h-10 text-blue-600 drop-shadow-lg"/> Cobranzas <span className="text-blue-600">Pro</span>
                    </h2>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Siskoven SMR - Entorno Shared</p>
                </div>
                
                {/* BUSCADOR CON SOPORTE DE BÚSQUEDA PROFUNDA Y AUTOCOMPLETADO */}
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl p-2 rounded-[2rem] border border-white/20 shadow-2xl flex gap-2 w-full md:w-auto relative z-50">
                    <div className="relative flex-1 md:w-[350px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                        <input
                            placeholder="Buscar cliente... (Enter para historial)"
                            value={searchTerm}
                            onChange={(e) => { 
                                setSearchTerm(e.target.value); 
                                setCurrentPage(1); 
                                setIsDropdownOpen(true);
                            }}
                            onKeyDown={handleDeepSearch}
                            onFocus={() => setIsDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                            className={cn(
                                "pl-12 pr-10 py-3 w-full bg-white dark:bg-slate-900 border-0 shadow-inner text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-blue-500/20",
                                isDropdownOpen && filteredClientsDropdown.length > 0 ? "rounded-t-[1.5rem]" : "rounded-[1.5rem]"
                            )}
                        />
                        {isSearchingDeep && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
                        )}

                        {/* MENÚ DESPLEGABLE DE CLIENTES */}
                        <AnimatePresence>
                            {isDropdownOpen && filteredClientsDropdown.length > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0, y: -5 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    exit={{ opacity: 0, y: -5 }} 
                                    className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 border border-t-0 shadow-xl rounded-b-[1.5rem] overflow-hidden max-h-60 overflow-y-auto"
                                >
                                    <div className="p-1">
                                        {filteredClientsDropdown.map(c => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => { 
                                                    setSearchTerm(c.nombreRazonSocial); 
                                                    setIsDropdownOpen(false);
                                                    setCurrentPage(1);
                                                }} 
                                                className="flex justify-between items-center px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                                            >
                                                <span className="truncate">{c.nombreRazonSocial}</span>
                                                {c.tipoCliente === 'ALIADO' && (
                                                    <Badge className="h-4 bg-purple-100 text-purple-600 border-none text-[8px] uppercase">Aliado</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="rounded-full w-12 h-12 bg-white dark:bg-black/20 text-blue-600 hover:scale-105 transition-transform shrink-0"
                        title="Historial de Abonos Globales"
                    >
                        <History className="w-6 h-6" />
                    </Button>
                </div>
            </div>

            {/* KPI ISLAND */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                <motion.div variants={itemVariants} className="md:col-span-1">
                    <Card className="rounded-[3rem] border-0 bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-2xl relative p-8 space-y-4">
                        <Activity className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12" />
                        
                        <div className="flex justify-between items-center relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Total por Cobrar</p>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setShowTotalDeuda(!showTotalDeuda)}
                                className="text-white/70 hover:text-white hover:bg-white/20 rounded-full h-8 w-8 transition-colors"
                            >
                                {showTotalDeuda ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-5xl font-black tracking-tighter">
                                {showTotalDeuda ? formatCurrency(totalPendienteGlobal) : "$***.**"}
                            </h3>
                            <p className="text-xs font-bold opacity-80 mt-2">
                                ≈ {showTotalDeuda ? formatBs(totalPendienteGlobal, rates.usd) : "Bs. ***.**"} (BCV)
                            </p>
                        </div>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants} className="md:col-span-2">
                    <Card className="rounded-[3rem] border-0 bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl shadow-2xl flex items-center p-8">
                        <div className="grid grid-cols-2 w-full gap-8">
                            <div className="border-r border-slate-200/50 dark:border-white/10 pr-8">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Clientes en Mora</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{clientSummaries.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Estado Activo</p>
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-blue-500" />
                                    <p className="text-3xl font-black text-blue-600 tracking-tighter italic uppercase">Flujo OK</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>
            </div>

            {/* SECCIÓN DE CARTERA PENDIENTE */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center px-2 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-rose-100 dark:bg-rose-500/20 rounded-xl text-rose-600"><CalendarClock className="w-6 h-6" /></div>
                        <h3 className="text-xl font-black tracking-tight uppercase italic">Cartera Pendiente</h3>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 bg-white/50 dark:bg-white/5 p-1 rounded-full border border-black/5">
                            <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="w-4 h-4"/></Button>
                            <span className="text-[10px] font-black px-2 uppercase tracking-widest">Pág {currentPage} de {totalPages}</span>
                            <Button variant="ghost" size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="w-4 h-4"/></Button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <AnimatePresence mode="popLayout">
                        {paginatedClients.map((summary) => (
                            <motion.div key={summary.key} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                <Card className="rounded-[2.5rem] border-0 bg-white dark:bg-slate-900 shadow-xl overflow-hidden group">
                                    {/* HEADER DEL CLIENTE */}
                                    <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50 dark:bg-white/5 border-b border-black/5">
                                        <div className="flex items-center gap-6">
                                            <div className="h-16 w-16 rounded-[1.5rem] bg-blue-600 text-white flex items-center justify-center font-black text-2xl uppercase italic">{summary.nombre.charAt(0)}</div>
                                            <div>
                                                <h4 className="text-xl font-black uppercase italic leading-none mb-1">{summary.nombre}</h4>
                                                <Badge variant="outline" className="rounded-lg border-slate-200 dark:border-white/10 text-[9px] font-black tracking-widest">{summary.rif}</Badge>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col md:flex-row items-center gap-4">
                                            <div className="text-center md:text-right mr-4">
                                                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Saldo Total</p>
                                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(summary.totalPendienteUSD)}</p>
                                            </div>

                                            <div className="flex gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button 
                                                            variant="outline"
                                                            className="rounded-2xl border-slate-200 dark:border-white/10 font-black py-7 px-6 text-xs uppercase italic tracking-widest gap-3 shadow-sm hover:bg-slate-100 dark:hover:bg-white/5"
                                                        >
                                                            <Printer className="w-5 h-5 text-slate-500"/> Recibo General <ChevronDown className="w-3 h-3 opacity-50"/>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-2xl min-w-[200px]">
                                                        <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400">Seleccionar Tasa</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleGenerateGeneralReceipt(summary, 'USD')} className="gap-3 py-3 cursor-pointer">
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">BCV $</Badge>
                                                            <span className="font-bold text-xs">{rates.usd.toFixed(2)}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleGenerateGeneralReceipt(summary, 'EUR')} className="gap-3 py-3 cursor-pointer">
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">BCV €</Badge>
                                                            <span className="font-bold text-xs">{rates.eur.toFixed(2)}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleGenerateGeneralReceipt(summary, 'USDT')} className="gap-3 py-3 cursor-pointer">
                                                            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Monitor</Badge>
                                                            <span className="font-bold text-xs">{rates.usdt.toFixed(2)}</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleGenerateGeneralReceipt(summary, 'USD_ONLY')} className="gap-3 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10">
                                                            <Banknote className="w-4 h-4 text-slate-500" />
                                                            <span className="font-bold text-xs text-slate-600 dark:text-slate-300">Solo Dólares (Sin Bs)</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                {summary.ordenesPendientes.length > 1 && (
                                                    <Button 
                                                        onClick={() => { 
                                                            setSelectedClientForGlobal(summary); 
                                                            setSelectedOrdersForGlobal([]);
                                                            setIsGlobalModalOpen(true); 
                                                        }}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black py-7 px-8 text-xs uppercase italic tracking-widest gap-3 shadow-xl"
                                                    >
                                                        <Layers className="w-5 h-5"/> Abono Global
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* TABLA DE ÓRDENES */}
                                    <Table>
                                        <TableBody>
                                            {summary.ordenesPendientes.map((orden) => (
                                                <React.Fragment key={orden.id}>
                                                    <TableRow className="border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                        <TableCell className="pl-10 font-black text-slate-400 text-xs italic">ORDEN #{orden.ordenNumero}</TableCell>
                                                        <TableCell className="text-right font-black text-rose-600 text-lg tracking-tight">
                                                            {formatCurrency(Number(orden.totalUSD) - (Number(orden.montoPagadoUSD) || 0))}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={cn("rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-widest border-0", orden.estadoPago === EstadoPago.ABONADO ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600")}>{orden.estadoPago}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button 
                                                                onClick={() => onRegisterPayment(orden)} 
                                                                className="bg-slate-900 dark:bg-white dark:text-black rounded-2xl hover:scale-105 transition-transform font-bold px-6 text-xs uppercase italic mr-2"
                                                            >
                                                                Liquidar
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="pr-10 text-right w-10">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => setExpandedOrdenId(expandedOrdenId === orden.id ? null : orden.id)} 
                                                                className="rounded-full hover:bg-slate-200 dark:hover:bg-white/10"
                                                            >
                                                                {expandedOrdenId === orden.id ? <ChevronUp className="w-4 h-4 text-slate-500"/> : <ChevronDown className="w-4 h-4 text-slate-400"/>}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    
                                                    {/* DETALLE DE ÍTEMS EXPANDIBLE */}
                                                    <AnimatePresence>
                                                        {expandedOrdenId === orden.id && (
                                                            <TableRow className="bg-slate-50/50 dark:bg-black/20 border-b border-black/5">
                                                                <TableCell colSpan={5} className="p-6">
                                                                    <motion.div 
                                                                        initial={{ opacity: 0, height: 0 }} 
                                                                        animate={{ opacity: 1, height: "auto" }} 
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] overflow-hidden">
                                                                            <Table>
                                                                                <TableHeader className="bg-slate-100 dark:bg-white/5">
                                                                                    <TableRow className="border-0">
                                                                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 pl-6 h-8">Ítem</TableHead>
                                                                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 text-center h-8">Cant.</TableHead>
                                                                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 text-center h-8">Medidas</TableHead>
                                                                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 text-right h-8">Precio U.</TableHead>
                                                                                        <TableHead className="text-[9px] font-black uppercase text-slate-400 text-right pr-6 h-8">Total</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {(orden.items || []).map((item: any, idx: number) => {
                                                                                        const totalItem = getItemTotal(item);
                                                                                        const medidas = item.unidad === 'm2' ? `${item.medidaXCm}x${item.medidaYCm}cm` : (item.tiempoCorte || 'N/A');
                                                                                        
                                                                                        return (
                                                                                            <TableRow key={idx} className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5">
                                                                                                <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-300 pl-6 py-2">{item.nombre}</TableCell>
                                                                                                <TableCell className="text-xs font-bold text-center py-2">{item.cantidad}</TableCell>
                                                                                                <TableCell className="text-[10px] font-bold text-slate-400 text-center uppercase py-2">{medidas}</TableCell>
                                                                                                <TableCell className="text-xs font-bold text-right py-2">{formatCurrency(totalItem / (parseFloat(item.cantidad) || 1))}</TableCell>
                                                                                                <TableCell className="text-xs font-black text-right text-slate-900 dark:text-white pr-6 py-2">{formatCurrency(totalItem)}</TableCell>
                                                                                            </TableRow>
                                                                                        )
                                                                                    })}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    </motion.div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </AnimatePresence>
                                                </React.Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* HISTORIAL DE LIQUIDADAS */}
            <div className="pt-10 space-y-6 pb-20">
                <div className="flex items-center gap-4 ml-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                    <h3 className="text-xl font-black tracking-tight uppercase italic">Historial Liquidadas</h3>
                </div>

                <Card className="rounded-[3rem] border-0 bg-white/40 dark:bg-slate-900/20 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-100/50 dark:bg-white/5">
                            <TableRow className="border-0">
                                <TableHead className="pl-10 uppercase text-[10px] font-black text-slate-400 py-6">N° Orden</TableHead>
                                <TableHead className="uppercase text-[10px] font-black text-slate-400 py-6">Cliente</TableHead>
                                <TableHead className="text-right uppercase text-[10px] font-black text-slate-400 py-6">Inversión</TableHead>
                                <TableHead className="text-center uppercase text-[10px] font-black text-slate-400 py-6">Estado</TableHead>
                                <TableHead className="text-center uppercase text-[10px] font-black text-slate-400 py-6 pr-10">Detalles</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <AnimatePresence>
                                {/* Si hay una búsqueda activa, mostramos todas. Si no, solo las últimas 10 para no saturar la UI */}
                                {pagadasCompletamente.slice(0, searchTerm ? undefined : 10).map((orden: any) => (
                                    <React.Fragment key={orden.id}>
                                        <TableRow className="border-b border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 transition-all">
                                            <TableCell className="pl-10 font-black text-slate-900 dark:text-white text-xs">#{orden.ordenNumero}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 dark:text-white tracking-tight italic uppercase text-xs">{orden.cliente?.nombreRazonSocial || 'S/N'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{orden.cliente?.rifCedula || 'S/N'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-emerald-600 text-lg tracking-tighter">{formatCurrency(Number(orden.totalUSD))}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 px-4 py-2 rounded-full w-fit mx-auto">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Liquidada</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center pr-10">
                                                <Button variant="ghost" size="icon" onClick={() => setExpandedOrdenId(expandedOrdenId === orden.id ? null : orden.id)} className="rounded-full">
                                                    {expandedOrdenId === orden.id ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                        {expandedOrdenId === orden.id && (
                                            <TableRow className="bg-slate-50/50 dark:bg-white/5">
                                                <TableCell colSpan={5} className="p-10">
                                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                                        <PaymentHistoryView historial={orden.registroPagos || []} totalOrdenUSD={Number(orden.totalUSD)} montoPagadoUSD={Number(orden.montoPagadoUSD) || 0} />
                                                    </motion.div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))}
                            </AnimatePresence>
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {/* MODAL ABONO GLOBAL */}
            <Dialog open={isGlobalModalOpen} onOpenChange={(open) => !isGlobalUploading && closeGlobalModal()}>
                <DialogContent className="max-w-md md:max-w-5xl rounded-[2.5rem] border-0 shadow-2xl p-0 outline-none bg-white dark:bg-[#1c1c1e] flex flex-col max-h-[95vh] overflow-hidden">
                    
                    <DialogHeader className="space-y-2 shrink-0 p-6 md:p-8 pb-4 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black uppercase italic text-slate-900 dark:text-white leading-none">Abono General</DialogTitle>
                                <DialogDescription className="font-bold text-[10px] uppercase text-slate-400 tracking-widest mt-1">
                                    Pago compartido para {selectedClientForGlobal?.nombre}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* CONTENEDOR GRID DE DOS COLUMNAS */}
                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                        
                        {/* COLUMNA IZQUIERDA: LISTA DE ÓRDENES */}
                        <div className="w-full md:w-1/2 bg-slate-50/50 dark:bg-black/10 border-r border-slate-100 dark:border-white/5 p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Órdenes a Liquidar</p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        if (selectedOrdersForGlobal.length === selectedClientForGlobal?.ordenesPendientes.length) {
                                            setSelectedOrdersForGlobal([]); // Desmarcar todo
                                        } else {
                                            setSelectedOrdersForGlobal(selectedClientForGlobal?.ordenesPendientes.map(o => o.id) || []); // Marcar todo
                                        }
                                    }}
                                    className="h-8 text-[9px] font-black uppercase text-blue-600 border-blue-200 hover:text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/30 rounded-xl px-3 shadow-sm"
                                >
                                    {selectedOrdersForGlobal.length === selectedClientForGlobal?.ordenesPendientes.length ? "Desmarcar Todo" : "Marcar Todo"}
                                </Button>
                            </div>
                            
                            <div className="space-y-3">
                                {selectedClientForGlobal?.ordenesPendientes.map(orden => {
                                    const deudaOrden = Number(orden.totalUSD) - (Number(orden.montoPagadoUSD) || 0);

                                    return (
                                        <div key={orden.id} className={cn("flex flex-col gap-2 p-4 rounded-2xl transition-all border", selectedOrdersForGlobal.includes(orden.id) ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900 shadow-md scale-[1.01]" : "bg-slate-50/80 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-70 hover:opacity-100")}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox 
                                                        checked={selectedOrdersForGlobal.includes(orden.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) setSelectedOrdersForGlobal(prev => [...prev, orden.id]);
                                                            else setSelectedOrdersForGlobal(prev => prev.filter(id => id !== orden.id));
                                                        }}
                                                        className="w-5 h-5 rounded-md data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                    />
                                                    <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Orden #{orden.ordenNumero}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-black text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg">{formatCurrency(deudaOrden)}</span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400 transition-colors shrink-0"
                                                        onClick={(e) => { e.preventDefault(); setViewingOrderDetails(orden); }}
                                                        title="Ver detalles completos"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {/* LISTA VERTICAL DE ÍTEMS */}
                                            <div className="pl-8 space-y-1.5 pt-1">
                                                {orden.items && orden.items.length > 0 ? (
                                                    orden.items.map((item: any, i: number) => (
                                                        <p key={i} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-tight flex items-start gap-2">
                                                            <span className="text-slate-300 mt-0.5">•</span> 
                                                            <span>{item.nombre} <span className="opacity-60 lowercase font-medium ml-1">x{item.cantidad}</span></span>
                                                        </p>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 italic">Sin ítems detallados</p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: FORMULARIO */}
                        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto custom-scrollbar bg-white dark:bg-[#1c1c1e]">
                            <div className="space-y-6 flex-1">
                                
                                {/* SELECCIÓN DE BILLETERA */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Destino del Dinero</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        <WalletOption id="cash_usd" label="Caja" icon={Wallet} active={globalWallet} onClick={setGlobalWallet} color="emerald" />
                                        <WalletOption id="bank_bs" label="Banco" icon={Landmark} active={globalWallet} onClick={setGlobalWallet} color="blue" />
                                        <WalletOption id="zelle" label="Zelle" icon={CreditCard} active={globalWallet} onClick={setGlobalWallet} color="purple" />
                                        <WalletOption id="usdt" label="Binance" icon={Coins} active={globalWallet} onClick={setGlobalWallet} color="orange" />
                                    </div>
                                </div>

                                {/* SELECTOR DE MONEDA E INPUTS */}
                                <div className="space-y-4">
                                    <Tabs value={globalCurrencyMode} onValueChange={(v) => {setGlobalCurrencyMode(v as any); setGlobalAmountUSD(''); setGlobalAmountBS('');}} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl mb-4 h-12">
                                            <TabsTrigger value="USD" className="font-black text-xs uppercase tracking-widest rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">Dólares ($)</TabsTrigger>
                                            <TabsTrigger value="BS" disabled={globalWallet === 'zelle' || globalWallet === 'usdt'} className="font-black text-xs uppercase tracking-widest rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm disabled:opacity-50">Bolívares (Bs)</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="USD" className="mt-0">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Monto del Abono (USD)</label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500" />
                                                    <input 
                                                        type="number" 
                                                        value={globalAmountUSD === '' ? '' : globalAmountUSD} 
                                                        onChange={(e) => handleAmountUSDChange(e.target.value)}
                                                        className="h-16 w-full pl-14 pr-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 font-black text-2xl outline-none focus:ring-2 ring-emerald-500/20 text-slate-900 dark:text-white transition-all hover:bg-slate-100" 
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="BS" className="mt-0 space-y-4">
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={() => handleRateChange('USD')} className={cn("flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-14", globalCalculationBase === 'USD' ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 ring-2 ring-emerald-500/20" : "border-slate-200 bg-slate-50 dark:bg-black/20 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5")}>
                                                    <span className="text-[9px] font-black uppercase flex items-center gap-1"><DollarSign size={10}/> BCV</span>
                                                    <span className="text-xs font-bold">{rates.usd.toFixed(2)}</span>
                                                </button>
                                                <button onClick={() => handleRateChange('EUR')} className={cn("flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-14", globalCalculationBase === 'EUR' ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 ring-2 ring-blue-500/20" : "border-slate-200 bg-slate-50 dark:bg-black/20 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5")}>
                                                    <span className="text-[9px] font-black uppercase flex items-center gap-1">€ EUR</span>
                                                    <span className="text-xs font-bold">{rates.eur.toFixed(2)}</span>
                                                </button>
                                                <button onClick={() => handleRateChange('USDT')} className={cn("flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-14", globalCalculationBase === 'USDT' ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 ring-2 ring-orange-500/20" : "border-slate-200 bg-slate-50 dark:bg-black/20 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5")}>
                                                    <span className="text-[9px] font-black uppercase flex items-center gap-1">₮ PARAL</span>
                                                    <span className="text-xs font-bold">{rates.usdt.toFixed(2)}</span>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Monto en Bs.</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Bs</span>
                                                        <input 
                                                            type="number" 
                                                            value={globalAmountBS === '' ? '' : globalAmountBS} 
                                                            onChange={(e) => handleAmountBSChange(e.target.value)}
                                                            className="h-14 w-full pl-9 pr-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 font-black text-xl outline-none focus:ring-2 ring-emerald-500/20 text-slate-900 dark:text-white transition-all hover:bg-slate-100" 
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Equivalente ($)</label>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                                        <input 
                                                            type="number" 
                                                            value={globalAmountUSD === '' ? '' : globalAmountUSD} 
                                                            onChange={(e) => handleAmountUSDChange(e.target.value)}
                                                            className="h-14 w-full pl-9 pr-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 font-black text-lg outline-none focus:ring-2 ring-emerald-500/20 text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-100" 
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                {/* CAPTURE Y NOTA */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Capture de Pago</label>
                                    <input type="file" ref={globalFileInputRef} onChange={handleGlobalImageUpload} accept="image/*" className="hidden" />
                                    
                                    {!previewUrl ? (
                                        <div 
                                            onClick={() => !isGlobalUploading && globalFileInputRef.current?.click()}
                                            className={cn(
                                                "h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-black/20 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-100 hover:border-emerald-400",
                                                isGlobalUploading && "pointer-events-none opacity-70"
                                            )}
                                        >
                                            {isGlobalUploading ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /> : (
                                                <>
                                                    <UploadCloud className="w-8 h-8 text-slate-400 dark:text-white/40 mb-2" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Haga clic para subir comprobante</p>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative h-40 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg group">
                                            <img src={previewUrl} alt="Comprobante" className="w-full h-full object-cover" />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={isGlobalUploading}
                                                onClick={() => { setPreviewUrl(null); setGlobalPaymentData(prev => ({ ...prev, imagenUrl: '' })); if(globalFileInputRef.current) globalFileInputRef.current.value = ''; }}
                                                className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-slate-400">Referencia de Pago</label>
                                    <textarea 
                                        value={globalPaymentData.nota} 
                                        onChange={(e) => setGlobalPaymentData({...globalPaymentData, nota: e.target.value})}
                                        className="w-full h-24 p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 font-bold text-xs resize-none outline-none focus:ring-2 ring-emerald-500/20 text-slate-900 dark:text-white transition-all hover:bg-slate-100" 
                                        placeholder="Indica banco receptor, número de referencia o detalles..."
                                    />
                                </div>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3 shrink-0">
                                <Button 
                                    onClick={handleProcessGlobalPayment}
                                    disabled={parseFloat(globalAmountUSD || '0') <= 0 || isGlobalUploading || selectedOrdersForGlobal.length === 0}
                                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isGlobalUploading ? "Subiendo Comprobante..." : "Confirmar Pago Global"}
                                </Button>
                                <Button variant="ghost" onClick={closeGlobalModal} className="font-bold text-slate-400 text-xs uppercase tracking-widest h-12 rounded-xl">Cancelar</Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL HISTORIAL Y REVERSIÓN DE ABONOS GLOBALES AUTÓNOMO */}
            <GlobalPaymentHistoryModal 
                isOpen={isHistoryModalOpen} 
                onClose={() => setIsHistoryModalOpen(false)}
                onDeleteBatch={handleRevertGlobalBatch}
                onViewImage={(url: string) => setViewingImage(url)}
            />

            {/* VISOR DE IMAGEN GENERAL */}
            <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center pointer-events-none">
                    <DialogTitle className="sr-only">Vista previa del comprobante</DialogTitle>
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {viewingImage && (
                                <a href={viewingImage} target="_blank" rel="noreferrer" className="p-3 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-md">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>
                        {viewingImage && <img src={viewingImage} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white" alt="Comprobante" />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL PARA VER ORDEN DETALLADA */}
            <OrderDetailModal 
                open={!!viewingOrderDetails} 
                onClose={() => setViewingOrderDetails(null)} 
                orden={viewingOrderDetails}
                rates={rates} 
            />

        </motion.div>
    )
}

// COMPONENTE BILLETERAS
function WalletOption({ id, label, icon: Icon, active, onClick, color }: any) {
    const isSelected = active === id;
    const colors: any = { 
        emerald: "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400", 
        blue: "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400", 
        purple: "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400", 
        orange: "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" 
    }
    return (
        <div 
            onClick={() => onClick(id)} 
            className={cn(
                "cursor-pointer flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all h-20 hover:scale-105 active:scale-95", 
                isSelected ? colors[color] : "bg-slate-50 dark:bg-black/20 border-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 shadow-sm"
            )}
        >
            <Icon size={20} />
            <span className="text-[9px] font-black uppercase text-center leading-none">{label}</span>
        </div>
    )
}

// --- COMPONENTE: HISTORIAL DE PAGOS GLOBALES AUTÓNOMO ---
function GlobalPaymentHistoryModal({ isOpen, onClose, onDeleteBatch, onViewImage }: any) {
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [unlockedState, setUnlockedState] = useState<Record<string, boolean>>({});
    
    // ESTADO LOCAL DE ÓRDENES (Autónomo para proteger la cuota)
    const [fullOrders, setFullOrders] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // FETCH AL ABRIR EL MODAL (Ahorro Masivo de Cuota)
    useEffect(() => {
        if (isOpen) {
            setIsLoadingHistory(true);
            getDocs(collection(db, "ordenes")).then(snap => {
                setFullOrders(snap.docs.map(d => ({id: d.id, ...d.data()})));
            }).catch(err => {
                console.error(err);
                toast.error("Error cargando el historial");
            }).finally(() => {
                setIsLoadingHistory(false);
            });
        } else {
            // Limpiamos memoria al cerrar
            setFullOrders([]);
            setExpandedGroup(null);
            setUnlockedState({});
        }
    }, [isOpen]);

    const globalGroups = useMemo(() => {
        const groups: any = {};

        fullOrders.forEach((orden: any) => {
            (orden.registroPagos || []).forEach((pago: any) => {
                if (pago.nota && pago.nota.includes("(Consolidado Global)")) {
                    
                    let groupKey: string;

                    if (pago.imagenUrl && pago.imagenUrl.length > 10) {
                        groupKey = `IMG_${pago.imagenUrl}`;
                    } 
                    else {
                        const dateKey = new Date(pago.fecha || pago.fechaRegistro).toISOString().slice(0, 16); 
                        const cleanNote = pago.nota.replace(" (Consolidado Global)", "").trim();
                        groupKey = `TXT_${dateKey}_${cleanNote}`;
                    }

                    if (!groups[groupKey]) {
                        groups[groupKey] = {
                            id: groupKey,
                            fecha: pago.fecha || pago.fechaRegistro,
                            notaOriginal: pago.nota.replace(" (Consolidado Global)", ""),
                            clienteNombre: orden.cliente?.nombreRazonSocial || 'Cliente Desconocido',
                            totalMonto: 0,
                            imagenUrl: pago.imagenUrl, 
                            distribucion: []
                        };
                    }

                    groups[groupKey].totalMonto += parseFloat(pago.montoUSD);
                    groups[groupKey].distribucion.push({
                        ordenId: orden.id,
                        ordenNumero: orden.ordenNumero,
                        montoAbonado: parseFloat(pago.montoUSD),
                        pagoRef: pago 
                    });
                }
            });
        });

        return Object.values(groups).sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [fullOrders]);

    const toggleLock = (id: string) => {
        setUnlockedState(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!isOpen) return null;

    if (isLoadingHistory) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-md bg-white dark:bg-[#1c1c1e] rounded-[3rem] border-0 p-10 flex flex-col items-center justify-center shadow-2xl outline-none">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                    <p className="text-sm font-black uppercase text-slate-500 tracking-widest text-center">Buscando historial global...</p>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-[3rem] border-0 p-0 flex flex-col max-h-[95vh] overflow-hidden">
                <DialogHeader className="p-6 md:p-8 pb-4 shrink-0">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black italic uppercase">
                        <History className="w-8 h-8 text-blue-600" /> Historial de Abonos Globales
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase tracking-widest mt-2">
                        Aquí puedes ver y revertir distribuciones de pago masivas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 md:px-8 space-y-4 custom-scrollbar">
                    {globalGroups.length === 0 ? (
                        <div className="text-center py-10 opacity-50 font-bold uppercase text-xs">No hay abonos globales registrados</div>
                    ) : (
                        globalGroups.map((group: any) => {
                            const isUnlocked = !!unlockedState[group.id];
                            
                            return (
                                <div key={group.id} className="border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden bg-slate-50 dark:bg-black/20">
                                    {/* CABECERA DEL GRUPO */}
                                    <div className="p-5 flex justify-between items-center bg-white dark:bg-white/5">
                                        <div className="flex gap-4 items-center">
                                            {/* IMAGEN INTERACTIVA */}
                                            <div 
                                                onClick={() => group.imagenUrl && onViewImage(group.imagenUrl)}
                                                className={cn("relative h-14 w-14 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 shrink-0", group.imagenUrl ? "cursor-pointer hover:opacity-80 transition-opacity" : "")}
                                                title={group.imagenUrl ? "Ver capture completo" : "Sin comprobante"}
                                            >
                                                {group.imagenUrl ? (
                                                    <img src={group.imagenUrl} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400"><ImageIcon size={20}/></div>
                                                )}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-black text-sm uppercase text-slate-800 dark:text-white leading-tight mb-1 truncate">{group.clienteNombre}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[180px] md:max-w-[220px]">
                                                    {group.notaOriginal || "Sin nota"}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1">
                                                    {new Date(group.fecha).toLocaleDateString()} • {new Date(group.fecha).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(group.totalMonto)}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{group.distribucion.length} Órdenes afectadas</p>
                                        </div>
                                    </div>

                                    {/* ACCIONES Y DETALLES */}
                                    <div className="px-5 py-3 flex justify-between items-center border-t border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/40">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                                            className="text-[10px] font-black uppercase text-slate-500 gap-1 h-8 rounded-xl"
                                        >
                                            {expandedGroup === group.id ? "Ocultar Detalles" : "Ver Distribución"}
                                            {expandedGroup === group.id ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                                        </Button>

                                        {/* CANDADO DE SEGURIDAD */}
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => toggleLock(group.id)}
                                                className="h-8 w-8 rounded-full bg-white dark:bg-slate-800 shadow-sm hover:scale-105 transition-transform"
                                                title={isUnlocked ? "Bloquear acción" : "Desbloquear para revertir"}
                                            >
                                                {isUnlocked ? <Unlock className="w-3.5 h-3.5 text-orange-500" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                                            </Button>

                                            <AnimatePresence>
                                                {isUnlocked && (
                                                    <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }}>
                                                        <Button 
                                                            size="sm" 
                                                            variant="destructive"
                                                            onClick={() => onDeleteBatch(group, fullOrders)}
                                                            className="h-8 text-[10px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border-0 shadow-sm transition-all rounded-xl"
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-2" /> Revertir Abono
                                                        </Button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* LISTA DESPLEGABLE DE ÓRDENES */}
                                    <AnimatePresence>
                                        {expandedGroup === group.id && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                                <div className="p-5 space-y-2 bg-white dark:bg-black/10 border-t border-slate-200 dark:border-white/5">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-2">Distribución del Dinero:</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {group.distribucion.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between items-center text-xs font-bold p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                                <span className="text-slate-600 dark:text-slate-300">Orden #{item.ordenNumero}</span>
                                                                <span className="text-emerald-600 font-black">{formatCurrency(item.montoAbonado)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })
                    )}
                </div>
                
                <DialogFooter className="p-6 md:p-8 pt-4 shrink-0 border-t border-slate-100 dark:border-white/5">
                     <Button variant="outline" onClick={onClose} className="w-full rounded-2xl font-bold h-12 uppercase text-[10px] tracking-widest border-slate-200">Cerrar Historial</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}