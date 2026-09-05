// src/lib/services/firestore-budget-service.ts

import { db } from "@/lib/firebase/firebase-config"; 
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    deleteDoc, 
    doc, 
    setDoc, // Necesario para actualizar documentos existentes
    getDoc,
    runTransaction,
    writeBatch,
    serverTimestamp
} from "firebase/firestore";

import type { SubItemInterno } from "@/lib/services/subitems-service";

// --- INTERFACES DE DATOS ---
export interface BudgetItem {
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitarioUSD: number;
    totalUSD: number;

    /**
     * Desglose INTERNO del renglon: que material salio y cuantos metros.
     *
     * No aparece en ningun PDF. El renglon que ve el cliente sigue siendo el
     * texto de arriba; esto es lo que permite al balance saber que detras de
     * "Senalizacion del local, $450" habia 12 m2 de vinil impreso.
     *
     * Opcional a proposito: se puede rellenar despues de facturar, y hay
     * cientos de presupuestos viejos que nunca lo van a tener.
     */
    subItems?: SubItemInterno[];
}

export interface DbBudgetEntry {
    id?: string; // ID de Firestore (opcional al crear, obligatorio al editar)
    /**
     * Número correlativo del presupuesto, para poder referirse a él con el
     * cliente ("el presupuesto #45"). El id de Firestore no sirve: es una
     * cadena aleatoria imposible de dictar por teléfono.
     */
    numero?: number;
    clienteNombre: string;
    items: BudgetItem[];
    totalUSD: number;
    dateCreated: string;
    userId?: string;
}

const BUDGETS_COLLECTION = "budgets";

/** Documento contador: un solo sitio manda sobre el próximo número. */
const REF_CONTADOR = () => doc(db, "contadores", "presupuestos");

/**
 * Reserva el siguiente número de presupuesto de forma ATÓMICA.
 *
 * Una transacción garantiza que dos personas guardando a la vez nunca reciban
 * el mismo número. Es el mismo patrón que usan las órdenes, donde el método
 * anterior (leer el último y sumarle uno) acabó generando 70 números repetidos.
 *
 * La primera vez siembra el contador con el número más alto que ya exista.
 */
export async function getNextBudgetNumber(): Promise<number> {
    const semilla = async (): Promise<number> => {
        const snap = await getDocs(collection(db, BUDGETS_COLLECTION));
        let max = 0;
        snap.forEach(d => {
            const n = Number((d.data() as any)?.numero);
            if (!isNaN(n) && n > max) max = n;
        });
        return max;
    };

    const ref = REF_CONTADOR();
    // La semilla se calcula fuera de la transacción: una transacción puede
    // reintentarse y no conviene repetir dentro una lectura de la colección.
    const previo = await getDoc(ref);
    const base = previo.exists() ? 0 : await semilla();

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const actual = snap.exists() ? Number(snap.data()?.ultimo) || 0 : base;
        const siguiente = actual + 1;
        tx.set(ref, { ultimo: siguiente, actualizadoEn: new Date().toISOString() }, { merge: true });
        return siguiente;
    });
}

/**
 * Pone número a los presupuestos antiguos que aún no lo tienen, respetando el
 * orden en que se crearon. Se ejecuta una sola vez, a petición del usuario:
 * no se hace solo al cargar la vista para no escribir en la base sin avisar.
 */
export async function numerarPresupuestosAntiguos(): Promise<number> {
    const snap = await getDocs(collection(db, BUDGETS_COLLECTION));

    const sinNumero = snap.docs
        .filter(d => {
            const n = Number((d.data() as any)?.numero);
            return isNaN(n) || n <= 0;
        })
        // Del más viejo al más nuevo, para que el número siga la cronología.
        .sort((a, b) => String((a.data() as any)?.dateCreated || '')
            .localeCompare(String((b.data() as any)?.dateCreated || '')));

    if (sinNumero.length === 0) return 0;

    // Se reserva TODO el bloque en una sola transacción y luego se reparte.
    // Pedir los números de uno en uno serían 110 transacciones encadenadas:
    // lento y con más ocasiones de fallar a medias.
    const ref = REF_CONTADOR();
    const previo = await getDoc(ref);
    const base = previo.exists()
        ? 0
        : await (async () => {
            const todos = await getDocs(collection(db, BUDGETS_COLLECTION));
            let max = 0;
            todos.forEach(d => {
                const n = Number((d.data() as any)?.numero);
                if (!isNaN(n) && n > max) max = n;
            });
            return max;
        })();

    const desde = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const actual = snap.exists() ? Number(snap.data()?.ultimo) || 0 : base;
        const ultimo = actual + sinNumero.length;
        tx.set(ref, { ultimo, actualizadoEn: new Date().toISOString() }, { merge: true });
        return actual + 1; // primer número del bloque reservado
    });

    // Los lotes de Firestore admiten 500 operaciones; se trocea por seguridad.
    for (let i = 0; i < sinNumero.length; i += 400) {
        const lote = writeBatch(db);
        sinNumero.slice(i, i + 400).forEach((d, j) => {
            lote.set(doc(db, BUDGETS_COLLECTION, d.id), { numero: desde + i + j }, { merge: true });
        });
        await lote.commit();
    }

    return sinNumero.length;
}

/**
 * Guarda o Actualiza un presupuesto en Firestore.
 * Si el objeto tiene un 'id', lo actualiza. Si no, crea uno nuevo.
 */
export async function saveBudgetToFirestore(budgetData: DbBudgetEntry): Promise<string> {
    try {
        // 1. Extraemos el ID y separamos el resto de los datos para el payload
        const { id, ...data } = budgetData;

        // 2. Limpieza de datos: Evitar enviar valores 'undefined' que rompen Firebase
        const cleanData = JSON.parse(JSON.stringify(data));

        if (id) {
            // --- MODO ACTUALIZACIÓN ---
            // Usamos setDoc para apuntar al ID específico que ya existe
            const docRef = doc(db, BUDGETS_COLLECTION, id);
            
            // merge: true asegura que no se borren otros campos si existieran
            await setDoc(docRef, cleanData, { merge: true });
            console.log("Presupuesto actualizado:", id);
            return id;
        } else {
            // --- MODO CREACIÓN ---
            // Se le reserva su número correlativo antes de guardarlo. Si el
            // contador fallara, se guarda igual sin número: perder el
            // presupuesto sería mucho peor que quedarse sin numerar.
            let numero: number | undefined;
            try {
                numero = await getNextBudgetNumber();
            } catch (e) {
                console.error("No se pudo reservar número de presupuesto:", e);
            }

            const docRef = await addDoc(collection(db, BUDGETS_COLLECTION), {
                ...cleanData,
                ...(numero ? { numero } : {}),
            });
            console.log("Nuevo presupuesto creado con ID:", docRef.id, "número:", numero ?? "sin número");
            return docRef.id;
        }
    } catch (e) {
        console.error("Error en saveBudgetToFirestore:", e);
        throw new Error("No se pudo procesar la solicitud en la base de datos.");
    }
}

/**
 * Guarda el desglose interno de UN renglon de un presupuesto ya guardado.
 *
 * Se lee el documento fresco antes de escribir en vez de mandar el
 * presupuesto que hay en pantalla: estos desgloses se rellenan a menudo dias
 * despues de facturar, con la lista del historial cargada hace rato, y
 * escribir el objeto entero pisaria cualquier cambio hecho mientras tanto.
 * Solo se toca el campo subItems del renglon indicado.
 */
export async function guardarSubItemsDeItem(
    budgetId: string,
    itemId: number,
    subItems: SubItemInterno[]
): Promise<void> {
    const ref = doc(db, BUDGETS_COLLECTION, budgetId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("El presupuesto ya no existe.");

    const datos = snap.data() as DbBudgetEntry;
    const items = (datos.items || []).map(item =>
        item.id === itemId
            // JSON.parse/stringify quita los undefined, que Firestore rechaza.
            ? { ...item, subItems: JSON.parse(JSON.stringify(subItems)) }
            : item
    );

    await setDoc(ref, { items }, { merge: true });
}

/**
 * Carga todo el historial de presupuestos ordenados por fecha.
 */
export async function loadBudgetsFromFirestore(): Promise<DbBudgetEntry[]> {
    try {
        // SIN `orderBy` a propósito. Firestore descarta los documentos que no
        // tienen el campo por el que se ordena, y hay presupuestos antiguos sin
        // `dateCreated`: ordenando por ese campo desaparecían de la lista sin
        // que nadie se enterara. Se traen todos y se ordenan aquí.
        const querySnapshot = await getDocs(collection(db, BUDGETS_COLLECTION));
        const budgets: DbBudgetEntry[] = [];

        querySnapshot.forEach((doc) => {
            budgets.push({
                id: doc.id, // Capturamos el ID real de Firestore
                ...doc.data(),
            } as DbBudgetEntry);
        });

        // Más nuevos primero; los que no tienen fecha quedan al final, pero
        // siguen estando en la lista y se pueden buscar y editar.
        budgets.sort((a, b) =>
            String(b.dateCreated || '').localeCompare(String(a.dateCreated || ''))
        );

        return budgets;
    } catch (e) {
        console.error("Error al cargar presupuestos:", e);
        return [];
    }
}

/**
 * Elimina un presupuesto permanentemente usando su ID de Firestore.
 */
export async function deleteBudgetFromFirestore(id: string): Promise<void> {
    if (!id) {
        console.error("Intento de borrar sin ID válido");
        return;
    }

    try {
        const docRef = doc(db, BUDGETS_COLLECTION, id);
        await deleteDoc(docRef);
        console.log("Documento eliminado:", id);
    } catch (e) {
        console.error("Error al eliminar presupuesto:", e);
        throw new Error("Error al eliminar el registro de la base de datos.");
    }
}