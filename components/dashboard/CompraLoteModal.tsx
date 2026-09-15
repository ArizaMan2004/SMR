"use client"

// @/components/dashboard/CompraLoteModal.tsx
//
// REGISTRAR UNA COMPRA.
//
// La pregunta que se hacía de cabeza en el mostrador: llegó una caja de 100
// termos que costó $200, ¿a cómo me sale cada uno y a cómo lo vendo? Aquí se
// escribe lo que se compró y la cuenta sale sola, delante, mientras se teclea.
//
// El precio sugerido es una PROPUESTA. El margen se puede cambiar, y el precio
// final se puede escribir a mano: hay razones para cobrar distinto que ninguna
// fórmula conoce. Solo se aplica si se marca, y si no, el precio de venta se
// queda como estaba.
//
// CON UN ROLLO NO SE PREGUNTAN LOS M², SE PREGUNTA EL ROLLO
//
// Antes esta pantalla pedía "m² c/u" y había que llegar con el 68,5 ya hecho
// de cabeza —que es justo la cuenta que el sistema existe para ahorrar—. Ahora
// pregunta lo que se sabe sin pensar: uno de 137 que trae 50 metros. Los m²
// salen solos.
//
// El ancho y los metros no tocan ningún inventario: solo sirven para saber a
// cómo sale el metro y cuánto se gana vendiéndolo. Cuántos rollos quedan en el
// depósito se lleva aparte, en Materia Prima, porque un rollo no se vende.

import React, { useEffect, useMemo, useState } from "react"
import { PackagePlus, CheckCircle2, TrendingUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { abrevUnidad, unidadDe, type CatalogoProducto } from "@/lib/services/catalog-service"
import { registrarCompra, costoPorUnidad, problemaDeCompra } from "@/lib/services/compras-lote-service"
import { unidadesDeRollo, MARGEN_RECOMENDADO } from "@/lib/utils/precio-estimado"

interface Props {
    open: boolean
    onOpenChange: (v: boolean) => void
    producto: CatalogoProducto | null
    /** Tasa BCV del día, para apuntar el gasto también en bolívares. */
    tasa?: number
    usuario?: string
}

const num = (v: string) => {
    const x = parseFloat(String(v).replace(",", "."))
    return Number.isFinite(x) ? x : 0
}

/** A cinco céntimos: nadie cobra 3,3267. */
const redondear = (x: number) => Math.round(x * 20) / 20

/** Sin ceros de adorno: 100 y 68,5, no 100,00 ni 68,5000. */
const cifra = (x: number) => Number(x.toFixed(2)).toString()

export function CompraLoteModal({ open, onOpenChange, producto, tasa = 0, usuario }: Props) {
    const [varianteId, setVarianteId] = useState("")
    const [presentacion, setPresentacion] = useState("caja")
    const [paquetes, setPaquetes] = useState("1")
    const [porPaquete, setPorPaquete] = useState("")
    // Solo para rollos: de estos dos sale el "c/u" que antes había que teclear.
    const [anchoCm, setAnchoCm] = useState("")
    const [metrosRollo, setMetrosRollo] = useState("")
    const [monto, setMonto] = useState("")
    const [proveedor, setProveedor] = useState("")
    const [nota, setNota] = useState("")
    const [margen, setMargen] = useState("")
    const [precioManual, setPrecioManual] = useState("")
    const [aplicarPrecio, setAplicarPrecio] = useState(false)
    const [guardando, setGuardando] = useState(false)

    // Al abrir con otro producto se empieza limpio, pero con el margen que ya
    // tenía: quien lo puso sabía por qué.
    //
    // El ancho y los metros tampoco se borran: el vinil se compra siempre del
    // mismo ancho y los rollos suelen venir iguales, así que lo que se puso la
    // última vez es casi siempre lo de esta. Se puede pisar, y el precio no se
    // toca hasta que hay un monto escrito.
    useEffect(() => {
        if (!open || !producto) return
        const u = unidadDe(producto)
        setVarianteId(producto.tieneVariantes ? (producto.variantes?.[0]?.id || "") : "")
        setPresentacion(u === "metro_cuadrado" || u === "metro_lineal" ? "rollo" : "caja")
        setPaquetes("1")
        setPorPaquete("")
        setAnchoCm(String(producto.anchoBaseCm || producto.costo?.anchoCm || ""))
        setMetrosRollo(String(producto.costo?.metrosRollo || ""))
        setMonto("")
        setProveedor("")
        setNota("")
        // Sin margen guardado arranca en el recomendado, el mismo del "¿Precio
        // estimado?". Vacío, el sugerido salía igual al costo y eso se lee como
        // "véndelo a como te salió", que no lo propone nadie.
        setMargen(producto.costo?.margenPct != null ? String(producto.costo.margenPct) : String(MARGEN_RECOMENDADO))
        setPrecioManual("")
        setAplicarPrecio(false)
    }, [open, producto])

    const unidad = producto ? unidadDe(producto) : "unidad"
    const abrev = abrevUnidad(unidad)
    /** Se compra en rollo: no se pregunta el "c/u", se pregunta el rollo. */
    const esRollo = unidad === "metro_cuadrado" || unidad === "metro_lineal"
    /** Se cobra el largo y el ancho no divide: del rollo se gasta entero. */
    const porMetroLineal = unidad === "metro_lineal"
    const precioActual = producto?.precioBase || 0

    const cuenta = useMemo(() => {
        // Lo que trae cada paquete. Con rollos no se teclea: es el ancho por el
        // largo, la misma cuenta que hace el "¿Precio estimado?" del resto de
        // la aplicación, para que los dos sitios nunca den números distintos.
        const trae = esRollo
            ? unidadesDeRollo(num(anchoCm), num(metrosRollo), porMetroLineal)
            : num(porPaquete)

        const unidades = Math.round(num(paquetes) * trae * 10000) / 10000
        const unitario = costoPorUnidad(num(monto), unidades)
        const sugerido = unitario > 0 ? redondear(unitario * (1 + num(margen) / 100)) : 0
        const final = num(precioManual) > 0 ? num(precioManual) : sugerido
        const ganancia = final > 0 && unitario > 0 ? final - unitario : 0

        return {
            trae, unidades, unitario, sugerido, final, ganancia,
            margenReal: unitario > 0 && final > 0 ? ((final / unitario) - 1) * 100 : 0,
            // Lo que se gana HOY, con el precio que ya está puesto en la ficha.
            // Es la pregunta que de verdad se hace al ver subir un costo: ¿esto
            // que vengo cobrando sigue dejando algo?
            gananciaActual: precioActual > 0 && unitario > 0 ? precioActual - unitario : 0,
            margenActualPct: precioActual > 0 && unitario > 0 ? ((precioActual / unitario) - 1) * 100 : 0,
        }
    }, [esRollo, porMetroLineal, anchoCm, metrosRollo, paquetes, porPaquete, monto, margen, precioManual, precioActual])

    // El precio solo se puede aplicar a productos sin variantes: con variantes
    // cada una tiene el suyo, y cambiar el de la base no diría cuál.
    const puedeAplicar = !!producto && !producto.tieneVariantes && cuenta.final > 0

    const guardar = async () => {
        if (!producto) return
        const datos = {
            producto,
            varianteId: varianteId || null,
            presentacion: presentacion.trim(),
            paquetes: num(paquetes),
            unidadesPorPaquete: cuenta.trae,
            ...(esRollo ? { anchoCm: num(anchoCm), metrosRollo: num(metrosRollo) } : {}),
            montoUSD: num(monto),
            tasa,
            proveedor: proveedor.trim(),
            nota: nota.trim(),
            ...(margen !== "" ? { margenPct: num(margen) } : {}),
            ...(aplicarPrecio && puedeAplicar ? { nuevoPrecioBase: cuenta.final } : {}),
            creadoPor: usuario,
            categoriaGasto: (esRollo ? "materiales" : "insumos") as "insumos" | "materiales",
        }
        const problema = problemaDeCompra(datos)
        if (problema) { toast.error(problema); return }

        setGuardando(true)
        try {
            const r = await registrarCompra(datos)
            toast.success(
                `Compra registrada: ${cifra(cuenta.unidades)} ${abrev} a $${r.costoUnitarioUSD.toFixed(2)} c/u`
            )
            onOpenChange(false)
        } catch (e: any) {
            toast.error(`No se registró nada: ${e?.message || e}`)
        } finally {
            setGuardando(false)
        }
    }

    const campo = "h-11 rounded-xl border-none bg-slate-50 dark:bg-white/5 font-black"
    const etiqueta = "text-[9px] font-black uppercase text-slate-400 tracking-widest"

    return (
        <Dialog open={open} onOpenChange={v => !guardando && onOpenChange(v)}>
            <DialogContent className="sm:max-w-lg rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                        <PackagePlus className="w-6 h-6 text-blue-600" /> Registrar compra
                    </DialogTitle>
                    {producto && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{producto.nombre}</p>
                    )}
                </DialogHeader>

                {producto && (
                    <div className="space-y-5">
                        {producto.tieneVariantes && (
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Cuál</Label>
                                <select
                                    value={varianteId}
                                    onChange={e => setVarianteId(e.target.value)}
                                    className={cn(campo, "w-full px-3 text-sm")}
                                >
                                    {producto.variantes.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Cómo vino y cuánto traía. La caja es como se compra; la
                            unidad, como se cuenta y se vende. */}
                        <div className={cn("grid gap-3", esRollo ? "grid-cols-2" : "grid-cols-3")}>
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Llegaron</Label>
                                <Input type="number" min="1" value={paquetes} onChange={e => setPaquetes(e.target.value)} className={cn(campo, "text-center")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>De tipo</Label>
                                <Input value={presentacion} onChange={e => setPresentacion(e.target.value)} placeholder={esRollo ? "rollo" : "caja"} className={campo} />
                            </div>
                            {!esRollo && (
                                <div className="space-y-1.5">
                                    <Label className={etiqueta}>{abrev} c/u</Label>
                                    <Input type="number" min="0" value={porPaquete} onChange={e => setPorPaquete(e.target.value)} placeholder="100" className={cn(campo, "text-center")} />
                                </div>
                            )}
                        </div>

                        {/* CÓMO ES EL ROLLO.
                            No se pregunta cuántos m² trae, que es la cuenta: se
                            pregunta lo que se sabe sin pensarlo, uno de 137 que
                            trae 50 metros. Y se dice claro que esto no es el
                            inventario, para que nadie salga a medir rollos. */}
                        {esRollo && (
                            <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 space-y-3">
                                <div>
                                    <p className={etiqueta}>Cómo es el rollo</p>
                                    <p className="text-[9px] font-bold text-slate-400 leading-snug mt-0.5">
                                        Es solo para sacar el precio. Cuántos rollos te quedan en el depósito
                                        se lleva aparte, en Materia Prima.
                                    </p>
                                </div>

                                <div className={cn("grid gap-3", porMetroLineal ? "grid-cols-1" : "grid-cols-2")}>
                                    {!porMetroLineal && (
                                        <div className="space-y-1.5">
                                            <Label className={etiqueta}>Ancho (cm)</Label>
                                            <Input type="number" min="0" step="0.1" value={anchoCm} onChange={e => setAnchoCm(e.target.value)} placeholder="137" className={cn(campo, "text-center")} />
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <Label className={etiqueta}>Metros que trae</Label>
                                        <Input type="number" min="0" step="0.1" value={metrosRollo} onChange={e => setMetrosRollo(e.target.value)} placeholder="50" className={cn(campo, "text-center")} />
                                    </div>
                                </div>

                                {cuenta.trae > 0 ? (
                                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-300">
                                        Cada rollo trae {cuenta.trae.toFixed(2)} {abrev}
                                        {num(paquetes) > 1 && ` · los ${num(paquetes)} juntos, ${cuenta.unidades.toFixed(2)} ${abrev}`}
                                    </p>
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-400">
                                        {porMetroLineal
                                            ? "Con los metros del rollo sale a cómo te queda el metro."
                                            : "Con el ancho y los metros sale a cómo te queda el m²."}
                                    </p>
                                )}

                                {porMetroLineal && (
                                    <p className="text-[9px] font-bold text-slate-400 leading-snug">
                                        Se cobra el largo, así que el ancho no divide: del rollo se va entero
                                        aunque la pieza sea estrecha.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Costó en total (USD)</Label>
                                <Input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="200" className={cn(campo, "text-emerald-600")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Proveedor</Label>
                                <Input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Opcional" className={campo} />
                            </div>
                        </div>

                        {/* LA CUENTA, EN VIVO. */}
                        {cuenta.unidades > 0 && cuenta.unitario > 0 && (
                            <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-4 space-y-3">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                        {cifra(cuenta.unidades)} {abrev} · cada {abrev === "und" ? "una" : "uno"} sale a
                                    </span>
                                    <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                                        ${cuenta.unitario.toFixed(cuenta.unitario < 1 ? 4 : 2)}
                                    </span>
                                </div>

                                {/* LO QUE SE GANA HOY, CON EL PRECIO QUE YA ESTÁ.
                                    Es lo primero que se quiere saber cuando entra
                                    una compra: ¿lo que vengo cobrando sigue
                                    dejando algo? Va antes que ningún sugerido. */}
                                {precioActual > 0 ? (
                                    <div className="flex items-baseline justify-between gap-2 border-t border-blue-200/70 dark:border-white/10 pt-2.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            Lo vendes a ${precioActual.toFixed(2)} · {cuenta.gananciaActual >= 0 ? "ganas" : "pierdes"}
                                        </span>
                                        <span className={cn(
                                            "text-sm font-black tabular-nums shrink-0",
                                            cuenta.gananciaActual >= 0 ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            ${Math.abs(cuenta.gananciaActual).toFixed(2)}
                                            <span className="text-[10px] font-bold opacity-70"> /{abrev} · {cuenta.margenActualPct.toFixed(0)} %</span>
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-500 border-t border-blue-200/70 dark:border-white/10 pt-2.5 leading-snug">
                                        Todavía no tiene precio de venta. Pon el margen que quieras ganarle y
                                        abajo sale a cómo tendrías que cobrarlo.
                                    </p>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className={etiqueta}>Margen %</Label>
                                        <Input type="number" value={margen} onChange={e => setMargen(e.target.value)} placeholder="50" className="h-10 rounded-xl border-none bg-white dark:bg-black/20 font-black" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className={etiqueta}>Sugerido</Label>
                                        <div className="h-10 rounded-xl bg-white dark:bg-black/20 flex items-center px-3 font-black tabular-nums text-emerald-600">
                                            {cuenta.sugerido > 0 ? `$${cuenta.sugerido.toFixed(2)}` : "—"}
                                        </div>
                                    </div>
                                </div>

                                {/* El precio lo decide una persona. */}
                                <div className="space-y-1">
                                    <Label className={etiqueta}>O el precio que tú quieras (USD)</Label>
                                    <Input type="number" step="0.05" value={precioManual} onChange={e => setPrecioManual(e.target.value)} placeholder={cuenta.sugerido > 0 ? cuenta.sugerido.toFixed(2) : ""} className="h-10 rounded-xl border-none bg-white dark:bg-black/20 font-black" />
                                </div>

                                {cuenta.final > 0 && (
                                    <p className={cn(
                                        "text-[10px] font-black flex items-center gap-1",
                                        cuenta.ganancia >= 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        <TrendingUp className="w-3 h-3" />
                                        {cuenta.ganancia >= 0
                                            ? `Ganas $${cuenta.ganancia.toFixed(2)} por ${abrev} · ${cuenta.margenReal.toFixed(0)}% sobre el costo`
                                            : `Pierdes $${Math.abs(cuenta.ganancia).toFixed(2)} por ${abrev}: el precio está por debajo del costo`}
                                    </p>
                                )}

                                {puedeAplicar ? (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={aplicarPrecio} onChange={e => setAplicarPrecio(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            Cambiar el precio de venta a ${cuenta.final.toFixed(2)}
                                            {producto.precioBase > 0 && <span className="text-slate-400 font-bold normal-case"> (ahora ${producto.precioBase.toFixed(2)})</span>}
                                        </span>
                                    </label>
                                ) : producto.tieneVariantes && (
                                    <p className="text-[9px] font-bold text-slate-400">
                                        Tiene variantes: el precio de cada una se cambia en su ficha.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className={etiqueta}>Nota</Label>
                            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Factura, lote, lo que sirva para encontrarla" className={campo} />
                        </div>

                        <p className="text-[9px] font-bold text-slate-400 leading-snug">
                            {esRollo
                                ? <>Al registrar: esta ficha se queda con lo que cuesta el {abrev}, el lote guardado y el
                                    gasto en Insumos. Los rollos se cuentan aparte, en Materia Prima; si esta misma
                                    compra ya la apuntaste allí, no la apuntes aquí o el gasto quedará dos veces.</>
                                : <>Al registrar: sube el stock en {abrev}, queda guardado este lote con su costo,
                                    y el gasto aparece en Insumos. Todo junto o nada.</>}
                        </p>

                        <Button onClick={guardar} disabled={guardando} className="w-full h-14 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest">
                            {guardando
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <><CheckCircle2 className="w-4 h-4 mr-2" /> Registrar compra</>}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
