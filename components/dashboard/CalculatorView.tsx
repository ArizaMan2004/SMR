"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Calculator as CalcIcon, Ruler, DollarSign, Timer, Euro, Trash2, Plus, Loader2,
    Repeat2, Save, FolderOpen, X, Clock, Eye, Receipt, Pencil, Check, Box, ArrowLeftRight, Undo2
} from "lucide-react";
import { fetchBCVRateFromAPI } from "@/lib/bcv-service";

// IMPORTAMOS EL NUEVO SERVICIO QUE ACABAMOS DE CREAR
import { 
    saveAreaCalculation, getAreaHistory, deleteAreaCalculation,
    saveLaserCalculation, getLaserHistory, deleteLaserCalculation,
    AreaCalculation, LaserCalculation
} from "@/lib/services/firestore-calculator-service";

// --- TIPADOS ---
interface ExchangeRates {
    usdRate: number | null;
    eurRate: number | null;
    loading: boolean;
    error: string | null;
}

// --- UTILIDADES ---
const formatTimeInMinutes = (totalMinutes: number): string => {
    if (totalMinutes < 0) return "00:00";
    const minutes = Math.floor(totalMinutes);
    const secondsDecimal = (totalMinutes - minutes) * 60;
    const seconds = Math.round(secondsDecimal);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatCurrencyBs = (amount: number | null): string => {
    if (amount === null || isNaN(amount)) return "0,00";
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

const formatCurrencyForeign = (amount: number | null): string => {
    if (amount === null || isNaN(amount)) return "0.00";
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

// --- COMPONENTE: MODAL DE RECIBO ---
interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any; 
    type: 'area' | 'laser';
    rates: ExchangeRates;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, data, type, rates }) => {
    const [conversionMode, setConversionMode] = useState<'USD' | 'EUR'>('USD');
    if (!isOpen || !data) return null;

    const activeRate = conversionMode === 'USD' ? rates.usdRate : rates.eurRate;
    const totalBs = activeRate ? data.totalCost * activeRate : 0;
    const toggleConversionMode = () => setConversionMode(prev => prev === 'USD' ? 'EUR' : 'USD');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
                <div className="bg-primary/10 p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                    <div><h3 className="text-xl font-bold text-primary flex items-center gap-2"><Receipt className="w-5 h-5" /> Presupuesto</h3><p className="text-sm text-muted-foreground mt-1 uppercase tracking-wide font-semibold">{data.name}</p></div>
                    <div className="text-right"><p className="text-xs text-muted-foreground">Fecha</p><p className="text-sm font-medium">{data.date}</p></div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Tabla simple de detalles */}
                    <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium">
                                <tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">$$</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {type === 'area' ? data.mediciones.map((m: any, i: number) => (
                                    <tr key={i}><td className="px-3 py-2">{m.name} <span className="text-xs text-gray-400">({m.cmAlto}x{m.cmAncho})</span></td><td className="px-3 py-2 text-right">${(((m.cmAlto/100)*(m.cmAncho/100))*m.precioDolar).toFixed(2)}</td></tr>
                                )) : data.tiempos.map((t: any, i: number) => (
                                    <tr key={i}><td className="px-3 py-2">{t.name} <span className="text-xs text-gray-400">({t.minutes}m {t.seconds}s)</span></td><td className="px-3 py-2 text-right">ref</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center text-lg font-bold text-gray-800 dark:text-gray-100"><span>Total USD:</span><span className="text-green-600">${data.totalCost.toFixed(2)}</span></div>
                    {activeRate && (<div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 relative"><div className="flex justify-between items-start mb-1"><span className="text-sm text-blue-800 dark:text-blue-300 font-semibold mt-1">Total en Bolívares:</span><Button size="sm" variant="outline" onClick={toggleConversionMode} className="h-6 text-[10px] px-2"><ArrowLeftRight className="w-3 h-3 mr-1" />{conversionMode === 'USD' ? 'Tasa BCV ($)' : 'Tasa BCV (€)'}</Button></div><div className="text-right"><span className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 block leading-none mt-1">Bs {formatCurrencyBs(totalBs)}</span></div></div>)}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t flex justify-end"><Button onClick={onClose} variant="secondary">Cerrar</Button></div>
            </div>
        </div>
    );
};

// --- COMPONENTE RESULTADO ---
const MultiCurrencyResult: React.FC<{ usdAmount: number | null; rates: ExchangeRates; title: string; }> = ({ usdAmount, rates, title }) => {
    if (usdAmount === null || usdAmount <= 0) return null;
    const bsAmount_usdRate = rates.usdRate ? usdAmount * rates.usdRate : null;
    return (
        <div className="mt-4 p-4 border rounded-md bg-green-50 dark:bg-green-900/20 space-y-2">
            <h4 className="font-semibold text-lg">{title}:</h4>
            <div className="flex justify-between items-center"><span className="text-xl font-bold text-green-600 dark:text-green-400">${usdAmount.toFixed(2)} USD</span><DollarSign className="w-5 h-5 text-green-600" /></div>
            {bsAmount_usdRate !== null && (<div className="flex justify-between text-base font-bold text-primary border-t pt-2"><span className="font-bold">Total Bs:</span><strong className="text-2xl font-extrabold text-blue-600">Bs {formatCurrencyBs(bsAmount_usdRate)}</strong></div>)}
        </div>
    );
};

// --- CÁLCULO 1: COSTO POR METRO CUADRADO (CON FIREBASE) ---
interface Measurement { id: number; name: string; cmAlto: number; cmAncho: number; precioDolar: number; }

const MetroCuadradoCalculator: React.FC<{ rates: ExchangeRates }> = ({ rates }) => {
    const [mediciones, setMediciones] = useState<Measurement[]>([{ id: Date.now(), name: "Medición #1", cmAlto: 0, cmAncho: 0, precioDolar: 0 }]);
    const [resultadoTotal, setResultadoTotal] = useState<number | null>(null);
    const [totalM2, setTotalM2] = useState<number>(0);
    const [editingNameId, setEditingNameId] = useState<number | null>(null);

    // Estados Firebase
    const [history, setHistory] = useState<AreaCalculation[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingToDb, setIsSavingToDb] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [selectedItem, setSelectedItem] = useState<AreaCalculation | null>(null);

    // CARGAR HISTORIAL AL INICIO
    useEffect(() => {
        const load = async () => {
            setIsLoadingHistory(true);
            const data = await getAreaHistory();
            setHistory(data);
            setIsLoadingHistory(false);
        };
        load();
    }, []);

    const calcularInstantaneo = useCallback(() => {
        let costoTotalAcumulado = 0; let m2TotalAcumulado = 0; let algunaMedicionValida = false;
        mediciones.forEach(m => {
            if (m.cmAlto > 0 && m.cmAncho > 0 && m.precioDolar > 0) {
                const m2 = (m.cmAlto / 100) * (m.cmAncho / 100);
                m2TotalAcumulado += m2; costoTotalAcumulado += (m2 * m.precioDolar); algunaMedicionValida = true;
            }
        });
        setTotalM2(m2TotalAcumulado); setResultadoTotal(algunaMedicionValida ? costoTotalAcumulado : null);
    }, [mediciones]);
    useEffect(() => { calcularInstantaneo(); }, [calcularInstantaneo]);

    const addMeasurementEntry = () => { const newId = Date.now(); setMediciones([...mediciones, { id: newId, name: `Medición #${mediciones.length + 1}`, cmAlto: 0, cmAncho: 0, precioDolar: 0 }]); };
    const updateMeasurementEntry = (id: number, field: keyof Omit<Measurement, 'id'>, value: any) => { setMediciones(mediciones.map(m => m.id === id ? { ...m, [field]: value } : m)); };
    const removeMeasurementEntry = (id: number) => { const newM = mediciones.filter(m => m.id !== id); setMediciones(newM.length > 0 ? newM : [{ id: Date.now(), name: "Medición #1", cmAlto: 0, cmAncho: 0, precioDolar: 0 }]); };

    // GUARDAR EN BD
    const handleSaveOperation = async () => {
        if (!saveName.trim() || resultadoTotal === null) return;
        setIsSavingToDb(true);
        try {
            const newItem = await saveAreaCalculation({
                name: saveName,
                date: new Date().toLocaleDateString(),
                mediciones: mediciones,
                totalCost: resultadoTotal,
                totalM2: totalM2
            });
            setHistory([newItem as AreaCalculation, ...history]);
            setIsSaving(false); setSaveName("");
        } catch (e) { alert("Error al guardar"); } finally { setIsSavingToDb(false); }
    };

    // BORRAR DE BD
    const handleDeleteOperation = async (id: string) => {
        if(!confirm("¿Borrar permanentemente?")) return;
        try { await deleteAreaCalculation(id); setHistory(history.filter(h => h.id !== id)); } catch(e) { alert("Error al borrar"); }
    };

    const handleLoadOperation = (item: AreaCalculation) => { if(confirm(`¿Cargar "${item.name}"?`)) setMediciones(item.mediciones); };

    return (
        <>
            <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">Fórmula: (Alto/100) × (Ancho/100) × Precio/m²</p>
                {mediciones.map((m) => (
                    <div key={m.id} className="border p-4 rounded-lg space-y-4 shadow-sm relative">
                        <div className="flex justify-between items-center h-10">
                            {editingNameId === m.id ? (
                                <div className="flex items-center gap-2 flex-1 max-w-[250px]"><Input value={m.name} onChange={(e) => updateMeasurementEntry(m.id, 'name', e.target.value)} onBlur={() => setEditingNameId(null)} autoFocus className="h-8 text-sm"/></div>
                            ) : (
                                <div className="flex items-center gap-2 group"><h4 className="text-base font-bold text-primary truncate">{m.name}</h4><Button variant="ghost" size="icon" className="h-6 w-6 opacity-50" onClick={() => setEditingNameId(m.id)}><Pencil className="w-3 h-3" /></Button></div>
                            )}
                            {mediciones.length > 1 && (<Button variant="destructive" size="icon" onClick={() => removeMeasurementEntry(m.id)} className="w-8 h-8"><Trash2 className="w-4 h-4" /></Button>)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1"><label className="text-sm font-medium">Alto (cm)</label><Input type="number" value={m.cmAlto} onChange={(e) => updateMeasurementEntry(m.id, 'cmAlto', parseFloat(e.target.value))} placeholder="50"/></div>
                            <div className="space-y-1"><label className="text-sm font-medium">Ancho (cm)</label><Input type="number" value={m.cmAncho} onChange={(e) => updateMeasurementEntry(m.id, 'cmAncho', parseFloat(e.target.value))} placeholder="80"/></div>
                            <div className="space-y-1"><label className="text-sm font-medium">Precio/m² ($)</label><Input type="number" value={m.precioDolar} onChange={(e) => updateMeasurementEntry(m.id, 'precioDolar', parseFloat(e.target.value))} placeholder="25"/></div>
                        </div>
                    </div>
                ))}
                
                <Button variant="secondary" onClick={addMeasurementEntry} className="w-full mt-4"><Plus className="w-4 h-4 mr-2" /> Añadir Medición</Button>

                <div className="space-y-4">
                    <MultiCurrencyResult usdAmount={resultadoTotal} rates={rates} title="Costo Total Estimado" />
                    {resultadoTotal !== null && resultadoTotal > 0 && (
                        !isSaving ? (
                            <Button onClick={() => setIsSaving(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white"><Save className="w-4 h-4 mr-2" /> Guardar en Nube</Button>
                        ) : (
                            <div className="p-4 border bg-blue-50 dark:bg-blue-900/20 rounded-md flex gap-2">
                                <Input placeholder="Nombre Cliente / Negocio" value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus disabled={isSavingToDb} />
                                <Button onClick={handleSaveOperation} disabled={!saveName.trim() || isSavingToDb}>{isSavingToDb ? <Loader2 className="w-4 h-4 animate-spin"/> : "Guardar"}</Button>
                                <Button variant="ghost" size="icon" onClick={() => setIsSaving(false)} disabled={isSavingToDb}><X className="w-4 h-4" /></Button>
                            </div>
                        )
                    )}
                </div>

                <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-bold flex items-center mb-4"><FolderOpen className="w-5 h-5 mr-2" /> Historial en Nube (m²)</h3>
                    {isLoadingHistory ? <div className="flex justify-center py-4 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2"/> Cargando...</div> : (
                        history.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-800 text-xs uppercase"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Total</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead>
                                    <tbody>
                                        {history.map((item) => (
                                            <tr key={item.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <td className="px-3 py-2"><div className="font-bold">{item.name}</div><div className="text-[10px] text-gray-500">{item.date}</div></td>
                                                <td className="px-3 py-2 font-bold text-green-600">${item.totalCost.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right flex justify-end gap-1">
                                                    <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 border-blue-200" onClick={() => setSelectedItem(item)}><Eye className="w-4 h-4" /></Button>
                                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleLoadOperation(item)}><Pencil className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => item.id && handleDeleteOperation(item.id)}><Trash2 className="w-4 h-4" /></Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-sm text-gray-400 text-center py-4">No hay registros guardados.</p>
                    )}
                </div>
            </CardContent>
            <ReceiptModal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} data={selectedItem} type="area" rates={rates} />
        </>
    );
};


// --- CÁLCULO 2: CORTES LÁSER (CON FIREBASE) ---
interface TimeEntry { id: number; name: string; minutes: number; seconds: number; includeMaterial: boolean; materialCost: number; }

const LaserCutsCalculator: React.FC<{ rates: ExchangeRates }> = ({ rates }) => {
    const [tiempos, setTiempos] = useState<TimeEntry[]>([{ id: Date.now(), name: "Corte #1", minutes: 0, seconds: 0, includeMaterial: false, materialCost: 0 }]);
    const COSTO_POR_MINUTO = 0.80;
    const [resultado, setResultado] = useState<{ totalMinutes: number; totalCost: number } | null>(null);
    const [editingNameId, setEditingNameId] = useState<number | null>(null);

    // Estados Firebase
    const [history, setHistory] = useState<LaserCalculation[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingToDb, setIsSavingToDb] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [selectedItem, setSelectedItem] = useState<LaserCalculation | null>(null);

    // CARGAR HISTORIAL
    useEffect(() => {
        const load = async () => {
            setIsLoadingHistory(true);
            const data = await getLaserHistory();
            setHistory(data);
            setIsLoadingHistory(false);
        };
        load();
    }, []);

    const calcularInstantaneo = useCallback(() => {
        let totalTimeInMinutes = 0; let totalMaterialCost = 0;
        tiempos.forEach(t => { 
            totalTimeInMinutes += (Math.max(0, t.minutes||0) + (Math.max(0, t.seconds||0)/60)); 
            if (t.includeMaterial) totalMaterialCost += (t.materialCost || 0);
        });
        if (totalTimeInMinutes <= 0 && totalMaterialCost <= 0) { setResultado(null); return; }
        setResultado({ totalMinutes: totalTimeInMinutes, totalCost: (totalTimeInMinutes * COSTO_POR_MINUTO) + totalMaterialCost });
    }, [tiempos]);
    useEffect(() => { calcularInstantaneo(); }, [calcularInstantaneo]);

    const updateTimeEntry = (id: number, field: keyof Omit<TimeEntry, 'id'>, value: any) => { setTiempos(tiempos.map(t => t.id === id ? { ...t, [field]: value } : t)); };
    const addTimeEntry = () => { setTiempos([...tiempos, { id: Date.now(), name: `Corte #${tiempos.length + 1}`, minutes: 0, seconds: 0, includeMaterial: false, materialCost: 0 }]); };
    const removeTimeEntry = (id: number) => { const newT = tiempos.filter(t => t.id !== id); setTiempos(newT.length > 0 ? newT : [{ id: Date.now(), name: "Corte #1", minutes: 0, seconds: 0, includeMaterial: false, materialCost: 0 }]); };

    // GUARDAR BD
    const handleSaveOperation = async () => {
        if (!saveName.trim() || resultado === null) return;
        setIsSavingToDb(true);
        try {
            const newItem = await saveLaserCalculation({
                name: saveName,
                date: new Date().toLocaleDateString(),
                tiempos: tiempos,
                totalMinutes: resultado.totalMinutes,
                totalCost: resultado.totalCost
            });
            setHistory([newItem as LaserCalculation, ...history]);
            setIsSaving(false); setSaveName("");
        } catch (e) { alert("Error al guardar"); } finally { setIsSavingToDb(false); }
    };

    const handleDeleteOperation = async (id: string) => {
        if(!confirm("¿Borrar permanentemente?")) return;
        try { await deleteLaserCalculation(id); setHistory(history.filter(i => i.id !== id)); } catch(e) { alert("Error borrando"); }
    };
    const handleLoadOperation = (item: LaserCalculation) => { if(confirm(`¿Cargar "${item.name}"?`)) setTiempos(item.tiempos); };

    return (
        <>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Costo: ${COSTO_POR_MINUTO.toFixed(2)} por minuto.</p>
                {tiempos.map((t) => (
                     <div key={t.id} className="flex flex-col border-b pb-4 mb-4 bg-gray-50/50 dark:bg-gray-800/20 p-3 rounded-md">
                        <div className="flex justify-between items-center mb-3 h-8">
                             {editingNameId === t.id ? (
                                <div className="flex items-center gap-2 flex-1 max-w-[200px]"><Input value={t.name} onChange={(e) => updateTimeEntry(t.id, 'name', e.target.value)} onBlur={() => setEditingNameId(null)} autoFocus className="h-7 text-sm"/></div>
                            ) : (
                                <div className="flex items-center gap-2 group"><label className="text-base font-bold block">{t.name}</label><Button variant="ghost" size="icon" className="h-6 w-6 opacity-50" onClick={() => setEditingNameId(t.id)}><Pencil className="w-3 h-3" /></Button></div>
                            )}
                            {tiempos.length > 1 && (<Button variant="destructive" size="icon" onClick={() => removeTimeEntry(t.id)} className="h-8 w-8"><Trash2 className="w-4 h-4" /></Button>)}
                        </div>
                        <div className="flex space-x-2 items-end mb-3">
                            <div className="flex-1"><label className="text-sm font-medium">Minutos</label><Input type="number" value={t.minutes} onChange={(e) => updateTimeEntry(t.id, 'minutes', parseFloat(e.target.value))} placeholder="0" className="bg-white dark:bg-slate-950"/></div>
                            <div className="flex-1"><label className="text-sm font-medium">Segundos</label><Input type="number" value={t.seconds} onChange={(e) => updateTimeEntry(t.id, 'seconds', parseFloat(e.target.value))} placeholder="0" className="bg-white dark:bg-slate-950"/></div>
                        </div>
                        <div className="flex flex-col gap-2 bg-white dark:bg-slate-950 p-2 rounded border border-dashed">
                            <div className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" checked={t.includeMaterial || false} onChange={(e) => updateTimeEntry(t.id, 'includeMaterial', e.target.checked)}/><label className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-1"><Box className="w-3.5 h-3.5" /> Suministrar Material</label></div>
                            {t.includeMaterial && (<div className="animate-in fade-in slide-in-from-top-1 pl-6"><label className="text-xs text-muted-foreground block mb-1">Costo del Material ($)</label><div className="relative"><DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500"/><Input type="number" className="h-8 text-sm pl-6" placeholder="0.00" value={t.materialCost || 0} onChange={(e) => updateTimeEntry(t.id, 'materialCost', parseFloat(e.target.value) || 0)}/></div></div>)}
                        </div>
                    </div>
                ))}
                <Button variant="secondary" onClick={addTimeEntry} className="w-full mt-2"><Plus className="w-4 h-4 mr-2" /> Otro Tiempo</Button>
                
                {resultado?.totalMinutes !== undefined && resultado.totalMinutes > 0 && (<div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-md"><p className="text-lg font-semibold">Total Tiempo: <strong className="text-blue-600">{formatTimeInMinutes(resultado.totalMinutes)}</strong></p></div>)}

                <div className="space-y-4">
                    <MultiCurrencyResult usdAmount={resultado ? resultado.totalCost : null} rates={rates} title="Costo Total" />
                    {resultado !== null && resultado.totalCost > 0 && (
                        !isSaving ? (
                            <Button onClick={() => setIsSaving(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white"><Save className="w-4 h-4 mr-2" /> Guardar en Nube</Button>
                        ) : (
                            <div className="p-4 border bg-blue-50 rounded-md flex gap-2">
                                <Input placeholder="Nombre Cliente" value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus disabled={isSavingToDb} />
                                <Button onClick={handleSaveOperation} disabled={!saveName.trim() || isSavingToDb}>{isSavingToDb ? <Loader2 className="w-4 h-4 animate-spin"/> : "Guardar"}</Button>
                                <Button variant="ghost" size="icon" onClick={() => setIsSaving(false)} disabled={isSavingToDb}><X className="w-4 h-4" /></Button>
                            </div>
                        )
                    )}
                </div>

                <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-bold flex items-center mb-4"><Clock className="w-5 h-5 mr-2" /> Historial en Nube</h3>
                    {isLoadingHistory ? <div className="flex justify-center py-4 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2"/> Cargando...</div> : (
                        history.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-gray-800 text-xs uppercase"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Tiempo</th><th className="px-3 py-2">Total</th><th className="px-3 py-2 text-right">Acciones</th></tr></thead>
                                    <tbody>
                                        {history.map((item) => (
                                            <tr key={item.id} className="border-b hover:bg-gray-50">
                                                <td className="px-3 py-2"><div className="font-bold">{item.name}</div><div className="text-[10px] text-gray-500">{item.date}</div></td>
                                                <td className="px-3 py-2">{formatTimeInMinutes(item.totalMinutes)}</td>
                                                <td className="px-3 py-2 font-bold text-green-600">${item.totalCost.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right flex justify-end gap-1">
                                                    <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 border-blue-200" onClick={() => setSelectedItem(item)}><Eye className="w-4 h-4" /></Button>
                                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleLoadOperation(item)}><Pencil className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => item.id && handleDeleteOperation(item.id)}><Trash2 className="w-4 h-4" /></Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-sm text-gray-400 text-center py-4">No hay registros guardados.</p>
                    )}
                </div>
            </CardContent>
            <ReceiptModal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} data={selectedItem} type="laser" rates={rates} />
        </>
    );
};

// --- CALCULADORA DE DIVISAS (Mismo componente de antes) ---
const CurrencyConverterCalculator: React.FC<{ rates: ExchangeRates }> = ({ rates }) => {
    const { usdRate, eurRate, loading, error } = rates;
    const [inputAmount, setInputAmount] = useState<string>(""); 
    const [additionList, setAdditionList] = useState<number[]>([]); 
    const [isForeignToBs, setIsForeignToBs] = useState(true); 
    const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR'>('USD'); 
    const [result, setResult] = useState<number | null>(null);

    const currentRate = selectedCurrency === 'USD' ? usdRate : eurRate;
    const otherRateAvailable = selectedCurrency === 'USD' ? (eurRate !== null) : (usdRate !== null);

    const currentInputVal = parseFloat(inputAmount) || 0;
    const totalFromList = additionList.reduce((acc, curr) => acc + curr, 0);
    const effectiveTotal = totalFromList + currentInputVal;

    const handleCalculate = useCallback((amount: number, foreignToBs: boolean, rate: number | null) => {
        if (rate === null || amount < 0) { setResult(null); return; } 
        setResult(foreignToBs ? amount * rate : amount / rate);
    }, []);

    useEffect(() => { handleCalculate(effectiveTotal, isForeignToBs, currentRate); }, [effectiveTotal, currentRate, isForeignToBs, handleCalculate]);

    const toggleCurrency = () => setSelectedCurrency(prev => prev === 'USD' ? 'EUR' : 'USD');
    const toggleDirection = () => {
        const newDirection = !isForeignToBs;
        const newInputValue = (result !== null && result > 0) ? result : parseFloat(inputAmount) || 0;
        setIsForeignToBs(newDirection); setAdditionList([]); setInputAmount(newInputValue.toFixed(2));
    };

    const handleAddToTotal = () => {
        const val = parseFloat(inputAmount);
        if (!isNaN(val) && val > 0) { setAdditionList([...additionList, val]); setInputAmount(""); }
    };

    const handleUndoLast = () => { setAdditionList(prev => prev.slice(0, -1)); };
    const handleClearAll = () => { setAdditionList([]); setInputAmount(""); };
    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleAddToTotal(); } };

    const fromCurrency = isForeignToBs ? selectedCurrency : 'Bs';
    const toCurrency = isForeignToBs ? 'Bs' : selectedCurrency;
    const formattedRate = currentRate !== null ? formatCurrencyBs(currentRate) : "N/A";
    const formattedResult = isForeignToBs ? formatCurrencyBs(result) : formatCurrencyForeign(result);

    return (
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Convierte entre Bolívares (Bs) y {selectedCurrency}. Puedes sumar varios montos.</p>
            {loading && <div className="p-4 bg-yellow-50 text-yellow-700 flex items-center rounded-md"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Cargando tasas...</div>}
            {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}
            {currentRate && !loading && (
                <>
                    <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-md"><span className="text-sm font-semibold">Tasa BCV:</span><span className="text-lg font-bold text-primary">Bs {formattedRate}</span></div>
                    {additionList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-dashed animate-in fade-in slide-in-from-top-2">
                            <span className="text-xs font-bold text-gray-500 mr-1">SUMANDO:</span>
                            {additionList.map((val, idx) => (<span key={idx} className="bg-white dark:bg-gray-700 border px-2 py-0.5 rounded text-sm flex items-center shadow-sm">{val}{idx < additionList.length - 1 && <span className="ml-2 text-gray-400">+</span>}</span>))}
                            <div className="flex-1"></div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-red-500" onClick={handleUndoLast} title="Borrar último"><Undo2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={handleClearAll} title="Limpiar todo"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                    )}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2 relative">
                            <label className="text-sm font-medium">Monto ({fromCurrency}) {additionList.length > 0 && <span className="text-green-600 text-xs ml-1">(Total: {effectiveTotal.toFixed(2)})</span>}</label>
                            <div className="flex gap-1">
                                <Input type="number" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} onKeyDown={handleKeyDown} placeholder="0" className="text-lg font-semibold"/>
                                <Button onClick={handleAddToTotal} disabled={!inputAmount || parseFloat(inputAmount) <= 0} variant="secondary" className="px-3" title="Sumar monto (Enter)"><Plus className="w-5 h-5" /></Button>
                            </div>
                        </div>
                        <Button variant="outline" size="icon" onClick={toggleDirection} className="mb-0.5"><Repeat2 className="w-4 h-4" /></Button>
                        <div className="flex-1 space-y-2"><label className="text-sm font-medium">Resultado Total ({toCurrency})</label><Input type="text" value={formattedResult} readOnly className="text-lg font-semibold bg-primary/10 border-primary"/></div>
                    </div>
                    {otherRateAvailable && (<Button variant="outline" onClick={toggleCurrency} className="w-full mt-2 gap-2"><Euro className="w-4 h-4" />Cambiar a {selectedCurrency === 'USD' ? 'EUR' : 'USD'}</Button>)}
                </>
            )}
        </CardContent>
    );
};

// --- COMPONENTE PRINCIPAL (VISTA) ---
const CalculatorView: React.FC = () => {
    const [activeTab, setActiveTab] = useState("currency");
    const [rates, setRates] = useState<ExchangeRates>({ usdRate: null, eurRate: null, loading: true, error: null });

    useEffect(() => {
        const loadRates = async () => {
            try {
                setRates(r => ({ ...r, loading: true, error: null }));
                const data = await fetchBCVRateFromAPI();
                setRates({
                    usdRate: (data as any).usdRate ? parseFloat((data as any).usdRate) : null,
                    eurRate: (data as any).eurRate ? parseFloat((data as any).eurRate) : null,
                    loading: false, error: null,
                });
            } catch (err) { setRates(r => ({ ...r, loading: false, error: "Error tasas BCV." })); }
        };
        loadRates();
    }, []);

    return (
        <div className="p-4 lg:p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <Card>
                    <CardHeader><CardTitle className="flex items-center text-3xl font-bold"><CalcIcon className="w-7 h-7 mr-3 text-primary" />Calculadora de Producción</CardTitle></CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="currency"><DollarSign className="w-4 h-4 mr-1"/> Divisas</TabsTrigger>
                                <TabsTrigger value="area"><Ruler className="w-4 h-4 mr-1"/> Costo m²</TabsTrigger>
                                <TabsTrigger value="laser"><Timer className="w-4 h-4 mr-1"/> Láser</TabsTrigger>
                            </TabsList>
                            <TabsContent value="currency"><CurrencyConverterCalculator rates={rates} /></TabsContent>
                            <TabsContent value="area"><MetroCuadradoCalculator rates={rates} /></TabsContent>
                            <TabsContent value="laser"><LaserCutsCalculator rates={rates} /></TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CalculatorView;