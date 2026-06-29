// @/components/dashboard/PaymentAuditView.tsx
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import {
    FileText, Wallet, ArrowUpRight, ArrowDownLeft,
    Eye, Loader2, ImageIcon, ExternalLink,
    Lock, Unlock, Trash2, Pencil, AlertTriangle, Search, RefreshCw
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/order-utils";
import { cn } from "@/lib/utils";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, isValid } from 'date-fns';

// Props kept for interface compatibility — data is self-fetched internally
interface PaymentAuditViewProps {
    ordenes?: any[];
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

export function PaymentAuditView(_props: PaymentAuditViewProps) {

    // ── Self-fetch (sin límite de 150 órdenes del dashboard)
    const [selfOrdenes, setSelfOrdenes] = useState<any[]>([]);
    const [selfGastos, setSelfGastos] = useState<any[]>([]);
    const [selfPagos, setSelfPagos] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    const loadAll = async () => {
        setIsFetching(true);
        try {
            const [snapOrd, snapGas, snapPag] = await Promise.all([
                getDocs(query(collection(db, "ordenes"), orderBy("fecha", "desc"), limit(3000))),
                getDocs(query(collection(db, "gastos_insumos"), orderBy("fecha", "desc"), limit(1000))),
                getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc"), limit(500))),
            ]);
            setSelfOrdenes(snapOrd.docs.map(d => ({ id: d.id, ...d.data() })));
            setSelfGastos(snapGas.docs.map(d => ({ id: d.id, ...d.data() })));
            setSelfPagos(snapPag.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch {
            toast.error("Error al cargar datos de auditoría");
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => { loadAll(); }, []);

    // ── UI state
    const [mainTab, setMainTab] = useState("ingresos");
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [searchTerm, setSearchTerm] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: any; type: string }>({ isOpen: false, item: null, type: '' });
    const [editModal, setEditModal] = useState<{ isOpen: boolean; item: any; type: string }>({ isOpen: false, item: null, type: '' });
    const [editForm, setEditForm] = useState({ monto: 0, concepto: '', area: '', imagenUrl: '' });

    // ── Helpers
    const filterByDate = (dateInput: any) => {
        if (!dateInput) return false;
        const d = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
        if (!isValid(d)) return false;
        return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
    };

    const filterBySearch = (text: string) =>
        !searchTerm || text.toLowerCase().includes(searchTerm.toLowerCase());

    // ── INGRESOS
    const ingresosData = useMemo(() => {
        const pagos: any[] = [];
        selfOrdenes.forEach(orden => {
            let pagosArray: any[] = Array.isArray(orden.registroPagos)
                ? orden.registroPagos
                : orden.registroPagos && typeof orden.registroPagos === 'object'
                    ? Object.values(orden.registroPagos)
                    : [];

            pagosArray.forEach((pago: any, index: number) => {
                const rawDate = pago.fechaRegistro || pago.fecha || pago.timestamp;
                if (!filterByDate(rawDate)) return;
                const cliente = orden.cliente?.nombreRazonSocial || "Desconocido";
                const nota = pago.nota || "";
                if (!filterBySearch(cliente + nota + (orden.ordenNumero || ""))) return;
                pagos.push({
                    uniqueId: `${orden.id}-${index}`,
                    ordenId: orden.id,
                    ordenNumero: orden.ordenNumero,
                    cliente,
                    monto: Number(pago.montoUSD) || 0,
                    dateObj: rawDate?.toDate ? rawDate.toDate() : new Date(rawDate),
                    metodo: pago.metodo || "Efectivo USD",
                    nota,
                    imagenUrl: pago.imagenUrl || null,
                    index,
                    type: 'ingreso'
                });
            });
        });
        return pagos.sort((a, b) => b.dateObj - a.dateObj);
    }, [selfOrdenes, selectedMonth, selectedYear, searchTerm]);

    // ── EGRESOS
    const egresosInsumos = useMemo(() => selfGastos.filter(g => {
        const isFijo = g.tipo === 'FIJO' || g.categoria === 'Gasto Fijo' || g.categoria === 'ServiciosPublicos';
        return !isFijo && filterByDate(g.fecha) && filterBySearch(g.descripcion || g.nombre || "");
    }).map(g => ({
        id: g.id, fecha: g.fecha, beneficiario: g.proveedor || "Proveedor",
        concepto: g.descripcion || g.nombre || "Compra Insumo",
        metodo: g.metodoPago || "No especificado",
        monto: Number(g.montoUSD) || Number(g.monto) || 0,
        type: 'gasto', area: g.area || 'GENERAL',
        imagenUrl: g.imagenUrl || g.comprobante || null
    })), [selfGastos, selectedMonth, selectedYear, searchTerm]);

    const egresosFijos = useMemo(() => selfGastos.filter(g => {
        const isFijo = g.tipo === 'FIJO' || g.categoria === 'Gasto Fijo' || g.categoria === 'ServiciosPublicos';
        const isPagoServicio = (g.nombre || "").startsWith("[PAGO SERVICIO]");
        return (isFijo || isPagoServicio) && filterByDate(g.fecha) && filterBySearch(g.descripcion || g.nombre || "");
    }).map(g => ({
        id: g.id, fecha: g.fecha, beneficiario: g.proveedor || "Servicio",
        concepto: g.nombre || g.descripcion || "Pago Mensual",
        metodo: g.metodoPago || "No especificado",
        monto: Number(g.montoUSD) || Number(g.monto) || 0,
        type: 'fijo', area: g.area || 'GENERAL',
        imagenUrl: g.imagenUrl || g.comprobante || null
    })), [selfGastos, selectedMonth, selectedYear, searchTerm]);

    const egresosNomina = useMemo(() => selfPagos
        .filter(p => filterByDate(p.fechaPago || p.fecha) && filterBySearch(p.nombre || ""))
        .map(p => ({
            id: p.id, fecha: p.fechaPago || p.fecha,
            beneficiario: p.nombre || p.nombreEmpleado || "Empleado",
            concepto: p.notaAdicional || "Nómina / Comisión",
            metodo: p.metodoPago || "Efectivo",
            monto: Number(p.totalUSD) || 0,
            type: 'nomina', area: p.areaAsignada || 'GENERAL',
            imagenUrl: p.imagenUrl || null
        })), [selfPagos, selectedMonth, selectedYear, searchTerm]);

    const egresosDiseno = useMemo(() => {
        const list: any[] = [];
        selfOrdenes.forEach(o => {
            if (o.estado === 'ANULADO') return;
            const itemsArray: any[] = Array.isArray(o.items)
                ? o.items
                : o.items && typeof o.items === 'object' ? Object.values(o.items) : [];
            itemsArray.forEach((item: any, idx: number) => {
                const esDiseno = item.tipoServicio === 'DISENO' || item.tipoServicio === 'DISEÑO';
                const estaPagado = item.designPaymentStatus === 'PAGADO' || !!item.paymentReference;
                if (!esDiseno || !estaPagado) return;
                const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                if (!filterByDate(fechaPago) || !filterBySearch((item.empleadoAsignado || "") + (item.nombre || ""))) return;
                list.push({
                    id: item.id || `${o.id}-${idx}`, orderId: o.id, itemIndex: idx, fecha: fechaPago,
                    beneficiario: item.empleadoAsignado || "Diseñador",
                    concepto: `Diseño Orden #${o.ordenNumero}`,
                    metodo: item.paymentMethod || "Pago Móvil",
                    monto: (Number(item.costoInterno) || Number(item.precioUnitario) || 0) * (Number(item.cantidad) || 1),
                    type: 'diseno', area: 'DISEÑO'
                });
            });
        });
        return list;
    }, [selfOrdenes, selectedMonth, selectedYear, searchTerm]);

    // ── Handlers
    const handleUpdateIncomeMethod = async (payment: any, newMethod: string) => {
        setUpdatingId(`method-${payment.uniqueId}`);
        try {
            const ref = doc(db, "ordenes", payment.ordenId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                const rp = [...(data.registroPagos || [])];
                if (rp[payment.index]) {
                    rp[payment.index] = { ...rp[payment.index], metodo: newMethod };
                    await updateDoc(ref, { registroPagos: rp });
                    toast.success("Billetera actualizada");
                }
            }
        } catch { toast.error("Error al actualizar"); } finally { setUpdatingId(null); }
    };

    const handleUpdateIncomeDate = async (payment: any, newDateString: string) => {
        if (!newDateString) return;
        setUpdatingId(`date-${payment.uniqueId}`);
        try {
            const parts = newDateString.split('-');
            const d = new Date(payment.dateObj);
            d.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const iso = d.toISOString();
            const ref = doc(db, "ordenes", payment.ordenId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                const rp = [...(data.registroPagos || [])];
                if (rp[payment.index]) {
                    rp[payment.index] = { ...rp[payment.index], fecha: iso, fechaRegistro: iso };
                    await updateDoc(ref, { registroPagos: rp });
                    toast.success("Fecha ajustada");
                }
            }
        } catch { toast.error("Error al actualizar fecha"); } finally { setUpdatingId(null); }
    };

    const handleUpdateExpenseMethod = async (item: any, newMethod: string, type: string) => {
        setUpdatingId(`method-${item.id}`);
        try {
            if (type === 'gasto' || type === 'fijo') {
                await updateDoc(doc(db, "gastos_insumos", item.id), { metodoPago: newMethod });
            } else if (type === 'nomina') {
                await updateDoc(doc(db, "pagos", item.id), { metodoPago: newMethod });
            } else if (type === 'diseno') {
                const ref = doc(db, "ordenes", item.orderId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const items = [...(data.items || [])];
                    if (items[item.itemIndex]) {
                        items[item.itemIndex] = { ...items[item.itemIndex], paymentMethod: newMethod };
                        await updateDoc(ref, { items });
                    }
                }
            }
            toast.success("Billetera actualizada");
        } catch { toast.error("Error al actualizar"); } finally { setUpdatingId(null); }
    };

    const handleUpdateExpenseDate = async (item: any, newDateString: string, type: string) => {
        if (!newDateString) return;
        setUpdatingId(`date-${item.id}`);
        try {
            const parts = newDateString.split('-');
            let d = new Date();
            if (item.fecha) { const p = new Date(item.fecha); if (!isNaN(p.getTime())) d = p; }
            d.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const iso = d.toISOString();
            if (type === 'gasto' || type === 'fijo') {
                await updateDoc(doc(db, "gastos_insumos", item.id), { fecha: iso });
            } else if (type === 'nomina') {
                await updateDoc(doc(db, "pagos", item.id), { fechaPago: iso, fecha: iso });
            } else if (type === 'diseno') {
                const ref = doc(db, "ordenes", item.orderId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const items = [...(data.items || [])];
                    if (items[item.itemIndex]) {
                        items[item.itemIndex] = { ...items[item.itemIndex], paymentDate: iso };
                        await updateDoc(ref, { items });
                    }
                }
            }
            toast.success("Fecha ajustada");
        } catch { toast.error("Error al reasignar fecha"); } finally { setUpdatingId(null); }
    };

    const confirmDelete = async () => {
        const { item, type } = deleteModal;
        if (!item) return;
        try {
            if (type === 'ingreso') {
                const ref = doc(db, "ordenes", item.ordenId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const newPagos = [...(data.registroPagos || [])];
                    newPagos.splice(item.index, 1);
                    const totalUSD = Number(data.totalUSD) || 0;
                    const montoPagado = newPagos.reduce((s: number, p: any) => s + (Number(p.montoUSD) || 0), 0);
                    const estado = montoPagado >= totalUSD && totalUSD > 0 ? "PAGADO" : montoPagado > 0 ? "ABONADO" : "PENDIENTE";
                    await updateDoc(ref, { registroPagos: newPagos, montoPagadoUSD: montoPagado, estadoPago: estado });
                }
            } else if (type === 'gasto' || type === 'fijo') {
                await deleteDoc(doc(db, "gastos_insumos", item.id));
            } else if (type === 'nomina') {
                await deleteDoc(doc(db, "pagos", item.id));
            } else if (type === 'diseno') {
                const ref = doc(db, "ordenes", item.orderId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const newItems = [...(data.items || [])];
                    if (newItems[item.itemIndex]) {
                        newItems[item.itemIndex] = { ...newItems[item.itemIndex], designPaymentStatus: 'PENDIENTE', paymentReference: null, paymentDate: null, paymentMethod: null };
                        await updateDoc(ref, { items: newItems });
                    }
                }
            }
            toast.success("Registro eliminado y saldos recalculados");
        } catch { toast.error("Error al eliminar"); }
        finally { setDeleteModal({ isOpen: false, item: null, type: '' }); }
    };

    const confirmEdit = async () => {
        const { item, type } = editModal;
        if (!item) return;
        try {
            if (type === 'ingreso') {
                const ref = doc(db, "ordenes", item.ordenId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const newPagos = [...(data.registroPagos || [])];
                    if (newPagos[item.index]) {
                        newPagos[item.index] = { ...newPagos[item.index], montoUSD: editForm.monto, nota: editForm.concepto, imagenUrl: editForm.imagenUrl };
                        const totalUSD = Number(data.totalUSD) || 0;
                        const montoPagado = newPagos.reduce((s: number, p: any) => s + (Number(p.montoUSD) || 0), 0);
                        const estado = montoPagado >= totalUSD && totalUSD > 0 ? "PAGADO" : montoPagado > 0 ? "ABONADO" : "PENDIENTE";
                        await updateDoc(ref, { registroPagos: newPagos, montoPagadoUSD: montoPagado, estadoPago: estado });
                    }
                }
            } else if (type === 'gasto' || type === 'fijo') {
                const upd: any = { monto: editForm.monto, montoUSD: editForm.monto, area: editForm.area !== 'GENERAL' ? editForm.area : null, imagenUrl: editForm.imagenUrl };
                if (item.concepto) upd.descripcion = editForm.concepto;
                await updateDoc(doc(db, "gastos_insumos", item.id), upd);
            } else if (type === 'nomina') {
                await updateDoc(doc(db, "pagos", item.id), { totalUSD: editForm.monto, areaAsignada: editForm.area !== 'GENERAL' ? editForm.area : null, notaAdicional: editForm.concepto, imagenUrl: editForm.imagenUrl });
            } else if (type === 'diseno') {
                const ref = doc(db, "ordenes", item.orderId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const newItems = [...(data.items || [])];
                    if (newItems[item.itemIndex]) {
                        newItems[item.itemIndex] = { ...newItems[item.itemIndex], costoInterno: editForm.monto };
                        await updateDoc(ref, { items: newItems });
                    }
                }
            }
            toast.success("Registro actualizado");
        } catch { toast.error("Error al guardar cambios"); }
        finally { setEditModal({ isOpen: false, item: null, type: '' }); }
    };

    const openEditModal = (item: any, type: string) => {
        setEditForm({ monto: item.monto, concepto: type === 'ingreso' ? item.nota : item.concepto, area: item.area || 'GENERAL', imagenUrl: item.imagenUrl || '' });
        setEditModal({ isOpen: true, item, type });
    };

    const totalIngresos = ingresosData.reduce((s, p) => s + p.monto, 0);

    return (
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24 px-2 sm:px-4">

            {/* HEADER */}
            <div className="flex flex-col gap-3 bg-white dark:bg-[#1c1c1e] p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className={cn("w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0 transition-colors", mainTab === 'ingresos' ? "bg-emerald-600 shadow-emerald-500/20" : "bg-rose-600 shadow-rose-500/20")}>
                            {mainTab === 'ingresos' ? <ArrowDownLeft className="text-white w-5 h-5 sm:w-7 sm:h-7" /> : <ArrowUpRight className="text-white w-5 h-5 sm:w-7 sm:h-7" />}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic leading-tight">
                                {mainTab === 'ingresos' ? "Auditoría de Ingresos" : "Auditoría de Egresos"}
                            </h1>
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {isFetching ? "Cargando datos sin límite..." : `${selfOrdenes.length} órdenes cargadas`}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={loadAll} disabled={isFetching} className="shrink-0 rounded-xl text-slate-400 hover:text-blue-600" title="Recargar datos">
                        <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
                    </Button>
                </div>

                {/* CONTROLES */}
                <div className="flex flex-wrap gap-2 items-center">
                    <Button variant={isEditMode ? "destructive" : "outline"} onClick={() => setIsEditMode(!isEditMode)}
                        className={cn("h-9 sm:h-11 rounded-xl font-bold text-[10px] sm:text-xs uppercase gap-1.5 sm:gap-2 border-slate-200", isEditMode ? "shadow-red-500/20 shadow-lg" : "")}>
                        {isEditMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {isEditMode ? "Modo Seguro" : "Edición"}
                    </Button>

                    <div className="relative flex-1 min-w-[120px] sm:min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input placeholder="Buscar..." className="pl-8 sm:pl-10 h-9 sm:h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-none font-bold text-[10px] sm:text-xs uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[110px] sm:w-[130px] h-9 sm:h-11 rounded-xl bg-slate-100 dark:bg-white/10 border-none font-black uppercase text-[10px] sm:text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 12 }, (_, i) => (<SelectItem key={i} value={i.toString()} className="uppercase text-xs">{new Date(0, i).toLocaleString('es-VE', { month: 'long' })}</SelectItem>))}</SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[80px] sm:w-[90px] h-9 sm:h-11 rounded-xl bg-slate-100 dark:bg-white/10 border-none font-black uppercase text-[10px] sm:text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Array.from({ length: 5 }, (_, i) => (<SelectItem key={i} value={(new Date().getFullYear() - i).toString()} className="uppercase text-xs">{new Date().getFullYear() - i}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
            </div>

            {/* LOADING OVERLAY */}
            {isFetching && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <p className="text-[11px] font-black uppercase tracking-widest">Cargando todas las órdenes sin límite...</p>
                </div>
            )}

            {!isFetching && (
                <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4 sm:space-y-6">
                    <TabsList className="bg-white dark:bg-[#1c1c1e] p-1.5 rounded-[1.5rem] w-full flex h-14 sm:h-16 border border-slate-100 dark:border-white/5 shadow-sm">
                        <TabsTrigger value="ingresos" className="flex-1 rounded-[1.2rem] h-full text-[10px] sm:text-xs font-black uppercase tracking-widest data-[state=active]:bg-emerald-50 dark:data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 transition-all gap-1.5 sm:gap-2">
                            <Wallet size={15} className="sm:w-[18px] sm:h-[18px]" /> Entradas
                        </TabsTrigger>
                        <TabsTrigger value="egresos" className="flex-1 rounded-[1.2rem] h-full text-[10px] sm:text-xs font-black uppercase tracking-widest data-[state=active]:bg-rose-50 dark:data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-600 transition-all gap-1.5 sm:gap-2">
                            <FileText size={15} className="sm:w-[18px] sm:h-[18px]" /> Salidas
                        </TabsTrigger>
                    </TabsList>

                    {/* ──────────────── INGRESOS ──────────────── */}
                    <TabsContent value="ingresos" className="mt-0 space-y-3">
                        {/* Resumen total */}
                        <div className="flex items-center justify-between px-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ingresosData.length} cobros en el periodo</p>
                            <Badge className="bg-emerald-100 text-emerald-700 font-black text-sm sm:text-base border-none px-3 py-1 break-all">{formatCurrency(totalIngresos)}</Badge>
                        </div>

                        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                            {/* MOBILE: tarjetas apiladas */}
                            <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
                                {ingresosData.length === 0 && (
                                    <p className="p-8 text-center text-slate-400 text-xs font-bold uppercase">No hay ingresos en este periodo</p>
                                )}
                                {ingresosData.map(pago => (
                                    <div key={pago.uniqueId} className="p-4 space-y-2.5 group hover:bg-emerald-50/30 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Orden #{pago.ordenNumero}</span>
                                                <p className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{pago.cliente}</p>
                                                {pago.nota && <p className="text-[9px] text-slate-400 italic truncate">{pago.nota}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[9px] text-slate-400 font-bold">{format(pago.dateObj, 'dd/MM/yy')}</p>
                                                <Badge className="bg-emerald-100 text-emerald-700 font-black border-none mt-0.5">{formatCurrency(pago.monto)}</Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {isEditMode ? (
                                                updatingId === `method-${pago.uniqueId}` ? (
                                                    <span className="text-[9px] text-emerald-600 flex items-center gap-1 font-bold"><Loader2 className="w-3 h-3 animate-spin" />Guardando...</span>
                                                ) : (
                                                    <Select defaultValue={pago.metodo} onValueChange={(v) => handleUpdateIncomeMethod(pago, v)}>
                                                        <SelectTrigger className="h-8 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10 flex-1 min-w-[110px]"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                )
                                            ) : (
                                                <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{pago.metodo}</Badge>
                                            )}
                                            {isEditMode && updatingId === `date-${pago.uniqueId}` && (
                                                <span className="text-[9px] text-emerald-600 flex items-center gap-1 font-bold"><Loader2 className="w-3 h-3 animate-spin" />Moviendo...</span>
                                            )}
                                            {isEditMode && updatingId !== `date-${pago.uniqueId}` && (
                                                <Input type="date" defaultValue={format(pago.dateObj, 'yyyy-MM-dd')} onChange={(e) => handleUpdateIncomeDate(pago, e.target.value)} className="h-8 text-[10px] font-black bg-emerald-50 border-none rounded-lg w-[130px] text-emerald-700" />
                                            )}
                                            {pago.imagenUrl && (
                                                <Button variant="ghost" size="sm" onClick={() => setPreviewImage(pago.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600"><Eye className="w-3.5 h-3.5" /></Button>
                                            )}
                                            {isEditMode && (
                                                <>
                                                    <Button variant="ghost" size="icon" onClick={() => openEditModal(pago, pago.type)} className="h-8 w-8 text-blue-500 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => setDeleteModal({ isOpen: true, item: pago, type: pago.type })} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* DESKTOP: tabla */}
                            <div className="hidden sm:block overflow-x-auto">
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
                                        {ingresosData.map(pago => (
                                            <tr key={pago.uniqueId} className="group hover:bg-emerald-50/30 transition-colors">
                                                <td className="p-5">
                                                    {isEditMode ? (
                                                        updatingId === `date-${pago.uniqueId}` ? (
                                                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Moviendo...</span>
                                                        ) : (
                                                            <Input type="date" defaultValue={format(pago.dateObj, 'yyyy-MM-dd')} onChange={(e) => handleUpdateIncomeDate(pago, e.target.value)} className="h-8 text-[11px] font-black uppercase text-emerald-700 bg-emerald-50 border-none rounded-lg w-[130px]" />
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
                                                        <span className="text-xs font-bold text-slate-700 dark:text-white uppercase truncate max-w-[180px]">{pago.cliente}</span>
                                                        {pago.nota && <span className="text-[9px] text-slate-400 italic truncate max-w-[180px]">{pago.nota}</span>}
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    {pago.imagenUrl ? (
                                                        <Button variant="ghost" size="sm" onClick={() => setPreviewImage(pago.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600 hover:scale-110 transition-transform"><Eye className="w-4 h-4" /></Button>
                                                    ) : <ImageIcon className="w-4 h-4 mx-auto text-slate-200" />}
                                                </td>
                                                <td className="p-5 text-right">
                                                    <Badge className="bg-emerald-100 text-emerald-700 font-black text-sm border-none shadow-sm">{formatCurrency(pago.monto)}</Badge>
                                                </td>
                                                <td className="p-5">
                                                    {isEditMode ? (
                                                        updatingId === `method-${pago.uniqueId}` ? (
                                                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Guardando...</span>
                                                        ) : (
                                                            <Select defaultValue={pago.metodo} onValueChange={(v) => handleUpdateIncomeMethod(pago, v)}>
                                                                <SelectTrigger className="h-9 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10"><SelectValue /></SelectTrigger>
                                                                <SelectContent>{PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                                            </Select>
                                                        )
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{pago.metodo}</Badge>
                                                    )}
                                                </td>
                                                {isEditMode && (
                                                    <td className="p-5 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(pago, pago.type)} className="h-8 w-8 text-blue-500 hover:bg-blue-50"><Pencil className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="icon" onClick={() => setDeleteModal({ isOpen: true, item: pago, type: pago.type })} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {ingresosData.length === 0 && (
                                            <tr><td colSpan={isEditMode ? 6 : 5} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">No hay ingresos registrados en este periodo</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* ──────────────── EGRESOS ──────────────── */}
                    <TabsContent value="egresos" className="mt-0">
                        <Tabs defaultValue="insumos" className="space-y-4 sm:space-y-6">
                            <TabsList className="bg-slate-100 dark:bg-white/5 p-1 sm:p-1.5 rounded-[1.5rem] w-full flex flex-wrap h-auto gap-1">
                                <EgresosTabTrigger value="insumos" label="Insumos" count={egresosInsumos.length} total={egresosInsumos.reduce((a, b) => a + b.monto, 0)} />
                                <EgresosTabTrigger value="fijos" label="Servicios" count={egresosFijos.length} total={egresosFijos.reduce((a, b) => a + b.monto, 0)} />
                                <EgresosTabTrigger value="nomina" label="Nómina" count={egresosNomina.length} total={egresosNomina.reduce((a, b) => a + b.monto, 0)} />
                                <EgresosTabTrigger value="diseno" label="Diseño" count={egresosDiseno.length} total={egresosDiseno.reduce((a, b) => a + b.monto, 0)} />
                            </TabsList>
                            <TabsContent value="insumos"><AuditTable data={egresosInsumos} color="blue" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item: any, type: string) => setDeleteModal({ isOpen: true, item, type })} setPreviewImage={setPreviewImage} /></TabsContent>
                            <TabsContent value="fijos"><AuditTable data={egresosFijos} color="orange" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item: any, type: string) => setDeleteModal({ isOpen: true, item, type })} setPreviewImage={setPreviewImage} /></TabsContent>
                            <TabsContent value="nomina"><AuditTable data={egresosNomina} color="indigo" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item: any, type: string) => setDeleteModal({ isOpen: true, item, type })} setPreviewImage={setPreviewImage} /></TabsContent>
                            <TabsContent value="diseno"><AuditTable data={egresosDiseno} color="purple" onUpdate={handleUpdateExpenseMethod} onUpdateDate={handleUpdateExpenseDate} updatingId={updatingId} isEditMode={isEditMode} onEdit={openEditModal} onDelete={(item: any, type: string) => setDeleteModal({ isOpen: true, item, type })} setPreviewImage={setPreviewImage} /></TabsContent>
                        </Tabs>
                    </TabsContent>
                </Tabs>
            )}

            {/* PREVIEW IMAGEN */}
            <Dialog open={!!previewImage} onOpenChange={(o) => !o && setPreviewImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center pointer-events-none">
                    <DialogTitle className="sr-only">Comprobante</DialogTitle>
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {previewImage && <a href={previewImage} target="_blank" rel="noreferrer" className="p-3 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-md"><ExternalLink className="w-5 h-5" /></a>}
                        </div>
                        {previewImage && <img src={previewImage} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white" alt="Comprobante" />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL ELIMINAR */}
            <Dialog open={deleteModal.isOpen} onOpenChange={(o) => !o && setDeleteModal({ isOpen: false, item: null, type: '' })}>
                <DialogContent className="sm:max-w-md rounded-2xl mx-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-600"><AlertTriangle className="w-5 h-5" /> Confirmar Eliminación</DialogTitle>
                        <DialogDescription className="pt-2">Esta acción es irreversible. Los saldos se recalcularán automáticamente.</DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl text-sm border border-slate-100 dark:border-white/10 mt-2 space-y-1">
                        <p><strong>Monto:</strong> {formatCurrency(deleteModal.item?.monto || 0)}</p>
                        <p className="truncate"><strong>Referencia:</strong> {deleteModal.item?.cliente || deleteModal.item?.beneficiario}</p>
                    </div>
                    <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                        <Button variant="outline" onClick={() => setDeleteModal({ isOpen: false, item: null, type: '' })} className="rounded-xl">Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete} className="rounded-xl gap-2 font-bold"><Trash2 className="w-4 h-4" /> Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL EDICIÓN */}
            <Dialog open={editModal.isOpen} onOpenChange={(o) => !o && setEditModal({ isOpen: false, item: null, type: '' })}>
                <DialogContent className="sm:max-w-md rounded-2xl mx-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-blue-500" /> Editar Registro</DialogTitle>
                        <DialogDescription>Ajusta el monto, concepto o comprobante.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Monto (USD)</label>
                            <Input type="number" step="0.01" value={editForm.monto} onChange={(e) => setEditForm({ ...editForm, monto: Number(e.target.value) })} className="h-12 rounded-xl text-lg font-black" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nota / Concepto</label>
                            <Input value={editForm.concepto} onChange={(e) => setEditForm({ ...editForm, concepto: e.target.value })} className="h-12 rounded-xl font-bold" placeholder="Concepto..." />
                        </div>
                        {editModal.type !== 'ingreso' && editModal.type !== 'diseno' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Área</label>
                                <Select value={editForm.area || 'GENERAL'} onValueChange={(v) => setEditForm({ ...editForm, area: v })}>
                                    <SelectTrigger className="h-12 rounded-xl font-bold text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GENERAL">GENERAL</SelectItem>
                                        <SelectItem value="IMPRESION">IMPRESIÓN</SelectItem>
                                        <SelectItem value="CORTE">CORTE / LÁSER</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1"><ImageIcon size={12} /> URL Comprobante</label>
                            <Input value={editForm.imagenUrl} onChange={(e) => setEditForm({ ...editForm, imagenUrl: e.target.value })} className="h-12 rounded-xl text-xs" placeholder="https://..." />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button variant="outline" onClick={() => setEditModal({ isOpen: false, item: null, type: '' })} className="rounded-xl">Cancelar</Button>
                        <Button onClick={confirmEdit} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white">Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ── COMPONENTES AUXILIARES

function EgresosTabTrigger({ value, label, count, total }: any) {
    return (
        <TabsTrigger value={value} className="flex-1 min-w-[80px] sm:min-w-[120px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-2xl py-1.5 sm:py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-[#1c1c1e] data-[state=active]:shadow-md transition-all">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wide">{label}</span>
            <div className="flex items-center gap-1 sm:gap-2">
                <Badge variant="secondary" className="h-3.5 sm:h-4 px-1 rounded-md text-[7px] sm:text-[8px] font-bold">{count}</Badge>
                <span className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-white break-all">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
        </TabsTrigger>
    );
}

function AuditTable({ data, color, onUpdate, onUpdateDate, updatingId, isEditMode, onEdit, onDelete, setPreviewImage }: any) {
    const total = data.reduce((s: number, i: any) => s + i.monto, 0);
    const colorClasses: Record<string, string> = {
        blue: "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30",
        orange: "text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800/30",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/30",
        purple: "text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800/30",
    };
    const inputCls = cn("h-8 text-[10px] font-black uppercase border-none rounded-lg w-[120px] cursor-pointer", colorClasses[color]);

    const areaLabel = (a: string) => a === 'IMPRESION' ? 'Impresión' : a === 'CORTE' ? 'Corte' : a === 'DISEÑO' ? 'Diseño' : 'General';

    return (
        <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-4 sm:gap-6">
            {/* Tabla / Cards */}
            <Card className="sm:col-span-3 rounded-[2rem] sm:rounded-[2.5rem] border-none bg-white dark:bg-[#1c1c1e] shadow-xl overflow-hidden">

                {/* MOBILE: tarjetas */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
                    {data.length === 0 && <p className="p-8 text-center text-slate-400 text-xs font-bold uppercase">Sin movimientos</p>}
                    {data.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="p-4 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-800 dark:text-white uppercase truncate">{item.beneficiario}</p>
                                    <p className="text-[9px] text-slate-500 truncate">{item.concepto}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[9px] text-slate-400 font-bold">{item.fecha ? new Date(item.fecha?.toDate ? item.fecha.toDate() : item.fecha).toLocaleDateString('es-VE') : '---'}</p>
                                    <p className={cn("text-sm font-black mt-0.5", colorClasses[color].split(' ')[0])}>
                                        ${item.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-[8px] uppercase font-bold text-slate-500">{areaLabel(item.area)}</Badge>
                                {isEditMode ? (
                                    updatingId === `method-${item.id}` ? (
                                        <span className="text-[9px] font-bold flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />...</span>
                                    ) : (
                                        <Select defaultValue={item.metodo} onValueChange={(v) => onUpdate(item, v, item.type)}>
                                            <SelectTrigger className="h-8 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10 flex-1 min-w-[110px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>{PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )
                                ) : (
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{item.metodo}</Badge>
                                )}
                                {isEditMode && (
                                    <Input type="date" defaultValue={item.fecha ? format(new Date(item.fecha?.toDate ? item.fecha.toDate() : item.fecha), 'yyyy-MM-dd') : ''} onChange={(e) => onUpdateDate(item, e.target.value, item.type)} className={inputCls} />
                                )}
                                {item.imagenUrl && (
                                    <Button variant="ghost" size="sm" onClick={() => setPreviewImage(item.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600"><Eye className="w-3.5 h-3.5" /></Button>
                                )}
                                {isEditMode && (
                                    <>
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(item, item.type)} className="h-8 w-8 text-blue-500 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => onDelete(item, item.type)} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* DESKTOP: tabla */}
                <div className="hidden sm:block overflow-auto max-h-[500px]">
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
                            {data.length === 0 && <tr><td colSpan={isEditMode ? 7 : 6} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">Sin movimientos</td></tr>}
                            {data.map((item: any, idx: number) => (
                                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        {isEditMode ? (
                                            updatingId === `date-${item.id}` ? (
                                                <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />...</span>
                                            ) : (
                                                <Input type="date" defaultValue={item.fecha ? format(new Date(item.fecha?.toDate ? item.fecha.toDate() : item.fecha), 'yyyy-MM-dd') : ''} onChange={(e) => onUpdateDate(item, e.target.value, item.type)} className={inputCls} />
                                            )
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.fecha ? new Date(item.fecha?.toDate ? item.fecha.toDate() : item.fecha).toLocaleDateString('es-VE') : '---'}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[200px]">{item.beneficiario}</p>
                                        <p className="text-[9px] font-semibold text-slate-500 truncate max-w-[200px]">{item.concepto}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        {item.imagenUrl ? (
                                            <Button variant="ghost" size="sm" onClick={() => setPreviewImage(item.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600 hover:scale-110 transition-transform"><Eye className="w-4 h-4" /></Button>
                                        ) : <ImageIcon className="w-4 h-4 mx-auto text-slate-200" />}
                                    </td>
                                    <td className="p-4 text-center">
                                        <Badge variant="secondary" className="text-[8px] uppercase font-bold text-slate-500">{areaLabel(item.area)}</Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-sm font-black text-slate-900 dark:text-white">${item.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </td>
                                    <td className="p-4">
                                        {isEditMode ? (
                                            updatingId === `method-${item.id}` ? (
                                                <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />...</span>
                                            ) : (
                                                <Select defaultValue={item.metodo} onValueChange={(v) => onUpdate(item, v, item.type)}>
                                                    <SelectTrigger className="h-8 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                            )
                                        ) : (
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{item.metodo}</Badge>
                                        )}
                                    </td>
                                    {isEditMode && (
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => onEdit(item, item.type)} className="h-8 w-8 text-blue-500 hover:bg-blue-50"><Pencil className="w-4 h-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDelete(item, item.type)} className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></Button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Card de total */}
            <Card className={cn("p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-lg text-center flex flex-col items-center justify-center gap-2 order-first sm:order-last", colorClasses[color])}>
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total Salidas</p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter break-all">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                <p className="text-[9px] font-bold opacity-50 uppercase">{data.length} registros</p>
            </Card>
        </div>
    );
}
