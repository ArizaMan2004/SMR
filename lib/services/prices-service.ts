// @/lib/services/prices-service.ts
import { db } from "@/lib/firebase";
import { 
  collection, onSnapshot, query, addDoc, 
  updateDoc, deleteDoc, doc, serverTimestamp, orderBy 
} from "firebase/firestore";

export interface PriceItem {
    id?: string;
    nombre: string;
    categoriaId: string; 
    precioPublico: number;
    precioAliado: number;
    unidad: string;
}

export interface CategoryItem {
    id?: string;
    nombre: string;
}

// --- CRUD PRODUCTOS ---
export const subscribeToPrices = (callback: (prices: PriceItem[]) => void) => {
  const q = query(collection(db, "precios"), orderBy("nombre", "asc"));
  return onSnapshot(q, (snapshot) => {
    const prices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PriceItem[];
    callback(prices);
  }, (error) => console.error("Error precios:", error));
};

export const savePriceItem = async (data: PriceItem, id?: string) => {
  if (id) {
    const { id: _, ...dataToSave } = data;
    await updateDoc(doc(db, "precios", id), { ...dataToSave, updatedAt: serverTimestamp() });
  } else {
    await addDoc(collection(db, "precios"), { ...data, createdAt: serverTimestamp() });
  }
};

export const deletePriceItem = async (id: string) => {
  await deleteDoc(doc(db, "precios", id));
};

// --- CRUD CATEGORÍAS (Guardando en 'categoriaprecios') ---
export const subscribeToCategories = (callback: (cats: CategoryItem[]) => void) => {
  const q = query(collection(db, "categoriaprecios"), orderBy("nombre", "asc"));
  return onSnapshot(q, (snapshot) => {
    const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CategoryItem[];
    callback(cats);
  }, (error) => console.error("Error categorías:", error));
};

export const saveCategory = async (nombre: string) => {
  await addDoc(collection(db, "categoriaprecios"), { 
      nombre: nombre.trim(),
      createdAt: serverTimestamp() 
  });
};

export const deleteCategory = async (id: string) => {
  await deleteDoc(doc(db, "categoriaprecios", id));
};