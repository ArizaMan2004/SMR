// @/components/dashboard/CalculatorView.tsx
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// Iconos - Lucide
import {
    Calculator as CalcIcon, Ruler, DollarSign, Timer, Trash2, Plus, 
    Repeat2, Save, FolderOpen, X, Clock, Eye, Pencil, 
    ArrowLeftRight, Landmark, CheckCircle2, Search, ChevronLeft, ChevronRight
} from "lucide-react";

import { fetchBCVRateFromAPI } from "@/lib/bcv-service";
import { cn } from "@/lib/utils";

// Servicios Firestore
import { 
    saveAreaCalculation, getAreaHistory, deleteAreaCalculation,
    saveLaserCalculation, getLaserHistory, deleteLaserCalculation
} from "@/lib/services/firestore-calculator-service";

// --- CONSTANTES ---
const ITEMS_PER_PAGE = 5;

// --- CONFIGURACIÓN DE ANIMACIONES ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { 
        y: 0, 
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 }
    },
    exit: { 
        scale: 0.98, 
        opacity: 0, 
        transition: { duration: 0.2 } 
    }
};

const historyItemVariants = {
    hidden: { x: -10, opacity: 0 },
    visible: { 
        x: 0, 
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 }
    },
    exit: { 
        x: 10, 
        opacity: 0, 
        transition: { duration: 0.15 } 
    }
};

const tapAnimation = { whileTap: { scale: 0.98 } };
const hoverScale = { whileHover: { scale: 1.005 } };

// --- UTILIDADES DE FORMATEO ---
const formatBs = (amount: number | null): string => {
    if (amount === null || isNaN(amount)) return "0,00";
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const formatUSD = (amount: number | null): string => {
    if (amount === null || isNaN(amount)) return "0.00";
    return amount.toFixed(2);
};

const formatTime = (totalMinutes: number): string => {
    if (totalMinutes < 0) return "00:00";
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round((totalMinutes - minutes) * 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// --- COMPONENTES UI ---

const PremiumResultWidget = ({ usdAmount, rates, title }: { usdAmount: number | null, rates: any, title: string }) => {
    const [rateMode, setRateMode] = useState<'USD' | 'EUR'>('USD');
    if (!usdAmount || usdAmount <= 0) return null;

    const activeRate = rateMode === 'USD' ? rates.usdRate : rates.eurRate;
    const bsAmount = activeRate ? usdAmount * activeRate : 0;

    return (
        <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 rounded-3xl text-white shadow-lg relative overflow-hidden border border-emerald-400/20">
                <div className="relative z-10 flex flex-row justify-between items-center gap-4">
                    <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">{title}</p>
                        <motion.h2 key={usdAmount} initial={{ x: -5, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-3xl font-black tracking-tighter italic">${formatUSD(usdAmount)}</motion.h2>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="bg-white/10 backdrop-blur-md p-0.5 rounded-xl flex border border-white/10">
                            {['USD', 'EUR'].map((m) => (
                                <button key={m} onClick={() => setRateMode(m as any)} className={cn("px-3 py-1 rounded-lg text-[8px] font-black transition-all", rateMode === m ? "bg-white text-emerald-700 shadow-sm" : "text-white/60 hover:text-white")}>{m}</button>
                            ))}
                        </div>
                        <div className="text-right">
                            <motion.p key={bsAmount} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-lg font-black tracking-tighter">Bs. {formatBs(bsAmount)}</motion.p>
                        </div>
                    </div>
                </div>
                {/* SIGNO DE DÓLAR ANIMADO REINSTALADO */}
                <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }} 
                    className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none"
                >
                    <DollarSign size={120} />
                </motion.div>
            </div>
        </motion.div>
    );
};

const ReceiptModal = ({ isOpen, onClose, data, type, rates }: any) => {
    const [rateMode, setRateMode] = useState<'USD' | 'EUR'>('USD');
    if (!isOpen || !data) return null;
    const activeRate = rateMode === 'USD' ? rates.usdRate : rates.eurRate;
    const totalBs = activeRate ? data.totalCost * activeRate : 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden z-[160] border border-slate-200 dark:border-slate-800">
                    <div className="bg-slate-900 p-6 text-white text-center relative">
                        <div className="absolute top-4 right-5 text-emerald-400"><CheckCircle2 size={20}/></div>
                        <h3 className="text-xl font-black italic tracking-tighter">{data.name}</h3>
                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">{data.date}</p>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1 custom-scrollbar">
                            {type === 'area' ? data.mediciones?.map((m: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-[11px] font-bold border-b border-slate-50 dark:border-slate-900 pb-2">
                                    <span className="text-slate-500">{m.name}</span>
                                    <span className="text-slate-900 dark:text-white">${formatUSD(((m.cmAlto/100)*(m.cmAncho/100))*m.precioDolar)}</span>
                                </div>
                            )) : data.tiempos?.map((t: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-[11px] font-bold border-b border-slate-50 dark:border-slate-900 pb-2">
                                    <span className="text-slate-500">{t.name}</span>
                                    <span className="text-slate-900 dark:text-white">{formatTime((t.minutes || 0) + (t.seconds || 0)/60)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg flex gap-0.5">
                                <button onClick={() => setRateMode('USD')} className={cn("px-2 py-1 rounded-md text-[8px] font-black", rateMode === 'USD' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400")}>USD</button>
                                <button onClick={() => setRateMode('EUR')} className={cn("px-2 py-1 rounded-md text-[8px] font-black", rateMode === 'EUR' ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400")}>EUR</button>
                            </div>
                            <p className="text-2xl font-black italic tracking-tighter text-slate-900 dark:text-white">${formatUSD(data.totalCost)}</p>
                        </div>
                        <div className="bg-blue-600 p-4 rounded-2xl text-white text-center shadow-lg shadow-blue-500/20">
                            <p className="text-[8px] font-black uppercase opacity-60 mb-0.5 tracking-widest">Total en Bolívares</p>
                            <p className="text-2xl font-black tracking-tighter">Bs. {formatBs(totalBs)}</p>
                        </div>
                        <Button onClick={onClose} variant="ghost" className="w-full text-slate-400 font-bold h-10 text-xs rounded-xl">Cerrar Recibo</Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// --- CALCULADORA 1: METRO CUADRADO ---
const MetroCuadradoCalculator = ({ rates }: { rates: any }) => {
    const [mediciones, setMediciones] = useState<any[]>([{ id: Date.now(), name: "Medición #1", cmAlto: 0, cmAncho: 0, precioDolar: 0 }]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [resultadoTotal, setResultadoTotal] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [history, setHistory] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => { getAreaHistory().then(setHistory); }, []);
    
    useEffect(() => {
        let total = 0; let ok = false;
        mediciones.forEach(m => { if(m.cmAlto > 0 && m.cmAncho > 0 && m.precioDolar > 0) { total += (m.cmAlto/100)*(m.cmAncho/100)*m.precioDolar; ok = true; }});
        setResultadoTotal(ok ? total : null);
    }, [mediciones]);

    const filteredHistory = useMemo(() => {
        return history.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [history, searchTerm]);

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleSave = async () => {
        if (!saveName.trim() || resultadoTotal === null) return;
        const newItem = await saveAreaCalculation({ name: saveName, date: new Date().toLocaleDateString(), mediciones, totalCost: resultadoTotal, totalM2: 0 });
        setHistory([newItem as any, ...history]); setIsSaving(false); setSaveName(""); setCurrentPage(1);
    };

    const handleEditFromHistory = (item: any) => {
        setMediciones(item.mediciones);
        setSaveName(item.name);
        setIsSaving(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-5">
            <LayoutGroup>
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {mediciones.map((m, idx) => (
                            <motion.div layout variants={itemVariants} initial="hidden" animate="visible" exit="exit" key={m.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 group relative">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-slate-900 h-6 w-6 rounded-lg p-0 flex items-center justify-center text-[9px] font-black italic">{idx + 1}</Badge>
                                        {editingId === m.id ? (
                                            <Input autoFocus className="h-7 w-32 rounded-md font-bold text-xs" value={m.name} onChange={e => setMediciones(mediciones.map(i => i.id === m.id ? {...i, name: e.target.value} : i))} onBlur={() => setEditingId(null)} />
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="font-black text-xs text-slate-700 dark:text-white italic">{m.name}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setEditingId(m.id)}><Pencil size={12}/></Button>
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setMediciones(mediciones.length > 1 ? mediciones.filter(i => i.id !== m.id) : mediciones)} className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={16}/></Button>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 ml-1">Alto (cm)</Label><Input type="number" className="rounded-xl h-9 text-xs font-bold" value={m.cmAlto || ""} onChange={e => setMediciones(mediciones.map(i => i.id === m.id ? {...i, cmAlto: parseFloat(e.target.value)||0} : i))} /></div>
                                    <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 ml-1">Ancho (cm)</Label><Input type="number" className="rounded-xl h-9 text-xs font-bold" value={m.cmAncho || ""} onChange={e => setMediciones(mediciones.map(i => i.id === m.id ? {...i, cmAncho: parseFloat(e.target.value)||0} : i))} /></div>
                                    <div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-400 ml-1">Precio m²</Label><Input type="number" className="rounded-xl h-9 text-xs font-black text-blue-600" value={m.precioDolar || ""} onChange={e => setMediciones(mediciones.map(i => i.id === m.id ? {...i, precioDolar: parseFloat(e.target.value)||0} : i))} /></div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </LayoutGroup>

            <motion.div {...hoverScale} {...tapAnimation}>
                <Button variant="outline" onClick={() => setMediciones([...mediciones, { id: Date.now(), name: `Pieza #${mediciones.length+1}`, cmAlto: 0, cmAncho: 0, precioDolar: 0 }])} className="w-full h-10 rounded-2xl border-dashed border-2 font-black text-[10px] text-slate-400 gap-2 hover:bg-slate-50 transition-all">
                    <Plus size={16}/> Añadir otra pieza
                </Button>
            </motion.div>

            <PremiumResultWidget usdAmount={resultadoTotal} rates={rates} title="Cotización Total Área" />

            {resultadoTotal && (
                <div className="pt-1">
                    {!isSaving ? (
                        <Button onClick={() => setIsSaving(true)} className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black gap-2 shadow-md hover:bg-slate-800 transition-all">
                            <Save size={16} /> Guardar presupuesto
                        </Button>
                    ) : (
                        <motion.div layout className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                            <Input autoFocus placeholder="Cliente..." className="h-10 rounded-xl bg-white dark:bg-slate-800 border-none font-bold px-4 text-xs flex-1" value={saveName} onChange={e => setSaveName(e.target.value)} />
                            <Button onClick={handleSave} className="h-10 px-6 bg-blue-600 text-white rounded-xl font-black text-xs">OK</Button>
                            <Button variant="ghost" onClick={() => setIsSaving(false)} className="h-10 w-10 rounded-xl text-slate-400"><X size={18} /></Button>
                        </motion.div>
                    )}
                </div>
            )}

            <div className="pt-8 space-y-4">
                <div className="flex flex-row justify-between items-center gap-2 px-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-black uppercase text-[9px] tracking-widest">
                        <FolderOpen size={12}/> Historial
                    </div>
                    <div className="relative w-40 sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                        <Input placeholder="Buscar..." className="h-8 pl-8 rounded-lg bg-slate-100 dark:bg-slate-900 border-none text-[10px] font-bold" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                    </div>
                </div>

                <motion.div key={`hist-area-${currentPage}`} variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {paginatedHistory.map(h => (
                            <motion.div layout variants={historyItemVariants} exit="exit" key={h.id} className="bg-white dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center font-black italic text-[10px]">M2</div>
                                    <div><p className="font-black text-xs text-slate-800 dark:text-white leading-tight">{h.name}</p><p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">{h.date}</p></div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-black text-emerald-600 text-sm mr-2">${formatUSD(h.totalCost)}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditFromHistory(h)} className="h-8 w-8 text-amber-500"><Pencil size={14}/></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedItem(h)} className="h-8 w-8 text-blue-500"><Eye size={14}/></Button>
                                    <Button variant="ghost" size="icon" onClick={async () => { if(confirm("¿Borrar?")) { await deleteAreaCalculation(h.id); setHistory(history.filter(i => i.id !== h.id)); } }} className="h-8 w-8 text-red-300 hover:text-red-500"><Trash2 size={14}/></Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 pt-2">
                        <Button variant="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="h-8 w-8 p-0"><ChevronLeft size={16} /></Button>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Pág {currentPage} / {totalPages}</span>
                        <Button variant="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="h-8 w-8 p-0"><ChevronRight size={16} /></Button>
                    </div>
                )}
            </div>
            <ReceiptModal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} data={selectedItem} type="area" rates={rates} />
        </div>
    );
};

// --- CALCULADORA 2: LÁSER ---
const LaserCutsCalculator = ({ rates }: { rates: any }) => {
    const [tiempos, setTiempos] = useState<any[]>([{ id: Date.now(), name: "Corte #1", minutes: 0, seconds: 0, includeMaterial: false, materialCost: 0 }]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [resultado, setResultado] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveName, setSaveName] = useState("");
    const COSTO_POR_MINUTO = 0.80;

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => { getLaserHistory().then(setHistory); }, []);
    
    useEffect(() => {
        let min = 0; let mat = 0;
        tiempos.forEach(t => { min += (t.minutes||0) + ((t.seconds||0)/60); if(t.includeMaterial) mat += (t.materialCost||0); });
        setResultado(min > 0 ? { totalMinutes: min, totalCost: (min * COSTO_POR_MINUTO) + mat } : null);
    }, [tiempos]);

    const filteredHistory = useMemo(() => {
        return history.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [history, searchTerm]);

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const handleSave = async () => {
        if (!saveName.trim() || !resultado) return;
        const newItem = await saveLaserCalculation({ name: saveName, date: new Date().toLocaleDateString(), tiempos, totalCost: resultado.totalCost, totalMinutes: resultado.totalMinutes });
        setHistory([newItem as any, ...history]); setIsSaving(false); setSaveName(""); setCurrentPage(1);
    };

    const handleEditFromHistory = (item: any) => {
        setTiempos(item.tiempos);
        setSaveName(item.name);
        setIsSaving(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="space-y-5">
            <motion.div initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between border border-white/5 relative overflow-hidden">
                <div className="flex items-center gap-2 relative z-10">
                    <Clock className="text-emerald-400" size={16}/>
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-70">Tarifa Base</span>
                </div>
                <span className="font-black text-lg text-emerald-400 italic relative z-10">${formatUSD(COSTO_POR_MINUTO)} <span className="text-[9px] opacity-40">/ MIN</span></span>
            </motion.div>

            <LayoutGroup>
                <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                        {tiempos.map((t, idx) => (
                            <motion.div layout variants={itemVariants} initial="hidden" animate="visible" exit="exit" key={t.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3 group">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-500 h-6 w-6 rounded-lg p-0 flex items-center justify-center text-[9px] font-black">{idx + 1}</Badge>
                                        {editingId === t.id ? (
                                            <Input autoFocus className="h-7 w-32 rounded-md font-bold text-xs" value={t.name} onChange={e => setTiempos(tiempos.map(i => i.id === t.id ? {...i, name: e.target.value} : i))} onBlur={() => setEditingId(null)} />
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="font-black text-xs text-slate-700 dark:text-white italic">{t.name}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={() => setEditingId(t.id)}><Pencil size={12}/></Button>
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setTiempos(tiempos.length > 1 ? tiempos.filter(i => i.id !== t.id) : tiempos)} className="text-red-400 h-8 w-8"><Trash2 size={16}/></Button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><Label className="text-[8px] font-black text-slate-400 ml-1">Minutos</Label><Input type="number" className="rounded-xl h-9 text-xs font-bold" value={t.minutes || ""} onChange={e => setTiempos(tiempos.map(i => i.id === t.id ? {...i, minutes: parseFloat(e.target.value)||0} : i))} /></div>
                                    <div className="space-y-1"><Label className="text-[8px] font-black text-slate-400 ml-1">Segundos</Label><Input type="number" className="rounded-xl h-9 text-xs font-bold" value={t.seconds || ""} onChange={e => setTiempos(tiempos.map(i => i.id === t.id ? {...i, seconds: parseFloat(e.target.value)||0} : i))} /></div>
                                </div>
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <Checkbox checked={t.includeMaterial} onCheckedChange={v => setTiempos(tiempos.map(i => i.id === t.id ? {...i, includeMaterial: !!v} : i))} className="h-4 w-4" />
                                    <Label className="text-[9px] font-black text-slate-500 uppercase flex-1 cursor-pointer">Material Extra</Label>
                                    <AnimatePresence>
                                        {t.includeMaterial && (
                                            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }}>
                                                <Input type="number" placeholder="0.00" className="w-20 h-7 text-[10px] border-none font-black text-right text-blue-600" value={t.materialCost || ""} onChange={e => setTiempos(tiempos.map(i => i.id === t.id ? {...i, materialCost: parseFloat(e.target.value)||0} : i))} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </LayoutGroup>

            <Button variant="outline" onClick={() => setTiempos([...tiempos, { id: Date.now(), name: `Tiempo #${tiempos.length+1}`, minutes: 0, seconds: 0, includeMaterial: false, materialCost: 0 }])} className="w-full h-10 rounded-2xl border-dashed text-[10px] font-black text-slate-400 gap-2 hover:bg-slate-50">
                <Plus size={16}/> Añadir tiempo
            </Button>

            {resultado && (
                <div className="space-y-3">
                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-3xl flex items-center justify-between border border-slate-200/50">
                        <div><p className="text-[8px] font-black uppercase opacity-40">Tiempo Total</p><p className="text-2xl font-black italic text-slate-900 dark:text-white">{formatTime(resultado.totalMinutes)}</p></div>
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-300 shadow-inner"><ArrowLeftRight size={16} /></div>
                        <div className="text-right"><p className="text-[8px] font-black uppercase opacity-40">Costo Tiempo</p><p className="text-2xl font-black text-blue-600 italic tracking-tighter">${formatUSD(resultado.totalMinutes * COSTO_POR_MINUTO)}</p></div>
                    </div>

                    <PremiumResultWidget usdAmount={resultado.totalCost} rates={rates} title="Cotización Total Láser" />

                    {!isSaving ? (
                        <Button onClick={() => setIsSaving(true)} className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black gap-2 shadow-md transition-all"><Save size={16} /> Guardar</Button>
                    ) : (
                        <motion.div layout className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                            <Input placeholder="Cliente..." className="h-10 rounded-xl bg-white border-none font-bold px-4 text-xs flex-1" value={saveName} onChange={e => setSaveName(e.target.value)} />
                            <Button onClick={handleSave} className="h-10 px-5 bg-indigo-600 text-white rounded-xl font-black text-xs">OK</Button>
                            <Button variant="ghost" onClick={() => setIsSaving(false)} className="h-10 w-10 text-slate-400"><X size={18} /></Button>
                        </motion.div>
                    )}
                </div>
            )}
            
            <div className="pt-8 space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5 text-slate-400 font-black uppercase text-[9px] tracking-widest"><Clock size={12}/> Historial Láser</div>
                    <div className="relative w-40"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} /><Input placeholder="Buscar..." className="h-8 pl-8 rounded-lg bg-slate-100 dark:bg-slate-900 border-none text-[10px] font-bold" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div>
                </div>

                <motion.div key={`hist-laser-${currentPage}`} variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {paginatedHistory.map(h => (
                            <motion.div layout variants={historyItemVariants} exit="exit" key={h.id} className="bg-white dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-400 flex items-center justify-center"><Timer size={16}/></div>
                                    <div><p className="font-black text-xs text-slate-800 dark:text-white leading-tight">{h.name}</p><p className="text-[8px] font-bold text-slate-400 mt-0.5 tracking-tighter">{h.date}</p></div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-black text-indigo-600 text-sm mr-2">${formatUSD(h.totalCost)}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditFromHistory(h)} className="h-8 w-8 text-amber-500"><Pencil size={14}/></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedItem(h)} className="h-8 w-8 text-blue-500"><Eye size={14}/></Button>
                                    <Button variant="ghost" size="icon" onClick={async () => { if(confirm("¿Borrar?")) { await deleteLaserCalculation(h.id); setHistory(history.filter(i => i.id !== h.id)); } }} className="h-8 w-8 text-red-300"><Trash2 size={14}/></Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 pt-2">
                        <Button variant="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="h-8 w-8 p-0"><ChevronLeft size={16} /></Button>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Pág {currentPage} / {totalPages}</span>
                        <Button variant="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="h-8 w-8 p-0"><ChevronRight size={16} /></Button>
                    </div>
                )}
            </div>
            <ReceiptModal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} data={selectedItem} type="laser" rates={rates} />
        </div>
    );
};

// --- CALCULADORA 3: DIVISAS ---
const CurrencyConverterCalculator = ({ rates }: { rates: any }) => {
    const [inputAmount, setInputAmount] = useState("");
    const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR'>('USD');
    const [isForeignToBs, setIsForeignToBs] = useState(true);

    const currentRate = selectedCurrency === 'USD' ? rates.usdRate : rates.eurRate;
    const result = isForeignToBs ? (parseFloat(inputAmount)||0) * (currentRate||0) : (parseFloat(inputAmount)||0) / (currentRate||1);

    const handleSwapDirection = () => {
        if (result > 0) setInputAmount(result.toFixed(2));
        setIsForeignToBs(!isForeignToBs);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full sm:w-auto">
                    {['USD', 'EUR'].map((curr) => (
                        <motion.button key={curr} {...tapAnimation} onClick={() => setSelectedCurrency(curr as any)} className={cn("flex-1 px-6 py-2 rounded-lg text-[9px] font-black uppercase transition-all", selectedCurrency === curr ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>{curr}</motion.button>
                    ))}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100/50">
                    <Landmark className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase italic">BCV: {currentRate?.toFixed(2)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">{isForeignToBs ? selectedCurrency : 'Bolívares'}</Label>
                    <div className="relative group">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300 italic group-focus-within:text-blue-500 transition-colors">{isForeignToBs ? (selectedCurrency === 'USD' ? '$' : '€') : 'Bs'}</span>
                        <Input type="number" placeholder="0.00" className="h-16 rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 border-none text-2xl font-black pl-14 transition-all focus:ring-4 focus:ring-blue-500/5" value={inputAmount} onChange={e => setInputAmount(e.target.value)} />
                    </div>
                </div>

                <motion.button whileHover={{ rotate: 180, scale: 1.1 }} {...tapAnimation} onClick={handleSwapDirection} className="w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-lg flex items-center justify-center mx-auto z-10 md:-my-0 -my-4 border-4 border-white dark:border-slate-950">
                    <Repeat2 size={20} />
                </motion.button>

                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">{!isForeignToBs ? selectedCurrency : 'Bolívares'}</Label>
                    <div className="h-16 rounded-[1.5rem] bg-blue-600 flex flex-col justify-center px-10 text-white shadow-xl shadow-blue-500/10 relative overflow-hidden">
                        <p className="text-[8px] font-black uppercase opacity-60 italic mb-0.5 tracking-widest">Equivalente</p>
                        <h2 className="text-2xl font-black tracking-tighter italic z-10">{isForeignToBs ? 'Bs. ' : (selectedCurrency === 'USD' ? '$' : '€')}{isForeignToBs ? formatBs(result) : formatUSD(result)}</h2>
                        <div className="absolute right-0 top-0 p-4 opacity-10 rotate-12"><Landmark size={80}/></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- VISTA PRINCIPAL ---
const CalculatorView = () => {
    const [activeTab, setActiveTab] = useState("currency");
    const [rates, setRates] = useState<any>({ usdRate: null, eurRate: null, loading: true });

    useEffect(() => {
        fetchBCVRateFromAPI().then(data => {
            setRates({ usdRate: parseFloat((data as any).usdRate)||0, eurRate: parseFloat((data as any).eurRate)||0, loading: false });
        });
    }, []);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8 pb-20">
            <header className="flex flex-row justify-between items-center px-4">
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/20"><CalcIcon size={24}/></div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic leading-none">Calculadora</h1>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1.5">Siskoven v2.5</p>
                    </div>
                </motion.div>
                <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex gap-2">
                    <Badge className="rounded-xl bg-white dark:bg-slate-900 text-blue-600 border border-slate-100 dark:border-slate-800 px-4 py-3 font-black italic text-sm shadow-sm">
                        <span className="opacity-40 text-[10px] mr-1">$</span> {rates.usdRate?.toFixed(2)}
                    </Badge>
                </motion.div>
            </header>

            <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-slate-200/50 bg-white dark:bg-slate-950 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="px-6 pt-6">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-[1.8rem] h-14 gap-2">
                            {[
                                { id: 'currency', label: 'Divisas', icon: DollarSign },
                                { id: 'area', label: 'Área M2', icon: Ruler },
                                { id: 'laser', label: 'Láser', icon: Timer },
                            ].map((tab) => (
                                <TabsTrigger 
                                    key={tab.id} value={tab.id} 
                                    className="rounded-2xl font-black uppercase text-[10px] data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-lg data-[state=active]:text-blue-600 gap-2 transition-all duration-300"
                                >
                                    <tab.icon size={16} className={cn(activeTab === tab.id ? "scale-110" : "opacity-40")} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="min-h-[500px] p-6 md:p-8">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={activeTab} 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                            >
                                {activeTab === "currency" && <CurrencyConverterCalculator rates={rates} />}
                                {activeTab === "area" && <MetroCuadradoCalculator rates={rates} />}
                                {activeTab === "laser" && <LaserCutsCalculator rates={rates} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </Tabs>
            </Card>
           
        </motion.div>
    );
};

export default CalculatorView;