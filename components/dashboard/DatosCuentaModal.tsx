// @/components/dashboard/DatosCuentaModal.tsx
//
// Los datos para pagar, en grande.
//
// Esto es lo que se le enseña al cliente que está delante del mostrador o al
// que pide los datos por WhatsApp: el QR ocupando lo que puede y debajo el
// titular, el RIF, la cuenta y el teléfono, cada uno con su botón de copiar.
//
// Está pensado primero para el teléfono, que es donde se usa de verdad: el QR
// se adapta al ancho de la pantalla y cada dato es una fila con su botón,
// nunca una tabla que haya que desplazar de lado.

"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, Copy, QrCode, ImageOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { LogoBanco } from '@/components/dashboard/LogoBanco'
import { type CuentaBilletera } from '@/lib/services/billeteras-service'
import { bancoPorCodigo, adivinarBanco } from '@/lib/services/bancos-venezuela'

interface Props {
    cuenta?: CuentaBilletera
    open: boolean
    onOpenChange: (o: boolean) => void
}

interface Fila { etiqueta: string; valor: string; copiar: string }

export function DatosCuentaModal({ cuenta, open, onOpenChange }: Props) {
    const [copiado, setCopiado] = useState<string | null>(null)
    const [qrRoto, setQrRoto] = useState(false)

    if (!cuenta) return null

    const banco = bancoPorCodigo(cuenta.bancoCodigo) || adivinarBanco(cuenta.banco)

    const copiar = async (texto: string, etiqueta: string) => {
        try {
            await navigator.clipboard.writeText(texto)
            setCopiado(etiqueta)
            setTimeout(() => setCopiado(null), 1600)
        } catch {
            // En http sin certificado el portapapeles no existe. No es motivo
            // para dejar al vendedor sin el dato: ya lo tiene en pantalla.
            toast.info('Copia el dato a mano, el navegador no dejó copiarlo')
        }
    }

    // En pago móvil el orden importa: el cliente los teclea en ese orden en
    // la app del banco (banco, teléfono, cédula) y el número de cuenta ni
    // aparece. En transferencia manda el número.
    const esPagoMovil = cuenta.modo === 'pago_movil'

    const filas: Fila[] = [
        banco && { etiqueta: 'Banco', valor: banco.nombre, copiar: banco.codigo },
        cuenta.titular && { etiqueta: 'Titular', valor: cuenta.titular, copiar: cuenta.titular },
        cuenta.documento && { etiqueta: 'RIF / Cédula', valor: cuenta.documento, copiar: cuenta.documento },
        !esPagoMovil && cuenta.numeroCuenta && {
            etiqueta: cuenta.tipoCuenta ? `Cuenta ${cuenta.tipoCuenta}` : 'Cuenta',
            valor: cuenta.numeroCuenta,
            // Se copia sin espacios ni guiones: es lo que espera el formulario
            // del banco, y es donde más se equivoca la gente al transcribir.
            copiar: cuenta.numeroCuenta.replace(/[^0-9]/g, ''),
        },
        cuenta.telefono && {
            etiqueta: esPagoMovil ? 'Teléfono' : 'Pago Móvil',
            valor: cuenta.telefono,
            copiar: cuenta.telefono.replace(/[^0-9+]/g, ''),
        },
        cuenta.correo && { etiqueta: 'Correo', valor: cuenta.correo, copiar: cuenta.correo },
        cuenta.usuario && { etiqueta: 'Usuario / Pay ID', valor: cuenta.usuario, copiar: cuenta.usuario },
    ].filter(Boolean) as Fila[]

    const todo = filas.map(f => `${f.etiqueta}: ${f.valor}`).join('\n')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-sm p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <DialogTitle className="text-lg font-black uppercase italic tracking-tighter flex items-center gap-2.5 text-left">
                        <LogoBanco codigo={cuenta.bancoCodigo} texto={cuenta.banco} size={28} />
                        <span className="min-w-0 truncate">{cuenta.nombre}</span>
                    </DialogTitle>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1 text-left">
                        {esPagoMovil ? 'Pago Móvil' : 'Transferencia'}
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                    {cuenta.qrUrl && !qrRoto && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-[1.5rem] bg-white p-3 shadow-inner border border-slate-100"
                        >
                            {/* Fondo blanco siempre, también en modo oscuro: un QR
                                sobre gris oscuro no lo lee ningún teléfono. */}
                            <img
                                src={cuenta.qrUrl}
                                alt={`QR de ${cuenta.nombre}`}
                                onError={() => setQrRoto(true)}
                                className="w-full h-auto max-h-[45vh] object-contain mx-auto"
                            />
                        </motion.div>
                    )}

                    {cuenta.qrUrl && qrRoto && (
                        <div className="rounded-[1.5rem] bg-slate-50 dark:bg-white/5 p-6 flex flex-col items-center gap-2 text-slate-400">
                            <ImageOff className="w-7 h-7" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center">
                                El QR no cargó · usa los datos de abajo
                            </p>
                        </div>
                    )}

                    {!cuenta.qrUrl && (
                        <div className="rounded-[1.5rem] bg-slate-50 dark:bg-white/5 p-6 flex flex-col items-center gap-2 text-slate-300 dark:text-slate-600">
                            <QrCode className="w-7 h-7" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center">
                                Esta cuenta no tiene QR cargado
                            </p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        {filas.map(f => (
                            <button
                                key={f.etiqueta}
                                type="button"
                                onClick={() => copiar(f.copiar, f.etiqueta)}
                                className="w-full flex items-center gap-3 text-left rounded-2xl bg-slate-50 dark:bg-white/5 px-4 py-3 transition-colors hover:bg-slate-100 dark:hover:bg-white/10 active:scale-[0.99]"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{f.etiqueta}</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 break-all leading-snug">{f.valor}</p>
                                </div>
                                {copiado === f.etiqueta
                                    ? <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                                    : <Copy className="w-4 h-4 shrink-0 text-slate-300" />}
                            </button>
                        ))}

                        {filas.length === 0 && (
                            <p className="text-[11px] font-bold text-slate-400 text-center py-4">
                                Esta cuenta todavía no tiene datos cargados. Se ponen en
                                Ajustes → Cuentas Bancarias.
                            </p>
                        )}
                    </div>
                </div>

                {filas.length > 0 && (
                    <div className="p-5 pt-3 border-t border-slate-100 dark:border-white/5 shrink-0">
                        <Button
                            onClick={() => copiar(todo, 'TODO')}
                            className={cn(
                                "w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg",
                                copiado === 'TODO' ? "bg-emerald-600 hover:bg-emerald-600" : "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                            )}
                        >
                            {copiado === 'TODO'
                                ? <><Check className="w-4 h-4" /> Copiado</>
                                : <><Copy className="w-4 h-4" /> Copiar todos los datos</>}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
