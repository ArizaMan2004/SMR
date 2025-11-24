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
  getDoc,
  getFirestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import type { OrdenServicio, EstadoOrden, EstadoPago, PaymentLog, ItemOrden, PagoTransaction } from "@/lib/types/orden";

/**
 * 🔹 Crea una nueva orden en Firestore
 */
export async function createOrden(data: OrdenServicio) {
  try {
    const colRef = collection(db, "ordenes"); 
    // Aseguramos que se guarden valores por defecto si faltan
    const docRef = await addDoc(colRef, {
      ...data,
      fecha: data.fecha || new Date().toISOString(),
      estado: data.estado || "PENDIENTE",
      estadoPago: data.estadoPago || "PENDIENTE",
      registroPagos: [], // Inicializar historial de pagos vacío
      montoPagadoUSD: 0
    });
    console.log("✅ Orden creada con ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error al crear la orden:", error);
    throw error;
  }
}

/**
 * 🔹 Actualiza los datos generales de una orden existente (Edición desde el Wizard)
 * ESTA ES LA FUNCIÓN QUE FALTABA
 */
export async function actualizarOrden(ordenId: string, data: Partial<OrdenServicio>) {
  try {
    const docRef = doc(db, "ordenes", ordenId);

    // Construimos el payload con los campos que permite editar el formulario
    const updatePayload = {
      cliente: data.cliente,
      items: data.items,
      serviciosSolicitados: data.serviciosSolicitados,
      descripcionDetallada: data.descripcionDetallada || "",
      fechaEntrega: data.fechaEntrega,
      ordenNumero: data.ordenNumero,
      totalUSD: data.totalUSD,
      updatedAt: new Date().toISOString() // Marca de tiempo de actualización
    };

    await updateDoc(docRef, updatePayload);
    console.log("✅ Orden actualizada:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar la orden:", error);
    throw error;
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
    // Ordenar por fecha de creación descendente
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
    throw error;
  }
}

/**
 * 🔹 Actualiza el estado de una orden (Pendiente -> Proceso -> Terminado)
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
 * 🔹 Actualiza SOLO el registro de pagos (Función interna o uso directo)
 */
export async function updateOrdenPaymentLog(
  ordenId: string,
  nuevoEstadoPago: EstadoPago,
  montoPagadoUSD: number,
  historialPagos: PaymentLog[] // O PagoTransaction[]
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    await updateDoc(docRef, { 
      estadoPago: nuevoEstadoPago,
      montoPagadoUSD: montoPagadoUSD,
      registroPagos: historialPagos, // Usamos 'registroPagos' para ser consistentes con tu modelo
    });
    console.log("💲 Pago actualizado:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar el pago:", error);
    throw error;
  }
}

/**
 * 🔹 Registrar un nuevo pago (Función Helper para el Dashboard)
 * Obtiene la orden, calcula el nuevo total y actualiza el historial.
 */
export async function registrarPago(ordenId: string, transaccion: PagoTransaction) {
    try {
        const docRef = doc(db, "ordenes", ordenId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Orden no encontrada");

        const ordenData = docSnap.data() as OrdenServicio;
        
        // Obtener historial actual (o array vacío si no existe)
        // @ts-ignore: Compatibilidad con nombres de campo variables
        const historialActual: PagoTransaction[] = ordenData.registroPagos || ordenData.historialPagos || [];
        
        // Añadir nueva transacción
        const nuevoHistorial = [...historialActual, transaccion];
        
        // Calcular nuevo total pagado
        const nuevoMontoPagado = nuevoHistorial.reduce((acc, curr) => acc + (curr.montoUSD || curr.monto || 0), 0);
        
        // Determinar nuevo estado
        let nuevoEstadoPago = EstadoPago.PENDIENTE;
        if (nuevoMontoPagado >= (ordenData.totalUSD - 0.01)) { // Margen de error pequeño
            nuevoEstadoPago = EstadoPago.PAGADO;
        } else if (nuevoMontoPagado > 0) {
            nuevoEstadoPago = EstadoPago.ABONADO;
        }

        // Actualizar en BD
        await updateDoc(docRef, {
            registroPagos: nuevoHistorial,
            montoPagadoUSD: nuevoMontoPagado,
            estadoPago: nuevoEstadoPago
        });

        console.log("💰 Pago registrado exitosamente en orden:", ordenId);

    } catch (error) {
        console.error("❌ Error registrando pago:", error);
        throw error;
    }
}


// =========================================================================
// ✅ FUNCIÓN PARA ACTUALIZAR IMÁGENES DEL ÍTEM (Para TaskDetailModal)
// =========================================================================

/**
 * 🔹 Encuentra y actualiza el array 'imagenes' o 'pruebasImagenes' de un ítem.
 */
export async function updateItemImagesInOrden(
  ordenId: string, 
  itemNombre: string, 
  newImages: string[],
  fieldName: 'imagenes' | 'pruebasImagenes' = 'imagenes' // Por defecto imagenes (detalles)
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error(`Orden ${ordenId} no encontrada.`);

    const ordenData = docSnap.data() as OrdenServicio;
    let items: ItemOrden[] = ordenData.items || [];
    
    // Buscar índice
    let itemIndex = items.findIndex(item => item.nombre === itemNombre);

    if (itemIndex === -1) throw new Error(`Ítem '${itemNombre}' no encontrado.`);

    // Actualizar array inmutablemente
    const updatedItems = items.map((item, index) => {
      if (index === itemIndex) {
        return { 
          ...item, 
          [fieldName]: newImages // Actualiza dinámicamente el campo correcto
        };
      }
      return item;
    });

    await updateDoc(docRef, { items: updatedItems });
    console.log(`✅ ${fieldName} actualizadas en ítem '${itemNombre}'.`);
  } catch (error) {
    console.error("❌ Error actualizando imágenes:", error);
    throw error;
  }
}