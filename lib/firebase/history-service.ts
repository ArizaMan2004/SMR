// lib/history-service.ts
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";

// --- Guardar ---
export const saveCalculation = async (collectionName: 'calculos_area' | 'calculos_laser', data: any) => {
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: Timestamp.now() // Para ordenar por fecha real
        });
        return { ...data, id: docRef.id }; // Devolvemos el objeto con el ID de Firebase
    } catch (e) {
        console.error("Error guardando documento: ", e);
        throw e;
    }
};

// --- Leer ---
export const getHistory = async (collectionName: 'calculos_area' | 'calculos_laser') => {
    try {
        const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (e) {
        console.error("Error leyendo historial: ", e);
        return [];
    }
};

// --- Borrar ---
export const deleteCalculation = async (collectionName: 'calculos_area' | 'calculos_laser', id: string) => {
    try {
        await deleteDoc(doc(db, collectionName, id));
    } catch (e) {
        console.error("Error borrando documento: ", e);
        throw e;
    }
};