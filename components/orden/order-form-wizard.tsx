// @/components/orden/order-form-wizard.tsx
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
// Importaciones de Shadcn UI 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

// Iconos
import { 
    ChevronLeft, ChevronRight, Plus, X, User, DollarSign, Calendar, Truck, 
    Timer, Check, Users, Loader2, Pencil, Trash2 
} from "lucide-react" 

// Importaciones de tipos
import { type FormularioOrdenData, type ItemOrden, type ServiciosSolicitados, EstadoOrden } from "@/lib/types/orden" 
import { ItemFormModal } from "@/components/orden/item-form-modal"

// *******************************************************************
// 🔥 LÓGICA REAL DE FIREBASE
// *******************************************************************
import { getLastOrderNumber } from "@/lib/firebase/ordenes" 
import { getFrequentClients, saveClient, deleteClient, type ClienteFirestore } from "@/lib/firebase/clientes" 

// Interfaz para el cliente dentro del wizard (simplificada del tipo de Firestore)
export type ClienteWizard = { 
    id: string, 
    nombreRazonSocial: string, 
    rifCedula: string, // Completo (Ej: J-123456789)
    telefono: string, // Completo (Ej: 04141234567)
    correo: string, 
    domicilioFiscal: string 
    personaContacto?: string | null; // Contacto guardado del cliente
};


// -------------------------------------------------------------------
// TIPOS Y CONSTANTES DE TRABAJO
// -------------------------------------------------------------------

// Prefijos de RIF/Cédula
const PREFIJOS_RIF = ["V", "E", "P", "R", "J", "G"] as const;
type PrefijoRif = typeof PREFIJOS_RIF[number];

// Prefijos de Teléfono
const PREFIJOS_TELEFONO = ["0412", "0422", "0414", "0424", "0416", "0426"] as const;
type PrefijoTelefono = typeof PREFIJOS_TELEFONO[number];

// ✅ JEFES/CONTACTOS CLAVE (ENUM SOLICITADO)
const JEFES_CONTACTO = [
    "Marcos Leal", 
    "Samuel Leal",
] as const;
// Helper para usar .includes() en la lógica
const JEFES_CONTACTO_LIST = JEFES_CONTACTO as unknown as string[];


// ✅ Lista de Empleados/Jefes para Asignación
const EMPLEADOS_DISPONIBLES = [
    "N/A", 
    "Marcos (Gerencia)", 
    "Samuel (Diseño/Producción)", 
    "Daniela Chiquito (Corte Láser)",
    "Jose Angel (Impresión)",
    "Daniel Montero (Impresión)",
    "Jesus Ariza (Diseño)",
];

// Tipos de Material de Impresión
const MATERIALES_IMPRESION = [
    "Vinil Brillante", "Vinil Mate", "Banner Cara Negra", "Banner Cara Blanca", 
    "Banner Cara Gris", "Vinil Transparente (Clear)", "Otro/No aplica" 
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

// Interfaz extendida para manejar los campos separados de RIF y Teléfono
type FormularioOrdenExtendida = FormularioOrdenData & { 
    cliente: { 
        prefijoTelefono: PrefijoTelefono, 
        numeroTelefono: string, 
        prefijoRif: PrefijoRif, 
        numeroRif: string 
    } 
};

const INITIAL_FORM_DATA: FormularioOrdenExtendida = {
    ordenNumero: '', 
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: {
        nombreRazonSocial: "", rifCedula: "", 
        telefono: "", 
        
        prefijoTelefono: "0414", 
        numeroTelefono: "", 
        prefijoRif: "J", 
        numeroRif: "", 
        
        domicilioFiscal: "",
        correo: "", personaContacto: "",
    } as any, 
    serviciosSolicitados: {
        impresionDigital: false, impresionGranFormato: false, corteLaser: false, laminacion: false,
        avisoCorporeo: false, rotulacion: false, instalacion: false, senaletica: false,
    },
    items: [],
    descripcionDetallada: "",
} as any; 


// -------------------------------------------------------------------
// Componente OrderFormWizardV2
// -------------------------------------------------------------------

interface OrderFormWizardProps {
    onSave: (data: FormularioOrdenData & { totalUSD: number }) => Promise<void>;
    onClose: () => void;
    className?: string;
}

export const OrderFormWizardV2: React.FC<OrderFormWizardProps> = ({ onSave, onClose, className }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<FormularioOrdenExtendida>(INITIAL_FORM_DATA);
    const [isLoading, setIsLoading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    
    // Estado para el número de orden
    const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);

    // Estado para clientes frecuentes
    const [frequentClients, setFrequentClients] = useState<ClienteWizard[]>([]); 
    const [isClientLoading, setIsClientLoading] = useState(true);

    // 🔥 ESTADOS PARA GESTIÓN CRUD DE CLIENTES
    const [selectedClientId, setSelectedClientId] = useState<string>('NEW'); // ID del cliente seleccionado
    const [isClientEditing, setIsClientEditing] = useState(true); // Controla si los campos del cliente son editables

    // Función de Recarga de Clientes (Extraída para uso en CRUD)
    const fetchClients = useCallback(async () => {
         setIsClientLoading(true);
         try {
            const clients = await getFrequentClients(); 
            
            // Mapear el tipo de Firestore al tipo que espera el Wizard
            const formattedClients: ClienteWizard[] = clients.map(c => ({
                id: c.id!,
                nombreRazonSocial: c.nombreRazonSocial,
                rifCedula: c.rifCedulaCompleto, 
                telefono: c.telefonoCompleto,   
                correo: c.correo,
                domicilioFiscal: c.domicilioFiscal,
                personaContacto: c.personaContactoCliente,
            }));
            
            setFrequentClients(formattedClients);
         } catch (error) {
            console.error("Error al cargar clientes frecuentes:", error);
            setFrequentClients([]);
         } finally {
            setIsClientLoading(false);
         }
    }, []);

    // -------------------------------------------------------------------
    // 🔥 LÓGICA DE FIREBASE: OBTENER EL NÚMERO DE ORDEN Y CLIENTES
    // -------------------------------------------------------------------
    useEffect(() => {
        
        // 1. LÓGICA DE NÚMERO DE ORDEN
        const fetchLastOrderNumber = async () => {
            let lastNumberFromDB: number = 0; 
            try {
                // Función real de Firebase
                lastNumberFromDB = await getLastOrderNumber(); 
            } catch (error) {
                 console.error("Error al obtener el último número de orden, se usará 0.", error);
                 toast.error("Error al obtener el último número de orden. Se usará 1 como orden inicial.");
                 lastNumberFromDB = 0; 
            }
            
            setLastOrderNumber(lastNumberFromDB);
            setFormData(prev => ({
                ...prev,
                ordenNumero: String(lastNumberFromDB + 1), 
            }));
        };

        if (formData.ordenNumero === '') {
             fetchLastOrderNumber();
        }
        
        fetchClients(); 
       
    }, [fetchClients]); 

    // FUNCIÓN PARA CARGAR LOS DATOS DEL CLIENTE SELECCIONADO
    const handleSelectClient = useCallback((clientId: string) => {
        setSelectedClientId(clientId); // Actualiza el ID seleccionado
        
        if (clientId === 'NEW' || clientId === 'CUSTOM') {
            setIsClientEditing(true); // Nuevo cliente, siempre editable
            setFormData(prev => ({
                ...prev,
                cliente: {
                    ...INITIAL_FORM_DATA.cliente,
                    prefijoTelefono: prev.cliente.prefijoTelefono,
                    prefijoRif: prev.cliente.prefijoRif,
                    // Asegurar que los campos a limpiar estén vacíos
                    nombreRazonSocial: "",
                    numeroTelefono: "",
                    numeroRif: "",
                    correo: "",
                    domicilioFiscal: "",
                    personaContacto: "",
                }
            }));
            return;
        }

        const client = frequentClients.find(c => c.id === clientId);
        if (client) {
            setIsClientEditing(false); // Cliente existente: INICIA EN SOLO LECTURA
            
            // Descomponer RIF y Teléfono
            const [prefijoRif, numeroRif] = client.rifCedula.includes('-') 
                ? client.rifCedula.split('-') 
                : [INITIAL_FORM_DATA.cliente.prefijoRif, client.rifCedula];
            
            const prefijoTelefono = client.telefono.slice(0, 4) as PrefijoTelefono;
            const numeroTelefono = client.telefono.slice(4);

            setFormData(prev => ({
                ...prev,
                cliente: {
                    ...prev.cliente,
                    nombreRazonSocial: client.nombreRazonSocial,
                    correo: client.correo,
                    domicilioFiscal: client.domicilioFiscal,
                    // Dejar el contacto de la orden (si ya había un jefe seleccionado) o usar el contacto del cliente
                    personaContacto: prev.cliente.personaContacto || client.personaContacto || "", 
                    
                    prefijoRif: prefijoRif as PrefijoRif,
                    numeroRif: numeroRif,
                    prefijoTelefono: prefijoTelefono,
                    numeroTelefono: numeroTelefono,
                }
            }));
        }
    }, [frequentClients]);

    // -------------------------------------------------------------------
    // 🔥 HANDLERS CRUD PARA CLIENTES
    // -------------------------------------------------------------------
    
    // ✅ CORRECCIÓN 1: Función que construye el payload usando 'null' si no hay contacto
    const getClientPayload = (data: FormularioOrdenExtendida['cliente']): Omit<ClienteFirestore, 'id' | 'fechaCreacion'> => {
        
        let personaContactoClienteValue: string | null = null;
        
        const isJefe = JEFES_CONTACTO_LIST.includes(data.personaContacto);
        const contactIsEmpty = data.personaContacto.trim() === "";
        
        if (!isJefe && !contactIsEmpty) {
            // Si no es un Jefe y el campo tiene un valor, guardamos el valor
            personaContactoClienteValue = data.personaContacto;
        } 
        // Si es un Jefe, o el campo está vacío, usamos 'null' para Firestore (evitando el 'undefined')

        const payload = {
            nombreRazonSocial: data.nombreRazonSocial,
            telefonoCompleto: `${data.prefijoTelefono}${data.numeroTelefono}`,
            rifCedulaCompleto: `${data.prefijoRif}-${data.numeroRif}`,
            
            prefijoTelefono: data.prefijoTelefono,
            numeroTelefono: data.numeroTelefono,
            prefijoRif: data.prefijoRif,
            numeroRif: data.numeroRif,
            
            domicilioFiscal: data.domicilioFiscal,
            correo: data.correo,
            // Usamos string o null
            personaContactoCliente: personaContactoClienteValue, 
        };
        return payload as Omit<ClienteFirestore, 'id' | 'fechaCreacion'>;
    };


    const handleSaveClientData = useCallback(async () => {
        const currentClientData = formData.cliente;
        
        // 1. VALIDACIÓN BÁSICA
        if (currentClientData.nombreRazonSocial.trim().length === 0 || currentClientData.numeroTelefono.length !== 7) {
             toast.error("Datos incompletos. Se requieren Nombre/Razón Social y Teléfono (7 dígitos).");
             return;
        }

        const idToSave = selectedClientId === 'NEW' || selectedClientId === 'CUSTOM' ? undefined : selectedClientId;
        const isCreating = idToSave === undefined;
        // Obtenemos el payload corregido con 'null'
        const payload = getClientPayload(currentClientData);

        try {
            setIsLoading(true);
            const newId = await saveClient(payload, idToSave);

            await fetchClients(); 

            setSelectedClientId(newId);
            setIsClientEditing(false);
            toast.success(`Cliente ${isCreating ? 'creado' : 'actualizado'} con éxito. ID: ${newId.substring(0, 5)}...`);

        } catch (error) {
            console.error("Error al guardar el cliente:", error);
            toast.error("Error al guardar el cliente en Firebase.");
        } finally {
            setIsLoading(false);
        }
    }, [formData, selectedClientId, fetchClients]);

    const handleEditClientData = useCallback(() => {
        // Solo permite editar si hay un cliente seleccionado y no es 'NEW'
        if (selectedClientId && selectedClientId !== 'NEW') {
            setIsClientEditing(true);
            toast.info("Modo Edición activado. Recuerde Guardar los cambios.");
        }
    }, [selectedClientId]);

    const handleDeleteClientData = useCallback(async () => {
        if (selectedClientId && selectedClientId !== 'NEW' && selectedClientId !== 'CUSTOM' && 
            window.confirm('⚠️ ¿Estás seguro de que quieres eliminar permanentemente este cliente? Esta acción no se puede deshacer.')) {
            try {
                setIsLoading(true);
                await deleteClient(selectedClientId); 
                
                // Resetea el estado a Nuevo Cliente
                setSelectedClientId('NEW');
                setIsClientEditing(true);
                setFormData(INITIAL_FORM_DATA);
                
                await fetchClients();
                
                toast.success("Cliente eliminado con éxito.");
                
            } catch (error) {
                console.error("Error al eliminar el cliente:", error);
                toast.error("Error al eliminar el cliente en Firebase.");
            } finally {
                setIsLoading(false);
            }
        }
    }, [selectedClientId, fetchClients]);


    // Función genérica para manejar cambios en el formulario con validación
    const handleChange = useCallback((path: string, value: any) => {
        setFormData(prev => {
            const newForm = { ...prev };
            const keys = path.split('.');
            let current: any = newForm;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            if (path === 'cliente.numeroTelefono') {
                const cleanedValue = value.replace(/[^0-9]/g, ''); 
                current[keys[keys.length - 1]] = cleanedValue.slice(0, 7); 
            } 
            else if (path === 'cliente.numeroRif') {
                 const cleanedValue = value.replace(/[^0-9]/g, ''); 
                 current[keys[keys.length - 1]] = cleanedValue.slice(0, 9); 
            }
            else {
                 current[keys[keys.length - 1]] = value;
            }
            
            const isClientField = path.startsWith('cliente.');
            const isContactField = path === 'cliente.personaContacto'; 
            
            if (isClientField && !isContactField && selectedClientId !== 'NEW' && !isClientEditing) {
                 // No aplica.
            }

            return newForm;
        });
    }, [selectedClientId, isClientEditing]);
    
    // LÓGICA DE AÑADIR ITEM (Se mantiene)
    const handleAddItem = useCallback((newItem: ItemOrden & { materialDeImpresion?: MaterialDeImpresion }) => {
        const itemWithAssignment: ItemOrden & { materialDeImpresion?: MaterialDeImpresion, empleadoAsignado: string } = {
            ...newItem,
            empleadoAsignado: "N/A", 
            materialDeImpresion: newItem.materialDeImpresion || "Otro/No aplica"
        };

        setFormData(prev => {
            const newItems = [...prev.items, itemWithAssignment as ItemOrden];
            const newForm = { ...prev, items: newItems };
            
            // Lógica de Auto-Check de Servicios
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

    const calculateTotal = (items: ItemOrden[]) => {
      // Lógica de cálculo (Se mantiene)
      return items.reduce((sum, item) => {
          let subtotal = 0;
          const PRECIO_LASER_POR_MINUTO = 0.80; 
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
             const totalMinutes = (parseFloat(minutesStr) || 0) + ((parseFloat(secondsStr) || 0) / 60);
             
             subtotal = totalMinutes * PRECIO_LASER_POR_MINUTO * cantidad; 
          }
          return sum + subtotal;
      }, 0);
    }
    
    const currentTotal = useMemo(() => calculateTotal(formData.items), [formData.items]);


    // --- HANDLER DE GUARDADO FINAL (CORREGIDO) ---
    const handleSave = async () => {
        setIsLoading(true);
        
        // 1. 🔥 CORRECCIÓN CLAVE: Destructurar el objeto cliente para OMITIR los campos separados (prefijos y números)
        const { 
            prefijoTelefono, numeroTelefono, prefijoRif, numeroRif, 
            ...clienteRest // Contiene nombreRazonSocial, correo, domicilioFiscal, personaContacto, rifCedula, telefono
        } = formData.cliente;
        
        // 2. Reconstruir los campos completos que sí van en el documento final.
        const telefonoCompleto = `${prefijoTelefono}${numeroTelefono}`;
        const rifCedulaCompleto = prefijoRif && numeroRif
            ? `${prefijoRif}-${numeroRif}`
            : '';

        // 3. Crear el payload final seguro para Firestore
        const finalPayload = {
            ...formData,
            ordenNumero: parseInt(formData.ordenNumero, 10), // ¡IMPORTANTE! Guardar como número en Firestore
            cliente: {
                ...clienteRest, // Incluye todos los campos excepto los omitidos
                telefono: telefonoCompleto, // Campo completo (reemplaza el campo del wizard)
                rifCedula: rifCedulaCompleto, // Campo completo (reemplaza el campo del wizard)
            },
            totalUSD: parseFloat(currentTotal.toFixed(2)),
        };

        try {
            // Llama a la función de guardado con el payload final
            await onSave(finalPayload as any); 
            toast.success(`Orden #${finalPayload.ordenNumero} creada con éxito.`);
            onClose();
        } catch (error) {
            console.error("Error al guardar la orden:", error);
            toast.error("Error al intentar guardar la orden de servicio.");
        } finally {
            setIsLoading(false);
        }
    };

    const totalSteps = 3;
    const hasPrintingSelected = formData.serviciosSolicitados.impresionDigital || formData.serviciosSolicitados.impresionGranFormato;

    // Check para deshabilitar el botón de siguiente
    const isStep1Valid = useMemo(() => (
        formData.cliente.nombreRazonSocial.trim().length > 0 &&
        formData.fechaEntrega.trim().length > 0 &&
        formData.cliente.numeroTelefono.trim().length === 7 
    ), [formData.cliente.nombreRazonSocial, formData.fechaEntrega, formData.cliente.numeroTelefono]);
    
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
            
            <ScrollArea className="flex-grow h-0"> 
                <div className="p-6">
                    {step === 1 && <Step1 
                                data={formData} 
                                onChange={handleChange} 
                                frequentClients={frequentClients}
                                isClientLoading={isClientLoading}
                                onClientSelected={handleSelectClient}
                                // 🔥 PROPS DE CONTROL CRUD
                                isClientEditing={isClientEditing}
                                selectedClientId={selectedClientId}
                                onSaveClient={handleSaveClientData}
                                onEditClient={handleEditClientData}
                                onDeleteClient={handleDeleteClientData}
                                isWizardLoading={isLoading}
                            />}
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
                            handleSave(); 
                        }
                    }}
                    disabled={
                        isLoading || 
                        (step === 1 && !isStep1Valid) ||
                        (step === 2 && !isStep2Valid)
                    }
                    className={`gap-2 ${step < totalSteps ? 'bg-primary hover:bg-primary/90' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                >
                    {step < totalSteps ? 'Siguiente' : (isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : 'Finalizar Orden')}
                    {step < totalSteps && <ChevronRight className="w-4 h-4" />}
                </Button>
            </div>
            
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
// SUB-COMPONENTE: PASO 1 (CLIENTE Y FECHAS)
// -------------------------------------------------------------------

interface Step1Props {
    data: FormularioOrdenExtendida;
    onChange: (path: string, value: any) => void;
    frequentClients: ClienteWizard[];
    isClientLoading: boolean;
    onClientSelected: (clientId: string) => void;
    
    // 🔥 PROPS DE CONTROL CRUD
    isClientEditing: boolean;
    selectedClientId: string;
    onSaveClient: () => Promise<void>;
    onEditClient: () => void;
    onDeleteClient: () => Promise<void>;
    isWizardLoading: boolean;
}

const Step1: React.FC<Step1Props> = ({ 
    data, onChange, frequentClients, isClientLoading, onClientSelected,
    isClientEditing, selectedClientId, onSaveClient, onEditClient, onDeleteClient, isWizardLoading
}) => {
    
    const currentPrefijoTelefono = data.cliente.prefijoTelefono;
    const currentNumeroTelefono = data.cliente.numeroTelefono;
    const currentPrefijoRif = data.cliente.prefijoRif;
    const currentNumeroRif = data.cliente.numeroRif;
    
    const isExistingClient = selectedClientId !== 'NEW' && selectedClientId !== 'CUSTOM';
    
    const isSaveDisabled = !isClientEditing || 
                           data.cliente.nombreRazonSocial.trim().length === 0 ||
                           data.cliente.numeroTelefono.length !== 7 ||
                           isWizardLoading;
    
    const isEditingPlaceholder = selectedClientId === 'CUSTOM';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">1. Datos del Cliente y Fechas</h2>

            {/* BOTÓN DE SELECCIÓN/CREACIÓN DE CLIENTE NUEVO */}
            <Card className="dark:bg-gray-800/50 border-primary/50">
                 <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><Users className="w-5 h-5"/> Seleccionar/Gestionar Cliente</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-grow">
                            <Label htmlFor="clienteFrecuente">Buscar o seleccionar cliente guardado</Label>
                            <Select 
                                onValueChange={onClientSelected}
                                value={selectedClientId}
                                disabled={isClientLoading || (isClientEditing && selectedClientId !== 'NEW')} // Deshabilitar si está editando y no es un cliente nuevo
                            >
                                <SelectTrigger className="w-full">
                                    {isClientLoading ? (
                                        <Skeleton className="h-6 w-full" />
                                    ) : (
                                        <SelectValue placeholder="Seleccionar o buscar cliente..." />
                                    )}
                                </SelectTrigger>
                                <SelectContent>
                                     <SelectItem value="NEW" className="font-bold text-primary dark:text-primary">
                                        ✨ **Nuevo Cliente** (Comenzar de cero)
                                     </SelectItem>
                                     {isEditingPlaceholder && (
                                        <SelectItem value="CUSTOM" className="text-orange-500 font-semibold">
                                            ✏️ **Cliente en Edición** (Guardar como nuevo)
                                        </SelectItem>
                                     )}
                                     <Separator />
                                    {frequentClients.map(client => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.nombreRazonSocial} ({client.rifCedula})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 🔥 BOTONES DE ACCIÓN DE CLIENTE (CRUD) */}
                        <div className="flex-shrink-0 flex items-end gap-2 pt-2">
                            {isClientEditing ? (
                                <Button 
                                    onClick={onSaveClient} 
                                    disabled={isSaveDisabled}
                                    className="bg-green-600 hover:bg-green-700 text-white gap-2"
                                    title="Guardar o actualizar este cliente"
                                >
                                    {isWizardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 
                                    Guardar
                                </Button>
                            ) : (
                                <>
                                    <Button 
                                        onClick={onEditClient} 
                                        variant="outline"
                                        className="gap-2"
                                        title="Habilitar edición de los datos del cliente"
                                    >
                                        <Pencil className="w-4 h-4" /> Editar
                                    </Button>
                                    <Button 
                                        onClick={onDeleteClient} 
                                        variant="destructive"
                                        disabled={!isExistingClient || isWizardLoading}
                                        title="Eliminar este cliente permanentemente"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    {isClientLoading && <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin"/> Cargando clientes...
                    </p>}
                    {!isClientLoading && isExistingClient && !isClientEditing && (
                         <p className="text-sm text-blue-500 dark:text-blue-400 mt-2">
                             🔒 Cliente Existente. Pulsa **"Editar"** para modificar sus datos permanentes.
                         </p>
                    )}
                </CardContent>
            </Card>

            <Card className="dark:bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><User className="w-5 h-5"/> Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="nombreRazonSocial">Nombre/Razón Social (*)</Label>
                            <Input 
                                id="nombreRazonSocial" 
                                value={data.cliente.nombreRazonSocial ?? ""} 
                                onChange={(e) => onChange('cliente.nombreRazonSocial', e.target.value)} 
                                required 
                                disabled={!isClientEditing} // Controlado por el modo de edición
                            />
                        </div>
                        
                        {/* ESTRUCTURA PARA RIF/Cédula */}
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="rifCedula">RIF/Cédula</Label>
                            <div className="flex gap-2">
                                {/* SELECT para el Prefijo RIF */}
                                <Select 
                                    value={currentPrefijoRif ?? PREFIJOS_RIF[0]} 
                                    onValueChange={(value) => onChange('cliente.prefijoRif', value)}
                                    disabled={!isClientEditing} // Controlado por el modo de edición
                                >
                                    <SelectTrigger className="w-[80px] flex-shrink-0">
                                        <SelectValue placeholder="Letra" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PREFIJOS_RIF.map(prefijo => (
                                            <SelectItem key={prefijo} value={prefijo}>{prefijo}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* INPUT para el Número RIF/Cédula */}
                                <Input 
                                    id="numeroRif" 
                                    value={currentNumeroRif ?? ""} 
                                    onChange={(e) => onChange('cliente.numeroRif', e.target.value)} 
                                    type="tel"
                                    placeholder="Número (Máx 9 dígitos)"
                                    maxLength={9}
                                    disabled={!isClientEditing} // Controlado por el modo de edición
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ESTRUCTURA DE TELÉFONO */}
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="telefono">Teléfono (7 dígitos requeridos) (*)</Label>
                            <div className="flex gap-2">
                                <Select 
                                    value={currentPrefijoTelefono ?? PREFIJOS_TELEFONO[0]} 
                                    onValueChange={(value) => onChange('cliente.prefijoTelefono', value)}
                                    disabled={!isClientEditing} // Controlado por el modo de edición
                                >
                                    <SelectTrigger className="w-[100px] flex-shrink-0">
                                        <SelectValue placeholder="Prefijo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PREFIJOS_TELEFONO.map(prefijo => (
                                            <SelectItem key={prefijo} value={prefijo}>{prefijo}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Input 
                                    id="numeroTelefono" 
                                    value={currentNumeroTelefono ?? ""} 
                                    onChange={(e) => onChange('cliente.numeroTelefono', e.target.value)} 
                                    type="tel"
                                    placeholder="Ej: 5551234 (7 dígitos)"
                                    maxLength={7}
                                    className={currentNumeroTelefono.length > 0 && currentNumeroTelefono.length < 7 ? "border-red-500" : ""}
                                    disabled={!isClientEditing} // Controlado por el modo de edición
                                />
                            </div>
                            {currentNumeroTelefono.length > 0 && currentNumeroTelefono.length < 7 && (
                                <p className="text-xs text-red-500">
                                    Faltan {7 - currentNumeroTelefono.length} dígitos para completar el número.
                                </p>
                            )}
                        </div>

                        {/* ✅ CAMPO PERSONA DE CONTACTO (SIEMPRE EDITABLE) */}
                        <div>
                            <Label htmlFor="personaContacto">Persona de Contacto (Para esta Orden)</Label>
                            <Select 
                                value={JEFES_CONTACTO_LIST.includes(data.cliente.personaContacto) ? data.cliente.personaContacto : "MANUAL"}
                                onValueChange={(value) => {
                                    if (value !== "MANUAL") {
                                        onChange('cliente.personaContacto', value);
                                    } else {
                                        onChange('cliente.personaContacto', ""); // Limpiar para entrada manual
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar o escribir..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {JEFES_CONTACTO.map(jefe => (
                                        <SelectItem key={jefe} value={jefe}>
                                            {jefe}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="MANUAL" className="font-semibold text-orange-500">
                                        Ingreso Manual...
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            
                            {/* Input condicional para entrada manual */}
                            {(!JEFES_CONTACTO_LIST.includes(data.cliente.personaContacto) || data.cliente.personaContacto === "") && (
                                <Input 
                                    id="personaContactoManual" 
                                    value={data.cliente.personaContacto ?? ""} 
                                    onChange={(e) => onChange('cliente.personaContacto', e.target.value)} 
                                    placeholder="Escribe el nombre del contacto..."
                                    className="mt-2"
                                />
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="correo">Correo Electrónico</Label>
                            <Input 
                                id="correo" 
                                type="email" 
                                value={data.cliente.correo ?? ""} 
                                onChange={(e) => onChange('cliente.correo', e.target.value)} 
                                disabled={!isClientEditing} // Controlado por el modo de edición
                            />
                        </div>
                        <div>
                            <Label htmlFor="domicilioFiscal">Domicilio Fiscal</Label>
                            <Input 
                                id="domicilioFiscal" 
                                value={data.cliente.domicilioFiscal ?? ""} 
                                onChange={(e) => onChange('cliente.domicilioFiscal', e.target.value)} 
                                disabled={!isClientEditing} // Controlado por el modo de edición
                            />
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
                            <Input 
                                id="ordenNumero" 
                                value={data.ordenNumero || 'Asignando...'} 
                                readOnly 
                                className="font-mono bg-gray-100 dark:bg-gray-700/50" 
                            />
                        </div>
                        <div>
                            <Label htmlFor="fechaEntrega">Fecha de Entrega Estimada (*)</Label>
                            <Input 
                                id="fechaEntrega" 
                                type="date" 
                                value={data.fechaEntrega} 
                                onChange={(e) => onChange('fechaEntrega', e.target.value)} 
                                required 
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// -------------------------------------------------------------------
// SUB-COMPONENTE: PASO 2 (ÍTEMS Y SERVICIOS) - Se mantiene
// -------------------------------------------------------------------

interface Step2Props {
  items: ItemOrden[];
  removeItem: (index: number) => void;
  data: FormularioOrdenData;
  onChange: (path: string, value: any) => void;
  onItemAssignmentChange: (itemIndex: number, employeeName: string) => void;
  openItemModal: () => void;
  materials: readonly string[]; 
}

const Step2: React.FC<Step2Props> = ({ items, removeItem, data, onChange, onItemAssignmentChange, openItemModal }) => { 
  
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

    const isServiceAutoChecked = useCallback((key: keyof ServiciosSolicitados): boolean => {
        if (key === 'corteLaser') {
            return items.some(item => (item as any).tipoServicio === 'CORTE_LASER' || (item as any).unidad === 'tiempo');
        }
        if (key === 'impresionDigital') {
            return items.some(item => (item as any).tipoServicio === 'IMPRESION');
        }
        if (key === 'rotulacion') {
            return items.some(item => (item as any).tipoServicio === 'ROTULACION');
        }
        if (key === 'avisoCorporeo') {
            return items.some(item => (item as any).tipoServicio === 'AVISO_CORPOREO');
        }
        if (key === 'impresionGranFormato') {
            return items.some(item => (item as any).materialDeImpresion && (item as any).materialDeImpresion !== "Otro/No aplica");
        }
        return false;
    }, [items]);


  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">2. Detalle de Ítems y Servicios</h2>

        <Card className="dark:bg-gray-800/50">
            <CardHeader>
                <CardTitle className="text-xl">Servicios Adicionales/Confirmados</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Botones Toggle */}
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(data.serviciosSolicitados) as (keyof ServiciosSolicitados)[]).map((key) => {
                        const path = `serviciosSolicitados.${key}`;
                        const isChecked = data.serviciosSolicitados[key];
                        const isDisabled = isServiceAutoChecked(key); 
                        const buttonText = getServiceText(key);

                        return (
                            <Button
                                key={key}
                                onClick={() => onChange(path, !isChecked)}
                                disabled={isDisabled}
                                variant={isChecked ? (isDisabled ? "default" : "secondary") : "outline"}
                                className={`
                                    ${isChecked ? 
                                        'bg-primary text-primary-foreground dark:bg-primary/80 dark:text-white hover:bg-primary/90' : 
                                        'bg-background hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700'
                                    }
                                    ${isDisabled ? 
                                        'opacity-70 cursor-not-allowed border-blue-500/50 dark:border-blue-400/50 text-blue-500 dark:text-blue-400' : 
                                        ''
                                    }
                                    gap-1 transition-colors duration-150
                                `}
                            >
                                {isChecked && <Check className="w-4 h-4" />}
                                {buttonText}
                                {isDisabled && 
                                    <span className="text-xs ml-1 opacity-70">(Auto)</span>
                                }
                            </Button>
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

                {/* Tabla de Ítems */}
                <div className="space-y-3">
                    <ScrollArea className="h-[300px] w-full border rounded-md dark:border-gray-700">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                    <TableHead className="w-[28%]">Descripción</TableHead>
                                    <TableHead className="w-[8%] text-center">Cant.</TableHead>
                                    <TableHead className="w-[8%] text-center">Unidad</TableHead>
                                    <TableHead className="w-[18%]">Material/Detalle</TableHead>
                                    <TableHead className="w-[15%] text-right">Subtotal USD</TableHead>
                                    <TableHead className="w-[18%] text-center">Asignación</TableHead>
                                    <TableHead className="w-[5%] text-center">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length > 0 ? (
                                    items.map((item, index) => {
                                        const itemAny = item as any;
                                        
                                        const materialDisplay = itemAny.materialDetalleCorte 
                                            ? itemAny.materialDetalleCorte
                                            : itemAny.materialDeImpresion || 'N/A';
                                        
                                        const showTiempo = itemAny.unidad === 'tiempo' && itemAny.tiempoCorte && itemAny.tiempoCorte !== '0:00';

                                        return (
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
// SUB-COMPONENTE: PASO 3 (RESUMEN Y CONFIRMACIÓN) - Se mantiene
// -------------------------------------------------------------------

interface Step3Props {
    data: FormularioOrdenData;
    totalUSD: number;
    onChange: (path: string, value: any) => void;
}

const Step3: React.FC<Step3Props> = ({ data, totalUSD, onChange }) => {
    
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

    const clienteData = data.cliente as any;
    
    // Muestra el RIF/Cédula completo reconstruido
    const rifCompleto = clienteData.prefijoRif && clienteData.numeroRif 
        ? `${clienteData.prefijoRif}-${clienteData.numeroRif}`
        : 'N/A';
        
    // Muestra el Teléfono completo reconstruido
    const telefonoCompleto = clienteData.prefijoTelefono && clienteData.numeroTelefono 
        ? `${clienteData.prefijoTelefono} ${clienteData.numeroTelefono}`
        : 'N/A';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">3. Revisión Final y Descripción</h2>

            <Card className="dark:bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-xl">Detalle de la Orden</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    <div className="lg:col-span-1 space-y-4">
                        <div className="p-4 dark:bg-gray-900 rounded-lg border dark:border-gray-700">
                            <h3 className="text-lg font-semibold mb-3 border-b pb-2 text-primary dark:text-gray-100">Datos del Cliente</h3>
                            {renderField('Razón Social', data.cliente.nombreRazonSocial, <User className="w-4 h-4"/>)}
                            {renderField('RIF/Cédula', rifCompleto, <User className="w-4 h-4"/>)}
                            {renderField('Teléfono', telefonoCompleto, <User className="w-4 h-4"/>)}
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