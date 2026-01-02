// @/components/orden/orders-table.tsx
"use client"

import React, { useState, useMemo } from "react" // Importación de React añadida para solucionar el error
import { motion, AnimatePresence } from "framer-motion"
import { type OrdenServicio, EstadoOrden } from "@/lib/types/orden"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils/order-utils"
import { 
    Trash2, Eye, Clock, Pencil, Archive, Zap, 
    ChevronLeft, ChevronRight, ChevronDown, User, Hash
} from "lucide-react"
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

// --- ESTILOS DE BADGES PROFESIONALES ---
const getBadgeStyles = (estado: string) => {
  const s = estado?.toUpperCase();
  switch (s) {
    case "PENDIENTE": return "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200/50";
    case "PROCESO": return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200/50";
    case "TERMINADO": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200/50";
    case "CANCELADO": return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200/50";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
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
  
  const [selectedOrden, setSelectedOrden] = useState<OrdenServicio | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  // Despliegue de secciones
  const [showActive, setShowActive] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  const { activeOrders, historyOrders } = useMemo(() => {
    const active: OrdenServicio[] = []
    const history: OrdenServicio[] = []

    const sorted = [...ordenes].sort((a, b) => 
        new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );

    sorted.forEach(o => {
        const s = o.estado?.toUpperCase();
        if (s === "PENDIENTE" || s === "PROCESO") active.push(o);
        else history.push(o);
    });

    return { activeOrders: active, historyOrders: history }
  }, [ordenes])

  const handleOpenDetail = (o: OrdenServicio) => { setSelectedOrden(o); setIsDetailModalOpen(true); }
  const handleOpenStatus = (o: OrdenServicio) => { setSelectedOrden(o); setIsStatusModalOpen(true); }

  return (
    <div className="space-y-12 pb-24">
      
      {/* --- SECCIÓN: ÓRDENES ACTIVAS --- */}
      <section className="space-y-6">
        <button 
            onClick={() => setShowActive(!showActive)}
            className="group flex items-center justify-between w-full p-4 bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 transition-all shadow-sm outline-none"
        >
            <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none group-hover:rotate-6 transition-transform">
                    <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Órdenes en Curso</h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Producción Activa en Taller</p>
                </div>
                <Badge className="ml-4 bg-blue-600 text-white border-none px-3 rounded-full">{activeOrders.length}</Badge>
            </div>
            <ChevronDown className={`w-6 h-6 text-slate-400 transition-transform duration-500 ${showActive ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
            {showActive && (
                <motion.div initial={{ opacity: 0, y: -20, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}>
                    <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
                        <CardContent className="p-0">
                            <OrdersSubTable 
                                data={activeOrders} 
                                isHistory={false} 
                                actions={{ onDelete, onEdit, handleOpenDetail, handleOpenStatus }} 
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
      </section>

      {/* --- SECCIÓN: HISTORIAL --- */}
      <section className="space-y-6">
        <button 
            onClick={() => setShowHistory(!showHistory)}
            className="group flex items-center justify-between w-full p-4 bg-white/30 dark:bg-slate-900/30 hover:bg-white/50 rounded-[2rem] border border-slate-200/50 transition-all outline-none"
        >
            <div className="flex items-center gap-5 opacity-70">
                <div className="p-3 bg-slate-200 dark:bg-slate-800 rounded-2xl transition-transform group-hover:-rotate-6">
                    <Archive className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-left">
                    <h2 className="text-xl font-black text-slate-600 dark:text-slate-400 tracking-tight">Historial de Finalizados</h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Cerradas o Canceladas</p>
                </div>
                <Badge variant="outline" className="ml-4 rounded-full border-slate-300 text-slate-500">{historyOrders.length}</Badge>
            </div>
            <ChevronDown className={`w-6 h-6 text-slate-400 transition-transform duration-500 ${showHistory ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
            {showHistory && (
                <motion.div initial={{ opacity: 0, y: -20, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}>
                    <Card className="border-none shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-[2.5rem] overflow-hidden opacity-90">
                        <CardContent className="p-0">
                            <OrdersSubTable 
                                data={historyOrders} 
                                isHistory={true} 
                                actions={{ onDelete, onEdit, handleOpenDetail, handleOpenStatus }} 
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
      </section>

      {/* MODALES */}
      {selectedOrden && (
        <>
            <OrderDetailModal 
                orden={selectedOrden} open={isDetailModalOpen} 
                onClose={() => setIsDetailModalOpen(false)} 
                smrLogoBase64={smrLogoBase64} bcvRate={bcvRate} 
            />
            <StatusEditModal 
                isOpen={isStatusModalOpen} orden={selectedOrden} 
                onClose={() => setIsStatusModalOpen(false)} 
                onSave={(id, s) => { onStatusChange(id, s); setIsStatusModalOpen(false); }} 
            />
        </>
      )}
    </div>
  )
}

// --- SUB-TABLA ---
function OrdersSubTable({ data, isHistory, actions }: any) {
    const [page, setPage] = useState(1);
    const pageSize = 12;
    const totalPages = Math.ceil(data.length / pageSize);
    const paginated = data.slice((page - 1) * pageSize, page * pageSize);

    if (data.length === 0) {
        return <div className="p-20 text-center text-slate-400 font-bold italic bg-slate-50/50 dark:bg-slate-800/20">No hay órdenes registradas aquí.</div>
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="py-6 px-8 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]"><div className="flex items-center gap-2"><Hash className="w-3 h-3"/> Orden</div></TableHead>
                        <TableHead className="py-6 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]"><div className="flex items-center gap-2"><User className="w-3 h-3"/> Cliente</div></TableHead>
                        <TableHead className="py-6 text-right text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Inversión ($)</TableHead>
                        <TableHead className="py-6 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Estado</TableHead>
                        <TableHead className="py-6 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Entrega</TableHead>
                        <TableHead className="py-6 pr-8 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginated.map((o: OrdenServicio) => (
                        <TableRow key={o.id} className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <TableCell className="py-5 px-8">
                                <span className="text-lg font-black text-slate-900 dark:text-white tracking-tighter">#{o.ordenNumero}</span>
                            </TableCell>
                            <TableCell className="py-5">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">{o.cliente?.nombreRazonSocial || o.clienteNombre}</span>
                                    <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{o.cliente?.rifCedula || o.clienteRif}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-5 text-right">
                                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                    {formatCurrency(o.totalUSD)}
                                </span>
                            </TableCell>
                            <TableCell className="py-5 text-center">
                                <Badge className={`rounded-xl px-4 py-1.5 font-black text-[10px] uppercase tracking-wider border transition-all shadow-sm ${getBadgeStyles(o.estado)}`}>
                                    {getEtiquetaEstado(o.estado)}
                                </Badge>
                            </TableCell>
                            <TableCell className="py-5 text-center">
                                <div className="flex flex-col items-center">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{formatDate(o.fechaEntrega || o.fecha)}</span>
                                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{o.fechaEntrega ? 'Pactada' : 'Registro'}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-5 pr-8 text-center">
                                <div className="flex items-center justify-center gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ActionButton icon={<Eye />} color="blue" onClick={() => actions.handleOpenDetail(o)} label="Ver" />
                                    {!isHistory && <ActionButton icon={<Pencil />} color="orange" onClick={() => actions.onEdit(o)} label="Editar" />}
                                    <ActionButton icon={<Clock />} color="green" onClick={() => actions.handleOpenStatus(o)} label="Estado" />
                                    <ActionButton icon={<Trash2 />} color="rose" onClick={() => actions.onDelete(o.id)} label="Borrar" />
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* PAGINACIÓN */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400">Mostrando {paginated.length} de {data.length} órdenes</p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="rounded-xl border-slate-200 shadow-sm"><ChevronLeft className="w-4 h-4"/></Button>
                        <div className="flex items-center px-4 text-xs font-black text-slate-500 uppercase tracking-widest">Pág {page} / {totalPages}</div>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="rounded-xl border-slate-200 shadow-sm"><ChevronRight className="w-4 h-4"/></Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- MINI COMPONENTE: BOTÓN DE ACCIÓN ---
function ActionButton({ icon, color, onClick, label }: any) {
    const colors: any = {
        blue: "text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white border-blue-100",
        orange: "text-orange-600 bg-orange-50 hover:bg-orange-600 hover:text-white border-orange-100",
        green: "text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white border-emerald-100",
        rose: "text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white border-rose-100"
    }
    return (
        <button 
            onClick={onClick}
            title={label}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm border hover:shadow-md hover:-translate-y-1 active:translate-y-0 ${colors[color]}`}
        >
            {React.cloneElement(icon, { className: "w-4 h-4" })}
        </button>
    )
}