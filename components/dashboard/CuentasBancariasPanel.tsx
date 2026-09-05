// @/components/dashboard/CuentasBancariasPanel.tsx
//
// Editor de billeteras y cuentas bancarias.
//
// Aquí se define cómo se llama cada billetera, qué cuentas cuelgan de ella y,
// para cada una, todo lo que hay que dictarle al cliente para que pague:
// titular, RIF, número de cuenta, teléfono del pago móvil y el QR del banco.
//
// El QR se sube a Cloudinary como el logo o el sello: es un dato de la empresa,
// no de la máquina donde se cargó, y tiene que verse igual desde el mostrador y
// desde el teléfono del vendedor que está en la calle.
//
// Cada cuenta se abre y se cierra: en reposo se ve una fila por cuenta, y solo
// la que se está editando muestra los campos. Con cuatro billeteras y varias
// cuentas cada una, todo abierto a la vez era una pared de inputs.

"use client"

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Plus, Trash2, Loader2, Landmark, Archive, RotateCcw, Save,
    ChevronDown, QrCode, Upload, X, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
    BILLETERAS, NOMBRE_POR_DEFECTO, guardarBilletera, nuevaCuentaId, tieneDatosParaCobrar,
    type BilleteraId, type ConfigBilleteras, type CuentaBilletera,
} from '@/lib/services/billeteras-service'
import { BANCOS_VE, adivinarBanco } from '@/lib/services/bancos-venezuela'
import { uploadFileToCloudinary } from '@/lib/services/cloudinary-service'
import { LogoBanco } from '@/components/dashboard/LogoBanco'
import { DatosCuentaModal } from '@/components/dashboard/DatosCuentaModal'

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

/** Un QR más grande que esto no se lee mejor, solo tarda más en abrir. */
const MAX_MB = 3

// Qué se pide en cada billetera. Un Zelle no tiene número de cuenta de 20
// dígitos y un Binance no tiene banco: enseñar esos campos vacíos solo hace
// dudar a quien está cargando los datos.
const CAMPOS: Record<string, { banco: boolean; cuenta: boolean; telefono: boolean; correo: boolean; usuario: boolean }> = {
    cash_usd: { banco: false, cuenta: false, telefono: false, correo: false, usuario: false },
    bank_bs:  { banco: true,  cuenta: true,  telefono: true,  correo: false, usuario: false },
    zelle:    { banco: true,  cuenta: false, telefono: true,  correo: true,  usuario: false },
    usdt:     { banco: false, cuenta: false, telefono: false, correo: true,  usuario: true },
}

interface Props {
    config: ConfigBilleteras
    /** Se llama al guardar bien, por si el contenedor quiere cerrarse. */
    onGuardado?: () => void
}

export function CuentasBancariasPanel({ config, onGuardado }: Props) {
    const [borrador, setBorrador] = useState<Borrador>(() => aBorrador(config))
    const [guardando, setGuardando] = useState(false)
    const [abierta, setAbierta] = useState<string | null>(null)
    const [subiendoQR, setSubiendoQR] = useState<string | null>(null)
    const [vistaPrevia, setVistaPrevia] = useState<CuentaBilletera | null>(null)
    const refs = useRef<Record<string, HTMLInputElement | null>>({})

    // Si alguien cambia la configuración desde otra máquina, se recarga el
    // borrador; pero no mientras se está editando una cuenta, que borraría lo
    // que la persona lleva escrito.
    useEffect(() => { if (!abierta) setBorrador(aBorrador(config)) }, [config, abierta])

    const editarNombre = (id: BilleteraId, nombre: string) =>
        setBorrador(p => ({ ...p, [id]: { ...p[id], nombre } }))

    const editarCuenta = (id: BilleteraId, cuentaId: string, cambios: Partial<CuentaBilletera>) =>
        setBorrador(p => ({
            ...p,
            [id]: { ...p[id], cuentas: p[id].cuentas.map(c => c.id === cuentaId ? { ...c, ...cambios } : c) },
        }))

    const agregarCuenta = (id: BilleteraId) => {
        const nueva: CuentaBilletera = { id: nuevaCuentaId(), nombre: '', banco: '', bancoCodigo: '', activa: true }
        setBorrador(p => ({ ...p, [id]: { ...p[id], cuentas: [...p[id].cuentas, nueva] } }))
        setAbierta(nueva.id)
    }

    // Una cuenta nueva y vacía se descarta sin más. Una que ya se guardó se
    // archiva: si se borrara, los cobros hechos con ella se quedarían señalando
    // un banco que ya no existe en ningún sitio.
    const quitarCuenta = (id: BilleteraId, cuenta: CuentaBilletera) => {
        const nuncaGuardada = !(config[id]?.cuentas || []).some(c => c.id === cuenta.id)
        if (nuncaGuardada) {
            if (abierta === cuenta.id) setAbierta(null)
            return setBorrador(p => ({ ...p, [id]: { ...p[id], cuentas: p[id].cuentas.filter(c => c.id !== cuenta.id) } }))
        }
        editarCuenta(id, cuenta.id, { activa: cuenta.activa === false })
    }

    const subirQR = async (id: BilleteraId, cuentaId: string, file?: File | null) => {
        if (!file) return
        if (!file.type.startsWith('image/')) return toast.error('El QR tiene que ser una imagen (PNG o JPG)')
        if (file.size > MAX_MB * 1024 * 1024) return toast.error(`La imagen supera ${MAX_MB} MB. Redúcela antes de subirla.`)

        setSubiendoQR(cuentaId)
        try {
            const url = await uploadFileToCloudinary(file)
            editarCuenta(id, cuentaId, { qrUrl: url })
            toast.success('QR cargado. Acuérdate de guardar los cambios.')
        } catch (e) {
            console.error(e)
            toast.error('No se pudo subir el QR')
        } finally {
            setSubiendoQR(null)
        }
    }

    const guardar = async () => {
        const sinNombre = BILLETERAS.some(id =>
            borrador[id].cuentas.some(c => c.activa !== false && !c.nombre.trim())
        )
        if (sinNombre) return toast.error('Hay cuentas sin nombre. Ponles uno o quítalas.')

        setGuardando(true)
        try {
            for (const id of BILLETERAS) await guardarBilletera(id, borrador[id])
            toast.success('Cuentas actualizadas para toda la empresa')
            setAbierta(null)
            onGuardado?.()
        } catch (e) {
            console.error(e)
            toast.error('No se pudo guardar la configuración')
        } finally {
            setGuardando(false)
        }
    }

    const campo = (
        etiqueta: string,
        valor: string | undefined,
        alCambiar: (v: string) => void,
        placeholder: string,
        tipo: string = 'text'
    ) => (
        <div className="space-y-1">
            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{etiqueta}</Label>
            <Input
                type={tipo}
                value={valor || ''}
                onChange={e => alCambiar(e.target.value)}
                placeholder={placeholder}
                className="h-10 bg-white dark:bg-white/5 border-none rounded-xl text-sm font-bold shadow-sm"
            />
        </div>
    )

    return (
        <div className="space-y-5">
            {BILLETERAS.map(id => {
                const b = borrador[id]
                if (!b) return null
                const activas = b.cuentas.filter(c => c.activa !== false).length

                return (
                    <div key={id} className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                            <div className="flex-1 space-y-1.5 min-w-0">
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
                            {b.cuentas.map(c => {
                                const archivada = c.activa === false
                                const yaGuardada = (config[id]?.cuentas || []).some(x => x.id === c.id)
                                const desplegada = abierta === c.id

                                return (
                                    <div
                                        key={c.id}
                                        className={cn(
                                            "rounded-2xl bg-white dark:bg-white/5 shadow-sm overflow-hidden transition-opacity",
                                            archivada && "opacity-50"
                                        )}
                                    >
                                        {/* Fila en reposo */}
                                        <div className="flex items-center gap-2 p-2">
                                            <button
                                                type="button"
                                                onClick={() => setAbierta(desplegada ? null : c.id)}
                                                className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-left"
                                            >
                                                <LogoBanco codigo={c.bancoCodigo} texto={c.banco} size={22} />
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-sm font-black truncate">
                                                        {c.nombre || <span className="text-slate-300">Cuenta sin nombre</span>}
                                                    </span>
                                                    {(c.numeroCuenta || c.telefono || c.correo || c.usuario) && (
                                                        <span className="block text-[10px] font-bold text-slate-400 truncate">
                                                            {c.numeroCuenta || c.telefono || c.correo || c.usuario}
                                                        </span>
                                                    )}
                                                </span>
                                                {c.qrUrl && <QrCode className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}
                                                <ChevronDown className={cn("w-4 h-4 shrink-0 text-slate-300 transition-transform", desplegada && "rotate-180")} />
                                            </button>

                                            {tieneDatosParaCobrar(c) && (
                                                <Button
                                                    variant="ghost" size="icon" title="Ver como lo verá el cliente"
                                                    onClick={() => setVistaPrevia(c)}
                                                    className="h-9 w-9 shrink-0 rounded-xl text-slate-400 hover:text-slate-900"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost" size="icon"
                                                title={archivada ? 'Volver a usarla' : yaGuardada ? 'Archivar cuenta' : 'Quitar'}
                                                onClick={() => quitarCuenta(id, c)}
                                                className="h-9 w-9 shrink-0 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                                            >
                                                {archivada ? <RotateCcw className="w-4 h-4" />
                                                    : yaGuardada ? <Archive className="w-4 h-4" />
                                                    : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>

                                        <AnimatePresence initial={false}>
                                            {desplegada && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100 dark:border-white/5">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {campo('Nombre interno', c.nombre, v => editarCuenta(id, c.id, { nombre: v }),
                                                                id === 'zelle' ? 'Zelle de Samuel' : id === 'usdt' ? 'Binance principal' : 'Banesco Corriente')}

                                                            {CAMPOS[id].banco && (
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Banco</Label>
                                                                <div className="flex items-center gap-2 h-10 px-2.5 bg-white dark:bg-white/5 rounded-xl shadow-sm">
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
                                                                        {BANCOS_VE.map(x => (
                                                                            <option key={x.codigo} value={x.codigo}>
                                                                                {/^\d{4}$/.test(x.codigo) ? x.codigo + ' · ' + x.corto : x.corto}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            )}

                                                            {campo('Titular', c.titular, v => editarCuenta(id, c.id, { titular: v }),
                                                                id === 'zelle' ? 'Samuel Leal' : 'SMR Lase Print C.A.')}
                                                            {campo(id === 'zelle' ? 'Documento' : 'RIF / Cédula', c.documento, v => editarCuenta(id, c.id, { documento: v }), 'J-12345678-9')}

                                                            {CAMPOS[id].cuenta && campo('Número de cuenta', c.numeroCuenta, v => editarCuenta(id, c.id, { numeroCuenta: v }), '0134 0000 00 0000000000')}
                                                            {CAMPOS[id].cuenta && campo('Tipo de cuenta', c.tipoCuenta, v => editarCuenta(id, c.id, { tipoCuenta: v }), 'Corriente')}
                                                            {CAMPOS[id].telefono && campo(id === 'zelle' ? 'Teléfono' : 'Teléfono (Pago Móvil)', c.telefono, v => editarCuenta(id, c.id, { telefono: v }), '0412-1234567', 'tel')}
                                                            {CAMPOS[id].correo && campo(id === 'zelle' ? 'Correo del Zelle' : 'Correo', c.correo, v => editarCuenta(id, c.id, { correo: v }), 'pagos@empresa.com', 'email')}
                                                            {CAMPOS[id].usuario && campo('Usuario / Pay ID', c.usuario, v => editarCuenta(id, c.id, { usuario: v }), 'smrlaseprint')}
                                                        </div>

                                                        {/* QR */}
                                                        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-black/20 p-3">
                                                            <div className="w-16 h-16 shrink-0 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                                {c.qrUrl
                                                                    ? <img src={c.qrUrl} alt="QR" className="w-full h-full object-contain" />
                                                                    : <QrCode className="w-6 h-6 text-slate-300" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Código QR de cobro</p>
                                                                <p className="text-[10px] font-bold text-slate-400 leading-snug">
                                                                    El que genera el banco. Es lo que se le enseña al cliente para que pague.
                                                                </p>
                                                            </div>
                                                            <input
                                                                type="file"
                                                                accept="image/png,image/jpeg,image/webp"
                                                                className="hidden"
                                                                ref={el => { refs.current[c.id] = el }}
                                                                onChange={e => { subirQR(id, c.id, e.target.files?.[0]); e.target.value = '' }}
                                                            />
                                                            <Button
                                                                onClick={() => refs.current[c.id]?.click()}
                                                                disabled={subiendoQR === c.id}
                                                                className="h-9 shrink-0 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black uppercase text-[9px] tracking-widest gap-1.5 px-3"
                                                            >
                                                                {subiendoQR === c.id
                                                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Subiendo</>
                                                                    : <><Upload className="w-3 h-3" /> {c.qrUrl ? 'Cambiar' : 'Subir'}</>}
                                                            </Button>
                                                            {c.qrUrl && (
                                                                <Button
                                                                    variant="ghost" size="icon" title="Quitar el QR"
                                                                    onClick={() => editarCuenta(id, c.id, { qrUrl: '' })}
                                                                    className="h-9 w-9 shrink-0 rounded-xl text-slate-400 hover:text-rose-500"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })}

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

            <Button
                onClick={guardar}
                disabled={guardando}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg"
            >
                {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
            </Button>

            <DatosCuentaModal
                cuenta={vistaPrevia || undefined}
                open={!!vistaPrevia}
                onOpenChange={o => !o && setVistaPrevia(null)}
            />
        </div>
    )
}

/** Cabecera reutilizable, para cuando el panel va suelto en una vista. */
export function CuentasBancariasHeader() {
    return (
        <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Cuentas Bancarias</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">
                    Cómo se llama cada billetera, por qué bancos cobras y qué datos se le
                    dictan al cliente. Se guardan en la nube: valen para todo el mundo.
                </p>
            </div>
        </div>
    )
}
