// ⚠️ AJUSTA ESTAS IMPORTACIONES: 
// Asegúrate de que './firebase-config' apunte a donde exportas tu instancia 'db' de Firestore.
import { db } from './firebase-config'; 
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

/**
 * Consulta la base de datos de Firestore para obtener el número de la última orden guardada.
 * * 🚨 CRUCIAL: Se asume que el campo 'ordenNumero' en Firestore está guardado como un tipo NUMÉRICO.
 * Si lo guardas como string, el ordenamiento (orderBy) será alfabético (Ej: "10" < "2"), lo cual es incorrecto.
 * * @returns El número de orden más alto encontrado (como número), o 0 si no hay órdenes.
 */
export async function getLastOrderNumber(): Promise<number> {
    try {
        const ordenesRef = collection(db, "ordenes");
        
        // 1. Consulta: Busca en la colección 'ordenes'
        // 2. Ordena: Por 'ordenNumero' de forma descendente (el más alto primero)
        // 3. Limita: A un solo documento (la última orden)
        const q = query(ordenesRef, orderBy("ordenNumero", "desc"), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("Colección 'ordenes' vacía. Se asignará el N° 1.");
            return 0; // Si no hay documentos, el último número es 0.
        }

        const lastOrder = snapshot.docs[0].data();
        
        // Extrae el valor y lo asegura como número.
        const lastNumber = typeof lastOrder.ordenNumero === 'number' 
            ? lastOrder.ordenNumero 
            : parseInt(lastOrder.ordenNumero, 10);
        
        if (isNaN(lastNumber)) {
             console.error("El campo 'ordenNumero' no es un número válido en la última orden.");
             return 0; 
        }

        return lastNumber;

    } catch (error) {
        console.error("Error al obtener el último número de orden de Firebase:", error);
        // Devuelve 0 en caso de fallo para evitar que el formulario se rompa y comenzar en 1.
        return 0; 
    }
}