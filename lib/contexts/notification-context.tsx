// @/lib/contexts/notification-context.tsx
//
// Punto único desde el que toda la app lee y marca notificaciones.
// La campana y el Centro de Notificaciones consumen exactamente los mismos
// datos, así que ya no pueden mostrar cosas distintas ni descuadrar el contador.

"use client"

import React, {
  createContext, useContext, useEffect, useState, useCallback, useMemo, useRef
} from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  subscribeToNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  eliminarNotificaciones,
} from "@/lib/services/notificaciones-service";
import {
  esParaEsteUsuario,
  TIPO_META,
  type Notificacion,
  type NotifCategoria,
} from "@/lib/types/notificaciones";

interface NotificationContextType {
  /** Ya filtradas para esta persona y ordenadas de más nueva a más vieja. */
  notifications: Notificacion[];
  unreadCount: number;
  /** Cuántas sin leer hay de cada categoría, para los contadores de los filtros. */
  countsPorCategoria: Record<string, number>;
  cargando: boolean;
  /** Mensaje si Firestore falló, en vez de quedarse en blanco sin explicación. */
  error: string | null;

  markAsRead: (id: string, leida?: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;

  canPushNotify: boolean;
  pushBloqueado: boolean;
  requestPermission: () => Promise<void>;
  /** Lanza un aviso de prueba, para comprobar que de verdad llegan. */
  probarAviso: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Muestra el aviso del sistema operativo.
 *
 * Se intenta primero por el service worker: así el aviso sigue apareciendo con
 * la pestaña en segundo plano y en el móvil con la app instalada, cosa que
 * `new Notification()` desde la página no garantiza.
 */
async function mostrarAvisoDelSistema(n: Notificacion) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const titulo = `${TIPO_META[n.tipo]?.icono || '🔔'} ${n.titulo}`;
  const opciones: NotificationOptions = {
    body: n.cuerpo,
    icon: '/smr-logo-dark.png',
    badge: '/smr-logo-dark.png',
    // Agrupa por notificación concreta: si llega dos veces, no se apila duplicada.
    tag: `smr-${n.id}`,
    requireInteraction: n.tipo === 'error' || n.tipo === 'warning',
    data: { link: n.link, id: n.id },
  };

  try {
    if ('serviceWorker' in navigator) {
      // OJO: aquí había un bug grave. Usar `navigator.serviceWorker.ready`
      // parece lo natural, pero esa promesa NO se rechaza cuando no hay
      // service worker: se queda esperando para siempre. Y en desarrollo no
      // lo hay, porque next.config.mjs desactiva el PWA fuera de producción.
      // Resultado: el `await` no volvía nunca y el aviso no llegaba jamás.
      // `getRegistration()` sí resuelve (con undefined) si no hay ninguno,
      // y aun así se le pone un tope de tiempo por seguridad.
      const registro = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 800)),
      ]);

      if (registro?.showNotification) {
        await registro.showNotification(titulo, opciones);
        return;
      }
    }
  } catch {
    // Si el service worker falla, se cae al método de la página.
  }

  try {
    new Notification(titulo, opciones);
  } catch {
    // Bloqueadas por el navegador: no es motivo para romper nada.
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth();

  const [todas, setTodas] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [canPushNotify, setCanPushNotify] = useState(false);
  const [pushBloqueado, setPushBloqueado] = useState(false);

  // Ids ya vistos, para avisar solo de lo que llega nuevo y no de golpe al abrir.
  const idsVistosRef = useRef<Set<string>>(new Set());
  const yaMontadoRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setCanPushNotify(Notification.permission === 'granted');
    setPushBloqueado(Notification.permission === 'denied');
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador no admite notificaciones de escritorio.');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushBloqueado(true);
      toast.error('Están bloqueadas. Actívalas desde el candado de la barra de direcciones.');
      return;
    }

    const resultado = await Notification.requestPermission();
    setCanPushNotify(resultado === 'granted');
    setPushBloqueado(resultado === 'denied');

    if (resultado === 'granted') {
      toast.success('Avisos del sistema activados');
      // Aviso inmediato de confirmación: si no aparece este, tampoco aparecerán
      // los demás, y así se sabe al momento en vez de descubrirlo días después.
      mostrarAvisoDelSistema({
        id: 'prueba-activacion',
        titulo: 'Avisos activados',
        cuerpo: 'A partir de ahora verás aquí las órdenes, pagos y tareas.',
        tipo: 'success',
        categoria: 'sistema',
        leida: false,
        fecha: new Date(),
      });
    } else if (resultado === 'denied') {
      toast.error('Permiso denegado. Actívalo desde el candado de la barra de direcciones.');
    } else {
      toast.info('No se concedió el permiso. Vuelve a intentarlo cuando quieras.');
    }
  }, []);

  const probarAviso = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador no admite avisos del sistema.');
      return;
    }
    if (Notification.permission !== 'granted') {
      toast.error('Primero activa los avisos del sistema.');
      return;
    }
    await mostrarAvisoDelSistema({
      id: `prueba-${Date.now()}`,
      titulo: 'Aviso de prueba',
      cuerpo: 'Si ves esto fuera del navegador, los avisos funcionan.',
      tipo: 'info',
      categoria: 'sistema',
      leida: false,
      fecha: new Date(),
    });
    toast.success('Aviso de prueba enviado');
  }, []);

  // --- UNA SOLA SUSCRIPCIÓN PARA TODA LA APP ---
  useEffect(() => {
    setCargando(true);
    const unsubscribe = subscribeToNotificaciones(
      lista => {
        setTodas(lista);
        setCargando(false);
        setError(null);
      },
      mensaje => {
        setError(mensaje);
        setCargando(false);
      }
    );
    return () => {
      unsubscribe();
      yaMontadoRef.current = false;
      idsVistosRef.current = new Set();
    };
  }, []);

  // Solo las que le corresponden a esta persona.
  const notifications = useMemo(
    () => todas.filter(n => esParaEsteUsuario(n, user?.uid, userData?.rol)),
    [todas, user?.uid, userData?.rol]
  );

  // Aviso emergente y del sistema para lo que acaba de llegar.
  useEffect(() => {
    if (!yaMontadoRef.current) {
      // Primera carga: no reventar la pantalla con el historial entero.
      idsVistosRef.current = new Set(notifications.map(n => n.id));
      if (notifications.length > 0 || !cargando) yaMontadoRef.current = true;
      return;
    }

    notifications.forEach(n => {
      if (n.leida || idsVistosRef.current.has(n.id)) return;

      const mostrar = n.tipo === 'error' ? toast.error
        : n.tipo === 'warning' ? toast.warning
        : n.tipo === 'success' ? toast.success
        : toast.info;

      mostrar(n.titulo, { description: n.cuerpo, duration: 6000 });
      mostrarAvisoDelSistema(n);
    });

    idsVistosRef.current = new Set(notifications.map(n => n.id));
  }, [notifications, cargando]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.leida).length, [notifications]);

  const countsPorCategoria = useMemo(() => {
    const contador: Record<string, number> = {};
    notifications.forEach(n => {
      if (n.leida) return;
      contador[n.categoria] = (contador[n.categoria] || 0) + 1;
    });
    return contador;
  }, [notifications]);

  // Actualización optimista: la lista real llega sola por la suscripción,
  // pero así el clic se siente inmediato.
  const markAsRead = useCallback(async (id: string, leida = true) => {
    setTodas(prev => prev.map(n => n.id === id ? { ...n, leida } : n));
    try {
      await marcarComoLeida(id, leida);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo actualizar la notificación');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = notifications.filter(n => !n.leida).map(n => n.id);
    if (ids.length === 0) return;
    setTodas(prev => prev.map(n => ids.includes(n.id) ? { ...n, leida: true } : n));
    try {
      await marcarTodasComoLeidas(ids);
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron marcar como leídas');
    }
  }, [notifications]);

  const dismiss = useCallback(async (id: string) => {
    setTodas(prev => prev.filter(n => n.id !== id));
    try {
      await eliminarNotificacion(id);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo eliminar');
    }
  }, []);

  const dismissAll = useCallback(async () => {
    const ids = notifications.map(n => n.id);
    if (ids.length === 0) return;
    setTodas(prev => prev.filter(n => !ids.includes(n.id)));
    try {
      await eliminarNotificaciones(ids);
      toast.success('Bandeja vaciada');
    } catch (e) {
      console.error(e);
      toast.error('No se pudo vaciar la bandeja');
    }
  }, [notifications]);

  const valor = useMemo<NotificationContextType>(() => ({
    notifications,
    unreadCount,
    countsPorCategoria,
    cargando,
    error,
    markAsRead,
    markAllRead,
    dismiss,
    dismissAll,
    canPushNotify,
    pushBloqueado,
    requestPermission,
    probarAviso,
  }), [
    notifications, unreadCount, countsPorCategoria, cargando, error,
    markAsRead, markAllRead, dismiss, dismissAll,
    canPushNotify, pushBloqueado, requestPermission, probarAviso,
  ]);

  return (
    <NotificationContext.Provider value={valor}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationProvider");
  return ctx;
}

export type { Notificacion, NotifCategoria };
