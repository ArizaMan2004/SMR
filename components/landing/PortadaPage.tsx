// @/components/landing/PortadaPage.tsx
//
// LA PORTADA.
//
// Lo que ve quien abre el sistema sin haber entrado. Antes se caía
// directamente en el formulario de acceso, que no dice nada de lo que hay
// dentro: quien llega por primera vez —un empleado nuevo, alguien a quien se
// le enseña el sistema— veía una caja de contraseña y punto.
//
// No vende nada. Cuenta lo que el sistema hace, módulo por módulo, con lo que
// de verdad está construido, y lo enseña con capturas REALES de esta misma
// instalación. Si algo deja de existir, se quita de la lista.
//
// SOBRE LAS CAPTURAS
//
// Salen del sistema funcionando, no de un diseño. Lo único que se cambió antes
// de tomarlas fueron los nombres de los clientes y sus documentos, que se
// sustituyeron por otros inventados: esta página la ve cualquiera que abra la
// dirección, y quién le debe cuánto a la empresa no es cosa suya.
//
// El nombre de la empresa sale del entorno, así que una copia montada para
// otro taller lleva el suyo sin tocar esto.

"use client"

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowRight, Check, ChevronDown, Menu, X, Sparkles,
    Monitor, Smartphone, LogIn, Quote,
} from 'lucide-react'

import { MARCA, MARCA_DESCRIPCION, MARCA_LOGO } from '@/lib/marca'
import { MODULOS, VENTAJAS, TAMBIEN, PREGUNTAS, DOLORES } from '@/components/landing/landing-data'

const NAV = [
    { href: '#modulos', label: 'Qué hace' },
    { href: '#decisiones', label: 'Cómo está hecho' },
    { href: '#tambien', label: 'Y además' },
    { href: '#preguntas', label: 'Preguntas' },
]

/**
 * Aparecer al llegar.
 *
 * `whileInView` con `once`, no un desplazamiento continuo: una animación que
 * se rehace cada vez que el bloque vuelve a pasar marea, y en un teléfono
 * cuesta fotogramas todo el rato.
 */
const aparecer = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
}

const enVista = {
    initial: 'hidden' as const,
    whileInView: 'visible' as const,
    viewport: { once: true, amount: 0.2 },
    variants: aparecer,
}

/**
 * El logo de la empresa.
 *
 * Si el entorno no trae ninguno, la inicial dentro de un cuadrado. No es lo
 * mismo, pero es mejor que un hueco: una copia recién montada tiene que
 * verse terminada antes de que alguien le ponga su archivo.
 */
function Logo({ className = 'h-8' }: { className?: string }) {
    if (!MARCA_LOGO) {
        return (
            <span className="fondo-degradado grid size-8 shrink-0 place-items-center rounded-lg text-sm font-black text-white">
                {MARCA.charAt(0)}
            </span>
        )
    }
    return (
        <Image
            src={MARCA_LOGO}
            alt={MARCA}
            width={3543}
            height={1588}
            priority
            className={`${className} w-auto shrink-0 object-contain`}
        />
    )
}

/** Todos los botones llevan al mismo sitio: a entrar. */
function BotonEntrar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <Link
            href="/acceso"
            className={`fondo-degradado brillo-marca group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition hover:opacity-95 ${className}`}
        >
            {children}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
    )
}

/**
 * Una captura dentro de una ventana.
 *
 * La barra de arriba con los tres puntos no es adorno: sitúa lo de dentro como
 * una pantalla del sistema y no como una ilustración. `priority` solo en la
 * del encabezado, que es la única que se ve sin bajar.
 */
function Ventana({
    src, alt, alto, priority = false, recortar = false,
}: {
    src: string; alt: string; alto?: string; priority?: boolean; recortar?: boolean
}) {
    return (
        <div className="ventana overflow-hidden rounded-xl sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2.5 sm:px-4">
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="ml-2 truncate rounded-md bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium tracking-wide text-slate-500 sm:text-[11px]">
                    {MARCA}
                </span>
            </div>

            <div className={`relative overflow-hidden bg-[#04070f] ${alto ?? ''} ${recortar ? 'recorte-suave' : ''}`}>
                <Image
                    src={src}
                    alt={alt}
                    width={1700}
                    height={1063}
                    priority={priority}
                    sizes="(max-width: 1024px) 100vw, 1100px"
                    className="w-full"
                />
            </div>
        </div>
    )
}

export default function PortadaPage() {
    const [menuAbierto, setMenuAbierto] = useState(false)
    /** El modulo abierto. Cadena vacia: todos cerrados. */
    const [moduloActivo, setModuloActivo] = useState<string>(MODULOS[0]!.id)
    const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(0)


    return (
        <div className="portada relative min-h-screen overflow-x-hidden">
            {/* La cuadrícula y las manchas de color, en una sola capa fija
                que mide lo que la ventana. Los detalles, en globals.css. */}
            <div aria-hidden className="fondo-portada" />

            {/* El resplandor del encabezado va aparte porque este SÍ se va
                con el scroll: es el brillo de esta sección, no del fondo. */}
            <div
                aria-hidden
                className="pointer-events-none absolute top-[-20%] left-1/2 z-0 h-[700px] w-[1100px] -translate-x-1/2 opacity-60"
                style={{
                    background:
                        'radial-gradient(ellipse at center, rgba(29,78,216,0.75) 0%, rgba(8,145,178,0.28) 35%, rgba(8,145,178,0.08) 55%, transparent 72%)',
                }}
            />

            {/* ==================================================== cabecera */}
            <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-[color:var(--portada-tinta)]/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <a href="#inicio" className="flex min-w-0 items-center" aria-label={MARCA}>
                        <Logo className="h-8 sm:h-9" />
                    </a>

                    <nav className="hidden items-center gap-6 text-sm text-slate-400 lg:flex">
                        {NAV.map(n => (
                            <a key={n.href} href={n.href} className="transition hover:text-white">{n.label}</a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/acceso"
                            className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:text-white sm:inline-flex"
                        >
                            Entrar
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMenuAbierto(v => !v)}
                            className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-300 lg:hidden"
                            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
                        >
                            {menuAbierto ? <X className="size-4" /> : <Menu className="size-4" />}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {menuAbierto && (
                        <motion.nav
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-white/5 bg-[color:var(--portada-tinta)] lg:hidden"
                        >
                            <div className="flex flex-col gap-1 px-6 py-4">
                                {NAV.map(n => (
                                    <a
                                        key={n.href}
                                        href={n.href}
                                        onClick={() => setMenuAbierto(false)}
                                        className="rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                                    >
                                        {n.label}
                                    </a>
                                ))}
                                <Link
                                    href="/acceso"
                                    className="fondo-degradado mt-2 rounded-lg px-3 py-2.5 text-center text-sm font-bold text-white"
                                >
                                    Entrar al sistema
                                </Link>
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
            </header>

            {/* ==================================================== encabezado */}
            <section id="inicio" className="relative z-10 px-6 pt-32 pb-16 sm:pt-40 sm:pb-24">
                <div className="mx-auto max-w-4xl text-center">
                    <motion.span
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="borde-girando inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-300"
                    >
                        <Sparkles className="size-3.5 text-[color:var(--portada-agua)]" aria-hidden />
                        {MARCA_DESCRIPCION}
                    </motion.span>

                    <motion.h1
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.06 }}
                        className="mt-7 text-[2.6rem] font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
                    >
                        El taller entero
                        <br />
                        <span className="texto-degradado">en una sola pantalla.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.12 }}
                        className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg"
                    >
                        Se cobra la orden, el trabajo pasa a la mesa, a quien le toca le suena el
                        teléfono y al final del mes el balance dice en qué se fue el material. Sin
                        cuadernos y sin volver a escribir nada.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.18 }}
                        className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
                    >
                        <BotonEntrar className="w-full sm:w-auto">Entrar al sistema</BotonEntrar>
                        <a
                            href="#modulos"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:text-white sm:w-auto"
                        >
                            Ver qué hace
                            <ChevronDown className="size-4" aria-hidden />
                        </a>
                    </motion.div>
                </div>

                {/* La captura de verdad, debajo del titular. Es lo que convence:
                    todo lo de arriba es una promesa hasta que se ve la pantalla. */}
                <motion.div
                    initial={{ opacity: 0, y: 34 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.24 }}
                    className="mx-auto mt-16 max-w-6xl sm:mt-20"
                >
                    <Ventana
                        src="/portada/panel.webp"
                        alt="El panel del sistema: el equipo del día, lo cobrado hoy, las cuentas por cobrar y el conteo de órdenes"
                        priority
                    />
                    <p className="mt-4 text-center text-xs text-slate-600">
                        Capturas reales del sistema. Los nombres de los clientes están cambiados.
                    </p>
                </motion.div>
            </section>

            {/* ==================================================== la tira */}
            <div className="tira-modulos relative z-10 overflow-hidden border-y border-white/5 py-4">
                <div className="flex w-max gap-3">
                    {[...MODULOS, ...MODULOS].map((m, i) => (
                        <span
                            key={`${m.id}-${i}`}
                            className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-400"
                        >
                            <m.icon className="size-3.5 text-[color:var(--portada-cielo)]" aria-hidden />
                            {m.label}
                        </span>
                    ))}
                </div>
            </div>

            {/* ==================================================== ¿te suena? */}
            <section className="relative z-10 px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-6xl">
                    <motion.div {...enVista} className="max-w-2xl">
                        <span className="text-xs font-bold tracking-[0.2em] text-[color:var(--portada-agua)]">
                            DE DÓNDE SALIÓ ESTO
                        </span>
                        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                            Cada pantalla existe porque algo se perdía.
                        </h2>
                        <p className="mt-4 text-slate-400">
                            No se diseñó de una vez. Se fue construyendo encima de las preguntas que
                            se repetían en el mostrador todos los días.
                        </p>
                    </motion.div>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2">
                        {DOLORES.map((d, i) => (
                            <motion.div
                                key={d.problema}
                                {...enVista}
                                transition={{ delay: i * 0.06 }}
                                className="vidrio vidrio-vivo rounded-2xl p-6"
                            >
                                <Quote className="size-5 text-[color:var(--portada-cielo)]/60" aria-hidden />
                                <p className="mt-4 text-lg font-bold text-white">{d.problema}</p>
                                <p className="mt-3 text-sm leading-relaxed text-slate-400">{d.respuesta}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================================================== módulos */}
            <section id="modulos" className="relative z-10 scroll-mt-24 px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-6xl">
                    <motion.div {...enVista} className="max-w-2xl">
                        <span className="text-xs font-bold tracking-[0.2em] text-[color:var(--portada-agua)]">
                            QUÉ HACE
                        </span>
                        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                            Ocho módulos que se hablan entre ellos.
                        </h2>
                        <p className="mt-4 text-slate-400">
                            Lo que se registra en uno lo lee el siguiente. El material del catálogo
                            entra en la orden, la orden va al taller, el cobro va a la billetera y
                            todo termina en el balance.
                        </p>
                    </motion.div>

                    {/* UNA LISTA QUE SE ABRE, NO UNAS PESTAÑAS.

                        Las pestañas obligan a elegir antes de saber qué hay
                        detrás, y en el teléfono se convierten en una fila que
                        hay que arrastrar de lado — que casi nadie arrastra.
                        Así los ocho títulos se leen de un vistazo y se abre el
                        que interese. Uno a la vez: con dos abiertos vuelve a
                        haber que buscar dónde se quedó uno. */}
                    <div className="mt-10 space-y-3">
                        {MODULOS.map((m, i) => {
                            const abierto = m.id === moduloActivo
                            return (
                                <motion.div
                                    key={m.id}
                                    {...enVista}
                                    transition={{ delay: Math.min(i, 4) * 0.05 }}
                                    className={`vidrio overflow-hidden rounded-2xl transition-colors ${
                                        abierto ? 'border-[color:var(--portada-agua)]/25' : ''
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setModuloActivo(abierto ? '' : m.id)}
                                        aria-expanded={abierto}
                                        className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-7 sm:py-5"
                                    >
                                        <span
                                            className={`inline-grid size-10 shrink-0 place-items-center rounded-xl transition ${
                                                abierto
                                                    ? 'fondo-degradado text-white'
                                                    : 'bg-white/[0.05] text-[color:var(--portada-cielo)]'
                                            }`}
                                        >
                                            <m.icon className="size-5" aria-hidden />
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block text-base font-black tracking-tight text-white sm:text-lg">
                                                {m.label}
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs text-slate-500 sm:text-sm">
                                                {m.titular}
                                            </span>
                                        </span>

                                        <ChevronDown
                                            className={`size-4 shrink-0 text-slate-500 transition-transform ${
                                                abierto ? 'rotate-180' : ''
                                            }`}
                                            aria-hidden
                                        />
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {abierto && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.28, ease: 'easeOut' }}
                                                className="overflow-hidden"
                                            >
                                                <div className="grid items-start gap-7 border-t border-white/[0.06] px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-10">
                                                    <div>
                                                        <p className="text-sm leading-relaxed text-slate-400">
                                                            {m.detalle}
                                                        </p>

                                                        <ul className="mt-6 space-y-3.5">
                                                            {m.puntos.map(punto => (
                                                                <li key={punto} className="flex gap-3 text-sm text-slate-300">
                                                                    <Check
                                                                        className="mt-0.5 size-4 shrink-0 text-[color:var(--portada-agua)]"
                                                                        aria-hidden
                                                                    />
                                                                    <span className="leading-relaxed">{punto}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {m.imagen ? (
                                                        <Ventana
                                                            src={m.imagen}
                                                            alt={`La vista de ${m.label} dentro del sistema`}
                                                            alto="max-h-[420px]"
                                                            recortar
                                                        />
                                                    ) : (
                                                        /* Sin captura no se pone una inventada. Se
                                                           dice lo que hay y se invita a verlo. */
                                                        <div className="vidrio grid min-h-[200px] place-items-center rounded-2xl p-8 text-center">
                                                            <div>
                                                                <m.icon
                                                                    className="mx-auto size-8 text-[color:var(--portada-cielo)]/50"
                                                                    aria-hidden
                                                                />
                                                                <p className="mx-auto mt-4 max-w-xs text-sm text-slate-500">
                                                                    Esta pantalla se ve entrando al sistema.
                                                                </p>
                                                                <BotonEntrar className="mt-6">Entrar</BotonEntrar>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ==================================================== franja de paso */}
            <section className="relative z-10 px-6 py-6">
                <motion.div
                    {...enVista}
                    className="vidrio mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-3xl px-7 py-9 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left"
                >
                    <div>
                        <p className="text-xl font-black tracking-tight text-white sm:text-2xl">
                            La cuenta ya está creada.
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                            Entra con tu correo y mira tu propia pantalla, con lo que te toca a ti.
                        </p>
                    </div>
                    <BotonEntrar className="shrink-0">
                        <LogIn className="size-4" aria-hidden />
                        Entrar
                    </BotonEntrar>
                </motion.div>
            </section>

            {/* ==================================================== decisiones */}
            <section id="decisiones" className="relative z-10 scroll-mt-24 px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-6xl">
                    <motion.div {...enVista} className="max-w-2xl">
                        <span className="text-xs font-bold tracking-[0.2em] text-[color:var(--portada-agua)]">
                            CÓMO ESTÁ HECHO
                        </span>
                        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                            Cuatro decisiones que se notan a diario.
                        </h2>
                        <p className="mt-4 text-slate-400">
                            No son características: son decisiones. Las características se copian;
                            las decisiones explican por qué el sistema se comporta como se comporta.
                        </p>
                    </motion.div>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2">
                        {VENTAJAS.map((v, i) => (
                            <motion.div
                                key={v.titulo}
                                {...enVista}
                                transition={{ delay: i * 0.06 }}
                                className="vidrio vidrio-vivo rounded-2xl p-7"
                            >
                                <span className="fondo-degradado inline-grid size-10 place-items-center rounded-xl text-white">
                                    <v.icon className="size-5" aria-hidden />
                                </span>
                                <h3 className="mt-5 text-lg font-black tracking-tight text-white">{v.titulo}</h3>
                                <p className="mt-3 text-sm leading-relaxed text-slate-400">{v.texto}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================================================== dispositivos */}
            <section className="relative z-10 px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-6xl">
                    <div className="grid items-center gap-12 lg:grid-cols-2">
                        <motion.div {...enVista}>
                            <span className="text-xs font-bold tracking-[0.2em] text-[color:var(--portada-agua)]">
                                EN LA MESA Y EN EL BOLSILLO
                            </span>
                            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                                La misma pantalla, del monitor al teléfono.
                            </h2>
                            <p className="mt-5 leading-relaxed text-slate-400">
                                No hay una versión recortada para el móvil. La administración trabaja
                                desde la computadora con la tabla completa, y el taller consulta desde
                                el teléfono lo que tiene pendiente, con los mismos datos y los mismos
                                permisos.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                {[
                                    { icon: Monitor, texto: 'Computadora del mostrador' },
                                    { icon: Smartphone, texto: 'Teléfono del taller' },
                                ].map(d => (
                                    <span key={d.texto} className="vidrio flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-300">
                                        <d.icon className="size-4 text-[color:var(--portada-cielo)]" aria-hidden />
                                        {d.texto}
                                    </span>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div {...enVista} className="relative">
                            <Ventana
                                src="/portada/catalogo.webp"
                                alt="El catálogo con los productos, su precio por metro cuadrado y su stock"
                                alto="max-h-[420px]"
                                recortar
                            />

                            {/* El teléfono encima, en la esquina. Se esconde en
                                pantallas estrechas: ahí la ventana ya ocupa todo
                                el ancho y el teléfono taparía la captura en vez
                                de acompañarla. */}
                            <div className="ventana absolute -bottom-10 -right-1 hidden w-[152px] overflow-hidden rounded-[1.7rem] p-1.5 sm:block lg:-right-8 lg:w-[176px]">
                                <div className="h-[300px] overflow-hidden rounded-[1.35rem] bg-[#04070f] lg:h-[345px]">
                                    <Image
                                        src="/portada/movil.webp"
                                        alt="El mismo panel abierto en el teléfono"
                                        width={760}
                                        height={2836}
                                        sizes="176px"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ==================================================== también */}
            <section id="tambien" className="relative z-10 scroll-mt-24 px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-6xl">
                    <motion.div {...enVista} className="max-w-2xl">
                        <span className="text-xs font-bold tracking-[0.2em] text-[color:var(--portada-agua)]">
                            Y ADEMÁS
                        </span>
                        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                            Lo que también está dentro.
                        </h2>
                        <p className="mt-4 text-slate-400">
                            Herramientas que no dan para una sección propia pero que están, y se usan.
                        </p>
                    </motion.div>

                    <div className="mt-10 flex flex-wrap gap-3">
                        {TAMBIEN.map((t, i) => (
                            <motion.span
                                key={t}
                                {...enVista}
                                transition={{ delay: i * 0.04 }}
                                className="vidrio vidrio-vivo flex items-center gap-2 rounded-full px-5 py-2.5 text-sm text-slate-300"
                            >
                                <Check className="size-3.5 text-[color:var(--portada-agua)]" aria-hidden />
                                {t}
                            </motion.span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ==================================================== preguntas */}
            <section id="preguntas" className="relative z-10 scroll-mt-24 px-6 py-20 sm:py-28">
                <div className="mx-auto max-w-3xl">
                    <motion.div {...enVista} className="text-center">
                        <span className="text-xs font-bold tracking-[0.2em] text-[color:var(--portada-agua)]">
                            PREGUNTAS
                        </span>
                        <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                            Lo que se pregunta siempre.
                        </h2>
                    </motion.div>

                    <div className="mt-12 space-y-3">
                        {PREGUNTAS.map((p, i) => {
                            const abierta = preguntaAbierta === i
                            return (
                                <motion.div
                                    key={p.q}
                                    {...enVista}
                                    transition={{ delay: i * 0.05 }}
                                    className="vidrio overflow-hidden rounded-2xl"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setPreguntaAbierta(abierta ? null : i)}
                                        aria-expanded={abierta}
                                        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                                    >
                                        <span className="font-bold text-white">{p.q}</span>
                                        <ChevronDown
                                            className={`size-4 shrink-0 text-slate-500 transition-transform ${abierta ? 'rotate-180' : ''}`}
                                            aria-hidden
                                        />
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {abierta && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.22 }}
                                                className="overflow-hidden"
                                            >
                                                <p className="px-6 pb-5 text-sm leading-relaxed text-slate-400">{p.a}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ==================================================== cierre */}
            <section className="relative z-10 px-6 py-24 sm:py-32">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px]"
                    style={{
                        background:
                            'radial-gradient(ellipse at 50% 120%, rgba(29,78,216,0.55) 0%, rgba(8,145,178,0.18) 40%, transparent 70%)',
                    }}
                />
                <motion.div {...enVista} className="relative mx-auto max-w-2xl text-center">
                    <h2 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                        Entra y míralo <span className="texto-degradado">por dentro.</span>
                    </h2>
                    <p className="mx-auto mt-5 max-w-lg text-slate-400">
                        Cada quien tiene su cuenta y ve lo suyo. Si aún no la tienes, pídele el
                        código de registro al administrador: la cuenta nace apagada hasta que él la
                        aprueba.
                    </p>
                    <div className="mt-9 flex justify-center">
                        <BotonEntrar className="px-8 py-3.5 text-base">
                            <LogIn className="size-4" aria-hidden />
                            Entrar al sistema
                        </BotonEntrar>
                    </div>
                </motion.div>
            </section>

            {/* ==================================================== pie */}
            <footer className="relative z-10 border-t border-white/5 px-6 py-10">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
                    <Logo className="h-7" />
                    <p className="text-xs text-slate-500">
                        © {new Date().getFullYear()} {MARCA} · {MARCA_DESCRIPCION}
                    </p>
                </div>
            </footer>
        </div>
    )
}
