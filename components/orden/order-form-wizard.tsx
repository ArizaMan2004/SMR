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
    Users, Loader2, Pencil, Trash2, Save, 
    Palette, Scissors, Printer, Calendar, Box, ShoppingCart, DollarSign
} from "lucide-react" 

import { ItemFormModal } from "@/components/orden/item-form-modal"
import { getLastOrderNumber } from "@/lib/firebase/ordenes" 
import { getFrequentClients, saveClient, deleteClient } from "@/lib/firebase/clientes" 
import { subscribeToColors, saveNewColor } from "@/lib/firebase/configuracion" 
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"

// Utility to prevent Firebase errors with undefined values
const cleanFirebaseObject = (obj: any): any => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) delete newObj[key];
        else if (newObj[key] && typeof newObj[key] === 'object' && !Array.isArray(newObj[key])) {
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

const INITIAL_FORM_DATA = {
    ordenNumero: '', 
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: { 
        nombreRazonSocial: "", rifCedula: "", telefono: "", 
        prefijoTelefono: "0414", numeroTelefono: "", 
        prefijoRif: "V", numeroRif: "", 
        domicilioFiscal: "", correo: "", personaContacto: "" 
    },
    items: [],
    descripcionDetallada: "",
};

export const OrderFormWizardV2: React.FC<any> = ({ 
    onCreate, onUpdate, onClose, initialData, currentUserId 
}) => {
    const [formData, setFormData] = useState<any>(INITIAL_FORM_DATA);
    const [isLoading, setIsLoading] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [frequentClients, setFrequentClients] = useState<any[]>([]); 
    const [selectedClientId, setSelectedClientId] = useState<string>('NEW'); 
    const [isClientEditing, setIsClientEditing] = useState(true); 
    const [designersList, setDesignersList] = useState<Designer[]>([]);
    const [customColors, setCustomColors] = useState<any[]>([]);

    useEffect(() => {
        const unsubscribeDesigners = subscribeToDesigners(setDesignersList);
        const unsubscribeColors = subscribeToColors((colors) => setCustomColors(colors));

        const loadData = async () => {
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

                if (initialData) {
                    const [prefijoRif, numeroRif] = (initialData.cliente?.rifCedula || "V-").split('-');
                    const tel = initialData.cliente?.telefono || "";
                    setFormData({
                        ...initialData,
                        ordenNumero: String(initialData.ordenNumero),
                        cliente: { 
                            ...initialData.cliente, 
                            prefijoRif: prefijoRif || "V", 
                            numeroRif: numeroRif || "", 
                            prefijoTelefono: tel.substring(0, 4) || "0414", 
                            numeroTelefono: tel.substring(4) || ""
                        }
                    });
                    const existing = clients.find(c => c.rifCedulaCompleto === initialData.cliente?.rifCedula);
                    if (existing) { setSelectedClientId(existing.id!); setIsClientEditing(false); }
                    else { setSelectedClientId('CUSTOM'); setIsClientEditing(true); }
                } else {
                    fetchOrderNumber();
                }
            } catch (e) { console.error(e); }
        };

        loadData();
        return () => {
            unsubscribeDesigners();
            unsubscribeColors();
        };
    }, [initialData]);

    const fetchOrderNumber = async () => {
        const lastNumber = await getLastOrderNumber(); 
        setFormData((prev: any) => ({ ...prev, ordenNumero: String(lastNumber + 1) }));
    };

    // LÓGICA DE CÁLCULO TOTAL CORREGIDA
    const currentTotal = useMemo(() => {
        return formData.items.reduce((sum: number, item: any) => {
            const x = parseFloat(item.medidaXCm) || 0;
            const y = parseFloat(item.medidaYCm) || 0;
            const precioBase = parseFloat(item.precioUnitario) || 0;
            const cant = parseFloat(item.cantidad) || 0;
            const extra = item.suministrarMaterial ? (parseFloat(item.costoMaterialExtra) || 0) : 0;

            let subTotalItem = 0;
            if (item.unidad === 'm2' && x > 0 && y > 0) {
                // (Área en m2 * Precio Base m2 + Extra sustrato) * Cantidad
                subTotalItem = ((x / 100) * (y / 100) * precioBase + extra) * cant;
            } else {
                // (Precio Unitario + Extra sustrato) * Cantidad
                subTotalItem = (precioBase + extra) * cant;
            }
            return sum + subTotalItem;
        }, 0);
    }, [formData.items]);

    const handleSaveItem = (newItem: any) => {
        setFormData((prev: any) => {
            let newItems = [...prev.items];
            if (editingItemIndex !== null) newItems[editingItemIndex] = newItem;
            else newItems.push(newItem);
            return { ...prev, items: newItems };
        });
        setIsItemModalOpen(false);
    };

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        if (clientId === 'NEW' || clientId === 'CUSTOM') {
            setIsClientEditing(true);
            setFormData((p: any) => ({ ...p, cliente: INITIAL_FORM_DATA.cliente }));
            return;
        }
        const client = frequentClients.find(c => c.id === clientId);
        if (client) {
            setIsClientEditing(false);
            const [prefijoRif, numeroRif] = (client.rifCedula || "V-").split('-');
            setFormData((prev: any) => ({
                ...prev,
                cliente: {
                    ...prev.cliente,
                    nombreRazonSocial: client.nombreRazonSocial, 
                    correo: client.correo || "",
                    domicilioFiscal: client.domicilioFiscal || "", 
                    personaContacto: client.personaContacto || "",
                    prefijoRif: prefijoRif || "V", 
                    numeroRif: numeroRif || "", 
                    prefijoTelefono: client.telefono?.substring(0, 4) || "0414", 
                    numeroTelefono: client.telefono?.substring(4) || "",
                }
            }));
        }
    };

    const handleSaveClientData = async () => {
        const { nombreRazonSocial, numeroTelefono, prefijoTelefono, prefijoRif, numeroRif, domicilioFiscal, correo, personaContacto } = formData.cliente;
        if (!nombreRazonSocial?.trim()) return toast.error("Nombre es obligatorio");
        
        setIsLoading(true);
        try {
            const payload = {
                nombreRazonSocial, 
                telefonoCompleto: numeroTelefono ? `${prefijoTelefono}${numeroTelefono}` : "EXPRESS",
                rifCedulaCompleto: numeroRif ? `${prefijoRif}-${numeroRif}` : "EXPRESS", 
                prefijoTelefono, numeroTelefono, prefijoRif, numeroRif,
                domicilioFiscal, correo, personaContactoCliente: personaContacto
            };
            const idToSave = (selectedClientId === 'NEW' || selectedClientId === 'CUSTOM') ? undefined : selectedClientId;
            const newId = await saveClient(cleanFirebaseObject(payload), idToSave);
            toast.success("Cliente actualizado");
            setSelectedClientId(newId);
            setIsClientEditing(false);
            const updated = await getFrequentClients();
            setFrequentClients(updated.map(c => ({ id: c.id, nombreRazonSocial: c.nombreRazonSocial, rifCedula: c.rifCedulaCompleto, telefono: c.telefonoCompleto })));
        } catch { toast.error("Error al guardar cliente"); } finally { setIsLoading(false); }
    };

    const handleChange = useCallback((path: string, value: any) => {
        setFormData((prev: any) => {
            const newForm = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let current = newForm;
            for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
            current[keys[keys.length - 1]] = value;
            return newForm;
        });
    }, []);

    const handleSaveOrder = async () => {
        if (!formData.cliente.nombreRazonSocial) return toast.error("El nombre del cliente es obligatorio");
        if (formData.items.length === 0) return toast.error("La orden está vacía");
        
        setIsLoading(true);
        const { prefijoTelefono, numeroTelefono, prefijoRif, numeroRif, ...clienteRest } = formData.cliente;
        const finalRif = numeroRif.trim() === "" ? "EXPRESS" : `${prefijoRif}-${numeroRif}`;
        const finalTel = numeroTelefono.trim() === "" ? "EXPRESS" : `${prefijoTelefono}${numeroTelefono}`;

        const finalPayload = {
            ...formData,
            ordenNumero: parseInt(formData.ordenNumero, 10),
            cliente: { ...clienteRest, telefono: finalTel, rifCedula: finalRif },
            totalUSD: parseFloat(currentTotal.toFixed(2)),
            userId: currentUserId,
            updatedAt: new Date().toISOString()
        };

        try {
            const cleanPayload = cleanFirebaseObject(finalPayload);
            if (initialData?.id) await onUpdate(initialData.id, cleanPayload);
            else await onCreate(cleanPayload);
            toast.success("Orden procesada exitosamente");
            onClose();
        } catch (error) {
            toast.error("Error al procesar orden");
        } finally { setIsLoading(false); }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <header className="h-20 shrink-0 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-8 z-20">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight leading-none">Punto de Venta</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Terminal de Producción</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Orden Nº</p>
                        <p className="text-xl font-black text-blue-600 tracking-tighter">#{formData.ordenNumero}</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} className="rounded-full h-10 w-10 hover:bg-red-50 text-red-500"><X /></Button>
                </div>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* IZQUIERDA: LISTA DE ITEMS */}
                <section className="flex-1 flex flex-col bg-white dark:bg-slate-900/50 border-r">
                    <div className="p-6 flex justify-between items-center border-b bg-slate-50/50 dark:bg-transparent">
                        <h3 className="font-black text-xs uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Box className="w-4 h-4" /> Detalle de Producción
                        </h3>
                        <Button 
                            onClick={() => { setEditingItemIndex(null); setIsItemModalOpen(true); }} 
                            className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs h-10 px-6 shadow-md shadow-blue-500/10"
                        >
                            <Plus className="w-4 h-4 mr-2" /> AGREGAR ÍTEM
                        </Button>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-3 max-w-4xl mx-auto pb-10">
                            {formData.items.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] text-slate-300 border-slate-200">
                                    <Box className="w-12 h-12 mb-2 opacity-20" />
                                    <p className="font-black text-[10px] uppercase tracking-widest">Esperando productos...</p>
                                </div>
                            ) : (
                                formData.items.map((item: any, idx: number) => {
                                    // Cálculo individual para el Badge del ítem
                                    const x = parseFloat(item.medidaXCm) || 0;
                                    const y = parseFloat(item.medidaYCm) || 0;
                                    const p = parseFloat(item.precioUnitario) || 0;
                                    const c = parseFloat(item.cantidad) || 0;
                                    const e = item.suministrarMaterial ? (parseFloat(item.costoMaterialExtra) || 0) : 0;
                                    const sub = item.unidad === 'm2' ? ((x/100)*(y/100)*p + e)*c : (p+e)*c;

                                    return (
                                        <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200/60 flex items-center justify-between group hover:border-blue-300 transition-all shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 shadow-inner">
                                                    {item.tipoServicio === 'IMPRESION' ? <Printer className="w-5 h-5 text-blue-500" /> : <Scissors className="w-5 h-5 text-orange-500" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-sm uppercase text-slate-800 dark:text-white">{item.nombre}</h4>
                                                        {item.empleadoAsignado && item.empleadoAsignado !== "N/A" && (
                                                            <Badge variant="outline" className="text-[8px] font-black border-blue-200 text-blue-500">{item.empleadoAsignado}</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                        {item.cantidad} {item.unidad} 
                                                        {item.unidad === 'm2' && ` (${item.medidaXCm}x${item.medidaYCm}cm)`}
                                                        <span className="mx-2">•</span> 
                                                        ${item.precioUnitario} {item.unidad === 'm2' ? '/m²' : 'c/u'}
                                                        {item.suministrarMaterial && <span className="text-emerald-500 ml-1">+ Material</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-lg font-black text-blue-600 tracking-tight">
                                                        ${sub.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditingItemIndex(idx); setIsItemModalOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500" onClick={() => setFormData({...formData, items: formData.items.filter((_:any, i:number)=> i !== idx)})}><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })
                            )}
                        </div>
                    </ScrollArea>
                </section>

                {/* DERECHA: CLIENTE Y TOTAL */}
                <aside className="w-full lg:w-[420px] shrink-0 bg-slate-50 dark:bg-slate-900 border-l flex flex-col shadow-2xl z-10">
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8">
                            <section className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><Users className="w-3.5 h-3.5" /> Datos del Cliente</Label>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase" onClick={() => setIsClientEditing(!isClientEditing)}>
                                            {isClientEditing ? 'Bloquear' : 'Editar'}
                                        </Button>
                                        {isClientEditing && (
                                            <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black uppercase text-emerald-500" onClick={handleSaveClientData}>Guardar DB</Button>
                                        )}
                                    </div>
                                </div>

                                <Select onValueChange={handleSelectClient} value={selectedClientId}>
                                    <SelectTrigger className="h-12 rounded-xl border-none shadow-sm font-bold bg-white dark:bg-slate-800">
                                        <SelectValue placeholder="Seleccionar cliente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NEW" className="font-black text-blue-600">✨ VENTA RÁPIDA (EXPRESS)</SelectItem>
                                        {frequentClients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombreRazonSocial}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <div className={cn("space-y-4 transition-all", !isClientEditing && "opacity-50 pointer-events-none")}>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Nombre / Razón Social *</Label>
                                        <Input value={formData.cliente.nombreRazonSocial} onChange={e => handleChange('cliente.nombreRazonSocial', e.target.value)} className="h-11 rounded-xl border-none shadow-sm font-bold bg-white dark:bg-slate-800" placeholder="Indispensable" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">RIF / Cédula</Label>
                                            <div className="flex gap-1">
                                                <Select value={formData.cliente.prefijoRif} onValueChange={v => handleChange('cliente.prefijoRif', v)}>
                                                    <SelectTrigger className="w-16 h-11 border-none bg-white dark:bg-slate-800 font-bold rounded-xl text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{PREFIJOS_RIF.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Input value={formData.cliente.numeroRif} onChange={e => handleChange('cliente.numeroRif', e.target.value)} className="h-11 border-none bg-white dark:bg-slate-800 font-bold rounded-xl text-xs" placeholder="Número" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Teléfono</Label>
                                            <div className="flex gap-1">
                                                <Select value={formData.cliente.prefijoTelefono} onValueChange={v => handleChange('cliente.prefijoTelefono', v)}>
                                                    <SelectTrigger className="w-18 h-11 border-none bg-white dark:bg-slate-800 font-bold rounded-xl text-[10px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{PREFIJOS_TELEFONO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Input value={formData.cliente.numeroTelefono} onChange={e => handleChange('cliente.numeroTelefono', e.target.value)} className="h-11 border-none bg-white dark:bg-slate-800 font-bold rounded-xl text-xs" placeholder="7 dígitos" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><Calendar className="w-3.5 h-3.5" /> Planificación</Label>
                                <Input type="date" value={formData.fechaEntrega} onChange={e => handleChange('fechaEntrega', e.target.value)} className="h-12 rounded-xl border-none shadow-sm font-black text-orange-600 bg-orange-50 dark:bg-orange-950/30 text-center" />
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest"><Palette className="w-3.5 h-3.5" /> Instrucciones Especiales</Label>
                                <Textarea value={formData.descripcionDetallada} onChange={e => handleChange('descripcionDetallada', e.target.value)} className="rounded-2xl border-none shadow-sm bg-white dark:bg-slate-800 resize-none h-24 text-xs font-bold p-4" placeholder="Detalles de diseño, acabados..." />
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="p-8 bg-white dark:bg-slate-900 border-t space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Orden</span>
                            <span className="text-3xl font-black text-blue-600 tracking-tighter">${currentTotal.toFixed(2)}</span>
                        </div>
                        <Button 
                            disabled={isLoading} 
                            onClick={handleSaveOrder} 
                            className="w-full h-16 rounded-[1.8rem] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : 'CONFIRMAR Y GUARDAR'}
                        </Button>
                    </div>
                </aside>
            </main>

            <ItemFormModal
                isOpen={isItemModalOpen}
                onClose={() => { setIsItemModalOpen(false); setEditingItemIndex(null); }}
                onAddItem={handleSaveItem}
                itemToEdit={editingItemIndex !== null ? formData.items[editingItemIndex] : undefined}
                designers={designersList}
                customColors={customColors}
                onRegisterColor={(newColor: any) => saveNewColor(newColor)}
            />
        </div>
    )
}