// @/components/orden/order-detail-modal.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils/order-utils";
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden";
import { 
    X, User, Calendar, FileText, MapPin, Phone, 
    Mail, Box, Layers, Hammer, Receipt, ArrowRight, 
    Timer, Scissors, Printer, FileCode, FileImage 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  orden: OrdenServicio | null;
  bcvRate: number;
}

// --- UTILIDADES DE CÁLCULO DE SEGURIDAD ---
const getItemSubtotal = (item: ItemOrden) => {
  const qty = parseFloat(item.cantidad.toString()) || 0;
  const price = parseFloat(item.precioUnitario.toString()) || 0;
  const x = parseFloat((item as any).medidaXCm) || 0;
  const y = parseFloat((item as any).medidaYCm) || 0;

  // Cálculo según unidad: m2 requiere área, el resto usa precio directo
  if (item.unidad === "m2" && x > 0 && y > 0) {
    return (x / 100) * (y / 100) * price * qty;
  }
  return price * qty;
};

export function OrderDetailModal({ open, onClose, orden, bcvRate }: OrderDetailModalProps) {
  if (!orden) return null;

  // RECALCULO DE TOTALES: Si la orden llega con total $0, sumamos los ítems en tiempo real
  const totalBaseUSD = orden.totalUSD > 0 
    ? orden.totalUSD 
    : orden.items.reduce((acc, item) => acc + getItemSubtotal(item), 0);

  const montoPagadoUSD = orden.montoPagadoUSD || 0;
  const montoPendiente = totalBaseUSD - montoPagadoUSD;
  const isPagado = montoPendiente <= 0.01;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Estética Premium iOS: Glassmorphism y bordes suaves */}
      <DialogContent className="max-w-[95vw] md:max-w-6xl h-[92vh] p-0 border-none bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-2xl overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl flex flex-col">
        
        {/* --- HEADER --- */}
        <header className="shrink-0 relative p-6 md:p-10 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
            <div className="flex items-center gap-5">
                <div className="h-14 w-14 md:h-16 md:w-16 bg-blue-600 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    <Receipt className="w-7 h-7 md:w-8 md:h-8" />
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">
                            Orden #{orden.ordenNumero}
                        </DialogTitle>
                        <Badge className={cn(
                            "rounded-full px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none",
                            orden.estado === 'TERMINADO' ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                        )}>
                            {orden.estado}
                        </Badge>
                    </div>
                    <p className="text-slate-500 font-bold text-xs md:text-sm uppercase tracking-wide">{formatDate(orden.fecha)}</p>
                </div>
            </div>

            <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-10 w-10 md:h-12 md:w-12 border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors">
                <X className="h-5 w-5" />
            </Button>
        </header>

        {/* --- ÁREA DE CONTENIDO (Scrollable con corrección min-h-0) --- */}
        <div className="flex-1 min-h-0 relative"> 
            <ScrollArea className="h-full">
                <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto space-y-8 pb-24">
                    
                    {/* SECCIÓN CLIENTE Y ENTREGA */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SectionCard title="Cliente" icon={<User className="text-blue-500 w-4 h-4"/>} className="md:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <InfoField label="Razón Social" value={orden.cliente.nombreRazonSocial} primary className="sm:col-span-2" />
                                <InfoField label="RIF / CI" value={orden.cliente.rifCedula} icon={FileText} />
                                <InfoField label="Teléfono" value={orden.cliente.telefono} icon={Phone} />
                                <InfoField label="Correo" value={orden.cliente.correo} icon={Mail} />
                                <InfoField label="Dirección" value={orden.cliente.domicilioFiscal} icon={MapPin} />
                            </div>
                        </SectionCard>

                        <SectionCard title="Entrega" icon={<Calendar className="text-orange-500 w-4 h-4"/>}>
                            <div className="space-y-6">
                                <div className="p-5 bg-orange-50 dark:bg-orange-500/10 rounded-[2rem] border border-orange-100">
                                    <p className="text-[10px] font-black uppercase text-orange-600 mb-1 tracking-widest">Fecha Prometida</p>
                                    <p className="text-xl md:text-2xl font-black text-orange-700 tracking-tighter">{formatDate(orden.fechaEntrega)}</p>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Servicios</p>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(orden.serviciosSolicitados).filter(([,v])=>v).map(([k]) => (
                                            <Badge key={k} variant="secondary" className="rounded-xl bg-white border-slate-200 font-bold text-[9px] py-1 px-3 uppercase">
                                                {k.replace(/([A-Z])/g, ' $1').trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* SECCIÓN DETALLE DE PRODUCCIÓN */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <Layers className="w-5 h-5 text-slate-400" />
                            <h3 className="font-black text-lg tracking-tighter uppercase text-slate-800 dark:text-slate-200">Detalle de Producción</h3>
                        </div>

                        <div className="space-y-3">
                            {orden.items.map((item, idx) => (
                                <ItemRow key={idx} item={item} />
                            ))}
                        </div>
                    </div>

                    {/* SECCIÓN FINANCIERA */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pt-4">
                        <div className="p-8 bg-slate-200/30 dark:bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-300">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Notas de Producción</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm italic whitespace-pre-line leading-relaxed">
                                {orden.descripcionDetallada || "No hay instrucciones adicionales para esta orden."}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-200/50 flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                    <span>Subtotal Base</span>
                                    <span>{formatCurrency(totalBaseUSD)} USD</span>
                                </div>
                                <div className="flex justify-between text-emerald-500 font-bold uppercase text-[10px] tracking-widest">
                                    <span>Total Abonado</span>
                                    <span>- {formatCurrency(montoPagadoUSD)} USD</span>
                                </div>
                                <Separator className="opacity-50" />
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Restante</p>
                                        <p className="text-xs font-bold text-slate-400 mt-1">Ref. BCV: {formatCurrency(bcvRate)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("text-4xl md:text-5xl font-black tracking-tighter leading-none", isPagado ? "text-emerald-500" : "text-red-500")}>
                                            {formatCurrency(montoPendiente)}
                                        </p>
                                        <p className="text-lg md:text-xl font-black text-slate-400 mt-1">
                                            ≈ {formatCurrency(montoPendiente * bcvRate)} Bs.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- SUB-COMPONENTES INTERNOS ---

function SectionCard({ title, icon, children, className }: any) {
    return (
        <div className={cn("bg-white dark:bg-slate-900 rounded-[2.5rem] p-7 md:p-8 shadow-sm border border-slate-200/50 dark:border-slate-800", className)}>
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">{icon}</div>
                <h3 className="font-black text-xs md:text-sm uppercase tracking-[0.2em] text-slate-800 dark:text-slate-200">{title}</h3>
            </div>
            {children}
        </div>
    )
}

function InfoField({ label, value, icon: Icon, primary, className }: any) {
    return (
        <div className={cn("space-y-1.5", className)}>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                {Icon && <Icon className="w-3 h-3" />} {label}
            </p>
            <p className={cn("font-bold text-slate-800 dark:text-slate-100 break-words", primary ? "text-lg md:text-xl tracking-tight leading-tight" : "text-sm")}>
                {value || "---"}
            </p>
        </div>
    )
}

function ItemRow({ item }: { item: ItemOrden }) {
    const subtotal = getItemSubtotal(item);
    const itemExtra = item as any; // Casting para acceder a campos técnicos guardados

    return (
        <motion.div 
            whileHover={{ x: 8 }} 
            className="group flex flex-col md:flex-row items-center gap-4 p-5 md:p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm transition-all"
        >
            <div className="flex-1 w-full space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-slate-900 dark:text-white text-base md:text-lg tracking-tight leading-tight uppercase">
                                {item.nombre}
                            </h4>
                            <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none text-[9px] font-black uppercase px-2 py-0">
                                {item.tipoServicio}
                            </Badge>
                            
                            {/* --- RESPONSABLE ASIGNADO (Visible y prominentemente marcado) --- */}
                            {itemExtra.empleadoAsignado && itemExtra.empleadoAsignado !== "N/A" && (
                                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase px-2 py-0 gap-1">
                                    <User className="w-2.5 h-2.5" /> Responsable: {itemExtra.empleadoAsignado}
                                </Badge>
                            )}
                        </div>
                        
                        {/* DETALLES TÉCNICOS ESPECÍFICOS */}
                        <div className="space-y-1">
                            {itemExtra.materialDetalleCorte && (
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 italic leading-none">
                                    <Scissors className="w-3 h-3 text-orange-500" /> {itemExtra.materialDetalleCorte}
                                </p>
                            )}
                            {item.materialDeImpresion && (
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 italic leading-none">
                                    <Printer className="w-3 h-3 text-blue-500" /> {item.materialDeImpresion}
                                </p>
                            )}
                            {itemExtra.archivoTipo && (
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 italic leading-none">
                                    {itemExtra.archivoTipo === 'vector' ? <FileCode className="w-3 h-3 text-indigo-500"/> : <FileImage className="w-3 h-3 text-indigo-500"/>}
                                    Entrega en {itemExtra.archivoFormato} ({itemExtra.archivoTipo})
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                            {formatCurrency(subtotal)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">
                            {item.cantidad} {item.unidad} x {formatCurrency(item.precioUnitario)}
                        </p>
                    </div>
                </div>

                {/* BADGES DE ESPECIFICACIONES ADICIONALES */}
                <div className="flex flex-wrap gap-2 md:gap-3">
                    {(item as any).medidaXCm > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg py-1 px-2 border-slate-100 dark:border-slate-700">
                            <Box className="w-3 h-3" /> {(item as any).medidaXCm}x{(item as any).medidaYCm}cm
                        </Badge>
                    )}
                    {item.tiempoCorte && (
                        <Badge variant="outline" className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 rounded-lg py-1 px-2 border-orange-100 dark:border-orange-500/20">
                            <Timer className="w-3 h-3" /> {item.tiempoCorte}
                        </Badge>
                    )}
                    {(item as any).suministrarMaterial && (
                        <Badge variant="outline" className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg py-1 px-2 border-emerald-100 dark:border-emerald-500/20">
                            <Hammer className="w-3 h-3" /> MATERIAL INCLUIDO
                        </Badge>
                    )}
                </div>
            </div>
            <div className="hidden md:block pl-4">
                <ArrowRight className="w-5 h-5 text-slate-200 group-hover:text-blue-500 transition-colors" />
            </div>
        </motion.div>
    );
}