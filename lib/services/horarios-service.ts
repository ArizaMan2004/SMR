// @/lib/services/horarios-service.ts
//
// Horario estándar del personal: un documento por empleado con su patrón
// semanal. Sustituye al modelo anterior de bloques con fecha, que obligaba a
// rellenar la agenda semana tras semana cuando en realidad el horario del
// taller es fijo.

import { db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
} from "firebase/firestore";

import type { HorarioEstandar, BloqueHorario } from "@/lib/types/horarios";

const COLECCION = "horarios_estandar";

/** El id del documento ES el id del empleado: garantiza un horario por persona. */
const refDe = (empleadoId: string) => doc(db, COLECCION, empleadoId);

const normalizar = (id: string, raw: any): HorarioEstandar => ({
    id,
    empleadoId: raw?.empleadoId || id,
    empleadoNombre: String(raw?.empleadoNombre || 'Sin nombre'),
    dias: raw?.dias && typeof raw.dias === 'object' ? raw.dias : {},
    activo: raw?.activo !== false,
    nota: raw?.nota || undefined,
    actualizadoEn: raw?.actualizadoEn,
});

/**
 * Escucha los horarios. Es una colección pequeña —un documento por empleado—
 * así que no necesita paginación ni filtros: cabe entera sin castigar la cuota.
 */
export const subscribeToHorarios = (
    callback: (horarios: HorarioEstandar[]) => void,
    onError?: (mensaje: string) => void
) => {
    return onSnapshot(
        collection(db, COLECCION),
        snap => callback(snap.docs.map(d => normalizar(d.id, d.data()))),
        error => {
            console.error("Error escuchando horarios:", error);
            callback([]);
            onError?.(error?.message || 'No se pudieron cargar los horarios');
        }
    );
};

export const cargarHorarios = async (): Promise<HorarioEstandar[]> => {
    try {
        const snap = await getDocs(collection(db, COLECCION));
        return snap.docs.map(d => normalizar(d.id, d.data()));
    } catch (error) {
        console.error("Error cargando horarios:", error);
        return [];
    }
};

/** Guarda el horario completo de una persona. */
export const guardarHorario = async (horario: {
    empleadoId: string;
    empleadoNombre: string;
    dias: Record<number, BloqueHorario[]>;
    activo?: boolean;
    nota?: string;
}): Promise<void> => {
    // Se limpian los días vacíos para no guardar ruido.
    const dias: Record<number, BloqueHorario[]> = {};
    Object.entries(horario.dias || {}).forEach(([dia, bloques]) => {
        const validos = (bloques || []).filter(b => b?.inicio && b?.fin);
        if (validos.length > 0) dias[Number(dia)] = validos;
    });

    await setDoc(
        refDe(horario.empleadoId),
        {
            empleadoId: horario.empleadoId,
            empleadoNombre: horario.empleadoNombre,
            dias,
            activo: horario.activo !== false,
            ...(horario.nota ? { nota: horario.nota } : {}),
            actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
    );
};

/** Cambia solo los bloques de un día, sin tocar el resto de la semana. */
export const guardarDia = async (
    horario: HorarioEstandar,
    dia: number,
    bloques: BloqueHorario[]
): Promise<void> => {
    const dias = { ...(horario.dias || {}) };
    if (bloques.length > 0) dias[dia] = bloques;
    else delete dias[dia];

    await guardarHorario({
        empleadoId: horario.empleadoId,
        empleadoNombre: horario.empleadoNombre,
        dias,
        activo: horario.activo,
        nota: horario.nota,
    });
};

export const eliminarHorario = async (empleadoId: string): Promise<void> => {
    await deleteDoc(refDe(empleadoId));
};
