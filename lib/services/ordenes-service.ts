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
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; 
// Asegúrate de que tus tipos estén actualizados en @/lib/types/orden
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
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, updatePayload);
    console.log("✅ Orden actualizada:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar la orden:", error);
    throw error;
  }
}

// =========================================================================
// 🎨 GESTIÓN DE DISEÑO Y PRODUCCIÓN
// =========================================================================

/**
 * 🔹 Actualiza datos de nivel superior de diseño (Diseñador asignado globalmente o estado general)
 */
export async function updateOrdenDesign(
  ordenId: string, 
  data: { designerId?: string; designStatus?: string }
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
    console.log("🎨 Datos de diseño actualizados:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar diseño:", error);
    throw error;
  }
}

/**
 * 🔹 Actualiza un campo específico de UN ÍTEM dentro de la orden.
 * Vital para marcar diseños individuales como PAGADOS o cambiar sus detalles sin reescribir toda la orden.
 */
export async function updateOrdenItemField(
  ordenId: string, 
  itemIndex: number, 
  updates: { [key: string]: any }
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Orden no encontrada");

    const ordenData = docSnap.data() as OrdenServicio;
    
    // Clonamos el array de items para no mutar directamente
    const newItems = [...(ordenData.items || [])];

    if (!newItems[itemIndex]) throw new Error(`Ítem en índice ${itemIndex} no encontrado`);

    // Actualizamos solo los campos solicitados del ítem específico
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      ...updates
    };

    await updateDoc(docRef, { 
        items: newItems,
        updatedAt: new Date().toISOString()
    });
    console.log(`✅ Ítem ${itemIndex} actualizado en orden ${ordenId} con:`, updates);
  } catch (error) {
    console.error("❌ Error actualizando campo de ítem:", error);
    throw error;
  }
}

// =========================================================================
// 🔄 SUSCRIPCIONES Y ELIMINACIÓN
// =========================================================================

/**
 * 🔹 Escucha en tiempo real los cambios en las órdenes
 */
export function subscribeToOrdenes(
  userId: string,
  callback: (ordenes: OrdenServicio[], error?: any) => void
) {
  try {
    const colRef = collection(db, "ordenes");
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

// =========================================================================
// 💰 GESTIÓN DE PAGOS Y ESTADOS GENERALES
// =========================================================================

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
      registroPagos: historialPagos, 
    });
    console.log("💲 Pago actualizado:", ordenId);
  } catch (error) {
    console.error("❌ Error al actualizar el pago:", error);
    throw error;
  }
}

export async function registrarPago(ordenId: string, transaccion: PagoTransaction) {
    try {
        const docRef = doc(db, "ordenes", ordenId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Orden no encontrada");

        const ordenData = docSnap.data() as OrdenServicio;
        
        // @ts-ignore
        const historialActual: PagoTransaction[] = ordenData.registroPagos || ordenData.historialPagos || [];
        const nuevoHistorial = [...historialActual, transaccion];
        const nuevoMontoPagado = nuevoHistorial.reduce((acc, curr) => acc + (curr.montoUSD || curr.monto || 0), 0);
        
        let nuevoEstadoPago = EstadoPago.PENDIENTE;
        if (nuevoMontoPagado >= (ordenData.totalUSD - 0.01)) { 
            nuevoEstadoPago = EstadoPago.PAGADO;
        } else if (nuevoMontoPagado > 0) {
            nuevoEstadoPago = EstadoPago.ABONADO;
        }

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
// 🖼️ GESTIÓN DE IMÁGENES (Detalles de Tareas)
// =========================================================================

export async function updateItemImagesInOrden(
  ordenId: string, 
  itemNombre: string, 
  newImages: string[],
  fieldName: 'imagenes' | 'pruebasImagenes' = 'imagenes'
) {
  try {
    const docRef = doc(db, "ordenes", ordenId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error(`Orden ${ordenId} no encontrada.`);

    const ordenData = docSnap.data() as OrdenServicio;
    let items: ItemOrden[] = ordenData.items || [];
    
    let itemIndex = items.findIndex(item => item.nombre === itemNombre);

    if (itemIndex === -1) throw new Error(`Ítem '${itemNombre}' no encontrado.`);

    const updatedItems = items.map((item, index) => {
      if (index === itemIndex) {
        return { 
          ...item, 
          [fieldName]: newImages 
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