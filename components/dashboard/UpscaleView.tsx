"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
    Upload, Download, RefreshCw,
    X, Maximize2, ArrowLeftRight,
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

// Detección simple de móvil (UA + ancho). En móvil bajamos exigencia para evitar crashes de GPU.
const isMobileDevice = () =>
    typeof window !== "undefined" &&
    (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);

// Lado máximo de la imagen de ENTRADA antes de escalar. Escalar imágenes grandes en WebGL
// es la causa #1 de cuelgues por falta de memoria. Capamos según el dispositivo.
const MAX_INPUT_SIDE_DESKTOP = 1500;
const MAX_INPUT_SIDE_MOBILE = 768;

// Carga una imagen y, si excede maxSide, la reduce con canvas. Devuelve un <img> ya decodificado.
async function loadCappedImage(src: string, maxSide: number): Promise<{ img: HTMLImageElement; wasCapped: boolean }> {
    const img = new Image();
    img.src = src;
    await img.decode();
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest <= maxSide) return { img, wasCapped: false };

    const scale = maxSide / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { img, wasCapped: false };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const capped = new Image();
    capped.src = canvas.toDataURL("image/png");
    await capped.decode();
    return { img: capped, wasCapped: true };
}

export function UpscaleView() {
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState("")
    const [progress, setProgress] = useState(0)
    const [scaleFactor, setScaleFactor] = useState<2 | 4>(2)
    const [sliderPos, setSliderPos] = useState(50)
    const [useCPU, setUseCPU] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    const [showMagnifier, setShowMagnifier] = useState(false)
    const [[x, y], setXY] = useState([0, 0])
    const [[imgWidth, imgHeight], setSize] = useState([0, 0])
    const [processedSize, setProcessedSize] = useState<{ w: number, h: number } | null>(null)

    const upscalerRef = useRef<Upscaler | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const objectUrlRef = useRef<string | null>(null) // para revocar y no fugar memoria

    useEffect(() => { setIsMobile(isMobileDevice()) }, [])

    // En móvil no permitimos x4 (dobla el uso de memoria y cuelga en GPUs débiles).
    useEffect(() => {
        if (isMobile && scaleFactor === 4) setScaleFactor(2);
    }, [isMobile, scaleFactor])

    // Inicialización del motor (y reinicio si cambia Safe Mode). Liberamos el motor previo.
    useEffect(() => {
        let cancelled = false;
        const initAI = async () => {
            try {
                await tf.ready();
                const backend = useCPU ? 'cpu' : 'webgl';

                // Flags que reducen el consumo de memoria de GPU (clave en equipos modestos / móvil).
                if (!useCPU) {
                    try {
                        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);     // texturas a 16-bit = ~mitad de memoria
                        tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);  // libera texturas de inmediato
                        tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);           // descarga trabajo a la GPU más seguido
                    } catch { /* flags no soportados: continuar */ }
                }

                if (tf.findBackend(backend)) await tf.setBackend(backend);
                await tf.ready();

                // Liberar instancia anterior antes de crear una nueva.
                try { await upscalerRef.current?.dispose?.(); } catch { /* noop */ }
                if (!cancelled) upscalerRef.current = new Upscaler();
            } catch (err) {
                console.error("Error inicializando el motor de IA:", err);
            }
        };
        initAI();
        return () => { cancelled = true; };
    }, [useCPU])

    // Limpieza de object URLs al desmontar.
    useEffect(() => {
        return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
    }, [])

    const setImageFromFile = (file?: File | null) => {
        if (!file) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        setImageSrc(url);
        setProcessedImage(null);
        setProcessedSize(null);
        setProgress(0);
    };

    const handleScaleChange = (factor: 2 | 4) => {
        setScaleFactor(factor);
        setProcessedImage(null);
        setProcessedSize(null);
    };

    const resetAll = () => {
        if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
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

        const maxSide = (useCPU || isMobile) ? MAX_INPUT_SIDE_MOBILE : MAX_INPUT_SIDE_DESKTOP;

        try {
            const { img: sourceImg, wasCapped } = await loadCappedImage(imageSrc, maxSide);
            if (wasCapped) {
                toast.info(`Imagen ajustada a ${sourceImg.naturalWidth}×${sourceImg.naturalHeight} px para un escalado estable.`);
            }

            const patchSize = isMobile ? 32 : 64;
            const doublePass = scaleFactor === 4 && !isMobile;

            const baseOptions = {
                patchSize,
                padding: 2,
                progress: (amount: number) =>
                    setProgress(Math.round((doublePass ? amount * 50 : amount * 100))),
            };

            setLoadingMessage(doublePass ? "Escalando (Paso 1/2)..." : "Mejorando resolución...");
            let result = await upscalerRef.current.upscale(sourceImg, baseOptions);

            if (doublePass) {
                await tf.nextFrame(); // deja que la GPU descargue antes de la 2ª pasada
                setLoadingMessage("Refinando (Paso 2/2)...");
                const nextImg = new Image();
                nextImg.src = result;
                await nextImg.decode();
                result = await upscalerRef.current.upscale(nextImg, {
                    ...baseOptions,
                    progress: (amount: number) => setProgress(Math.round(50 + amount * 50)),
                });
            }

            setProcessedImage(result);
            const finalImg = new Image();
            finalImg.onload = () => setProcessedSize({ w: finalImg.width, h: finalImg.height });
            finalImg.src = result;
            setProgress(100);
            toast.success("¡Imagen completada!");
        } catch (error: any) {
            console.error("Error de escalado:", error);
            const msg = String(error?.message || error || "").toLowerCase();
            const isMemory = msg.includes("texture") || msg.includes("memory") || msg.includes("out of") || msg.includes("webgl");
            if (isMemory) {
                toast.error("La imagen es muy pesada para la GPU. Activa 'Safe Mode' o usa escala x2 con una imagen más pequeña.");
                if (!useCPU) setUseCPU(true); // cae automáticamente a CPU para el próximo intento
            } else {
                toast.error("Error de procesamiento. Intenta de nuevo.");
            }
        } finally {
            setIsProcessing(false);
            setLoadingMessage("");
        }
    };

    // Movimiento unificado mouse + táctil (pointer events) para el comparador y la lupa.
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!containerRef.current || !processedImage) return;
        const { left, top, width, height } = containerRef.current.getBoundingClientRect();
        const px = e.clientX - left;
        const py = e.clientY - top;
        if (!showMagnifier) {
            const position = (px / width) * 100;
            setSliderPos(Math.min(Math.max(position, 0), 100));
        }
        setXY([px, py]);
        setSize([width, height]);
    }, [processedImage, showMagnifier]);

    return (
        <div className="p-3 sm:p-4 space-y-6 max-w-7xl mx-auto pb-24">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter flex items-center gap-2 italic">
                    <Maximize2 className="text-blue-600 w-6 h-6 sm:w-8 sm:h-8" /> SMR UPSCALER <span className="text-slate-300">|</span> HD
                </h2>
                <div className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-white/5 p-2 px-4 rounded-full border border-slate-200 dark:border-white/10 self-start sm:self-auto">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Visor */}
                <Card className="lg:col-span-8 overflow-hidden bg-slate-100 dark:bg-slate-950 border-none rounded-[2rem] sm:rounded-[2.5rem] relative min-h-[340px] sm:min-h-[550px] flex items-center justify-center">
                    {!imageSrc ? (
                        <div className="text-center cursor-pointer p-12 sm:p-20 w-full" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mx-auto mb-4 text-slate-300" size={56} />
                            <p className="font-black uppercase text-sm tracking-widest text-slate-400">Sube imagen para escalar</p>
                        </div>
                    ) : (
                        <div
                            ref={containerRef}
                            className="relative w-full h-full cursor-crosshair overflow-hidden flex items-center justify-center p-3 sm:p-4 select-none"
                            style={{ touchAction: "none" }}
                            onPointerMove={handlePointerMove}
                        >
                            <img src={imageSrc} className="max-h-[420px] sm:max-h-[600px] w-auto object-contain select-none rounded-lg pointer-events-none" alt="Original" />

                            {processedImage && !showMagnifier && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3 sm:p-4" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
                                    <img src={processedImage} className="max-h-[420px] sm:max-h-[600px] w-auto object-contain select-none rounded-lg" alt="HD" />
                                </div>
                            )}

                            {processedImage && !showMagnifier && (
                                <div className="absolute top-0 bottom-0 w-1 bg-white shadow-xl z-10 pointer-events-none" style={{ left: `${sliderPos}%` }}>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-blue-600">
                                        <ArrowLeftRight className="text-blue-600 w-5 h-5" />
                                    </div>
                                </div>
                            )}

                            {processedImage && showMagnifier && (
                                <div className="pointer-events-none absolute border-4 border-white rounded-full shadow-2xl z-50 overflow-hidden"
                                    style={{
                                        width: "220px", height: "220px", top: `${y - 110}px`, left: `${x - 110}px`,
                                        backgroundImage: `url(${processedImage})`, backgroundRepeat: "no-repeat",
                                        backgroundSize: `${imgWidth * 2.5}px ${imgHeight * 2.5}px`,
                                        backgroundPosition: `${-x * 2.5 + 110}px ${-y * 2.5 + 110}px`
                                    }}
                                />
                            )}

                            <div className="absolute top-4 right-4 flex gap-2">
                                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="rounded-full h-11 w-11 sm:h-12 sm:w-12 p-0 shadow-xl bg-white/90 hover:bg-white text-blue-600">
                                    <ImagePlus size={20} />
                                </Button>
                                <Button onClick={resetAll} variant="destructive" className="rounded-full h-11 w-11 sm:h-12 sm:w-12 p-0 shadow-xl">
                                    <X size={20} />
                                </Button>
                            </div>

                            {processedImage && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                                    Desliza para comparar
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Controles */}
                <Card className="lg:col-span-4 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] bg-white dark:bg-slate-900 border-none flex flex-col justify-between shadow-2xl">
                    <div className="space-y-6 sm:space-y-8">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ajustes de Escala</Label>
                            <div className="flex gap-3">
                                {[2, 4].map((num) => {
                                    const disabled = isMobile && num === 4;
                                    return (
                                        <Button
                                            key={num}
                                            onClick={() => !disabled && handleScaleChange(num as 2 | 4)}
                                            disabled={disabled}
                                            variant={scaleFactor === num ? "default" : "outline"}
                                            className={cn("flex-1 h-14 font-black rounded-2xl", scaleFactor === num && "bg-blue-600 shadow-lg shadow-blue-200", disabled && "opacity-40")}
                                            title={disabled ? "x4 no disponible en móvil (memoria limitada)" : ""}
                                        >
                                            x{num} {num === 4 ? 'ULTRA' : 'FAST'}
                                        </Button>
                                    );
                                })}
                            </div>
                            {isMobile && (
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">En móvil se usa x2 para evitar cuelgues por memoria.</p>
                            )}
                        </div>

                        {imageSrc && (
                            <Button onClick={processImage} disabled={isProcessing} className="w-full h-16 sm:h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black uppercase tracking-widest text-base sm:text-lg shadow-xl active:scale-95 transition-transform">
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
                                }} className="w-full h-16 sm:h-20 bg-black text-white rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl active:scale-95 transition-transform">
                                    <Download className="mr-3" /> Descargar PNG
                                </Button>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="space-y-3 pt-4">
                                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-blue-600 uppercase animate-pulse">{loadingMessage}</span>
                                    <span className="text-[10px] font-black text-slate-400">{progress}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 sm:mt-8 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="text-emerald-500 w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Estabilidad</span>
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium leading-relaxed uppercase">
                            Las imágenes grandes se ajustan automáticamente para no saturar la memoria. Si se cuelga, activa Safe Mode (procesa en CPU, más lento pero estable).
                        </p>
                    </div>
                </Card>
            </div>

            {/* Input oculto (único) para subir / cambiar imagen */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => setImageFromFile(e.target.files?.[0])}
            />
        </div>
    );
}
