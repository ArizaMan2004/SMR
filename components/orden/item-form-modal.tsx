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
import { cn } from "@/lib/utils"

import { 
    X, Scissors, Hash, DollarSign, Box, Type, 
    User, Calculator, Layers, Palette, MoveVertical 
} from "lucide-react"

// --- CONSTANTES ---
const PRECIO_LASER_POR_MINUTO = 0.80;
const PERSONAL_TALLER = ["Marcos", "Samuel", "Daniela", "Jose Angel", "Daniel Montero"];
const MATERIALES_CORTE = ["Acrilico", "MDF", "Melamina", "Cartulina", "Otro"] as const;
const GROSORES = Array.from({ length: 12 }, (_, i) => `${i + 1}mm`);

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
  const [minutos, setMinutos] = useState('0');
  const [segundos, setSegundos] = useState('00');

  const allColors = useMemo(() => [...COLORES_PREDEFINIDOS, ...customColors], [customColors]);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
          if (itemToEdit.unidad === 'tiempo' && itemToEdit.tiempoCorte) {
             const parts = itemToEdit.tiempoCorte.split(':');
             setMinutos(parts[0] || '0'); setSegundos(parts[1] || '00');
          }
          setState({ ...getInitialState(), ...itemToEdit, nuevoColorCustom: "" });
      } else {
          setState(getInitialState());
          setMinutos('0'); setSegundos('00');
      }
    }
  }, [isOpen, itemToEdit]);

  // LÓGICA DE CÁLCULO CORREGIDA
  useEffect(() => {
    let costoBaseUnitario = 0;
    const { cantidad, precioUnitario, unidad, medidaXCm, medidaYCm, suministrarMaterial, costoMaterialExtra, tipoServicio, modoCobroLaser } = state; 
    
    if (cantidad > 0) {
        if (tipoServicio === 'CORTE' && modoCobroLaser === 'tiempo') {
            const totalMinutes = (parseFloat(minutos) || 0) + ((parseFloat(segundos) || 0) / 60);
            costoBaseUnitario = totalMinutes * PRECIO_LASER_POR_MINUTO;
        } else if (unidad === 'm2' && medidaXCm > 0 && medidaYCm > 0) {
            // Fórmula corregida: (cm/100) * (cm/100) * precio_m2
            costoBaseUnitario = (medidaXCm / 100) * (medidaYCm / 100) * precioUnitario;
        } else {
            costoBaseUnitario = precioUnitario;
        }

        const totalUnit = costoBaseUnitario + (suministrarMaterial ? costoMaterialExtra : 0);
        setState((prev: any) => ({ ...prev, subtotal: totalUnit * cantidad }));
    }
  }, [state.cantidad, state.precioUnitario, state.unidad, state.medidaXCm, state.medidaYCm, minutos, segundos, state.suministrarMaterial, state.costoMaterialExtra, state.tipoServicio, state.modoCobroLaser]);

  // FUNCIÓN DE GUARDADO CORREGIDA
  const handleSave = async () => {
    if (!state.nombre.trim()) return;

    let colorFinal = state.colorAcrilico;

    if (state.colorAcrilico === 'NEW' && state.nuevoColorCustom.trim() !== "") {
        colorFinal = state.nuevoColorCustom.trim();
        if (onRegisterColor) {
            await onRegisterColor({ label: colorFinal, value: colorFinal, emoji: "🎨" });
        }
    }

    // SI ES M2, GUARDAMOS EL PRECIO BASE POR M2 PARA QUE EL WIZARD NO MULTIPLIQUE DOBLE
    const finalUnitPrice = state.unidad === 'm2' 
        ? state.precioUnitario 
        : (state.subtotal / state.cantidad);

    onAddItem({ 
        ...state, 
        colorAcrilico: colorFinal,
        materialDetalleCorte: state.tipoServicio === 'CORTE' 
            ? `${state.materialDeCorte} ${state.materialDeCorte === 'Cartulina' ? 'N/A' : state.grosorMaterial} ${colorFinal}`
            : null,
        precioUnitario: finalUnitPrice,
        tiempoCorte: state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo' ? `${minutos}:${segundos.padStart(2, '0')}` : "Servicio" 
    });
    onClose();
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
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descripción</Label>
                        <Input 
                            value={state.nombre} 
                            onChange={e => setState({...state, nombre: e.target.value})}
                            className="h-12 rounded-xl border-none bg-slate-100 dark:bg-slate-800 font-bold text-base"
                            placeholder="Ej: Medallas acrílicas grabadas"
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
                                        <Label className="text-[9px] font-black text-orange-400 uppercase">Tiempo de Ejecución (MM:SS)</Label>
                                        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 h-14 px-6 rounded-2xl shadow-inner font-black text-xl">
                                            <input value={minutos} onChange={e => setMinutos(e.target.value)} className="w-full text-center outline-none bg-transparent" placeholder="0" />
                                            <span className="opacity-20">:</span>
                                            <input value={segundos} onChange={e => setSegundos(e.target.value)} className="w-full text-center outline-none bg-transparent" placeholder="00" maxLength={2} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black text-orange-400 uppercase">Precio por Pieza (USD)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400"/>
                                            <Input type="number" step="0.01" value={state.precioUnitario} onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} className="h-14 pl-12 border-none bg-white dark:bg-slate-800 font-black text-orange-600 text-xl rounded-2xl shadow-inner" />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Cantidad de Piezas</Label>
                                    <Input type="number" value={state.cantidad} onChange={e => setState({...state, cantidad: parseInt(e.target.value) || 1})} className="h-14 border-none bg-white dark:bg-slate-800 font-black text-center text-xl rounded-2xl shadow-inner" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {state.unidad === 'm2' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-[0.2em]"><MoveVertical className="w-4 h-4"/> Dimensiones de Impresión</h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-blue-400 uppercase">Ancho (cm)</Label>
                                    <Input type="number" value={state.medidaXCm} onChange={e => setState({...state, medidaXCm: parseFloat(e.target.value) || 0})} className="h-12 text-center border-none bg-white dark:bg-slate-800 font-black text-lg rounded-xl shadow-inner" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-blue-400 uppercase">Alto (cm)</Label>
                                    <Input type="number" value={state.medidaYCm} onChange={e => setState({...state, medidaYCm: parseFloat(e.target.value) || 0})} className="h-12 text-center border-none bg-white dark:bg-slate-800 font-black text-lg rounded-xl shadow-inner" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!(state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Precio Unitario (USD)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                <Input type="number" step="0.01" value={state.precioUnitario} onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} className="h-12 pl-12 rounded-2xl border-none bg-slate-100 dark:bg-slate-800 font-black text-emerald-600 text-xl shadow-inner" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cantidad</Label>
                            <Input type="number" value={state.cantidad} onChange={e => setState({...state, cantidad: parseInt(e.target.value) || 1})} className="h-12 rounded-2xl border-none bg-slate-100 dark:bg-slate-800 font-black text-center text-xl shadow-inner" />
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
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sumar costo de sustrato</p>
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
                            <Input type="number" step="0.01" value={state.costoMaterialExtra} onChange={e => setState({...state, costoMaterialExtra: parseFloat(e.target.value) || 0})} className="h-11 pl-11 border-none bg-white dark:bg-slate-800 font-black text-emerald-600 rounded-xl shadow-inner" />
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