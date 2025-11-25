// @/components/dashboard/ClientsAndPaymentsView.tsx

"use client"

import React, { useMemo, useState } from 'react'
import { type OrdenServicio, EstadoPago } from '@/lib/types/orden'
import { formatCurrency, formatBsCurrency } from '@/lib/utils/order-utils' 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
    Wallet, Search, Filter, ArrowLeft, ArrowRight, 
    CheckCircle2, ArrowDown, ArrowUp, DollarSign, 
    CalendarClock, TrendingUp 
} from 'lucide-react'

// --- COMPONENTES IMPORTADOS ---
// Asegúrate de que este path coincida con donde guardaste el historial
import { PaymentHistoryView } from '@/components/orden/PaymentHistoryView' 
import { PaymentEditModal } from '@/components/dashboard/PaymentEditModal'

// --- TIPOS ---
interface ClientSummary {
    key: string
    nombre: string
    rif: string
    totalOrdenes: number
    totalPendienteUSD: number
    ordenesPendientes: OrdenServicio[]
}

const ITEMS_PER_PAGE = 5; 

interface ClientsAndPaymentsViewProps {
    ordenes: OrdenServicio[]
    currentUserId: string 
    bcvRate: number 
    // Actualizado para aceptar imagenUrl
    onRegisterPayment: (ordenId: string, monto: number, nota?: string, imagenUrl?: string) => Promise<void>
}

// Helper para colores de badges
const getPaymentBadgeVariant = (estado: EstadoPago) => {
    switch (estado) {
        case EstadoPago.PAGADO: return "default"; 
        case EstadoPago.ABONADO: return "secondary"; 
        case EstadoPago.ANULADO: return "destructive"; 
        default: return "outline"; 
    }
}

export function ClientsAndPaymentsView({ ordenes, currentUserId, bcvRate, onRegisterPayment }: ClientsAndPaymentsViewProps) {
    
    // --- ESTADOS DE UI ---
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<'ALL' | EstadoPago>('ALL')
    const [currentPage, setCurrentPage] = useState(1)
    
    // Estado para controlar qué fila está expandida mostrando el historial
    const [expandedOrdenId, setExpandedOrdenId] = useState<string | null>(null);

    // --- ESTADOS DEL MODAL DE PAGO ---
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [selectedOrdenForPayment, setSelectedOrdenForPayment] = useState<OrdenServicio | null>(null)

    // --- LÓGICA DE DATOS (MEMOIZADA) ---
    const { clientSummaries, pagadasCompletamente, totalPendienteGlobal } = useMemo(() => {
        const summaryMap = new Map<string, ClientSummary>()
        const pagadasCompletamente: OrdenServicio[] = []
        let totalPendienteGlobal = 0;

        const lowerCaseSearchTerm = searchTerm.toLowerCase()

        const filteredOrdenes = ordenes.filter(orden => {
            const estadoPagoSeguro: EstadoPago = orden.estadoPago ?? EstadoPago.PENDIENTE;
            const montoPagado = orden.montoPagadoUSD || 0;
            const montoPendiente = orden.totalUSD - montoPagado;

            // 1. Filtro de Estado
            if (filterStatus !== 'ALL' && estadoPagoSeguro !== filterStatus) return false;

            // 2. Filtro de Búsqueda
            if (searchTerm) {
                const matchesOrden = (orden.ordenNumero || '').toLowerCase().includes(lowerCaseSearchTerm)
                const matchesCliente = orden.cliente.nombreRazonSocial.toLowerCase().includes(lowerCaseSearchTerm)
                const matchesRif = orden.cliente.rifCedula.toLowerCase().includes(lowerCaseSearchTerm)
                if (!matchesOrden && !matchesCliente && !matchesRif) return false;
            }
            
            // 3. Ignorar anuladas/vacías
            if (orden.totalUSD <= 0 || estadoPagoSeguro === EstadoPago.ANULADO) return false;

            // Calcular deuda global
            if (montoPendiente > 0.01) {
                totalPendienteGlobal += montoPendiente;
            }

            return true; 
        })

        // Agrupación
        for (const orden of filteredOrdenes) {
            const montoPagado = orden.montoPagadoUSD || 0;
            const montoPendiente = orden.totalUSD - montoPagado;
            
            // Si está pagada (margen de error 0.01)
            if (montoPendiente <= 0.01 && orden.estadoPago === EstadoPago.PAGADO) {
                pagadasCompletamente.push(orden);
                continue;
            }

            // Agrupar por Cliente (Deudores)
            const key = orden.cliente.rifCedula.trim().toUpperCase() || orden.cliente.nombreRazonSocial.trim().toUpperCase()
            
            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    key,
                    nombre: orden.cliente.nombreRazonSocial,
                    rif: orden.cliente.rifCedula,
                    totalOrdenes: 0,
                    totalPendienteUSD: 0,
                    ordenesPendientes: []
                })
            }

            const summary = summaryMap.get(key)!
            summary.totalOrdenes += orden.totalUSD
            summary.totalPendienteUSD += montoPendiente
            
            // Solo agregar a la lista si tiene deuda real
            if (montoPendiente > 0.01) {
                 summary.ordenesPendientes.push(orden);
            }
        }

        const summariesArray = Array.from(summaryMap.values())
            .sort((a, b) => b.totalPendienteUSD - a.totalPendienteUSD) // Ordenar por mayor deuda
            .filter(summary => summary.ordenesPendientes.length > 0) 
            
        return { clientSummaries: summariesArray, pagadasCompletamente, totalPendienteGlobal }

    }, [ordenes, searchTerm, filterStatus])


    // --- PAGINACIÓN ---
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSummaries = clientSummaries.slice(offset, offset + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(clientSummaries.length / ITEMS_PER_PAGE);

    // --- HANDLERS ---
    
    const handleOpenPaymentModal = (orden: OrdenServicio) => {
        setSelectedOrdenForPayment(orden)
        setIsPaymentModalOpen(true)
    }

    // Handler intermedio para conectar el modal con el Dashboard
    const handleRegisterPayment = async (abonoUSD: number, nota?: string, imagenUrl?: string) => {
        if (!selectedOrdenForPayment) return;

        try {
            // Llamamos a la función del padre (Dashboard) pasando la imagen si existe
            await onRegisterPayment(selectedOrdenForPayment.id, abonoUSD, nota, imagenUrl);
            setIsPaymentModalOpen(false);
            setSelectedOrdenForPayment(null);
        } catch (error) {
            console.error("Error en vista registrando pago:", error);
            // El alert ya lo maneja el padre normalmente, pero por seguridad:
            // alert("Error al registrar el pago."); 
        }
    }

    const toggleExpand = (ordenId: string) => {
        setExpandedOrdenId(prevId => (prevId === ordenId ? null : ordenId));
    };


    // --- RENDER ---

    const totalBs = formatBsCurrency(totalPendienteGlobal, bcvRate);
    const hasDeudas = paginatedSummaries.length > 0;
    const hasPagadas = pagadasCompletamente.length > 0;

    // Caso: Todo limpio
    if (!hasDeudas && !hasPagadas && !searchTerm && filterStatus === 'ALL') {
         return (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full">
                    <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400"/>
                </div>
                <h3 className="text-xl font-bold">¡Todo al día!</h3>
                <p className="text-muted-foreground max-w-md">
                    No hay cuentas por cobrar ni órdenes activas en este momento.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-8 p-1">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Wallet className="w-8 h-8 text-primary"/> Finanzas
                    </h2>
                    <p className="text-muted-foreground">
                        Control de cuentas por cobrar y flujo de caja.
                    </p>
                </div>
            </div>

            {/* --- DASHBOARD SUPERIOR: RESUMEN FINANCIERO --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Card 1: Total Deuda */}
                <Card className="border-l-4 border-l-red-500 bg-gradient-to-br from-white to-red-50/50 dark:from-slate-950 dark:to-red-950/10 shadow-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Por Cobrar (Global)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(totalPendienteGlobal)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 font-medium">
                            ~ {totalBs}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3"/> Tasa BCV: {formatCurrency(bcvRate)}
                        </p>
                    </CardContent>
                </Card>

                {/* Card 2: Filtros */}
                <Card className="md:col-span-1 lg:col-span-2 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Filter className="w-4 h-4"/> Filtrar Registros
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar Cliente, RIF o N° Orden..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="pl-10"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={filterStatus} onValueChange={(v: any) => { setFilterStatus(v); setCurrentPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos</SelectItem>
                                    <SelectItem value={EstadoPago.PENDIENTE}>Pendientes</SelectItem>
                                    <SelectItem value={EstadoPago.ABONADO}>Abonados</SelectItem>
                                    <SelectItem value={EstadoPago.PAGADO}>Pagados</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* --- SECCIÓN 1: CLIENTES DEUDORES --- */}
            {hasDeudas ? (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex items-center gap-2 border-b pb-2">
                        <CalendarClock className="w-5 h-5 text-red-500"/>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                            Cuentas Pendientes por Cliente
                        </h3>
                    </div>

                    <div className="grid gap-6">
                        {paginatedSummaries.map((summary) => (
                            <Card key={summary.key} className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                                {/* Encabezado del Cliente */}
                                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold">
                                            {summary.nombre.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base text-foreground">{summary.nombre}</h4>
                                            <p className="text-xs text-muted-foreground font-mono">{summary.rif}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Deuda Total</p>
                                        <div className="text-xl font-extrabold text-red-600 dark:text-red-400">
                                            {formatCurrency(summary.totalPendienteUSD)}
                                        </div>
                                    </div>
                                </div>

                                {/* Tabla de Órdenes del Cliente */}
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">Orden</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead className="text-right">Abonado</TableHead>
                                                <TableHead className="text-right">Restante</TableHead>
                                                <TableHead className="text-center">Estado</TableHead>
                                                <TableHead className="text-center">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {summary.ordenesPendientes.map((orden) => {
                                                const pendiente = orden.totalUSD - (orden.montoPagadoUSD || 0)
                                                
                                                // Accedemos a registroPagos con seguridad
                                                // @ts-ignore: Propiedad dinámica de Firebase
                                                const historialPagos = orden.registroPagos || [];
                                                const hasHistory = historialPagos.length > 0;
                                                const isExpanded = expandedOrdenId === orden.id;

                                                return (
                                                    <React.Fragment key={orden.id}>
                                                        <TableRow className={`group hover:bg-muted/50 ${isExpanded ? 'bg-muted/30' : ''}`}>
                                                            <TableCell className="font-medium">
                                                                #{orden.ordenNumero}
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">
                                                                {formatCurrency(orden.totalUSD)}
                                                            </TableCell>
                                                            <TableCell className="text-right text-green-600 dark:text-green-400">
                                                                {formatCurrency(orden.montoPagadoUSD || 0)}
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                                                                {formatCurrency(pendiente)}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant={getPaymentBadgeVariant(orden.estadoPago || EstadoPago.PENDIENTE)}>
                                                                    {(orden.estadoPago || 'PENDIENTE').replace('_', ' ')}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Button 
                                                                        size="sm" 
                                                                        variant="outline" 
                                                                        className="h-8 px-2 text-primary border-primary/20 hover:bg-primary/5"
                                                                        onClick={() => handleOpenPaymentModal(orden)}
                                                                    >
                                                                        <DollarSign className="w-3.5 h-3.5 mr-1"/> Pagar
                                                                    </Button>

                                                                    {hasHistory && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant={isExpanded ? "secondary" : "ghost"}
                                                                            className="h-8 w-8"
                                                                            onClick={() => toggleExpand(orden.id)}
                                                                            title="Ver historial de pagos y fotos"
                                                                        >
                                                                            {isExpanded ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* --- FILA EXPANDIBLE CON EL HISTORIAL Y FOTOS --- */}
                                                        {isExpanded && hasHistory && (
                                                            <TableRow className="bg-slate-50 dark:bg-slate-900/30 animate-in slide-in-from-top-2 duration-200">
                                                                <TableCell colSpan={6} className="p-0">
                                                                    <div className="p-4 border-t border-b border-primary/10 shadow-inner">
                                                                        <PaymentHistoryView 
                                                                            historial={historialPagos}
                                                                            totalOrdenUSD={orden.totalUSD}
                                                                            montoPagadoUSD={orden.montoPagadoUSD || 0}
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-4 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ArrowLeft className="w-4 h-4 mr-2"/> Anterior
                            </Button>
                            <span className="flex items-center text-sm font-medium">
                                Pág {currentPage} de {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Siguiente <ArrowRight className="w-4 h-4 ml-2"/>
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                searchTerm && (
                    <div className="text-center py-10 text-muted-foreground">
                        No se encontraron resultados para "{searchTerm}" con el filtro actual.
                    </div>
                )
            )}

            {/* --- SECCIÓN 2: HISTORIAL DE PAGADOS (ÚLTIMOS 10) --- */}
            {hasPagadas && filterStatus !== EstadoPago.PENDIENTE && filterStatus !== EstadoPago.ABONADO && (
                <div className="pt-10">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-green-600"/>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                            Historial de Órdenes Pagadas
                        </h3>
                    </div>
                    
                    <Card className="border-t-4 border-t-green-500 shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>N° Orden</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="text-right">Monto Total</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-center">Detalles</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagadasCompletamente.slice(0, 10).map((orden) => {
                                    // @ts-ignore
                                    const historial = orden.registroPagos || [];
                                    const isExpanded = expandedOrdenId === orden.id;

                                    return (
                                        <React.Fragment key={orden.id}>
                                            <TableRow className="opacity-75 hover:opacity-100 transition-opacity">
                                                <TableCell className="font-semibold">#{orden.ordenNumero}</TableCell>
                                                <TableCell>
                                                    <span className="font-medium">{orden.cliente.nombreRazonSocial}</span>
                                                    <span className="text-xs text-muted-foreground block">{orden.cliente.rifCedula}</span>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                                                    {formatCurrency(orden.totalUSD)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">Pagado</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                     {historial.length > 0 && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8"
                                                            onClick={() => toggleExpand(orden.id)}
                                                        >
                                                            {isExpanded ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            
                                            {/* Historial también en las pagadas */}
                                            {isExpanded && historial.length > 0 && (
                                                <TableRow className="bg-slate-50 dark:bg-slate-900/30">
                                                    <TableCell colSpan={5} className="p-0">
                                                        <div className="p-4 border-t border-b border-primary/10">
                                                            <PaymentHistoryView 
                                                                historial={historial}
                                                                totalOrdenUSD={orden.totalUSD}
                                                                montoPagadoUSD={orden.montoPagadoUSD || 0}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* --- MODAL DE PAGO (EDITAR/AGREGAR) --- */}
            {selectedOrdenForPayment && (
                <PaymentEditModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => {
                        setIsPaymentModalOpen(false)
                        setSelectedOrdenForPayment(null)
                    }}
                    orden={selectedOrdenForPayment}
                    onSave={handleRegisterPayment} 
                    currentUserId={currentUserId}
                />
            )}
        </div>
    )
}