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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from 'sonner' 
import { cn } from "@/lib/utils"

import { 
    Plus, X, User, Receipt, 
    Users, Loader2, Pencil, Trash2, Save, 
    Palette, Scissors, Printer, Calendar, Box, ShoppingCart, 
    DollarSign, ChevronRight, CheckCircle2, Sparkles,
    Coins, RotateCcw
} from "lucide-react" 

import { ItemFormModal } from "@/components/orden/item-form-modal"
import { getLastOrderNumber } from "@/lib/firebase/ordenes" 
import { getFrequentClients, saveClient, deleteClient } from "@/lib/firebase/clientes" 
import { subscribeToColors, saveNewColor } from "@/lib/firebase/configuracion" 
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"

const PREFIJOS_RIF = ["V", "E", "P", "R", "J", "G"] as const;
const PREFIJOS_TELEFONO = ["0412", "0422", "0414", "0424", "0416", "0426"] as const;

const INITIAL_FORM_DATA = {
    ordenNumero: '', 
    fechaEntrega: new Date().toISOString().split('T')[0],
    cliente: { 
        nombreRazonSocial: "", tipoCliente: "REGULAR", rifCedula: "", telefono: "", 
        prefijoTelefono: "0414", numeroTelefono: "", prefijoRif: "V", numeroRif: "", 
        domicilioFiscal: "", correo: "", personaContacto: "" 
    },
    items: [],
    descripcionDetallada: "",
};

export const OrderFormWizardV2: React.FC<any> = ({ onCreate, onUpdate, onClose, initialData, currentUserId }) => {
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
        const unsubDesigners = subscribeToDesigners(setDesignersList);
        const unsubColors = subscribeToColors(setCustomColors);
        const load = async () => {
            const clients = await getFrequentClients();
            setFrequentClients(clients.map(c => ({
                id: c.id!, nombreRazonSocial: c.nombreRazonSocial, 
                tipoCliente: c.tipoCliente || "REGULAR", rifCedula: c.rifCedulaCompleto, 
                telefono: c.telefonoCompleto
            })));
            if (initialData) {
                const [prefRif, numRif] = (initialData.cliente?.rifCedula || "V-").split('-');
                const tel = initialData.cliente?.telefono || "";
                setFormData({ ...initialData, cliente: { ...initialData.cliente, prefijoRif: prefRif || "V", numeroRif: numRif || "", prefijoTelefono: tel.substring(0, 4) || "0414", numeroTelefono: tel.substring(4) || "" } });
                const existing = clients.find(c => c.rifCedulaCompleto === initialData.cliente?.rifCedula);
                if (existing) { setSelectedClientId(existing.id!); setIsClientEditing(false); }
            } else {
                const last = await getLastOrderNumber();
                setFormData(prev => ({ ...prev, ordenNumero: String(last + 1) }));
            }
        };
        load();
        return () => { unsubDesigners(); unsubColors(); };
    }, [initialData]);

    const getItemSubtotal = useCallback((item: any) => {
        if (item.totalAjustado !== undefined) return parseFloat(item.totalAjustado);

        const x = parseFloat(item.medidaXCm) || 0;
        const y = parseFloat(item.medidaYCm) || 0;
        const p = parseFloat(item.precioUnitario) || 0;
        const c = parseFloat(item.cantidad) || 0;
        const e = item.suministrarMaterial ? (parseFloat(item.costoMaterialExtra) || 0) : 0;
        
        return item.unidad === 'm2' 
            ? ((x / 100) * (y / 100) * p + e) * c 
            : (p + e) * c;
    }, []);

    const currentTotal = useMemo(() => {
        return formData.items.reduce((sum: number, item: any) => {
            return sum + getItemSubtotal(item);
        }, 0);
    }, [formData.items, getItemSubtotal]);

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        if (clientId === 'NEW') {
            setIsClientEditing(true);
            setFormData(p => ({ ...p, cliente: INITIAL_FORM_DATA.cliente }));
            return;
        }
        const c = frequentClients.find(client => client.id === clientId);
        if (c) {
            setIsClientEditing(false);
            const [pref, num] = (c.rifCedula || "V-").split('-');
            setFormData(prev => ({ ...prev, cliente: { ...prev.cliente, nombreRazonSocial: c.nombreRazonSocial, tipoCliente: c.tipoCliente, prefijoRif: pref || "V", numeroRif: num || "", prefijoTelefono: c.telefono?.substring(0, 4) || "0414", numeroTelefono: c.telefono?.substring(4) || "" } }));
        }
    };

    const handleSaveClientData = async () => {
        const { nombreRazonSocial, tipoCliente, numeroTelefono, prefijoTelefono, prefijoRif, numeroRif } = formData.cliente;
        if (!nombreRazonSocial) return toast.error("Nombre obligatorio");
        setIsLoading(true);
        try {
            const payload = { nombreRazonSocial, tipoCliente, telefonoCompleto: `${prefijoTelefono}${numeroTelefono}`, rifCedulaCompleto: `${prefijoRif}-${numeroRif}`, prefijoTelefono, numeroTelefono, prefijoRif, numeroRif };
            const id = await saveClient(payload, selectedClientId === 'NEW' ? undefined : selectedClientId);
            toast.success("Cliente sincronizado", { icon: <CheckCircle2 className="text-emerald-500" /> });
            setSelectedClientId(id);
            setIsClientEditing(false);
            const updated = await getFrequentClients();
            setFrequentClients(updated.map(c => ({ id: c.id, nombreRazonSocial: c.nombreRazonSocial, tipoCliente: c.tipoCliente, rifCedula: c.rifCedulaCompleto, telefono: c.telefonoCompleto })));
        } catch { toast.error("Error al sincronizar"); } finally { setIsLoading(false); }
    };

    const handleDeleteClient = async () => {
        if (selectedClientId === 'NEW') return;
        if (!confirm("¿Eliminar este cliente permanentemente?")) return;
        try {
            await deleteClient(selectedClientId);
            toast.success("Cliente eliminado");
            handleSelectClient('NEW');
            const updated = await getFrequentClients();
            setFrequentClients(updated.map(c => ({ id: c.id, nombreRazonSocial: c.nombreRazonSocial, tipoCliente: c.tipoCliente, rifCedula: c.rifCedulaCompleto, telefono: c.telefonoCompleto })));
        } catch { toast.error("Error al eliminar"); }
    };

    const handleChange = useCallback((path: string, value: any) => {
        setFormData(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let curr = next;
            for (let i = 0; i < keys.length - 1; i++) curr = curr[keys[i]];
            curr[keys[keys.length - 1]] = value;
            return next;
        });
    }, []);

    const handleAdjustItemPrice = (idx: number) => {
        const item = formData.items[idx];
        const currentSub = getItemSubtotal(item);
        
        if (item.totalAjustado !== undefined) {
            const next = [...formData.items];
            delete next[idx].totalAjustado;
            handleChange('items', next);
            toast.info("Precio vuelto al cálculo original");
            return;
        }

        const val = window.prompt(
            `Ajustar precio total para "${item.nombre}"\nMonto actual calculado: $${currentSub.toFixed(2)}`, 
            Math.max(1, Math.ceil(currentSub)).toString()
        );

        if (val !== null) {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                const next = [...formData.items];
                next[idx] = { ...item, totalAjustado: num };
                handleChange('items', next);
                toast.success("Precio ajustado manualmente");
            }
        }
    };

    const handleSaveOrder = async () => {
        if (!formData.cliente.nombreRazonSocial || formData.items.length === 0) return toast.error("Datos incompletos");
        setIsLoading(true);
        try {
            const { prefijoTelefono, numeroTelefono, prefijoRif, numeroRif, ...clienteRest } = formData.cliente;
            
            // --- CORRECCIÓN: Procesar subtotales de items antes de guardar ---
            const processedItems = formData.items.map((item: any) => ({
                ...item,
                subtotal: parseFloat(getItemSubtotal(item).toFixed(2))
            }));

            const finalPayload = { 
                ...formData, 
                items: processedItems, // Guardamos los items con su subtotal estático
                totalUSD: parseFloat(currentTotal.toFixed(2)), 
                userId: currentUserId, 
                updatedAt: new Date().toISOString(), 
                cliente: { 
                    ...clienteRest, 
                    telefono: `${prefijoTelefono}${numeroTelefono}`, 
                    rifCedula: `${prefijoRif}-${numeroRif}` 
                } 
            };

            if (initialData?.id) await onUpdate(initialData.id, finalPayload);
            else await onCreate(finalPayload);
            onClose();
        } catch { toast.error("Error al procesar"); } finally { setIsLoading(false); }
    };

    if (!formData) return null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full h-full bg-[#f8fafc] dark:bg-black flex flex-col overflow-hidden rounded-[2rem] border dark:border-white/5 shadow-2xl">
            <header className="h-14 shrink-0 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><ShoppingCart className="w-4 h-4" /></div>
                    <h2 className="text-sm font-black dark:text-white uppercase">Terminal de Ventas</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Nº Orden</p><p className="text-base font-black text-blue-600">#{formData.ordenNumero}</p></div>
                    <Button variant="ghost" onClick={onClose} className="rounded-full h-8 w-8 p-0 hover:bg-red-50 text-red-500"><X className="w-4 h-4" /></Button>
                </div>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                <section className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 border-r">
                    <div className="p-3 px-6 flex justify-between items-center border-b bg-slate-50/50">
                        <h3 className="font-black text-[9px] uppercase text-slate-500 tracking-widest flex items-center gap-2"><Box className="w-3.5 h-3.5" /> Items en Orden</h3>
                        <Button onClick={() => { setEditingItemIndex(null); setIsItemModalOpen(true); }} className="rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-[9px] h-7 px-4 shadow-md"><Plus className="w-3 h-3 mr-1" /> AÑADIR</Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-4 space-y-2 pb-10">
                            <AnimatePresence mode="popLayout">
                                {formData.items.length === 0 ? (
                                    <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-slate-300"><Sparkles className="w-8 h-8 mb-1 opacity-20" /><p className="text-[9px] font-black uppercase">Sin productos</p></div>
                                ) : (
                                    formData.items.map((item: any, idx: number) => (
                                        <motion.div key={idx} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", item.tipoServicio === 'IMPRESION' ? "bg-blue-50 text-blue-500" : "bg-orange-50 text-orange-500")}>{item.tipoServicio === 'IMPRESION' ? <Printer className="w-4 h-4" /> : <Scissors className="w-4 h-4" />}</div>
                                                <div>
                                                    <h4 className="font-black text-[11px] uppercase dark:text-white leading-none mb-1">{item.nombre}</h4>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{item.cantidad} {item.unidad} • {item.unidad === 'm2' ? `${item.medidaXCm}x${item.medidaYCm}cm` : `$${item.precioUnitario}`}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="text-sm font-black dark:text-white leading-none">${getItemSubtotal(item).toFixed(2)}</p>
                                                    {item.totalAjustado !== undefined && (
                                                        <span className="text-[7px] text-amber-500 font-black uppercase tracking-tighter">Ajustado</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={cn("h-7 w-7 rounded-md", item.totalAjustado !== undefined ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600")} 
                                                        onClick={() => handleAdjustItemPrice(idx)}
                                                        title="Redondear o ajustar precio"
                                                    >
                                                        {item.totalAjustado !== undefined ? <RotateCcw className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md bg-slate-50" onClick={() => { setEditingItemIndex(idx); setIsItemModalOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md bg-red-50 text-red-500" onClick={() => handleChange('items', formData.items.filter((_:any, i:number)=> i !== idx))}><Trash2 className="w-3 h-3" /></Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </ScrollArea>
                </section>

                <aside className="w-full lg:w-[350px] shrink-0 bg-[#f1f5f9] dark:bg-black border-l dark:border-slate-800 flex flex-col min-h-0">
                    <ScrollArea className="flex-1">
                        <div className="p-5 space-y-6">
                            <section className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">Datos del Cliente</Label>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500" onClick={() => setIsClientEditing(!isClientEditing)}><Pencil className="w-3 h-3"/></Button>
                                        {selectedClientId !== 'NEW' && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-500" onClick={handleDeleteClient}><Trash2 className="w-3 h-3"/></Button>}
                                    </div>
                                </div>
                                <Select onValueChange={handleSelectClient} value={selectedClientId}>
                                    <SelectTrigger className="h-10 rounded-lg border-none bg-white dark:bg-slate-900 px-4 text-[11px] font-bold"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="NEW" className="font-bold text-blue-600">✨ Venta Directa (Express)</SelectItem>
                                        {frequentClients.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-[11px] font-bold">
                                                <div className="flex justify-between w-full gap-2"><span>{c.nombreRazonSocial}</span>{c.tipoCliente === 'ALIADO' && <Badge className="h-3.5 bg-purple-100 text-purple-600 border-none text-[7px] uppercase">Aliado</Badge>}</div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className={cn("space-y-3", !isClientEditing && "opacity-60 pointer-events-none")}>
                                    <div className="space-y-1">
                                        <Label className="text-[8px] font-black text-slate-400 ml-1 uppercase">Razón Social / Nombre</Label>
                                        <Input value={formData.cliente.nombreRazonSocial} onChange={e => handleChange('cliente.nombreRazonSocial', e.target.value)} className="h-9 rounded-lg border-none bg-white dark:bg-slate-900 font-bold text-[11px]" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black text-slate-400 ml-1 uppercase">Identificación</Label>
                                            <div className="flex gap-1">
                                                <Select value={formData.cliente.prefijoRif} onValueChange={v => handleChange('cliente.prefijoRif', v)}><SelectTrigger className="w-12 h-9 border-none bg-white dark:bg-slate-900 font-bold text-[10px] px-1"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_RIF.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                                                <Input value={formData.cliente.numeroRif} onChange={e => handleChange('cliente.numeroRif', e.target.value)} className="h-9 border-none bg-white dark:bg-slate-900 font-bold text-[10px]" placeholder="000" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black text-slate-400 ml-1 uppercase">Teléfono</Label>
                                            <div className="flex gap-1">
                                                <Select value={formData.cliente.prefijoTelefono} onValueChange={v => handleChange('cliente.prefijoTelefono', v)}>
                                                    <SelectTrigger className="w-14 h-9 border-none bg-white dark:bg-slate-900 font-bold text-[10px] px-1"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="min-w-[5rem]">{PREFIJOS_TELEFONO.map(p => <SelectItem key={p} value={p} className="text-[10px] font-bold">{p}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Input value={formData.cliente.numeroTelefono} onChange={e => handleChange('cliente.numeroTelefono', e.target.value.replace(/\D/g, ''))} className="h-9 border-none bg-white dark:bg-slate-900 font-bold text-[10px] flex-1" placeholder="7 dígitos" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[8px] font-black text-slate-400 uppercase">Estatus:</Label>
                                        <Tabs value={formData.cliente.tipoCliente} onValueChange={v => handleChange('cliente.tipoCliente', v)} className="flex-1">
                                            <TabsList className="h-7 w-full p-0.5 bg-slate-200">
                                                <TabsTrigger value="REGULAR" className="text-[8px] font-black px-4 flex-1">REGULAR</TabsTrigger>
                                                <TabsTrigger value="ALIADO" className="text-[8px] font-black px-4 flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">ALIADO</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>
                                    <Button onClick={handleSaveClientData} className="w-full h-8 text-[8px] font-black uppercase text-blue-600 bg-white hover:bg-blue-50 border border-blue-50 rounded-lg gap-1.5"><Save className="w-3 h-3"/> Actualizar perfil en DB</Button>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-orange-400" /> Entrega Prometida</Label>
                                    <Input type="date" value={formData.fechaEntrega} onChange={e => handleChange('fechaEntrega', e.target.value)} className="h-9 rounded-lg border-none font-black text-orange-600 bg-orange-50/50 text-center text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-blue-400" /> Instrucciones</Label>
                                    <Textarea value={formData.descripcionDetallada} onChange={e => handleChange('descripcionDetallada', e.target.value)} className="rounded-lg border-none shadow-sm bg-white dark:bg-slate-900 resize-none h-20 text-[10px] font-bold p-3" placeholder="..." />
                                </div>
                            </section>
                        </div>
                    </ScrollArea>

                    <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 space-y-3 shrink-0">
                        <div className="flex justify-between items-center px-1">
                            <div><p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Subtotal Neto</p>{formData.cliente.tipoCliente === 'ALIADO' && <Badge className="bg-purple-600 text-[6px] h-3.5 px-1.5 font-black text-white uppercase">Tarifa Aliado</Badge>}</div>
                            <p className="text-2xl font-black tracking-tighter dark:text-white leading-none">${currentTotal.toFixed(2)}</p>
                        </div>
                        <Button disabled={isLoading} onClick={handleSaveOrder} className={cn("w-full h-11 rounded-xl text-white font-black text-[11px] shadow-lg transition-all", formData.cliente.tipoCliente === 'ALIADO' ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-900 dark:bg-blue-600")}>{isLoading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2 uppercase tracking-widest">Confirmar Orden <ChevronRight className="w-4 h-4" /></span>}</Button>
                    </div>
                </aside>
            </main>

            <ItemFormModal
                isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); setEditingItemIndex(null); }}
                onAddItem={(item: any) => { const next = [...formData.items]; if (editingItemIndex !== null) next[editingItemIndex] = item; else next.push(item); handleChange('items', next); setIsItemModalOpen(false); }}
                itemToEdit={editingItemIndex !== null ? formData.items[editingItemIndex] : undefined}
                tipoCliente={formData.cliente.tipoCliente} designers={designersList} customColors={customColors}
                onRegisterColor={(newColor: any) => saveNewColor(newColor)}
            />
        </motion.div>
    );
};