// @/components/orden/orders-table.tsx
"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { type OrdenServicio, EstadoOrden } from "@/lib/types/orden"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils/order-utils"
import { 
    Trash2, Eye, Clock, Pencil, Archive, Zap, 
    ChevronLeft, ChevronRight, ChevronDown, User, Hash, Calendar, DollarSign
} from "lucide-react"
import { StatusEditModal } from "@/components/orden/status-edit-modal"
import { OrderDetailModal } from "@/components/orden/order-detail-modal"
import { cn } from "@/lib/utils"

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
    <div className="space-y-6 md:space-y-12 pb-24 px-1 sm:px-0">
      
      {/* --- SECCIÓN: ÓRDENES ACTIVAS --- */}
      <section className="space-y-4 md:space-y-6">
        <button 
            onClick={() => setShowActive(!showActive)}
            className="group flex items-center justify-between w-full p-3 md:p-4 bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 transition-all shadow-sm outline-none"
        >
            <div className="flex items-center gap-3 md:gap-5">
                <div className="p-2 md:p-3 bg-blue-600 rounded-xl md:rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none group-hover:rotate-6 transition-transform">
                    <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="text-left">
                    <h2 className="text-base md:text-xl font-black text-slate-800 dark:text-white tracking-tight">Órdenes en Curso</h2>
                    <p className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest">Producción Activa en Taller</p>
                </div>
                <Badge className="ml-2 md:ml-4 bg-blue-600 text-white border-none px-2 md:px-3 rounded-full">{activeOrders.length}</Badge>
            </div>
            <ChevronDown className={cn("w-5 h-5 md:w-6 md:h-6 text-slate-400 transition-transform duration-500", showActive && 'rotate-180')} />
        </button>

        <AnimatePresence>
            {showActive && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }} className="overflow-hidden">
                    <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden">
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
      <section className="space-y-4 md:space-y-6">
        <button 
            onClick={() => setShowHistory(!showHistory)}
            className="group flex items-center justify-between w-full p-3 md:p-4 bg-white/30 dark:bg-slate-900/30 hover:bg-white/50 rounded-2xl md:rounded-[2rem] border border-slate-200/50 transition-all outline-none"
        >
            <div className="flex items-center gap-3 md:gap-5 opacity-70">
                <div className="p-2 md:p-3 bg-slate-200 dark:bg-slate-800 rounded-xl md:rounded-2xl transition-transform group-hover:-rotate-6">
                    <Archive className="w-5 h-5 md:w-6 md:h-6 text-slate-600" />
                </div>
                <div className="text-left">
                    <h2 className="text-base md:text-xl font-black text-slate-600 dark:text-slate-400 tracking-tight">Historial</h2>
                    <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest">Cerradas o Canceladas</p>
                </div>
                <Badge variant="outline" className="ml-2 md:ml-4 rounded-full border-slate-300 text-slate-500">{historyOrders.length}</Badge>
            </div>
            <ChevronDown className={cn("w-5 h-5 md:w-6 md:h-6 text-slate-400 transition-transform duration-500", showHistory && 'rotate-180')} />
        </button>

        <AnimatePresence>
            {showHistory && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }} className="overflow-hidden">
                    <Card className="border-none shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden opacity-90">
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

// --- SUB-TABLA RESPONSIVA ---
function OrdersSubTable({ data, isHistory, actions }: any) {
    const [page, setPage] = useState(1);
    const pageSize = 12;
    const totalPages = Math.ceil(data.length / pageSize);
    const paginated = data.slice((page - 1) * pageSize, page * pageSize);

    if (data.length === 0) {
        return <div className="p-10 md:p-20 text-center text-slate-400 font-bold italic bg-slate-50/50 dark:bg-slate-800/20 text-sm">No hay órdenes registradas aquí.</div>
    }

    return (
        <div className="w-full">
            {/* VISTA DESKTOP: Tabla completa (visible desde md) */}
            <div className="hidden md:block overflow-x-auto">
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
                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
            </div>

            {/* VISTA MÓVIL: Lista de tarjetas (visible solo en sm/xs) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.map((o: OrdenServicio) => (
                    <div key={o.id} className="p-4 space-y-4 bg-white dark:bg-slate-900 active:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">#{o.ordenNumero}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate max-w-[180px]">{o.cliente?.nombreRazonSocial || o.clienteNombre}</span>
                            </div>
                            <Badge className={cn("rounded-lg px-3 py-1 font-black text-[9px] uppercase tracking-wider border shadow-sm", getBadgeStyles(o.estado))}>
                                {getEtiquetaEstado(o.estado)}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                <DollarSign className="w-3 h-3 text-emerald-500"/>
                                <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(o.totalUSD)}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                <Calendar className="w-3 h-3 text-blue-500"/>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{formatDate(o.fechaEntrega || o.fecha)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-around gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                            <ActionButton icon={<Eye />} color="blue" onClick={() => actions.handleOpenDetail(o)} label="Ver" isMobile />
                            {!isHistory && <ActionButton icon={<Pencil />} color="orange" onClick={() => actions.onEdit(o)} label="Editar" isMobile />}
                            <ActionButton icon={<Clock />} color="green" onClick={() => actions.handleOpenStatus(o)} label="Estado" isMobile />
                            <ActionButton icon={<Trash2 />} color="rose" onClick={() => actions.onDelete(o.id)} label="Borrar" isMobile />
                        </div>
                    </div>
                ))}
            </div>

            {/* PAGINACIÓN RESPONSIVA */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 md:p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 gap-4">
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 order-2 sm:order-1 uppercase tracking-widest">Mostrando {paginated.length} de {data.length} órdenes</p>
                    <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="rounded-xl border-slate-200 shadow-sm h-8 w-8 p-0 md:h-9 md:w-9"><ChevronLeft className="w-4 h-4"/></Button>
                        <div className="flex items-center px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Pág {page} / {totalPages}</div>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="rounded-xl border-slate-200 shadow-sm h-8 w-8 p-0 md:h-9 md:w-9"><ChevronRight className="w-4 h-4"/></Button>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- MINI COMPONENTE: BOTÓN DE ACCIÓN ---
function ActionButton({ icon, color, onClick, label, isMobile }: any) {
    const colors: any = {
        blue: "text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20",
        orange: "text-orange-600 bg-orange-50 hover:bg-orange-600 hover:text-white border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20",
        green: "text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20",
        rose: "text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20"
    }
    return (
        <button 
            onClick={onClick}
            title={label}
            className={cn(
                "rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm border active:scale-95",
                isMobile ? "w-11 h-11 flex-1 max-w-[60px]" : "w-9 h-9 hover:shadow-md hover:-translate-y-1",
                colors[color]
            )}
        >
            {React.cloneElement(icon, { className: isMobile ? "w-5 h-5" : "w-4 h-4" })}
        </button>
    )
}