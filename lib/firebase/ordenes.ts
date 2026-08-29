// @/lib/firebase/ordenes.ts

import { db } from './firebase-config'; // Asegúrate de que esta ruta sea correcta
import { collection, query, orderBy, limit, getDocs, doc, getDoc, runTransaction } from "firebase/firestore";

/** Documento contador. Un solo sitio manda sobre el próximo número de orden. */
const REF_CONTADOR = () => doc(db, "contadores", "ordenes");

/**
 * Reserva el siguiente número de orden de forma ATÓMICA.
 *
 * Sustituye al método anterior, que miraba las 10 órdenes con `updatedAt` más
 * reciente y se quedaba con el mayor. El problema: `updatedAt` cambia cada vez
 * que se EDITA o se COBRA una orden, así que esas 10 solían ser órdenes viejas
 * recién pagadas, no las de numeración más alta. El resultado en la base son
 * 70 números repetidos que afectan a 195 órdenes — la #100 existe 30 veces.
 *
 * Una transacción de Firestore garantiza que dos personas creando órdenes a la
 * vez nunca reciban el mismo número. Además cuesta 1 lectura en vez de 10.
 *
 * La primera vez siembra el contador con el número más alto que ya exista.
 */
export async function getNextOrderNumber(): Promise<number> {
    /**
     * Valor de arranque del contador. Se calcula UNA sola vez, la primera vez
     * que se usa, y solo si el documento del contador aún no existe.
     *
     * Se ordena por `fecha` (fecha de CREACIÓN, texto ISO que sí ordena bien)
     * y NO por `ordenNumero`: ese campo se guarda como texto, así que Firestore
     * pondría "999" por delante de "1800" y la semilla saldría demasiado baja.
     * Tampoco se usa `updatedAt`, que es justo el error del método antiguo:
     * cambia al cobrar una orden vieja.
     */
    const semilla = async (): Promise<number> => {
        const snap = await getDocs(query(collection(db, "ordenes"), orderBy("fecha", "desc"), limit(100)));
        const nums = snap.docs.map(d => parseInt(String(d.data().ordenNumero), 10)).filter(n => !isNaN(n));
        return nums.length ? Math.max(...nums) : 0;
    };

    try {
        const ref = REF_CONTADOR();

        // La semilla se calcula FUERA de la transacción: una transacción puede
        // reintentarse varias veces, y no conviene repetir dentro una consulta
        // de 100 documentos en cada reintento.
        // Se comprueba ESTE documento, no si la colección tiene algo dentro:
        // con otro contador cualquiera presente, el de órdenes habría arrancado
        // en 1 y chocado con las órdenes que ya existen.
        const previo = await getDoc(ref);
        const base = previo.exists() ? 0 : await semilla();

        return await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const actual = snap.exists() ? Number(snap.data()?.ultimo) || 0 : base;
            const siguiente = actual + 1;
            tx.set(ref, { ultimo: siguiente, actualizadoEn: new Date().toISOString() }, { merge: true });
            return siguiente;
        });
    } catch (error) {
        console.error("Error reservando número de orden:", error);
        // Último recurso: el método antiguo, para no bloquear la creación de la orden.
        return (await getLastOrderNumber()) + 1;
    }
}

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