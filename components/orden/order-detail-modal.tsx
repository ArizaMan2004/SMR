// @/components/orden/order-detail-modal.tsx
"use client";

import React, { useState, useMemo } from "react";
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
    ChevronDown, DollarSign, Euro, Coins, Building2, Users 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  orden: any | null; 
  rates: {
    usd: number;
    eur: number;
    usdt: number;
  };
}

// --- UTILIDADES DE CÁLCULO ACTUALIZADAS ---
const getItemSubtotal = (item: ItemOrden) => {
  const itemExtra = item as any;
  
  if (itemExtra.totalAjustado !== undefined) return parseFloat(itemExtra.totalAjustado);
  if (itemExtra.subtotal !== undefined) return parseFloat(itemExtra.subtotal);

  const x = parseFloat(itemExtra.medidaXCm) || 0;
  const y = parseFloat(itemExtra.medidaYCm) || 0;
  const p = parseFloat(item.precioUnitario.toString()) || 0;
  const c = parseFloat(item.cantidad.toString()) || 0;
  const e = itemExtra.suministrarMaterial ? (parseFloat(itemExtra.costoMaterialExtra) || 0) : 0;

  if (item.unidad === 'm2' && x > 0 && y > 0) {
      let costoBaseUnitario = (x / 100) * (y / 100) * p;

      if (item.tipoServicio === 'IMPRESION') {
          if (itemExtra.impresionLaminado) {
              const pLin = parseFloat(itemExtra.precioLaminadoLineal) || 0;
              const pMan = parseFloat(itemExtra.precioLaminadoManual) || 0;
              if (itemExtra.tipoCobroLaminado === 'x' && pLin > 0) costoBaseUnitario += (x / 100) * pLin;
              else if (itemExtra.tipoCobroLaminado === 'y' && pLin > 0) costoBaseUnitario += (y / 100) * pLin;
              else if (itemExtra.tipoCobroLaminado === 'manual' && pMan > 0) costoBaseUnitario += pMan;
          }
          if (itemExtra.impresionPegado && itemExtra.proveedorPegado === 'taller' && itemExtra.precioPegado > 0) {
              costoBaseUnitario += parseFloat(itemExtra.precioPegado) || 0;
          }
      }
      return (costoBaseUnitario + e) * c;
  } else {
      return (p + e) * c;
  }
};

export function OrderDetailModal({ open, onClose, orden, rates }: OrderDetailModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'USDT'>('USD');

  // AGRUPAR ÍTEMS DINÁMICAMENTE (Para Empresas Matrices)
  const groupedItems = useMemo(() => {
      if (!orden) return {};
      if (!orden.isMaster) return { 'General': orden.items };
      
      const groups: any = {};
      orden.items.forEach((item: any) => {
          const sc = item.subCliente?.trim() || 'General';
          if (!groups[sc]) groups[sc] = [];
          groups[sc].push(item);
      });
      return groups;
  }, [orden]);

  if (!orden) return null;

  const isAliado = orden.cliente?.tipoCliente === "ALIADO";
  const isMaster = orden.isMaster === true; 
  const totalBaseUSD = orden.totalUSD || 0;
  const montoPagadoUSD = orden.montoPagadoUSD || 0;
  const montoPendiente = totalBaseUSD - montoPagadoUSD;
  const isPagado = montoPendiente <= 0.01;

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
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <DialogTitle className="text-xl md:text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                            Orden #{orden.ordenNumero}
                        </DialogTitle>
                        
                        {isMaster && (
                            <Badge className="bg-indigo-600 text-white rounded-full px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest border-none flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> Matriz
                            </Badge>
                        )}

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
                    <p className="text-slate-500 font-bold text-xs md:text-sm uppercase tracking-wide mt-2">{formatDate(orden.fecha)}</p>
                </div>
            </div>
            <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-10 w-10 md:h-12 md:w-12 border-slate-200 bg-white shadow-sm hover:bg-slate-50 shrink-0">
                <X className="h-5 w-5" />
            </Button>
        </header>

        <div className="flex-1 min-h-0 relative"> 
            <ScrollArea className="h-full">
                <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto space-y-8 pb-24">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SectionCard title={isMaster ? "Empresa Matriz" : "Cliente"} icon={isMaster ? <Building2 className="text-indigo-500 w-4 h-4"/> : <User className={isAliado ? "text-purple-500 w-4 h-4" : "text-blue-500 w-4 h-4"}/>} className="md:col-span-2">
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

                    <div className="space-y-6">
                        <div className="flex items-center gap-2 px-2">
                            <Layers className="w-5 h-5 text-slate-400" />
                            <h3 className="font-black text-lg tracking-tighter uppercase text-slate-800 dark:text-slate-200">Detalle de Producción</h3>
                        </div>
                        
                        <div className="space-y-8">
                            {Object.entries(groupedItems).map(([subCliente, items]: [string, any], groupIdx) => (
                                <div key={groupIdx} className="space-y-3">
                                    
                                    {/* CABECERA DEL SUB-CLIENTE (Solo si es Matriz) */}
                                    {isMaster && (
                                        <div className="flex items-center justify-between bg-indigo-50/80 dark:bg-indigo-900/20 px-5 py-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/30">
                                            <span className="font-black text-[11px] md:text-xs uppercase tracking-widest text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                                                <Users className="w-4 h-4" /> Sub-Cliente: {subCliente}
                                            </span>
                                            <Badge className="bg-white text-indigo-600 border-none font-bold text-[9px] shadow-sm uppercase">{items.length} ítems</Badge>
                                        </div>
                                    )}

                                    {/* ITEMS */}
                                    <div className="space-y-3">
                                        {items.map((item: any, idx: number) => (
                                            <ItemRow key={idx} item={item} isMaster={isMaster} />
                                        ))}
                                    </div>

                                    {/* SUBTOTAL DEL SUB-CLIENTE (Solo si es Matriz) */}
                                    {isMaster && (
                                        <div className="flex justify-end pr-4 pt-1">
                                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-3">
                                                Subtotal {subCliente} 
                                                <span className="text-sm md:text-base font-black text-slate-800 dark:text-slate-200">
                                                    ${items.reduce((acc: number, item: any) => acc + getItemSubtotal(item), 0).toFixed(2)}
                                                </span>
                                            </p>
                                        </div>
                                    )}
                                </div>
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
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className={cn("h-8 gap-2 px-3 rounded-xl border font-bold text-[10px] uppercase transition-all", isAliado ? "bg-purple-500/30 border-purple-400 text-white hover:bg-purple-500/50" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200")}>
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

function ItemRow({ item, isMaster }: { item: ItemOrden, isMaster?: boolean }) {
    const subtotal = getItemSubtotal(item); 
    const qty = parseFloat(item.cantidad.toString()) || 1;
    const precioUnitarioReal = subtotal / qty;
    
    const itemExtra = item as any;
    const isImpresion = item.tipoServicio === 'IMPRESION';
    const isCorte = item.tipoServicio === 'CORTE';

    const detallesList = isImpresion && itemExtra.materialDetalleCorte 
        ? itemExtra.materialDetalleCorte.split(" | ") 
        : [];
        
    const materialPrincipal = detallesList.find((d: string) => d.startsWith("Mat:"));
    const acabados = detallesList.filter((d: string) => !d.startsWith("Mat:"));

    return (
        <motion.div whileHover={{ x: 8 }} className="group flex flex-col md:flex-row items-center gap-4 p-5 md:p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm transition-all">
            <div className="flex-1 w-full space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-slate-900 dark:text-white text-base md:text-lg tracking-tight leading-tight uppercase">
                                {item.nombre}
                            </h4>
                            <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none text-[9px] font-black uppercase px-2 py-0">
                                {item.tipoServicio}
                            </Badge>
                            
                            {/* Ocultamos el badge individual si ya está agrupado por cabecera, pero lo mostramos si quieres extra claridad */}
                            {/* {itemExtra.subCliente && !isMaster && ( ... )} */}

                            {itemExtra.empleadoAsignado && itemExtra.empleadoAsignado !== "N/A" && (
                                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase px-2 py-0 gap-1">
                                    <User className="w-2.5 h-2.5" /> {itemExtra.empleadoAsignado}
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            {isCorte && itemExtra.materialDetalleCorte && (
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 leading-none bg-orange-50 dark:bg-orange-500/10 w-fit px-2 py-1 rounded-md">
                                    <Scissors className="w-3 h-3 text-orange-500" /> {itemExtra.materialDetalleCorte}
                                </p>
                            )}
                            
                            {isImpresion && (
                                <div className="space-y-2">
                                    {(materialPrincipal || itemExtra.materialDeImpresion) && (
                                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 leading-none bg-blue-50 dark:bg-blue-500/10 w-fit px-2 py-1 rounded-md">
                                            <Printer className="w-3 h-3" /> 
                                            {materialPrincipal ? materialPrincipal.replace("Mat: ", "Material: ") : `Material: ${itemExtra.materialDeImpresion}`}
                                        </p>
                                    )}
                                    {acabados.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {acabados.map((acabado: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-[8.5px] font-black uppercase border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 px-1.5 py-0">
                                                    {acabado}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                            {formatCurrency(subtotal)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">
                            {item.cantidad} {item.unidad} x {formatCurrency(precioUnitarioReal)}
                        </p>
                        {itemExtra.totalAjustado !== undefined && (
                            <Badge className="bg-amber-100 text-amber-600 border-none text-[7px] font-black uppercase px-1.5 h-3.5 mt-1 block w-fit ml-auto">
                                Ajustado Manual
                            </Badge>
                        )}
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