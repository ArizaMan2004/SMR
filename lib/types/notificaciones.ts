// @/lib/types/notificaciones.ts
//
// ESQUEMA ÚNICO DE NOTIFICACIONES.
//
// Hasta ahora había TRES sistemas escribiendo en la misma colección
// "notificaciones" con campos incompatibles entre sí:
//
//   notification-service.ts   -> { titulo, cuerpo, tipo, leida,   creadoEn,  targetRoles }
//   gastos-service.ts         -> { title,  description, type, isRead, timestamp, category }
//   notifications-service.ts  -> { ...lo que sea,             isRead, timestamp }
//
// Como cada lector ordenaba por un campo distinto (`creadoEn` vs `timestamp`) y
// Firestore EXCLUYE los documentos que no tienen el campo por el que se ordena,
// cada pantalla veía solo la mitad de las notificaciones:
//
//   - Las de órdenes y producción no aparecían en el Centro de Notificaciones.
//   - Las de gastos y tasas no aparecían en la campana.
//   - "Marcar como leída" escribía `leida` en un lado e `isRead` en el otro,
//     así que lo leído en una pantalla seguía sin leer en la otra.
//
// Este archivo define la forma canónica y sabe leer las tres antiguas, para que
// el historial que ya tienes guardado se siga viendo sin migrar nada.

export type NotifTipo = 'info' | 'success' | 'warning' | 'error';

export type NotifCategoria =
    | 'orden'
    | 'pago'
    | 'gasto'
    | 'empleado'
    | 'tarea'
    | 'inventario'
    | 'sistema';

export interface Notificacion {
    id: string;
    titulo: string;
    cuerpo: string;
    tipo: NotifTipo;
    categoria: NotifCategoria;
    leida: boolean;
    /** Ya normalizada a Date, venga de `creadoEn` o de `timestamp`. */
    fecha: Date;

    // --- A quién va dirigida ---
    /** UID concreto. Si está, solo la ve esa persona. */
    targetUserId?: string;
    /** Rangos que deben verla. Vacío o ausente = todos. */
    targetRoles?: string[];
    /** Áreas de producción implicadas (IMPRESION, CORTE, DISENO...). */
    targetAreas?: string[];

    /** Vista del dashboard a la que saltar al hacer clic. */
    link?: string;
    ordenId?: string;
}

export const CATEGORIA_META: Record<NotifCategoria, { label: string; icono: string; color: string }> = {
    orden:      { label: 'Órdenes',      icono: '📋', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
    pago:       { label: 'Pagos',        icono: '💰', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
    gasto:      { label: 'Gastos',       icono: '🧾', color: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },
    empleado:   { label: 'Personal',     icono: '👤', color: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10' },
    tarea:      { label: 'Tareas',       icono: '✔️', color: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
    inventario: { label: 'Inventario',   icono: '📦', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10' },
    sistema:    { label: 'Sistema',      icono: '⚙️', color: 'text-slate-600 bg-slate-100 dark:bg-white/10' },
};

export const TIPO_META: Record<NotifTipo, { label: string; icono: string; punto: string }> = {
    info:    { label: 'Información', icono: 'ℹ️', punto: 'bg-blue-500' },
    success: { label: 'Correcto',    icono: '✅', punto: 'bg-emerald-500' },
    warning: { label: 'Atención',    icono: '⚠️', punto: 'bg-orange-500' },
    error:   { label: 'Urgente',     icono: '❌', punto: 'bg-rose-500' },
};

// --- NORMALIZACIÓN DE LO YA GUARDADO ---

const TIPOS_VALIDOS: NotifTipo[] = ['info', 'success', 'warning', 'error'];

/** Los tipos antiguos no coinciden con los nuevos: se traducen. */
const MAPA_TIPOS: Record<string, NotifTipo> = {
    urgent: 'error',
    urgente: 'error',
    neutral: 'info',
    orden: 'info',
    pago: 'success',
    tarea: 'info',
    expense: 'warning',
    gasto: 'warning',
};

const normalizarTipo = (valor: any): NotifTipo => {
    const texto = String(valor ?? '').trim().toLowerCase();
    if ((TIPOS_VALIDOS as string[]).includes(texto)) return texto as NotifTipo;
    return MAPA_TIPOS[texto] ?? 'info';
};

const CATEGORIAS_VALIDAS: NotifCategoria[] = [
    'orden', 'pago', 'gasto', 'empleado', 'tarea', 'inventario', 'sistema',
];

const MAPA_CATEGORIAS: Record<string, NotifCategoria> = {
    expense: 'gasto',
    gastos: 'gasto',
    ordenes: 'orden',
    order: 'orden',
    payment: 'pago',
    pagos: 'pago',
    empleados: 'empleado',
    nomina: 'empleado',
    tareas: 'tarea',
    stock: 'inventario',
};

const normalizarCategoria = (raw: any): NotifCategoria => {
    // `categoria` es lo nuevo; `category` y `fuente` son las formas antiguas.
    const texto = String(raw?.categoria ?? raw?.category ?? raw?.fuente ?? '').trim().toLowerCase();
    if ((CATEGORIAS_VALIDAS as string[]).includes(texto)) return texto as NotifCategoria;
    return MAPA_CATEGORIAS[texto] ?? 'sistema';
};

/** Acepta Timestamp de Firestore, ISO, número o Date. */
const aFecha = (valor: any): Date | null => {
    if (!valor) return null;
    if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
    if (typeof valor?.toDate === 'function') {
        try { return valor.toDate(); } catch { return null; }
    }
    const f = new Date(valor);
    return isNaN(f.getTime()) ? null : f;
};

/**
 * Convierte un documento de Firestore —en cualquiera de los tres formatos
 * históricos— a la forma canónica. Nunca lanza: una notificación mal formada
 * se muestra degradada antes que romper la bandeja entera.
 */
export const normalizarNotificacion = (id: string, raw: any): Notificacion => {
    const datos = raw || {};

    return {
        id,
        titulo: String(datos.titulo ?? datos.title ?? 'Sin título'),
        cuerpo: String(datos.cuerpo ?? datos.description ?? datos.body ?? ''),
        tipo: normalizarTipo(datos.tipo ?? datos.type),
        categoria: normalizarCategoria(datos),
        // Dos nombres para lo mismo: por eso lo leído en una pantalla seguía
        // apareciendo sin leer en la otra.
        leida: Boolean(datos.leida ?? datos.isRead ?? false),
        fecha: aFecha(datos.creadoEn ?? datos.timestamp ?? datos.fecha) ?? new Date(0),
        targetUserId: datos.targetUserId || undefined,
        targetRoles: Array.isArray(datos.targetRoles) ? datos.targetRoles : undefined,
        targetAreas: Array.isArray(datos.targetAreas) ? datos.targetAreas : undefined,
        link: datos.link || undefined,
        ordenId: datos.ordenId || undefined,
    };
};

/**
 * ¿Le corresponde esta notificación a esta persona?
 *
 * Se filtra en el cliente a propósito. Hacerlo en Firestore exige índices
 * compuestos (where + orderBy), y el código anterior se tragaba en silencio el
 * error de índice faltante: la campana se quedaba vacía para siempre sin que
 * nadie se enterara de por qué.
 */
export const esParaEsteUsuario = (
    n: Notificacion,
    uid: string | undefined,
    rol: string | undefined
): boolean => {
    // Dirigida a una persona concreta: solo ella.
    if (n.targetUserId) return n.targetUserId === uid;
    // Dirigida a rangos: solo si el suyo está en la lista.
    if (n.targetRoles && n.targetRoles.length > 0) {
        return !!rol && n.targetRoles.includes(rol);
    }
    // Sin destinatario declarado (las antiguas de gastos): son para todos.
    return true;
};
