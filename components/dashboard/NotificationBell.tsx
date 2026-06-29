// @/components/dashboard/NotificationBell.tsx
"use client"

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, CheckCheck, Trash2, X,
  Info, CheckCircle2, AlertTriangle, XCircle,
  ClipboardList, Coins, CheckSquare, Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/contexts/notification-context";
import type { NotifTipo } from "@/lib/services/notification-service";

interface NotificationBellProps {
  onNavigate?: (view: string) => void;
}

const TIPO_CONFIG: Record<NotifTipo, { icon: React.ReactNode; color: string; bg: string }> = {
  info:    { icon: <Info size={14} />,          color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-500/20" },
  success: { icon: <CheckCircle2 size={14} />,  color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-500/20" },
  warning: { icon: <AlertTriangle size={14} />, color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-500/20" },
  error:   { icon: <XCircle size={14} />,       color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-500/20" },
  orden:   { icon: <ClipboardList size={14} />, color: "text-purple-600",  bg: "bg-purple-100 dark:bg-purple-500/20" },
  pago:    { icon: <Coins size={14} />,          color: "text-green-600",   bg: "bg-green-100 dark:bg-green-500/20" },
  tarea:   { icon: <CheckSquare size={14} />,   color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-500/20" },
};

function timeAgo(ts: any): string {
  if (!ts) return "";
  const ms = ts?.toMillis?.() ?? new Date(ts).getTime();
  const diff = Date.now() - ms;
  if (diff < 60000) return "ahora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
  return `${Math.floor(diff / 86400000)} d`;
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllRead, dismiss, canPushNotify, requestPermission } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClickNotif = async (n: any) => {
    if (!n.leida) await markAsRead(n.id);
    if (n.link && onNavigate) onNavigate(n.link);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* BELL BUTTON */}
      <button
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

      {/* DROPDOWN PANEL */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-12 z-[200] w-80 bg-white dark:bg-[#1c1c1e] rounded-[1.5rem] shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
          >
            {/* Header */}
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
                {/* Windows notifications toggle */}
                <button
                  onClick={requestPermission}
                  title={canPushNotify ? "Notificaciones Windows activas" : "Activar notificaciones Windows"}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    canPushNotify
                      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                >
                  <Monitor size={13} />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    title="Marcar todas como leídas"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  >
                    <CheckCheck size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <BellOff size={28} className="mb-2 opacity-30" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map(n => {
                  const cfg = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.info;
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
                      {/* Dot */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", cfg.bg, cfg.color)}>
                          {cfg.icon}
                        </div>
                        {!n.leida && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[11px] font-black truncate", n.leida ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-white")}>
                          {n.titulo}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{n.cuerpo}</p>
                        <p className="text-[9px] text-slate-300 dark:text-slate-600 mt-1 uppercase tracking-widest">{timeAgo(n.creadoEn)}</p>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                        className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-black/5 dark:border-white/5 flex justify-center">
                <button
                  onClick={async () => {
                    await Promise.all(notifications.map(n => dismiss(n.id)));
                    setOpen(false);
                  }}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={10} /> Limpiar todo
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
