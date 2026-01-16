"use client"
import InventoryView from "@/components/inventory/inventoryView" // Ajusta la ruta según donde guardaste el archivo
import { Toaster } from "sonner"

export default function TestInventoryPage() {
  return (
    <main className="bg-[#f2f2f7] min-h-screen">
      {/* Añadimos el Toaster para ver las notificaciones de éxito/error */}
      <Toaster position="top-center" richColors />
      
      {/* Renderizamos solo la vista de inventario */}
      <InventoryView />
    </main>
  )
}