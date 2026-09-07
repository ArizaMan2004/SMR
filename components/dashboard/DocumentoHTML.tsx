// @/components/dashboard/DocumentoHTML.tsx
//
// EL PAPEL QUE SE LE DA AL CLIENTE.
//
// Tres documentos con la misma hoja: presupuesto, nota de entrega y factura.
// Lo que cambia entre ellos lo decide `lib/services/tipos-documento.ts`; aquí
// solo se dibuja.
//
// Está en HTML y no en pdfmake porque así el documento ES la vista previa: se
// ve al instante mientras se tocan las opciones, y el PDF se saca de esta
// misma hoja. Con dos sitios dibujando el mismo papel, arreglar un margen en
// uno lo deja torcido en el otro.
//
// Sin bordes de celda y con líneas solo donde separan algo: es un documento
// que se lee, no una tabla de datos.

"use client"

import React from 'react'

import { type CuentaBilletera } from '@/lib/services/billeteras-service'
import { bancoPorCodigo } from '@/lib/services/bancos-venezuela'
import type { BloquesDocumento, DatosEmpresa, DatosFirmante } from '@/lib/services/pdf-config-service'
import { reglasDe, type TipoImpreso } from '@/lib/services/tipos-documento'

export type TamanoHoja = 'carta' | 'oficio' | 'continuo'

export interface DatosDocumento {
    numero?: string | number
    fecha: string
    fechaEntrega?: string
    clienteNombre: string
    clienteDocumento?: string
    clienteTelefono?: string
    items: { descripcion: string; cantidad: number; unidad?: string; precioUnitario: number; total: number }[]
    totalUSD: number
    /** Lo ya cobrado, para las notas de entrega y las facturas. */
    cobradoUSD?: number
    notas?: string
}

export interface OpcionesDocumento {
    tipo: TipoImpreso
    bloques: BloquesDocumento
    empresa: DatosEmpresa
    firmante: DatosFirmante
    notas: string[]
    cuentas: CuentaBilletera[]
    tamano: TamanoHoja
    /** Tasa para el equivalente en bolívares. Cero: no se muestra. */
    tasa: number
    /** true si la tasa es la de hoy y no la que de verdad se cobró. */
    tasaEsDeHoy: boolean
    mostrarEntrega: boolean
    mostrarTasa: boolean
    aplicarIva: boolean
    ivaPct: number
    logoBase64?: string
    firmaBase64?: string
    selloBase64?: string
}

const usd = (n: number) =>
    '$' + n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const bs = (n: number) =>
    n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Fecha corta y en local: el papel lo lee alguien que está en Venezuela. */
const soloFecha = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Los estilos de la hoja.
 *
 * Van en una cadena y no en clases de Tailwind porque este mismo HTML se
 * inyecta en el iframe que se imprime, donde no existe la hoja de estilos de
 * la aplicación. Todo lo que necesita para verse tiene que viajar con él.
 */
export const estilosDocumento = (tamano: TamanoHoja) => {
    const hoja = tamano === 'carta'
        ? 'size: letter;'
        : tamano === 'oficio'
            ? 'size: 216mm 356mm;'
            // Tan larga como el contenido: sin cortes ni paginado.
            : 'size: 216mm 2000mm;'

    return `
@page { ${hoja} margin: 12mm; }
.hoja, .hoja * { box-sizing: border-box; }
.hoja {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #111;
  background: #fff;
  font-size: 12px;
  line-height: 1.45;
  padding: 40px;
  width: 216mm;
  margin: 0 auto;
}

/* cabecera */
.h-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
         border-bottom: 2px solid #111; padding-bottom: 16px; }
.h-emisor { display: flex; align-items: flex-start; gap: 16px; min-width: 0; }
.h-emisor img { height: 64px; width: 64px; object-fit: contain; flex-shrink: 0; }
.h-emisor .razon { font-size: 18px; font-weight: 700; line-height: 1.2; margin: 0; }
.h-emisor p { margin: 0; font-size: 11px; }
.h-emisor .dir { max-width: 38ch; line-height: 1.35; }
.h-doc { text-align: right; flex-shrink: 0; }
.h-doc .titulo { font-size: 21px; font-weight: 900; letter-spacing: -.02em; margin: 0; }
.h-doc p { margin: 4px 0 0; font-size: 11px; }
.h-doc strong { font-variant-numeric: tabular-nums; }

/* cliente */
.h-cliente { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px;
             border-bottom: 1px solid #ccc; padding-bottom: 12px; font-size: 11px; }
.h-cliente p { margin: 0; }
.h-cliente .et { font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; }
.h-cliente .nombre { font-weight: 600; }
.h-cliente .der { text-align: right; }

/* renglones */
table.h-items { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
table.h-items th { border-bottom: 1px solid #111; padding-bottom: 6px; text-align: left; font-weight: 700; }
table.h-items th.c { text-align: center; }
table.h-items th.d { text-align: right; }
table.h-items td { border-bottom: 1px solid #eee; padding: 6px 0; vertical-align: top; white-space: pre-wrap; }
table.h-items td.c { text-align: center; padding-right: 12px; }
table.h-items td.d { text-align: right; font-variant-numeric: tabular-nums; }

/* totales */
.h-totales { display: flex; justify-content: flex-end; margin-top: 16px; }
.h-totales dl { width: 260px; font-size: 11px; margin: 0; }
.h-totales .fila { display: flex; justify-content: space-between; }
.h-totales dt, .h-totales dd { margin: 0; }
.h-totales dd { font-variant-numeric: tabular-nums; }
.h-totales .total { display: flex; justify-content: space-between; border-top: 2px solid #111;
                    margin-top: 4px; padding-top: 6px; font-size: 14px; font-weight: 700; }
.h-totales .enbs { display: flex; justify-content: space-between; font-size: 11px; }
.h-totales .cobros { margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
.h-totales .cobros .saldo { display: flex; justify-content: space-between; font-weight: 600; }

/* pago y notas */
.h-pago { margin-top: 16px; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; }
.h-pago .et { font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 4px; }
.h-pago .cuenta { margin-bottom: 6px; }
.h-pago .cuenta:last-child { margin-bottom: 0; }
.h-pago span.k { font-weight: 700; }
.h-notas { margin-top: 12px; font-size: 10px; line-height: 1.35; }
.h-notas .et { font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin: 0; }
.h-notas ul { margin: 2px 0 0; padding-left: 14px; }
.h-obs { margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; font-size: 11px; }

/* firmas */
.h-firmas { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; margin-top: 32px; }
.h-firmas > div { flex: 1; }
.h-firmas .rubricas { display: flex; height: 64px; align-items: flex-end; justify-content: center; gap: 24px; }
.h-firmas .rubricas img { height: 64px; object-fit: contain; }
.h-firmas .linea { margin-top: 4px; border-top: 1px solid #111; padding-top: 4px;
                   text-align: center; font-size: 10px; }
.h-firmas .hueco { height: 64px; }

/* pie */
.h-pie { margin-top: 24px; border-top: 1px solid #eee; padding-top: 8px;
         text-align: center; font-size: 9px; line-height: 1.35; }
.h-pie p { margin: 0; }
`
}

export function DocumentoHTML({ datos, op }: { datos: DatosDocumento; op: OpcionesDocumento }) {
    const reglas = reglasDe(op.tipo)

    /**
     * El IVA sale de DENTRO del precio, no se suma encima.
     *
     * Los precios del taller ya son lo que se cobra: si un trabajo está en
     * $115, el papel tiene que seguir diciendo $115 y desglosar cuánto de eso
     * es impuesto. Sumando 16% encima saldrían $133,40 y el cliente recibiría
     * un documento que no cuadra con lo que le dijeron.
     *
     *     base = total / (1 + alícuota)     impuesto = total − base
     *
     * En ese orden, y no calculando el impuesto por su lado: así base +
     * impuesto vuelve a dar el total EXACTO. Sacando cada uno aparte, el
     * redondeo deja un céntimo suelto y el desglose impreso no suma.
     */
    const desglosa = reglas.desglosaIva && op.aplicarIva
    const total = datos.totalUSD
    const base = desglosa ? total / (1 + op.ivaPct / 100) : total
    const iva = desglosa ? total - base : 0

    /**
     * Cuando se desglosa, los renglones se imprimen SIN el IVA que ya llevan
     * dentro.
     *
     * Si el renglon dijera el precio completo, sumarlos no daria la base
     * imponible y el papel se leeria mal: los importes de arriba no cuadran
     * con el subtotal de abajo. Quitandoselo, el renglon dice a cuanto sale
     * de verdad la unidad y el impuesto se suma una sola vez, al final.
     *
     * El TOTAL sigue siendo exactamente lo que se tecleo.
     */
    const sinIva = (n: number) => desglosa ? n / (1 + op.ivaPct / 100) : n

    const cobrado = datos.cobradoUSD || 0
    const debe = Math.max(0, total - cobrado)

    const numero = datos.numero != null ? String(datos.numero).padStart(5, '0') : ''

    return (
        <div className="hoja">
            {/* ------------------------------------------------- cabecera */}
            <header className="h-top">
                <div className="h-emisor">
                    {op.bloques.logo && op.logoBase64 ? <img src={op.logoBase64} alt="" /> : null}
                    <div style={{ minWidth: 0 }}>
                        <p className="razon">{op.empresa.nombre}</p>
                        {op.empresa.rif && <p>RIF: {op.empresa.rif}</p>}
                        {op.empresa.direccion && <p className="dir">{op.empresa.direccion}</p>}
                        {(op.empresa.telefono || op.empresa.correo) && (
                            <p>{[op.empresa.telefono, op.empresa.correo].filter(Boolean).join(' · ')}</p>
                        )}
                    </div>
                </div>

                <div className="h-doc">
                    <p className="titulo">{reglas.titulo}</p>
                    {numero && <p>{reglas.etiquetaNumero} <strong>{numero}</strong></p>}
                    <p>{soloFecha(datos.fecha)}</p>
                </div>
            </header>

            {/* -------------------------------------------------- cliente */}
            <section className="h-cliente">
                <div>
                    <p className="et">{reglas.etiquetaCliente}</p>
                    <p className="nombre">{datos.clienteNombre || 'Consumidor final'}</p>
                    {op.bloques.datosFiscalesCliente && datos.clienteDocumento && (
                        <p>RIF/CI: {datos.clienteDocumento}</p>
                    )}
                    {op.bloques.datosFiscalesCliente && datos.clienteTelefono && (
                        <p>Tel: {datos.clienteTelefono}</p>
                    )}
                </div>
                <div className="der">
                    {op.mostrarEntrega && datos.fechaEntrega && (
                        <p><span className="et" style={{ display: 'inline' }}>Entrega: </span>{soloFecha(datos.fechaEntrega)}</p>
                    )}
                    {op.mostrarTasa && op.tasa > 0 && (
                        <p>
                            <span className="et" style={{ display: 'inline' }}>
                                Tasa{op.tasaEsDeHoy ? ' (hoy)' : ''}:{' '}
                            </span>
                            Bs. {bs(op.tasa)}
                        </p>
                    )}
                </div>
            </section>

            {/* ------------------------------------------------ renglones */}
            {/* La cantidad va primero: es lo primero que se lee de un renglón
                —"3 banners de…"— y no el nombre del trabajo. */}
            <table className="h-items">
                <thead>
                    <tr>
                        <th className="c">Cantidad</th>
                        <th>Descripción</th>
                        <th className="d">P. unitario</th>
                        <th className="d">Importe</th>
                    </tr>
                </thead>
                <tbody>
                    {datos.items.map((it, i) => (
                        <tr key={i}>
                            <td className="c">{it.cantidad}{it.unidad ? ` ${it.unidad}` : ''}</td>
                            <td>{it.descripcion || '—'}</td>
                            <td className="d">{usd(sinIva(it.precioUnitario))}</td>
                            <td className="d">{usd(sinIva(it.total))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* -------------------------------------------------- totales */}
            <section className="h-totales">
                <dl>
                    {desglosa && (
                        <>
                            <div className="fila"><dt>Base imponible</dt><dd>{usd(base)}</dd></div>
                            <div className="fila"><dt>IVA {op.ivaPct}%</dt><dd>{usd(iva)}</dd></div>
                        </>
                    )}

                    <div className="total"><dt>TOTAL</dt><dd>{usd(total)}</dd></div>

                    {op.mostrarTasa && op.tasa > 0 && (
                        <div className="enbs">
                            <dt>En bolívares{op.tasaEsDeHoy ? ' (a la tasa de hoy)' : ''}</dt>
                            <dd>Bs. {bs(total * op.tasa)}</dd>
                        </div>
                    )}

                    {reglas.muestraCobros && cobrado > 0 && (
                        <div className="cobros">
                            <div className="fila"><dt>Cobrado</dt><dd>{usd(cobrado)}</dd></div>
                            <div className="saldo">
                                <dt>{debe > 0 ? 'Queda debiendo' : 'Cancelado'}</dt>
                                <dd>{usd(debe)}</dd>
                            </div>
                        </div>
                    )}
                </dl>
            </section>

            {/* ---------------------------------------------- cómo pagar */}
            {op.bloques.datosPago && op.cuentas.length > 0 && (
                <section className="h-pago">
                    <p className="et">Datos para pagos / transferencias</p>
                    {op.cuentas.map(c => {
                        const banco = bancoPorCodigo(c.bancoCodigo)
                        const partes = [
                            banco?.nombre,
                            c.titular,
                            c.documento,
                            c.modo === 'pago_movil' ? c.telefono : c.numeroCuenta,
                            c.correo,
                        ].filter(Boolean)
                        return (
                            <p className="cuenta" key={c.id}>
                                <span className="k">{c.nombre}:</span> {partes.join(' · ')}
                            </p>
                        )
                    })}
                </section>
            )}

            {datos.notas && (
                <p className="h-obs"><strong>Observaciones: </strong>{datos.notas}</p>
            )}

            {op.bloques.notasLegales && op.notas.length > 0 && (
                <div className="h-notas">
                    <p className="et">Nota:</p>
                    <ul>{op.notas.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
            )}

            {/* --------------------------------------------------- firmas */}
            {(op.bloques.firma || op.bloques.sello || op.bloques.datosFirmante) && (
                <section className="h-firmas">
                    <div>
                        {/* En fila y no superpuestos: puestos los dos sobre la
                            misma caja, el sello cae encima de la firma y no se
                            lee ninguno de los dos. */}
                        <div className="rubricas">
                            {op.bloques.firma && op.firmaBase64 && <img src={op.firmaBase64} alt="" />}
                            {op.bloques.sello && op.selloBase64 && <img src={op.selloBase64} alt="" />}
                        </div>
                        <p className="linea">
                            {op.bloques.datosFirmante && op.firmante.nombre
                                ? `${op.firmante.nombre}${op.firmante.cedula ? ` · C.I. ${op.firmante.cedula}` : ''}`
                                : 'Firma y sello autorizados'}
                        </p>
                    </div>

                    <div>
                        <div className="hueco" />
                        <p className="linea">{reglas.etiquetaConforme}</p>
                    </div>
                </section>
            )}

            {/* ------------------------------------------------------ pie */}
            <footer className="h-pie">
                <p>{reglas.leyenda}</p>
                {op.bloques.pieEmpresa && op.empresa.nombre && (
                    <p>{op.empresa.nombre} · RIF {op.empresa.rif}</p>
                )}
            </footer>
        </div>
    )
}
