import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  type Firestore,
} from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Evita reinicializar la app en hot-reload / múltiples imports.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)

/**
 * Firestore con caché persistente (IndexedDB) para reducir lecturas y dar soporte offline.
 * - En el navegador: caché persistente + soporte multi-pestaña (sin esto, falla si abres 2 pestañas).
 * - En el servidor (SSR/build de Next): IndexedDB no existe, así que usamos el Firestore por defecto.
 * - try/catch: si Firestore ya fue inicializado (hot-reload), reutiliza la instancia existente.
 */
function createDb(): Firestore {
  if (typeof window === "undefined") {
    return getFirestore(app)
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch {
    // Ya estaba inicializado (p. ej. Fast Refresh) -> devolver la instancia existente.
    return getFirestore(app)
  }
}

export const db = createDb()

/**
 * Enganche de INSPECCIÓN, solo en desarrollo.
 *
 * Expone la instancia de Firestore en `window.__smr` para poder revisar desde
 * la consola cómo están escritos los datos de verdad (tipos de fecha, nombres
 * de campo, mayúsculas de los estados...) sin tener que adivinarlo leyendo el
 * código. Nunca se activa en producción: `process.env.NODE_ENV` es "production"
 * en el build y el bloque entero desaparece.
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Se cargan bajo demanda para no engordar el bundle de desarrollo.
  ;(window as any).__smr = {
    db,
    app,
    /** Lee N documentos de una colección y los devuelve en crudo. */
    async leer(coleccion: string, n = 5) {
      const { collection, getDocs, query, limit } = await import('firebase/firestore')
      const snap = await getDocs(query(collection(db, coleccion), limit(n)))
      return snap.docs.map(d => ({ __id: d.id, ...d.data() }))
    },
    /** Igual, pero SOLO desde la caché local: no consume cuota de Firestore. */
    async leerCache(coleccion: string) {
      const { collection, getDocsFromCache } = await import('firebase/firestore')
      const snap = await getDocsFromCache(collection(db, coleccion))
      return snap.docs.map(d => ({ __id: d.id, ...d.data() }))
    },
  }
}

export default app
