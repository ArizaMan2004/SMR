// @/components/dashboard/BudgetEntryView.tsx
"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'; 
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { generateBudgetPDF } from "@/lib/services/pdf-generator";
import { 
    saveBudgetToFirestore, 
    loadBudgetsFromFirestore, 
    deleteBudgetFromFirestore 
} from "@/lib/firebase/firestore-budget-service";

// UI Components - Shadcn
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Iconos - Lucide
import { 
    Plus, Trash2, Image as ImageIcon, Handshake, Stamp, 
    FileText, X, Save, Clock, Download, Loader2, 
    User, FileSpreadsheet, Wallet, Calculator, Search, TrendingUp,
    ChevronLeft, ChevronRight, Sparkles, Command, RefreshCcw, MousePointer2, Type, Layers,
    Calendar, DollarSign
} from "lucide-react"; 

import { cn } from "@/lib/utils";

// --- CATÁLOGO SMR ---
const SMR_CATALOG = [
    "Laminación Mate para Vinil ( )", "Laminación Brillante para Vinil ( )", "Laminación Semimate Especial ( )",
    "Impresión de Alta Resolución en Vinil Adhesivo ( )", "Impresión de Gran Formato en Lona Banner ( )",
    "Impresión Full Color sobre Vinil Clear / Transparente ( )", "Impresión Simple en Vinil Adhesivo ( )",
    "Impresión Simple en Lona Banner ( )", "Impresión Simple en Vinil Clear ( )", "Corte Láser en Acrílico ( )",
    "Corte Láser en Cartulina (Invitaciones/Detalles) ( )", "Letras Corpóreas en Acrílico con Iluminación LED ( )",
    "Logotipo 3D en Acrílico sobre Base de PVC ( )", "Medallas en Acrílico Personalizadas ( )",
    "Llaveros en Acrílico con Herraje Metálico ( )", "Placa en Acrílico Transparente con Separadores ( )",
    "Corte y Grabado Láser en MDF ( )", "Logotipo Calado en MDF para Pared ( )", "Letrero en Madera Natural con Grabado Profundo ( )",
    "Aviso en Melamina con Letras Corpóreas ( )", "Rotulación en General (Interiores y Exteriores) ( )",
    "Impresión de Vinil Autoadhesivo para Paredes ( )", "Vinil Microperforado para Vidrieras ( )",
    "Vinil Esmerilado para Oficinas (Corte Plotter) ( )", "Stickers Personalizados (Cualquier medida) ( )",
    "Rotulación Vehicular Parcial o Total (Vinil Cast) ( )", "Pendón Conmemorativo en Lona Banner ( )",
    "Banner Publicitario 13oz con Ojaletes ( )", "Aviso Exterior en Lona Banner con Estructura Metálica ( )",
    "Roller Stand Publicitario (Banner 10oz + Estructura)", "Grabado Láser de Agenda Corporativa ( )",
    "Grabado Láser de Termo Metálico / Yeti ( )", "Grabado Láser de Artículos Promocionales ( )",
    "Servicio de Diseño Gráfico Publicitario", "Vectorización de Logotipo e Identidad Visual"
];

// --- ANIMACIONES ---
const iosTransition = { type: "spring", stiffness: 350, damping: 30 };
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: iosTransition } };
const suggestionVariants = { hidden: { opacity: 0, y: -5 }, visible: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

export default function BudgetEntryView({
    currentBcvRate, pdfLogoBase64, handleLogoUpload, handleClearLogo,
    firmaBase64, handleFirmaUpload, handleClearFirma,
    selloBase64, handleSelloUpload, handleClearSello,
}: any) {
    const [budgetData, setBudgetData] = useState({ clienteNombre: '', items: [] as any[] });
    const [newItem, setNewItem] = useState({ descripcion: '', cantidad: 1, precioUnitarioUSD: 0 });
    const [history, setHistory] = useState<any[]>([]); 
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

    const totalUSD = useMemo(() => budgetData.items.reduce((sum, i) => sum + i.totalUSD, 0), [budgetData.items]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) setShowSuggestions(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredSuggestions = useMemo(() => {
        if (!newItem.descripcion || newItem.descripcion.length < 2) return [];
        const historyPool = history.flatMap(h => (h.items || []).map((i: any) => i.descripcion));
        const combinedPool = Array.from(new Set([...SMR_CATALOG, ...historyPool]));
        return combinedPool.filter(opt => opt.toLowerCase().includes(newItem.descripcion.toLowerCase())).slice(0, 5);
    }, [newItem.descripcion, history]);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await loadBudgetsFromFirestore();
            if (data) setHistory(data.map(b => ({ ...b, id: b.id! })));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const filteredHistory = useMemo(() => history.filter(h => (h.clienteNombre || "").toLowerCase().includes(searchTerm.toLowerCase())), [history, searchTerm]);
    const paginatedHistory = useMemo(() => filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredHistory, currentPage]);
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

    const handleAddItem = () => {
        if (!newItem.descripcion || newItem.cantidad <= 0) return;
        setBudgetData(prev => ({ ...prev, items: [...prev.items, { ...newItem, id: Date.now(), totalUSD: newItem.cantidad * newItem.precioUnitarioUSD }] }));
        setNewItem({ descripcion: '', cantidad: 1, precioUnitarioUSD: 0 });
        setShowSuggestions(false);
    };

    const handleSave = async () => {
        if (!budgetData.clienteNombre || budgetData.items.length === 0) return;
        setIsLoading(true);
        try {
            await saveBudgetToFirestore({ ...budgetData, dateCreated: new Date().toISOString(), totalUSD });
            await fetchHistory();
            setBudgetData({ clienteNombre: '', items: [] });
        } catch (e) { alert("Error"); } finally { setIsLoading(false); }
    };

    const handleDownloadPDF = async (entry?: any) => {
        const target = entry || budgetData;
        if (!pdfLogoBase64 || !target.clienteNombre) return alert("Suba el logo antes.");
        const pdfData = { titulo: 'Presupuesto', clienteNombre: target.clienteNombre, clienteCedula: '', items: target.items, totalUSD: target.items.reduce((s:any, i:any) => s + i.totalUSD, 0), fechaCreacion: entry?.dateCreated ? new Date(entry.dateCreated).toLocaleDateString() : new Date().toLocaleDateString() };
        try { await generateBudgetPDF(pdfData, pdfLogoBase64, { bcvRate: currentBcvRate, firmaBase64, selloBase64 }); } catch (e) { console.error(e); }
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="max-w-5xl mx-auto space-y-4 md:space-y-6 pb-24 px-2 md:px-4">
            
            {/* --- HEADER --- */}
            <motion.header variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 md:p-5 rounded-3xl border border-white/20 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shrink-0">
                        <FileSpreadsheet className="text-white w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-none italic tracking-tight">SMR Budget</h1>
                        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5 text-blue-500" /> Smart System</p>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                    <AssetPill active={!!pdfLogoBase64} label="Logo" onUpload={handleLogoUpload} onClear={handleClearLogo} />
                    <AssetPill active={!!firmaBase64} label="Firma" onUpload={handleFirmaUpload} onClear={handleClearFirma} />
                    <AssetPill active={!!selloBase64} label="Sello" onUpload={handleSelloUpload} onClear={handleClearSello} />
                </div>
            </motion.header>

            {/* --- STATS --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <IOSStatCard label="Total USD" value={`$${totalUSD.toFixed(2)}`} icon={<Wallet />} color="blue" />
                <IOSStatCard label="Monto BS" value={`Bs. ${(totalUSD * currentBcvRate).toLocaleString()}`} icon={<Calculator />} color="emerald" />
                <IOSStatCard label="Tasa BCV" value={currentBcvRate.toFixed(2)} icon={<TrendingUp />} color="amber" className="sm:col-span-2 md:col-span-1" />
            </div>

            {/* --- CONSTRUCTOR --- */}
            <motion.div variants={itemVariants}>
                <Card className="rounded-[1.5rem] md:rounded-[2.5rem] border-none shadow-2xl bg-white dark:bg-slate-900 p-4 md:p-10 space-y-6 md:space-y-8">
                    <div className="space-y-2">
                        <Label className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Cliente</Label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <Input value={budgetData.clienteNombre} onChange={(e) => setBudgetData({...budgetData, clienteNombre: e.target.value})} className="h-12 md:h-14 pl-10 md:pl-14 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-black text-sm md:text-lg" placeholder="NOMBRE DEL CLIENTE..." />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-slate-400 ml-2 flex items-center gap-2"><Layers className="w-3 h-3 text-blue-500" /> Conceptos</h3>
                        <div className="flex flex-col gap-2 p-2 md:p-3 bg-slate-100/40 dark:bg-slate-800/40 rounded-2xl md:rounded-[1.8rem] border border-white/5">
                            <div className="relative flex-1" ref={suggestionRef}>
                                <Input value={newItem.descripcion} onChange={(e) => { setNewItem({...newItem, descripcion: e.target.value}); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} className="h-11 rounded-xl bg-white dark:bg-slate-900 border-none px-4 font-bold text-xs md:text-sm" placeholder="Descripción del trabajo..." />
                                <AnimatePresence>
                                    {showSuggestions && filteredSuggestions.length > 0 && (
                                        <motion.div variants={suggestionVariants} initial="hidden" animate="visible" exit="exit" className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                                            {filteredSuggestions.map((s, i) => (
                                                <button key={i} onClick={() => { setNewItem({...newItem, descripcion: s}); setShowSuggestions(false); }} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border-b last:border-none">
                                                    <span className="font-bold text-[9px] md:text-[10px] text-slate-600 dark:text-slate-300 uppercase truncate block">{s}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="flex gap-2">
                                <Input type="number" value={newItem.cantidad} onChange={(e) => setNewItem({...newItem, cantidad: parseFloat(e.target.value) || 0})} className="h-11 w-20 rounded-xl bg-white dark:bg-slate-900 border-none font-black text-center text-xs" placeholder="Cant." />
                                <div className="relative flex-1">
                                    <Input type="number" value={newItem.precioUnitarioUSD} onChange={(e) => setNewItem({...newItem, precioUnitarioUSD: parseFloat(e.target.value) || 0})} className="h-11 w-full rounded-xl bg-white dark:bg-slate-900 border-none font-black pl-7 text-blue-600 text-xs" placeholder="P. Unit" />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-blue-300 text-[10px]">$</span>
                                </div>
                                <Button onClick={handleAddItem} className="h-11 w-11 rounded-xl bg-slate-900 text-white shrink-0"><Plus className="w-5 h-5" /></Button>
                            </div>
                        </div>
                    </div>

                    {/* TABLA ESCRITORIO / LISTA MÓVIL */}
                    <div className="rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        {/* PC */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow><TableHead className="px-6 text-[8px] font-black uppercase">Concepto</TableHead><TableHead className="text-center text-[8px] font-black uppercase">Cant.</TableHead><TableHead className="text-right px-6 text-[8px] font-black uppercase">Total USD</TableHead><TableHead className="w-10"></TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {budgetData.items.length === 0 ? <TableRow><TableCell colSpan={4} className="h-20 text-center font-black text-slate-200 text-[10px] uppercase italic">Sin items</TableCell></TableRow> : budgetData.items.map(item => (
                                        <TableRow key={item.id} className="h-14"><TableCell className="px-6 font-bold uppercase text-[10px] text-slate-600">{item.descripcion}</TableCell><TableCell className="text-center font-black text-xs">{item.cantidad}</TableCell><TableCell className="text-right px-6 font-black text-blue-600 text-sm">${item.totalUSD.toFixed(2)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => setBudgetData(p => ({...p, items: p.items.filter(i => i.id !== item.id)}))} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></Button></TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {/* MOBILE */}
                        <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                            {budgetData.items.length === 0 ? <div className="p-10 text-center text-slate-200 text-[10px] font-black uppercase italic">Sin conceptos añadidos</div> : budgetData.items.map(item => (
                                <div key={item.id} className="p-4 flex justify-between items-center bg-white dark:bg-slate-900">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p className="font-bold uppercase text-[10px] text-slate-600 dark:text-slate-300 truncate">{item.descripcion}</p>
                                        <p className="text-[9px] font-black text-slate-400">CANT: {item.cantidad} x ${item.precioUnitarioUSD.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-blue-600 text-xs">${item.totalUSD.toFixed(2)}</span>
                                        <Button variant="ghost" size="icon" onClick={() => setBudgetData(p => ({...p, items: p.items.filter(i => i.id !== item.id)}))} className="h-8 w-8 text-red-400"><Trash2 className="w-3.5 h-3.5"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                        <Button onClick={handleSave} disabled={isLoading || budgetData.items.length === 0} className="h-12 md:h-14 rounded-xl md:rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest flex-1"><Save className="w-4 h-4 mr-2" /> Guardar</Button>
                        <Button onClick={() => handleDownloadPDF()} disabled={budgetData.items.length === 0} className="h-12 md:h-14 rounded-xl md:rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest flex-1"><Download className="w-4 h-4 mr-2" /> Exportar PDF</Button>
                    </div>
                </Card>
            </motion.div>

            {/* --- HISTORIAL --- */}
            <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2 mt-4">
                    <h2 className="text-lg md:text-xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-2 italic uppercase"><Clock className="w-4 h-4 text-blue-500" /> Historial</h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                        <Input placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="h-10 pl-9 rounded-xl bg-white dark:bg-slate-900 border-none shadow-sm font-bold text-[10px]" />
                    </div>
                </div>

                <Card className="rounded-2xl md:rounded-[2.2rem] border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                    {/* PC */}
                    <div className="hidden md:block">
                        <Table>
                            <TableBody>
                                {paginatedHistory.map((entry) => (
                                    <TableRow key={entry.id} className="h-16">
                                        <TableCell className="px-8"><div className="font-black uppercase text-[11px] text-slate-900 dark:text-white">{entry.clienteNombre}</div><div className="text-[8px] font-bold text-slate-400 mt-0.5">{new Date(entry.dateCreated).toLocaleDateString()}</div></TableCell>
                                        <TableCell className="text-right px-10"><div className="font-black text-sm">${entry.totalUSD.toFixed(2)}</div><div className="text-[8px] font-black text-emerald-500">Bs. {(entry.totalUSD * currentBcvRate).toLocaleString()}</div></TableCell>
                                        <TableCell><div className="flex justify-center gap-1.5"><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-blue-50 text-blue-600" onClick={() => { setBudgetData(entry); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus className="w-3.5 h-3.5"/></Button><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-slate-900 text-white" onClick={() => handleDownloadPDF(entry)}><Download className="w-3.5 h-3.5"/></Button><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-red-50 text-red-400" onClick={() => { if(confirm("¿Eliminar?")) deleteBudgetFromFirestore(entry.id).then(fetchHistory); }}><Trash2 className="w-3.5 h-3.5"/></Button></div></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {/* MOBILE */}
                    <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                        {paginatedHistory.map((entry) => (
                            <div key={entry.id} className="p-4 bg-white dark:bg-slate-900 flex justify-between items-center">
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="font-black uppercase text-[10px] text-slate-800 dark:text-slate-100 truncate">{entry.clienteNombre}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-black text-blue-600">${entry.totalUSD.toFixed(2)}</span>
                                        <span className="text-[8px] font-bold text-slate-400">{new Date(entry.dateCreated).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-9 w-9 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg" onClick={() => { setBudgetData(entry); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Plus className="w-4 h-4"/></Button>
                                    <Button size="icon" variant="ghost" className="h-9 w-9 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg" onClick={() => handleDownloadPDF(entry)}><Download className="w-4 h-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 py-4">
                        <Button variant="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-10 w-10 p-0 rounded-full"><ChevronLeft className="w-5 h-5"/></Button>
                        <span className="font-black text-[10px] uppercase text-slate-400">Pág. {currentPage} / {totalPages}</span>
                        <Button variant="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-10 w-10 p-0 rounded-full"><ChevronRight className="w-5 h-5"/></Button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

// --- SUB-COMPONENTES ---

function IOSStatCard({ label, value, icon, color, className }: any) {
    const colors: any = { 
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30", 
        emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30", 
        amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30" 
    };
    return (
        <Card className={cn("border-none shadow-xl rounded-2xl md:rounded-3xl p-4 md:p-5 flex items-center gap-4 bg-white dark:bg-slate-900", className)}>
            <div className={cn("w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner", colors[color])}>
                {React.cloneElement(icon, { className: "w-4 h-4 md:w-5 md:h-5" })}
            </div>
            <div className="min-w-0">
                <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 leading-none">{label}</p>
                <h3 className="text-base md:text-lg font-black tracking-tighter text-slate-900 dark:text-white leading-none truncate">{value}</h3>
            </div>
        </Card>
    );
}

function AssetPill({ active, label, onUpload, onClear }: any) {
    return (
        <div className="flex items-center gap-1.5 p-1 pl-3 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm h-8 md:h-9">
            <span className={cn("text-[6px] md:text-[7px] font-black uppercase tracking-widest", active ? "text-emerald-500" : "text-slate-400")}>{label}</span>
            <input type="file" className="hidden" id={`pill-${label}`} onChange={onUpload} />
            <Button variant="ghost" size="icon" onClick={() => document.getElementById(`pill-${label}`)?.click()} className={cn("h-6 w-6 md:h-7 md:w-7 rounded-full", active ? "bg-emerald-500 text-white shadow-lg" : "bg-slate-50 dark:bg-slate-700")}>
                {active ? <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5"/> : <Plus className="w-3 h-3 md:w-3.5 md:h-3.5"/>}
            </Button>
            {active && <Button variant="ghost" size="icon" onClick={onClear} className="h-6 w-6 md:h-7 md:w-7 text-slate-300 hover:text-red-500"><X className="w-3 h-3 md:w-3.5 md:h-3.5"/></Button>}
        </div>
    );
}