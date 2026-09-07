// @/components/dashboard/EditorPDFModal.tsx
//
// EL DOCUMENTO ANTES DE ENTREGARLO.
//
// Barra arriba con lo que se puede cambiar, y debajo la hoja tal como va a
// salir. La barra no se imprime.
//
// DOS BOTONES, DOS DESTINOS
//
// "Imprimir" abre el diálogo del navegador, con la impresora del taller como
// primera opción. "Guardar PDF" descarga el archivo directo, sin pasar por
// ese diálogo: es el que se manda por WhatsApp, y ahí el diálogo de impresora
// de por medio es un paso que no pinta nada.
//
// El PDF se genera a partir de la MISMA hoja que se ve en pantalla, así que no
// hay dos plantillas que puedan desalinearse: lo que se ve es lo que se
// descarga. Las librerías se cargan dentro del botón, no al abrir el modal:
// la mayoría de las veces alguien solo quiere mirar.
//
// Lo que se toca aquí vale solo para este documento. Lo guardado en Ajustes no
// se altera: el ajuste de hoy para un cliente no debería cambiar los de mañana.

"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { AlertTriangle, Download, Loader2, Printer, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
    subscribeToConfigPDF, empresaDe, firmanteDe, notasDe, bloquesDe,
    type ConfigPDF, type BloquesDocumento,
} from '@/lib/services/pdf-config-service'
import {
    subscribeToBilleteras, cuentasActivas, BILLETERAS,
    type ConfigBilleteras, type CuentaBilletera,
} from '@/lib/services/billeteras-service'
import {
    TIPOS, reglasDe, problemasPara, nombreArchivo, type TipoImpreso,
} from '@/lib/services/tipos-documento'
import {
    DocumentoHTML, estilosDocumento,
    type DatosDocumento, type TamanoHoja,
} from '@/components/dashboard/DocumentoHTML'

export interface TasaDisponible {
    id: string
    nombre: string
    valor: number
    /** true si es la tasa de hoy y no la que de verdad se cobró. */
    esDeHoy?: boolean
}

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    datos: DatosDocumento | null
    tasas: TasaDisponible[]
    /** Un presupuesto no puede imprimirse como factura: no es una venta. */
    soloPresupuesto?: boolean
    tipoInicial?: TipoImpreso
    logoBase64?: string
    firmaBase64?: string
    selloBase64?: string
}

export function EditorPDFModal({
    open, onOpenChange, datos, tasas,
    soloPresupuesto, tipoInicial,
    logoBase64, firmaBase64, selloBase64,
}: Props) {
    const [config, setConfig] = useState<ConfigPDF>({})
    const [billeteras, setBilleteras] = useState<ConfigBilleteras>({})
    useEffect(() => subscribeToConfigPDF(setConfig), [])
    useEffect(() => subscribeToBilleteras(setBilleteras), [])

    const [tipo, setTipo] = useState<TipoImpreso>(
        soloPresupuesto ? 'PRESUPUESTO' : (tipoInicial || 'NOTA_DE_ENTREGA')
    )
    const [mostrarEntrega, setMostrarEntrega] = useState(true)
    const [mostrarTasa, setMostrarTasa] = useState(true)
    const [tasaId, setTasaId] = useState('')
    const [formato, setFormato] = useState<TamanoHoja>('carta')
    const [aplicarIva, setAplicarIva] = useState(false)
    const [cuentaId, setCuentaId] = useState('TODAS')
    const [generando, setGenerando] = useState(false)

    const hojaRef = useRef<HTMLDivElement>(null)

    const cuentas: CuentaBilletera[] = useMemo(
        () => BILLETERAS.flatMap(b => cuentasActivas(b, billeteras))
            .filter(c => c.numeroCuenta || c.telefono || c.correo),
        [billeteras]
    )

    // Los bloques arrancan con lo de Ajustes, y se pueden apagar aquí para
    // este documento sin ir a cambiar el ajuste de todos.
    const [bloques, setBloques] = useState<BloquesDocumento>({})
    useEffect(() => {
        if (!open) return
        const tipoConfig = tipo === 'PRESUPUESTO' ? 'presupuesto' : 'orden'
        setBloques(bloquesDe(config, tipoConfig))
        setTasaId(prev => prev || tasas[0]?.id || '')
    }, [open, config, tipo, tasas])

    const empresa = empresaDe(config)
    const firmante = firmanteDe(config)
    const tasaElegida = tasas.find(t => t.id === tasaId) || tasas[0]
    const disponibles = soloPresupuesto ? TIPOS.filter(t => t.id === 'PRESUPUESTO') : TIPOS

    const avisos = useMemo(
        () => datos ? problemasPara(tipo, empresa, {
            nombre: datos.clienteNombre,
            documento: datos.clienteDocumento,
        }) : [],
        [tipo, empresa, datos]
    )

    const opciones = useMemo(() => ({
        tipo,
        bloques,
        empresa,
        firmante,
        notas: notasDe(config),
        cuentas: cuentaId === 'TODAS' ? cuentas : cuentas.filter(c => c.id === cuentaId),
        tamano: formato,
        tasa: tasaElegida?.valor ?? 0,
        tasaEsDeHoy: !!tasaElegida?.esDeHoy,
        mostrarEntrega,
        mostrarTasa,
        aplicarIva,
        ivaPct: 16,
        logoBase64, firmaBase64, selloBase64,
    }), [tipo, bloques, empresa, firmante, config, cuentas, cuentaId, formato,
        tasaElegida, mostrarEntrega, mostrarTasa, aplicarIva, logoBase64, firmaBase64, selloBase64])

    const archivo = () =>
        nombreArchivo(tipo, datos?.numero != null ? String(datos.numero) : '', datos?.clienteNombre || '')

    /**
     * Imprime con el navegador.
     *
     * Se copia la hoja a un iframe con sus propios estilos: sin eso, imprimir
     * arrastraría la hoja de estilos de la aplicación y el papel saldría con
     * los colores de la pantalla.
     *
     * "Sin límite" no existe en una impresora de verdad —un papel no sale
     * infinitamente largo—, así que ahí se imprime en carta; quien quiere el
     * documento largo de una pieza usa "Guardar PDF".
     */
    const imprimir = () => {
        const html = hojaRef.current?.innerHTML
        if (!html) return toast.error('No hay nada que imprimir')

        const papel: TamanoHoja = formato === 'continuo' ? 'carta' : formato

        const marco = document.createElement('iframe')
        marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
        document.body.appendChild(marco)

        const doc = marco.contentDocument
        if (!doc) { marco.remove(); return toast.error('El navegador no dejó preparar la impresión') }

        doc.open()
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${archivo()}</title>` +
            `<style>${estilosDocumento(papel)} body{margin:0;background:#fff} .hoja{padding:0;width:auto}</style>` +
            `</head><body>${html}</body></html>`)
        doc.close()

        // Se espera a que carguen logo, firma y sello: imprimir antes saca el
        // documento con los huecos en blanco.
        const lanzar = () => {
            marco.contentWindow?.focus()
            marco.contentWindow?.print()
            setTimeout(() => marco.remove(), 1000)
        }
        const imgs = Array.from(doc.images)
        const pendientes = imgs.filter(i => !i.complete)
        if (pendientes.length === 0) { setTimeout(lanzar, 150); return }

        let faltan = pendientes.length
        pendientes.forEach(i => {
            const listo = () => { if (--faltan <= 0) setTimeout(lanzar, 100) }
            i.addEventListener('load', listo, { once: true })
            i.addEventListener('error', listo, { once: true })
        })
        // Por si alguna imagen nunca responde.
        setTimeout(() => { if (faltan > 0) { faltan = 0; lanzar() } }, 3000)
    }

    /**
     * Descarga el PDF sin pasar por el diálogo de impresora.
     *
     * Es una foto de la hoja. En carta y oficio se reparte en tantas páginas
     * como haga falta, corriendo la misma imagen hacia arriba en cada una. En
     * "sin límite" se fabrica UNA sola página tan alta como el documento
     * entero, que es lo que pide un presupuesto de cuarenta renglones que no
     * tiene sentido cortar en hojas sueltas.
     */
    const guardarPdf = async () => {
        const hoja = hojaRef.current
        if (!hoja) return toast.error('No hay nada que guardar')

        setGenerando(true)
        try {
            const [{ toPng }, { default: jsPDF }] = await Promise.all([
                import('html-to-image'),
                import('jspdf'),
            ])

            const imagen = await toPng(hoja, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
            const nombre = `${archivo()}.pdf`

            if (formato === 'continuo') {
                const anchoPt = 612 // 8,5 pulgadas a 72 pt
                const medidor = new jsPDF({ unit: 'pt', format: [anchoPt, 100] })
                const props = medidor.getImageProperties(imagen)
                const altoPt = (props.height * anchoPt) / props.width
                const pdf = new jsPDF({ unit: 'pt', format: [anchoPt, altoPt] })
                pdf.addImage(imagen, 'PNG', 0, 0, anchoPt, altoPt)
                pdf.save(nombre)
                return
            }

            const pdf = new jsPDF({ unit: 'pt', format: formato === 'oficio' ? 'legal' : 'letter' })
            const anchoPagina = pdf.internal.pageSize.getWidth()
            const altoPagina = pdf.internal.pageSize.getHeight()
            const props = pdf.getImageProperties(imagen)
            const altoImagen = (props.height * anchoPagina) / props.width

            let restante = altoImagen
            let y = 0
            pdf.addImage(imagen, 'PNG', 0, y, anchoPagina, altoImagen)
            restante -= altoPagina

            while (restante > 0) {
                y -= altoPagina
                pdf.addPage()
                pdf.addImage(imagen, 'PNG', 0, y, anchoPagina, altoImagen)
                restante -= altoPagina
            }

            pdf.save(nombre)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo generar el PDF')
        } finally {
            setGenerando(false)
        }
    }

    if (!open || !datos) return null

    const control = 'rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]'

    // Portal: el editor se abre desde dentro de paneles con transform de
    // framer-motion, y sin escapar de ahí este "fixed inset-0" quedaría
    // contenido dentro del panel en vez de cubrir la pantalla.
    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
            <div className="mx-auto max-w-[820px]">

                {/* --------------------------------------- barra, no se imprime */}
                <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-3 shadow-lg">
                    <div className="flex flex-1 flex-wrap gap-1.5">
                        {disponibles.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTipo(t.id)}
                                title={t.explicacion}
                                aria-pressed={tipo === t.id}
                                className={cn(
                                    'rounded-full px-4 py-2 text-xs font-medium transition',
                                    tipo === t.id
                                        ? 'bg-sky-500 text-white'
                                        : 'border border-slate-300 dark:border-white/15 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                )}
                            >
                                {t.titulo}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={imprimir}
                        disabled={generando}
                        className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                        <Printer className="h-4 w-4" /> Imprimir
                    </button>
                    <button
                        type="button"
                        onClick={guardarPdf}
                        disabled={generando}
                        className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                    >
                        {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Guardar PDF
                    </button>

                    <button
                        onClick={() => onOpenChange(false)}
                        aria-label="Cerrar"
                        className="rounded-lg border border-slate-300 dark:border-white/15 p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {/* Qué llevar en ESTE documento. Arrancan con lo de Ajustes,
                        pero cambiarlas aquí no toca el ajuste del negocio. */}
                    <div className="flex w-full flex-wrap items-center gap-4 border-t border-slate-200 dark:border-white/10 pt-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <label className="flex items-center gap-1.5">
                            <input type="checkbox" checked={mostrarEntrega}
                                onChange={e => setMostrarEntrega(e.target.checked)} />
                            Fecha de entrega
                        </label>
                        <label className="flex items-center gap-1.5">
                            <input type="checkbox" checked={mostrarTasa}
                                onChange={e => setMostrarTasa(e.target.checked)} />
                            Equivalente en bolívares
                        </label>

                        {mostrarTasa && tasas.length > 0 ? (
                            <label className="flex items-center gap-1.5">
                                Con la tasa
                                <select value={tasaId} onChange={e => setTasaId(e.target.value)} className={control}>
                                    {tasas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                </select>
                            </label>
                        ) : null}

                        {reglasDe(tipo).desglosaIva ? (
                            <label className="flex items-center gap-1.5">
                                <input type="checkbox" checked={aplicarIva}
                                    onChange={e => setAplicarIva(e.target.checked)} />
                                Desglosar IVA
                            </label>
                        ) : null}

                        {bloques.datosPago && cuentas.length > 0 ? (
                            <label className="flex items-center gap-1.5">
                                Cuenta
                                <select value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={control}>
                                    <option value="TODAS">Todas ({cuentas.length})</option>
                                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </label>
                        ) : null}

                        <label className="flex items-center gap-1.5">
                            Papel
                            <select value={formato} onChange={e => setFormato(e.target.value as TamanoHoja)} className={control}>
                                <option value="carta">Carta</option>
                                <option value="oficio">Oficio</option>
                                <option value="continuo">Sin límite (solo PDF)</option>
                            </select>
                        </label>
                    </div>
                </div>

                {/* Los avisos son para quien factura, nunca salen en el papel. */}
                {avisos.length > 0 ? (
                    <div className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-500/5 p-4">
                        <div className="mb-1.5 flex items-center gap-2 text-rose-500">
                            <AlertTriangle className="h-4 w-4" />
                            <p className="text-sm font-semibold">Antes de imprimir</p>
                        </div>
                        <ul className="grid gap-1 text-sm text-slate-500 dark:text-slate-400">
                            {avisos.map(a => <li key={a}>· {a}</li>)}
                        </ul>
                    </div>
                ) : null}

                {/* --------------------------------------------------- la hoja */}
                <style>{estilosDocumento(formato)}</style>
                <div ref={hojaRef} className="rounded-2xl bg-white shadow-2xl overflow-hidden">
                    <DocumentoHTML datos={datos} op={opciones} />
                </div>
            </div>
        </div>,
        document.body
    )
}
