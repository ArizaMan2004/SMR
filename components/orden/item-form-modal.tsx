// @/components/orden/item-form-modal.tsx
"use client"

import * as React from "react"
import { useState, useEffect } from "react" 
import { motion, AnimatePresence } from "framer-motion"

// Shadcn UI & Estilos
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// Iconos
import { 
    X, Sparkles, MoveVertical, Scissors, 
    Hash, DollarSign, Box, FileCode, FileImage, PenTool,
    Type, User, AlertCircle
} from "lucide-react"

// Tipos
import { type UnidadItem, type TipoServicio } from "@/lib/types/orden" 

// --- CONSTANTES DE NEGOCIO ---
const PRECIO_LASER_POR_MINUTO = 0.80
const PERSONAL_TALLER = ["Marcos", "Samuel", "Daniela", "Jose Angel", "Daniel Montero"];
const MATERIALES_CORTE = ["Acrilico", "Melamina", "MDF", "Cartulina", "Otro"] as const;
const GROSORES_DISPONIBLES = ["1mm", "2mm", "3mm", "4mm", "5mm"] as const;
const COLORES_ACRILICO = [
    { value: "Transparente", label: "Transparente", emoji: "💎" },
    { value: "Blanco", label: "Blanco", emoji: "⬜" },
    { value: "Negro", label: "Negro", emoji: "⬛" },
    { value: "Rojo", label: "Rojo", emoji: "🟥" },
    { value: "Amarillo", label: "Amarillo", emoji: "🟨" },
    { value: "Verde", label: "Verde", emoji: "🟩" },
    { value: "Naranja", label: "Naranja", emoji: "🟧" },
    { value: "Dorado", label: "Dorado", emoji: "🪙" },
    { value: "Espejo (Plateado)", label: "Espejo (Plateado)", emoji: "💿" },
];

const UNIDADES_DISPONIBLES: { value: UnidadItem, label: string }[] = [
  { value: 'und', label: 'Unidad (und)' },
  { value: 'm2', label: 'Metros Cuadrados (m²)' },
  { value: 'tiempo', label: 'Tiempo (min)' },
]

const TIPOS_ARCHIVO = [
    { value: "vector", label: "Vector (Líneas)", icon: FileCode },
    { value: "imagen", label: "Imagen (Pixel)", icon: FileImage },
]

const FORMATOS_ARCHIVO = {
    vector: ["CDR", "AI", "PDF", "DXF", "EPS", "SVG"],
    imagen: ["JPG", "PNG", "PSD", "TIFF", "BMP"]
}

const getInitialState = () => ({
  nombre: "",
  tipoServicio: "OTROS" as TipoServicio | "DISENO",
  cantidad: 1,
  unidad: "und" as UnidadItem,
  materialDeImpresion: "Otro/No aplica",
  materialDeCorte: MATERIALES_CORTE[0], 
  grosorMaterial: GROSORES_DISPONIBLES[2],      
  colorAcrilico: COLORES_ACRILICO[0].value, 
  archivoTipo: "vector" as "vector" | "imagen",
  archivoFormato: "CDR",
  precioUnitario: 0,
  medidaXCm: 0,
  medidaYCm: 0,
  tiempoCorte: "0:00",
  empleadoAsignado: "N/A", 
  suministrarMaterial: false,
  costoMaterialExtra: 0,
  subtotal: 0,
  error: "",
});

export function ItemFormModal({ isOpen, onClose, onAddItem, itemToEdit, designers = [] }: any) {
  const [state, setState] = useState<any>(getInitialState());
  const [minutosInput, setMinutosInput] = useState('0');
  const [segundosInput, setSegundosInput] = useState('00');

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
          const isTiempo = itemToEdit.unidad === 'tiempo';
          let mins = '0', secs = '00';
          if (isTiempo && itemToEdit.tiempoCorte) {
             const parts = itemToEdit.tiempoCorte.split(':');
             mins = parts[0] || '0'; secs = parts[1] || '00';
          }
          
          let matCorte = MATERIALES_CORTE[0], grosor = GROSORES_DISPONIBLES[2], color = COLORES_ACRILICO[0].value;
          if (itemToEdit.materialDetalleCorte) {
             const parts = itemToEdit.materialDetalleCorte.split(' ');
             const foundMat = MATERIALES_CORTE.find(m => parts.includes(m));
             if (foundMat) matCorte = foundMat;
             const foundGros = GROSORES_DISPONIBLES.find(g => parts.includes(g));
             if (foundGros) grosor = foundGros;
             const foundColor = COLORES_ACRILICO.find(c => itemToEdit.materialDetalleCorte?.includes(c.label));
             if (foundColor) color = foundColor.value;
          }

          setMinutosInput(mins); setSegundosInput(secs);
          setState({ ...getInitialState(), ...itemToEdit, materialDeCorte: matCorte, grosorMaterial: grosor, colorAcrilico: color, archivoTipo: itemToEdit.archivoTipo || "vector", archivoFormato: itemToEdit.archivoFormato || "CDR", suministrarMaterial: itemToEdit.suministrarMaterial || false, costoMaterialExtra: itemToEdit.costoMaterialExtra || 0, empleadoAsignado: itemToEdit.empleadoAsignado || "N/A" });
      } else {
          setState(getInitialState()); setMinutosInput('0'); setSegundosInput('00');
      }
    }
  }, [isOpen, itemToEdit]);

  useEffect(() => {
    let costoBaseUnitario = 0;
    const { cantidad, precioUnitario, unidad, medidaXCm, medidaYCm, suministrarMaterial, costoMaterialExtra } = state; 
    if (cantidad > 0) {
        if (unidad === 'und') costoBaseUnitario = precioUnitario;
        else if (unidad === 'm2' && medidaXCm > 0 && medidaYCm > 0) {
            costoBaseUnitario = (medidaXCm / 100) * (medidaYCm / 100) * precioUnitario;
        } else if (unidad === 'tiempo') {
            const totalMinutes = (parseFloat(minutosInput) || 0) + ((parseFloat(segundosInput) || 0) / 60);
            costoBaseUnitario = totalMinutes * PRECIO_LASER_POR_MINUTO;
        }
        const totalUnit = costoBaseUnitario + (suministrarMaterial ? costoMaterialExtra : 0);
        setState((prev: any) => ({ ...prev, subtotal: totalUnit * cantidad }));
    }
  }, [state.cantidad, state.precioUnitario, state.unidad, state.medidaXCm, state.medidaYCm, minutosInput, segundosInput, state.suministrarMaterial, state.costoMaterialExtra]);

  useEffect(() => {
    if (state.tipoServicio === 'DISENO') setState((p: any) => ({ ...p, unidad: 'und', archivoTipo: 'imagen', archivoFormato: 'JPG' }));
    else if (state.tipoServicio === 'CORTE') setState((p: any) => ({ ...p, unidad: 'tiempo', archivoTipo: 'vector', archivoFormato: 'CDR' }));
    else if (state.tipoServicio === 'IMPRESION') setState((p: any) => ({ ...p, unidad: 'm2', archivoFormato: 'TIFF' }));
    else setState((p: any) => ({ ...p, unidad: 'und' }));
  }, [state.tipoServicio]);

  const handleSave = () => {
    if (!state.nombre.trim() || state.cantidad <= 0) {
        setState((p: any) => ({ ...p, error: "Faltan datos obligatorios." })); return;
    }
    let materialDetalleCorte = '';
    if (state.tipoServicio === 'CORTE') {
        const col = COLORES_ACRILICO.find(c => c.value === state.colorAcrilico)?.label;
        materialDetalleCorte = `${state.materialDeCorte} ${state.grosorMaterial} ${col || ''}`.trim();
    }
    let tiempoCorteFinal = state.unidad === 'tiempo' ? `${minutosInput}:${segundosInput.padStart(2, '0')}` : null;
    let precioUnitarioCalculado = state.unidad === 'tiempo' ? (parseInt(minutosInput) + (parseInt(segundosInput) / 60)) * PRECIO_LASER_POR_MINUTO : state.precioUnitario;
    if (state.suministrarMaterial) precioUnitarioCalculado += state.costoMaterialExtra;
    onAddItem({ ...state, nombre: state.nombre.trim(), precioUnitario: precioUnitarioCalculado, tiempoCorte: tiempoCorteFinal, materialDetalleCorte: materialDetalleCorte || null, empleadoAsignado: state.empleadoAsignado });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-[85vh] p-0 border-none bg-white dark:bg-slate-950 overflow-hidden rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex flex-col transition-all">
        
        <header className="shrink-0 p-5 md:px-8 md:py-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="h-11 w-11 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <DialogTitle className="text-xl md:text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">
                        {itemToEdit ? "Editar Ítem" : "Nuevo Ítem"}
                    </DialogTitle>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">Parámetros de Producción</p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
            </Button>
        </header>

        <div className="flex-1 min-h-0 relative bg-slate-50/30 dark:bg-slate-950/30">
            <ScrollArea className="h-full">
                <div className="p-6 md:p-8 space-y-8">
                    
                    {/* FILA 1: NOMBRE Y SERVICIO */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        <div className="md:col-span-6 space-y-2">
                            <Label className="text-[9px] font-black uppercase ml-2 text-slate-400 tracking-wider">Descripción del Ítem</Label>
                            <div className="relative">
                                <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <Input 
                                    value={state.nombre} 
                                    onChange={e => setState({...state, nombre: e.target.value})}
                                    className="h-11 pl-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 shadow-sm font-bold text-sm focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    placeholder="Ej: Letrero Acrílico..."
                                />
                            </div>
                        </div>
                        <div className="md:col-span-3 space-y-2">
                            <Label className="text-[9px] font-black uppercase ml-2 text-slate-400 tracking-wider">Categoría</Label>
                            <Select value={state.tipoServicio} onValueChange={v => setState({...state, tipoServicio: v})}>
                                <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 shadow-sm font-black text-blue-600 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    <SelectItem value="DISENO">🎨 Diseño</SelectItem>
                                    <SelectItem value="IMPRESION">🖨️ Impresión</SelectItem>
                                    <SelectItem value="CORTE">✂️ Corte Láser</SelectItem>
                                    <SelectItem value="ROTULACION">🚗 Rotulación</SelectItem>
                                    <SelectItem value="AVISO_CORPOREO">🏢 Corpóreo</SelectItem>
                                    <SelectItem value="OTROS">📦 Otros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:col-span-3 space-y-2">
                            <Label className="text-[9px] font-black uppercase text-orange-600/70 ml-2 tracking-wider">Operador</Label>
                            <Select value={state.empleadoAsignado} onValueChange={v => setState({...state, empleadoAsignado: v})}>
                                <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 shadow-sm font-bold text-xs">
                                    <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-orange-500"/> <SelectValue /></div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    <SelectItem value="N/A">Sin Asignar</SelectItem>
                                    <Separator className="my-1.5 opacity-50"/>
                                    {PERSONAL_TALLER.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    {designers.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* FILA 2: CANTIDAD, UNIDAD Y PRECIO */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <SectionField label="Cantidad" icon={<Hash className="w-3 h-3"/>}>
                            <Input type="number" value={state.cantidad} onChange={e => setState({...state, cantidad: parseInt(e.target.value) || 1})} className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 font-black text-center text-sm" />
                        </SectionField>
                        <SectionField label="Unidad" icon={<Box className="w-3 h-3"/>}>
                            <Select value={state.unidad} onValueChange={v => setState({...state, unidad: v})} disabled={state.tipoServicio === 'CORTE'}>
                                <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{UNIDADES_DISPONIBLES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </SectionField>
                        {state.unidad !== 'tiempo' && (
                            <SectionField label="Precio Unitario" icon={<DollarSign className="w-3 h-3"/>} className="col-span-2">
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                                    <Input type="number" step="0.01" value={state.precioUnitario} onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} className="h-11 pl-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 font-black text-emerald-600 text-lg" />
                                </div>
                            </SectionField>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {state.tipoServicio === 'DISENO' && (
                            <motion.div key="panel-diseno" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-indigo-50/50 dark:bg-indigo-500/5 p-6 rounded-[1.8rem] border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2"><PenTool className="w-3.5 h-3.5"/> Configuración de Archivo</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <SectionField label="Tipo Archivo"><Select value={state.archivoTipo} onValueChange={v => setState({...state, archivoTipo: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none rounded-lg h-10 text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ARCHIVO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></SectionField>
                                    <SectionField label="Formato Final"><Select value={state.archivoFormato} onValueChange={v => setState({...state, archivoFormato: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none rounded-lg h-10 text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent>{FORMATOS_ARCHIVO[state.archivoTipo as 'vector' | 'imagen'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></SectionField>
                                </div>
                            </motion.div>
                        )}
                        {state.tipoServicio === 'CORTE' && (
                            <motion.div key="panel-corte" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-orange-50/50 dark:bg-orange-500/5 p-6 rounded-[1.8rem] border border-orange-100 dark:border-orange-900/30 space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-orange-600 flex items-center gap-2"><Scissors className="w-3.5 h-3.5"/> Detalles de Corte</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <SectionField label="Sustrato"><Select value={state.materialDeCorte} onValueChange={v => setState({...state, materialDeCorte: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none h-10 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent>{MATERIALES_CORTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></SectionField>
                                    {state.materialDeCorte === 'Acrilico' && (<SectionField label="Color Acrílico"><Select value={state.colorAcrilico} onValueChange={v => setState({...state, colorAcrilico: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none h-10 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent>{COLORES_ACRILICO.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent></Select></SectionField>)}
                                    <SectionField label="Tiempo (MM:SS)"><div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg h-10 px-3 border border-slate-100 dark:border-slate-800"><Input value={minutosInput} onChange={e => setMinutosInput(e.target.value)} className="border-none text-center font-black h-8 text-xs p-0 w-8" placeholder="0" /><span>:</span><Input value={segundosInput} onChange={e => setSegundosInput(e.target.value)} className="border-none text-center font-black h-8 text-xs p-0 w-8" placeholder="00" /></div></SectionField>
                                </div>
                            </motion.div>
                        )}
                        {state.unidad === 'm2' && (
                            <motion.div key="panel-medidas" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50/50 dark:bg-blue-500/5 p-6 rounded-[1.8rem] border border-blue-100 dark:border-blue-900/30 space-y-4">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2"><MoveVertical className="w-3.5 h-3.5"/> Dimensiones</h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <SectionField label="Base (cm)"><Input type="number" value={state.medidaXCm} onChange={e => setState({...state, medidaXCm: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg border-none bg-white dark:bg-slate-900 font-black text-center text-xs" /></SectionField>
                                    <SectionField label="Altura (cm)"><Input type="number" value={state.medidaYCm} onChange={e => setState({...state, medidaYCm: parseFloat(e.target.value) || 0})} className="h-10 rounded-lg border-none bg-white dark:bg-slate-900 font-black text-center text-xs" /></SectionField>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* SUMINISTRO MATERIAL */}
                    <div className={cn("p-5 rounded-[2rem] border transition-all duration-300", state.suministrarMaterial ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800")}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2.5 rounded-xl transition-colors", state.suministrarMaterial ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}><Box className="w-4 h-4" /></div>
                                <div><p className="font-black text-xs uppercase text-slate-700 dark:text-slate-200">Suministrar Material</p><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Añadir costo del sustrato</p></div>
                            </div>
                            <input type="checkbox" checked={state.suministrarMaterial} onChange={e => setState({...state, suministrarMaterial: e.target.checked})} className="w-6 h-6 rounded-lg accent-emerald-500 cursor-pointer" />
                        </div>
                        <AnimatePresence>
                            {state.suministrarMaterial && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-900/20 overflow-hidden">
                                    <Label className="text-[8px] font-black uppercase text-emerald-600 ml-2">Costo Extra Material (USD)</Label>
                                    <div className="relative mt-1.5"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-emerald-400"/><Input type="number" step="0.01" value={state.costoMaterialExtra} onChange={e => setState({...state, costoMaterialExtra: parseFloat(e.target.value) || 0})} className="h-10 pl-9 rounded-lg border-none bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-400 text-base" /></div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {state.error && (<Alert variant="destructive" className="rounded-2xl bg-red-50 dark:bg-red-500/10 border-red-100 py-3"><AlertCircle className="h-4 w-4" /><AlertTitle className="text-xs font-black">Error</AlertTitle><AlertDescription className="text-[10px] font-bold">{state.error}</AlertDescription></Alert>)}
                </div>
            </ScrollArea>
        </div>

        <footer className="shrink-0 p-6 md:px-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="hidden md:block">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Subtotal del Ítem</p>
                <div className="flex items-baseline gap-1.5"><span className="text-3xl font-black text-blue-600 tracking-tighter">${state.subtotal.toFixed(2)}</span><span className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase">USD</span></div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <Button variant="ghost" onClick={onClose} className="flex-1 md:flex-none rounded-xl h-11 px-6 font-black text-slate-400 hover:text-slate-600 text-xs uppercase tracking-widest transition-all">Cancelar</Button>
                <Button onClick={handleSave} className="flex-[2] md:flex-none rounded-xl h-11 px-10 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                    {itemToEdit ? "Actualizar" : "Añadir Ítem"}
                </Button>
            </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function SectionField({ label, icon, children, className }: any) {
    return (
        <div className={cn("space-y-2", className)}>
            <Label className="text-[9px] font-black uppercase ml-1.5 text-slate-400 flex items-center gap-1.5 tracking-wider">{icon} {label}</Label>
            {children}
        </div>
    )
}