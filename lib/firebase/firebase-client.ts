// @/lib/firebase/firebase-client.ts

import { initializeApp, getApps, getApp } from "firebase/app"
import { getFirestore, Firestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

// 1. CONFIGURACIÓN DE FIREBASE (Usando process.env)
const firebaseConfig = {
  // Las variables de entorno de Next.js deben ser accedidas mediante process.env
  // y deben comenzar con NEXT_PUBLIC_ para ser accesibles en el lado del cliente.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Opcional
}

// Validación básica para evitar la inicialización si faltan datos críticos
if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key no encontrada. Verifica tu archivo .env.local y el prefijo NEXT_PUBLIC_")
}

// 2. INICIALIZACIÓN DE LA APLICACIÓN
const app = !getApps().length ? initializeApp(firebaseConfig as any) : getApp()

// 3. OBTENCIÓN DE SERVICIOS
// Puedes usar 'app' aquí para obtener los servicios de forma segura.

// Exporta la instancia de Firestore para las operaciones de base de datos
export const db: Firestore = getFirestore(app) 

// Exporta la instancia de Auth para la autenticación
export const auth = getAuth(app)

// Exporta la instancia de Storage para el manejo de archivos
export const storage = getStorage(app)