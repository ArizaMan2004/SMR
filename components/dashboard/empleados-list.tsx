"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2, Mail, Phone } from "lucide-react"
import type { Empleado } from "@/lib/types/gastos"

interface EmpleadosListProps {
  empleados: Empleado[]
  onDelete: (id: string) => Promise<void>
  onEdit: (empleado: Empleado) => void
  isLoading?: boolean
}

export function EmpleadosList({ empleados, onDelete, onEdit, isLoading }: EmpleadosListProps) {
  const getDaysUntilPayroll = (dayOfMonth: number) => {
    const today = new Date()
    const currentDay = today.getDate()

    if (dayOfMonth >= currentDay) {
      return dayOfMonth - currentDay
    }
    return 30 - currentDay + dayOfMonth
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {empleados.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-slate-500">
            <p className="font-bold uppercase tracking-wider">Sin empleados registrados</p>
          </motion.div>
        ) : (
          empleados.map((emp, idx) => {
            const daysUntil = getDaysUntilPayroll(emp.fechaPago)
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="p-4 rounded-2xl border-0 bg-white/50 dark:bg-white/5 backdrop-blur hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-purple-100 dark:bg-purple-900/30">
                        👤
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm uppercase tracking-tight text-slate-900 dark:text-white">
                          {emp.nombre} {emp.apellido}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{emp.puesto}</p>

                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          {emp.email && (
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                              <Mail className="w-3 h-3" />
                              <span>{emp.email}</span>
                            </div>
                          )}
                          {emp.telefono && (
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                              <Phone className="w-3 h-3" />
                              <span>{emp.telefono}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div>
                        <p className="font-black text-lg text-slate-900 dark:text-white">
                          Bs. {emp.salario.toFixed(2)}
                        </p>
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 text-right mt-1">
                          Día {emp.fechaPago}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(emp)}
                          className="h-8 w-8 p-0 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(emp.id)}
                          disabled={isLoading}
                          className="h-8 w-8 p-0 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })
        )}
      </AnimatePresence>
    </div>
  )
}
