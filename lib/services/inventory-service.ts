// @/lib/services/inventory-service.ts
import { db } from "@/lib/firebase";
import { 
  collection, query, orderBy, onSnapshot, 
  doc, runTransaction, serverTimestamp, setDoc
} from "firebase/firestore";

// Suscribirse al stock actual
export const subscribeToInventory = (callback: (data: any[]) => void) => {
  const q = query(collection(db, "inventario"), orderBy("nombre", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

// Suscribirse al historial (Entradas y Salidas)
export const subscribeToMovements = (callback: (data: any[]) => void) => {
  const q = query(collection(db, "historial_inventario"), orderBy("fecha", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

// Crear un producto nuevo desde cero
export const createInventoryItem = async (item: any) => {
    const newDocRef = doc(collection(db, "inventario"));
    await setDoc(newDocRef, {
        ...item,
        stockActual: Number(item.stockActual) || 0,
        minimo: Number(item.minimo) || 5,
        precio: Number(item.precio) || 0,
        createdAt: serverTimestamp()
    });
};

// Registrar Movimiento (Entrada/Salida)
export const registerMovement = async (movement: any) => {
  const productRef = doc(db, "inventario", movement.productoId);
  const historyRef = doc(collection(db, "historial_inventario"));

  return await runTransaction(db, async (transaction) => {
    const productDoc = await transaction.get(productRef);
    if (!productDoc.exists()) throw new Error("Producto no encontrado");

    const currentStock = Number(productDoc.data().stockActual) || 0;
    const cantidad = Number(movement.cantidad);
    const newStock = movement.tipo === 'ENTRADA' ? currentStock + cantidad : currentStock - cantidad;

    if (newStock < 0) throw new Error("Stock insuficiente");

    transaction.update(productRef, { stockActual: newStock });
    transaction.set(historyRef, {
      ...movement,
      fecha: serverTimestamp(),
      stockPrevio: currentStock,
      stockResultante: newStock
    });
  });
};