// @/components/dashboard/gastos-list.tsx
"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Package, 
  Hammer, 
  Wrench, 
  MoreHorizontal, 
  Trash2, 
  TrendingDown, 
  Edit3, 
  X,
  LayoutGrid,
  Printer,
  Scissors,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// 1. MAPEADO DE CATEGORÍAS
const CATEGORY_MAP: Record<string, { color: string, icon: any, label: string, bg: string }> = {
  "insumos": { color: "text-blue-500", bg: "bg-blue-500/10", icon: Package, label: "Insumo" },
  "materiales": { color: "text-purple-500", bg: "bg-purple-500/10", icon: Hammer, label: "Material" },
  "servicios": { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Wrench, label: "Taller" },
  "otros": { color: "text-slate-500", bg: "bg-slate-500/10", icon: MoreHorizontal, label: "Otros" }
}

const DEFAULT_STYLE = { color: "text-slate-400", bg: "bg-slate-100", icon: TrendingDown, label: "Gasto" };

// 2. ICONOS POR ÁREA PARA VISUALIZACIÓN
const AREA_ICONS: Record<string, any> = {
    "GENERAL": LayoutGrid,
    "IMPRESION": Printer,
    "CORTE": Scissors
};

interface GastosListProps {
  gastos: any[]
  onDelete: (id: string) => void
  onEdit: (gasto: any) => void
  // Nueva función opcional para la clasificación rápida
  onQuickCategory?: (id: string, area: string) => void 
}

export function GastosList({ gastos, onDelete, onEdit, onQuickCategory }: GastosListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Filtrar duplicados por si acaso (seguridad)
  const uniqueGastos = useMemo(() => {
    return (gastos || []).filter((gasto, index, self) =>
      index === self.findIndex((t) => t.id === gasto.id)
    );
  }, [gastos]);

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {uniqueGastos.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="text-center py-20 bg-white/40 dark:bg-white/5 rounded-[3rem] border border-dashed border-black/5"
          >
            <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400 italic">
              Sin movimientos registrados
            </p>
          </motion.div>
        ) : (
          uniqueGastos.map((gasto) => {
            const style = CATEGORY_MAP[gasto.categoria] || DEFAULT_STYLE;
            const Icon = style.icon;
            const isConfirming = confirmDelete === gasto.id;
            
            // Detectar si falta el área (Gasto Antiguo)
            const needsClassification = !gasto.area;
            const AreaIcon = gasto.area ? AREA_ICONS[gasto.area] : null;

            return (
              <motion.div 
                layout
                key={gasto.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group flex flex-col sm:flex-row items-center gap-4 p-4 rounded-[2rem] border transition-all duration-300 relative overflow-hidden",
                  isConfirming 
                    ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-500/30" 
                    : needsClassification
                        ? "bg-amber-50/80 border-amber-200/60 dark:bg-amber-900/10 dark:border-amber-500/20" // Resaltar los sin clasificar
                        : "bg-white dark:bg-[#1c1c1e] border-black/5 hover:shadow-lg hover:border-blue-500/20"
                )}
              >
                {/* --- IZQUIERDA: ICONO E INFORMACIÓN --- */}
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                    style.bg
                    )}>
                        <Icon className={cn("w-5 h-5", style.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-[250px]">
                            {gasto.nombre}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase italic">
                                {style.label} • {new Date(gasto.fecha?.toDate?.() || gasto.fecha || Date.now()).toLocaleDateString('es-VE')}
                            </p>
                            
                            {/* Si ya tiene área, mostramos el badge */}
                            {gasto.area && (
                                <span className="bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-[8px] font-bold text-slate-500 flex items-center gap-1 border border-black/5">
                                    {AreaIcon && <AreaIcon size={8} />}
                                    {gasto.area}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- DERECHA: ACCIONES O PRECIO --- */}
                <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:ml-auto">
                    
                    {/* CASO 1: FALTA CLASIFICAR (MOSTRAR BOTONES RÁPIDOS) */}
                    {needsClassification && onQuickCategory ? (
                        <div className="flex items-center gap-1 p-1 pr-2 rounded-xl bg-white/60 dark:bg-black/20 border border-amber-200/50 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
                            <div className="px-2 hidden md:block">
                                <span className="text-[8px] font-black text-amber-600 uppercase flex items-center gap-1">
                                    <AlertCircle size={10} /> Clasificar:
                                </span>
                            </div>
                            <Button 
                                size="sm" onClick={() => onQuickCategory(gasto.id, 'GENERAL')}
                                className="h-7 px-3 text-[9px] font-bold bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm"
                            >
                                Gral
                            </Button>
                            <Button 
                                size="sm" onClick={() => onQuickCategory(gasto.id, 'IMPRESION')}
                                className="h-7 px-3 text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 shadow-sm"
                            >
                                Imp
                            </Button>
                            <Button 
                                size="sm" onClick={() => onQuickCategory(gasto.id, 'CORTE')}
                                className="h-7 px-3 text-[9px] font-bold bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 shadow-sm"
                            >
                                Corte
                            </Button>
                        </div>
                    ) : (
                        // CASO 2: YA CLASIFICADO (MOSTRAR PRECIO)
                        <div className="text-right min-w-[80px]">
                            <div className="flex items-center gap-1 justify-end">
                                <span className="text-[10px] font-black text-slate-300">$</span>
                                <p className="font-black text-lg tracking-tighter text-slate-900 dark:text-white leading-none">
                                {(Number(gasto.monto) || 0).toFixed(2)}
                                </p>
                            </div>
                            <p className="text-[10px] font-bold text-blue-600 italic mt-1">
                                {(Number(gasto.montoBs) || 0).toLocaleString('es-VE')} Bs.
                            </p>
                        </div>
                    )}

                    {/* BOTONES DE EDICIÓN Y BORRADO */}
                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-white/10">
                        <AnimatePresence mode="wait">
                            {isConfirming ? (
                            <motion.div 
                                key="confirm-ui"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-1"
                            >
                                <Button 
                                size="sm" variant="destructive" 
                                className="h-8 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20"
                                onClick={() => { onDelete(gasto.id); setConfirmDelete(null); }}
                                >
                                Borrar
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => setConfirmDelete(null)}>
                                <X size={14} />
                                </Button>
                            </motion.div>
                            ) : (
                            <motion.div key="actions-ui" className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => onEdit(gasto)}>
                                    <Edit3 size={16} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => setConfirmDelete(gasto.id)}>
                                    <Trash2 size={16} />
                                </Button>
                            </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
              </motion.div>
            )
          })
        )}
      </AnimatePresence>
    </div>
  )
}