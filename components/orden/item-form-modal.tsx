// @/components/orden/item-form-modal.tsx
"use client"

import * as React from "react"
import { useState, useEffect } from "react" 
// Shadcn UI
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
    AlertCircle, Sparkles, MoveVertical, Timer, Layers, Scissors, 
    Hash, DollarSign, Box, FileCode, FileImage, PenTool 
} from "lucide-react"

// Tipos
import { type ItemOrden, type UnidadItem, type TipoServicio } from "@/lib/types/orden" 

// --- CONSTANTES DE NEGOCIO ---
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

// Configuración de Archivos
const TIPOS_ARCHIVO = [
    { value: "vector", label: "Vector (Líneas)", icon: FileCode },
    { value: "imagen", label: "Imagen (Pixel)", icon: FileImage },
]
const FORMATOS_ARCHIVO = {
    vector: ["CDR", "AI", "PDF", "DXF", "EPS", "SVG"],
    imagen: ["JPG", "PNG", "PSD", "TIFF", "BMP"]
}

// --- ESTADO INICIAL ---
const getInitialState = () => ({
  nombre: "",
  // @ts-ignore: Permitimos DISENO aunque no esté en el tipo estricto de TS aún
  tipoServicio: "OTROS" as TipoServicio | "DISENO",
  cantidad: 1,
  unidad: "und" as UnidadItem,
  
  // Materiales Impresión
  materialDeImpresion: "Otro/No aplica",
  
  // Materiales Corte
  materialDeCorte: MATERIALES_CORTE[0], 
  grosorMaterial: GROSORES_DISPONIBLES[2],      
  colorAcrilico: COLORES_ACRILICO[0].value, 

  // Archivos (Solo diseño)
  archivoTipo: "vector" as "vector" | "imagen",
  archivoFormato: "CDR",
  
  // Costos y Medidas
  precioUnitario: 0,
  medidaXCm: 0,
  medidaYCm: 0,
  tiempoCorte: "0:00",
  empleadoAsignado: undefined as string | undefined,
  
  // Extras
  suministrarMaterial: false,
  costoMaterialExtra: 0,

  subtotal: 0,
  error: "",
});

type ItemFormState = ReturnType<typeof getInitialState>;

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: ItemOrden) => void; 
  hasPrintingSelected: boolean;
  materialesDisponibles: readonly string[];
  itemToEdit?: ItemOrden; 
}

export function ItemFormModal({ isOpen, onClose, onAddItem, hasPrintingSelected, materialesDisponibles, itemToEdit }: ItemFormModalProps) {
  const [state, setState] = useState<ItemFormState>(getInitialState());
  const [minutosInput, setMinutosInput] = useState('0');
  const [segundosInput, setSegundosInput] = useState('00');
  
  // 1. CARGAR DATOS AL ABRIR
  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
          // Parsear Tiempo
          const isTiempo = itemToEdit.unidad === 'tiempo';
          let mins = '0', secs = '00';
          if (isTiempo && itemToEdit.tiempoCorte) {
             const parts = itemToEdit.tiempoCorte.split(':');
             mins = parts[0] || '0'; secs = parts[1] || '00';
          }
          
          // Parsear Materiales de Corte
          let matCorte = MATERIALES_CORTE[0];
          let grosor = GROSORES_DISPONIBLES[2];
          let color = COLORES_ACRILICO[0].value;
          
          if (itemToEdit.materialDetalleCorte) {
             const parts = itemToEdit.materialDetalleCorte.split(' ');
             const foundMat = MATERIALES_CORTE.find(m => parts.includes(m));
             if (foundMat) matCorte = foundMat;
             const foundGros = GROSORES_DISPONIBLES.find(g => parts.includes(g));
             if (foundGros) grosor = foundGros;
             const foundColor = COLORES_ACRILICO.find(c => itemToEdit.materialDetalleCorte?.includes(c.label));
             if (foundColor) color = foundColor.value;
          }

          // @ts-ignore: Recuperar campos nuevos si existen
          const archTipo = itemToEdit.archivoTipo || "vector";
          // @ts-ignore
          const archFmt = itemToEdit.archivoFormato || "CDR";

          setMinutosInput(mins);
          setSegundosInput(secs);
          
          setState({
              ...getInitialState(),
              ...itemToEdit,
              // @ts-ignore
              tipoServicio: itemToEdit.tipoServicio, // Para aceptar DISENO
              materialDeCorte: matCorte,
              grosorMaterial: grosor,
              colorAcrilico: color,
              archivoTipo: archTipo,
              archivoFormato: archFmt,
              // @ts-ignore
              suministrarMaterial: itemToEdit.suministrarMaterial || false,
              // @ts-ignore
              costoMaterialExtra: itemToEdit.costoMaterialExtra || 0,
          });
      } else {
          setState(getInitialState());
          setMinutosInput('0');
          setSegundosInput('00');
      }
    }
  }, [isOpen, itemToEdit]); 
  
  // 2. CALCULADORA DE SUBTOTAL (Efecto en Vivo)
  useEffect(() => {
    let costoBaseUnitario = 0;
    const { cantidad, precioUnitario, unidad, medidaXCm, medidaYCm, suministrarMaterial, costoMaterialExtra } = state; 

    if (cantidad > 0) {
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
        
        // Sumar extras
        let costoTotalUnitario = costoBaseUnitario;
        if (suministrarMaterial && costoMaterialExtra > 0) {
            costoTotalUnitario += costoMaterialExtra;
        }

        setState(prev => ({ ...prev, subtotal: costoTotalUnitario * cantidad }));
    } else {
        setState(prev => ({ ...prev, subtotal: 0 }));
    }
  }, [state.cantidad, state.precioUnitario, state.unidad, state.medidaXCm, state.medidaYCm, minutosInput, segundosInput, state.suministrarMaterial, state.costoMaterialExtra]); 
  
  // 3. AUTO-CONFIGURACIÓN INTELIGENTE
  useEffect(() => {
    if (state.tipoServicio === 'DISENO') {
        setState(prev => ({ ...prev, unidad: 'und', materialDeImpresion: "Otro/No aplica", archivoTipo: 'imagen', archivoFormato: 'JPG' }));
    } 
    else if (state.tipoServicio === 'CORTE') {
        setState(prev => ({ ...prev, unidad: 'tiempo', materialDeImpresion: "Otro/No aplica", archivoTipo: 'vector', archivoFormato: 'CDR' }));
    } 
    else if (state.tipoServicio === 'IMPRESION') {
        setState(prev => ({ ...prev, unidad: 'm2', archivoTipo: 'imagen', archivoFormato: 'TIFF' }));
    }
  }, [state.tipoServicio]); 

  const handleChange = (key: keyof ItemFormState, value: any) => {
    setState(prev => ({ ...prev, [key]: value, error: "" }));
  };
  
  // 4. GUARDAR
  const handleSave = () => {
    if (!state.nombre.trim()) { setState(prev => ({ ...prev, error: "Falta la descripción del ítem." })); return; }
    if (state.cantidad <= 0) { setState(prev => ({ ...prev, error: "La cantidad debe ser mayor a 0." })); return; }
    
    // Generar nombre automático para Corte si es genérico
    let finalNombre = state.nombre.trim();
    let materialDetalleCorte = '';
    
    if (state.tipoServicio === 'CORTE') {
        const mat = state.materialDeCorte;
        const gros = (mat !== 'Cartulina' && mat !== 'Otro') ? state.grosorMaterial : '';
        const col = (mat === 'Acrilico' && state.colorAcrilico) ? COLORES_ACRILICO.find(c => c.value === state.colorAcrilico)?.label : '';
        materialDetalleCorte = `${mat} ${gros} ${col}`.trim().replace(/\s+/g, ' '); 
        
        // Si el usuario dejó el nombre por defecto, lo enriquecemos
        if (finalNombre === "" || finalNombre.toLowerCase() === "corte") {
            finalNombre = `Corte ${materialDetalleCorte}`;
        }
    }

    // Calcular Precio Unitario Final
    let tiempoCorteFinal: string | undefined;
    let precioUnitarioCalculado = state.precioUnitario;

    if (state.unidad === 'tiempo') {
        const mins = Math.max(0, parseInt(minutosInput) || 0);
        const secs = Math.max(0, parseInt(segundosInput) || 0);
        if (mins === 0 && secs === 0) { setState(prev => ({ ...prev, error: "El tiempo no puede ser 0." })); return; }
        
        tiempoCorteFinal = `${mins}:${String(secs).padStart(2, '0')}`;
        // En unidad Tiempo, el precio unitario ES el costo total del tiempo por unidad de servicio
        precioUnitarioCalculado = (mins + (secs / 60)) * PRECIO_LASER_POR_MINUTO;
    }
    
    // Sumar Material Extra al precio unitario base para que el total de la orden cuadre
    if (state.suministrarMaterial && state.costoMaterialExtra > 0) {
         // Nota: Para m2 esto simplifica el costo extra por pieza, no por m2.
         precioUnitarioCalculado += state.costoMaterialExtra;
    }

    const newItem: ItemOrden = {
      nombre: finalNombre, 
      // @ts-ignore
      tipoServicio: state.tipoServicio,
      cantidad: state.cantidad,
      unidad: state.unidad,
      precioUnitario: precioUnitarioCalculado, 
      
      medidaXCm: state.medidaXCm,
      medidaYCm: state.medidaYCm,
      materialDeImpresion: state.materialDeImpresion !== "Otro/No aplica" ? state.materialDeImpresion : undefined,
      
      ...(tiempoCorteFinal && { tiempoCorte: tiempoCorteFinal }), 
      ...(materialDetalleCorte && { materialDetalleCorte }), 
      ...(state.empleadoAsignado && { empleadoAsignado: state.empleadoAsignado }),
      
      // Campos nuevos (se guardan aunque TS se queje si no actualizas types.ts)
      // @ts-ignore
      archivoTipo: state.archivoTipo,
      // @ts-ignore
      archivoFormato: state.archivoFormato,
      // @ts-ignore
      suministrarMaterial: state.suministrarMaterial,
      // @ts-ignore
      costoMaterialExtra: state.costoMaterialExtra,
    };

    onAddItem(newItem);
    onClose();
  };

  // --- LOGICA DE VISIBILIDAD DE CAMPOS ---
  const showSizeInputs = state.unidad === 'm2';
  const showLaserInputs = state.unidad === 'tiempo';
  const showPriceInput = state.unidad !== 'tiempo'; // Si es tiempo, el precio se calcula solo
  
  // Impresión: mostrar si es tipo IMPRESION o si viene de un contexto de impresión
  const showMaterialSelect = (state.tipoServicio === 'IMPRESION' || hasPrintingSelected) && state.tipoServicio !== 'CORTE' && state.tipoServicio !== 'DISENO';
  
  // Corte: mostrar solo si es tipo CORTE
  const showCorteDetails = state.tipoServicio === 'CORTE';
  const showGrosor = showCorteDetails && state.materialDeCorte !== 'Cartulina' && state.materialDeCorte !== 'Otro';
  const showColor = showCorteDetails && state.materialDeCorte === 'Acrilico';

  // Diseño: mostrar solo si es tipo DISENO
  const showFileDetails = state.tipoServicio === 'DISENO';

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
                    
                    {/* BLOQUE 1: DATOS PRINCIPALES */}
                    <Card className="shadow-sm border border-gray-200 dark:border-gray-800">
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Nombre */}
                            <div className="md:col-span-8 space-y-1.5">
                                <Label>Descripción del Trabajo <span className="text-red-500">*</span></Label>
                                <Input value={state.nombre} onChange={(e) => handleChange('nombre', e.target.value)} placeholder="Ej: Diseño de Logo, Corte de Letras..." className="font-medium" autoFocus />
                            </div>
                            
                            {/* Tipo de Servicio */}
                            <div className="md:col-span-4 space-y-1.5">
                                <Label>Tipo de Servicio</Label>
                                <Select value={state.tipoServicio} onValueChange={(v) => handleChange('tipoServicio', v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DISENO">🎨 Diseño Gráfico</SelectItem>
                                        <SelectItem value="IMPRESION">🖨️ Impresión Digital</SelectItem>
                                        <SelectItem value="CORTE">✂️ Corte / Grabado</SelectItem> 
                                        <SelectItem value="ROTULACION">🚗 Rotulación</SelectItem>
                                        <SelectItem value="AVISO_CORPOREO">🏢 Aviso Corpóreo</SelectItem>
                                        <SelectItem value="OTROS">📦 Otros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {/* Cantidad */}
                            <div className="md:col-span-3 space-y-1.5">
                                <Label>Cantidad</Label>
                                <div className="relative">
                                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                                    <Input type="number" min="1" className="pl-9" value={state.cantidad} onChange={(e) => handleChange('cantidad', Math.max(1, parseInt(e.target.value) || 1))} />
                                </div>
                            </div>
                            
                            {/* Unidad */}
                            <div className="md:col-span-4 space-y-1.5">
                                <Label>Unidad de Medida</Label>
                                <Select value={state.unidad} onValueChange={(v: UnidadItem) => handleChange('unidad', v)} disabled={state.tipoServicio === 'CORTE' || state.tipoServicio === 'DISENO'}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{UNIDADES_DISPONIBLES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            {/* Precio Manual (Oculto si es Tiempo porque se calcula solo) */}
                            {showPriceInput && (
                                <div className="md:col-span-5 space-y-1.5 animate-in fade-in zoom-in duration-300">
                                    <Label>Precio {state.unidad === 'm2' ? 'por m²' : 'Unitario'} (USD)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-green-600"/>
                                        <Input type="number" min="0" step="0.01" className="pl-9 font-bold text-green-700" value={state.precioUnitario} onChange={(e) => handleChange('precioUnitario', parseFloat(e.target.value) || 0)} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* BLOQUE 2: DETALLES DE ARCHIVO (SOLO DISEÑO) */}
                    {showFileDetails && (
                        <Card className="bg-indigo-50/50 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900 animate-in fade-in slide-in-from-top-2">
                             <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-indigo-700 flex items-center gap-2"><PenTool className="w-4 h-4"/> Tipo de Entrega</Label>
                                    <Select value={state.archivoTipo} onValueChange={(v:any) => handleChange('archivoTipo', v)}>
                                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                                        <SelectContent>{TIPOS_ARCHIVO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-indigo-700">Formato / Extensión</Label>
                                    <Select value={state.archivoFormato} onValueChange={(v) => handleChange('archivoFormato', v)}>
                                        <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {FORMATOS_ARCHIVO[state.archivoTipo].map(fmt => (
                                                <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                             </CardContent>
                        </Card>
                    )}

                    {/* BLOQUE 3: DETALLES DE CORTE (SOLO CORTE) */}
                    {showCorteDetails && (
                        <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900 animate-in slide-in-from-top-2">
                            <CardContent className="p-4 space-y-4">
                                <h4 className="text-sm font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2"><Scissors className="w-4 h-4"/> Materiales para Corte</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Material</Label>
                                        <Select value={state.materialDeCorte} onValueChange={(v) => handleChange('materialDeCorte', v)}>
                                            <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                                            <SelectContent>{MATERIALES_CORTE.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    {showGrosor && (
                                        <div className="space-y-1.5">
                                            <Label>Grosor</Label>
                                            <Select value={state.grosorMaterial} onValueChange={(v) => handleChange('grosorMaterial', v)}>
                                                <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                                                <SelectContent>{GROSORES_DISPONIBLES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {showColor && (
                                        <div className="space-y-1.5">
                                            <Label>Color</Label>
                                            <Select value={state.colorAcrilico} onValueChange={(v) => handleChange('colorAcrilico', v)}>
                                                <SelectTrigger className="bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                                                <SelectContent>{COLORES_ACRILICO.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* BLOQUE 4: MEDIDAS (SOLO M2) */}
                    {showSizeInputs && (
                        <Card className="bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-900 animate-in slide-in-from-top-2">
                            <CardContent className="p-4 grid grid-cols-2 gap-4">
                                <div className="col-span-2 text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2"><MoveVertical className="w-4 h-4"/> Dimensiones (cm)</div>
                                <div className="space-y-1.5">
                                    <Label>Ancho (X)</Label>
                                    <Input type="number" min="0" value={state.medidaXCm} onChange={(e) => handleChange('medidaXCm', parseFloat(e.target.value) || 0)} className="bg-white dark:bg-slate-950"/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Alto (Y)</Label>
                                    <Input type="number" min="0" value={state.medidaYCm} onChange={(e) => handleChange('medidaYCm', parseFloat(e.target.value) || 0)} className="bg-white dark:bg-slate-950"/>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* BLOQUE 5: TIEMPO LASER (SOLO TIEMPO) */}
                    {showLaserInputs && (
                        <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900 animate-in slide-in-from-top-2">
                            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label className="text-orange-700 font-bold flex items-center gap-2"><Timer className="w-4 h-4"/> Tiempo de Corte</Label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <Input placeholder="0" type="number" min="0" value={minutosInput} onChange={(e) => setMinutosInput(e.target.value)} className="bg-white dark:bg-slate-950 text-center font-mono text-lg"/>
                                            <span className="text-[10px] text-center block text-muted-foreground mt-1">Minutos</span>
                                        </div>
                                        <span className="text-xl font-bold text-orange-400">:</span>
                                        <div className="flex-1">
                                            <Input placeholder="00" type="number" min="0" max="59" value={segundosInput} onChange={(e) => setSegundosInput(e.target.value)} className="bg-white dark:bg-slate-950 text-center font-mono text-lg"/>
                                            <span className="text-[10px] text-center block text-muted-foreground mt-1">Segundos</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-950 p-3 rounded border text-center">
                                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Tarifa Láser</p>
                                    <p className="text-lg font-bold text-orange-600">${PRECIO_LASER_POR_MINUTO.toFixed(2)} / min</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* BLOQUE 6: MATERIAL IMPRESIÓN */}
                    {showMaterialSelect && (
                        <div className="space-y-1.5 animate-in fade-in">
                            <Label className="flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500"/> Material de Impresión</Label>
                            <Select value={state.materialDeImpresion} onValueChange={(v) => handleChange('materialDeImpresion', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{materialesDisponibles.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* BLOQUE 7: SUMINISTRO MATERIAL (GLOBAL) */}
                    <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                        <CardContent className="p-4 flex items-end gap-4">
                            <div className="flex items-center h-10">
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="suministrar" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={state.suministrarMaterial} onChange={(e) => handleChange('suministrarMaterial', e.target.checked)}/>
                                    <Label htmlFor="suministrar" className="font-bold cursor-pointer flex items-center gap-2">
                                        <Box className="w-4 h-4 text-primary" /> Suministrar Material
                                    </Label>
                                </div>
                            </div>
                            {state.suministrarMaterial && (
                                <div className="flex-1 space-y-1.5 animate-in fade-in slide-in-from-left-2">
                                    <Label className="text-xs text-muted-foreground">Costo Material (Unitario)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                                        <Input type="number" min="0" step="0.01" className="pl-9 bg-white dark:bg-slate-950" value={state.costoMaterialExtra} onChange={(e) => handleChange('costoMaterialExtra', parseFloat(e.target.value) || 0)} placeholder="0.00"/>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {state.error && (<Alert variant="destructive" className="animate-in zoom-in duration-300"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{state.error}</AlertDescription></Alert>)}
                </div>
            </ScrollArea>
        </div>

        {/* FOOTER: TOTALES Y BOTONES */}
        <div className="border-t bg-white dark:bg-slate-900 p-4 shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
                <p className="text-xs text-muted-foreground uppercase font-bold">Subtotal Estimado</p>
                <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-black text-green-600 dark:text-green-400">${state.subtotal.toFixed(2)}</p>
                    <span className="text-sm text-gray-400">USD</span>
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button onClick={handleSave} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 min-w-[140px] shadow-lg shadow-primary/20">
                    {itemToEdit ? "Guardar Cambios" : "Agregar Ítem"}
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}