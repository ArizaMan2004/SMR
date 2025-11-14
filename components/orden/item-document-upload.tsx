// @/components/orden/item-document-upload.tsx

"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress' // Asumiendo que usas shadcn/ui/progress
import { Upload, Trash2, FileText, Image, Loader2, Link as LinkIcon } from 'lucide-react'
import { type ItemOrden } from "@/lib/types/orden"
import { Badge } from '@/components/ui/badge'

interface ItemDocumentUploadProps {
    // El ItemOrden actual que estamos editando (estado local en ItemFormModal)
    itemData: ItemOrden;
    // Función de callback para actualizar ItemOrden en el Wizard/Modal padre
    onUpdateItem: (updatedItem: ItemOrden) => void;
    // El ID de la orden actual (necesario para la ruta de Firebase Storage)
    ordenId: string;
}

/**
 * 🔑 DEBES REEMPLAZAR ESTA FUNCIÓN CON TU LÓGICA REAL DE FIREBASE STORAGE
 * Esta función sube el archivo y devuelve la URL pública.
 * En una implementación real, aquí importarías tu servicio de Storage.
 */
async function uploadFileForTaskMock(file: File, ordenId: string, itemName: string): Promise<string> {
    console.log(`[MOCK] Subiendo archivo: ${file.name} para Orden ${ordenId}, Item ${itemName}`);
    // Simula una subida de 1.5 segundos
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    // Devuelve una URL de ejemplo (deberías devolver la URL real de Firebase Storage)
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let url = `https://storage.miempresa.com/${ordenId}/${itemName.replace(/\s/g, '-')}-${Date.now()}.${fileExtension}`;
    if (fileExtension === 'pdf') {
        url = `https://documentos.miempresa.com/${ordenId}/plano.pdf`; 
    }
    return url;
}


export default function ItemDocumentUpload({ 
    itemData, 
    onUpdateItem,
    ordenId // Clave para la ruta de subida real
}: ItemDocumentUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const uploadedDocuments = itemData.imagenesDeTrabajo || [];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            setUploadProgress(10); 
            
            // 🔑 Llama a tu función de subida REAL aquí
            const url = await uploadFileForTaskMock(file, ordenId, itemData.nombre); 

            // Simulación de progreso
            setUploadProgress(90);

            // 🔑 ACTUALIZAR EL ESTADO DEL ITEM EN EL COMPONENTE PADRE
            const updatedImages = [...uploadedDocuments, url];
            onUpdateItem({
                ...itemData,
                imagenesDeTrabajo: updatedImages,
            });

            setUploadProgress(100);
        } catch (error) {
            console.error("Error al subir documento:", error);
            alert("Fallo al subir el documento.");
            setUploadProgress(0);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            e.target.value = ''; // Limpiar el input para subir el mismo archivo de nuevo
        }
    }

    const handleRemoveDocument = (urlToRemove: string) => {
        if (!confirm("¿Estás seguro de que quieres eliminar este documento?")) return;
        
        const updatedImages = uploadedDocuments.filter(url => url !== urlToRemove);
        onUpdateItem({
            ...itemData,
            // Si el array queda vacío, es mejor usar 'undefined' para no guardar un array vacío en Firestore.
            imagenesDeTrabajo: updatedImages.length > 0 ? updatedImages : undefined,
        });
    }

    const getFileIcon = (url: string) => {
        const extension = url.split('.').pop()?.toLowerCase();
        if (extension === 'pdf') return <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />;
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) return <Image className="w-5 h-5 text-blue-500 flex-shrink-0" />;
        return <LinkIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />;
    }

    const getFileName = (url: string) => {
        // Simple helper to extract a name from the URL
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            let name = pathSegments[pathSegments.length - 1];
            name = name.split('?')[0]; 
            return decodeURIComponent(name) || "Documento Adjunto";
        } catch (e) {
            return "Documento Adjunto";
        }
    }

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <h4 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documentos de Trabajo ({uploadedDocuments.length})
            </h4>

            {/* Input y Botón de Subida */}
            <div className="flex flex-col gap-2">
                <input
                    id={`item-file-upload-${itemData.nombre}`}
                    type="file"
                    accept="image/*,.pdf,.svg,.ai,.cdr,.dxf,.dwg" 
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                />
                <Button 
                    onClick={() => document.getElementById(`item-file-upload-${itemData.nombre}`)?.click()}
                    disabled={isUploading}
                    variant="outline"
                    className="justify-center"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Subiendo...
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4 mr-2" />
                            Subir Plano o Documento
                        </>
                    )}
                </Button>
                {isUploading && <Progress value={uploadProgress} className="h-2" />}
            </div>

            {/* Lista de Documentos Subidos */}
            {uploadedDocuments.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {uploadedDocuments.map((url, index) => (
                        <div 
                            key={index} 
                            className="flex items-center justify-between p-2 text-sm border rounded-md hover:bg-secondary/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {getFileIcon(url)}
                                <Badge variant="secondary" className="truncate font-normal">
                                    {getFileName(url)}
                                </Badge>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-auto">
                                    Ver
                                </a>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-red-500 hover:text-red-700"
                                onClick={() => handleRemoveDocument(url)}
                                disabled={isUploading}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}