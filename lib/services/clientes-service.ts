// @/lib/services/clientes-service.ts
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, // <--- IMPORTADO PARA PROTEGER TU CUOTA SPARK
  doc, 
  getDocs, 
  where 
} from "firebase/firestore";

/**
 * 🔹 Suscribe al Dashboard a los cambios en la colección de clientes.
 * OPTIMIZACIÓN: Solo trae los 100 clientes más recientes para ahorrar lecturas.
 */
export const subscribeToClients = (callback: (clients: any[]) => void) => {
  // Ordenamos por nombre para que la lista sea útil, pero limitamos a 100
  const q = query(
    collection(db, "clientes"), 
    orderBy("nombreRazonSocial", "asc"),
    limit(100) 
  );
  
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

/**
 * 🔹 Búsqueda específica de un cliente por RIF o Cédula (Búsqueda Profunda)
 * Esto permite encontrar un cliente que no esté en los 100 recientes gastando solo 1 lectura.
 */
export const buscarClientePorRif = async (rifCedula: string) => {
  try {
    const q = query(
      collection(db, "clientes"), 
      where("rifCedulaCompleto", "==", rifCedula.trim().toUpperCase())
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error("Error buscando cliente:", error);
    return null;
  }
};