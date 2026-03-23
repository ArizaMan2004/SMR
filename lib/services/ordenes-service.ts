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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OrdenServicio, EstadoOrden, EstadoPago, PaymentLog } from "@/lib/types/orden";

/**
 * 🔹 Crea una nueva orden en Firestore (NIVEL PRO: Con campo de búsqueda optimizado)
 */
export async function createOrden(data: OrdenServicio) {
  try {
    const colRef = collection(db, "ordenes"); 
    
    // Guardamos el nombre todo en minúsculas en un campo oculto para búsquedas rápidas
    const clienteBusqueda = data.cliente?.nombreRazonSocial ? data.cliente.nombreRazonSocial.toLowerCase() : "";

    const docRef = await addDoc(colRef, {
      ...data,
      clienteBusqueda,
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
    const { id, ...dataToUpdate } = data as any; 
    
    // Si editan el nombre del cliente, actualizamos el campo oculto de búsqueda también
    if (dataToUpdate.cliente && dataToUpdate.cliente.nombreRazonSocial) {
        dataToUpdate.clienteBusqueda = dataToUpdate.cliente.nombreRazonSocial.toLowerCase();
    }

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
 * 🔹 Escucha en tiempo real los cambios en las órdenes (Trae las últimas 150)
 */
export function subscribeToOrdenes(
  userId: string, 
  callback: (ordenes: OrdenServicio[], error?: any) => void
) {
  try {
    const colRef = collection(db, "ordenes");

    const q = query(
      colRef,
      orderBy("fecha", "desc"),
      limit(150) 
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
 * 🔹 Busca una orden específica
 */
export async function buscarOrdenEspecifica(numeroDeOrden: string) {
  try {
    const colRef = collection(db, "ordenes");
    const numero = Number(numeroDeOrden);

    if (isNaN(numero)) {
      return null; 
    }

    const q = query(colRef, where("ordenNumero", "==", numero));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as OrdenServicio;

  } catch (error) {
    console.error("❌ Error en la búsqueda profunda:", error);
    return null;
  }
}

/**
 * 🔹 Obtiene el número total real de órdenes históricas
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
 * 🔹 Obtiene las estadísticas reales de todas las órdenes en la base de datos
 */
export async function getOrdenesStatsFromServer() {
  try {
    const colRef = collection(db, "ordenes");

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

/**
 * 🔹 Busca órdenes en todo el historial (A PRUEBA DE BALAS: 100% Funcional para registros nuevos y viejos)
 */
export async function buscarOrdenesHistoricas(searchTerm: string) {
  try {
    const colRef = collection(db, "ordenes");
    
    // Limpiamos espacios basura al inicio y al final
    const term = searchTerm.trim();
    if (!term) return [];

    // Preparamos todas las combinaciones posibles
    const termLower = term.toLowerCase(); // "edward producciones"
    const termUpper = term.toUpperCase(); // "EDWARD PRODUCCIONES"
    const termCap = term.charAt(0).toUpperCase() + termLower.slice(1); // "Edward producciones"
    const numTerm = Number(term);

    const promesas = [];

    // 1. Búsqueda Numérica Exacta (Si ingresaron un número de orden válido)
    if (!isNaN(numTerm)) {
      promesas.push(getDocs(query(colRef, where("ordenNumero", "==", numTerm))));
    }

    // 2. Búsqueda por RIF/Cédula
    promesas.push(getDocs(query(colRef, where("cliente.rifCedula", "==", termUpper))));
    promesas.push(getDocs(query(colRef, where("cliente.rifCedula", "==", termLower))));
    
    // 3. Búsqueda en el Nuevo Campo Optimizado (Para facturas recientes/futuras)
    promesas.push(getDocs(query(
        colRef, 
        where("clienteBusqueda", ">=", termLower),
        where("clienteBusqueda", "<=", termLower + '\uf8ff')
    )));

    // 4. Búsqueda Legacy por Nombre (Para facturas viejas guardadas de diferentes formas)
    promesas.push(getDocs(query(
        colRef, 
        where("cliente.nombreRazonSocial", ">=", termUpper),
        where("cliente.nombreRazonSocial", "<=", termUpper + '\uf8ff')
    )));
    promesas.push(getDocs(query(
        colRef, 
        where("cliente.nombreRazonSocial", ">=", termLower),
        where("cliente.nombreRazonSocial", "<=", termLower + '\uf8ff')
    )));
    promesas.push(getDocs(query(
        colRef, 
        where("cliente.nombreRazonSocial", ">=", termCap),
        where("cliente.nombreRazonSocial", "<=", termCap + '\uf8ff')
    )));

    // Ejecutamos TODAS las búsquedas al mismo tiempo
    const snapshots = await Promise.all(promesas);
    
    // Agrupamos en un Map usando el ID del documento para asegurar que NINGUNA orden se duplique en la tabla
    const resultadosMap = new Map();
    
    snapshots.forEach((snap) => {
      snap.forEach((doc) => {
        resultadosMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    });

    return Array.from(resultadosMap.values());
  } catch (error) {
    console.error("❌ Error buscando en el historial:", error);
    return [];
  }
}

/**
 * 🔹 Suscribe al NewsBar SOLO a las órdenes que no han sido pagadas por completo (PENDIENTE).
 */
export const subscribeToDeudasActivas = (callback: (ordenes: any[]) => void) => {
    const q = query(
        collection(db, "ordenes"),
        where("estadoPago", "==", "PENDIENTE") 
    );

    return onSnapshot(q, (snapshot) => {
        const deudas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(deudas);
    }, (error) => {
        console.error("Error cargando deudas activas:", error);
    });
};

/**
 * 🔹 Carga un bloque grande de órdenes recientes para extraer historiales completos (Ej. Diseños pagados viejos)
 * Solo consume las lecturas necesarias sin explotar la cuota de Firebase.
 */
export async function cargarHistorialMasivo() {
  try {
    const q = query(collection(db, "ordenes"), orderBy("fecha", "desc"), limit(800));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as OrdenServicio[];
  } catch (error) {
    console.error("❌ Error cargando historial masivo:", error);
    return [];
  }
}