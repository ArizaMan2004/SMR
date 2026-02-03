// @/components/dashboard/ClientsAndPaymentsView.tsx
"use client"

import React, { useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type OrdenServicio, EstadoPago } from '@/lib/types/orden'
import { formatCurrency } from '@/lib/utils/order-utils' 
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
    Printer, Banknote 
} from 'lucide-react'

// Servicios y Utilidades
import { PaymentHistoryView } from '@/components/orden/PaymentHistoryView' 
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"
import { generateGeneralAccountStatusPDF } from "@/lib/services/pdf-generator"
import { createNotification } from "@/lib/services/gastos-service"
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// FIREBASE (Para el Abono Global)
import { db } from "@/lib/firebase"
import { doc, updateDoc, arrayUnion } from "firebase/firestore"

interface ClientSummary {
    key: string
    nombre: string
    rif: string
    totalOrdenes: number
    totalPendienteUSD: number
    ordenesPendientes: OrdenServicio[]
}

interface ClientsAndPaymentsViewProps {
    ordenes: any[];
    rates: {
        usd: number;
        eur: number;
        usdt: number;
    };
    // Esta función solo ABRE el modal del dashboard
    onRegisterPayment: (orden: OrdenServicio) => void; 
    pdfLogoBase64?: string;
    firmaBase64?: string;
    selloBase64?: string;
}

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, staggerChildren: 0.1 }
    }
}

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
}

export function ClientsAndPaymentsView({ 
    ordenes, 
    rates, 
    onRegisterPayment,
    pdfLogoBase64,
    firmaBase64,
    selloBase64 
}: ClientsAndPaymentsViewProps) {
    // --- ESTADOS DE UI Y FILTROS ---
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 5
    const [expandedOrdenId, setExpandedOrdenId] = useState<string | null>(null);

    // --- ESTADOS DE MODAL GLOBAL (Lógica interna de esta vista) ---
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false)
    const [selectedClientForGlobal, setSelectedClientForGlobal] = useState<ClientSummary | null>(null)
    const [globalPaymentData, setGlobalPaymentData] = useState({ monto: 0, nota: '', imagenUrl: '' })
    
    const [previewUrl, setPreviewUrl] = useState<string | null>(null) 
    const [isGlobalUploading, setIsGlobalUploading] = useState(false) 
    const globalFileInputRef = useRef<HTMLInputElement>(null)

    // --- PROCESAMIENTO DE DATOS ---
    const { clientSummaries, pagadasCompletamente, totalPendienteGlobal } = useMemo(() => {
        const summaryMap = new Map<string, ClientSummary>()
        let totalPendGlobal = 0;
        const lowerCaseSearch = searchTerm.toLowerCase().trim();

        // 1. Filtrar historial de liquidadas
        const pagadas = ordenes
            .filter((o: any) => {
                const total = Number(o.totalUSD) || 0;
                const pagado = Number(o.montoPagadoUSD) || 0;
                const esPagada = (o.estadoPago === EstadoPago.PAGADO) || (total - pagado <= 0.01);
                const nombreCliente = (o.cliente?.nombreRazonSocial || '').toLowerCase();
                const coincideBusqueda = !lowerCaseSearch || nombreCliente.includes(lowerCaseSearch);
                return esPagada && coincideBusqueda && o.estadoPago !== EstadoPago.ANULADO;
            })
            .sort((a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

        // 2. Procesar deudores agrupados
        ordenes.forEach((orden: any) => {
            if (orden.estadoPago === EstadoPago.ANULADO) return;

            const total = Number(orden.totalUSD) || 0;
            const pagado = Number(orden.montoPagadoUSD) || 0;
            const pendiente = Math.max(0, total - pagado);
            
            const nombreCliente = (orden.cliente?.nombreRazonSocial || '').toLowerCase();
            const coincideBusqueda = !lowerCaseSearch || nombreCliente.includes(lowerCaseSearch);

            if (pendiente > 0.01 && coincideBusqueda) {
                totalPendGlobal += pendiente;
                const key = (orden.cliente?.nombreRazonSocial || 'S/N').trim().toUpperCase();
                
                if (!summaryMap.has(key)) {
                    summaryMap.set(key, {
                        key, 
                        nombre: orden.cliente?.nombreRazonSocial || 'Cliente sin nombre', 
                        rif: orden.cliente?.rifCedula || 'S/N',
                        totalOrdenes: 0, 
                        totalPendienteUSD: 0, 
                        ordenesPendientes: []
                    });
                }
                const s = summaryMap.get(key)!;
                s.totalPendienteUSD += pendiente;
                s.totalOrdenes += total;
                s.ordenesPendientes.push(orden);
            }
        });

        // Ordenar órdenes internas por fecha
        summaryMap.forEach(s => s.ordenesPendientes.sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()));

        return { 
            clientSummaries: Array.from(summaryMap.values()).sort((a, b) => b.totalPendienteUSD - a.totalPendienteUSD), 
            pagadasCompletamente: pagadas, 
            totalPendienteGlobal: totalPendGlobal 
        };
    }, [ordenes, searchTerm]);

    const totalPages = Math.ceil(clientSummaries.length / itemsPerPage);
    const paginatedClients = useMemo(() => clientSummaries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [clientSummaries, currentPage]);

    // --- HELPER PARA CALCULAR ITEM ---
    const getItemTotal = (item: any) => {
        const qty = parseFloat(item.cantidad?.toString()) || 0;
        const x = parseFloat(item.medidaXCm) || 0;
        const y = parseFloat(item.medidaYCm) || 0;
        const price = parseFloat(item.precioUnitario?.toString()) || 0;

        if (item.subtotal) return parseFloat(item.subtotal);
        if (item.unidad === "m2" && x > 0 && y > 0) {
            return (x / 100) * (y / 100) * price * qty;
        }
        return price * qty;
    };

    // --- REPORTES PDF ---
    const handleGenerateGeneralReceipt = (summary: ClientSummary, rateType: 'USD' | 'EUR' | 'USDT' | 'USD_ONLY') => {
        try {
            toast.loading(`Generando estado de cuenta (${rateType === 'USD_ONLY' ? 'Solo USD' : rateType})...`);
            
            let selectedCurrency = { rate: rates.usd, label: "Tasa BCV ($)", symbol: "Bs." };
            if (rateType === 'EUR') selectedCurrency = { rate: rates.eur, label: "Tasa BCV (€)", symbol: "Bs." };
            if (rateType === 'USDT') selectedCurrency = { rate: rates.usdt, label: "Tasa Monitor", symbol: "Bs." };
            if (rateType === 'USD_ONLY') selectedCurrency = { rate: 1, label: "", symbol: "" };

            const consolidatedItems = summary.ordenesPendientes.flatMap(orden => 
                (orden.items || []).map((item: any) => {
                    const qty = parseFloat(item.cantidad?.toString()) || 0;
                    const x = parseFloat(item.medidaXCm) || 0;
                    const y = parseFloat(item.medidaYCm) || 0;
                    const tiempo = item.tiempoCorte;
                    let itemSubtotal = 0;
                    
                    if (item.subtotal !== undefined && item.subtotal !== null) itemSubtotal = parseFloat(item.subtotal);
                    else if (item.totalAjustado !== undefined) itemSubtotal = parseFloat(item.totalAjustado);
                    else {
                        const price = parseFloat(item.precioUnitario?.toString()) || 0;
                        if (item.unidad === "m2" && x > 0 && y > 0) itemSubtotal = (x / 100) * (y / 100) * price * qty;
                        else itemSubtotal = price * qty;
                    }

                    const displayUnitPrice = qty > 0 ? (itemSubtotal / qty) : 0;
                    let medidasDisplay = "N/A";
                    if (item.unidad === "m2" && x > 0 && y > 0) medidasDisplay = `${x}x${y}cm`;
                    else if (tiempo && tiempo !== "N/A") medidasDisplay = tiempo;

                    return {
                        parentOrder: `#${orden.ordenNumero || 'S/N'}`,
                        nombre: item.nombre,
                        cantidad: qty,
                        medidasTiempo: medidasDisplay, 
                        precioUnitario: displayUnitPrice,
                        totalUSD: itemSubtotal 
                    };
                })
            );

            generateGeneralAccountStatusPDF(
                {
                    clienteNombre: summary.nombre,
                    clienteRIF: summary.rif,
                    items: consolidatedItems,
                    totalPendienteUSD: summary.totalPendienteUSD,
                    fechaReporte: new Date().toLocaleDateString('es-VE'),
                },
                pdfLogoBase64 || "", 
                { firmaBase64, selloBase64, currency: selectedCurrency }
            );

            toast.dismiss();
            toast.success("PDF Generado");
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Error al generar reporte");
        }
    };

    // --- MANEJO DE ABONO GLOBAL (LOGICA AUTÓNOMA) ---
    const handleGlobalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setPreviewUrl(URL.createObjectURL(file));
            setIsGlobalUploading(true);
            toast.loading("Subiendo comprobante...");
            const url = await uploadFileToCloudinary(file);
            setGlobalPaymentData(prev => ({ ...prev, imagenUrl: url }));
            toast.dismiss();
            toast.success("Comprobante cargado");
        } catch (error) {
            toast.dismiss();
            toast.error("Error al subir imagen");
            setPreviewUrl(null);
        } finally {
            setIsGlobalUploading(false);
            if (globalFileInputRef.current) globalFileInputRef.current.value = '';
        }
    };

    const handleProcessGlobalPayment = async () => {
        if (!selectedClientForGlobal || globalPaymentData.monto <= 0 || isGlobalUploading) return;
        
        let remaining = globalPaymentData.monto;
        
        try {
            toast.loading("Distribuyendo abono...");
            
            // Iteramos sobre las órdenes del cliente para pagar
            for (const orden of selectedClientForGlobal.ordenesPendientes) {
                if (remaining <= 0.009) break; // Si ya no queda saldo, paramos

                const saldoOrden = Number(orden.totalUSD) - (Number(orden.montoPagadoUSD) || 0);
                const aPagar = Math.min(remaining, saldoOrden);

                if (aPagar > 0.009) {
                    // REALIZAMOS LA TRANSACCIÓN DIRECTAMENTE EN FIREBASE
                    // (Esto evita depender del modal del dashboard para un proceso en lote)
                    const ordenRef = doc(db, "ordenes", orden.id);
                    const nuevoMontoPagado = (Number(orden.montoPagadoUSD) || 0) + aPagar;
                    const nuevoEstado = (Number(orden.totalUSD) - nuevoMontoPagado) <= 0.01 ? "PAGADO" : "ABONADO";

                    const nuevoRecibo = {
                        montoUSD: aPagar,
                        fecha: new Date().toISOString(),
                        nota: `${globalPaymentData.nota} (Consolidado Global)`.trim(),
                        imagenUrl: globalPaymentData.imagenUrl || "",
                        tasaBCV: rates.usd,
                        metodo: "Abono Global"
                    };

                    await updateDoc(ordenRef, {
                        montoPagadoUSD: nuevoMontoPagado,
                        estadoPago: nuevoEstado,
                        registroPagos: arrayUnion(nuevoRecibo)
                    });

                    // Crear Notificación
                    await createNotification({
                        title: "Abono Global Aplicado",
                        description: `Pago de $${aPagar.toFixed(2)} a orden #${orden.ordenNumero}`,
                        type: 'success',
                        category: 'system'
                    });

                    remaining -= aPagar;
                }
            }

            toast.dismiss();
            toast.success("Abono global aplicado correctamente");
            closeGlobalModal();
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Error al procesar el pago global");
        }
    };

    const closeGlobalModal = () => {
        setIsGlobalModalOpen(false);
        setPreviewUrl(null);
        setGlobalPaymentData({ monto: 0, nota: '', imagenUrl: '' });
    };

    const formatBs = (amount: number, rate: number) => {
        return `Bs. ${(amount * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-10 p-2 font-sans selection:bg-blue-100">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white flex items-center gap-3">
                        <Wallet className="w-10 h-10 text-blue-600 drop-shadow-lg"/> Cobranzas <span className="text-blue-600">Pro</span>
                    </h2>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Siskoven SMR - Entorno Shared</p>
                </div>
                
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl p-2 rounded-[2rem] border border-white/20 shadow-2xl flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                        <input
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-12 pr-6 py-3 w-full md:w-[300px] bg-white dark:bg-slate-900 border-0 rounded-[1.5rem] shadow-inner text-sm font-bold outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* KPI ISLAND */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div variants={itemVariants} className="md:col-span-1">
                    <Card className="rounded-[3rem] border-0 bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-2xl relative p-8 space-y-4">
                        <Activity className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 rotate-12" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Total por Cobrar</p>
                        <div>
                            <h3 className="text-5xl font-black tracking-tighter">{formatCurrency(totalPendienteGlobal)}</h3>
                            <p className="text-xs font-bold opacity-80 mt-2">≈ {formatBs(totalPendienteGlobal, rates.usd)} (BCV)</p>
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
                                                        onClick={() => { setSelectedClientForGlobal(summary); setIsGlobalModalOpen(true); }}
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
                                                                // ✅ USA LA FUNCIÓN DEL DASHBOARD PARA ABRIR EL MODAL CENTRAL
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
                                {pagadasCompletamente.slice(0, 10).map((orden: any) => (
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

            {/* MODAL ABONO GLOBAL (Este se mantiene local) */}
            <Dialog open={isGlobalModalOpen} onOpenChange={(open) => !isGlobalUploading && closeGlobalModal()}>
                <DialogContent className="max-w-md rounded-[2.5rem] border-0 shadow-2xl p-8 outline-none overflow-hidden bg-white dark:bg-[#1c1c1e]">
                    <DialogHeader className="space-y-4">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto shadow-inner"><CreditCard className="w-8 h-8" /></div>
                        <DialogTitle className="text-2xl font-black uppercase italic text-center text-slate-900 dark:text-white leading-none">Abono General</DialogTitle>
                        <DialogDescription className="text-center font-bold text-[10px] uppercase text-slate-400 tracking-widest">Pago compartido para {selectedClientForGlobal?.nombre}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50 text-slate-900 dark:text-white">Monto del Abono (USD)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                                <input 
                                    type="number" 
                                    value={globalPaymentData.monto} 
                                    onChange={(e) => setGlobalPaymentData({...globalPaymentData, monto: Number(e.target.value)})}
                                    className="h-16 w-full pl-14 pr-6 rounded-2xl border-0 bg-slate-50 dark:bg-black/20 font-black text-2xl outline-none focus:ring-2 ring-emerald-500/20 text-slate-900 dark:text-white" 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50 text-slate-900 dark:text-white">Capture de Pago</label>
                            <input type="file" ref={globalFileInputRef} onChange={handleGlobalImageUpload} accept="image/*" className="hidden" />
                            
                            {!previewUrl ? (
                                <div 
                                    onClick={() => !isGlobalUploading && globalFileInputRef.current?.click()}
                                    className={cn(
                                        "h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-100",
                                        isGlobalUploading && "pointer-events-none opacity-70"
                                    )}
                                >
                                    {isGlobalUploading ? <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /> : (
                                        <>
                                            <UploadCloud className="w-8 h-8 text-slate-300 dark:text-white/30" />
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">Haga clic para subir</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="relative h-40 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 shadow-lg group">
                                    <img src={previewUrl} alt="Comprobante" className="w-full h-full object-cover" />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isGlobalUploading}
                                        onClick={() => { setPreviewUrl(null); setGlobalPaymentData(prev => ({ ...prev, imagenUrl: '' })); if(globalFileInputRef.current) globalFileInputRef.current.value = ''; }}
                                        className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-2 opacity-50 text-slate-900 dark:text-white">Referencia de Pago</label>
                            <textarea 
                                value={globalPaymentData.nota} 
                                onChange={(e) => setGlobalPaymentData({...globalPaymentData, nota: e.target.value})}
                                className="w-full h-24 p-5 rounded-2xl border-0 bg-slate-50 dark:bg-black/20 font-bold text-xs resize-none outline-none focus:ring-2 ring-emerald-500/20 text-slate-900 dark:text-white" 
                                placeholder="Indica banco, referencia..."
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-col sm:flex-col gap-3">
                        <Button 
                            onClick={handleProcessGlobalPayment}
                            disabled={globalPaymentData.monto <= 0 || isGlobalUploading}
                            className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                        >
                            {isGlobalUploading ? "Subiendo..." : "Confirmar Pago Global"}
                        </Button>
                        <Button variant="ghost" onClick={closeGlobalModal} className="font-bold text-slate-400 text-[10px] uppercase">Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}