// @/lib/services/notificaciones-service.ts
//
// SERVICIO ÚNICO DE NOTIFICACIONES. Sustituye a los tres que había
// (notification-service, notifications-service y las funciones sueltas de
// gastos-service), que escribían campos distintos en la misma colección.

import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch,
    Timestamp,
} from "firebase/firestore";

import {
    normalizarNotificacion,
    type Notificacion,
    type NotifTipo,
    type NotifCategoria,
} from "@/lib/types/notificaciones";

const COLECCION = "notificaciones";

/** Cuántas se traen. Suben rápido; con 80 sobra para la bandeja. */
const LIMITE = 80;

export interface CrearNotificacionPayload {
    titulo: string;
    cuerpo: string;
    tipo?: NotifTipo;
    categoria?: NotifCategoria;
    targetUserId?: string;
    targetRoles?: string[];
    targetAreas?: string[];
    link?: string;
    ordenId?: string;
}

/**
 * Crea una notificación.
 *
 * Escribe los campos canónicos Y los antiguos (`timestamp`, `isRead`, `title`,
 * `description`) a propósito: mientras quede alguna pantalla vieja leyendo el
 * formato anterior, seguirá funcionando. Cuando ya no quede ninguna, se pueden
 * quitar los duplicados de aquí y nada más.
 */
export async function crearNotificacion(payload: CrearNotificacionPayload): Promise<string> {
    const ahora = Timestamp.now();

    const documento: any = {
        // Canónico
        titulo: payload.titulo,
        cuerpo: payload.cuerpo,
        tipo: payload.tipo ?? 'info',
        categoria: payload.categoria ?? 'sistema',
        leida: false,
        creadoEn: serverTimestamp(),

        // Compatibilidad con los lectores antiguos
        title: payload.titulo,
        description: payload.cuerpo,
        type: payload.tipo ?? 'info',
        category: payload.categoria ?? 'sistema',
        isRead: false,
        timestamp: ahora,
    };

    if (payload.targetUserId) documento.targetUserId = payload.targetUserId;
    if (payload.targetRoles?.length) documento.targetRoles = payload.targetRoles;
    if (payload.targetAreas?.length) documento.targetAreas = payload.targetAreas;
    if (payload.link) documento.link = payload.link;
    if (payload.ordenId) documento.ordenId = payload.ordenId;

    const ref = await addDoc(collection(db, COLECCION), documento);
    return ref.id;
}

/**
 * Escucha TODAS las notificaciones y las devuelve ya normalizadas y ordenadas.
 *
 * Se lanzan dos consultas, una por cada campo de fecha histórico. Es necesario:
 * Firestore descarta los documentos que no tienen el campo por el que se
 * ordena, así que una sola consulta por `creadoEn` perdería todas las
 * notificaciones antiguas de gastos, y una sola por `timestamp` perdería las
 * de órdenes. Los resultados se fusionan por id, así que un documento nuevo
 * (que tiene ambos campos) no se duplica.
 *
 * El filtrado por rol se hace en el cliente, no aquí: mezclar `where` con
 * `orderBy` obliga a crear índices compuestos, y si falta el índice Firestore
 * falla en silencio y la bandeja se queda vacía sin explicación.
 */
export function subscribeToNotificaciones(
    callback: (notificaciones: Notificacion[]) => void,
    onError?: (mensaje: string) => void
) {
    const porCampo = new Map<string, Map<string, Notificacion>>();

    const emitir = () => {
        const fusionadas = new Map<string, Notificacion>();
        porCampo.forEach(mapa => {
            mapa.forEach((n, id) => fusionadas.set(id, n));
        });

        const lista = Array.from(fusionadas.values())
            .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
            .slice(0, LIMITE);

        callback(lista);
    };

    const escuchar = (campo: 'creadoEn' | 'timestamp') => {
        const q = query(collection(db, COLECCION), orderBy(campo, "desc"), limit(LIMITE));
        return onSnapshot(
            q,
            snapshot => {
                const mapa = new Map<string, Notificacion>();
                snapshot.docs.forEach(d => mapa.set(d.id, normalizarNotificacion(d.id, d.data())));
                porCampo.set(campo, mapa);
                emitir();
            },
            error => {
                // Antes esto se ignoraba en silencio y nadie entendía por qué la
                // campana estaba vacía. Ahora al menos queda constancia.
                console.error(`Error escuchando notificaciones por "${campo}":`, error);
                porCampo.set(campo, new Map());
                emitir();
                onError?.(error?.message || 'No se pudieron cargar las notificaciones');
            }
        );
    };

    const unsubCreadoEn = escuchar('creadoEn');
    const unsubTimestamp = escuchar('timestamp');

    return () => {
        unsubCreadoEn();
        unsubTimestamp();
        porCampo.clear();
    };
}

/** Marca como leída escribiendo LOS DOS campos, para que se note en toda la app. */
export async function marcarComoLeida(id: string, leida = true): Promise<void> {
    await updateDoc(doc(db, COLECCION, id), { leida, isRead: leida });
}

export async function marcarTodasComoLeidas(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // writeBatch admite 500 operaciones; se trocea por si acaso.
    for (let i = 0; i < ids.length; i += 400) {
        const lote = writeBatch(db);
        ids.slice(i, i + 400).forEach(id => {
            lote.update(doc(db, COLECCION, id), { leida: true, isRead: true });
        });
        await lote.commit();
    }
}

export async function eliminarNotificacion(id: string): Promise<void> {
    await deleteDoc(doc(db, COLECCION, id));
}

export async function eliminarNotificaciones(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    for (let i = 0; i < ids.length; i += 400) {
        const lote = writeBatch(db);
        ids.slice(i, i + 400).forEach(id => lote.delete(doc(db, COLECCION, id)));
        await lote.commit();
    }
}

// --- ATAJOS DE NEGOCIO ---

/** Detecta qué rangos y áreas implica una orden según sus ítems. */
export function detectarAreasDeOrden(items: any[]): { roles: string[]; areas: string[] } {
    const roles = new Set<string>(['ADMIN', 'CAJERO', 'VENDEDOR']);
    const areas = new Set<string>();

    (items || []).forEach((item: any) => {
        const tipo = String(
            item?.tipo || item?.tipoItem || item?.tipoServicio || item?.nombre || ''
        ).toLowerCase();

        if (/imp|vinil|lona|banner|roll|flex|impresion|print/.test(tipo)) {
            roles.add('IMPRESOR'); roles.add('PRODUCCION'); areas.add('IMPRESION');
        }
        if (/laser|corte|grabado|acril|co2|fibra|marcado/.test(tipo)) {
            roles.add('OPERADOR_LASER'); roles.add('PRODUCCION'); areas.add('CORTE');
        }
        if (/dise|arte|vectori|logo|ilustra/.test(tipo)) {
            roles.add('DISENADOR'); areas.add('DISENO');
        }
        if (/instal|montaj/.test(tipo)) {
            roles.add('PRODUCCION'); areas.add('INSTALACION');
        }
    });

    return { roles: Array.from(roles), areas: Array.from(areas) };
}

export async function notificarNuevaOrden(orden: {
    ordenNumero: string | number;
    cliente: { nombreRazonSocial: string };
    items: any[];
    totalUSD: number;
    id?: string;
}): Promise<void> {
    const { roles, areas } = detectarAreasDeOrden(orden.items);

    await crearNotificacion({
        titulo: `Nueva Orden #${orden.ordenNumero}`,
        cuerpo: `${orden.cliente.nombreRazonSocial} — $${(orden.totalUSD || 0).toFixed(2)} · ${areas.join(', ') || 'General'}`,
        tipo: 'info',
        categoria: 'orden',
        targetRoles: roles,
        targetAreas: areas,
        ordenId: orden.id,
        link: 'orders',
    });
}

export async function notificarEstadoProduccion(orden: {
    ordenNumero: string | number;
    cliente: { nombreRazonSocial: string };
    estadoProduccion: string;
    id?: string;
}): Promise<void> {
    const etiquetas: Record<string, string> = {
        PENDIENTE: 'marcada como Pendiente',
        EN_PRODUCCION: 'en Producción',
        TERMINADA: 'Terminada ✓',
    };

    await crearNotificacion({
        titulo: `Orden #${orden.ordenNumero} — ${etiquetas[orden.estadoProduccion] || orden.estadoProduccion}`,
        cuerpo: `Cliente: ${orden.cliente.nombreRazonSocial}`,
        tipo: orden.estadoProduccion === 'TERMINADA' ? 'success' : 'info',
        categoria: 'orden',
        targetRoles: ['ADMIN', 'CAJERO', 'VENDEDOR'],
        ordenId: orden.id,
        link: 'orders',
    });
}
