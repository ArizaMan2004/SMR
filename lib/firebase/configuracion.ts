// @/lib/firebase/configuracion.ts
import { db } from "./firebase-config"; // Asegúrate de que la ruta sea correcta
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";

export interface CustomColor {
    id?: string;
    label: string;
    value: string;
    emoji: string;
    createdAt: string;
}

// Escuchar cambios en tiempo real en la colección de colores
export const subscribeToColors = (callback: (colors: CustomColor[]) => void) => {
    const q = query(collection(db, "colores_personalizados"), orderBy("label", "asc"));
    return onSnapshot(q, (snapshot) => {
        const colors = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CustomColor[];
        callback(colors);
    });
};

// Guardar un color nuevo permanentemente
export const saveNewColor = async (colorData: Omit<CustomColor, "id" | "createdAt">) => {
    try {
        await addDoc(collection(db, "colores_personalizados"), {
            ...colorData,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error al guardar el color:", error);
        throw error;
    }
};