// @/components/orden/order-detail-modal.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/utils/order-utils";
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden";
import { 
    X, User, Calendar, FileText, MapPin, Phone, 
    Mail, Box, Layers, Hammer, Receipt, ArrowRight, 
    Timer, Scissors, Printer, Star, ShieldCheck,
    ChevronDown, DollarSign, Euro, Coins 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  orden: OrdenServicio | null;
  rates: {
    usd: number;
    eur: number;
    usdt: number;
  };
}

// --- UTILIDADES DE CÁLCULO ---
const getItemSubtotal = (item: ItemOrden) => {
  const qty = parseFloat(item.cantidad.toString()) || 0;
  const price = parseFloat(item.precioUnitario.toString()) || 0;
  const x = parseFloat((item as any).medidaXCm) || 0;
  const y = parseFloat((item as any).medidaYCm) || 0;

  if (item.unidad === "m2" && x > 0 && y > 0) {
    return (x / 100) * (y / 100) * price * qty;
  }
  return price * qty;
};

export function OrderDetailModal({ open, onClose, orden, rates }: OrderDetailModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'USDT'>('USD');

  if (!orden) return null;

  // Lógica de detección de Aliado
  const isAliado = orden.cliente?.tipoCliente === "ALIADO";

  const totalBaseUSD = orden.totalUSD > 0 
    ? orden.totalUSD 
    : orden.items.reduce((acc, item) => acc + getItemSubtotal(item), 0);

  const montoPagadoUSD = orden.montoPagadoUSD || 0;
  const montoPendiente = totalBaseUSD - montoPagadoUSD;
  const isPagado = montoPendiente <= 0.01;

  // Lógica de tasa activa
  const activeRateValue = selectedCurrency === 'USD' ? rates.usd : 
                         selectedCurrency === 'EUR' ? rates.eur : rates.usdt;

  const currencyLabels = {
    USD: { label: "Tasa BCV (USD)", icon: <DollarSign className="w-3 h-3 text-emerald-500" /> },
    EUR: { label: "Tasa BCV (EUR)", icon: <Euro className="w-3 h-3 text-blue-500" /> },
    USDT: { label: "Tasa Paralelo", icon: <Coins className="w-3 h-3 text-orange-500" /> }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl h-[92vh] p-0 border-none bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-2xl overflow-hidden rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl flex flex-col">
        
        {/* --- HEADER DINÁMICO --- */}
        <header className={cn(
            "shrink-0 relative p-6 md:p-10 border-b border-slate-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10",
            isAliado ? "bg-purple-50/50 dark:bg-purple-900/10" : "bg-white/50 dark:bg-slate-900/50"
        )}>
            <div className="flex items-center gap-5">
                <div className={cn(
                    "h-14 w-14 md:h-16 md:w-16 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-white shadow-lg",
                    isAliado ? "bg-purple-600 shadow-purple-500/30" : "bg-blue-600 shadow-blue-500/30"
                )}>
                    {isAliado ? <Star className="w-7 h-7 md:w-8 md:h-8 fill-current" /> : <Receipt className="w-7 h-7 md:w-8 md:h-8" />}
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                            Orden #{orden.ordenNumero}
                        </DialogTitle>
                        
                        {isAliado && (
                            <Badge className="bg-purple-600 text-white animate-pulse rounded-full px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none">
                                Aliado 🤝
                            </Badge>
                        )}

                        <Badge className={cn(
                            "rounded-full px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none",
                            orden.estado === 'TERMINADO' ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"
                        )}>
                            {orden.estado}
                        </Badge>
                    </div>
                    <p className="text-slate-500 font-bold text-xs md:text-sm uppercase tracking-wide mt-1">{formatDate(orden.fecha)}</p>
                </div>
            </div>

            <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-10 w-10 md:h-12 md:w-12 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                <X className="h-5 w-5" />
            </Button>
        </header>

        {/* --- CONTENIDO --- */}
        <div className="flex-1 min-h-0 relative"> 
            <ScrollArea className="h-full">
                <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto space-y-8 pb-24">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SectionCard title="Cliente" icon={<User className={isAliado ? "text-purple-500 w-4 h-4" : "text-blue-500 w-4 h-4"}/>} className="md:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                                <InfoField label="Razón Social" value={orden.cliente.nombreRazonSocial} primary className="sm:col-span-2" />
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                                        <ShieldCheck className="w-3 h-3" /> Estatus de Cuenta
                                    </p>
                                    <Badge variant="outline" className={cn(
                                        "w-fit font-black text-[10px] uppercase px-2",
                                        isAliado ? "border-purple-200 text-purple-600 bg-purple-50" : "border-blue-200 text-blue-600 bg-blue-50"
                                    )}>
                                        {isAliado ? "Tarifa Aliado Aplicada" : "Cliente Regular"}
                                    </Badge>
                                </div>
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
                                        {Object.entries(orden.serviciosSolicitados || {}).filter(([,v])=>v).map(([k]) => (
                                            <Badge key={k} variant="secondary" className="rounded-xl bg-white border-slate-200 font-bold text-[9px] py-1 px-3 uppercase">
                                                {k.replace(/([A-Z])/g, ' $1').trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    </div>

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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch pt-4">
                        <div className="p-8 bg-slate-200/30 dark:bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-300">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Notas de Producción</h4>
                            <p className="text-slate-600 dark:text-slate-400 text-sm italic whitespace-pre-line leading-relaxed">
                                {orden.descripcionDetallada || "Sin instrucciones adicionales."}
                            </p>
                        </div>

                        <div className={cn(
                            "rounded-[2.5rem] p-8 shadow-xl border flex flex-col justify-between space-y-6 transition-all",
                            isAliado ? "bg-purple-600 text-white border-purple-500" : "bg-white dark:bg-slate-900 border-slate-200/50"
                        )}>
                            <div className="space-y-4">
                                <div className={cn("flex justify-between font-bold uppercase text-[10px] tracking-widest", isAliado ? "text-purple-100" : "text-slate-500")}>
                                    <span>Subtotal Base</span>
                                    <span>{formatCurrency(totalBaseUSD)} USD</span>
                                </div>
                                <div className={cn("flex justify-between font-bold uppercase text-[10px] tracking-widest", isAliado ? "text-white" : "text-emerald-500")}>
                                    <span>Total Abonado</span>
                                    <span>- {formatCurrency(montoPagadoUSD)} USD</span>
                                </div>
                                <Separator className={cn("opacity-50", isAliado ? "bg-white" : "bg-slate-200")} />
                                
                                <div className="flex justify-between items-end">
                                    <div className="space-y-3">
                                        <p className={cn("text-[10px] font-black uppercase tracking-widest", isAliado ? "text-purple-100" : "text-slate-400")}>Restante en Bs.</p>
                                        
                                        {/* SELECTOR DE MONEDA DINÁMICO */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className={cn(
                                                        "h-8 gap-2 px-3 rounded-xl border font-bold text-[10px] uppercase transition-all",
                                                        isAliado 
                                                            ? "bg-purple-500/30 border-purple-400 text-white hover:bg-purple-500/50" 
                                                            : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                                                    )}
                                                >
                                                    {currencyLabels[selectedCurrency].icon}
                                                    {currencyLabels[selectedCurrency].label}
                                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="rounded-2xl p-2 shadow-2xl border-none bg-white dark:bg-slate-800">
                                                <DropdownMenuItem onClick={() => setSelectedCurrency('USD')} className="rounded-xl gap-2 font-bold text-xs uppercase cursor-pointer">
                                                    <DollarSign className="w-4 h-4 text-emerald-500" /> Dólar BCV
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setSelectedCurrency('EUR')} className="rounded-xl gap-2 font-bold text-xs uppercase cursor-pointer">
                                                    <Euro className="w-4 h-4 text-blue-500" /> Euro BCV
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setSelectedCurrency('USDT')} className="rounded-xl gap-2 font-bold text-xs uppercase cursor-pointer">
                                                    <Coins className="w-4 h-4 text-orange-500" /> USDT / Paralelo
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <p className={cn("text-[10px] font-bold mt-1", isAliado ? "text-purple-200" : "text-slate-400")}>
                                            Ref. Tasa: {formatCurrency(activeRateValue)} Bs.
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("text-4xl md:text-5xl font-black tracking-tighter leading-none", isPagado ? "text-emerald-400" : isAliado ? "text-white" : "text-red-500")}>
                                            {formatCurrency(montoPendiente)}
                                        </p>
                                        <p className={cn("text-lg md:text-xl font-black mt-1", isAliado ? "text-purple-100" : "text-slate-400")}>
                                            ≈ {formatCurrency(montoPendiente * activeRateValue)} Bs.
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

// --- SUB-COMPONENTES AUXILIARES ---

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
    const itemExtra = item as any;

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
                            
                            {itemExtra.empleadoAsignado && itemExtra.empleadoAsignado !== "N/A" && (
                                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase px-2 py-0 gap-1">
                                    <User className="w-2.5 h-2.5" /> {itemExtra.empleadoAsignado}
                                </Badge>
                            )}
                        </div>
                        
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

                <div className="flex flex-wrap gap-2 md:gap-3">
                    {itemExtra.medidaXCm > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg py-1 px-2 border-slate-100 dark:border-slate-700">
                            <Box className="w-3 h-3" /> {itemExtra.medidaXCm}x{itemExtra.medidaYCm}cm
                        </Badge>
                    )}
                    {item.tiempoCorte && (
                        <Badge variant="outline" className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 rounded-lg py-1 px-2 border-orange-100 dark:border-orange-500/20">
                            <Timer className="w-3 h-3" /> {item.tiempoCorte}
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