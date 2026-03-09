// @/components/dashboard/tasks-view.tsx
"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore"

// UI Components
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// Icons
import { 
  ClipboardList, Plus, User, Phone, PenTool, 
  Ruler, Printer, Scissors, Eye,
  CheckCircle2, Clock, Trash2, Layers
} from "lucide-react"

import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };

const MATERIALES = ["Vinil", "Banner", "Micro", "Clear", "Stickers", "V. Corte", "DTF", "V. Textil", "Laser"]
const ADICIONALES = ["Refilado", "Bolsillos", "Laminado", "PVC", "Ojales", "Tubos", "Otros"]

// ✨ NUEVA ÁREA: PRODUCCIÓN
const AREAS_TALLER = [
    { id: "DISENO", label: "Diseño", icon: PenTool, color: "blue" },
    { id: "IMPRESION", label: "Impresión", icon: Printer, color: "purple" },
    { id: "CORTE_LASER", label: "Corte / Láser", icon: Scissors, color: "orange" },
    { id: "PRODUCCION", label: "Producción (Armado)", icon: Layers, color: "emerald" }, 
]

interface ServiceOrder {
    id?: string;
    cliente: string;
    telefono: string;
    responsable: string;
    fechaInicio: string;
    fechaEntrega: string;
    descripcion: string;
    materiales: string[];
    notaMaterial: string;
    medidas: { alto: string, ancho: string };
    adicionales: string[];
    observaciones: string;
    areaActual: string;
    estado: "PENDIENTE" | "COMPLETADO";
    creadoEn: string;
}

const emptyOrder: ServiceOrder = {
    cliente: "", telefono: "", responsable: "", fechaInicio: new Date().toISOString().split('T')[0], fechaEntrega: "",
    descripcion: "", materiales: [], notaMaterial: "", medidas: { alto: "", ancho: "" }, adicionales: [],
    observaciones: "", areaActual: "DISENO", estado: "PENDIENTE", creadoEn: new Date().toISOString()
}

export default function TasksView({ areaPriorizada }: { ordenes?: any, currentUserId?: string, areaPriorizada?: string }) {
    const { userData } = useAuth()
    const [ordenesServicio, setOrdenesServicio] = useState<ServiceOrder[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isReadOnly, setIsReadOnly] = useState(false) 
    const [formData, setFormData] = useState<ServiceOrder>(emptyOrder)
    const [activeTab, setActiveTab] = useState(areaPriorizada || "DISENO")
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "ordenes_servicio"), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceOrder))
            data.sort((a, b) => new Date(a.fechaEntrega || '2099').getTime() - new Date(b.fechaEntrega || '2099').getTime());
            setOrdenesServicio(data);
            setIsLoading(false);
        })
        return () => unsub();
    }, [])

    // ✨ REDIRECCIÓN MÁGICA A SU PESTAÑA
    useEffect(() => {
        if (userData?.rol === 'DISENADOR') setActiveTab("DISENO");
        else if (userData?.rol === 'IMPRESOR') setActiveTab("IMPRESION"); 
        else if (userData?.rol === 'OPERADOR_LASER') setActiveTab("CORTE_LASER"); 
        else if (userData?.rol === 'PRODUCCION') setActiveTab("PRODUCCION"); 
        else if (areaPriorizada) setActiveTab(areaPriorizada);
    }, [userData, areaPriorizada])

    const handleCheckToggle = (field: 'materiales' | 'adicionales', value: string) => {
        if (isReadOnly) return; 
        setFormData(prev => {
            const current = prev[field];
            if (current.includes(value)) return { ...prev, [field]: current.filter(item => item !== value) }
            return { ...prev, [field]: [...current, value] }
        })
    }

    const handleSaveOrder = async () => {
        if (isReadOnly) return; 
        if (!formData.cliente || !formData.descripcion) {
            toast.error("El cliente y la descripción son obligatorios");
            return;
        }

        try {
            toast.loading("Guardando Orden de Trabajo...");
            if (formData.id) {
                const { id, ...dataToUpdate } = formData;
                await updateDoc(doc(db, "ordenes_servicio", id), dataToUpdate);
                toast.success("Orden actualizada");
            } else {
                await addDoc(collection(db, "ordenes_servicio"), { ...formData, creadoEn: new Date().toISOString() });
                toast.success("Nueva orden enviada al taller");
            }
            setIsModalOpen(false);
            setFormData(emptyOrder);
            toast.dismiss();
        } catch (error) {
            toast.error("Error al guardar la orden");
        }
    }

    const handleMoveArea = async (id: string, newArea: string) => {
        try {
            await updateDoc(doc(db, "ordenes_servicio", id), { areaActual: newArea, estado: "PENDIENTE" });
            toast.success(`Orden movida a ${AREAS_TALLER.find(a => a.id === newArea)?.label}`);
        } catch (error) { toast.error("Error al mover"); }
    }

    const handleComplete = async (id: string) => {
        try {
            await updateDoc(doc(db, "ordenes_servicio", id), { estado: "COMPLETADO" });
            toast.success("Trabajo marcado como finalizado");
        } catch (error) { toast.error("Error al completar"); }
    }

    const handleDelete = async (id: string) => {
        if(!confirm("¿Eliminar esta orden de trabajo definitivamente?")) return;
        try {
            await deleteDoc(doc(db, "ordenes_servicio", id));
            toast.success("Orden eliminada");
        } catch (error) { toast.error("Error al eliminar"); }
    }

    const isAdmin = userData?.rol === 'ADMIN';

    // ✨ ASIGNACIÓN DE VISTAS POR ROL
    const visibleAreas = useMemo(() => {
        if (isAdmin || userData?.rol === 'VENDEDOR') return AREAS_TALLER; 
        
        switch(userData?.rol) {
            case 'DISENADOR': return AREAS_TALLER.filter(a => a.id === 'DISENO');
            case 'IMPRESOR': return AREAS_TALLER.filter(a => a.id === 'IMPRESION');
            case 'OPERADOR_LASER': return AREAS_TALLER.filter(a => a.id === 'CORTE_LASER');
            case 'PRODUCCION': return AREAS_TALLER.filter(a => a.id === 'PRODUCCION');
            default: return []; 
        }
    }, [userData, isAdmin]);

    const activeOrders = ordenesServicio.filter(o => o.estado === "PENDIENTE" && o.areaActual === activeTab);
    const completedOrders = ordenesServicio.filter(o => o.estado === "COMPLETADO");

    return (
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-black/5 shadow-sm">
                <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                        <ClipboardList className="w-8 h-8 text-blue-600" /> Taller de Producción
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Control Digital de Órdenes de Trabajo SMR
                    </p>
                </div>
                
                {/* SOLO EL ADMIN PUEDE CREAR ÓRDENES DE TRABAJO FÍSICAS */}
                {isAdmin && (
                    <Button 
                        onClick={() => { setFormData(emptyOrder); setIsReadOnly(false); setIsModalOpen(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 w-full md:w-auto"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Crear Orden de Trabajo
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl flex flex-wrap h-auto w-full md:w-fit gap-2">
                    {visibleAreas.map(area => {
                        const count = ordenesServicio.filter(o => o.estado === "PENDIENTE" && o.areaActual === area.id).length;
                        return (
                            <TabsTrigger 
                                key={area.id} 
                                value={area.id} 
                                className="rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm flex items-center gap-2"
                            >
                                <area.icon className="w-4 h-4" /> {area.label}
                                {count > 0 && <Badge className="ml-1 bg-red-500 text-white border-0 px-1.5 py-0 text-[9px]">{count}</Badge>}
                            </TabsTrigger>
                        )
                    })}
                    {(isAdmin || userData?.rol === 'VENDEDOR') && (
                        <TabsTrigger value="COMPLETADOS" className="rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">
                            <CheckCircle2 className="w-4 h-4 mr-2 inline-block"/> Finalizados
                        </TabsTrigger>
                    )}
                </TabsList>

                {visibleAreas.map(area => (
                    <TabsContent key={area.id} value={area.id} className="mt-0 focus-visible:outline-none">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            <AnimatePresence>
                                {activeOrders.map(orden => (
                                    <OrderCard 
                                        key={orden.id} 
                                        orden={orden} 
                                        onView={() => { setFormData(orden); setIsReadOnly(true); setIsModalOpen(true); }}
                                        onEdit={() => { setFormData(orden); setIsReadOnly(false); setIsModalOpen(true); }}
                                        onMove={(newArea) => handleMoveArea(orden.id!, newArea)}
                                        onComplete={() => handleComplete(orden.id!)}
                                        onDelete={() => handleDelete(orden.id!)}
                                        isAdmin={isAdmin}
                                    />
                                ))}
                            </AnimatePresence>
                            {activeOrders.length === 0 && (
                                <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-40">
                                    <area.icon className="w-20 h-20 mb-4" />
                                    <p className="text-xl font-black uppercase italic">Área Despejada</p>
                                    <p className="text-xs font-bold uppercase tracking-widest">No hay trabajos pendientes en {area.label}</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                ))}

                <TabsContent value="COMPLETADOS" className="mt-0 focus-visible:outline-none">
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-70 grayscale-[0.3]">
                        {completedOrders.map(orden => (
                            <OrderCard 
                                key={orden.id} 
                                orden={orden} 
                                onView={() => { setFormData(orden); setIsReadOnly(true); setIsModalOpen(true); }}
                                onEdit={() => { setFormData(orden); setIsReadOnly(false); setIsModalOpen(true); }}
                                onMove={(newArea) => handleMoveArea(orden.id!, newArea)} 
                                onComplete={() => {}}
                                onDelete={() => handleDelete(orden.id!)}
                                isAdmin={isAdmin}
                                isCompleted={true}
                            />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#1c1c1e] rounded-[2rem] border-0 shadow-2xl p-0">
                    
                    <DialogTitle className="sr-only">Formulario de Orden de Trabajo</DialogTitle>

                    <div className="bg-slate-900 text-white p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 z-20">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><ClipboardList className="w-8 h-8" /></div>
                            <div>
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter">SMR Laser Print</h2>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                                    {isReadOnly ? "Orden de Trabajo (Solo Lectura)" : "Orden de Trabajo Oficial"}
                                </p>
                            </div>
                        </div>
                        
                        <div className="w-full md:w-64 space-y-2">
                            <Label className="text-[10px] font-black uppercase text-white/60 ml-1">Enviar a Área Inicial:</Label>
                            <select 
                                value={formData.areaActual}
                                onChange={(e) => setFormData({...formData, areaActual: e.target.value})}
                                disabled={isReadOnly}
                                className={cn("w-full h-12 bg-white/10 border-none rounded-xl text-white font-bold px-4 outline-none cursor-pointer", isReadOnly && "opacity-70 pointer-events-none")}
                            >
                                {AREAS_TALLER.map(a => <option key={a.id} value={a.id} className="text-black">{a.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-8">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cliente</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input readOnly={isReadOnly} value={formData.cliente} onChange={e=>setFormData({...formData, cliente: e.target.value})} className={cn("pl-10 h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-none font-bold", isReadOnly && "pointer-events-none opacity-80")} placeholder="Nombre del cliente" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Teléfono</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input readOnly={isReadOnly} value={formData.telefono} onChange={e=>setFormData({...formData, telefono: e.target.value})} className={cn("pl-10 h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-none font-bold", isReadOnly && "pointer-events-none opacity-80")} placeholder="Número de contacto" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fechas (Inicio - Entrega)</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="date" disabled={isReadOnly} value={formData.fechaInicio} onChange={e=>setFormData({...formData, fechaInicio: e.target.value})} className={cn("h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-none font-bold text-xs", isReadOnly && "pointer-events-none opacity-80")} />
                                    <span className="text-slate-300">-</span>
                                    <Input type="date" disabled={isReadOnly} value={formData.fechaEntrega} onChange={e=>setFormData({...formData, fechaEntrega: e.target.value})} className={cn("h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-none font-bold text-xs", isReadOnly && "pointer-events-none opacity-80")} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable / Vendedor</Label>
                                <Input readOnly={isReadOnly} value={formData.responsable} onChange={e=>setFormData({...formData, responsable: e.target.value})} className={cn("h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-none font-bold", isReadOnly && "pointer-events-none opacity-80")} placeholder="Quién recibe la orden" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-3 py-1 rounded-md">Descripción del Trabajo</Label>
                            <Textarea 
                                readOnly={isReadOnly}
                                value={formData.descripcion} 
                                onChange={e=>setFormData({...formData, descripcion: e.target.value})} 
                                className={cn("min-h-[120px] rounded-2xl bg-slate-50 dark:bg-black/20 border-none font-medium p-4 text-base resize-none", isReadOnly && "pointer-events-none opacity-80")} 
                                placeholder="Ej: 1. Sticker 500 de Doctora Store redondo 4cm..." 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-[#1c1c1e] shadow-sm">
                                <p className="text-center font-black uppercase text-xs tracking-widest border-b border-black/10 pb-2 mb-4">Tipo de Material</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {MATERIALES.map(mat => (
                                        <div key={mat} className={cn("flex items-center space-x-2", isReadOnly && "opacity-80 pointer-events-none")}>
                                            <Checkbox disabled={isReadOnly} id={`mat-${mat}`} checked={formData.materiales.includes(mat)} onCheckedChange={() => handleCheckToggle('materiales', mat)} />
                                            <label htmlFor={`mat-${mat}`} className="text-[11px] font-bold cursor-pointer uppercase">{mat}</label>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-3 border-t border-black/5">
                                    <Label className="text-[9px] font-black uppercase text-slate-400">Nota Especial Material</Label>
                                    <Input readOnly={isReadOnly} value={formData.notaMaterial} onChange={e=>setFormData({...formData, notaMaterial: e.target.value})} className={cn("h-8 text-xs mt-1 bg-slate-50 border-none", isReadOnly && "pointer-events-none opacity-80")} />
                                </div>
                            </div>

                            <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                                <Ruler className="absolute w-32 h-32 text-slate-100 dark:text-white/5 rotate-45 -right-10 -bottom-10" />
                                <p className="text-center font-black uppercase text-xs tracking-widest bg-slate-900 text-white px-4 py-1 rounded-full mb-6 z-10">Medidas</p>
                                
                                <div className="flex items-center justify-center gap-4 w-full z-10">
                                    <div className="text-center">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Alto (↕)</Label>
                                        <Input readOnly={isReadOnly} value={formData.medidas.alto} onChange={e=>setFormData({...formData, medidas: {...formData.medidas, alto: e.target.value}})} className={cn("w-20 text-center font-black text-lg h-12 mt-1 border-slate-300", isReadOnly && "pointer-events-none opacity-80")} placeholder="cm" />
                                    </div>
                                    <div className="text-2xl font-black text-slate-300 mt-5">X</div>
                                    <div className="text-center">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">Ancho (↔)</Label>
                                        <Input readOnly={isReadOnly} value={formData.medidas.ancho} onChange={e=>setFormData({...formData, medidas: {...formData.medidas, ancho: e.target.value}})} className={cn("w-20 text-center font-black text-lg h-12 mt-1 border-slate-300", isReadOnly && "pointer-events-none opacity-80")} placeholder="cm" />
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-200 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-[#1c1c1e] shadow-sm">
                                <p className="text-center font-black uppercase text-xs tracking-widest border-b border-black/10 pb-2 mb-4">Adicionales</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {ADICIONALES.map(adi => (
                                        <div key={adi} className={cn("flex items-center space-x-2", isReadOnly && "opacity-80 pointer-events-none")}>
                                            <Checkbox disabled={isReadOnly} id={`adi-${adi}`} checked={formData.adicionales.includes(adi)} onCheckedChange={() => handleCheckToggle('adicionales', adi)} />
                                            <label htmlFor={`adi-${adi}`} className="text-[11px] font-bold cursor-pointer uppercase">{adi}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observaciones Generales</Label>
                            <Input 
                                readOnly={isReadOnly}
                                value={formData.observaciones} 
                                onChange={e=>setFormData({...formData, observaciones: e.target.value})} 
                                className={cn("h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-b-2 border-slate-300 font-medium", isReadOnly && "pointer-events-none opacity-80")} 
                                placeholder="Notas adicionales para el equipo..." 
                            />
                        </div>

                    </div>

                    <DialogFooter className="bg-slate-50 dark:bg-black/40 p-6 md:p-8 flex items-center justify-between border-t border-black/5 rounded-b-[2rem]">
                        <p className="text-[8px] font-black uppercase text-slate-400 max-w-[200px] leading-tight">
                            {isReadOnly ? "Estás en modo visualización." : "Nota: Cada responsable debe remitir la orden al siguiente proceso."}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest h-12">
                                {isReadOnly ? "Cerrar Visualización" : "Cancelar"}
                            </Button>
                            {!isReadOnly && (
                                <Button onClick={handleSaveOrder} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest h-12 px-8 shadow-lg shadow-emerald-500/20">
                                    Guardar Ticket
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}

function OrderCard({ orden, onView, onEdit, onMove, onComplete, onDelete, isAdmin, isCompleted = false }: any) {
    
    const areaColor = AREAS_TALLER.find(a => a.id === orden.areaActual)?.color || "slate";
    const colors: any = { 
        blue: "bg-blue-500 text-white shadow-blue-500/30", 
        purple: "bg-purple-500 text-white shadow-purple-500/30", 
        orange: "bg-orange-500 text-white shadow-orange-500/30",
        emerald: "bg-emerald-500 text-white shadow-emerald-500/30",
        slate: "bg-slate-500 text-white shadow-slate-500/30"
    };

    return (
        <Card className="rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col bg-white dark:bg-[#1c1c1e]">
            <div className="p-5 flex justify-between items-start border-b border-black/5 bg-slate-50/50 dark:bg-white/5">
                <div>
                    <h3 className="font-black text-lg uppercase italic leading-tight text-slate-900 dark:text-white truncate max-w-[200px]">{orden.cliente}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                        <Clock size={10} /> Entrega: {orden.fechaEntrega ? new Date(orden.fechaEntrega).toLocaleDateString() : "Sin fecha"}
                    </p>
                </div>
                <Badge className={cn("rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest border-0 shadow-sm shrink-0", colors[areaColor])}>
                    {AREAS_TALLER.find(a => a.id === orden.areaActual)?.label || "Taller"}
                </Badge>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-black/5 pb-3">
                    <span className="flex items-center gap-1 truncate" title={`Resp: ${orden.responsable}`}>
                        <User size={12} className="shrink-0"/> Resp: {orden.responsable || "N/A"}
                    </span>
                    <span className="flex items-center gap-1 truncate" title={orden.telefono}>
                        <Phone size={12} className="shrink-0"/> {orden.telefono || "Sin Tlf"}
                    </span>
                </div>

                <div className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap leading-snug">
                    {orden.descripcion}
                </div>

                {(orden.observaciones || orden.notaMaterial) && (
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-500/20 line-clamp-2">
                        <span className="font-black uppercase text-[9px] block mb-0.5 tracking-widest opacity-70">Aviso / Notas:</span>
                        {orden.notaMaterial && <span className="block italic">- Mat: {orden.notaMaterial}</span>}
                        {orden.observaciones && <span className="block italic">- {orden.observaciones}</span>}
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                    {orden.medidas?.alto && orden.medidas?.ancho && (
                        <span className="text-[9px] font-black bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md flex items-center gap-1 border border-black/5"><Ruler size={10}/> {orden.medidas.alto}x{orden.medidas.ancho} cm</span>
                    )}
                    {orden.materiales?.map((m: string) => (
                        <span key={m} className="text-[9px] font-black bg-blue-50 dark:bg-blue-500/10 text-blue-600 px-2 py-1 rounded-md uppercase border border-blue-500/10">{m}</span>
                    ))}
                    {orden.adicionales?.map((a: string) => (
                        <span key={a} className="text-[9px] font-black bg-purple-50 dark:bg-purple-500/10 text-purple-600 px-2 py-1 rounded-md uppercase border border-purple-500/10">{a}</span>
                    ))}
                </div>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-black/20 border-t border-black/5 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={onView} className="h-9 w-9 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Ver Detalles Completos">
                        <Eye className="w-4 h-4" />
                    </Button>

                    {isAdmin && (
                        <>
                            <Button variant="ghost" size="icon" onClick={onEdit} className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Editar Ticket (Admin)">
                                <PenTool className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onDelete} className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50" title="Eliminar (Admin)">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    )}
                </div>

                {!isCompleted && (
                    <div className="flex gap-1">
                        <select 
                            onChange={(e) => { if(e.target.value !== "") onMove(e.target.value); e.target.value = ""; }}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase text-slate-500 rounded-xl px-2 h-9 outline-none cursor-pointer hover:bg-slate-50 transition-colors max-w-[100px]"
                        >
                            <option value="">Pasar a...</option>
                            {AREAS_TALLER.filter(a => a.id !== orden.areaActual).map(a => (
                                <option key={a.id} value={a.id}>{a.label}</option>
                            ))}
                        </select>
                        
                        <Button onClick={onComplete} className="h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[9px] tracking-widest px-3 shadow-md shadow-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4" />
                        </Button>
                    </div>
                )}
                {isCompleted && (
                    <div className="flex-1 flex justify-end">
                        <Badge className="bg-emerald-100 text-emerald-600 border-0 font-black uppercase text-[9px] tracking-widest px-3 py-1.5 flex gap-1 items-center">
                            <CheckCircle2 size={12} /> Finalizado
                        </Badge>
                    </div>
                )}
            </div>
        </Card>
    )
}