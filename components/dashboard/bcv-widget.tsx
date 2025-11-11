"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchBCVRateFromAPI, getBCVRate, setBCVRate } from "@/lib/services/bcv-service"
// Importamos los iconos de estado
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react"

interface BCVWidgetProps {
  onRateChange?: (rate: number) => void
}

export default function BCVWidget({ onRateChange }: BCVWidgetProps) {
  const [rate, setRate] = useState(216.37)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isUpdating, setIsUpdating] = useState(false) // Usado para deshabilitar botones
  // ESTADOS AÑADIDOS PARA LA NOTIFICACIÓN
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState(false)
  // FIN ESTADOS AÑADIDOS

  // 1. LÓGICA PARA CARGAR LA TASA PERSISTENTE AL MONTAR
  useEffect(() => {
    const bcvData = getBCVRate()
    setRate(bcvData.rate)
    setLastUpdated(bcvData.lastUpdated)
    onRateChange?.(bcvData.rate)
  }, [onRateChange])
  
  // 2. LÓGICA DE AUTO-ACTUALIZACIÓN CADA 5 MINUTOS
  useEffect(() => {
    const autoRefresh = async () => {
      try {
        const data = await fetchBCVRateFromAPI()
        // Solo actualiza si la tasa de la API es diferente
        if (data.rate !== rate) {
            setRate(data.rate)
            setBCVRate(data.rate, "api")
            setLastUpdated(data.lastUpdated)
            onRateChange?.(data.rate)
        }
        // Limpiamos errores si una auto-actualización funciona
        setUpdateError(null)
      } catch (error) {
        console.error("Auto-refresh error:", error)
        // No mostramos error en UI para auto-refresh, solo en consola
      }
    }

    autoRefresh() 

    const interval = setInterval(autoRefresh, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [onRateChange, rate])

  // Manejador para guardar manualmente la tasa
  const handleUpdateRate = () => {
    setBCVRate(rate, "manual")
    setLastUpdated(new Date())
    onRateChange?.(rate)
    
    // Notificación de éxito para guardar manualmente
    setUpdateError(null)
    setUpdateSuccess(true)
    setTimeout(() => setUpdateSuccess(false), 3000)
  }

  // Manejador para refrescar desde la API (botón)
  const handleRefreshFromAPI = async () => {
    setIsUpdating(true)
    setUpdateError(null) // Limpiar errores anteriores
    try {
      const data = await fetchBCVRateFromAPI()
      setRate(data.rate)
      setBCVRate(data.rate, "api")
      setLastUpdated(data.lastUpdated)
      onRateChange?.(data.rate)

      // Notificación de éxito
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 3000)

    } catch (error) {
      console.error("Error refreshing rate:", error)
      // Notificación de error
      setUpdateError("Error actualizando tasa BCV desde la API.")
    } finally {
      setIsUpdating(false)
    }
  }

  // Función de formato de fecha
  const formatDate = (dateValue: Date | string) => {
    if (!dateValue) return "Sin fecha"

    let date: Date
    try {
      date = typeof dateValue === "string" ? new Date(dateValue + "T00:00:00") : dateValue

      if (isNaN(date.getTime())) return "Fecha inválida"

      return new Intl.DateTimeFormat("es-VE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    } catch {
      return "Fecha inválida"
    }
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tasa BCV</span>
          <span className="text-sm font-normal text-muted-foreground">Dólar - Bolívares</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-primary/10 rounded-lg p-4">
          <div className="text-4xl font-bold text-primary mb-2">Bs {rate.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground">Actualizado: {formatDate(lastUpdated)}</p>
        </div>

        {/* MENSAJE DE ERROR AÑADIDO */}
        {updateError && (
          <div className="flex gap-2 p-2 bg-destructive/10 rounded text-xs text-destructive border border-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {updateError}
          </div>
        )}

        {/* MENSAJE DE ÉXITO AÑADIDO */}
        {updateSuccess && (
          <div className="flex gap-2 p-2 bg-green-500/10 rounded text-xs text-green-600 border border-green-500">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Tasa actualizada correctamente
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              value={rate}
              onChange={(e) => setRate(Number.parseFloat(e.target.value))}
              step="0.01"
              placeholder="Ingresa la tasa"
              className="flex-1"
              disabled={isUpdating} // Deshabilitar si se está actualizando
            />
            <Button 
              onClick={handleUpdateRate} 
              className="bg-primary hover:bg-primary/90"
              disabled={isUpdating} // Deshabilitar si se está actualizando
            >
              Guardar
            </Button>
          </div>

          <Button
            onClick={handleRefreshFromAPI}
            disabled={isUpdating}
            variant="outline"
            className="w-full gap-2 bg-transparent"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
            {isUpdating ? "Actualizando..." : "Actualizar Tasa BCV"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}