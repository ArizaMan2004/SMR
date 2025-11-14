// task-detail-modal.tsx
"use client"

import { useState, useRef, useEffect } from "react"
// Componentes de UI (Shadcn UI)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input" 
import { Label } from "@/components/ui/label" 
import { Card } from "@/components/ui/card"
// Iconos
import { 
  ChevronLeft, ChevronRight, X, Loader2, Upload, AlertCircle, CheckCircle2, Save, Send, Trash2 
} from 'lucide-react'
// Tipos
import { type OrdenServicio, type ItemOrden, EstadoOrden } from "@/lib/types/orden" 

// ⚠️ SERVICIOS REQUERIDOS (Deben existir en tu proyecto)
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "@/lib/services/cloudinary-service"; 
import { saveTaskNote, markItemAsReviewed, deleteTaskImage } from "@/lib/services/task-actions-service"; 
// ------------------------------------

/**
 * Función helper para formatear una cadena de tiempo (ej. "1:30" o "01:30") a MM:SS.
 */
const formatTimeForDisplay = (timeValue: string | undefined): string => {
    if (!timeValue) return "00:00";
    
    // Divide "M:SS" o "MM:SS"
    const parts = timeValue.split(':');
    
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);

        if (!isNaN(minutes) && !isNaN(seconds)) {
            // Asegura que los minutos y segundos tengan dos dígitos (ej. 1 -> 01)
            const paddedMinutes = String(minutes).padStart(2, '0');
            const paddedSeconds = String(seconds).padStart(2, '0');
            return `${paddedMinutes}:${paddedSeconds}`;
        }
    }
    // Retorna el valor original si no se puede parsear o "00:00" si está vacío
    return timeValue.trim() || "00:00"; 
};


interface TaskDetailModalProps {
  item: ItemOrden
  orden: OrdenServicio
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void 
}

export default function TaskDetailModal({
  item,
  orden,
  isOpen,
  onClose,
  onUpdate,
}: TaskDetailModalProps) {
  // Estados principales
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [areaNote, setAreaNote] = useState(item.areaNote || "") 
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  
  // 📸 ESTADO: Para controlar el modal de previsualización de imagen
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false); 
  
  // 💡 ESTADO CLAVE: Usamos estado local para las imágenes para que el cambio sea instantáneo
  const [localImages, setLocalImages] = useState(item.imagenes || []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lógica de visualización de imágenes (carousel)
  const itemImages = localImages 
  const hasImages = itemImages.length > 0
  const placeholderImage = "/placeholder-no-image.jpg" 
  const imagesToDisplay = hasImages ? itemImages : [placeholderImage] 
  const totalImages = imagesToDisplay.length
  
  // URL de la imagen que se muestra actualmente
  const currentImageUrl = imagesToDisplay[currentImageIndex]; 

  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(0);
      setUploadError(null);
      setActionMessage(null);
      setAreaNote(item.areaNote || ""); 
    }
    // 💡 SINCRONIZAR: Actualiza el estado local cada vez que la prop 'item.imagenes' cambie (ej. al abrir el modal)
    setLocalImages(item.imagenes || []); 
  }, [isOpen, item.areaNote, item.imagenes]); 

  // Lógica del Carrusel
  const handlePrevImage = () => {
    // Si no hay imágenes reales, totalImages es 1 (solo placeholder), no navegamos.
    if (!hasImages && totalImages === 1) return;
    setCurrentImageIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1))
  }

  const handleNextImage = () => {
    // Si no hay imágenes reales, totalImages es 1 (solo placeholder), no navegamos.
    if (!hasImages && totalImages === 1) return;
    setCurrentImageIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1))
  }
  
  // Handlers de Cloudinary
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) {
        console.warn("Advertencia: No se seleccionó ningún archivo.");
        return; 
    }

    setIsUploading(true);
    setUploadError(null); 
    setActionMessage(null);

    try {
      console.log(`[INICIO SUBIDA] Procesando archivo: ${file.name}`);

      const newImageUrl = await uploadFileToCloudinary(file);
      console.log("[ÉXITO SUBIDA] URL de Cloudinary obtenida.");

      // 💡 CREAR NUEVO ARRAY CON EL ESTADO LOCAL
      const updatedImages = [...localImages, newImageUrl];
      
      // 1. Guardar en la DB
      await saveTaskNote(orden.id, item.nombre, updatedImages, 'imagenes'); 
      console.log("[ÉXITO DB] URL guardada en Firestore.");
      
      // 2. ACTUALIZACIÓN INSTANTÁNEA
      setLocalImages(updatedImages); 
      setCurrentImageIndex(updatedImages.length - 1); // Mover al final (imagen recién subida)
      
      // 3. Notificar al padre para recarga general
      // ⚠️ REMOVIDO: onUpdate?.(); <-- Quitamos esta llamada para evitar el cierre del modal.

    } catch (err: any) {
      const errorMessage = err.message || "Ocurrió un error desconocido. Revisar consola para más detalles.";
      console.error("❌ ERROR CRÍTICO DE SUBIDA/GUARDADO:", errorMessage, err);
      setUploadError(errorMessage); 
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
    }
  };

  // 🗑️ HANDLER PARA ELIMINAR LA IMAGEN
  const handleDeleteImage = async () => {
    if (!hasImages) return; 

    if (!window.confirm("¿Estás seguro de que quieres eliminar esta imagen? Esta acción es permanente.")) {
      return;
    }
    
    const imageUrlToDelete = itemImages[currentImageIndex];

    setIsSaving(true); 
    setActionMessage(null);

    try {
      console.log(`[INICIO ELIMINACIÓN] Procesando URL: ${imageUrlToDelete}`);

      // 1. Llama al servicio que borra de Cloudinary y actualiza la BD
      await deleteTaskImage(orden.id, item.nombre, imageUrlToDelete);
      console.log("[ÉXITO ELIMINACIÓN] Imagen removida de Cloudinary y DB.");

      // 2. Filtra el array de imágenes localmente
      const newImagesArray = itemImages.filter(url => url !== imageUrlToDelete);
      
      // 3. ACTUALIZACIÓN INSTANTÁNEA
      setLocalImages(newImagesArray);
      
      setActionMessage("Imagen eliminada exitosamente.");
      
      // ⚠️ REMOVIDO: onUpdate?.(); <-- Quitamos esta llamada para evitar el cierre del modal.

      // 4. Ajustar el índice del carrusel después de la eliminación
      setCurrentImageIndex((prevIndex) => {
        const newTotal = newImagesArray.length; 
        if (newTotal === 0) return 0;
        if (prevIndex >= newTotal) return newTotal - 1;
        return prevIndex;
      });

    } catch (err: any) {
      const errorMessage = err.message || "Ocurrió un error desconocido al eliminar la imagen.";
      console.error("❌ ERROR CRÍTICO DE ELIMINACIÓN:", errorMessage, err);
      setActionMessage(`Error al eliminar: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };


  // Handler para guardar las notas
  const handleSaveNote = async () => {
    if (areaNote === (item.areaNote || "")) return; 
    
    setIsSaving(true);
    setActionMessage(null);

    try {
      await saveTaskNote(orden.id, item.nombre, areaNote, 'areaNote'); 
      setActionMessage("Notas guardadas exitosamente.");
      // ⚠️ REMOVIDO: onUpdate?.(); <-- Quitamos esta llamada para evitar el cierre del modal.
    } catch (err: any) {
      setActionMessage("Error al guardar las notas.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler para marcar como revisado/terminado
  // ESTO SÍ DEBE LLAMAR A onUpdate() y onClose()
  const handleMarkReviewed = async () => {
    
    setIsSaving(true);
    setActionMessage(null);

    try {
      await markItemAsReviewed(orden.id, item.nombre, EstadoOrden.TERMINADO); 
      
      setActionMessage("Tarea marcada como TERMINADA/Revisada.");
      onUpdate?.(); // Se mantiene porque la lista principal debe refrescarse al terminar una tarea.
      onClose(); 
    } catch (err: any) {
      setActionMessage("Error al marcar la tarea como revisada.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    // Dialog principal
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        
        {/* DialogHeader para el modal principal */}
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl">{item.nombre}</DialogTitle>
          <button 
              onClick={onClose} 
              className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
              <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 pt-2">
          
          {/* Columna de la Imagen y Controles */}
          <div className="md:col-span-1 space-y-4">
            
            {/* CARD DEL CARRUSEL DE IMAGEN (INTERACTIVO con CLICK) */}
            <Card className="relative p-2 flex items-center justify-center bg-gray-100 dark:bg-gray-800 aspect-video overflow-hidden">
                
                {/* 🔑 MODIFICACIÓN: Solo renderizar la imagen si existen imágenes reales (hasImages) */}
                {hasImages ? (
                    <img 
                        src={currentImageUrl}
                        alt={`Imagen ${currentImageIndex + 1} del proyecto - ${item.nombre}`}
                        className="object-contain max-h-full max-w-full cursor-pointer transition-opacity hover:opacity-80"
                        onClick={() => setIsImagePreviewOpen(true)}
                    />
                ) : (
                    // Si no hay imágenes, se renderiza un div vacío para que solo se vea el componente estético.
                    <div className="w-full h-full" />
                )}

                {/* CONTROLES DE NAVEGACIÓN */}
                {/* Solo si hay imágenes y más de una en total */}
                {hasImages && totalImages > 1 && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevImage}
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextImage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>

                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {currentImageIndex + 1} / {totalImages}
                        </div>
                    </>
                )}
                
                {/* 🗑️ BOTÓN DE ELIMINAR IMAGEN */}
                {/* Solo se muestra si hay imágenes reales y el modal no está guardando */}
                {hasImages && !isSaving && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDeleteImage}
                        className="absolute bottom-2 left-2 z-10 bg-red-600/70 hover:bg-red-700 text-white"
                        title="Eliminar esta imagen"
                        disabled={isSaving}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                )}

                {/* Mensaje Estético si no hay imágenes adjuntas */}
                {!hasImages && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-gray-200 dark:bg-gray-900/80 border-2 border-dashed border-gray-400 dark:border-gray-600 rounded-lg m-4">
                        <Upload className="h-10 w-10 text-gray-500 dark:text-gray-400 mb-2"/>
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">¡Añade la primera foto de la tarea!</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sube un archivo para registrar el avance o finalización del trabajo.</p>
                     </div>
                )}
            </Card>
            
            {/* BOTÓN DE SUBIDA DE FOTOS PARA CLOUDINARY */}
            <Card className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-between">
                    <Label htmlFor="task-file-upload" className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        {itemImages.length > 0 ? "Añadir Foto de Tarea Final" : "Subir Foto de Tarea"}
                    </Label>
                    <Input 
                        id="task-file-upload"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUploadFile}
                        className="hidden"
                        disabled={isUploading}
                        accept="image/*, application/pdf"
                    />
                    <Button 
                        onClick={handleUploadClick}
                        disabled={isUploading}
                        size="sm"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Subiendo...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Subir Archivo
                            </>
                        )}
                    </Button>
                </div>
                
                {uploadError && (
                    <p className="text-sm text-red-600 mt-2 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1"/> Error de Subida: {uploadError}
                    </p>
                )}
                {itemImages.length > 0 && !isUploading && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-1"/> {itemImages.length} archivo(s) adjunto(s).
                    </p>
                )}
            </Card>

            {/* Información Completa del Cliente */}
            <Card className="p-4 border-l-4 border-primary">
              <h3 className="font-semibold text-foreground">Cliente</h3>
              <p className="text-sm font-medium">{orden.cliente.nombreRazonSocial}</p>
              
              {orden.cliente.telefono && (
                  <p className="text-sm text-muted-foreground mt-1">Teléfono: <span className="font-medium text-foreground">{orden.cliente.telefono}</span></p>
              )}
              {orden.cliente.correo && (
                  <p className="text-sm text-muted-foreground">Email: <span className="font-medium text-foreground">{orden.cliente.correo}</span></p>
              )}
            </Card>

            {/* Notas específicas del área (con botón de Guardar funcional) */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Notas específicas para esta área</h4>
              <Textarea
                placeholder="Añade notas específicas para este trabajo (instrucciones especiales, detalles importantes, etc.)"
                value={areaNote}
                onChange={(e) => setAreaNote(e.target.value)}
                className="min-h-24 resize-none"
                disabled={isSaving}
              />
              <Button 
                className="w-full" 
                onClick={handleSaveNote}
                disabled={isSaving || areaNote === (item.areaNote || "")} 
              >
                {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Save className="mr-2 h-4 w-4" />
                )}
                Guardar Notas
              </Button>
              {actionMessage && !isSaving && (
                <p className={`text-sm mt-2 ${actionMessage.includes("Error") ? 'text-red-600' : 'text-green-600'}`}>
                  {actionMessage}
                </p>
              )}
            </div>
          </div>
          
          {/* Columna de Detalles Técnicos */}
          <div className="md:col-span-1 space-y-4">
            
            <h3 className="font-bold text-lg border-b pb-1">Detalles de la Orden</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
                <p className="text-muted-foreground">Número de Orden:</p>
                <p className="font-medium text-right">{orden.ordenNumero}</p> 
                
                {orden.fechaEntregaEstimada && (<><p className="text-muted-foreground">Entrega Estimada:</p><p className="font-medium text-right">{orden.fechaEntregaEstimada}</p></>)}
                
                <p className="text-muted-foreground">Estado General:</p>
                <p className="font-medium text-right">{orden.estado}</p>
            </div>
            
            <h3 className="font-bold text-lg border-b pb-1 pt-4">Detalles del Ítem</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
                
                <p className="text-muted-foreground">Cantidad:</p>
                <p className="font-medium text-right">{item.cantidad} {item.unidad}</p>
                
                {/* 🔑 LÓGICA DE MEDIDAS (medidaXCm y medidaYCm) */}
                {(item.medidaXCm > 0 || item.medidaYCm > 0) && (
                    <>
                        <p className="text-muted-foreground">Medidas (cm):</p>
                        <p className="font-medium text-right">
                            {item.medidaXCm || 0} x {item.medidaYCm || 0} cm
                        </p>
                    </>
                )}

                {/* 🔑 ÁREA (SI LA UNIDAD ES 'm2') */}
                {item.unidad === 'm2' && item.cantidad && item.cantidad > 0 && (
                    <>
                        <p className="text-muted-foreground">Área Total:</p>
                        <p className="font-medium text-right">
                             {item.cantidad} M²
                        </p>
                    </>
                )}

                {/* 🔑 TIEMPO LÁSER (tiempoCorte) - AHORA SIEMPRE SE MUESTRA SI ES CORTE LÁSER */}
                {(item.tipoServicio === 'CORTE_LASER' || item.tipoServicio?.toLowerCase() === 'corte_laser') && (
                    <>
                        <p className="text-muted-foreground font-bold text-red-600">Tiempo de Corte:</p>
                        <p className="font-extrabold text-right text-red-600">
                            {/* Formato MM:SS */}
                            {formatTimeForDisplay(item.tiempoCorte)} min:seg
                        </p>
                    </>
                )}
                
                {/* OTROS DETALLES */}
                {item.materialDeImpresion && (<><p className="text-muted-foreground">Material:</p><p className="font-medium text-right">{item.materialDeImpresion}</p></>)}
                {item.materialDetalleCorte && (<><p className="text-muted-foreground">Detalle:</p><p className="font-medium text-right">{item.materialDetalleCorte}</p></>)}
            </div>

            {/* SECCIÓN DE FINANZAS ELIMINADA */}

          </div>
          
        </div>

        {/* Footer con Botones */}
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 p-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {/* Botón Marcar como Revisado (funcional) */}
          <Button onClick={handleMarkReviewed} disabled={isSaving}>
            {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Send className="mr-2 h-4 w-4" />
            )}
            Marcar como Revisado
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 🖼️ DIALOG DE PREVISUALIZACIÓN DE IMAGEN */}
      <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-transparent shadow-none">
          
          <DialogHeader className="sr-only">
            <DialogTitle>Previsualización de Imagen</DialogTitle>
          </DialogHeader>
          
          <div className="relative w-full h-full flex items-center justify-center">
            
            {/* Solo renderiza la imagen si hay imágenes reales */}
            {hasImages && (
                <img 
                    src={currentImageUrl} 
                    alt={`Vista ampliada de la imagen ${currentImageIndex + 1}`}
                    className="object-contain max-w-full max-h-full" 
                />
            )}
            
            {/* Botón de cierre absoluto */}
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsImagePreviewOpen(false)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white z-50 h-10 w-10"
            >
                <X className="h-6 w-6" />
            </Button>
            
            {/* Controles de carrusel dentro del modal grande */}
            {/* Solo si hay imágenes y más de una */}
            {hasImages && totalImages > 1 && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handlePrevImage(); }} 
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white z-50 h-12 w-12"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white z-50 h-12 w-12"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                </>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}