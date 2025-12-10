// @/lib/services/designers-service.ts
import { db } from "@/lib/firebase/firebase-config" // Asegúrate que esta ruta sea correcta según tu proyecto
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore"

export interface Designer {
  id: string
  name: string
}

const COLLECTION_NAME = "designers"

// Suscribirse a la lista de diseñadores en tiempo real
export function subscribeToDesigners(callback: (designers: Designer[]) => void) {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"))
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    })) as Designer[]
    callback(data)
  })
}

// Agregar un nuevo diseñador
export async function addDesigner(name: string) {
  if (!name.trim()) return
  await addDoc(collection(db, COLLECTION_NAME), {
    name: name.trim()
  })
}

// Eliminar un diseñador
export async function deleteDesigner(id: string) {
  await deleteDoc(doc(db, COLLECTION_NAME, id))
}