// @/lib/firebase/ordenes.ts

import { db } from './firebase-config'; // Asegúrate de que esta ruta sea correcta
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

/**
 * Obtiene el número de orden más alto REAL, corrigiendo el error de ordenamiento alfabético.
 * Estrategia: Obtiene las últimas 10 órdenes creadas (por fecha) y busca el número mayor matemáticamente.
 */
export async function getLastOrderNumber(): Promise<number> {
    try {
        const ordenesRef = collection(db, "ordenes");
        
        // 1. CAMBIO CLAVE: Ordenamos por 'updatedAt' (fecha) descendente.
        // Esto nos garantiza traer las órdenes más recientes (la 100, la 99, etc.),
        // ignorando si la DB cree que "99" es mayor que "100".
        const q = query(ordenesRef, orderBy("updatedAt", "desc"), limit(10));
        
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No hay órdenes previas. Iniciando conteo en 0.");
            return 0; 
        }

        // 2. Convertimos los resultados a Números Reales de Javascript
        const numerosEncontrados = snapshot.docs.map(doc => {
            const data = doc.data();
            // Parseamos el string a int (ej: "100" -> 100)
            const num = parseInt(data.ordenNumero, 10);
            return isNaN(num) ? 0 : num;
        });

        // 3. Usamos Math.max para encontrar el verdadero número mayor
        // Javascript sí sabe que 100 es mayor que 99.
        const maxNumber = Math.max(...numerosEncontrados);

        return maxNumber;

    } catch (error) {
        console.error("Error al obtener último número:", error);
        
        // INTENTO DE RESPALDO (FALLBACK)
        // Si falla el ordenamiento por fecha (ej. datos viejos sin fecha), 
        // intentamos el método antiguo pero trayendo MUCHOS documentos para saltar el "99"
        try {
            const ordenesRef = collection(db, "ordenes");
            // Traemos las "supuestas" últimas 50 órdenes alfabéticas para intentar encontrar la 100
            const qFallback = query(ordenesRef, orderBy("ordenNumero", "desc"), limit(50));
            const snapFallback = await getDocs(qFallback);
            
            if (snapFallback.empty) return 0;

            const nums = snapFallback.docs.map(d => parseInt(d.data().ordenNumero, 10) || 0);
            return Math.max(...nums);
        } catch (e) {
            return 0;
        }
    }
}