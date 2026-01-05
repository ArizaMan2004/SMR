"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  LayoutGrid, 
  Users, 
  Zap, 
  CheckCircle2, 
  Clock 
} from 'lucide-react'

// Tipos y Servicios
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden"
import { updateOrdenItemField } from "@/lib/services/ordenes-service"
import TaskCard from "@/components/dashboard/task-card"
import TaskDetailModal from "@/components/dashboard/task-detail-modal"
import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };

interface TasksViewProps {
  ordenes: OrdenServicio[]
  currentUserId: string
  areaPriorizada?: string 
}

export default function TasksView({ ordenes, currentUserId, areaPriorizada }: TasksViewProps) {
  const [internalArea, setInternalArea] = useState<string>("")
  const selectedArea = areaPriorizada || internalArea 

  // --- 🏷️ MAPEO DE ÁREAS CON SOPORTE PARA NOMBRES VIEJOS ---
  const getAreaLabel = (tipo: string) => {
    if (!tipo) return "Sin Área";
    const normalized = tipo.toUpperCase().trim();
    
    // Alias: Si es "CORTE", visualmente es "Corte Láser"
    if (normalized === "CORTE" || normalized === "CORTE_LASER") return "Corte Láser";
    
    const labels: Record<string, string> = {
      IMPRESION: "Impresión",
      ROTULACION: "Rotulación",
      AVISO_CORPOREO: "Producción",
      INSTALACION: "Instalación",
      DISENO: "Diseño",
      OTROS: "Otros Servicios"
    }
    return labels[normalized] || tipo;
  }

  const [selectedTask, setSelectedTask] = useState<{ item: ItemOrden; orden: OrdenServicio } | null>(null)

  const handleToggleComplete = async (ordenId: string, itemIndex: number, currentStatus: boolean) => {
    try {
      await updateOrdenItemField(ordenId, itemIndex, { completado: !currentStatus });
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
    }
  }

  // --- 📊 FILTRADO ROBUSTO (Une "CORTE" y "CORTE_LASER") ---
  const tareasFiltradas = useMemo(() => {
    if (!selectedArea) return []
    
    const tareas: Array<{ item: ItemOrden; orden: OrdenServicio; index: number }> = []
    const searchArea = selectedArea.toUpperCase().trim();
    
    // Si buscamos Corte Láser, aceptamos ambos IDs
    const isSearchingCorte = searchArea === "CORTE" || searchArea === "CORTE_LASER";

    ordenes.forEach(orden => {
      orden.items?.forEach((item, index) => {
        const itemArea = (item.tipoServicio || "OTROS").toUpperCase().trim();
        
        const matches = isSearchingCorte 
            ? (itemArea === "CORTE" || itemArea === "CORTE_LASER")
            : (itemArea === searchArea);

        if (matches) {
          tareas.push({ item, orden, index })
        }
      })
    })

    return tareas.sort((a, b) => {
      const dateA = a.orden.fechaEntregaEstimada ? new Date(a.orden.fechaEntregaEstimada).getTime() : Infinity
      const dateB = b.orden.fechaEntregaEstimada ? new Date(b.orden.fechaEntregaEstimada).getTime() : Infinity
      return dateA - dateB
    })
  }, [ordenes, selectedArea])

  const stats = useMemo(() => {
    const total = tareasFiltradas.length
    const completadas = tareasFiltradas.filter(t => t.item.completado).length
    return { 
      total, 
      completadas, 
      pendientes: total - completadas,
      porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0
    }
  }, [tareasFiltradas])

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 sm:px-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase leading-none">
            Cola de <span className="text-blue-600">{getAreaLabel(selectedArea)}</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
            Gestión de flujo por departamento taller
          </p>
        </div>

        {!areaPriorizada && (
          <div className="w-full md:w-72">
            <Select value={internalArea} onValueChange={setInternalArea}>
              <SelectTrigger className="h-14 rounded-[1.8rem] bg-white dark:bg-white/5 border-black/5 shadow-sm px-6 hover:ring-4 ring-blue-500/10 transition-all">
                <div className="flex items-center gap-3">
                  <LayoutGrid className="w-4 h-4 text-blue-600" />
                  <SelectValue placeholder="SELECCIONAR ÁREA" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-[1.5rem] border-black/5 shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-black/90">
                {/* Generamos las áreas dinámicamente de los datos reales */}
                {Array.from(new Set(ordenes.flatMap(o => o.items?.map(i => i.tipoServicio) || []))).map(area => (
                  <SelectItem key={area} value={area || "OTROS"} className="py-3 rounded-xl cursor-pointer font-bold text-[10px] uppercase">
                    {getAreaLabel(area || "OTROS")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <AnimatePresence mode="wait">
        {selectedArea ? (
          <motion.div key={selectedArea} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={springConfig} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCardMini label="Total" value={stats.total} icon={<Zap />} color="blue" />
              <StatCardMini label="Pendientes" value={stats.pendientes} icon={<Clock />} color="orange" />
              <StatCardMini label="Listas" value={stats.completadas} icon={<CheckCircle2 />} color="green" />
              <div className="hidden lg:flex items-center justify-center bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-[2.2rem] border border-black/5 p-4">
                  <div className="relative flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-black/5 dark:text-white/5" />
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * stats.porcentaje) / 100} className="text-blue-600 transition-all duration-1000" />
                      </svg>
                      <span className="absolute text-[11px] font-black">{stats.porcentaje}%</span>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tareasFiltradas.map(({ item, orden, index }) => (
                <motion.div key={`${orden.id}-${index}`} whileHover={{ scale: 1.02, y: -5 }} className="relative group">
                  <TaskCard item={item} orden={orden} isCompleted={!!item.completado} onToggleComplete={() => handleToggleComplete(orden.id!, index, !!item.completado)} onClick={() => setSelectedTask({ item, orden })} />
                  {item.empleadoAsignado && (
                    <div className="absolute top-[-8px] right-2 bg-white dark:bg-slate-900 border border-black/5 shadow-xl px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter text-blue-600 flex items-center gap-2 z-10">
                        <Users className="w-3 h-3" />
                        {item.empleadoAsignado}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <EmptyState icon={<LayoutGrid className="opacity-20" />} message="Selecciona un departamento para ver la cola de trabajo" />
        )}
      </AnimatePresence>

      {selectedTask && (
        <TaskDetailModal item={selectedTask.item} orden={selectedTask.orden} isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} onUpdate={() => setSelectedTask(null)} />
      )}
    </div>
  )
}

function StatCardMini({ label, value, icon, color }: any) {
  const colors: any = { blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", orange: "bg-orange-500/10 text-orange-600 border-orange-500/20", green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" }
  return (
    <Card className="rounded-[2.2rem] p-6 border-black/5 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md shadow-sm flex items-center gap-5">
      <div className={cn("p-4 rounded-2xl shadow-inner", colors[color])}>{React.cloneElement(icon, { className: "w-6 h-6" })}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">{label}</p>
        <p className="text-3xl font-black tracking-tighter leading-none">{value}</p>
      </div>
    </Card>
  )
}

function EmptyState({ icon, message }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 px-6 rounded-[3rem] bg-white/30 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10">
      <div className="w-20 h-20 rounded-[2rem] bg-black/5 dark:bg-white/5 flex items-center justify-center mb-6">{React.cloneElement(icon, { className: "w-8 h-8 opacity-20" })}</div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 text-center max-w-[200px]">{message}</p>
    </motion.div>
  )
}