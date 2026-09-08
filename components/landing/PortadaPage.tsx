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
// de verdad está construido. Si algo deja de existir, se quita de la lista.
//
// El nombre sale del entorno, así que una copia montada para otro taller lleva
// el suyo sin tocar esto.

"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowRight, Check, ChevronDown, Menu, X, Sparkles,
    Monitor, Smartphone, LogIn,
} from 'lucide-react'

import { MARCA, MARCA_DESCRIPCION } from '@/lib/marca'
import { MODULOS, VENTAJAS, TAMBIEN, PREGUNTAS } from '@/components/landing/landing-data'

const NAV = [
    { href: '#modulos', label: 'Qué hace' },
    { href: '#decisiones', label: 'Cómo está hecho' },
    { href: '#tambien', label: 'Y además' },
    { href: '#preguntas', label: 'Preguntas' },
]

const aparecer = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
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

export default function PortadaPage() {
    const [menuAbierto, setMenuAbierto] = useState(false)
    const [moduloActivo, setModuloActivo] = useState(MODULOS[0]!.id)
    const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(0)

    const modulo = MODULOS.find(m => m.id === moduloActivo) ?? MODULOS[0]!

    return (
        <div className="portada relative min-h-screen overflow-x-hidden">
            {/* Resplandor SIN desenfoque.

                Un filtro blur sobre una superficie de 1100x700 obliga al
                navegador a rasterizarla y desenfocarla en cada fotograma. En
                una computadora no se nota; en el Android del mostrador la
                página se arrastra. Un degradado radial ya es difuso y no
                cuesta nada. */}
            <div
                aria-hidden
                className="pointer-events-none absolute top-[-20%] left-1/2 h-[700px] w-[1100px] -translate-x-1/2 opacity-60"
                style={{
                    background:
                        'radial-gradient(ellipse at center, rgba(29,78,216,0.85) 0%, rgba(8,145,178,0.32) 35%, rgba(8,145,178,0.10) 55%, transparent 72%)',
                }}
            />
            <div aria-hidden className="reticula pointer-events-none absolute inset-x-0 top-0 h-[900px] opacity-70" />

            {/* ---------------------------------------------------- cabecera */}
            <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-[color:var(--portada-tinta)]/80 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <a href="#inicio" className="flex items-center gap-2.5 min-w-0">
                        <span className="fondo-degradado grid size-8 shrink-0 place-items-center rounded-lg text-sm font-black text-white">
                            {MARCA.charAt(0)}
                        </span>
                        <span className="truncate text-lg font-black tracking-tight text-white">{MARCA}</span>
                    </a>

                    <nav className="hidden items-center gap-6 text-sm text-slate-400 lg:flex">
                        {NAV.map(n => (
                            <a key={n.href} href={n.href} className="transition hover:text-white">{n.label}</a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        <BotonEntrar className="hidden sm:inline-flex">Entrar</BotonEntrar>
                        <button
                            onClick={() => setMenuAbierto(v => !v)}
                            className="grid size-10 place-items-center rounded-xl border border-white/10 text-white lg:hidden"
                            aria-label="Menú"
                        >
                            {menuAbierto ? <X className="size-5" /> : <Menu className="size-5" />}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {menuAbierto && (
                        <motion.nav
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5 lg:hidden"
                        >
                            <div className="flex flex-col gap-1 px-6 py-4">
                                {NAV.map(n => (
                                    <a
                                        key={n.href}
                                        href={n.href}
                                        onClick={() => setMenuAbierto(false)}
                                        className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white"
                                    >
                                        {n.label}
                                    </a>
                                ))}
                                <BotonEntrar className="mt-2 w-full">Entrar</BotonEntrar>
                            </div>
                        </motion.nav>
                    )}
                </AnimatePresence>
            </header>

            {/* ------------------------------------------------------ encabezado */}
            <section id="inicio" className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-32 pb-16 text-center md:pt-44 md:pb-24">
                <motion.div initial="hidden" animate="visible" variants={aparecer}>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                        <Sparkles className="size-3.5 text-sky-400" />
                        {MARCA_DESCRIPCION}
                    </span>

                    <h1 className="mt-7 text-4xl font-black leading-[1.05] tracking-tighter text-white sm:text-5xl md:text-6xl">
                        El taller entero,{' '}
                        <span className="texto-degradado">en una sola pantalla</span>
                    </h1>

                    <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
                        Se cotiza, se factura, se cobra y se manda a producir sin volver a escribir
                        lo mismo tres veces. Cada metro que sale del rollo queda contado, y cada
                        bolívar que entra sabe por qué cuenta llegó.
                    </p>

                    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                        <BotonEntrar className="px-8 py-3.5 text-base">Entrar al sistema</BotonEntrar>
                        <a
                            href="#modulos"
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3.5 text-sm font-bold text-slate-300 transition hover:border-white/25 hover:text-white"
                        >
                            Ver qué hace
                            <ChevronDown className="size-4" />
                        </a>
                    </div>
                </motion.div>
            </section>

            {/* --------------------------------------------------------- módulos */}
            <section id="modulos" className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={aparecer}
                    className="text-center"
                >
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-sky-400">Qué hace</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tighter text-white md:text-4xl">
                        Ocho piezas que se hablan entre sí
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
                        No son ocho programas sueltos. Lo que se registra en uno lo leen los demás:
                        el precio del catálogo llega a la orden, la orden llega al taller, y lo que
                        se gastó llega al balance.
                    </p>
                </motion.div>

                {/* Pestañas de módulo. En móvil se deslizan de lado en vez de
                    apilarse en ocho filas que empujan el contenido fuera. */}
                <div className="mt-10 -mx-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex gap-2 md:flex-wrap md:justify-center">
                        {MODULOS.map(m => {
                            const activo = m.id === moduloActivo
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setModuloActivo(m.id)}
                                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition ${
                                        activo
                                            ? 'fondo-degradado border-transparent text-white'
                                            : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'
                                    }`}
                                >
                                    <m.icon className="size-4" />
                                    {m.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={modulo.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-10"
                    >
                        <div className="grid gap-8 md:grid-cols-2">
                            <div>
                                <span className="fondo-degradado inline-grid size-12 place-items-center rounded-2xl text-white">
                                    <modulo.icon className="size-6" />
                                </span>
                                <h3 className="mt-5 text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
                                    {modulo.titular}
                                </h3>
                                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                                    {modulo.detalle}
                                </p>
                            </div>

                            <ul className="space-y-3 md:pt-2">
                                {modulo.puntos.map(p => (
                                    <li key={p} className="flex items-start gap-3">
                                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-400">
                                            <Check className="size-3" strokeWidth={3} />
                                        </span>
                                        <span className="text-sm leading-relaxed text-slate-300">{p}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </section>

            {/* ------------------------------------------------------ decisiones */}
            <section id="decisiones" className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={aparecer}
                    className="text-center"
                >
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-sky-400">Cómo está hecho</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tighter text-white md:text-4xl">
                        Cuatro decisiones, no cuatro características
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
                        Las características se copian. Estas son las razones por las que el sistema
                        se comporta como se comporta.
                    </p>
                </motion.div>

                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                    {VENTAJAS.map((v, i) => (
                        <motion.div
                            key={v.titulo}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: '-60px' }}
                            variants={aparecer}
                            transition={{ delay: i * 0.06 }}
                            className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6"
                        >
                            <span className="grid size-10 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
                                <v.icon className="size-5" />
                            </span>
                            <h3 className="mt-4 text-lg font-black tracking-tight text-white">{v.titulo}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-400">{v.texto}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* --------------------------------------------------------- además */}
            <section id="tambien" className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={aparecer}
                    className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 md:p-10"
                >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-sky-400">Y además</p>
                            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                                Lo que también está dentro
                            </h2>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                            <Monitor className="size-5" />
                            <Smartphone className="size-5" />
                            <span className="text-xs font-bold">Computadora y teléfono</span>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                        {TAMBIEN.map(t => (
                            <span
                                key={t}
                                className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold text-slate-300"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* ------------------------------------------------------- preguntas */}
            <section id="preguntas" className="relative z-10 mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={aparecer}
                    className="text-center"
                >
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-sky-400">Preguntas</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tighter text-white md:text-4xl">
                        Lo que suelen preguntar
                    </h2>
                </motion.div>

                <div className="mt-8 space-y-3">
                    {PREGUNTAS.map((p, i) => {
                        const abierta = preguntaAbierta === i
                        return (
                            <div key={p.q} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                                <button
                                    onClick={() => setPreguntaAbierta(abierta ? null : i)}
                                    className="flex w-full items-center gap-3 px-5 py-4 text-left"
                                >
                                    <span className="flex-1 text-sm font-bold text-white">{p.q}</span>
                                    <ChevronDown
                                        className={`size-4 shrink-0 text-slate-500 transition-transform ${abierta ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                <AnimatePresence initial={false}>
                                    {abierta && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{p.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* ---------------------------------------------------------- cierre */}
            <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    variants={aparecer}
                    className="fondo-degradado brillo-marca rounded-[2rem] px-8 py-12 text-center md:px-12"
                >
                    <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                        Todo esto ya está adentro
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80">
                        Entra con tu cuenta. Si eres nuevo, pídele el código de registro al
                        administrador: la cuenta nace apagada hasta que él la aprueba.
                    </p>
                    <Link
                        href="/acceso"
                        className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-black text-slate-900 transition hover:bg-slate-100"
                    >
                        <LogIn className="size-4" />
                        Entrar
                    </Link>
                </motion.div>
            </section>

            {/* ------------------------------------------------------------- pie */}
            <footer className="relative z-10 border-t border-white/5 py-10">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
                    <div className="flex items-center gap-2.5">
                        <span className="fondo-degradado grid size-7 place-items-center rounded-lg text-xs font-black text-white">
                            {MARCA.charAt(0)}
                        </span>
                        <span className="text-sm font-bold text-white">{MARCA}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                        © {new Date().getFullYear()} {MARCA} · Panel interno
                    </p>
                </div>
            </footer>
        </div>
    )
}
