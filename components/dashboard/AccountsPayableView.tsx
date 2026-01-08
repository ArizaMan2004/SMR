// @/components/dashboard/SMR_Finance_v3.tsx
"use client"

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from "framer-motion"

// UI Components - Shadcn
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Iconos - Lucide
import { 
    Plus, Search, Repeat, Zap, Trash2, Edit3, Bell, 
    Package, UserCircle, DollarSign, CheckCircle2, 
    Clock, AlertTriangle, Wallet, ArrowUpRight
} from "lucide-react"

import { cn } from "@/lib/utils"

// --- TIPOS ---
export type GastoType = 'FIJO' | 'VARIABLE' | 'NOMINA';
export type CategoryType = 'Insumos' | 'Materiales' | 'Servicios' | 'Nomina' | 'Impuestos';

export interface Registro {
    id: string;
    beneficiario: string; // Proveedor o Nombre de Empleado
    descripcion: string;
    monto: number;
    montoBs: number;
    fecha: string;
    categoria: CategoryType;
    tipo: GastoType;
    diaRecordatorio: number;
    estado: 'PENDIENTE' | 'PAGADO';
}

interface Props {
    bcvRate: number;
    initialData?: Registro[];
}

export function AccountsPayableView({ bcvRate, initialData = [] }: Props) {
    const [registros, setRegistros] = useState<Registro[]>(initialData);
    const [isMainModalOpen, setIsMainModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<Registro | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Formulario Base
    const [formData, setFormData] = useState<Omit<Registro, 'id'>>({
        beneficiario: "", descripcion: "", monto: 0, montoBs: 0,
        fecha: new Date().toISOString().split('T')[0],
        categoria: 'Insumos', tipo: 'VARIABLE', diaRecordatorio: 1, estado: 'PAGADO'
    });

    // Formulario de Pago (Manual)
    const [payAmount, setPayAmount] = useState({ usd: "", bs: "" });

    // --- LÓGICA DE RECORDATORIOS (Nómina y Fijos) ---
    const reminders = useMemo(() => {
        const today = new Date().getDate();
        return registros.filter(r => {
            if (r.estado === 'PAGADO') return false;
            const diff = r.diaRecordatorio - today;
            return (diff >= 0 && diff <= 5) || today > r.diaRecordatorio;
        });
    }, [registros]);

    // --- MANEJO DE PRECIOS ---
    const handleAmountUpdate = (val: string, source: 'USD' | 'BS', target: 'FORM' | 'PAY') => {
        const num = parseFloat(val) || 0;
        const converted = source === 'USD' ? (num * bcvRate).toFixed(2) : (num / bcvRate).toFixed(2);
        
        if (target === 'FORM') {
            setFormData(prev => ({
                ...prev,
                monto: source === 'USD' ? num : parseFloat(converted),
                montoBs: source === 'BS' ? num : parseFloat(converted)
            }));
        } else {
            setPayAmount({
                usd: source === 'USD' ? val : converted.toString(),
                bs: source === 'BS' ? val : converted.toString()
            });
        }
    };

    // --- ACCIONES ---
    const saveNewRecord = () => {
        const newRecord: Registro = { 
            ...formData, 
            id: Math.random().toString(36).substr(2, 9),
            // Si es Nómina, forzamos estado Pendiente para que el recordatorio funcione
            estado: formData.tipo === 'NOMINA' ? 'PENDIENTE' : formData.estado 
        };
        setRegistros(prev => [newRecord, ...prev]);
        setIsMainModalOpen(false);
        resetForm();
    };

    const processPayment = () => {
        if (!selectedRecord) return;
        setRegistros(prev => prev.map(r => 
            r.id === selectedRecord.id 
                ? { ...r, estado: 'PAGADO', monto: parseFloat(payAmount.usd), montoBs: parseFloat(payAmount.bs), fecha: new Date().toISOString().split('T')[0] } 
                : r
        ));
        setIsPayModalOpen(false);
        setSelectedRecord(null);
    };

    const resetForm = () => {
        setFormData({ beneficiario: "", descripcion: "", monto: 0, montoBs: 0, fecha: new Date().toISOString().split('T')[0], categoria: 'Insumos', tipo: 'VARIABLE', diaRecordatorio: 1, estado: 'PAGADO' });
    };

    return (
        <div className="max-w-7xl mx-auto p-4 lg:p-10 space-y-8">
            
            {/* CABECERA */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-slate-900 dark:text-white">
                        SMR <span className="text-amber-600">Payroll & Expenses</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Gestión Integral de Nómina y Egresos</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl flex flex-col justify-center">
                        <span className="text-[8px] font-black text-slate-500 uppercase">Tasa del día</span>
                        <span className="font-black text-sm text-slate-900 dark:text-white">${bcvRate}</span>
                    </div>
                    <Button onClick={() => setIsMainModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 h-14 px-8 rounded-2xl font-black uppercase italic tracking-widest text-white shadow-lg transition-transform active:scale-95">
                        <Plus className="mr-2" /> Registrar Nuevo
                    </Button>
                </div>
            </header>

            {/* RECORDATORIOS INTELIGENTES */}
            <AnimatePresence>
                {reminders.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reminders.map(r => (
                            <div key={r.id} className="bg-amber-500 text-white p-5 rounded-3xl shadow-xl flex items-center justify-between border-b-4 border-amber-700">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 p-2 rounded-xl"><Bell className="w-5 h-5 animate-bounce" /></div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase opacity-80">Por Pagar (Día {r.diaRecordatorio})</p>
                                        <h4 className="font-black uppercase italic text-sm">{r.beneficiario}</h4>
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => { setSelectedRecord(r); setIsPayModalOpen(true); }}
                                    className="bg-white text-amber-600 hover:bg-slate-100 font-black uppercase text-[10px] px-4 rounded-xl h-10"
                                >
                                    Pagar Ahora
                                </Button>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TABLA DE OPERACIONES */}
            <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row justify-between gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar pago, empleado o insumo..." 
                            className="pl-14 h-14 rounded-2xl border-none bg-slate-100 dark:bg-slate-800 font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Tabs defaultValue="TODO" className="w-full md:w-auto">
                        <TabsList className="bg-slate-100 dark:bg-slate-800 h-14 p-1 rounded-2xl">
                            <TabsTrigger value="TODO" className="rounded-xl px-6 font-black text-[10px] uppercase">Todo</TabsTrigger>
                            <TabsTrigger value="NOMINA" className="rounded-xl px-6 font-black text-[10px] uppercase">Nómina</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
                            <TableRow className="h-16 border-none">
                                <TableHead className="px-10 font-black text-[10px] uppercase text-slate-400 tracking-widest">Identificación</TableHead>
                                <TableHead className="font-black text-[10px] uppercase text-slate-400 text-center">Tipo</TableHead>
                                <TableHead className="font-black text-[10px] uppercase text-slate-400 text-right">Monto</TableHead>
                                <TableHead className="font-black text-[10px] uppercase text-slate-400 text-right px-10">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registros.filter(r => r.beneficiario.toLowerCase().includes(searchTerm.toLowerCase())).map((r) => (
                                <TableRow key={r.id} className="h-28 border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 transition-all">
                                    <TableCell className="px-10">
                                        <div className="flex items-center gap-4">
                                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", 
                                                r.tipo === 'NOMINA' ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                                            )}>
                                                {r.tipo === 'NOMINA' ? <UserCircle className="w-7 h-7" /> : <Package className="w-7 h-7" />}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white uppercase italic text-lg leading-none">{r.beneficiario}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{r.descripcion}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge className="bg-slate-900 dark:bg-white dark:text-slate-900 font-black text-[9px] uppercase px-3 rounded-lg">{r.categoria}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="font-black text-2xl text-slate-900 dark:text-white leading-none">${r.monto.toFixed(2)}</div>
                                        <div className="text-[11px] font-black text-amber-600 uppercase">Bs. {r.montoBs.toLocaleString()}</div>
                                    </TableCell>
                                    <TableCell className="px-10 text-right">
                                        {r.estado === 'PAGADO' ? (
                                            <div className="flex items-center justify-end gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                                                <CheckCircle2 className="w-4 h-4" /> Pagado
                                            </div>
                                        ) : (
                                            <Button 
                                                onClick={() => { setSelectedRecord(r); setIsPayModalOpen(true); }}
                                                className="bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-amber-600 hover:text-white h-10 px-4 rounded-xl font-black text-[9px] uppercase transition-all"
                                            >
                                                Procesar Pago
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* MODAL: REGISTRO INICIAL */}
            <Dialog open={isMainModalOpen} onOpenChange={setIsMainModalOpen}>
                <DialogContent className="max-w-md rounded-[3rem] p-10 bg-white dark:bg-slate-950 border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-amber-600 leading-none">Configurar Registro</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <Tabs value={formData.tipo} onValueChange={(v: any) => setFormData({...formData, tipo: v, categoria: v === 'NOMINA' ? 'Nomina' : 'Insumos'})}>
                            <TabsList className="grid grid-cols-2 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1">
                                <TabsTrigger value="VARIABLE" className="rounded-xl font-black text-[10px] uppercase">Gasto Gral</TabsTrigger>
                                <TabsTrigger value="NOMINA" className="rounded-xl font-black text-[10px] uppercase">Empleado</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">{formData.tipo === 'NOMINA' ? "Nombre del Empleado" : "Beneficiario / Tienda"}</Label>
                                <Input value={formData.beneficiario} onChange={(e) => setFormData({...formData, beneficiario: e.target.value})} className="h-12 rounded-xl border-none bg-slate-100 dark:bg-slate-800 font-bold" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Categoría</Label>
                                    <Select value={formData.categoria} onValueChange={(v: any) => setFormData({...formData, categoria: v})}>
                                        <SelectTrigger className="h-12 border-none bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent className="font-bold rounded-xl">
                                            <SelectItem value="Insumos">Insumos</SelectItem>
                                            <SelectItem value="Nomina">Nómina</SelectItem>
                                            <SelectItem value="Servicios">Servicios</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Día Recordatorio</Label>
                                    <Input type="number" value={formData.diaRecordatorio} onChange={(e) => setFormData({...formData, diaRecordatorio: parseInt(e.target.value)})} className="h-12 rounded-xl border-none bg-slate-100 dark:bg-slate-800 font-bold" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={saveNewRecord} className="w-full h-16 bg-slate-900 dark:bg-white dark:text-slate-900 rounded-2xl font-black uppercase text-lg tracking-widest italic">Confirmar Alta</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: PROCESAR PAGO (MONTO MANUAL) */}
            <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
                <DialogContent className="max-w-sm rounded-[3rem] p-10 bg-slate-900 text-white border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-amber-500 leading-none">Confirmar Pago</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6">
                        <div className="text-center space-y-1">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pagando a:</p>
                            <h2 className="text-3xl font-black uppercase italic leading-none">{selectedRecord?.beneficiario}</h2>
                        </div>

                        <div className="space-y-4 bg-slate-800 p-6 rounded-[2rem] border border-slate-700">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-slate-500">Monto Final USD</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-0 top-1/2 -translate-y-1/2 text-amber-500" />
                                    <Input 
                                        type="number" 
                                        placeholder="0.00" 
                                        value={payAmount.usd}
                                        onChange={(e) => handleAmountUpdate(e.target.value, 'USD', 'PAY')}
                                        className="bg-transparent border-none text-3xl font-black p-0 pl-7 h-auto focus-visible:ring-0 text-white" 
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-500">BOLÍVARES:</span>
                                <span className="font-black text-amber-500 text-lg">Bs. {parseFloat(payAmount.bs).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-3">
                        <Button onClick={processPayment} className="w-full h-16 bg-amber-600 hover:bg-amber-700 rounded-2xl font-black uppercase text-lg italic tracking-widest">Marcar como Pagado</Button>
                        <Button variant="ghost" onClick={() => setIsPayModalOpen(false)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cancelar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}