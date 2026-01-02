// @/components/orden/bvc-rate-widget.tsx
"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"
import { 
    RefreshCw, AlertCircle, CheckCircle, 
    DollarSign, Euro, Save, Landmark, Clock, X 
} from "lucide-react"

interface BCVWidgetProps {
  onRateChange?: (rate: number) => void
  initialRate?: number 
}

export function BCVRateWidget({ onRateChange, initialRate = 216.37 }: BCVWidgetProps) { 
  const [usdRate, setUsdRate] = useState(initialRate)
  const [eurRate, setEurRate] = useState<number | null>(null)
  const [currentRate, setCurrentRate] = useState(initialRate)
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState(false)
  const [isEurMode, setIsEurMode] = useState(false)

  const rateToDisplay = isEurMode ? eurRate : usdRate

  useEffect(() => {
    const fetchRate = async () => {
      try {
        setIsUpdating(true)
        setUpdateError(null)
        const data = await fetchBCVRateFromAPI()

        setUsdRate(data.usdRate)
        setEurRate(data.eurRate)
        setLastUpdated(data.lastUpdated)
        
        onRateChange?.(data.usdRate) 
        setCurrentRate(isEurMode && data.eurRate ? data.eurRate : data.usdRate)

        setUpdateSuccess(true)
        setTimeout(() => setUpdateSuccess(false), 4000)
      } catch (error) {
        setUpdateError("Error de conexión con BCV")
        setTimeout(() => setUpdateError(null), 4000)
      } finally {
        setIsUpdating(false)
      }
    }

    fetchRate()
    const interval = setInterval(fetchRate, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [onRateChange, isEurMode])

  useEffect(() => {
      setCurrentRate(isEurMode && eurRate ? eurRate : usdRate)
  }, [isEurMode, usdRate, eurRate])

  const handleManualRateChange = (value: string) => {
    const newRate = Number.parseFloat(value)
    if (isNaN(newRate)) return
    setCurrentRate(newRate)
    if (isEurMode) setEurRate(newRate) 
    else setUsdRate(newRate)
  }

  const handleSave = () => {
    onRateChange?.(usdRate) 
    setUpdateSuccess(true)
    setTimeout(() => setUpdateSuccess(false), 4000)
  }

  const handleRefresh = async () => {
    try {
        setIsUpdating(true)
        setUpdateError(null)
        const data = await fetchBCVRateFromAPI()
        setUsdRate(data.usdRate)
        setEurRate(data.eurRate)
        setLastUpdated(data.lastUpdated)
        onRateChange?.(data.usdRate) 
        setCurrentRate(isEurMode && data.eurRate ? data.eurRate : data.usdRate)
        setUpdateSuccess(true)
        setTimeout(() => setUpdateSuccess(false), 4000)
    } catch (error) {
        setUpdateError("Fallo al actualizar tasa")
        setTimeout(() => setUpdateError(null), 4000)
    } finally {
        setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 relative">
      
      {/* --- NOTIFICACIÓN FLOTANTE: Más compacta en móvil --- */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-[100] flex flex-col gap-2 md:gap-3 pointer-events-none">
        <AnimatePresence>
            {updateSuccess && (
                <motion.div 
                    initial={{ opacity: 0, x: 50, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    className="pointer-events-auto flex items-center gap-3 p-3 md:p-4 bg-emerald-500 text-white rounded-xl md:rounded-2xl shadow-xl min-w-[240px] md:min-w-[280px]"
                >
                    <div className="bg-white/20 p-1.5 md:p-2 rounded-lg md:rounded-xl">
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-widest">Sincronización</p>
                        <p className="text-xs md:text-[13px] font-medium">Tasa actualizada</p>
                    </div>
                    <button onClick={() => setUpdateSuccess(false)} className="opacity-50 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* --- ÁREA DE VISUALIZACIÓN: Ajuste de paddings y fuentes --- */}
      <div className="relative overflow-hidden bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 p-5 md:p-8 rounded-2xl md:rounded-[2rem] shadow-inner backdrop-blur-sm">
        <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                    <div className="p-1 md:p-1.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-md md:rounded-lg">
                        {isEurMode ? <Euro className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600" /> : <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-600" />}
                    </div>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-slate-500">
                        Tasa {isEurMode ? "Euro (€)" : "Dólar ($)"} Oficial
                    </span>
                </div>
                
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={rateToDisplay}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter"
                    >
                        {rateToDisplay !== null ? `Bs. ${rateToDisplay.toFixed(2)}` : "---"}
                    </motion.div>
                </AnimatePresence>
            </div>

            {eurRate !== null && (
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEurMode(!isEurMode)} 
                    className="h-7 md:h-9 px-3 rounded-full border-indigo-100 dark:border-indigo-500/20 bg-white/50 hover:bg-white text-indigo-600 font-bold text-[9px] md:text-xs"
                    disabled={isUpdating}
                >
                    {isEurMode ? "Dólar $" : "Euro €"}
                </Button>
            )}
        </div>

        <div className="mt-3 md:mt-4 flex items-center gap-2">
            <Clock className="w-3 h-3 text-slate-400" />
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {lastUpdated ? `Sinc: ${lastUpdated.toLocaleTimeString("es-VE", { hour: '2-digit', minute: '2-digit' })}` : "Buscando..."}
            </p>
        </div>
        
        {/* Marca de agua reducida en móvil */}
        <Landmark className="absolute -right-2 -bottom-2 md:-right-4 md:-bottom-4 w-16 h-16 md:w-24 md:h-24 text-indigo-500/5 rotate-12 pointer-events-none" />
      </div>

      {/* --- CONTROLES MANUALES: Apilado responsivo --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="flex gap-2 p-1.5 md:p-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl md:rounded-2xl border border-slate-200 dark:border-slate-700">
          <Input
            type="number"
            value={currentRate}
            onChange={(e) => handleManualRateChange(e.target.value)}
            step="0.01"
            className="h-8 md:h-10 border-none bg-transparent shadow-none text-xs md:text-sm font-bold focus-visible:ring-0 text-slate-700 dark:text-slate-200"
            disabled={isUpdating}
          />
          <Button 
            onClick={handleSave} 
            size="sm" 
            className="h-8 md:h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg md:rounded-xl px-3 md:px-4 font-bold text-[10px] md:text-xs shadow-sm" 
            disabled={isUpdating}
          >
            <Save className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
            Guardar
          </Button>
        </div>

        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="h-10 md:h-full rounded-xl md:rounded-2xl border-slate-200 dark:border-slate-700 font-bold uppercase text-[9px] md:text-[10px] tracking-widest transition-all shadow-sm"
          disabled={isUpdating}
        >
          <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 mr-2 ${isUpdating ? "animate-spin text-indigo-600" : ""}`} />
          {isUpdating ? "Cargando..." : "Actualizar BCV"}
        </Button>
      </div>
    </div>
  )
}