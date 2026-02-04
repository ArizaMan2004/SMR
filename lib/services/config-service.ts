// @/lib/services/config-service.ts
import { db } from "@/lib/firebase"
import { doc, setDoc, onSnapshot } from "firebase/firestore"

const CONFIG_DOC_ID = "task_keywords_v1"; // ID fijo para la configuración global

export const DEFAULT_KEYWORDS = {
    IMPRESION: [
        "MICROPERFORADO", "VINIL", "BANNER", "LONA", "LONNA", "STICKER", "STICIKER", "STIKER", 
        "ETIQUETA", "IMPRESION", "IMPRESIÓN", "OJALES", "LAMINACION", "LAMINACIÓN", "PENDON", 
        "PENDÓN", "FROSTED", "VINILO", "DTF", "SUBLIMACION"
    ],
    CORTE: [
        "SEÑALETICA", "SEÑALÉTICA", "ACRILICO", "ACRÍLICO", "MEDALLA", "BOLSILLO", "CARTULINA", 
        "SERVILLETERO", "CORTE", "PVC", "SEPARADOR", "MDF", "TROFEO", "LETRAS", "CORPOREO", "CORPÓREO"
    ],
    DISENO: [
        "DISEÑO", "DISENO", "DIBUJO", "ARTE", "LOGO", "VECTOR", "FLYER", "POST", "REDES", 
        "BRANDING", "EDITAR", "EDICION", "EDICIÓN", "PROPUESTA"
    ]
};

// Suscribirse a cambios en tiempo real
export const subscribeToKeywords = (callback: (data: any) => void) => {
    const docRef = doc(db, "config", CONFIG_DOC_ID);
    return onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        } else {
            // Si no existe, crearlo con defaults
            setDoc(docRef, DEFAULT_KEYWORDS);
            callback(DEFAULT_KEYWORDS);
        }
    });
};

// Guardar cambios
export const saveKeywordsConfig = async (newKeywords: any) => {
    const docRef = doc(db, "config", CONFIG_DOC_ID);
    await setDoc(docRef, newKeywords, { merge: true });
};