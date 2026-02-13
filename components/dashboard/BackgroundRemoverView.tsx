"use client"

import React, { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Wand2, Upload, Image as ImageIcon, Download, 
    RefreshCw, Layers, Sparkles, CheckCircle2, X 
} from "lucide-react"
import removeBackground from "@imgly/background-removal"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function BackgroundRemoverView() {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const [processTime, setProcessTime] = useState<number>(0)
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Manejar subida de archivo
    const handleFile = (file: File) => {
        if (!file.type.startsWith("image/")) return alert("Por favor sube una imagen válida")
        
        const url = URL.createObjectURL(file)
        setImageSrc(url)
        setProcessedImage(null) // Resetear resultado anterior
        setProcessTime(0)
    }

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(true)
    }

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0])
        }
    }

    // --- LA MAGIA: REMOVER FONDO ---
    const processImage = async () => {
        if (!imageSrc) return

        setIsProcessing(true)
        const startTime = Date.now()

        try {
            // Configuración del procesador
            const config = {
                progress: (key: string, current: number, total: number) => {
                    console.log(`Descargando modelo IA: ${current} of ${total}`)
                },
                debug: false,
                device: 'gpu', // Intenta usar GPU para velocidad
                model: 'medium' // 'small' (rápido) o 'medium' (mejor calidad)
            }

            // Ejecutar la IA
            const blob = await removeBackground(imageSrc, config)
            const url = URL.createObjectURL(blob)
            
            setProcessedImage(url)
            setProcessTime((Date.now() - startTime) / 1000)
        } catch (error) {
            console.error("Error al procesar:", error)
            alert("Ocurrió un error al procesar la imagen. Intenta con otra.")
        } finally {
            setIsProcessing(false)
        }
    }

    const downloadImage = () => {
        if (!processedImage) return
        const link = document.createElement("a")
        link.href = processedImage
        link.download = "imagen-sin-fondo-ia.png"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const reset = () => {
        setImageSrc(null)
        setProcessedImage(null)
    }

    return (
        <div className="space-y-8 p-2 font-sans pb-24 text-slate-800 dark:text-slate-100 animate-in fade-in duration-500">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-indigo-600" /> IA Tools <span className="text-slate-300">|</span> Studio
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Removedor de Fondos Inteligente</p>
                </div>
            </div>

            {/* MAIN AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[500px]">
                
                {/* 1. UPLOAD ZONE */}
                <Card className={cn(
                    "rounded-[2.5rem] border-2 border-dashed relative overflow-hidden flex flex-col justify-center items-center text-center transition-all duration-300",
                    dragActive ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e]",
                    imageSrc ? "border-solid border-transparent p-0" : "p-12 hover:border-slate-300"
                )}>
                    {!imageSrc ? (
                        <div 
                            className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                            <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-full mb-6">
                                <Upload className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-slate-700 dark:text-white">Sube o arrastra tu imagen</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Soporta JPG, PNG, WEBP</p>
                        </div>
                    ) : (
                        <div className="relative w-full h-full bg-[url('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fpng.pngtree.com%2Fpng-vector%2F20190405%2Fourmid%2Fpngtree-vector-transparency-grid-png-image_914522.jpg&f=1&nofb=1')] bg-repeat">
                            {/* IMAGEN ORIGINAL */}
                            <img src={imageSrc} alt="Original" className="w-full h-full object-contain relative z-10" />
                            
                            {/* CONTROLES OVERLAY */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
                                <Button onClick={reset} variant="secondary" className="rounded-xl shadow-lg font-bold uppercase text-xs h-10">
                                    <X className="w-4 h-4 mr-2"/> Cancelar
                                </Button>
                                {!processedImage && (
                                    <Button 
                                        onClick={processImage} 
                                        disabled={isProcessing}
                                        className="rounded-xl shadow-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs h-10"
                                    >
                                        {isProcessing ? (
                                            <><RefreshCw className="w-4 h-4 mr-2 animate-spin"/> Procesando...</>
                                        ) : (
                                            <><Wand2 className="w-4 h-4 mr-2"/> Eliminar Fondo</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </Card>

                {/* 2. RESULT ZONE */}
                <Card className="rounded-[2.5rem] bg-slate-50 dark:bg-[#1c1c1e] border-none shadow-inner relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-start">
                        <Badge variant="outline" className="bg-white/50 backdrop-blur-md border-none font-black uppercase text-[10px] tracking-widest">
                            Resultado
                        </Badge>
                        {processTime > 0 && (
                            <Badge className="bg-emerald-500 text-white border-none font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 mr-1"/> {processTime.toFixed(1)}s
                            </Badge>
                        )}
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8 bg-[url('https://t3.ftcdn.net/jpg/03/76/74/78/360_F_376747823_L8il80K6c1DkIOe5D6A7D3Z7z88le8fE.jpg')] bg-cover">
                        {isProcessing ? (
                            <div className="text-center">
                                <div className="relative w-24 h-24 mx-auto mb-4">
                                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                                    <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                                    <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse"/>
                                </div>
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-600 animate-pulse">La IA está trabajando...</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">Esto puede tomar unos segundos</p>
                            </div>
                        ) : processedImage ? (
                            <motion.img 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                src={processedImage} 
                                alt="Processed" 
                                className="max-w-full max-h-[400px] object-contain drop-shadow-2xl"
                            />
                        ) : (
                            <div className="text-center opacity-30">
                                <Layers className="w-20 h-20 mx-auto mb-4 text-slate-400"/>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Aquí aparecerá tu imagen PNG</p>
                            </div>
                        )}
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="p-6 bg-white dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
                        <Button 
                            onClick={downloadImage} 
                            disabled={!processedImage}
                            className={cn(
                                "w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all",
                                processedImage 
                                    ? "bg-black text-white hover:bg-slate-800 hover:scale-[1.02]" 
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            <Download className="w-5 h-5 mr-2" /> Descargar PNG
                        </Button>
                    </div>
                </Card>

            </div>

            {/* INFO SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-500/20">
                    <h4 className="font-black text-indigo-600 uppercase text-xs mb-2">01. Procesamiento Local</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Tus imágenes no se suben a la nube. La IA corre directamente en tu navegador usando WebAssembly. Privacidad 100%.
                    </p>
                </div>
                <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-500/20">
                    <h4 className="font-black text-emerald-600 uppercase text-xs mb-2">02. Calidad de Impresión</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        El resultado es un archivo PNG con canal alfa (transparencia) listo para importar en CorelDRAW o Illustrator.
                    </p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                    <h4 className="font-black text-slate-600 uppercase text-xs mb-2">03. Sin Límites</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Al ser una herramienta interna, no tienes límites de "créditos" diarios. Úsala cuantas veces necesites.
                    </p>
                </div>
            </div>
        </div>
    )
}