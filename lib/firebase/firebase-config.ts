// @/lib/firebase/firebase-config.ts
//
// COMPATIBILIDAD. Este archivo ya NO inicializa nada.
//
// Antes creaba su propia instancia de Firestore con `getFirestore(app)`. El
// problema: `lib/firebase.ts` arranca Firestore con `initializeFirestore(...)`
// y caché persistente (IndexedDB), y el SDK prohibe llamar a `initializeFirestore`
// después de un `getFirestore`. Según qué módulo se evaluara primero, el arranque
// con caché fallaba en silencio (lo tragaba el try/catch) y la app se quedaba sin
// caché offline y leyendo de más en Firestore, que es lo que se factura.
//
// Ahora todo el mundo comparte la MISMA instancia. Se mantiene la ruta para no
// tocar los seis módulos que ya importaban de aquí.
export { db, auth, app } from "@/lib/firebase"
export { default } from "@/lib/firebase"
