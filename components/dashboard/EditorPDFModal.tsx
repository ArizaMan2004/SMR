// @/components/dashboard/EditorPDFModal.tsx
//
// Ajustar el documento antes de emitirlo, viéndolo.
//
// El documento se arma en HTML, no con pdfmake. Eso cambia dos cosas: la
// vista previa ES el documento, así que se ve al instante en vez de esperar
// medio segundo a que se maquete un PDF; y el papel lo pone el navegador al
// imprimir, que sabe de saltos de página y tamaños de hoja sin que haya que
// calcular alturas a mano.
//
// Lo que se toca aquí vale solo para este documento. Lo guardado en Ajustes
// no se altera: el ajuste de hoy para un cliente concreto no debería cambiar
// cómo salen los de mañana.

"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Printer, Download, Loader2, Eye, EyeOff } from 'lucide-react'
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
import {
    DocumentoHTML, estilosDocumento,
    type DatosDocumento, type TamanoHoja,
} from '@/components/dashboard/DocumentoHTML'

const BLOQUES: { campo: keyof BloquesDocumento; texto: string }[] = [
    { campo: 'logo',                 texto: 'Logo' },
    { campo: 'datosFiscalesCliente', texto: 'Datos del cliente' },
    { campo: 'tasaBcv',              texto: 'Tasa' },
    { campo: 'totalEnBs',            texto: 'Total en Bs' },
    { campo: 'datosPago',            texto: 'Datos de pago' },
    { campo: 'notasLegales',         texto: 'Condiciones' },
    { campo: 'despedida',            texto: 'Despedida' },
    { campo: 'firma',                texto: 'Firma' },
    { campo: 'sello',                texto: 'Sello' },
    { campo: 'datosFirmante',        texto: 'Firmante' },
    { campo: 'pieEmpresa',           texto: 'Pie' },
]

const HOJAS: { valor: TamanoHoja; nombre: string }[] = [
    { valor: 'carta',    nombre: 'Carta · 21,6 × 27,9 cm' },
    { valor: 'oficio',   nombre: 'Oficio · 21,6 × 35,6 cm' },
    { valor: 'continuo', nombre: 'Sin límite · una sola hoja' },
]

export interface TasaDisponible { id: string; nombre: string; valor: number }

interface Props {
    open: boolean
    onOpenChange: (o: boolean) => void
    tipo: TipoDocumento
    datos: DatosDocumento | null
    tasas: TasaDisponible[]
    logoBase64?: string
    firmaBase64?: string
    selloBase64?: string
}

/** El desplegable estándar del editor: lo configurable va en listas. */
const Lista = ({ etiqueta, valor, onChange, children }: any) => (
    <label className="flex items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{etiqueta}</span>
        <select
            value={valor}
            onChange={onChange}
            className="h-8 px-2 rounded-lg text-[10px] font-bold shadow-sm outline-none cursor-pointer bg-white text-slate-900 dark:bg-slate-800 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
        >
            {children}
        </select>
    </label>
)

export function EditorPDFModal({
    open, onOpenChange, tipo, datos, tasas,
    logoBase64, firmaBase64, selloBase64,
}: Props) {
    const [config, setConfig] = useState<ConfigPDF>({})
    const [billeteras, setBilleteras] = useState<ConfigBilleteras>({})
    useEffect(() => subscribeToConfigPDF(setConfig), [])
    useEffect(() => subscribeToBilleteras(setBilleteras), [])

    const [bloques, setBloques] = useState<BloquesDocumento>({})
    const [tamano, setTamano] = useState<TamanoHoja>('continuo')
    const [tasaId, setTasaId] = useState('')
    const [cuentaId, setCuentaId] = useState<string>('TODAS')
    const [aplicarIva, setAplicarIva] = useState(false)
    const [ivaPct, setIvaPct] = useState('16')

    const cuentas: CuentaBilletera[] = useMemo(
        () => BILLETERAS.flatMap(b => cuentasActivas(b, billeteras))
            .filter(c => c.numeroCuenta || c.telefono || c.correo),
        [billeteras]
    )

    useEffect(() => {
        if (!open) return
        setBloques(bloquesDe(config, tipo))
        setTamano('continuo')
        setAplicarIva(false)
        setCuentaId('TODAS')
        setTasaId(prev => prev || tasas[0]?.id || '')
    }, [open, config, tipo, tasas])

    const tasaElegida = tasas.find(t => t.id === tasaId) || tasas[0]

    const opciones = useMemo(() => ({
        bloques,
        empresa: empresaDe(config),
        firmante: firmanteDe(config),
        notas: notasDe(config),
        cuentas: cuentaId === 'TODAS' ? cuentas : cuentas.filter(c => c.id === cuentaId),
        tamano,
        tasa: tasaElegida?.valor ?? 0,
        tasaEtiqueta: tasaElegida?.nombre ?? '',
        aplicarIva,
        ivaPct: parseFloat(ivaPct) || 16,
        logoBase64, firmaBase64, selloBase64,
    }), [bloques, config, cuentas, cuentaId, tamano, tasaElegida, aplicarIva, ivaPct, logoBase64, firmaBase64, selloBase64])

    const contenedor = useRef<HTMLDivElement | null>(null)
    const [guardando, setGuardando] = useState(false)

    const nombreArchivo = () =>
        [datos?.titulo, datos?.numero != null ? `#${datos.numero}` : '', datos?.clienteNombre]
            .filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '').trim() || 'documento'

    /**
     * Descarga el PDF sin pasar por el dialogo de impresora.
     *
     * Es lo que se manda por WhatsApp: ahi el dialogo de impresora de por
     * medio es un paso que no pinta nada.
     *
     * El PDF es una foto de la misma hoja que se ve en pantalla, no una
     * segunda maquetacion. Con dos sitios dibujando el mismo papel, arreglar
     * un margen en uno lo deja torcido en el otro.
     *
     * 'Sin limite' fabrica UNA pagina tan alta como el documento entero, que
     * es justo lo que pide un presupuesto de cuarenta renglones que no tiene
     * sentido cortar en hojas sueltas.
     */
    const guardarPdf = async () => {
        const hoja = contenedor.current
        if (!hoja) return toast.error('No hay nada que guardar')

        setGuardando(true)
        try {
            const [{ toPng }, { default: jsPDF }] = await Promise.all([
                import('html-to-image'),
                import('jspdf'),
            ])

            const imagen = await toPng(hoja, { cacheBust: true, pixelRatio: 2, backgroundColor: '#ffffff' })
            const archivo = `${nombreArchivo()}.pdf`

            if (tamano === 'continuo') {
                const anchoPt = 612 // 8,5 pulgadas a 72 pt
                const pdf = new jsPDF({ unit: 'pt', format: [anchoPt, 100] })
                const props = pdf.getImageProperties(imagen)
                const altoPt = (props.height * anchoPt) / props.width
                const largo = new jsPDF({ unit: 'pt', format: [anchoPt, altoPt] })
                largo.addImage(imagen, 'PNG', 0, 0, anchoPt, altoPt)
                largo.save(archivo)
                return
            }

            const pdf = new jsPDF({ unit: 'pt', format: tamano === 'oficio' ? 'legal' : 'letter' })
            const anchoPagina = pdf.internal.pageSize.getWidth()
            const altoPagina = pdf.internal.pageSize.getHeight()
            const props = pdf.getImageProperties(imagen)
            const altoImagen = (props.height * anchoPagina) / props.width

            // Se corre la misma imagen hacia arriba en cada pagina, que es como
            // se reparte un documento largo sin volver a maquetarlo.
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

            pdf.save(archivo)
        } catch (e) {
            console.error(e)
            toast.error('No se pudo generar el PDF')
        } finally {
            setGuardando(false)
        }
    }

    /**
     * Imprime a PDF con el motor del navegador.
     *
     * Se copia el documento a un iframe aislado con sus propios estilos: sin
     * eso, imprimir arrastraría toda la hoja de estilos de la aplicación y el
     * papel saldría con el fondo y los colores de la pantalla.
     */
    const emitir = () => {
        const html = contenedor.current?.innerHTML
        if (!html) return toast.error('No hay nada que imprimir')

        const marco = document.createElement('iframe')
        marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
        document.body.appendChild(marco)

        const doc = marco.contentDocument
        if (!doc) { marco.remove(); return toast.error('El navegador no dejó preparar la impresión') }

        doc.open()
        // "Sin limite" no existe en una impresora de verdad: un papel no sale
        // infinitamente largo. Para imprimir se usa carta, que es lo comun;
        // quien quiere el presupuesto largo de una pieza usa "Guardar PDF".
        const hojaImpresion: TamanoHoja = tamano === 'continuo' ? 'carta' : tamano

        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${datos?.titulo || 'Documento'}</title><style>${estilosDocumento(hojaImpresion)}
            body { margin: 0; background: #fff; }
            .doc { padding: 0; width: auto; }
        </style></head><body>${html}</body></html>`)
        doc.close()

        // Se espera a que carguen el logo, la firma y el sello: imprimir antes
        // saca el documento con los huecos en blanco.
        const imprimir = () => {
            marco.contentWindow?.focus()
            marco.contentWindow?.print()
            setTimeout(() => marco.remove(), 1000)
        }
        const imgs = Array.from(doc.images)
        if (imgs.every(i => i.complete)) setTimeout(imprimir, 150)
        else {
            let faltan = imgs.filter(i => !i.complete).length
            imgs.filter(i => !i.complete).forEach(i => {
                const listo = () => { if (--faltan <= 0) setTimeout(imprimir, 100) }
                i.addEventListener('load', listo, { once: true })
                i.addEventListener('error', listo, { once: true })
            })
            // Por si alguna imagen nunca responde.
            setTimeout(() => { if (faltan > 0) { faltan = 0; imprimir() } }, 3000)
        }
    }

    if (!datos) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[97vw] max-w-5xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
                <DialogHeader className="px-5 sm:px-7 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                    <DialogTitle className="text-lg sm:text-xl font-black uppercase italic tracking-tighter flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                        {datos.titulo}{datos.numero != null ? ` #${datos.numero}` : ''}
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Los cambios valen solo para este documento
                    </p>
                </DialogHeader>

                {/* BARRA DE HERRAMIENTAS */}
                <div className="px-5 sm:px-7 py-3 border-b border-slate-100 dark:border-white/5 shrink-0 space-y-3 bg-slate-50/60 dark:bg-white/[0.02]">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Lista etiqueta="Hoja" valor={tamano} onChange={(e: any) => setTamano(e.target.value)}>
                            {HOJAS.map(h => <option key={h.valor} value={h.valor}>{h.nombre}</option>)}
                        </Lista>

                        {tasas.length > 0 && (
                            <Lista etiqueta="Tasa" valor={tasaId} onChange={(e: any) => setTasaId(e.target.value)}>
                                {tasas.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.nombre}{t.valor > 1 ? ` · ${t.valor.toFixed(2)}` : ''}
                                    </option>
                                ))}
                            </Lista>
                        )}

                        {bloques.datosPago && cuentas.length > 0 && (
                            <Lista etiqueta="Cuenta" valor={cuentaId} onChange={(e: any) => setCuentaId(e.target.value)}>
                                <option value="TODAS">Todas ({cuentas.length})</option>
                                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </Lista>
                        )}

                        <label className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">IVA</span>
                            <select
                                value={aplicarIva ? 'si' : 'no'}
                                onChange={e => setAplicarIva(e.target.value === 'si')}
                                className="h-8 px-2 rounded-lg text-[10px] font-bold shadow-sm outline-none cursor-pointer bg-white text-slate-900 dark:bg-slate-800 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                            >
                                <option value="no">Sin IVA</option>
                                <option value="si">Con IVA</option>
                            </select>
                            {aplicarIva && (
                                <Input type="number" value={ivaPct} onChange={e => setIvaPct(e.target.value)}
                                    className="h-8 w-14 rounded-lg bg-white dark:bg-slate-800 border-none text-[11px] font-black text-center" />
                            )}
                        </label>
                    </div>

                    {/* Mostrar u ocultar: esto sí son interruptores, uno por bloque. */}
                    <div className="flex flex-wrap gap-1">
                        {BLOQUES.map(b => {
                            const activo = !!bloques[b.campo]
                            return (
                                <button key={b.campo} type="button"
                                    onClick={() => setBloques(p => ({ ...p, [b.campo]: !p[b.campo] }))}
                                    className={cn('flex items-center gap-1 px-2 h-7 rounded-lg text-[9px] font-black uppercase transition-all',
                                        activo ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400')}>
                                    {activo ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                                    {b.texto}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* VISTA PREVIA — es el documento, no una imitación */}
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-slate-300/50 dark:bg-black/50 p-4 sm:p-6">
                    <style>{estilosDocumento(tamano)}</style>
                    <div ref={contenedor} className="mx-auto shadow-2xl" style={{ width: 'fit-content', background: '#fff' }}>
                        <DocumentoHTML datos={datos} op={opciones} />
                    </div>
                </div>

                <div className="px-5 sm:px-7 py-4 border-t border-slate-100 dark:border-white/5 shrink-0 flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}
                        className="flex-1 h-11 rounded-2xl font-black uppercase text-[10px] tracking-widest border-slate-200">
                        Cancelar
                    </Button>
                    {/* Dos destinos distintos: la impresora del taller y el
                        archivo que se manda por WhatsApp. */}
                    <Button variant="outline" onClick={emitir} disabled={guardando}
                        className="flex-1 h-11 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 border-slate-200">
                        <Printer className="w-4 h-4" /> Imprimir
                    </Button>
                    <Button onClick={guardarPdf} disabled={guardando}
                        className="flex-[2] h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
                        {guardando
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando</>
                            : <><Download className="w-4 h-4" /> Guardar PDF</>}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
