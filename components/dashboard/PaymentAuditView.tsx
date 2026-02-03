// @/components/dashboard/PaymentAuditView.tsx
"use client"

import React, { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { 
    Search, Loader2, Filter, Eye, ExternalLink, 
    CalendarX, Image as ImageIcon, FileText 
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils/order-utils"
import { format, isValid } from 'date-fns'
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { toast } from "sonner"

interface PaymentAuditViewProps {
    ordenes: any[]
}

export function PaymentAuditView({ ordenes }: PaymentAuditViewProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterMethod, setFilterMethod] = useState("ALL")
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    
    // Estado para el modal de imagen (Igual que en tu PaymentHistoryView)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // 1. Aplanar la estructura: De Órdenes -> Lista de Pagos Individuales
    const allPayments = useMemo(() => {
        const pagos: any[] = []
        ordenes.forEach(orden => {
            if (orden.registroPagos && orden.registroPagos.length > 0) {
                orden.registroPagos.forEach((pago: any, index: number) => {
                    // Lógica de fecha robusta (Traída de tu script)
                    const rawDate = pago.fechaRegistro || pago.fecha || pago.timestamp;
                    const dateObj = rawDate?.toDate ? rawDate.toDate() : (rawDate ? new Date(rawDate) : null);
                    
                    pagos.push({
                        uniqueId: `${orden.id}-${index}`,
                        ordenId: orden.id,
                        ordenNumero: orden.ordenNumero,
                        cliente: orden.cliente?.nombreRazonSocial || "Desconocido",
                        monto: pago.montoUSD,
                        dateObj: dateObj, // Objeto fecha procesado
                        metodo: pago.metodo || "Efectivo USD",
                        nota: pago.nota || "",
                        imagenUrl: pago.imagenUrl || null,
                        index: index
                    })
                })
            }
        })
        // Ordenar por fecha (más reciente primero)
        return pagos.sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))
    }, [ordenes])

    // 2. Filtrado
    const filteredPayments = useMemo(() => {
        return allPayments.filter(p => {
            const matchesSearch = 
                p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.ordenNumero.toString().includes(searchTerm) ||
                p.nota.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (filterMethod === "ALL") return matchesSearch;
            if (filterMethod === "PENDING") return matchesSearch && (p.metodo === "Efectivo USD" || !p.metodo);
            return matchesSearch && p.metodo === filterMethod;
        })
    }, [allPayments, searchTerm, filterMethod])

    // 3. Función de Actualización
    const handleUpdateMethod = async (payment: any, newMethod: string) => {
        setUpdatingId(payment.uniqueId)
        try {
            const ordenRef = doc(db, "ordenes", payment.ordenId)
            const ordenSnap = await getDoc(ordenRef)
            
            if (ordenSnap.exists()) {
                const data = ordenSnap.data()
                const registroPagos = [...(data.registroPagos || [])]

                if (registroPagos[payment.index]) {
                    registroPagos[payment.index] = {
                        ...registroPagos[payment.index],
                        metodo: newMethod
                    }
                    await updateDoc(ordenRef, { registroPagos })
                    toast.success("Método actualizado")
                }
            }
        } catch (error) {
            console.error("Error:", error)
            toast.error("Error al actualizar")
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header y Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] shadow-sm border border-black/5">
                <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <Filter className="w-6 h-6 text-blue-600"/> Auditoría de Pagos
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Revisión y clasificación de ingresos ({filteredPayments.length})
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar cliente, nota..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 rounded-xl bg-slate-50 border-slate-200"
                        />
                    </div>
                    
                    <Select value={filterMethod} onValueChange={setFilterMethod}>
                        <SelectTrigger className="w-[180px] rounded-xl font-bold text-xs uppercase bg-slate-100 border-none">
                            <SelectValue placeholder="Filtrar..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="PENDING">Posibles "Sin Clasificar"</SelectItem>
                            <SelectItem value="Efectivo USD">Caja Chica ($)</SelectItem>
                            <SelectItem value="Efectivo Bs">Caja Chica (Bs)</SelectItem> 
                            <SelectItem value="Pago Móvil / Bs">Banco Nacional</SelectItem>
                            <SelectItem value="Zelle">Zelle</SelectItem>
                            <SelectItem value="Binance USDT">Binance</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tabla */}
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                            <tr>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Orden / Cliente</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Detalles</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Evidencia</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Monto</th>
                                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[220px]">Clasificar Como</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredPayments.map((pago) => (
                                <tr key={pago.uniqueId} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                    {/* FECHA */}
                                    <td className="p-5">
                                        <div className="flex flex-col">
                                            {isValid(pago.dateObj) ? (
                                                <>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {format(pago.dateObj, 'dd/MM/yyyy')}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400">
                                                        {format(pago.dateObj, 'hh:mm a')}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] text-red-400 italic">
                                                    <CalendarX className="w-3 h-3" /> Sin fecha
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* CLIENTE */}
                                    <td className="p-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-800 dark:text-white">#{pago.ordenNumero}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px]">{pago.cliente}</span>
                                        </div>
                                    </td>

                                    {/* NOTA / DETALLES */}
                                    <td className="p-5">
                                        <div className="flex items-start gap-2 max-w-[200px]">
                                            <FileText className="w-3 h-3 text-slate-300 mt-0.5 shrink-0" />
                                            <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-tight line-clamp-2">
                                                {pago.nota || "Sin nota"}
                                            </p>
                                        </div>
                                    </td>

                                    {/* EVIDENCIA (CAPTURE) */}
                                    <td className="p-5 text-center">
                                        {pago.imagenUrl ? (
                                            <Button 
                                                variant="ghost" 
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-110 transition-all shadow-sm"
                                                onClick={() => setPreviewImage(pago.imagenUrl)}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        ) : (
                                            <span className="text-slate-200 dark:text-slate-800">
                                                <ImageIcon className="w-4 h-4 mx-auto"/>
                                            </span>
                                        )}
                                    </td>

                                    {/* MONTO */}
                                    <td className="p-5 text-right">
                                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 font-black text-sm border-none px-2.5 py-1">
                                            {formatCurrency(pago.monto)}
                                        </Badge>
                                    </td>

                                    {/* CLASIFICADOR */}
                                    <td className="p-5">
                                        {updatingId === pago.uniqueId ? (
                                            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg animate-pulse">
                                                <Loader2 className="w-3 h-3 animate-spin"/> Guardando...
                                            </div>
                                        ) : (
                                            <Select 
                                                defaultValue={pago.metodo} 
                                                onValueChange={(val) => handleUpdateMethod(pago, val)}
                                            >
                                                <SelectTrigger className={`h-9 rounded-lg border-0 font-bold text-[10px] uppercase shadow-sm ring-1 ring-inset transition-all ${
                                                    pago.metodo === 'Efectivo USD' ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' :
                                                    pago.metodo.includes('Bs') ? 'bg-blue-50 ring-blue-200 text-blue-700' :
                                                    pago.metodo.includes('Zelle') ? 'bg-purple-50 ring-purple-200 text-purple-700' :
                                                    'bg-orange-50 ring-orange-200 text-orange-700'
                                                }`}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Efectivo USD">Caja Chica ($)</SelectItem>
                                                    <SelectItem value="Efectivo Bs">Caja Chica (Bs)</SelectItem>
                                                    <SelectItem value="Pago Móvil / Bs">Banco Nacional (Bs)</SelectItem>
                                                    <SelectItem value="Zelle">Zelle</SelectItem>
                                                    <SelectItem value="Binance USDT">Binance / USDT</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredPayments.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 font-bold uppercase text-xs border-dashed">
                                        No se encontraron pagos con estos filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* --- MODAL DE PREVISUALIZACIÓN DE IMAGEN (Traído de PaymentHistoryView) --- */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center pointer-events-none">
                    <DialogTitle className="sr-only">Comprobante de Pago</DialogTitle>
                    
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {previewImage && (
                                <a href={previewImage} target="_blank" rel="noreferrer" className="p-3 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors backdrop-blur-md">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>
                        {previewImage && (
                            <img 
                                src={previewImage} 
                                alt="Comprobante" 
                                className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl bg-white border-4 border-white/20" 
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}