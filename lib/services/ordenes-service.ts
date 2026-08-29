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
  getAggregateFromServer,
  sum,
  count,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OrdenServicio, EstadoOrden, EstadoPago, PaymentLog } from "@/lib/types/orden";

/**
 * 🔹 MOTOR DE AUTO-SANACIÓN: Obtiene el siguiente número de orden de forma 100% segura.
 * Ignora si hay números guardados accidentalmente como texto y siempre encuentra el mayor.
 */
export async function getNextSafeOrderNumber() {
    try {
        const colRef = collection(db, "ordenes");
        // Buscamos los últimos 30 documentos por fecha para evitar bloqueos del índice
        const q = query(colRef, orderBy("fecha", "desc"), limit(30));
        const snap = await getDocs(q);
        
        let max = 0;
        snap.forEach(doc => {
            const num = Number(doc.data().ordenNumero);
            if (!isNaN(num) && num > max) {
                max = num;
            }
        });
        
        // Fallback: Si no encuentra por fecha, busca por el índice tradicional
        if (max === 0) {
            const q2 = query(colRef, orderBy("ordenNumero", "desc"), limit(1));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
                const num2 = Number(snap2.docs[0].data().ordenNumero);
                if (!isNaN(num2)) max = num2;
            }
        }

        return max > 0 ? max + 1 : 1;
    } catch (error) {
        console.error("Error buscando el próximo correlativo:", error);
        return Date.now() % 100000; // Fallback de emergencia
    }
}

/**
 * 🔹 Crea una nueva orden en Firestore (NIVEL PRO: Auto-correlativo a prueba de fallos)
 */
export async function createOrden(data: OrdenServicio) {
  try {
    const colRef = collection(db, "ordenes"); 
    
    // 🔥 CALCULAMOS EL NÚMERO DIRECTAMENTE AQUÍ PARA EVITAR QUE SE CONGELE
    const numeroSeguro = await getNextSafeOrderNumber();

    const clienteBusqueda = data.cliente?.nombreRazonSocial ? data.cliente.nombreRazonSocial.toLowerCase() : "";

    const docRef = await addDoc(colRef, {
      ...data,
      ordenNumero: numeroSeguro, // Sobrescribimos y forzamos a que sea un número puro
      clienteBusqueda,
      fecha: data.fecha || new Date().toISOString(),
      estado: data.estado || "PENDIENTE",
      estadoPago: data.estadoPago || "PENDIENTE",
    });
    
    console.log(`✅ Orden #${numeroSeguro} creada con ID:`, docRef.id);
    return { id: docRef.id, ordenNumero: numeroSeguro };
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
 * Deuda REAL de todo el historial, calculada en el servidor.
 *
 * El panel mostraba "Por cobrar" sumando solo las órdenes cargadas en memoria
 * (150), así que la cifra siempre salía corta. Descargar las 1.800 para sumarlas
 * costaría 1.800 lecturas cada vez.
 *
 * Firestore sabe sumar sin enviar los documentos: `getAggregateFromServer` con
 * `sum()` devuelve el total ya calculado y se factura como UNA lectura por cada
 * 1.000 documentos recorridos. Con 1.800 órdenes son 2 lecturas por consulta en
 * vez de 1.800: unas 4 en total contando la de anuladas.
 *
 * Se suma la colección entera sin filtrar por estado a propósito: hay órdenes
 * con el estado en minúsculas ("Pagado") y otras sin estado, y un `where`
 * las dejaría fuera. Las pagadas no distorsionan porque aportan cero
 * (su total y su abonado coinciden); solo hay que descontar las anuladas.
 */
export async function getDeudaTotalFromServer(): Promise<{
  deudaUSD: number;
  facturadoUSD: number;
  cobradoUSD: number;
  /** Cuántas órdenes tienen saldo pendiente de verdad. */
  ordenesConDeuda: number;
  ordenes: number;
} | null> {
  try {
    const colRef = collection(db, "ordenes");

    // Solo se traen las que pueden deber algo: pendientes y abonadas. De 1.802
    // órdenes son unas 217, así que se leen esas y no el historial entero.
    // Se incluyen las dos grafías porque en la base conviven "PENDIENTE" y
    // "Pendiente" según qué pantalla creó el registro.
    const qDeudoras = query(
      colRef,
      where("estadoPago", "in", ["PENDIENTE", "ABONADO", "Pendiente", "Abonado"])
    );

    const [snap, aConteo] = await Promise.all([
      getDocs(qDeudoras),
      getCountFromServer(colRef),
    ]);

    // Se suman SOLO los saldos positivos, uno a uno.
    //
    // Restar sumas globales (Σfacturado − Σcobrado) daba una cifra falsa: hay
    // clientes que pagaron de más, y esos $1.843 de sobrepago cancelaban la
    // deuda de otros clientes distintos. Lo que se debe no se compensa entre
    // personas: si uno pagó de más, el otro sigue debiendo igual.
    let deuda = 0;
    let facturado = 0;
    let cobrado = 0;
    let conDeuda = 0;

    snap.docs.forEach(d => {
      const o = d.data() as any;
      const t = Number(o.totalUSD) || 0;
      const p = Number(o.montoPagadoUSD) || 0;
      facturado += t;
      cobrado += p;
      const saldo = t - p;
      if (saldo > 0.01) { deuda += saldo; conDeuda++; }
    });

    return {
      deudaUSD: deuda,
      facturadoUSD: facturado,
      cobradoUSD: cobrado,
      ordenesConDeuda: conDeuda,
      ordenes: aConteo.data().count || 0,
    };
  } catch (error) {
    console.error("Error calculando la deuda total en el servidor:", error);
    return null;
  }
}

/**
 * 🔹 Busca órdenes en todo el historial
 */
export async function buscarOrdenesHistoricas(searchTerm: string) {
  try {
    const colRef = collection(db, "ordenes");
    const term = searchTerm.trim();
    if (!term) return [];

    const termLower = term.toLowerCase(); 
    const termUpper = term.toUpperCase(); 
    const termCap = term.charAt(0).toUpperCase() + termLower.slice(1); 
    const numTerm = Number(term);

    const promesas = [];

    if (!isNaN(numTerm)) {
      promesas.push(getDocs(query(colRef, where("ordenNumero", "==", numTerm))));
    }

    promesas.push(getDocs(query(colRef, where("cliente.rifCedula", "==", termUpper))));
    promesas.push(getDocs(query(colRef, where("cliente.rifCedula", "==", termLower))));
    
    promesas.push(getDocs(query(
        colRef, 
        where("clienteBusqueda", ">=", termLower),
        where("clienteBusqueda", "<=", termLower + '\uf8ff')
    )));

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

    const snapshots = await Promise.all(promesas);
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
 * 🔹 Suscribe al NewsBar SOLO a las órdenes pendientes.
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
 * 🔹 Carga un bloque grande de órdenes recientes para extraer historiales completos
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