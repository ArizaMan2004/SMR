// @/components/dashboard/PaymentEditModal.tsx

"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatCurrency } from '@/lib/utils/order-utils'

// 🔑 CORRECCIÓN CRÍTICA (Línea 14): La ruta debe ser "@/components/orden/PaymentHistoryView" y debe estar cerrada.
// El tipo PagoTransaction todavía es necesario para tipar el historial
import { type PagoTransaction } from "@/components/orden/PaymentHistoryView" 
import { type OrdenServicio } from '@/lib/types/orden'
import { AlertTriangle, DollarSign } from 'lucide-react'


interface PaymentEditModalProps {
    isOpen: boolean
    orden: OrdenServicio
    // onSave ahora recibe solo el abono y la nota
    onSave: (abonoUSD: number, nota: string | undefined) => void 
    onClose: () => void
    currentUserId: string
    // Mantenemos el tipo por si la función 'onSave' lo requiere, pero no lo renderizamos.
    historialPagos?: PagoTransaction[] 
}

export function PaymentEditModal({ isOpen, orden, onSave, onClose }: PaymentEditModalProps) {
    
    const [abonoAmount, setAbonoAmount] = useState<number>(0) 
    const [nota, setNota] = useState<string>('') 

    const montoTotal = orden.totalUSD
    const montoPagado = orden.montoPagadoUSD || 0
    const montoPendiente = montoTotal - montoPagado
    const canSave = abonoAmount > 0 && abonoAmount <= montoPendiente

    const handleSave = () => {
        if (!canSave) return
        
        onSave(abonoAmount, nota.trim() || undefined)
        setAbonoAmount(0)
        setNota('')
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center">
                        <DollarSign className="w-6 h-6 mr-2 text-green-600" />
                        Registrar Abono | Orden #{orden.ordenNumero}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="space-y-2 p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/50">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Orden: 
                            <span className="font-semibold ml-1">{formatCurrency(montoTotal)}</span>
                        </p>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Abonado: 
                            <span className="font-semibold ml-1 text-green-600 dark:text-green-400">{formatCurrency(montoPagado)}</span>
                        </p>
                        <p className="text-lg font-bold">Saldo Pendiente: 
                            <span className="text-destructive dark:text-red-400 ml-2">{formatCurrency(montoPendiente)}</span>
                        </p>
                    </div>

                    {/* Formulario de Registro de Nuevo Abono */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Monto del Abono (USD)</label>
                            <Input
                                type="number"
                                placeholder={`Máx. ${montoPendiente.toFixed(2)}`}
                                value={abonoAmount || ''}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value)
                                    if (value >= 0 && value <= montoPendiente) {
                                        setAbonoAmount(value)
                                    } else if (value > montoPendiente) {
                                        setAbonoAmount(montoPendiente)
                                    } else {
                                        setAbonoAmount(0)
                                    }
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Notas del Abono (Opcional)</label>
                            <Textarea
                                placeholder="Referencia bancaria, método de pago, etc."
                                value={nota}
                                onChange={(e) => setNota(e.target.value)}
                            />
                        </div>
                        
                        {montoPendiente === 0 && (
                            <Alert>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>¡Orden Pagada!</AlertTitle>
                                <AlertDescription>
                                    El saldo es cero. No se pueden registrar más abonos.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={!canSave || montoPendiente === 0}
                    >
                        Registrar Abono {formatCurrency(abonoAmount)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}