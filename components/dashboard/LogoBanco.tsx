// @/components/dashboard/LogoBanco.tsx
//
// La pastilla con el logo de un banco.
//
// Debajo siempre hay un monograma con el color de marca; encima, si existe, el
// favicon real del banco. Se hace en ese orden a propósito: el favicon viene de
// un servicio ajeno y puede tardar, fallar o no existir, y en ninguno de esos
// casos queremos que la fila se quede con un hueco. El monograma no depende de
// nadie.

"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { bancoPorCodigo, adivinarBanco, faviconDeBanco } from '@/lib/services/bancos-venezuela'

interface Props {
    /** Código SUDEBAN, o ZELLE / BINANCE / PAYPAL / EFECTIVO. */
    codigo?: string
    /** Lo que se escribió a mano, por si no hay código guardado todavía. */
    texto?: string
    /** Lado de la pastilla en píxeles. */
    size?: number
    className?: string
}

export function LogoBanco({ codigo, texto, size = 20, className }: Props) {
    const [fallo, setFallo] = useState(false)

    const banco = bancoPorCodigo(codigo) || adivinarBanco(texto)
    const color = banco?.color || '#64748B'
    const sigla = banco?.sigla || (texto || '?').trim().charAt(0).toUpperCase() || '?'
    const favicon = fallo ? undefined : faviconDeBanco(banco?.codigo, 64)

    return (
        <span
            title={banco?.nombre || texto}
            style={{ width: size, height: size, backgroundColor: color }}
            className={cn(
                'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md shadow-sm',
                className
            )}
        >
            <span
                style={{ fontSize: Math.max(7, Math.round(size * 0.42)) }}
                className="font-black uppercase leading-none tracking-tight text-white"
            >
                {sigla}
            </span>

            {favicon && (
                // El favicon tapa el monograma solo cuando ha cargado de verdad.
                // Si el banco no tiene dominio o Google no responde, se queda el
                // monograma y aquí no se pinta nada.
                <img
                    src={favicon}
                    alt=""
                    loading="lazy"
                    onError={() => setFallo(true)}
                    className="absolute inset-0 h-full w-full bg-white object-contain p-[1px]"
                />
            )}
        </span>
    )
}
