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
