// @/components/dashboard/PaymentEditModal.tsx

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatCurrency } from '@/lib/utils/order-utils'

// --- SERVICIOS ---
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"
// ⚠️ Asegúrate de importar tu servicio de Cloudinary existente
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"

import { type PagoTransaction } from "@/components/orden/PaymentHistoryView" 
import { type OrdenServicio } from '@/lib/types/orden'
import { AlertTriangle, DollarSign, RefreshCw, Calculator, Loader2, Upload, X, Image as ImageIcon } from 'lucide-react'

interface PaymentEditModalProps {
    isOpen: boolean
    orden: OrdenServicio
    // 📢 ACTUALIZADO: onSave ahora acepta un tercer argumento opcional para la imagen
    onSave: (abonoUSD: number, nota: string | undefined, imagenUrl?: string) => void 
    onClose: () => void
    currentUserId: string
    historialPagos?: PagoTransaction[] 
}

export function PaymentEditModal({ isOpen, orden, onSave, onClose }: PaymentEditModalProps) {
    
    // Estados del formulario de Pago
    const [currencyMode, setCurrencyMode] = useState<'USD' | 'BS'>('USD')
    const [abonoAmount, setAbonoAmount] = useState<number>(0)
    const [nota, setNota] = useState<string>('') 
    
    // Estados para Bolívares
    const [bsAmount, setBsAmount] = useState<string>('')
    const [selectedRateType, setSelectedRateType] = useState<'USD' | 'EUR'>('USD')
    const [rates, setRates] = useState<{ usd: number, eur: number } | null>(null)
    const [loadingRates, setLoadingRates] = useState(false)
    const [ratesError, setRatesError] = useState<string | null>(null)

    // 📸 ESTADOS PARA IMAGEN
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const montoTotal = orden.totalUSD
    const montoPagado = orden.montoPagadoUSD || 0
    const montoPendiente = montoTotal - montoPagado
    const canSave = abonoAmount > 0 && abonoAmount <= (montoPendiente + 0.01)

    // Resetear al abrir
    useEffect(() => {
        if (isOpen) {
            loadRates()
            setAbonoAmount(0)
            setBsAmount('')
            setCurrencyMode('USD')
            setNota('')
            // Reset Imagen
            setSelectedFile(null)
            setPreviewUrl(null)
            setIsUploading(false)
        }
    }, [isOpen])

    // --- LOGICA DE TASAS (Igual que antes) ---
    const loadRates = async () => {
        setLoadingRates(true)
        setRatesError(null)
        try {
            const data = await fetchBCVRateFromAPI()
            setRates({ usd: data.usdRate, eur: data.eurRate || 0 })
        } catch (error) {
            console.error("Error cargando tasas:", error)
            setRatesError("No se pudieron cargar las tasas del BCV.")
        } finally {
            setLoadingRates(false)
        }
    }

    useEffect(() => {
        if (currencyMode === 'BS' && rates) {
            const amount = parseFloat(bsAmount)
            if (!isNaN(amount) && amount > 0) {
                const rate = selectedRateType === 'USD' ? rates.usd : rates.eur
                if (rate > 0) {
                    setAbonoAmount(amount / rate)
                }
            } else {
                setAbonoAmount(0)
            }
        }
    }, [bsAmount, selectedRateType, rates, currencyMode])

    // --- LOGICA DE IMAGEN ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            // Crear preview local
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
        }
    }

    const handleRemoveFile = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // --- GUARDAR ---
    const handleSave = async () => {
        if (!canSave) return
        
        setIsUploading(true) // Iniciamos estado de carga (bloquea botones)

        try {
            // 1. Subir imagen si existe
            let finalImageUrl: string | undefined = undefined
            
            if (selectedFile) {
                // Usamos tu servicio existente
                finalImageUrl = await uploadFileToCloudinary(selectedFile)
            }

            // 2. Preparar nota con detalles de tasa
            let finalNota = nota
            if (currencyMode === 'BS' && rates) {
                const rateUsed = selectedRateType === 'USD' ? rates.usd : rates.eur
                const autoNote = ` [Pago en Bs: ${parseFloat(bsAmount).toLocaleString('es-VE', { minimumFractionDigits: 2 })} | Tasa ${selectedRateType}: ${rateUsed}]`
                finalNota = (nota.trim() + autoNote).trim()
            }

            // 3. Ajuste de redondeo
            let finalAmount = abonoAmount
            if (finalAmount > montoPendiente && finalAmount < montoPendiente + 0.1) {
                finalAmount = montoPendiente
            }

            // 4. Guardar Todo (Pasamos la URL de la imagen al padre)
            onSave(finalAmount, finalNota || undefined, finalImageUrl)

            // Reset
            setAbonoAmount(0)
            setBsAmount('')
            setNota('')
            handleRemoveFile()
            
        } catch (error) {
            console.error("Error al procesar el pago/imagen:", error)
            alert("Hubo un error al subir la imagen o procesar el pago.")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center">
                        <DollarSign className="w-6 h-6 mr-2 text-green-600" />
                        Registrar Abono | Orden #{orden.ordenNumero}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Resumen de Saldos */}
                    <div className="space-y-2 p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/50">
                        <div className="flex justify-between">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Orden:</p>
                            <span className="font-semibold">{formatCurrency(montoTotal)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 mt-1">
                            <p className="text-lg font-bold">Saldo Pendiente:</p>
                            <span className="text-lg font-bold text-destructive dark:text-red-400">{formatCurrency(montoPendiente)}</span>
                        </div>
                    </div>

                    {/* Selector de Moneda y Formulario */}
                    <Tabs value={currencyMode} onValueChange={(v) => setCurrencyMode(v as 'USD' | 'BS')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="USD">Dólares ($)</TabsTrigger>
                            <TabsTrigger value="BS">Bolívares (Bs)</TabsTrigger>
                        </TabsList>

                        <TabsContent value="USD" className="space-y-4">
                            <div className="space-y-2">
                                <Label>Monto (USD)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <Input
                                        type="number"
                                        placeholder={`Máx. ${montoPendiente.toFixed(2)}`}
                                        className="pl-9 text-lg font-semibold"
                                        value={abonoAmount || ''}
                                        onChange={(e) => setAbonoAmount(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="BS" className="space-y-4">
                            {/* Selector Tasa */}
                            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md border space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase">Tasa de Conversión</Label>
                                    <Button variant="ghost" size="sm" onClick={loadRates} disabled={loadingRates} className="h-6 px-2 text-xs">
                                        <RefreshCw className={`w-3 h-3 mr-1 ${loadingRates ? 'animate-spin' : ''}`} /> Actualizar
                                    </Button>
                                </div>
                                {loadingRates && !rates ? (
                                    <div className="text-xs text-muted-foreground">Cargando tasas...</div>
                                ) : (
                                    <RadioGroup value={selectedRateType} onValueChange={(v) => setSelectedRateType(v as 'USD' | 'EUR')} className="grid grid-cols-2 gap-4">
                                        <div className={`flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-white dark:hover:bg-gray-700 ${selectedRateType === 'USD' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-transparent'}`}>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="USD" id="r-usd" /><Label htmlFor="r-usd" className="cursor-pointer font-semibold">BCV ($)</Label></div>
                                            <span className="text-sm font-mono">{rates?.usd.toFixed(2)}</span>
                                        </div>
                                        <div className={`flex items-center justify-between p-2 rounded border cursor-pointer hover:bg-white dark:hover:bg-gray-700 ${selectedRateType === 'EUR' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-transparent'}`}>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="EUR" id="r-eur" /><Label htmlFor="r-eur" className="cursor-pointer font-semibold">BCV (€)</Label></div>
                                            <span className="text-sm font-mono">{rates?.eur.toFixed(2)}</span>
                                        </div>
                                    </RadioGroup>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Monto Bs.</Label>
                                    <Input type="number" placeholder="0.00" value={bsAmount} onChange={(e) => setBsAmount(e.target.value)} disabled={loadingRates || !rates} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground">Equivale ($)</Label>
                                    <Input readOnly className="bg-gray-100 dark:bg-gray-800 font-bold text-green-700" value={abonoAmount > 0 ? abonoAmount.toFixed(2) : '0.00'} />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* --- SECCIÓN DE FOTO / COMPROBANTE --- */}
                    <div className="space-y-2">
                        <Label>Comprobante o Foto del Efectivo (Opcional)</Label>
                        
                        {!previewUrl ? (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground font-medium">Clic para subir foto</p>
                                <p className="text-xs text-muted-foreground">JPG, PNG (Max 5MB)</p>
                            </div>
                        ) : (
                            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                                <img 
                                    src={previewUrl} 
                                    alt="Vista previa comprobante" 
                                    className="w-full h-48 object-cover bg-gray-100"
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <Button 
                                        variant="destructive" 
                                        size="icon" 
                                        className="h-8 w-8 shadow-sm"
                                        onClick={handleRemoveFile}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs truncate">
                                    {selectedFile?.name}
                                </div>
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Notas del Abono</Label>
                        <Textarea
                            placeholder="Referencia bancaria, banco emisor, etc."
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>Cancelar</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={!canSave || montoPendiente === 0 || loadingRates || isUploading}
                        className="min-w-[160px]"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Subiendo...
                            </>
                        ) : (
                            `Registrar ${formatCurrency(abonoAmount)}`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}