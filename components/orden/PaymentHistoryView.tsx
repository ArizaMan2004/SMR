// @/components/orden/PaymentHistoryView.tsx

"use client"

import React, { useState } from 'react'
import { formatCurrency } from '@/lib/utils/order-utils'
import { format, isValid } from 'date-fns' // 1. Agregamos isValid
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Eye, ExternalLink, CalendarX } from 'lucide-react'

export interface PagoTransaction {
    montoUSD: number
    fechaRegistro?: string | any // 2. Cambiado a opcional y any para soportar Timestamps
    fecha?: string | any
    timestamp?: string | any
    registradoPorUserId: string
    nota?: string | null
    imagenUrl?: string | null 
}

interface PaymentHistoryViewProps {
    historial: PagoTransaction[]
    totalOrdenUSD: number
    montoPagadoUSD: number
}

export function PaymentHistoryView({ historial, totalOrdenUSD, montoPagadoUSD }: PaymentHistoryViewProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const pendiente = totalOrdenUSD - montoPagadoUSD

    // Ordenamiento seguro manejando posibles fechas nulas
    const sortedHistorial = [...historial].sort((a, b) => {
        const dateA = a.fechaRegistro || a.fecha || a.timestamp || 0;
        const dateB = b.fechaRegistro || b.fecha || b.timestamp || 0;
        const timeA = dateA?.toDate ? dateA.toDate().getTime() : new Date(dateA).getTime();
        const timeB = dateB?.toDate ? dateB.toDate().getTime() : new Date(dateB).getTime();
        return timeB - timeA;
    })

    return (
        <div className="space-y-6 w-full bg-white dark:bg-gray-900/50 rounded-lg p-2 border border-gray-100 dark:border-gray-800">
            
            {/* SECCIÓN DE TOTALES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-4">
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de la Orden:</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalOrdenUSD)}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Pagado:</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(montoPagadoUSD)}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monto Pendiente:</p>
                    <p className={`text-xl font-bold ${pendiente > 0.01 ? 'text-red-500' : 'text-gray-500'}`}>
                        {formatCurrency(Math.max(0, pendiente))}
                    </p>
                </div>
            </div>

            {/* TABLA DE PAGOS */}
            <div className="rounded-md border bg-white dark:bg-black/20 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800">
                        <TableRow>
                            <TableHead className="w-[120px]">Fecha</TableHead>
                            <TableHead>Nota / Referencia</TableHead>
                            <TableHead className="text-center w-[80px]">Foto</TableHead>
                            <TableHead className="text-right">Monto (USD)</TableHead>
                            <TableHead className="text-right w-[100px]">Registro</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedHistorial.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No hay pagos registrados aún.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedHistorial.map((pago, index) => {
                                // 3. Lógica todoterreno para procesar la fecha
                                const rawDate = pago.fechaRegistro || pago.fecha || pago.timestamp;
                                const dateObj = rawDate?.toDate ? rawDate.toDate() : (rawDate ? new Date(rawDate) : null);
                                const dateIsValid = dateObj && isValid(dateObj);

                                return (
                                    <TableRow key={index} className="hover:bg-muted/30">
                                        <TableCell className="text-xs font-medium">
                                            <div className="flex flex-col">
                                                {dateIsValid ? (
                                                    <>
                                                        <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                                                            {format(dateObj, 'dd/MM/yyyy')}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {format(dateObj, 'hh:mm a')}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-red-400 italic">
                                                        <CalendarX className="w-3 h-3" /> Sin fecha
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        
                                        <TableCell>
                                            <div className="text-sm italic text-gray-600 dark:text-gray-400 break-words max-w-[300px]">
                                                {pago.nota || "Sin nota"}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-center">
                                            {pago.imagenUrl ? (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-full"
                                                    onClick={() => setPreviewImage(pago.imagenUrl || null)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground opacity-50">-</span>
                                            )}
                                        </TableCell>

                                        <TableCell className="text-right font-bold text-green-600 dark:text-green-400 text-sm">
                                            {formatCurrency(pago.montoUSD)}
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                                                {pago.registradoPorUserId ? pago.registradoPorUserId.slice(0, 6) : 'N/A'}...
                                            </Badge>
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
                    <DialogTitle className="sr-only">Vista previa del comprobante</DialogTitle>
                    
                    <div className="relative group max-h-[90vh] w-auto pointer-events-auto">
                        <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            {previewImage && (
                                <a href={previewImage} target="_blank" rel="noreferrer" className="p-2 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
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