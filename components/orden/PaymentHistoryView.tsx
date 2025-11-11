// @/components/orden/PaymentHistoryView.tsx
"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils/order-utils"
import { DollarSign, Clock } from "lucide-react"

// EXPORTACIÓN NOMBRADA DEL TIPO (se mantiene)
export type PagoTransaction = {
    montoUSD: number;
    fechaRegistro: string; // ISO String
    registradoPorUserId?: string | null; // Aceptamos que pueda ser nulo o indefinido
    nota?: string | null;
};

interface PaymentHistoryViewProps {
    historial: PagoTransaction[];
    totalOrdenUSD: number;
    montoPagadoUSD: number;
}

// EXPORTACIÓN NOMBRADA DEL COMPONENTE (se mantiene)
export function PaymentHistoryView({ historial, totalOrdenUSD, montoPagadoUSD }: PaymentHistoryViewProps) {
    
    // Ordenar historial de la transacción más reciente a la más antigua
    const historialOrdenado = [...historial].sort((a, b) => 
        new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime()
    );

    const montoPendiente = totalOrdenUSD - montoPagadoUSD;
    const isPaid = montoPendiente <= 0.01;

    return (
        // ✅ Ajuste del contenedor principal
        <div className="rounded-lg border bg-white dark:bg-gray-800 shadow-md overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground dark:text-gray-100">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    Historial de Pagos y Abonos
                </h3>
            </div>
            
            <div className="p-4 grid grid-cols-3 gap-4 text-sm dark:text-gray-300">
                <div className="space-y-1">
                    <p className="font-medium text-muted-foreground dark:text-gray-400">Total de la Orden:</p>
                    <p className="font-bold text-lg text-primary">{formatCurrency(totalOrdenUSD)}</p>
                </div>
                <div className="space-y-1">
                    <p className="font-medium text-muted-foreground dark:text-gray-400">Total Pagado:</p>
                    <p className="font-bold text-lg text-green-600 dark:text-green-500">{formatCurrency(montoPagadoUSD)}</p>
                </div>
                <div className="space-y-1">
                    <p className="font-medium text-muted-foreground dark:text-gray-400">Monto Pendiente:</p>
                    <p className={`font-bold text-lg ${isPaid ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(montoPendiente)}
                    </p>
                </div>
            </div>

            <Table>
                {/* ✅ Dark Mode: Fondo más oscuro en la cabecera de la tabla */}
                <TableHeader className="bg-gray-50 dark:bg-gray-700/50">
                    <TableRow>
                        <TableHead className="w-[150px]">Fecha</TableHead>
                        <TableHead className="text-right">Monto (USD)</TableHead>
                        <TableHead className="w-1/2">Nota</TableHead>
                        <TableHead className="text-center w-[120px]">Registro</TableHead>
                    </TableRow>
                </TableHeader>
                
                <TableBody>
                    {historialOrdenado.map((pago, index) => {
                        const userId = pago.registradoPorUserId;
                        const userIdDisplay = userId ? `User...${userId.slice(-4)}` : 'Sistema / Desconocido';
                        
                        return (
                        <TableRow key={index} className="text-sm hover:bg-gray-50/50 dark:hover:bg-gray-700/80 transition-colors">
                            {/* ✅ Dark Mode: Aseguramos el color del texto de la fecha */}
                            <TableCell className="dark:text-gray-300">{formatDate(pago.fechaRegistro, true)}</TableCell>
                            <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">
                                {formatCurrency(pago.montoUSD)}
                            </TableCell>
                            {/* ✅ Dark Mode: Aseguramos el color del texto secundario de la nota */}
                            <TableCell className="text-muted-foreground italic max-w-xs overflow-hidden text-ellipsis dark:text-gray-400">
                                {pago.nota || '—'}
                            </TableCell>
                            <TableCell className="text-center">
                                {/* Muestra solo una parte del ID para referencia */}
                                <Badge variant="secondary" className="text-xs">
                                    {userIdDisplay}
                                </Badge>
                            </TableCell>
                        </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
            
            {historial.length === 0 && (
                <div className="text-center text-muted-foreground p-4 dark:text-gray-400">
                    Aún no hay abonos registrados para esta orden.
                </div>
            )}
        </div>
    )
}