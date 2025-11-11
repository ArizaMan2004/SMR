// @/components/orden/order-form-wizard.tsx
"use client"

import { useState, useMemo, useCallback } from "react"
// Importaciones de Shadcn UI
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area" 
import { Badge } from "@/components/ui/badge" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table" 

import { ChevronLeft, ChevronRight, Plus, X, User, DollarSign, Calendar, Truck, Timer } from "lucide-react"

// Importaciones de tipos (Asumimos que están en @/lib/types/orden)
import { type FormularioOrdenData, type ItemOrden, type ServiciosSolicitados, EstadoOrden } from "@/lib/types/orden" 
import { ItemFormModal } from "@/components/orden/item-form-modal"


// 🚧 Mock de Empleados (Ajusta esta lista según tus empleados reales)
const EMPLEADOS_DISPONIBLES = [
    "N/A", 
    "Daniela Chiquito (Corte Láser)",
    "Jose Angel (Impresión)",
    "Daniel Montero (Impresión)",
    "Jesus Ariza (Diseño)",
];

// 🔑 Tipos de Material de Impresión
const MATERIALES_IMPRESION = [
    "Vinil Brillante",
    "Vinil Mate",
    "Banner Cara Negra",
    "Banner Cara Blanca",
    "Banner Cara Gris",
    "Vinil Transparente (Clear)",
    "Otro/No aplica" 
] as const;
type MaterialDeImpresion = typeof MATERIALES_IMPRESION[number];


// Helper para convertir las claves de servicio en texto legible
const getServiceText = (key: keyof ServiciosSolicitados): string => {
    switch (key) {
        case 'impresionDigital': return 'Impresión Digital (Hojas)';
        case 'impresionGranFormato': return 'Impresión Gran Formato (Rollos)';
        case 'corteLaser': return 'Corte Láser / CNC';
        case 'laminacion': return 'Laminación / Plastificado';
        case 'avisoCorporeo': return 'Aviso Corpóreo';
        case 'rotulacion': return 'Rotulación / Montaje';
        case 'instalacion': return 'Instalación';
        case 'senaletica': return 'Señaletica';
        default: return key;
    }
};


// -------------------------------------------------------------------
// ESTADO INICIAL
// -------------------------------------------------------------------

const INITIAL_FORM_DATA: FormularioOrdenData = {
    ordenNumero: '', 
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: {
        nombreRazonSocial: "", rifCedula: "", telefono: "", domicilioFiscal: "",
        correo: "", personaContacto: "",
    },
    serviciosSolicitados: {
        impresionDigital: false, impresionGranFormato: false, corteLaser: false, laminacion: false,
        avisoCorporeo: false, rotulacion: false, instalacion: false, senaletica: false,
    },
    items: [],
    descripcionDetallada: "",
};


// -------------------------------------------------------------------
// 🔑 Componente OrderFormWizardV2
// -------------------------------------------------------------------

interface OrderFormWizardProps {
    onSave: (data: FormularioOrdenData & { totalUSD: number }) => Promise<void>;
    onClose: () => void;
    className?: string;
}

export const OrderFormWizardV2: React.FC<OrderFormWizardProps> = ({ onSave, onClose, className }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormularioOrdenData>(INITIAL_FORM_DATA);
    const [isLoading, setIsLoading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    
    // Función genérica para manejar cambios en el formulario
    const handleChange = useCallback((path: string, value: any) => {
        setFormData(prev => {
            const newForm = { ...prev };
            const keys = path.split('.');
            let current: any = newForm;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newForm;
        });
    }, []);
    
    // LÓGICA DE AÑADIR ITEM
    const handleAddItem = useCallback((newItem: ItemOrden & { materialDeImpresion?: MaterialDeImpresion }) => {
        const itemWithAssignment: ItemOrden & { materialDeImpresion?: MaterialDeImpresion, empleadoAsignado: string } = {
            ...newItem,
            empleadoAsignado: "N/A", 
            materialDeImpresion: newItem.materialDeImpresion || "Otro/No aplica"
        };

        setFormData(prev => {
            const newItems = [...prev.items, itemWithAssignment as ItemOrden];
            const newForm = { ...prev, items: newItems };
            
            // --- Lógica de Auto-Check de Servicios ---
            if (newItem.unidad === 'tiempo' || newItem.tipoServicio === 'CORTE_LASER') {
                newForm.serviciosSolicitados.corteLaser = true;
            }
            if (newItem.tipoServicio === 'IMPRESION') {
                newForm.serviciosSolicitados.impresionDigital = true;
            }
            if (newItem.tipoServicio === 'ROTULACION') {
                newForm.serviciosSolicitados.rotulacion = true;
            }
            if (newItem.tipoServicio === 'AVISO_CORPOREO') {
                newForm.serviciosSolicitados.avisoCorporeo = true;
            }
            if (newItem.materialDeImpresion && newItem.materialDeImpresion !== "Otro/No aplica") {
                 newForm.serviciosSolicitados.impresionGranFormato = true;
            }
            
            return newForm;
        });
    }, []);

    const handleItemAssignmentChange = useCallback((itemIndex: number, employeeName: string) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            (newItems[itemIndex] as any).empleadoAsignado = employeeName;
            return { ...prev, items: newItems };
        });
    }, []);

    const removeItem = useCallback((indexToRemove: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, index) => index !== indexToRemove)
        }));
    }, []);

    // Lógica de Cálculo (Duplicada en Step2 por conveniencia)
    const calculateTotal = (items: ItemOrden[]) => {
      return items.reduce((sum, item) => {
          let subtotal = 0;
          const PRECIO_LASER_POR_MINUTO = 0.80; // Hardcoded price for consistency
          const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item as any;
          
          if (cantidad <= 0 || precioUnitario < 0) return sum;

          if (unidad === 'und') {
              subtotal = cantidad * precioUnitario;
          } else if (unidad === 'm2') {
              if (medidaXCm && medidaYCm) {
                  const areaM2 = (medidaXCm / 100) * (medidaYCm / 100);
                  subtotal = areaM2 * precioUnitario * cantidad; 
              }
          } else if (unidad === 'tiempo' && tiempoCorte) {
             const [minutesStr = '0', secondsStr = '0'] = tiempoCorte.split(':');
             const minutes = parseFloat(minutesStr) || 0; 
             const seconds = parseFloat(secondsStr) || 0;
             const totalMinutes = minutes + (seconds / 60);
             
             subtotal = totalMinutes * PRECIO_LASER_POR_MINUTO * cantidad; 
          }
          return sum + subtotal;
      }, 0);
    }
    
    const currentTotal = useMemo(() => calculateTotal(formData.items), [formData.items]);


    // --- HANDLER DE GUARDADO FINAL (Resuelve el error onFinalize) ---
    const handleSave = async () => {
        setIsLoading(true);
        
        const finalPayload = {
            ...formData,
            totalUSD: parseFloat(currentTotal.toFixed(2)),
        };

        try {
            await onSave(finalPayload);
            onClose();
        } catch (error) {
            console.error("Error al guardar la orden:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const totalSteps = 3;
    const hasPrintingSelected = formData.serviciosSolicitados.impresionDigital || formData.serviciosSolicitados.impresionGranFormato;

    // Check para deshabilitar el botón de siguiente
    const isStep1Valid = useMemo(() => (
        formData.cliente.nombreRazonSocial.trim().length > 0 &&
        formData.fechaEntrega.trim().length > 0
    ), [formData.cliente.nombreRazonSocial, formData.fechaEntrega]);
    
    const isStep2Valid = useMemo(() => (
        formData.items.length > 0
    ), [formData.items.length]);


    return (
        <Card className={`w-full max-w-6xl mx-auto shadow-xl dark:border-gray-700 h-full flex flex-col ${className}`}>
            <CardHeader className="flex flex-row items-center justify-between border-b dark:border-gray-700 p-6 flex-shrink-0">
                <CardTitle className="text-3xl font-extrabold text-primary dark:text-gray-100">
                    Wizard de Orden de Servicio
                </CardTitle>
                <div className="text-xl font-bold text-muted-foreground">Paso {step} de 3</div>
            </CardHeader>
            
            {/* 🔑 CORRECCIÓN DE SCROLL: Aplicamos flex-grow y h-0 */}
            <ScrollArea className="flex-grow h-0"> 
                <div className="p-6">
                    {step === 1 && <Step1 data={formData} onChange={handleChange} />}
                    {step === 2 && <Step2 
                                items={formData.items} 
                                removeItem={removeItem} 
                                data={formData} 
                                onChange={handleChange}
                                onItemAssignmentChange={handleItemAssignmentChange}
                                openItemModal={() => setIsItemModalOpen(true)}
                                materials={MATERIALES_IMPRESION}
                            />}
                    {step === 3 && <Step3 data={formData} onChange={handleChange} totalUSD={currentTotal} />}
                </div>
            </ScrollArea>

            {/* 🔑 Bloque de Navegación (Fijo al final) */}
            <Separator className="dark:bg-gray-700 flex-shrink-0" />
            <div className="flex justify-between p-6 flex-shrink-0">
                <Button 
                    onClick={() => setStep(prev => Math.max(1, prev - 1))} 
                    disabled={step === 1 || isLoading}
                    variant="outline"
                    className="gap-2"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                </Button>
                
                <Button 
                    onClick={() => {
                        if (step < totalSteps) {
                            setStep(step + 1);
                        } else {
                            handleSave(); // 🔑 CORREGIDO: Llama a handleSave
                        }
                    }}
                    disabled={
                        isLoading || 
                        (step === 1 && !isStep1Valid) ||
                        (step === 2 && !isStep2Valid)
                    }
                    className={`gap-2 ${step < totalSteps ? 'bg-primary hover:bg-primary/90' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                >
                    {step < totalSteps ? 'Siguiente' : (isLoading ? 'Guardando...' : 'Finalizar Orden')}
                    {step < totalSteps && <ChevronRight className="w-4 h-4" />}
                </Button>
            </div>
            
            {/* Modal de Añadir Item (fuera del ScrollArea) */}
            <ItemFormModal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                onAddItem={handleAddItem as any}
                hasPrintingSelected={hasPrintingSelected}
                materialesDisponibles={MATERIALES_IMPRESION}
            />
        </Card>
    )
}

// -------------------------------------------------------------------
// SUB-COMPONENTE: PASO 1 (CLIENTE Y FECHAS) - ESTÉTICA RESTAURADA
// -------------------------------------------------------------------

interface Step1Props {
    data: FormularioOrdenData;
    onChange: (path: string, value: any) => void;
}

const Step1: React.FC<Step1Props> = ({ data, onChange }) => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">1. Datos del Cliente y Fechas</h2>

            <Card className="dark:bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><User className="w-5 h-5"/> Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="nombreRazonSocial">Nombre/Razón Social (*)</Label>
                            <Input id="nombreRazonSocial" value={data.cliente.nombreRazonSocial} onChange={(e) => onChange('cliente.nombreRazonSocial', e.target.value)} required />
                        </div>
                        <div>
                            <Label htmlFor="rifCedula">RIF/Cédula</Label>
                            <Input id="rifCedula" value={data.cliente.rifCedula} onChange={(e) => onChange('cliente.rifCedula', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="telefono">Teléfono</Label>
                            <Input id="telefono" value={data.cliente.telefono} onChange={(e) => onChange('cliente.telefono', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="personaContacto">Persona de Contacto</Label>
                            <Input id="personaContacto" value={data.cliente.personaContacto} onChange={(e) => onChange('cliente.personaContacto', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="correo">Correo Electrónico</Label>
                            <Input id="correo" type="email" value={data.cliente.correo} onChange={(e) => onChange('cliente.correo', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="domicilioFiscal">Domicilio Fiscal</Label>
                            <Input id="domicilioFiscal" value={data.cliente.domicilioFiscal} onChange={(e) => onChange('cliente.domicilioFiscal', e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="dark:bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Calendar className="w-5 h-5"/> Fechas Importantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="ordenNumero">Número de Orden</Label>
                            <Input id="ordenNumero" value={data.ordenNumero} onChange={(e) => onChange('ordenNumero', e.target.value)} className="font-mono bg-gray-100 dark:bg-gray-700/50" />
                        </div>
                        <div>
                            <Label htmlFor="fechaEntrega">Fecha de Entrega Estimada (*)</Label>
                            <Input id="fechaEntrega" type="date" value={data.fechaEntrega} onChange={(e) => onChange('fechaEntrega', e.target.value)} required />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// -------------------------------------------------------------------
// SUB-COMPONENTE: PASO 2 (ÍTEMS Y ESPECIFICACIONES) - CORRECCIONES Y ESTÉTICA RESTAURADA
// -------------------------------------------------------------------

interface Step2Props {
  items: ItemOrden[];
  removeItem: (index: number) => void;
  data: FormularioOrdenData;
  onChange: (path: string, value: any) => void;
  onItemAssignmentChange: (itemIndex: number, employeeName: string) => void;
  openItemModal: () => void;
  materials: readonly string[]; // Renombrado a 'materials' para evitar conflicto
}

const Step2: React.FC<Step2Props> = ({ items, removeItem, data, onChange, onItemAssignmentChange, openItemModal }) => { 
  
    // Función de cálculo de subtotal (Duplicada para renderizado de la celda)
    const getItemSubtotal = (item: ItemOrden): number => {
      let subtotal = 0;
      const PRECIO_LASER_POR_MINUTO = 0.80; 
      const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item as any;
      
      if (cantidad <= 0 || precioUnitario < 0) return 0;

      if (unidad === 'und') {
          subtotal = cantidad * precioUnitario;
      } else if (unidad === 'm2') {
          if (medidaXCm && medidaYCm) {
              const areaM2 = (medidaXCm / 100) * (medidaYCm / 100);
              subtotal = areaM2 * precioUnitario * cantidad;
          }
      } else if (unidad === 'tiempo' && tiempoCorte) {
         const [minutesStr = '0', secondsStr = '0'] = tiempoCorte.split(':');
         const totalMinutes = (parseFloat(minutesStr) || 0) + ((parseFloat(secondsStr) || 0) / 60);
         
         subtotal = totalMinutes * PRECIO_LASER_POR_MINUTO * cantidad; 
      }
      
      return subtotal;
    };


  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">2. Detalle de Ítems y Servicios</h2>

        <Card className="dark:bg-gray-800/50">
            <CardHeader>
                <CardTitle className="text-xl">Servicios Adicionales/Confirmados</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(Object.keys(data.serviciosSolicitados) as (keyof ServiciosSolicitados)[]).map((key) => {
                        const path = `serviciosSolicitados.${key}`;
                        return (
                            <div key={key} className="flex items-center space-x-2">
                                <Checkbox
                                    id={key}
                                    checked={data.serviciosSolicitados[key]}
                                    onCheckedChange={(checked) => onChange(path, checked)}
                                    // 🔑 Deshabilitar los que se auto-chequean (Estilo restaurado)
                                    disabled={
                                        (key === 'corteLaser' && items.some(item => (item as any).tipoServicio === 'CORTE_LASER' || (item as any).unidad === 'tiempo')) ||
                                        (key === 'impresionDigital' && items.some(item => (item as any).tipoServicio === 'IMPRESION')) ||
                                        (key === 'rotulacion' && items.some(item => (item as any).tipoServicio === 'ROTULACION')) ||
                                        (key === 'avisoCorporeo' && items.some(item => (item as any).tipoServicio === 'AVISO_CORPOREO'))
                                    }
                                />
                                <Label 
                                    htmlFor={key} 
                                    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                                        (key === 'corteLaser' || key === 'impresionDigital' || key === 'rotulacion' || key === 'avisoCorporeo') ? 'text-blue-500 dark:text-blue-400' : ''
                                    }`}
                                >
                                    {getServiceText(key)}
                                </Label>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>


        <Card className="dark:bg-gray-800/50">
            <CardHeader>
                <CardTitle className="text-xl flex justify-between items-center">
                    Items de Cobro ({items.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button 
                    onClick={openItemModal}
                    className="w-full gap-2 bg-primary hover:bg-primary/90"
                >
                    <Plus className="w-4 h-4" />
                    Abrir Calculadora y Agregar Ítem
                </Button>

                {/* Tabla de Ítems con la corrección de Hydration */}
                <div className="space-y-3">
                    <ScrollArea className="h-[300px] w-full border rounded-md dark:border-gray-700">
                        <Table>
                            <TableHeader>
                                {/* 🔑 CORRECCIÓN DEL WHITESPACE (HEADER) */}
                                <TableRow className="bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900/50"><TableHead className="w-[28%]">Descripción</TableHead><TableHead className="w-[8%] text-center">Cant.</TableHead><TableHead className="w-[8%] text-center">Unidad</TableHead><TableHead className="w-[18%]">Material/Detalle</TableHead><TableHead className="w-[15%] text-right">Subtotal USD</TableHead><TableHead className="w-[18%] text-center">Asignación</TableHead><TableHead className="w-[5%] text-center">Acción</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length > 0 ? (
                                    items.map((item, index) => {
                                        const itemAny = item as any;
                                        
                                        // Lógica para decidir qué mostrar en la columna Material
                                        const materialDisplay = itemAny.materialDetalleCorte 
                                            ? itemAny.materialDetalleCorte
                                            : itemAny.materialDeImpresion || 'N/A';
                                        
                                        const showTiempo = itemAny.unidad === 'tiempo' && itemAny.tiempoCorte && itemAny.tiempoCorte !== '0:00';

                                        return (
                                            /* 🔑 CORRECCIÓN DEL WHITESPACE (BODY) */
                                            <TableRow key={index} className="hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                                <TableCell>
                                                    <p className="font-medium truncate">{itemAny.nombre}</p>
                                                    {itemAny.unidad === 'm2' && itemAny.medidaXCm && itemAny.medidaYCm && 
                                                        <p className="text-xs text-blue-500 dark:text-blue-400 truncate">
                                                            {itemAny.medidaXCm}cm x {itemAny.medidaYCm}cm
                                                        </p>}
                                                    {showTiempo && 
                                                        <p className="text-xs text-orange-600 dark:text-orange-400 truncate font-semibold">
                                                            <Timer className="w-3 h-3 inline mr-1" />
                                                            Tiempo: {itemAny.tiempoCorte}
                                                        </p>}
                                                </TableCell>
                                                <TableCell className="text-center">{itemAny.cantidad}</TableCell>
                                                <TableCell className="text-center font-semibold">{itemAny.unidad.toUpperCase()}</TableCell>
                                                
                                                <TableCell className="text-sm text-muted-foreground dark:text-gray-400">
                                                    {materialDisplay}
                                                </TableCell>
                                                
                                                <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">
                                                    ${getItemSubtotal(item).toFixed(2)}
                                                </TableCell>
                                                
                                                <TableCell className="text-center">
                                                    <Select
                                                        value={itemAny.empleadoAsignado || "N/A"}
                                                        onValueChange={(value) => onItemAssignmentChange(index, value)}
                                                    >
                                                        <SelectTrigger className="w-[100px] text-xs h-8">
                                                            <SelectValue placeholder="Empleado" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {EMPLEADOS_DISPONIBLES.map((employee) => (
                                                                <SelectItem key={employee} value={employee}>
                                                                    {employee.split(' ')[0]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>

                                                <TableCell className="text-center">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => removeItem(index)} 
                                                        className="text-destructive hover:bg-destructive/10"
                                                        title="Eliminar Ítem"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            <Plus className="w-5 h-5 mx-auto mb-2 text-primary/50" />
                                            Aún no has añadido ningún ítem a la orden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    </div>
  )
}

// -------------------------------------------------------------------
// SUB-COMPONENTE: PASO 3 (RESUMEN Y CONFIRMACIÓN) - ESTÉTICA RESTAURADA
// -------------------------------------------------------------------

interface Step3Props {
    data: FormularioOrdenData;
    totalUSD: number;
    onChange: (path: string, value: any) => void;
}

const Step3: React.FC<Step3Props> = ({ data, totalUSD, onChange }) => {
    
    // Función para renderizar el campo de la tarjeta
    const renderField = (label: string, value: string | number | undefined, icon: React.ReactNode) => (
        <div className="flex items-start mb-2">
            <div className="text-primary mr-3 mt-1 flex-shrink-0">
                {icon}
            </div>
            <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                <p className="text-sm font-medium dark:text-gray-200">{value || 'N/A'}</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">3. Revisión Final y Descripción</h2>

            <Card className="dark:bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-xl">Detalle de la Orden</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Columna 1: Cliente y Fechas */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="p-4 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                            <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-primary dark:text-gray-100">Datos del Cliente</h3>
                            {renderField('Razón Social', data.cliente.nombreRazonSocial, <User className="w-4 h-4"/>)}
                            {renderField('RIF/Cédula', data.cliente.rifCedula, <User className="w-4 h-4"/>)}
                            {renderField('Teléfono', data.cliente.telefono, <User className="w-4 h-4"/>)}
                            {renderField('Contacto', data.cliente.personaContacto, <User className="w-4 h-4"/>)}
                            {renderField('Correo', data.cliente.correo, <User className="w-4 h-4"/>)}
                            {renderField('Domicilio Fiscal', data.cliente.domicilioFiscal, <Truck className="w-4 h-4"/>)}
                        </div>
                        <div className="p-4 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                            <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-primary dark:text-gray-100">Fechas</h3>
                            {renderField('Orden N°', data.ordenNumero, <Calendar className="w-4 h-4"/>)}
                            {renderField('Fecha de Entrega', data.fechaEntrega, <Calendar className="w-4 h-4"/>)}
                        </div>
                    </div>

                    {/* Columna 2: Descripción Detallada y Resumen */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="p-4 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                            <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-primary dark:text-gray-100">Notas y Descripción</h3>
                            <Label htmlFor="descripcionDetallada" className="mb-2 block">Añade cualquier nota, requerimiento o información adicional.</Label>
                            <Textarea
                                id="descripcionDetallada"
                                value={data.descripcionDetallada}
                                onChange={(e) => onChange('descripcionDetallada', e.target.value)}
                                rows={6}
                                placeholder="Ej: Se requiere embalaje especial. El cliente pagará el 50% de abono hoy."
                                className="dark:bg-gray-700/50 dark:border-gray-600 dark:text-gray-100"
                            />
                        </div>
                        
                        {/* Resumen de Servicios y Total */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                                <h3 className="text-md font-semibold mb-2 border-b pb-2">Servicios Marcados</h3>
                                <div className="text-sm space-y-1">
                                    {Object.entries(data.serviciosSolicitados)
                                        .filter(([, checked]) => checked)
                                        .map(([key]) => (
                                            <Badge key={key} variant="secondary" className="mr-2 mb-1">
                                                {getServiceText(key as keyof ServiciosSolicitados)}
                                            </Badge>
                                        ))}
                                    {Object.values(data.serviciosSolicitados).every(v => v === false) && (
                                        <p className="text-muted-foreground">Ningún servicio marcado.</p>
                                    )}
                                </div>
                            </div>
                            
                            <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600">
                                <h3 className="text-xl font-bold mb-1">Total Final de la Orden</h3>
                                <p className="text-4xl font-extrabold text-green-700 dark:text-green-400">
                                    ${totalUSD.toFixed(2)} USD
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    La orden será registrada con el estado: **Pendiente**
                                </p>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}