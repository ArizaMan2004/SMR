// @/lib/services/ordenes-service.ts

import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  getCountFromServer,
  getFirestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OrdenServicio, EstadoOrden, EstadoPago, PaymentLog } from "@/lib/types/orden";

/**
 * 🔹 Crea una nueva orden en Firestore
 */
export async function createOrden(data: OrdenServicio) {
  try {
    const colRef = collection(db, "ordenes"); 
    const docRef = await addDoc(colRef, {
      ...data,
      fecha: data.fecha || new Date().toISOString(),
      estado: data.estado || "PENDIENTE",
      estadoPago: data.estadoPago || "PENDIENTE",
    });
    console.log("✅ Orden creada con ID:", docRef.id);
  } catch (error) {
    console.error("❌ Error al crear la orden:", error);
    throw error;
  }
}

/**
 * 🔹 Actualiza los datos de una orden existente
 */
export async function actualizarOrden(ordenId: string, data: Partial<OrdenServicio>) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    // Extraemos el id para no sobreescribirlo accidentalmente en el documento de Firebase
    const { id, ...dataToUpdate } = data as any; 
    await updateDoc(docRef, dataToUpdate);
    console.log("✅ Orden actualizada:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar la orden:", error);
    throw error;
  }
}

/**
 * 🔹 Actualiza los items o campos específicos de una orden
 */
export async function updateOrdenItemField(ordenId: string, itemsActualizados: any[]) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    await updateDoc(docRef, { items: itemsActualizados });
    console.log("✅ Items actualizados en la orden:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar items:", error);
    throw error;
  }
}

/**
 * 🔹 Escucha en tiempo real los cambios en las órdenes (Optimizada para ahorrar cuota)
 */
export function subscribeToOrdenes(
  userId: string, // Mantenemos el parámetro por si lo usas en otros componentes
  callback: (ordenes: OrdenServicio[], error?: any) => void
) {
  try {
    const colRef = collection(db, "ordenes");

    // ⚠️ Consulta optimizada: Ordena por fecha y trae solo las últimas 150
    const q = query(
      colRef,
      // where("registradoPorUserId", "==", userId), // ← descomenta solo si guardas este campo
      orderBy("fecha", "desc"),
      limit(150) // <-- El límite que protege tu cuota gratuita de Firebase
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as OrdenServicio[];

        callback(data);
      },
      (error) => {
        console.error("Error en la suscripción de órdenes:", error);
        callback([], error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error("Error en subscribeToOrdenes:", error);
    callback([], error);
    return () => {};
  }
}

/**
 * 🔹 Elimina una orden
 */
export async function deleteOrden(ordenId: string) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    await deleteDoc(docRef);
    console.log("🗑️ Orden eliminada:", ordenId);
  } catch (error) {
    console.error("❌ Error al eliminar la orden:", error);
    throw error;
  }
}

/**
 * 🔹 Actualiza el estado de una orden
 */
export async function updateOrdenStatus(ordenId: string, nuevoEstado: EstadoOrden) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    await updateDoc(docRef, { estado: nuevoEstado });
    console.log("🔄 Estado actualizado:", ordenId, "→", nuevoEstado);
  } catch (error) {
    console.error("❌ Error al actualizar el estado:", error);
    throw error;
  }
}

/**
 * 🔹 Actualiza el registro de pagos y estado de pago
 */
export async function updateOrdenPaymentLog(
  ordenId: string,
  nuevoEstadoPago: EstadoPago,
  montoPagadoUSD: number,
  historialPagos: PaymentLog[]
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    await updateDoc(docRef, {
      estadoPago: nuevoEstadoPago,
      montoPagadoUSD,
      registroPagos: historialPagos,
    });
    console.log("💰 Pago actualizado para orden:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar el pago:", error);
    throw error;
  }
}

/**
 * 🔹 Busca una orden específica en todo el historial sin descargar toda la base de datos (1 Lectura)
 */
export async function buscarOrdenEspecifica(numeroDeOrden: string) {
  try {
    const colRef = collection(db, "ordenes");
    const numero = Number(numeroDeOrden);

    // Si la búsqueda no es un número, cancelamos (las órdenes se manejan numéricamente)
    if (isNaN(numero)) {
      return null; 
    }

    // Buscamos exactamente el documento que tenga ese número de orden
    const q = query(colRef, where("ordenNumero", "==", numero));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // Retornamos la orden encontrada
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as OrdenServicio;

  } catch (error) {
    console.error("❌ Error en la búsqueda profunda:", error);
    return null;
  }
}

/**
 * 🔹 Obtiene el número total real de órdenes históricas en la base de datos (Cuesta solo 1 lectura)
 */
export async function getTotalOrdenesCount() {
  try {
    const colRef = collection(db, "ordenes");
    const snapshot = await getCountFromServer(colRef);
    return snapshot.data().count;
  } catch (error) {
    console.error("❌ Error al contar las órdenes:", error);
    return 0;
  }
}

/**
 * 🔹 Obtiene las estadísticas reales de todas las órdenes en la base de datos (Cuesta 3 lecturas)
 */
export async function getOrdenesStatsFromServer() {
  try {
    const colRef = collection(db, "ordenes");

    // Contamos según el campo estadoPago que guarda tu sistema
    const qPendientes = query(colRef, where("estadoPago", "==", "PENDIENTE"));
    const snapPendientes = await getCountFromServer(qPendientes);

    const qAbonadas = query(colRef, where("estadoPago", "==", "ABONADO"));
    const snapAbonadas = await getCountFromServer(qAbonadas);

    const qPagadas = query(colRef, where("estadoPago", "==", "PAGADO"));
    const snapPagadas = await getCountFromServer(qPagadas);

    return {
      sinPagar: snapPendientes.data().count,
      abonadas: snapAbonadas.data().count,
      pagadas: snapPagadas.data().count,
    };
  } catch (error) {
    console.error("❌ Error al obtener estadísticas reales:", error);
    return null;
  }
}