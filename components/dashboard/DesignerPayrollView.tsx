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

// Iconos - Lucide (CORREGIDO: de "lucide-center" a "lucide-react")
import { 
    DollarSign, ChevronDown, Wallet, Search, Landmark, Trash2, AlertCircle,
    Plus, Zap, Layers, Palette, CreditCard, Loader2, Eye, ImageIcon, 
    TrendingUp, Settings, User, Ruler, Box, Upload, Euro, Download, X, Calendar,
    CheckCircle2, Receipt
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
    const [activeTab, setActiveTab] = useState("pendientes")
    const [expandedDesigner, setExpandedDesigner] = useState<string | null>(null)

    // Modales
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
    
    const [selectedOrder, setSelectedOrder] = useState<OrdenServicio | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    // Formulario de Pago
    const [payingItem, setPayingItem] = useState<{orderId: string, itemIndex: number, amount: number, designerName: string} | null>(null)
    const [paymentForm, setPaymentForm] = useState({
        referencia: "", 
        metodo: "Pago Móvil", 
        monedaTasa: "BCV" as "BCV" | "EUR" | "MANUAL", 
        customRate: "", 
        comprobanteFile: null as File | null, 
        previewUrl: ""
    })

    // --- ACCIONES ---
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
        } catch (error) { console.error("Error al descargar:", error); }
    };

    const handleReassign = async (orderId: string, itemIndex: number, newDesignerName: string) => {
        try {
            await updateOrdenItemField(orderId, itemIndex, { empleadoAsignado: newDesignerName });
        } catch (e) {
            console.error("Error al reasignar:", e);
            alert("Error al reasignar responsable.");
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
        setIsProcessing(true)
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
        } catch (e) { alert("Error al procesar el pago") } finally { setIsProcessing(false) }
    }

    // --- MOTOR DE DATOS UNIFICADO ---
    const allDesignTasks = useMemo(() => {
        return ordenes.flatMap(orden => 
            (orden.items || []).map((item, index) => {
                const isPaid = (item as any).designPaymentStatus?.toUpperCase() === 'PAGADO' || !!(item as any).paymentReference;
                const designerName = item.empleadoAsignado || "Sin Asignar";
                
                const matchedDesigner = designers.find(d => d.name === designerName);
                const designerId = matchedDesigner?.id || (designerName === "Sin Asignar" || designerName === "N/A" ? "sin_asignar" : "desconocido");

                return {
                    ...item,
                    orderId: orden.id,
                    orderNum: orden.ordenNumero,
                    itemIndex: index,
                    clientName: orden.cliente?.nombreRazonSocial || "Cliente Genérico",
                    designerId,
                    designerName,
                    isPaid,
                    fullOrder: orden,
                    totalTaskUSD: (item.precioUnitario || 0) * (item.cantidad || 1)
                }
            })
        ).filter(item => {
            const serviceType = (item.tipoServicio || "").toUpperCase();
            return serviceType === 'DISENO' || serviceType === 'DISEÑO';
        });
    }, [ordenes, designers]);

    const pendingGroups = useMemo(() => {
        const groups = [...designers, { id: 'sin_asignar', name: 'Sin Asignar' }].map(d => {
            const tasks = allDesignTasks.filter(t => {
                if (t.isPaid) return false;
                if (d.id === 'sin_asignar') return t.designerId === 'sin_asignar' || t.designerName === 'N/A';
                return t.designerId === d.id || t.designerName.toLowerCase() === d.name.toLowerCase();
            });
            return { ...d, tasks, totalUSD: tasks.reduce((s, t) => s + t.totalTaskUSD, 0) };
        });
        return groups.filter(g => g.tasks.length > 0 && g.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allDesignTasks, designers, searchTerm]);

    const historyList = useMemo(() => {
        return allDesignTasks
            .filter(t => t.isPaid)
            .filter(t => 
                t.designerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                String(t.orderNum).includes(searchTerm) ||
                t.clientName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date((b as any).paymentDate || 0).getTime() - new Date((a as any).paymentDate || 0).getTime());
    }, [allDesignTasks, searchTerm]);

    const totalPendingCount = pendingGroups.reduce((acc, group) => acc + group.tasks.length, 0);
    const totalHistoryCount = historyList.length;

    return (
        <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-4 lg:space-y-6 pb-10">
            
            <motion.header variants={itemVariants} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-3xl lg:rounded-[2rem] border shadow-sm">
                <div>
                    <h1 className="text-xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-2 lg:gap-3">
                        <Receipt className="w-6 h-6 lg:w-8 h-8 text-blue-600" /> Nómina de Diseño
                    </h1>
                    <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-0.5">Gestión de Liquidaciones</p>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <Button onClick={() => setIsAssignModalOpen(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl lg:rounded-2xl h-11 lg:h-12 px-4 lg:px-6 font-bold shadow-lg shadow-blue-500/20 gap-2 text-xs lg:text-base">
                        <Plus className="w-4 h-4 lg:w-5 h-5" /> Tarea Express
                    </Button>
                    <TeamManagement designers={designers} onAdd={addDesigner} onDelete={deleteDesigner} />
                </div>
            </motion.header>

            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
                <StatCard label="Por Liquidar" value={`$${pendingGroups.reduce((s, g) => s + g.totalUSD, 0).toFixed(2)}`} icon={<Wallet />} color="orange" />
                <StatCard label="Tasa BCV" value={`${bcvRate.toFixed(2)}`} icon={<Landmark />} color="blue" />
                <div className="col-span-2 md:col-span-1">
                    <StatCard label="Acumulado Pagado" value={`$${historyList.reduce((s, t) => s + t.totalTaskUSD, 0).toFixed(2)}`} icon={<CheckCircle2 />} color="emerald" />
                </div>
            </motion.div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 lg:space-y-6">
                <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl lg:rounded-3xl border shadow-sm">
                    <TabsList className="bg-transparent gap-1 lg:gap-2 h-10 lg:h-12 w-full md:w-auto overflow-x-auto">
                        <TabsTrigger value="pendientes" className="flex-1 md:flex-none rounded-xl lg:rounded-2xl px-4 lg:px-8 font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all uppercase text-[9px] lg:text-[10px] tracking-widest">
                            Pendientes ({totalPendingCount})
                        </TabsTrigger>
                        <TabsTrigger value="historial" className="flex-1 md:flex-none rounded-xl lg:rounded-2xl px-4 lg:px-8 font-black data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all uppercase text-[9px] lg:text-[10px] tracking-widest">
                            Historial ({totalHistoryCount})
                        </TabsTrigger>
                    </TabsList>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Buscar..." className="pl-10 rounded-xl lg:rounded-2xl border-none bg-slate-100 dark:bg-slate-800 h-10 lg:h-12 font-bold text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </motion.div>

                <TabsContent value="pendientes">
                    <LayoutGroup>
                        <div className="space-y-3 lg:space-y-4">
                            {pendingGroups.length === 0 ? <EmptyState text="No hay tareas pendientes" /> : (
                                pendingGroups.map(group => (
                                    <DesignerCollapse 
                                        key={group.id} group={group} isExpanded={expandedDesigner === group.id}
                                        onToggle={() => setExpandedDesigner(expandedDesigner === group.id ? null : group.id)}
                                        onPay={(task: any) => { setPayingItem({ orderId: task.orderId, itemIndex: task.itemIndex, amount: task.totalTaskUSD, designerName: group.name }); setIsPaymentModalOpen(true); }}
                                        onView={(task: any) => { setSelectedOrder(task.fullOrder); setIsDetailModalOpen(true); }}
                                        designersList={designers} onReassign={handleReassign}
                                    />
                                ))
                            )}
                        </div>
                    </LayoutGroup>
                </TabsContent>

                <TabsContent value="historial">
                    <Card className="rounded-2xl lg:rounded-[2rem] border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 h-14 lg:h-16">
                                    <TableRow className="border-none">
                                        <TableHead className="px-4 lg:px-8 font-black text-[9px] lg:text-[10px] uppercase tracking-widest">Fecha</TableHead>
                                        <TableHead className="font-black text-[9px] lg:text-[10px] uppercase tracking-widest">Orden</TableHead>
                                        <TableHead className="hidden md:table-cell font-black text-[9px] lg:text-[10px] uppercase tracking-widest">Diseñador</TableHead>
                                        <TableHead className="text-right font-black text-[9px] lg:text-[10px] uppercase tracking-widest">Monto</TableHead>
                                        <TableHead className="text-center font-black text-[9px] lg:text-[10px] uppercase tracking-widest">Voucher</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyList.map((item, idx) => (
                                        <TableRow key={idx} className="h-16 lg:h-20 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="px-4 lg:px-8 font-bold text-slate-500 text-[10px] lg:text-xs">{item.paymentDate ? new Date(item.paymentDate).toLocaleDateString() : '---'}</TableCell>
                                            <TableCell><div className="font-black text-blue-600 text-xs lg:text-sm">#{item.orderNum}</div><div className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[80px] lg:max-w-none">{item.clientName}</div></TableCell>
                                            <TableCell className="hidden md:table-cell"><Badge className="bg-slate-100 text-slate-900 border-none rounded-lg px-3 font-black text-[10px] uppercase">{item.designerName}</Badge></TableCell>
                                            <TableCell className="text-right"><div className="font-black text-emerald-600 text-sm lg:text-xl">${item.totalTaskUSD.toFixed(2)}</div></TableCell>
                                            <TableCell className="text-center">{(item as any).paymentScreenshotUrl && <Button variant="ghost" size="icon" onClick={() => setPreviewImageUrl((item as any).paymentScreenshotUrl)} className="text-blue-500 h-8 w-8"><ImageIcon className="w-5 h-5" /></Button>}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modales */}
            <PaymentModal 
                isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} item={payingItem} 
                form={paymentForm} setForm={setPaymentForm} rates={{ bcv: bcvRate, eur: eurRate }}
                onConfirm={confirmFinalPayment} loading={isProcessing} onFileChange={handleFileChange}
            />

            <AssignmentModal 
                isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} designers={designers}
                loading={isProcessing}
                onConfirm={async (data: any) => {
                    setIsProcessing(true);
                    try {
                        const lastNum = await getLastOrderNumber();
                        const items: ItemOrden[] = [{
                            nombre: `Diseño: ${data.detalles}`, tipoServicio: "DISENO", cantidad: 1, unidad: "und", 
                            precioUnitario: parseFloat(data.precioDiseno || "0"), 
                            empleadoAsignado: designers.find(d => d.id === data.designerId)?.name || "Sin Asignar",
                            // @ts-ignore
                            designPaymentStatus: 'PENDIENTE'
                        }];
                        if (data.incluirMaterial) {
                            const materialPrice = (parseFloat(data.ancho || "0") * parseFloat(data.alto || "0") * parseFloat(data.precioM2 || "10")) / 10000;
                            items.push({ nombre: `Producción: ${data.material} (${data.ancho}x${data.alto}cm)`, tipoServicio: "IMPRESION", cantidad: 1, unidad: "und", precioUnitario: materialPrice, materialDeImpresion: data.material });
                        }
                        await createOrden({ 
                            ordenNumero: String(lastNum + 1), fecha: new Date().toISOString(), 
                            cliente: { nombreRazonSocial: data.cliente, rifCedula: "V-EXPRESS", telefono: "N/A", correo: "N/A", domicilioFiscal: "N/A", personaContacto: "N/A" }, 
                            items, serviciosSolicitados: { impresionDigital: false, impresionGranFormato: data.incluirMaterial, corteLaser: false, laminacion: false, avisoCorporeo: false, rotulacion: false, instalacion: false, senaletica: false }, 
                            descripcionDetallada: data.detalles || "Express", totalUSD: items.reduce((s, i) => s + i.precioUnitario, 0), montoPagadoUSD: 0, estadoPago: EstadoPago.PENDIENTE, estado: EstadoOrden.PENDIENTE, designerId: data.designerId 
                        });
                        setIsAssignModalOpen(false);
                    } catch (e) { alert("Error al crear tarea") } finally { setIsProcessing(false) }
                }}
            />

            <OrderDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} orden={selectedOrder} bcvRate={bcvRate} />
            <ImagePreviewModal imageUrl={previewImageUrl} onClose={() => setPreviewImageUrl(null)} onDownload={() => previewImageUrl && handleDownloadImage(previewImageUrl)} />
        </motion.div>
    )
}

// --- SUB-COMPONENTES INTERNOS ---

function DesignerCollapse({ group, isExpanded, onToggle, onPay, onView, designersList, onReassign }: any) {
    return (
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900 rounded-2xl lg:rounded-[2rem]">
            <button onClick={onToggle} className="w-full flex items-center justify-between p-4 lg:p-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3 lg:gap-5">
                    <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm lg:text-xl italic">{group.name.charAt(0)}</div>
                    <div className="text-left"><h3 className="font-black text-sm lg:text-xl uppercase tracking-tighter truncate max-w-[120px] lg:max-w-none">{group.name}</h3><Badge variant="secondary" className="font-bold text-[8px] lg:text-[10px] mt-0.5 lg:mt-1 uppercase">Tareas: {group.tasks.length}</Badge></div>
                </div>
                <div className="flex items-center gap-3 lg:gap-8">
                    <div className="text-right"><p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendiente</p><p className="text-lg lg:text-3xl font-black text-orange-600 tracking-tighter">${group.totalUSD.toFixed(2)}</p></div>
                    <ChevronDown className={cn("w-5 h-5 lg:w-6 h-6 text-slate-300 transition-transform duration-300", isExpanded && "rotate-180 text-blue-600")} />
                </div>
            </button>
            <AnimatePresence>{isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 lg:px-6 pb-4 lg:pb-6 space-y-2 lg:space-y-3">
                    {group.tasks.map((task: any) => (
                        <div key={`${task.orderId}-${task.itemIndex}`} className="flex flex-col md:flex-row items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 lg:p-5 rounded-xl lg:rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm gap-3 lg:gap-4">
                            <div className="flex-1 w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-blue-600 text-xs lg:text-sm">#{task.orderNum}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] lg:text-xs truncate">{task.nombre}</span>
                                </div>
                                <div className="text-[9px] lg:text-[10px] font-bold text-slate-400 mt-0.5 lg:mt-1 uppercase"><User className="inline w-3 h-3 mr-1" /> {task.clientName}</div>
                            </div>
                            <div className="flex items-center gap-2 lg:gap-3 w-full md:w-auto justify-between md:justify-end">
                                <div className="font-black text-lg lg:text-xl text-slate-900 dark:text-white">${task.totalTaskUSD.toFixed(2)}</div>
                                <div className="flex gap-1.5 lg:gap-2">
                                    <Button variant="outline" size="icon" className="rounded-lg lg:rounded-xl h-8 w-8 lg:h-10 lg:w-10" onClick={() => onView(task)}><Eye className="w-4 h-4" /></Button>
                                    <Select value={task.designerId} onValueChange={(v) => onReassign(task.orderId, task.itemIndex, designersList.find((dl:any) => dl.id === v)?.name || "Sin Asignar")}>
                                        <SelectTrigger className="w-24 lg:w-32 h-8 lg:h-10 rounded-lg lg:rounded-xl bg-white dark:bg-slate-900 text-[9px] lg:text-[10px] font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="sin_asignar">Sin Asignar</SelectItem>{designersList.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button onClick={() => onPay(task)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg lg:rounded-xl h-8 lg:h-10 px-3 lg:px-6 font-black uppercase text-[9px] lg:text-[10px] tracking-widest shadow-lg shadow-emerald-500/20">Pagar</Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </motion.div>
            )}</AnimatePresence>
        </Card>
    );
}

function StatCard({ label, value, icon, color }: any) {
    const variants: any = { orange: "bg-orange-50 text-orange-600", blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600" };
    return (
        <Card className="border-none shadow-sm rounded-2xl lg:rounded-[2rem] bg-white dark:bg-slate-900 p-4 lg:p-8 flex items-center gap-3 lg:gap-6">
            <div className={cn("p-3 lg:p-5 rounded-xl lg:rounded-2xl", variants[color])}>{React.cloneElement(icon, { className: "w-5 h-5 lg:w-8 h-8" })}</div>
            <div>
                <p className="text-[8px] lg:text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
                <h3 className="text-lg lg:text-3xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{value}</h3>
            </div>
        </Card>
    );
}

function EmptyState({ text }: { text: string }) {
    return <div className="p-10 lg:p-20 text-center bg-white dark:bg-slate-900 rounded-[2rem] lg:rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800"><Palette className="w-8 h-8 lg:w-12 h-12 text-slate-200 mx-auto mb-4" /><p className="font-black text-slate-300 uppercase text-sm lg:text-xl tracking-tighter">{text}</p></div>;
}

function PaymentModal({ isOpen, onClose, item, form, setForm, rates, onConfirm, loading, onFileChange }: any) {
    const effectiveRate = form.monedaTasa === "BCV" ? rates.bcv : form.monedaTasa === "EUR" ? rates.eur : parseFloat(form.customRate) || 0;
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-8 bg-white dark:bg-slate-950 max-w-md border-none shadow-2xl overflow-hidden w-[95vw] lg:w-full">
                <DialogHeader><DialogTitle className="text-xl lg:text-2xl font-black flex items-center gap-3"><CreditCard className="text-emerald-500 w-6 h-6 lg:w-8 h-8" /> Liquidar Pago</DialogTitle></DialogHeader>
                <div className="space-y-4 lg:space-y-6 py-2 lg:py-4">
                    <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 lg:p-8 rounded-2xl lg:rounded-[2rem] text-center border border-emerald-100 dark:border-emerald-500/10">
                        <h2 className="text-3xl lg:text-5xl font-black text-emerald-600 tracking-tighter">${item?.amount.toFixed(2)}</h2>
                        <p className="text-sm lg:text-xl font-black mt-1 text-slate-700 dark:text-slate-300 tracking-tighter">Bs. {((item?.amount || 0) * effectiveRate).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:gap-4">
                        <div className="space-y-1"><Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Vía</Label><Select value={form.metodo} onValueChange={v => setForm({...form, metodo: v})}><SelectTrigger className="rounded-xl h-10 lg:h-12 bg-slate-100 dark:bg-slate-800 border-none font-bold text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pago Móvil">Pago Móvil</SelectItem><SelectItem value="Zelle">Zelle</SelectItem><SelectItem value="Efectivo">Efectivo</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Ref.</Label><Input value={form.referencia} onChange={e => setForm({...form, referencia: e.target.value})} className="rounded-xl h-10 lg:h-12 bg-slate-100 dark:bg-slate-800 border-none font-black text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:gap-4">
                        <div className="space-y-1"><Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Tasa</Label><Select value={form.monedaTasa} onValueChange={v => setForm({...form, monedaTasa: v})}><SelectTrigger className="rounded-xl h-10 lg:h-12 bg-slate-100 dark:bg-slate-800 border-none font-bold text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BCV">Dólar BCV</SelectItem><SelectItem value="EUR">Euro BCV</SelectItem><SelectItem value="MANUAL">Manual</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1">
                            <Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Valor</Label>
                            {form.monedaTasa === "MANUAL" ? <Input type="number" value={form.customRate} onChange={e => setForm({...form, customRate: e.target.value})} className="rounded-xl h-10 lg:h-12 bg-slate-100 dark:bg-slate-800 border-none font-black text-orange-600 text-xs" /> : <div className="h-10 lg:h-12 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center px-4 font-black text-slate-500 border border-slate-100 dark:border-slate-800 text-xs">{effectiveRate.toFixed(2)}</div>}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Voucher</Label>
                        <label className="flex flex-col items-center justify-center w-full h-24 lg:h-32 rounded-2xl lg:rounded-3xl border-2 border-dashed cursor-pointer overflow-hidden transition-all bg-slate-50 dark:bg-slate-800 hover:border-emerald-400 border-slate-200 dark:border-slate-700">
                            {form.previewUrl ? <img src={form.previewUrl} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1"><Upload className="w-5 h-5 lg:w-6 h-6 text-slate-400" /><span className="text-[7px] lg:text-[8px] font-bold text-slate-400 uppercase tracking-widest">Subir Imagen</span></div>}
                            <input type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                        </label>
                    </div>
                </div>
                <DialogFooter><Button onClick={onConfirm} disabled={loading || !form.referencia} className="w-full h-12 lg:h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl lg:rounded-2xl font-black text-lg lg:text-xl shadow-lg shadow-emerald-500/20 uppercase">{loading ? <Loader2 className="animate-spin" /> : "Confirmar Pago"}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ImagePreviewModal({ imageUrl, onClose, onDownload }: any) {
    return (
        <Dialog open={!!imageUrl} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] lg:max-w-4xl p-0 bg-transparent border-none shadow-none z-[200]">
                <DialogHeader className="sr-only"><DialogTitle>Vista previa</DialogTitle></DialogHeader>
                <div className="flex flex-col items-center p-2 lg:p-4">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-slate-900 rounded-2xl lg:rounded-[2.5rem] overflow-hidden border-2 lg:border-4 border-white/10 shadow-2xl w-full flex flex-col items-center">
                        <div className="absolute top-2 right-2 lg:top-4 lg:right-4 flex gap-2 z-50">
                            <Button onClick={onDownload} className="bg-slate-800/60 text-white rounded-xl h-9 lg:h-11 px-3 lg:px-4 gap-2 hover:bg-emerald-500 text-[9px] lg:text-[10px] uppercase font-black"><Download className="w-4 h-4" /> <span className="hidden lg:inline">Descargar</span></Button>
                            <Button onClick={onClose} className="bg-slate-800/60 text-white rounded-xl w-9 h-9 lg:w-11 lg:h-11 p-0 hover:bg-red-500"><X className="w-5 h-5" /></Button>
                        </div>
                        <img src={imageUrl} alt="Voucher" className="max-h-[70vh] lg:max-h-[80vh] w-auto object-contain" />
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function AssignmentModal({ isOpen, onClose, designers, onConfirm, loading }: any) {
    const [localForm, setLocalForm] = useState({ cliente: "", detalles: "", designerId: "sin_asignar", precioDiseno: "", ancho: "", alto: "", material: "Vinil", precioM2: "10", incluirMaterial: true })
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 bg-white dark:bg-slate-950 border-none shadow-2xl overflow-y-auto max-h-[90vh] w-[95vw] lg:w-full">
                <DialogHeader><DialogTitle className="text-xl lg:text-3xl font-black uppercase italic tracking-tighter flex items-center gap-2 lg:gap-3"><Plus className="w-6 h-6 lg:w-8 h-8 text-blue-500"/> Nueva Tarea Express</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4 lg:gap-6 py-4 lg:py-6">
                    <div className="space-y-1 col-span-2"><Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Cliente</Label><Input value={localForm.cliente} onChange={e => setLocalForm({...localForm, cliente: e.target.value})} className="rounded-xl lg:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-11 lg:h-14 font-bold text-sm" /></div>
                    <div className="space-y-1 col-span-2"><Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Descripción</Label><Input value={localForm.detalles} onChange={e => setLocalForm({...localForm, detalles: e.target.value})} className="rounded-xl lg:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-11 lg:h-14 font-bold text-sm" /></div>
                    <div className="space-y-1">
                        <Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Diseñador</Label>
                        <Select value={localForm.designerId} onValueChange={v => setLocalForm({...localForm, designerId: v})}><SelectTrigger className="rounded-xl lg:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-11 lg:h-14 font-bold text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger><SelectContent className="z-[150]"><SelectItem value="sin_asignar">Sin asignar</SelectItem>{designers.map((d: any) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}</SelectContent></Select>
                    </div>
                    <div className="space-y-1"><Label className="text-[9px] lg:text-[10px] font-black uppercase text-slate-400 ml-1">Precio Diseño</Label><Input type="number" value={localForm.precioDiseno} onChange={e => setLocalForm({...localForm, precioDiseno: e.target.value})} className="rounded-xl lg:rounded-2xl bg-slate-100 dark:bg-slate-800 border-none h-11 lg:h-14 font-black text-blue-600 text-xl lg:text-2xl" /></div>
                    <div className="col-span-2 bg-slate-50 dark:bg-slate-900 rounded-2xl lg:rounded-[2rem] p-4 lg:p-6 border border-slate-100 dark:border-slate-800 space-y-3 lg:space-y-4 shadow-inner">
                        <div className="flex justify-between items-center"><span className="font-black text-slate-600 dark:text-slate-400 flex items-center gap-2 text-[10px] lg:text-sm uppercase tracking-widest"><Layers className="w-4 h-4 lg:w-5 h-5"/> ¿Producción?</span><Checkbox checked={localForm.incluirMaterial} onCheckedChange={v => setLocalForm({...localForm, incluirMaterial: v as boolean})} /></div>
                        {localForm.incluirMaterial && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-2 gap-2 lg:gap-4 pt-1 lg:pt-2">
                                <div className="space-y-1"><Label className="text-[8px] lg:text-[9px] font-black uppercase text-slate-400">Material</Label><Select value={localForm.material} onValueChange={v => setLocalForm({...localForm, material: v})}><SelectTrigger className="h-9 lg:h-11 rounded-lg lg:rounded-xl bg-white dark:bg-slate-800 border-slate-200 font-bold text-[10px]"><SelectValue /></SelectTrigger><SelectContent className="z-[150]"><SelectItem value="Vinil">Vinil</SelectItem><SelectItem value="Banner">Banner</SelectItem><SelectItem value="Microperforado">Microperforado</SelectItem><SelectItem value="Clear">Clear</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1"><Label className="text-[8px] lg:text-[9px] font-black uppercase text-slate-400">Ancho (cm)</Label><Input type="number" value={localForm.ancho} onChange={e => setLocalForm({...localForm, ancho: e.target.value})} className="h-9 lg:h-11 rounded-lg lg:rounded-xl bg-white dark:bg-slate-800 border-slate-200 text-xs" /></div>
                                <div className="space-y-1"><Label className="text-[8px] lg:text-[9px] font-black uppercase text-slate-400">Alto (cm)</Label><Input type="number" value={localForm.alto} onChange={e => setLocalForm({...localForm, alto: e.target.value})} className="h-9 lg:h-11 rounded-lg lg:rounded-xl bg-white dark:bg-slate-800 border-slate-200 text-xs" /></div>
                                <div className="space-y-1"><Label className="text-[8px] lg:text-[9px] font-black uppercase text-slate-400">Precio m²</Label><Input type="number" value={localForm.precioM2} onChange={e => setLocalForm({...localForm, precioM2: e.target.value})} className="h-9 lg:h-11 rounded-lg lg:rounded-xl bg-white dark:bg-slate-800 border-slate-200 font-bold text-xs" /></div>
                            </motion.div>
                        )}
                    </div>
                </div>
                <DialogFooter><Button onClick={() => onConfirm(localForm)} disabled={loading || !localForm.cliente} className="w-full h-12 lg:h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-xl lg:rounded-2xl font-black text-lg lg:text-xl uppercase tracking-widest shadow-xl transition-all"> {loading ? <Loader2 className="animate-spin" /> : "Crear Tarea"}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}