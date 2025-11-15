// @/lib/firebase/clientes.ts

import { db } from './firebase-config'; 
// Asegúrate de que esta ruta sea correcta para tu configuración de Firestore
import { collection, getDocs, setDoc, doc, query, orderBy, deleteDoc } from 'firebase/firestore'; 

// -------------------------------------------------------------------
// TIPOS DE DATOS DEL CLIENTE EN FIRESTORE
// -------------------------------------------------------------------

const PREFIJOS_RIF = ["V", "E", "P", "R", "J", "G"] as const;
const PREFIJOS_TELEFONO = ["0412", "0422", "0414", "0424", "0416", "0426"] as const;

export interface ClienteFirestore {
    id?: string; 
    nombreRazonSocial: string;
    telefonoCompleto: string; 
    rifCedulaCompleto: string; 
    
    prefijoTelefono: typeof PREFIJOS_TELEFONO[number];
    numeroTelefono: string; 
    prefijoRif: typeof PREFIJOS_RIF[number];
    numeroRif: string; 
    
    domicilioFiscal: string;
    correo: string;
    // ✅ CORRECCIÓN: Ahora acepta string o null, no undefined.
    personaContactoCliente: string | null; 
    
    fechaCreacion: string; 
}

// -------------------------------------------------------------------
// FUNCIONES DE INTERACCIÓN CON FIRESTORE
// -------------------------------------------------------------------

/**
 * Obtiene todos los clientes frecuentes de la colección 'clientes'.
 */
export async function getFrequentClients(): Promise<ClienteFirestore[]> {
    try {
        const q = query(collection(db, "clientes"), orderBy("nombreRazonSocial"));
        const snapshot = await getDocs(q);
        
        const clientes: ClienteFirestore[] = [];
        snapshot.forEach((doc) => {
            clientes.push({ id: doc.id, ...doc.data() } as ClienteFirestore);
        });
        
        return clientes;
    } catch (error) {
        console.error("Error al obtener los clientes frecuentes:", error);
        return []; 
    }
}

/**
 * Guarda un cliente nuevo o actualiza uno existente.
 */
export async function saveClient(clientData: Omit<ClienteFirestore, 'id' | 'fechaCreacion'>, existingId?: string): Promise<string> {
    const dataToSave = {
        ...clientData,
        fechaCreacion: new Date().toISOString(),
    };
    
    // 1. Si existe un ID, actualiza el documento.
    // ✅ CORRECCIÓN: Se usa 'NEW' y no 'nuevo' para el chequeo
    if (existingId && existingId !== 'NEW' && existingId !== 'CUSTOM') {
        const docRef = doc(db, "clientes", existingId);
        await setDoc(docRef, dataToSave, { merge: true });
        return existingId;
    } 
    // 2. Si es un cliente nuevo ('NEW' o 'CUSTOM' o undefined), crea un nuevo documento con un ID automático.
    else {
        const newDocRef = doc(collection(db, "clientes"));
        await setDoc(newDocRef, dataToSave);
        return newDocRef.id;
    }
}

/**
 * Elimina un cliente de la base de datos por su ID.
 */
export async function deleteClient(clientId: string): Promise<void> {
    try {
        if (!clientId) {
            throw new Error("El ID del cliente es necesario para la eliminación.");
        }
        const docRef = doc(db, "clientes", clientId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error al eliminar el cliente:", error);
        throw error;
    }
}