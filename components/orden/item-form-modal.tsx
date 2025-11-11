// @/components/orden/item-form-modal.tsx
"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react" 
// Importaciones de Shadcn UI (Asegúrate de tenerlas configuradas)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
// Iconos
import { AlertCircle, Sparkles, MoveVertical, Timer } from "lucide-react"

// Importar tipos de la estructura central
import { type ItemOrden, type UnidadItem, type TipoServicio } from "@/lib/types/orden" 

// --- Constantes de Lógica de Negocio ---
const PRECIO_LASER_POR_MINUTO = 0.80

// NUEVAS CONSTANTES DE MATERIALES Y GROSORES
const MATERIALES_CORTE: readonly string[] = [
    "Acrilico",
    "Melamina",
    "MDF",
    "Cartulina", // Excepción sin grosor
    "Otro",
];

const GROSORES_DISPONIBLES: readonly string[] = [
    "1mm", "2mm", "3mm", "4mm", "5mm",
];

const COLORES_ACRILICO: { value: string, label: string, emoji: string }[] = [
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


// Tipos de Unidad disponibles
const UNIDADES_DISPONIBLES: { value: UnidadItem, label: string }[] = [
  { value: 'und', label: 'Unidad (und)' },
  { value: 'm2', label: 'Metros Cuadrados (m²)' },
  { value: 'tiempo', label: 'Tiempo (min/h)' },
]

// Estado inicial extendido
const getInitialState = () => ({
  nombre: "",
  tipoServicio: "OTROS" as TipoServicio,
  cantidad: 1,
  unidad: "und" as UnidadItem,
  
  // CAMPO DE MATERIALES DE IMPRESIÓN
  materialDeImpresion: "Otro/No aplica" as string,
  
  // NUEVOS CAMPOS PARA CORTE/GRABADO
  materialDeCorte: MATERIALES_CORTE[0] as string, 
  grosorMaterial: GROSORES_DISPONIBLES[2] as string,      
  colorAcrilico: COLORES_ACRILICO[0].value as string, 

  // Campos de entrada
  precioUnitario: 0,
  medidaXCm: 0,
  medidaYCm: 0,
  tiempoCorte: "0:00", // min:seg (se usa solo para guardar el formato final)
  
  // Estos campos opcionales son inicializados como undefined/null para evitar el error de Firebase
  impresionMaterialPropio: undefined as 'Propio' | 'Intermediario' | undefined,
  empleadoAsignado: undefined as string | undefined,
  
  // Cálculos
  subtotal: 0,
  error: "",
});

type ItemFormState = ReturnType<typeof getInitialState>;

// Componente auxiliar para animar secciones
const AnimatedSection: React.FC<React.PropsWithChildren<{ show: boolean }>> = ({ show, children }) => {
    return (
        <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                show ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}
        >
            {show && children}
        </div>
    );
};

// -------------------------------------------------------------------
// Interfaz de Props Actualizada
// -------------------------------------------------------------------

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Usamos ItemOrden directamente
  onAddItem: (item: ItemOrden) => void; 
  // NUEVAS PROPS DEL WIZARD
  hasPrintingSelected: boolean;
  materialesDisponibles: readonly string[];
}

// -------------------------------------------------------------------
// Componente Principal
// -------------------------------------------------------------------

export function ItemFormModal({ isOpen, onClose, onAddItem, hasPrintingSelected, materialesDisponibles }: ItemFormModalProps) {
  const [state, setState] = useState<ItemFormState>(getInitialState());
  
  // NUEVOS ESTADOS DE INPUT SEPARADOS PARA TIEMPO
  const [minutosInput, setMinutosInput] = useState('0');
  const [segundosInput, setSegundosInput] = useState('00');
  
  const resetTimeInputs = useCallback(() => {
    setMinutosInput('0');
    setSegundosInput('00');
  }, []);

  // Resetear el estado cuando el modal se abre/cierra
  useEffect(() => {
    if (isOpen) {
      setState(getInitialState());
      // Resetear los estados de minutos/segundos también
      resetTimeInputs();
    }
  }, [isOpen, resetTimeInputs]); 
  
  // -------------------------------------------------------------------
  // LÓGICA DE CÁLCULO Y EFECTOS
  // -------------------------------------------------------------------

  // Calcula el subtotal cada vez que las dependencias cambian
  useEffect(() => {
    let newSubtotal = 0;
    const { cantidad, precioUnitario, unidad, medidaXCm, medidaYCm } = state; 

    if (cantidad <= 0 || precioUnitario < 0) {
      setState(prev => ({ ...prev, subtotal: 0 }));
      return;
    }

    if (unidad === 'und') {
      newSubtotal = cantidad * precioUnitario;
    } 
    else if (unidad === 'm2') {
      if (medidaXCm > 0 && medidaYCm > 0) {
        const areaM2 = (medidaXCm / 100) * (medidaYCm / 100);
        newSubtotal = areaM2 * precioUnitario * cantidad;
      }
    } 
    else if (unidad === 'tiempo') {
      // USO DE LOS ESTADOS SEPARADOS PARA EL CÁLCULO EN VIVO
      const minutes = parseFloat(minutosInput) || 0;
      const seconds = parseFloat(segundosInput) || 0;
      
      const totalMinutes = minutes + (seconds / 60);
      newSubtotal = totalMinutes * PRECIO_LASER_POR_MINUTO * cantidad;
    }

    setState(prev => ({ ...prev, subtotal: newSubtotal }));
  }, [state.cantidad, state.precioUnitario, state.unidad, state.medidaXCm, state.medidaYCm, minutosInput, segundosInput]); 
  
  // LÓGICA DE AUTO-ASIGNACIÓN DE UNIDAD (Tiempo y m2)
  useEffect(() => {
    
    // 1. Forzar a 'tiempo' si es CORTE
    if (state.tipoServicio === 'CORTE') {
        if (state.unidad !== 'tiempo') {
            setState(prev => ({ 
                ...prev, 
                unidad: 'tiempo',
            }));
        }
    }
    // 2. Lógica para m2 (Impresión)
    else {
        // Si hay un material de impresión seleccionado que NO es el valor por defecto
        const isPrintingMaterialSelected = state.materialDeImpresion !== "Otro/No aplica";
        
        // Si hay impresión seleccionada Y se eligió un material, forzar a 'm2'
        if (hasPrintingSelected && isPrintingMaterialSelected) {
            // Solo actualizar si no es ya 'm2'
            if (state.unidad !== 'm2') {
                setState(prev => ({ 
                    ...prev, 
                    unidad: 'm2',
                }));
            }
        }
    }
    // Lógica para resetear campos de corte/impresión si el tipo de servicio cambia
    if (state.tipoServicio !== 'CORTE') {
        setState(prev => ({
            ...prev,
            materialDeCorte: MATERIALES_CORTE[0],
            grosorMaterial: GROSORES_DISPONIBLES[2],
            colorAcrilico: COLORES_ACRILICO[0].value,
        }));
    }
  }, [state.materialDeImpresion, hasPrintingSelected, state.unidad, state.tipoServicio]); 
  

  const handleChange = (key: keyof ItemFormState, value: any) => {
    setState(prev => ({ ...prev, [key]: value, error: "" }));
  };
  
  const handleSave = () => {
    if (!state.nombre.trim()) {
      setState(prev => ({ ...prev, error: "La descripción del ítem es obligatoria." }));
      return;
    }
    if (state.cantidad <= 0) {
      setState(prev => ({ ...prev, error: "La cantidad debe ser mayor a cero." }));
      return;
    }
    
    // --------------------------------------------------------------------------------------------------------------------
    // LÓGICA DE FORMATO DE NOMBRE y CREACIÓN DE MATERIAL DETALLE (CORREGIDA)
    // --------------------------------------------------------------------------------------------------------------------
    let finalNombre = state.nombre.trim();
    let materialDetalleCorte = ''; 

    if (state.tipoServicio === 'CORTE') {
        const material = state.materialDeCorte;
        let grosor = '';
        let color = '';

        if (material !== 'Cartulina' && material !== 'Otro' && state.grosorMaterial) {
            grosor = state.grosorMaterial;
        }

        if (material === 'Acrilico' && state.colorAcrilico) {
            const colorObj = COLORES_ACRILICO.find(c => c.value === state.colorAcrilico);
            color = colorObj ? colorObj.label : state.colorAcrilico;
        }

        // Crear la cadena de detalle para la tabla: Ejempo; "Acrilico 3mm Blanco"
        materialDetalleCorte = `${material} ${grosor ? grosor : ''} ${color ? color : ''}`.trim().replace(/\s+/g, ' '); 
        
        // CORRECCIÓN CLAVE 1: Eliminamos la concatenación a finalNombre.
        
        // Lógica de resguardo: Si no hay descripción, usamos el detalle de material como nombre principal
        if (!finalNombre && materialDetalleCorte) {
            finalNombre = materialDetalleCorte;
            materialDetalleCorte = ''; // Si se usa como nombre, la columna de detalle debe quedar vacía
        }
    }
    // FIN LÓGICA DE FORMATO DE NOMBRE
    // --------------------------------------------------------------------------------------------------------------------

    // LÓGICA DE FORMATO DE TIEMPO
    let tiempoCorteFinal: string | undefined = undefined;
    if (state.unidad === 'tiempo') {
        const parsedMinutos = Math.max(0, parseInt(minutosInput) || 0);
        const parsedSegundos = Math.max(0, parseInt(segundosInput) || 0);

        const secs = parsedSegundos % 60;
        const totalMinutos = parsedMinutos + Math.floor(parsedSegundos / 60);

        if (totalMinutos === 0 && secs === 0) {
            setState(prev => ({ ...prev, error: "El tiempo de corte no puede ser 0:00." }));
            return;
        }

        tiempoCorteFinal = `${String(totalMinutos).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    // FIN LÓGICA DE FORMATO DE TIEMPO
    
    // --------------------------------------------------------------------------------------------------------------------
    // CORRECCIÓN CLAVE 2: Construir el objeto ItemOrden sin valores 'undefined'
    // --------------------------------------------------------------------------------------------------------------------
    const newItem: ItemOrden = {
      nombre: finalNombre, 
      tipoServicio: state.tipoServicio,
      cantidad: state.cantidad,
      unidad: state.unidad,
      precioUnitario: state.precioUnitario,
      medidaXCm: state.medidaXCm,
      medidaYCm: state.medidaYCm,
      
      materialDeImpresion: state.materialDeImpresion,
      
      // Usamos el operador de propagación para incluir solo si el valor NO es 'undefined'
      // Esto previene el FirebaseError.
      ...(tiempoCorteFinal && { tiempoCorte: tiempoCorteFinal }), 
      
      // Permitimos que materialDetalleCorte sea un string vacío si lo es, pero evitamos 'undefined'
      ...((materialDetalleCorte !== undefined && materialDetalleCorte !== null) && { materialDetalleCorte: materialDetalleCorte }), 
      
      // Campos opcionales: solo se incluyen si el valor es 'truthy'
      ...(state.impresionMaterialPropio && { impresionMaterialPropio: state.impresionMaterialPropio }),
      ...(state.empleadoAsignado && { empleadoAsignado: state.empleadoAsignado }),
      
      // Si existe state.material (campo genérico en orden.ts)
      // ...(state.material && { material: state.material }), 
    };
    // --------------------------------------------------------------------------------------------------------------------


    onAddItem(newItem);
    onCloseModal();
  };
  
  const onCloseModal = () => {
      setState(getInitialState());
      resetTimeInputs(); 
      onClose();
  }

  // Determina qué campos de entrada mostrar
  const showSizeInputs = state.unidad === 'm2';
  const showLaserInputs = state.unidad === 'tiempo';
  const showPriceInput = state.unidad !== 'tiempo';
  
  // Determina si mostrar el selector de materiales de Impresión
  const showMaterialSelect = hasPrintingSelected && state.tipoServicio !== 'CORTE'; // No mostrar impresión si es CORTE
  
  // Variables condicionales para la nueva sección de CORTE
  const showCorteDetails = state.tipoServicio === 'CORTE';
  const showGrosor = showCorteDetails && state.materialDeCorte !== 'Cartulina' && state.materialDeCorte !== 'Otro';
  const showColor = showCorteDetails && state.materialDeCorte === 'Acrilico';


  return (
    <Dialog open={isOpen} onOpenChange={onCloseModal}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 sm:p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold text-primary dark:text-gray-100">
            <Sparkles className="w-5 h-5 inline mr-2 text-primary dark:text-gray-100"/>
            Calculadora de Ítem de Orden
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* 1. Campos Base */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="lg:col-span-2">
              <Label htmlFor="nombre">Descripción/Nombre del Ítem (*)</Label>
              <Input 
                id="nombre" 
                value={state.nombre} 
                onChange={(e) => handleChange('nombre', e.target.value)} 
                placeholder="Ej: Logo Rotulado - 150x150cm"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
              {/* Mensaje de concatenación ELIMINADO */}
            </div>
            
            <div>
              <Label htmlFor="tipoServicio">Tipo de Servicio</Label>
              <Select value={state.tipoServicio} onValueChange={(v: TipoServicio) => handleChange('tipoServicio', v)}>
                <SelectTrigger id="tipoServicio">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMPRESION">Impresión</SelectItem>
                  <SelectItem value="ROTULACION">Rotulación</SelectItem>
                  <SelectItem value="CORTE">Corte / Grabado Láser o CNC</SelectItem> 
                  <SelectItem value="AVISO_CORPOREO">Aviso Corpóreo</SelectItem>
                  <SelectItem value="OTROS">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cantidad">Cantidad (*)</Label>
              <Input 
                id="cantidad" 
                type="number" 
                min="1" 
                value={state.cantidad} 
                onChange={(e) => handleChange('cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          </div>
          
          <Separator />

          {/* DETALLES DE CORTE/GRABADO */}
          <AnimatedSection show={showCorteDetails}>
            <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                Detalles del Material de Corte/Grabado
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Selector de Material */}
                <div>
                    <Label htmlFor="materialDeCorte">Material</Label>
                    <Select 
                        value={state.materialDeCorte} 
                        onValueChange={(v: string) => handleChange('materialDeCorte', v)}
                    >
                        <SelectTrigger id="materialDeCorte">
                            <SelectValue placeholder="Seleccionar material" />
                        </SelectTrigger>
                        <SelectContent>
                            {MATERIALES_CORTE.map((material) => (
                                <SelectItem key={material} value={material}>
                                    {material}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                {/* Selector de Grosor (Condicional: no Cartulina/Otro) */}
                {showGrosor && (
                    <div>
                        <Label htmlFor="grosorMaterial">Grosor (mm)</Label>
                        <Select 
                            value={state.grosorMaterial} 
                            onValueChange={(v: string) => handleChange('grosorMaterial', v)}
                        >
                            <SelectTrigger id="grosorMaterial">
                                <SelectValue placeholder="Seleccionar grosor" />
                            </SelectTrigger>
                            <SelectContent>
                                {GROSORES_DISPONIBLES.map((grosor) => (
                                    <SelectItem key={grosor} value={grosor}>
                                        {grosor}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Selector de Color (Condicional: solo Acrílico) */}
                {showColor && (
                    <div>
                        <Label htmlFor="colorAcrilico">Color de Acrílico</Label>
                        <Select 
                            value={state.colorAcrilico} 
                            onValueChange={(v: string) => handleChange('colorAcrilico', v)}
                        >
                            <SelectTrigger id="colorAcrilico">
                                <SelectValue placeholder="Seleccionar color" />
                            </SelectTrigger>
                            <SelectContent>
                                {COLORES_ACRILICO.map((color) => (
                                    <SelectItem key={color.value} value={color.value}>
                                        {color.emoji} {color.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
          </AnimatedSection>

          <Separator />
          
          {/* 2. Unidades y Precio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div>
              <Label htmlFor="unidad">Unidad de Medida (*)</Label>
              <Select 
                value={state.unidad} 
                onValueChange={(v: UnidadItem) => handleChange('unidad', v)}
                // Deshabilitar si se seleccionó material de impresión O si el tipo de servicio es CORTE
                disabled={(showMaterialSelect && state.materialDeImpresion !== "Otro/No aplica") || state.tipoServicio === 'CORTE'}
              >
                <SelectTrigger id="unidad">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_DISPONIBLES.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.unidad === 'm2' && showMaterialSelect && state.materialDeImpresion !== "Otro/No aplica" && (
                <p className="text-xs text-blue-500 mt-1">
                    Unidad fijada a m² por el material seleccionado.
                </p>
              )}
              {state.unidad === 'tiempo' && state.tipoServicio === 'CORTE' && (
                <p className="text-xs text-blue-500 mt-1">
                    Unidad fijada a Tiempo por el tipo de servicio (Corte/Grabado).
                </p>
              )}
            </div>

            {/* SELECTOR DE MATERIAL DE IMPRESIÓN (Condicional) */}
            {showMaterialSelect && (
                <div>
                    <Label htmlFor="materialDeImpresion">Material de Impresión</Label>
                    <Select 
                        value={state.materialDeImpresion} 
                        onValueChange={(v: string) => handleChange('materialDeImpresion', v)}
                    >
                        <SelectTrigger id="materialDeImpresion">
                            <SelectValue placeholder="Seleccionar material" />
                        </SelectTrigger>
                        <SelectContent>
                            {materialesDisponibles.map((material) => (
                                <SelectItem key={material} value={material}>
                                    {material}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            
            {showPriceInput && (
              <div className={showMaterialSelect ? "col-span-1" : "col-span-2"}>
                <Label htmlFor="precioUnitario">Precio Unitario (USD) / Precio por m²</Label>
                <Input 
                  id="precioUnitario" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={state.precioUnitario} 
                  onChange={(e) => handleChange('precioUnitario', parseFloat(e.target.value) || 0)}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            )}
          </div>
          
          <Separator />
          
          {/* 3. Campos Condicionales de Cálculo */}
          
          {/* Cálculo por m2 */}
          <AnimatedSection show={showSizeInputs}>
            <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                <MoveVertical className="w-4 h-4"/>
                Dimensiones (Metros Cuadrados)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="medidaXCm">Medida X (cm)</Label>
                <Input 
                  id="medidaXCm" 
                  type="number" 
                  min="0" 
                  value={state.medidaXCm} 
                  onChange={(e) => handleChange('medidaXCm', parseFloat(e.target.value) || 0)}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <Label htmlFor="medidaYCm">Medida Y (cm)</Label>
                <Input 
                  id="medidaYCm" 
                  type="number" 
                  min="0" 
                  value={state.medidaYCm} 
                  onChange={(e) => handleChange('medidaYCm', parseFloat(e.target.value) || 0)}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                Cálculo: (Medida X / 100) * (Medida Y / 100) * Precio m² * Cantidad
            </p>
          </AnimatedSection>

          {/* Cálculo por Tiempo (Láser/CNC) */}
          <AnimatedSection show={showLaserInputs}>
            <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                <Timer className="w-4 h-4"/>
                Tiempo de Corte Láser / CNC
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CAMPO DE TIEMPO DIVIDIDO */}
              <div className="flex gap-4">
                <div className="flex-1">
                    <Label htmlFor="minutosInput">Minutos</Label>
                    <Input 
                      id="minutosInput" 
                      type="number" 
                      min="0" 
                      value={minutosInput} 
                      onChange={(e) => setMinutosInput(e.target.value)}
                      placeholder="0"
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                </div>
                <div className="flex-1">
                    <Label htmlFor="segundosInput">Segundos</Label>
                    <Input 
                      id="segundosInput" 
                      type="number" 
                      min="0" 
                      value={segundosInput} 
                      onChange={(e) => setSegundosInput(e.target.value)}
                      placeholder="00"
                      className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                </div>
              </div>
              {/* FIN CAMPO DE TIEMPO DIVIDIDO */}
              
              <div className="sm:col-span-1">
                <Card className="p-3 border-l-4 border-l-orange-500 dark:bg-gray-700/50">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    Precio por Minuto: <span className="font-bold">${PRECIO_LASER_POR_MINUTO.toFixed(2)} USD</span>
                  </p>
                </Card>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                Cálculo: (Minutos + Segundos/60) * ${PRECIO_LASER_POR_MINUTO.toFixed(2)} * Cantidad
            </p>
          </AnimatedSection>
          
          {/* 4. SUBTOTAL y Mensajes */}
          <Separator />
          <Card className="p-4 bg-primary/10 dark:bg-primary/20">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-primary dark:text-white">Subtotal por Ítem</h3>
              <p className="text-3xl font-extrabold text-green-700 dark:text-green-400">
                ${state.subtotal.toFixed(2)} USD
              </p>
            </div>
          </Card>

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          
        </div>

        {/* Footer con Botones */}
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 p-6 pt-4 border-t">
          <Button variant="outline" onClick={onCloseModal}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
            Añadir Ítem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}