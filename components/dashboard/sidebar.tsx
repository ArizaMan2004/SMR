// @/components/dashboard/sidebar.tsx
"use client"

import React from "react" 
import { Button } from "@/components/ui/button"
import Image from "next/image" 
import { motion, AnimatePresence } from "framer-motion"
import { LogOut, X, ChevronRight } from "lucide-react" 
import { ThemeToggle } from "@/components/theme-toggle" 
import { cn } from "@/lib/utils"

interface NavItem {
    id: string
    label: string
    icon: React.ReactElement 
}

interface SidebarProps {
    activeView: string
    setActiveView: (view: string) => void
    navItems: NavItem[] 
    onLogout?: () => void 
    isMobileOpen: boolean
    setIsMobileOpen: (v: boolean) => void
}

const LOGO_LIGHT_PATH = "/smr-logo-light.png";
const LOGO_DARK_PATH = "/smr-logo-dark.png";  

export default function Sidebar({
    activeView,
    setActiveView,
    navItems,
    onLogout,
    isMobileOpen,
    setIsMobileOpen,
}: SidebarProps) {

    return (
        <>
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        // Ajustado a z-40 para estar debajo del modal
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsMobileOpen(false)}
                    />
                )}
            </AnimatePresence>

            <aside
                className={cn(
                    // Ajustado a z-40 para que el Dialog (z-50) pase por encima
                    "fixed inset-y-0 left-0 z-40 flex flex-col w-72 bg-white dark:bg-slate-950 border-r border-slate-200/60 dark:border-slate-800/60 transition-transform duration-500 ease-in-out shadow-2xl lg:shadow-none",
                    isMobileOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="px-6 h-24 flex items-center justify-between">
                    <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className="relative h-10 w-32 cursor-pointer"
                    >
                        <Image src={LOGO_LIGHT_PATH} alt="Logo" fill className="object-contain dark:hidden" />
                        <Image src={LOGO_DARK_PATH} alt="Logo" fill className="object-contain hidden dark:block" />
                    </motion.div>
                    
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => setIsMobileOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                
                <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
                    <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Menú Principal
                    </p>
                    {navItems.map((item) => {
                        const isActive = activeView === item.id;
                        return (
                            <motion.button
                                key={item.id}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                    setActiveView(item.id)
                                    if (window.innerWidth < 1024) setIsMobileOpen(false)
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative",
                                    isActive 
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                                )}
                            >
                                <div className={cn(
                                    "p-1 rounded-lg transition-colors",
                                    isActive ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700"
                                )}>
                                    {React.cloneElement(item.icon, { className: "w-4 h-4" })}
                                </div>
                                <span className="text-sm font-bold tracking-tight flex-1 text-left">
                                    {item.label}
                                </span>
                                {isActive && (
                                    <motion.div layoutId="activeInd" className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                )}
                                {!isActive && (
                                    <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                )}
                            </motion.button>
                        )
                    })}
                </nav>
                
                <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800/60 space-y-3">
                    <motion.div 
                        whileHover={{ scale: 1.02 }}
                        className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 font-black text-sm">
                            AD
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">Administrador</p>
                            <p className="text-[10px] font-bold text-slate-400 truncate tracking-tighter">SMR Siskoven © 2026</p>
                        </div>
                        <ThemeToggle />
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.95 }}>
                        <Button
                            onClick={onLogout}
                            variant="ghost"
                            className="w-full justify-start gap-3 py-6 rounded-2xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 transition-colors font-bold text-sm"
                        >
                            <div className="p-1.5 bg-rose-100 dark:bg-rose-500/20 rounded-lg">
                                <LogOut className="w-4 h-4" />
                            </div>
                            Cerrar Sesión
                        </Button>
                    </motion.div>
                </div>
            </aside>
        </>
    )
}