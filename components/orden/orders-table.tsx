// @/components/orden/orders-table.tsx
"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { type OrdenServicio } from "@/lib/types/orden"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { 
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { formatCurrency } from "@/lib/utils/order-utils"
import { generateOrderPDF } from "@/lib/services/pdf-generator"
import { toast } from "sonner"
import { 
    Trash2, Eye, Pencil, ChevronLeft, ChevronRight, 
    ChevronDown, CheckCircle2, Wallet, Landmark,
    History, X, Clock, Download, RefreshCw, Loader2, Sparkles, Banknote,
    ArrowUpDown, ArrowUp, ArrowDown // ✅ Iconos para ordenar
} from "lucide-react"

import { OrderDetailModal } from "@/components/orden/order-detail-modal"
import { PaymentHistoryView } from "@/components/orden/PaymentHistoryView" 
import { cn } from "@/lib/utils"

interface OrdersTableProps {
  ordenes: OrdenServicio[]
  onDelete: (ordenId: string) => void
  onEdit: (orden: OrdenServicio) => void
  onRegisterPayment: (ordenId: string) => void
  currentUserId: string
  rates: {
    usd: number;
    eur: number;
    usdt: number;
  };
  pdfLogoBase64?: string
  firmaBase64?: string
  selloBase64?: string
  onSyncStatus?: () => Promise<{ success: boolean; message: string }>;
}

function PaymentStatusBadge({ total, abonado }: { total: number, abonado: number }) {
    const isPagado = abonado >= total && total > 0;
    const isAbonado = abonado > 0 && abonado < total;
    if (isPagado) return <Badge className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-none px-3 py-1 rounded-full font-black text-[10px] uppercase flex items-center gap-1.5 shadow-sm"><CheckCircle2 className="w-3 h-3" /> Pagado Total</Badge>;
    if (isAbonado) return <Badge className="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-none px-3 py-1 rounded-full font-black text-[10px] uppercase flex items-center gap-1.5 shadow-sm"><Wallet className="w-3 h-3" /> Abonado</Badge>;
    return <Badge className="bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border-none px-3 py-1 rounded-full font-black text-[10px] uppercase flex items-center gap-1.5"><Clock className="w-3 h-3" /> Pago Pendiente</Badge>;
}

export function OrdersTable({ 
    ordenes, onDelete, onEdit, onRegisterPayment, 
    currentUserId, rates, pdfLogoBase64, firmaBase64, selloBase64, onSyncStatus 
}: OrdersTableProps) {
  
  const [selectedOrden, setSelectedOrden] = useState<OrdenServicio | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [orderForHistory, setOrderForHistory] = useState<OrdenServicio | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const [showUnpaid, setShowUnpaid] = useState(true)
  const [showPaid, setShowPaid] = useState(false)

  const { unpaidOrders, paidOrders } = useMemo(() => {
    const unpaid: OrdenServicio[] = [];
    const paid: OrdenServicio[] = [];
    
    // Dejamos el ordenamiento inicial aquí solo como backup, 
    // pero el componente hijo manejará el ordenamiento visual.
    ordenes.forEach(o => {
        const total = o.totalUSD || 0;
        const abonado = o.montoPagadoUSD || 0;
        if (abonado >= total && total > 0) paid.push(o); else unpaid.push(o);
    });
    return { unpaidOrders: unpaid, paidOrders: paid };
  }, [ordenes]);

  const handleDownloadPDF = async (o: OrdenServicio, rateType: 'USD' | 'EUR' | 'USDT' | 'USD_ONLY') => {
    if (!pdfLogoBase64) return alert("Por favor, cargue un logo en Presupuestos.");
    let selectedCurrency = { rate: rates.usd, label: "Tasa BCV ($)", symbol: "Bs." };
    if (rateType === 'EUR') selectedCurrency = { rate: rates.eur, label: "Tasa BCV (€)", symbol: "Bs." };
    if (rateType === 'USDT') selectedCurrency = { rate: rates.usdt, label: "Tasa Monitor", symbol: "Bs." };
    if (rateType === 'USD_ONLY') selectedCurrency = { rate: 1, label: "", symbol: "" };

    await generateOrderPDF(o, pdfLogoBase64, { 
        firmaBase64, 
        selloBase64,
        currency: selectedCurrency 
    });
  };

  const handleSync = async () => {
    if (!onSyncStatus) return toast.error("Función de sincronización no configurada");
    setIsSyncing(true);
    try {
        const result = await onSyncStatus();
        if (result.success) toast.success(result.message, { icon: <Sparkles className="text-blue-500" /> });
    } catch (error) {
        toast.error("Error al sincronizar estatus");
    } finally {
        setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-10 pb-24">
      {/* BOTÓN DE ACCIÓN MINIMALISTA */}
      <div className="flex justify-end px-6 -mb-6">
          <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="ghost" disabled={isSyncing} className={cn("h-8 px-3 rounded-xl font-bold text-[9px] uppercase tracking-tight transition-all gap-2", "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5", isSyncing && "opacity-50")}>
                    {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 opacity-50" />}
                    {isSyncing ? "Sincronizando..." : "Sincronizar Estatus"}
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem] max-w-[400px]">
                  <AlertDialogHeader>
                      <AlertDialogTitle className="text-lg font-black uppercase tracking-tight">Mantenimiento de Datos</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs font-medium text-slate-500">
                          Esta acción actualizará el estatus de Aliado/Regular en todas las órdenes según tu base de datos de clientes actual.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl font-bold uppercase text-[9px] h-9">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSync} className="bg-slate-900 dark:bg-blue-600 hover:bg-black rounded-xl font-black uppercase text-[9px] h-9">Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      </div>

      {/* SECCIÓN 1: CUENTAS POR COBRAR */}
      <section className="space-y-4 px-2 sm:px-4">
        <button onClick={() => setShowUnpaid(!showUnpaid)} className="group flex items-center justify-between w-full p-4 bg-white dark:bg-zinc-900 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-sm transition-all outline-none">
            <div className="flex items-center gap-5">
                <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-200 dark:shadow-none"><Landmark className="w-6 h-6 text-white" /></div>
                <div className="text-left">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase italic tracking-tight leading-none">Cuentas por Cobrar</h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">Saldos activos y abonos</p>
                </div>
                <Badge className="bg-amber-500 text-white rounded-full px-3">{unpaidOrders.length}</Badge>
            </div>
            <ChevronDown className={cn("w-6 h-6 text-slate-300 dark:text-slate-600 transition-transform duration-500", showUnpaid && 'rotate-180')} />
        </button>
        <AnimatePresence>
            {showUnpaid && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-zinc-900 overflow-hidden">
                        <CardContent className="p-0">
                            <OrdersSubTable 
                                data={unpaidOrders} 
                                actions={{ onDelete, onEdit, handleOpenDetail: (o:any)=>{setSelectedOrden(o); setIsDetailModalOpen(true);}, handleOpenPayment: (o:any)=>{ onRegisterPayment(o.id); }, handleOpenHistory: (o:any)=>{setOrderForHistory(o); setIsHistoryModalOpen(true); }, handleDownloadPDF }} 
                                rates={rates} 
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
      </section>

      {/* SECCIÓN 2: HISTORIAL PAGADO */}
      <section className="space-y-4 px-2 sm:px-4">
        <button onClick={() => setShowPaid(!showPaid)} className="group flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-[2rem] border border-black/5 dark:border-white/5 transition-all outline-none">
            <div className="flex items-center gap-5 opacity-70">
                <div className="p-3 bg-emerald-500 rounded-2xl"><CheckCircle2 className="w-6 h-6 text-white" /></div>
                <div className="text-left">
                    <h2 className="text-xl font-black text-slate-600 dark:text-slate-400 uppercase italic tracking-tight leading-none">Facturación Pagada</h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mt-1">Ingresos liquidados</p>
                </div>
                <Badge variant="outline" className="rounded-full px-3 border-slate-300 dark:border-slate-700">{paidOrders.length}</Badge>
            </div>
            <ChevronDown className={cn("w-6 h-6 text-slate-300 dark:text-slate-600 transition-transform duration-500", showPaid && 'rotate-180')} />
        </button>
        <AnimatePresence>
            {showPaid && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="rounded-[2.5rem] border-none shadow-lg bg-white/80 dark:bg-zinc-900/80 overflow-hidden opacity-90">
                        <CardContent className="p-0">
                            <OrdersSubTable 
                                data={paidOrders} 
                                actions={{ onDelete, onEdit, handleOpenDetail: (o:any)=>{setSelectedOrden(o); setIsDetailModalOpen(true);}, handleOpenPayment: (o:any)=>{ onRegisterPayment(o.id); }, handleOpenHistory: (o:any)=>{setOrderForHistory(o); setIsHistoryModalOpen(true); }, handleDownloadPDF }} 
                                rates={rates} 
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
      </section>

      {/* MODALES LOCALES */}
      {selectedOrden && (
        <OrderDetailModal orden={selectedOrden} open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} rates={rates} />
      )}

      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
          <DialogContent className="max-w-4xl p-0 border-none bg-white dark:bg-zinc-950 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
              <header className="p-6 border-b dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-zinc-900">
                  <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg"><History className="w-5 h-5" /></div>
                      <div className="text-left">
                          <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none text-slate-900 dark:text-white">Historial de Abonos</DialogTitle>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Orden #{orderForHistory?.ordenNumero}</p>
                      </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsHistoryModalOpen(false)} className="rounded-full text-slate-400"><X /></Button>
              </header>
              <div className="p-6 overflow-y-auto max-h-[70vh] bg-white dark:bg-zinc-950">
                  {orderForHistory && (<PaymentHistoryView historial={(orderForHistory as any).registroPagos || []} totalOrdenUSD={orderForHistory.totalUSD} montoPagadoUSD={orderForHistory.montoPagadoUSD || 0} />)}
              </div>
          </DialogContent>
      </Dialog>
    </div>
  )
}

// --- SUB-TABLA CON ORDENAMIENTO (SORTING) ---
function OrdersSubTable({ data, actions, rates }: any) {
    const [page, setPage] = useState(1);
    const pageSize = 10;
    
    // ✅ Estado para el ordenamiento (Por defecto: Número de orden descendente, osea las nuevas primero)
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'ordenNumero', direction: 'desc' });

    // ✅ Lógica de Ordenamiento
    const sortedData = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Casos especiales (Anidados)
                if (sortConfig.key === 'cliente') {
                    aVal = a.cliente?.nombreRazonSocial || '';
                    bVal = b.cliente?.nombreRazonSocial || '';
                }
                
                // Comparación
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / pageSize);
    const paginated = sortedData.slice((page - 1) * pageSize, page * pageSize);

    // Función para cambiar el orden al hacer clic en header
    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Icono dinámico según estado
    const getSortIcon = (columnKey: string) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
    };

    if (data.length === 0) return <div className="p-20 text-center text-slate-300 dark:text-slate-700 font-bold uppercase text-[10px] tracking-widest italic bg-slate-50/30 dark:bg-black/20">No hay registros financieros</div>

    return (
        <div className="w-full">
            <div className="hidden md:block overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-zinc-800/50">
                        <TableRow className="border-b border-slate-100 dark:border-white/5">
                            <TableHead 
                                className="py-6 px-8 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 w-[180px] cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors select-none"
                                onClick={() => requestSort('ordenNumero')}
                            >
                                <div className="flex items-center">N° Orden / Fecha {getSortIcon('ordenNumero')}</div>
                            </TableHead>
                            <TableHead 
                                className="py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors select-none"
                                onClick={() => requestSort('cliente')}
                            >
                                <div className="flex items-center">Cliente {getSortIcon('cliente')}</div>
                            </TableHead>
                            <TableHead 
                                className="py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors select-none"
                                onClick={() => requestSort('totalUSD')}
                            >
                                <div className="flex items-center justify-end">Total Factura {getSortIcon('totalUSD')}</div>
                            </TableHead>
                            <TableHead 
                                className="py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors select-none"
                                onClick={() => requestSort('estadoPago')}
                            >
                                <div className="flex items-center justify-center">Estatus Pago {getSortIcon('estadoPago')}</div>
                            </TableHead>
                            <TableHead className="py-6 pr-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.map((o: OrdenServicio) => (
                            <TableRow key={o.id} className="group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <TableCell className="py-5 px-8">
                                    <div className="flex flex-col">
                                        <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">#{o.ordenNumero}</span>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 flex items-center gap-1">
                                           {new Date(o.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                           <span className="w-1 h-1 rounded-full bg-slate-300 mx-0.5" />
                                           {new Date(o.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-5">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate max-w-[200px] leading-tight uppercase italic">{o.cliente?.nombreRazonSocial || "Cliente S/N"}</span>
                                            {o.cliente?.tipoCliente === 'ALIADO' ? (
                                                <Badge className="bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-none text-[7px] font-black uppercase px-2 h-4">Aliado</Badge>
                                            ) : (
                                                <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-none text-[7px] font-black uppercase px-2 h-4">Regular</Badge>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono tracking-tighter">{o.cliente?.rifCedula || "S/R"}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-5 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                                            {formatCurrency(o.totalUSD)}
                                        </span>
                                        {o.montoPagadoUSD > 0 && o.montoPagadoUSD < o.totalUSD && (
                                            <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase italic leading-none">Abonado: {formatCurrency(o.montoPagadoUSD)}</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="py-5 text-center flex justify-center"><PaymentStatusBadge total={o.totalUSD} abonado={o.montoPagadoUSD || 0} /></TableCell>
                                <TableCell className="py-5 pr-8 text-center">
                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ActionButton icon={<Eye />} color="blue" onClick={() => actions.handleOpenDetail(o)} label="Ver Factura" />
                                        
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="w-10 h-10 rounded-xl flex items-center justify-center transition-all border active:scale-95 shadow-sm text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-600 hover:text-white dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500">
                                                    <Download className="w-5 h-5" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-2xl min-w-[150px]">
                                                <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400">Seleccionar Tasa</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => actions.handleDownloadPDF(o, 'USD')} className="gap-3 cursor-pointer text-xs font-bold">
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">BCV $</Badge>
                                                    {rates?.usd?.toFixed(2)}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => actions.handleDownloadPDF(o, 'EUR')} className="gap-3 cursor-pointer text-xs font-bold">
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">BCV €</Badge>
                                                    {rates?.eur?.toFixed(2)}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => actions.handleDownloadPDF(o, 'USDT')} className="gap-3 cursor-pointer text-xs font-bold">
                                                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Monitor</Badge>
                                                    {rates?.usdt?.toFixed(2)}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => actions.handleDownloadPDF(o, 'USD_ONLY')} className="gap-3 cursor-pointer text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10">
                                                    <Banknote className="w-4 h-4 text-slate-500" />
                                                    Solo Dólares (Sin Bs)
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <ActionButton icon={<History />} color="indigo" onClick={() => actions.handleOpenHistory(o)} label="Historial" />
                                        {(o.totalUSD - (o.montoPagadoUSD || 0)) > 0.01 && (<ActionButton icon={<Wallet />} color="green" onClick={() => actions.handleOpenPayment(o)} label="Abonar" />)}
                                        <ActionButton icon={<Pencil />} color="orange" onClick={() => actions.onEdit(o)} label="Editar" />
                                        <ActionButton icon={<Trash2 />} color="rose" onClick={() => { if (confirm(`¿Borrar orden #${o.ordenNumero}?`)) actions.onDelete(o.id); }} label="Borrar" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {/* PAGINACIÓN */}
            {totalPages > 1 && (
                <div className="p-4 bg-slate-50/50 dark:bg-zinc-800/30 border-t dark:border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest px-4">Página {page} de {totalPages}</span>
                    <div className="flex gap-2 px-4">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="h-9 w-9 p-0 rounded-xl dark:border-white/10 dark:text-slate-400">
                            <ChevronLeft className="w-4 h-4"/>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="h-9 w-9 p-0 rounded-xl dark:border-white/10 dark:text-slate-400">
                            <ChevronRight className="w-4 h-4"/>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function ActionButton({ icon, color, onClick, label }: any) {
    const colors: any = { 
        blue: "text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-600 hover:text-white dark:bg-blue-500/10 dark:border-blue-500/20 dark:hover:bg-blue-500", 
        green: "text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-600 hover:text-white dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500", 
        orange: "text-orange-600 bg-orange-50 border-orange-100 hover:bg-orange-600 hover:text-white dark:bg-orange-500/10 dark:border-orange-500/20 dark:hover:bg-orange-500", 
        rose: "text-rose-600 bg-rose-50 border-rose-100 hover:bg-rose-600 hover:text-white dark:bg-rose-500/10 dark:border-rose-500/20 dark:hover:bg-rose-500",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-600 hover:text-white dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:hover:bg-indigo-500",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100 hover:bg-emerald-600 hover:text-white dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:hover:bg-emerald-500"
    };
    return (<button onClick={onClick} title={label} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all border active:scale-95 shadow-sm", colors[color])}>{React.cloneElement(icon, { className: "w-5 h-5" })}</button>);
}