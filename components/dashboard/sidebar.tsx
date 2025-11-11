// @/components/dashboard/sidebar.tsx

"use client"

import React, { useState } from "react" 
import { Button } from "@/components/ui/button"
import Image from "next/image" 
// Importaciones de iconos
import { LogOut, Menu, X } from "lucide-react" 
import { ThemeToggle } from "@/components/theme-toggle" 

// --- TIPOS ---
interface NavItem {
    id: string
    label: string
    icon: React.ReactElement 
}

interface SidebarProps {
    activeView: string
    setActiveView: (view: string) => void
    navItems: NavItem[] 
    onLogout?: () => void // <-- Esta prop es clave para cerrar sesión
}

// 🔑 DEFINICIÓN DE RUTAS DEL LOGO (AJUSTA ESTAS RUTAS SEGÚN TUS ARCHIVOS)
const LOGO_LIGHT_PATH = "/smr-logo-light.png";
const LOGO_DARK_PATH = "/smr-logo-dark.png";  
const LOGO_WIDTH = 150; 
const LOGO_HEIGHT = 40; 

export default function Sidebar({
    activeView,
    setActiveView,
    navItems,
    onLogout, // <-- Recibimos la función de logout
}: SidebarProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false) 

    const getIcon = (icon: React.ReactElement) => {
        // Asegura que el icono tenga las clases correctas
        return React.cloneElement(icon, { className: "w-4 h-4 flex-shrink-0" }); 
    };

    return (
        <>
            {/* 1. Botón de Menú Móvil */}
            <Button 
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-40 lg:hidden"
                onClick={() => setIsMobileOpen(true)}
            >
                <Menu className="h-6 w-6" />
            </Button>
            
            {/* 2. Overlay Móvil */}
            {isMobileOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* 3. Barra Lateral (Sidebar) */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-40 
                    flex flex-col 
                    w-64 bg-white dark:bg-gray-900 border-r border-border
                    p-4
                    transform transition-transform duration-300 ease-in-out
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:static lg:translate-x-0 lg:shadow-none
                `}
            >
                
                {/* Header/Logo y Botón de Cierre Móvil */}
                <div className="flex items-center justify-between h-16 flex-shrink-0">
                    <div className="relative h-10 w-40 flex items-center">
                        {/* El logo debe cambiar según el tema si usas Next/Image */}
                        <Image 
                            src={LOGO_LIGHT_PATH} 
                            alt="Logo SMR" 
                            width={LOGO_WIDTH} 
                            height={LOGO_HEIGHT} 
                            className="dark:hidden"
                            priority
                        />
                         <Image 
                            src={LOGO_DARK_PATH} 
                            alt="Logo SMR" 
                            width={LOGO_WIDTH} 
                            height={LOGO_HEIGHT} 
                            className="hidden dark:block"
                            priority
                        />
                    </div>
                    {/* Botón de Cierre Móvil */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setIsMobileOpen(false)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto mt-6 space-y-2">
                    {/* Navegación Principal */}
                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <Button
                                key={item.id}
                                onClick={() => {
                                    setActiveView(item.id)
                                    if (isMobileOpen) setIsMobileOpen(false)
                                }}
                                variant={activeView === item.id ? "default" : "ghost"}
                                className="w-full justify-start gap-2"
                            >
                                {getIcon(item.icon)}
                                {item.label}
                            </Button>
                        ))}
                    </nav>
                </div>
                
                {/* Footer (Logout y Theme Toggle) */}
                <div className="mt-auto pt-4 space-y-2 border-t border-border flex-shrink-0"> 
                    {/* ✅ Se asegura que este bloque no se encoja */}
                    {onLogout && (
                        <Button
                            onClick={onLogout}
                            variant="ghost"
                            className="w-full justify-start gap-2 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        >
                            <LogOut className="w-4 h-4" />
                            Cerrar Sesión
                        </Button>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">© 2025 SMR</span>
                        <ThemeToggle />
                    </div>
                </div>

            </aside>
        </>
    )
}