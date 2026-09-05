// @/lib/services/cloudinary-service.ts

import { auth } from "@/lib/firebase";

/**
 * Sube un archivo (File) a Cloudinary y devuelve la URL pública.
 * @param file El archivo (File object) a subir.
 * @returns La URL pública del recurso en Cloudinary.
 */
export async function uploadFileToCloudinary(file: File): Promise<string> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME; 
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET; 

    if (!cloudName || !uploadPreset) {
        throw new Error("❌ Error de Configuración: Las variables de entorno de Cloudinary no están definidas. Revisa .env.local.");
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'siskoven_tasks'); 

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        let errorDetail = response.statusText;
        try {
            const errorBody = await response.json();
            errorDetail = errorBody.error?.message || errorDetail;
        } catch (e) {} // Ignorar si el cuerpo no es JSON
        
        throw new Error(`❌ Fallo en la subida a Cloudinary: ${response.statusText} (${errorDetail})`);
    }

    const data = await response.json();
    return data.secure_url; 
}


// =========================================================================
// 🗑️ FUNCIÓN DE ELIMINACIÓN (Llama a tu API Route segura)
// =========================================================================

/**
 * 🔹 Llama a una API Route de tu proyecto para eliminar una imagen de Cloudinary.
 * ⚠️ Importante: La lógica real de eliminación debe ejecutarse en el servidor (API Route)
 * para proteger la API Key y el secreto de Cloudinary.
 * @param imageUrl La URL de la imagen a eliminar.
 */
export async function deleteFileFromCloudinary(imageUrl: string): Promise<void> {
    // La API Route exige el token de la sesión: sin esto responde 401 y no borra
    // nada. Es lo que impide que un desconocido vacíe la cuenta de Cloudinary.
    const usuario = auth.currentUser;
    if (!usuario) {
        throw new Error("Debes tener la sesión abierta para eliminar imágenes.");
    }
    const idToken = await usuario.getIdToken();

    // 1. Llama a tu propia API Route (ej. /api/cloudinary/delete-image)
    const response = await fetch('/api/cloudinary/delete-image', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
        let errorDetail = response.statusText;
        try {
            const errorBody = await response.json();
            errorDetail = errorBody.message || errorDetail;
        } catch (e) {
            // No hacer nada si el cuerpo no es JSON
        } 
        
        console.error(`❌ Fallo en la eliminación via API Route: ${errorDetail}`);
        throw new Error(`Error al eliminar la imagen en Cloudinary: ${errorDetail}`);
    }

}