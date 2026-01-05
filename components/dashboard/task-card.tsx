// @/components/dashboard/task-card.tsx

"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Circle, ChevronRight, Hash, Box, Layers } from 'lucide-react'
import { type OrdenServicio, type ItemOrden } from "@/lib/types/orden"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  item: ItemOrden
  orden: OrdenServicio
  isCompleted?: boolean
  onToggleComplete?: () => void
  onClick?: () => void
}

export default function TaskCard({
  item,
  orden,
  isCompleted = false,
  onToggleComplete,
  onClick
}: TaskCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-300",
        "rounded-[2rem] border-black/5 dark:border-white/5",
        "bg-white/50 dark:bg-white/5 backdrop-blur-md shadow-sm hover:shadow-2xl hover:shadow-blue-500/10",
        isCompleted && "opacity-75 grayscale-[0.5]"
      )}
    >
      <div className="p-5 space-y-4">
        {/* TOP: TITULO Y CHECK */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <Hash className="w-2.5 h-2.5" />
                {orden.ordenNumero || "S/N"}
              </div>
            </div>
            <h3 className="font-bold text-sm leading-tight text-slate-900 dark:text-white line-clamp-2">
              {item.nombre}
            </h3>
          </div>
          
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete?.()
            }}
            className={cn(
              "shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
              isCompleted 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : "bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-blue-600"
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </motion.button>
        </div>

        {/* DETAILS: ESTILO ETIQUETAS IOS */}
        <div className="grid grid-cols-1 gap-2">
          {item.cantidad && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <Box className="w-3 h-3 opacity-40" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                Cant: <span className="text-slate-900 dark:text-slate-200">{item.cantidad} {item.unidad}</span>
              </p>
            </div>
          )}
          {(item.materialDeImpresion || item.materialDetalleCorte) && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                <Layers className="w-3 h-3 opacity-40" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                Mat: <span className="text-slate-900 dark:text-slate-200">{item.materialDeImpresion || item.materialDetalleCorte}</span>
              </p>
            </div>
          )}
        </div>

        {/* FOOTER: CLIENTE CON SEPARADOR SUTIL */}
        <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30 mb-0.5">Cliente</p>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
              {orden.cliente?.nombreRazonSocial || "Cliente Genérico"}
            </p>
          </div>
          <div className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <ChevronRight className="w-3.5 h-3.5 opacity-30" />
          </div>
        </div>
      </div>

      {/* INDICADOR LATERAL DE ESTADO */}
      <div className={cn(
        "absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-full transition-all",
        isCompleted ? "bg-emerald-500" : "bg-blue-600"
      )} />
    </Card>
  )
}