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
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

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
