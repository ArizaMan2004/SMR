// @/components/dashboard/PaymentAuditView.tsx
"use client"

import React, { useState, useMemo } from 'react';
import { 
    FileText, Wallet, ArrowUpRight, ArrowDownLeft,
    Eye, Loader2, ImageIcon, ExternalLink,
    Lock, Unlock, Trash2, Pencil, AlertTriangle, Search
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/order-utils";
import { cn } from "@/lib/utils";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, isValid } from 'date-fns';

interface PaymentAuditViewProps {
    ordenes: any[];
    gastos?: any[];         
    pagosEmpleados?: any[]; 
}

const PAYMENT_OPTIONS = [
    { value: "Efectivo USD", label: "Caja Chica ($)" },
    { value: "Pago Móvil (Bs)", label: "Banco Nacional (Bs)" },
    { value: "Zelle", label: "Zelle / Bofa" },
    { value: "Binance USDT", label: "Binance / USDT" },
    { value: "Efectivo Bs", label: "Caja Chica (Bs)" } 
];

export function PaymentAuditView({ 
    ordenes = [], 
    gastos = [], 
    pagosEmpleados = [] 
}: PaymentAuditViewProps) {

    const [mainTab, setMainTab] = useState("ingresos");
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [searchTerm, setSearchTerm] = useState("");
    
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // --- NUEVOS ESTADOS PARA MODALES ---
    const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, item: any, type: string}>({isOpen: false, item: null, type: ''});
    const [editModal, setEditModal] = useState<{isOpen: boolean, item: any, type: string}>({isOpen: false, item: null, type: ''});
    const [editForm, setEditForm] = useState({ monto: 0, concepto: '', area: '', imagenUrl: '' });

    const filterByDate = (dateInput: any) => {
        if (!dateInput) return false;
        const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
        if (!isValid(d)) return false;
        return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
    };

    const filterBySearch = (text: string) => {
        if (!searchTerm) return true;
        return text.toLowerCase().includes(searchTerm.toLowerCase());
    };

    // ==========================================
    // 1. LÓGICA DE INGRESOS (Cobranza)
    // ==========================================
    const ingresosData = useMemo(() => {
        const pagos: any[] = []
        ordenes.forEach(orden => {
            // Protección contra arrays convertidos en objetos por Firebase
            let pagosArray: any[] = [];
            if (Array.isArray(orden.registroPagos)) {
                pagosArray = orden.registroPagos;
            } else if (orden.registroPagos && typeof orden.registroPagos === 'object') {
                pagosArray = Object.values(orden.registroPagos);
            }

            if (pagosArray.length > 0) {
                pagosArray.forEach((pago: any, index: number) => {
                    const rawDate = pago.fechaRegistro || pago.fecha || pago.timestamp;
                    if (filterByDate(rawDate)) {
                        const cliente = orden.cliente?.nombreRazonSocial || "Desconocido";
                        const nota = pago.nota || "";
                        if (filterBySearch(cliente + nota + orden.ordenNumero)) {
                            pagos.push({
                                uniqueId: `${orden.id}-${index}`,
                                ordenId: orden.id,
                                ordenNumero: orden.ordenNumero,
                                cliente: cliente,
                                monto: Number(pago.montoUSD) || 0,
                                dateObj: rawDate?.toDate ? rawDate.toDate() : new Date(rawDate),
                                metodo: pago.metodo || "Efectivo USD",
                                nota: nota,
                                imagenUrl: pago.imagenUrl || null,
                                index: index,
                                type: 'ingreso'
                            });
                        }
                    }
                })
            }
        })
        return pagos.sort((a, b) => b.dateObj - a.dateObj);
    }, [ordenes, selectedMonth, selectedYear, searchTerm]);

    const handleUpdateIncomeMethod = async (payment: any, newMethod: string) => {
        setUpdatingId(`method-${payment.uniqueId}`)
        try {
            const ordenRef = doc(db, "ordenes", payment.ordenId)
            const ordenSnap = await getDoc(ordenRef)
            if (ordenSnap.exists()) {
                const data = ordenSnap.data()
                const registroPagos = [...(data.registroPagos || [])]
                if (registroPagos[payment.index]) {
                    registroPagos[payment.index] = { ...registroPagos[payment.index], metodo: newMethod }
                    await updateDoc(ordenRef, { registroPagos })
                    toast.success("Billetera actualizada")
                }
            }
        } catch (error) { toast.error("Error al actualizar") } finally { setUpdatingId(null) }
    }

    const handleUpdateIncomeDate = async (payment: any, newDateString: string) => {
        if (!newDateString) return;
        setUpdatingId(`date-${payment.uniqueId}`);
        try {
            const parts = newDateString.split('-');
            const oldDate = new Date(payment.dateObj);
            oldDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const isoString = oldDate.toISOString();

            const ordenRef = doc(db, "ordenes", payment.ordenId);
            const ordenSnap = await getDoc(ordenRef);
            if (ordenSnap.exists()) {
                const data = ordenSnap.data();
                const registroPagos = [...(data.registroPagos || [])];
                if (registroPagos[payment.index]) {
                    registroPagos[payment.index] = { 
                        ...registroPagos[payment.index], 
                        fecha: isoString,
                        fechaRegistro: isoString 
                    };
                    await updateDoc(ordenRef, { registroPagos });
                    toast.success("Fecha de ingreso ajustada");
                }
            }
        } catch (error) { toast.error("Error al actualizar la fecha"); } 
        finally { setUpdatingId(null); }
    };

    // ==========================================
    // 2. LÓGICA DE EGRESOS (Gastos Editables)
    // ==========================================
    const handleUpdateExpenseMethod = async (item: any, newMethod: string, type: string) => {
        setUpdatingId(`method-${item.id}`);
        try {
            if (type === 'gasto' || type === 'fijo') {
                await updateDoc(doc(db, "gastos_insumos", item.id), { metodoPago: newMethod });
            } 
            else if (type === 'nomina') {
                await updateDoc(doc(db, "pagos", item.id), { metodoPago: newMethod });
            }
            else if (type === 'diseno') {
                const ordenRef = doc(db, "ordenes", item.orderId);
                const ordenSnap = await getDoc(ordenRef);
                if (ordenSnap.exists()) {
                    const data = ordenSnap.data();
                    const items = [...(data.items || [])];
                    if (items[item.itemIndex]) {
                        items[item.itemIndex] = { ...items[item.itemIndex], paymentMethod: newMethod };
                        await updateDoc(ordenRef, { items });
                    }
                }
            }
            toast.success("Billetera actualizada");
        } catch (error) { toast.error("Error al actualizar"); } 
        finally { setUpdatingId(null); }
    };

    const handleUpdateExpenseDate = async (item: any, newDateString: string, type: string) => {
        if (!newDateString) return;
        setUpdatingId(`date-${item.id}`);
        try {
            const parts = newDateString.split('-');
            let oldDate = new Date();
            if (item.fecha) {
                const parsed = new Date(item.fecha);
                if (!isNaN(parsed.getTime())) oldDate = parsed;
            }
            oldDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const isoString = oldDate.toISOString();

            if (type === 'gasto' || type === 'fijo') {
                await updateDoc(doc(db, "gastos_insumos", item.id), { fecha: isoString });
            } 
            else if (type === 'nomina') {
                await updateDoc(doc(db, "pagos", item.id), { fechaPago: isoString, fecha: isoString });
            }
            else if (type === 'diseno') {
                const ordenRef = doc(db, "ordenes", item.orderId);
                const ordenSnap = await getDoc(ordenRef);
                if (ordenSnap.exists()) {
                    const data = ordenSnap.data();
                    const items = [...(data.items || [])];
                    if (items[item.itemIndex]) {
                        items[item.itemIndex] = { ...items[item.itemIndex], paymentDate: isoString };
                        await updateDoc(ordenRef, { items });
                    }
                }
            }
            toast.success("Fecha de gasto ajustada");
        } catch (error) { toast.error("Error al reasignar fecha"); } 
        finally { setUpdatingId(null); }
    };

    const egresosInsumos = useMemo(() => gastos.filter(g => {
        const isFijo = g.tipo === 'FIJO' || g.categoria === 'Gasto Fijo' || g.categoria === 'ServiciosPublicos';
        return !isFijo && filterByDate(g.fecha) && filterBySearch(g.descripcion || g.nombre || "");
    }).map(g => ({
        id: g.id, fecha: g.fecha, beneficiario: g.proveedor || "Proveedor",
        concepto: g.descripcion || g.nombre || "Compra Insumo", metodo: g.metodoPago || "No especificado",
        monto: Number(g.montoUSD) || Number(g.monto) || 0, type: 'gasto',
        area: g.area || 'GENERAL', imagenUrl: g.imagenUrl || g.comprobante || null
    })), [gastos, selectedMonth, selectedYear, searchTerm]);

    const egresosFijos = useMemo(() => gastos.filter(g => {
        const isFijo = g.tipo === 'FIJO' || g.categoria === 'Gasto Fijo' || g.categoria === 'ServiciosPublicos';
        const isPagoServicio = (g.nombre || "").startsWith("[PAGO SERVICIO]");
        return (isFijo || isPagoServicio) && filterByDate(g.fecha) && filterBySearch(g.descripcion || g.nombre || "");
    }).map(g => ({
        id: g.id, fecha: g.fecha, beneficiario: g.proveedor || "Servicio",
        concepto: g.nombre || g.descripcion || "Pago Mensual", metodo: g.metodoPago || "No especificado",
        monto: Number(g.montoUSD) || Number(g.monto) || 0, type: 'fijo',
        area: g.area || 'GENERAL', imagenUrl: g.imagenUrl || g.comprobante || null
    })), [gastos, selectedMonth, selectedYear, searchTerm]);

    const egresosNomina = useMemo(() => pagosEmpleados.filter(p => filterByDate(p.fechaPago || p.fecha) && filterBySearch(p.nombre || ""))
    .map(p => ({
        id: p.id, fecha: p.fechaPago || p.fecha, beneficiario: p.nombre, concepto: p.notaAdicional || "Nómina / Comisión",
        metodo: p.metodoPago || "Efectivo", monto: Number(p.totalUSD) || 0, type: 'nomina',
        area: p.areaAsignada || 'GENERAL', imagenUrl: p.imagenUrl || null
    })), [pagosEmpleados, selectedMonth, selectedYear, searchTerm]);

    const egresosDiseno = useMemo(() => {
        const list: any[] = [];
        ordenes.forEach(o => {
            if (o.estado === 'ANULADO') return;
            
            // Protección contra arrays convertidos en objetos por Firebase
            let itemsArray: any[] = [];
            if (Array.isArray(o.items)) {
                itemsArray = o.items;
            } else if (o.items && typeof o.items === 'object') {
                itemsArray = Object.values(o.items);
            }

            itemsArray.forEach((item: any, idx: number) => {
                const esDiseno = (item.tipoServicio === 'DISENO' || item.tipoServicio === 'DISEÑO');
                const estaPagado = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                if (esDiseno && estaPagado) {
                    const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                    if (filterByDate(fechaPago) && filterBySearch(item.empleadoAsignado + item.nombre)) {
                        list.push({
                            id: item.id || `${o.id}-${idx}`, orderId: o.id, itemIndex: idx, fecha: fechaPago,
                            beneficiario: item.empleadoAsignado || "Diseñador", concepto: `Diseño Orden #${o.ordenNumero}`,
                            metodo: item.paymentMethod || "Pago Móvil",
                            monto: (Number(item.costoInterno) || Number(item.precioUnitario) || 0) * (Number(item.cantidad) || 1),
                            type: 'diseno', area: 'DISEÑO'
                        });
                    }
                }
            });
        });
        return list;
    }, [ordenes, selectedMonth, selectedYear, searchTerm]);

    // ==========================================
    // 3. ACCIONES DE ELIMINACIÓN Y EDICIÓN PROFUNDA CON RECALCULO
    // ==========================================
    const confirmDelete = async () => {
        const { item, type } = deleteModal;
        if (!item) return;
        
        try {
            if (type === 'ingreso') {
                const ordenRef = doc(db, "ordenes", item.ordenId);
                const ordenSnap = await getDoc(ordenRef);
                if (ordenSnap.exists()) {
                    const data = ordenSnap.data();
                    const newPagos = [...(data.registroPagos || [])];
                    newPagos.splice(item.index, 1); 
                    
                    const totalUSD = Number(data.totalUSD) || 0;
                    const nuevoMontoPagado = newPagos.reduce((sum, p) => sum + (Number(p.montoUSD) || 0), 0);
                    let nuevoEstado = "PENDIENTE";
                    if (nuevoMontoPagado >= totalUSD && totalUSD > 0) nuevoEstado = "PAGADO";
                    else if (nuevoMontoPagado > 0) nuevoEstado = "ABONADO";

                    await updateDoc(ordenRef, { 
                        registroPagos: newPagos,
                        montoPagadoUSD: nuevoMontoPagado,
                        estadoPago: nuevoEstado
                    });
                }
            } else if (type === 'gasto' || type === 'fijo') {
                await deleteDoc(doc(db, "gastos_insumos", item.id));
            } else if (type === 'nomina') {
                await deleteDoc(doc(db, "pagos", item.id));
            } else if (type === 'diseno') {
                const ordenRef = doc(db, "ordenes", item.orderId);
                const ordenSnap = await getDoc(ordenRef);
                if (ordenSnap.exists()) {
                    const data = ordenSnap.data();
                    const newItems = [...(data.items || [])];
                    if (newItems[item.itemIndex]) {
                        newItems[item.itemIndex] = { ...newItems[item.itemIndex], designPaymentStatus: 'PENDIENTE', paymentReference: null, paymentDate: null, paymentMethod: null };
                        await updateDoc(ordenRef, { items: newItems });
                    }
                }
            }
            toast.success("Registro eliminado exitosamente (Saldos recalificados)");
        } catch (error) {
            toast.error("Error al eliminar el registro");
        } finally {
            setDeleteModal({ isOpen: false, item: null, type: '' });
        }
    };

    const confirmEdit = async () => {
        const { item, type } = editModal;
        if (!item) return;

        try {
            if (type === 'ingreso') {
                const ordenRef = doc(db, "ordenes", item.ordenId);
                const ordenSnap = await getDoc(ordenRef);
                if (ordenSnap.exists()) {
                    const data = ordenSnap.data();
                    const newPagos = [...(data.registroPagos || [])];
                    if(newPagos[item.index]) {
                        newPagos[item.index] = { 
                            ...newPagos[item.index], 
                            montoUSD: editForm.monto, 
                            nota: editForm.concepto,
                            imagenUrl: editForm.imagenUrl
                        };
                        
                        const totalUSD = Number(data.totalUSD) || 0;
                        const nuevoMontoPagado = newPagos.reduce((sum, p) => sum + (Number(p.montoUSD) || 0), 0);
                        let nuevoEstado = "PENDIENTE";
                        if (nuevoMontoPagado >= totalUSD && totalUSD > 0) nuevoEstado = "PAGADO";
                        else if (nuevoMontoPagado > 0) nuevoEstado = "ABONADO";

                        await updateDoc(ordenRef, { 
                            registroPagos: newPagos,
                            montoPagadoUSD: nuevoMontoPagado,
                            estadoPago: nuevoEstado
                        });
                    }
                }
            } else if (type === 'gasto' || type === 'fijo') {
                const updateData: any = { 
                    monto: editForm.monto, 
                    montoUSD: editForm.monto,
                    area: editForm.area !== 'GENERAL' ? editForm.area : null,
                    imagenUrl: editForm.imagenUrl
                };
                if (item.concepto) updateData.descripcion = editForm.concepto;
                await updateDoc(doc(db, "gastos_insumos", item.id), updateData);
            } else if (type === 'nomina') {
                await updateDoc(doc(db, "pagos", item.id), { 
                    totalUSD: editForm.monto,
                    areaAsignada: editForm.area !== 'GENERAL' ? editForm.area : null,
                    notaAdicional: editForm.concepto,
                    imagenUrl: editForm.imagenUrl
                });
            } else if (type === 'diseno') {
                const ordenRef = doc(db, "ordenes", item.orderId);
                const ordenSnap = await getDoc(ordenRef);
                if (ordenSnap.exists()) {
                    const data = ordenSnap.data();
                    const newItems = [...(data.items || [])];
                    if (newItems[item.itemIndex]) {
                        newItems[item.itemIndex] = { ...newItems[item.itemIndex], costoInterno: editForm.monto };
                        await updateDoc(ordenRef, { items: newItems });
                    }
                }
            }
            toast.success("Registro actualizado y auditoría recalculada.");
        } catch (error) {
            toast.error("Error al guardar los cambios");
        } finally {
            setEditModal({ isOpen: false, item: null, type: '' });
        }
    };

    const openEditModal = (item: any, type: string) => {
        setEditForm({ 
            monto: item.monto, 
            concepto: type === 'ingreso' ? item.nota : item.concepto,
            area: item.area || 'GENERAL',
            imagenUrl: item.imagenUrl || ''
        });
        setEditModal({ isOpen: true, item, type });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-4">
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors", mainTab === 'ingresos' ? "bg-emerald-600 shadow-emerald-500/20" : "bg-rose-600 shadow-rose-500/20")}>
                        {mainTab === 'ingresos' ? <ArrowDownLeft className="text-white w-7 h-7" /> : <ArrowUpRight className="text-white w-7 h-7" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
                            {mainTab === 'ingresos' ? "Auditoría de Ingresos" : "Auditoría de Egresos"}
                        </h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Control Financiero</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    <Button 
                        variant={isEditMode ? "destructive" : "outline"}
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={cn("h-11 rounded-xl font-bold text-xs uppercase gap-2 transition-all border-slate-200", isEditMode ? "shadow-red-500/20 shadow-lg" : "")}
                    >
                        {isEditMode ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4"/>}
                        {isEditMode ? "Modo Seguro" : "Desbloquear Edición"}
                    </Button>

                    <div className="relative flex-1 md:flex-none md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar..." className="pl-10 h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[130px] h-11 rounded-xl bg-slate-100 dark:bg-white/10 border-none font-black uppercase text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length: 12}, (_, i) => (<SelectItem key={i} value={i.toString()} className="uppercase text-xs">{new Date(0, i).toLocaleString('es-VE', { month: 'long' })}</SelectItem>))}</SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[90px] h-11 rounded-xl bg-slate-100 dark:bg-white/10 border-none font-black uppercase text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({length: 5}, (_, i) => (<SelectItem key={i} value={(new Date().getFullYear() - i).toString()} className="uppercase text-xs">{new Date().getFullYear() - i}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
                <TabsList className="bg-white dark:bg-[#1c1c1e] p-1.5 rounded-[1.5rem] w-full flex h-16 border border-slate-100 dark:border-white/5 shadow-sm">
                    <TabsTrigger value="ingresos" className="flex-1 rounded-[1.2rem] h-full text-xs font-black uppercase tracking-widest data-[state=active]:bg-emerald-50 dark:data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 transition-all gap-2">
                        <Wallet size={18} /> Entradas (Cobranza)
                    </TabsTrigger>
                    <TabsTrigger value="egresos" className="flex-1 rounded-[1.2rem] h-full text-xs font-black uppercase tracking-widest data-[state=active]:bg-rose-50 dark:data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600 transition-all gap-2">
                        <FileText size={18} /> Salidas (Gastos)
                    </TabsTrigger>
                </TabsList>

                {/* --- CONTENIDO INGRESOS --- */}
                <TabsContent value="ingresos" className="mt-0">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                                    <tr>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">{isEditMode ? "Ajustar Fecha" : "Fecha"}</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente / Orden</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Capture</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Monto</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 w-[160px]">{isEditMode ? "Asignar Billetera" : "Billetera"}</th>
                                        {isEditMode && <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center w-[100px]">Acciones</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {ingresosData.map((pago) => (
                                        <tr key={pago.uniqueId} className="group hover:bg-emerald-50/30 transition-colors">
                                            <td className="p-5">
                                                {isEditMode ? (
                                                    updatingId === `date-${pago.uniqueId}` ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Moviendo...</span>
                                                    ) : (
                                                        <Input type="date" defaultValue={format(pago.dateObj, 'yyyy-MM-dd')} onChange={(e) => handleUpdateIncomeDate(pago, e.target.value)} className="h-8 text-[11px] font-black uppercase text-emerald-700 bg-emerald-50 border-none rounded-lg w-[130px] cursor-pointer" />
                                                    )
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{format(pago.dateObj, 'dd/MM/yyyy')}</span>
                                                        <span className="text-[9px] font-bold tracking-widest text-slate-400">{format(pago.dateObj, 'hh:mm a')}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-emerald-600">ORDEN #{pago.ordenNumero}</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-white uppercase truncate max-w-[150px]">{pago.cliente}</span>
                                                    {pago.nota && <span className="text-[9px] text-slate-400 italic truncate max-w-[150px]">{pago.nota}</span>}
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                {pago.imagenUrl ? (
                                                    <Button variant="ghost" size="sm" onClick={() => setPreviewImage(pago.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600 hover:scale-110 transition-transform" title="Ver Comprobante"><Eye className="w-4 h-4"/></Button>
                                                ) : <span className="text-slate-200" title="Sin Comprobante"><ImageIcon className="w-4 h-4 mx-auto"/></span>}
                                            </td>
                                            <td className="p-5 text-right">
                                                <Badge className="bg-emerald-100 text-emerald-700 font-black text-sm border-none shadow-sm">{formatCurrency(pago.monto)}</Badge>
                                            </td>
                                            <td className="p-5">
                                                {isEditMode ? (
                                                    updatingId === `method-${pago.uniqueId}` ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Guardando...</span>
                                                    ) : (
                                                        <Select defaultValue={pago.metodo} onValueChange={(val) => handleUpdateIncomeMethod(pago, val)}>
                                                            <SelectTrigger className="h-9 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{PAYMENT_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                    )
                                                ) : (
                                                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{pago.metodo}</Badge>
                                                )}
                                            </td>
                                            {isEditMode && (
                                                <td className="p-5 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(pago, pago.type)} className="h-8 w-8 text-blue-500 hover:bg-blue-50" title="Editar Monto/Comprobante"><Pencil className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setDeleteModal({ isOpen: true, item: pago, type: pago.type })} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {ingresosData.length === 0 && <tr><td colSpan={isEditMode ? 6 : 5} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">No hay ingresos registrados en este periodo</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- PESTAÑA EGRESOS --- */}
                <TabsContent value="egresos" className="mt-0">
                    <Tabs defaultValue="insumos" className="space-y-6">
                        <TabsList className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-[1.5rem] w-full flex flex-wrap h-auto gap-1">
                            <EgresosTabTrigger value="insumos" label="Insumos" count={egresosInsumos.length} total={egresosInsumos.reduce((a,b)=>a+b.monto,0)} />
                            <EgresosTabTrigger value="fijos" label="Servicios" count={egresosFijos.length} total={egresosFijos.reduce((a,b)=>a+b.monto,0)} />
                            <EgresosTabTrigger value="nomina" label="Nómina" count={egresosNomina.length} total={egresosNomina.reduce((a,b)=>a+b.monto,0)} />
                            <EgresosTabTrigger value="diseno" label="Diseño" count={egresosDiseno.length} total={egresosDiseno.reduce((a,b)=>a+b.monto,0)} />
                        </TabsList>

                        <TabsContent value="insumos"><AuditTable data={egresosInsumos} color="blue" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item:any, type:string) => setDeleteModal({isOpen: true, item, type})} setPreviewImage={setPreviewImage} /></TabsContent>
                        <TabsContent value="fijos"><AuditTable data={egresosFijos} color="orange" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item:any, type:string) => setDeleteModal({isOpen: true, item, type})} setPreviewImage={setPreviewImage} /></TabsContent>
                        <TabsContent value="nomina"><AuditTable data={egresosNomina} color="indigo" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item:any, type:string) => setDeleteModal({isOpen: true, item, type})} setPreviewImage={setPreviewImage} /></TabsContent>
                        <TabsContent value="diseno"><AuditTable data={egresosDiseno} color="purple" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item:any, type:string) => setDeleteModal({isOpen: true, item, type})} setPreviewImage={setPreviewImage} /></TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>

            {/* VISTA PREVIA IMAGEN */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center pointer-events-none">
                    <DialogTitle className="sr-only">Vista previa del comprobante</DialogTitle>
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {previewImage && <a href={previewImage} target="_blank" rel="noreferrer" className="p-3 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-md"><ExternalLink className="w-5 h-5" /></a>}
                        </div>
                        {previewImage && <img src={previewImage} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white" alt="Comprobante" />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL CONFIRMAR ELIMINACIÓN */}
            <Dialog open={deleteModal.isOpen} onOpenChange={(open) => !open && setDeleteModal({ isOpen: false, item: null, type: '' })}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle className="w-5 h-5" /> Confirmar Eliminación
                        </DialogTitle>
                        <DialogDescription className="pt-2">
                            ¿Estás completamente seguro de que deseas eliminar este registro de {deleteModal.type}? 
                            Esta acción es irreversible y afectará los totales de la auditoría. Los saldos se recalcularán automáticamente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl text-sm border border-slate-100 dark:border-white/10 mt-2">
                        <p><strong>Monto:</strong> {formatCurrency(deleteModal.item?.monto || 0)}</p>
                        <p><strong>Referencia:</strong> {deleteModal.item?.cliente || deleteModal.item?.beneficiario}</p>
                    </div>
                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteModal({ isOpen: false, item: null, type: '' })} className="rounded-xl">Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete} className="rounded-xl gap-2 font-bold"><Trash2 className="w-4 h-4"/> Eliminar Definitivamente</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL DE EDICIÓN PROFUNDA (MONTO, ÁREA Y URL) */}
            <Dialog open={editModal.isOpen} onOpenChange={(open) => !open && setEditModal({ isOpen: false, item: null, type: '' })}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="w-5 h-5 text-blue-500" /> Editar Registro ({editModal.type})
                        </DialogTitle>
                        <DialogDescription>Ajusta el monto, concepto o el comprobante de este movimiento.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Monto de Liquidación (USD)</label>
                            <Input type="number" step="0.01" value={editForm.monto} onChange={(e) => setEditForm({...editForm, monto: Number(e.target.value)})} className="h-12 rounded-xl text-lg font-black" />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nota / Concepto</label>
                            <Input value={editForm.concepto} onChange={(e) => setEditForm({...editForm, concepto: e.target.value})} className="h-12 rounded-xl font-bold" placeholder="Escribe el concepto..." />
                        </div>

                        {/* SELECTOR DE ÁREA (Solo para egresos auditables) */}
                        {editModal.type !== 'ingreso' && editModal.type !== 'diseno' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Área Asignada (Balance)</label>
                                <Select value={editForm.area || 'GENERAL'} onValueChange={(val) => setEditForm({...editForm, area: val})}>
                                    <SelectTrigger className="h-12 rounded-xl font-bold text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GENERAL">GENERAL / COMPARTIDO</SelectItem>
                                        <SelectItem value="IMPRESION">IMPRESIÓN</SelectItem>
                                        <SelectItem value="CORTE">CORTE / LÁSER</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1"><ImageIcon size={12}/> Enlace del Comprobante (URL)</label>
                            <Input value={editForm.imagenUrl} onChange={(e) => setEditForm({...editForm, imagenUrl: e.target.value})} className="h-12 rounded-xl text-xs" placeholder="https://res.cloudinary.com/..." />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setEditModal({ isOpen: false, item: null, type: '' })} className="rounded-xl">Cancelar</Button>
                        <Button onClick={confirmEdit} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// --- COMPONENTES AUXILIARES ---

function EgresosTabTrigger({ value, label, count, total }: any) {
    return (
        <TabsTrigger value={value} className="flex-1 min-w-[120px] flex flex-col items-center justify-center gap-1 rounded-2xl py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1c1c1e] data-[state=active]:shadow-md transition-all">
            <span className="text-[10px] font-black uppercase tracking-wide">{label}</span>
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-4 px-1 rounded-md text-[8px] font-bold">{count}</Badge>
                <span className="text-xs font-black text-slate-900 dark:text-white">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
        </TabsTrigger>
    )
}

function AuditTable({ data, color, onUpdate, onUpdateDate, updatingId, isEditMode, onEdit, onDelete, setPreviewImage }: any) {
    const total = data.reduce((sum: number, item: any) => sum + item.monto, 0);
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30",
        orange: "text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/30",
        purple: "text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800/30"
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3 p-6 rounded-[2.5rem] border-none bg-white dark:bg-[#1c1c1e] shadow-xl overflow-hidden">
                <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white dark:bg-[#1c1c1e] z-10 border-b border-black/5 dark:border-white/5">
                            <tr>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">{isEditMode ? "Ajustar Fecha" : "Fecha"}</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Beneficiario / Concepto</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Capture</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Área</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Monto</th>
                                <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 w-[160px]">{isEditMode ? "Asignar Billetera" : "Billetera"}</th>
                                {isEditMode && <th className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center w-[100px]">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {data.length > 0 ? data.map((item: any, idx: number) => (
                                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        {isEditMode ? (
                                            updatingId === `date-${item.id}` ? (
                                                <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> ...</span>
                                            ) : (
                                                <Input type="date" defaultValue={item.fecha ? format(new Date(item.fecha), 'yyyy-MM-dd') : ''} onChange={(e) => onUpdateDate(item, e.target.value, item.type)} className={cn("h-8 text-[11px] font-black uppercase border-none rounded-lg w-[130px] cursor-pointer", colorClasses[color])} />
                                            )
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.fecha ? new Date(item.fecha).toLocaleDateString('es-VE') : '---'}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.fecha ? new Date(item.fecha).getFullYear() : ''}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[200px]">{item.beneficiario}</p>
                                        <p className="text-[9px] font-semibold text-slate-500 truncate max-w-[200px]">{item.concepto}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        {item.imagenUrl ? (
                                            <Button variant="ghost" size="sm" onClick={() => setPreviewImage(item.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600 hover:scale-110 transition-transform" title="Ver Comprobante"><Eye className="w-4 h-4"/></Button>
                                        ) : <span className="text-slate-200" title="Sin Comprobante"><ImageIcon className="w-4 h-4 mx-auto"/></span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        <Badge variant="secondary" className="text-[8px] uppercase font-bold text-slate-500">
                                            {item.area === 'IMPRESION' ? 'Impresión' : item.area === 'CORTE' ? 'Corte' : item.area === 'DISEÑO' ? 'Diseño' : 'General'}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-sm font-black text-slate-900 dark:text-white">${item.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </td>
                                    <td className="p-4">
                                        {isEditMode ? (
                                            updatingId === `method-${item.id}` ? (
                                                <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Actualizando...</span>
                                            ) : (
                                                <Select defaultValue={item.metodo} onValueChange={(val) => onUpdate(item, val, item.type)}>
                                                    <SelectTrigger className="h-8 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{PAYMENT_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                                </Select>
                                            )
                                        ) : (
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{item.metodo}</Badge>
                                        )}
                                    </td>
                                    {isEditMode && (
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => onEdit(item, item.type)} className="h-8 w-8 text-blue-500 hover:bg-blue-50" title="Editar Monto/Área"><Pencil className="w-4 h-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDelete(item, item.type)} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            )) : <tr><td colSpan={isEditMode ? 7 : 6} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">Sin movimientos</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>
            <Card className={cn("p-6 rounded-[2.5rem] border-none shadow-lg text-center flex flex-col items-center justify-center gap-2 h-fit", colorClasses[color])}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Salidas</p>
                <h2 className="text-4xl font-black tracking-tighter">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
            </Card>
        </div>
    );
}