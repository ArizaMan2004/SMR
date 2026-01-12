// @/lib/services/clientes-service.ts
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

/**
 * Suscribe al Dashboard a los cambios en la colección de clientes
 * para estadísticas y conteos en tiempo real.
 */
export const subscribeToClients = (callback: (clients: any[]) => void) => {
  const q = query(collection(db, "clientes"));
  
  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(clients);
  }, (error) => {
    console.error("Error en suscripción de clientes:", error);
  });
};