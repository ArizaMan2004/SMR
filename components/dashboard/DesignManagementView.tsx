// @/components/dashboard/DesignManagementView.tsx
"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
    Palette, FileImage, FileCode, Settings, Trash2, Plus, Zap, 
    CheckCircle, Clock, Send, DollarSign, Euro, User, Briefcase, X, UserCheck
} from "lucide-react"

import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden"
import { subscribeToDesigners, addDesigner, deleteDesigner, type Designer } from "@/lib/services/designers-service"
import { updateOrdenDesign, createOrden, updateOrdenItemField } from "@/lib/services/ordenes-service"
import { getLastOrderNumber } from "@/lib/firebase/ordenes"
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"

type DesignPaymentStatus = "PENDIENTE" | "PAGADO";

const TIPOS_ARCHIVO = [
    { value: "vector", label: "Vector", icon: FileCode },
    { value: "imagen", label: "Imagen", icon: FileImage },
]
const FORMATOS_ARCHIVO: Record<string, string[]> = {
    vector: ["CDR", "AI", "PDF", "DXF", "EPS", "SVG"],
    imagen: ["JPG", "PNG", "PSD", "TIFF", "BMP"]
}

const SOLICITANTES = ["Marcos Leal", "Samuel Leal", "Cliente Directo"];

export function DesignManagementView({ ordenes, currentBcvRate }: { ordenes: OrdenServicio[], currentBcvRate: number }) {
    
    // --- ESTADOS GENERALES ---
    const [designers, setDesigners] = useState<Designer[]>([])
    const [newDesignerName, setNewDesignerName] = useState("")
    const [rates, setRates] = useState({ usd: currentBcvRate || 0, eur: 0 })
    const [rowCurrencyMode, setRowCurrencyMode] = useState<Record<string, "USD" | "EUR">>({})

    // --- ESTADOS DISEÑO EXPRESS ---
    const [isExpressOpen, setIsExpressOpen] = useState(false)
    const [expressLoading, setExpressLoading] = useState(false)
    
    // Datos de Cabecera Express
    const [expressClientName, setExpressClientName] = useState("")
    const [solicitadoPor, setSolicitadoPor] = useState("Cliente Directo") 

    // Lista de ítems
    const [expressItemsList, setExpressItemsList] = useState<ItemOrden[]>([])

    // Estado del item actual
    const initialItemState = {
        descripcion: "",
        precioUsd: "",
        isPricePending: false,
        designerId: "sin_asignar",
        archivoTipo: "vector" as "vector" | "imagen",
        archivoFormato: "CDR",
        paymentStatus: "PENDIENTE" as DesignPaymentStatus
    }
    const [currentItem, setCurrentItem] = useState(initialItemState)

    // --- EFECTOS ---
    useEffect(() => {
        const unsubscribe = subscribeToDesigners(setDesigners)
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        const loadRates = async () => {
            try {
                const data: any = await fetchBCVRateFromAPI();
                setRates({
                    usd: data.usdRate || data.rate || currentBcvRate || 0,
                    eur: data.eurRate || 0 
                })
            } catch (e) {
                setRates({ usd: currentBcvRate || 0, eur: 0 }) 
            }
        }
        loadRates();
    }, [currentBcvRate])

    // --- LÓGICA DE DATOS ---
    const groupedTasks = useMemo(() => {
        if (!ordenes) return {};

        const allTasks = ordenes.flatMap(orden => {
            const itemsDiseno = orden.items?.map((item, idx) => ({ ...item, originalIndex: idx })).filter((i: any) => i.tipoServicio === 'DISENO') || [];
            
            return itemsDiseno.map((item) => {
                let effectiveDesignerId = orden.designerId || "sin_asignar";
                if (effectiveDesignerId === "sin_asignar" && item.empleadoAsignado && item.empleadoAsignado !== "Sin Asignar" && item.empleadoAsignado !== "N/A") {
                    const match = designers.find(d => d.name.toLowerCase().includes(item.empleadoAsignado!.toLowerCase()));
                    if(match) effectiveDesignerId = match.id;
                }

                // @ts-ignore
                let solicitante = item.solicitadoPor || "Cliente Directo";
                
                // Fallback para órdenes viejas
                if (!item.hasOwnProperty('solicitadoPor') && orden.descripcionDetallada?.includes("Solicitado por:")) {
                     const parts = orden.descripcionDetallada.split("Solicitado por:");
                     if (parts[1]) solicitante = parts[1].split(".")[0].trim();
                }

                return {
                    uniqueKey: `${orden.id}-${item.originalIndex}`,
                    ...item,
                    ordenId: orden.id,
                    ordenNumero: orden.ordenNumero,
                    clienteNombre: orden.cliente?.nombreRazonSocial || orden.nombreCliente,
                    designStatus: orden.designStatus,
                    designerId: effectiveDesignerId,
                    // @ts-ignore
                    paymentStatus: item.designPaymentStatus || "PENDIENTE" as DesignPaymentStatus,
                    solicitadoPor: solicitante 
                };
            });
        });

        const groups: Record<string, typeof allTasks> = { "sin_asignar": [] };
        designers.forEach(d => { groups[d.id] = [] });

        allTasks.forEach(task => {
            const key = task.designerId && groups[task.designerId] ? task.designerId : "sin_asignar";
            groups[key].push(task);
        });

        return groups;
    }, [ordenes, designers]);

    // --- MANEJADORES ---
    const handleStatusChange = (ordenId: string, s: string) => updateOrdenDesign(ordenId, { designStatus: s });
    const handleDesignerChange = (ordenId: string, d: string) => updateOrdenDesign(ordenId, { designerId: d });
    const handlePaymentStatusChange = (ordenId: string, itemIndex: number, status: string) => updateOrdenItemField(ordenId, itemIndex, { designPaymentStatus: status });
    const handleSolicitantChange = (ordenId: string, itemIndex: number, solicitante: string) => {
        updateOrdenItemField(ordenId, itemIndex, { solicitadoPor: solicitante });
    }
    const toggleRowCurrency = (uniqueKey: string) => setRowCurrencyMode(prev => ({...prev, [uniqueKey]: prev[uniqueKey] === 'EUR' ? 'USD' : 'EUR'}));
    const handleAddDesigner = async () => { if(newDesignerName.trim()) { await addDesigner(newDesignerName); setNewDesignerName(""); } }
    const handleDeleteDesigner = async (id: string) => { if(confirm("¿Eliminar?")) await deleteDesigner(id); }

    // --- LÓGICA MODAL EXPRESS ---
    const handleAddItemToList = () => {
        if (!currentItem.descripcion) return alert("Falta descripción del ítem");
        
        const designerName = currentItem.designerId !== "sin_asignar" 
            ? designers.find(d => d.id === currentItem.designerId)?.name || "Sin Asignar"
            : "Sin Asignar";

        const newItem: ItemOrden = {
            nombre: `Diseño: ${currentItem.descripcion}`,
            tipoServicio: "DISENO",
            cantidad: 1,
            unidad: "und",
            precioUnitario: currentItem.isPricePending ? 0 : (parseFloat(currentItem.precioUsd) || 0),
            empleadoAsignado: designerName,
            // @ts-ignore
            archivoTipo: currentItem.archivoTipo,
            // @ts-ignore
            archivoFormato: currentItem.archivoFormato,
            // @ts-ignore
            designPaymentStatus: currentItem.paymentStatus,
            // @ts-ignore
            isPricePending: currentItem.isPricePending 
        };

        setExpressItemsList([...expressItemsList, newItem]);
        setCurrentItem(initialItemState); 
    };

    const handleRemoveItemFromList = (index: number) => {
        const newList = [...expressItemsList];
        newList.splice(index, 1);
        setExpressItemsList(newList);
    };

    const handleCreateExpressOrder = async () => {
        if (!expressClientName) return alert("Falta el nombre del cliente");
        if (expressItemsList.length === 0) return alert("Debes agregar al menos un ítem");
        
        setExpressLoading(true);
        try {
            const lastNum = await getLastOrderNumber();
            const totalOrderUSD = expressItemsList.reduce((sum, item) => sum + item.precioUnitario, 0);
            
            const mainDesignerId = expressItemsList[0].empleadoAsignado !== "Sin Asignar" 
                ? designers.find(d => d.name === expressItemsList[0].empleadoAsignado)?.id 
                : "sin_asignar";

            const payload = {
                ordenNumero: lastNum + 1,
                fechaCreacion: new Date().toISOString(),
                fechaEntrega: new Date().toISOString().split('T')[0],
                cliente: { 
                    nombreRazonSocial: expressClientName, 
                    telefono: "0000", rifCedula: "V-Express" 
                },
                items: expressItemsList,
                totalUSD: totalOrderUSD,
                serviciosSolicitados: { designOnly: true },
                status: "PENDIENTE",
                designStatus: "pendiente",
                designerId: mainDesignerId || "sin_asignar",
                descripcionDetallada: `Solicitado por: ${solicitadoPor}. Orden Express.`
            };

            // @ts-ignore
            await createOrden(payload);
            
            setIsExpressOpen(false);
            setExpressClientName("");
            setSolicitadoPor("Cliente Directo");
            setExpressItemsList([]);
            setCurrentItem(initialItemState);
        } catch (e) {
            console.error(e);
            alert("Error al crear la orden");
        } finally {
            setExpressLoading(false);
        }
    }

    const calculateBsForRow = (usdPrice: number, mode: "USD" | "EUR") => {
        const rate = mode === 'USD' ? rates.usd : rates.eur;
        const finalRate = rate || rates.usd || 0; 
        return (usdPrice * finalRate).toFixed(2);
    }

    return (
        <div className="space-y-8">
            
            {/* CABECERA */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <Briefcase className="w-6 h-6 text-primary"/> Gestión de Diseño y Producción
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tasas activas: <span className="font-bold text-green-600">1$ = {rates.usd.toFixed(2)} Bs</span> 
                        {rates.eur > 0 && <span className="ml-2 font-bold text-blue-600">| 1€ = {rates.eur.toFixed(2)} Bs</span>}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Dialog>
                        <DialogTrigger asChild><Button variant="outline" size="sm"><Settings className="w-4 h-4 mr-2"/> Equipo</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Equipo de Diseño</DialogTitle></DialogHeader>
                            <div className="flex gap-2 mt-4"><Input placeholder="Nombre..." value={newDesignerName} onChange={e=>setNewDesignerName(e.target.value)}/><Button onClick={handleAddDesigner}><Plus/></Button></div>
                            <div className="mt-4 space-y-1">{designers.map(d=><div key={d.id} className="flex justify-between p-2 border rounded"><span>{d.name}</span><Trash2 className="w-4 h-4 cursor-pointer text-red-500" onClick={()=>handleDeleteDesigner(d.id)}/></div>)}</div>
                        </DialogContent>
                    </Dialog>

                    {/* --- MODAL DISEÑO EXPRESS --- */}
                    <Dialog open={isExpressOpen} onOpenChange={setIsExpressOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white"><Zap className="w-4 h-4 mr-2"/> Diseño Express</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Crear Orden Express</DialogTitle></DialogHeader>
                            <div className="space-y-6 py-2">
                                
                                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded border">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Cliente / Referencia</Label>
                                        <Input value={expressClientName} onChange={e=>setExpressClientName(e.target.value)} placeholder="Ej: Juan Pérez" className="bg-white"/>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Solicitado Por</Label>
                                        <Select value={solicitadoPor} onValueChange={setSolicitadoPor}>
                                            <SelectTrigger className="bg-white"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                {SOLICITANTES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4 border rounded-md p-4 relative pt-5">
                                    <div className="absolute -top-2.5 left-3 bg-white px-2 text-xs font-bold text-indigo-600">Agregar Ítem de Diseño</div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-1.5">
                                            <Label>Descripción del Trabajo</Label>
                                            <Input value={currentItem.descripcion} onChange={e=>setCurrentItem({...currentItem, descripcion: e.target.value})} placeholder="Ej: Flyer promocional..."/>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label>Diseñador Asignado</Label>
                                            <Select value={currentItem.designerId} onValueChange={v=>setCurrentItem({...currentItem, designerId: v})}>
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sin_asignar">-- Sin Asignar --</SelectItem>
                                                    {designers.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label>Estado de Pago (Interno)</Label>
                                            <Select value={currentItem.paymentStatus} onValueChange={(v:any)=>setCurrentItem({...currentItem, paymentStatus: v})}>
                                                <SelectTrigger className={currentItem.paymentStatus === 'PAGADO' ? "text-green-600 font-bold" : ""}><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PENDIENTE">⏳ Pendiente</SelectItem>
                                                    <SelectItem value="PAGADO">💰 Pagado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label>Formato de Entrega</Label>
                                            <div className="flex gap-2">
                                                <Select value={currentItem.archivoTipo} onValueChange={(v:any)=>setCurrentItem({...currentItem, archivoTipo: v, archivoFormato: FORMATOS_ARCHIVO[v][0]})}>
                                                    <SelectTrigger className="w-[100px]"><SelectValue/></SelectTrigger>
                                                    <SelectContent>{TIPOS_ARCHIVO.map(t=><SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                                <Select value={currentItem.archivoFormato} onValueChange={v=>setCurrentItem({...currentItem, archivoFormato: v})}>
                                                    <SelectTrigger className="flex-1"><SelectValue/></SelectTrigger>
                                                    <SelectContent>{FORMATOS_ARCHIVO[currentItem.archivoTipo].map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <Label>Precio ($)</Label>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id="pendingPrice" 
                                                        checked={currentItem.isPricePending}
                                                        onCheckedChange={(c) => setCurrentItem({...currentItem, isPricePending: c as boolean, precioUsd: ""})}
                                                    />
                                                    <label htmlFor="pendingPrice" className="text-[10px] font-medium leading-none cursor-pointer text-orange-600">
                                                        Por Acordar
                                                    </label>
                                                </div>
                                            </div>
                                            <Input 
                                                type="number" 
                                                value={currentItem.precioUsd} 
                                                onChange={e=>setCurrentItem({...currentItem, precioUsd: e.target.value})} 
                                                placeholder="0.00"
                                                disabled={currentItem.isPricePending}
                                                className={currentItem.isPricePending ? "bg-orange-50 cursor-not-allowed" : ""}
                                            />
                                        </div>
                                    </div>
                                    
                                    <Button onClick={handleAddItemToList} variant="secondary" className="w-full border-dashed border-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                                        <Plus className="w-4 h-4 mr-2"/> Agregar a la Lista
                                    </Button>
                                </div>

                                {expressItemsList.length > 0 && (
                                    <div className="border rounded-md overflow-hidden">
                                        <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 uppercase">Resumen</div>
                                        <Table>
                                            <TableBody>
                                                {expressItemsList.map((item, idx) => (
                                                    <TableRow key={idx} className="h-10">
                                                        <TableCell className="py-1">
                                                            <div className="font-medium text-sm">{item.nombre}</div>
                                                            <div className="text-[10px] text-muted-foreground">{item.empleadoAsignado}</div>
                                                        </TableCell>
                                                        <TableCell className="py-1 text-right font-mono">
                                                            {/* @ts-ignore */}
                                                            {item.isPricePending || item.precioUnitario === 0 ? (
                                                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Por Acordar</Badge>
                                                            ) : (
                                                                `$${item.precioUnitario}`
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-1 w-[40px]">
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleRemoveItemFromList(idx)}><X className="w-3 h-3"/></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="bg-slate-50 p-3 text-right">
                                            <span className="text-xs text-muted-foreground mr-2">Total Estimado:</span>
                                            <span className="font-bold text-lg">${expressItemsList.reduce((s, i) => s + i.precioUnitario, 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}

                            </div>
                            <DialogFooter><Button onClick={handleCreateExpressOrder} disabled={expressLoading || expressItemsList.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700">{expressLoading ? "Procesando..." : "Confirmar Orden"}</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {groupedTasks["sin_asignar"]?.length > 0 && (
                <DesignerSection 
                    title="Pendientes por Asignar" 
                    tasks={groupedTasks["sin_asignar"]} 
                    colorClass="border-l-red-500"
                    headerClass="bg-red-50 text-red-800"
                    designers={designers}
                    handleDesignerChange={handleDesignerChange}
                    handleStatusChange={handleStatusChange}
                    handlePaymentStatusChange={handlePaymentStatusChange}
                    handleSolicitantChange={handleSolicitantChange}
                    toggleRowCurrency={toggleRowCurrency}
                    rowCurrencyMode={rowCurrencyMode}
                    calculateBsForRow={calculateBsForRow}
                />
            )}

            {designers.map(designer => (
                <DesignerSection 
                    key={designer.id}
                    title={`Trabajos de ${designer.name}`} 
                    tasks={groupedTasks[designer.id] || []} 
                    colorClass="border-l-indigo-500"
                    headerClass="bg-indigo-50 text-indigo-800"
                    designers={designers}
                    handleDesignerChange={handleDesignerChange}
                    handleStatusChange={handleStatusChange}
                    handlePaymentStatusChange={handlePaymentStatusChange}
                    handleSolicitantChange={handleSolicitantChange}
                    toggleRowCurrency={toggleRowCurrency}
                    rowCurrencyMode={rowCurrencyMode}
                    calculateBsForRow={calculateBsForRow}
                />
            ))}
        </div>
    )
}

const DesignerSection = ({ 
    title, tasks, colorClass, headerClass, designers, 
    handleDesignerChange, handleStatusChange, handlePaymentStatusChange, handleSolicitantChange,
    toggleRowCurrency, rowCurrencyMode, calculateBsForRow
}: any) => {
    
    const totalUSD = tasks.reduce((sum: number, t: any) => sum + ((t.precioUnitario || 0) * (t.cantidad || 1)), 0);
    const paidCount = tasks.filter((t: any) => t.paymentStatus === 'PAGADO').length;

    return (
        <Card className={`overflow-hidden border-l-4 ${colorClass} shadow-md`}>
            <div className={`px-6 py-3 flex justify-between items-center ${headerClass}`}>
                <div className="flex items-center gap-2">
                    <User className="w-5 h-5 opacity-70"/>
                    <h3 className="font-bold text-lg">{title}</h3>
                    <Badge variant="outline" className="bg-white/50 ml-2 border-0 text-current">{tasks.length} ítems</Badge>
                </div>
                <div className="text-sm font-mono opacity-80">
                    Acumulado: <b>${totalUSD.toFixed(2)}</b> | Pagados: {paidCount}/{tasks.length}
                </div>
            </div>
            
            <CardContent className="p-0">
                {tasks.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm italic">Este diseñador no tiene tareas activas.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[180px]">Orden</TableHead>
                                <TableHead className="w-[140px]">Solicitado Por</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="w-[140px]">Estado</TableHead>
                                <TableHead className="w-[140px]">Pago</TableHead>
                                <TableHead className="text-right w-[110px]">Precio ($)</TableHead>
                                <TableHead className="text-right w-[150px]">Pago (Bs)</TableHead>
                                <TableHead className="text-right w-[130px]">Reasignar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.map((task: any) => {
                                const isExpress = task.clienteRif === 'V-Express';
                                const itemPrice = (task.precioUnitario || 0) * (task.cantidad || 1);
                                const currentMode = rowCurrencyMode[task.uniqueKey] || 'USD';
                                
                                return (
                                <TableRow key={task.uniqueKey} className="hover:bg-slate-50/80">
                                    <TableCell>
                                        <div className="font-bold text-gray-800">#{task.ordenNumero}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[150px]" title={task.clienteNombre}>{task.clienteNombre}</div>
                                        {isExpress && <Badge className="text-[9px] px-1 h-3 mt-1 bg-purple-100 text-purple-700 hover:bg-purple-100 shadow-none">Express</Badge>}
                                    </TableCell>
                                    
                                    <TableCell>
                                        <Select 
                                            value={task.solicitadoPor || "Cliente Directo"} 
                                            onValueChange={(val) => handleSolicitantChange(task.ordenId, task.originalIndex, val)}
                                        >
                                            <SelectTrigger className="h-7 text-xs bg-white border-dashed shadow-sm w-full"><div className="flex items-center gap-1 truncate"><UserCheck className="w-3 h-3 text-indigo-500"/> <SelectValue /></div></SelectTrigger>
                                            <SelectContent>{SOLICITANTES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    
                                    <TableCell>
                                        <div className="font-medium text-sm">{task.nombre}</div>
                                        <div className="flex gap-2 mt-1">
                                            {task.archivoTipo && <Badge variant="outline" className="text-[9px] h-4 px-1">{task.archivoFormato}</Badge>}
                                            {task.cantidad > 1 && <Badge variant="secondary" className="text-[9px] h-4 px-1">x{task.cantidad}</Badge>}
                                        </div>
                                    </TableCell>
                                    
                                    <TableCell>
                                        <Select value={task.designStatus || "pendiente"} onValueChange={(val) => handleStatusChange(task.ordenId, val)}>
                                            <SelectTrigger className={`h-7 text-xs border-0 ring-1 ring-gray-200 ${task.designStatus === 'finalizado' ? 'bg-green-50 text-green-700 ring-green-200' : task.designStatus === 'en_proceso' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-white'}`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pendiente">🔴 Pendiente</SelectItem>
                                                <SelectItem value="en_proceso">🔵 En Proceso</SelectItem>
                                                <SelectItem value="listo_imprimir">🟡 Listo Imp.</SelectItem>
                                                <SelectItem value="finalizado">🟢 Finalizado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>

                                    <TableCell>
                                        <Select value={task.paymentStatus || "PENDIENTE"} onValueChange={(val) => handlePaymentStatusChange(task.ordenId, task.originalIndex, val)}>
                                            <SelectTrigger className={`h-7 text-xs font-bold border-0 ring-1 ${task.paymentStatus === 'PAGADO' ? 'bg-green-100 text-green-800 ring-green-300' : 'bg-gray-100 text-gray-600 ring-gray-300'}`}><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="PENDIENTE">⏳ Pendiente</SelectItem><SelectItem value="PAGADO">💰 Pagado</SelectItem></SelectContent>
                                        </Select>
                                    </TableCell>

                                    <TableCell className="text-right font-mono font-bold text-gray-700">
                                        {itemPrice === 0 ? <span className="text-[10px] text-orange-600 bg-orange-100 px-1 py-0.5 rounded uppercase font-bold tracking-tight">Por Acordar</span> : `$${itemPrice.toFixed(2)}`}
                                    </TableCell>

                                    <TableCell className="text-right">
                                        {itemPrice === 0 ? <span className="text-xs text-gray-300">-</span> : (
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-700">Bs {calculateBsForRow(itemPrice, currentMode)}</span>
                                                <div className="flex scale-75 origin-right gap-1">
                                                    <Button variant={currentMode === 'USD' ? 'default' : 'outline'} size="icon" className="h-5 w-5 rounded-full" onClick={() => toggleRowCurrency(task.uniqueKey)}><DollarSign className="w-3 h-3"/></Button>
                                                    <Button variant={currentMode === 'EUR' ? 'default' : 'outline'} size="icon" className="h-5 w-5 rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => toggleRowCurrency(task.uniqueKey)}><Euro className="w-3 h-3"/></Button>
                                                </div>
                                            </div>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-right">
                                        <Select value={task.designerId} onValueChange={(val) => handleDesignerChange(task.ordenId, val)}>
                                            <SelectTrigger className="w-[110px] h-7 text-xs ml-auto"><SelectValue placeholder="Mover..." /></SelectTrigger>
                                            <SelectContent><SelectItem value="sin_asignar">-- Liberar --</SelectItem>{designers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}