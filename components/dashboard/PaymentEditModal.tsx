// @/components/dashboard/PaymentEditModal.tsx

"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
    DollarSign, RefreshCw, Loader2, Upload, X, 
    Banknote, Calculator, CheckCircle2, Euro, ArrowLeftRight
} from 'lucide-react'

// --- SERVICIOS Y UTILIDADES ---
import { formatCurrency } from '@/lib/utils/order-utils'
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"
import { type OrdenServicio } from '@/lib/types/orden'

interface PaymentEditModalProps {
    isOpen: boolean
    orden: OrdenServicio
    onSave: (abonoUSD: number, nota: string | undefined, imagenUrl?: string) => void 
    onClose: () => void
    currentUserId: string
}

export function PaymentEditModal({ isOpen, orden, onSave, onClose }: PaymentEditModalProps) {
    
    // --- ESTADOS ---
    const [currencyMode, setCurrencyMode] = useState<'USD' | 'BS'>('USD')
    
    // Estado para la calculadora (Input)
    const [calculationBase, setCalculationBase] = useState<'USD' | 'EUR'>('USD') 
    
    // Estado para el Header (Visualización de deuda)
    const [headerRateType, setHeaderRateType] = useState<'USD' | 'EUR'>('USD')

    // Montos
    const [amountUSD, setAmountUSD] = useState<string>('')
    const [amountBS, setAmountBS] = useState<string>('')
    const [nota, setNota] = useState<string>('') 
    
    // Tasas
    const [rates, setRates] = useState<{ usd: number, eur: number }>({ usd: 0, eur: 0 })
    const [loadingRate, setLoadingRate] = useState(false)

    // Imagen
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cálculos de Deuda
    const montoPendiente = orden.totalUSD - (orden.montoPagadoUSD || 0)

    // Tasa activa según selección de la calculadora
    const activeRate = calculationBase === 'USD' ? rates.usd : rates.eur

    // Tasa activa para el Header
    const activeHeaderRate = headerRateType === 'USD' ? rates.usd : rates.eur
    const pendingBs = montoPendiente * activeHeaderRate

    // --- EFECTOS ---
    useEffect(() => {
        if (isOpen) {
            resetForm()
            loadRates()
        }
    }, [isOpen])

    // Conversión Automática: Cuando cambia BS o la Tasa seleccionada
    useEffect(() => {
        if (currencyMode === 'BS' && activeRate > 0 && amountBS) {
            const valBs = parseFloat(amountBS)
            if (!isNaN(valBs)) {
                setAmountUSD((valBs / activeRate).toFixed(2))
            } else {
                setAmountUSD('')
            }
        }
    }, [amountBS, activeRate, currencyMode])

    // --- FUNCIONES AUXILIARES ---

    const resetForm = () => {
        setAmountUSD('')
        setAmountBS('')
        setNota('')
        setCurrencyMode('USD')
        setCalculationBase('USD')
        setHeaderRateType('USD') // Resetear header a USD
        setSelectedFile(null)
        setPreviewUrl(null)
        setIsUploading(false)
    }

    const loadRates = async () => {
        setLoadingRate(true)
        try {
            const data = await fetchBCVRateFromAPI()
            setRates({ 
                usd: data.usdRate, 
                // @ts-ignore
                eur: data.eurRate || 0 
            })
        } catch (e) {
            console.error("Error tasa", e)
        } finally {
            setLoadingRate(false)
        }
    }

    const handleSetFullPayment = () => {
        if (currencyMode === 'USD') {
            setAmountUSD(montoPendiente.toFixed(2))
        } else {
            // Si es en Bolívares, usa la tasa seleccionada en la calculadora
            const totalBs = montoPendiente * activeRate
            setAmountBS(totalBs.toFixed(2))
        }
    }

    // --- MANEJO DE ARCHIVOS ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) return alert("El archivo es muy pesado (Máx 5MB)")
            setSelectedFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleRemoveFile = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // --- GUARDAR ---
    const handleSave = async () => {
        const finalAmount = parseFloat(amountUSD)
        if (isNaN(finalAmount) || finalAmount <= 0) return

        setIsUploading(true)

        try {
            let imageUrl: string | undefined = undefined
            if (selectedFile) {
                imageUrl = await uploadFileToCloudinary(selectedFile)
            }

            let finalNota = nota
            if (currencyMode === 'BS') {
                const symbol = calculationBase === 'USD' ? '$' : '€';
                const autoNote = ` [Pago: Bs. ${parseFloat(amountBS).toLocaleString('es-VE')} @ ${activeRate.toFixed(2)} (${symbol})]`
                finalNota = (nota + autoNote).trim()
            }

            onSave(finalAmount, finalNota || undefined, imageUrl)
            
        } catch (error) {
            console.error("Error guardando pago", error)
            alert("Error al procesar el pago o subir la imagen.")
            setIsUploading(false) 
        }
    }

    const valAmount = parseFloat(amountUSD || '0')
    const isOverLimit = valAmount > (montoPendiente + 0.1)
    const isValid = valAmount > 0 && !isOverLimit

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md md:max-w-lg p-0 bg-white dark:bg-gray-900 border-none shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* --- HEADER (FIJO) --- */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex-none">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Banknote className="w-6 h-6 text-white/80" /> 
                            Registrar Nuevo Pago
                        </DialogTitle>
                        <p className="text-blue-100 text-sm opacity-90">
                            Orden #{orden.ordenNumero} • {orden.cliente.nombreRazonSocial}
                        </p>
                    </DialogHeader>

                    {/* Tarjeta de Saldo */}
                    <div className="mt-6 flex flex-col sm:flex-row justify-between items-end bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 gap-4">
                        <div className="flex-1 w-full">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-xs text-blue-100 uppercase font-semibold tracking-wider">Saldo Pendiente</p>
                                
                                {/* BOTÓN TOGGLE TASA HEADER */}
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => setHeaderRateType(prev => prev === 'USD' ? 'EUR' : 'USD')}
                                    className="h-5 px-2 text-[10px] bg-black/20 hover:bg-black/30 text-white border border-white/10 rounded-full transition-all"
                                    title="Cambiar referencia de Bs"
                                >
                                    Ref: <span className="font-bold ml-1">{headerRateType}</span> 
                                    <ArrowLeftRight className="w-3 h-3 ml-1 opacity-70" />
                                </Button>
                            </div>
                            
                            {/* Monto Principal USD */}
                            <p className="text-3xl font-bold font-mono">{formatCurrency(montoPendiente)}</p>
                            
                            {/* Monto Chiquito en Bs */}
                            <p className="text-sm text-blue-100 font-medium mt-1 flex items-center">
                                ≈ Bs. {pendingBs > 0 
                                    ? pendingBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                    : '...'
                                }
                                <span className="text-[10px] opacity-60 ml-1">
                                    (@ Tasa {headerRateType})
                                </span>
                            </p>
                        </div>

                        <Button 
                            size="sm" 
                            variant="secondary" 
                            className="bg-white text-blue-700 hover:bg-blue-50 border-0 h-9 text-xs font-bold shadow-sm whitespace-nowrap self-end sm:self-center"
                            onClick={handleSetFullPayment}
                        >
                            PAGAR TODO
                        </Button>
                    </div>
                </div>

                {/* --- BODY (SCROLLABLE) --- */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    
                    <Tabs value={currencyMode} onValueChange={(v) => {setCurrencyMode(v as any); setAmountUSD(''); setAmountBS('')}} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <TabsTrigger value="USD" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all">
                                Dólares ($)
                            </TabsTrigger>
                            <TabsTrigger value="BS" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm transition-all">
                                Bolívares (Bs)
                            </TabsTrigger>
                        </TabsList>

                        {/* INPUT USD */}
                        <TabsContent value="USD" className="pt-4 space-y-3 animate-in fade-in slide-in-from-left-2">
                            <Label className="text-sm font-medium text-gray-500">Monto a pagar ($)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-10 text-xl font-semibold h-12"
                                    value={amountUSD}
                                    onChange={(e) => setAmountUSD(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </TabsContent>

                        {/* INPUT BS */}
                        <TabsContent value="BS" className="pt-4 space-y-4 animate-in fade-in slide-in-from-right-2">
                            
                            {/* SELECTOR DE TASA (BOTONES GRANDES) */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-muted-foreground">Calcular usando tasa:</Label>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={loadRates} disabled={loadingRate}>
                                        <RefreshCw className={`w-3 h-3 text-blue-600 ${loadingRate ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    {/* BOTÓN TASA USD */}
                                    <button
                                        onClick={() => setCalculationBase('USD')}
                                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                                            calculationBase === 'USD' 
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                                                : 'border-gray-200 hover:border-blue-300 bg-white dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className={`p-1.5 rounded-full mb-1 ${calculationBase === 'USD' ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                            <DollarSign className="w-4 h-4" />
                                        </div>
                                        <span className={`text-xs font-bold ${calculationBase === 'USD' ? 'text-blue-700' : 'text-gray-500'}`}>USD BCV</span>
                                        <span className="text-lg font-bold mt-1">{rates.usd > 0 ? rates.usd.toFixed(2) : '...'}</span>
                                        
                                        {calculationBase === 'USD' && (
                                            <div className="absolute top-2 right-2 text-blue-500"><CheckCircle2 className="w-4 h-4" /></div>
                                        )}
                                    </button>

                                    {/* BOTÓN TASA EURO */}
                                    <button
                                        onClick={() => setCalculationBase('EUR')}
                                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                                            calculationBase === 'EUR' 
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' 
                                                : 'border-gray-200 hover:border-indigo-300 bg-white dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className={`p-1.5 rounded-full mb-1 ${calculationBase === 'EUR' ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                            <Euro className="w-4 h-4" />
                                        </div>
                                        <span className={`text-xs font-bold ${calculationBase === 'EUR' ? 'text-indigo-700' : 'text-gray-500'}`}>EUR BCV</span>
                                        <span className="text-lg font-bold mt-1">{rates.eur > 0 ? rates.eur.toFixed(2) : '...'}</span>

                                        {calculationBase === 'EUR' && (
                                            <div className="absolute top-2 right-2 text-indigo-500"><CheckCircle2 className="w-4 h-4" /></div>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Monto Bs.</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="text-lg"
                                        value={amountBS}
                                        onChange={(e) => setAmountBS(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">
                                        Equivalente $ (Ref. {calculationBase})
                                    </Label>
                                    <div className="flex items-center h-10 px-3 rounded-md bg-gray-100 dark:bg-gray-800 border font-mono font-bold text-gray-600 dark:text-gray-300">
                                        {amountUSD || '0.00'}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* ALERTA SI EXCEDE MONTO */}
                    {isOverLimit && (
                        <div className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded flex items-center gap-2">
                            <X className="w-4 h-4" /> El monto excede la deuda pendiente.
                        </div>
                    )}

                    <Separator />

                    {/* --- ZONA DE UPLOAD IMAGEN --- */}
                    <div className="space-y-2">
                        <Label className="flex items-center justify-between">
                            <span>Comprobante / Capture</span>
                            {previewUrl && <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Imagen cargada</Badge>}
                        </Label>
                        
                        {!previewUrl ? (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="group border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                            >
                                <Upload className="h-6 w-6 text-gray-400 group-hover:text-blue-500 mb-1" />
                                <span className="text-xs text-gray-500 group-hover:text-blue-600 font-medium">Clic para subir imagen</span>
                            </div>
                        ) : (
                            <div className="relative rounded-xl overflow-hidden border border-gray-200 h-32 group">
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button variant="destructive" size="sm" onClick={handleRemoveFile}>
                                        <X className="w-4 h-4 mr-2" /> Quitar
                                    </Button>
                                </div>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
                    </div>

                    {/* NOTAS */}
                    <div className="space-y-2">
                        <Label>Nota / Referencia</Label>
                        <Textarea 
                            placeholder="Ej: Pago móvil ref 1234..." 
                            className="resize-none"
                            rows={2}
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                        />
                    </div>

                </div>

                {/* --- FOOTER (FIJO) --- */}
                <DialogFooter className="bg-gray-50 dark:bg-gray-900/50 p-4 border-t gap-2 sm:gap-0 flex-none">
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>Cancelar</Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={!isValid || isUploading}
                        className={`min-w-[140px] ${isValid ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Registrar Pago
                            </>
                        )}
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    )
}