// @/lib/contexts/notification-context.tsx
"use client"

import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef
} from "react";
import {
  collection, query, where, orderBy, onSnapshot
} from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  type Notificacion, markNotifAsRead, markAllNotifsAsRead, deleteNotification
} from "@/lib/services/notification-service";

interface NotificationContextType {
  notifications: Notificacion[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  canPushNotify: boolean;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const TIPO_ICONS: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  orden: '📋',
  pago: '💰',
  tarea: '✔️',
};

function showSystemNotification(title: string, body: string, tipo: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const icon = TIPO_ICONS[tipo] || '🔔';
    new Notification(`${icon} ${title}`, {
      body,
      icon: '/smr-logo-dark.png',
      tag: `smr-${Date.now()}`,
      requireInteraction: tipo === 'error' || tipo === 'warning',
    });
  } catch {
    // Silently fail if notifications are blocked
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [canPushNotify, setCanPushNotify] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);

  // Sync Notification permission state
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setCanPushNotify(Notification.permission === 'granted');
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setCanPushNotify(result === 'granted');
    if (result === 'granted') {
      toast.success('Notificaciones de Windows activadas');
    } else {
      toast.error('Permiso denegado. Actívalas desde la configuración del navegador.');
    }
  }, []);

  // Firestore real-time listener
  useEffect(() => {
    if (!user?.uid || !userData?.rol) return;

    const uid = user.uid;
    const rol = userData.rol;

    // Query: notifs directed at this user OR at this role
    // Firestore OR queries require composite indexes — use two separate queries merged
    const qUser = query(
      collection(db, "notificaciones"),
      where("targetUserId", "==", uid),
      orderBy("creadoEn", "desc")
    );

    const qRole = query(
      collection(db, "notificaciones"),
      where("targetRoles", "array-contains", rol),
      orderBy("creadoEn", "desc")
    );

    const mergedMap = new Map<string, Notificacion>();

    const processSnapshot = () => {
      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const ta = a.creadoEn?.toMillis?.() ?? 0;
        const tb = b.creadoEn?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setNotifications(sorted);

      // Show toast + system notification for NEW unread items
      if (mountedRef.current) {
        sorted.forEach(n => {
          if (!n.leida && !prevIdsRef.current.has(n.id)) {
            // In-app toast
            const toastFn = n.tipo === 'error' ? toast.error
              : n.tipo === 'warning' ? toast.warning
              : n.tipo === 'success' ? toast.success
              : toast.info;
            toastFn(`${n.titulo}`, { description: n.cuerpo, duration: 6000 });

            // System (Windows) notification
            showSystemNotification(n.titulo, n.cuerpo, n.tipo);
          }
        });
      }

      // Update seen IDs
      prevIdsRef.current = new Set(sorted.map(n => n.id));
      mountedRef.current = true;
    };

    const unsubUser = onSnapshot(qUser, (snap) => {
      snap.docs.forEach(d => mergedMap.set(d.id, { id: d.id, ...d.data() } as Notificacion));
      // Remove items no longer in user query that might have been deleted
      processSnapshot();
    }, () => { /* ignore index errors silently */ });

    const unsubRole = onSnapshot(qRole, (snap) => {
      snap.docs.forEach(d => mergedMap.set(d.id, { id: d.id, ...d.data() } as Notificacion));
      processSnapshot();
    }, () => { /* ignore index errors silently */ });

    return () => {
      unsubUser();
      unsubRole();
      mergedMap.clear();
      mountedRef.current = false;
    };
  }, [user?.uid, userData?.rol]);

  const markAsRead = useCallback(async (id: string) => {
    await markNotifAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.leida).map(n => n.id);
    await markAllNotifsAsRead(unread);
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
  }, [notifications]);

  const dismiss = useCallback(async (id: string) => {
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.leida).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      markAsRead, markAllRead, dismiss,
      canPushNotify, requestPermission,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationProvider");
  return ctx;
}
