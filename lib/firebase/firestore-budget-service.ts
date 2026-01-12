// src/lib/services/firestore-budget-service.ts

import { db } from "@/lib/firebase/firebase-config"; 
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    deleteDoc, 
    doc, 
    setDoc, // Necesario para actualizar documentos existentes
    serverTimestamp 
} from "firebase/firestore";

// --- INTERFACES DE DATOS ---
export interface BudgetItem {
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitarioUSD: number;
    totalUSD: number;
}

export interface DbBudgetEntry {
    id?: string; // ID de Firestore (opcional al crear, obligatorio al editar)
    clienteNombre: string;
    items: BudgetItem[];
    totalUSD: number;
    dateCreated: string;
    userId?: string;
}

const BUDGETS_COLLECTION = "budgets";

/**
 * Guarda o Actualiza un presupuesto en Firestore.
 * Si el objeto tiene un 'id', lo actualiza. Si no, crea uno nuevo.
 */
export async function saveBudgetToFirestore(budgetData: DbBudgetEntry): Promise<string> {
    try {
        // 1. Extraemos el ID y separamos el resto de los datos para el payload
        const { id, ...data } = budgetData;

        // 2. Limpieza de datos: Evitar enviar valores 'undefined' que rompen Firebase
        const cleanData = JSON.parse(JSON.stringify(data));

        if (id) {
            // --- MODO ACTUALIZACIÓN ---
            // Usamos setDoc para apuntar al ID específico que ya existe
            const docRef = doc(db, BUDGETS_COLLECTION, id);
            
            // merge: true asegura que no se borren otros campos si existieran
            await setDoc(docRef, cleanData, { merge: true });
            console.log("Presupuesto actualizado:", id);
            return id;
        } else {
            // --- MODO CREACIÓN ---
            // Si no hay ID, addDoc genera uno nuevo automáticamente
            const docRef = await addDoc(collection(db, BUDGETS_COLLECTION), cleanData);
            console.log("Nuevo presupuesto creado con ID:", docRef.id);
            return docRef.id;
        }
    } catch (e) {
        console.error("Error en saveBudgetToFirestore:", e);
        throw new Error("No se pudo procesar la solicitud en la base de datos.");
    }
}

/**
 * Carga todo el historial de presupuestos ordenados por fecha.
 */
export async function loadBudgetsFromFirestore(): Promise<DbBudgetEntry[]> {
    try {
        const q = query(
            collection(db, BUDGETS_COLLECTION), 
            orderBy("dateCreated", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        const budgets: DbBudgetEntry[] = [];

        querySnapshot.forEach((doc) => {
            budgets.push({
                id: doc.id, // Capturamos el ID real de Firestore
                ...doc.data(),
            } as DbBudgetEntry);
        });

        return budgets;
    } catch (e) {
        console.error("Error al cargar presupuestos:", e);
        return []; 
    }
}

/**
 * Elimina un presupuesto permanentemente usando su ID de Firestore.
 */
export async function deleteBudgetFromFirestore(id: string): Promise<void> {
    if (!id) {
        console.error("Intento de borrar sin ID válido");
        return;
    }

    try {
        const docRef = doc(db, BUDGETS_COLLECTION, id);
        await deleteDoc(docRef);
        console.log("Documento eliminado:", id);
    } catch (e) {
        console.error("Error al eliminar presupuesto:", e);
        throw new Error("Error al eliminar el registro de la base de datos.");
    }
}