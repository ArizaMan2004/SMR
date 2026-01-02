// @/components/orden/order-form-wizard.tsx
"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input" 
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area" 
import { Badge } from "@/components/ui/badge" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { Skeleton } from "@/components/ui/skeleton" 
import { toast } from 'sonner' 
import { cn } from "@/lib/utils"

import { 
    ChevronLeft, ChevronRight, Plus, X, User, DollarSign, Calendar, 
    Check, Users, Loader2, Pencil, Trash2, RefreshCcw, Save, 
    Palette, Scissors, Printer, Hash, Receipt, Info, Box, Timer
} from "lucide-react" 

import { type ItemOrden } from "@/lib/types/orden" 
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

export const OrderFormWizardV2: React.FC<any> = ({ onSave, onClose, ordenToEdit }) => {
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

                if (ordenToEdit) {
                    const [prefijoRif, numeroRif] = (ordenToEdit.cliente.rifCedula || "J-").split('-');
                    const tel = ordenToEdit.cliente.telefono || "";
                    setFormData({
                        ...ordenToEdit,
                        ordenNumero: String(ordenToEdit.ordenNumero),
                        cliente: { 
                            ...ordenToEdit.cliente, 
                            prefijoRif, numeroRif, 
                            prefijoTelefono: tel.substring(0, 4) || "0414", 
                            numeroTelefono: tel.substring(4) 
                        }
                    });

                    // ✨ LÓGICA DE DETECCIÓN EXPRESS ✨
                    // Si el RIF es V-EXPRESS, saltamos directamente al Paso 2
                    if (ordenToEdit.cliente?.rifCedula === "V-EXPRESS") {
                        setStep(2);
                    }

                    const existing = clients.find(c => c.rifCedulaCompleto === ordenToEdit.cliente.rifCedula);
                    if (existing) { setSelectedClientId(existing.id!); setIsClientEditing(false); }
                    else { setSelectedClientId('CUSTOM'); setIsClientEditing(true); }
                } else {
                    fetchOrderNumber();
                }
            } finally { setIsClientLoading(false); }
        };
        loadData();
        return () => unsubscribeDesigners();
    }, [ordenToEdit]);

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
                    nombreRazonSocial: client.nombreRazonSocial, correo: client.correo,
                    domicilioFiscal: client.domicilioFiscal, personaContacto: client.personaContacto || "",
                    prefijoRif, numeroRif, prefijoTelefono: client.telefono.substring(0, 4), numeroTelefono: client.telefono.substring(4),
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
                nombreRazonSocial, telefonoCompleto: `${prefijoTelefono}${numeroTelefono}`,
                rifCedulaCompleto: `${prefijoRif}-${numeroRif}`, prefijoTelefono, numeroTelefono, prefijoRif, numeroRif,
                domicilioFiscal, correo, personaContactoCliente: JEFES_CONTACTO.includes(personaContacto as any) ? null : personaContacto
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
        };

        try {
            const cleanPayload = cleanFirebaseObject(finalPayload);
            await onSave(cleanPayload);
            toast.success("Orden guardada");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setIsLoading(false);
        }
    };

    const isStep1Valid = formData.cliente.nombreRazonSocial?.length > 0 && formData.cliente.numeroTelefono?.length === 7;

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
            <header className="shrink-0 p-6 md:p-10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="h-16 w-16 bg-blue-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                        <Receipt className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter uppercase text-slate-900 dark:text-white leading-none">
                            {ordenToEdit ? `Editar #${formData.ordenNumero}` : 'Nueva Orden'}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paso {step} de 3</span>
                            <div className="flex gap-1.5">
                                {[1, 2, 3].map(s => <div key={s} className={cn("h-1.5 w-8 rounded-full transition-all duration-500", step >= s ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-800")} />)}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="h-10 px-4 rounded-2xl border-slate-200 bg-white font-black text-blue-600 text-lg">
                        TOTAL: ${currentTotal.toFixed(2)}
                    </Badge>
                    <Button variant="ghost" onClick={onClose} className="rounded-full h-12 w-12 hover:bg-red-50 hover:text-red-500"><X className="w-6 h-6" /></Button>
                </div>
            </header>

            <div className="flex-1 min-h-0 relative">
                <ScrollArea className="h-full">
                    <div className="p-6 md:p-12 max-w-6xl mx-auto">
                        <AnimatePresence mode="wait">
                            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                
                                {step === 1 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2 space-y-6">
                                            <section className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3"><Users className="text-blue-500"/><h3 className="font-black text-sm uppercase text-slate-400">Datos Cliente</h3></div>
                                                    <div className="flex gap-2">
                                                        <Button size="sm" variant={isClientEditing ? "default" : "outline"} onClick={() => isClientEditing ? handleSaveClientData() : setIsClientEditing(true)} className="rounded-xl font-black">
                                                            {isClientEditing ? <><Save className="w-4 h-4 mr-2"/> Guardar</> : <><Pencil className="w-4 h-4 mr-2"/> Editar</>}
                                                        </Button>
                                                        {!isClientEditing && <Button size="sm" variant="destructive" onClick={handleDeleteClientData} className="rounded-xl w-10 p-0"><Trash2 className="w-4 h-4"/></Button>}
                                                    </div>
                                                </div>
                                                <div className="space-y-6">
                                                    <Select onValueChange={handleSelectClient} value={selectedClientId}>
                                                        <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-lg"><SelectValue placeholder="Buscar..." /></SelectTrigger>
                                                        <SelectContent><SelectItem value="NEW" className="font-black text-blue-600">✨ Nuevo Cliente</SelectItem>{frequentClients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombreRazonSocial}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 transition-all", !isClientEditing && "opacity-50 pointer-events-none")}>
                                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre</Label><Input value={formData.cliente?.nombreRazonSocial || ""} onChange={e => handleChange('cliente.nombreRazonSocial', e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2">RIF</Label><div className="flex gap-2"><Select value={formData.cliente?.prefijoRif || "J"} onValueChange={v => handleChange('cliente.prefijoRif', v)}><SelectTrigger className="w-20 h-12 bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_RIF.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Input value={formData.cliente?.numeroRif || ""} onChange={e => handleChange('cliente.numeroRif', e.target.value)} className="h-12 bg-slate-50 border-none flex-1 font-mono" /></div></div>
                                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Teléfono</Label><div className="flex gap-2"><Select value={formData.cliente?.prefijoTelefono || "0414"} onValueChange={v => handleChange('cliente.prefijoTelefono', v)}><SelectTrigger className="w-24 h-12 bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_TELEFONO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Input value={formData.cliente?.numeroTelefono || ""} onChange={e => handleChange('cliente.numeroTelefono', e.target.value)} className="h-12 bg-slate-50 border-none flex-1 font-mono" /></div></div>
                                                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Persona de Contacto</Label><Input value={formData.cliente?.personaContacto || ""} onChange={e => handleChange('cliente.personaContacto', e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none font-bold" /></div>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                                            <div className="flex items-center gap-3"><Calendar className="text-orange-500"/><h3 className="font-black text-sm uppercase text-slate-400">Entrega</h3></div>
                                            <Input type="date" value={formData.fechaEntrega || ""} onChange={e => handleChange('fechaEntrega', e.target.value)} className="h-14 rounded-2xl bg-orange-50 border-none text-xl font-black text-orange-600" />
                                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-dashed border-blue-200"><div className="flex justify-between items-center text-[10px] font-black uppercase text-blue-400"><span>Orden #</span><RefreshCcw className="w-3 h-3 cursor-pointer" onClick={fetchOrderNumber}/></div><p className="text-2xl font-black text-blue-700">#{formData.ordenNumero || "---"}</p></div>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-8">
                                        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                                            <div><h3 className="text-3xl font-black tracking-tighter uppercase">Detalle Taller</h3><p className="text-slate-500 font-bold">Agrega productos.</p></div>
                                            <Button onClick={() => { setEditingItemIndex(null); setIsItemModalOpen(true); }} className="rounded-2xl h-14 px-8 bg-blue-600 font-black text-lg gap-2 shadow-xl shadow-blue-500/20"><Plus className="w-6 h-6"/> Agregar Ítem</Button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {formData.items.map((item: any, idx: number) => (
                                                <motion.div key={idx} whileHover={{ x: 10 }} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/50 flex flex-col md:flex-row justify-between items-center gap-6">
                                                    <div className="flex items-center gap-5 flex-1">
                                                        <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                            {item.tipoServicio === 'IMPRESION' ? <Printer className="text-blue-500" /> : item.tipoServicio === 'CORTE' ? <Scissors className="text-orange-500" /> : <Palette className="text-purple-500" />}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-black text-lg uppercase leading-tight">{item.nombre}</h4>
                                                                {item.empleadoAsignado && item.empleadoAsignado !== "N/A" && (
                                                                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 text-[9px] font-black uppercase px-2 py-0 gap-1">
                                                                        <User className="w-2.5 h-2.5" /> {item.empleadoAsignado}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Badge variant="secondary" className="rounded-lg text-[9px] font-black uppercase">{item.cantidad} {item.unidad}</Badge>
                                                                {item.suministrarMaterial && <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[9px] font-black uppercase">Material Incluido</Badge>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Total</p><p className="text-2xl font-black text-blue-600">${(parseFloat(item.cantidad) * parseFloat(item.precioUnitario)).toFixed(2)}</p></div>
                                                        <div className="flex gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingItemIndex(idx); setIsItemModalOpen(true); }} className="rounded-xl hover:bg-blue-50 text-blue-500"><Pencil className="w-4 h-4"/></Button>
                                                            <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, items: formData.items.filter((_:any, i:number)=> i !== idx)})} className="rounded-xl hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4"/></Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                                            <h3 className="font-black text-sm uppercase text-slate-400">Resumen Final</h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between p-4 bg-slate-50 rounded-2xl"><span className="text-slate-500 font-bold uppercase text-xs">Cliente</span><span className="font-black">{formData.cliente?.nombreRazonSocial || "---"}</span></div>
                                                <div className="flex justify-between p-6 bg-blue-600 rounded-[2rem] text-white shadow-xl shadow-blue-500/30"><span className="font-black uppercase text-sm">Total Orden</span><span className="text-4xl font-black tracking-tighter">${currentTotal.toFixed(2)}</span></div>
                                            </div>
                                        </div>
                                        <div className="bg-yellow-50/50 p-8 rounded-[2.5rem] border border-yellow-200 flex flex-col">
                                            <h3 className="font-black text-sm uppercase text-yellow-600 mb-4">Notas de Producción</h3>
                                            <Textarea value={formData.descripcionDetallada || ""} onChange={e => handleChange('descripcionDetallada', e.target.value)} className="flex-1 min-h-[200px] bg-transparent border-none text-lg font-bold text-yellow-900 focus-visible:ring-0 resize-none" placeholder="Instrucciones..." />
                                        </div>
                                    </div>
                                )}
                                
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </ScrollArea>
            </div>

            <footer className="shrink-0 p-8 md:px-12 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 flex justify-between items-center">
                <Button variant="ghost" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} className="rounded-2xl h-14 px-8 font-black">
                    {step === 1 ? 'Cancelar' : 'Anterior'}
                </Button>
                <Button 
                    disabled={isLoading || (step === 1 && !isStep1Valid) || (step === 2 && formData.items.length === 0)}
                    onClick={() => step < 3 ? setStep(s => s + 1) : handleSaveOrder()}
                    className={cn("rounded-2xl h-14 px-12 font-black text-lg bg-blue-600 hover:bg-blue-700 shadow-xl transition-all", step === 3 && "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20")}
                >
                    {isLoading ? <Loader2 className="animate-spin w-6 h-6"/> : (step === 3 ? 'Finalizar Orden' : 'Siguiente')}
                </Button>
            </footer>

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