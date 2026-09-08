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

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Send, Loader2, Save, ShieldAlert, Check, X, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { useAuth } from '@/lib/auth-context'
import { esAdmin } from '@/lib/roles'
import {
    subscribeToTelegram, guardarTelegram, enviarTelegram, AREAS_TELEGRAM,
    type ConfigTelegram, type AreaTelegram,
} from '@/lib/services/telegram-service'

export function TelegramPanel() {
    const { userData } = useAuth()
    const puedeEditar = esAdmin(userData?.rol)

    const [cfg, setCfg] = useState<ConfigTelegram>({})
    const [chats, setChats] = useState<Partial<Record<AreaTelegram, string>>>({})
    const [activo, setActivo] = useState(true)
    const [tocado, setTocado] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [probando, setProbando] = useState<string | null>(null)

    useEffect(() => subscribeToTelegram(setCfg), [])

    // No se pisa lo que se está tecleando: sin esto, un cambio de otra pestaña
    // borra lo escrito a medias.
    useEffect(() => {
        if (tocado) return
        setChats({ ...(cfg.chats || {}) })
        setActivo(cfg.activo !== false)
    }, [cfg, tocado])

    const guardar = async () => {
        setGuardando(true)
        try {
            await guardarTelegram({ activo, chats })
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
            `✅ *Prueba desde SMR*\nSi lees esto, los avisos de ${AREAS_TELEGRAM.find(a => a.id === area)?.label} funcionan.`
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
                    <li>En el grupo, manda <span className="font-mono">/start@tu_bot</span> y luego escribe a{' '}
                        <span className="font-black text-sky-600">@RawDataBot</span> dentro del grupo: te dice el id, que empieza por <span className="font-mono">-100</span>.</li>
                    <li>Pega ese id aquí abajo y dale a Probar.</li>
                </ol>
            </div>

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

            <p className="text-[10px] font-bold text-slate-400 leading-snug">
                Un área sin id no recibe avisos, y eso no rompe nada: el trabajo se manda al
                taller igual. El aviso es un extra — perder un mensaje es molesto, perder la
                orden sería grave.
            </p>
        </Card>
    )
}
