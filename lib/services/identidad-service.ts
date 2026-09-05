// @/lib/services/identidad-service.ts
//
// IDENTIDAD DE LA EMPRESA: logo, firma y sello.
//
// Antes vivían en el localStorage de cada navegador, en base64. Eso significaba
// que había que volver a subirlos en cada PC, en cada navegador y cada vez que
// se limpiaba la caché — y que dos empleados podían estar emitiendo PDF con
// sellos distintos sin enterarse.
//
// Son un estándar de la empresa, así que ahora se suben una vez a Cloudinary y
// la URL se guarda en Firestore. Todo el mundo ve lo mismo, se cambia en un
// sitio y se actualiza en todas partes.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "@/lib/services/cloudinary-service";

export type TipoActivo = "logo" | "firma" | "sello";

export interface IdentidadEmpresa {
    logoUrl?: string;
    firmaUrl?: string;
    selloUrl?: string;
    actualizadoEn?: string;
    actualizadoPor?: string;
}

const REF = () => doc(db, "configuracion", "identidad");

const CAMPO: Record<TipoActivo, keyof IdentidadEmpresa> = {
    logo: "logoUrl",
    firma: "firmaUrl",
    sello: "selloUrl",
};

/** Escucha los cambios: si alguien cambia el sello, todos lo ven al momento. */
export const subscribeToIdentidad = (callback: (i: IdentidadEmpresa) => void) => {
    return onSnapshot(
        REF(),
        snap => callback((snap.exists() ? snap.data() : {}) as IdentidadEmpresa),
        error => {
            console.error("Error leyendo la identidad de la empresa:", error);
            callback({});
        }
    );
};

export const cargarIdentidad = async (): Promise<IdentidadEmpresa> => {
    try {
        const snap = await getDoc(REF());
        return (snap.exists() ? snap.data() : {}) as IdentidadEmpresa;
    } catch (error) {
        console.error("Error cargando la identidad de la empresa:", error);
        return {};
    }
};

/**
 * Sube un archivo a Cloudinary y guarda su URL.
 * Si ya había uno, se borra el anterior para no dejar basura acumulada.
 */
export const guardarActivo = async (
    tipo: TipoActivo,
    file: File,
    usuario?: string
): Promise<string> => {
    const anterior = (await cargarIdentidad())[CAMPO[tipo]] as string | undefined;

    const url = await uploadFileToCloudinary(file);

    await setDoc(
        REF(),
        {
            [CAMPO[tipo]]: url,
            actualizadoEn: new Date().toISOString(),
            ...(usuario ? { actualizadoPor: usuario } : {}),
        },
        { merge: true }
    );

    // El borrado del viejo va después de guardar el nuevo y sin bloquear:
    // si fallara, lo peor que pasa es que quede una imagen huérfana en
    // Cloudinary, no que la empresa se quede sin sello.
    if (anterior && anterior !== url) {
        deleteFileFromCloudinary(anterior).catch(e =>
            console.warn("No se pudo borrar el archivo anterior de Cloudinary:", e)
        );
    }

    return url;
};

export const eliminarActivo = async (tipo: TipoActivo): Promise<void> => {
    const actual = (await cargarIdentidad())[CAMPO[tipo]] as string | undefined;

    await setDoc(REF(), { [CAMPO[tipo]]: "", actualizadoEn: new Date().toISOString() }, { merge: true });

    if (actual) {
        deleteFileFromCloudinary(actual).catch(e =>
            console.warn("No se pudo borrar el archivo de Cloudinary:", e)
        );
    }
};

// --- PARA LOS PDF ---

/**
 * Los PDF se arman con pdfmake, que necesita la imagen en base64: no sabe ir a
 * buscar una URL. Se descarga una vez y se guarda en memoria para no bajar la
 * misma imagen en cada presupuesto que se imprima.
 */
const cacheBase64 = new Map<string, string>();

export const urlABase64 = async (url?: string): Promise<string | undefined> => {
    if (!url) return undefined;
    if (cacheBase64.has(url)) return cacheBase64.get(url);

    try {
        const respuesta = await fetch(url, { mode: "cors" });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const blob = await respuesta.blob();

        const base64 = await new Promise<string>((resolve, reject) => {
            const lector = new FileReader();
            lector.onloadend = () => resolve(lector.result as string);
            lector.onerror = reject;
            lector.readAsDataURL(blob);
        });

        cacheBase64.set(url, base64);
        return base64;
    } catch (error) {
        console.error("No se pudo convertir la imagen a base64 para el PDF:", url, error);
        return undefined;
    }
};

/** Las tres imágenes ya en base64, listas para pdfmake. */
export const identidadParaPDF = async (identidad: IdentidadEmpresa) => {
    const [logo, firma, sello] = await Promise.all([
        urlABase64(identidad.logoUrl),
        urlABase64(identidad.firmaUrl),
        urlABase64(identidad.selloUrl),
    ]);
    return { logo, firma, sello };
};
