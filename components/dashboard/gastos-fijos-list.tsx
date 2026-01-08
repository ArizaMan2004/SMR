// @/components/dashboard/gastos-fijos-list.tsx
"use client"

import React from "react"
import { 
  Trash2, 
  Edit2, 
  Calendar, 
  DollarSign, 
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { GastoFijo } from "@/lib/types/gastos"

interface GastosFijosListProps {
  gastos: GastoFijo[];
  onPay: (gasto: GastoFijo) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (gasto: GastoFijo) => void;
  isLoading?: boolean;
  isPaidMode?: boolean; // Define si es la lista de pendientes o la de solventes
}

export function GastosFijosList({ 
  gastos, 
  onPay, 
  onDelete, 
  onEdit, 
  isLoading, 
  isPaidMode = false 
}: GastosFijosListProps) {

  // --- ESTADO VACÍO ---
  if (!gastos || gastos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white/50 dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-black/5">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
          <AlertCircle size={32} />
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
          {isPaidMode ? "No hay registros solventes este mes" : "Sin facturas pendientes por ahora"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 px-2">
      {gastos.map((gasto) => {
        // --- LÓGICA DE FECHAS (Firebase Timestamp vs Date) ---
        const formatFecha = (fecha: any) => {
          if (!fecha) return "N/A";
          const d = fecha instanceof Date ? fecha : fecha?.toDate?.() || new Date(fecha);
          return d.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: 'short'
          });
        };

        const fechaAMostrar = isPaidMode 
          ? formatFecha(gasto.ultimoPago) 
          : formatFecha(gasto.proximoPago);

        // --- LÓGICA DE MONTO (Real vs Referencial) ---
        // Si está pagado, mostramos el monto real que se calculó en el modal
        const montoPrincipal = isPaidMode 
          ? (Number(gasto.ultimoMontoPagadoUSD) || Number(gasto.monto)) 
          : Number(gasto.monto);

        return (
          <div 
            key={gasto.id}
            className={cn(
              "group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-black/5 transition-all duration-300",
              isPaidMode 
                ? "opacity-80 hover:opacity-100" 
                : "hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1"
            )}
          >
            {/* IZQUIERDA: ICONO E INFORMACIÓN */}
            <div className="flex items-center gap-5 flex-1 w-full">
              <div className={cn(
                "w-16 h-16 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl shrink-0 transition-transform group-hover:scale-105",
                isPaidMode 
                  ? "bg-emerald-500 shadow-emerald-500/20" 
                  : "bg-orange-500 shadow-orange-500/20"
              )}>
                {isPaidMode ? (
                  <CheckCircle2 size={28} strokeWidth={2.5} />
                ) : (
                  <Clock size={28} strokeWidth={2.5} />
                )}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900 dark:text-white text-xl tracking-tight truncate">
                        {gasto.nombre}
                    </h4>
                    <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                        isPaidMode ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20" : "bg-orange-100 text-orange-600 dark:bg-orange-500/20"
                    )}>
                        {gasto.moneda === 'USD' ? 'Divisas' : gasto.moneda?.replace('_', ' ')}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    {gasto.categoria}
                  </span>
                  
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Calendar size={14} className="text-blue-500" />
                    <span>
                        {isPaidMode ? `Pagado: ${fechaAMostrar}` : `Vence: ${fechaAMostrar}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DERECHA: MONTO Y ACCIONES */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-8 border-t sm:border-t-0 pt-4 sm:pt-0 border-black/5">
              <div className="text-right">
                <div className="flex flex-col">
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">
                        ${montoPrincipal.toFixed(2)}
                    </span>
                    {isPaidMode && gasto.ultimoMontoPagadoBs && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {gasto.ultimoMontoPagadoBs.toLocaleString('es-VE')} Bs.
                      </span>
                    )}
                </div>
                
                {!isPaidMode && (
                  <button 
                    disabled={isLoading}
                    onClick={() => onPay(gasto)}
                    className="group/btn text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 mt-2 flex items-center gap-2 ml-auto transition-all"
                  >
                    {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <DollarSign size={12} className="group-hover/btn:scale-125 transition-transform" />
                    )}
                    {gasto.categoria === 'Impuestos' ? 'Registrar Monto' : 'Marcar Pagado'}
                  </button>
                )}
              </div>

              {/* ACCIONES (EDITAR/ELIMINAR) - Solo en modo pendiente */}
              {!isPaidMode && (
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/5 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => onEdit(gasto)}
                    className="p-3 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => onDelete(gasto.id)}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}