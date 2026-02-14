"use client"

import React, { useState, useRef, useEffect } from "react"
import { 
    Upload, Download, RefreshCw, Sparkles, 
    X, Maximize2, ArrowLeftRight, Search, ZoomIn,
    ShieldCheck, Zap, ImagePlus
} from "lucide-react"

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import Upscaler from "upscaler"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function UpscaleView() {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState("") 
    const [progress, setProgress] = useState(0)
    const [scaleFactor, setScaleFactor] = useState<2 | 4>(2)
    const [sliderPos, setSliderPos] = useState(50)
    const [useCPU, setUseCPU] = useState(false)
    
    const [showMagnifier, setShowMagnifier] = useState(false)
    const [[x, y], setXY] = useState([0, 0])
    const [[imgWidth, imgHeight], setSize] = useState([0, 0])
    const [processedSize, setProcessedSize] = useState<{w: number, h: number} | null>(null)
    
    const upscalerRef = useRef<Upscaler | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Inicialización del motor
    useEffect(() => {
        const initAI = async () => {
            try {
                await tf.ready();
                const backend = useCPU ? 'cpu' : 'webgl';
                if (tf.findBackend(backend)) await tf.setBackend(backend);
                upscalerRef.current = new Upscaler();
            } catch (err) {
                console.error("Error en IA:", err);
            }
        };
        initAI();
    }, [useCPU]) 

    // Resetear proceso al cambiar de escala para permitir re-procesar
    const handleScaleChange = (factor: 2 | 4) => {
        setScaleFactor(factor);
        setProcessedImage(null); // Esto desbloquea el botón de "Mejorar"
        setProcessedSize(null);
    };

    const resetAll = () => {
        setImageSrc(null);
        setProcessedImage(null);
        setProcessedSize(null);
        setProgress(0);
        setIsProcessing(false);
    };

    const processImage = async () => {
        if (!imageSrc || !upscalerRef.current) return;
        setIsProcessing(true);
        setProgress(0);

        try {
            const imgElement = new Image();
            imgElement.src = imageSrc;
            await imgElement.decode(); 

            const options = {
                patchSize: 64,
                padding: 2,
                progress: (amount: number) => setProgress(Math.round(amount * 100))
            };

            setLoadingMessage(scaleFactor === 4 ? "Escalando (Paso 1/2)..." : "Mejorando resolución...");
            let result = await upscalerRef.current.upscale(imgElement, options);

            if (scaleFactor === 4) {
                setLoadingMessage("Refinando (Paso 2/2)...");
                const nextImg = new Image();
                nextImg.src = result;
                await nextImg.decode();
                result = await upscalerRef.current.upscale(nextImg, options);
            }
            
            setProcessedImage(result);
            const finalImg = new Image();
            finalImg.onload = () => setProcessedSize({ w: finalImg.width, h: finalImg.height });
            finalImg.src = result;
            toast.success("¡Imagen completada!");
        } catch (error) {
            toast.error("Error de procesamiento.");
        } finally {
            setIsProcessing(false);
            setLoadingMessage("");
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const { left, top, width, height } = containerRef.current.getBoundingClientRect();
        const mouseX = e.pageX - left - window.scrollX;
        const mouseY = e.pageY - top - window.scrollY;

        if (!showMagnifier) {
            const position = (mouseX / width) * 100;
            setSliderPos(Math.min(Math.max(position, 0), 100));
        }
        setXY([mouseX, mouseY]);
        setSize([width, height]);
    };

    return (
        <div className="p-4 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2 italic">
                    <Maximize2 className="text-blue-600 w-8 h-8" /> SMR UPSCALER <span className="text-slate-300">|</span> HD
                </h2>
                <div className="flex items-center gap-4 bg-white dark:bg-white/5 p-2 px-4 rounded-full border border-slate-200">
                    <div className="flex items-center gap-2">
                        <Switch checked={showMagnifier} onCheckedChange={setShowMagnifier} id="zoom-mode" />
                        <Label htmlFor="zoom-mode" className="text-[10px] font-black uppercase cursor-pointer">Lupa</Label>
                    </div>
                    <div className="w-px h-4 bg-slate-300" />
                    <div className="flex items-center gap-2">
                        <Switch checked={useCPU} onCheckedChange={setUseCPU} id="safe-mode" />
                        <Label htmlFor="safe-mode" className="text-[10px] font-black uppercase italic text-blue-600">Safe Mode</Label>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Visor */}
                <Card className="lg:col-span-8 overflow-hidden bg-slate-100 dark:bg-slate-950 border-none rounded-[2.5rem] relative min-h-[550px] flex items-center justify-center">
                    {!imageSrc ? (
                        <div className="text-center cursor-pointer p-20 w-full" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mx-auto mb-4 text-slate-300" size={64} />
                            <p className="font-black uppercase text-sm tracking-widest text-slate-400">Sube imagen para escalar</p>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && setImageSrc(URL.createObjectURL(e.target.files[0]))} />
                        </div>
                    ) : (
                        <div ref={containerRef} className="relative w-full h-full cursor-crosshair overflow-hidden flex items-center justify-center p-4" onMouseMove={handleMouseMove}>
                            <img src={imageSrc} className="max-h-[600px] w-auto object-contain select-none rounded-lg" alt="Original" />

                            {processedImage && !showMagnifier && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                                    <img src={processedImage} className="max-h-[600px] w-auto object-contain select-none rounded-lg" alt="HD" />
                                </div>
                            )}

                            {processedImage && !showMagnifier && (
                                <div className="absolute top-0 bottom-0 w-1 bg-white shadow-xl z-10" style={{ left: `${sliderPos}%` }}>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-blue-600">
                                        <ArrowLeftRight className="text-blue-600 w-5 h-5" />
                                    </div>
                                </div>
                            )}

                            {processedImage && showMagnifier && (
                                <div className="pointer-events-none absolute border-4 border-white rounded-full shadow-2xl z-50 overflow-hidden"
                                    style={{
                                        width: "250px", height: "250px", top: `${y - 125}px`, left: `${x - 125}px`,
                                        backgroundImage: `url(${processedImage})`, backgroundRepeat: "no-repeat",
                                        backgroundSize: `${imgWidth * 2.5}px ${imgHeight * 2.5}px`,
                                        backgroundPosition: `${-x * 2.5 + 125}px ${-y * 2.5 + 125}px`
                                    }}
                                />
                            )}

                            <div className="absolute top-4 right-4 flex gap-2">
                                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="rounded-full h-12 w-12 p-0 shadow-xl bg-white/90 hover:bg-white text-blue-600">
                                    <ImagePlus size={20} />
                                </Button>
                                <Button onClick={resetAll} variant="destructive" className="rounded-full h-12 w-12 p-0 shadow-xl">
                                    <X size={20} />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Controles */}
                <Card className="lg:col-span-4 p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border-none flex flex-col justify-between shadow-2xl">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ajustes de Escala</Label>
                            <div className="flex gap-3">
                                {[2, 4].map((num) => (
                                    <Button key={num} onClick={() => handleScaleChange(num as 2 | 4)} variant={scaleFactor === num ? "default" : "outline"} className={cn("flex-1 h-14 font-black rounded-2xl", scaleFactor === num && "bg-blue-600 shadow-lg shadow-blue-200")}>
                                        x{num} {num === 4 ? 'ULTRA' : 'FAST'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        
                        {/* El botón ahora aparece si hay imagen original, esté o no procesada */}
                        {imageSrc && (
                            <Button onClick={processImage} disabled={isProcessing} className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black uppercase tracking-widest text-lg shadow-xl">
                                {isProcessing ? <RefreshCw className="animate-spin mr-3" /> : <Zap className="mr-3 fill-white" />}
                                {processedImage ? "Volver a Escalar" : "Mejorar Imagen"}
                            </Button>
                        )}

                        {processedImage && !isProcessing && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <Badge className="w-full justify-center py-3 bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-black uppercase">
                                    Listo: {processedSize?.w} x {processedSize?.h} PX
                                </Badge>
                                <Button onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = processedImage;
                                    a.download = `SMR_x${scaleFactor}.png`;
                                    a.click();
                                }} className="w-full h-20 bg-black text-white rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl">
                                    <Download className="mr-3" /> Descargar PNG
                                </Button>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="space-y-3 pt-4">
                                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-blue-600 uppercase animate-pulse">{loadingMessage}</span>
                                    <span className="text-[10px] font-black text-slate-400">{progress}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="text-emerald-500 w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Seguridad GTX</span>
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium leading-relaxed uppercase">
                            Configuración de bloques activa. Puedes cambiar de escala o imagen en cualquier momento.
                        </p>
                    </div>
                </Card>
            </div>
            {/* Input oculto para cambio rápido */}
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && setImageSrc(URL.createObjectURL(e.target.files[0]))} />
        </div>
    );
}