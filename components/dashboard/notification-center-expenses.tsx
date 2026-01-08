// @/components/dashboard/notification-center-expenses.tsx
"use client"

import React, { useMemo, useState } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { CheckCircle2, X, Sparkles, History, MessageSquareText, MailOpen, ChevronRight, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface NotificationGasto {
  id: string
  title: string
  description: string
  type: "success" | "urgent" | "warning" | "info" | "neutral"
  icon: React.ReactNode
  timestamp: Date
  isRead?: boolean
  metadata?: any
}

interface NotificationCenterExpensesProps {
  isOpen: boolean
  onClose: () => void
  activeNotifications: NotificationGasto[]
  onDeleteNotification: (id: string) => void
  onToggleRead: (id: string) => void
  onMarkAllRead: () => void
}

export function NotificationCenterExpenses({
  isOpen,
  onClose,
  activeNotifications,
  onDeleteNotification,
  onToggleRead,
  onMarkAllRead,
}: NotificationCenterExpensesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const generateDetail = (note: NotificationGasto) => {
    const { metadata } = note
    if (note.type === "warning" && metadata?.diasRestantes !== undefined) {
      return `Recordatorio: Falta ${metadata.diasRestantes} día(s) para el pago de ${metadata.concepto || 'gasto'}.`
    }
    return note.description
  }

  const { recientes, anteriores } = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const sorted = [...activeNotifications].sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
        const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
        return dateB - dateA;
    });

    return {
      recientes: sorted.filter((n) => n.timestamp >= today),
      anteriores: sorted.filter((n) => n.timestamp < today),
    }
  }, [activeNotifications])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-md z-[60]" />
          <motion.aside initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }} className="fixed top-0 right-0 h-full w-full md:w-[450px] z-[70] p-4 md:p-6">
            <Card className="h-full rounded-[3rem] border-0 shadow-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl flex flex-col overflow-hidden">
              <div className="p-8 border-b border-black/5 dark:border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20"><Clock className="w-6 h-6 text-white" /></div>
                    <div>
                      <h3 className="font-black text-2xl tracking-tighter italic uppercase leading-none text-slate-900 dark:text-white">Recordatorios</h3>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">Gastos y Pagos</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 text-slate-500"><X /></Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={onMarkAllRead} className="flex-1 rounded-xl font-bold text-[10px] uppercase gap-2 bg-black/5 dark:bg-white/5"><MailOpen className="w-3.5 h-3.5" /> Marcar Todo</Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <LayoutGroup>
                  <NotificationSection title="Hoy" items={recientes} icon={<Sparkles className="w-3 h-3 text-orange-500" />} expandedId={expandedId} onExpand={setExpandedId} detail={generateDetail} onDelete={onDeleteNotification} onToggleRead={onToggleRead} />
                  <NotificationSection title="Anteriores" items={anteriores} icon={<History className="w-3 h-3 text-slate-400" />} expandedId={expandedId} onExpand={setExpandedId} detail={generateDetail} onDelete={onDeleteNotification} onToggleRead={onToggleRead} />
                </LayoutGroup>
                {activeNotifications.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20"><CheckCircle2 className="w-20 h-20 mb-4" /><p className="font-black uppercase tracking-widest text-xs">Todo al día</p></div>
                )}
              </div>
            </Card>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function NotificationSection({ title, items, icon, expandedId, onExpand, detail, onDelete, onToggleRead }: any) {
  if (items.length === 0) return null
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-2"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{icon} {title}</p></div>
      {items.map((note: NotificationGasto) => (
        <NotificationCard key={note.id} note={note} isExpanded={expandedId === note.id} detail={detail(note)} onExpand={() => onExpand(expandedId === note.id ? null : note.id)} onDelete={() => onDelete(note.id)} onToggleRead={() => onToggleRead(note.id)} />
      ))}
    </div>
  )
}

function NotificationCard({ note, isExpanded, detail, onExpand, onDelete, onToggleRead }: any) {
  const formatDate = (date: any) => {
    const d = date instanceof Date ? date : date?.toDate ? date.toDate() : new Date();
    return `${d.toLocaleDateString("es-VE")} — ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  }

  return (
    <motion.div layout className={cn("p-5 rounded-[2.5rem] border transition-all duration-300 relative", note.isRead ? "bg-black/5 border-transparent opacity-60 dark:bg-white/5" : "bg-white dark:bg-white/10 border-black/5 dark:border-white/5 shadow-sm")}>
      <div className="flex gap-4 cursor-pointer" onClick={onExpand}>
        <div className={cn("relative shrink-0 p-3 rounded-2xl h-fit shadow-md", note.type === 'urgent' ? 'bg-red-500' : 'bg-orange-500')}>
          {React.isValidElement(note.icon) ? React.cloneElement(note.icon as React.ReactElement, { className: "w-5 h-5 text-white" }) : <Clock className="w-5 h-5 text-white" />}
          {!note.isRead && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <p className="font-black text-[13px] uppercase tracking-tight truncate text-slate-900 dark:text-white pr-2">{note.title}</p>
            <span className="text-[9px] font-black text-slate-400 bg-white/50 dark:bg-slate-800 px-2 py-0.5 rounded-full whitespace-nowrap uppercase">{formatDate(note.timestamp)}</span>
          </div>
          <p className="text-[12px] font-bold text-slate-500 leading-tight">{note.description}</p>
        </div>
        <ChevronRight className={cn("w-4 h-4 mt-1 opacity-20 transition-transform", isExpanded && "rotate-90")} />
      </div>
      <AnimatePresence>{isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-5 pt-5 border-t border-black/5 dark:border-white/5 space-y-4">
            <div className="bg-orange-600/5 dark:bg-orange-500/10 p-4 rounded-3xl border border-orange-500/10">
              <p className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-2 mb-2 italic"><MessageSquareText className="w-3.5 h-3.5" /> Detalle SMR</p>
              <p className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed italic">"{detail}"</p>
            </div>
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onToggleRead(); }} className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase bg-black/5">{note.isRead ? "No leído" : "Leído"}</Button>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase text-red-500 hover:bg-red-50">Borrar</Button>
            </div>
          </motion.div>
        )}</AnimatePresence>
    </motion.div>
  )
}