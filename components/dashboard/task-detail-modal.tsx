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
// Tipos (ASUMIMOS QUE LA INTERFAZ ItemOrden AHORA INCLUYE pruebasImagenes)
interface ItemOrden {
    // ... otras propiedades
    nombre: string;
    imagenes: string[]; // Imágenes de Detalles/Instrucciones (Originales)
    pruebasImagenes: string[]; // <--- NUEVO CAMPO PARA PRUEBAS
    areaNote: string;
    // ...
}
type EstadoOrden = "PENDIENTE" | "EN_PROGRESO" | "TERMINADO";
interface OrdenServicio {
    // ... otras propiedades
    estado: EstadoOrden;
    cliente: { nombreRazonSocial: string; telefono: string; correo: string; };
    ordenNumero: string;
    fechaEntregaEstimada: string;
}
const EstadoOrden = { TERMINADO: "TERMINADO" as EstadoOrden };


// ⚠️ SERVICIOS REQUERIDOS (Deben existir en tu proyecto)
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "@/lib/services/cloudinary-service"; 
import { saveTaskNote, markItemAsReviewed, deleteTaskImage } from "@/lib/services/task-actions-service"; 
// ------------------------------------

/**
 * Función helper para formatear una cadena de tiempo (ej. "1:30" o "01:30") a MM:SS.
 */
// ... (formatTimeForDisplay se mantiene igual)
const formatTimeForDisplay = (timeValue: string | undefined): string => {
    if (!timeValue) return "00:00";
    const parts = timeValue.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        if (!isNaN(minutes) && !isNaN(seconds)) {
            const paddedMinutes = String(minutes).padStart(2, '0');
            const paddedSeconds = String(seconds).padStart(2, '0');
            return `${paddedMinutes}:${paddedSeconds}`;
        }
    }
    return timeValue.trim() || "00:00"; 
};


interface TaskDetailModalProps {
  item: ItemOrden
  orden: OrdenServicio
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void 
}

// ----------------------------------------------------
//     CARRUSEL REUSABLE (HELPER COMPONENT)
// ----------------------------------------------------

interface ImageCarouselProps {
    title: string;
    images: string[];
    onUpload: (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'imagenes' | 'pruebasImagenes') => void;
    onDelete: (imageUrl: string, fieldName: 'imagenes' | 'pruebasImagenes') => void;
    isSaving: boolean;
    isUploading: boolean;
    uploadError: string | null;
    fieldName: 'imagenes' | 'pruebasImagenes';
    itemId: string;
    ordenId: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
    title,
    images,
    onUpload,
    onDelete,
    isSaving,
    isUploading,
    uploadError,
    fieldName,
    itemId,
    ordenId,
}) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasImages = images.length > 0;
    const placeholderImage = "/placeholder-no-image.jpg"; 
    const imagesToDisplay = hasImages ? images : [placeholderImage]; 
    const totalImages = imagesToDisplay.length;
    const currentImageUrl = imagesToDisplay[currentImageIndex]; 

    useEffect(() => {
        // Reset index when images array changes or when component is shown
        setCurrentImageIndex(0);
    }, [images]);


    const handlePrevImage = () => {
        if (!hasImages && totalImages === 1) return;
        setCurrentImageIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
    };

    const handleNextImage = () => {
        if (!hasImages && totalImages === 1) return;
        setCurrentImageIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleDeleteClick = () => {
        if (currentImageUrl && hasImages) {
            onDelete(currentImageUrl, fieldName);
        }
    };
    
    // --- Renderizado ---

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-lg border-b pb-1">{title}</h4>
            
            {/* CARD DEL CARRUSEL */}
            <Card className="relative p-2 flex items-center justify-center bg-gray-100 dark:bg-gray-800 aspect-video overflow-hidden">
                
                {hasImages ? (
                    <img 
                        src={currentImageUrl}
                        alt={`${title} - Imagen ${currentImageIndex + 1}`}
                        className="object-contain max-h-full max-w-full cursor-pointer transition-opacity hover:opacity-80"
                        onClick={() => setIsImagePreviewOpen(true)}
                    />
                ) : (
                    <div className="w-full h-full" />
                )}

                {/* CONTROLES DE NAVEGACIÓN */}
                {hasImages && totalImages > 1 && (
                    <>
                        {/* Botones de navegación (ChevronLeft/Right) */}
                        <Button variant="ghost" size="icon" onClick={handlePrevImage} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white"><ChevronLeft className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleNextImage} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white"><ChevronRight className="h-5 w-5" /></Button>

                        {/* Contador */}
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {currentImageIndex + 1} / {totalImages}
                        </div>
                    </>
                )}
                
                {/* 🗑️ BOTÓN DE ELIMINAR IMAGEN */}
                {hasImages && !isSaving && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDeleteClick}
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
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">¡Añade la primera foto de {fieldName === 'imagenes' ? 'detalle' : 'prueba'}!</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sube un archivo para {fieldName === 'imagenes' ? 'instrucciones' : 'el avance del trabajo'}.</p>
                     </div>
                )}
            </Card>

            {/* BOTÓN DE SUBIDA */}
            <Card className={`p-4 border-l-4 ${fieldName === 'pruebasImagenes' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'}`}>
                <div className="flex items-center justify-between">
                    <Label htmlFor={`${fieldName}-file-upload`} className={`text-sm font-semibold ${fieldName === 'pruebasImagenes' ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'}`}>
                        {images.length > 0 ? `Añadir más fotos de ${fieldName === 'imagenes' ? 'detalle' : 'prueba'}` : `Subir Foto de ${fieldName === 'imagenes' ? 'Detalle' : 'Prueba'}`}
                    </Label>
                    <Input 
                        id={`${fieldName}-file-upload`}
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => onUpload(e, fieldName)}
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
                {images.length > 0 && !isUploading && (
                    <p className={`text-sm mt-2 flex items-center ${fieldName === 'pruebasImagenes' ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
                        <CheckCircle2 className="h-4 w-4 mr-1"/> {images.length} archivo(s) adjunto(s).
                    </p>
                )}
            </Card>

            {/* DIALOG DE PREVISUALIZACIÓN DE IMAGEN (Se mantiene en el componente reusable) */}
            <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
                <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-transparent shadow-none">
                    <div className="relative w-full h-full flex items-center justify-center">
                        {hasImages && (
                            <img 
                                src={currentImageUrl} 
                                alt={`Vista ampliada de la imagen ${currentImageIndex + 1}`}
                                className="object-contain max-w-full max-h-full" 
                            />
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setIsImagePreviewOpen(false)} className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white z-50 h-10 w-10"><X className="h-6 w-6" /></Button>
                        {hasImages && totalImages > 1 && (
                            <>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePrevImage(); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white z-50 h-12 w-12"><ChevronLeft className="h-8 w-8" /></Button>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleNextImage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white z-50 h-12 w-12"><ChevronRight className="h-8 w-8" /></Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
// ----------------------------------------------------
//     FIN DE CARRUSEL REUSABLE
// ----------------------------------------------------


export default function TaskDetailModal({
  item,
  orden,
  isOpen,
  onClose,
  onUpdate,
}: TaskDetailModalProps) {
  // Estados principales
  const [areaNote, setAreaNote] = useState(item.areaNote || "") 
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  
  // 💡 ESTADO CLAVE: Estados locales para ambos arrays de imágenes
  const [detalleImages, setDetalleImages] = useState(item.imagenes || []); // Original
  const [pruebaImages, setPruebaImages] = useState(item.pruebasImagenes || []); // Nuevo

  // Sincronización de estados al abrir o cambiar las props
  useEffect(() => {
    if (isOpen) {
      setUploadError(null);
      setActionMessage(null);
      setAreaNote(item.areaNote || ""); 
    }
    setDetalleImages(item.imagenes || []);
    setPruebaImages(item.pruebasImagenes || []);
  }, [isOpen, item.areaNote, item.imagenes, item.pruebasImagenes]); 


  // ----------------------------------------------------
  //     HANDLERS UNIFICADOS DE SUBIDA Y ELIMINACIÓN
  // ----------------------------------------------------

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'imagenes' | 'pruebasImagenes') => {
    const file = e.target.files?.[0];
    if (!file) return; 

    setIsUploading(true);
    setUploadError(null); 
    setActionMessage(null);

    const currentImages = fieldName === 'imagenes' ? detalleImages : pruebaImages;

    try {
      const newImageUrl = await uploadFileToCloudinary(file);
      const updatedImages = [...currentImages, newImageUrl];
      
      // 1. Guardar en la DB (usa fieldName para seleccionar el campo)
      await saveTaskNote(orden.id, item.nombre, updatedImages, fieldName); 
      
      // 2. ACTUALIZACIÓN INSTANTÁNEA LOCAL
      if (fieldName === 'imagenes') {
        setDetalleImages(updatedImages);
      } else {
        setPruebaImages(updatedImages);
      }

    } catch (err: any) {
      const errorMessage = err.message || "Ocurrió un error desconocido. Revisar consola para más detalles.";
      console.error("❌ ERROR CRÍTICO DE SUBIDA/GUARDADO:", errorMessage, err);
      setUploadError(errorMessage); 
    } finally {
      setIsUploading(false);
      // Resetear el input file para permitir subir el mismo archivo
      if (e.target) {
          e.target.value = ""; 
      }
    }
  };

  const handleDeleteImage = async (imageUrlToDelete: string, fieldName: 'imagenes' | 'pruebasImagenes') => {
    setIsSaving(true); 
    setActionMessage(null);

    const currentImages = fieldName === 'imagenes' ? detalleImages : pruebaImages;

    try {
      // 1. Llama al servicio que borra de Cloudinary y actualiza la BD
      await deleteTaskImage(orden.id, item.nombre, imageUrlToDelete, fieldName);
      
      // 2. Filtra el array de imágenes localmente
      const newImagesArray = currentImages.filter(url => url !== imageUrlToDelete);
      
      // 3. ACTUALIZACIÓN INSTANTÁNEA LOCAL
      if (fieldName === 'imagenes') {
        setDetalleImages(newImagesArray);
      } else {
        setPruebaImages(newImagesArray);
      }
      
      setActionMessage("Imagen eliminada exitosamente.");

    } catch (err: any) {
      const errorMessage = err.message || "Ocurrió un error desconocido al eliminar la imagen.";
      console.error("❌ ERROR CRÍTICO DE ELIMINACIÓN:", errorMessage, err);
      setActionMessage(`Error al eliminar: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };


  // Handler para guardar las notas (se mantiene sin onUpdate para evitar cierre)
  const handleSaveNote = async () => {
    if (areaNote === (item.areaNote || "")) return; 
    
    setIsSaving(true);
    setActionMessage(null);

    try {
      await saveTaskNote(orden.id, item.nombre, areaNote, 'areaNote'); 
      setActionMessage("Notas guardadas exitosamente.");
    } catch (err: any) {
      setActionMessage("Error al guardar las notas.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler para marcar como revisado/terminado (SÍ LLAMA a onUpdate y onClose)
  const handleMarkReviewed = async () => {
    setIsSaving(true);
    setActionMessage(null);

    try {
      await markItemAsReviewed(orden.id, item.nombre, EstadoOrden.TERMINADO); 
      setActionMessage("Tarea marcada como TERMINADA/Revisada.");
      onUpdate?.(); 
      onClose(); 
    } catch (err: any) {
      setActionMessage("Error al marcar la tarea como revisada.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        
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
          
          {/* Columna de Imágenes y Controles */}
          <div className="md:col-span-1 space-y-4">
            
            {/* 📸 CARRUSEL 1: DETALLES E INSTRUCCIONES (Originales) */}
            <ImageCarousel
                title="1. Detalles e Instrucciones (Admin)"
                images={detalleImages}
                onUpload={handleUploadFile}
                onDelete={handleDeleteImage}
                isSaving={isSaving}
                isUploading={isUploading}
                uploadError={uploadError}
                fieldName="imagenes"
                itemId={item.nombre}
                ordenId={orden.id}
            />

            <hr className="my-4"/>

            {/* 📸 CARRUSEL 2: PRUEBAS DE TRABAJO (Empleados) */}
            <ImageCarousel
                title="2. Pruebas de Trabajo (Avance)"
                images={pruebaImages}
                onUpload={handleUploadFile}
                onDelete={handleDeleteImage}
                isSaving={isSaving}
                isUploading={isUploading}
                uploadError={uploadError}
                fieldName="pruebasImagenes"
                itemId={item.nombre}
                ordenId={orden.id}
            />

            <hr className="my-4"/>
            
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
            
            {/* Info Cliente y Orden */}
            <Card className="p-4 border-l-4 border-primary">
              <h3 className="font-semibold text-foreground">Cliente</h3>
              <p className="text-sm font-medium">{orden.cliente.nombreRazonSocial}</p>
              {orden.cliente.telefono && (<p className="text-sm text-muted-foreground mt-1">Teléfono: <span className="font-medium text-foreground">{orden.cliente.telefono}</span></p>)}
              {orden.cliente.correo && (<p className="text-sm text-muted-foreground">Email: <span className="font-medium text-foreground">{orden.cliente.correo}</span></p>)}
            </Card>

            <h3 className="font-bold text-lg border-b pb-1">Detalles de la Orden</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
                <p className="text-muted-foreground">Número de Orden:</p><p className="font-medium text-right">{orden.ordenNumero}</p> 
                {orden.fechaEntregaEstimada && (<><p className="text-muted-foreground">Entrega Estimada:</p><p className="font-medium text-right">{orden.fechaEntregaEstimada}</p></>)}
                <p className="text-muted-foreground">Estado General:</p><p className="font-medium text-right">{orden.estado}</p>
            </div>
            
            <h3 className="font-bold text-lg border-b pb-1 pt-4">Detalles del Ítem</h3>
            {/* ... (Detalles técnicos del ítem se mantienen igual) ... */}
            <div className="grid grid-cols-2 gap-y-2 text-sm">
                <p className="text-muted-foreground">Cantidad:</p><p className="font-medium text-right">{item.cantidad} {item.unidad}</p>
                {(item.medidaXCm > 0 || item.medidaYCm > 0) && (
                    <><p className="text-muted-foreground">Medidas (cm):</p><p className="font-medium text-right">{item.medidaXCm || 0} x {item.medidaYCm || 0} cm</p></>
                )}
                {item.unidad === 'm2' && item.cantidad && item.cantidad > 0 && (
                    <><p className="text-muted-foreground">Área Total:</p><p className="font-medium text-right">{item.cantidad} M²</p></>
                )}
                {(item.tipoServicio === 'CORTE_LASER' || item.tipoServicio?.toLowerCase() === 'corte_laser') && (
                    <><p className="text-muted-foreground font-bold text-red-600">Tiempo de Corte:</p><p className="font-extrabold text-right text-red-600">{formatTimeForDisplay(item.tiempoCorte)} min:seg</p></>
                )}
                {item.materialDeImpresion && (<><p className="text-muted-foreground">Material:</p><p className="font-medium text-right">{item.materialDeImpresion}</p></>)}
                {item.materialDetalleCorte && (<><p className="text-muted-foreground">Detalle:</p><p className="font-medium text-right">{item.materialDetalleCorte}</p></>)}
            </div>

          </div>
          
        </div>

        {/* Footer con Botones */}
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 p-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {/* Botón Marcar como Revisado (funcional) */}
          <Button onClick={handleMarkReviewed} disabled={isSaving}>
            {isSaving ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Send className="mr-2 h-4 w-4" />)}
            Marcar como Revisado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}