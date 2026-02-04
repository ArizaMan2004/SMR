// @/components/dashboard/PaymentAuditView.tsx
"use client"

import React, { useState, useMemo } from 'react';
import { 
    FileText, Wallet, User, Building2, Palette, 
    Search, ArrowUpRight, ArrowDownLeft,
    Eye, Loader2, ImageIcon, ExternalLink,
    Lock, Unlock, CalendarX
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils/order-utils";
import { cn } from "@/lib/utils";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { format, isValid } from 'date-fns';

interface PaymentAuditViewProps {
    ordenes: any[];
    gastos?: any[];         
    pagosEmpleados?: any[]; 
}

// --- CONFIGURACIÓN DE MÉTODOS DE PAGO (Sincronizado con WalletsView) ---
// Estos valores contienen las palabras clave que WalletsView busca para clasificar
const PAYMENT_OPTIONS = [
    { value: "Efectivo USD", label: "Caja Chica ($)" },
    { value: "Pago Móvil (Bs)", label: "Banco Nacional (Bs)" },
    { value: "Zelle", label: "Zelle / Bofa" },
    { value: "Binance USDT", label: "Binance / USDT" },
    // Opción extra por si manejas efectivo en bolívares físico
    { value: "Efectivo Bs", label: "Caja Chica (Bs)" } 
];

export function PaymentAuditView({ 
    ordenes = [], 
    gastos = [], 
    pagosEmpleados = [] 
}: PaymentAuditViewProps) {

    // --- ESTADOS GLOBALES ---
    const [mainTab, setMainTab] = useState("ingresos");
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [searchTerm, setSearchTerm] = useState("");
    
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // --- FILTROS ---
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
            if (orden.registroPagos && orden.registroPagos.length > 0) {
                orden.registroPagos.forEach((pago: any, index: number) => {
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
                                index: index
                            });
                        }
                    }
                })
            }
        })
        return pagos.sort((a, b) => b.dateObj - a.dateObj);
    }, [ordenes, selectedMonth, selectedYear, searchTerm]);

    const handleUpdateIncomeMethod = async (payment: any, newMethod: string) => {
        setUpdatingId(payment.uniqueId)
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

    // ==========================================
    // 2. LÓGICA DE EGRESOS (Gastos Editables)
    // ==========================================
    
    const handleUpdateExpenseMethod = async (item: any, newMethod: string, type: 'gasto' | 'nomina' | 'diseno') => {
        setUpdatingId(item.id);
        try {
            if (type === 'gasto') {
                // Actualiza en colección 'gastos_insumos'
                await updateDoc(doc(db, "gastos_insumos", item.id), { metodoPago: newMethod });
            } 
            else if (type === 'nomina') {
                // Actualiza en colección 'pagos'
                await updateDoc(doc(db, "pagos", item.id), { metodoPago: newMethod });
            }
            else if (type === 'diseno') {
                // Actualiza el item dentro de la orden
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
        } catch (error) {
            console.error("Error al actualizar:", error);
            toast.error("Error al actualizar (Revisa consola)");
        } finally {
            setUpdatingId(null);
        }
    };

    // A. Insumos
    const egresosInsumos = useMemo(() => {
        return gastos.filter(g => {
            const isFijo = g.tipo === 'FIJO' || g.categoria === 'Gasto Fijo' || g.categoria === 'ServiciosPublicos';
            return !isFijo && filterByDate(g.fecha) && filterBySearch(g.descripcion || g.nombre || "");
        }).map(g => ({
            id: g.id,
            fecha: g.fecha,
            beneficiario: g.proveedor || "Proveedor",
            concepto: g.descripcion || g.nombre || "Compra Insumo",
            metodo: g.metodoPago || "No especificado",
            monto: Number(g.montoUSD) || Number(g.monto) || 0,
            type: 'gasto'
        }));
    }, [gastos, selectedMonth, selectedYear, searchTerm]);

    // B. Gastos Fijos
    const egresosFijos = useMemo(() => {
        return gastos.filter(g => {
            const isFijo = g.tipo === 'FIJO' || g.categoria === 'Gasto Fijo' || g.categoria === 'ServiciosPublicos';
            const isPagoServicio = (g.nombre || "").startsWith("[PAGO SERVICIO]");
            return (isFijo || isPagoServicio) && filterByDate(g.fecha) && filterBySearch(g.descripcion || g.nombre || "");
        }).map(g => ({
            id: g.id,
            fecha: g.fecha,
            beneficiario: g.proveedor || "Servicio",
            concepto: g.nombre || g.descripcion || "Pago Mensual",
            metodo: g.metodoPago || "No especificado",
            monto: Number(g.montoUSD) || Number(g.monto) || 0,
            type: 'gasto'
        }));
    }, [gastos, selectedMonth, selectedYear, searchTerm]);

    // C. Nómina
    const egresosNomina = useMemo(() => {
        return pagosEmpleados.filter(p => {
            return filterByDate(p.fechaPago || p.fecha) && filterBySearch(p.nombre || "");
        }).map(p => ({
            id: p.id,
            fecha: p.fechaPago || p.fecha,
            beneficiario: p.nombre,
            concepto: "Nómina / Comisión",
            metodo: p.metodoPago || "Efectivo",
            monto: Number(p.totalUSD) || 0,
            type: 'nomina'
        }));
    }, [pagosEmpleados, selectedMonth, selectedYear, searchTerm]);

    // D. Diseños
    const egresosDiseno = useMemo(() => {
        const list: any[] = [];
        ordenes.forEach(o => {
            if (o.estado === 'ANULADO') return;
            (o.items || []).forEach((item: any, idx: number) => {
                const esDiseno = (item.tipoServicio === 'DISENO' || item.tipoServicio === 'DISEÑO');
                const estaPagado = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                
                if (esDiseno && estaPagado) {
                    const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                    if (filterByDate(fechaPago)) {
                        if (filterBySearch(item.empleadoAsignado + item.nombre)) {
                            const costo = (Number(item.costoInterno) || Number(item.precioUnitario) || 0) * (Number(item.cantidad) || 1);
                            list.push({
                                id: item.id || `${o.id}-${idx}`,
                                orderId: o.id,
                                itemIndex: idx,
                                fecha: fechaPago,
                                beneficiario: item.empleadoAsignado || "Diseñador",
                                concepto: `Diseño Orden #${o.ordenNumero}`,
                                metodo: item.paymentMethod || "Pago Móvil",
                                monto: costo,
                                type: 'diseno'
                            });
                        }
                    }
                }
            });
        });
        return list;
    }, [ordenes, selectedMonth, selectedYear, searchTerm]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-24 px-4">
            
            {/* HEADER COMPARTIDO */}
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
                    {/* BOTÓN MODO EDICIÓN */}
                    <Button 
                        variant={isEditMode ? "destructive" : "outline"}
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={cn("h-11 rounded-xl font-bold text-xs uppercase gap-2 transition-all border-slate-200", isEditMode ? "shadow-red-500/20 shadow-lg" : "")}
                    >
                        {isEditMode ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4"/>}
                        {isEditMode ? "Bloquear" : "Editar"}
                    </Button>

                    <div className="relative flex-1 md:flex-none md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar..." 
                            className="pl-10 h-11 rounded-xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs uppercase"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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

            {/* CONTROL DE PESTAÑAS PRINCIPAL */}
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
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente / Orden</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Capture</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Monto</th>
                                        <th className="p-5 text-[9px] font-black uppercase tracking-widest text-slate-400 w-[200px]">
                                            {isEditMode ? "Asignar Billetera" : "Billetera"}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {ingresosData.map((pago) => (
                                        <tr key={pago.uniqueId} className="group hover:bg-emerald-50/30 transition-colors">
                                            <td className="p-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{format(pago.dateObj, 'dd/MM/yyyy')}</span>
                                                    <span className="text-[9px] text-slate-400">{format(pago.dateObj, 'hh:mm a')}</span>
                                                </div>
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
                                                    <Button variant="ghost" size="sm" onClick={() => setPreviewImage(pago.imagenUrl)} className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600 hover:scale-110 transition-transform"><Eye className="w-4 h-4"/></Button>
                                                ) : <span className="text-slate-200"><ImageIcon className="w-4 h-4 mx-auto"/></span>}
                                            </td>
                                            <td className="p-5 text-right">
                                                <Badge className="bg-emerald-100 text-emerald-700 font-black text-sm border-none shadow-sm">{formatCurrency(pago.monto)}</Badge>
                                            </td>
                                            <td className="p-5">
                                                {isEditMode ? (
                                                    updatingId === pago.uniqueId ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Guardando...</span>
                                                    ) : (
                                                        <Select defaultValue={pago.metodo} onValueChange={(val) => handleUpdateIncomeMethod(pago, val)}>
                                                            <SelectTrigger className="h-9 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {PAYMENT_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )
                                                ) : (
                                                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{pago.metodo}</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {ingresosData.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">No hay ingresos registrados en este periodo</td></tr>}
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

                        <TabsContent value="insumos">
                            <AuditTable data={egresosInsumos} color="blue" onUpdate={handleUpdateExpenseMethod} updatingId={updatingId} isEditMode={isEditMode} />
                        </TabsContent>
                        <TabsContent value="fijos">
                            <AuditTable data={egresosFijos} color="orange" onUpdate={handleUpdateExpenseMethod} updatingId={updatingId} isEditMode={isEditMode} />
                        </TabsContent>
                        <TabsContent value="nomina">
                            <AuditTable data={egresosNomina} color="indigo" onUpdate={handleUpdateExpenseMethod} updatingId={updatingId} isEditMode={isEditMode} />
                        </TabsContent>
                        <TabsContent value="diseno">
                            <AuditTable data={egresosDiseno} color="purple" onUpdate={handleUpdateExpenseMethod} updatingId={updatingId} isEditMode={isEditMode} />
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>

            {/* MODAL IMAGEN */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center pointer-events-none">
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {previewImage && (
                                <a href={previewImage} target="_blank" rel="noreferrer" className="p-3 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-md">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>
                        {previewImage && <img src={previewImage} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white" />}
                    </div>
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

function AuditTable({ data, color, onUpdate, updatingId, isEditMode }: any) {
    const total = data.reduce((sum: number, item: any) => sum + item.monto, 0);
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        orange: "text-orange-600 bg-orange-50 border-orange-100",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        purple: "text-purple-600 bg-purple-50 border-purple-100"
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3 p-6 rounded-[2.5rem] border-none bg-white dark:bg-[#1c1c1e] shadow-xl overflow-hidden">
                <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white dark:bg-[#1c1c1e] z-10">
                            <tr>
                                <th className="p-4 text-[9px] font-black uppercase text-slate-400">Fecha</th>
                                <th className="p-4 text-[9px] font-black uppercase text-slate-400">Beneficiario / Concepto</th>
                                <th className="p-4 text-[9px] font-black uppercase text-slate-400 text-right">Monto</th>
                                <th className="p-4 text-[9px] font-black uppercase text-slate-400 w-[200px]">
                                    {isEditMode ? "Asignar Billetera" : "Billetera"}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {data.length > 0 ? data.map((item: any, idx: number) => (
                                <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {item.fecha ? new Date(item.fecha).toLocaleDateString('es-VE') : '---'}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                {item.fecha ? new Date(item.fecha).getFullYear() : ''}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate max-w-[200px]">{item.beneficiario}</p>
                                        <p className="text-[9px] font-semibold text-slate-500 truncate max-w-[200px]">{item.concepto}</p>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-sm font-black text-slate-900 dark:text-white">${item.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </td>
                                    <td className="p-4">
                                        {/* CONDICIONAL MODO EDICIÓN */}
                                        {isEditMode ? (
                                            updatingId === item.id ? (
                                                <span className="text-[9px] font-bold text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Actualizando...</span>
                                            ) : (
                                                <Select defaultValue={item.metodo} onValueChange={(val) => onUpdate(item, val, item.type)}>
                                                    <SelectTrigger className="h-8 rounded-lg border-0 font-bold text-[9px] uppercase bg-slate-100 dark:bg-white/10"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {PAYMENT_OPTIONS.map((opt) => (
                                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )
                                        ) : (
                                            <Badge variant="outline" className="text-[9px] uppercase font-bold text-slate-500">{item.metodo}</Badge>
                                        )}
                                    </td>
                                </tr>
                            )) : <tr><td colSpan={4} className="p-10 text-center text-slate-400 text-xs font-bold uppercase">Sin movimientos</td></tr>}
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