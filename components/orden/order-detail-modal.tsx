// @/components/orden/order-detail-modal.tsx
"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils/order-utils";
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden";
import { 
    X, User, Calendar, FileText, DollarSign, 
    MapPin, Phone, Mail, Package, Timer, Box, Layers, Hammer 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  orden: OrdenServicio | null;
  bcvRate: number;
  smrLogoBase64?: string; 
}

const PRECIO_LASER_POR_MINUTO = 0.80;

// --- UTILIDADES DE CÁLCULO ---
const getItemSubtotal = (item: ItemOrden) => {
  let subtotal = 0;
  const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item as any;
  
  const qty = cantidad || 0;
  const price = precioUnitario || 0;
  // Detectar si hay material extra
  const costoMaterial = (item as any).suministrarMaterial ? ((item as any).costoMaterialExtra || 0) : 0;

  let serviceCost = 0;
  if (unidad === "und") {
    serviceCost = price;
  } else if (unidad === "m2" && medidaXCm && medidaYCm) {
    serviceCost = (medidaXCm / 100) * (medidaYCm / 100) * price;
  } else if (unidad === "tiempo" && tiempoCorte) {
    const [minStr, secStr] = tiempoCorte.split(':');
    const totalMin = (parseInt(minStr) || 0) + ((parseInt(secStr) || 0) / 60);
    serviceCost = totalMin * PRECIO_LASER_POR_MINUTO;
  }

  // El precio unitario total es el servicio + el material
  const totalUnitCost = serviceCost + costoMaterial;
  subtotal = totalUnitCost * qty;
  
  return subtotal;
};

// --- COMPONENTE UI INTERNO ---
const InfoItem = ({ icon: Icon, label, value, className }: { icon?: any, label: string, value: React.ReactNode, className?: string }) => (
    <div className={cn("flex flex-col gap-1", className)}>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
            {Icon && <Icon className="w-3 h-3" />} {label}
        </span>
        <div className="text-sm font-medium text-foreground break-words leading-tight">{value || "-"}</div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export function OrderDetailModal({ open, onClose, orden, bcvRate }: OrderDetailModalProps) {
  if (!orden) return null;

  const montoPagadoVES = (orden.montoPagadoUSD || 0) * bcvRate;
  const totalVES = orden.totalUSD * bcvRate;
  const montoPendiente = orden.totalUSD - (orden.montoPagadoUSD || 0);
  const isPagado = montoPendiente <= 0.01;
  const numeroOrdenDisplay = isNaN(Number(orden.ordenNumero)) ? "S/N" : orden.ordenNumero;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] md:max-w-5xl h-[90vh] flex flex-col p-0 gap-0 bg-gray-50/50 dark:bg-slate-950 overflow-hidden">
        
        {/* --- HEADER (Fijo) --- */}
        <DialogHeader className="p-4 border-b bg-white dark:bg-slate-900 shrink-0 flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-sm">
                    <span className="font-bold text-lg">#{numeroOrdenDisplay}</span>
                </div>
                <div className="flex flex-col">
                    <DialogTitle className="text-lg font-bold leading-none">Orden de Servicio</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{formatDate(orden.fecha)}</span>
                        <Badge variant={orden.estado === 'TERMINADO' ? 'default' : 'secondary'} className="h-4 text-[10px] px-1">
                            {orden.estado}
                        </Badge>
                    </div>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="h-5 w-5" />
            </Button>
        </DialogHeader>

        {/* --- BODY (Scrollable) --- */}
        {/* flex-1 y min-h-0 son CRUCIALES para que el scroll funcione dentro de un flex column */}
        <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full w-full">
                <div className="p-4 space-y-6">

                    {/* 1. GRID SUPERIOR: CLIENTE Y DATOS CLAVE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Tarjeta Cliente */}
                        <Card className="md:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-dashed">
                                    <User className="w-4 h-4 text-primary"/>
                                    <h3 className="font-bold text-sm">Datos del Cliente</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                                    <InfoItem label="Razón Social" value={orden.cliente.nombreRazonSocial} className="col-span-1 sm:col-span-2"/>
                                    <InfoItem icon={FileText} label="RIF / CI" value={orden.cliente.rifCedula} />
                                    <InfoItem icon={Phone} label="Teléfono" value={orden.cliente.telefono} />
                                    <InfoItem icon={Mail} label="Correo" value={orden.cliente.correo} />
                                    <InfoItem icon={MapPin} label="Dirección" value={orden.cliente.domicilioFiscal} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tarjeta Fechas y Servicios */}
                        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
                            <CardContent className="p-4 flex flex-col h-full justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dashed">
                                        <Calendar className="w-4 h-4 text-orange-500"/>
                                        <h3 className="font-bold text-sm">Tiempos</h3>
                                    </div>
                                    <InfoItem label="Fecha Entrega" value={<span className="text-orange-600 font-bold text-base">{formatDate(orden.fechaEntrega)}</span>} />
                                </div>
                                
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-4 h-4 text-blue-500"/>
                                        <h3 className="font-bold text-xs uppercase text-muted-foreground">Servicios</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(orden.serviciosSolicitados).filter(([,v])=>v).map(([k]) => (
                                            <Badge key={k} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                {k.replace(/([A-Z])/g, ' $1').trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 2. TABLA DE ÍTEMS (Scroll Horizontal en Móvil) */}
                    <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                        <div className="p-3 border-b bg-muted/20 flex justify-between items-center">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <Layers className="w-4 h-4"/> Ítems de la Orden
                            </h3>
                            <Badge variant="secondary">{orden.items.length}</Badge>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[30%]">Descripción</TableHead>
                                        <TableHead className="text-center w-[10%]">Cant.</TableHead>
                                        <TableHead className="text-center w-[20%]">Detalles</TableHead>
                                        <TableHead className="text-right w-[15%]">Unitario</TableHead>
                                        <TableHead className="text-right w-[20%]">Subtotal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orden.items.map((item, idx) => {
                                        const itemAny = item as any;
                                        const subtotal = getItemSubtotal(item);
                                        const tieneMaterialExtra = itemAny.suministrarMaterial && itemAny.costoMaterialExtra > 0;
                                        
                                        return (
                                            <TableRow key={idx} className="hover:bg-muted/5">
                                                <TableCell className="align-top py-3">
                                                    <div className="font-bold text-sm text-foreground">{item.nombre}</div>
                                                    <div className="text-xs text-muted-foreground mt-1">{item.tipoServicio}</div>
                                                    
                                                    {/* 🔥 INDICADOR DE MATERIAL SUMINISTRADO 🔥 */}
                                                    {tieneMaterialExtra && (
                                                        <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 text-[10px] font-semibold">
                                                            <Hammer className="w-3 h-3" />
                                                            Incluye Material (+{formatCurrency(itemAny.costoMaterialExtra)})
                                                        </div>
                                                    )}

                                                    {item.empleadoAsignado && item.empleadoAsignado !== "N/A" && (
                                                        <div className="mt-1">
                                                            <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                                                                👤 {item.empleadoAsignado.split(" ")[0]}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                
                                                <TableCell className="text-center font-mono font-medium align-top py-3">
                                                    {item.cantidad} <span className="text-[10px] text-muted-foreground block">{item.unidad}</span>
                                                </TableCell>
                                                
                                                <TableCell className="align-top py-3">
                                                    <div className="flex flex-col gap-1 text-xs items-center">
                                                        {/* Detalles Técnicos */}
                                                        {item.unidad === 'm2' && (
                                                            <span className="flex items-center gap-1"><Box className="w-3 h-3"/> {item.medidaXCm}x{item.medidaYCm}cm</span>
                                                        )}
                                                        {item.unidad === 'tiempo' && (
                                                            <span className="flex items-center gap-1 text-orange-600 font-medium"><Timer className="w-3 h-3"/> {item.tiempoCorte}</span>
                                                        )}
                                                        
                                                        {/* Materiales */}
                                                        {(itemAny.materialDeImpresion || itemAny.materialDetalleCorte) && (
                                                            <span className="text-muted-foreground bg-muted/30 px-1 rounded w-fit text-center">
                                                                {itemAny.materialDeImpresion || itemAny.materialDetalleCorte}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                
                                                <TableCell className="text-right align-top py-3 text-sm">
                                                    {item.unidad === 'tiempo' 
                                                        ? <span className="text-xs text-muted-foreground italic">N/A</span> 
                                                        : formatCurrency(item.precioUnitario)
                                                    }
                                                </TableCell>
                                                
                                                <TableCell className="text-right align-top py-3 font-bold text-base">
                                                    {formatCurrency(subtotal)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                    {/* 3. TOTALES Y FINANZAS */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* Notas (Izquierda) */}
                        <div className="lg:col-span-7">
                            <Card className="border-none shadow-sm bg-yellow-50/50 dark:bg-yellow-950/10 h-full">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-bold uppercase text-yellow-700 dark:text-yellow-500 mb-2">Notas de Producción</h3>
                                    <p className="text-sm text-muted-foreground italic whitespace-pre-line">
                                        {orden.descripcionDetallada || "Sin observaciones adicionales para esta orden."}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Resumen Económico (Derecha) */}
                        <div className="lg:col-span-5">
                            <Card className="border-l-4 border-l-primary shadow-md bg-white dark:bg-slate-900">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Total Base:</span>
                                        <span className="font-medium">{formatCurrency(orden.totalUSD)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Abonado:</span>
                                        <span className="font-bold text-green-600">- {formatCurrency(orden.montoPagadoUSD)}</span>
                                    </div>
                                    
                                    <Separator />
                                    
                                    <div className="flex justify-between items-end pt-1">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-bold uppercase">Restante</p>
                                            <p className="text-[10px] text-muted-foreground">Ref. BCV: {formatCurrency(bcvRate)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn("text-3xl font-black", isPagado ? "text-green-600" : "text-red-600")}>
                                                {formatCurrency(montoPendiente)} <span className="text-sm font-normal text-muted-foreground">USD</span>
                                            </p>
                                            <p className="text-sm font-medium text-muted-foreground">
                                                ~ {formatCurrency(montoPendiente * bcvRate)} Bs.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                </div>
            </ScrollArea>
        </div>

    </DialogContent>
    </Dialog>
  );
}