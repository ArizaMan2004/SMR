// @/lib/contexts/permisos-context.tsx
//
// Punto único desde el que toda la app pregunta "¿esta persona puede ver esto?".
//
// Se suscribe una sola vez a la configuración de roles y la combina con el rol
// del usuario y con sus permisos individuales. El menú lateral y el render del
// dashboard leen de aquí, así que no pueden contradecirse: se acabaron las
// opciones de menú que abrían una pantalla en blanco.

"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { subscribeToRoles } from "@/lib/services/roles-service";
import {
    ROLES_SISTEMA,
    resolverVistas,
    vistaInicialPara,
    type RolDefinicion,
    type ViewId,
} from "@/lib/roles";

interface PermisosContextType {
    /** Todos los roles disponibles, de fábrica y personalizados. */
    roles: RolDefinicion[];
    /** Definición del rol de la persona conectada. */
    rolActual: RolDefinicion | null;
    /** Vistas a las que esta persona puede entrar. */
    vistasPermitidas: Set<ViewId>;
    /** La pregunta que hace todo el mundo. */
    puedeVer: (view: string) => boolean;
    /** Dónde debe aterrizar esta persona al abrir la app. */
    vistaInicial: ViewId;
    /** true mientras aún no ha llegado la configuración de Firestore. */
    cargando: boolean;
}

const PermisosContext = createContext<PermisosContextType | undefined>(undefined);

export function PermisosProvider({ children }: { children: React.ReactNode }) {
    const { userData } = useAuth();
    const [roles, setRoles] = useState<RolDefinicion[]>(ROLES_SISTEMA);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToRoles(nuevos => {
            setRoles(nuevos);
            setCargando(false);
        });
        return () => unsubscribe();
    }, []);

    const vistasPermitidas = useMemo(
        () =>
            resolverVistas(userData?.rol, roles, {
                vistasExtra: (userData as any)?.vistasExtra,
                vistasBloqueadas: (userData as any)?.vistasBloqueadas,
            }),
        [userData, roles]
    );

    const valor = useMemo<PermisosContextType>(() => {
        const rolActual = roles.find(r => r.id === userData?.rol) ?? null;
        return {
            roles,
            rolActual,
            vistasPermitidas,
            puedeVer: (view: string) => vistasPermitidas.has(view as ViewId),
            vistaInicial: vistaInicialPara(vistasPermitidas, !!rolActual?.esProduccion),
            cargando,
        };
    }, [roles, userData?.rol, vistasPermitidas, cargando]);

    return <PermisosContext.Provider value={valor}>{children}</PermisosContext.Provider>;
}

export function usePermisos() {
    const context = useContext(PermisosContext);
    if (context === undefined) {
        throw new Error("usePermisos debe usarse dentro de un PermisosProvider");
    }
    return context;
}
