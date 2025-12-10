// @/components/orden/orders-table.tsx
"use client"

import { useState, useMemo } from "react"
import { type OrdenServicio, EstadoOrden } from "@/lib/types/orden"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils/order-utils"
import { Trash2, Eye, Clock, Pencil, Archive, Zap, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { StatusEditModal } from "@/components/orden/status-edit-modal"
import { OrderDetailModal } from "@/components/orden/order-detail-modal"

interface OrdersTableProps {
  ordenes: OrdenServicio[]
  onDelete: (ordenId: string) => void
  onStatusChange: (ordenId: string, nuevoEstado: EstadoOrden) => void
  onEdit: (orden: OrdenServicio) => void
  smrLogoBase64: string | undefined
  bcvRate: number
}

// Configuración de colores
const estadoBadgeVariant = (estado: string) => {
  const upperState = estado?.toUpperCase();
  switch (upperState) {
    case "PENDIENTE": return "secondary" 
    case "PROCESO": return "default"   
    case "TERMINADO": return "success" 
    case "CANCELADO": return "destructive" 
    default: return "outline"
  }
}

const getEtiquetaEstado = (estado?: string) => {
  if (!estado) return "Sin estado"
  const map: Record<string, string> = {
      "PENDIENTE": "Pendiente",
      "PROCESO": "En Proceso",
      "TERMINADO": "Terminado",
      "CANCELADO": "Cancelado"
  }
  return map[estado.toUpperCase()] || estado;
}

export function OrdersTable({
  ordenes,
  onDelete,
  onStatusChange,
  onEdit,
  smrLogoBase64,
  bcvRate,
}: OrdersTableProps) {
  
  const [searchTerm, setSearchTerm] = useState("")
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [selectedOrden, setSelectedOrden] = useState<OrdenServicio | null>(null)

  // 1. Filtrado
  const filteredOrders = useMemo(() => {
    return ordenes.filter((orden) => {
      const term = searchTerm.toLowerCase()
      const nOrden = String(orden.ordenNumero || "").toLowerCase()
      const cliente = (orden.cliente?.nombreRazonSocial || "").toLowerCase()
      const rif = (orden.cliente?.rifCedula || "").toLowerCase()
      return nOrden.includes(term) || cliente.includes(term) || rif.includes(term)
    })
  }, [ordenes, searchTerm])

  // 2. Separación
  const { activeOrders, historyOrders } = useMemo(() => {
    const active: OrdenServicio[] = []
    const history: OrdenServicio[] = []

    const sorted = [...filteredOrders].sort((a, b) => 
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );

    sorted.forEach(orden => {
        const estadoNormalized = orden.estado?.toUpperCase();
        if (estadoNormalized === "PENDIENTE" || estadoNormalized === "PROCESO") {
            active.push(orden)
        } else {
            history.push(orden)
        }
    })

    return { activeOrders: active, historyOrders: history }
  }, [filteredOrders])

  const openDetail = (o: OrdenServicio) => { setSelectedOrden(o); setIsDetailModalOpen(true) }
  const openStatus = (o: OrdenServicio) => { setSelectedOrden(o); setIsStatusModalOpen(true) }

  return (
    <div className="space-y-10 pb-20">
      
      {/* BUSCADOR */}
      <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur py-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar orden, cliente, RIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-full text-sm bg-white dark:bg-gray-950 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
        </div>
      </div>

      {/* --- TABLA 1: ACTIVAS --- */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full"><Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Órdenes en Curso</h2>
            <Badge className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:text-white">{activeOrders.length}</Badge>
        </div>

        <Card className="border-t-4 border-t-blue-500 shadow-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardContent className="p-0">
                <OrdersSubTable 
                    data={activeOrders}
                    isHistory={false}
                    actions={{ onDelete, onEdit, openDetail, openStatus }}
                />
            </CardContent>
        </Card>
      </div>

      {/* --- TABLA 2: HISTORIAL --- */}
      <div className="space-y-4 pt-8">
        <div className="flex items-center gap-2 opacity-80">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><Archive className="w-5 h-5 text-gray-600 dark:text-gray-400" /></div>
            <h2 className="text-xl font-bold text-gray-600 dark:text-gray-400">Historial de Finalizados</h2>
            <Badge variant="outline" className="dark:text-gray-300 dark:border-gray-700">{historyOrders.length}</Badge>
        </div>

        <Card className="border-t-4 border-t-gray-400 shadow-sm bg-gray-50/50 dark:bg-gray-900/50 opacity-90 border-gray-200 dark:border-gray-800">
            <CardContent className="p-0">
                <OrdersSubTable 
                    data={historyOrders}
                    isHistory={true}
                    actions={{ onDelete, onEdit, openDetail, openStatus }}
                />
            </CardContent>
        </Card>
      </div>

      {/* MODALES */}
      {selectedOrden && (
        <>
          <OrderDetailModal orden={selectedOrden} open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} smrLogoBase64={smrLogoBase64} bcvRate={bcvRate} />
          <StatusEditModal isOpen={isStatusModalOpen} orden={selectedOrden} onClose={() => setIsStatusModalOpen(false)} onSave={(ordenId, nuevoEstado) => { onStatusChange(ordenId, nuevoEstado); setIsStatusModalOpen(false); }} />
        </>
      )}
    </div>
  )
}

// --- SUB-COMPONENTE TABLA ---
function OrdersSubTable({ data, isHistory, actions }: any) {
    const [page, setPage] = useState(1);
    const pageSize = isHistory ? 10 : 20; 
    const totalPages = Math.ceil(data.length / pageSize);
    
    useMemo(() => { if(page > totalPages && totalPages > 0) setPage(1) }, [data.length]);

    const paginatedData = data.slice((page - 1) * pageSize, page * pageSize);

    if (data.length === 0) {
        return <div className="p-10 text-center text-gray-400 dark:text-gray-500 italic">No hay órdenes en esta lista.</div>
    }

    return (
        <div>
            <Table>
                <TableHeader>
                    <TableRow className={isHistory ? "bg-gray-100 dark:bg-gray-800" : "bg-blue-50/30 dark:bg-blue-900/20"}>
                        <TableHead className="w-[100px] text-gray-700 dark:text-gray-300">N° Orden</TableHead>
                        <TableHead className="text-gray-700 dark:text-gray-300">Cliente</TableHead>
                        <TableHead className="text-right text-gray-700 dark:text-gray-300">Total ($)</TableHead>
                        <TableHead className="text-center text-gray-700 dark:text-gray-300">Estado</TableHead>
                        <TableHead className="text-center text-gray-700 dark:text-gray-300">Fecha Entrega</TableHead>
                        <TableHead className="text-center text-gray-700 dark:text-gray-300">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedData.map((orden: OrdenServicio) => {
                        const fechaMostrar = orden.fechaEntrega ? formatDate(orden.fechaEntrega) : formatDate(orden.fecha)
                        
                        return (
                            <TableRow key={orden.id} className={isHistory ? "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b dark:border-gray-800" : "hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors border-b dark:border-gray-800"}>
                                <TableCell className="font-bold text-gray-700 dark:text-gray-200">
                                    #{orden.ordenNumero}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{orden.cliente?.nombreRazonSocial || "General"}</div>
                                    <div className="text-[10px] text-muted-foreground">{orden.cliente?.rifCedula}</div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(orden.totalUSD)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant={estadoBadgeVariant(orden.estado)} className="text-[10px] px-2 py-0.5">
                                        {getEtiquetaEstado(orden.estado)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center text-xs text-gray-500 dark:text-gray-400">
                                    {fechaMostrar}
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => actions.openDetail(orden)} title="Ver">
                                            <Eye className="w-4 h-4"/>
                                        </Button>
                                        
                                        {!isHistory && (
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20" onClick={() => actions.onEdit(orden)} title="Editar">
                                                <Pencil className="w-4 h-4"/>
                                            </Button>
                                        )}

                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => actions.openStatus(orden)} title="Estado">
                                            <Clock className="w-4 h-4"/>
                                        </Button>

                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => actions.onDelete(orden.id)} title="Eliminar">
                                            <Trash2 className="w-4 h-4"/>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>

            {totalPages > 1 && (
                <div className="flex justify-end items-center p-2 gap-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-900/20">
                    <span className="text-xs text-muted-foreground">Pág {page} de {totalPages}</span>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-white dark:bg-gray-800" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page===1}><ChevronLeft className="w-4 h-4"/></Button>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-white dark:bg-gray-800" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page===totalPages}><ChevronRight className="w-4 h-4"/></Button>
                    </div>
                </div>
            )}
        </div>
    )
}