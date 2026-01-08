"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { 
  UserPlus, 
  Phone, 
  User,
  ChevronRight,
  ShieldCheck
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface EmpleadosFormProps {
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
}

export function EmpleadosForm({ onSubmit, isLoading }: EmpleadosFormProps) {
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre) return

    await onSubmit({
      ...formData,
      activo: true,
      fechaRegistro: new Date().toISOString()
    })

    // Reset de los campos
    setFormData({ nombre: "", telefono: "" })
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="overflow-hidden rounded-[2.5rem] border-0 shadow-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl">
        {/* Banner Decorativo */}
        <div className="h-20 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-indigo-600 dark:to-indigo-500 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-black text-lg tracking-tighter text-white uppercase italic">
              Nuevo Registro
            </h3>
          </div>
          <ShieldCheck className="text-white/20 w-8 h-8" />
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-5">
            {/* Input Nombre */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">
                Identificación del Colaborador
              </label>
              <div className="relative group">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Nombre y Apellido"
                  className="w-full pl-12 pr-6 py-4 bg-slate-100/50 dark:bg-white/5 rounded-2xl border-0 ring-1 ring-transparent focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm outline-none"
                />
              </div>
            </div>

            {/* Input Teléfono */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">
                Contacto Directo (Opcional)
              </label>
              <div className="relative group">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="+58 412..."
                  className="w-full pl-12 pr-6 py-4 bg-slate-100/50 dark:bg-white/5 rounded-2xl border-0 ring-1 ring-transparent focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-8 rounded-[2rem] bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-indigo-500/20 group transition-all"
            >
              {isLoading ? "Procesando..." : "Registrar Colaborador"}
              <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <p className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 opacity-60">
              SMR Intel • Sistema de Gestión de Personal
            </p>
          </div>
        </form>
      </Card>
    </motion.div>
  )
}