// @/components/dashboard/EditorPDFModal.tsx
//
// Ajustar el documento antes de emitirlo, viéndolo.
//
// Antes el PDF salía como saliera: si el presupuesto tenía que ir sin las
// condiciones, o con una cuenta bancaria en vez de las tres, o en carta en vez
// de en hoja continua, no había manera. Se generaba, se miraba, y si no servía
// no quedaba más que pedirlo distinto en el código.
//
// Aquí se toca y se ve al momento. Lo que se cambia vale solo para este
// documento: lo guardado en Ajustes no se toca, porque el ajuste de hoy para
// un cliente concreto no debería cambiar cómo salen los de mañana.

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    FileText, Loader2, Download, Eye, EyeOff, Landmark, Settings2, Percent,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
    subscribeToConfigPDF, empresaDe, firmanteDe, notasDe, bloquesDe,
    type ConfigPDF, type TipoDocumento, type BloquesDocumento,
} from '@/lib/services/pdf-config-service'
import {
    subscribeToBilleteras, cuentasActivas, BILLETERAS,
    type ConfigBilleteras, type CuentaBilletera,
} from '@/lib/services/billeteras-service'
import { definicionAPreview, abrirDefinicion, TAMANOS_HOJA, type TamanoHoja } from '@/lib/services/pdf-generator'
import { LogoBanco } from '@/components/dashboard/LogoBanco'

/** Los bloques que se pueden encender y apagar, con un nombre que se entiende. */
const BLOQUES: { campo: keyof BloquesDocumento; texto: string }[] = [
    { campo: 'logo',                 texto: 'Logo' },
    { campo: 'datosFiscalesCliente', texto: 'Datos fiscales del cliente' },
    { campo: 'tasaBcv',              texto: 'Tasa BCV' },
    { campo: 'totalEnBs',            texto: 'Total en bolívares' },
    { campo: 'datosPago',            texto: 'Datos para pagar' },
    { campo: 'notasLegales',         texto: 'Condiciones' },
    { campo: 'despedida',            texto: 'Despedida' },
    { campo: 'firma',                texto: 'Firma' },
    { campo: 'sello',                texto: 'Sello' },
    { campo: 'datosFirmante',        texto: 'Nombre de quien firma' },
    { campo: 'pieEmpresa',           texto: 'Pie con datos de la empresa' },
]

export interface AjustesPDF {
    bloques?: Partial<BloquesDocumento>
    empresa?: any
    firmante?: any
    notasLegales?: string[]
    cuentas?: string[]
    tamanoHoja?: TamanoHoja
    aplicarIva?: boolean
    ivaPct?: number
}

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    tipo: TipoDocumento
    titulo?: string
    /** Monta el documento con los ajustes dados y devuelve su definición. */
    construir: (ajustes: AjustesPDF) => Promise<any>
}

export function EditorPDFModal({ open, onOpenChange, tipo, titulo, construir }: Props) {
    const [config, setConfig] = useState<ConfigPDF>({})
    const [billeteras, setBilleteras] = useState<ConfigBilleteras>({})
    useEffect(() => subscribeToConfigPDF(setConfig), [])
    useEffect(() => subscribeToBilleteras(setBilleteras), [])

    const [bloques, setBloques] = useState<BloquesDocumento>({})
    const [cuentas, setCuentas] = useState<string[]>([])
    const [tamano, setTamano] = useState<TamanoHoja>('continuo')
    const [aplicarIva, setAplicarIva] = useState(false)
    const [ivaPct, setIvaPct] = useState('16')
    const [notas, setNotas] = useState<string[]>([])

    const [preview, setPreview] = useState<string | null>(null)
    const [pintando, setPintando] = useState(false)

    const todasLasCuentas: CuentaBilletera[] = useMemo(
        () => BILLETERAS.flatMap(b => cuentasActivas(b, billeteras))
            .filter(c => c.numeroCuenta || c.telefono || c.correo),
        [billeteras]
    )

    // Al abrir se parte de lo configurado; los cambios de aquí no se guardan.
    useEffect(() => {
        if (!open) return
        setBloques(bloquesDe(config, tipo))
        setCuentas(config.cuentasEnPDF?.length ? config.cuentasEnPDF : todasLasCuentas.map(c => c.id))
        setNotas(notasDe(config))
        setTamano('continuo')
        setAplicarIva(false)
    }, [open, config, tipo, todasLasCuentas])

    const ajustes: AjustesPDF = useMemo(() => ({
        bloques,
        cuentas,
        notasLegales: notas,
        tamanoHoja: tamano,
        aplicarIva,
        ivaPct: parseFloat(ivaPct) || 16,
    }), [bloques, cuentas, notas, tamano, aplicarIva, ivaPct])

    /**
     * Repinta la vista previa.
     *
     * Va con un respiro de medio segundo: cada casilla vuelve a maquetar el PDF
     * entero, y sin la espera marcar cinco casillas seguidas lanza cinco
     * maquetaciones de las que solo importa la última.
     */
    const temporizador = useRef<any>(null)
    const repintar = useCallback(() => {
        clearTimeout(temporizador.current)
        temporizador.current = setTimeout(async () => {
            setPintando(true)
            try {
                const def = await construir(ajustes)
                setPreview(await definicionAPreview(def))
            } catch (e) {
                console.error('No se pudo pintar la vista previa:', e)
                setPreview(null)
            } finally {
                setPintando(false)
            }
        }, 500)
    }, [ajustes, construir])

    useEffect(() => {
        if (!open) return
        repintar()
        return () => clearTimeout(temporizador.current)
    }, [open, repintar])

    const emitir = async () => {
        try {
            await abrirDefinicion(await construir(ajustes))
            onOpenChange(false)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo generar el documento')
        }
    }

    const alternar = (campo: keyof BloquesDocumento) =>
        setBloques(p => ({ ...p, [campo]: !p[campo] }))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[97vw] max-w-6xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
                <DialogHeader className="px-5 sm:px-7 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <DialogTitle className="text-lg sm:text-xl font-black uppercase italic tracking-tighter flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                        {titulo || 'Documento'}
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Los cambios valen solo para este PDF
                    </p>
                </DialogHeader>

                {/* BARRA DE HERRAMIENTAS */}
                <div className="px-5 sm:px-7 py-3 border-b border-slate-100 dark:border-white/5 shrink-0 space-y-3 bg-slate-50/60 dark:bg-white/[0.02]">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        {/* Tamaño de hoja */}
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Hoja</span>
                            <div className="flex gap-1 p-1 rounded-xl bg-white dark:bg-slate-800">
                                {TAMANOS_HOJA.map(t => (
                                    <button key={t.valor} type="button" onClick={() => setTamano(t.valor)}
                                        title={t.ayuda}
                                        className={cn('px-2.5 h-7 rounded-lg text-[9px] font-black uppercase transition-all',
                                            tamano === t.valor ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'text-slate-400')}>
                                        {t.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* IVA */}
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setAplicarIva(v => !v)}
                                className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[9px] font-black uppercase transition-all',
                                    aplicarIva ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400')}>
                                <Percent className="w-3 h-3" /> IVA
                            </button>
                            {aplicarIva && (
                                <Input type="number" value={ivaPct} onChange={e => setIvaPct(e.target.value)}
                                    className="h-7 w-16 rounded-lg bg-white dark:bg-slate-800 border-none text-xs font-black text-center" />
                            )}
                        </div>
                    </div>

                    {/* Bloques */}
                    <div className="flex flex-wrap gap-1.5">
                        {BLOQUES.map(b => {
                            const activo = !!bloques[b.campo]
                            return (
                                <button key={b.campo} type="button" onClick={() => alternar(b.campo)}
                                    className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all',
                                        activo
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white dark:bg-slate-800 text-slate-400 line-through decoration-slate-300')}>
                                    {activo ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    {b.texto}
                                </button>
                            )
                        })}
                    </div>

                    {/* Cuentas que salen */}
                    {bloques.datosPago && todasLasCuentas.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                <Landmark className="w-3 h-3" /> Cuentas
                            </span>
                            {todasLasCuentas.map(c => {
                                const activa = cuentas.includes(c.id)
                                return (
                                    <button key={c.id} type="button"
                                        onClick={() => setCuentas(p => activa ? p.filter(x => x !== c.id) : [...p, c.id])}
                                        className={cn('flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[9px] font-black uppercase transition-all',
                                            activa ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'bg-white dark:bg-slate-800 text-slate-400')}>
                                        <LogoBanco codigo={c.bancoCodigo} texto={c.banco} size={12} />
                                        {c.nombre}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* VISTA PREVIA */}
                <div className="flex-1 min-h-0 bg-slate-200/60 dark:bg-black/40 relative">
                    {pintando && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        </div>
                    )}
                    {preview ? (
                        <iframe
                            src={preview}
                            title="Vista previa del documento"
                            className="w-full h-full min-h-[45vh] border-none"
                        />
                    ) : (
                        <div className="h-full min-h-[45vh] flex flex-col items-center justify-center gap-2 text-slate-400">
                            <FileText className="w-10 h-10 opacity-30" />
                            <p className="text-[10px] font-black uppercase tracking-widest">
                                {pintando ? 'Montando el documento…' : 'No se pudo pintar la vista previa'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="px-5 sm:px-7 py-4 border-t border-slate-100 dark:border-white/5 shrink-0 flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}
                        className="flex-1 h-11 rounded-2xl font-black uppercase text-[10px] tracking-widest border-slate-200">
                        Cancelar
                    </Button>
                    <Button onClick={emitir}
                        className="flex-[2] h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
                        <Download className="w-4 h-4" /> Generar documento
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
