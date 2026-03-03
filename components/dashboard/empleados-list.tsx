// @/components/dashboard/empleados-list.tsx
"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit2, Trash2, Mail, Phone, Calendar, Briefcase, Repeat } from "lucide-react"

// Nueva interfaz sincronizada con la base de datos de empleados-view
interface Empleado {
  id: string;
  nombre: string;
  cargo?: string;
  montoSueldo: number;
  diaPago: number;
  frecuenciaPago: string;
  ultimoPagoIso?: string;
  ultimoPagoMes?: string;
  email?: string;
  telefono?: string;
}

interface EmpleadosListProps {
  empleados: Empleado[]
  onDelete: (id: string) => Promise<void>
  onEdit: (empleado: Empleado) => void
  isLoading?: boolean
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" }
];

export function EmpleadosList({ empleados, onDelete, onEdit, isLoading }: EmpleadosListProps) {
  
  // Función de cálculo sincronizada con la nueva lógica
  const calcularDiasRestantes = (emp: Empleado) => {
    const hoy = new Date();
    
    if (emp.frecuenciaPago === 'Semanal') {
        const targetDay = parseInt(emp.diaPago.toString()) || 1; 
        const todayDay = hoy.getDay();
        let diff = targetDay - todayDay;
        if (diff < 0) diff += 7;
        
        if (emp.ultimoPagoIso) {
            const lastP = new Date(emp.ultimoPagoIso);
            const diffSinceLastPayment = Math.floor((hoy.getTime() - lastP.getTime()) / (1000 * 60 * 60 * 24));
            if (diffSinceLastPayment < 6 && diff === 0) {
                return 7; // Ya cobró recientemente, le toca la próxima semana
            }
        }
        return diff === 0 ? "Hoy" : diff;
    } else {
        const diaPago = parseInt(emp.diaPago.toString()) || 15;
        let fechaPago = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
        if (hoy.getDate() > diaPago) {
            fechaPago.setMonth(fechaPago.getMonth() + 1);
        }
        const diff = fechaPago.getTime() - hoy.getTime();
        const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return dias === 0 ? "Hoy" : dias;
    }
  };

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {empleados.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 text-slate-500">
            <p className="font-bold uppercase tracking-wider">Sin empleados registrados</p>
          </motion.div>
        ) : (
          empleados.map((emp, idx) => {
            const dias = calcularDiasRestantes(emp);
            const esSemanal = emp.frecuenciaPago === 'Semanal';
            
            // Determinar texto de cobro
            let textoCobro = "";
            if (dias === 'Hoy') {
                textoCobro = "Toca Pagar Hoy";
            } else if (esSemanal) {
                const nombreDia = DAYS_OF_WEEK.find(d => d.value === emp.diaPago?.toString())?.label || "Día";
                textoCobro = `Cobro los ${nombreDia}`;
            } else {
                textoCobro = `Día ${emp.diaPago} (en ${dias} d)`;
            }

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
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                        {emp.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm uppercase tracking-tight text-slate-900 dark:text-white truncate">
                          {emp.nombre}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                                <Briefcase className="w-3 h-3" /> {emp.cargo || "Empleado"}
                            </span>
                            <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Repeat className="w-3 h-3" /> {emp.frecuenciaPago || "Mensual"}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          {emp.email && (
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{emp.email}</span>
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

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-lg text-slate-900 dark:text-white leading-none">
                          ${Number(emp.montoSueldo).toFixed(2)}
                        </p>
                        <p className={`text-[9px] font-bold uppercase mt-1.5 flex items-center gap-1 justify-end ${dias === 'Hoy' ? 'text-red-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`}>
                          <Calendar className="w-3 h-3" /> {textoCobro}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(emp)}
                          className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(emp.id)}
                          disabled={isLoading}
                          className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
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