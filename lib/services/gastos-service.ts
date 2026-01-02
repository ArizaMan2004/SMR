// @/lib/services/gastos-service.ts
import { 
    collection, 
    addDoc, 
    query, 
    onSnapshot, 
    orderBy, 
    Timestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase-config"; //
import { type Gasto } from "@/components/dashboard/AccountsPayableView";

const COLLECTION_NAME = "gastos";

// 1. Guardar un nuevo gasto en Firebase
export const createGasto = async (gastoData: Omit<Gasto, 'id'>) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...gastoData,
            createdAt: Timestamp.now() // Timestamp para orden exacto
        });
        return docRef.id;
    } catch (error) {
        console.error("Error al crear gasto en Firebase:", error);
        throw error;
    }
};

// 2. Suscribirse a los gastos en tiempo real
export const subscribeToGastos = (callback: (data: Gasto[]) => void) => {
    const q = query(
        collection(db, COLLECTION_NAME), 
        orderBy("fecha", "desc") // Ordenar por la fecha del gasto
    );

    return onSnapshot(q, (snapshot) => {
        const gastos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Gasto[];
        callback(gastos);
    }, (error) => {
        console.error("Error en suscripción de gastos:", error);
    });
};