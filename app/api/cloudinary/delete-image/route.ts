// /app/api/cloudinary/delete-image/route.ts

import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configura Cloudinary (asegúrate de que estas variables estén en .env.local o donde sea tu secreto)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // ⚠️ DEBE SER SECRETA
    api_key: process.env.CLOUDINARY_API_KEY,       // ⚠️ DEBE SER SECRETA
    api_secret: process.env.CLOUDINARY_API_SECRET, // ⚠️ DEBE SER SECRETA
});

/**
 * Función para extraer el Public ID de la URL de Cloudinary
 * Ej: '.../v123456789/siskoven_tasks/my_image.jpg' -> 'siskoven_tasks/my_image'
 */
function getPublicIdFromUrl(imageUrl: string): string | null {
    // 1. Expresión regular para capturar la parte después de /v[timestamp]/
    const regex = /\/v\d+\/(.*)\.[a-zA-Z0-9]+$/;
    const match = imageUrl.match(regex);
    
    if (match && match[1]) {
        // Elimina el timestamp y el dominio, deja el folder/public_id
        return match[1];
    }
    return null;
}

export async function DELETE(request: Request) {
    try {
        const { imageUrl } = await request.json();

        if (!imageUrl) {
            return NextResponse.json({ message: 'URL de imagen no proporcionada' }, { status: 400 });
        }

        const publicId = getPublicIdFromUrl(imageUrl);

        if (!publicId) {
            console.warn(`No se pudo extraer el Public ID de la URL: ${imageUrl}`);
            // Aún si no se extrae, podemos responder OK si la DB se limpió.
            // Aquí elegimos enviar un error para depuración.
             return NextResponse.json({ message: 'No se pudo identificar el recurso en Cloudinary.' }, { status: 400 });
        }

        // 2. Llamada real a la API de eliminación de Cloudinary
        const result = await cloudinary.uploader.destroy(publicId);

        if (result.result !== 'ok' && result.result !== 'not found') {
            console.error('Error de Cloudinary al eliminar:', result);
            throw new Error(`Error en el servicio de Cloudinary: ${result.result}`);
        }

        // Si 'ok' o 'not found' (ya estaba eliminada)
        return NextResponse.json({ message: 'Imagen eliminada exitosamente' });

    } catch (error: any) {
        console.error('Error al procesar la solicitud de eliminación:', error);
        return NextResponse.json({ message: 'Error interno del servidor al eliminar imagen', error: error.message }, { status: 500 });
    }
}