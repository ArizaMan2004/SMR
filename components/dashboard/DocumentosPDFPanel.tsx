// @/components/dashboard/DocumentosPDFPanel.tsx
//
// Los datos que llevan los documentos de la empresa.
//
// El nombre fiscal, el RIF y la dirección que salen al pie de cada PDF
// estaban escritos dentro del código. Mudarse de local obligaba a tocar el
// generador y volver a publicar, cuando es un dato que cambia sin avisar y
// que cualquiera de la oficina sabe.
//
// Aquí se escribe una vez y aparece en todos los documentos. También se dice
// qué lleva cada tipo por defecto: no es lo mismo un presupuesto, que necesita
// los datos de pago porque el cliente decide con eso delante, que una nota de
// entrega que ya está aprobada.

"use client"

import React, { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save, FileText, Building2, PenLine, ShieldAlert, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    subscribeToConfigPDF, guardarConfigPDF, empresaDe, firmanteDe, notasDe, bloquesDe,
    DOCUMENTOS, type ConfigPDF, type BloquesDocumento, type TipoDocumento,
} from '@/lib/services/pdf-config-service'

/** Los bloques, con nombres que se entienden sin saber cómo está hecho. */
const BLOQUES: { campo: keyof BloquesDocumento; texto: string }[] = [
    { campo: 'logo',                 texto: 'Logo' },
    { campo: 'datosFiscalesCliente', texto: 'Datos fiscales del cliente' },
    { campo: 'tasaBcv',              texto: 'Tasa del día' },
    { campo: 'totalEnBs',            texto: 'Total en bolívares' },
    { campo: 'datosPago',            texto: 'Datos para pagar' },
    { campo: 'notasLegales',         texto: 'Condiciones' },
    { campo: 'despedida',            texto: 'Despedida' },
    { campo: 'firma',                texto: 'Firma' },
    { campo: 'sello',                texto: 'Sello' },
    { campo: 'datosFirmante',        texto: 'Nombre de quien firma' },
    { campo: 'pieEmpresa',           texto: 'Pie con datos de la empresa' },
]

export function DocumentosPDFPanel() {
    const { userData } = useAuth()
    const puedeEditar = esAdmin(userData?.rol)

    const [config, setConfig] = useState<ConfigPDF>({})
    const [borrador, setBorrador] = useState<ConfigPDF>({})
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [docAbierto, setDocAbierto] = useState<TipoDocumento>('presupuesto')

    useEffect(() => subscribeToConfigPDF(c => {
        setConfig(c)
        setCargando(false)
    }), [])

    // Se rellena el borrador desde lo guardado, con los valores de siempre para
    // lo que todavía no se ha configurado: así el formulario nunca sale vacío.
    useEffect(() => {
        setBorrador({
            empresa: empresaDe(config),
            firmante: firmanteDe(config),
            notasLegales: notasDe(config),
            documentos: Object.fromEntries(
                DOCUMENTOS.map(d => [d.tipo, bloquesDe(config, d.tipo)])
            ) as ConfigPDF['documentos'],
        })
    }, [config])

    const guardar = async () => {
        if (!borrador.empresa?.nombre?.trim()) return toast.error('El nombre fiscal es obligatorio')
        setGuardando(true)
        try {
            await guardarConfigPDF({
                ...borrador,
                notasLegales: (borrador.notasLegales || []).map(n => n.trim()).filter(Boolean),
            })
            toast.success('Datos de los documentos actualizados')
        } catch (e) {
            console.error(e)
            toast.error('No se pudo guardar')
        } finally {
            setGuardando(false)
        }
    }

    const campo = (
        etiqueta: string,
        valor: string | undefined,
        alCambiar: (v: string) => void,
        placeholder = ''
    ) => (
        <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{etiqueta}</Label>
            <Input
                value={valor || ''}
                onChange={e => alCambiar(e.target.value)}
                placeholder={placeholder}
                disabled={!puedeEditar}
                className="h-11 bg-slate-50 dark:bg-white/5 border-none rounded-xl text-sm font-bold"
            />
        </div>
    )

    const bloquesDoc = borrador.documentos?.[docAbierto] || {}

    if (cargando) {
        return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-blue-600" /></div>
    }

    return (
        <div className="space-y-6">
            {!puedeEditar && (
                <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                    <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-slate-400 leading-snug">
                        Solo el administrador puede cambiar esto: son los datos que llevan
                        todos los documentos que salen de la empresa.
                    </p>
                </div>
            )}

            {/* PIE DE LOS DOCUMENTOS */}
            <div className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pie de los documentos</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                            Lo que aparece abajo en cada PDF. Si te mudas, se cambia aquí y ya.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campo('Nombre fiscal', borrador.empresa?.nombre,
                        v => setBorrador(p => ({ ...p, empresa: { ...p.empresa!, nombre: v } })), 'EMPRENDIMIENTO …')}
                    {campo('RIF', borrador.empresa?.rif,
                        v => setBorrador(p => ({ ...p, empresa: { ...p.empresa!, rif: v } })), 'J-12345678-9')}
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dirección</Label>
                    <Textarea
                        value={borrador.empresa?.direccion || ''}
                        onChange={e => setBorrador(p => ({ ...p, empresa: { ...p.empresa!, direccion: e.target.value } }))}
                        disabled={!puedeEditar}
                        rows={2}
                        className="bg-slate-50 dark:bg-white/5 border-none rounded-xl text-sm font-bold resize-none"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campo('Teléfono', borrador.empresa?.telefono,
                        v => setBorrador(p => ({ ...p, empresa: { ...p.empresa!, telefono: v } })), '0268-1234567')}
                    {campo('Correo', borrador.empresa?.correo,
                        v => setBorrador(p => ({ ...p, empresa: { ...p.empresa!, correo: v } })), 'ventas@empresa.com')}
                </div>
            </div>

            {/* QUIÉN FIRMA */}
            <div className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-2.5">
                    <PenLine className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quién firma</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                            El nombre que va sobre la línea de firma.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campo('Nombre', borrador.firmante?.nombre,
                        v => setBorrador(p => ({ ...p, firmante: { ...p.firmante!, nombre: v } })))}
                    {campo('Cargo', borrador.firmante?.cargo,
                        v => setBorrador(p => ({ ...p, firmante: { ...p.firmante!, cargo: v } })), 'Gerente')}
                    {campo('Cédula', borrador.firmante?.cedula,
                        v => setBorrador(p => ({ ...p, firmante: { ...p.firmante!, cedula: v } })))}
                    {campo('Teléfono', borrador.firmante?.telefono,
                        v => setBorrador(p => ({ ...p, firmante: { ...p.firmante!, telefono: v } })))}
                </div>
            </div>

            {/* CONDICIONES */}
            <div className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Condiciones</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                            Una por línea. Salen como lista en los documentos que las lleven.
                        </p>
                    </div>
                </div>

                <Textarea
                    value={(borrador.notasLegales || []).join('\n')}
                    onChange={e => setBorrador(p => ({ ...p, notasLegales: e.target.value.split('\n') }))}
                    disabled={!puedeEditar}
                    rows={4}
                    className="bg-slate-50 dark:bg-white/5 border-none rounded-xl text-sm font-bold resize-none"
                />
            </div>

            {/* QUÉ LLEVA CADA DOCUMENTO */}
            <div className="rounded-[1.75rem] border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qué lleva cada documento</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug">
                        Con lo que arranca cada tipo. Al emitir uno concreto se puede cambiar sin tocar esto.
                    </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {DOCUMENTOS.map(d => (
                        <button key={d.tipo} type="button" onClick={() => setDocAbierto(d.tipo)}
                            title={d.ayuda}
                            className={cn('px-3 h-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all',
                                docAbierto === d.tipo
                                    ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-400')}>
                            {d.nombre}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {BLOQUES.map(b => {
                        const activo = !!bloquesDoc[b.campo]
                        return (
                            <button key={b.campo} type="button"
                                disabled={!puedeEditar}
                                onClick={() => setBorrador(p => ({
                                    ...p,
                                    documentos: {
                                        ...p.documentos,
                                        [docAbierto]: { ...(p.documentos?.[docAbierto] || {}), [b.campo]: !activo },
                                    },
                                }))}
                                className={cn('flex items-center gap-2 px-3 h-9 rounded-xl text-[10px] font-bold text-left transition-all disabled:opacity-50',
                                    activo
                                        ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                                        : 'bg-transparent text-slate-400')}>
                                {activo ? <Eye className="w-3.5 h-3.5 shrink-0 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
                                {b.texto}
                            </button>
                        )
                    })}
                </div>
            </div>

            {puedeEditar && (
                <Button onClick={guardar} disabled={guardando}
                    className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg">
                    {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando</> : <><Save className="w-4 h-4" /> Guardar</>}
                </Button>
            )}
        </div>
    )
}
