// @/components/dashboard/NotificationBell.tsx
//
// Campana de notificaciones: vista rápida de la bandeja.
//
// El desplegable se dibuja con un PORTAL sobre <body>, no dentro del botón.
// Es imprescindible: la cabecera del dashboard tiene `overflow-hidden`, y eso
// recorta cualquier hijo posicionado por muy alto que sea su z-index. Por eso
// el panel se veía "atrapado" dentro de la barra superior sin superponerse a
// nada. Al sacarlo del árbol de la cabecera, ningún ancestro puede recortarlo.

"use client"

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, BellRing, CheckCheck, Trash2, X,
  Info, CheckCircle2, AlertTriangle, XCircle, Send, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/contexts/notification-context";
import { CATEGORIA_META, type NotifTipo, type Notificacion } from "@/lib/types/notificaciones";

interface NotificationBellProps {
  onNavigate?: (view: string) => void;
}

const TIPO_CONFIG: Record<NotifTipo, { icon: React.ReactNode; color: string; bg: string }> = {
  info:    { icon: <Info size={14} />,          color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-500/20" },
  success: { icon: <CheckCircle2 size={14} />,  color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-500/20" },
  warning: { icon: <AlertTriangle size={14} />, color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-500/20" },
  error:   { icon: <XCircle size={14} />,       color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-500/20" },
};

function timeAgo(ts: any): string {
  if (!ts) return "";
  const ms = ts?.toMillis?.() ?? new Date(ts).getTime();
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60000) return "ahora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
  return `${Math.floor(diff / 86400000)} d`;
}

const ANCHO_PANEL = 340;
const MARGEN = 12;

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const {
    notifications, unreadCount, markAsRead, markAllRead, dismiss, dismissAll,
    canPushNotify, pushBloqueado, requestPermission, probarAviso,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMontado(true), []);

  /** Coloca el panel justo debajo del botón, sin salirse de la pantalla. */
  const recalcular = useCallback(() => {
    const boton = botonRef.current;
    if (!boton) return;
    const r = boton.getBoundingClientRect();

    // Alineado a la derecha del botón, que es donde suele estar en la cabecera.
    let left = r.right - ANCHO_PANEL;
    left = Math.max(MARGEN, Math.min(left, window.innerWidth - ANCHO_PANEL - MARGEN));

    setPos({ top: r.bottom + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (open) recalcular();
  }, [open, recalcular]);

  // Si se hace scroll o cambia el tamaño, el panel sigue al botón.
  useEffect(() => {
    if (!open) return;
    const alMover = () => recalcular();
    window.addEventListener('resize', alMover);
    window.addEventListener('scroll', alMover, true);
    return () => {
      window.removeEventListener('resize', alMover);
      window.removeEventListener('scroll', alMover, true);
    };
  }, [open, recalcular]);

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (botonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const handleClickNotif = async (n: Notificacion) => {
    if (!n.leida) await markAsRead(n.id);
    if (n.link && onNavigate) {
      onNavigate(n.link);
      setOpen(false);
    }
  };

  const panel = pos && (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: ANCHO_PANEL }}
      className="z-[9999] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-[#1c1c1e] rounded-[1.5rem] shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-blue-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">
            Notificaciones
          </span>
          {unreadCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              title="Marcar todas como leídas"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
            >
              <CheckCheck size={13} />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            title="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Activar avisos del sistema: antes era un iconito de 13px escondido
          en la esquina y nadie lo encontraba. Ahora es una banda visible. */}
      {!canPushNotify && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-500/10 border-b border-blue-100 dark:border-blue-500/20">
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Avisos del sistema desactivados
          </p>
          <p className="text-[10px] font-bold text-blue-500 mt-0.5 leading-snug">
            {pushBloqueado
              ? 'Bloqueados en este navegador. Ábrelos desde el candado de la barra de direcciones y recarga.'
              : 'Actívalos para enterarte aunque no estés mirando la pestaña.'}
          </p>
          {!pushBloqueado && (
            <button
              onClick={requestPermission}
              className="mt-2 w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-colors"
            >
              <BellRing size={12} /> Activar avisos
            </button>
          )}
        </div>
      )}

      {canPushNotify && (
        <button
          onClick={probarAviso}
          className="w-full px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
        >
          <Send size={10} /> Avisos activos · Enviar prueba
        </button>
      )}

      {/* Lista */}
      <div className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <BellOff size={28} className="mb-2 opacity-30" />
            <p className="text-[10px] font-black uppercase tracking-widest">Sin notificaciones</p>
          </div>
        ) : (
          notifications.slice(0, 15).map(n => {
            const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.info;
            const cat = CATEGORIA_META[n.categoria];
            return (
              <div
                key={n.id}
                onClick={() => handleClickNotif(n)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-black/5 dark:border-white/5 last:border-b-0",
                  n.leida
                    ? "opacity-50 hover:opacity-70"
                    : "bg-blue-50/40 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                )}
              >
                <div className="relative shrink-0 mt-0.5">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", cfg.bg, cfg.color)}>
                    {cfg.icon}
                  </div>
                  {!n.leida && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-[11px] font-black truncate", n.leida ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white")}>
                    {n.titulo}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{n.cuerpo}</p>
                  <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-1 uppercase tracking-widest">
                    {cat?.label} · {timeAgo(n.fecha)}
                  </p>
                </div>

                <button
                  onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                  title="Eliminar"
                  className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pie */}
      <div className="px-3 py-2.5 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
        <button
          onClick={() => { onNavigate?.('notifications_full'); setOpen(false); }}
          className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
        >
          <Maximize2 size={10} /> Ver todas y filtrar
        </button>
        {notifications.length > 0 && (
          <button
            onClick={async () => { await dismissAll(); setOpen(false); }}
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
          >
            <Trash2 size={10} /> Limpiar
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <button
        ref={botonRef}
        onClick={() => setOpen(v => !v)}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all",
          open
            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        )}
        title="Notificaciones"
      >
        <Bell size={18} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none shadow-md"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Fuera de la cabecera, directamente sobre <body>. */}
      {montado && createPortal(
        <AnimatePresence>{open && panel}</AnimatePresence>,
        document.body
      )}
    </>
  );
}
