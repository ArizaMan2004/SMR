// @/components/orden/PaymentHistoryView.tsx
"use client"

import React, { useState } from 'react'
import { formatCurrency } from '@/lib/utils/order-utils'
import { format, isValid } from 'date-fns' 
import { es } from 'date-fns/locale'
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { 
    Eye, ExternalLink, CalendarX, 
    CreditCard, Banknote, Wallet, Building2, Tag, Coins 
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PagoTransaction {
    montoUSD: number
    fechaRegistro?: string | any 
    fecha?: string | any
    timestamp?: string | any
    registradoPorUserId: string
    nota?: string | null
    imagenUrl?: string | null 
    metodo?: string // ✅ Campo vital para saber la billetera
    tasaBCV?: number
}

interface PaymentHistoryViewProps {
    historial: PagoTransaction[]
    totalOrdenUSD: number
    montoPagadoUSD: number
}

export function PaymentHistoryView({ 
    historial, 
    totalOrdenUSD, 
    montoPagadoUSD,
}: PaymentHistoryViewProps) {
    
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const pendiente = totalOrdenUSD - montoPagadoUSD

    // Ordenar: lo más reciente primero
    const sortedHistorial = [...historial].sort((a, b) => {
        const dateA = a.fechaRegistro || a.fecha || a.timestamp || 0;
        const dateB = b.fechaRegistro || b.fecha || b.timestamp || 0;
        const timeA = dateA?.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
        const timeB = dateB?.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
        return timeB - timeA;
    })

    // Helper para íconos y estilos según la billetera
    const getMethodStyles = (metodo: string = "") => {
        const m = metodo.toLowerCase();
        
        if (m.includes('zelle')) return { icon: CreditCard, color: "text-purple-600 bg-purple-50", label: "Zelle" };
        if (m.includes('banco') || m.includes('pago movil') || m.includes('bs')) return { icon: Building2, color: "text-blue-600 bg-blue-50", label: "Banco / Bs" };
        if (m.includes('efectivo')) return { icon: Banknote, color: "text-emerald-600 bg-emerald-50", label: "Efectivo" };
        if (m.includes('binance') || m.includes('usdt')) return { icon: Coins, color: "text-orange-500 bg-orange-50", label: "Binance" };
        if (m.includes('descuento') || m.includes('ajuste')) return { icon: Tag, color: "text-amber-600 bg-amber-50", label: "Ajuste / Cierre" };
        
        return { icon: Wallet, color: "text-slate-500 bg-slate-100", label: m || "Otro" };
    }

    return (
        <div className="space-y-6 w-full bg-white dark:bg-gray-900/50 rounded-lg p-2 border border-gray-100 dark:border-gray-800">
            
            {/* SECCIÓN DE TOTALES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Orden:</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalOrdenUSD)}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Abonado:</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(montoPagadoUSD)}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Restante:</p>
                    <p className={`text-xl font-bold ${pendiente > 0.01 ? 'text-red-500' : 'text-gray-400'}`}>
                        {formatCurrency(Math.max(0, pendiente))}
                    </p>
                </div>
            </div>

            {/* TABLA DE PAGOS */}
            <div className="rounded-md border bg-white dark:bg-black/20 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800">
                        <TableRow>
                            <TableHead className="w-[110px] text-[10px] uppercase font-bold tracking-wider">Fecha</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-wider">Billetera / Método</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold tracking-wider">Nota</TableHead>
                            <TableHead className="text-center w-[60px] text-[10px] uppercase font-bold tracking-wider">Ref.</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedHistorial.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground text-xs italic">
                                    No hay movimientos registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedHistorial.map((pago, idx) => {
                                const rawDate = pago.fechaRegistro || pago.fecha || pago.timestamp;
                                const dateObj = rawDate?.toDate ? rawDate.toDate() : (rawDate ? new Date(rawDate) : null);
                                const dateIsValid = dateObj && isValid(dateObj);
                                
                                const style = getMethodStyles(pago.metodo);
                                const Icon = style.icon;
                                const isDiscount = pago.metodo === 'DESCUENTO';

                                return (
                                    <TableRow key={idx} className={cn("hover:bg-muted/30 group transition-colors", isDiscount && "bg-amber-50/30 dark:bg-amber-900/10")}>
                                        {/* FECHA */}
                                        <TableCell className="py-3">
                                            <div className="flex flex-col">
                                                {dateIsValid ? (
                                                    <>
                                                        <span className="font-bold text-gray-700 dark:text-gray-200 text-xs">
                                                            {format(dateObj, 'dd MMM yy', { locale: es })}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {format(dateObj, 'hh:mm a')}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-red-400 italic text-[10px]">
                                                        <CalendarX className="w-3 h-3" /> Error
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        
                                        {/* MÉTODO / BILLETERA (Aquí está la precisión que pediste) */}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={cn("p-1.5 rounded-md flex-shrink-0", style.color)}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase leading-none mb-0.5">
                                                        {style.label}
                                                    </span>
                                                    {pago.tasaBCV && pago.tasaBCV > 0 && (
                                                        <span className="text-[9px] text-muted-foreground font-mono">
                                                            Tasa: {pago.tasaBCV.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* NOTA */}
                                        <TableCell>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 italic max-w-[200px] truncate" title={pago.nota || ""}>
                                                {pago.nota || "-"}
                                            </p>
                                        </TableCell>

                                        {/* FOTO / EVIDENCIA */}
                                        <TableCell className="text-center">
                                            {pago.imagenUrl ? (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-7 w-7 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full"
                                                    onClick={() => setPreviewImage(pago.imagenUrl || null)}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-gray-300">-</span>
                                            )}
                                        </TableCell>

                                        {/* MONTO */}
                                        <TableCell className="text-right">
                                            <span className={cn(
                                                "font-black text-sm",
                                                isDiscount ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-400"
                                            )}>
                                                {isDiscount && "- "}{formatCurrency(pago.montoUSD)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* MODAL DE PREVISUALIZACIÓN */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-4xl p-0 bg-transparent border-none shadow-none flex justify-center items-center pointer-events-none">
                    <DialogTitle className="sr-only">Comprobante</DialogTitle>
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {previewImage && (
                                <a href={previewImage} target="_blank" rel="noreferrer" className="p-2 bg-black/60 text-white rounded-full hover:bg-black/80">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>
                        {previewImage && (
                            <img src={previewImage} alt="Comprobante" className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white" />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}