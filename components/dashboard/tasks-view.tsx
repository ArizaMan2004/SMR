"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { type OrdenServicio, type ItemOrden, type TipoServicio } from "@/lib/types/orden"
import TaskCard from "@/components/dashboard/task-card"
import TaskDetailModal from "@/components/dashboard/task-detail-modal"

interface TasksViewProps {
  ordenes: OrdenServicio[]
}

export default function TasksView({ ordenes }: TasksViewProps) {
  const [selectedEmpleado, setSelectedEmpleado] = useState("")
  const [selectedTask, setSelectedTask] = useState<{ item: ItemOrden; orden: OrdenServicio } | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  // 🔑 MOVIDO AQUÍ: Funciones utilitarias para que estén disponibles antes de los useMemo

  // Genera un ID único para la tarea basado en la orden y el índice del ítem
  const getTaskId = (orden: OrdenServicio, itemIndex: number) => {
    return `${orden.id}-${itemIndex}`
  }

  const getTipoServicioLabel = (tipo: TipoServicio) => {
    const labels: Record<TipoServicio, string> = {
      CORTE_LASER: "Corte Láser",
      IMPRESION: "Impresión",
      ROTULACION: "Rotulación",
      AVISO_CORPOREO: "Aviso Corporeo",
      OTROS: "Otros"
    }
    return labels[tipo] || tipo
  }

  // Extraer lista única de empleados (quienes tienen tareas asignadas)
  const empleados = useMemo(() => {
    const empleadosSet = new Set<string>()
    ordenes.forEach(orden => {
      // ✅ FIX: Asegurar que orden.items existe y es un array
      if (Array.isArray(orden.items)) { 
        orden.items.forEach(item => {
          // Usamos 'item.empleadoAsignado' tal como está en tu código
          if (item.empleadoAsignado) {
            empleadosSet.add(item.empleadoAsignado)
          }
        })
      }
    })
    return Array.from(empleadosSet).sort()
  }, [ordenes])

  // Filtrar y ORDENAR tareas por empleado seleccionado
  const tareasFiltradas = useMemo(() => {
    // Si no hay empleado seleccionado, devolvemos un array vacío
    if (!selectedEmpleado) return []

    const tareas: Array<{ item: ItemOrden; orden: OrdenServicio; index: number }> = []
    ordenes.forEach(orden => {
      // ✅ FIX: Asegurar que orden.items existe y es un array
      if (Array.isArray(orden.items)) {
        orden.items.forEach((item, index) => {
          // Filtramos solo las tareas asignadas al empleado seleccionado
          if (item.empleadoAsignado === selectedEmpleado) {
            tareas.push({ item, orden, index })
          }
        })
      }
    })
    
    // 💡 LÓGICA DE ORDENACIÓN POR FECHA DE ENTREGA ESTIMADA (ASCENDENTE)
    // Esto prioriza las tareas con fecha más próxima y envía las tareas sin fecha al final.
    tareas.sort((a, b) => {
        // Convertir fecha a timestamp. Si no existe, usar Infinity para enviarla al final.
        const dateA = a.orden.fechaEntregaEstimada ? new Date(a.orden.fechaEntregaEstimada).getTime() : Infinity;
        const dateB = b.orden.fechaEntregaEstimada ? new Date(b.orden.fechaEntregaEstimada).getTime() : Infinity;
        
        return dateA - dateB; 
    });

    return tareas
  }, [ordenes, selectedEmpleado])

  // Agrupar tareas por tipo de servicio
  const tareasAgrupadas = useMemo(() => {
    const grupos: Record<string, Array<{ item: ItemOrden; orden: OrdenServicio; index: number }>> = {}
    tareasFiltradas.forEach(tarea => {
      // Usamos el tipo de servicio o "OTROS" como fallback
      const tipo = tarea.item.tipoServicio || "OTROS"
      if (!grupos[tipo]) {
        grupos[tipo] = []
      }
      grupos[tipo].push(tarea)
    })
    return grupos
  }, [tareasFiltradas])

  // Contar tareas completadas
  const contadorCompletadas = useMemo(() => {
    // 🔑 AHORA getTaskId está disponible
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
          <h1 className="text-2xl font-bold text-foreground">Mis Tareas del Día</h1>
          <p className="text-sm text-muted-foreground mt-1">Consulta tus trabajos asignados</p>
        </div>
        {/* Selector de Empleado */}
        <Select value={selectedEmpleado} onValueChange={setSelectedEmpleado}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Selecciona tu nombre" />
          </SelectTrigger>
          <SelectContent>
            {empleados.map(empleado => (
              <SelectItem key={empleado} value={empleado}>
                {empleado}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contador de tareas */}
      {selectedEmpleado && (
        <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tareas totales</p>
              <p className="text-3xl font-bold text-foreground">{tareasFiltradas.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completadas</p>
              <p className="text-3xl font-bold text-green-600">{contadorCompletadas}</p>
            </div>
            <div className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {tareasFiltradas.length > 0 ? Math.round((contadorCompletadas / tareasFiltradas.length) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Avance</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tareas por tipo de servicio */}
      {selectedEmpleado ? (
        Object.entries(tareasAgrupadas).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(tareasAgrupadas).map(([tipoServicio, tareas]) => {
              // 💡 CALCULAR AVANCE POR GRUPO
              const tareasCompletadasEnGrupo = tareas.filter(t => completedTasks.has(getTaskId(t.orden, t.index))).length;

              return (
                <div key={tipoServicio} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-primary rounded-full"></div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {getTipoServicioLabel(tipoServicio as TipoServicio)}
                    </h2>
                    {/* 💡 MOSTRAR AVANCE EN VEZ DE SOLO EL TOTAL */}
                    <span className="text-sm bg-secondary text-secondary-foreground px-2 py-1 rounded-full font-medium">
                      {tareasCompletadasEnGrupo} / {tareas.length} Tareas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tareas.map(({ item, orden, index }) => {
                      const taskId = getTaskId(orden, index)
                      const isCompleted = completedTasks.has(taskId)
                      return (
                        <TaskCard 
                          key={taskId}
                          item={item} 
                          orden={orden} 
                          isCompleted={isCompleted}
                          onToggleComplete={() => handleToggleComplete(taskId)}
                          onClick={() => setSelectedTask({ item, orden })} 
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No tienes tareas asignadas.</p>
          </Card>
        )
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Selecciona tu nombre para ver tus tareas del día.</p>
        </Card>
      )}

      {/* Modal de detalles */}
      {selectedTask && (
        <TaskDetailModal
          item={selectedTask.item} 
          orden={selectedTask.orden} 
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          // 💡 onUpdate para que al cerrar el modal, se recarguen los datos del padre
          onUpdate={() => { 
            // Esto forzará una re-renderización y actualizará el estado de completado en el padre
            // Aunque tu componente no recarga la data de Firestore aquí, el cambio de estado 
            // en el modal hijo (si lo has implementado) debería bastar.
            setSelectedTask(null); // Cerrar y forzar re-render con el nuevo estado de la prop
          }}
        />
      )}
    </div>
  )
}