// /app/api/cloudinary/delete-image/route.ts

import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configura Cloudinary (estas variables NO llevan NEXT_PUBLIC_: son secretas y
// solo existen en el servidor).
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Carpetas que esta ruta tiene permitido borrar.
 *
 * Aunque alguien con sesión válida manipule la URL que envía, no podrá tocar
 * nada que esté fuera de aquí (por ejemplo, el logo de la empresa u otros
 * recursos de la cuenta de Cloudinary).
 */
const CARPETAS_PERMITIDAS = ['siskoven_tasks/'];

/**
 * Comprueba contra Google que el token de sesión sea real y de ESTE proyecto.
 *
 * Antes esta ruta no pedía nada: cualquiera en internet podía mandar un DELETE
 * con una URL y borrar imágenes de la cuenta de Cloudinary. Ahora exige el
 * token de Firebase del usuario conectado.
 *
 * Se valida con la API pública de Identity Toolkit en vez de firebase-admin
 * para no añadir dependencias ni credenciales de servicio al despliegue.
 */
async function usuarioValido(request: Request): Promise<boolean> {
    const cabecera = request.headers.get('authorization') || '';
    const idToken = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
    if (!idToken) return false;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
        console.error('Falta NEXT_PUBLIC_FIREBASE_API_KEY: no se puede validar la sesión.');
        return false;
    }

    try {
        const res = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
                cache: 'no-store',
            }
        );
        if (!res.ok) return false;
        const data = await res.json();
        // Un token válido devuelve exactamente un usuario del proyecto.
        return Array.isArray(data.users) && data.users.length > 0;
    } catch (error) {
        console.error('Error validando el token de sesión:', error);
        return false;
    }
}

/**
 * Función para extraer el Public ID de la URL de Cloudinary
 * Ej: '.../v123456789/siskoven_tasks/my_image.jpg' -> 'siskoven_tasks/my_image'
 */
function getPublicIdFromUrl(imageUrl: string): string | null {
    // Solo URLs de Cloudinary: evita que se cuele cualquier otra cosa.
    let url: URL;
    try {
        url = new URL(imageUrl);
    } catch {
        return null;
    }
    if (!url.hostname.endsWith('.cloudinary.com')) return null;

    // Captura la parte después de /v[timestamp]/ y le quita la extensión.
    const match = url.pathname.match(/\/v\d+\/(.*)\.[a-zA-Z0-9]+$/);
    return match && match[1] ? match[1] : null;
}

export async function DELETE(request: Request) {
    try {
        if (!(await usuarioValido(request))) {
            return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
        }

        const { imageUrl } = await request.json();

        if (!imageUrl || typeof imageUrl !== 'string') {
            return NextResponse.json({ message: 'URL de imagen no proporcionada' }, { status: 400 });
        }

        const publicId = getPublicIdFromUrl(imageUrl);

        if (!publicId) {
            console.warn(`No se pudo extraer el Public ID de la URL: ${imageUrl}`);
            return NextResponse.json({ message: 'No se pudo identificar el recurso en Cloudinary.' }, { status: 400 });
        }

        if (!CARPETAS_PERMITIDAS.some(carpeta => publicId.startsWith(carpeta))) {
            console.warn(`Intento de borrar fuera de las carpetas permitidas: ${publicId}`);
            return NextResponse.json({ message: 'Ese recurso no se puede eliminar desde aquí.' }, { status: 403 });
        }

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
