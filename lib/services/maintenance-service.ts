// @/lib/services/maintenance-service.ts
import { db } from "@/lib/firebase"; 
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
      return { success: true, message: `Se actualizaron ${count} órdenes (Status Cliente) correctamente.` };
    } else {
      return { success: true, message: "Todas las órdenes ya están sincronizadas." };
    }
  } catch (error) {
    console.error("Error en sincronización:", error);
    throw error;
  }
};

// 🔹 NUEVA FUNCIÓN: Arregla los estados de pago rotos o vacíos en Firebase
export const fixAllOrdersPaymentStatus = async () => {
  const batch = writeBatch(db);
  
  try {
    const ordersSnap = await getDocs(collection(db, "ordenes"));
    let count = 0;

    ordersSnap.forEach(orderDoc => {
      const data = orderDoc.data();
      const total = Number(data.totalUSD) || 0;
      const pagado = Number(data.montoPagadoUSD) || 0;
      const deuda = Math.max(0, total - pagado);

      let estadoReal = "PENDIENTE";
      if (pagado >= total && total > 0) estadoReal = "PAGADO";
      else if (pagado > 0 && deuda > 0) estadoReal = "ABONADO";
      else if (total <= 0) estadoReal = "PAGADO"; // Si es 0 (gratis), cuenta como pagado

      // Si el estado en Firebase no coincide con el estado matemático real, lo actualizamos
      if (data.estadoPago !== estadoReal) {
        batch.update(orderDoc.ref, { estadoPago: estadoReal });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      return { success: true, message: `¡Éxito! Se repararon ${count} facturas desconfiguradas.` };
    } else {
      return { success: true, message: "Todas las facturas tienen su estado de pago correcto." };
    }
  } catch (error) {
    console.error("Error reparando estados de pago:", error);
    throw error;
  }
};