// @/components/dashboard/gastos-fijos-form.tsx
"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Save, DollarSign, Calendar, Tag, Loader2, 
  Layers, Coins, ShieldCheck 
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GastosFijosForm({ onSubmit, isLoading, rates, initialData }: any) {
  const [formData, setFormData] = useState({
    nombre: "",
    monto: "",
    categoria: "Servicios",
    proximoPago: new Date().toISOString().split('T')[0],
    moneda: "USD" 
  });

  // --- CORRECCIÓN: Sincronizar datos al editar ---
  useEffect(() => {
    if (initialData) {
      // Manejo de fecha si viene de Firestore (Timestamp) o String
      let dateValue = "";
      if (initialData.proximoPago) {
        const d = initialData.proximoPago?.toDate ? initialData.proximoPago.toDate() : new Date(initialData.proximoPago);
        dateValue = d.toISOString().split('T')[0];
      }

      setFormData({
        nombre: initialData.nombre || "",
        // Al editar, mostramos el monto original si lo guardamos, 
        // o el montoUSD por defecto
        monto: initialData.ultimoMontoPagadoBs?.toString() || initialData.monto?.toString() || "",
        categoria: initialData.categoria || "Servicios",
        proximoPago: dateValue,
        moneda: initialData.moneda || "USD"
      });
    }
  }, [initialData]);

  const currentRate = formData.moneda === 'BS_EUR' ? (rates?.eur || 0) : (rates?.usd || 0);
  const rawInput = parseFloat(formData.monto) || 0;
  const isBolivares = formData.moneda !== 'USD';
  
  // Conversión visual
  const displayConversion = isBolivares 
    ? (rawInput / (currentRate || 1)) 
    : (rawInput * (rates?.usd || 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.monto) return;
    
    // Normalizamos los datos para que el servicio reciba montos coherentes
    await onSubmit({
      ...formData,
      monto: isBolivares ? displayConversion : rawInput, // Guardamos siempre base USD para estadísticas
      montoOriginal: rawInput, // Guardamos lo que el usuario escribió
      tasaAlMomento: currentRate
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-xl mx-auto"
    >
      <Card className="overflow-hidden border-0 shadow-2xl bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-3xl rounded-[3rem]">
        <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 relative">
           <div className="relative z-10">
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                {initialData ? "Editar Registro" : "Nuevo Servicio"}
              </h3>
              <p className="text-blue-100 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 italic">
                {initialData ? "Modificando gasto existente" : "Cargando gasto global"}
              </p>
           </div>
           <ShieldCheck className="absolute right-8 top-8 text-white/10 w-24 h-24 -rotate-12" />
        </div>

        <form onSubmit={handleSubmit} className="p-8 -mt-8 bg-white dark:bg-[#1c1c1e] rounded-t-[3rem] space-y-6">
          
          {/* Selector de Moneda */}
          <div className="flex p-1.5 bg-slate-100 dark:bg-white/5 rounded-[2rem] gap-1 shadow-inner">
            {['USD', 'BS_USD', 'BS_EUR'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFormData({...formData, moneda: m})}
                className={cn(
                  "flex-1 py-2.5 rounded-[1.5rem] text-[9px] font-black transition-all uppercase tracking-widest",
                  formData.moneda === m 
                    ? "bg-white dark:bg-slate-800 text-blue-600 shadow-md scale-[1.02]" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {m === 'USD' ? 'Divisas ($)' : m === 'BS_USD' ? 'Bs (USD)' : 'Bs (EUR)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Identificación</label>
              <div className="relative group">
                <Tag className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                <input
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                  placeholder="Ej: Fibra Internet"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Categoría</label>
              <div className="relative">
                <Layers className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm appearance-none"
                >
                  <option value="Servicios">Servicios Públicos</option>
                  <option value="Alquiler">Alquileres</option>
                  <option value="Impuestos">Impuestos</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2.5rem] border border-black/5 shadow-inner">
             <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Importe Estimado</span>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-black uppercase",
                  isBolivares ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  {isBolivares ? "Base en Bolívares" : "Base en Dólares"}
                </div>
             </div>
             
             <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors",
                  isBolivares ? "bg-blue-600" : "bg-emerald-600"
                )}>
                  {isBolivares ? <Coins className="text-white w-6 h-6" /> : <DollarSign className="text-white w-6 h-6" />}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monto}
                  onChange={(e) => setFormData({...formData, monto: e.target.value})}
                  className="bg-transparent border-none outline-none text-4xl font-black text-slate-900 dark:text-white w-full placeholder:opacity-10"
                  placeholder="0.00"
                />
             </div>

             {rawInput > 0 && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 pt-4 border-t border-black/5 flex justify-between items-center">
                  <p className="text-[10px] font-bold text-slate-400 italic">Conversión a Tasa Actual:</p>
                  <p className="text-sm font-black text-blue-600">
                    {isBolivares ? `${displayConversion.toFixed(2)} $` : `${displayConversion.toLocaleString('es-VE')} Bs.`}
                  </p>
               </motion.div>
             )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Próximo Vencimiento</label>
              <div className="relative">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type="date"
                  value={formData.proximoPago}
                  onChange={(e) => setFormData({...formData, proximoPago: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 rounded-2xl border-none font-bold text-sm cursor-pointer"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-[52px] px-10 rounded-2xl bg-slate-900 dark:bg-white dark:text-black font-black uppercase text-[10px] tracking-[0.2em] gap-3 shadow-xl active:scale-95 transition-all w-full sm:w-auto"
            >
              {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
              {initialData ? "Actualizar" : "Registrar"}
            </Button>
          </div>

        </form>
      </Card>
    </motion.div>
  )
}