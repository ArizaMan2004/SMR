"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"
import { RefreshCw, AlertCircle, CheckCircle, Euro } from "lucide-react"

interface BCVWidgetProps {
  onRateChange?: (rate: number) => void
  initialRate?: number // Este ahora es el USD inicial
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
        setTimeout(() => setUpdateSuccess(false), 3000)
        console.log("[v1] BCV rates updated. USD:", data.usdRate, "EUR:", data.eurRate)
      } catch (error) {
        console.error("[v1] Error fetching BCV rate:", error)
        setUpdateError("Error actualizando tasas BCV")
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
    setCurrentRate(newRate)
    
    if (isEurMode) {
        setEurRate(newRate)
    } else {
        setUsdRate(newRate)
    }
  }

  const handleSave = () => {
    onRateChange?.(usdRate) 
    setUpdateSuccess(true)
    setTimeout(() => setUpdateSuccess(false), 3000)
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
        setTimeout(() => setUpdateSuccess(false), 3000)
        console.log("[v1] BCV rate manually refreshed. USD:", data.usdRate, "EUR:", data.eurRate)
    } catch (error) {
        console.error("[v1] Error refreshing BCV rate:", error)
        setUpdateError("Error actualizando tasas BCV")
    } finally {
        setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tasa BCV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-primary/10 rounded-lg p-3">
          {rateToDisplay !== null && (
            <div className="text-2xl font-bold text-primary">
              Bs {rateToDisplay.toFixed(2)}
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {isEurMode ? "Euro (€) - Bolívares" : "Dólar ($) - Bolívares"}
            </p>
            {/* Botón para cambiar de modo si EUR está disponible */}
            {eurRate !== null && (
                <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => setIsEurMode(!isEurMode)} 
                    className="p-0 h-auto text-xs text-primary font-bold"
                    disabled={isUpdating}
                >
                    {isEurMode ? "Ver USD" : "Ver EUR"}
                </Button>
            )}
          </div>

          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">Actualizado: {lastUpdated.toLocaleTimeString("es-VE")}</p>
          )}
        </div>

        {updateError && (
          <div className="flex gap-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {updateError}
          </div>
        )}

        {updateSuccess && (
          <div className="flex gap-2 p-2 bg-green-500/10 rounded text-xs text-green-600">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Tasa actualizada correctamente
          </div>
        )}

        <div className="flex gap-2">
          <Input
            type="number"
            value={currentRate}
            onChange={(e) => handleManualRateChange(e.target.value)}
            step="0.01"
            className="text-sm"
            disabled={isUpdating}
          />
          <Button onClick={handleSave} size="sm" className="bg-primary hover:bg-primary/90" disabled={isUpdating}>
            Guardar
          </Button>
        </div>

        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="w-full gap-2 bg-transparent"
          disabled={isUpdating}
        >
          <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin" : ""}`} />
          {isUpdating ? "Actualizando..." : "Actualizar Tasa"}
        </Button>
      </CardContent>
    </Card>
  )
}