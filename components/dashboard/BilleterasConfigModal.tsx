// @/components/dashboard/BilleterasConfigModal.tsx
//
// El editor de cuentas, metido en un modal para poder abrirlo desde Tesoreria
// sin tener que salir a Ajustes.
//
// El contenido es el mismo componente que se usa en Ajustes -> Cuentas
// Bancarias. Estaba duplicado y las dos copias empezaron a separarse: el modal
// no tenia los campos del QR ni los de Zelle. Un solo editor, dos sitios desde
// donde abrirlo.

"use client"

import React from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Landmark } from 'lucide-react'

import { CuentasBancariasPanel } from '@/components/dashboard/CuentasBancariasPanel'
import { type ConfigBilleteras } from '@/lib/services/billeteras-service'

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    config: ConfigBilleteras
}

export function BilleterasConfigModal({ open, onOpenChange, config }: Props) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="p-5 sm:p-7 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                        <Landmark className="w-6 h-6 text-indigo-600" /> Cuentas y Nombres
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Como se llama cada billetera y por que bancos cobras
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7">
                    <CuentasBancariasPanel config={config} onGuardado={() => onOpenChange(false)} />
                </div>
            </DialogContent>
        </Dialog>
    )
}
