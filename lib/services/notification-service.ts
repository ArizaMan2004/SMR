// @/lib/services/notification-service.ts
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotifTipo = 'info' | 'success' | 'warning' | 'error' | 'orden' | 'pago' | 'tarea';

export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: NotifTipo;
  // Targeting — al menos uno debe estar presente
  targetUserId?: string;   // UID específico del usuario
  targetRoles?: string[];  // roles que deben verla (ADMIN, IMPRESOR, etc.)
  targetAreas?: string[];  // áreas de producción (IMPRESION, CORTE, DISENO)
  leida: boolean;
  creadoEn: any;           // Firestore Timestamp
  fuente: string;          // 'orden' | 'gasto' | 'empleado' | 'sistema'
  ordenId?: string;
  link?: string;           // vista a la que navegar al clickear
}

export type CreateNotifPayload = Omit<Notificacion, 'id' | 'leida' | 'creadoEn'>;

const COLLECTION = "notificaciones";

export async function createNotification(payload: CreateNotifPayload): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    leida: false,
    creadoEn: serverTimestamp(),
  });
  return ref.id;
}

export async function markNotifAsRead(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { leida: true });
}

export async function markAllNotifsAsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, COLLECTION, id), { leida: true }));
  await batch.commit();
}

export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

// Crea notificaciones para múltiples roles a la vez
export async function notifyRoles(
  roles: string[],
  payload: Omit<CreateNotifPayload, 'targetRoles' | 'targetUserId' | 'targetAreas'>
): Promise<void> {
  await createNotification({ ...payload, targetRoles: roles });
}

// Crea una notificación dirigida a un usuario específico
export async function notifyUser(
  userId: string,
  payload: Omit<CreateNotifPayload, 'targetRoles' | 'targetUserId' | 'targetAreas'>
): Promise<void> {
  await createNotification({ ...payload, targetUserId: userId });
}

// Detecta qué áreas/roles involucra una orden según sus ítems
export function detectOrderAreas(items: any[]): { roles: string[]; areas: string[] } {
  const roles = new Set<string>(['ADMIN', 'CAJERO', 'VENDEDOR']);
  const areas = new Set<string>();

  items.forEach((item: any) => {
    const tipo = (item.tipo || item.tipoItem || item.tipoServicio || item.nombre || '').toLowerCase();

    if (/imp|vinil|lona|banner|roll|flex|impresion|print/.test(tipo)) {
      roles.add('IMPRESOR');
      roles.add('PRODUCCION');
      areas.add('IMPRESION');
    }
    if (/laser|corte|grabado|acril|co2|fibra|marcado/.test(tipo)) {
      roles.add('OPERADOR_LASER');
      roles.add('PRODUCCION');
      areas.add('CORTE');
    }
    if (/dise|arte|vectori|logo|ilustra/.test(tipo)) {
      roles.add('DISENADOR');
      areas.add('DISENO');
    }
    if (/instal|montaj/.test(tipo)) {
      roles.add('PRODUCCION');
      areas.add('INSTALACION');
    }
  });

  return { roles: Array.from(roles), areas: Array.from(areas) };
}

// Envía notificaciones al crear una nueva orden
export async function notifyNuevaOrden(orden: {
  ordenNumero: string | number;
  cliente: { nombreRazonSocial: string };
  items: any[];
  totalUSD: number;
  id?: string;
}): Promise<void> {
  const { roles, areas } = detectOrderAreas(orden.items);
  const numero = orden.ordenNumero;
  const cliente = orden.cliente.nombreRazonSocial;

  await createNotification({
    titulo: `Nueva Orden #${numero}`,
    cuerpo: `${cliente} — $${orden.totalUSD.toFixed(2)} | Áreas: ${areas.join(', ') || 'General'}`,
    tipo: 'orden',
    targetRoles: roles,
    targetAreas: areas,
    fuente: 'orden',
    ordenId: orden.id,
    link: 'orders',
  });
}

// Envía notificación al cambiar el estado de producción
export async function notifyEstadoProduccion(orden: {
  ordenNumero: string | number;
  cliente: { nombreRazonSocial: string };
  estadoProduccion: string;
  id?: string;
}): Promise<void> {
  const labels: Record<string, string> = {
    PENDIENTE: 'marcada como Pendiente',
    EN_PRODUCCION: 'en Producción',
    TERMINADA: 'Terminada ✓',
  };
  const label = labels[orden.estadoProduccion] || orden.estadoProduccion;

  await createNotification({
    titulo: `Orden #${orden.ordenNumero} — ${label}`,
    cuerpo: `Cliente: ${orden.cliente.nombreRazonSocial}`,
    tipo: orden.estadoProduccion === 'TERMINADA' ? 'success' : 'info',
    targetRoles: ['ADMIN', 'CAJERO', 'VENDEDOR'],
    fuente: 'orden',
    ordenId: orden.id,
    link: 'orders',
  });
}
