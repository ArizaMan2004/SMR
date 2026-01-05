"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
// Componentes de UI
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription // Añadido para accesibilidad completa
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input" 
import { Label } from "@/components/ui/label" 
import { Card } from "@/components/ui/card"
// Iconos
import { 
  ChevronLeft, ChevronRight, X, Loader2, Upload, AlertCircle, 
  CheckCircle2, Save, Send, Trash2, Info, User, Hash, 
  Calendar, Box, Layers, Maximize, Clock
} from 'lucide-react'
import { cn } from "@/lib/utils"

// --- SERVICIOS ORIGINALES (SIN TOCAR) ---
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "@/lib/services/cloudinary-service"
import { saveTaskNote, markItemAsReviewed, deleteTaskImage } from "@/lib/services/task-actions-service"

type EstadoOrden = "PENDIENTE" | "EN_PROGRESO" | "TERMINADO"
const EstadoOrdenObj = { TERMINADO: "TERMINADO" as EstadoOrden }

const formatTimeForDisplay = (timeValue: string | undefined): string => {
    if (!timeValue) return "00:00"
    const parts = timeValue.split(':')
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10)
        const seconds = parseInt(parts[1], 10)
        if (!isNaN(minutes) && !isNaN(seconds)) {
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        }
    }
    return timeValue.trim() || "00:00"
}

// --- CARRUSEL REUSABLE (ESTILO IOS GALLERY) ---
const ImageCarousel: React.FC<any> = ({
    title, images, onUpload, onDelete, isSaving, isUploading, uploadError, fieldName
}) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const hasImages = images.length > 0
    const currentImageUrl = hasImages ? images[currentImageIndex] : null

    useEffect(() => { setCurrentImageIndex(0) }, [images])

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{title}</h4>
                {hasImages && (
                    <span className="text-[10px] font-bold opacity-40 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                        {currentImageIndex + 1} / {images.length}
                    </span>
                )}
            </div>
            
            <Card className="relative aspect-video overflow-hidden rounded-[2rem] border-black/5 dark:border-white/5 bg-slate-100 dark:bg-white/5 shadow-inner">
                <AnimatePresence mode="wait">
                    {hasImages ? (
                        <motion.img 
                            key={currentImageUrl}
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            src={currentImageUrl}
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => setIsImagePreviewOpen(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center opacity-30">
                            <Upload className="w-8 h-8 mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Sin fotos adjuntas</p>
                        </div>
                    )}
                </AnimatePresence>

                {hasImages && images.length > 1 && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentImageIndex(i => i === 0 ? images.length-1 : i-1)} className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md shadow-lg"><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentImageIndex(i => i === images.length-1 ? 0 : i+1)} className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md shadow-lg"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                )}
                
                {hasImages && !isSaving && (
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => onDelete(currentImageUrl, fieldName)}
                        className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-red-500/80 text-white shadow-lg hover:bg-red-600"
                        disabled={isSaving}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </Card>

            <div className="relative">
                <Input type="file" ref={fileInputRef} onChange={(e) => onUpload(e, fieldName)} className="hidden" accept="image/*, application/pdf" />
                <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    variant="secondary"
                    className="w-full h-12 rounded-2xl bg-white/50 dark:bg-white/5 border-black/5 hover:bg-white dark:hover:bg-white/10 font-bold text-[11px] uppercase tracking-widest"
                >
                    {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo...</> : <><Upload className="mr-2 h-4 w-4" /> Añadir archivo</>}
                </Button>
            </div>
            {uploadError && <p className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {uploadError}</p>}
        </div>
    )
}

// --- MODAL PRINCIPAL ---
export default function TaskDetailModal({ item, orden, isOpen, onClose, onUpdate }: any) {
  const [areaNote, setAreaNote] = useState(item.areaNote || "")
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [detalleImages, setDetalleImages] = useState(item.imagenes || [])
  const [pruebaImages, setPruebaImages] = useState(item.pruebasImagenes || [])

  useEffect(() => {
    if (isOpen) {
      setUploadError(null)
      setActionMessage(null)
      setAreaNote(item.areaNote || "")
    }
    setDetalleImages(item.imagenes || [])
    setPruebaImages(item.pruebasImagenes || [])
  }, [isOpen, item])

  // Handlers (Lógica original completa)
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'imagenes' | 'pruebasImagenes') => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true); setUploadError(null)
    const currentImages = fieldName === 'imagenes' ? detalleImages : pruebaImages
    try {
      const newImageUrl = await uploadFileToCloudinary(file)
      const updatedImages = [...currentImages, newImageUrl]
      await saveTaskNote(orden.id, item.nombre, updatedImages, fieldName)
      if (fieldName === 'imagenes') setDetalleImages(updatedImages)
      else setPruebaImages(updatedImages)
    } catch (err: any) { setUploadError(err.message || "Error de subida") }
    finally { setIsUploading(false); if (e.target) e.target.value = "" }
  }

  const handleDeleteImage = async (imageUrlToDelete: string, fieldName: 'imagenes' | 'pruebasImagenes') => {
    setIsSaving(true)
    const currentImages = fieldName === 'imagenes' ? detalleImages : pruebaImages
    try {
      await deleteTaskImage(orden.id, item.nombre, imageUrlToDelete, fieldName)
      const newImagesArray = currentImages.filter(url => url !== imageUrlToDelete)
      if (fieldName === 'imagenes') setDetalleImages(newImagesArray)
      else setPruebaImages(newImagesArray)
      setActionMessage("Imagen eliminada.")
    } catch (err: any) { setActionMessage("Error al eliminar.") }
    finally { setIsSaving(false) }
  }

  const handleSaveNote = async () => {
    if (areaNote === (item.areaNote || "")) return
    setIsSaving(true)
    try {
      await saveTaskNote(orden.id, item.nombre, areaNote, 'areaNote')
      setActionMessage("Notas guardadas.")
    } catch (err: any) { setActionMessage("Error al guardar.") }
    finally { setIsSaving(false) }
  }

  const handleMarkReviewed = async () => {
    setIsSaving(true)
    try {
      await markItemAsReviewed(orden.id, item.nombre, EstadoOrdenObj.TERMINADO)
      onUpdate?.(); onClose()
    } catch (err: any) { setActionMessage("Error al finalizar.") }
    finally { setIsSaving(false) }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[92vh] overflow-hidden p-0 rounded-[2.5rem] border-none bg-white/80 dark:bg-slate-950/80 backdrop-blur-3xl shadow-2xl">
        
        {/* CORRECCIÓN DE ACCESIBILIDAD: DialogHeader con DialogTitle */}
        <DialogHeader className="px-8 pt-8 pb-4 flex-row justify-between items-start sticky top-0 bg-transparent z-10 space-y-0">
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                {item.nombre}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalles técnicos y gestión de producción para el ítem seleccionado.</DialogDescription>
            <div className="flex items-center gap-3">
               <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-lg shadow-blue-500/20">
                 <Hash className="w-2.5 h-2.5" /> {orden.ordenNumero}
               </span>
               <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Dpto: {item.tipoServicio || "General"}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-black/5 dark:bg-white/10 h-10 w-10">
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className="px-8 pb-8 overflow-y-auto max-h-[calc(92vh-140px)] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-7 space-y-8">
              <ImageCarousel title="1. Detalles e Instrucciones (Admin)" images={detalleImages} onUpload={handleUploadFile} onDelete={handleDeleteImage} isSaving={isSaving} isUploading={isUploading} fieldName="imagenes" />
              <ImageCarousel title="2. Pruebas de Trabajo (Avance)" images={pruebaImages} onUpload={handleUploadFile} onDelete={handleDeleteImage} isSaving={isSaving} isUploading={isUploading} fieldName="pruebasImagenes" />

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Notas específicas del área</h4>
                <div className="relative group">
                    <Textarea
                        value={areaNote}
                        onChange={(e) => setAreaNote(e.target.value)}
                        className="min-h-32 rounded-[1.8rem] bg-slate-100/50 dark:bg-white/5 border-black/5 focus:ring-4 ring-blue-500/10 transition-all resize-none p-5 text-sm font-medium"
                        placeholder="Escribe detalles técnicos aquí..."
                    />
                    <Button 
                        size="sm"
                        onClick={handleSaveNote}
                        disabled={isSaving || areaNote === (item.areaNote || "")}
                        className="absolute bottom-3 right-3 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 font-bold text-[10px] uppercase px-4 h-8"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-3 w-3" /> : <><Save className="w-3 h-3 mr-2" /> Guardar Notas</>}
                    </Button>
                </div>
                {actionMessage && <p className={cn("text-[10px] font-bold uppercase", actionMessage.includes("Error") ? "text-red-500" : "text-emerald-500")}>{actionMessage}</p>}
              </div>
            </div>

            <div className="md:col-span-5 space-y-6">
              <div className="p-6 rounded-[2rem] bg-blue-600 text-white shadow-xl shadow-blue-500/20 space-y-4 relative overflow-hidden">
                <User className="absolute -right-4 -top-4 w-24 h-24 opacity-10" />
                <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-60">Cliente</p>
                    <p className="text-lg font-bold leading-tight">{orden.cliente.nombreRazonSocial}</p>
                </div>
                <div className="grid grid-cols-1 gap-1 border-t border-white/10 pt-4 text-[11px] font-medium">
                    <p className="flex items-center gap-2 opacity-80"><Calendar className="w-3 h-3" /> {orden.fechaEntregaEstimada || "Sin fecha"}</p>
                    <p className="flex items-center gap-2 opacity-80 truncate"><Info className="w-3 h-3" /> {orden.cliente.correo}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 px-2">Detalles Técnicos</h4>
                <div className="grid grid-cols-1 gap-3">
                   <DetailRow label="Cantidad" value={`${item.cantidad} ${item.unidad}`} icon={<Box className="w-3 h-3"/>} />
                   {(item.medidaXCm > 0 || item.medidaYCm > 0) && (
                     <DetailRow label="Medidas" value={`${item.medidaXCm || 0} x ${item.medidaYCm || 0} cm`} icon={<Maximize className="w-3 h-3"/>} />
                   )}
                   {item.tiempoCorte && (
                     <DetailRow label="Tiempo de Corte" value={formatTimeForDisplay(item.tiempoCorte)} color="text-red-500" icon={<Clock className="w-3 h-3"/>} />
                   )}
                   {item.materialDeImpresion && <DetailRow label="Material" value={item.materialDeImpresion} icon={<Layers className="w-3 h-3"/>} />}
                   {item.materialDetalleCorte && <DetailRow label="Detalle" value={item.materialDetalleCorte} icon={<Info className="w-3 h-3"/>} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 pt-4 flex flex-col sm:flex-row gap-4 border-t border-black/5 dark:border-white/5">
          <Button variant="ghost" onClick={onClose} className="flex-1 rounded-2xl h-14 font-black uppercase text-[11px] tracking-widest text-slate-400">Cerrar</Button>
          <Button 
            onClick={handleMarkReviewed} 
            disabled={isSaving}
            className="flex-[1.5] rounded-2xl h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-500/20"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Marcar como Revisado</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({ label, value, color, icon }: any) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-100/50 dark:bg-white/5 border border-black/5">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white dark:bg-black/20 shadow-sm opacity-40">{icon}</div>
                <span className="text-[10px] font-bold uppercase tracking-tight opacity-40">{label}</span>
            </div>
            <span className={cn("text-xs font-black", color ? color : "text-slate-900 dark:text-white")}>{value}</span>
        </div>
    )
}