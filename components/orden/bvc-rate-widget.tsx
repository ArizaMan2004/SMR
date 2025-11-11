"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react"

interface BCVWidgetProps {
  onRateChange?: (rate: number) => void
  initialRate?: number
}

export function BCVRateWidget({ onRateChange, initialRate = 216.37 }: BCVWidgetProps) {
  const [rate, setRate] = useState(initialRate)
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  useEffect(() => {
    const fetchRate = async () => {
      try {
        setIsUpdating(true)
        setUpdateError(null)
        const data = await fetchBCVRateFromAPI()
        setRate(data.rate)
        setLastUpdated(data.lastUpdated)
        onRateChange?.(data.rate)
        setUpdateSuccess(true)
        setTimeout(() => setUpdateSuccess(false), 3000)
        console.log("[v0] BCV rate updated:", data.rate)
      } catch (error) {
        console.error("[v0] Error fetching BCV rate:", error)
        setUpdateError("Error actualizando tasa BCV")
      } finally {
        setIsUpdating(false)
      }
    }

    // Fetch on mount
    fetchRate()

    // Set up auto-update every 5 minutes
    const interval = setInterval(fetchRate, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [onRateChange])

  const handleSave = () => {
    onRateChange?.(rate)
    setUpdateSuccess(true)
    setTimeout(() => setUpdateSuccess(false), 3000)
  }

  const handleRefresh = async () => {
    try {
      setIsUpdating(true)
      setUpdateError(null)
      const data = await fetchBCVRateFromAPI()
      setRate(data.rate)
      setLastUpdated(data.lastUpdated)
      onRateChange?.(data.rate)
      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 3000)
      console.log("[v0] BCV rate manually refreshed:", data.rate)
    } catch (error) {
      console.error("[v0] Error refreshing BCV rate:", error)
      setUpdateError("Error actualizando tasa BCV")
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
          <div className="text-2xl font-bold text-primary">Bs {rate.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Dólar - Bolívares</p>
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
            value={rate}
            onChange={(e) => setRate(Number.parseFloat(e.target.value))}
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
