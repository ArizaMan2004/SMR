// @/components/dashboard/task-card.tsx

"use client"

import { Card } from "@/components/ui/card"
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden"

interface TaskCardProps {
  item: ItemOrden
  orden: OrdenServicio
  isCompleted?: boolean
  onToggleComplete?: () => void
  onClick?: () => void
}

export default function TaskCard({
  item,
  orden,
  isCompleted = false,
  onToggleComplete,
  onClick
}: TaskCardProps) {
  return (
    <Card
      className="p-4 cursor-pointer transition-all hover:shadow-lg hover:border-primary"
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground line-clamp-2">{item.nombre}</h3>
            <p className="text-xs text-muted-foreground mt-1">Orden #{orden.ordenNumero}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete?.()
            }}
            className="ml-2"
          >
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <Circle className="w-6 h-6 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        </div>

        <div className="space-y-1 text-sm">
          {item.cantidad && (
            <p className="text-muted-foreground">
              Cantidad: <span className="font-medium text-foreground">{item.cantidad} {item.unidad}</span>
            </p>
          )}
          {item.materialDeImpresion && (
            <p className="text-muted-foreground">
              Material: <span className="font-medium text-foreground">{item.materialDeImpresion}</span>
            </p>
          )}
          {item.materialDetalleCorte && (
            <p className="text-muted-foreground">
              Detalle: <span className="font-medium text-foreground">{item.materialDetalleCorte}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Cliente: <span className="font-medium">{orden.cliente.nombreRazonSocial}</span>
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  )
}