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
import { Switch } from "@/components/ui/switch"
import { 
    DollarSign, RefreshCw, Loader2, Upload, X, 
    Banknote, ArrowLeftRight, CheckCircle2, Euro, // ✅ Iconos agregados correctamente
    Wallet, Landmark, CreditCard, Coins, Image as ImageIcon,
    Tag
} from 'lucide-react'

import { formatCurrency } from '@/lib/utils/order-utils'
import { fetchBCVRateFromAPI } from "@/lib/services/bcv-service"
import { uploadFileToCloudinary } from "@/lib/services/cloudinary-service"
import { type OrdenServicio } from '@/lib/types/orden'
import { cn } from '@/lib/utils'

interface PaymentEditModalProps {
    isOpen: boolean
    orden: OrdenServicio
    // ✅ Firma actualizada para aceptar descuento
    onSave: (abonoUSD: number, nota: string | undefined, imagenUrl: string | undefined, metodo: string, descuento?: number) => Promise<void> | void
    onClose: () => void
    currentUserId: string
    rates?: { usd: number, eur: number, usdt: number }
}

export function PaymentEditModal({ isOpen, orden, onSave, onClose, rates }: PaymentEditModalProps) {
    
    // --- ESTADOS ---
    const [wallet, setWallet] = useState('cash_usd') 
    const [currencyMode, setCurrencyMode] = useState<'USD' | 'BS'>('USD')
    const [calculationBase, setCalculationBase] = useState<'USD' | 'EUR' | 'USDT'>('USD') 
    const [headerRateType, setHeaderRateType] = useState<'USD' | 'EUR'>('USD')

    const [amountUSD, setAmountUSD] = useState<string>('')
    const [amountBS, setAmountBS] = useState<string>('')
    const [nota, setNota] = useState<string>('') 
    
    // Estado para el Descuento / Ajuste
    const [applyDiscount, setApplyDiscount] = useState(false)

    const [localRates, setLocalRates] = useState<{ usd: number, eur: number, usdt: number }>({ usd: 0, eur: 0, usdt: 0 })
    const [loadingRate, setLoadingRate] = useState(false)

    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // --- CÁLCULOS ---
    const montoPendiente = orden.totalUSD - (orden.montoPagadoUSD || 0)
    
    const safeRates = {
        bcv: rates?.usd || localRates.usd || 1,
        eur: rates?.eur || localRates.eur || 1,
        paralelo: rates?.usdt || localRates.usdt || 1
    }

    const activeRate = calculationBase === 'USD' ? safeRates.bcv : 
                       calculationBase === 'EUR' ? safeRates.eur : safeRates.paralelo

    const activeHeaderRate = headerRateType === 'USD' ? safeRates.bcv : safeRates.eur
    const pendingBs = montoPendiente * activeHeaderRate

    // LÓGICA DE DESCUENTO (Saldar Restante)
    const currentPaymentAmount = parseFloat(amountUSD || '0');
    const difference = montoPendiente - currentPaymentAmount;
    // Mostrar opción si falta dinero (> 0.01) y ya escribió algo
    const showDiscountOption = difference > 0.01 && currentPaymentAmount > 0;

    // --- EFECTOS ---
    
    // Cargar tasas al abrir (Sin resetear formulario para evitar el bug del reinicio)
    useEffect(() => {
        if (isOpen && !rates) loadRates()
    }, [isOpen])

    // Reglas de Negocio para Billeteras (Estricto)
    useEffect(() => {
        if (wallet === 'bank_bs') {
            setCurrencyMode('BS'); // Banco es Bs
            setCalculationBase('USD'); 
        } else if (wallet === 'zelle') {
            setCurrencyMode('USD'); // Zelle es Dólares
        } else if (wallet === 'usdt') {
            setCurrencyMode('USD'); // Binance es Dólares (USDT)
        } else {
            // Caja Chica default USD pero flexible
            setCurrencyMode('USD');
        }
        
        // Limpiamos al cambiar billetera (Acción explícita del usuario)
        setAmountUSD('')
        setAmountBS('')
        setApplyDiscount(false)
    }, [wallet])

    // Conversión en vivo Bs -> USD
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

    // --- FUNCIONES ---

    const loadRates = async () => {
        setLoadingRate(true)
        try {
            const data = await fetchBCVRateFromAPI()
            let paralelo = 0;
            try {
                const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo');
                const pData = await res.json();
                paralelo = pData.promedio;
            } catch(e) {}
            setLocalRates({ usd: data.usd, eur: data.eur || 0, usdt: paralelo })
        } catch (e) { console.error(e) } finally { setLoadingRate(false) }
    }

    const handleSetFullPayment = () => {
        setApplyDiscount(false)
        if (currencyMode === 'USD') {
            setAmountUSD(montoPendiente.toFixed(2))
        } else {
            const totalBs = montoPendiente * activeRate
            setAmountBS(totalBs.toFixed(2))
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB")
            setSelectedFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleRemoveFile = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const handleSave = async () => {
        const finalAmount = parseFloat(amountUSD)
        if (isNaN(finalAmount) || finalAmount <= 0) return

        setIsUploading(true)
        try {
            let imageUrl: string | undefined = undefined
            if (selectedFile) imageUrl = await uploadFileToCloudinary(selectedFile)

            // Etiquetas para el historial
            let metodoLegible = "Efectivo USD";
            if (wallet === 'bank_bs') metodoLegible = "Pago Móvil / Bs";
            if (wallet === 'zelle') metodoLegible = "Zelle";
            if (wallet === 'usdt') metodoLegible = "Binance USDT";
            if (wallet === 'cash_usd' && currencyMode === 'BS') metodoLegible = "Efectivo Bs";

            // Nota automática con detalle de tasa
            let finalNota = nota
            if (currencyMode === 'BS') {
                const symbol = calculationBase === 'USD' ? '$' : calculationBase === 'EUR' ? '€' : '₮';
                const autoNote = ` [Ref: Bs. ${parseFloat(amountBS).toLocaleString('es-VE')} @ ${activeRate.toFixed(2)} (${symbol})]`
                finalNota = (nota + autoNote).trim()
            }

            // CALCULAR DESCUENTO SI APLICA
            // Si el switch está activo, la diferencia es el descuento
            const discountAmount = (applyDiscount && difference > 0) ? difference : 0;

            await onSave(finalAmount, finalNota || undefined, imageUrl, metodoLegible, discountAmount)
            onClose()
        } catch (error) {
            console.error(error)
            alert("Error al procesar.")
        } finally {
            setIsUploading(false)
        }
    }

    const valAmount = parseFloat(amountUSD || '0')
    const isOverLimit = valAmount > (montoPendiente + 0.1)
    const isValid = valAmount > 0 && !isOverLimit

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md md:max-w-lg p-0 bg-white dark:bg-gray-900 border-none shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* --- HEADER --- */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex-none">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Banknote className="w-6 h-6 text-white/80" /> 
                            Registrar Ingreso
                        </DialogTitle>
                        <p className="text-blue-100 text-sm opacity-90">
                            Orden #{orden.ordenNumero} • {orden.cliente.nombreRazonSocial}
                        </p>
                    </DialogHeader>

                    {/* TARJETA RESUMEN */}
                    <div className="mt-6 flex justify-between items-end bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                        <div>
                            <div className="flex justify-between items-center mb-1 gap-4">
                                <p className="text-xs text-blue-100 uppercase font-semibold tracking-wider">Por Cobrar</p>
                                <Button size="sm" variant="ghost" onClick={() => setHeaderRateType(prev => prev === 'USD' ? 'EUR' : 'USD')} className="h-5 px-2 text-[10px] bg-black/20 hover:bg-black/30 text-white border border-white/10 rounded-full transition-all">
                                    Ref: <span className="font-bold ml-1">{headerRateType}</span> 
                                    <ArrowLeftRight className="w-3 h-3 ml-1 opacity-70" />
                                </Button>
                            </div>
                            <p className="text-3xl font-bold font-mono">{formatCurrency(montoPendiente)}</p>
                            <p className="text-sm text-blue-100 font-medium mt-1">
                                ≈ Bs. {pendingBs > 0 ? pendingBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '...'}
                            </p>
                        </div>
                        <Button size="sm" variant="secondary" className="bg-white text-blue-700 hover:bg-blue-50 border-0 h-9 text-xs font-bold shadow-sm whitespace-nowrap self-end sm:self-center" onClick={handleSetFullPayment}>
                            PAGAR TODO
                        </Button>
                    </div>
                </div>

                {/* --- BODY --- */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    {/* SELECCIÓN DE BILLETERA */}
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase text-slate-400">Destino del Dinero</Label>
                        <div className="grid grid-cols-4 gap-2">
                            <WalletOption id="cash_usd" label="Caja" icon={Wallet} active={wallet} onClick={setWallet} color="emerald" />
                            <WalletOption id="bank_bs" label="Banco" icon={Landmark} active={wallet} onClick={setWallet} color="blue" />
                            <WalletOption id="zelle" label="Zelle" icon={CreditCard} active={wallet} onClick={setWallet} color="purple" />
                            <WalletOption id="usdt" label="Binance" icon={Coins} active={wallet} onClick={setWallet} color="orange" />
                        </div>
                    </div>

                    <Separator />

                    <Tabs value={currencyMode} onValueChange={(v) => {setCurrencyMode(v as any); setAmountUSD(''); setAmountBS('')}} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-4">
                            <TabsTrigger value="USD" className="font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm">Dólares ($)</TabsTrigger>
                            <TabsTrigger value="BS" disabled={wallet === 'zelle' || wallet === 'usdt'} className="font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm disabled:opacity-50">Bolívares (Bs)</TabsTrigger>
                        </TabsList>

                        {/* INPUT USD */}
                        <TabsContent value="USD" className="space-y-3 mt-0">
                            <Label className="text-xs font-black uppercase text-slate-400">Monto Real Recibido ($)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-10 text-xl font-bold h-14 rounded-2xl bg-slate-50 border-none"
                                    value={amountUSD}
                                    onChange={(e) => setAmountUSD(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </TabsContent>

                        {/* INPUT BS CON CALCULADORA */}
                        <TabsContent value="BS" className="space-y-4 mt-0">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs font-black uppercase text-slate-400">Tasa de Conversión</Label>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={loadRates} disabled={loadingRate}><RefreshCw className={`w-3 h-3 text-blue-600 ${loadingRate ? 'animate-spin' : ''}`} /></Button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <RateButton type="USD" rate={safeRates.bcv} active={calculationBase} onClick={setCalculationBase} icon={<DollarSign size={12}/>} label="USD BCV" />
                                    <RateButton type="EUR" rate={safeRates.eur} active={calculationBase} onClick={setCalculationBase} icon={<Euro size={12}/>} label="EUR BCV" />
                                    <RateButton type="USDT" rate={safeRates.paralelo} active={calculationBase} onClick={setCalculationBase} icon={<Coins size={12}/>} label="PARALELO" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500">Monto Bs.</Label>
                                    <Input type="number" placeholder="0.00" className="text-lg font-bold h-12 rounded-xl" value={amountBS} onChange={(e) => setAmountBS(e.target.value)} autoFocus />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500">Equivalente ($)</Label>
                                    <div className="flex items-center h-12 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 border font-mono font-bold text-gray-600 dark:text-gray-300">{amountUSD || '0.00'}</div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* --- OPCIÓN DE DESCUENTO (Saldar Restante) --- */}
                    {showDiscountOption && (
                        <div className="animate-in fade-in zoom-in-95 bg-orange-50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/20 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-black uppercase text-orange-700 flex items-center gap-2">
                                    <Tag className="w-3 h-3" /> Saldar Restante (Ajuste)
                                </Label>
                                <p className="text-[10px] text-orange-600/80 leading-tight">
                                    El cliente paga <b>{formatCurrency(currentPaymentAmount)}</b>. <br/>
                                    Aplicar descuento de <b>{formatCurrency(difference)}</b> para cerrar la orden.
                                </p>
                            </div>
                            <Switch 
                                checked={applyDiscount} 
                                onCheckedChange={setApplyDiscount} 
                                className="data-[state=checked]:bg-orange-500"
                            />
                        </div>
                    )}

                    {isOverLimit && <div className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl flex items-center gap-2 animate-pulse"><X className="w-4 h-4" /> El monto excede la deuda (verificar).</div>}

                    <Separator />

                    <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                            <Label className="text-xs font-black uppercase text-slate-400">Nota / Referencia</Label>
                            <Input value={nota} onChange={e => setNota(e.target.value)} className="h-12 font-bold bg-slate-50 dark:bg-black/20 border-none rounded-xl text-xs" placeholder="Ej: Ref 1234..." />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-black uppercase text-slate-400 flex justify-between">Foto {previewUrl && <span className="text-emerald-500">OK</span>}</Label>
                            <div onClick={() => !previewUrl && fileInputRef.current?.click()} className={cn("h-12 w-12 rounded-xl flex items-center justify-center cursor-pointer transition-all border-2 border-dashed relative overflow-hidden", previewUrl ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-blue-400")}>
                                {previewUrl ? (
                                    <>
                                        <img src={previewUrl} className="w-full h-full object-cover opacity-50" />
                                        <div className="absolute inset-0 flex items-center justify-center"><X className="w-5 h-5 text-red-600 bg-white rounded-full p-0.5 cursor-pointer shadow-sm" onClick={(e) => {e.stopPropagation(); setPreviewUrl(null); setSelectedFile(null)}}/></div>
                                    </>
                                ) : <ImageIcon className="w-5 h-5 text-slate-400" />}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-gray-50 dark:bg-gray-900/50 p-6 border-t gap-3 sm:gap-0 flex-none">
                    <Button variant="outline" onClick={onClose} disabled={isUploading} className="rounded-xl h-12 font-bold border-slate-200">Cancelar</Button>
                    <Button onClick={handleSave} disabled={!isValid || isUploading} className={`min-w-[160px] h-12 rounded-xl font-black uppercase tracking-wide ${isValid ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
                        {isUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Procesando...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> {applyDiscount ? 'Saldar y Cerrar' : 'Registrar Pago'}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function WalletOption({ id, label, icon: Icon, active, onClick, color }: any) {
    const isSelected = active === id;
    const colors: any = { emerald: "border-emerald-500 bg-emerald-50 text-emerald-700", blue: "border-blue-500 bg-blue-50 text-blue-700", purple: "border-purple-500 bg-purple-50 text-purple-700", orange: "border-orange-500 bg-orange-50 text-orange-700" }
    return (
        <div onClick={() => onClick(id)} className={cn("cursor-pointer flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all h-20 hover:scale-105 active:scale-95", isSelected ? colors[color] : "bg-white border-transparent hover:bg-slate-50 text-slate-400")}>
            <Icon size={20} />
            <span className="text-[9px] font-black uppercase text-center leading-none">{label}</span>
        </div>
    )
}

function RateButton({ type, rate, active, onClick, icon, label }: any) {
    const isSelected = active === type;
    return (
        <button onClick={() => onClick(type)} className={cn("flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-16", isSelected ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20" : "border-slate-200 bg-white hover:bg-slate-50 text-slate-400")}>
            <div className="flex items-center gap-1 mb-1">{icon} <span className="text-[9px] font-black uppercase">{label || type}</span></div>
            <span className="text-xs font-bold">{rate.toFixed(2)}</span>
        </button>
    )
}