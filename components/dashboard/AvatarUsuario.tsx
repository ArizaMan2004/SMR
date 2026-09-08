// @/components/dashboard/AvatarUsuario.tsx
//
// LA CARA DE UNA CUENTA, EN UN SITIO.
//
// Foto si la hay, iniciales sobre su degradado si no. Vive aparte porque sale
// en el menú, en la cabecera y en los ajustes, y tres copias del mismo círculo
// acaban siendo tres círculos distintos.
//
// Si la foto no carga —se borró de Cloudinary, no hay internet— se cae a las
// iniciales sin dejar el hueco roto: una cara vacía en el menú se lee como que
// la sesión se perdió.

"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import {
    fondoDegradado, inicialesDe,
    type AparienciaPerfil,
} from '@/lib/services/perfil-apariencia'

interface Props {
    nombre?: string
    apellido?: string
    apariencia?: AparienciaPerfil
    /** Lado del círculo en píxeles. */
    tamano?: number
    className?: string
    /** Aro claro alrededor, para cuando va sobre un fondo de color. */
    conAro?: boolean
}

export function AvatarUsuario({
    nombre, apellido, apariencia, tamano = 40, className, conAro,
}: Props) {
    const [fallo, setFallo] = useState(false)

    const iniciales = inicialesDe(nombre, apellido)
    const hayFoto = !!apariencia?.fotoUrl && !fallo

    return (
        <div
            className={cn(
                'relative shrink-0 overflow-hidden flex items-center justify-center',
                'rounded-[28%] shadow-sm',
                conAro && 'ring-2 ring-white/30',
                className
            )}
            style={{
                width: tamano,
                height: tamano,
                // El degradado se pinta siempre, también detrás de la foto: si
                // la imagen tarda, se ve su color en vez de un hueco gris.
                background: fondoDegradado(apariencia, `${nombre || ''} ${apellido || ''}`),
            }}
            title={[nombre, apellido].filter(Boolean).join(' ') || undefined}
        >
            {hayFoto ? (
                <img
                    src={apariencia!.fotoUrl}
                    alt={[nombre, apellido].filter(Boolean).join(' ')}
                    onError={() => setFallo(true)}
                    className="w-full h-full object-cover"
                />
            ) : (
                <span
                    className="font-black text-white leading-none select-none"
                    style={{ fontSize: Math.max(10, Math.round(tamano * 0.38)) }}
                >
                    {iniciales}
                </span>
            )}
        </div>
    )
}
