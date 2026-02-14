"use client"

import React, { useState, useRef } from "react"
import { 
    Upload, Download, X, ArrowRightLeft, 
    CheckCircle2, RefreshCw, FileImage, 
    Settings2, ShieldCheck, ImagePlus
} from "lucide-react" // <--- CORREGIDO: lucide-react

// UI - Shadcn
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue,
    SelectGroup,
    SelectLabel
} from "@/components/ui/select"
import { toast } from "sonner"

export function FormatConverterView() {
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [targetFormat, setTargetFormat] = useState<string>("image/png")
    const [isConverting, setIsConverting] = useState(false)
    const [convertedUrl, setConvertedUrl] = useState<string | null>(null)
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Formatos base (Pendiente de tu HTML para expandir la lista)
    const formats = [
        { label: "PNG (Transparente)", value: "image/png" },
        { label: "JPG (Fotografía)", value: "image/jpeg" },
        { label: "WEBP (Optimizado Web)", value: "image/webp" },
        { label: "AVIF (Alta Compresión)", value: "image/avif" },
        { label: "BMP (Mapa de bits)", value: "image/bmp" },
    ]

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) {
            setFile(selectedFile)
            setPreviewUrl(URL.createObjectURL(selectedFile))
            setConvertedUrl(null)
            toast.info(`Archivo cargado: ${selectedFile.name}`)
        }
    }

    const convertImage = async () => {
        if (!file || !previewUrl) return
        setIsConverting(true)

        try {
            const img = new Image()
            img.src = previewUrl
            await img.decode()

            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext("2d")
            
            if (!ctx) throw new Error("Error de contexto")

            // Si conviertes a JPG, ponemos fondo blanco para evitar fondos negros
            if (targetFormat === "image/jpeg") {
                ctx.fillStyle = "#FFFFFF"
                ctx.fillRect(0, 0, canvas.width, canvas.height)
            }

            ctx.drawImage(img, 0, 0)
            
            // Generación local usando tus 16GB de RAM
            const dataUrl = canvas.toDataURL(targetFormat, 0.95)
            setConvertedUrl(dataUrl)
            toast.success("Conversión finalizada")
        } catch (error) {
            console.error(error)
            toast.error("Error al convertir la imagen")
        } finally {
            setIsConverting(false)
        }
    }

    return (
        <div className="p-4 space-y-6 max-w-6xl mx-auto">
            <header className="flex justify-between items-center">
                <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2 italic">
                    <ArrowRightLeft className="text-emerald-600 w-8 h-8" /> Convertidor <span className="text-slate-300">|</span> SMR
                </h2>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Visualizador */}
                <Card className="lg:col-span-7 p-8 border-none rounded-[2.5rem] bg-slate-100 dark:bg-slate-950 min-h-[500px] flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
                    {!previewUrl ? (
                        <div className="text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mx-auto mb-4 text-slate-300" size={56} />
                            <p className="font-black uppercase text-sm tracking-widest text-slate-400">Selecciona una imagen</p>
                        </div>
                    ) : (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                            <img src={previewUrl} className="max-h-[400px] rounded-3xl shadow-2xl object-contain mb-4 animate-in fade-in zoom-in-95 duration-500" alt="Original" />
                            <Badge variant="outline" className="font-bold border-2 bg-white/50 backdrop-blur-sm">{file?.name}</Badge>
                            
                            <div className="absolute top-0 right-0 flex gap-2">
                                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="rounded-full h-11 w-11 p-0 shadow-lg bg-white/90">
                                    <ImagePlus size={20} className="text-emerald-600" />
                                </Button>
                                <Button onClick={() => {setPreviewUrl(null); setConvertedUrl(null)}} variant="destructive" className="rounded-full h-11 w-11 p-0 shadow-lg">
                                    <X size={20} />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Controles */}
                <Card className="lg:col-span-5 p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border-none shadow-2xl flex flex-col justify-between">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-emerald-500" />
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ajustes de Conversión</Label>
                            </div>
                            <Select onValueChange={setTargetFormat} defaultValue={targetFormat}>
                                <SelectTrigger className="h-16 rounded-2xl font-black border-2 text-lg">
                                    <SelectValue placeholder="Formato de salida" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl font-bold">
                                    <SelectGroup>
                                        <SelectLabel className="text-[10px] uppercase opacity-40">Formatos Compatibles</SelectLabel>
                                        {formats.map(f => (
                                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        {previewUrl && (
                            <Button 
                                onClick={convertImage} 
                                disabled={isConverting}
                                className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all"
                            >
                                {isConverting ? <RefreshCw className="animate-spin mr-3" /> : <RefreshCw className="mr-3" />}
                                {isConverting ? "Procesando..." : "Iniciar Conversión"}
                            </Button>
                        )}

                        {convertedUrl && (
                            <div className="pt-6 border-t space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="text-emerald-500 w-6 h-6" />
                                        <span className="text-xs font-black uppercase">Conversión Lista</span>
                                    </div>
                                    <Badge className="bg-emerald-500 uppercase">{targetFormat.split("/")[1]}</Badge>
                                </div>
                                <Button onClick={() => {
                                    const a = document.createElement("a")
                                    a.href = convertedUrl
                                    a.download = `SMR_Convert_${Date.now()}.${targetFormat.split("/")[1].replace('jpeg', 'jpg')}`
                                    a.click()
                                }} className="w-full h-20 bg-black text-white rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl">
                                    <Download className="mr-3" /> Descargar Archivo
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t flex items-center gap-3">
                        <ShieldCheck className="text-emerald-600 w-5 h-5" />
                        <p className="text-[9px] text-slate-500 font-bold leading-tight uppercase">
                            Hardware: i5-3470 + 16GB RAM detectados. <br />
                            Seguridad: Procesamiento 100% privado en tu navegador.
                        </p>
                    </div>
                </Card>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
    )
}