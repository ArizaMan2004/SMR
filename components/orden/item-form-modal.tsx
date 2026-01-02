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
    X, Sparkles, MoveVertical, Timer, Layers, Scissors, 
    Hash, DollarSign, Box, FileCode, FileImage, PenTool,
    Type, User, AlertCircle, HardHat
} from "lucide-react"

// Tipos
import { type ItemOrden, type UnidadItem, type TipoServicio } from "@/lib/types/orden" 

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

  // 1. CARGA DE DATOS
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
          setState({
              ...getInitialState(),
              ...itemToEdit,
              materialDeCorte: matCorte,
              grosorMaterial: grosor,
              colorAcrilico: color,
              archivoTipo: itemToEdit.archivoTipo || "vector",
              archivoFormato: itemToEdit.archivoFormato || "CDR",
              suministrarMaterial: itemToEdit.suministrarMaterial || false,
              costoMaterialExtra: itemToEdit.costoMaterialExtra || 0,
              empleadoAsignado: itemToEdit.empleadoAsignado || "N/A"
          });
      } else {
          setState(getInitialState());
          setMinutosInput('0'); setSegundosInput('00');
      }
    }
  }, [isOpen, itemToEdit]);

  // 2. CÁLCULO DE SUBTOTAL
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

  // 3. AUTO-CONFIGURACIÓN
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
    let precioUnitarioCalculado = state.unidad === 'tiempo' 
        ? (parseInt(minutosInput) + (parseInt(segundosInput) / 60)) * PRECIO_LASER_POR_MINUTO
        : state.precioUnitario;
    
    if (state.suministrarMaterial) precioUnitarioCalculado += state.costoMaterialExtra;

    onAddItem({
      ...state,
      nombre: state.nombre.trim(),
      precioUnitario: precioUnitarioCalculado, 
      tiempoCorte: tiempoCorteFinal,
      materialDetalleCorte: materialDetalleCorte || null,
      empleadoAsignado: state.empleadoAsignado
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-5xl h-[90vh] p-0 border-none bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-3xl overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl flex flex-col">
        
        <header className="shrink-0 p-6 md:p-10 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/50 flex justify-between items-center">
            <div className="flex items-center gap-5">
                <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                    <Sparkles className="w-7 h-7" />
                </div>
                <div>
                    <DialogTitle className="text-xl md:text-3xl font-black tracking-tighter uppercase text-slate-900 dark:text-white leading-none">
                        {itemToEdit ? "Editar Ítem" : "Nuevo Producto"}
                    </DialogTitle>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Especificaciones de Taller</p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-12 w-12 hover:bg-slate-200/50 transition-colors">
                <X className="w-6 h-6" />
            </Button>
        </header>

        <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
                <div className="p-6 md:p-12 space-y-10">
                    
                    {/* BLOQUE: IDENTIFICACIÓN Y RESPONSABLE */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-6 space-y-2">
                            <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Descripción del Trabajo</Label>
                            <div className="relative">
                                <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                <Input 
                                    value={state.nombre} 
                                    onChange={e => setState({...state, nombre: e.target.value})}
                                    className="h-14 pl-12 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm font-bold text-lg focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    placeholder="Nombre del trabajo..."
                                />
                            </div>
                        </div>
                        <div className="md:col-span-3 space-y-2">
                            <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Servicio</Label>
                            <Select value={state.tipoServicio} onValueChange={v => setState({...state, tipoServicio: v})}>
                                <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm font-black text-blue-600">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    <SelectItem value="DISENO">🎨 Diseño Gráfico</SelectItem>
                                    <SelectItem value="IMPRESION">🖨️ Impresión</SelectItem>
                                    <SelectItem value="CORTE">✂️ Corte / Grabado</SelectItem>
                                    <SelectItem value="ROTULACION">🚗 Rotulación</SelectItem>
                                    <SelectItem value="AVISO_CORPOREO">🏢 Aviso Corpóreo</SelectItem>
                                    <SelectItem value="OTROS">📦 Otros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* SELECTOR DE ENCARGADO / RESPONSABLE */}
                        <div className="md:col-span-3 space-y-2">
                            <Label className="text-[10px] font-black uppercase text-orange-600 ml-2 tracking-widest">Responsable</Label>
                            <Select value={state.empleadoAsignado} onValueChange={v => setState({...state, empleadoAsignado: v})}>
                                <SelectTrigger className="h-14 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm font-black text-slate-800 dark:text-white">
                                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-orange-500"/> <SelectValue /></div>
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">
                                    <SelectItem value="N/A">Sin Asignar</SelectItem>
                                    <Separator className="my-2"/>
                                    <div className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Equipo Taller</div>
                                    {PERSONAL_TALLER.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    <Separator className="my-2"/>
                                    <div className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Diseñadores</div>
                                    {designers.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <SectionField label="Cantidad" icon={<Hash className="w-3 h-3"/>}>
                            <Input type="number" value={state.cantidad} onChange={e => setState({...state, cantidad: parseInt(e.target.value) || 1})} className="h-12 rounded-xl bg-white dark:bg-slate-900 border-none font-black text-center text-lg" />
                        </SectionField>
                        <SectionField label="Unidad" icon={<Layers className="w-3 h-3"/>}>
                            <Select value={state.unidad} onValueChange={v => setState({...state, unidad: v})} disabled={state.tipoServicio === 'CORTE'}>
                                <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-slate-900 border-none font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>{UNIDADES_DISPONIBLES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </SectionField>
                        {state.unidad !== 'tiempo' && (
                            <SectionField label="Precio Base (USD)" icon={<DollarSign className="w-3 h-3"/>} className="col-span-2">
                                <Input type="number" step="0.01" value={state.precioUnitario} onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} className="h-12 rounded-xl bg-white dark:bg-slate-900 border-none font-black text-emerald-600 text-xl" />
                            </SectionField>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {state.tipoServicio === 'DISENO' && (
                            <motion.div key="panel-diseno" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-indigo-500/5 p-8 rounded-[2.5rem] border border-indigo-200/50 space-y-6">
                                <div className="flex items-center gap-2"><PenTool className="w-4 h-4 text-indigo-500"/> <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Archivos Digitales</h4></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <SectionField label="Entrega"><Select value={state.archivoTipo} onValueChange={v => setState({...state, archivoTipo: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none rounded-xl h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{TIPOS_ARCHIVO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></SectionField>
                                    <SectionField label="Extensión"><Select value={state.archivoFormato} onValueChange={v => setState({...state, archivoFormato: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none rounded-xl h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{FORMATOS_ARCHIVO[state.archivoTipo as 'vector' | 'imagen'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></SectionField>
                                </div>
                            </motion.div>
                        )}
                        {state.tipoServicio === 'CORTE' && (
                            <motion.div key="panel-corte" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-orange-500/5 p-8 rounded-[2.5rem] border border-orange-200/50 space-y-6">
                                <div className="flex items-center gap-2"><Scissors className="w-4 h-4 text-orange-500"/> <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-600">Material y Tiempo</h4></div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <SectionField label="Material"><Select value={state.materialDeCorte} onValueChange={v => setState({...state, materialDeCorte: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent>{MATERIALES_CORTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></SectionField>
                                    {state.materialDeCorte === 'Acrilico' && (<SectionField label="Color"><Select value={state.colorAcrilico} onValueChange={v => setState({...state, colorAcrilico: v})}><SelectTrigger className="bg-white dark:bg-slate-900 border-none h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent>{COLORES_ACRILICO.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent></Select></SectionField>)}
                                    <SectionField label="Tiempo Estimado"><div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl h-12 px-4 border border-slate-100 dark:border-slate-800"><Input value={minutosInput} onChange={e => setMinutosInput(e.target.value)} className="border-none text-center font-black h-10" placeholder="0" /><span>:</span><Input value={segundosInput} onChange={e => setSegundosInput(e.target.value)} className="border-none text-center font-black h-10" placeholder="00" /></div></SectionField>
                                </div>
                            </motion.div>
                        )}
                        {state.unidad === 'm2' && (
                            <motion.div key="panel-medidas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-blue-500/5 p-8 rounded-[2.5rem] border border-blue-200/50 space-y-6">
                                <div className="flex items-center gap-2"><MoveVertical className="w-4 h-4 text-blue-500"/> <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Medidas (cm)</h4></div>
                                <div className="grid grid-cols-2 gap-8">
                                    <SectionField label="Ancho (X)"><Input type="number" value={state.medidaXCm} onChange={e => setState({...state, medidaXCm: parseFloat(e.target.value) || 0})} className="h-12 rounded-xl border-none bg-white dark:bg-slate-900 font-black text-center" /></SectionField>
                                    <SectionField label="Alto (Y)"><Input type="number" value={state.medidaYCm} onChange={e => setState({...state, medidaYCm: parseFloat(e.target.value) || 0})} className="h-12 rounded-xl border-none bg-white dark:bg-slate-900 font-black text-center" /></SectionField>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* BLOQUE: SUMINISTRO MATERIAL */}
                    <div className={cn("p-8 rounded-[2.5rem] border transition-all", state.suministrarMaterial ? "bg-emerald-500/5 border-emerald-200 shadow-inner" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800")}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn("p-3 rounded-2xl", state.suministrarMaterial ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}><Box /></div>
                                <div><p className="font-black text-sm uppercase">Suministrar Material</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incluir costo en la orden</p></div>
                            </div>
                            <input type="checkbox" checked={state.suministrarMaterial} onChange={e => setState({...state, suministrarMaterial: e.target.checked})} className="w-7 h-7 rounded-lg text-emerald-500 cursor-pointer" />
                        </div>
                        <AnimatePresence>
                            {state.suministrarMaterial && (
                                <motion.div key="material-input" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-6 pt-6 border-t border-emerald-100 dark:border-emerald-900/30">
                                    <Label className="text-[10px] font-black uppercase text-emerald-600 ml-2">Costo Extra por Unidad</Label>
                                    <div className="relative mt-2"><DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400"/><Input type="number" step="0.01" value={state.costoMaterialExtra} onChange={e => setState({...state, costoMaterialExtra: parseFloat(e.target.value) || 0})} className="h-12 pl-10 rounded-xl border-none bg-emerald-500/10 font-black text-emerald-700 text-lg" /></div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {state.error && (<Alert variant="destructive" className="rounded-[1.5rem] bg-red-50 border-red-200"><AlertCircle className="h-5 w-5" /><AlertTitle className="font-black">Error</AlertTitle><AlertDescription className="font-medium">{state.error}</AlertDescription></Alert>)}
                </div>
            </ScrollArea>
        </div>

        <footer className="shrink-0 p-8 md:px-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal Estimado</p>
                <div className="flex items-baseline gap-2"><span className="text-4xl font-black text-blue-600 tracking-tighter">${state.subtotal.toFixed(2)}</span><span className="text-sm font-black text-slate-300 uppercase">USD</span></div>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
                <Button variant="ghost" onClick={onClose} className="rounded-2xl h-14 px-8 font-black text-slate-400 hover:text-slate-600">Cancelar</Button>
                <Button onClick={handleSave} className="flex-1 md:flex-none rounded-2xl h-14 px-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-2xl transition-all hover:scale-105">
                    {itemToEdit ? "Guardar Cambios" : "Agregar Ítem"}
                </Button>
            </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function SectionField({ label, icon, children, className }: any) {
    return (
        <div className={cn("space-y-2.5", className)}>
            <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 flex items-center gap-1.5 tracking-widest">{icon} {label}</Label>
            {children}
        </div>
    )
}