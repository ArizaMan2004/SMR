// @/components/dashboard/DocumentoHTML.tsx
//
// El documento, escrito en HTML.
//
// Antes se maquetaba con pdfmake: un árbol de objetos donde cada columna y
// cada margen es una propiedad, y donde para ver el resultado había que
// generar el PDF entero. Cambiar una casilla costaba medio segundo de espera.
//
// En HTML el documento ES la vista previa. Se ve al instante mientras se
// tocan las opciones, y para emitirlo se imprime a PDF con el propio motor
// del navegador, que respeta el tamaño de hoja y los saltos de página sin que
// haya que calcularlos a mano.
//
// El tamaño de hoja se controla con @page; 'continuo' pone una hoja tan larga
// como el contenido para que un presupuesto largo no salga cortado en tres.

"use client"

import React from 'react'

import { type CuentaBilletera } from '@/lib/services/billeteras-service'
import { bancoPorCodigo } from '@/lib/services/bancos-venezuela'
import type { BloquesDocumento, DatosEmpresa, DatosFirmante } from '@/lib/services/pdf-config-service'

export type TamanoHoja = 'carta' | 'oficio' | 'continuo'

export interface DatosDocumento {
    titulo: string
    numero?: string | number
    fecha: string
    clienteNombre: string
    clienteDocumento?: string
    clienteDireccion?: string
    items: { descripcion: string; cantidad: number; precioUnitario: number; total: number; subCliente?: string }[]
    totalUSD: number
}

export interface OpcionesDocumento {
    bloques: BloquesDocumento
    empresa: DatosEmpresa
    firmante: DatosFirmante
    notas: string[]
    cuentas: CuentaBilletera[]
    tamano: TamanoHoja
    /** Tasa para mostrar el total en bolívares. Cero: no se muestra. */
    tasa: number
    tasaEtiqueta: string
    aplicarIva: boolean
    ivaPct: number
    logoBase64?: string
    firmaBase64?: string
    selloBase64?: string
}

const dinero = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const bolivares = (n: number) =>
    n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fechaLegible = (iso: string) => {
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Los estilos del documento.
 *
 * Van en una cadena y no en clases de Tailwind porque este mismo HTML se
 * inyecta en el iframe que se imprime, donde no hay hoja de estilos de la
 * aplicación. Todo lo que necesita para verse tiene que viajar con él.
 */
export const estilosDocumento = (tamano: TamanoHoja) => {
    const hoja = tamano === 'carta'
        ? 'size: letter;'
        : tamano === 'oficio'
            ? 'size: 216mm 356mm;'
            // Hoja tan larga como el contenido: sin cortes ni paginado.
            : 'size: 216mm 2000mm;'

    return `
@page { ${hoja} margin: 14mm 12mm; }
* { box-sizing: border-box; }
.doc {
  font-family: "Helvetica Neue", Arial, sans-serif;
  color: #14171a;
  background: #fff;
  font-size: 11px;
  line-height: 1.45;
  padding: 14mm 12mm;
  width: 216mm;
  margin: 0 auto;
}
.doc-cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
.doc-logo { max-height: 64px; max-width: 200px; object-fit: contain; }
.doc-titulo { text-align: right; }
.doc-titulo h1 { margin: 0; font-size: 20px; letter-spacing: -0.02em; text-transform: uppercase; }
.doc-titulo p { margin: 2px 0 0; font-size: 10px; color: #6d7880; }
.doc-cliente { border: 1px solid #d8dde1; border-radius: 4px; padding: 10px 12px; margin-bottom: 14px; }
.doc-cliente dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
.doc-cliente dt { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #6d7880; font-weight: 700; }
.doc-cliente dd { margin: 0; font-weight: 700; }
table.doc-items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
table.doc-items th {
  background: #eef1f3; text-align: left; padding: 7px 9px; font-size: 9px;
  text-transform: uppercase; letter-spacing: .07em; border: 1px solid #c9d0d6;
}
table.doc-items td { padding: 7px 9px; border: 1px solid #d8dde1; vertical-align: top; white-space: pre-wrap; }
table.doc-items td.num, table.doc-items th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
tr.doc-sub td { background: #f7f9fa; font-weight: 700; }
tr.doc-total td { background: #eef1f3; font-weight: 700; font-size: 13px; }
.doc-refbs { text-align: right; font-size: 10px; color: #6d7880; margin: -6px 0 14px; }
.doc-pago { border: 1px solid #d8dde1; border-radius: 4px; padding: 10px 12px; margin-bottom: 14px; }
.doc-pago h2 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
.doc-pago .cuenta { margin-bottom: 8px; }
.doc-pago .cuenta:last-child { margin-bottom: 0; }
.doc-pago table { border-collapse: collapse; }
.doc-pago td { padding: 1px 8px 1px 0; font-size: 10px; }
.doc-pago td.et { font-weight: 700; white-space: nowrap; }
.doc-notas { margin-bottom: 16px; padding-left: 16px; }
.doc-notas li { font-size: 10px; margin-bottom: 2px; }
.doc-despedida { text-align: center; font-style: italic; font-size: 10px; margin: 22px 0; }
.doc-firma { display: flex; justify-content: center; align-items: flex-end; gap: 24px; margin-top: 8px; }
.doc-firma .rubrica { text-align: center; width: 200px; }
.doc-firma .rubrica img { max-height: 44px; display: block; margin: 0 auto 2px; }
.doc-firma .linea { border-top: 1px solid #14171a; margin-top: 2px; padding-top: 4px; }
.doc-firma .rubrica strong { display: block; font-size: 11px; }
.doc-firma .rubrica span { display: block; font-size: 10px; color: #3d474f; }
.doc-firma .sello img { max-height: 120px; }
.doc-pie { text-align: right; margin-top: 20px; border-top: 1px solid #e2e6ea; padding-top: 6px; }
.doc-pie strong { display: block; font-size: 9px; color: #6d7880; }
.doc-pie span { display: block; font-size: 8px; color: #98a1a8; line-height: 1.3; }
`
}

export function DocumentoHTML({ datos, op }: { datos: DatosDocumento; op: OpcionesDocumento }) {
    /**
     * El IVA sale de DENTRO del precio, no se suma encima.
     *
     * Los precios del taller ya son lo que se cobra: si un trabajo esta en
     * $115, el papel tiene que seguir diciendo $115 y desglosar cuanto de eso
     * es impuesto. Sumando 16% encima saldrian $133,40 y el cliente recibiria
     * un documento que no cuadra con lo que le dijeron.
     *
     *     base = total / (1 + alicuota)     impuesto = total - base
     *
     * En ese orden, y no calculando el impuesto por su lado: asi
     * base + impuesto vuelve a dar el total EXACTO. Sacando cada uno aparte,
     * el redondeo deja un centimo suelto y el desglose impreso no suma.
     */
    const total = datos.totalUSD
    const base = op.aplicarIva ? total / (1 + op.ivaPct / 100) : total
    const iva = op.aplicarIva ? total - base : 0

    // Los renglones se agrupan por sub-cliente solo si de verdad hay varios:
    // un presupuesto normal no debe salir con un encabezado de grupo.
    const grupos = datos.items.some(i => i.subCliente)
        ? Array.from(new Set(datos.items.map(i => i.subCliente || 'General')))
        : null

    const filasDe = (items: typeof datos.items) => items.map((it, i) => (
        <tr key={i}>
            <td className="num">{it.cantidad}</td>
            <td>{it.descripcion}</td>
            <td className="num">{dinero(it.precioUnitario)}</td>
            <td className="num">{dinero(it.total)}</td>
        </tr>
    ))

    return (
        <div className="doc">
            <div className="doc-cabecera">
                {op.bloques.logo && op.logoBase64
                    ? <img className="doc-logo" src={op.logoBase64} alt="" />
                    : <div />}
                <div className="doc-titulo">
                    <h1>{datos.titulo}</h1>
                    {datos.numero != null && <p>N.º {datos.numero}</p>}
                    <p>{fechaLegible(datos.fecha)}</p>
                </div>
            </div>

            <div className="doc-cliente">
                <dl>
                    <dt>Cliente</dt>
                    <dd>{datos.clienteNombre || '—'}</dd>
                    {op.bloques.datosFiscalesCliente && datos.clienteDocumento && (
                        <>
                            <dt>RIF / C.I.</dt>
                            <dd>{datos.clienteDocumento}</dd>
                        </>
                    )}
                    {op.bloques.datosFiscalesCliente && datos.clienteDireccion && (
                        <>
                            <dt>Dirección</dt>
                            <dd>{datos.clienteDireccion}</dd>
                        </>
                    )}
                </dl>
            </div>

            <table className="doc-items">
                <thead>
                    <tr>
                        <th className="num" style={{ width: '9%' }}>Cant.</th>
                        <th>Descripción</th>
                        <th className="num" style={{ width: '16%' }}>P. Unit.</th>
                        <th className="num" style={{ width: '18%' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {grupos
                        ? grupos.flatMap(g => {
                            const delGrupo = datos.items.filter(i => (i.subCliente || 'General') === g)
                            const sub = delGrupo.reduce((t, i) => t + i.total, 0)
                            return [
                                <tr className="doc-sub" key={`h-${g}`}><td colSpan={4}>{g}</td></tr>,
                                ...filasDe(delGrupo),
                                <tr className="doc-sub" key={`s-${g}`}>
                                    <td colSpan={3} style={{ textAlign: 'right' }}>Subtotal {g}</td>
                                    <td className="num">{dinero(sub)}</td>
                                </tr>,
                            ]
                        })
                        : filasDe(datos.items)}

                    {op.aplicarIva && (
                        <>
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'right' }}>Base imponible</td>
                                <td className="num">{dinero(base)}</td>
                            </tr>
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'right' }}>IVA {op.ivaPct}%</td>
                                <td className="num">{dinero(iva)}</td>
                            </tr>
                        </>
                    )}

                    <tr className="doc-total">
                        <td colSpan={3} style={{ textAlign: 'right' }}>Total USD</td>
                        <td className="num">${dinero(total)}</td>
                    </tr>
                </tbody>
            </table>

            {op.bloques.totalEnBs && op.tasa > 1 && (
                <p className="doc-refbs">
                    Referencia: Bs. {bolivares(total * op.tasa)}
                    {op.bloques.tasaBcv && op.tasaEtiqueta ? ` · ${op.tasaEtiqueta} ${bolivares(op.tasa)}` : ''}
                </p>
            )}

            {op.bloques.datosPago && op.cuentas.length > 0 && (
                <div className="doc-pago">
                    <h2>Datos para pagos / transferencias</h2>
                    {op.cuentas.map(c => {
                        const banco = bancoPorCodigo(c.bancoCodigo)
                        const esPagoMovil = c.modo === 'pago_movil'
                        return (
                            <div className="cuenta" key={c.id}>
                                <table>
                                    <tbody>
                                        {banco && <tr><td className="et">Banco:</td><td>{banco.nombre}</td></tr>}
                                        {c.titular && <tr><td className="et">Titular:</td><td>{c.titular}</td></tr>}
                                        {c.documento && <tr><td className="et">RIF / C.I.:</td><td>{c.documento}</td></tr>}
                                        {esPagoMovil
                                            ? (c.telefono && <tr><td className="et">Pago Móvil:</td><td>{c.telefono}</td></tr>)
                                            : (
                                                <>
                                                    {c.numeroCuenta && <tr><td className="et">Cuenta:</td><td>{c.numeroCuenta}</td></tr>}
                                                    {c.tipoCuenta && <tr><td className="et">Tipo:</td><td>{c.tipoCuenta}</td></tr>}
                                                </>
                                            )}
                                        {c.correo && <tr><td className="et">Correo:</td><td>{c.correo}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })}
                </div>
            )}

            {op.bloques.notasLegales && op.notas.length > 0 && (
                <ul className="doc-notas">
                    {op.notas.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
            )}

            {op.bloques.despedida && (
                <p className="doc-despedida">Sin más que hacer referencia, quedamos a la orden.</p>
            )}

            {(op.bloques.firma || op.bloques.sello || op.bloques.datosFirmante) && (
                <div className="doc-firma">
                    <div className="rubrica">
                        {op.bloques.firma && op.firmaBase64 && <img src={op.firmaBase64} alt="" />}
                        <div className="linea">
                            {op.bloques.datosFirmante && (
                                <>
                                    <strong>{op.firmante.nombre}</strong>
                                    {op.firmante.cargo && <span>{op.firmante.cargo}</span>}
                                    {op.firmante.cedula && <span>C.I. {op.firmante.cedula}</span>}
                                    {op.firmante.telefono && <span>Cel. {op.firmante.telefono}</span>}
                                </>
                            )}
                        </div>
                    </div>
                    {op.bloques.sello && op.selloBase64 && (
                        <div className="sello"><img src={op.selloBase64} alt="" /></div>
                    )}
                </div>
            )}

            {op.bloques.pieEmpresa && (
                <div className="doc-pie">
                    <strong>{op.empresa.nombre}</strong>
                    <span>RIF: {op.empresa.rif}</span>
                    <span>{op.empresa.direccion}</span>
                    {op.empresa.telefono && <span>Tel. {op.empresa.telefono}</span>}
                    {op.empresa.correo && <span>{op.empresa.correo}</span>}
                </div>
            )}
        </div>
    )
}
