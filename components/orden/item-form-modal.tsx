// @/components/orden/item-form-modal.tsx
"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react" 
import { motion, AnimatePresence } from "framer-motion"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import { 
    X, Scissors, Hash, DollarSign, Box, Type, 
    User, Calculator, Layers, Palette, MoveVertical, AlertCircle, Clock, Printer
} from "lucide-react"

// --- CONSTANTES ---
const PRECIO_LASER_POR_MINUTO = 0.80;
const PERSONAL_TALLER = ["Marcos", "Samuel", "Daniela", "Jose Angel", "Daniel Montero"];
const MATERIALES_CORTE = ["Acrilico", "MDF", "Melamina", "Cartulina", "Otro"] as const;
const GROSORES = Array.from({ length: 12 }, (_, i) => `${i + 1}mm`);

// --- CONSTANTES DE IMPRESIÓN ---
const MATERIALES_IMPRESION = [
    "Banner", "Banner Mate", "Banner Cara Negra",
    "Vinil Brillante", "Vinil Mate", "Clear", "DTF", "Stickers",
    "Vinil Textil", "Vinil Blackout", "Microperforado", "Tornasol", "Esmerilado",
    "Vinil con Corte"
];

// --- FUNCIONES DE VALIDACIÓN ESTRICTA ---
const isBanner = (mat: string) => mat.toLowerCase().includes('banner');
const isSticker = (mat: string) => mat.toLowerCase() === 'stickers';
const isClear = (mat: string) => mat.toLowerCase() === 'clear';
const isVinilPegable = (mat: string) => {
    const v = mat.toLowerCase();
    return (v.includes('vinil') && !v.includes('textil') && !v.includes('corte')) || ['microperforado', 'tornasol', 'esmerilado'].includes(v);
};

const COLORES_PREDEFINIDOS = [
    { value: "Transparente", label: "Transparente", emoji: "💎" },
    { value: "Blanco", label: "Blanco", emoji: "⬜" },
    { value: "Negro", label: "Negro", emoji: "⬛" },
    { value: "Rojo", label: "Rojo", emoji: "🟥" },
    { value: "Dorado", label: "Dorado", emoji: "🪙" },
    { value: "Espejo (Plateado)", label: "Espejo (Plateado)", emoji: "💿" },
];

const getInitialState = () => ({
  nombre: "",
  tipoServicio: "OTROS",
  cantidad: 1,
  unidad: "und",
  precioUnitario: 0,
  modoCobroLaser: "tiempo", 
  materialDeCorte: "Acrilico",
  grosorMaterial: "3mm",
  colorAcrilico: "Transparente",
  nuevoColorCustom: "",
  
  // --- ESTADOS IMPRESIÓN ---
  materialImpresion: "Vinil Brillante",
  impresionConCorte: false,
  
  // --- ESTADOS PEGADO (PVC / Acrilico) ---
  impresionPegado: false,
  tipoPegado: "PVC", // 'PVC' | 'Acrilico'
  proveedorPegado: "taller", // 'taller' o 'cliente'
  precioPegado: 0,
  
  impresionOjales: false,
  impresionBolsillos: false,
  impresionTubos: false,
  impresionRefilado: false,
  
  // --- ESTADOS LAMINADO ---
  impresionLaminado: false,
  tipoCobroLaminado: "y", // 'x', 'y', 'manual'
  precioLaminadoLineal: 0,
  precioLaminadoManual: 0,

  medidaXCm: 0,
  medidaYCm: 0,
  empleadoAsignado: "N/A", 
  suministrarMaterial: false,
  costoMaterialExtra: 0,
  subtotal: 0,
});

export function ItemFormModal({ 
    isOpen, onClose, onAddItem, itemToEdit, designers = [], 
    customColors = [], onRegisterColor 
}: any) {
  const [state, setState] = useState<any>(getInitialState());
  const [horas, setHoras] = useState('0');
  const [minutos, setMinutos] = useState('0');
  const [segundos, setSegundos] = useState('00');
  const [errors, setErrors] = useState<any>({});

  const allColors = useMemo(() => {
    const uniqueColors = new Map();
    COLORES_PREDEFINIDOS.forEach(c => uniqueColors.set(c.value, c));
    customColors.forEach((c: any) => uniqueColors.set(c.value, c));
    return Array.from(uniqueColors.values());
  }, [customColors]);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
          if (itemToEdit.unidad === 'tiempo' && itemToEdit.tiempoCorte) {
             const parts = itemToEdit.tiempoCorte.split(':');
             if (parts.length === 3) {
                 setHoras(parts[0] || '0');
                 setMinutos(parts[1] || '0');
                 setSegundos(parts[2] || '00');
             } else {
                 setHoras('0');
                 setMinutos(parts[0] || '0'); 
                 setSegundos(parts[1] || '00');
             }
          }
          setState({ ...getInitialState(), ...itemToEdit, nuevoColorCustom: "" });
      } else {
          setState(getInitialState());
          setHoras('0'); setMinutos('0'); setSegundos('00');
      }
      setErrors({}); 
    }
  }, [isOpen, itemToEdit]);

  // LÓGICA DE CÁLCULO
  useEffect(() => {
    let costoBaseUnitario = 0;
    const { 
        cantidad, precioUnitario, unidad, medidaXCm, medidaYCm, suministrarMaterial, 
        costoMaterialExtra, tipoServicio, modoCobroLaser, impresionLaminado, 
        tipoCobroLaminado, precioLaminadoLineal, precioLaminadoManual,
        impresionPegado, proveedorPegado, precioPegado
    } = state; 
    
    const cantidadCalculo = cantidad > 0 ? cantidad : 0;

    if (cantidadCalculo > 0 || (modoCobroLaser === 'tiempo' && tipoServicio === 'CORTE')) {
        if (tipoServicio === 'CORTE' && modoCobroLaser === 'tiempo') {
            const h = parseFloat(horas) || 0;
            const m = parseFloat(minutos) || 0;
            const s = parseFloat(segundos) || 0;
            const totalMinutes = (h * 60) + m + (s / 60);
            costoBaseUnitario = totalMinutes * PRECIO_LASER_POR_MINUTO;
        } else if (unidad === 'm2' && medidaXCm > 0 && medidaYCm > 0) {
            costoBaseUnitario = (medidaXCm / 100) * (medidaYCm / 100) * precioUnitario;
            
            if (tipoServicio === 'IMPRESION') {
                if (impresionLaminado) {
                    if (tipoCobroLaminado === 'x' && precioLaminadoLineal > 0) {
                        const metrosLineales = medidaXCm / 100;
                        costoBaseUnitario += (metrosLineales * precioLaminadoLineal);
                    } else if (tipoCobroLaminado === 'y' && precioLaminadoLineal > 0) {
                        const metrosLineales = medidaYCm / 100;
                        costoBaseUnitario += (metrosLineales * precioLaminadoLineal);
                    } else if (tipoCobroLaminado === 'manual' && precioLaminadoManual > 0) {
                        costoBaseUnitario += precioLaminadoManual;
                    }
                }
                
                if (impresionPegado && proveedorPegado === 'taller' && precioPegado > 0) {
                    costoBaseUnitario += precioPegado;
                }
            }
        } else {
            costoBaseUnitario = precioUnitario;
        }

        const totalUnit = costoBaseUnitario + (suministrarMaterial ? costoMaterialExtra : 0);
        setState((prev: any) => ({ ...prev, subtotal: totalUnit * cantidadCalculo }));
    }
  }, [
      state.cantidad, state.precioUnitario, state.unidad, state.medidaXCm, state.medidaYCm, 
      horas, minutos, segundos, state.suministrarMaterial, state.costoMaterialExtra, 
      state.tipoServicio, state.modoCobroLaser, state.impresionLaminado, 
      state.tipoCobroLaminado, state.precioLaminadoLineal, state.precioLaminadoManual,
      state.impresionPegado, state.proveedorPegado, state.precioPegado
  ]);

  const handleSave = async () => {
    const newErrors: any = {};
    let hasError = false;

    if (!state.nombre.trim()) { newErrors.nombre = true; hasError = true; }

    if (state.unidad === 'm2') {
        if (state.medidaXCm <= 0) { newErrors.medidaXCm = true; hasError = true; }
        if (state.medidaYCm <= 0) { newErrors.medidaYCm = true; hasError = true; }
    }

    if (state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo') {
        const tH = parseFloat(horas) || 0;
        const tMin = parseFloat(minutos) || 0;
        const tSec = parseFloat(segundos) || 0;
        if (tH === 0 && tMin === 0 && tSec === 0) {
            newErrors.tiempo = true;
            hasError = true;
        }
    }

    if ((state.cantidad || 0) <= 0) { newErrors.cantidad = true; hasError = true; }

    setErrors(newErrors);
    if (hasError) return;

    let colorFinal = state.colorAcrilico;

    if (state.colorAcrilico === 'NEW' && state.nuevoColorCustom.trim() !== "") {
        colorFinal = state.nuevoColorCustom.trim();
        if (onRegisterColor) {
            await onRegisterColor({ label: colorFinal, value: colorFinal, emoji: "🎨" });
        }
    }

    const finalUnitPrice = state.unidad === 'm2' 
        ? state.precioUnitario 
        : (state.subtotal / (state.cantidad || 1));

    const hVal = parseInt(horas) || 0;
    const mVal = parseInt(minutos) || 0;
    const sVal = segundos.padStart(2, '0');
    
    const tiempoString = hVal > 0 
        ? `${hVal}:${mVal.toString().padStart(2, '0')}:${sVal}`
        : `${mVal}:${sVal}`;

    let detallesExtras = [];
    if (state.tipoServicio === 'IMPRESION') {
        detallesExtras.push(`Mat: ${state.materialImpresion}`);
        
        // Corte detallado
        if ((state.impresionConCorte || isSticker(state.materialImpresion)) && state.materialImpresion !== 'Vinil con Corte') {
            detallesExtras.push("Corte");
        }
        
        // Pegado detallado
        if (state.impresionPegado) {
            const prov = state.proveedorPegado === 'taller' ? "(Taller)" : "(Cliente)";
            detallesExtras.push(`Pegado en ${state.tipoPegado} ${prov}`);
        }
        
        if (state.impresionOjales) detallesExtras.push("Ojales");
        if (state.impresionBolsillos) detallesExtras.push("Bolsillos");
        if (state.impresionTubos) detallesExtras.push("Tubos");
        if (state.impresionRefilado) detallesExtras.push("Refilado");
        if (state.impresionLaminado) detallesExtras.push("Laminado");
    }

    onAddItem({ 
        ...state, 
        cantidad: state.cantidad || 1, 
        colorAcrilico: colorFinal,
        materialDetalleCorte: state.tipoServicio === 'CORTE' 
            ? `${state.materialDeCorte} ${state.materialDeCorte === 'Cartulina' ? 'N/A' : state.grosorMaterial} ${colorFinal}`
            : state.tipoServicio === 'IMPRESION' 
            ? detallesExtras.join(" | ")
            : null,
        precioUnitario: finalUnitPrice,
        tiempoCorte: state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo' ? tiempoString : "Servicio" 
    });
    
    onClose();
  };

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: false }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-auto max-h-[92vh] p-0 border-none bg-white dark:bg-slate-950 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        
        <header className="p-6 border-b bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Layers className="w-5 h-5" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Configuración de Ítem</DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Terminal de Producción</p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 hover:bg-red-50 text-red-500"><X /></Button>
        </header>

        <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-8 space-y-8 pb-12">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div className="md:col-span-8 space-y-1.5">
                        <Label className={cn("text-[10px] font-black uppercase ml-1 transition-colors", errors.nombre ? "text-red-500" : "text-slate-400")}>
                            Descripción {errors.nombre && <span className="text-[8px] ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Campo Obligatorio</span>}
                        </Label>
                        <Input 
                            value={state.nombre} 
                            onChange={e => { setState({...state, nombre: e.target.value}); clearError('nombre'); }}
                            className={cn(
                                "h-12 rounded-xl border-none font-bold text-base transition-all",
                                errors.nombre ? "bg-red-50 text-red-900 placeholder:text-red-300 ring-2 ring-red-500/50" : "bg-slate-100 dark:bg-slate-800"
                            )}
                            placeholder="Ej: Medallas acrílicas / Banner promocional"
                            autoFocus
                        />
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Servicio</Label>
                        <Select value={state.tipoServicio} onValueChange={v => {
                            const updates: any = { tipoServicio: v };
                            if (v === 'IMPRESION') updates.unidad = 'm2';
                            else if (v === 'CORTE') updates.unidad = 'tiempo';
                            else updates.unidad = 'und';
                            setState({...state, ...updates});
                            setErrors({});
                        }}>
                            <SelectTrigger className="h-12 rounded-xl border-none bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="IMPRESION">🖨️ Impresión</SelectItem>
                                <SelectItem value="CORTE">✂️ Corte Láser</SelectItem>
                                <SelectItem value="DISENO">🎨 Diseño</SelectItem>
                                <SelectItem value="ROTULACION">🚗 Rotulación</SelectItem>
                                <SelectItem value="OTROS">📦 Otros</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <AnimatePresence>
                    {state.tipoServicio === 'CORTE' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-orange-50 dark:bg-orange-900/10 rounded-[2rem] border border-orange-100 dark:border-orange-800 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <h4 className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2 tracking-[0.2em]"><Scissors className="w-4 h-4"/> Parámetros de Láser</h4>
                                <Tabs value={state.modoCobroLaser} onValueChange={v => setState({...state, modoCobroLaser: v, unidad: v === 'tiempo' ? 'tiempo' : 'und'})}>
                                    <TabsList className="bg-orange-200/50 dark:bg-orange-900 rounded-xl h-10 p-1">
                                        <TabsTrigger value="tiempo" className="text-[9px] font-black">POR TIEMPO</TabsTrigger>
                                        <TabsTrigger value="servicio" className="text-[9px] font-black">POR SERVICIO</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Sustrato</Label>
                                    <Select value={state.materialDeCorte} onValueChange={v => setState({...state, materialDeCorte: v})}>
                                        <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>{MATERIALES_CORTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Grosor</Label>
                                    <Select value={state.grosorMaterial} onValueChange={v => setState({...state, grosorMaterial: v})} disabled={state.materialDeCorte === 'Cartulina'}>
                                        <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue placeholder="N/A" /></SelectTrigger>
                                        <SelectContent>{GROSORES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Color</Label>
                                    <Select value={state.colorAcrilico} onValueChange={v => setState({...state, colorAcrilico: v})}>
                                        <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {allColors.map((c: any) => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
                                            <Separator className="my-2" />
                                            <SelectItem value="NEW" className="text-blue-600 font-black">➕ Registrar Nuevo Color</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {state.colorAcrilico === 'NEW' && (
                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="pt-2">
                                            <Input value={state.nuevoColorCustom} onChange={e => setState({...state, nuevoColorCustom: e.target.value})} className="h-10 text-xs border-orange-200 dark:bg-slate-800" placeholder="Nombre del color..." />
                                        </motion.div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                                {state.modoCobroLaser === 'tiempo' ? (
                                    <div className="space-y-1.5">
                                        <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.tiempo ? "text-red-500" : "text-orange-400")}>
                                            Tiempo (H : M : S) {errors.tiempo && "(Requerido)"}
                                        </Label>
                                        <div className={cn("flex items-center gap-1 bg-white dark:bg-slate-800 h-14 px-4 rounded-2xl shadow-inner font-black text-xl border transition-all", errors.tiempo ? "border-red-500 ring-2 ring-red-500/20" : "border-transparent")}>
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <input value={horas === '0' ? '' : horas} onChange={e => { setHoras(e.target.value); clearError('tiempo'); }} className="w-full text-center outline-none bg-transparent" placeholder="0" type="number" />
                                                <span className="text-[7px] text-slate-300 uppercase font-bold tracking-widest">Hrs</span>
                                            </div>
                                            <span className="opacity-20 pb-3 text-2xl">:</span>
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <input value={minutos === '0' ? '' : minutos} onChange={e => { setMinutos(e.target.value); clearError('tiempo'); }} className="w-full text-center outline-none bg-transparent" placeholder="00" type="number" />
                                                <span className="text-[7px] text-slate-300 uppercase font-bold tracking-widest">Min</span>
                                            </div>
                                            <span className="opacity-20 pb-3 text-2xl">:</span>
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <input value={segundos === '00' ? '' : segundos} onChange={e => { setSegundos(e.target.value); clearError('tiempo'); }} className="w-full text-center outline-none bg-transparent" placeholder="00" maxLength={2} />
                                                <span className="text-[7px] text-slate-300 uppercase font-bold tracking-widest">Seg</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black text-orange-400 uppercase">Precio por Pieza (USD)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400"/>
                                            <Input type="number" step="0.01" value={state.precioUnitario === 0 ? '' : state.precioUnitario} onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} className="h-14 pl-12 border-none bg-white dark:bg-slate-800 font-black text-orange-600 text-xl rounded-2xl shadow-inner" />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.cantidad ? "text-red-500" : "text-orange-400")}>
                                        Cantidad de Piezas
                                    </Label>
                                    <Input type="number" value={state.cantidad === 0 ? '' : state.cantidad} onChange={e => { setState({...state, cantidad: parseInt(e.target.value) || 0}); clearError('cantidad'); }} className={cn("h-14 border-none font-black text-center text-xl rounded-2xl shadow-inner transition-all", errors.cantidad ? "bg-red-50 text-red-600 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {state.unidad === 'm2' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 space-y-6">
                            
                            {/* SECCIÓN: OPCIONES DE IMPRESIÓN */}
                            {state.tipoServicio === 'IMPRESION' && (
                                <div className="space-y-4 pb-4 border-b border-blue-200 dark:border-blue-900/50">
                                    <div className="flex items-center gap-2">
                                        <Printer className="w-5 h-5 text-blue-600" />
                                        <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Material y Acabados</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                                            <Label className="text-[9px] font-black text-blue-500 uppercase">Material de Impresión</Label>
                                            <Select value={state.materialImpresion} onValueChange={v => {
                                                let updates: any = { materialImpresion: v };
                                                
                                                // Reseteos automáticos al cambiar de material según las reglas
                                                if (isBanner(v)) {
                                                    updates.impresionConCorte = false;
                                                    updates.impresionPegado = false;
                                                } else if (isSticker(v)) {
                                                    updates.impresionConCorte = true;
                                                    updates.impresionPegado = false;
                                                } else if (isClear(v)) {
                                                    updates.tipoPegado = 'Acrilico'; // Obliga acrilico si van a pegar
                                                }
                                                setState({...state, ...updates});
                                            }}>
                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {MATERIALES_IMPRESION.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* CHECKBOXES DINÁMICOS */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                                        {/* Añadir Corte (Oculto para Banner, Obligatorio para Stickers) */}
                                        {!isBanner(state.materialImpresion) && state.materialImpresion !== "Vinil con Corte" && (
                                            <div className={cn("flex items-center space-x-2 p-2.5 rounded-lg shadow-sm transition-opacity", isSticker(state.materialImpresion) ? "bg-slate-200/50 dark:bg-slate-800/50 opacity-70 pointer-events-none" : "bg-white dark:bg-slate-800")}>
                                                <Checkbox 
                                                    id="chk-corte" 
                                                    checked={isSticker(state.materialImpresion) ? true : state.impresionConCorte} 
                                                    disabled={isSticker(state.materialImpresion)}
                                                    onCheckedChange={c => setState({...state, impresionConCorte: !!c})} 
                                                />
                                                <Label htmlFor="chk-corte" className="text-xs font-bold cursor-pointer">
                                                    {isSticker(state.materialImpresion) ? "Corte (Obligatorio)" : "Añadir Corte"}
                                                </Label>
                                            </div>
                                        )}

                                        {/* Pegado en Rígido (Exclusivo Viniles y Clear) */}
                                        {(isVinilPegable(state.materialImpresion) || isClear(state.materialImpresion)) && (
                                            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                <Checkbox id="chk-pegado" checked={state.impresionPegado} onCheckedChange={c => setState({...state, impresionPegado: !!c})} />
                                                <Label htmlFor="chk-pegado" className="text-xs font-bold cursor-pointer">Pegado en Rígido</Label>
                                            </div>
                                        )}

                                        {/* Exclusivos Banner */}
                                        {isBanner(state.materialImpresion) && (
                                            <>
                                                <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                    <Checkbox id="chk-ojales" checked={state.impresionOjales} onCheckedChange={c => setState({...state, impresionOjales: !!c})} />
                                                    <Label htmlFor="chk-ojales" className="text-xs font-bold cursor-pointer">Ojales</Label>
                                                </div>
                                                <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                    <Checkbox id="chk-bolsillos" checked={state.impresionBolsillos} onCheckedChange={c => setState({...state, impresionBolsillos: !!c})} />
                                                    <Label htmlFor="chk-bolsillos" className="text-xs font-bold cursor-pointer">Bolsillos</Label>
                                                </div>
                                                <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                    <Checkbox id="chk-tubos" checked={state.impresionTubos} onCheckedChange={c => setState({...state, impresionTubos: !!c})} />
                                                    <Label htmlFor="chk-tubos" className="text-xs font-bold cursor-pointer">Tubos</Label>
                                                </div>
                                                <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                    <Checkbox id="chk-refilado" checked={state.impresionRefilado} onCheckedChange={c => setState({...state, impresionRefilado: !!c})} />
                                                    <Label htmlFor="chk-refilado" className="text-xs font-bold cursor-pointer">Refilado</Label>
                                                </div>
                                            </>
                                        )}

                                        {/* Compartido Viniles / Clear / Banner - LAMINADO */}
                                        {(isVinilPegable(state.materialImpresion) || isClear(state.materialImpresion) || isBanner(state.materialImpresion)) && (
                                            <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                                                <Checkbox id="chk-laminado" checked={state.impresionLaminado} onCheckedChange={c => setState({...state, impresionLaminado: !!c})} className="data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500" />
                                                <Label htmlFor="chk-laminado" className="text-xs font-black text-indigo-700 dark:text-indigo-300 cursor-pointer">Laminado Extra</Label>
                                            </div>
                                        )}
                                    </div>

                                    {/* PANELES DE CONFIGURACIÓN EXTRAS (Pegado y Laminado) */}
                                    <div className="space-y-3 mt-4">
                                        
                                        {/* PANEL DE PEGADO */}
                                        <AnimatePresence>
                                            {(isVinilPegable(state.materialImpresion) || isClear(state.materialImpresion)) && state.impresionPegado && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 overflow-hidden">
                                                    <Label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase flex items-center gap-2"><Box className="w-3 h-3"/> Configuración de Pegado</Label>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-slate-500 uppercase">Sustrato Rígido</Label>
                                                            <Select value={state.tipoPegado} onValueChange={v => setState({...state, tipoPegado: v})} disabled={isClear(state.materialImpresion)}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-none h-11 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {!isClear(state.materialImpresion) && <SelectItem value="PVC">Lámina PVC</SelectItem>}
                                                                    <SelectItem value="Acrilico">Acrílico</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-slate-500 uppercase">¿Quién lo pone?</Label>
                                                            <Select value={state.proveedorPegado} onValueChange={v => setState({...state, proveedorPegado: v})}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-none h-11 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="taller">Taller (Cobrar material)</SelectItem>
                                                                    <SelectItem value="cliente">Cliente (No cobrar material)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {state.proveedorPegado === 'taller' && (
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[9px] font-bold text-slate-500 uppercase">Costo Rígido (USD)</Label>
                                                                <div className="relative">
                                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                                                                    <Input 
                                                                        type="number" step="0.01" 
                                                                        value={state.precioPegado === 0 ? '' : state.precioPegado}
                                                                        onChange={e => setState({...state, precioPegado: parseFloat(e.target.value) || 0})} 
                                                                        className="h-11 pl-9 border-none bg-white dark:bg-slate-900 font-black text-slate-700 dark:text-slate-300 rounded-lg shadow-sm" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* PANEL DE LAMINADO */}
                                        <AnimatePresence>
                                            {(isVinilPegable(state.materialImpresion) || isClear(state.materialImpresion) || isBanner(state.materialImpresion)) && state.impresionLaminado && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50 space-y-3 overflow-hidden">
                                                    <Label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2"><Layers className="w-3 h-3"/> Configuración de Costo (Laminado)</Label>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-indigo-500 uppercase">Modo de Cálculo</Label>
                                                            <Select value={state.tipoCobroLaminado} onValueChange={v => setState({...state, tipoCobroLaminado: v})}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="y">M. Lineal (Gastar Alto Y)</SelectItem>
                                                                    <SelectItem value="x">M. Lineal (Gastar Ancho X)</SelectItem>
                                                                    <SelectItem value="manual">Monto Fijo (Retazos)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-indigo-500 uppercase">
                                                                {state.tipoCobroLaminado === 'manual' ? "Costo del Laminado (USD)" : "Precio por M. Lineal (USD)"}
                                                            </Label>
                                                            <div className="relative">
                                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400"/>
                                                                <Input 
                                                                    type="number" step="0.01" 
                                                                    value={state.tipoCobroLaminado === 'manual' ? (state.precioLaminadoManual === 0 ? '' : state.precioLaminadoManual) : (state.precioLaminadoLineal === 0 ? '' : state.precioLaminadoLineal)}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        if (state.tipoCobroLaminado === 'manual') setState({...state, precioLaminadoManual: val});
                                                                        else setState({...state, precioLaminadoLineal: val});
                                                                    }} 
                                                                    className="h-11 pl-9 border-none bg-white dark:bg-slate-800 font-black text-indigo-600 rounded-lg shadow-sm" 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                </div>
                            )}

                            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-[0.2em]"><MoveVertical className="w-4 h-4"/> Dimensiones del Archivo</h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.medidaXCm ? "text-red-500" : "text-blue-400")}>
                                        Ancho X (cm) {state.impresionLaminado && state.tipoCobroLaminado === 'x' && <span className="text-[7px] text-indigo-500 ml-1">(Usado para Laminado)</span>}
                                    </Label>
                                    <Input 
                                        type="number" 
                                        value={state.medidaXCm === 0 ? '' : state.medidaXCm}
                                        onChange={e => { setState({...state, medidaXCm: parseFloat(e.target.value) || 0}); clearError('medidaXCm'); }}
                                        className={cn("h-12 text-center border-none font-black text-lg rounded-xl shadow-inner transition-all", errors.medidaXCm ? "bg-red-50 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.medidaYCm ? "text-red-500" : "text-blue-400")}>
                                        Alto Y (cm) {state.impresionLaminado && state.tipoCobroLaminado === 'y' && <span className="text-[7px] text-indigo-500 ml-1">(Usado para Laminado)</span>}
                                    </Label>
                                    <Input 
                                        type="number" 
                                        value={state.medidaYCm === 0 ? '' : state.medidaYCm}
                                        onChange={e => { setState({...state, medidaYCm: parseFloat(e.target.value) || 0}); clearError('medidaYCm'); }}
                                        className={cn("h-12 text-center border-none font-black text-lg rounded-xl shadow-inner transition-all", errors.medidaYCm ? "bg-red-50 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} 
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!(state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Precio Unitario Base (USD)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={state.precioUnitario === 0 ? '' : state.precioUnitario}
                                    onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} 
                                    className="h-12 pl-12 rounded-2xl border-none bg-slate-100 dark:bg-slate-800 font-black text-emerald-600 text-xl shadow-inner" 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className={cn("text-[10px] font-black uppercase ml-1 transition-colors", errors.cantidad ? "text-red-500" : "text-slate-400")}>Cantidad de Copias</Label>
                            <Input 
                                type="number" 
                                value={state.cantidad === 0 ? '' : state.cantidad}
                                onChange={e => { setState({...state, cantidad: parseInt(e.target.value) || 0}); clearError('cantidad'); }}
                                className={cn("h-12 rounded-2xl border-none font-black text-center text-xl shadow-inner transition-all", errors.cantidad ? "bg-red-50 ring-2 ring-red-500/50" : "bg-slate-100 dark:bg-slate-800")} 
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Responsable de Ejecución</Label>
                        <Select value={state.empleadoAsignado} onValueChange={v => setState({...state, empleadoAsignado: v})}>
                            <SelectTrigger className="h-12 rounded-xl border-none bg-slate-100 dark:bg-slate-800 font-bold text-sm shadow-inner px-5">
                                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400"/> <SelectValue /></div>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="N/A">Sin Asignar</SelectItem>
                                {PERSONAL_TALLER.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                {designers.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className={cn("p-4 rounded-2xl border flex items-center justify-between transition-all", state.suministrarMaterial ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200" : "bg-slate-50 dark:bg-slate-900 border-slate-100")}>
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", state.suministrarMaterial ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>
                                <Box className="w-5 h-5" />
                            </div>
                            <div className="leading-none">
                                <p className="font-black text-[10px] uppercase text-slate-700 dark:text-slate-200">Suministrar Material</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sumar costo de sustrato extra</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={state.suministrarMaterial} onChange={e => setState({...state, suministrarMaterial: e.target.checked})} className="w-6 h-6 rounded-lg accent-emerald-500 cursor-pointer" />
                    </div>
                </div>

                {state.suministrarMaterial && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="p-5 bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden">
                        <Label className="text-[9px] font-black text-emerald-600 uppercase ml-1">Costo Adicional Material (USD)</Label>
                        <div className="relative mt-1">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500"/>
                            <Input 
                                type="number" step="0.01" 
                                value={state.costoMaterialExtra === 0 ? '' : state.costoMaterialExtra}
                                onChange={e => setState({...state, costoMaterialExtra: parseFloat(e.target.value) || 0})} 
                                className="h-11 pl-11 border-none bg-white dark:bg-slate-800 font-black text-emerald-600 rounded-xl shadow-inner" 
                            />
                        </div>
                    </motion.div>
                )}
            </div>
        </ScrollArea>

        <footer className="p-8 bg-white dark:bg-slate-900 border-t flex flex-col md:flex-row justify-between items-center gap-6 shrink-0 z-20">
            <div className="flex items-center gap-5 w-full md:w-auto">
                <div className="h-14 w-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                    <Calculator className="w-7 h-7" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Monto Subtotal</p>
                    <p className="text-4xl font-black text-blue-600 tracking-tighter leading-none">${state.subtotal.toFixed(2)}</p>
                </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <Button variant="ghost" onClick={onClose} className="flex-1 md:flex-none h-14 px-8 font-black uppercase text-xs tracking-widest text-slate-400">Cancelar</Button>
                <Button 
                    onClick={handleSave} 
                    className="flex-[2] md:flex-none h-14 px-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-sm tracking-widest"
                >
                    {itemToEdit ? "ACTUALIZAR ÍTEM" : "AÑADIR A LA ORDEN"}
                </Button>
            </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}