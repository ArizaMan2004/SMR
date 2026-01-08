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
  where, 
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { GastoInsumo, GastoFijo, Empleado, PagoEmpleado } from "@/lib/types/gastos";

/**
 * HELPER: Valida si una fecha es realmente válida para evitar RangeError
 */
const isValidDate = (date: any): boolean => {
  const d = date instanceof Date ? date : new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * UTILIDAD: Mapea los documentos de Firestore convirtiendo Timestamps a Date.
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
// 1. GASTOS DE INSUMOS / VARIABLES
// ==========================================

export const createGasto = async (gasto: any) => {
  try {
    const { id, ...dataToSave } = gasto;
    
    // Validación de fecha de seguridad
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

export const subscribeToGastos = (empresaId: string, callback: (gastos: GastoInsumo[]) => void) => {
  const q = query(
    collection(db, "gastos_insumos"),
    where("empresa_id", "==", empresaId),
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
// 2. GASTOS FIJOS (RECURRENTES)
// ==========================================

export const createGastoFijo = async (gasto: any) => {
  try {
    const proximoPago = isValidDate(gasto.proximoPago) 
      ? (gasto.proximoPago instanceof Date ? gasto.proximoPago : new Date(gasto.proximoPago))
      : new Date();

    const docRef = await addDoc(collection(db, "gastos_fijos"), {
      ...gasto,
      createdAt: Timestamp.now(),
      proximoPago: Timestamp.fromDate(proximoPago)
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createGastoFijo:", error);
    throw error;
  }
};

export const subscribeToGastosFijos = (empresaId: string, callback: (gastos: GastoFijo[]) => void) => {
  const q = query(
    collection(db, "gastos_fijos"),
    where("empresa_id", "==", empresaId)
  );
  return onSnapshot(q, (snapshot) => {
    const gastos = snapshot.docs.map(mapSnapshot);
    callback(gastos as GastoFijo[]);
  });
};

export const updateGastoFijo = async (id: string, data: Partial<GastoFijo>) => {
  try {
    const updateData: any = { ...data };
    
    // CORRECCIÓN: Validar antes de convertir a Timestamp
    if (data.proximoPago) {
      if (isValidDate(data.proximoPago)) {
        updateData.proximoPago = Timestamp.fromDate(
          data.proximoPago instanceof Date ? data.proximoPago : new Date(data.proximoPago)
        );
      } else {
        delete updateData.proximoPago; // Eliminar si no es válida para no romper Firestore
      }
    }

    if (data.ultimoPago) {
      if (isValidDate(data.ultimoPago)) {
        updateData.ultimoPago = Timestamp.fromDate(
          data.ultimoPago instanceof Date ? data.ultimoPago : new Date(data.ultimoPago)
        );
      } else {
        delete updateData.ultimoPago;
      }
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
// 3. GESTIÓN DE PERSONAL (JERÁRQUICA)
// ==========================================

export const createEmpleado = async (empresaId: string, empleado: any) => {
  try {
    const docRef = await addDoc(collection(db, "empresas", empresaId, "empleados"), {
      ...empleado,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createEmpleado:", error);
    throw error;
  }
};

export const subscribeToEmpleados = (empresaId: string, callback: (empleados: Empleado[]) => void) => {
  const q = query(collection(db, "empresas", empresaId, "empleados"));
  return onSnapshot(q, (snapshot) => {
    const empleados = snapshot.docs.map(mapSnapshot);
    callback(empleados as Empleado[]);
  });
};

export const updateEmpleado = async (empresaId: string, id: string, data: Partial<Empleado>) => {
  try {
    await updateDoc(doc(db, "empresas", empresaId, "empleados", id), {
      ...data,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error en updateEmpleado:", error);
    throw error;
  }
};

export const deleteEmpleado = async (empresaId: string, id: string) => {
  try {
    await deleteDoc(doc(db, "empresas", empresaId, "empleados", id));
  } catch (error) {
    console.error("Error en deleteEmpleado:", error);
    throw error;
  }
};

// ==========================================
// 4. PAGOS DE NÓMINA (JERÁRQUICA)
// ==========================================

export const createPago = async (empresaId: string, pago: any) => {
  try {
    const docRef = await addDoc(collection(db, "empresas", empresaId, "pagos"), {
      ...pago,
      fecha: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error en createPago:", error);
    throw error;
  }
};

export const subscribeToPagos = (empresaId: string, callback: (pagos: PagoEmpleado[]) => void) => {
  const q = query(
    collection(db, "empresas", empresaId, "pagos"), 
    orderBy("fecha", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const pagos = snapshot.docs.map(mapSnapshot);
    callback(pagos as PagoEmpleado[]);
  });
};

// ==========================================
// 5. NOTIFICACIONES PERSISTENTES
// ==========================================

export const createNotification = async (userId: string, notification: any) => {
  try {
    await addDoc(collection(db, "notificaciones"), {
      ...notification,
      empresa_id: userId,
      timestamp: Timestamp.now(),
      isRead: false
    });
  } catch (error) {
    console.error("Error en createNotification:", error);
  }
};

export const subscribeToNotifications = (userId: string, callback: (notis: any[]) => void) => {
  const q = query(
    collection(db, "notificaciones"),
    where("empresa_id", "==", userId),
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