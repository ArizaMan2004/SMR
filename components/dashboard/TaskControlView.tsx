// @/components/dashboard/TaskControlView.tsx
"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, where, orderBy, doc, addDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
    CheckCircle2, Clock, XCircle, Search, Plus, 
    Scissors, PenTool, Wrench, Layers, DollarSign, 
    Percent, Activity, FileCheck, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskControlViewProps {
    currentUser: any; // { uid, rol, nombre... }
    empleadosDb: any[]; // La lista de empleados de firebase para vincular las comisiones
}

export function TaskControlView({ currentUser, empleadosDb }: TaskControlViewProps) {
    const isAdmin = ['ADMIN', 'PRODUCCION'].includes(currentUser?.rol);
    
    // Buscar el documento del empleado actual (si es un empleado)
    const currentEmpleadoDoc = empleadosDb.find(e => e.usuarioId === currentUser?.uid);

    const [tareas, setTareas] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    
    // --- ESTADOS DE UI ---
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any | null>(null);

    // --- FORMULARIO DE EMPLEADO ---
    const [taskForm, setTaskForm] = useState({
        nombre: "",
        tipo: "SERVICIO",
        tiempoMinutos: "",
        cantidad: "1",
        medidas: "",
        formato: "N/A"
    });

    // --- FORMULARIO DE ADMIN (VALORACIÓN) ---
    const [reviewForm, setReviewForm] = useState({
        valorBaseUSD: "",
        porcentajeComision: ""
    });

    // ==========================================
    // FETCH DE TAREAS
    // ==========================================
    useEffect(() => {
        if (!currentUser?.uid) return;

        let q;
        const tareasRef = collection(db, "empleado_tareas");

        if (isAdmin) {
            // El admin ve todo (ordenado por fecha)
            q = query(tareasRef, orderBy("fechaRegistro", "desc"));
        } else {
            // El empleado solo ve lo suyo
            q = query(tareasRef, where("usuarioId", "==", currentUser.uid), orderBy("fechaRegistro", "desc"));
        }

        const unsub = onSnapshot(q, (snap) => {
            setTareas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => unsub();
    }, [currentUser, isAdmin]);

    // ==========================================
    // ACCIONES DE EMPLEADO
    // ==========================================
    const handleRegistrarTarea = async () => {
        if (!taskForm.nombre.trim()) {
            toast.error("El nombre de la tarea es obligatorio");
            return;
        }

        // Buscamos el perfil del empleado aquí mismo para asegurar los datos
        const empleadoActual = empleadosDb.find(e => e.usuarioId === currentUser?.uid);
        
        if (!isAdmin && !empleadoActual) {
            toast.error("No encontramos tu perfil de empleado. Contacta al Admin.");
            return;
        }

        try {
            toast.loading("Registrando tarea...");
            await addDoc(collection(db, "empleado_tareas"), {
                usuarioId: currentUser.uid,
                // Usamos el ID del empleado encontrado, o 'ADMIN' si es administrador
                empleadoDbId: empleadoActual?.id || "ADMIN_ID", 
                nombreEmpleado: empleadoActual?.nombre || currentUser.nombre || "Admin",
                nombreTarea: taskForm.nombre,
                tipoTarea: taskForm.tipo,
                estado: "PENDIENTE",
                detalles: {
                    tiempoMinutos: taskForm.tiempoMinutos || null,
                    cantidad: taskForm.cantidad || null,
                    medidas: taskForm.medidas || null,
                    formato: taskForm.formato || null,
                },
                fechaRegistro: serverTimestamp(),
                valorBaseUSD: 0,
                montoComision: 0
            });
            
            toast.dismiss();
            toast.success("Tarea registrada correctamente");
            setIsRegisterModalOpen(false);
            setTaskForm({ nombre: "", tipo: "SERVICIO", tiempoMinutos: "", cantidad: "1", medidas: "", formato: "N/A" });
        } catch (error) {
            console.error("Error al guardar:", error);
            toast.dismiss();
            toast.error("Error al conectar con la base de datos");
        }
    };

    // ==========================================
    // ACCIONES DE ADMIN
    // ==========================================
    const handleAprobarTarea = async () => {
        const valor = parseFloat(reviewForm.valorBaseUSD);
        const porcentaje = parseFloat(reviewForm.porcentajeComision);

        if (isNaN(valor) || isNaN(porcentaje)) {
            toast.error("Ingresa valores numéricos válidos");
            return;
        }

        const montoGanado = (valor * porcentaje) / 100;

        try {
            toast.loading("Aprobando y asignando comisión...");
            
            // 1. Actualizamos la tarea
            await updateDoc(doc(db, "empleado_tareas", selectedTask.id), {
                estado: "APROBADA",
                valorBaseUSD: valor,
                porcentajeAsignado: porcentaje,
                montoComision: montoGanado,
                fechaAprobacion: serverTimestamp(),
                aprobadoPor: currentUser.nombre
            });

            // 2. MAGIA DEL ECOSISTEMA: Inyectamos la comisión en el perfil de nómina del empleado
            if (selectedTask.empleadoDbId && selectedTask.empleadoDbId !== "ADMIN_MOCK") {
                await updateDoc(doc(db, "empleados", selectedTask.empleadoDbId), {
                    comisiones: arrayUnion({
                        id: selectedTask.id,
                        monto: montoGanado,
                        desc: `Tarea: ${selectedTask.nombreTarea}`
                    })
                });
            }

            toast.dismiss();
            toast.success(`Comisión de $${montoGanado.toFixed(2)} asignada exitosamente`);
            setIsReviewModalOpen(false);
            setSelectedTask(null);
            setReviewForm({ valorBaseUSD: "", porcentajeComision: "" });
        } catch (error) {
            toast.dismiss();
            toast.error("Error al procesar la aprobación");
        }
    };

    const handleRechazarTarea = async (tareaId: string) => {
        if (!confirm("¿Estás seguro de rechazar esta tarea? No generará comisión.")) return;
        try {
            await updateDoc(doc(db, "empleado_tareas", tareaId), {
                estado: "RECHAZADA",
                fechaAprobacion: serverTimestamp()
            });
            toast.success("Tarea rechazada");
        } catch (error) {
            toast.error("Error al rechazar");
        }
    };

    // ==========================================
    // FILTROS Y ESTADÍSTICAS
    // ==========================================
    const tareasFiltradas = useMemo(() => {
        return tareas.filter(t => 
            t.nombreTarea.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.nombreEmpleado.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [tareas, searchTerm]);

    const pendientesCount = tareas.filter(t => t.estado === 'PENDIENTE').length;
    const comisionesTotales = tareas.filter(t => t.estado === 'APROBADA').reduce((acc, t) => acc + (t.montoComision || 0), 0);

    const getTaskIcon = (tipo: string) => {
        switch(tipo) {
            case 'CORTE_LASER': return <Wrench className="w-5 h-5 text-orange-500" />;
            case 'DISENO': return <PenTool className="w-5 h-5 text-indigo-500" />;
            default: return <Scissors className="w-5 h-5 text-emerald-500" />;
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto font-sans">
            
            {/* HEADER Y KPIS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter dark:text-white flex items-center gap-3">
                        <Layers className="w-10 h-10 text-blue-600" /> 
                        {isAdmin ? "Auditoría de Tareas" : "Mis Tareas"}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {isAdmin ? "Control de producción y asignación de comisiones" : "Registra tu trabajo para calcular tus bonos"}
                    </p>
                </div>
                
                {!isAdmin && (
                    <Button 
                        onClick={() => setIsRegisterModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-14 rounded-2xl px-8 font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Registrar Trabajo
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="rounded-[2.5rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm p-6 flex items-center gap-5">
                    <div className="p-4 bg-amber-100 dark:bg-amber-500/10 text-amber-600 rounded-[1.5rem] shrink-0">
                        <Clock className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendientes de Revisión</p>
                        <p className="text-4xl font-black italic tracking-tighter">{pendientesCount}</p>
                    </div>
                </Card>
                <Card className="rounded-[2.5rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm p-6 flex items-center gap-5">
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 rounded-[1.5rem] shrink-0">
                        <DollarSign className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {isAdmin ? "Comisiones Otorgadas" : "Comisiones Ganadas"}
                        </p>
                        <p className="text-4xl font-black italic tracking-tighter text-emerald-600">${comisionesTotales.toFixed(2)}</p>
                    </div>
                </Card>
            </div>

            {/* BUSCADOR */}
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                    placeholder={isAdmin ? "Buscar por empleado o tarea..." : "Buscar en mi historial..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-16 pl-14 rounded-[2rem] bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 font-bold shadow-sm dark:text-white"
                />
            </div>

            {/* LISTA DE TAREAS */}
            <Tabs defaultValue={isAdmin ? "pendientes" : "todas"} className="w-full">
                <TabsList className="bg-slate-200/50 dark:bg-white/5 p-1.5 rounded-2xl mb-6">
                    {isAdmin && (
                        <TabsTrigger value="pendientes" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <Activity className="w-4 h-4 mr-2 inline-block"/> Requieren Acción
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="todas" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                        <FileCheck className="w-4 h-4 mr-2 inline-block"/> Historial Completo
                    </TabsTrigger>
                </TabsList>

                {["pendientes", "todas"].map(tabMode => (
                    <TabsContent key={tabMode} value={tabMode} className="mt-0 space-y-4">
                        <AnimatePresence>
                            {tareasFiltradas.filter(t => tabMode === 'pendientes' ? t.estado === 'PENDIENTE' : true).map((tarea) => (
                                <motion.div 
                                    key={tarea.id}
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-white dark:bg-[#1c1c1e] p-5 md:p-6 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:shadow-md transition-all"
                                >
                                    <div className="flex gap-5 items-center">
                                        <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 shrink-0">
                                            {getTaskIcon(tarea.tipoTarea)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-black text-lg md:text-xl uppercase italic dark:text-white leading-none">{tarea.nombreTarea}</h3>
                                                {tarea.estado === 'PENDIENTE' && <Badge className="bg-amber-100 text-amber-600 border-none text-[8px] uppercase font-black">Pendiente</Badge>}
                                                {tarea.estado === 'APROBADA' && <Badge className="bg-emerald-100 text-emerald-600 border-none text-[8px] uppercase font-black">Aprobada</Badge>}
                                                {tarea.estado === 'RECHAZADA' && <Badge className="bg-red-100 text-red-600 border-none text-[8px] uppercase font-black">Rechazada</Badge>}
                                            </div>
                                            
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {isAdmin ? `Realizado por: ${tarea.nombreEmpleado} • ` : ''} 
                                                {new Date(tarea.fechaRegistro?.toDate?.() || Date.now()).toLocaleDateString('es-VE')}
                                            </p>
                                            
                                            {/* ETIQUETAS DE DETALLE (Dependen del tipo) */}
                                            <div className="flex gap-2 mt-3 flex-wrap">
                                                {tarea.detalles.cantidad && <span className="text-[9px] bg-slate-100 dark:bg-white/5 font-black px-2 py-1 rounded-md uppercase text-slate-500">Cant: {tarea.detalles.cantidad}</span>}
                                                {tarea.detalles.tiempoMinutos && <span className="text-[9px] bg-orange-50 dark:bg-orange-500/10 font-black px-2 py-1 rounded-md uppercase text-orange-600">Tiempo: {tarea.detalles.tiempoMinutos} min</span>}
                                                {tarea.detalles.medidas && <span className="text-[9px] bg-blue-50 dark:bg-blue-500/10 font-black px-2 py-1 rounded-md uppercase text-blue-600">Medidas: {tarea.detalles.medidas}</span>}
                                                {tarea.detalles.formato && tarea.detalles.formato !== 'N/A' && <span className="text-[9px] bg-indigo-50 dark:bg-indigo-500/10 font-black px-2 py-1 rounded-md uppercase text-indigo-600">Formato: {tarea.detalles.formato}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-black/5 pt-4 md:pt-0">
                                        {tarea.estado === 'APROBADA' && (
                                            <div className="text-right">
                                                <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest mb-1">Comisión</p>
                                                <p className="text-2xl font-black text-emerald-600 italic leading-none">+${tarea.montoComision.toFixed(2)}</p>
                                            </div>
                                        )}

                                        {tarea.estado === 'PENDIENTE' && isAdmin && (
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <Button 
                                                    variant="outline" size="icon" 
                                                    onClick={() => handleRechazarTarea(tarea.id)}
                                                    className="rounded-xl border-red-200 text-red-500 hover:bg-red-50 shrink-0" title="Rechazar"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </Button>
                                                <Button 
                                                    onClick={() => { setSelectedTask(tarea); setIsReviewModalOpen(true); }}
                                                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg flex-1 md:flex-none"
                                                >
                                                    Valorar Trabajo
                                                </Button>
                                            </div>
                                        )}

                                        {tarea.estado === 'PENDIENTE' && !isAdmin && (
                                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest italic animate-pulse">En Revisión...</p>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {tareasFiltradas.length === 0 && (
                                <div className="text-center py-20 opacity-50">
                                    <Layers className="w-12 h-12 mx-auto mb-4" />
                                    <p className="font-bold uppercase tracking-widest text-xs">No se encontraron tareas</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </TabsContent>
                ))}
            </Tabs>

            {/* =======================================================
                MODAL 1: REGISTRAR TAREA (VISTA EMPLEADO)
            ======================================================= */}
            <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Registrar Trabajo</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documenta tu tarea para cálculo de bono</p>
                    </DialogHeader>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">¿Qué realizaste?</Label>
                            <Input 
                                placeholder="Ej. Corte de letras en MDF 3mm" 
                                value={taskForm.nombre} onChange={e => setTaskForm({...taskForm, nombre: e.target.value})}
                                className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Tarea</Label>
                            <Select value={taskForm.tipo} onValueChange={(v) => setTaskForm({...taskForm, tipo: v, cantidad: "1", tiempoMinutos: "", medidas: ""})}>
                                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold uppercase text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    <SelectItem value="SERVICIO" className="font-bold text-xs uppercase">Servicio Manual / Armado</SelectItem>
                                    <SelectItem value="CORTE_LASER" className="font-bold text-xs uppercase">Corte Láser / Router</SelectItem>
                                    <SelectItem value="DISENO" className="font-bold text-xs uppercase">Diseño Gráfico / Vectorización</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* CAMPOS DINÁMICOS SEGÚN EL TIPO DE TAREA */}
                        <div className="grid grid-cols-2 gap-4">
                            {taskForm.tipo === 'CORTE_LASER' && (
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[10px] font-black uppercase text-orange-500 ml-2">Tiempo de Máquina (Minutos)</Label>
                                    <Input 
                                        type="number" placeholder="Ej. 45" 
                                        value={taskForm.tiempoMinutos} onChange={e => setTaskForm({...taskForm, tiempoMinutos: e.target.value})}
                                        className="h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border-none font-black text-orange-700 dark:text-orange-400"
                                    />
                                </div>
                            )}

                            {taskForm.tipo === 'DISENO' && (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-indigo-500 ml-2">Medidas (Opcional)</Label>
                                        <Input 
                                            placeholder="Ej. 120x80cm" 
                                            value={taskForm.medidas} onChange={e => setTaskForm({...taskForm, medidas: e.target.value})}
                                            className="h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border-none font-bold text-indigo-700 dark:text-indigo-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-indigo-500 ml-2">Formato</Label>
                                        <Select value={taskForm.formato} onValueChange={(v) => setTaskForm({...taskForm, formato: v})}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border-none font-bold uppercase text-[10px] text-indigo-700 dark:text-indigo-400">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="VECTOR" className="font-bold text-xs uppercase">Vector (.AI/.CDR)</SelectItem>
                                                <SelectItem value="IMAGEN" className="font-bold text-xs uppercase">Imagen (JPG/PNG)</SelectItem>
                                                <SelectItem value="N/A" className="font-bold text-xs uppercase">N/A</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}

                            {(taskForm.tipo === 'SERVICIO' || taskForm.tipo === 'DISENO') && (
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cantidad Realizada</Label>
                                    <Input 
                                        type="number" min="1" 
                                        value={taskForm.cantidad} onChange={e => setTaskForm({...taskForm, cantidad: e.target.value})}
                                        className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black text-center"
                                    />
                                </div>
                            )}
                        </div>

                        <Button 
                            onClick={handleRegistrarTarea}
                            className="w-full h-16 rounded-[2rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl mt-4 transition-transform active:scale-95"
                        >
                            <Check className="w-5 h-5 mr-2" /> Enviar Tarea
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* =======================================================
                MODAL 2: VALORAR TAREA (VISTA ADMIN)
            ======================================================= */}
            <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Valorar Tarea</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Calculadora de comisión para {selectedTask?.nombreEmpleado}</p>
                    </DialogHeader>

                    {selectedTask && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-black/5">
                                <p className="font-black italic uppercase text-lg leading-tight mb-2">{selectedTask.nombreTarea}</p>
                                <div className="flex gap-2 flex-wrap">
                                    <Badge className="bg-blue-100 text-blue-600 text-[8px] uppercase border-none">{selectedTask.tipoTarea}</Badge>
                                    {selectedTask.detalles.cantidad && <Badge variant="outline" className="text-[8px] uppercase border-black/10">Cant: {selectedTask.detalles.cantidad}</Badge>}
                                    {selectedTask.detalles.tiempoMinutos && <Badge variant="outline" className="text-[8px] uppercase border-black/10 text-orange-600">{selectedTask.detalles.tiempoMinutos} min</Badge>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor Base ($)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input 
                                            type="number" placeholder="0.00"
                                            value={reviewForm.valorBaseUSD} onChange={e => setReviewForm({...reviewForm, valorBaseUSD: e.target.value})}
                                            className="h-14 pl-10 rounded-2xl bg-white dark:bg-black/20 font-black text-lg border-black/10 dark:border-white/10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Comisión (%)</Label>
                                    <div className="relative">
                                        <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                        <Input 
                                            type="number" placeholder="Ej. 10"
                                            value={reviewForm.porcentajeComision} onChange={e => setReviewForm({...reviewForm, porcentajeComision: e.target.value})}
                                            className="h-14 pr-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border-none font-black text-lg text-emerald-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* PREVISUALIZADOR DEL CÁLCULO */}
                            {parseFloat(reviewForm.valorBaseUSD) > 0 && parseFloat(reviewForm.porcentajeComision) > 0 && (
                                <div className="bg-emerald-500 text-white p-5 rounded-[2rem] text-center shadow-lg shadow-emerald-500/20 scale-105 transition-transform">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">El empleado ganará:</p>
                                    <p className="text-4xl font-black italic tracking-tighter">
                                        +${((parseFloat(reviewForm.valorBaseUSD) * parseFloat(reviewForm.porcentajeComision)) / 100).toFixed(2)}
                                    </p>
                                </div>
                            )}

                            <Button 
                                onClick={handleAprobarTarea}
                                disabled={!reviewForm.valorBaseUSD || !reviewForm.porcentajeComision}
                                className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                Aprobar y Asignar
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    )
}