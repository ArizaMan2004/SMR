// @/components/orden/order-form-wizard.tsx
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input" 
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area" 
import { Badge } from "@/components/ui/badge" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table" 
import { Skeleton } from "@/components/ui/skeleton" 
import { toast } from 'sonner' 
import { cn } from "@/lib/utils"
import { 
    ChevronLeft, ChevronRight, Plus, X, User, DollarSign, Calendar, 
    Timer, Check, Users, Loader2, Pencil, Trash2, RefreshCcw, Save, AlertCircle, Phone, Mail, MapPin, Hash
} from "lucide-react" 

import { type FormularioOrdenData, type ItemOrden, type ServiciosSolicitados, type OrdenServicio } from "@/lib/types/orden" 
import { ItemFormModal } from "@/components/orden/item-form-modal"
import { getLastOrderNumber } from "@/lib/firebase/ordenes" 
import { getFrequentClients, saveClient, deleteClient } from "@/lib/firebase/clientes" 

// --- TIPOS Y CONSTANTES ---

export type ClienteWizard = { 
    id: string, 
    nombreRazonSocial: string, 
    rifCedula: string, 
    telefono: string, 
    correo: string, 
    domicilioFiscal: string 
    personaContacto?: string | null; 
};

const PREFIJOS_RIF = ["V", "E", "P", "R", "J", "G"] as const;
const PREFIJOS_TELEFONO = ["0412", "0422", "0414", "0424", "0416", "0426"] as const;
const JEFES_CONTACTO = ["Marcos Leal", "Samuel Leal"] as const;
const EMPLEADOS_DISPONIBLES = [
    "N/A", "Marcos (Gerencia)", "Samuel (Diseño/Producción)", 
    "Daniela Chiquito (Corte Láser)", "Jose Angel (Impresión)", 
    "Daniel Montero (Impresión)", "Jesus Ariza (Diseño)"
];
const MATERIALES_IMPRESION = [
    "Vinil Brillante", "Vinil Mate", "Banner Cara Negra", "Banner Cara Blanca", 
    "Banner Cara Gris", "Vinil Transparente (Clear)", "Otro/No aplica" 
] as const;

const getServiceText = (key: keyof ServiciosSolicitados): string => {
    switch (key) {
        case 'impresionDigital': return 'Impresión Digital';
        case 'impresionGranFormato': return 'Gran Formato';
        case 'corteLaser': return 'Corte Láser';
        case 'laminacion': return 'Laminación';
        case 'avisoCorporeo': return 'Aviso Corpóreo';
        case 'rotulacion': return 'Rotulación';
        case 'instalacion': return 'Instalación';
        case 'senaletica': return 'Señaletica';
        default: return key;
    }
};

type FormularioOrdenExtendida = FormularioOrdenData & { 
    cliente: { 
        prefijoTelefono: string, 
        numeroTelefono: string, 
        prefijoRif: string, 
        numeroRif: string 
    } 
};

const INITIAL_FORM_DATA: FormularioOrdenExtendida = {
    ordenNumero: '', 
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: {
        nombreRazonSocial: "", rifCedula: "", telefono: "", 
        prefijoTelefono: "0414", numeroTelefono: "", prefijoRif: "J", numeroRif: "", 
        domicilioFiscal: "", correo: "", personaContacto: "",
    } as any, 
    serviciosSolicitados: {
        impresionDigital: false, impresionGranFormato: false, corteLaser: false, laminacion: false,
        avisoCorporeo: false, rotulacion: false, instalacion: false, senaletica: false,
    },
    items: [],
    descripcionDetallada: "",
} as any; 

interface OrderFormWizardProps {
    onSave: (data: FormularioOrdenData & { totalUSD: number }) => Promise<void>;
    onClose: () => void;
    className?: string;
    ordenToEdit?: OrdenServicio | null;
}

export const OrderFormWizardV2: React.FC<OrderFormWizardProps> = ({ onSave, onClose, className, ordenToEdit }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormularioOrdenExtendida>(INITIAL_FORM_DATA);
    const [isLoading, setIsLoading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    
    // 🔥 NUEVO ESTADO: Índice del ítem que se está editando (null si es nuevo)
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    const [isOrderNumLoading, setIsOrderNumLoading] = useState(false);
    const [frequentClients, setFrequentClients] = useState<ClienteWizard[]>([]); 
    const [isClientLoading, setIsClientLoading] = useState(true);
    const [selectedClientId, setSelectedClientId] = useState<string>('NEW'); 
    const [isClientEditing, setIsClientEditing] = useState(true); 

    // --- CARGA INICIAL ---
    useEffect(() => {
        const loadData = async () => {
            setIsClientLoading(true);
            try {
                const clients = await getFrequentClients();
                setFrequentClients(clients.map(c => ({
                    id: c.id!,
                    nombreRazonSocial: c.nombreRazonSocial,
                    rifCedula: c.rifCedulaCompleto, 
                    telefono: c.telefonoCompleto,   
                    correo: c.correo,
                    domicilioFiscal: c.domicilioFiscal,
                    personaContacto: c.personaContactoCliente,
                })));

                if (ordenToEdit) {
                    const [prefijoRif, numeroRif] = ordenToEdit.cliente.rifCedula.includes('-') 
                        ? ordenToEdit.cliente.rifCedula.split('-') 
                        : ["J", ordenToEdit.cliente.rifCedula];
                    
                    const tel = ordenToEdit.cliente.telefono || "";
                    const prefijoTelefono = tel.length >= 4 ? tel.substring(0, 4) : "0414";
                    const numeroTelefono = tel.length >= 4 ? tel.substring(4) : tel;

                    setFormData({
                        ...ordenToEdit,
                        ordenNumero: String(ordenToEdit.ordenNumero),
                        cliente: {
                            ...ordenToEdit.cliente,
                            prefijoRif, numeroRif, prefijoTelefono, numeroTelefono
                        },
                        items: ordenToEdit.items || [],
                        serviciosSolicitados: ordenToEdit.serviciosSolicitados || INITIAL_FORM_DATA.serviciosSolicitados
                    } as FormularioOrdenExtendida);
                    
                    const existingClient = clients.find(c => c.rifCedulaCompleto === ordenToEdit.cliente.rifCedula);
                    if (existingClient) {
                        setSelectedClientId(existingClient.id!);
                        setIsClientEditing(false);
                    } else {
                        setSelectedClientId('CUSTOM'); 
                        setIsClientEditing(true);
                    }
                } else {
                    setIsOrderNumLoading(true);
                    try {
                        const lastNumber = await getLastOrderNumber(); 
                        setFormData(prev => ({ ...prev, ordenNumero: String(lastNumber + 1) }));
                    } catch(e) { console.error(e) }
                    setIsOrderNumLoading(false);
                }
            } catch (error) {
                console.error("Error cargando datos:", error);
            } finally {
                setIsClientLoading(false);
            }
        };
        loadData();
    }, [ordenToEdit]);

    const fetchOrderNumber = async () => {
        if (ordenToEdit) return; 
        setIsOrderNumLoading(true);
        try {
            const lastNumber = await getLastOrderNumber(); 
            setFormData(prev => ({ ...prev, ordenNumero: String(lastNumber + 1) }));
        } finally { setIsOrderNumLoading(false); }
    };

    // --- MANEJO DE CLIENTES ---
    const handleSelectClient = useCallback((clientId: string) => {
        setSelectedClientId(clientId);
        if (clientId === 'NEW' || clientId === 'CUSTOM') {
            setIsClientEditing(true); 
            setFormData(prev => ({
                ...prev,
                cliente: {
                    ...INITIAL_FORM_DATA.cliente,
                    prefijoTelefono: prev.cliente.prefijoTelefono, prefijoRif: prev.cliente.prefijoRif,
                    nombreRazonSocial: "", numeroTelefono: "", numeroRif: "", correo: "", domicilioFiscal: "", personaContacto: "",
                }
            }));
            return;
        }
        const client = frequentClients.find(c => c.id === clientId);
        if (client) {
            setIsClientEditing(false); 
            const [prefijoRif, numeroRif] = client.rifCedula.includes('-') ? client.rifCedula.split('-') : ["J", client.rifCedula];
            const prefijoTelefono = client.telefono.substring(0, 4);
            const numeroTelefono = client.telefono.substring(4);
            setFormData(prev => ({
                ...prev,
                cliente: {
                    ...prev.cliente,
                    nombreRazonSocial: client.nombreRazonSocial,
                    correo: client.correo,
                    domicilioFiscal: client.domicilioFiscal,
                    personaContacto: prev.cliente.personaContacto || client.personaContacto || "", 
                    prefijoRif, numeroRif, prefijoTelefono, numeroTelefono,
                }
            }));
        }
    }, [frequentClients]);

    const handleSaveClientData = useCallback(async () => {
        // ... (Lógica igual que antes)
        const { nombreRazonSocial, numeroTelefono, prefijoTelefono, prefijoRif, numeroRif, domicilioFiscal, correo, personaContacto } = formData.cliente;
        if (!nombreRazonSocial.trim()) { toast.error("Nombre obligatorio"); return; }
        if (numeroTelefono.length !== 7) { toast.error("Teléfono inválido"); return; }
        const idToSave = selectedClientId === 'NEW' || selectedClientId === 'CUSTOM' ? undefined : selectedClientId;
        const isJefe = JEFES_CONTACTO.some(j => j === personaContacto);
        const contactValue = (!isJefe && personaContacto.trim() !== "") ? personaContacto : null;
        const payload = {
            nombreRazonSocial,
            telefonoCompleto: `${prefijoTelefono}${numeroTelefono}`,
            rifCedulaCompleto: `${prefijoRif}-${numeroRif}`,
            prefijoTelefono, numeroTelefono, prefijoRif, numeroRif,
            domicilioFiscal, correo,
            personaContactoCliente: contactValue, 
        };
        try {
            setIsLoading(true);
            const newId = await saveClient(payload, idToSave);
            const clients = await getFrequentClients();
            setFrequentClients(clients.map(c => ({
                id: c.id!, nombreRazonSocial: c.nombreRazonSocial, rifCedula: c.rifCedulaCompleto, 
                telefono: c.telefonoCompleto, correo: c.correo, domicilioFiscal: c.domicilioFiscal, personaContacto: c.personaContactoCliente
            })));
            setSelectedClientId(newId);
            setIsClientEditing(false);
            toast.success("Cliente guardado.");
        } catch { toast.error("Error al guardar cliente."); } 
        finally { setIsLoading(false); }
    }, [formData.cliente, selectedClientId]);

    const handleDeleteClientData = useCallback(async () => {
        // ... (Lógica igual que antes)
        if (!window.confirm('¿Eliminar cliente?')) return;
        try {
            setIsLoading(true);
            await deleteClient(selectedClientId); 
            setSelectedClientId('NEW');
            setIsClientEditing(true);
            setFormData(prev => ({ ...prev, cliente: INITIAL_FORM_DATA.cliente }));
            const clients = await getFrequentClients();
            setFrequentClients(clients.map(c => ({
                id: c.id!, nombreRazonSocial: c.nombreRazonSocial, rifCedula: c.rifCedulaCompleto, 
                telefono: c.telefonoCompleto, correo: c.correo, domicilioFiscal: c.domicilioFiscal, personaContacto: c.personaContactoCliente
            })));
            toast.success("Cliente eliminado.");
        } catch { toast.error("Error eliminando."); } 
        finally { setIsLoading(false); }
    }, [selectedClientId]);

    const handleChange = useCallback((path: string, value: any) => {
        setFormData(prev => {
            const newForm = { ...prev };
            const keys = path.split('.');
            let current: any = newForm;
            for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
            const lastKey = keys[keys.length - 1];
            if (lastKey === 'numeroTelefono') value = value.replace(/[^0-9]/g, '').slice(0, 7);
            if (lastKey === 'numeroRif') value = value.replace(/[^0-9]/g, '').slice(0, 9);
            current[lastKey] = value;
            return newForm;
        });
    }, []);
    
    // 🔥🔥 LÓGICA MODIFICADA: AGREGAR O EDITAR ITEM
    const handleSaveItem = useCallback((newItem: ItemOrden & { materialDeImpresion?: string }) => {
        setFormData(prev => {
            const itemProcesado = { 
                ...newItem, 
                // Si es nuevo, ponemos empleado N/A por defecto, si se edita, mantenemos el que tenía si existe
                empleadoAsignado: newItem.empleadoAsignado || "N/A", 
                materialDeImpresion: newItem.materialDeImpresion || "Otro/No aplica" 
            };

            let newItems = [...prev.items];

            // SI HAY ÍNDICE DE EDICIÓN, REEMPLAZAMOS
            if (editingItemIndex !== null) {
                newItems[editingItemIndex] = itemProcesado;
            } else {
                // SI NO, AGREGAMOS
                newItems = [...newItems, itemProcesado];
            }

            const newForm = { ...prev, items: newItems };
            
            // Auto-check servicios (igual que antes)
            if (newItem.unidad === 'tiempo' || newItem.tipoServicio === 'CORTE_LASER') newForm.serviciosSolicitados.corteLaser = true;
            if (newItem.tipoServicio === 'IMPRESION') newForm.serviciosSolicitados.impresionDigital = true;
            if (newItem.tipoServicio === 'ROTULACION') newForm.serviciosSolicitados.rotulacion = true;
            if (newItem.tipoServicio === 'AVISO_CORPOREO') newForm.serviciosSolicitados.avisoCorporeo = true;
            if (newItem.materialDeImpresion && newItem.materialDeImpresion !== "Otro/No aplica") newForm.serviciosSolicitados.impresionGranFormato = true;
            
            return newForm;
        });
        
        // Reseteamos el índice de edición al guardar
        setEditingItemIndex(null);
    }, [editingItemIndex]);

    // 🔥 Nueva función para abrir modal en modo edición
    const handleEditItemClick = (index: number) => {
        setEditingItemIndex(index);
        setIsItemModalOpen(true);
    };

    // 🔥 Nueva función para abrir modal en modo creación
    const handleNewItemClick = () => {
        setEditingItemIndex(null);
        setIsItemModalOpen(true);
    };

    const currentTotal = useMemo(() => {
        return formData.items.reduce((sum, item) => {
            let subtotal = 0;
            const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item as any;
            if (cantidad <= 0 || precioUnitario < 0) return sum;
            if (unidad === 'und') subtotal = cantidad * precioUnitario;
            else if (unidad === 'm2' && medidaXCm && medidaYCm) subtotal = (medidaXCm / 100) * (medidaYCm / 100) * precioUnitario * cantidad;
            else if (unidad === 'tiempo' && tiempoCorte) {
               const [min, sec] = tiempoCorte.split(':').map(Number);
               subtotal = (min + (sec / 60)) * 0.80 * cantidad;
            }
            return sum + subtotal;
        }, 0);
    }, [formData.items]);

    const handleSave = async () => {
        setIsLoading(true);
        const { prefijoTelefono, numeroTelefono, prefijoRif, numeroRif, ...clienteRest } = formData.cliente;
        const finalPayload = {
            ...formData,
            ordenNumero: parseInt(formData.ordenNumero, 10),
            cliente: {
                ...clienteRest,
                telefono: `${prefijoTelefono}${numeroTelefono}`,
                rifCedula: prefijoRif && numeroRif ? `${prefijoRif}-${numeroRif}` : '',
            },
            totalUSD: parseFloat(currentTotal.toFixed(2)),
        };

        try {
            await onSave(finalPayload as any); 
            toast.success(ordenToEdit ? `Orden #${finalPayload.ordenNumero} actualizada.` : `Orden #${finalPayload.ordenNumero} creada.`);
            onClose();
        } catch (error) {
            toast.error("Error al guardar la orden.");
        } finally {
            setIsLoading(false);
        }
    };

    const isStep1Valid = useMemo(() => {
        const { nombreRazonSocial, numeroTelefono } = formData.cliente;
        const { fechaEntrega } = formData;
        return Boolean(nombreRazonSocial?.trim().length > 0 && numeroTelefono?.trim().length === 7 && fechaEntrega?.trim().length > 0);
    }, [formData.cliente, formData.fechaEntrega]);
    
    const isStep2Valid = useMemo(() => formData.items.length > 0, [formData.items.length]);

    return (
        <Card className={cn("w-full max-w-7xl mx-auto shadow-2xl dark:border-gray-800 bg-background flex flex-col overflow-hidden h-[90vh] md:h-[85vh]", className)}>
            <div className="flex flex-col border-b dark:border-gray-800 bg-muted/20 flex-shrink-0">
                <div className="flex items-center justify-between p-4 md:p-6 pb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold tracking-tight text-primary">
                            {ordenToEdit ? `Editar Orden #${ordenToEdit.ordenNumero}` : 'Nueva Orden de Servicio'}
                        </CardTitle>
                        <CardDescription className="hidden md:block">
                            {ordenToEdit ? 'Modifique los datos necesarios.' : 'Complete los datos requeridos para procesar la solicitud.'}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 md:gap-4">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={cn("flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all duration-300", step === s ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg" : step > s ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 text-muted-foreground bg-background")}>
                                    {step > s ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 3 && <div className={cn("w-6 md:w-12 h-1 mx-1 md:mx-2 rounded-full", step > s ? "bg-green-500" : "bg-muted-foreground/20")} />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="flex-1 min-h-0 relative"> 
                <ScrollArea className="h-full w-full bg-white dark:bg-slate-950/50"> 
                    <div className="p-4 md:p-8 max-w-6xl mx-auto">
                        {step === 1 && <Step1 
                            data={formData} 
                            onChange={handleChange} 
                            frequentClients={frequentClients}
                            isClientLoading={isClientLoading}
                            onClientSelected={handleSelectClient}
                            isClientEditing={isClientEditing}
                            selectedClientId={selectedClientId}
                            onSaveClient={handleSaveClientData}
                            onEditClient={() => setIsClientEditing(true)}
                            onDeleteClient={handleDeleteClientData}
                            isWizardLoading={isLoading}
                            ordenNumero={formData.ordenNumero}
                            refreshOrderNum={fetchOrderNumber}
                            isOrderNumLoading={isOrderNumLoading}
                            isStepValid={isStep1Valid}
                            isEditingOrder={!!ordenToEdit}
                        />}
                        {step === 2 && <Step2 
                            items={formData.items} 
                            removeItem={(idx: number) => setFormData(p => ({...p, items: p.items.filter((_, i) => i !== idx)}))} 
                            data={formData} 
                            onChange={handleChange}
                            onItemAssignmentChange={(idx: number, val: string) => {
                                const newItems = [...formData.items]; (newItems[idx] as any).empleadoAsignado = val;
                                setFormData(p => ({...p, items: newItems}));
                            }}
                            // 🔥 Pasamos los nuevos handlers
                            openItemModal={handleNewItemClick}
                            onEditItem={handleEditItemClick}
                            currentTotal={currentTotal}
                        />}
                        {step === 3 && <Step3 data={formData} totalUSD={currentTotal} onChange={handleChange} />}
                    </div>
                </ScrollArea>
            </div>

            <Separator className="dark:bg-gray-800 flex-shrink-0" />
            <div className="flex justify-between p-4 md:p-6 bg-muted/10 flex-shrink-0 z-10 border-t">
                <div className="flex gap-2">
                    <Button onClick={() => setStep(prev => Math.max(1, prev - 1))} disabled={step === 1 || isLoading} variant="ghost" className="gap-2 pl-2">
                        <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    {step === 1 && <Button variant="outline" onClick={onClose}>Cancelar</Button>}
                </div>
                <Button 
                    onClick={() => step < 3 ? setStep(s => s + 1) : handleSave()}
                    disabled={isLoading || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                    className={cn("gap-2 min-w-[150px] transition-all", step === 3 ? "bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg" : "bg-primary hover:bg-primary/90 shadow-sm")}
                >
                    {step < 3 ? 'Siguiente' : (isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (ordenToEdit ? 'Actualizar Orden' : 'Finalizar Orden'))}
                    {step < 3 && <ChevronRight className="w-4 h-4" />}
                </Button>
            </div>
            
            <ItemFormModal
                isOpen={isItemModalOpen}
                onClose={() => { setIsItemModalOpen(false); setEditingItemIndex(null); }} // Limpiar al cerrar
                onAddItem={handleSaveItem} // Ahora maneja add/edit
                hasPrintingSelected={formData.serviciosSolicitados.impresionDigital || formData.serviciosSolicitados.impresionGranFormato}
                materialesDisponibles={MATERIALES_IMPRESION}
                // 🔥 Pasamos el ítem a editar si existe el índice
                itemToEdit={editingItemIndex !== null ? formData.items[editingItemIndex] : undefined}
            />
        </Card>
    )
}

// ... (Step1 queda igual que antes) ...
// Resumido para brevedad, usar el Step1 del código anterior que ya estaba corregido con isWizardLoading

const Step1: React.FC<any> = (props) => {
    // ... Copiar el Step1 corregido del mensaje anterior ...
    // Asumo que ya lo tienes, si no, avísame para volver a ponerlo completo.
    // Por seguridad, aquí está la versión reducida funcional:
    const { data, onChange, frequentClients, isClientLoading, onClientSelected, isClientEditing, selectedClientId, onSaveClient, onEditClient, onDeleteClient, ordenNumero, refreshOrderNum, isOrderNumLoading, isStepValid, isEditingOrder, isWizardLoading } = props;
    const showError = (field: string) => field === 'telefono' && data.cliente.numeroTelefono.length > 0 && data.cliente.numeroTelefono.length < 7;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
                <Card className="bg-blue-50/40 border-blue-100 shadow-sm">
                    <div className="p-4 flex flex-col md:flex-row gap-4 items-end justify-between">
                        <div className="w-full space-y-1.5">
                            <Label className="text-blue-800 font-bold flex items-center gap-2 text-xs uppercase"><Users className="w-3.5 h-3.5"/> Seleccionar Cliente</Label>
                            <Select onValueChange={onClientSelected} value={selectedClientId} disabled={isClientEditing && selectedClientId !== 'NEW'}>
                                <SelectTrigger className="bg-background h-9">{isClientLoading ? <Skeleton className="h-5 w-32"/> : <SelectValue placeholder="Buscar cliente..." />}</SelectTrigger>
                                <SelectContent><SelectItem value="NEW" className="font-bold text-primary">✨ Nuevo Cliente</SelectItem>{selectedClientId === 'CUSTOM' && <SelectItem value="CUSTOM">✏️ Cliente de la Orden</SelectItem>}<Separator className="my-1"/>{frequentClients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombreRazonSocial}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">{isClientEditing ? <Button size="sm" onClick={onSaveClient} disabled={isWizardLoading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white h-9">{isWizardLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Save className="w-3.5 h-3.5 mr-2"/>} Guardar</Button> : <><Button size="sm" variant="outline" className="h-9" onClick={onEditClient}><Pencil className="w-3.5 h-3.5 mr-2"/> Editar</Button><Button size="sm" variant="destructive" className="h-9 w-9 p-0" onClick={onDeleteClient}><Trash2 className="w-3.5 h-3.5"/></Button></>}</div>
                    </div>
                </Card>
                <div className={cn("transition-all duration-300 space-y-3", !isClientEditing && "opacity-80 pointer-events-none")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Nombre <span className="text-red-500">*</span></Label><Input className="pl-3" value={data.cliente.nombreRazonSocial} onChange={(e) => onChange('cliente.nombreRazonSocial', e.target.value)} placeholder="Inversiones C.A." /></div>
                        <div className="space-y-1"><Label className="text-xs">RIF</Label><div className="flex shadow-sm rounded-md"><Select value={data.cliente.prefijoRif} onValueChange={(v) => onChange('cliente.prefijoRif', v)}><SelectTrigger className="w-[65px] rounded-l-md"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_RIF.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Input className="rounded-l-none" placeholder="12345678" maxLength={9} value={data.cliente.numeroRif} onChange={(e) => onChange('cliente.numeroRif', e.target.value)} /></div></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1"><div className="flex justify-between"><Label className="text-xs">Teléfono <span className="text-red-500">*</span></Label>{showError('telefono') && <span className="text-[10px] text-red-500 font-bold">Incompleto</span>}</div><div className="flex shadow-sm rounded-md"><Select value={data.cliente.prefijoTelefono} onValueChange={(v) => onChange('cliente.prefijoTelefono', v)}><SelectTrigger className="w-[80px] rounded-l-md"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_TELEFONO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Input className={cn("rounded-l-none", showError('telefono') && "border-red-400 bg-red-50")} placeholder="1234567" maxLength={7} value={data.cliente.numeroTelefono} onChange={(e) => onChange('cliente.numeroTelefono', e.target.value)} /></div></div>
                        <div className="space-y-1"><Label className="text-xs">Contacto</Label><Select value={JEFES_CONTACTO.includes(data.cliente.personaContacto as any) ? data.cliente.personaContacto : "MANUAL"} onValueChange={(v) => onChange('cliente.personaContacto', v === "MANUAL" ? "" : v)}><SelectTrigger className="w-full bg-muted/30"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent>{JEFES_CONTACTO.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}<SelectItem value="MANUAL" className="text-orange-500">Manual</SelectItem></SelectContent></Select>{(!JEFES_CONTACTO.includes(data.cliente.personaContacto as any)) && (<Input className="mt-2 h-8 text-sm" placeholder="Nombre..." value={data.cliente.personaContacto || ""} onChange={(e) => onChange('cliente.personaContacto', e.target.value)} />)}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Correo</Label><Input className="pl-3" type="email" value={data.cliente.correo || ""} onChange={(e) => onChange('cliente.correo', e.target.value)} placeholder="email@ejemplo.com" /></div>
                        <div className="space-y-1"><Label className="text-xs">Domicilio</Label><Input className="pl-3" value={data.cliente.domicilioFiscal || ""} onChange={(e) => onChange('cliente.domicilioFiscal', e.target.value)} placeholder="Dirección..." /></div>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-4 space-y-4">
                <Card className="border-t-4 border-t-primary shadow-md h-full bg-muted/5">
                    <CardHeader className="pb-3 border-b"><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4"/> Detalles Orden</CardTitle></CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><Label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Número</Label><Badge variant="outline" className="text-[10px] h-5">Auto</Badge></div>
                            <div className="flex gap-2"><div className="relative w-full"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary opacity-50" /><Input value={ordenNumero || "..."} readOnly className="pl-10 text-xl font-mono font-bold text-center bg-white border-primary/20"/></div><Button variant="outline" size="icon" onClick={refreshOrderNum} disabled={isOrderNumLoading || isEditingOrder}><RefreshCcw className={cn("w-4 h-4", isOrderNumLoading && "animate-spin")} /></Button></div>
                        </div>
                        <div className="space-y-2"><Label className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Entrega <span className="text-red-500">*</span></Label><Input type="date" className="h-10 font-medium" value={data.fechaEntrega} onChange={(e) => onChange('fechaEntrega', e.target.value)} /></div>
                        {!isStepValid && (<div className="bg-red-50 text-red-600 p-3 rounded-md text-[11px] flex gap-2 items-start border border-red-100"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><p>Faltan campos obligatorios (*).</p></div>)}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// 🔥 Step2 ACTUALIZADO con botón Editar
const Step2: React.FC<any> = ({ items, removeItem, data, onChange, onItemAssignmentChange, openItemModal, onEditItem, currentTotal }) => { 
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white dark:bg-slate-950 rounded-lg border p-3 shadow-sm">
                         <div className="flex flex-wrap gap-2">
                            {Object.keys(data.serviciosSolicitados).map((key) => {
                                const isChecked = data.serviciosSolicitados[key];
                                return (<Button key={key} size="sm" variant={isChecked ? "default" : "outline"} onClick={() => onChange(`serviciosSolicitados.${key}`, !isChecked)} className={cn("h-7 text-xs px-3", isChecked ? "bg-primary border-primary text-white shadow-sm" : "text-muted-foreground border-dashed")}>{isChecked && <Check className="w-3 h-3 mr-1.5" />}{getServiceText(key as any)}</Button>);
                            })}
                         </div>
                    </div>
                    <Card className="border shadow-md overflow-hidden flex flex-col h-[400px]">
                        <CardHeader className="flex flex-row items-center justify-between py-2 px-4 bg-muted/20 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><div className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{items.length}</div> Ítems Agregados</CardTitle><Button size="sm" onClick={openItemModal} className="h-8 gap-1 bg-primary text-xs"><Plus className="w-3 h-3" /> Agregar</Button></CardHeader>
                        <div className="flex-grow overflow-auto bg-white dark:bg-slate-950">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-10 shadow-sm"><TableRow className="h-8"><TableHead className="w-[35%] pl-4 text-xs">Descripción</TableHead><TableHead className="text-center w-[10%] text-xs">Cant.</TableHead><TableHead className="w-[20%] text-xs">Detalle</TableHead><TableHead className="text-right w-[15%] text-xs">Total</TableHead><TableHead className="text-center w-[10%] text-xs">Asignado</TableHead><TableHead className="w-[10%] text-center">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {items.length > 0 ? items.map((item: any, idx: number) => (
                                        <TableRow key={idx} className="group h-10">
                                            <TableCell className="pl-4 py-2 align-middle"><p className="font-bold text-xs text-foreground">{item.nombre}</p><div className="flex flex-wrap gap-1 mt-0.5">{item.unidad === 'm2' && <Badge variant="secondary" className="text-[9px] h-4 px-1 font-normal bg-blue-50 text-blue-700 border-blue-100">{item.medidaXCm}x{item.medidaYCm}cm</Badge>}{item.tiempoCorte && <Badge variant="secondary" className="text-[9px] h-4 px-1 font-normal bg-orange-50 text-orange-700 border-orange-100"><Timer className="w-3 h-3 mr-1"/>{item.tiempoCorte}</Badge>}</div></TableCell>
                                            <TableCell className="text-center align-middle font-mono text-xs">{item.cantidad}</TableCell>
                                            <TableCell className="text-[10px] text-muted-foreground align-middle truncate max-w-[100px]">{item.materialDeImpresion || item.materialDetalleCorte || '-'}</TableCell>
                                            <TableCell className="text-right font-bold text-green-700 dark:text-green-400 align-middle text-xs">${(item.precioUnitario * item.cantidad).toFixed(2)}</TableCell>
                                            <TableCell className="text-center align-middle"><Select value={item.empleadoAsignado || "N/A"} onValueChange={(value) => onItemAssignmentChange(idx, value)}><SelectTrigger className="w-full text-[10px] h-6 min-h-0 px-2 border-dashed"><SelectValue placeholder="-" /></SelectTrigger><SelectContent>{EMPLEADOS_DISPONIBLES.map((employee) => (<SelectItem key={employee} value={employee} className="text-xs">{employee.split(' ')[0]}</SelectItem>))}</SelectContent></Select></TableCell>
                                            <TableCell className="align-middle text-center">
                                                {/* 🔥 BOTÓN EDITAR */}
                                                <Button variant="ghost" size="icon" onClick={() => onEditItem(idx)} className="h-6 w-6 text-blue-500 hover:bg-blue-50 mr-1"><Pencil className="w-3 h-3"/></Button>
                                                <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-6 w-6 text-muted-foreground hover:text-red-500"><X className="w-3 h-3"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (<TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground bg-muted/5"><p className="text-sm">La lista de ítems está vacía.</p></TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-4 space-y-4">
                     <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-slate-950 border-green-200 dark:border-green-800 shadow-md sticky top-4">
                        <CardHeader className="pb-2 border-b border-green-100 dark:border-green-900/50"><CardTitle className="text-green-800 dark:text-green-300 flex items-center gap-2 text-base"><DollarSign className="w-4 h-4"/> Total Estimado</CardTitle></CardHeader>
                        <CardContent className="pt-6 text-center"><div className="text-4xl font-extrabold text-green-700 dark:text-green-400 tracking-tight">${currentTotal.toFixed(2)}</div></CardContent>
                        <CardFooter className="bg-green-100/30 dark:bg-green-900/10 py-2 px-4"><div className="w-full flex justify-between text-xs text-green-800 dark:text-green-300"><span>Cant. Ítems:</span><span className="font-bold">{items.length}</span></div></CardFooter>
                     </Card>
                </div>
            </div>
        </div>
    )
}

// Step3 permanece igual (sin cambios)
const Step3: React.FC<any> = ({ data, totalUSD, onChange }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            <div className="lg:col-span-7 space-y-4">
                <Card>
                    <CardHeader className="pb-3 bg-muted/20"><CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2"><User className="w-4 h-4"/> Resumen del Cliente</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-y-4 pt-4 text-sm"><div className="col-span-2"><p className="text-xs text-muted-foreground">Razón Social</p><p className="font-semibold text-base">{data.cliente.nombreRazonSocial}</p></div><div><p className="text-xs text-muted-foreground">RIF / Cédula</p><p className="font-mono">{data.cliente.prefijoRif}-{data.cliente.numeroRif}</p></div><div><p className="text-xs text-muted-foreground">Teléfono</p><p className="font-mono">{data.cliente.prefijoTelefono}-{data.cliente.numeroTelefono}</p></div></CardContent>
                </Card>
                <Card className="bg-muted/10"><CardContent className="flex items-center justify-between p-6"><span className="text-muted-foreground font-medium">Total a Cobrar:</span><span className="text-3xl font-bold text-green-700 dark:text-green-400">${totalUSD.toFixed(2)}</span></CardContent></Card>
            </div>
            <div className="lg:col-span-5 h-full"><div className="bg-white dark:bg-slate-950 p-4 rounded-lg border shadow-sm h-full flex flex-col"><h3 className="text-sm font-bold uppercase text-muted-foreground mb-2">Notas Internas</h3><div className="flex-grow"><Label htmlFor="notas" className="sr-only">Notas</Label><Textarea id="notas" className="w-full h-full min-h-[200px] resize-none border-0 bg-yellow-50/50 dark:bg-yellow-950/10 focus-visible:ring-1 focus-visible:ring-yellow-400" placeholder="Instrucciones para producción..." value={data.descripcionDetallada} onChange={(e) => onChange('descripcionDetallada', e.target.value)}/></div></div></div>
        </div>
    )
}