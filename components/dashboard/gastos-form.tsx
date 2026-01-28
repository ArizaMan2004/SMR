// @/components/dashboard/gastos-form.tsx
"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  Package, 
  Hammer, 
  Wrench, 
  MoreHorizontal, 
  DollarSign, 
  Calendar,
  FileText, 
  ArrowRightLeft,
  Coins,
  ShoppingCart,
  Loader2,
  Save,
  LayoutGrid, 
  Printer, 
  Scissors
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface GastosFormProps {
  onSubmit: (data: any) => Promise<void>
  isLoading?: boolean
  bcvRate: number
  initialData?: any // Para modo edición
}

const CATEGORIAS = [
  { id: "insumos", label: "Insumos", icon: Package, color: "text-blue-600", bg: "bg-blue-500/10" },
  { id: "materiales", label: "Materiales", icon: Hammer, color: "text-purple-600", bg: "bg-purple-500/10" },
  { id: "servicios", label: "Taller", icon: Wrench, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  { id: "otros", label: "Otros", icon: MoreHorizontal, color: "text-slate-600", bg: "bg-slate-500/10" },
]

const DEPARTAMENTOS = [
  { id: "GENERAL", label: "General", icon: LayoutGrid },
  { id: "IMPRESION", label: "Impresión", icon: Printer },
  { id: "CORTE", label: "Corte Láser", icon: Scissors },
]

export function GastosForm({ onSubmit, isLoading, bcvRate, initialData }: GastosFormProps) {
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    montoUSD: "",
    montoBs: "",
    categoria: "insumos",
    area: "GENERAL", // Valor por defecto
    fecha: new Date().toISOString().split("T")[0],
  })

  // EFECTO: Cargar datos para edición cuando cambie initialData
  useEffect(() => {
    if (initialData) {
      const fechaRaw = initialData.fecha?.toDate ? initialData.fecha.toDate() : new Date(initialData.fecha || Date.now());
      setFormData({
        nombre: initialData.nombre || "",
        descripcion: initialData.descripcion || "",
        montoUSD: initialData.monto?.toString() || "",
        montoBs: initialData.montoBs?.toString() || "",
        categoria: initialData.categoria || "insumos",
        area: initialData.area || "GENERAL", // Cargar área existente o default
        fecha: fechaRaw.toISOString().split("T")[0],
      });
    } else {
      // Reset al limpiar edición
      setFormData({
        nombre: "",
        descripcion: "",
        montoUSD: "",
        montoBs: "",
        categoria: "insumos",
        area: "GENERAL",
        fecha: new Date().toISOString().split("T")[0],
      });
    }
  }, [initialData]);

  // Lógica de conversión en tiempo real
  const handleMontoChange = (valor: string, tipo: "USD" | "BS") => {
    const num = parseFloat(valor) || 0
    if (tipo === "USD") {
      setFormData(prev => ({ 
        ...prev, 
        montoUSD: valor, 
        montoBs: (num * bcvRate).toFixed(2) 
      }))
    } else {
      setFormData(prev => ({ 
        ...prev, 
        montoBs: valor, 
        montoUSD: (num / bcvRate).toFixed(2) 
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!formData.montoUSD || !formData.nombre) return
    
    await onSubmit({
      ...formData,
      id: initialData?.id, // Incluimos el ID si estamos editando
      monto: parseFloat(formData.montoUSD),
      montoBs: parseFloat(formData.montoBs),
      tasaDolar: bcvRate,
      fecha: new Date(formData.fecha),
      estado: "completado"
    })
    
    // Solo reseteamos si no es edición
    if (!initialData) {
        setFormData(prev => ({ ...prev, nombre: "", descripcion: "", montoUSD: "", montoBs: "" }))
    }
  }

  return (
    <Card className="overflow-hidden border-0 shadow-2xl bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-3xl rounded-[3rem]">
      {/* Banner Superior Estilo iOS */}
      <div className={cn(
        "h-28 p-8 flex justify-between items-start transition-colors duration-500",
        initialData ? "bg-gradient-to-r from-indigo-600 to-purple-500" : "bg-gradient-to-r from-blue-600 to-blue-400"
      )}>
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
            {initialData ? "Editar Gasto" : "Nuevo Gasto"}
          </h3>
          <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-80">
            SMR • Control de Operaciones
          </p>
        </div>
        <ShoppingCart className="text-white/20 w-16 h-16 -rotate-12" />
      </div>

      <form onSubmit={handleSubmit} className="p-8 -mt-6 bg-white dark:bg-[#1c1c1e] rounded-t-[3rem] space-y-8">
        
        {/* --- NUEVO: Selector de Departamento --- */}
        <div className="space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Asignar a Departamento</label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-black/20 p-1.5 rounded-2xl">
                {DEPARTAMENTOS.map((dpto) => {
                    const Icon = dpto.icon;
                    const isActive = formData.area === dpto.id;
                    return (
                        <button
                            key={dpto.id}
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, area: dpto.id }))}
                            className={cn(
                                "flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-wide",
                                isActive 
                                    ? "bg-white dark:bg-white/10 text-blue-600 shadow-md scale-95 ring-1 ring-black/5" 
                                    : "text-slate-400 hover:bg-white/50"
                            )}
                        >
                            <Icon size={14} /> {dpto.label}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* Selector de Categoría */}
        <div className="grid grid-cols-4 gap-3">
          {CATEGORIAS.map((cat) => {
            const Icon = cat.icon
            const isActive = formData.categoria === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFormData(p => ({ ...p, categoria: cat.id }))}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300",
                  isActive 
                    ? "bg-blue-600 border-blue-600 shadow-lg scale-95" 
                    : "bg-slate-50 dark:bg-white/5 border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <Icon className={cn("w-5 h-5 mb-1", isActive ? "text-white" : cat.color)} />
                <span className={cn("text-[8px] font-black uppercase tracking-tight", isActive ? "text-white" : "text-slate-500")}>
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Campos de Identificación */}
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Nombre / Identificación</label>
            <div className="relative group">
              <FileText className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
              <input
                required
                value={formData.nombre}
                onChange={(e) => setFormData(p => ({ ...p, nombre: e.target.value }))}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                placeholder="Ej: Pintura, Lijas, Toner..."
              />
            </div>
          </div>
        </div>

        {/* Área de Montos y Conversión */}
        <div className="bg-slate-900 dark:bg-black p-6 rounded-[2.5rem] relative overflow-hidden shadow-inner">
          <ArrowRightLeft className="absolute right-6 top-6 w-12 h-12 text-white/5" />
          
          <div className="space-y-4">
            {/* Campo USD */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500 shadow-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Dólares ($)</p>
                <input
                  type="number"
                  step="0.01"
                  value={formData.montoUSD}
                  onChange={(e) => handleMontoChange(e.target.value, "USD")}
                  className="bg-transparent border-none outline-none text-4xl font-black text-white w-full placeholder:text-white/5"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="h-px bg-white/10 mx-2" />

            {/* Campo Bs */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-lg">
                <Coins className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                    Bolívares (Tasa: {bcvRate.toFixed(2)})
                </p>
                <input
                  type="number"
                  step="0.01"
                  value={formData.montoBs}
                  onChange={(e) => handleMontoChange(e.target.value, "BS")}
                  className="bg-transparent border-none outline-none text-2xl font-black text-emerald-500 w-full placeholder:text-emerald-900"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fecha y Botón de Acción */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Fecha de Registro</label>
            <div className="relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData(p => ({ ...p, fecha: e.target.value }))}
                className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-none font-bold text-xs"
              />
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={isLoading}
            className={cn(
                "h-[56px] px-10 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest gap-3 shadow-xl active:scale-95 transition-all w-full sm:w-auto",
                initialData ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {isLoading ? (
                <Loader2 className="animate-spin w-5 h-5" />
            ) : (
                <>
                    {initialData ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {initialData ? "Actualizar" : "Registrar"}
                </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}