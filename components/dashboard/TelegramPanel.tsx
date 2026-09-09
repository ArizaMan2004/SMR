// @/components/dashboard/TelegramPanel.tsx
//
// LOS GRUPOS DE TELEGRAM DEL TALLER.
//
// Un grupo por área, no uno solo con todo: un grupo donde suena todo acaba
// silenciado por todos, y entonces no sirve para nada.
//
// Los ids se guardan en la base de datos y no en el código para poder cambiar
// un grupo sin tocar nada. No son secretos: sin el token del bot no sirven.
// El token vive en el servidor y no se toca desde aquí.

"use client"

import React, { useEffect, useState } from 'react'
import { MARCA_CORTA } from "@/lib/marca"

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Send, Loader2, Save, ShieldAlert, Check, X, MessageCircle, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    subscribeToTelegram, guardarTelegram, enviarTelegram, descubrirChats, motivoChatInvalido, AREAS_TELEGRAM,
    type ConfigTelegram, type AreaTelegram, type ChatDescubierto,
} from '@/lib/services/telegram-service'
import { subscribeToEmpleados } from '@/lib/services/gastos-service'
import type { Empleado } from '@/lib/types/gastos'

export function TelegramPanel() {
    const { userData } = useAuth()
    const puedeEditar = esAdmin(userData?.rol)

    const [cfg, setCfg] = useState<ConfigTelegram>({})
    const [chats, setChats] = useState<Partial<Record<AreaTelegram, string>>>({})
    const [empleadosChat, setEmpleadosChat] = useState<Record<string, string>>({})
    /** Como se llama el bot, para poder pasarle el enlace a la gente. */
    const [botUsuario, setBotUsuario] = useState('')
    /** Lo que se esta tecleando en la casilla de cada empleado. */
    const [borrador, setBorrador] = useState<Record<string, string>>({})

    /**
     * Vincula lo escrito a mano.
     *
     * Se comprueba antes de guardarlo. Un id mal copiado se guarda igual de
     * bien que uno bueno y no se nota hasta el dia que hace falta el aviso, que
     * es el peor momento para enterarse.
     */
    const vincularAMano = (empleadoId: string) => {
        const v = String(borrador[empleadoId] ?? '').trim()
        if (!v) return
        const motivo = motivoChatInvalido(v)
        if (motivo) { toast.error(motivo); return }
        setEmpleadosChat(p => ({ ...p, [empleadoId]: v }))
        setBorrador(p => { const c = { ...p }; delete c[empleadoId]; return c })
        setTocado(true)
    }
    const [urlApp, setUrlApp] = useState('')
    const [activo, setActivo] = useState(true)

    const [empleados, setEmpleados] = useState<Empleado[]>([])
    useEffect(() => subscribeToEmpleados(setEmpleados), [])
    const [tocado, setTocado] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [probando, setProbando] = useState<string | null>(null)

    const [buscando, setBuscando] = useState(false)
    const [encontrados, setEncontrados] = useState<ChatDescubierto[] | null>(null)

    const buscarGrupos = async () => {
        setBuscando(true)
        const r = await descubrirChats()
        if (r.botUsuario) setBotUsuario(r.botUsuario)
        setBuscando(false)

        if (r.error) return toast.error(r.error)
        setEncontrados(r.chats)
        if (!r.chats.length) {
            toast.error('No apareció ninguno. Escribe algo en el grupo y vuelve a buscar.')
        }
    }

    useEffect(() => subscribeToTelegram(setCfg), [])

    // No se pisa lo que se está tecleando: sin esto, un cambio de otra pestaña
    // borra lo escrito a medias.
    useEffect(() => {
        if (tocado) return
        setChats({ ...(cfg.chats || {}) })
        setEmpleadosChat({ ...(cfg.empleados || {}) })
        setUrlApp(cfg.urlApp || '')
        setActivo(cfg.activo !== false)
    }, [cfg, tocado])

    const guardar = async () => {
        setGuardando(true)
        try {
            await guardarTelegram({ activo, chats, empleados: empleadosChat, urlApp: urlApp.trim() })
            toast.success('Grupos guardados')
            setTocado(false)
        } catch (e: any) {
            toast.error(`No se pudo guardar: ${e?.message || e}`)
        } finally {
            setGuardando(false)
        }
    }

    /**
     * Manda un mensaje de prueba a un grupo.
     *
     * Es la única forma de saber si está bien puesto: un id equivocado no da
     * error al guardarlo, da error el día que hace falta el aviso.
     */
    const probar = async (area: AreaTelegram) => {
        const chatId = String(chats[area] || '').trim()
        if (!chatId) return toast.error('Pon primero el id del grupo')

        setProbando(area)
        const r = await enviarTelegram(
            chatId,
            `✅ *Prueba desde ${MARCA_CORTA}*\nSi lees esto, los avisos de ${AREAS_TELEGRAM.find(a => a.id === area)?.label} funcionan.`
        )
        setProbando(null)

        if (r.enviado) toast.success('Mensaje enviado; míralo en el grupo')
        else toast.error(r.motivo || 'No se pudo enviar')
    }

    if (!puedeEditar) {
        return (
            <Card className="rounded-[2rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-slate-400 leading-snug">
                    Solo el administrador puede configurar los avisos del taller.
                </p>
            </Card>
        )
    }

    return (
        <Card className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-black uppercase italic tracking-tight">Avisos por Telegram</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Un grupo por área
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setActivo(v => !v); setTocado(true) }}
                        className={cn(
                            'h-11 px-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-colors',
                            activo
                                ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                                : 'border-black/10 dark:border-white/10 text-slate-400'
                        )}
                    >
                        {activo ? 'Avisos encendidos' : 'Avisos apagados'}
                    </button>

                    <Button
                        onClick={guardar}
                        disabled={guardando || !tocado}
                        className="h-11 rounded-2xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[10px] gap-2"
                    >
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {tocado ? 'Guardar' : 'Sin cambios'}
                    </Button>
                </div>
            </div>

            {/* CÓMO SE MONTA.

                Va aquí y no en un manual aparte porque es lo que hay que hacer
                una vez y nadie recuerda dónde estaba escrito. */}
            <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cómo se monta, una sola vez</p>
                <ol className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed list-decimal ml-4 space-y-1">
                    <li>En Telegram, escribe a <span className="font-black text-sky-600">@BotFather</span> y manda <span className="font-mono">/newbot</span>. Te da un token.</li>
                    <li>Ese token va en el archivo <span className="font-mono">.env.local</span> del servidor, así:<br /><span className="font-mono text-[10px]">TELEGRAM_BOT_TOKEN=el_token_que_te_dio</span></li>
                    <li>Arma un grupo por área y mete al bot en cada uno.</li>
                    <li>Escribe cualquier cosa en cada grupo (un "hola" basta) para que exista la conversación.</li>
                    <li>Dale a <span className="font-black text-sky-600">Buscar grupos</span> aquí abajo y elige cuál va en cada área.</li>
                </ol>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="outline"
                    onClick={buscarGrupos}
                    disabled={buscando}
                    className="h-11 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2"
                >
                    {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Buscar grupos
                </Button>
                <p className="text-[10px] font-bold text-slate-400 leading-snug flex-1 min-w-[12rem]">
                    Mete el bot en cada grupo, escribe algo ahí, y aparecerán aquí para elegirlos
                    sin copiar números.
                </p>
            </div>

            {encontrados && encontrados.length > 0 && (
                <div className="rounded-2xl border border-sky-200 dark:border-sky-500/20 bg-sky-50/60 dark:bg-sky-500/5 p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                        Grupos encontrados — toca uno y elige su área
                    </p>
                    {encontrados.map(c => (
                        <div key={c.id} className="flex flex-wrap items-center gap-2 bg-white dark:bg-black/20 rounded-xl px-3 py-2">
                            <span className="font-black text-xs flex-1 min-w-[8rem] truncate">{c.nombre}</span>
                            {c.usuario && (
                                <span className="text-[10px] font-black text-blue-600 shrink-0">{c.usuario}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">{c.id}</span>
                            <select
                                defaultValue=""
                                onChange={e => {
                                    const v = e.target.value
                                    if (!v) return
                                    setTocado(true)

                                    if (v.startsWith('area:')) {
                                        const id = v.slice(5) as AreaTelegram
                                        setChats(p => ({ ...p, [id]: c.id }))
                                        toast.success(`Puesto en ${AREAS_TELEGRAM.find(a => a.id === id)?.label}`)
                                    } else {
                                        const id = v.slice(4)
                                        setEmpleadosChat(p => ({ ...p, [id]: c.id }))
                                        const emp = empleados.find(x => x.id === id)
                                        toast.success(`Vinculado a ${emp?.nombre || 'el empleado'}`)
                                    }
                                }}
                                className="h-8 rounded-lg bg-slate-50 dark:bg-white/5 border-none text-[10px] font-black uppercase px-2 outline-none shrink-0"
                            >
                                <option value="">Usar en...</option>
                                <optgroup label="Grupo de área">
                                    {AREAS_TELEGRAM.map(a => <option key={a.id} value={`area:${a.id}`}>{a.label}</option>)}
                                </optgroup>
                                {/* Un chat privado es de una persona, no de un
                                    área: el grupo avisa al equipo, el privado
                                    le suena a quien le toca. */}
                                <optgroup label="Chat de un empleado">
                                    {empleados.map(e => (
                                        <option key={e.id} value={`emp:${e.id}`}>
                                            {[e.nombre, e.apellido].filter(Boolean).join(' ')}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-3">
                {AREAS_TELEGRAM.map(a => {
                    const v = String(chats[a.id] || '')
                    return (
                        <div key={a.id} className="flex flex-wrap items-center gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-full sm:w-56 shrink-0">
                                {a.label}
                            </Label>

                            <Input
                                value={v}
                                onChange={e => { setChats(p => ({ ...p, [a.id]: e.target.value })); setTocado(true) }}
                                placeholder="-1001234567890"
                                className="h-11 flex-1 min-w-[10rem] rounded-xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold font-mono"
                            />

                            <Button
                                variant="outline"
                                onClick={() => probar(a.id)}
                                disabled={!v.trim() || probando === a.id}
                                className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest gap-1.5 shrink-0"
                            >
                                {probando === a.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Send className="w-3.5 h-3.5" />}
                                Probar
                            </Button>

                            {v.trim() && (
                                /^-?\d+$/.test(v.trim()) || /^@[A-Za-z0-9_]{4,}$/.test(v.trim())
                                    ? <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                    : <span className="text-[9px] font-black uppercase text-amber-600 shrink-0 flex items-center gap-1">
                                        <X className="w-3.5 h-3.5" /> No parece un id
                                      </span>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* QUIÉN RECIBE POR PRIVADO.

                El grupo avisa al área; el privado le suena a quien le toca. En
                un grupo de doce nadie se da por aludido. */}
            <div className="rounded-2xl border border-black/5 dark:border-white/5 p-4 space-y-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Aviso directo a cada quien
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 leading-snug mt-0.5">
                        Cada quien le escribe al bot por privado, tú le das a Buscar grupos y lo
                        vinculas aquí. Recibe su orden y cuántas lleva pendientes.
                    </p>
                </div>

                {/* POR QUE NO HAY NUMEROS DE TELEFONO.

                    Telegram no se los da a los bots, ni con permiso: lo unico
                    que entrega es un identificador de conversacion. No es una
                    limitacion del panel y no hay forma de rodearla, asi que
                    mejor decirlo aqui que dejar a alguien buscando el campo del
                    telefono durante media hora. */}
                <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                        Telegram no da telefonos
                    </p>
                    <p className="text-[10px] font-bold text-blue-900/70 dark:text-blue-200/70 leading-snug">
                        A los bots solo les entrega un numero de conversacion. Por eso ves IDs y
                        no telefonos: no falta nada por configurar, es asi y no se puede cambiar.
                    </p>
                    <ol className="text-[10px] font-bold text-blue-900/70 dark:text-blue-200/70 leading-snug list-decimal ml-4 space-y-0.5">
                        <li>La persona abre el bot y le escribe cualquier cosa.</li>
                        <li>Tocas <span className="font-black">Buscar chats</span> aqui arriba.</li>
                        <li>Aparece con su nombre y la vinculas.</li>
                    </ol>
                    {botUsuario && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <code className="text-[10px] font-black bg-white dark:bg-black/30 rounded-lg px-2 py-1">
                                https://t.me/{botUsuario.replace('@', '')}
                            </code>
                            <button
                                onClick={() => {
                                    navigator.clipboard?.writeText(`https://t.me/${botUsuario.replace('@', '')}`)
                                    toast.success('Enlace copiado, pasaselo a tu gente')
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                            >
                                Copiar enlace
                            </button>
                        </div>
                    )}
                </div>

                {empleados.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-400">No hay empleados registrados.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {empleados.map(e => {
                            const chat = empleadosChat[e.id]
                            const nombre = [e.nombre, e.apellido].filter(Boolean).join(' ')
                            return (
                                <div
                                    key={e.id}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-full pl-3 pr-1 h-8 border',
                                        chat
                                            ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10'
                                            : 'border-black/10 dark:border-white/10'
                                    )}
                                >
                                    <span className={cn('text-[10px] font-black uppercase', chat ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400')}>
                                        {nombre}
                                    </span>

                                    {chat ? (
                                        <>
                                            <button
                                                onClick={async () => {
                                                    const r = await enviarTelegram(chat, `✅ *Prueba desde ${MARCA_CORTA}*
Hola ${e.nombre}, si lees esto tus avisos funcionan.`)
                                                    if (r.enviado) toast.success(`Enviado a ${e.nombre}`)
                                                    else toast.error(r.motivo || 'No se pudo enviar')
                                                }}
                                                title="Mandarle una prueba"
                                                className="text-emerald-600 hover:text-emerald-800 p-1"
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEmpleadosChat(p => { const c = { ...p }; delete c[e.id]; return c })
                                                    setTocado(true)
                                                }}
                                                title="Desvincular"
                                                className="text-slate-300 hover:text-red-500 p-1"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </>
                                    ) : (
                                        /* ESCRIBIRLO A MANO.

                                           Buscar chats solo encuentra a quien le
                                           haya escrito al bot hace poco: Telegram
                                           descarta las actualizaciones viejas. Si
                                           el empleado escribio ayer, ya no sale, y
                                           sin esta casilla no queda mas remedio que
                                           pedirle que vuelva a escribir. */
                                        <input
                                            value={borrador[e.id] ?? ''}
                                            onChange={ev => setBorrador(p => ({ ...p, [e.id]: ev.target.value }))}
                                            onKeyDown={ev => { if (ev.key === 'Enter') vincularAMano(e.id) }}
                                            onBlur={() => vincularAMano(e.id)}
                                            placeholder="Pegar ID o @usuario"
                                            className="h-6 w-36 rounded-full bg-white dark:bg-black/30 border border-dashed border-black/15 dark:border-white/15 text-[9px] font-bold px-2 outline-none"
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* A dónde manda el enlace. El aviso no lleva los detalles: los
                    detalles se ven dentro de la cuenta, que es donde están los
                    permisos. Un mensaje de Telegram se reenvía a cualquiera. */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                        Enlace a la app
                    </Label>
                    <Input
                        value={urlApp}
                        onChange={e => { setUrlApp(e.target.value); setTocado(true) }}
                        placeholder="https://tu-app.vercel.app"
                        className="h-10 flex-1 min-w-[12rem] rounded-xl bg-slate-50 dark:bg-white/5 border-none text-xs font-bold"
                    />
                </div>
            </div>

            <p className="text-[10px] font-bold text-slate-400 leading-snug">
                Un área sin id no recibe avisos, y eso no rompe nada: el trabajo se manda al
                taller igual. El aviso es un extra — perder un mensaje es molesto, perder la
                orden sería grave.
            </p>
        </Card>
    )
}
