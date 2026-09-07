// @/components/orden/SelectorCatalogo.tsx
//
// Elegir del catálogo mientras se factura.
//
// Antes había que saberse el nombre y escribirlo: el picker era una caja de
// búsqueda que no enseñaba nada hasta que acertabas las primeras letras. Con
// tres llaveros parecidos y cola en el mostrador, eso se resuelve mirando, no
// recordando.
//
// Aquí se ve todo de un vistazo, separado en tres pestañas porque son tres
// cosas distintas: lo que sale de un rollo, lo que es mano de obra y lo que se
// cuenta en el estante. Con buscador y filtro por categoría para cuando el
// catálogo crezca.

"use client"

import React, { useMemo, useState } from 'react'
import { Search, Package, Layers, Wrench, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

import {
    tipoEntradaDe, unidadDe, abrevUnidad, categoriasRaiz, subcategoriasDe,
    type CatalogoProducto, type CatalogoCategoria, type TipoEntrada,
} from '@/lib/services/catalog-service'

interface Props {
    productos: CatalogoProducto[]
    categorias: CatalogoCategoria[]
    /** Id del producto elegido ahora mismo, para marcarlo. */
    seleccionadoId?: string | null
    onElegir: (producto: CatalogoProducto) => void
    /** Precios en euros para los aliados, como en el resto del sistema. */
    esAliado?: boolean
    /** Arranca en esta pestaña. */
    pestanaInicial?: TipoEntrada
    /** Deja fuera pestañas que no aplican en el sitio donde se monta. */
    soloTipos?: TipoEntrada[]
}

const PESTANAS: { tipo: TipoEntrada; texto: string; icono: React.ElementType; vacio: string }[] = [
    { tipo: 'material', texto: 'Materiales', icono: Layers,  vacio: 'No hay materiales dados de alta' },
    { tipo: 'servicio', texto: 'Servicios',  icono: Wrench,  vacio: 'No hay servicios dados de alta' },
    { tipo: 'producto', texto: 'Productos',  icono: Package, vacio: 'No hay productos en stock' },
]

/** Quita tildes y mayúsculas: "señalética" tiene que salir buscando "senaletica". */
const clave = (t: string) =>
    (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function SelectorCatalogo({
    productos, categorias, seleccionadoId, onElegir,
    esAliado, pestanaInicial = 'material', soloTipos,
}: Props) {
    const [pestana, setPestana] = useState<TipoEntrada>(pestanaInicial)
    const [busqueda, setBusqueda] = useState('')
    const [categoriaId, setCategoriaId] = useState<string | null>(null)

    const activos = useMemo(
        () => productos.filter(p => p.activo !== false),
        [productos]
    )

    const pestanasVisibles = useMemo(
        () => PESTANAS.filter(p => !soloTipos || soloTipos.includes(p.tipo)),
        [soloTipos]
    )

    /** Cuántos hay en cada pestaña, para no entrar a una vacía. */
    const conteos = useMemo(() => {
        const c: Record<string, number> = {}
        activos.forEach(p => { const t = tipoEntradaDe(p); c[t] = (c[t] || 0) + 1 })
        return c
    }, [activos])

    const delTipo = useMemo(
        () => activos.filter(p => tipoEntradaDe(p) === pestana),
        [activos, pestana]
    )

    /**
     * Las categorías que se ofrecen son solo las que tienen algo en esta
     * pestaña: un filtro que no filtra nada estorba más que ayuda.
     */
    const categoriasConItems = useMemo(() => {
        const usadas = new Set(delTipo.map(p => p.categoriaId))
        return categoriasRaiz(categorias)
            .flatMap(raiz => [raiz, ...subcategoriasDe(categorias, raiz.id)])
            .filter(c => usadas.has(c.id!))
    }, [delTipo, categorias])

    const resultado = useMemo(() => {
        const q = clave(busqueda.trim())
        return delTipo
            .filter(p => !categoriaId || p.categoriaId === categoriaId)
            .filter(p => !q || clave(p.nombre).includes(q) ||
                (p.variantes || []).some(v => clave(v.nombre).includes(q)) ||
                (p.acabados || []).some(a => clave(a.nombre).includes(q)))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }, [delTipo, categoriaId, busqueda])

    const precioDe = (p: CatalogoProducto) => {
        const aliado = esAliado && (p.precioPublicista ?? 0) > 0
        return { simbolo: aliado ? '€' : '$', monto: aliado ? p.precioPublicista! : p.precioBase }
    }

    const vacio = pestanasVisibles.find(p => p.tipo === pestana)?.vacio || 'Nada por aquí'

    return (
        <div className="space-y-3">
            {/* Pestañas */}
            {pestanasVisibles.length > 1 && (
                <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                    {pestanasVisibles.map(p => {
                        const Icono = p.icono
                        const activa = pestana === p.tipo
                        return (
                            <button
                                key={p.tipo}
                                type="button"
                                onClick={() => { setPestana(p.tipo); setCategoriaId(null) }}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all',
                                    activa
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                )}
                            >
                                <Icono className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{p.texto}</span>
                                {conteos[p.tipo] > 0 && (
                                    <span className={cn('tabular-nums', activa ? 'opacity-50' : 'opacity-40')}>
                                        {conteos[p.tipo]}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, acabado o servicio…"
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-800 border-none text-xs font-bold outline-none shadow-sm"
                />
            </div>

            {/* Filtro por categoría */}
            {categoriasConItems.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                    <button
                        type="button"
                        onClick={() => setCategoriaId(null)}
                        className={cn(
                            'shrink-0 px-3 h-7 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                            !categoriaId ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'bg-white dark:bg-slate-800 text-slate-400'
                        )}
                    >
                        Todas
                    </button>
                    {categoriasConItems.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id!)}
                            className={cn(
                                'shrink-0 px-3 h-7 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all',
                                categoriaId === c.id ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'bg-white dark:bg-slate-800 text-slate-400'
                            )}
                        >
                            {c.padreId && <span className="opacity-40 mr-1">└</span>}
                            {c.nombre}
                        </button>
                    ))}
                </div>
            )}

            {/* Resultados */}
            {resultado.length === 0 ? (
                <p className="text-[10px] font-bold text-slate-400 text-center py-6">
                    {busqueda.trim() ? 'Nada coincide con la búsqueda' : vacio}
                </p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                    {resultado.map(p => {
                        const elegido = seleccionadoId === p.id
                        const { simbolo, monto } = precioDe(p)
                        const u = unidadDe(p)
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onElegir(p)}
                                className={cn(
                                    'text-left rounded-2xl border-2 transition-all overflow-hidden',
                                    elegido
                                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'border-transparent bg-white dark:bg-slate-800 hover:border-blue-300'
                                )}
                            >
                                {/* La foto es opcional; sin ella la tarjeta no se descuadra. */}
                                <div className={cn(
                                    'h-16 flex items-center justify-center overflow-hidden',
                                    elegido ? 'bg-blue-500/40' : 'bg-slate-100 dark:bg-slate-900'
                                )}>
                                    {p.fotoUrl
                                        ? <img src={p.fotoUrl} alt="" className="w-full h-full object-cover" />
                                        : <ImageOff className={cn('w-5 h-5', elegido ? 'text-white/40' : 'text-slate-300 dark:text-slate-700')} />}
                                </div>

                                <div className="p-2.5">
                                    <p className={cn('text-[10px] font-black uppercase leading-tight line-clamp-2', elegido ? 'text-white' : 'dark:text-white')}>
                                        {p.nombre}
                                    </p>
                                    <p className={cn('text-[9px] font-bold mt-0.5 tabular-nums', elegido ? 'text-blue-100' : 'text-slate-400')}>
                                        {simbolo}{monto}/{abrevUnidad(u)}
                                    </p>
                                    {(p.acabados || []).length > 0 && (
                                        <p className={cn('text-[8px] font-bold mt-0.5 truncate', elegido ? 'text-blue-100/70' : 'text-slate-300 dark:text-slate-600')}>
                                            {(p.acabados || []).map(a => a.nombre).join(' · ')}
                                        </p>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
