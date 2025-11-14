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
  getDoc, // 👈 NECESARIO: Importar getDoc para leer el documento
  getFirestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Asegúrate de que esta ruta a tu instancia de db sea correcta
import type { OrdenServicio, EstadoOrden, EstadoPago, PaymentLog, ItemOrden } from "@/lib/types/orden"; // 👈 NECESARIO: Importar ItemOrden

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
    // Puedes ajustar el query si necesitas filtrar por usuario o algún otro criterio
    const q = query(colRef, orderBy("fecha", "desc")); 

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordenes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as OrdenServicio[];
        callback(ordenes);
      },
      (error) => {
        console.error("Error al escuchar órdenes:", error);
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
      montoPagadoUSD: montoPagadoUSD,
      historialPagos: historialPagos,
    });
    console.log("💲 Pago actualizado:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar el pago:", error);
  }
}


// =========================================================================
// ✅ NUEVA FUNCIÓN PARA ACTUALIZAR IMÁGENES DEL ÍTEM (Cloudinary)
// =========================================================================

/**
 * 🔹 Encuentra y actualiza el array 'imagenes' de un ítem específico dentro de la orden.
 * * @param ordenId ID del documento de la orden.
 * @param itemNombre El nombre del ítem (se usa como identificador, **NOTA**: usar un ID único por ítem es más seguro).
 * @param newImages El array completo de URLs de imágenes (incluyendo la URL recién subida).
 */
export async function updateItemImagesInOrden(
  ordenId: string, 
  itemNombre: string, 
  newImages: string[]
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    
    // 1. OBTENER el documento actual de la orden
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Documento de orden con ID ${ordenId} no encontrado.`);
    }

    // 2. Obtener el array de ítems y buscar el ítem a actualizar
    const ordenData = docSnap.data() as OrdenServicio;
    let items: ItemOrden[] = ordenData.items || [];
    let itemIndex = items.findIndex(item => item.nombre === itemNombre);

    if (itemIndex === -1) {
      // NOTA: Si usaras un ID único en lugar del nombre, este error es menos probable.
      throw new Error(`Ítem con nombre '${itemNombre}' no encontrado en la orden ${ordenId}.`);
    }

    // 3. Modificar el array de ítems (creando una copia inmutable)
    const updatedItems = items.map((item, index) => {
      if (index === itemIndex) {
        // Clonar el ítem y actualizar solo el campo 'imagenes'
        return { 
          ...item, 
          imagenes: newImages 
        };
      }
      return item;
    });

    // 4. GUARDAR el array de items modificado en Firestore
    await updateDoc(docRef, { 
      items: updatedItems 
    });

    console.log(`✅ Imágenes del ítem '${itemNombre}' actualizadas en orden ${ordenId}.`);
  } catch (error) {
    console.error("❌ Error al actualizar las imágenes del ítem:", error);
    // Propagar el error para que el modal lo pueda capturar y mostrar
    throw new Error("Fallo al guardar la URL en la base de datos: " + (error as Error).message);
  }
}