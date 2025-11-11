// @/components/orden/orders-table.tsx
"use client"

import type React from "react"
import { type OrdenServicio, EstadoOrden } from "@/lib/types/orden"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils/order-utils"
import { Trash2, Eye, Clock, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { StatusEditModal } from "@/components/orden/status-edit-modal"
import { OrderDetailModal } from "@/components/orden/order-detail-modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Tipo para la configuración de ordenamiento
type SortKey = keyof OrdenServicio | "cliente.nombreRazonSocial"

interface OrdersTableProps {
  ordenes: OrdenServicio[]
  onDelete: (ordenId: string) => void
  onStatusChange: (ordenId: string, nuevoEstado: EstadoOrden) => void
  smrLogoBase64: string | undefined
  bcvRate: number
}

// Lógica de variantes de Badge (Colores)
const estadoBadgeVariant = (estado: EstadoOrden) => {
  switch (estado) {
    case EstadoOrden.PENDIENTE:
      return "secondary"
    case EstadoOrden.PROCESO:
      return "default"
    case EstadoOrden.TERMINADO:
      return "success"
    case EstadoOrden.CANCELADO:
      return "destructive"
    default:
      return "secondary"
  }
}

// ✅ Corregido: Maneja estados undefined o nulos
const getEtiquetaEstado = (estado?: EstadoOrden) => {
  if (!estado || typeof estado !== "string") return "Sin estado"
  return estado.charAt(0) + estado.slice(1).toLowerCase().replace("_", " ")
}

const ITEMS_PER_PAGE = 10

export function OrdersTable({
  ordenes,
  onDelete,
  onStatusChange,
  smrLogoBase64,
  bcvRate,
}: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<EstadoOrden | "ALL">("ALL")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "ascending" | "descending" } | null>({
    key: "fecha" as keyof OrdenServicio,
    direction: "descending",
  })

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [selectedOrden, setSelectedOrden] = useState<OrdenServicio | null>(null)

  const handleOpenDetailModal = (orden: OrdenServicio) => {
    setSelectedOrden(orden)
    setIsDetailModalOpen(true)
  }

  const handleOpenStatusModal = (orden: OrdenServicio) => {
    setSelectedOrden(orden)
    setIsStatusModalOpen(true)
  }

  const handleSort = (key: SortKey) => {
    let direction: "ascending" | "descending" = "ascending"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }
    setSortConfig({ key, direction })
  }

  const filteredAndSortedOrdenes = useMemo(() => {
    let filtered = ordenes.filter((orden) => {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()

      const matchesOrden = (String(orden.ordenNumero) || "").toLowerCase().includes(lowerCaseSearchTerm)
      const matchesCliente = orden.cliente?.nombreRazonSocial?.toLowerCase().includes(lowerCaseSearchTerm)
      const matchesRif = orden.cliente?.rifCedula?.toLowerCase().includes(lowerCaseSearchTerm)
      const statusMatch = filterStatus === "ALL" || orden.estado === filterStatus

      return (matchesOrden || matchesCliente || matchesRif) && statusMatch
    })

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        if (sortConfig.key === "cliente.nombreRazonSocial") {
          aValue = a.cliente?.nombreRazonSocial || ""
          bValue = b.cliente?.nombreRazonSocial || ""
        } else {
          aValue = a[sortConfig.key as keyof OrdenServicio]
          bValue = b[sortConfig.key as keyof OrdenServicio]
        }

        if (aValue === undefined || aValue === null) return sortConfig.direction === "ascending" ? 1 : -1
        if (bValue === undefined || bValue === null) return sortConfig.direction === "ascending" ? -1 : 1

        if (aValue < bValue) return sortConfig.direction === "ascending" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "ascending" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [ordenes, searchTerm, filterStatus, sortConfig])

  // Paginación
  const totalItems = filteredAndSortedOrdenes.length
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  const paginatedOrdenes = filteredAndSortedOrdenes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages)
  }
  if (currentPage > 1 && totalPages === 0) {
    setCurrentPage(1)
  }

  const getSortIcon = (key: SortKey) => {
    if (sortConfig && sortConfig.key === key) {
      return sortConfig.direction === "ascending" ? " ▲" : " ▼"
    }
    return ""
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden border border-border/70">
      {/* Barra de búsqueda y filtro */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-border/70">
        <input
          type="text"
          placeholder="Buscar por N° Orden o Cliente/RIF..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setCurrentPage(1)
          }}
          className="flex-1 min-w-[200px] px-3 py-2 border rounded-md text-sm bg-background dark:bg-gray-700/50"
        />
        <div className="w-full sm:w-auto sm:min-w-[180px]">
          <Select
            value={filterStatus}
            onValueChange={(value: EstadoOrden | "ALL") => {
              setFilterStatus(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-full">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los Estados</SelectItem>
              {Object.values(EstadoOrden).map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {getEtiquetaEstado(estado)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla de órdenes */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors">
              <TableHead className="cursor-pointer" onClick={() => handleSort("ordenNumero")}>
                N° Orden{getSortIcon("ordenNumero")}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort("cliente.nombreRazonSocial")}>
                Cliente{getSortIcon("cliente.nombreRazonSocial")}
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => handleSort("totalUSD")}>
                Total (USD){getSortIcon("totalUSD")}
              </TableHead>
              <TableHead className="text-center cursor-pointer" onClick={() => handleSort("estado")}>
                Estado{getSortIcon("estado")}
              </TableHead>
              <TableHead className="text-center cursor-pointer" onClick={() => handleSort("fecha")}>
                Fecha{getSortIcon("fecha")}
              </TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrdenes.length > 0 ? (
              paginatedOrdenes.map((orden, index) => {
                const primaryDate = orden.fechaEntrega ? formatDate(orden.fechaEntrega) : formatDate(orden.fecha)
                const isDeliveryDate = !!orden.fechaEntrega

                return (
                  <TableRow
                    key={orden.id}
                    className={`${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-800/70"
                    } hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`}
                  >
                    <TableCell className="font-medium text-primary">{orden.ordenNumero}</TableCell>
                    <TableCell>
                      <p className="font-medium leading-tight dark:text-gray-200">
                        {orden.cliente?.nombreRazonSocial || "Sin cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        RIF: {orden.cliente?.rifCedula || "N/A"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(orden.totalUSD)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={estadoBadgeVariant(orden.estado || EstadoOrden.PENDIENTE)}>
                        {getEtiquetaEstado(orden.estado)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      <p
                        className={`font-semibold ${
                          isDeliveryDate
                            ? "text-green-600 dark:text-green-400"
                            : "text-foreground dark:text-gray-200"
                        }`}
                      >
                        {primaryDate}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400 mt-0.5" title="Fecha de creación">
                        Creada: {formatDate(orden.fecha)}
                      </p>
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenDetailModal(orden)} title="Ver Detalles">
                        <Eye className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenStatusModal(orden)}
                        title="Cambiar Estado"
                      >
                        <Clock className="w-4 h-4 text-green-600 dark:text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(orden.id)} title="Eliminar Orden">
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6 dark:text-gray-400">
                  No se encontraron órdenes que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between p-3 border-t border-border/70 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg transition-colors">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          Siguiente <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Modales */}
      {selectedOrden && (
        <>
          <OrderDetailModal
            orden={selectedOrden}
            open={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            smrLogoBase64={smrLogoBase64}
            bcvRate={bcvRate}
          />

          <StatusEditModal
            isOpen={isStatusModalOpen}
            orden={selectedOrden}
            onClose={() => setIsStatusModalOpen(false)}
            onSave={(ordenId, nuevoEstado) => {
              onStatusChange(ordenId, nuevoEstado)
              setIsStatusModalOpen(false)
            }}
          />
        </>
      )}
    </div>
  )
}
