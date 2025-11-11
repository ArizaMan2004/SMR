// @/components/orden/status-edit-modal.tsx
"use client"

import { useState } from "react"
import { type OrdenServicio, EstadoOrden } from "@/lib/types/orden"
// Asume que estos son de Shadcn UI o similar
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StatusEditModalProps {
  isOpen: boolean
  orden: OrdenServicio | null
  onClose: () => void
  onSave: (ordenId: string, nuevoEstado: EstadoOrden) => void
}

export function StatusEditModal({ isOpen, orden, onClose, onSave }: StatusEditModalProps) {
  // Inicializa el estado con el estado actual de la orden o una cadena vacía
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOrden | "">(orden?.estado || "")

  // Actualiza el estado local cada vez que la prop 'orden' cambie y el modal se abra
  useState(() => {
    if (orden && isOpen) {
      setNuevoEstado(orden.estado);
    }
  }, [orden, isOpen]);

  const getEtiquetaEstado = (estado: EstadoOrden) => {
    const etiquetas: Record<EstadoOrden, string> = {
      [EstadoOrden.PENDIENTE]: "Pendiente",
      [EstadoOrden.PROCESO]: "En Proceso",
      [EstadoOrden.TERMINADO]: "Terminado",
      [EstadoOrden.CANCELADO]: "Cancelado",
    }
    return etiquetas[estado]
  }

  const handleSave = () => {
    if (nuevoEstado && orden?.id) {
      onSave(orden.id, nuevoEstado as EstadoOrden)
      // No reseteamos 'nuevoEstado' aquí, ya que el padre debería cerrar el modal,
      // y al reabrir, se actualizará con el nuevo estado de la prop 'orden'.
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cambiar Estado de Orden</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Cliente: <strong>{orden?.razonSocial || "Cargando..."}</strong>
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-3">
            <Label htmlFor="estado">Nuevo Estado</Label>
            <Select value={nuevoEstado} onValueChange={(value) => setNuevoEstado(value as EstadoOrden)}>
              <SelectTrigger id="estado">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EstadoOrden.PENDIENTE}>{getEtiquetaEstado(EstadoOrden.PENDIENTE)}</SelectItem>
                <SelectItem value={EstadoOrden.PROCESO}>{getEtiquetaEstado(EstadoOrden.PROCESO)}</SelectItem>
                <SelectItem value={EstadoOrden.TERMINADO}>{getEtiquetaEstado(EstadoOrden.TERMINADO)}</SelectItem>
                <SelectItem value={EstadoOrden.CANCELADO}>{getEtiquetaEstado(EstadoOrden.CANCELADO)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orden && (
            <div className="text-sm text-muted-foreground">
              <p>
                Estado actual: <strong>{getEtiquetaEstado(orden.estado)}</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!nuevoEstado || nuevoEstado === orden?.estado}>
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}