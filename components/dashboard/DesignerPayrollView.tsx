// @/components/dashboard/DesignerPayrollView.tsx
"use client"

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"

// UI Components - Shadcn
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// Iconos - Lucide
import { 
    DollarSign, ChevronDown, Wallet, Search, Landmark, Trash2, AlertCircle,
    Plus, Zap, Layers, Palette, CreditCard, Loader2, Eye, ImageIcon, 
    TrendingUp, Settings, User, Ruler, Box, Upload, Euro, Download, X, Calendar
} from "lucide-react"

// Tipos y Servicios
import { type OrdenServicio, type ItemOrden, EstadoOrden, EstadoPago } from "@/lib/types/orden"
import { type Designer } from "@/lib/services/designers-service"
import { updateOrdenItemField, updateOrdenDesign, createOrden } from "@/lib/services/ordenes-service"
import { addDesigner, deleteDesigner } from "@/lib/services/designers-service"
import { getLastOrderNumber } from "@/lib/firebase/ordenes"
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"
import { cn } from "@/lib/utils"

// Componentes adicionales
import { TeamManagement } from "./TeamManagement"
import { OrderDetailModal } from "@/components/orden/order-detail-modal"

// --- VARIANTES DE ANIMACIÓN ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
}

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
        y: 0, 
        opacity: 1,
        transition: { type: "spring", stiffness: 260, damping: 20 }
    }
}

interface DesignerPayrollProps {
    ordenes: OrdenServicio[]
    designers: Designer[]
    bcvRate: number 
    eurRate?: number 
}

export function DesignerPayrollView({ ordenes, designers, bcvRate, eurRate = 0 }: DesignerPayrollProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [expandedDesigner, setExpandedDesigner] = useState<string | null>(null)

    // Modales
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
    
    const [selectedOrder, setSelectedOrder] = useState<OrdenServicio | null>(null)
    const [isProcessingPayment, setIsProcessingPayment] = useState(false)
    const [isCreatingOrder, setIsCreatingOrder] = useState(false)

    // Forms
    const [payingItem, setPayingItem] = useState<{orderId: string, itemIndex: number, amount: number, designerName: string} | null>(null)
    const [paymentForm, setPaymentForm] = useState({
        referencia: "", metodo: "Pago Móvil", monedaTasa: "BCV" as "BCV" | "EUR" | "MANUAL",
        customRate: "", comprobanteFile: null as File | null, previewUrl: ""
    })

    // --- FUNCIONES DE ACCIÓN ---
    const handleDownloadImage = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Pago-${payingItem?.designerName || 'Voucher'}-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error al descargar:", error);
        }
    };

    const handleReassign = async (orderId: string, newId: string) => {
        try {
            await updateOrdenDesign(orderId, { designerId: newId });
        } catch (e) {
            console.error("Error al reasignar:", e);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setPaymentForm(prev => ({ 
                ...prev, 
                comprobanteFile: file, 
                previewUrl: URL.createObjectURL(file) 
            }))
        }
    }

    const confirmFinalPayment = async () => {
        if (!payingItem || !paymentForm.referencia) return
        setIsProcessingPayment(true)
        try {
            let screenshotUrl = ""
            if (paymentForm.comprobanteFile) {
                screenshotUrl = await uploadFileToCloudinary(paymentForm.comprobanteFile)
            }

            let rateUsed = bcvRate
            if (paymentForm.monedaTasa === "EUR") rateUsed = eurRate
            if (paymentForm.monedaTasa === "MANUAL") rateUsed = parseFloat(paymentForm.customRate) || bcvRate

            await updateOrdenItemField(payingItem.orderId, payingItem.itemIndex, { 
                designPaymentStatus: 'PAGADO', 
                paymentReference: paymentForm.referencia,
                paymentMethod: paymentForm.metodo, 
                paymentScreenshotUrl: screenshotUrl,
                paymentDate: new Date().toISOString(), 
                paymentRateUsed: rateUsed
            })
            setIsPaymentModalOpen(false)
            setPaymentForm({ referencia: "", metodo: "Pago Móvil", monedaTasa: "BCV", customRate: "", comprobanteFile: null, previewUrl: "" })
        } catch (e) { alert("Error al procesar el pago") } finally { setIsProcessingPayment(false) }
    }

    // --- LÓGICA DE DATOS ---
    const pendingPayroll = useMemo(() => {
        const allDesigners = [...designers, { id: 'sin_asignar', name: 'Sin Asignar' }]
        return allDesigners.map(designer => {
            const tasks = ordenes.flatMap(orden => (orden.items || []).map((item, index) => ({
                ...item, orderId: orden.id, orderNum: orden.ordenNumero, itemIndex: index,
                client: orden.cliente?.nombreRazonSocial || "Cliente Genérico",
                currentDesignerId: orden.designerId || "sin_asignar", fullOrder: orden 
            }))).filter(item => {
                const isDesign = item.tipoServicio === 'DISENO'
                const isNotPaid = (item as any).designPaymentStatus !== 'PAGADO'
                const match = item.currentDesignerId === designer.id || 
                             (designer.id !== 'sin_asignar' && item.empleadoAsignado?.toLowerCase().includes(designer.name.toLowerCase()))
                return isDesign && isNotPaid && match
            })
            const totalUSD = tasks.reduce((sum, t) => sum + (t.precioUnitario || 0), 0)
            return { ...designer, tasks, totalUSD }
        }).filter(d => d.tasks.length > 0)
          .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }, [ordenes, designers, searchTerm])

    const paidHistory = useMemo(() => {
        return ordenes.flatMap(orden => (orden.items || []).map((item, index) => ({
            ...item, orderNum: orden.ordenNumero, client: orden.cliente?.nombreRazonSocial || "Cliente Genérico"
        })).filter(item => item.tipoServicio === 'DISENO' && (item as any).designPaymentStatus === 'PAGADO'))
        .sort((a, b) => new Date((b as any).paymentDate || 0).getTime() - new Date((a as any).paymentDate || 0).getTime())
    }, [ordenes])

    const globalTotal = pendingPayroll.reduce((s, d) => s + d.totalUSD, 0)

    return (
        <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-4 md:space-y-8 pb-10"
        >
            <motion.header variants={itemVariants} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
                <div className="px-1">
                    <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Nómina de Diseño</h1>
                    <p className="text-[12px] md:text-sm text-slate-500 font-medium uppercase tracking-wider">Gestión profesional de liquidaciones</p>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 lg:flex-none">
                        <Button onClick={() => setIsAssignModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 md:h-14 font-bold shadow-lg shadow-blue-500/20 gap-2">
                            <Zap className="w-4 h-4 md:w-5 md:h-5 fill-current" /> <span className="text-sm md:text-base">Nueva Tarea</span>
                        </Button>
                    </motion.div>
                    <TeamManagement designers={designers} onAdd={addDesigner} onDelete={deleteDesigner} />
                </div>
            </motion.header>

            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                <StatCard label="Por Liquidar" value={`$${globalTotal.toFixed(2)}`} icon={<Wallet />} color="blue" subValue={`≈ Bs. ${(globalTotal * bcvRate).toLocaleString()}`} />
                <StatCard label="Tasa BCV" value={`Bs. ${bcvRate.toFixed(2)}`} icon={<Landmark />} color="emerald" subValue="Tasa Oficial" />
                <StatCard label="Pendientes" value={pendingPayroll.reduce((s, d) => s + d.tasks.length, 0).toString()} icon={<Palette />} color="orange" subValue="Tareas activas" className="col-span-2 md:col-span-1" />
            </motion.div>

            <Tabs defaultValue="pendientes" className="w-full space-y-4 md:space-y-6">
                <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm">
                    <TabsList className="bg-transparent gap-2 h-10 md:h-12 w-full md:w-auto">
                        <TabsTrigger value="pendientes" className="flex-1 md:flex-none rounded-xl px-4 md:px-8 text-xs md:text-sm font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white">Pendientes</TabsTrigger>
                        <TabsTrigger value="historial" className="flex-1 md:flex-none rounded-xl px-4 md:px-8 text-xs md:text-sm font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white">Historial</TabsTrigger>
                    </TabsList>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar por diseñador..." className="pl-11 rounded-xl border-none bg-slate-100 dark:bg-slate-800 h-11 md:h-12 font-medium text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </motion.div>

                <TabsContent value="pendientes">
                    <LayoutGroup>
                        <motion.div layout className="space-y-3 md:space-y-4">
                            {pendingPayroll.map((designer) => (
                                <DesignerCard 
                                    key={designer.id} 
                                    designer={designer} 
                                    isExpanded={expandedDesigner === designer.id}
                                    onToggle={() => setExpandedDesigner(expandedDesigner === designer.id ? null : designer.id)}
                                    onPay={(task: any) => {
                                        setPayingItem({ orderId: task.orderId, itemIndex: task.itemIndex, amount: task.precioUnitario, designerName: designer.name });
                                        setIsPaymentModalOpen(true);
                                    }}
                                    onViewDetail={(task: any) => { setSelectedOrder(task.fullOrder); setIsDetailModalOpen(true); }}
                                    designersList={designers}
                                    onReassign={handleReassign}
                                />
                            ))}
                        </motion.div>
                    </LayoutGroup>
                </TabsContent>

                <TabsContent value="historial">
                    <motion.div variants={itemVariants}>
                        <HistoryView 
                            items={paidHistory} 
                            onViewVoucher={(url) => setPreviewImageUrl(url)}
                        />
                    </motion.div>
                </TabsContent>
            </Tabs>

            {/* MODALES */}
            <PaymentModal 
                isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} item={payingItem} 
                form={paymentForm} setForm={setPaymentForm} rates={{ bcv: bcvRate, eur: eurRate }}
                onConfirm={confirmFinalPayment} loading={isProcessingPayment} onFileChange={handleFileChange}
            />

            <AssignmentModal 
                isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} designers={designers}
                loading={isCreatingOrder}
                onConfirm={async (data: any) => {
                    setIsCreatingOrder(true);
                    try {
                        const lastNum = await getLastOrderNumber();
                        const items: ItemOrden[] = [{
                            nombre: `Diseño: ${data.detalles}`, tipoServicio: "OTROS", cantidad: 1, unidad: "unidades", 
                            precioUnitario: parseFloat(data.precioDiseno), subtotal: parseFloat(data.precioDiseno),
                            empleadoAsignado: designers.find(d => d.id === data.designerId)?.name || "Sin Asignar",
                        }];
                        if (data.incluirMaterial) {
                            items.push({ 
                                nombre: `Producción: ${data.material}`, tipoServicio: "IMPRESION" as any, 
                                cantidad: 1, unidad: "unidades", precioUnitario: (parseFloat(data.ancho || "0") * parseFloat(data.alto || "0") * parseFloat(data.precioM2 || "0")) / 10000,
                                subtotal: 0, materialDeImpresion: data.material
                            });
                        }
                        await createOrden({ 
                            ordenNumero: String(lastNum + 1), fecha: new Date().toISOString(), cliente: { nombreRazonSocial: data.cliente, rifCedula: "V-EXPRESS", telefono: "N/A", correo: "N/A", domicilioFiscal: "N/A", personaContacto: "N/A" }, 
                            items, serviciosSolicitados: { impresionDigital: false, impresionGranFormato: data.incluirMaterial, corteLaser: false, laminacion: false, avisoCorporeo: false, rotulacion: false, instalacion: false, senaletica: false }, 
                            descripcionDetallada: data.detalles || "Express", totalUSD: items.reduce((s, i) => s + i.precioUnitario, 0), totalBS: 0, montoPagadoUSD: 0, estadoPago: EstadoPago.PENDIENTE, estado: EstadoOrden.PENDIENTE, historialPagos: [],
                            // @ts-ignore
                            designerId: data.designerId 
                        });
                        setIsAssignModalOpen(false);
                    } catch (e) { alert("Error") } finally { setIsCreatingOrder(false) }
                }}
            />

            <OrderDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} orden={selectedOrder} bcvRate={bcvRate} />
            
            <ImagePreviewModal 
                imageUrl={previewImageUrl} 
                onClose={() => setPreviewImageUrl(null)} 
                onDownload={() => previewImageUrl && handleDownloadImage(previewImageUrl)}
            />
        </motion.div>
    )
}

// --- COMPONENTES INTERNOS ---

function StatCard({ label, value, icon, color, subValue, className }: any) {
    const colors: any = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", orange: "bg-orange-50 text-orange-600" }
    return (
        <motion.div 
            whileHover={{ y: -5, scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            className={cn("h-full", className)}
        >
            <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl bg-white dark:bg-slate-900 overflow-hidden h-full">
                <CardContent className="p-4 md:p-6 flex items-center gap-3 md:gap-6">
                    <div className={cn("p-3 md:p-4 rounded-xl md:rounded-2xl", colors[color])}>
                        {React.cloneElement(icon, { className: "w-5 h-5 md:w-8 md:h-8" })}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 truncate">{label}</p>
                        <h3 className="text-lg md:text-3xl font-black text-slate-900 dark:text-white truncate">{value}</h3>
                        <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-0.5 md:mt-1 flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> <span className="truncate">{subValue}</span></p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

function DesignerCard({ designer, isExpanded, onToggle, onPay, onViewDetail, designersList, onReassign }: any) {
    return (
        <motion.div layout className="group">
            <motion.button 
                layout
                onClick={onToggle} 
                whileHover={{ scale: 1.005, x: 2 }}
                whileTap={{ scale: 0.995 }}
                className={cn("w-full flex items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[2rem] border bg-white dark:bg-slate-900 shadow-sm transition-all", isExpanded ? 'border-blue-300 shadow-md' : 'border-slate-200')}
            >
                <div className="flex items-center gap-3 md:gap-5">
                    <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm md:text-xl font-black">
                        {designer.id === 'sin_asignar' ? <AlertCircle className="w-5 h-5 md:w-7 md:h-7" /> : designer.name.charAt(0)}
                    </div>
                    <div className="text-left min-w-0">
                        <h4 className="text-sm md:text-xl font-black truncate max-w-[120px] md:max-w-none">{designer.name}</h4>
                        <Badge variant="secondary" className="text-[8px] md:text-[10px] uppercase font-bold">{designer.tasks.length} Tareas</Badge>
                    </div>
                </div>
                <div className="flex items-center gap-3 md:gap-6">
                    <div className="text-right">
                        <p className="text-lg md:text-3xl font-black text-emerald-600 tracking-tighter">${designer.totalUSD.toFixed(2)}</p>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                        <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                    </motion.div>
                </div>
            </motion.button>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: "auto", opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }} 
                        className="overflow-hidden"
                    >
                        <div className="p-3 md:p-4 pt-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl md:rounded-b-[2rem] border border-t-0 border-slate-200 mx-2 md:mx-4">
                            <div className="space-y-3 pt-3 md:pt-4">
                                {designer.tasks.map((task: any, idx: number) => (
                                    <motion.div 
                                        key={`${task.orderId}-${task.itemIndex}`} 
                                        initial={{ x: -10, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-4 rounded-xl md:rounded-2xl border border-slate-100 gap-3 shadow-sm"
                                    >
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-black text-blue-600 text-sm md:text-base">#{task.orderNum}</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm md:text-base truncate">- {task.nombre}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 md:mt-2 text-[9px] md:text-[10px] font-bold uppercase text-slate-500">
                                                <div className="flex items-center gap-1"><User className="w-3 h-3" /> {task.client}</div>
                                                {task.materialDeImpresion && <div className="flex items-center gap-1 text-indigo-600"><Box className="w-3 h-3" /> {task.materialDeImpresion}</div>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-2 md:gap-3 border-t md:border-none pt-3 md:pt-0">
                                            <span className="font-black text-emerald-600 text-lg md:text-xl md:mr-4">${task.precioUnitario.toFixed(2)}</span>
                                            <div className="flex items-center gap-1.5 md:gap-3">
                                                <Button variant="outline" size="icon" onClick={() => onViewDetail(task)} className="rounded-lg md:rounded-xl h-9 w-9"><Eye className="w-4 h-4" /></Button>
                                                <Select value={task.currentDesignerId} onValueChange={(v) => onReassign(task.orderId, v)}>
                                                    <SelectTrigger className="h-9 w-[110px] md:w-[140px] rounded-lg md:rounded-xl bg-slate-50 dark:bg-slate-700 border-none font-bold text-[10px] md:text-[11px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="z-[110]">{designersList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <motion.div whileTap={{ scale: 0.95 }}>
                                                    <Button onClick={() => onPay(task)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg md:rounded-xl font-bold px-4 md:px-6 h-9 md:h-10 text-xs md:text-sm shadow-lg shadow-emerald-500/20">Pagar</Button>
                                                </motion.div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function HistoryView({ items, onViewVoucher }: { items: any[], onViewVoucher: (url: string) => void }) {
    if (items.length === 0) return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 md:p-20 text-center text-slate-300 font-black uppercase text-xs md:text-base tracking-widest bg-white rounded-[2rem] border-2 border-dashed">
            No hay registros de pago.
        </motion.div>
    )
    
    return (
        <Card className="rounded-2xl md:rounded-[2rem] border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                        <TableRow className="border-none h-16"><TableHead className="px-8 text-[10px] font-black uppercase">Orden</TableHead><TableHead className="text-[10px] font-black uppercase">Diseñador</TableHead><TableHead className="text-[10px] font-black uppercase">Método</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Monto</TableHead><TableHead className="text-center text-[10px] font-black uppercase">Voucher</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, idx) => (
                            <TableRow key={idx} className="border-slate-50 h-16 hover:bg-slate-50/50 transition-colors">
                                <TableCell className="px-8 font-black text-blue-600 text-xl">#{item.orderNum}</TableCell>
                                <TableCell><p className="font-bold">{item.empleadoAsignado}</p><p className="text-[10px] font-black text-slate-400 uppercase">{item.client}</p></TableCell>
                                <TableCell><Badge variant="outline" className="text-[9px] font-black bg-emerald-50 text-emerald-600 border-none px-3 py-1">{item.paymentMethod}</Badge></TableCell>
                                <TableCell className="text-right font-black text-lg text-slate-700 dark:text-slate-200">${item.precioUnitario?.toFixed(2)}</TableCell>
                                <TableCell className="text-center">
                                    {item.paymentScreenshotUrl ? (
                                        <Button variant="ghost" size="icon" onClick={() => onViewVoucher(item.paymentScreenshotUrl)} className="rounded-xl text-blue-500 hover:bg-blue-50">
                                            <ImageIcon className="w-5 h-5" />
                                        </Button>
                                    ) : <span className="text-[10px] font-bold text-slate-300">N/A</span>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
                {items.map((item, idx) => (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={idx} className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-blue-600 font-black text-lg">#{item.orderNum}</span>
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{item.empleadoAsignado}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.client}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-lg text-slate-900 dark:text-white">${item.precioUnitario?.toFixed(2)}</p>
                                <Badge variant="outline" className="text-[8px] font-black bg-emerald-50 text-emerald-600 border-none px-2 py-0.5 mt-1">{item.paymentMethod}</Badge>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                            <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                                <Calendar className="w-3 h-3" />
                                {item.paymentDate ? new Date(item.paymentDate).toLocaleDateString() : 'S/F'}
                            </div>
                            {item.paymentScreenshotUrl && (
                                <Button size="sm" variant="ghost" onClick={() => onViewVoucher(item.paymentScreenshotUrl)} className="h-8 px-3 gap-2 text-blue-600 font-bold text-[10px]">
                                    <ImageIcon className="w-3.5 h-3.5" /> VOUCHER
                                </Button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </Card>
    )
}

function PaymentModal({ isOpen, onClose, item, form, setForm, rates, onConfirm, loading, onFileChange }: any) {
    const effectiveRate = form.monedaTasa === "BCV" ? rates.bcv : form.monedaTasa === "EUR" ? rates.eur : parseFloat(form.customRate) || 0
    const amountBs = (item?.amount || 0) * effectiveRate
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 bg-white dark:bg-slate-950 z-[120] border-none shadow-2xl max-w-[95vw] md:max-w-md overflow-y-auto max-h-[90vh]">
                <DialogHeader><DialogTitle className="text-xl md:text-2xl font-black flex items-center gap-3"><CreditCard className="text-emerald-500 w-6 h-6 md:w-7 md:h-7" /> Liquidar Pago</DialogTitle></DialogHeader>
                <div className="space-y-4 md:space-y-6 py-4">
                    <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-emerald-100 text-center">
                        <h2 className="text-4xl md:text-5xl font-black text-emerald-600 tracking-tighter">${item?.amount.toFixed(2)}</h2>
                        <Separator className="my-2 md:my-3 bg-emerald-200/50" />
                        <p className="text-lg md:text-xl font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 flex-wrap">Bs. {amountBs.toLocaleString('es-VE')} <span className="text-[9px] md:text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-500 font-bold">TASA: {effectiveRate.toFixed(2)}</span></p>
                    </div>
                    <div className="space-y-2 md:space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Elegir Tasa</Label>
                        <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                            {[{ id: "BCV", label: "BCV", val: rates.bcv, icon: <Landmark className="w-3 h-3"/> }, { id: "EUR", label: "EUR", val: rates.eur, icon: <Euro className="w-3 h-3"/> }, { id: "MANUAL", label: "Pers.", val: 0, icon: <Settings className="w-3 h-3"/> }].map(rate => (
                                <motion.div key={rate.id} whileTap={{ scale: 0.95 }} className="w-full">
                                    <Button variant={form.monedaTasa === rate.id ? "default" : "outline"} onClick={() => setForm({...form, monedaTasa: rate.id})} className={cn("rounded-xl h-10 md:h-12 w-full flex-col gap-0 px-0 transition-all", form.monedaTasa === rate.id && "bg-slate-900 text-white")}>
                                        <span className="text-[8px] md:text-[9px] font-black uppercase flex items-center gap-1">{rate.icon} {rate.label}</span>
                                        <span className="text-[9px] md:text-[10px] font-bold">{rate.id === "MANUAL" ? "Asignar" : rate.val.toFixed(2)}</span>
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vía</Label><Select value={form.metodo} onValueChange={v => setForm({...form, metodo: v})}><SelectTrigger className="rounded-xl bg-slate-100 border-none h-11 md:h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pago Móvil">Pago Móvil</SelectItem><SelectItem value="Zelle">Zelle</SelectItem><SelectItem value="Efectivo">Efectivo</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Referencia</Label><Input value={form.referencia} onChange={e => setForm({...form, referencia: e.target.value})} className="rounded-xl bg-slate-100 border-none h-11 md:h-12 font-black" /></div>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Voucher</Label><label className="flex flex-col items-center justify-center w-full h-28 md:h-32 rounded-2xl md:rounded-3xl border-2 border-dashed border-slate-200 hover:border-emerald-400 cursor-pointer overflow-hidden transition-all bg-slate-50">{form.previewUrl ? <img src={form.previewUrl} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-slate-400"><Upload className="w-5 h-5" /><span className="text-[10px] font-bold uppercase">Subir captura</span></div>}<input type="file" className="hidden" accept="image/*" onChange={onFileChange} /></label></div>
                </div>
                <DialogFooter className="mt-2 md:mt-0"><Button onClick={onConfirm} disabled={loading || !form.referencia} className="w-full h-14 md:h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl md:rounded-2xl font-black text-lg md:text-xl shadow-lg shadow-emerald-500/20 transition-all">{loading ? <Loader2 className="animate-spin" /> : "Confirmar Liquidación"}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AssignmentModal({ isOpen, onClose, designers, onConfirm, loading }: any) {
    const [localForm, setLocalForm] = useState({ cliente: "", detalles: "", designerId: "sin_asignar", precioDiseno: "", ancho: "", alto: "", material: "Vinil", precioM2: "10", incluirMaterial: true })
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-2xl rounded-3xl md:rounded-[2.5rem] border-none p-6 md:p-10 bg-white dark:bg-slate-950 z-[120] max-h-[90vh] overflow-y-auto shadow-2xl">
                <DialogHeader><DialogTitle className="text-xl md:text-3xl font-black uppercase italic tracking-tighter flex items-center gap-2 md:gap-3"><Plus className="w-6 h-6 md:w-8 md:h-8 text-blue-500"/> Nueva Tarea Express</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 py-4 md:py-6">
                    <div className="space-y-1 md:col-span-2"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre del Cliente</Label><Input value={localForm.cliente} onChange={e => setLocalForm({...localForm, cliente: e.target.value})} className="rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-12 md:h-14 font-bold" /></div>
                    <div className="space-y-1 md:col-span-2"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descripción</Label><Input value={localForm.detalles} onChange={e => setLocalForm({...localForm, detalles: e.target.value})} className="rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-12 md:h-14 font-bold" /></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Asignar Diseñador</Label><Select value={localForm.designerId} onValueChange={v => setLocalForm({...localForm, designerId: v})}><SelectTrigger className="rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-12 md:h-14 font-bold"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent className="z-[130]"><SelectItem value="sin_asignar">Sin asignar</SelectItem>{designers.map((d: any) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Precio Diseño ($)</Label><Input type="number" value={localForm.precioDiseno} onChange={e => setLocalForm({...localForm, precioDiseno: e.target.value})} className="rounded-xl md:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-12 md:h-14 font-black text-blue-600 text-xl md:text-2xl" /></div>
                    <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900 rounded-2xl md:rounded-[2rem] p-4 md:p-6 border border-slate-100 space-y-4 shadow-inner mt-2">
                        <div className="flex justify-between items-center"><span className="font-black text-slate-600 dark:text-slate-400 flex items-center gap-2 text-[11px] md:text-sm uppercase tracking-tighter"><Layers className="w-4 h-4 md:w-5 md:h-5"/> ¿Incluir Material?</span><Checkbox checked={localForm.incluirMaterial} onCheckedChange={v => setLocalForm({...localForm, incluirMaterial: v as boolean})} /></div>
                        <AnimatePresence>{localForm.incluirMaterial && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-3 md:gap-4 overflow-hidden pt-2"><div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Material</Label><Select value={localForm.material} onValueChange={v => setLocalForm({...localForm, material: v})}><SelectTrigger className="h-10 md:h-11 rounded-lg md:rounded-xl bg-white border-slate-200"><SelectValue /></SelectTrigger><SelectContent className="z-[130]"><SelectItem value="Vinil">Vinil</SelectItem><SelectItem value="Banner">Banner</SelectItem><SelectItem value="Clear">Vinil Clear</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Precio M²</Label><Input type="number" value={localForm.precioM2} onChange={e => setLocalForm({...localForm, precioM2: e.target.value})} className="h-10 md:h-11 rounded-lg md:rounded-xl bg-white border-slate-200" /></div><div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Ancho (cm)</Label><Input type="number" value={localForm.ancho} onChange={e => setLocalForm({...localForm, ancho: e.target.value})} className="h-10 md:h-11 rounded-lg md:rounded-xl bg-white border-slate-200" /></div><div className="space-y-1"><Label className="text-[9px] font-black uppercase ml-1">Alto (cm)</Label><Input type="number" value={localForm.alto} onChange={e => setLocalForm({...localForm, alto: e.target.value})} className="h-10 md:h-11 rounded-lg md:rounded-xl bg-white border-slate-200" /></div></motion.div>
                        )}</AnimatePresence>
                    </div>
                </div>
                <DialogFooter><Button onClick={() => onConfirm(localForm)} disabled={loading || !localForm.cliente} className="w-full h-14 md:h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-xl md:rounded-2xl font-black text-lg md:text-xl uppercase tracking-widest shadow-xl transition-all">{loading ? <Loader2 className="animate-spin" /> : "Crear Tarea"}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ImagePreviewModal({ imageUrl, onClose, onDownload }: { imageUrl: string | null, onClose: () => void, onDownload: () => void }) {
    return (
        <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] md:max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none z-[200]">
                <DialogHeader className="sr-only"><DialogTitle>Voucher</DialogTitle></DialogHeader>
                <div className="flex flex-col items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 rounded-3xl md:rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl w-full flex flex-col">
                        <div className="absolute top-3 right-3 md:top-4 md:right-4 flex items-center gap-2 z-50">
                            <Button onClick={onDownload} className="bg-slate-800/60 hover:bg-emerald-500 backdrop-blur-md text-white border border-white/10 rounded-xl md:rounded-2xl h-10 md:h-11 px-3 md:px-4 flex items-center gap-2 transition-all active:scale-95"><Download className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Descargar</span></Button>
                            <Button onClick={onClose} className="bg-slate-800/60 hover:bg-red-500 backdrop-blur-md text-white border border-white/10 rounded-xl md:rounded-2xl w-10 h-10 md:w-11 md:h-11 p-0 transition-all active:scale-95"><X className="w-5 h-5" /></Button>
                        </div>
                        <div className="w-full flex justify-center bg-slate-950/50">
                            {imageUrl ? <img src={imageUrl} alt="Voucher" className="max-h-[75vh] md:max-h-[80vh] w-auto object-contain" /> : <div className="h-64 w-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white/20" /></div>}
                        </div>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    )
}