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
  getFirestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OrdenServicio, EstadoOrden, EstadoPago, PaymentLog } from "@/lib/types/orden";

/**
 * 🔹 Crea una nueva orden en Firestore
 */
export async function createOrden(data: OrdenServicio) {
  try {
    const colRef = collection(db, "ordenes"); // Asegúrate de que este nombre coincida con tu colección real
    const docRef = await addDoc(colRef, {
      ...data,
      fecha: data.fecha || new Date().toISOString(),
      estado: data.estado || "PENDIENTE",
      estadoPago: data.estadoPago || "PENDIENTE",
    });
    console.log("✅ Orden creada con ID:", docRef.id);
  } catch (error) {
    console.error("❌ Error al crear la orden:", error);
  }
}

/**
 * 🔹 Escucha en tiempo real los cambios en las órdenes
 */
export function subscribeToOrdenes(
  userId: string,
  callback: (ordenes: OrdenServicio[], error?: any) => void
) {
  try {
    const colRef = collection(db, "ordenes");

    // ⚠️ Si tus órdenes NO tienen un campo de usuario, elimina el filtro "where"
    const q = query(
      colRef,
      // where("registradoPorUserId", "==", userId), // ← descomenta solo si guardas este campo
      orderBy("fecha", "desc")
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
  }
}
