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

export function CompraLoteModal({ open, onOpenChange, producto, tasa = 0, usuario }: Props) {
    const [varianteId, setVarianteId] = useState("")
    const [presentacion, setPresentacion] = useState("caja")
    const [paquetes, setPaquetes] = useState("1")
    const [porPaquete, setPorPaquete] = useState("")
    const [monto, setMonto] = useState("")
    const [proveedor, setProveedor] = useState("")
    const [nota, setNota] = useState("")
    const [margen, setMargen] = useState("")
    const [precioManual, setPrecioManual] = useState("")
    const [aplicarPrecio, setAplicarPrecio] = useState(false)
    const [guardando, setGuardando] = useState(false)

    // Al abrir con otro producto se empieza limpio, pero con el margen que ya
    // tenía: quien lo puso sabía por qué.
    useEffect(() => {
        if (!open || !producto) return
        setVarianteId(producto.tieneVariantes ? (producto.variantes?.[0]?.id || "") : "")
        setPresentacion(unidadDe(producto) === "metro_cuadrado" ? "rollo" : "caja")
        setPaquetes("1")
        setPorPaquete("")
        setMonto("")
        setProveedor("")
        setNota("")
        setMargen(producto.costo?.margenPct != null ? String(producto.costo.margenPct) : "")
        setPrecioManual("")
        setAplicarPrecio(false)
    }, [open, producto])

    const unidad = producto ? unidadDe(producto) : "unidad"
    const abrev = abrevUnidad(unidad)
    const esRollo = unidad === "metro_cuadrado"

    const cuenta = useMemo(() => {
        const unidades = num(paquetes) * num(porPaquete)
        const unitario = costoPorUnidad(num(monto), unidades)
        const sugerido = unitario > 0 ? redondear(unitario * (1 + num(margen) / 100)) : 0
        const final = num(precioManual) > 0 ? num(precioManual) : sugerido
        const ganancia = final > 0 && unitario > 0 ? final - unitario : 0
        return {
            unidades, unitario, sugerido, final, ganancia,
            margenReal: unitario > 0 && final > 0 ? ((final / unitario) - 1) * 100 : 0,
        }
    }, [paquetes, porPaquete, monto, margen, precioManual])

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
            unidadesPorPaquete: num(porPaquete),
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
                `Compra registrada: ${cuenta.unidades} ${abrev} a $${r.costoUnitarioUSD.toFixed(2)} c/u`
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
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>Llegaron</Label>
                                <Input type="number" min="1" value={paquetes} onChange={e => setPaquetes(e.target.value)} className={cn(campo, "text-center")} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>De tipo</Label>
                                <Input value={presentacion} onChange={e => setPresentacion(e.target.value)} placeholder="caja" className={campo} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={etiqueta}>{esRollo ? "m² c/u" : `${abrev} c/u`}</Label>
                                <Input type="number" min="0" value={porPaquete} onChange={e => setPorPaquete(e.target.value)} placeholder={esRollo ? "68.5" : "100"} className={cn(campo, "text-center")} />
                            </div>
                        </div>

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
                                        {cuenta.unidades} {abrev} · cada una sale a
                                    </span>
                                    <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                                        ${cuenta.unitario.toFixed(cuenta.unitario < 1 ? 4 : 2)}
                                    </span>
                                </div>

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
                            Al registrar: sube el stock{esRollo ? " de rollos" : ""}, queda guardado este lote con su costo,
                            y el gasto aparece en Insumos. Todo junto o nada.
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
