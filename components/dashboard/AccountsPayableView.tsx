// @/components/dashboard/AccountsPayableView.tsx
"use client"

import React, { useState, useMemo, useEffect } from 'react'
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
    Building2, Plus, Search, Wallet, Landmark, 
    Calendar, Filter, CreditCard, ArrowUpRight, 
    ShoppingCart, Hammer, Home, TrendingUp, 
    Loader2, Repeat, Zap, Globe, HardDrive, 
    FileText, Coins, ArrowRightLeft
} from "lucide-react"

import { cn } from "@/lib/utils"

// --- DEFINICIÓN DE TIPOS ---
export type GastoType = 'FIJO' | 'VARIABLE';
export type CategoryType = 'Produccion' | 'Viveres' | 'Alquiler' | 'ServiciosPublicos' | 'Software' | 'Mantenimiento' | 'Impuestos';

export interface Gasto {
    id: string;
    proveedor: string;
    descripcion: string;
    monto: number; // Siempre se guarda en USD para consistencia
    montoBs?: number;
    fecha: string;
    categoria: CategoryType;
    tipo: GastoType;
    estado: 'PENDIENTE' | 'PAGADO';
}

interface AccountsPayableProps {
    gastos?: Gasto[];
    bcvRate: number;
    onAddGasto: (data: Omit<Gasto, 'id'>) => Promise<void>;
}

export function AccountsPayableView({ gastos = [], bcvRate, onAddGasto }: AccountsPayableProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currencyMode, setCurrencyMode] = useState<'USD' | 'BS'>('USD');

    // ✨ ESTADO DEL FORMULARIO CON CONVERSIÓN DINÁMICA
    const [formData, setFormData] = useState({
        tipo: 'VARIABLE' as GastoType,
        proveedor: "",
        descripcion: "",
        monto: "", // USD
        montoBs: "", // BS
        categoria: 'Produccion' as CategoryType,
        fecha: new Date().toISOString().split('T')[0]
    });

    // ✨ Efecto para convertir montos automáticamente
    const handleAmountChange = (val: string, type: 'USD' | 'BS') => {
        if (type === 'USD') {
            const bs = val ? (parseFloat(val) * bcvRate).toFixed(2) : "";
            setFormData(prev => ({ ...prev, monto: val, montoBs: bs }));
        } else {
            const usd = val ? (parseFloat(val) / bcvRate).toFixed(2) : "";
            setFormData(prev => ({ ...prev, montoBs: val, monto: usd }));
        }
    };

    const fixedServices = [
        { id: 'alquiler', label: 'Alquiler del Local', cat: 'Alquiler', prov: 'Inmobiliaria SMR' },
        { id: 'internet', label: 'Internet Fibra', cat: 'ServiciosPublicos', prov: 'Proveedor Local' },
        { id: 'adobe', label: 'Adobe Creative Cloud', cat: 'Software', prov: 'Adobe Systems' },
        { id: 'seniat', label: 'Impuestos SENIAT', cat: 'Impuestos', prov: 'SENIAT' },
        { id: 'alcaldia', label: 'Impuestos Municipales', cat: 'Impuestos', prov: 'Alcaldía' },
    ];

    const handleSelectFixed = (val: string) => {
        const service = fixedServices.find(s => s.id === val);
        if (service) {
            setFormData({
                ...formData,
                proveedor: service.prov,
                descripcion: service.label,
                categoria: service.cat as CategoryType
            });
        }
    };

    const handleRegister = async () => {
        if (!formData.proveedor || !formData.monto) return;
        setIsSubmitting(true);
        try {
            await onAddGasto({
                ...formData,
                monto: parseFloat(formData.monto),
                montoBs: parseFloat(formData.montoBs),
                estado: 'PAGADO'
            });
            setIsAddModalOpen(false);
            setFormData({ tipo: 'VARIABLE', proveedor: "", descripcion: "", monto: "", montoBs: "", categoria: 'Produccion', fecha: new Date().toISOString().split('T')[0] });
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredGastos = useMemo(() => {
        return gastos.filter(g => 
            g.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) || 
            g.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    }, [gastos, searchTerm]);

    const totals = useMemo(() => {
        return filteredGastos.reduce((acc, curr) => {
            if (curr.tipo === 'FIJO') acc.fijos += curr.monto;
            else acc.variables += curr.monto;
            acc.total += curr.monto;
            return acc;
        }, { fijos: 0, variables: 0, total: 0 });
    }, [filteredGastos]);

    return (
        <div className="space-y-4 lg:space-y-6 pb-10">
            
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-3xl lg:rounded-[2rem] border shadow-sm">
                <div>
                    <h1 className="text-xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-2 lg:gap-3">
                        <Building2 className="w-6 h-6 lg:w-8 h-8 text-amber-600" /> Cuentas por Pagar
                    </h1>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1 px-1">Control de Egresos SMR</p>
                </div>
                <Button onClick={() => setIsAddModalOpen(true)} className="w-full lg:w-auto bg-amber-600 hover:bg-amber-700 text-white rounded-xl lg:rounded-2xl h-11 lg:h-12 px-6 font-bold shadow-lg shadow-amber-500/20 gap-2">
                    <Plus className="w-5 h-5" /> Registrar Gasto
                </Button>
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Gastos Fijos" value={`$${totals.fijos.toFixed(2)}`} icon={<Repeat />} color="blue" />
                <StatCard label="Gastos Variables" value={`$${totals.variables.toFixed(2)}`} icon={<Zap />} color="orange" />
                <div className="col-span-2 lg:col-span-1">
                    <StatCard label="Total USD" value={`$${totals.total.toFixed(2)}`} icon={<TrendingUp />} color="emerald" primary />
                </div>
            </div>

            <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row justify-between gap-4">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar..." className="pl-10 rounded-xl border-none bg-slate-100 dark:bg-slate-800 h-11 font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-500">Tasa BCV: {bcvRate.toFixed(2)}</div>
                    </div>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50 h-14">
                        <TableRow className="border-none">
                            <TableHead className="px-6 font-black text-[10px] uppercase tracking-widest text-slate-500">Proveedor / Motivo</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest text-center text-slate-500">Categoría</TableHead>
                            <TableHead className="text-right font-black text-[10px] uppercase tracking-widest px-6 text-slate-500">Monto Final</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredGastos.map((g) => (
                            <TableRow key={g.id} className="h-20 border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-6">
                                    <div className="flex items-center gap-2">
                                        {g.tipo === 'FIJO' ? <Repeat className="w-3 h-3 text-blue-500" /> : <Zap className="w-3 h-3 text-orange-500" />}
                                        <div className="font-black text-slate-900 dark:text-white text-xs lg:text-sm uppercase tracking-tighter">{g.proveedor}</div>
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-1 ml-5">{g.descripcion}</div>
                                </TableCell>
                                <TableCell><CategoryBadge category={g.categoria} /></TableCell>
                                <TableCell className="text-right px-6">
                                    <div className="font-black text-slate-900 dark:text-white text-sm lg:text-lg">${g.monto.toFixed(2)}</div>
                                    <div className="text-[10px] font-black text-amber-600">Bs. {(g.monto * bcvRate).toLocaleString()}</div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 bg-white dark:bg-slate-950 border-none shadow-2xl w-[95vw]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 text-amber-600 leading-none">
                            <ArrowUpRight className="w-8 h-8"/> Registro de Egreso
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-5 py-4">
                        {/* Selector de Tipo */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Tipo de Gasto</Label>
                            <Tabs value={formData.tipo} onValueChange={(v: any) => setFormData({...formData, tipo: v})} className="w-full">
                                <TabsList className="grid grid-cols-2 w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                                    <TabsTrigger value="VARIABLE" className="rounded-lg font-black text-[10px] uppercase data-[state=active]:bg-white data-[state=active]:text-orange-600 transition-all">Variable</TabsTrigger>
                                    <TabsTrigger value="FIJO" className="rounded-lg font-black text-[10px] uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600 transition-all">Fijo</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <AnimatePresence mode="wait">
                            {formData.tipo === 'FIJO' ? (
                                <motion.div key="fijo" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Servicio Mensual / Impuestos</Label>
                                        <Select onValueChange={handleSelectFixed}>
                                            <SelectTrigger className="rounded-xl bg-slate-100 dark:bg-slate-800 border-none h-12 font-bold"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                            <SelectContent className="rounded-xl font-bold border-none shadow-2xl">
                                                {fixedServices.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div key="variable" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                    <Input value={formData.proveedor} onChange={(e) => setFormData({...formData, proveedor: e.target.value})} className="rounded-xl bg-slate-100 dark:bg-slate-800 border-none h-12 font-bold" placeholder="Proveedor" />
                                    <Input value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="rounded-xl bg-slate-100 dark:bg-slate-800 border-none h-12 font-bold" placeholder="Descripción" />
                                    <Select value={formData.categoria} onValueChange={(v: any) => setFormData({...formData, categoria: v})}>
                                        <SelectTrigger className="rounded-xl bg-slate-100 dark:bg-slate-800 border-none h-12 font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-xl font-bold">
                                            <SelectItem value="Produccion">Producción</SelectItem>
                                            <SelectItem value="Viveres">Víveres</SelectItem>
                                            <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                                            <SelectItem value="Impuestos">Impuestos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ✨ SECCIÓN DE MONTOS BI-MONETARIA ✨ */}
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-3xl space-y-4 border border-slate-100 dark:border-slate-800 shadow-inner">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Ingreso de Monto</Label>
                                <Tabs value={currencyMode} onValueChange={(v: any) => setCurrencyMode(v)} className="h-8">
                                    <TabsList className="bg-slate-200 dark:bg-slate-800 h-8 rounded-lg">
                                        <TabsTrigger value="USD" className="text-[9px] font-black h-6">USD</TabsTrigger>
                                        <TabsTrigger value="BS" className="text-[9px] font-black h-6">BS</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3">
                                {currencyMode === 'USD' ? (
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-amber-600 text-lg">$</span>
                                            <Input 
                                                type="number" 
                                                value={formData.monto} 
                                                onChange={(e) => handleAmountChange(e.target.value, 'USD')}
                                                className="pl-8 rounded-xl bg-white dark:bg-slate-800 border-none h-12 font-black text-amber-600 text-xl" 
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 ml-2 italic">Equivale a: Bs. {formData.montoBs || "0.00"}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600 text-lg">Bs</span>
                                            <Input 
                                                type="number" 
                                                value={formData.montoBs} 
                                                onChange={(e) => handleAmountChange(e.target.value, 'BS')}
                                                className="pl-12 rounded-xl bg-white dark:bg-slate-800 border-none h-12 font-black text-blue-600 text-xl" 
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 ml-2 italic">Equivale a: $ {formData.monto || "0.00"}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha</Label>
                            <Input type="date" value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="rounded-xl bg-slate-100 dark:bg-slate-800 border-none h-12 font-bold text-sm" />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleRegister} disabled={isSubmitting || !formData.monto} className="w-full h-16 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Guardar Registro"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CategoryBadge({ category }: { category: CategoryType }) {
    const config = {
        Produccion: { label: 'Producción', class: 'bg-orange-50 text-orange-600 border-orange-100', icon: <Hammer className="w-2.5 h-2.5" /> },
        Viveres: { label: 'Víveres', class: 'bg-blue-50 text-blue-600 border-blue-100', icon: <ShoppingCart className="w-2.5 h-2.5" /> },
        Alquiler: { label: 'Alquiler', class: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Home className="w-2.5 h-2.5" /> },
        ServiciosPublicos: { label: 'Servicios', class: 'bg-purple-50 text-purple-600 border-purple-100', icon: <Globe className="w-2.5 h-2.5" /> },
        Software: { label: 'Software', class: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: <HardDrive className="w-2.5 h-2.5" /> },
        Mantenimiento: { label: 'Mantenimiento', class: 'bg-red-50 text-red-600 border-red-100', icon: <Hammer className="w-2.5 h-2.5" /> },
        Impuestos: { label: 'Impuestos', class: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <FileText className="w-2.5 h-2.5" /> }
    };
    const c = config[category] || config['Produccion'];
    return (
        <Badge variant="outline" className={cn("font-black text-[8px] uppercase rounded-lg px-2 py-0.5 border flex items-center gap-1 w-fit mx-auto", c.class)}>
            {c.icon} {c.label}
        </Badge>
    );
}

function StatCard({ label, value, icon, color, primary }: any) {
    const variants: any = { 
        blue: "bg-blue-50 text-blue-600", 
        orange: "bg-orange-50 text-orange-600",
        emerald: "bg-emerald-50 text-emerald-600"
    };
    return (
        <Card className={cn(
            "border-none shadow-sm rounded-2xl lg:rounded-[2rem] p-4 lg:p-6 flex items-center gap-4 transition-all hover:scale-[1.02]",
            primary ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xl shadow-slate-200" : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
        )}>
            <div className={cn("p-3 lg:p-4 rounded-xl lg:rounded-2xl shrink-0", variants[color])}>
                {React.cloneElement(icon, { className: "w-5 h-5 lg:w-6 h-6" })}
            </div>
            <div className="min-w-0">
                <p className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <h3 className="text-lg lg:text-2xl font-black tracking-tighter truncate">{value}</h3>
            </div>
        </Card>
    );
}