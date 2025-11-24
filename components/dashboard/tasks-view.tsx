"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LayoutGrid, Users, CalendarClock } from 'lucide-react'
import { type OrdenServicio, type ItemOrden, type TipoServicio } from "@/lib/types/orden"
import TaskCard from "@/components/dashboard/task-card"
import TaskDetailModal from "@/components/dashboard/task-detail-modal"

interface TasksViewProps {
  ordenes: OrdenServicio[]
}

export default function TasksView({ ordenes }: TasksViewProps) {
  // Ahora seleccionamos AREA (Tipo de Servicio), no empleado
  const [selectedArea, setSelectedArea] = useState<string>("")
  const [selectedTask, setSelectedTask] = useState<{ item: ItemOrden; orden: OrdenServicio } | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  // --- UTILS ---

  const getTaskId = (orden: OrdenServicio, itemIndex: number) => {
    return `${orden.id}-${itemIndex}`
  }

  // 🏷️ MAPEO DE ÁREAS (Aquí definimos "Producción" para Aviso Corpóreo)
  const getAreaLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      CORTE_LASER: "Corte Láser",
      IMPRESION: "Impresión",
      ROTULACION: "Rotulación",
      AVISO_CORPOREO: "Producción", // 👈 Cambio solicitado
      INSTALACION: "Instalación",
      DISENO: "Diseño",
      OTROS: "Otros Servicios"
    }
    return labels[tipo] || tipo
  }

  // --- MEMOS ---

  // 1. Obtener lista única de ÁREAS disponibles basándonos en las órdenes activas
  const areasDisponibles = useMemo(() => {
    const areasSet = new Set<string>()
    ordenes.forEach(orden => {
      if (Array.isArray(orden.items)) { 
        orden.items.forEach(item => {
          // Usamos el tipoServicio como identificador del Área
          if (item.tipoServicio) {
            areasSet.add(item.tipoServicio)
          } else {
            areasSet.add("OTROS")
          }
        })
      }
    })
    return Array.from(areasSet).sort()
  }, [ordenes])

  // 2. Filtrar tareas por el ÁREA seleccionada
  const tareasFiltradas = useMemo(() => {
    if (!selectedArea) return []

    const tareas: Array<{ item: ItemOrden; orden: OrdenServicio; index: number }> = []
    
    ordenes.forEach(orden => {
      if (Array.isArray(orden.items)) {
        orden.items.forEach((item, index) => {
          const areaItem = item.tipoServicio || "OTROS"
          
          // Filtramos si el tipo coincide con el área seleccionada
          if (areaItem === selectedArea) {
            tareas.push({ item, orden, index })
          }
        })
      }
    })
    
    // Ordenar por fecha de entrega (Urgencia)
    tareas.sort((a, b) => {
        const dateA = a.orden.fechaEntregaEstimada ? new Date(a.orden.fechaEntregaEstimada).getTime() : Infinity;
        const dateB = b.orden.fechaEntregaEstimada ? new Date(b.orden.fechaEntregaEstimada).getTime() : Infinity;
        return dateA - dateB; 
    });

    return tareas
  }, [ordenes, selectedArea])

  // 3. Contar completadas
  const contadorCompletadas = useMemo(() => {
    const filteredTaskIds = tareasFiltradas.map(t => getTaskId(t.orden, t.index));
    let count = 0;
    filteredTaskIds.forEach(id => {
        if (completedTasks.has(id)) {
            count++;
        }
    });
    return count;
  }, [completedTasks, tareasFiltradas])

  const handleToggleComplete = (taskId: string) => {
    const newCompleted = new Set(completedTasks)
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId)
    } else {
      newCompleted.add(taskId)
    }
    setCompletedTasks(newCompleted)
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tareas por Área</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona la cola de producción por departamento</p>
        </div>
        
        {/* SELECTOR DE ÁREA */}
        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-full md:w-64">
            <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground"/>
                <SelectValue placeholder="Selecciona un Área" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {areasDisponibles.map(area => (
              <SelectItem key={area} value={area}>
                {getAreaLabel(area)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats del Área */}
      {selectedArea && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Cola de {getAreaLabel(selectedArea)}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-foreground">{tareasFiltradas.length}</p>
                <span className="text-sm text-muted-foreground">trabajos totales</span>
              </div>
            </div>
            
            <div className="flex gap-8 text-center">
                <div>
                    <p className="text-sm text-muted-foreground">Pendientes</p>
                    <p className="text-xl font-bold text-orange-600">{tareasFiltradas.length - contadorCompletadas}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Listas</p>
                    <p className="text-xl font-bold text-green-600">{contadorCompletadas}</p>
                </div>
            </div>

            <div className="hidden md:flex w-16 h-16 rounded-full border-4 border-blue-200 dark:border-blue-800 items-center justify-center">
                <span className="text-xs font-bold">
                    {tareasFiltradas.length > 0 ? Math.round((contadorCompletadas / tareasFiltradas.length) * 100) : 0}%
                </span>
            </div>
          </div>
        </Card>
      )}

      {/* Grid de Tareas */}
      {selectedArea ? (
        tareasFiltradas.length > 0 ? (
          <div className="space-y-4">
             <div className="flex items-center gap-2 pb-2 border-b">
                <CalendarClock className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-medium text-muted-foreground">
                    Cola de trabajo: {getAreaLabel(selectedArea)}
                </h3>
             </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in duration-300">
              {tareasFiltradas.map(({ item, orden, index }) => {
                const taskId = getTaskId(orden, index)
                const isCompleted = completedTasks.has(taskId)
                
                return (
                  <div key={taskId} className="relative group">
                    <TaskCard 
                      item={item} 
                      orden={orden} 
                      isCompleted={isCompleted}
                      onToggleComplete={() => handleToggleComplete(taskId)}
                      onClick={() => setSelectedTask({ item, orden })} 
                    />
                    
                    {/* Badge de Empleado Asignado (Visible sobre la tarjeta) */}
                    {item.empleadoAsignado && (
                        <div className="absolute top-[-8px] right-[-4px] bg-white dark:bg-slate-800 border shadow-sm px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 z-10">
                            <Users className="w-3 h-3" />
                            {item.empleadoAsignado}
                        </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <p className="text-muted-foreground">No hay tareas pendientes en el área de {getAreaLabel(selectedArea)}.</p>
          </Card>
        )
      ) : (
        <Card className="p-12 text-center bg-muted/50">
            <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">Selecciona un departamento</h3>
            <p className="text-muted-foreground">Elige un área de trabajo arriba para ver la cola de producción correspondiente.</p>
        </Card>
      )}

      {/* Modal de detalles (Sin cambios) */}
      {selectedTask && (
        <TaskDetailModal
          item={selectedTask.item} 
          orden={selectedTask.orden} 
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}