"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Package, Plus, Minus, Search, ArrowUpRight, ArrowDownLeft, 
    Box, History, MoreHorizontal, AlertTriangle, DollarSign
} from "lucide-react"

// Importaciones de servicios
import { 
    subscribeToInventory, 
    subscribeToMovements, 
    createInventoryItem,
    registerMovement 
} from "@/lib/services/inventory-service"

// UI Components (Shadcn)
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 400, damping: 30 };

// --- FUNCIÓN AUXILIAR DE FORMATEO DE FECHA ---
const formatFecha = (fecha: any) => {
    if (!fecha) return "---";
    
    // Si es un Timestamp de Firebase (tiene la función toDate)
    if (fecha && typeof fecha.toDate === 'function') {
        return fecha.toDate().toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
    
    // Si ya es un objeto Date de JS
    if (fecha instanceof Date) {
        return fecha.toLocaleString('es-VE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    return "Fecha inválida";
};

export default function InventoryView() {
    const [activeTab, setActiveTab] = useState<'stock' | 'in' | 'out'>('stock');
    const [items, setItems] = useState<any[]>([]);
    const [movements, setMovements] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        const unsubInv = subscribeToInventory(setItems);
        const unsubMov = subscribeToMovements(setMovements);
        return () => { unsubInv(); unsubMov(); };
    }, []);

    const filteredItems = useMemo(() => 
        items.filter(i => i.nombre?.toLowerCase().includes(searchTerm.toLowerCase())), 
    [items, searchTerm]);

    const stats = useMemo(() => ({
        totalItems: items.length,
        lowStock: items.filter(i => i.stockActual <= (i.minimo || 5)).length,
        totalValue: items.reduce((acc, i) => acc + (i.stockActual * (i.precio || 0)), 0)
    }), [items]);

    return (
        <div className="min-h-screen bg-[#f2f2f7] dark:bg-black p-4 md:p-8 font-sans antialiased text-slate-900 dark:text-white">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* HEADER */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-4xl font-black tracking-tight italic uppercase">Inventario</h1>
                        <p className="text-slate-500 font-bold text-[10px] tracking-widest opacity-60">SMR / CONTROL DE EXISTENCIAS</p>
                    </motion.div>

                    <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                        <DialogTrigger asChild>
                            <Button className="h-14 rounded-[1.8rem] bg-blue-600 hover:bg-blue-700 text-white font-black px-8 shadow-xl shadow-blue-500/20 gap-3 active:scale-95 transition-all">
                                <Plus className="w-6 h-6" /> NUEVO PRODUCTO
                            </Button>
                        </DialogTrigger>
                        <AddProductModal onClose={() => setIsAddModalOpen(false)} />
                    </Dialog>
                </header>

                {/* STATS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Artículos" value={stats.totalItems} icon={<Box />} color="blue" />
                    <StatCard label="Stock Bajo" value={stats.lowStock} icon={<AlertTriangle />} color="orange" isAlert={stats.lowStock > 0} />
                    <StatCard label="Valor Total" value={`$${stats.totalValue.toFixed(2)}`} icon={<DollarSign />} color="emerald" />
                </div>

                {/* CONTROLES */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/40 dark:bg-white/5 p-4 rounded-[2.5rem] backdrop-blur-md border border-black/5">
                    <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-[1.8rem] w-full md:w-fit">
                        <TabNav active={activeTab === 'stock'} onClick={() => setActiveTab('stock')} label="Existencias" icon={<Package />} />
                        <TabNav active={activeTab === 'in'} onClick={() => setActiveTab('in')} label="Entradas" icon={<ArrowUpRight />} />
                        <TabNav active={activeTab === 'out'} onClick={() => setActiveTab('out')} label="Salidas" icon={<ArrowDownLeft />} />
                    </div>

                    <div className="relative w-full md:max-w-xs group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                        <input 
                            placeholder="Buscar producto..." 
                            className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-black/20 border-none rounded-full shadow-inner outline-none focus:ring-2 ring-blue-500/20 transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* TABLAS */}
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeTab}
                        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
                        transition={springConfig}
                        className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] shadow-2xl shadow-black/[0.03] border border-black/5 overflow-hidden"
                    >
                        {activeTab === 'stock' && <StockTable items={filteredItems} />}
                        {activeTab === 'in' && <MovementTable data={movements.filter(m => m.tipo === 'ENTRADA')} color="emerald" />}
                        {activeTab === 'out' && <MovementTable data={movements.filter(m => m.tipo === 'SALIDA')} color="red" />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}

function StockTable({ items }: { items: any[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-white/[0.02]">
                    <tr className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        <th className="px-8 py-6">Producto / Detalle</th>
                        <th className="px-8 py-6 text-center">Existencia</th>
                        <th className="px-8 py-6 text-right">Precio</th>
                        <th className="px-8 py-6 text-right">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                    {items.map(item => (
                        <tr key={item.id} className="hover:bg-blue-500/[0.01] transition-colors">
                            <td className="px-8 py-6">
                                <p className="font-bold text-lg">{item.nombre}</p>
                                <p className="text-xs opacity-40 font-medium italic">{item.detalle || 'Sin descripción'}</p>
                            </td>
                            <td className="px-8 py-6 text-center">
                                <span className={cn(
                                    "px-4 py-1.5 rounded-full font-black text-xs inline-flex items-center gap-2",
                                    item.stockActual <= (item.minimo || 5) ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                                )}>
                                    {item.stockActual} {item.unidad || 'UND'}
                                </span>
                            </td>
                            <td className="px-8 py-6 text-right font-black text-blue-600">${Number(item.precio).toFixed(2)}</td>
                            <td className="px-8 py-6">
                                <div className="flex justify-end gap-2">
                                    <QuickAction item={item} type="ENTRADA" />
                                    <QuickAction item={item} type="SALIDA" />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function MovementTable({ data, color }: { data: any[], color: 'emerald' | 'red' }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-white/[0.02]">
                    <tr className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        <th className="px-8 py-6">Fecha y Hora</th>
                        <th className="px-8 py-6">Producto</th>
                        <th className="px-8 py-6">Motivo</th>
                        <th className="px-8 py-6 text-right">Cantidad</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                    {data.map(m => (
                        <tr key={m.id}>
                            {/* AQUÍ SE USA LA FUNCIÓN DE FORMATEO */}
                            <td className="px-8 py-6 text-[11px] font-bold opacity-60">
                                {formatFecha(m.fecha)}
                            </td>
                            <td className="px-8 py-6 font-black">{m.productoNombre}</td>
                            <td className="px-8 py-6 text-xs italic opacity-50">{m.motivo}</td>
                            <td className={cn("px-8 py-6 text-right font-black text-lg", color === 'red' ? 'text-red-500' : 'text-emerald-500')}>
                                {color === 'red' ? '-' : '+'}{m.cantidad}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function QuickAction({ item, type }: { item: any, type: 'ENTRADA' | 'SALIDA' }) {
    const [open, setOpen] = useState(false);
    const [val, setVal] = useState({ qty: '', motivo: '', total: '' });

    const handleSave = async () => {
        if(!val.qty || !val.motivo) return toast.error("Completa los campos");
        try {
            await registerMovement({
                productoId: item.id,
                productoNombre: item.nombre,
                tipo: type,
                cantidad: Number(val.qty),
                motivo: val.motivo,
                montoTotalUSD: Number(val.total) || 0
            });
            toast.success("Movimiento registrado");
            setOpen(false);
        } catch (e: any) { toast.error(e.message); }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90",
                    type === 'ENTRADA' ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white" : "bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                )}>
                    {type === 'ENTRADA' ? <Plus size={18} /> : <Minus size={18} />}
                </button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-8 max-w-sm border-none shadow-2xl bg-[#f2f2f7] dark:bg-[#1c1c1e]">
                <DialogHeader><DialogTitle className="text-2xl font-black italic uppercase">Registrar {type}</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-6">
                    <p className="text-[10px] font-black uppercase opacity-40">Producto: {item.nombre}</p>
                    <Input type="number" placeholder="Cantidad" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setVal({...val, qty: e.target.value})} />
                    <Input placeholder="Motivo o Detalle" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setVal({...val, motivo: e.target.value})} />
                    <Input type="number" placeholder="Costo Total USD (Opcional)" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setVal({...val, total: e.target.value})} />
                    <Button onClick={handleSave} className={cn("w-full h-14 rounded-2xl font-black text-lg", type === 'ENTRADA' ? "bg-emerald-600" : "bg-red-600")}>
                        PROCESAR
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function AddProductModal({ onClose }: { onClose: () => void }) {
    const [form, setForm] = useState({ nombre: '', detalle: '', stockActual: '', precio: '', unidad: 'unidades', minimo: '5' });

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            await createInventoryItem(form);
            toast.success("Producto creado");
            onClose();
        } catch (error) { toast.error("Error al guardar"); }
    };

    return (
        <DialogContent className="rounded-[2.5rem] bg-[#f2f2f7] dark:bg-[#1c1c1e] p-10 max-w-md border-none shadow-2xl">
            <DialogHeader><DialogTitle className="text-3xl font-black italic uppercase tracking-tighter">Nuevo Artículo</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                <Input placeholder="Nombre del Producto" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setForm({...form, nombre: e.target.value})} required />
                <Input placeholder="Descripción corta" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setForm({...form, detalle: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                    <Input type="number" placeholder="Stock Inicial" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setForm({...form, stockActual: e.target.value})} required />
                    <Input type="number" placeholder="Mínimo Alerta" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setForm({...form, minimo: e.target.value})} />
                </div>
                <Input type="number" step="0.01" placeholder="Precio Unitario (USD)" className="h-14 rounded-2xl border-none bg-white dark:bg-white/5" onChange={e => setForm({...form, precio: e.target.value})} required />
                <Button type="submit" className="w-full h-16 rounded-2xl bg-blue-600 text-white font-black text-xl shadow-xl shadow-blue-500/20">REGISTRAR</Button>
            </form>
        </DialogContent>
    )
}

function StatCard({ label, value, icon, color, isAlert }: any) {
    const themes: any = { blue: "text-blue-600 bg-blue-500/10", orange: "text-orange-600 bg-orange-500/10", emerald: "text-emerald-600 bg-emerald-500/10" };
    return (
        <Card className={cn("rounded-[2.2rem] border-none shadow-sm bg-white dark:bg-white/5 overflow-hidden", isAlert && "ring-2 ring-red-500/30")}>
            <CardContent className="p-7 flex items-center gap-5">
                <div className={cn("p-4 rounded-3xl", themes[color])}>{React.cloneElement(icon, { className: "w-8 h-8" })}</div>
                <div>
                    <p className="text-[10px] font-black uppercase opacity-30 tracking-widest">{label}</p>
                    <p className="text-3xl font-black tracking-tighter leading-none">{value}</p>
                </div>
            </CardContent>
        </Card>
    )
}

function TabNav({ active, onClick, label, icon }: any) {
    return (
        <button onClick={onClick} className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black transition-all uppercase tracking-tighter",
            active ? "bg-white dark:bg-white/10 shadow-lg scale-100" : "opacity-40 hover:opacity-100 scale-95"
        )}>
            {React.cloneElement(icon, { size: 14 })} {label}
        </button>
    )
}