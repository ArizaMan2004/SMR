// @/lib/services/maintenance-service.ts
import { db } from "@/lib/firebase"; // Corregido: ruta según dashboard.tsx
import { collection, getDocs, writeBatch } from "firebase/firestore";

export const syncAllOrdersClientStatus = async () => {
  const batch = writeBatch(db);
  
  try {
    // 1. Obtener todos los clientes actuales
    const clientsSnap = await getDocs(collection(db, "clientes"));
    const clientsMap = new Map();
    
    clientsSnap.forEach(doc => {
      const data = doc.data();
      clientsMap.set(data.rifCedulaCompleto, data.tipoCliente);
    });

    // 2. Obtener todas las órdenes
    const ordersSnap = await getDocs(collection(db, "ordenes"));
    let count = 0;

    ordersSnap.forEach(orderDoc => {
      const orderData = orderDoc.data();
      const clientRif = orderData.cliente?.rifCedula;
      const currentStatus = orderData.cliente?.tipoCliente;

      if (clientRif && clientsMap.has(clientRif)) {
        const newStatus = clientsMap.get(clientRif);
        
        if (currentStatus !== newStatus) {
          batch.update(orderDoc.ref, {
            "cliente.tipoCliente": newStatus
          });
          count++;
        }
      }
    });

    if (count > 0) {
      await batch.commit();
      return { success: true, message: `Se actualizaron ${count} órdenes correctamente.` };
    } else {
      return { success: true, message: "Todas las órdenes ya están sincronizadas." };
    }
  } catch (error) {
    console.error("Error en sincronización:", error);
    throw error;
  }
};