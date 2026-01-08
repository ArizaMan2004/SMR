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
  X 
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// 1. MAPEADO DE CATEGORÍAS (Específico para la vista de Insumos/Taller)
const CATEGORY_MAP: Record<string, { color: string, icon: any, label: string, bg: string }> = {
  "insumos": { color: "text-blue-500", bg: "bg-blue-500/10", icon: Package, label: "Insumo" },
  "materiales": { color: "text-purple-500", bg: "bg-purple-500/10", icon: Hammer, label: "Material" },
  "servicios": { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Wrench, label: "Taller" },
  "otros": { color: "text-slate-500", bg: "bg-slate-500/10", icon: MoreHorizontal, label: "Otros" }
}

const DEFAULT_STYLE = { color: "text-slate-400", bg: "bg-slate-100", icon: TrendingDown, label: "Gasto" };

interface GastosListProps {
  gastos: any[]
  onDelete: (id: string) => void
  onEdit: (gasto: any) => void
}

export function GastosList({ gastos, onDelete, onEdit }: GastosListProps) {
  // Estado para controlar qué elemento está en modo confirmación de borrado
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // --- FILTRO DE UNICIDAD: Evita que se muestren elementos duplicados por el mismo ID ---
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
              Sin movimientos de insumos registrados
            </p>
          </motion.div>
        ) : (
          uniqueGastos.map((gasto) => {
            const style = CATEGORY_MAP[gasto.categoria] || DEFAULT_STYLE;
            const Icon = style.icon;
            const isConfirming = confirmDelete === gasto.id;

            return (
              <motion.div 
                layout
                key={gasto.id} // Se usa el ID de Firebase como key única
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group flex items-center gap-4 p-5 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden",
                  isConfirming 
                    ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-500/30" 
                    : "bg-white dark:bg-[#1c1c1e] border-black/5 hover:shadow-xl hover:border-blue-500/20"
                )}
              >
                {/* Icono decorativo de categoría */}
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                  style.bg
                )}>
                  <Icon className={cn("w-6 h-6", style.color)} />
                </div>

                {/* Información del gasto */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-[15px] uppercase tracking-tight text-slate-900 dark:text-white truncate">
                    {gasto.nombre}
                  </h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase italic">
                    {style.label} • {new Date(gasto.fecha?.toDate?.() || gasto.fecha || Date.now()).toLocaleDateString('es-VE')}
                  </p>
                </div>

                {/* Precios: Protección contra $NaN */}
                <div className="text-right">
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

                {/* Acciones: Editar y Borrar con Confirmación */}
                <div className="flex items-center gap-1 ml-2">
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
                          size="sm" 
                          variant="destructive" 
                          className="h-9 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest"
                          onClick={() => {
                            onDelete(gasto.id);
                            setConfirmDelete(null);
                          }}
                        >
                          Borrar
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-9 w-9 rounded-xl"
                          onClick={() => setConfirmDelete(null)}
                        >
                          <X size={16} />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="actions-ui"
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-blue-600 hover:bg-blue-50"
                          onClick={() => onEdit(gasto)}
                        >
                          <Edit3 size={18} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-red-500 hover:bg-red-50"
                          onClick={() => setConfirmDelete(gasto.id)}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })
        )}
      </AnimatePresence>
    </div>
  )
}