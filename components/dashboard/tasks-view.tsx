// @/components/dashboard/tasks-view.tsx
"use client"

import React, { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { 
  Users, Zap, Search, AlertTriangle, Filter, Trophy, CalendarDays, ArrowUpDown,
  Palette, Printer, Scissors, MoreHorizontal, Settings, Plus, X, MoveRight,
  FolderInput // Icono para mover manualmente
} from 'lucide-react'

// Tipos y Servicios
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden"
import { updateOrdenItemField } from "@/lib/services/ordenes-service"
import { subscribeToKeywords, saveKeywordsConfig, DEFAULT_KEYWORDS } from "@/lib/services/config-service" // <--- IMPORTANTE: CREAR ESTE ARCHIVO
import TaskCard from "@/components/dashboard/task-card"
import TaskDetailModal from "@/components/dashboard/task-detail-modal"
import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };

interface TasksViewProps {
  ordenes: OrdenServicio[]
  currentUserId: string
  areaPriorizada?: string 
}

// Configuración Visual
const MAIN_AREAS = [
    { id: "DISENO", label: "Diseño", icon: Palette, color: "blue" },
    { id: "IMPRESION", label: "Impresión", icon: Printer, color: "purple" },
    { id: "CORTE", label: "Corte Láser", icon: Scissors, color: "orange" },
    { id: "OTROS", label: "Otros Servicios", icon: MoreHorizontal, color: "slate" }
];

export default function TasksView({ ordenes, currentUserId, areaPriorizada }: TasksViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(areaPriorizada || "DISENO")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pendientes")
  
  // Filtros
  const [sortBy, setSortBy] = useState("urgencia") 
  const [filterPriority, setFilterPriority] = useState("todos") 
  
  const [selectedTask, setSelectedTask] = useState<{ item: ItemOrden; orden: OrdenServicio } | null>(null)
  
  // --- ESTADO PARA PALABRAS CLAVE (FIREBASE) ---
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Suscripción a Firebase Config
  useEffect(() => {
      const unsubscribe = subscribeToKeywords((data) => {
          if(data) setKeywords(data);
      });
      return () => unsubscribe();
  }, []);

  const updateKeywords = async (newKeywords: typeof DEFAULT_KEYWORDS) => {
      // Optimistic update
      setKeywords(newKeywords);
      await saveKeywordsConfig(newKeywords);
  };

  const handleToggleComplete = async (ordenId: string, itemIndex: number, currentStatus: boolean) => {
    try {
      await updateOrdenItemField(ordenId, itemIndex, { completado: !currentStatus });
    } catch (error) {
      console.error("Error al guardar:", error);
    }
  }

  // --- FUNCIÓN PARA MOVER MANUALMENTE ---
  const handleManualCategorize = async (ordenId: string, itemIndex: number, newArea: string) => {
      try {
          // Guardamos "areaAsignada" en el item dentro de Firebase
          await updateOrdenItemField(ordenId, itemIndex, { areaAsignada: newArea });
      } catch (e) {
          console.error("Error al mover tarea", e);
      }
  };

  // --- FUNCIÓN CLASIFICADORA DINÁMICA ---
  const detectCategory = (item: ItemOrden): string => {
      // 1. PRIORIDAD MÁXIMA: Asignación Manual del Usuario
      if ((item as any).areaAsignada) {
          return (item as any).areaAsignada;
      }

      const tipo = (item.tipoServicio || "").toUpperCase().trim();
      const nombre = (item.nombre || "").toUpperCase();

      // 2. Prioridad Tipo Explícito (Si viene del asistente correcto)
      if (["DISENO", "DISEÑO"].includes(tipo)) return "DISENO";
      if (["IMPRESION", "IMPRESIÓN"].includes(tipo)) return "IMPRESION";
      if (["CORTE", "CORTE_LASER"].includes(tipo)) return "CORTE";

      // 3. Inteligencia: Buscar palabras clave dinámicas (desde Firebase)
      if (keywords.IMPRESION?.some((k: string) => nombre.includes(k))) return "IMPRESION";
      if (keywords.CORTE?.some((k: string) => nombre.includes(k))) return "CORTE";
      if (keywords.DISENO?.some((k: string) => nombre.includes(k))) return "DISENO";

      return "OTROS";
  };

  // --- 1. PRE-CÁLCULO DE CONTEOS ---
  const areaCounts = useMemo(() => {
      const counts: Record<string, number> = { DISENO: 0, IMPRESION: 0, CORTE: 0, OTROS: 0 };
      
      ordenes.forEach(orden => {
          orden.items?.forEach(item => {
              if (item.completado) return;
              const cat = detectCategory(item);
              if (counts[cat] !== undefined) counts[cat]++;
              else counts["OTROS"]++; 
          });
      });
      return counts;
  }, [ordenes, keywords]); 

  // --- 2. FILTRADO PRINCIPAL ---
  const tareasProcesadas = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let listaBruta: any[] = [];
    let urgenteCount = 0;
    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    ordenes.forEach(orden => {
      orden.items?.forEach((item, index) => {
        const itemCategory = detectCategory(item);
        
        if (itemCategory === selectedCategory) {
            const matchesSearch = !term || 
                orden.cliente?.nombreRazonSocial?.toLowerCase().includes(term) ||
                item.nombre?.toLowerCase().includes(term) || 
                String(orden.ordenNumero).includes(term) ||
                item.empleadoAsignado?.toLowerCase().includes(term);

            if (matchesSearch) {
                const taskObj = { item, orden, index };
                
                const fechaEntrega = orden.fechaEntregaEstimada ? new Date(orden.fechaEntregaEstimada) : null;
                let urgencia = "normal"; 
                
                if (fechaEntrega) {
                    const diffDias = Math.ceil((fechaEntrega.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDias <= 1) { urgencia = "urgente"; if(!item.completado) urgenteCount++; }
                    else if (diffDias <= 3) urgencia = "cercano";
                }

                if (filterPriority === "todos" || urgencia === filterPriority) {
                    listaBruta.push({ ...taskObj, urgencia });
                }
            }
        }
      })
    })

    let pendientes = listaBruta.filter(t => !t.item.completado);
    let completadas = listaBruta.filter(t => t.item.completado);

    const sortFn = (a: any, b: any) => {
        switch (sortBy) {
            case "urgencia":
                const da = a.orden.fechaEntregaEstimada ? new Date(a.orden.fechaEntregaEstimada).getTime() : Infinity;
                const db = b.orden.fechaEntregaEstimada ? new Date(b.orden.fechaEntregaEstimada).getTime() : Infinity;
                return da - db;
            case "fecha_creacion":
                return new Date(b.orden.fecha).getTime() - new Date(a.orden.fecha).getTime();
            case "cliente":
                return (a.orden.cliente?.nombreRazonSocial || "").localeCompare(b.orden.cliente?.nombreRazonSocial || "");
            case "monto":
                return (b.item.precioUnitario * b.item.cantidad) - (a.item.precioUnitario * a.item.cantidad);
            default: return 0;
        }
    };

    pendientes.sort(sortFn);
    completadas.sort((a, b) => new Date(b.orden.fecha).getTime() - new Date(a.orden.fecha).getTime());

    return { pendientes, completadas, urgenteCount }
  }, [ordenes, selectedCategory, searchTerm, sortBy, filterPriority, keywords])

  // --- 3. AGRUPACIÓN POR MESES ---
  const tareasAgrupadasPorMes = useMemo(() => {
      const grupos: Record<string, typeof tareasProcesadas.pendientes> = {};
      tareasProcesadas.pendientes.forEach(task => {
          const fechaRef = task.orden.fechaEntregaEstimada ? new Date(task.orden.fechaEntregaEstimada) : new Date(task.orden.fecha);
          const mesAno = fechaRef.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' }).toUpperCase();
          if (!grupos[mesAno]) grupos[mesAno] = [];
          grupos[mesAno].push(task);
      });
      return grupos;
  }, [tareasProcesadas.pendientes]);

  const activeColor = MAIN_AREAS.find(a => a.id === selectedCategory)?.color || "blue";
  const bgColors: any = { 
      blue: "bg-blue-600 shadow-blue-500/30", 
      purple: "bg-purple-600 shadow-purple-500/30", 
      orange: "bg-orange-500 shadow-orange-500/30",
      slate: "bg-slate-600 shadow-slate-500/30"
  };
  const textColors: any = {
      blue: "text-blue-600", purple: "text-purple-600", orange: "text-orange-600", slate: "text-slate-600"
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 sm:px-6">
      
      {/* 1. NAVEGACIÓN SUPERIOR */}
      <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white flex items-center gap-3">
                  Producción <span className="text-slate-300">/</span> <span className={cn(textColors[activeColor])}>{MAIN_AREAS.find(a => a.id === selectedCategory)?.label}</span>
              </h1>
              
              <div className="flex gap-2 w-full md:w-auto">
                  {/* Buscador */}
                  <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                          placeholder="Buscar por nombre, cliente..." 
                          value={searchTerm} 
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-12 rounded-2xl bg-white dark:bg-white/10 border-none font-bold text-xs shadow-sm"
                      />
                  </div>
                  {/* Botón Configuración */}
                  <Button onClick={() => setIsConfigOpen(true)} className="h-12 w-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 shadow-lg">
                      <Settings className="w-5 h-5" />
                  </Button>
              </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {MAIN_AREAS.map((area) => {
                  const isActive = selectedCategory === area.id;
                  const count = areaCounts[area.id];
                  const Icon = area.icon;
                  
                  return (
                      <motion.button
                          key={area.id}
                          onClick={() => setSelectedCategory(area.id)}
                          whileHover={{ y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                              "relative p-5 rounded-[1.8rem] border-2 transition-all flex flex-col items-start gap-3 overflow-hidden",
                              isActive 
                                  ? "bg-white dark:bg-[#1c1c1e] border-transparent shadow-xl ring-2 ring-offset-2 ring-offset-[#f2f2f7] dark:ring-offset-black" 
                                  : "bg-white/40 dark:bg-white/5 border-transparent hover:bg-white dark:hover:bg-white/10"
                          )}
                          style={{ borderColor: isActive ? 'transparent' : 'transparent' }}
                      >
                          <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-colors",
                              isActive ? bgColors[area.color] : "bg-slate-200 dark:bg-white/10 text-slate-400"
                          )}>
                              <Icon size={20} />
                          </div>
                          <div className="text-left z-10">
                              <p className={cn("text-xs font-black uppercase tracking-widest mb-0.5", isActive ? "text-slate-900 dark:text-white" : "text-slate-400")}>
                                  {area.label}
                              </p>
                              <p className={cn("text-2xl font-black tracking-tighter leading-none", isActive ? textColors[area.color] : "text-slate-300")}>
                                  {count} <span className="text-[10px] font-bold text-slate-300 uppercase">Pend.</span>
                              </p>
                          </div>
                      </motion.button>
                  )
              })}
          </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
            key={selectedCategory} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={springConfig}
            className="space-y-6"
        >
            {/* 2. BARRA DE HERRAMIENTAS Y PESTAÑAS */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#1c1c1e] p-2 rounded-[2rem] shadow-sm border border-black/5">
                    <TabsList className="bg-slate-100 dark:bg-white/5 p-1 h-auto rounded-[1.5rem] w-full md:w-auto">
                        <TabsTrigger value="pendientes" className="rounded-[1.2rem] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all flex-1 md:flex-none">
                            Por Hacer ({tareasProcesadas.pendientes.length})
                        </TabsTrigger>
                        <TabsTrigger value="completadas" className="rounded-[1.2rem] px-6 py-2.5 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 transition-all flex-1 md:flex-none">
                            Finalizadas ({tareasProcesadas.completadas.length})
                        </TabsTrigger>
                    </TabsList>

                    {activeTab === 'pendientes' && (
                        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto px-2 md:px-0 no-scrollbar">
                            <Select value={filterPriority} onValueChange={setFilterPriority}>
                                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-none px-4 font-bold text-[10px] uppercase min-w-[130px]">
                                    <div className="flex items-center gap-2"><Filter size={14} className="text-slate-400" /><SelectValue /></div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="urgente">⚠️ Urgentes</SelectItem>
                                    <SelectItem value="cercano">🕒 Próximos</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-white/5 border-none px-4 font-bold text-[10px] uppercase min-w-[140px]">
                                    <div className="flex items-center gap-2"><ArrowUpDown size={14} className="text-slate-400" /><SelectValue /></div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="urgencia">Fecha Entrega</SelectItem>
                                    <SelectItem value="fecha_creacion">Más Recientes</SelectItem>
                                    <SelectItem value="cliente">Cliente (A-Z)</SelectItem>
                                    <SelectItem value="monto">Mayor Valor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* 3. CONTENIDO: LISTA AGRUPADA POR MESES */}
                <TabsContent value="pendientes" className="mt-0 focus-visible:outline-none space-y-10">
                    {Object.keys(tareasAgrupadasPorMes).length > 0 ? (
                        Object.entries(tareasAgrupadasPorMes).map(([mes, tareas]) => (
                            <div key={mes} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-4 sticky top-0 z-10 py-2 bg-[#F2F2F7]/95 dark:bg-black/95 backdrop-blur-sm">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-md", bgColors[activeColor])}>
                                        <CalendarDays className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none">{mes}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tareas.length} Tareas pendientes</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {tareas.map(({ item, orden, index, urgencia }) => (
                                        <motion.div layout key={`${orden.id}-${index}`} whileHover={{ scale: 1.02 }} className="relative group">
                                            <TaskCard 
                                                item={item} 
                                                orden={orden} 
                                                isCompleted={false}
                                                onToggleComplete={() => handleToggleComplete(orden.id!, index, false)} 
                                                onClick={() => setSelectedTask({ item, orden })} 
                                            />
                                            {/* BADGE DE URGENCIA */}
                                            {urgencia === 'urgente' && (
                                                <div className="absolute -top-2 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-red-500/30 flex items-center gap-1 z-10 animate-pulse">
                                                    <AlertTriangle size={10} /> Urgente
                                                </div>
                                            )}
                                            {urgencia === 'cercano' && (
                                                <div className="absolute -top-2 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/30 z-10">
                                                    Pronto
                                                </div>
                                            )}
                                            
                                            {/* --- BOTÓN DE MOVER MANUAL --- */}
                                            <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-lg bg-white/90 hover:bg-white text-slate-500">
                                                            <FolderInput className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl">
                                                        <div className="px-2 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mover tarea a:</div>
                                                        {MAIN_AREAS.filter(a => a.id !== selectedCategory).map(area => (
                                                            <DropdownMenuItem 
                                                                key={area.id}
                                                                onClick={(e) => { e.stopPropagation(); handleManualCategorize(orden.id!, index, area.id); }}
                                                                className="text-xs font-bold gap-2 cursor-pointer"
                                                            >
                                                                {React.createElement(area.icon, { className: "w-3 h-3" })} {area.label}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            {item.empleadoAsignado && (
                                                <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 border border-black/5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase text-slate-500 flex items-center gap-1.5 shadow-sm">
                                                    <Users className="w-3 h-3" /> {item.empleadoAsignado}
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-32 flex flex-col items-center justify-center text-center opacity-50">
                            <Trophy className={cn("w-24 h-24 mb-6 drop-shadow-xl", textColors[activeColor])} />
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">¡Todo listo en {MAIN_AREAS.find(a => a.id === selectedCategory)?.label}!</h3>
                            <p className="text-sm font-bold text-slate-500 mt-2 max-w-xs">No hay tareas pendientes con los filtros actuales.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completadas" className="mt-0 focus-visible:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60 grayscale-[0.5] hover:grayscale-0 transition-all duration-500">
                        {tareasProcesadas.completadas.map(({ item, orden, index }) => (
                            <motion.div key={`${orden.id}-${index}`}>
                                <TaskCard 
                                    item={item} 
                                    orden={orden} 
                                    isCompleted={true}
                                    onToggleComplete={() => handleToggleComplete(orden.id!, index, true)} 
                                    onClick={() => setSelectedTask({ item, orden })} 
                                />
                            </motion.div>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </motion.div>
      </AnimatePresence>

      {/* MODAL CONFIGURACIÓN KEYWORDS */}
      <KeywordsConfigModal 
          isOpen={isConfigOpen} 
          onClose={() => setIsConfigOpen(false)} 
          keywords={keywords}
          onUpdate={updateKeywords}
      />

      {selectedTask && (
        <TaskDetailModal item={selectedTask.item} orden={selectedTask.orden} isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} onUpdate={() => setSelectedTask(null)} />
      )}
    </div>
  )
}

function StatCardMini({ label, value, icon, color }: any) {
  const colors: any = { 
      blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", 
      orange: "bg-orange-500/10 text-orange-600 border-orange-500/20", 
      green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      red: "bg-red-500/10 text-red-600 border-red-500/20"
  }
  return (
    <Card className="rounded-[2.2rem] p-5 border-black/5 dark:border-white/5 bg-white dark:bg-[#1c1c1e] shadow-sm flex items-center gap-4 relative overflow-hidden">
      <div className={cn("p-3.5 rounded-2xl shadow-inner", colors[color])}>
          {React.cloneElement(icon, { className: "w-5 h-5" })}
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-0.5">{label}</p>
        <p className="text-2xl font-black tracking-tighter leading-none">{value}</p>
      </div>
    </Card>
  )
}

// --- NUEVO COMPONENTE: MODAL DE CONFIGURACIÓN ---
function KeywordsConfigModal({ isOpen, onClose, keywords, onUpdate }: any) {
    const [localKeywords, setLocalKeywords] = useState(keywords);
    const [newKeyword, setNewKeyword] = useState("");
    const [activeTab, setActiveTab] = useState("IMPRESION");

    // Sincronizar si abren el modal
    React.useEffect(() => { if(isOpen && keywords) setLocalKeywords(keywords); }, [isOpen, keywords]);

    const addKeyword = () => {
        if (!newKeyword.trim()) return;
        const upper = newKeyword.toUpperCase().trim();
        // Verificar si existe el array, si no, iniciarlo
        const currentList = localKeywords[activeTab] || [];
        if (currentList.includes(upper)) return;

        setLocalKeywords(prev => ({
            ...prev,
            [activeTab]: [...currentList, upper]
        }));
        setNewKeyword("");
    };

    const removeKeyword = (word: string) => {
        setLocalKeywords(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].filter((k: string) => k !== word)
        }));
    };

    const handleSave = () => {
        onUpdate(localKeywords);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl rounded-[2.5rem] p-8 border-none bg-white dark:bg-slate-950 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                        <Settings className="text-slate-400" /> Configurar Filtros
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1.5 h-auto rounded-[1.5rem] w-full grid grid-cols-3">
                            <TabsTrigger value="IMPRESION" className="rounded-2xl py-2 font-black text-[10px] uppercase">Impresión</TabsTrigger>
                            <TabsTrigger value="CORTE" className="rounded-2xl py-2 font-black text-[10px] uppercase">Corte Láser</TabsTrigger>
                            <TabsTrigger value="DISENO" className="rounded-2xl py-2 font-black text-[10px] uppercase">Diseño</TabsTrigger>
                        </TabsList>
                        
                        <div className="mt-6 space-y-4">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Agregar palabra clave (Ej. Tazas)" 
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                                    className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-900 border-none font-bold uppercase text-xs"
                                />
                                <Button onClick={addKeyword} className="h-12 w-12 rounded-2xl bg-slate-900 text-white"><Plus /></Button>
                            </div>

                            <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-2">
                                {localKeywords[activeTab]?.map((word: string) => (
                                    <Badge key={word} variant="secondary" className="pl-3 pr-1 py-1.5 rounded-xl text-[10px] font-bold bg-white border border-slate-200 flex items-center gap-2 shadow-sm">
                                        {word}
                                        <button onClick={() => removeKeyword(word)} className="bg-slate-200 hover:bg-red-500 hover:text-white rounded-full p-0.5 transition-colors"><X size={10}/></button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </Tabs>
                </div>

                <DialogFooter>
                    <Button onClick={handleSave} className="w-full h-14 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl">
                        Guardar Cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}