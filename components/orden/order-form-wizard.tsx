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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { toast } from 'sonner' 
import { cn } from "@/lib/utils"

// ÍCONOS - SE INCLUYE 'Layers' PARA EVITAR EL REFERENCE ERROR Y 'Wand2' PARA EL REDONDEO
import { 
    Plus, X, User, Receipt, 
    Users, Loader2, Pencil, Trash2, Save, 
    Palette, Scissors, Printer, Calendar, Box, ShoppingCart, 
    DollarSign, ChevronRight, CheckCircle2, Sparkles,
    Coins, RotateCcw, Clock, Search, Building2, Layers, Wand2
} from "lucide-react" 

import { ItemFormModal } from "@/components/orden/item-form-modal"
import { getNextSafeOrderNumber } from "@/lib/services/ordenes-service" 
import { getFrequentClients, saveClient, deleteClient } from "@/lib/firebase/clientes" 
import { subscribeToColors, saveNewColor } from "@/lib/firebase/configuracion" 
import { subscribeToDesigners, type Designer } from "@/lib/services/designers-service"

const PREFIJOS_RIF = ["V", "E", "P", "R", "J", "G"] as const;
const PREFIJOS_TELEFONO = ["0412", "0422", "0414", "0424", "0416", "0426"] as const;

const formatForDateTimeInput = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
};

const INITIAL_FORM_DATA = {
    ordenNumero: '', 
    fecha: new Date().toISOString(), 
    fechaEntrega: new Date().toISOString().split('T')[0],
    isMaster: false,
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
    const [targetSubCliente, setTargetSubCliente] = useState<string>("");
    const [frequentClients, setFrequentClients] = useState<any[]>([]); 
    const [selectedClientId, setSelectedClientId] = useState<string>('NEW'); 
    const [isClientEditing, setIsClientEditing] = useState(true); 
    const [designersList, setDesignersList] = useState<Designer[]>([]);
    const [customColors, setCustomColors] = useState<any[]>([]);
    
    const [clientSearchTerm, setClientSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [shouldRoundTotal, setShouldRoundTotal] = useState(false);

    // Estados para la edición de precio manual (override)
    const [editingPriceIndex, setEditingPriceIndex] = useState<number | null>(null);
    const [tempPrice, setTempPrice] = useState<string>("");

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
                
                setFormData({ 
                    ...initialData, 
                    isMaster: initialData.isMaster || false,
                    fecha: initialData.fecha || new Date().toISOString(),
                    cliente: { ...initialData.cliente, prefijoRif: prefRif || "V", numeroRif: numRif || "", prefijoTelefono: tel.substring(0, 4) || "0414", numeroTelefono: tel.substring(4) || "" } 
                });
                
                const existing = clients.find(c => c.rifCedulaCompleto === initialData.cliente?.rifCedula);
                if (existing) { 
                    setSelectedClientId(existing.id!); 
                    setIsClientEditing(false); 
                    setClientSearchTerm(existing.nombreRazonSocial);
                } else if (initialData.cliente?.nombreRazonSocial) {
                    setClientSearchTerm(initialData.cliente.nombreRazonSocial);
                }
            } else {
                const safeNum = await getNextSafeOrderNumber();
                setFormData(prev => ({ ...prev, ordenNumero: String(safeNum) }));
            }
        };
        load();
        return () => { unsubDesigners(); unsubColors(); };
    }, [initialData]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, any[]> = {};
        formData.items.forEach((item: any, index: number) => {
            const sc = item.subCliente || "General";
            if (!groups[sc]) groups[sc] = [];
            groups[sc].push({ ...item, originalIndex: index });
        });
        return groups;
    }, [formData.items]);

    const filteredClients = useMemo(() => {
        if (!clientSearchTerm.trim()) return frequentClients;
        const lowerTerm = clientSearchTerm.toLowerCase();
        return frequentClients.filter(c => 
            (c.nombreRazonSocial && c.nombreRazonSocial.toLowerCase().includes(lowerTerm)) ||
            (c.rifCedula && c.rifCedula.toLowerCase().includes(lowerTerm)) ||
            (c.telefono && c.telefono.toLowerCase().includes(lowerTerm))
        );
    }, [frequentClients, clientSearchTerm]);

    const getItemSubtotal = useCallback((item: any) => {
        if (item.totalAjustado !== undefined) return parseFloat(item.totalAjustado);
        const x = parseFloat(item.medidaXCm) || 0;
        const y = parseFloat(item.medidaYCm) || 0;
        const p = parseFloat(item.precioUnitario) || 0;
        const c = parseFloat(item.cantidad) || 0;
        const e = item.suministrarMaterial ? (parseFloat(item.costoMaterialExtra) || 0) : 0;
        
        if (item.unidad === 'm2' && x > 0 && y > 0) {
            let costoBaseUnitario = (x / 100) * (y / 100) * p;
            if (item.tipoServicio === 'IMPRESION') {
                if (item.impresionLaminado) {
                    const pLin = parseFloat(item.precioLaminadoLineal) || 0;
                    const pMan = parseFloat(item.precioLaminadoManual) || 0;
                    if (item.tipoCobroLaminado === 'x' && pLin > 0) costoBaseUnitario += (x / 100) * pLin;
                    else if (item.tipoCobroLaminado === 'y' && pLin > 0) costoBaseUnitario += (y / 100) * pLin;
                    else if (item.tipoCobroLaminado === 'manual' && pMan > 0) costoBaseUnitario += pMan;
                }
                if (item.impresionPegado && item.proveedorPegado === 'taller' && item.precioPegado > 0) {
                    costoBaseUnitario += parseFloat(item.precioPegado) || 0;
                }
            }
            return (costoBaseUnitario + e) * c;
        }
        return (p + e) * c;
    }, []);

    const currentTotal = useMemo(() => {
        const sum = formData.items.reduce((sum: number, item: any) => sum + getItemSubtotal(item), 0);
        return shouldRoundTotal ? Math.ceil(sum) : sum;
    }, [formData.items, getItemSubtotal, shouldRoundTotal]);

    const addNewGroup = () => {
        const nombre = window.prompt("Nombre del Sub-Cliente / Sucursal:");
        if (nombre && nombre.trim()) {
            if (!groupedItems[nombre]) {
                setTargetSubCliente(nombre.trim());
                setIsItemModalOpen(true);
            }
        }
    };

    const handleSelectClient = (clientId: string) => {
        setSelectedClientId(clientId);
        setIsDropdownOpen(false); 
        if (clientId === 'NEW') {
            setIsClientEditing(true); setClientSearchTerm("");
            setFormData(p => ({ ...p, cliente: INITIAL_FORM_DATA.cliente }));
            return;
        }
        const c = frequentClients.find(client => client.id === clientId);
        if (c) {
            setIsClientEditing(false); setClientSearchTerm(c.nombreRazonSocial);
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

    const handleSaveOrder = async () => {
        if (!formData.cliente.nombreRazonSocial || formData.items.length === 0) return toast.error("Datos incompletos");
        setIsLoading(true);
        try {
            const { prefijoTelefono, numeroTelefono, prefijoRif, numeroRif, ...clienteRest } = formData.cliente;
            const processedItems = formData.items.map((item: any) => ({
                ...item, subtotal: parseFloat(getItemSubtotal(item).toFixed(2))
            }));
            const finalPayload = { 
                ...formData, items: processedItems, totalUSD: parseFloat(currentTotal.toFixed(2)), 
                userId: currentUserId, updatedAt: new Date().toISOString(), 
                cliente: { ...clienteRest, telefono: `${prefijoTelefono}${numeroTelefono}`, rifCedula: `${prefijoRif}-${numeroRif}` } 
            };
            if (initialData?.id) await onUpdate(initialData.id, finalPayload);
            else await onCreate(finalPayload);
            onClose();
        } catch { toast.error("Error al procesar"); } finally { setIsLoading(false); }
    };

    // Funciones para manejar el ajuste manual de precios (Override)
    const handleSavePriceOverride = (index: number) => {
        const val = parseFloat(tempPrice);
        const nextItems = [...formData.items];
        if (!isNaN(val) && val >= 0) {
            nextItems[index].totalAjustado = val;
        } else {
            delete nextItems[index].totalAjustado;
        }
        handleChange('items', nextItems);
        setEditingPriceIndex(null);
    };

    const handleRemovePriceOverride = (index: number) => {
        const nextItems = [...formData.items];
        delete nextItems[index].totalAjustado;
        handleChange('items', nextItems);
    };

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
                    <div className="p-4 px-6 flex justify-between items-center border-b bg-slate-50/50">
                        <h3 className="font-black text-[10px] uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Layers className="w-4 h-4" /> Estructura de la Orden
                        </h3>
                        {formData.isMaster && (
                            <Button onClick={addNewGroup} variant="outline" className="rounded-xl border-indigo-200 text-indigo-600 font-bold text-[9px] h-8 gap-2">
                                <Building2 className="w-3 h-3" /> AGREGAR SECCIÓN
                            </Button>
                        )}
                        {!formData.isMaster && (
                            <Button onClick={() => { setTargetSubCliente("General"); setIsItemModalOpen(true); }} className="rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-[9px] h-7 px-4 shadow-md"><Plus className="w-3 h-3 mr-1" /> AÑADIR</Button>
                        )}
                    </div>
                    
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-8 pb-20">
                            {Object.entries(groupedItems).map(([subC, items]) => (
                                <div key={subC} className="space-y-3">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("h-2 w-2 rounded-full", formData.isMaster ? "bg-indigo-500" : "bg-blue-500")} />
                                            <span className="font-black text-xs uppercase tracking-tighter text-slate-700 dark:text-slate-300">
                                                {subC === "General" && !formData.isMaster ? "Ítems de Producción" : `Sucursal: ${subC}`}
                                            </span>
                                        </div>
                                        {formData.isMaster && (
                                            <Button variant="ghost" size="sm" onClick={() => { setTargetSubCliente(subC); setEditingItemIndex(null); setIsItemModalOpen(true); }} className="h-7 text-[9px] font-black text-blue-600 hover:bg-blue-50 gap-1"><Plus className="w-3 h-3" /> AÑADIR A ESTA SECCIÓN</Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {items.map((item: any) => (
                                            <div key={item.originalIndex} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between group shadow-sm transition-all hover:shadow-md">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("p-2 rounded-xl", item.tipoServicio === 'IMPRESION' ? "bg-blue-50 text-blue-500" : "bg-orange-50 text-orange-500")}>
                                                        {item.tipoServicio === 'IMPRESION' ? <Printer size={16}/> : <Scissors size={16}/>}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-xs uppercase text-slate-800 dark:text-white leading-none">{item.nombre}</h4>
                                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{item.cantidad} {item.unidad} • {item.unidad === 'm2' ? `${item.medidaXCm}x${item.medidaYCm}cm` : `$${item.precioUnitario}`}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {/* Interfaz de Visualización / Edición de Precio */}
                                                    {editingPriceIndex === item.originalIndex ? (
                                                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-blue-200 dark:border-blue-900">
                                                            <Input
                                                                autoFocus
                                                                type="number"
                                                                className="h-8 w-20 text-right font-black text-sm border-none focus-visible:ring-0 bg-transparent"
                                                                value={tempPrice}
                                                                onChange={(e) => setTempPrice(e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && handleSavePriceOverride(item.originalIndex)}
                                                            />
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900" onClick={() => handleSavePriceOverride(item.originalIndex)}>
                                                                <CheckCircle2 size={16} />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-100 dark:hover:bg-red-900" onClick={() => setEditingPriceIndex(null)}>
                                                                <X size={16} />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className={cn(
                                                            "flex items-center gap-1 px-3 py-1.5 rounded-xl border shadow-sm",
                                                            item.totalAjustado !== undefined 
                                                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-500" 
                                                                : "border-slate-100 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                                                        )}>
                                                            {item.totalAjustado !== undefined && <Wand2 className="w-3 h-3" />}
                                                            <span className="font-black text-sm">${getItemSubtotal(item).toFixed(2)}</span>
                                                        </div>
                                                    )}

                                                    {/* Menú de Acciones (Hover) */}
                                                    {editingPriceIndex !== item.originalIndex && (
                                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-900/30" 
                                                                onClick={() => {
                                                                    setTempPrice(getItemSubtotal(item).toString());
                                                                    setEditingPriceIndex(item.originalIndex);
                                                                }}
                                                                title="Ajustar precio de este ítem"
                                                            >
                                                                <DollarSign size={16}/>
                                                            </Button>

                                                            {item.totalAjustado !== undefined && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30" 
                                                                    onClick={() => handleRemovePriceOverride(item.originalIndex)}
                                                                    title="Restaurar precio calculado"
                                                                >
                                                                    <RotateCcw size={14}/>
                                                                </Button>
                                                            )}

                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30" onClick={() => { setTargetSubCliente(subC); setEditingItemIndex(item.originalIndex); setIsItemModalOpen(true); }}>
                                                                <Pencil size={14}/>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => handleChange('items', formData.items.filter((_:any, i:number) => i !== item.originalIndex))}>
                                                                <Trash2 size={14}/>
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {formData.isMaster && items.length > 0 && (
                                        <div className="flex justify-end px-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subtotal Sección: <span className="text-slate-900 dark:text-white ml-2">${items.reduce((s, i) => s + getItemSubtotal(i), 0).toFixed(2)}</span></p></div>
                                    )}
                                </div>
                            ))}

                            {formData.items.length === 0 && (
                                <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300"><Sparkles className="w-10 h-10 mb-2 opacity-20" /><p className="text-xs font-black uppercase tracking-widest">Inicia la configuración de la orden</p></div>
                            )}
                        </div>
                    </ScrollArea>
                </section>

                <aside className="w-full lg:w-[350px] shrink-0 bg-[#f1f5f9] dark:bg-black border-l flex flex-col min-h-0">
                    <ScrollArea className="flex-1">
                        <div className="p-5 space-y-6">
                            <section className="space-y-3 relative">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">Entidad Cliente</Label>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500" onClick={() => setIsClientEditing(!isClientEditing)}><Pencil className="w-3 h-3"/></Button>
                                        {selectedClientId !== 'NEW' && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-500" onClick={handleDeleteClient}><Trash2 className="w-3 h-3"/></Button>}
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => handleChange('isMaster', !formData.isMaster)} className={cn("w-full h-8 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all mb-2", formData.isMaster ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-400")}>
                                    <Building2 className="w-3 h-3 mr-2"/> {formData.isMaster ? "Modo Matriz: Activo" : "Activar Modo Matriz"}
                                </Button>
                                <div className="relative z-50">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                                    <Input placeholder="Buscar en base de datos..." value={clientSearchTerm} onChange={(e) => { setClientSearchTerm(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)} className={cn("h-10 pl-9 text-[11px] bg-white dark:bg-slate-900 border-none shadow-sm font-bold transition-all", isDropdownOpen ? "rounded-t-xl" : "rounded-xl")} />
                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 border border-t-0 shadow-xl rounded-b-xl overflow-hidden max-h-60 overflow-y-auto">
                                                <div className="p-1"><div onClick={() => handleSelectClient('NEW')} className="px-3 py-2 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer">✨ Crear Nueva Identidad</div>{filteredClients.map(c => (<div key={c.id} onClick={() => handleSelectClient(c.id)} className="flex justify-between items-center px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"><span className="truncate">{c.nombreRazonSocial}</span>{c.tipoCliente === 'ALIADO' && <Badge className="h-3.5 bg-purple-100 text-purple-600 border-none text-[7px] uppercase">Aliado</Badge>}</div>))}</div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className={cn("space-y-3 pt-2", !isClientEditing && "opacity-60 pointer-events-none")}>
                                    <div className="space-y-1"><Label className="text-[8px] font-black text-slate-400 ml-1 uppercase">Nombre / Razón Social</Label><Input value={formData.cliente.nombreRazonSocial} onChange={e => handleChange('cliente.nombreRazonSocial', e.target.value)} className="h-9 rounded-lg border-none bg-white dark:bg-slate-900 font-bold text-[11px]" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1"><Label className="text-[8px] font-black text-slate-400 ml-1 uppercase">Identificación</Label><div className="flex gap-1"><Select value={formData.cliente.prefijoRif} onValueChange={v => handleChange('cliente.prefijoRif', v)}><SelectTrigger className="w-12 h-9 border-none bg-white font-bold text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_RIF.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Input value={formData.cliente.numeroRif} onChange={e => handleChange('cliente.numeroRif', e.target.value)} className="h-9 border-none bg-white font-bold text-[10px]" placeholder="000" /></div></div>
                                        <div className="space-y-1"><Label className="text-[8px] font-black text-slate-400 ml-1 uppercase">Teléfono</Label><div className="flex gap-1"><Select value={formData.cliente.prefijoTelefono} onValueChange={v => handleChange('cliente.prefijoTelefono', v)}><SelectTrigger className="w-14 h-9 border-none bg-white font-bold text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{PREFIJOS_TELEFONO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Input value={formData.cliente.numeroTelefono} onChange={e => handleChange('cliente.numeroTelefono', e.target.value.replace(/\D/g, ''))} className="h-9 border-none bg-white font-bold text-[10px] flex-1" placeholder="7 dígitos" /></div></div>
                                    </div>
                                    <div className="flex items-center gap-2"><Label className="text-[8px] font-black text-slate-400 uppercase">Tarifa:</Label><Tabs value={formData.cliente.tipoCliente} onValueChange={v => handleChange('cliente.tipoCliente', v)} className="flex-1"><TabsList className="h-7 w-full bg-slate-200"><TabsTrigger value="REGULAR" className="text-[8px] font-black flex-1">REGULAR</TabsTrigger><TabsTrigger value="ALIADO" className="text-[8px] font-black flex-1 data-[state=active]:bg-purple-600">ALIADO</TabsTrigger></TabsList></Tabs></div>
                                    <Button onClick={handleSaveClientData} className="w-full h-8 text-[8px] font-black uppercase text-blue-600 bg-white border border-blue-50 rounded-lg"><Save className="w-3 h-3 mr-1"/> Guardar Cliente</Button>
                                </div>
                            </section>

                            <section className="space-y-4 pt-4 border-t">
                                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-blue-500" /> Emisión</Label><Input type="datetime-local" value={formatForDateTimeInput(formData.fecha)} onChange={e => handleChange('fecha', new Date(e.target.value).toISOString())} className="h-9 rounded-lg border-none font-bold text-blue-600 bg-blue-50/50 text-xs" /></div>
                                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-orange-400" /> Entrega</Label><Input type="date" value={formData.fechaEntrega} onChange={e => handleChange('fechaEntrega', e.target.value)} className="h-9 rounded-lg border-none font-black text-orange-600 bg-orange-50/50 text-xs" /></div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-blue-400" /> Instrucciones</Label>
                                    <Textarea value={formData.descripcionDetallada} onChange={e => handleChange('descripcionDetallada', e.target.value)} className="rounded-lg border-none shadow-sm bg-white dark:bg-slate-900 resize-none h-20 text-[10px] font-bold p-3" placeholder="..." />
                                </div>
                            </section>
                        </div>
                    </ScrollArea>

                    <div className="p-4 bg-white dark:bg-slate-900 border-t space-y-3 shrink-0">
                        <div className="flex justify-between items-end px-1 pb-1">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Monto de la Factura</p>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => setShouldRoundTotal(!shouldRoundTotal)} 
                                        className={cn("h-4 w-4 rounded p-0 transition-colors", shouldRoundTotal ? "bg-amber-100 text-amber-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-500")}
                                        title="Redondear Total"
                                    >
                                        <Wand2 className="w-2.5 h-2.5" />
                                    </Button>
                                </div>
                                {formData.cliente.tipoCliente === 'ALIADO' && <Badge className="bg-purple-600 text-[6px] h-3.5 px-1.5 font-black text-white uppercase">Socio Estratégico</Badge>}
                            </div>
                            <p className="text-2xl font-black tracking-tighter leading-none text-slate-900 dark:text-white">${currentTotal.toFixed(2)}</p>
                        </div>
                        <Button disabled={isLoading} onClick={handleSaveOrder} className={cn("w-full h-11 rounded-xl text-white font-black text-[11px] shadow-lg transition-all", formData.cliente.tipoCliente === 'ALIADO' ? "bg-purple-600" : "bg-slate-900 dark:bg-blue-600")}>{isLoading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2 uppercase tracking-widest">Generar Orden <ChevronRight className="w-4 h-4" /></span>}</Button>
                    </div>
                </aside>
            </main>

            <ItemFormModal
                isOpen={isItemModalOpen} 
                onClose={() => { setIsItemModalOpen(false); setEditingItemIndex(null); }}
                onAddItem={(item: any) => { 
                    const next = [...formData.items]; 
                    const itemConSub = { ...item, subCliente: targetSubCliente || item.subCliente };
                    if (editingItemIndex !== null) next[editingItemIndex] = itemConSub; 
                    else next.push(itemConSub); 
                    handleChange('items', next); 
                    setIsItemModalOpen(false); 
                }}
                itemToEdit={editingItemIndex !== null ? formData.items[editingItemIndex] : undefined}
                tipoCliente={formData.cliente.tipoCliente} designers={designersList} customColors={customColors}
                onRegisterColor={(newColor: any) => saveNewColor(newColor)}
                isMaster={formData.isMaster}
            />
        </motion.div>
    );
};