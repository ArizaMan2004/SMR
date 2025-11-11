// @/components/dashboard/ClientsAndPaymentsView.tsx

"use client"

import React, { useMemo, useState } from 'react'
import { type OrdenServicio, EstadoPago, EstadoOrden } from '@/lib/types/orden' // Agregado EstadoOrden
import { formatCurrency, formatBsCurrency } from '@/lib/utils/order-utils' 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Search, Filter, Wallet, ArrowLeft, ArrowRight, CheckCircle2, ArrowDown, ArrowUp, Edit } from 'lucide-react' 
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

// Importamos el componente de historial y el tipo de transacción
import { PaymentHistoryView, type PagoTransaction } from '@/components/orden/PaymentHistoryView' 


// Tipos y utilidades auxiliares
interface ClientSummary {
    nombre: string
    rif: string
    totalOrdenes: number
    totalPendienteUSD: number
    ordenesPendientes: OrdenServicio[]
}

const getPaymentBadgeVariant = (estado: EstadoPago) => {
    switch (estado) {
        case EstadoPago.PAGADO: return "default"; 
        case EstadoPago.ABONADO: return "secondary"; 
        case EstadoPago.ANULADO: return "destructive"; 
        default: return "outline"; 
    }
}

const ITEMS_PER_PAGE = 10;

interface ClientsAndPaymentsViewProps {
    ordenes: OrdenServicio[]
    currentUserId: string 
    bcvRate: number 
    onEditPayment: (orden: OrdenServicio) => void 
}


export function ClientsAndPaymentsView({ ordenes, currentUserId, bcvRate, onEditPayment }: ClientsAndPaymentsViewProps) {
    
    const [expandedOrdenId, setExpandedOrdenId] = useState<string | null>(null);

    const toggleExpand = (ordenId: string) => {
        setExpandedOrdenId(prevId => (prevId === ordenId ? null : ordenId));
    };

    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<'ALL' | EstadoPago>('ALL')
    const [currentPage, setCurrentPage] = useState(1)
    
    // 1. Lógica de Filtrado, Búsqueda y Agrupación 
    const { clientSummaries, pagadasCompletamente, totalPendienteGlobal } = useMemo(() => {
        const summaryMap = new Map<string, ClientSummary>()
        const pagadasCompletamente: OrdenServicio[] = []
        let totalPendienteGlobal = 0;

        const lowerCaseSearchTerm = searchTerm.toLowerCase()

        const filteredOrdenes = ordenes.filter(orden => {
            const estadoPagoSeguro: EstadoPago = orden.estadoPago ?? EstadoPago.PENDIENTE;
            const montoPendiente = orden.totalUSD - (orden.montoPagadoUSD || 0);

            // Filtro por Estado de Pago
            if (filterStatus !== 'ALL' && estadoPagoSeguro !== filterStatus) {
                return false;
            }

            // Filtro por Búsqueda (Número de Orden o Cliente)
            if (searchTerm) {
                const matchesOrden = (orden.ordenNumero || '').toLowerCase().includes(lowerCaseSearchTerm)
                const matchesCliente = orden.cliente.nombreRazonSocial.toLowerCase().includes(lowerCaseSearchTerm)
                const matchesRif = orden.cliente.rifCedula.toLowerCase().includes(lowerCaseSearchTerm)
                if (!matchesOrden && !matchesCliente && !matchesRif) {
                    return false;
                }
            }
            
            // Ignorar anuladas
            if (orden.totalUSD <= 0 || estadoPagoSeguro === EstadoPago.ANULADO) {
                return false;
            }

            // Agrega al total pendiente global si tiene saldo
            if (montoPendiente > 0.01) {
                totalPendienteGlobal += montoPendiente;
            }

            return true; // Pasa todos los filtros de búsqueda y estado
        })


        // Agrupación de las órdenes filtradas
        for (const orden of filteredOrdenes) {
            const montoPagado = orden.montoPagadoUSD || 0;
            const montoPendiente = orden.totalUSD - montoPagado;
            
            // Separar órdenes pagadas de las pendientes/abonadas
            if (montoPendiente <= 0.01 && orden.estadoPago === EstadoPago.PAGADO) {
                pagadasCompletamente.push(orden);
                continue;
            }


            // Lógica para órdenes PENDIENTES o ABONADAS (Cuentas por Cobrar)
            const key = orden.cliente.rifCedula.trim().toUpperCase() || orden.cliente.nombreRazonSocial.trim().toUpperCase()
            
            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
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
            
            // Solo muestra órdenes que aún tienen saldo pendiente (> 0.01 USD)
            if (montoPendiente > 0.01) {
                 summary.ordenesPendientes.push(orden);
            }
        }

        const summariesArray = Array.from(summaryMap.values())
            .sort((a, b) => b.totalPendienteUSD - a.totalPendienteUSD)
            .filter(summary => summary.ordenesPendientes.length > 0) // Solo sumarizados con órdenes pendientes visibles
            
        return { clientSummaries: summariesArray, pagadasCompletamente, totalPendienteGlobal }

    }, [ordenes, searchTerm, filterStatus])


    // 2. Lógica de Paginación 
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSummaries = clientSummaries.slice(offset, offset + ITEMS_PER_PAGE);
    const totalPages = Math.ceil(clientSummaries.length / ITEMS_PER_PAGE);

    const hasCuentasPorCobrar = paginatedSummaries.length > 0;
    const hasPagadasCompletamente = pagadasCompletamente.length > 0;

    const totalBs = formatBsCurrency(totalPendienteGlobal, bcvRate);

    const showAllClearMessage = 
        !searchTerm && 
        !hasCuentasPorCobrar && 
        !hasPagadasCompletamente && 
        filterStatus !== EstadoPago.PAGADO; 

    if (showAllClearMessage) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3"/> 
                    <p className="font-semibold">¡Todos tus clientes están al día!</p>
                    <p className="text-sm">No hay órdenes pendientes de pago en el sistema.</p>
                </CardContent>
            </Card>
        )
    }


    // 3. Renderizado principal 
    return (
        <div className="space-y-8">
            <CardHeader className='p-0'>
                <CardTitle className="text-3xl flex items-center gap-2">
                    <Wallet className="w-6 h-6"/> Gestión de Cuentas por Cobrar
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                    Revisa los saldos pendientes y el historial de órdenes pagadas.
                </p>
            </CardHeader>
            
            {/* --------------------------------------------------- */}
            {/* BARRA DE HERRAMIENTAS Y RESUMEN GLOBAL */}
            {/* --------------------------------------------------- */}
            <Card className='p-4 shadow-lg'>
                <div className='flex justify-between items-start mb-4'>
                    <div>
                        <p className='text-sm font-semibold text-muted-foreground'>Total Pendiente Global</p>
                        <p className="text-4xl font-extrabold text-red-600 dark:text-red-400">
                            {formatCurrency(totalPendienteGlobal)} USD
                        </p>
                        <p className='text-sm font-medium text-gray-700 dark:text-gray-300 mt-1'>
                            ~ {totalBs} (Tasa BCV: {formatCurrency(bcvRate)} Bs.)
                        </p>
                    </div>
                </div>
                
                <Separator className='my-4'/>
                
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Búsqueda */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por N° Orden o Cliente/RIF..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value)
                                setCurrentPage(1) 
                            }}
                            className="pl-10"
                        />
                    </div>
                    
                    {/* Filtro de Estado */}
                    <div className='w-full md:w-[200px]'>
                        <Select value={filterStatus} onValueChange={(value: 'ALL' | EstadoPago) => {
                            setFilterStatus(value)
                            setCurrentPage(1) 
                        }}>
                            <SelectTrigger className='w-full'>
                                <Filter className='w-4 h-4 mr-2 text-muted-foreground'/>
                                <SelectValue placeholder="Filtrar por Estado de Pago" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Mostrar Todos</SelectItem>
                                <SelectItem value={EstadoPago.PENDIENTE}>Pendiente</SelectItem>
                                <SelectItem value={EstadoPago.ABONADO}>Abonado</SelectItem>
                                <SelectItem value={EstadoPago.PAGADO}>Pagado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>


            {/* --------------------------------------------------- */}
            {/* SECCIÓN 1: CUENTAS POR COBRAR (TABLAS PAGINADAS) */}
            {/* --------------------------------------------------- */}
            {hasCuentasPorCobrar ? (
                <div className='space-y-6'>
                    {/* 🔑 CAMBIO 1: Título sin el conteo de clientes */}
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                        Cuentas por Cobrar
                    </h2>
                    
                    {paginatedSummaries.map((summary) => (
                        <Card 
                            key={summary.rif} 
                            className='border-l-4 border-red-500/80 dark:border-red-600/80'
                        >
                            <CardHeader className='flex flex-row justify-between items-start'>
                                <div className='text-left'> 
                                    {/* ❌ Eliminamos la información del cliente del encabezado de la tarjeta */}
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                        Total Pendiente del Cliente
                                    </p>
                                    
                                    <p className="text-3xl font-extrabold text-red-600 dark:text-red-400">
                                        {formatCurrency(summary.totalPendienteUSD)} USD
                                    </p>
                                    <p className='text-sm font-medium text-gray-700 dark:text-gray-300 mt-1'>
                                        ~ {formatBsCurrency(summary.totalPendienteUSD, bcvRate)}
                                    </p>
                                </div>
                            </CardHeader>

                            <CardContent className='pt-2'>
                                <Table>
                                    <TableHeader>
                                        <TableRow className='bg-gray-50 dark:bg-gray-800'>
                                            <TableHead>N° Orden</TableHead>
                                            {/* 🔑 CAMBIO 2: Nueva columna para el cliente */}
                                            <TableHead>Cliente / RIF</TableHead> 
                                            <TableHead className='text-right'>Total Orden</TableHead>
                                            <TableHead className='text-right'>Pagado</TableHead>
                                            <TableHead className='text-right'>Pendiente</TableHead>
                                            <TableHead className='text-center'>Estado</TableHead>
                                            <TableHead className='text-center'>Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summary.ordenesPendientes.map((orden) => {
                                            const pendiente = orden.totalUSD - (orden.montoPagadoUSD || 0)
                                            const estadoDisplay = orden.estadoPago ?? EstadoPago.PENDIENTE;
                                            
                                            // @ts-ignore
                                            const historialPagos: PagoTransaction[] = (orden as any).registroPagos || []; 
                                            const isExpanded = expandedOrdenId === orden.id;
                                            
                                            return (
                                                <React.Fragment key={orden.id}>
                                                    <TableRow className='hover:bg-red-50 dark:hover:bg-red-900/10'>
                                                        <TableCell className='font-semibold'>{orden.ordenNumero}</TableCell>
                                                        
                                                        {/* 🔑 CAMBIO 3: Celda con Nombre y RIF por orden */}
                                                        <TableCell>
                                                            <p className="font-medium leading-tight">{orden.cliente.nombreRazonSocial}</p>
                                                            <p className="text-xs text-muted-foreground">RIF: {orden.cliente.rifCedula}</p>
                                                        </TableCell>
                                                        
                                                        <TableCell className='text-right'>
                                                            {formatCurrency(orden.totalUSD)}<br/>
                                                            <span className='text-xs text-muted-foreground'>{formatBsCurrency(orden.totalUSD, bcvRate)}</span>
                                                        </TableCell>
                                                        <TableCell className='text-right text-green-600 dark:text-green-400'>
                                                            {formatCurrency(orden.montoPagadoUSD || 0)}
                                                        </TableCell>
                                                        <TableCell className='text-right font-bold text-red-600 dark:text-red-400'>
                                                            {formatCurrency(pendiente)}<br/>
                                                            <span className='text-xs text-muted-foreground'>{formatBsCurrency(pendiente, bcvRate)}</span>
                                                        </TableCell>
                                                        
                                                        <TableCell className='text-center'>
                                                            <Badge variant={getPaymentBadgeVariant(estadoDisplay)}>
                                                                {estadoDisplay.charAt(0) + estadoDisplay.slice(1).toLowerCase().replace('_', ' ')}
                                                            </Badge>
                                                        </TableCell>
                                                        
                                                        {/* CELDA DE ACCIONES */}
                                                        <TableCell className='text-center space-x-2'>
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                onClick={() => onEditPayment(orden)} 
                                                                title="Registrar Pago"
                                                            >
                                                                <Edit className='w-4 h-4'/> 
                                                            </Button>
                                                            
                                                            {historialPagos.length > 0 && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    onClick={() => toggleExpand(orden.id)}
                                                                    title="Ver Historial de Abonos"
                                                                >
                                                                    {isExpanded ? 
                                                                        <ArrowUp className="w-4 h-4 text-primary" /> : 
                                                                        <ArrowDown className="w-4 h-4 text-primary" />
                                                                    }
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* FILA DE HISTORIAL EXPANDIDO */}
                                                    {isExpanded && historialPagos.length > 0 && (
                                                        <TableRow className='bg-gray-50 dark:bg-gray-850'>
                                                            {/* 🔑 CAMBIO 4: Ajustar colSpan a 7 */}
                                                            <TableCell colSpan={7} className="p-0 border-t border-b-2 border-primary/30 dark:border-primary/50">
                                                                <div className="p-4">
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
                            </CardContent>
                        </Card>
                    ))}
                    
                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center pt-4">
                            <Button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                variant="outline"
                            >
                                <ArrowLeft className='w-4 h-4 mr-2'/> Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Página {currentPage} de {totalPages}
                            </span>
                            <Button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                variant="outline"
                            >
                                Siguiente <ArrowRight className='w-4 h-4 ml-2'/>
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                filterStatus !== EstadoPago.PAGADO && searchTerm === '' && (
                    <p className="text-center text-muted-foreground mt-8">
                        No se encontraron cuentas por cobrar que coincidan con los filtros/búsqueda.
                    </p>
                )
            )}


            {/* SECCIÓN 2: ÓRDENES PAGADAS COMPLETAMENTE */}
            {(hasPagadasCompletamente && filterStatus !== EstadoPago.PENDIENTE && filterStatus !== EstadoPago.ABONADO) && (
                <div className='pt-8 border-t border-dashed'>
                    <PagadasCompletamenteTable 
                        ordenes={pagadasCompletamente} 
                        bcvRate={bcvRate} 
                        showTitle={filterStatus === EstadoPago.PAGADO || !hasCuentasPorCobrar}
                    /> 
                </div>
            )}
        </div>
    )
}

const PagadasCompletamenteTable: React.FC<{ ordenes: OrdenServicio[], bcvRate: number, showTitle?: boolean }> = ({ ordenes, bcvRate, showTitle = true }) => {
    return (
        <Card className="border-l-4 border-green-500/80 dark:border-green-600/80">
            {showTitle && (
                <CardHeader>
                    <CardTitle className="text-xl font-bold text-green-600 dark:text-green-400">
                        Órdenes Pagadas Completamente
                    </CardTitle>
                </CardHeader>
            )}
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className='bg-gray-50 dark:bg-gray-800'>
                            <TableHead>N° Orden</TableHead>
                            <TableHead>Cliente</TableHead> 
                            <TableHead className='text-right'>Total Pagado</TableHead>
                            <TableHead className='text-center'>Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ordenes.map((orden) => (
                            <TableRow key={orden.id}>
                                <TableCell className='font-semibold'>{orden.ordenNumero}</TableCell>
                                <TableCell>
                                    <p className="font-medium leading-tight">{orden.cliente.nombreRazonSocial}</p>
                                    <p className="text-xs text-muted-foreground">RIF: {orden.cliente.rifCedula}</p>
                                </TableCell>
                                <TableCell className='text-right font-bold text-green-600 dark:text-green-400'>
                                    {formatCurrency(orden.totalUSD)}<br/>
                                    <span className='text-xs text-muted-foreground'>{formatBsCurrency(orden.totalUSD, bcvRate)}</span>
                                </TableCell>
                                <TableCell className='text-center'>
                                    <Badge variant={getPaymentBadgeVariant(EstadoPago.PAGADO)}>
                                        Pagado
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}