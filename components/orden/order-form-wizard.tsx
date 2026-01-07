// @/components/orden/order-form-wizard.tsx
"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" 
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area" 
import { Badge } from "@/components/ui/badge" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { toast } from 'sonner' 
import { cn } from "@/lib/utils"

import { 
    Plus, X, User, Receipt, 
    Users, Loader2, Pencil, Trash2, RefreshCcw, Save, 
    Palette, Scissors, Printer, Calendar, Box, ChevronRight
} from "lucide-react" 

import { ItemFormModal } from "@/components/orden/item-form-modal"
import { getLastOrderNumber } from "@/lib/firebase/ordenes" 
import { getFrequentClients, saveClient, deleteClient } from "@/lib/firebase/clientes" 
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"

// --- UTILIDAD PARA ELIMINAR UNDEFINED (OBLIGATORIO PARA FIREBASE) ---
const cleanFirebaseObject = (obj: any): any => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        } else if (newObj[key] && typeof newObj[key] === 'object' && !Array.isArray(newObj[key])) {
            newObj[key] = cleanFirebaseObject(newObj[key]);
        } else if (Array.isArray(newObj[key])) {
            newObj[key] = newObj[key].map((item: any) => 
                (typeof item === 'object' && item !== null) ? cleanFirebaseObject(item) : item
            );
        }
    });
    return newObj;
};

const PREFIJOS_RIF = ["V", "E", "P", "R", "J", "G"] as const;
const PREFIJOS_TELEFONO = ["0412", "0422", "0414", "0424", "0416", "0426"] as const;
const JEFES_CONTACTO = ["Marcos Leal", "Samuel Leal"] as const;

const INITIAL_FORM_DATA = {
    ordenNumero: '', 
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: { 
        nombreRazonSocial: "", rifCedula: "", telefono: "", 
        prefijoTelefono: "0414", numeroTelefono: "", 
        prefijoRif: "J", numeroRif: "", 
        domicilioFiscal: "", correo: "", personaContacto: "" 
    },
    serviciosSolicitados: { 
        impresionDigital: false, impresionGranFormato: false, corteLaser: false, laminacion: false, 
        avisoCorporeo: false, rotulacion: false, instalacion: false, senaletica: false 
    },
    items: [],
    descripcionDetallada: "",
};

export const OrderFormWizardV2: React.FC<any> = ({ 
    onCreate, 
    onUpdate, 
    onClose, 
    initialData, 
    currentUserId, 
    bcvRate 
}) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<any>(INITIAL_FORM_DATA);
    const [isLoading, setIsLoading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [isOrderNumLoading, setIsOrderNumLoading] = useState(false);
    const [frequentClients, setFrequentClients] = useState<any[]>([]); 
    const [isClientLoading, setIsClientLoading] = useState(true);
    const [selectedClientId, setSelectedClientId] = useState<string>('NEW'); 
    const [isClientEditing, setIsClientEditing] = useState(true); 
    const [designersList, setDesignersList] = useState<Designer[]>([]);

    useEffect(() => {
        const unsubscribeDesigners = subscribeToDesigners(setDesignersList);
        const loadData = async () => {
            setIsClientLoading(true);
            try {
                const clients = await getFrequentClients();
                setFrequentClients(clients.map(c => ({
                    id: c.id!, nombreRazonSocial: c.nombreRazonSocial, rifCedula: c.rifCedulaCompleto, 
                    telefono: c.telefonoCompleto, correo: c.correo, domicilioFiscal: c.domicilioFiscal, personaContacto: c.personaContactoCliente,
                })));

                if (initialData) {
                    const [prefijoRif, numeroRif] = (initialData.cliente?.rifCedula || "J-").split('-');
                    const tel = initialData.cliente?.telefono || "";
                    setFormData({
                        ...initialData,
                        ordenNumero: String(initialData.ordenNumero),
                        cliente: { 
                            ...initialData.cliente, 
                            prefijoRif: prefijoRif || "J", 
                            numeroRif: numeroRif || "", 
                            prefijoTelefono: tel.substring(0, 4) || "0414", 
                            numeroTelefono: tel.substring(4) || ""
                        }
                    });

                    if (initialData.cliente?.rifCedula === "V-EXPRESS") {
                        setStep(2);
                    }

                    const existing = clients.find(c => c.rifCedulaCompleto === initialData.cliente?.rifCedula);
                    if (existing) { setSelectedClientId(existing.id!); setIsClientEditing(false); }
                    else { setSelectedClientId('CUSTOM'); setIsClientEditing(true); }
                } else {
                    fetchOrderNumber();
                }
            } finally { setIsClientLoading(false); }
        };
        loadData();
        return () => unsubscribeDesigners();
    }, [initialData]);

    const fetchOrderNumber = async () => {
        setIsOrderNumLoading(true);
        try {
            const lastNumber = await getLastOrderNumber(); 
            setFormData((prev: any) => ({ ...prev, ordenNumero: String(lastNumber + 1) }));
        } finally { setIsOrderNumLoading(false); }
    };

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        if (clientId === 'NEW' || clientId === 'CUSTOM') {
            setIsClientEditing(true);
            setFormData((p: any) => ({ 
                ...p, 
                cliente: { ...INITIAL_FORM_DATA.cliente, prefijoTelefono: p.cliente.prefijoTelefono, prefijoRif: p.cliente.prefijoRif } 
            }));
            return;
        }
        const client = frequentClients.find(c => c.id === clientId);
        if (client) {
            setIsClientEditing(false);
            const [prefijoRif, numeroRif] = (client.rifCedula || "J-").split('-');
            setFormData((prev: any) => ({
                ...prev,
                cliente: {
                    ...prev.cliente,
                    nombreRazonSocial: client.nombreRazonSocial, 
                    correo: client.correo || "",
                    domicilioFiscal: client.domicilioFiscal || "", 
                    personaContacto: client.personaContacto || "",
                    prefijoRif: prefijoRif || "J", 
                    numeroRif: numeroRif || "", 
                    prefijoTelefono: client.telefono?.substring(0, 4) || "0414", 
                    numeroTelefono: client.telefono?.substring(4) || "",
                }
            }));
        }
    };

    const handleSaveClientData = async () => {
        const { nombreRazonSocial, numeroTelefono, prefijoTelefono, prefijoRif, numeroRif, domicilioFiscal, correo, personaContacto } = formData.cliente;
        if (!nombreRazonSocial?.trim() || numeroTelefono?.length !== 7) return toast.error("Datos de cliente inválidos");
        
        setIsLoading(true);
        try {
            const idToSave = (selectedClientId === 'NEW' || selectedClientId === 'CUSTOM') ? undefined : selectedClientId;
            const payload = {
                nombreRazonSocial, 
                telefonoCompleto: `${prefijoTelefono}${numeroTelefono}`,
                rifCedulaCompleto: `${prefijoRif}-${numeroRif}`, 
                prefijoTelefono, numeroTelefono, prefijoRif, numeroRif,
                domicilioFiscal, correo, 
                personaContactoCliente: JEFES_CONTACTO.includes(personaContacto as any) ? null : personaContacto
            };
            const newId = await saveClient(cleanFirebaseObject(payload), idToSave);
            toast.success("Cliente guardado");
            setSelectedClientId(newId);
            setIsClientEditing(false);
            const updated = await getFrequentClients();
            setFrequentClients(updated.map(c => ({ id: c.id, nombreRazonSocial: c.nombreRazonSocial, rifCedula: c.rifCedulaCompleto, telefono: c.telefonoCompleto })));
        } catch { toast.error("Error al guardar cliente"); } finally { setIsLoading(false); }
    };

    const handleDeleteClientData = async () => {
        if (!window.confirm("¿Seguro que deseas eliminar este cliente?")) return;
        setIsLoading(true);
        try {
            await deleteClient(selectedClientId);
            toast.success("Cliente eliminado");
            setSelectedClientId('NEW');
            setIsClientEditing(true);
            const updated = await getFrequentClients();
            setFrequentClients(updated.map(c => ({ id: c.id, nombreRazonSocial: c.nombreRazonSocial, rifCedula: c.rifCedulaCompleto, telefono: c.telefonoCompleto })));
        } catch { toast.error("Error al eliminar"); } finally { setIsLoading(false); }
    };

    const handleChange = useCallback((path: string, value: any) => {
        setFormData((prev: any) => {
            const newForm = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let current = newForm;
            for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
            const lastKey = keys[keys.length - 1];
            current[lastKey] = value;
            return newForm;
        });
    }, []);

    const currentTotal = useMemo(() => {
        return formData.items.reduce((sum: number, item: any) => {
            const cantidad = parseFloat(item.cantidad) || 0;
            const precio = parseFloat(item.precioUnitario) || 0;
            const x = parseFloat(item.medidaXCm) || 0;
            const y = parseFloat(item.medidaYCm) || 0;
            if (cantidad <= 0) return sum;
            let sub = (item.unidad === 'm2' && x > 0 && y > 0) ? (x / 100) * (y / 100) * precio * cantidad : precio * cantidad;
            return sum + sub;
        }, 0);
    }, [formData.items]);

    const handleSaveItem = useCallback((newItem: any) => {
        setFormData((prev: any) => {
            const itemProcesado = { ...newItem, empleadoAsignado: newItem.empleadoAsignado || "N/A" };
            let newItems = [...prev.items];
            if (editingItemIndex !== null) newItems[editingItemIndex] = itemProcesado;
            else newItems.push(itemProcesado);
            return { ...prev, items: newItems };
        });
        setEditingItemIndex(null);
        setIsItemModalOpen(false);
    }, [editingItemIndex]);

    const handleSaveOrder = async () => {
        if (isLoading) return;
        setIsLoading(true);

        const { prefijoTelefono, numeroTelefono, prefijoRif, numeroRif, ...clienteRest } = formData.cliente;
        const finalPayload = {
            ...formData,
            ordenNumero: parseInt(formData.ordenNumero, 10),
            cliente: {
                ...clienteRest,
                telefono: `${prefijoTelefono}${numeroTelefono}`,
                rifCedula: `${prefijoRif}-${numeroRif}`,
            },
            totalUSD: parseFloat(currentTotal.toFixed(2)),
            userId: currentUserId,
            updatedAt: new Date().toISOString()
        };

        try {
            const cleanPayload = cleanFirebaseObject(finalPayload);
            
            if (initialData?.id) {
                await onUpdate(initialData.id, cleanPayload);
            } else {
                await onCreate(cleanPayload);
            }
            
            toast.success("Orden procesada correctamente");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al procesar la orden");
        } finally {
            setIsLoading(false);
        }
    };

    const isStep1Valid = formData.cliente?.nombreRazonSocial?.length > 0 && formData.cliente?.numeroTelefono?.length === 7;
    const isStep2Valid = formData.items.length > 0;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden">
            {/* HEADER - iOS Blur Style */}
            <header className="shrink-0 p-6 md:px-10 md:py-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-6 z-10">
                <div className="flex items-center gap-5">
                    <div className="h-14 w-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <Receipt className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">
                            {initialData ? `Editar #${formData.ordenNumero}` : 'Nueva Orden'}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso</span>
                            <div className="flex gap-1.5">
                                {[1, 2, 3].map(s => (
                                    <div key={s} className={cn("h-1.5 w-8 rounded-full transition-all duration-500", step >= s ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800")} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Total Estimado</span>
                        <span className="text-2xl font-black text-blue-600">${currentTotal.toFixed(2)}</span>
                    </div>
                    <Separator orientation="vertical" className="h-10 mx-2 hidden md:block" />
                    <Button variant="ghost" onClick={onClose} className="rounded-full h-10 w-10 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 min-h-0 relative bg-slate-50/50 dark:bg-slate-950/50">
                <ScrollArea className="h-full">
                    <div className="p-6 md:p-10 max-w-5xl mx-auto">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={step} 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                
                                {step === 1 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2 space-y-6">
                                            <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <Users className="text-blue-500 w-5 h-5"/>
                                                        <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider">Identificación del Cliente</h3>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" variant={isClientEditing ? "default" : "outline"} onClick={() => isClientEditing ? handleSaveClientData() : setIsClientEditing(true)} className="rounded-xl font-black text-[10px] uppercase h-9">
                                                            {isClientEditing ? <><Save className="w-3.5 h-3.5 mr-2"/> Guardar</> : <><Pencil className="w-3.5 h-3.5 mr-2"/> Editar</>}
                                                        </Button>
                                                        {!isClientEditing && (
                                                            <Button size="sm" variant="destructive" onClick={handleDeleteClientData} className="rounded-xl w-9 h-9 p-0">
                                                                <Trash2 className="w-3.5 h-3.5"/>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Seleccionar Cliente Existente</Label>
                                                        <Select onValueChange={handleSelectClient} value={selectedClientId}>
                                                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-lg shadow-inner">
                                                                <SelectValue placeholder="Buscar en base de datos..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="NEW" className="font-black text-blue-600">✨ Crear Nuevo Cliente</SelectItem>
                                                                {frequentClients.map(c => (
                                                                    <SelectItem key={c.id} value={c.id}>{c.nombreRazonSocial}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-500", !isClientEditing && "opacity-40 pointer-events-none")}>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre / Razón Social</Label>
                                                            <Input value={formData.cliente?.nombreRazonSocial || ""} onChange={e => handleChange('cliente.nombreRazonSocial', e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">RIF / Cédula</Label>
                                                            <div className="flex gap-2">
                                                                <Select value={formData.cliente?.prefijoRif || "J"} onValueChange={v => handleChange('cliente.prefijoRif', v)}>
                                                                    <SelectTrigger className="w-20 h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold rounded-xl"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>{PREFIJOS_RIF.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                                <Input value={formData.cliente?.numeroRif || ""} onChange={e => handleChange('cliente.numeroRif', e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none flex-1 font-mono font-bold" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Teléfono de Contacto</Label>
                                                            <div className="flex gap-2">
                                                                <Select value={formData.cliente?.prefijoTelefono || "0414"} onValueChange={v => handleChange('cliente.prefijoTelefono', v)}>
                                                                    <SelectTrigger className="w-24 h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold rounded-xl"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>{PREFIJOS_TELEFONO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                                <Input value={formData.cliente?.numeroTelefono || ""} onChange={e => handleChange('cliente.numeroTelefono', e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none flex-1 font-mono font-bold" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Atención a:</Label>
                                                            <Input value={formData.cliente?.personaContacto || ""} onChange={e => handleChange('cliente.personaContacto', e.target.value)} className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold" placeholder="Nombre del contacto" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <Calendar className="text-orange-500 w-5 h-5"/>
                                                    <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider">Planificación</h3>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Fecha de Entrega</Label>
                                                    <Input type="date" value={formData.fechaEntrega || ""} onChange={e => handleChange('fechaEntrega', e.target.value)} className="h-14 rounded-2xl bg-orange-50/50 dark:bg-orange-500/10 border-none text-xl font-black text-orange-600" />
                                                </div>
                                                <div className="p-5 bg-blue-50/50 dark:bg-blue-500/10 rounded-2xl border border-dashed border-blue-200 dark:border-blue-500/30">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-blue-400 mb-2">
                                                        <span>Identificador de Orden</span>
                                                        <RefreshCcw className="w-3.5 h-3.5 cursor-pointer hover:rotate-180 transition-transform duration-500" onClick={fetchOrderNumber}/>
                                                    </div>
                                                    <p className="text-3xl font-black text-blue-700 dark:text-blue-400 tracking-tighter">#{formData.ordenNumero || "---"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* CABECERA PASO 2 */}
                                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/60 shadow-sm">
                                            <div>
                                                <h3 className="text-2xl font-black tracking-tight uppercase text-slate-800 dark:text-white">Detalle de Producción</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gestiona los productos y servicios de esta orden</p>
                                            </div>
                                            <Button 
                                                onClick={() => { setEditingItemIndex(null); setIsItemModalOpen(true); }} 
                                                className="rounded-2xl h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                            >
                                                <Plus className="w-5 h-5"/> AGREGAR ÍTEM
                                            </Button>
                                        </div>

                                        {/* CONTENEDOR TIPO IOS PARA ITEMS */}
                                        <div className="bg-slate-100/50 dark:bg-slate-800/40 rounded-[2.5rem] p-4 md:p-6 border border-slate-200/50 min-h-[400px]">
                                            {formData.items.length === 0 ? (
                                                <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-4">
                                                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
                                                        <Box className="w-8 h-8 opacity-20" />
                                                    </div>
                                                    <p className="font-bold uppercase text-[10px] tracking-[0.2em]">No hay ítems registrados</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {formData.items.map((item: any, idx: number) => (
                                                        <motion.div 
                                                            key={idx} 
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-[1.8rem] border border-slate-200/60 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 group hover:border-blue-300 transition-all"
                                                        >
                                                            <div className="flex items-center gap-4 flex-1 w-full">
                                                                <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                                                                    {item.tipoServicio === 'IMPRESION' ? <Printer className="text-blue-500 w-5 h-5" /> : 
                                                                     item.tipoServicio === 'CORTE' ? <Scissors className="text-orange-500 w-5 h-5" /> : 
                                                                     <Palette className="text-purple-500 w-5 h-5" />}
                                                                </div>
                                                                
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h4 className="font-black text-sm md:text-base uppercase text-slate-800 dark:text-white truncate">
                                                                            {item.nombre}
                                                                        </h4>
                                                                        {item.empleadoAsignado && item.empleadoAsignado !== "N/A" && (
                                                                            <Badge className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-none text-[8px] font-black px-2 rounded-lg">
                                                                                <User className="w-2 h-2 mr-1 inline"/> {item.empleadoAsignado}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase">
                                                                            {item.cantidad} {item.unidad}
                                                                        </span>
                                                                        {item.suministrarMaterial && (
                                                                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase">
                                                                                Material Incluido
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto pt-4 md:pt-0 border-t md:border-none border-slate-100 dark:border-slate-800">
                                                                <div className="text-left md:text-right">
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Subtotal Item</p>
                                                                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                                                        ${(parseFloat(item.cantidad) * parseFloat(item.precioUnitario)).toFixed(2)}
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingItemIndex(idx); setIsItemModalOpen(true); }} className="rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 h-10 w-10">
                                                                        <Pencil className="w-4 h-4"/>
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, items: formData.items.filter((_:any, i:number)=> i !== idx)})} className="rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 h-10 w-10">
                                                                        <Trash2 className="w-4 h-4"/>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm space-y-8">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                                                    <Save className="w-5 h-5"/>
                                                </div>
                                                <h3 className="font-black text-sm uppercase text-slate-400 tracking-wider">Verificación Final</h3>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center group transition-all">
                                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cliente</span>
                                                    <span className="font-black text-slate-800 dark:text-white uppercase">{formData.cliente?.nombreRazonSocial || "No especificado"}</span>
                                                </div>
                                                <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center group transition-all">
                                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Entrega</span>
                                                    <span className="font-black text-slate-800 dark:text-white">{formData.fechaEntrega}</span>
                                                </div>
                                                <div className="p-8 bg-blue-600 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/30 flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="font-black uppercase text-[10px] tracking-widest opacity-70">Monto Final</span>
                                                        <span className="text-4xl font-black tracking-tighter">${currentTotal.toFixed(2)}</span>
                                                    </div>
                                                    <ChevronRight className="w-8 h-8 opacity-40" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-yellow-50/50 dark:bg-yellow-900/10 p-8 rounded-[2.5rem] border border-yellow-200 dark:border-yellow-900/30 flex flex-col min-h-[300px]">
                                            <div className="flex items-center gap-3 mb-6">
                                                <Palette className="text-yellow-600 w-5 h-5"/>
                                                <h3 className="font-black text-sm uppercase text-yellow-600 tracking-wider">Notas Especiales</h3>
                                            </div>
                                            <Textarea 
                                                value={formData.descripcionDetallada || ""} 
                                                onChange={e => handleChange('descripcionDetallada', e.target.value)} 
                                                className="flex-1 bg-transparent border-none text-lg font-bold text-yellow-900 dark:text-yellow-200 focus-visible:ring-0 resize-none placeholder:text-yellow-600/30" 
                                                placeholder="Escribe aquí instrucciones de diseño, colores específicos o detalles de instalación..." 
                                            />
                                        </div>
                                    </div>
                                )}
                                
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </ScrollArea>
            </div>

            {/* FOOTER - iOS Bottom Bar Style */}
            <footer className="shrink-0 p-8 md:px-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 flex justify-between items-center z-10">
                <Button 
                    variant="ghost" 
                    onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} 
                    className="rounded-2xl h-14 px-8 font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    {step === 1 ? 'Cerrar Panel' : 'Volver'}
                </Button>
                
                <Button 
                    disabled={isLoading || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                    onClick={() => step < 3 ? setStep(s => s + 1) : handleSaveOrder()}
                    className={cn(
                        "rounded-2xl h-14 px-12 font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95",
                        step === 3 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20" 
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                    )}
                >
                    {isLoading ? (
                        <Loader2 className="animate-spin w-6 h-6"/>
                    ) : (
                        step === 3 ? 'Finalizar y Guardar' : 'Siguiente Paso'
                    )}
                </Button>
            </footer>

            {/* MODAL PARA AGREGAR ITEMS */}
            <ItemFormModal
                isOpen={isItemModalOpen}
                onClose={() => { setIsItemModalOpen(false); setEditingItemIndex(null); }}
                onAddItem={handleSaveItem}
                itemToEdit={editingItemIndex !== null ? formData.items[editingItemIndex] : undefined}
                designers={designersList} 
            />
        </div>
    )
}

// Sub-componente Separator simple para evitar dependencias extra si no lo tienes instalado
const Separator = ({ orientation = "horizontal", className = "" }) => (
    <div className={cn("bg-slate-200 dark:bg-slate-800", orientation === "horizontal" ? "h-[1px] w-full" : "w-[1px] h-full", className)} />
);