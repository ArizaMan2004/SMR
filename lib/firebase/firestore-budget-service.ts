// src/lib/services/firestore-budget-service.ts

import { db } from "@/lib/firebase/firebase-config"; // Asegúrate de que tu archivo de configuración de Firebase existe y exporta 'db'
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";

// --- TIPOS DE DATOS BASE ---
interface BudgetItem {
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitarioUSD: number;
    totalUSD: number;
}

interface BudgetData {
    clienteNombre: string;
    items: BudgetItem[];
}

// Interfaz para la entrada de la base de datos (DbBudgetEntry)
export interface DbBudgetEntry extends BudgetData {
    id?: string; // El ID de Firestore
    dateCreated: string; // Fecha de creación persistente (ISO String)
    totalUSD: number;
}

const BUDGETS_COLLECTION = "budgets"; // Nombre de la colección en Firestore

/**
 * Guarda un nuevo presupuesto en Firestore.
 */
export async function saveBudgetToFirestore(budgetData: Omit<DbBudgetEntry, 'id'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, BUDGETS_COLLECTION), budgetData);
        return docRef.id;
    } catch (e) {
        console.error("Error al añadir documento a Firestore: ", e);
        throw new Error("No se pudo guardar el presupuesto en la base de datos.");
    }
}

/**
 * Carga todo el historial de presupuestos desde Firestore.
 */
export async function loadBudgetsFromFirestore(): Promise<DbBudgetEntry[]> {
    try {
        // Consulta: Obtener documentos ordenados por fecha de creación descendente
        const q = query(collection(db, BUDGETS_COLLECTION), orderBy("dateCreated", "desc"));
        const querySnapshot = await getDocs(q);
        
        const budgets: DbBudgetEntry[] = [];
        querySnapshot.forEach((doc) => {
            budgets.push({
                id: doc.id,
                ...doc.data(),
            } as DbBudgetEntry);
        });
        return budgets;
    } catch (e) {
        console.error("Error al cargar documentos desde Firestore: ", e);
        return []; 
    }
}

/**
 * Elimina un presupuesto de Firestore por su ID.
 */
export async function deleteBudgetFromFirestore(id: string): Promise<void> {
    try {
        await deleteDoc(doc(db, BUDGETS_COLLECTION, id));
    } catch (e) {
        console.error("Error al eliminar documento de Firestore: ", e);
        throw new Error("No se pudo eliminar el presupuesto de la base de datos.");
    }
}