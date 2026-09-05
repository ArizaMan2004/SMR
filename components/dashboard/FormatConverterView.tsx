"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import {
    Upload, Download, X, ArrowRightLeft,
    CheckCircle2, RefreshCw, Settings2, ShieldCheck, ImagePlus,
    AlertCircle, Trash2, Images
} from "lucide-react"

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
import { cn } from "@/lib/utils"

type ItemStatus = "pending" | "converting" | "done" | "error"

interface ConvertItem {
    id: string
    file: File
    previewUrl: string
    status: ItemStatus
    convertedUrl?: string
    convertedFormat?: string
    convertedSize?: number
}

function formatBytes(bytes: number) {
    if (!bytes) return "0 KB"
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(0)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
}

function extFromMime(mime: string) {
    return mime.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg")
}

async function convertImageFile(file: File, previewUrl: string, targetFormat: string): Promise<{ dataUrl: string; size: number }> {
    const img = new Image()
    img.src = previewUrl
    await img.decode()

    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Error de contexto de canvas")

    // Si conviertes a JPG/BMP, ponemos fondo blanco para evitar fondos negros (no soportan transparencia)
    if (targetFormat === "image/jpeg" || targetFormat === "image/bmp") {
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.drawImage(img, 0, 0)

    const dataUrl = canvas.toDataURL(targetFormat, 0.95)
    const base64Length = (dataUrl.split(",")[1] || "").length
    const size = Math.round(base64Length * 0.75) // tamaño real aproximado del base64 decodificado

    return { dataUrl, size }
}

export function FormatConverterView() {
    const [queue, setQueue] = useState<ConvertItem[]>([])
    const [history, setHistory] = useState<ConvertItem[]>([])
    const [targetFormat, setTargetFormat] = useState<string>("image/png")
    const [isConverting, setIsConverting] = useState(false)
    const [isDragActive, setIsDragActive] = useState(false)

    const dragCounter = useRef(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const queueRef = useRef<ConvertItem[]>([])
    queueRef.current = queue

    const formats = [
        { label: "PNG (Transparente)", value: "image/png" },
        { label: "JPG (Fotografía)", value: "image/jpeg" },
        { label: "WEBP (Optimizado Web)", value: "image/webp" },
        { label: "AVIF (Alta Compresión)", value: "image/avif" },
        { label: "BMP (Mapa de bits)", value: "image/bmp" },
    ]

    // Libera los object URLs al desmontar la vista para no dejar memoria colgada
    useEffect(() => {
        return () => {
            queueRef.current.forEach(i => URL.revokeObjectURL(i.previewUrl))
        }
    }, [])

    const addFiles = useCallback((files: FileList | File[]) => {
        const arr = Array.from(files).filter(f => f.type.startsWith("image/"))
        if (arr.length === 0) {
            toast.error("Solo se admiten archivos de imagen")
            return
        }
        const newItems: ConvertItem[] = arr.map(f => ({
            id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file: f,
            previewUrl: URL.createObjectURL(f),
            status: "pending",
        }))
        setQueue(prev => [...prev, ...newItems])
        toast.success(`${arr.length} archivo${arr.length > 1 ? "s" : ""} agregado${arr.length > 1 ? "s" : ""} a la cola`)
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) addFiles(e.target.files)
        e.target.value = ""
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current = 0
        setIsDragActive(false)
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
    }

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current++
        setIsDragActive(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current--
        if (dragCounter.current <= 0) {
            dragCounter.current = 0
            setIsDragActive(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const removeFromQueue = (id: string) => {
        setQueue(prev => {
            const item = prev.find(i => i.id === id)
            if (item) URL.revokeObjectURL(item.previewUrl)
            return prev.filter(i => i.id !== id)
        })
    }

    const clearQueue = () => {
        queue.forEach(i => URL.revokeObjectURL(i.previewUrl))
        setQueue([])
    }

    const convertAll = async () => {
        const targets = queue.filter(i => i.status === "pending" || i.status === "error")
        if (targets.length === 0) return
        setIsConverting(true)

        for (const target of targets) {
            setQueue(prev => prev.map(i => i.id === target.id ? { ...i, status: "converting" } : i))
            try {
                const { dataUrl, size } = await convertImageFile(target.file, target.previewUrl, targetFormat)
                setQueue(prev => prev.map(i => i.id === target.id ? {
                    ...i, status: "done", convertedUrl: dataUrl, convertedFormat: targetFormat, convertedSize: size,
                } : i))
                setHistory(prev => [{
                    ...target, status: "done" as ItemStatus, convertedUrl: dataUrl, convertedFormat: targetFormat, convertedSize: size,
                }, ...prev].slice(0, 12))
            } catch (error) {
                console.error(error)
                setQueue(prev => prev.map(i => i.id === target.id ? { ...i, status: "error" } : i))
            }
        }

        setIsConverting(false)
        toast.success("Conversión completada")
    }

    const downloadItem = (item: ConvertItem) => {
        if (!item.convertedUrl || !item.convertedFormat) return
        const a = document.createElement("a")
        a.href = item.convertedUrl
        const baseName = item.file.name.replace(/\.[^/.]+$/, "")
        a.download = `${baseName}_SMR.${extFromMime(item.convertedFormat)}`
        a.click()
    }

    const downloadAllDone = () => {
        const done = queue.filter(i => i.status === "done")
        done.forEach((item, idx) => setTimeout(() => downloadItem(item), idx * 250))
    }

    const clearHistory = () => setHistory([])

    const pendingCount = queue.filter(i => i.status === "pending" || i.status === "error").length
    const doneCount = queue.filter(i => i.status === "done").length

    return (
        <div className="p-4 space-y-6 max-w-6xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter flex items-center gap-2 italic">
                    <ArrowRightLeft className="text-emerald-600 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Convertidor <span className="text-slate-300 hidden sm:inline">|</span> SMR
                </h2>
                {queue.length > 0 && (
                    <Badge variant="outline" className="font-bold border-2 self-start sm:self-auto">
                        {queue.length} en cola · {doneCount} listos
                    </Badge>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Zona de arrastre + cola de archivos */}
                <Card
                    onDrop={handleDrop}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    className={cn(
                        "lg:col-span-7 p-6 sm:p-8 border-2 border-dashed rounded-[2.5rem] min-h-[500px] flex flex-col relative shadow-inner overflow-hidden transition-colors duration-200",
                        isDragActive
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : "border-transparent bg-slate-100 dark:bg-slate-950"
                    )}
                >
                    {isDragActive && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm pointer-events-none">
                            <div className="text-center">
                                <Upload className="mx-auto mb-3 text-emerald-600 animate-bounce" size={48} />
                                <p className="font-black uppercase text-sm tracking-widest text-emerald-700 dark:text-emerald-400">Suelta para agregar</p>
                            </div>
                        </div>
                    )}

                    {queue.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div>
                                <Upload className="mx-auto mb-4 text-slate-300" size={56} />
                                <p className="font-black uppercase text-sm tracking-widest text-slate-400">Arrastra tus imágenes aquí</p>
                                <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wide">o haz clic para elegir · admite varios archivos a la vez</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-emerald-600 font-black text-[11px] uppercase tracking-widest hover:text-emerald-700">
                                    <ImagePlus size={16} /> Agregar más
                                </button>
                                <button onClick={clearQueue} className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:text-red-500">
                                    <Trash2 size={14} /> Vaciar cola
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
                                {queue.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm">
                                        <img src={item.previewUrl} className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-200 dark:bg-slate-800" alt={item.file.name} />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm truncate">{item.file.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{formatBytes(item.file.size)}</p>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1.5">
                                            {item.status === "pending" && <Badge variant="outline" className="text-[9px] font-black uppercase">Pendiente</Badge>}
                                            {item.status === "converting" && <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />}
                                            {item.status === "done" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                                            {item.status === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                                            {item.status === "done" && (
                                                <Button onClick={() => downloadItem(item)} variant="secondary" className="rounded-full h-9 w-9 p-0">
                                                    <Download size={15} />
                                                </Button>
                                            )}
                                            {item.status !== "converting" && (
                                                <Button onClick={() => removeFromQueue(item.id)} variant="ghost" className="rounded-full h-9 w-9 p-0 text-slate-400 hover:text-red-500">
                                                    <X size={15} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Controles */}
                <Card className="lg:col-span-5 p-6 sm:p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border-none shadow-2xl flex flex-col justify-between">
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

                        {queue.length > 0 && (
                            <Button
                                onClick={convertAll}
                                disabled={isConverting || pendingCount === 0}
                                className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black uppercase tracking-widest text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isConverting ? <RefreshCw className="animate-spin mr-3" /> : <RefreshCw className="mr-3" />}
                                {isConverting
                                    ? "Procesando..."
                                    : pendingCount > 0
                                        ? `Convertir ${pendingCount} archivo${pendingCount > 1 ? "s" : ""}`
                                        : "Todo convertido"}
                            </Button>
                        )}

                        {doneCount > 0 && (
                            <div className="pt-6 border-t space-y-4 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="text-emerald-500 w-6 h-6" />
                                        <span className="text-xs font-black uppercase">{doneCount} Listo{doneCount > 1 ? "s" : ""}</span>
                                    </div>
                                    <Badge className="bg-emerald-500 uppercase">{targetFormat.split("/")[1].replace("jpeg", "jpg")}</Badge>
                                </div>
                                <Button onClick={downloadAllDone} className="w-full h-20 bg-black text-white rounded-3xl font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl">
                                    <Download className="mr-3" /> Descargar Todo ({doneCount})
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t flex items-center gap-3">
                        <ShieldCheck className="text-emerald-600 w-5 h-5 shrink-0" />
                        <p className="text-[9px] text-slate-500 font-bold leading-tight uppercase">
                            Procesamiento 100% local en tu navegador. <br />
                            Tus imágenes nunca salen de este equipo.
                        </p>
                    </div>
                </Card>
            </div>

            {/* Historial de últimas conversiones */}
            {history.length > 0 && (
                <Card className="p-6 sm:p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border-none shadow-2xl space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Images className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-black uppercase text-sm tracking-widest">Últimas conversiones</h3>
                        </div>
                        <button onClick={clearHistory} className="flex items-center gap-1.5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500">
                            <Trash2 size={13} /> Limpiar
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {history.map(item => {
                            const delta = item.convertedSize && item.file.size
                                ? Math.round((1 - item.convertedSize / item.file.size) * 100)
                                : null
                            return (
                                <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 aspect-square shadow-sm">
                                    <img src={item.convertedUrl} className="w-full h-full object-cover" alt={item.file.name} />
                                    <button
                                        onClick={() => downloadItem(item)}
                                        className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                                    >
                                        <span className="rounded-full h-10 w-10 bg-white/90 flex items-center justify-center">
                                            <Download size={16} className="text-slate-900" />
                                        </span>
                                    </button>
                                    <Badge className="absolute top-1.5 right-1.5 bg-emerald-500 text-[8px] font-black uppercase px-1.5 py-0.5">
                                        {item.convertedFormat?.split("/")[1].replace("jpeg", "jpg")}
                                    </Badge>
                                    {delta !== null && (
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm px-2 py-1">
                                            <p className="text-[8px] font-black text-white uppercase truncate">
                                                {delta >= 0 ? `-${delta}%` : `+${Math.abs(delta)}%`}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </Card>
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />
        </div>
    )
}
