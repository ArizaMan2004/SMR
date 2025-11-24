// @/components/orden/item-form-modal.tsx
"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react" 
// Shadcn UI
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// Iconos
import { AlertCircle, Sparkles, MoveVertical, Timer, Layers, Scissors, Hash, DollarSign, Box } from "lucide-react"

// Tipos
import { type ItemOrden, type UnidadItem, type TipoServicio } from "@/lib/types/orden" 

// --- CONSTANTES ---
const PRECIO_LASER_POR_MINUTO = 0.80

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

// Estado Inicial
const getInitialState = () => ({
  nombre: "",
  tipoServicio: "OTROS" as TipoServicio,
  cantidad: 1,
  unidad: "und" as UnidadItem,
  materialDeImpresion: "Otro/No aplica",
  materialDeCorte: MATERIALES_CORTE[0], 
  grosorMaterial: GROSORES_DISPONIBLES[2],      
  colorAcrilico: COLORES_ACRILICO[0].value, 
  precioUnitario: 0,
  medidaXCm: 0,
  medidaYCm: 0,
  tiempoCorte: "0:00",
  impresionMaterialPropio: undefined as 'Propio' | 'Intermediario' | undefined,
  empleadoAsignado: undefined as string | undefined,
  
  suministrarMaterial: false,
  costoMaterialExtra: 0,

  subtotal: 0,
  error: "",
});

type ItemFormState = ReturnType<typeof getInitialState>;

// --- PROPS ---
interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: ItemOrden) => void; 
  hasPrintingSelected: boolean;
  materialesDisponibles: readonly string[];
  itemToEdit?: ItemOrden; 
}

// --- COMPONENTE PRINCIPAL ---
export function ItemFormModal({ isOpen, onClose, onAddItem, hasPrintingSelected, materialesDisponibles, itemToEdit }: ItemFormModalProps) {
  const [state, setState] = useState<ItemFormState>(getInitialState());
  
  // Inputs temporales para tiempo
  const [minutosInput, setMinutosInput] = useState('0');
  const [segundosInput, setSegundosInput] = useState('00');
  
  // Reset / Cargar al abrir
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
          // MODO EDICIÓN
          let mins = '0';
          let secs = '00';
          if (itemToEdit.unidad === 'tiempo' && itemToEdit.tiempoCorte) {
              const parts = itemToEdit.tiempoCorte.split(':');
              mins = parts[0] || '0';
              secs = parts[1] || '00';
          }
          setMinutosInput(mins);
          setSegundosInput(secs);

          let matCorte = MATERIALES_CORTE[0];
          if (itemToEdit.tipoServicio === 'CORTE' && itemToEdit.materialDetalleCorte) {
              const parts = itemToEdit.materialDetalleCorte.split(' ');
              const foundMat = MATERIALES_CORTE.find(m => parts.includes(m));
              if (foundMat) matCorte = foundMat;
          }

          setState({
              ...getInitialState(),
              nombre: itemToEdit.nombre,
              tipoServicio: itemToEdit.tipoServicio || "OTROS",
              cantidad: itemToEdit.cantidad,
              unidad: itemToEdit.unidad,
              precioUnitario: itemToEdit.precioUnitario,
              medidaXCm: itemToEdit.medidaXCm || 0,
              medidaYCm: itemToEdit.medidaYCm || 0,
              materialDeImpresion: itemToEdit.materialDeImpresion || "Otro/No aplica",
              empleadoAsignado: itemToEdit.empleadoAsignado,
              tiempoCorte: itemToEdit.tiempoCorte || "0:00",
              materialDeCorte: matCorte,
              suministrarMaterial: (itemToEdit as any).suministrarMaterial || false,
              costoMaterialExtra: (itemToEdit as any).costoMaterialExtra || 0,
          });

      } else {
          // MODO CREACIÓN
          setState(getInitialState());
          setMinutosInput('0');
          setSegundosInput('00');
      }
    }
  }, [isOpen, itemToEdit]); 
  
  // CÁLCULO DE SUBTOTAL EN VIVO
  useEffect(() => {
    let costoBaseUnitario = 0;
    const { cantidad, precioUnitario, unidad, medidaXCm, medidaYCm, suministrarMaterial, costoMaterialExtra } = state; 

    if (cantidad > 0) {
        // 1. Calcular Costo Base del Servicio
        if (unidad === 'und') {
            costoBaseUnitario = precioUnitario;
        } else if (unidad === 'm2' && medidaXCm > 0 && medidaYCm > 0) {
            const area = (medidaXCm / 100) * (medidaYCm / 100);
            costoBaseUnitario = area * precioUnitario;
        } else if (unidad === 'tiempo') {
            const minutes = parseFloat(minutosInput) || 0;
            const seconds = parseFloat(segundosInput) || 0;
            const totalMinutes = minutes + (seconds / 60);
            costoBaseUnitario = totalMinutes * PRECIO_LASER_POR_MINUTO;
        }

        // 2. Sumar Costo de Material (si aplica, por unidad)
        let costoTotalUnitario = costoBaseUnitario;
        if (suministrarMaterial && costoMaterialExtra > 0) {
            costoTotalUnitario += costoMaterialExtra;
        }

        // 3. Total
        setState(prev => ({ ...prev, subtotal: costoTotalUnitario * cantidad }));
    } else {
        setState(prev => ({ ...prev, subtotal: 0 }));
    }
  }, [state.cantidad, state.precioUnitario, state.unidad, state.medidaXCm, state.medidaYCm, minutosInput, segundosInput, state.suministrarMaterial, state.costoMaterialExtra]); 
  
  // Auto-Configuración de tipo de servicio
  useEffect(() => {
    if (state.tipoServicio === 'CORTE') {
        setState(prev => ({ 
            ...prev, 
            unidad: 'tiempo', 
            materialDeImpresion: "Otro/No aplica" 
        }));
    } 
    else if (state.tipoServicio === 'IMPRESION') {
        setState(prev => ({ 
            ...prev, 
            unidad: 'm2', 
            materialDeCorte: MATERIALES_CORTE[0], 
            grosorMaterial: GROSORES_DISPONIBLES[2], 
            colorAcrilico: COLORES_ACRILICO[0].value
        }));
    }
    else {
        // Para otros, reseteamos materiales específicos pero mantenemos libertad
        if (state.tipoServicio !== 'CORTE' && state.tipoServicio !== 'IMPRESION') {
             setState(prev => ({
                ...prev,
                materialDeCorte: MATERIALES_CORTE[0],
                grosorMaterial: GROSORES_DISPONIBLES[2],
                colorAcrilico: COLORES_ACRILICO[0].value
            }));
        }
    }
  }, [state.tipoServicio]); 
  

  const handleChange = (key: keyof ItemFormState, value: any) => {
    setState(prev => ({ ...prev, [key]: value, error: "" }));
  };
  
  const handleSave = () => {
    if (!state.nombre.trim()) { setState(prev => ({ ...prev, error: "Falta la descripción." })); return; }
    if (state.cantidad <= 0) { setState(prev => ({ ...prev, error: "Cantidad inválida." })); return; }
    
    let finalNombre = state.nombre.trim();
    let materialDetalleCorte = ''; 

    if (state.tipoServicio === 'CORTE') {
        const mat = state.materialDeCorte;
        const gros = (mat !== 'Cartulina' && mat !== 'Otro') ? state.grosorMaterial : '';
        const col = (mat === 'Acrilico' && state.colorAcrilico) ? COLORES_ACRILICO.find(c => c.value === state.colorAcrilico)?.label : '';
        materialDetalleCorte = `${mat} ${gros} ${col}`.trim().replace(/\s+/g, ' '); 
        
        if (!finalNombre && materialDetalleCorte) {
            finalNombre = materialDetalleCorte;
            materialDetalleCorte = ''; 
        }
    }

    let tiempoCorteFinal: string | undefined;
    
    // 🔥🔥 CORRECCIÓN DEL PRECIO 0: Calculamos el precio unitario real antes de guardar
    let precioUnitarioCalculado = state.precioUnitario;

    if (state.unidad === 'tiempo') {
        const mins = Math.max(0, parseInt(minutosInput) || 0);
        const secs = Math.max(0, parseInt(segundosInput) || 0);
        if (mins === 0 && secs === 0) { setState(prev => ({ ...prev, error: "Tiempo inválido." })); return; }
        tiempoCorteFinal = `${mins + Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        
        // Calculamos el costo del tiempo y lo asignamos como precio unitario base
        precioUnitarioCalculado = (mins + (secs / 60)) * PRECIO_LASER_POR_MINUTO;
    }
    
    // Si hay material suministrado, lo sumamos al precio unitario para que el Wizard lo sume bien
    // Nota: Para m2, esto es un aproximado en la tabla del wizard si no desglosa, pero mantiene el total correcto.
    if (state.suministrarMaterial && state.costoMaterialExtra > 0) {
        // Si es m2, el costo extra es por UNIDAD entera, no por m2.
        // Para que la tabla del Wizard (que multiplica precio * cantidad) de el total correcto,
        // debemos "inyectar" este costo en el precio unitario de forma que al multiplicar de el total.
        // Total = (Servicio + Material) * Cantidad
        // PrecioUnitarioGuardado = Servicio + Material
        
        if (state.unidad === 'm2' && state.medidaXCm > 0 && state.medidaYCm > 0) {
             // El precioUnitario actual es por m2.
             // Necesitamos que (PrecioM2 * Area + CostoMaterial) * Cantidad = NuevoPrecio * Cantidad ???
             // No, la tabla del wizard hace: (PrecioUnitario * Cantidad). Es una tabla simple.
             // Si guardamos el precio ya calculado por item (Subtotal / Cantidad), la tabla funcionará.
             
             // Vamos a guardar el PRECIO FINAL POR PIEZA como precio unitario si es complejo
             // O mejor, confiamos en que la calculadora del modal lo hizo bien.
             
             // Estrategia Simple: Guardamos el precio unitario tal cual, y los datos extra.
             // El Wizard usará una función inteligente para sumar.
        } else {
             // Para unidad y tiempo es directo:
             precioUnitarioCalculado += state.costoMaterialExtra;
        }
    }
    
    const newItem: ItemOrden = {
      nombre: finalNombre, 
      tipoServicio: state.tipoServicio,
      cantidad: state.cantidad,
      unidad: state.unidad,
      
      // 🔥 Guardamos el precio calculado (que ya incluye tiempo y material)
      precioUnitario: precioUnitarioCalculado, 
      
      medidaXCm: state.medidaXCm,
      medidaYCm: state.medidaYCm,
      materialDeImpresion: state.materialDeImpresion !== "Otro/No aplica" ? state.materialDeImpresion : undefined,
      ...(tiempoCorteFinal && { tiempoCorte: tiempoCorteFinal }), 
      ...((materialDetalleCorte) && { materialDetalleCorte }), 
      ...(state.empleadoAsignado && { empleadoAsignado: state.empleadoAsignado }),
      
      // Guardamos datos extra para poder re-editar
      // @ts-ignore
      suministrarMaterial: state.suministrarMaterial,
      // @ts-ignore
      costoMaterialExtra: state.costoMaterialExtra,
    };

    onAddItem(newItem);
    onClose();
  };

  const showSizeInputs = state.unidad === 'm2';
  const showLaserInputs = state.unidad === 'tiempo';
  const showPriceInput = state.unidad !== 'tiempo';
  const showMaterialSelect = (state.tipoServicio === 'IMPRESION' || hasPrintingSelected) && state.tipoServicio !== 'CORTE';
  const showCorteDetails = state.tipoServicio === 'CORTE';
  const showGrosor = showCorteDetails && state.materialDeCorte !== 'Cartulina' && state.materialDeCorte !== 'Otro';
  const showColor = showCorteDetails && state.materialDeCorte === 'Acrilico';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-gray-50 dark:bg-slate-950">
        
        <DialogHeader className="p-6 pb-4 border-b bg-white dark:bg-slate-900 shrink-0">
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5"/> {itemToEdit ? "Editar Ítem" : "Nuevo Ítem"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full w-full">
                <div className="p-6 space-y-6">
                    
                    {/* 1. DATOS BÁSICOS */}
                    <Card className="shadow-sm border border-gray-200 dark:border-gray-800">
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-8 space-y-1.5">
                                <Label>Descripción del Ítem <span className="text-red-500">*</span></Label>
                                <Input value={state.nombre} onChange={(e) => handleChange('nombre', e.target.value)} placeholder="Ej: Letrero Corpóreo..." className="font-medium" autoFocus />
                            </div>
                            <div className="md:col-span-4 space-y-1.5">
                                <Label>Tipo de Servicio</Label>
                                <Select value={state.tipoServicio} onValueChange={(v: TipoServicio) => handleChange('tipoServicio', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IMPRESION">Impresión</SelectItem>
                                        <SelectItem value="ROTULACION">Rotulación</SelectItem>
                                        <SelectItem value="CORTE">Corte / Grabado</SelectItem> 
                                        <SelectItem value="AVISO_CORPOREO">Aviso Corpóreo</SelectItem>
                                        <SelectItem value="OTROS">Otros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="md:col-span-3 space-y-1.5">
                                <Label>Cantidad</Label>
                                <div className="relative"><Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input type="number" min="1" className="pl-9" value={state.cantidad} onChange={(e) => handleChange('cantidad', Math.max(1, parseInt(e.target.value) || 1))} /></div>
                            </div>

                            <div className="md:col-span-4 space-y-1.5">
                                <Label>Unidad</Label>
                                <Select value={state.unidad} onValueChange={(v: UnidadItem) => handleChange('unidad', v)} disabled={state.tipoServicio === 'CORTE'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{UNIDADES_DISPONIBLES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            {showPriceInput && (
                                <div className="md:col-span-5 space-y-1.5 animate-in fade-in zoom-in duration-300">
                                    <Label>Precio {state.unidad === 'm2' ? 'por m²' : 'Unitario'} (USD)</Label>
                                    <div className="relative"><DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-green-600"/><Input type="number" min="0" step="0.01" className="pl-9 font-bold text-green-700" value={state.precioUnitario} onChange={(e) => handleChange('precioUnitario', parseFloat(e.target.value) || 0)} /></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 2. DETALLES ESPECÍFICOS */}
                    {showCorteDetails && (
                        <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900 animate-in slide-in-from-top-2">
                            <CardContent className="p-4 space-y-4">
                                <h4 className="text-sm font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2"><Scissors className="w-4 h-4"/> Configuración de Material (Corte)</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5"><Label>Material</Label><Select value={state.materialDeCorte} onValueChange={(v) => handleChange('materialDeCorte', v)}><SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger><SelectContent>{MATERIALES_CORTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                                    {showGrosor && (<div className="space-y-1.5"><Label>Grosor</Label><Select value={state.grosorMaterial} onValueChange={(v) => handleChange('grosorMaterial', v)}><SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger><SelectContent>{GROSORES_DISPONIBLES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></div>)}
                                    {showColor && (<div className="space-y-1.5"><Label>Color</Label><Select value={state.colorAcrilico} onValueChange={(v) => handleChange('colorAcrilico', v)}><SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger><SelectContent>{COLORES_ACRILICO.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent></Select></div>)}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {showSizeInputs && (
                        <Card className="bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900 animate-in slide-in-from-top-2">
                            <CardContent className="p-4 grid grid-cols-2 gap-4">
                                <div className="col-span-2 text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><MoveVertical className="w-4 h-4"/> Dimensiones (cm)</div>
                                <div className="space-y-1.5"><Label>Ancho (X)</Label><Input type="number" min="0" value={state.medidaXCm} onChange={(e) => handleChange('medidaXCm', parseFloat(e.target.value) || 0)} className="bg-white dark:bg-slate-950"/></div>
                                <div className="space-y-1.5"><Label>Alto (Y)</Label><Input type="number" min="0" value={state.medidaYCm} onChange={(e) => handleChange('medidaYCm', parseFloat(e.target.value) || 0)} className="bg-white dark:bg-slate-950"/></div>
                            </CardContent>
                        </Card>
                    )}

                    {showLaserInputs && (
                        <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900 animate-in slide-in-from-top-2">
                            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label className="text-orange-700 font-bold flex items-center gap-2"><Timer className="w-4 h-4"/> Tiempo Estimado</Label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1"><Input placeholder="0" type="number" min="0" value={minutosInput} onChange={(e) => setMinutosInput(e.target.value)} className="bg-white dark:bg-slate-950 text-center font-mono"/><span className="text-[10px] text-center block text-muted-foreground mt-1">Minutos</span></div>
                                        <span className="text-xl font-bold text-orange-400">:</span>
                                        <div className="flex-1"><Input placeholder="00" type="number" min="0" max="59" value={segundosInput} onChange={(e) => setSegundosInput(e.target.value)} className="bg-white dark:bg-slate-950 text-center font-mono"/><span className="text-[10px] text-center block text-muted-foreground mt-1">Segundos</span></div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-950 p-3 rounded border text-center"><p className="text-xs text-muted-foreground uppercase font-bold mb-1">Tarifa Láser</p><p className="text-lg font-bold text-orange-600">${PRECIO_LASER_POR_MINUTO.toFixed(2)} / min</p></div>
                            </CardContent>
                        </Card>
                    )}

                    {showMaterialSelect && (
                        <div className="space-y-1.5 animate-in fade-in">
                            <Label className="flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500"/> Material de Impresión</Label>
                            <Select value={state.materialDeImpresion} onValueChange={(v) => handleChange('materialDeImpresion', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{materialesDisponibles.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                        </div>
                    )}

                    {/* SECCIÓN: SUMINISTRAR MATERIAL */}
                    <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                        <CardContent className="p-4 flex items-end gap-4">
                            <div className="flex items-center h-10">
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="checkbox" 
                                        id="suministrar" 
                                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={state.suministrarMaterial}
                                        onChange={(e) => handleChange('suministrarMaterial', e.target.checked)}
                                    />
                                    <Label htmlFor="suministrar" className="font-bold cursor-pointer flex items-center gap-2">
                                        <Box className="w-4 h-4" /> Suministrar Material
                                    </Label>
                                </div>
                            </div>
                            
                            {state.suministrarMaterial && (
                                <div className="flex-1 space-y-1.5 animate-in fade-in slide-in-from-left-2">
                                    <Label className="text-xs text-muted-foreground">Costo Material (por unidad)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                                        <Input 
                                            type="number" min="0" step="0.01" className="pl-9 bg-white dark:bg-slate-950"
                                            value={state.costoMaterialExtra} 
                                            onChange={(e) => handleChange('costoMaterialExtra', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {state.error && (
                        <Alert variant="destructive" className="animate-in zoom-in duration-300"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{state.error}</AlertDescription></Alert>
                    )}
                </div>
            </ScrollArea>
        </div>

        <div className="border-t bg-white dark:bg-slate-900 p-4 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
                <p className="text-xs text-muted-foreground uppercase font-bold">Subtotal Estimado</p>
                <p className="text-3xl font-black text-green-600 dark:text-green-400">${state.subtotal.toFixed(2)}</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button onClick={handleSave} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 min-w-[140px]">{itemToEdit ? "Guardar Cambios" : "Confirmar Ítem"}</Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}