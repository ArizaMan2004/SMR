// /app/api/telegram/route.ts
//
// EL ÚNICO SITIO QUE TOCA EL TOKEN DEL BOT.
//
// Quien tiene el token puede escribir como el bot a cualquier chat que lo
// tenga agregado, así que no puede salir del servidor. El navegador pide
// "manda esto a este grupo" y aquí se pone el token.
//
// PARA QUE FUNCIONE hace falta una línea en `.env.local`:
//
//     TELEGRAM_BOT_TOKEN=123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//
// El token lo da @BotFather en Telegram: /newbot, nombre, y lo devuelve.
// Después hay que agregar el bot a cada grupo del taller y, en el grupo,
// escribir cualquier cosa para que exista la conversación.

import { NextResponse } from "next/server";

/** Telegram corta por ahí; se avisa antes en vez de mandar algo cortado. */
const LIMITE_TEXTO = 4096;

/**
 * LOS GRUPOS EN LOS QUE ESTÁ EL BOT.
 *
 * Sacar el id de un grupo a mano es el paso donde todo el mundo se equivoca:
 * hay que meter otro bot, leer un JSON y copiar un número negativo largo. Esto
 * lo pregunta y devuelve la lista con sus nombres, para poder elegir.
 *
 * Telegram solo guarda los mensajes recientes sin leer (unas 24 horas), así
 * que el grupo tiene que haber recibido algo. Por eso la pantalla pide
 * escribir cualquier cosa en el grupo antes de buscar.
 */
export async function GET() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        return NextResponse.json(
            { error: "Falta TELEGRAM_BOT_TOKEN en el servidor. Se configura en .env.local." },
            { status: 503 }
        );
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
            cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok === false) {
            return NextResponse.json(
                { error: data?.description || `Telegram respondió ${res.status}` },
                { status: 502 }
            );
        }

        // QUIEN ES EL BOT.
        //
        // Hace falta para poder dar a los empleados el enlace de su bot. Sin el
        // hay que explicarles de palabra como se llama, y ahi es donde la mitad
        // le escribe al bot equivocado.
        let botUsuario = "";
        try {
            const me = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
            const j = await me.json().catch(() => ({}));
            botUsuario = j?.result?.username || "";
        } catch {
            // Sin esto se sigue pudiendo vincular a mano; no es motivo de error.
        }

        // Un mismo grupo aparece en cada mensaje: se queda uno por id.
        const vistos = new Map<string, {
            id: string; nombre: string; tipo: string; usuario: string;
        }>();

        for (const u of (data?.result || [])) {
            const chat = u?.message?.chat || u?.channel_post?.chat
                || u?.my_chat_member?.chat || u?.edited_message?.chat;
            if (!chat?.id) continue;

            const id = String(chat.id);
            if (vistos.has(id)) continue;

            vistos.set(id, {
                id,
                nombre: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || id,
                tipo: chat.type || "",
                // El @usuario es lo unico parecido a un identificador legible
                // que da Telegram: el telefono no lo entrega nunca.
                usuario: chat.username ? `@${chat.username}` : "",
            });
        }

        return NextResponse.json({ ok: true, chats: [...vistos.values()], botUsuario });
    } catch (e: any) {
        return NextResponse.json(
            { error: `No se pudo hablar con Telegram: ${e?.message || e}` },
            { status: 502 }
        );
    }
}

export async function POST(req: Request) {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        return NextResponse.json(
            { error: "Falta TELEGRAM_BOT_TOKEN en el servidor. Se configura en .env.local." },
            { status: 503 }
        );
    }

    let cuerpo: any;
    try {
        cuerpo = await req.json();
    } catch {
        return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const chatId = String(cuerpo?.chatId || "").trim();
    const texto = String(cuerpo?.texto || "").trim();

    if (!chatId) return NextResponse.json({ error: "Falta el grupo de destino" }, { status: 400 });
    if (!texto) return NextResponse.json({ error: "El mensaje está vacío" }, { status: 400 });

    // Un id de grupo es numérico (los de grupo van en negativo) o un @alias.
    // Sin esto, cualquier cadena llegaría a la API de Telegram.
    if (!/^-?\d+$/.test(chatId) && !/^@[A-Za-z0-9_]{4,}$/.test(chatId)) {
        return NextResponse.json(
            { error: "El id del grupo no tiene forma de id de Telegram" },
            { status: 400 }
        );
    }

    if (texto.length > LIMITE_TEXTO) {
        return NextResponse.json(
            { error: `El mensaje pasa de ${LIMITE_TEXTO} caracteres` },
            { status: 400 }
        );
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: texto,
                parse_mode: "Markdown",
                disable_web_page_preview: true,
            }),
            cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data?.ok === false) {
            // El mensaje de Telegram se devuelve tal cual: dice cosas útiles
            // como "chat not found" o "bot was kicked", que es justo lo que
            // hay que leer para arreglarlo.
            return NextResponse.json(
                { error: data?.description || `Telegram respondió ${res.status}` },
                { status: 502 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: `No se pudo hablar con Telegram: ${e?.message || e}` },
            { status: 502 }
        );
    }
}
