// @/components/dashboard/BilleterasConfigModal.tsx
//
// Ponerle nombre a cada billetera y dar de alta las cuentas que cuelgan de
// ella. "Banco Nacional (Bs)" no le dice nada a nadie cuando la empresa cobra
// por Banesco, Mercantil y Provincial: aquí se escribe cómo se llama de verdad
// y qué cuentas tiene, para poder decir después por cuál entró cada cobro.

"use client"

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Loader2, Landmark, Archive, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
    BILLETERAS, NOMBRE_POR_DEFECTO, guardarBilletera, nuevaCuentaId,
    type BilleteraId, type ConfigBilleteras, type CuentaBilletera,
} from '@/lib/services/billeteras-service'
import { BANCOS_VE, adivinarBanco } from '@/lib/services/bancos-venezuela'
import { LogoBanco } from '@/components/dashboard/LogoBanco'

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    config: ConfigBilleteras
}

type Borrador = Record<string, { nombre: string; cuentas: CuentaBilletera[] }>

const aBorrador = (config: ConfigBilleteras): Borrador => {
    const b: Borrador = {}
    BILLETERAS.forEach(id => {
        b[id] = {
            nombre: config[id]?.nombre || '',
            cuentas: (config[id]?.cuentas || []).map(c => ({ ...c })),
        }
    })
    return b
}

export function BilleterasConfigModal({ open, onOpenChange, config }: Props) {
    const [borrador, setBorrador] = useState<Borrador>(() => aBorrador(config))
    const [guardando, setGuardando] = useState(false)

    // Al abrir se relee lo que hay guardado: si alguien lo cambió desde otra
    // máquina no queremos pisarlo con un borrador viejo.
    useEffect(() => { if (open) setBorrador(aBorrador(config)) }, [open, config])

    const editarNombre = (id: BilleteraId, nombre: string) =>
        setBorrador(p => ({ ...p, [id]: { ...p[id], nombre } }))

    const editarCuenta = (id: BilleteraId, cuentaId: string, cambios: Partial<CuentaBilletera>) =>
        setBorrador(p => ({
            ...p,
            [id]: { ...p[id], cuentas: p[id].cuentas.map(c => c.id === cuentaId ? { ...c, ...cambios } : c) },
        }))

    const agregarCuenta = (id: BilleteraId) =>
        setBorrador(p => ({
            ...p,
            [id]: {
                ...p[id],
                cuentas: [...p[id].cuentas, { id: nuevaCuentaId(), nombre: '', banco: '', bancoCodigo: '', referencia: '', activa: true }],
            },
        }))

    // Una cuenta recién creada y todavía vacía se puede borrar sin más. Una que
    // ya se usó se archiva: si se borrara, los cobros viejos quedarían
    // apuntando a un banco que ya no existe en ningún sitio.
    const quitarCuenta = (id: BilleteraId, cuenta: CuentaBilletera) => {
        const nuncaGuardada = !(config[id]?.cuentas || []).some(c => c.id === cuenta.id)
        if (nuncaGuardada) {
            return setBorrador(p => ({ ...p, [id]: { ...p[id], cuentas: p[id].cuentas.filter(c => c.id !== cuenta.id) } }))
        }
        editarCuenta(id, cuenta.id, { activa: cuenta.activa === false })
    }

    const guardar = async () => {
        const sinNombre = BILLETERAS.some(id =>
            borrador[id].cuentas.some(c => c.activa !== false && !c.nombre.trim())
        )
        if (sinNombre) return toast.error('Hay cuentas sin nombre. Ponles uno o quítalas.')

        setGuardando(true)
        try {
            for (const id of BILLETERAS) {
                await guardarBilletera(id, borrador[id])
            }
            toast.success('Billeteras y cuentas actualizadas')
            onOpenChange(false)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo guardar la configuración')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="p-5 sm:p-7 pb-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <DialogTitle className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                        <Landmark className="w-6 h-6 text-indigo-600" /> Cuentas y Nombres
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Cómo se llama cada billetera y por qué bancos cobras
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-5">
                    {BILLETERAS.map(id => {
                        const b = borrador[id]
                        if (!b) return null
                        const activas = b.cuentas.filter(c => c.activa !== false).length

                        return (
                            <div key={id} className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                    <div className="flex-1 space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            Nombre de la billetera
                                        </Label>
                                        <Input
                                            value={b.nombre}
                                            onChange={e => editarNombre(id, e.target.value)}
                                            placeholder={NOMBRE_POR_DEFECTO[id]}
                                            className="h-11 bg-white dark:bg-white/5 border-none rounded-xl font-black shadow-sm"
                                        />
                                    </div>
                                    <Badge variant="secondary" className="h-7 w-fit border-none bg-slate-200/70 dark:bg-white/10 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                        {activas} {activas === 1 ? 'cuenta' : 'cuentas'}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    <AnimatePresence initial={false}>
                                        {b.cuentas.map(c => {
                                            const archivada = c.activa === false
                                            const yaGuardada = (config[id]?.cuentas || []).some(x => x.id === c.id)
                                            return (
                                                <motion.div
                                                    key={c.id}
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className={cn(
                                                        "flex flex-col sm:flex-row gap-2 items-stretch sm:items-center rounded-2xl p-2 bg-white dark:bg-white/5 shadow-sm",
                                                        archivada && "opacity-50"
                                                    )}
                                                >
                                                    <Input
                                                        value={c.nombre}
                                                        onChange={e => editarCuenta(id, c.id, { nombre: e.target.value })}
                                                        placeholder="Banesco Corriente"
                                                        className="h-10 flex-[2] bg-slate-50 dark:bg-black/20 border-none rounded-xl text-sm font-bold"
                                                    />
                                                    {/* El banco se elige de la lista y no se escribe: asi
                                                        se sabe que logo y que color ponerle. Si la cuenta
                                                        venia con el banco escrito a mano, se reconoce solo. */}
                                                    <div className="flex-1 flex items-center gap-2 h-10 px-2 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                        <LogoBanco codigo={c.bancoCodigo} texto={c.banco} size={20} />
                                                        <select
                                                            value={c.bancoCodigo || adivinarBanco(c.banco)?.codigo || ''}
                                                            onChange={e => editarCuenta(id, c.id, {
                                                                bancoCodigo: e.target.value,
                                                                banco: BANCOS_VE.find(x => x.codigo === e.target.value)?.nombre || '',
                                                            })}
                                                            className="flex-1 min-w-0 bg-transparent text-sm font-bold outline-none cursor-pointer"
                                                        >
                                                            <option value="">Banco…</option>
                                                            {BANCOS_VE.map(b => (
                                                                <option key={b.codigo} value={b.codigo}>
                                                                    {/^\d{4}$/.test(b.codigo) ? b.codigo + ' · ' + b.corto : b.corto}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <Input
                                                        value={c.referencia || ''}
                                                        onChange={e => editarCuenta(id, c.id, { referencia: e.target.value })}
                                                        placeholder="Últimos 4"
                                                        className="h-10 flex-1 bg-slate-50 dark:bg-black/20 border-none rounded-xl text-sm font-bold"
                                                    />
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        title={archivada ? 'Volver a usarla' : yaGuardada ? 'Archivar cuenta' : 'Quitar'}
                                                        onClick={() => quitarCuenta(id, c)}
                                                        className="h-10 w-10 shrink-0 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                                                    >
                                                        {archivada ? <RotateCcw className="w-4 h-4" />
                                                            : yaGuardada ? <Archive className="w-4 h-4" />
                                                            : <Trash2 className="w-4 h-4" />}
                                                    </Button>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>

                                    <Button
                                        variant="outline"
                                        onClick={() => agregarCuenta(id)}
                                        className="w-full h-10 rounded-xl border-dashed border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Agregar cuenta
                                    </Button>
                                </div>
                            </div>
                        )
                    })}

                    <p className="text-[10px] font-bold text-slate-400 leading-snug">
                        Las cuentas que se dejan de usar se archivan, no se borran: los cobros
                        que ya están registrados con ellas tienen que poder seguir mostrando
                        de qué banco vinieron.
                    </p>
                </div>

                <div className="p-5 sm:p-7 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0">
                    <Button
                        onClick={guardar}
                        disabled={guardando}
                        className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg"
                    >
                        {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
