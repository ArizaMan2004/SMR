// @/components/dashboard/BudgetEntryView.tsx
"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'; 
import { motion, AnimatePresence } from "framer-motion"

// --- SERVICIOS ---
import { generateBudgetPDF } from "@/lib/services/pdf-generator";
import { 
    saveBudgetToFirestore, 
    loadBudgetsFromFirestore, 
    deleteBudgetFromFirestore 
} from "@/lib/firebase/firestore-budget-service";
import { createOrden } from "@/lib/services/ordenes-service";
import { getLastOrderNumber } from "@/lib/firebase/ordenes";

// --- UI COMPONENTS ---
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

// --- ICONOS ---
import { 
    Plus, Trash2, FileText, Save, Clock, Download, 
    User, Calculator, TrendingUp, Sparkles, Layers, Zap, Wallet, X,
    DollarSign, CheckCircle2, Calendar, Pencil, RotateCcw, Check
} from "lucide-react"; 

import { cn } from "@/lib/utils";

// --- CONSTANTES ---
const SMR_CATALOG = [
    "Impresión de Alta Resolución en Vinil Adhesivo ( )", 
    "Letras Corpóreas en Acrílico con Iluminación LED ( )",
    "Medallas en Acrílico Personalizadas ( )", 
    "Servicio de Diseño Gráfico Publicitario",
    "Corte Láser en MDF ( )",
    "Instalación de Vinil en Vidrieras"
];

export default function BudgetEntryView({
    currentBcvRate, pdfLogoBase64, firmaBase64, selloBase64,
    handleLogoUpload, handleClearLogo, handleFirmaUpload, 
    handleClearFirma, handleSelloUpload, handleClearSello,
    currentUserId
}: any) {
    
    // --- ESTADO INICIAL ---
    const initialBudgetState = { 
        id: null as string | null, 
        clienteNombre: '', 
        items: [] as any[],
        dateCreated: null as string | null 
    };

    const [budgetData, setBudgetData] = useState(initialBudgetState);
    const [newItem, setNewItem] = useState({ 
        id: null as number | null, 
        descripcion: '', 
        cantidad: 1, 
        precioUnitarioUSD: 0 
    });
    const [history, setHistory] = useState<any[]>([]); 
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

    // --- CÁLCULOS ---
    const totalUSD = useMemo(() => 
        budgetData.items.reduce((sum: number, i: any) => sum + i.totalUSD, 0), 
    [budgetData.items]);

    // --- CARGAR HISTORIAL (DEDUPLICADO POR ID) ---
    const fetchHistory = useCallback(async () => {
        try {
            const data = await loadBudgetsFromFirestore();
            if (data) {
                // Evitamos el error de keys duplicadas en React filtrando por ID único
                const uniqueEntries = Array.from(
                    new Map(data.map((item: any) => [item.id, item])).values()
                );
                setHistory(uniqueEntries);
            }
        } catch (e) { 
            console.error("Error al cargar historial:", e); 
        }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // --- LÓGICA DE ITEMS (AÑADIR / ACTUALIZAR) ---
    const handleAddOrUpdateItem = () => {
        const desc = newItem.descripcion.trim() || "Concepto General";
        const calculatedTotal = newItem.cantidad * newItem.precioUnitarioUSD;

        if (newItem.id) {
            // Actualizar item que ya está en la tabla (modo edición de item)
            setBudgetData((prev: any) => ({
                ...prev,
                items: prev.items.map((item: any) => 
                    item.id === newItem.id 
                    ? { ...newItem, descripcion: desc, totalUSD: calculatedTotal } 
                    : item
                )
            }));
            toast.success("Concepto actualizado");
        } else {
            // Añadir nuevo item a la tabla
            setBudgetData((prev: any) => ({ 
                ...prev, 
                items: [...prev.items, { ...newItem, descripcion: desc, id: Date.now(), totalUSD: calculatedTotal }] 
            }));
            toast.success("Concepto añadido");
        }

        setNewItem({ id: null, descripcion: '', cantidad: 1, precioUnitarioUSD: 0 });
        setShowSuggestions(false);
    };

    const handleEditItemRequest = (item: any) => {
        setNewItem({
            id: item.id,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitarioUSD: item.precioUnitarioUSD
        });
    };

    // --- LÓGICA DE GUARDADO (CREAR O ACTUALIZAR) ---
    const handleSaveDraft = async () => {
        if (!budgetData.clienteNombre) return toast.error("El nombre del cliente es obligatorio");
        if (budgetData.items.length === 0) return toast.error("La tabla está vacía");

        setIsLoading(true);
        try {
            // Separamos el ID para enviarlo solo si existe (evita error 'undefined' en Firestore)
            const { id, ...rest } = budgetData;
            const payload: any = {
                ...rest,
                totalUSD: totalUSD,
                dateCreated: budgetData.id ? budgetData.dateCreated : new Date().toISOString(),
                userId: currentUserId || "express"
            };

            if (id) payload.id = id;

            await saveBudgetToFirestore(payload);
            toast.success(id ? "Cambios actualizados" : "Borrador guardado");
            
            setBudgetData(initialBudgetState);
            await fetchHistory();
        } catch (error) {
            toast.error("Error al guardar en la base de datos");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- CONVERSIÓN A FACTURA (CON ELIMINACIÓN DEL PRESUPUESTO) ---
    const handleConvertToOrder = async (targetBudget?: any) => {
        const data = targetBudget || budgetData;
        if (data.items.length === 0) return toast.error("No hay conceptos para facturar");

        const confirmConversion = window.confirm(`¿Convertir presupuesto de ${data.clienteNombre} en factura real? (Se borrará del historial)`);
        if (!confirmConversion) return;

        setIsLoading(true);
        try {
            const lastNumber = await getLastOrderNumber();
            const nextNumber = lastNumber + 1;
            
            const orderPayload = {
                ordenNumero: nextNumber,
                fecha: new Date().toISOString(),
                fechaEntrega: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
                cliente: {
                    nombreRazonSocial: data.clienteNombre,
                    rifCedula: "EXPRESS",
                    telefono: "N/A",
                    domicilioFiscal: "N/A",
                    correo: ""
                },
                items: data.items.map((item: any) => ({
                    nombre: item.descripcion,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitarioUSD,
                    unidad: 'und',
                    tipoServicio: 'OTROS',
                    subtotal: item.totalUSD
                })),
                totalUSD: data.totalUSD || totalUSD,
                montoPagadoUSD: 0,
                estado: 'PENDIENTE',
                userId: currentUserId
            };

            // 1. Crear la orden de producción
            await createOrden(orderPayload);

            // 2. Eliminar el presupuesto original de Firestore
            if (data.id) {
                await deleteBudgetFromFirestore(data.id);
            }

            toast.success(`Orden #${nextNumber} creada con éxito.`);
            setBudgetData(initialBudgetState);
            await fetchHistory();
        } catch (e) {
            toast.error("Error al facturar.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditBudget = (entry: any) => {
        setBudgetData({
            id: entry.id,
            clienteNombre: entry.clienteNombre,
            items: entry.items || [],
            dateCreated: entry.dateCreated || null
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteBudget = async (id: string) => {
        if (!id) return;
        if (!window.confirm("¿Eliminar este presupuesto permanentemente?")) return;

        try {
            await deleteBudgetFromFirestore(id);
            toast.success("Presupuesto eliminado");
            await fetchHistory();
        } catch (error) {
            toast.error("Error al borrar el registro");
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
            
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-center bg-white/40 dark:bg-white/5 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/20 shadow-2xl gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <FileText className="text-white w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">Presupuestos</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mt-2 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" /> 
                            {budgetData.id ? "Editando Registro" : "Nuevo Documento"}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <AssetPill active={!!pdfLogoBase64} label="Logo" onUpload={handleLogoUpload} onClear={handleClearLogo} />
                    <AssetPill active={!!firmaBase64} label="Firma" onUpload={handleFirmaUpload} onClear={handleClearFirma} />
                    <AssetPill active={!!selloBase64} label="Sello" onUpload={handleSelloUpload} onClear={handleClearSello} />
                </div>
            </header>

            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total USD" value={`$${totalUSD.toFixed(2)}`} icon={<Wallet />} color="blue" />
                <StatCard label="Monto BS" value={`Bs. ${(totalUSD * currentBcvRate).toLocaleString()}`} icon={<Calculator />} color="emerald" />
                <StatCard label="Tasa BCV" value={currentBcvRate.toFixed(2)} icon={<TrendingUp />} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* CONSTRUCTOR */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="p-8 md:p-12 space-y-10">
                            
                            <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Datos del Cliente</Label>
                                {(budgetData.id || budgetData.items.length > 0) && (
                                    <Button variant="ghost" size="sm" onClick={() => setBudgetData(initialBudgetState)} className="text-[9px] font-black uppercase text-red-400 gap-1 hover:bg-red-50">
                                        <RotateCcw className="w-3 h-3"/> Resetear Formulario
                                    </Button>
                                )}
                            </div>

                            <div className="relative">
                                <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <Input 
                                    value={budgetData.clienteNombre} 
                                    onChange={(e) => setBudgetData({...budgetData, clienteNombre: e.target.value})} 
                                    className="h-16 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/50 border-none font-black text-xl px-16 shadow-inner" 
                                    placeholder="NOMBRE DEL CLIENTE..." 
                                />
                            </div>

                            {/* CONCEPTOS */}
                            <div className="space-y-4">
                                <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-blue-500" /> Conceptos {newItem.id && <Badge className="bg-amber-500 ml-2">Editando</Badge>}
                                </h3>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-black/5 space-y-4">
                                    <div className="relative" ref={suggestionRef}>
                                        <Input 
                                            value={newItem.descripcion} 
                                            onChange={(e) => { setNewItem({...newItem, descripcion: e.target.value}); setShowSuggestions(true); }} 
                                            className="h-14 rounded-xl bg-white dark:bg-slate-900 border-none px-6 font-bold text-base shadow-sm" 
                                            placeholder="Descripción del trabajo..." 
                                        />
                                        <AnimatePresence>
                                            {showSuggestions && newItem.descripcion.length > 1 && (
                                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-50 border border-slate-100 dark:border-slate-700 overflow-hidden">
                                                    {SMR_CATALOG.filter(s => s.toLowerCase().includes(newItem.descripcion.toLowerCase())).map((s, i) => (
                                                        <button key={i} onClick={() => { setNewItem({...newItem, descripcion: s}); setShowSuggestions(false); }} className="w-full text-left p-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold text-xs uppercase border-b last:border-none text-slate-600 dark:text-slate-300">{s}</button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-3">
                                            <Input type="number" value={newItem.cantidad} onChange={(e) => setNewItem({...newItem, cantidad: Number(e.target.value) || 0})} className="h-14 rounded-xl bg-white dark:bg-slate-900 border-none text-center font-black" placeholder="Cant." />
                                        </div>
                                        <div className="col-span-6 relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                            <Input type="number" value={newItem.precioUnitarioUSD} onChange={(e) => setNewItem({...newItem, precioUnitarioUSD: Number(e.target.value) || 0})} className="h-14 rounded-xl bg-white dark:bg-slate-900 border-none pl-10 font-black text-blue-600" placeholder="Precio Unitario" />
                                        </div>
                                        <div className="col-span-3">
                                            <Button 
                                                onClick={handleAddOrUpdateItem} 
                                                className={cn(
                                                    "w-full h-14 rounded-xl text-white shadow-lg active:scale-95 transition-all",
                                                    newItem.id ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                                                )}
                                            >
                                                {newItem.id ? <Check /> : <Plus />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TABLA DE ITEMS */}
                            <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-800/30">
                                        <TableRow className="border-none">
                                            <TableHead className="px-8 text-[9px] font-black uppercase tracking-widest">Descripción</TableHead>
                                            <TableHead className="text-right px-8 text-[9px] font-black uppercase tracking-widest">Subtotal</TableHead>
                                            <TableHead className="w-24"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {budgetData.items.map(item => (
                                            <TableRow key={item.id} className={cn("h-16 border-b dark:border-slate-800 last:border-none transition-colors", newItem.id === item.id && "bg-blue-50/50 dark:bg-blue-500/5")}>
                                                <TableCell className="px-8 font-bold uppercase text-[11px] text-slate-600 dark:text-slate-300">
                                                    {item.descripcion} <span className="ml-2 text-slate-400 font-black italic">x{item.cantidad}</span>
                                                </TableCell>
                                                <TableCell className="text-right px-8 font-black text-blue-600 text-sm tracking-tight">${item.totalUSD.toFixed(2)}</TableCell>
                                                <TableCell className="pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditItemRequest(item)} className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setBudgetData((p:any) => ({...p, items: p.items.filter((i:any) => i.id !== item.id)}))} className="text-red-400 hover:bg-red-50">
                                                            <Trash2 className="w-4 h-4"/>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button onClick={() => handleConvertToOrder()} disabled={isLoading || budgetData.items.length === 0} className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs gap-3 shadow-xl active:scale-95 transition-all">
                                    {isLoading ? <Clock className="animate-spin w-5 h-5" /> : <Zap className="w-5 h-5" />} Facturar ahora
                                </Button>
                                <Button onClick={handleSaveDraft} disabled={isLoading || budgetData.items.length === 0} className="h-16 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs gap-3 active:scale-95 transition-all">
                                    <Save className="w-5 h-5" /> {budgetData.id ? "Actualizar Registro" : "Guardar Borrador"}
                                </Button>
                                <Button onClick={() => generateBudgetPDF(budgetData, pdfLogoBase64, { bcvRate: currentBcvRate, firmaBase64, selloBase64 })} disabled={budgetData.items.length === 0} className="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs gap-3 active:scale-95 transition-all">
                                    <Download className="w-5 h-5" /> Exportar PDF
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* HISTORIAL LATERAL */}
                <aside className="lg:col-span-4 space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h2 className="text-xl font-black italic uppercase flex items-center gap-3 text-slate-900 dark:text-white">
                            <Clock className="w-5 h-5 text-blue-600" /> Recientes
                        </h2>
                        <Badge className="rounded-full bg-blue-100 text-blue-600 px-3 border-none font-black">{history.length}</Badge>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                        {history.map((entry) => (
                            <motion.div key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <Card className="p-5 rounded-[2.5rem] border-none shadow-lg bg-white dark:bg-slate-900 group relative overflow-hidden transition-all hover:scale-[1.02]">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1 min-w-0 pr-4">
                                            <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm truncate uppercase italic tracking-tight">{entry.clienteNombre}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                                                <Calendar className="w-3 h-3" /> {entry.dateCreated ? new Date(entry.dateCreated).toLocaleDateString() : 'Sin fecha'}
                                            </p>
                                        </div>
                                        <p className="text-lg font-black text-blue-600 tracking-tighter leading-none">${entry.totalUSD?.toFixed(2)}</p>
                                    </div>
                                    
                                    <div className="mt-4 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                                        <Button size="icon" onClick={() => handleEditBudget(entry)} className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors shadow-sm">
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" onClick={() => generateBudgetPDF(entry, pdfLogoBase64, { bcvRate: currentBcvRate, firmaBase64, selloBase64 })} className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors shadow-sm">
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" onClick={() => handleConvertToOrder(entry)} className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors shadow-sm">
                                            <Zap className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" onClick={() => handleDeleteBudget(entry.id)} className="h-10 w-10 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-colors shadow-sm">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </aside>
            </div>
        </motion.div>
    );
}

// --- SUB-COMPONENTES AUXILIARES ---

function StatCard({ label, value, icon, color, className }: any) {
    const colors: any = { 
        blue: "bg-blue-600 text-white shadow-blue-500/20", 
        emerald: "bg-white dark:bg-slate-900 border-black/5 dark:border-white/5 shadow-md", 
        amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 border-none" 
    };
    return (
        <Card className={cn("rounded-[2.5rem] border-none shadow-xl p-7 flex items-center gap-5", colors[color], className)}>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", color === 'blue' ? "bg-white/20" : "bg-slate-50 dark:bg-white/5")}>
                {React.cloneElement(icon, { className: cn("w-6 h-6", color === 'blue' ? "text-white" : "text-slate-400") })}
            </div>
            <div className="min-w-0">
                <p className={cn("text-[9px] font-black uppercase tracking-widest leading-none mb-1.5", color === 'blue' ? "text-white/70" : "text-slate-400")}>{label}</p>
                <h3 className="text-2xl font-black tracking-tighter leading-none truncate">{value}</h3>
            </div>
        </Card>
    );
}

function AssetPill({ active, label, onUpload, onClear }: any) {
    return (
        <div className="flex items-center gap-2 p-1.5 pl-4 rounded-full bg-white dark:bg-slate-800 border border-black/5 shadow-sm h-11">
            <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "text-blue-600" : "text-slate-400")}>{label}</span>
            <input type="file" className="hidden" id={`pill-${label}`} onChange={onUpload} />
            <Button variant="ghost" size="icon" onClick={() => document.getElementById(`pill-${label}`)?.click()} className={cn("h-8 w-8 rounded-full transition-all", active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-50 dark:bg-white/5")}>
                {active ? <CheckCircle2 className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
            </Button>
            {active && <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8 rounded-full text-red-400 hover:bg-red-50"><X className="w-4 h-4"/></Button>}
        </div>
    );
}