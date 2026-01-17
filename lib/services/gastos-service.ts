// @/lib/services/gastos-service.ts
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { GastoInsumo, GastoFijo, Empleado, PagoEmpleado } from "@/lib/types/gastos";

/**
 * HELPER: Valida si una fecha es realmente válida para evitar errores de Firestore
 */
const isValidDate = (date: any): boolean => {
  const d = date instanceof Date ? date : new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * UTILIDAD: Mapea los documentos de Firestore convirtiendo Timestamps a objetos Date de JavaScript.
 * Mantiene la lista de campos específicos que definiste originalmente.
 */
const mapSnapshot = (doc: any) => {
  const data = doc.data();
  const dateFields = ['fecha', 'timestamp', 'proximoPago', 'ultimoPago', 'createdAt', 'fechaRegistro', 'updatedAt'];
  
  dateFields.forEach(field => {
    if (data[field] instanceof Timestamp) {
      data[field] = data[field].toDate();
    }
  });
  
  return { id: doc.id, ...data };
};

// ==========================================
// 1. GASTOS DE INSUMOS / VARIABLES (GLOBAL)
// ==========================================

/**
 * Crea o actualiza un gasto de insumo.
 */
export const createGasto = async (gasto: any) => {
  try {
    const { id, empresa_id, ...dataToSave } = gasto; 
    
    const fechaFinal = isValidDate(dataToSave.fecha) 
      ? (dataToSave.fecha instanceof Date ? dataToSave.fecha : new Date(dataToSave.fecha))
      : new Date();

    const firestoreData = {
      ...dataToSave,
      fecha: Timestamp.fromDate(fechaFinal),
      updatedAt: Timestamp.now()
    };

    if (id) {
      const docRef = doc(db, "gastos_insumos", id);
      await updateDoc(docRef, firestoreData);
      return id;
    } else {
      const docRef = await addDoc(collection(db, "gastos_insumos"), {
        ...firestoreData,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    }
  } catch (error) {
    console.error("Error en createGasto:", error);
    throw error;
  }
};

export const subscribeToGastos = (callback: (gastos: GastoInsumo[]) => void) => {
  const q = query(
    collection(db, "gastos_insumos"),
    orderBy("fecha", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const gastos = snapshot.docs.map(mapSnapshot);
    callback(gastos as GastoInsumo[]);
  });
};

export const deleteGastoInsumo = async (id: string) => {
  try {
    if (!id) throw new Error("ID no proporcionado");
    await deleteDoc(doc(db, "gastos_insumos", id));
  } catch (error) {
    console.error("Error en deleteGastoInsumo:", error);
    throw error;
  }
};

// ==========================================
// 2. GASTOS FIJOS (RECURRENTES - GLOBAL)
// ==========================================

/**
 * Crea un nuevo gasto fijo.
 */
export const createGastoFijo = async (gasto: any) => {
  try {
    const { empresa_id, ...cleanData } = gasto; 
    
    const proximoPago = isValidDate(cleanData.proximoPago) 
      ? (cleanData.proximoPago instanceof Date ? cleanData.proximoPago : new Date(cleanData.proximoPago))
      : new Date();

    const docRef = await addDoc(collection(db, "gastos_fijos"), {
      ...cleanData,
      createdAt: Timestamp.now(),
      proximoPago: Timestamp.fromDate(proximoPago)
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createGastoFijo:", error);
    throw error;
  }
};

export const subscribeToGastosFijos = (callback: (gastos: GastoFijo[]) => void) => {
  const q = query(
    collection(db, "gastos_fijos"),
    orderBy("proximoPago", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    const gastos = snapshot.docs.map(mapSnapshot);
    callback(gastos as GastoFijo[]);
  });
};

/**
 * Actualiza un gasto fijo existente manejando las fechas de pago.
 */
export const updateGastoFijo = async (id: string, data: Partial<GastoFijo>) => {
  try {
    const updateData: any = { ...data };
    
    if (data.proximoPago && isValidDate(data.proximoPago)) {
      updateData.proximoPago = Timestamp.fromDate(
        data.proximoPago instanceof Date ? data.proximoPago : new Date(data.proximoPago)
      );
    }

    if (data.ultimoPago && isValidDate(data.ultimoPago)) {
      updateData.ultimoPago = Timestamp.fromDate(
        data.ultimoPago instanceof Date ? data.ultimoPago : new Date(data.ultimoPago)
      );
    }
    
    await updateDoc(doc(db, "gastos_fijos", id), {
      ...updateData,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error en updateGastoFijo:", error);
    throw error;
  }
};

export const deleteGastoFijo = async (id: string) => {
  try {
    await deleteDoc(doc(db, "gastos_fijos", id));
  } catch (error) {
    console.error("Error en deleteGastoFijo:", error);
    throw error;
  }
};

// ==========================================
// 3. GESTIÓN DE PERSONAL (COLECCIÓN GLOBAL)
// ==========================================

export const createEmpleado = async (empleado: any) => {
  try {
    const docRef = await addDoc(collection(db, "empleados"), {
      ...empleado,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createEmpleado:", error);
    throw error;
  }
};

export const subscribeToEmpleados = (callback: (empleados: Empleado[]) => void) => {
  const q = query(collection(db, "empleados"));
  return onSnapshot(q, (snapshot) => {
    const empleados = snapshot.docs.map(mapSnapshot);
    callback(empleados as Empleado[]);
  });
};

export const updateEmpleado = async (id: string, data: Partial<Empleado>) => {
  try {
    await updateDoc(doc(db, "empleados", id), {
      ...data,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error en updateEmpleado:", error);
    throw error;
  }
};

export const deleteEmpleado = async (id: string) => {
  try {
    await deleteDoc(doc(db, "empleados", id));
  } catch (error) {
    console.error("Error en deleteEmpleado:", error);
    throw error;
  }
};

// ==========================================
// 4. PAGOS DE NÓMINA (COLECCIÓN GLOBAL)
// ==========================================

export const createPago = async (pago: any) => {
  try {
    const docRef = await addDoc(collection(db, "pagos"), {
      ...pago,
      fecha: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createPago:", error);
    throw error;
  }
};

export const subscribeToPagos = (callback: (pagos: PagoEmpleado[]) => void) => {
  const q = query(
    collection(db, "pagos"), 
    orderBy("fecha", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const pagos = snapshot.docs.map(mapSnapshot);
    callback(pagos as PagoEmpleado[]);
  });
};

// ==========================================
// 5. NOTIFICACIONES (GLOBAL)
// ==========================================

export const createNotification = async (notification: any) => {
  try {
    await addDoc(collection(db, "notificaciones"), {
      ...notification,
      timestamp: Timestamp.now(),
      isRead: false
    });
  } catch (error) {
    console.error("Error en createNotification:", error);
  }
};

export const subscribeToNotifications = (callback: (notis: any[]) => void) => {
  const q = query(
    collection(db, "notificaciones"),
    orderBy("timestamp", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const notis = snapshot.docs.map(mapSnapshot);
    callback(notis);
  });
};

export const updateNotificationStatus = async (id: string, isRead: boolean) => {
  try {
    await updateDoc(doc(db, "notificaciones", id), { isRead });
  } catch (error) {
    console.error("Error en updateNotificationStatus:", error);
  }
};

export const deleteNotification = async (id: string) => {
  try {
    await deleteDoc(doc(db, "notificaciones", id));
  } catch (error) {
    console.error("Error en deleteNotification:", error);
  }
};