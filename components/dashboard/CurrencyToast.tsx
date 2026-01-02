"use client"
import React from 'react'
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface CurrencyToastProps {
  show: boolean
  message: string
  onClose: () => void
}

export function CurrencyToast({ show, message, onClose }: CurrencyToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
          className="fixed bottom-10 right-10 z-[100]"
        >
          <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-4 min-w-[280px]">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">SMR Intelligence</p>
              <p className="text-[13px] font-bold text-slate-800 dark:text-white leading-tight">{message}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}