// @/lib/services/estado-orden-service.ts
//
// EL ESTADO DE LA ORDEN LO MUEVE EL TALLER, NO UNA PERSONA.
//
// `EstadoOrden` existía desde el principio —Pendiente, En Proceso, Terminado,
// Cancelado— y no lo escribía nadie: todas las órdenes nacían "PENDIENTE" y ahí
// se quedaban para siempre. Un estado que nunca cambia no informa de nada, y
// peor: da la impresión de que sí.
//
// Ahora lo mueven los dos momentos en los que de verdad cambia algo:
//
//   SE MANDA AL TALLER   →  En Proceso
//   SE DA POR LISTO      →  Terminado
//
// POR QUÉ NO BASTA CON "SE DIO POR LISTO"
//
// Una misma factura puede repartirse en varios trabajos —se imprime, pasa a
// producción que lo pega, y de ahí sale— y cada uno es su propia orden de
// taller. Dar la factura por terminada al cerrar el primero diría que está
// lista cuando todavía le falta la mitad.
//
// Por eso al cerrar un trabajo se mira si le queda alguno pendiente al mismo
// número de orden. Solo cuando no queda ninguno pasa a Terminado.
//
// SI ESTO FALLA, NO SE ROMPE NADA
//
// Es información, no dinero. Quien llama a esto está en medio de guardar el
// trabajo, y que el rótulo se quede desactualizado es molesto; que se caiga el
// envío al taller por un rótulo, no.

import { db } from "@/lib/firebase";
import {
    collection, doc, getDocs, query, updateDoc, where, limit,
} from "firebase/firestore";
import { EstadoOrden } from "@/lib/types/orden";

/**
 * El documento de la factura, a partir de lo que guarda el trabajo del taller.
 *
 * Se prefiere el id, que es directo. Los trabajos creados antes de que se
 * guardara solo tienen el número, así que se busca por él — y como el número
 * se ha repetido alguna vez en el histórico, se coge el único resultado o
 * ninguno: adivinar cuál de dos es peor que no tocar nada.
 */
const buscarOrden = async (
    ordenId?: string | null,
    ordenNumero?: number | string | null
): Promise<string | null> => {
    if (ordenId) return ordenId;
    if (ordenNumero == null || ordenNumero === "") return null;

    const numero = Number(ordenNumero);
    if (!Number.isFinite(numero)) return null;

    const snap = await getDocs(query(
        collection(db, "ordenes"),
        where("ordenNumero", "==", numero),
        limit(2)
    ));
    return snap.size === 1 ? snap.docs[0].id : null;
};

/** Cuántos trabajos siguen abiertos para ese número de orden. */
const trabajosPendientes = async (
    ordenNumero?: number | string | null,
    exceptoId?: string
): Promise<number> => {
    if (ordenNumero == null || ordenNumero === "") return 0;

    const snap = await getDocs(query(
        collection(db, "ordenes_servicio"),
        where("ordenNumero", "==", Number(ordenNumero) || ordenNumero)
    ));

    return snap.docs.filter(d =>
        d.id !== exceptoId && (d.data() as any)?.estado !== "COMPLETADO"
    ).length;
};

/** El trabajo entró al taller: la factura pasa a En Proceso. */
export const marcarEnProceso = async (
    ordenId?: string | null,
    ordenNumero?: number | string | null
): Promise<void> => {
    try {
        const id = await buscarOrden(ordenId, ordenNumero);
        if (!id) return;
        await updateDoc(doc(db, "ordenes", id), { estado: EstadoOrden.PROCESO });
    } catch (error) {
        console.error("No se pudo pasar la orden a En Proceso:", error);
    }
};

/**
 * Se dio un trabajo por listo.
 *
 * La factura pasa a Terminado solo si no le queda ningún otro trabajo abierto.
 * Devuelve si llegó a cambiarla, para poder decirlo en pantalla en vez de dejar
 * al que pulsó preguntándose si hizo algo.
 */
export const marcarTerminadaSiYaNoQuedaNada = async (
    trabajoId: string,
    ordenId?: string | null,
    ordenNumero?: number | string | null
): Promise<{ terminada: boolean; quedan: number }> => {
    try {
        const quedan = await trabajosPendientes(ordenNumero, trabajoId);
        if (quedan > 0) return { terminada: false, quedan };

        const id = await buscarOrden(ordenId, ordenNumero);
        if (!id) return { terminada: false, quedan: 0 };

        await updateDoc(doc(db, "ordenes", id), { estado: EstadoOrden.TERMINADO });
        return { terminada: true, quedan: 0 };
    } catch (error) {
        console.error("No se pudo pasar la orden a Terminado:", error);
        return { terminada: false, quedan: 0 };
    }
};
