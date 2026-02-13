// @/lib/services/inventory-service.ts
import { db } from "@/lib/firebase";
import { 
  collection, query, orderBy, onSnapshot, 
  doc, runTransaction, serverTimestamp, setDoc, deleteDoc // <--- IMPORTANTE: Agregado deleteDoc
} from "firebase/firestore";

// Suscribirse al stock actual
export const subscribeToInventory = (callback: (data: any[]) => void) => {
  const q = query(collection(db, "inventario"), orderBy("nombre", "asc"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
    }));
    callback(items);
  });
};

// Suscribirse al historial (Entradas y Salidas)
export const subscribeToMovements = (callback: (data: any[]) => void) => {
  const q = query(collection(db, "historial_inventario"), orderBy("fecha", "desc"));
  return onSnapshot(q, (snapshot) => {
    const movimientos = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
    }));
    callback(movimientos);
  });
};

// Crear un producto nuevo desde cero
export const createInventoryItem = async (item: any) => {
    const newDocRef = doc(collection(db, "inventario"));
    // Aseguramos que los números se guarden como números
    await setDoc(newDocRef, {
        nombre: item.nombre || "Sin nombre",
        detalle: item.detalle || "",
        unidad: item.unidad || "und",
        stockActual: Number(item.stockActual) || 0,
        minimo: Number(item.minimo) || 5,
        precio: Number(item.precio) || 0,
        createdAt: serverTimestamp()
    });
};

// Registrar Movimiento (Entrada/Salida)
export const registerMovement = async (movement: any) => {
  const productRef = doc(db, "inventario", movement.productoId);
  // Creamos referencia para el historial
  const historyRef = doc(collection(db, "historial_inventario"));

  return await runTransaction(db, async (transaction) => {
    const productDoc = await transaction.get(productRef);
    if (!productDoc.exists()) throw new Error("Producto no encontrado");

    const currentStock = Number(productDoc.data().stockActual) || 0;
    const cantidad = Number(movement.cantidad);
    
    // Calcular nuevo stock
    const newStock = movement.tipo === 'ENTRADA' 
        ? currentStock + cantidad 
        : currentStock - cantidad;

    if (newStock < 0) throw new Error("Stock insuficiente para realizar esta salida");

    // 1. Actualizar el producto
    transaction.update(productRef, { stockActual: newStock });

    // 2. Guardar el historial
    transaction.set(historyRef, {
      ...movement,
      fecha: serverTimestamp(),
      stockPrevio: currentStock,
      stockResultante: newStock
    });
  });
};

// --- NUEVA FUNCIÓN PARA ELIMINAR ---
export const deleteInventoryItem = async (id: string) => {
    try {
        const itemRef = doc(db, "inventario", id);
        await deleteDoc(itemRef);
    } catch (error) {
        console.error("Error al eliminar el producto:", error);
        throw error;
    }
};