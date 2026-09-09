// @/lib/services/roles-service.ts
//
// Guarda y lee la configuración de permisos que el admin edita desde la app.
//
// Colección "roles_permisos": un documento por rol, con el id del rol como id
// del documento. Ahí caben tanto los roles de fábrica (a los que el admin les
// cambió las vistas) como los rangos nuevos que él mismo crea.
//
// Los overrides por persona (dar o quitar una vista suelta a UN empleado) viven
// en el propio documento del usuario, en usuarios/{uid}.

import { db } from "@/lib/firebase";
import {
    collection,
    onSnapshot,
    doc,
    setDoc,
    deleteDoc,
    updateDoc,
    getDocs,
} from "firebase/firestore";

import {
    ROLES_SISTEMA,
    ALL_VIEW_IDS,
    COLOR_ROL_POR_DEFECTO,
    type RolDefinicion,
    type ViewId,
} from "@/lib/roles";

const COLECCION_ROLES = "roles_permisos";

/** Descarta ids de vistas que ya no existen (por si se borró una vista del código). */
const limpiarVistas = (vistas: any): ViewId[] => {
    if (!Array.isArray(vistas)) return [];
    return vistas.filter((v: any) => typeof v === "string" && ALL_VIEW_IDS.includes(v as ViewId));
};

/**
 * Mezcla los roles de fábrica con lo guardado en Firestore.
 *
 * - Si hay un documento con el id de un rol de fábrica, manda lo guardado
 *   (el admin le cambió las vistas), pero sigue marcado como de sistema para
 *   que no se pueda borrar.
 * - Si el documento no corresponde a ningún rol de fábrica, es un rango nuevo
 *   creado por el admin.
 * - Si no hay nada guardado, se usan los valores de fábrica tal cual.
 */
const combinarConDefaults = (docs: any[]): RolDefinicion[] => {
    const guardados = new Map<string, any>(docs.map(d => [d.id, d]));

    const deSistema: RolDefinicion[] = ROLES_SISTEMA.map(base => {
        const guardado = guardados.get(base.id);
        if (!guardado) return base;
        return {
            ...base,
            label: guardado.label || base.label,
            color: guardado.color || base.color,
            vistas: limpiarVistas(guardado.vistas),
            esProduccion: guardado.esProduccion ?? base.esProduccion,
            esSistema: true,
        };
    });

    const idsDeSistema = new Set(ROLES_SISTEMA.map(r => r.id));
    const personalizados: RolDefinicion[] = docs
        .filter(d => !idsDeSistema.has(d.id))
        .map(d => ({
            id: d.id,
            label: d.label || d.id,
            color: d.color || COLOR_ROL_POR_DEFECTO,
            vistas: limpiarVistas(d.vistas),
            esProduccion: !!d.esProduccion,
            esSistema: false,
        }));

    return [...deSistema, ...personalizados];
};

/**
 * Suscribe a la configuración de roles. Siempre devuelve al menos los roles de
 * fábrica, incluso si la colección está vacía o falla la lectura: la app nunca
 * debe quedarse sin roles porque entonces nadie podría entrar a nada.
 */
export const subscribeToRoles = (callback: (roles: RolDefinicion[]) => void) => {
    callback(ROLES_SISTEMA);

    return onSnapshot(
        collection(db, COLECCION_ROLES),
        snapshot => {
            const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
            callback(combinarConDefaults(docs));
        },
        error => {
            console.error("Error en suscripción de roles:", error);
            callback(ROLES_SISTEMA);
        }
    );
};

/** Lectura puntual, para procesos que no necesitan quedarse escuchando. */
export const cargarRoles = async (): Promise<RolDefinicion[]> => {
    try {
        const snap = await getDocs(collection(db, COLECCION_ROLES));
        return combinarConDefaults(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (error) {
        console.error("Error al cargar roles:", error);
        return ROLES_SISTEMA;
    }
};

/** Convierte un nombre escrito por el admin en un id válido: "Jefe de Taller" -> "JEFE_DE_TALLER". */
export const generarIdDeRol = (nombre: string): string =>
    nombre
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // quita tildes: "Diseno Jr." -> "DISENO_JR"
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);

/** Crea un rango nuevo o actualiza uno existente (incluidos los de fábrica). */
export const guardarRol = async (rol: RolDefinicion): Promise<void> => {
    await setDoc(
        doc(db, COLECCION_ROLES, rol.id),
        {
            label: rol.label,
            color: rol.color,
            vistas: limpiarVistas(rol.vistas),
            esProduccion: !!rol.esProduccion,
            actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
    );
};

/**
 * Borra un rango creado por el admin. Los de fábrica no se borran: hay usuarios
 * y lógica interna que dependen de ellos.
 */
export const eliminarRol = async (rolId: string): Promise<void> => {
    if (ROLES_SISTEMA.some(r => r.id === rolId)) {
        throw new Error("Los roles del sistema no se pueden eliminar, solo editar.");
    }
    await deleteDoc(doc(db, COLECCION_ROLES, rolId));
};

/**
 * Permisos sueltos para UNA persona: darle una vista que su rol no tiene, o
 * quitarle una que sí tiene. Se guardan en su propio documento de usuario.
 */
export const guardarOverridesUsuario = async (
    uid: string,
    overrides: { vistasExtra: string[]; vistasBloqueadas: string[] }
): Promise<void> => {
    await updateDoc(doc(db, "usuarios", uid), {
        vistasExtra: limpiarVistas(overrides.vistasExtra),
        vistasBloqueadas: limpiarVistas(overrides.vistasBloqueadas),
    });
};

/** Reasigna a otro rol a todos los usuarios que tuvieran el rol que se va a borrar. */
export const reasignarUsuariosDeRol = async (rolViejo: string, rolNuevo: string): Promise<number> => {
    const snap = await getDocs(collection(db, "usuarios"));
    const afectados = snap.docs.filter(d => (d.data() as any).rol === rolViejo);
    await Promise.all(afectados.map(d => updateDoc(doc(db, "usuarios", d.id), { rol: rolNuevo })));
    return afectados.length;
};
