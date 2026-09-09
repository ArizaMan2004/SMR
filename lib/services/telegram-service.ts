// @/lib/services/telegram-service.ts
//
// AVISAR AL TALLER POR TELEGRAM.
//
// Un trabajo entraba al taller y nadie se enteraba hasta que alguien abría la
// pantalla. En la práctica eso significa que el trabajo espera a que a alguien
// se le ocurra mirar.
//
// Esto manda un mensaje al grupo del área en cuanto el trabajo llega. Un
// grupo por área —Impresión, Corte, Producción, Diseño— porque un solo grupo
// con todo acaba silenciado por todos.
//
// DÓNDE VIVE CADA COSA
//
// El TOKEN del bot vive en `.env.local`, en el servidor, y no sale de ahí:
// quien tiene el token puede escribir como el bot a cualquiera que lo tenga
// agregado. Por eso el navegador nunca lo ve y el envío pasa por
// `/api/telegram`.
//
// Los IDS DE GRUPO viven en Firestore, no en el código, para poder cambiarlos
// desde Ajustes cuando se arme un grupo nuevo o entre gente. No son secretos:
// sin el token no sirven de nada.
//
// SI FALLA, NO SE ROMPE NADA
//
// El aviso es un extra. Si Telegram no responde, o nadie configuró el bot, el
// trabajo se manda igual al taller y se avisa aparte. Perder un mensaje es
// molesto; perder la orden sería grave.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { MARCA_CORTA } from "@/lib/marca";

/** Las áreas del taller, con los mismos ids que usa la pantalla. */
export type AreaTelegram =
    | "DISENO"
    | "IMPRESION"
    | "CORTE_LASER"
    | "PRODUCCION"
    /**
     * No es un área del taller: es donde termina la cadena.
     *
     * Un trabajo va pasando de mano —se imprime, pasa a producción que lo pega
     * sobre PVC— y cuando sale, quien atiende al cliente tiene que enterarse
     * para llamarlo. Si no, el trabajo se queda hecho en la mesa esperando a
     * que alguien pregunte.
     */
    | "ADMINISTRACION";

export const AREAS_TELEGRAM: { id: AreaTelegram; label: string }[] = [
    { id: "DISENO", label: "Diseño" },
    { id: "IMPRESION", label: "Impresión" },
    { id: "CORTE_LASER", label: "Corte / Láser" },
    { id: "PRODUCCION", label: "Producción (Armado)" },
    { id: "ADMINISTRACION", label: "Administración (trabajos terminados)" },
];

export interface ConfigTelegram {
    /** Encendido general. Apagado, no se manda nada sin tener que borrar ids. */
    activo?: boolean;
    /** Id del grupo de cada área. Vacío: esa área no recibe avisos. */
    chats?: Partial<Record<AreaTelegram, string>>;
    /**
     * El chat privado de cada empleado, por su id.
     *
     * El grupo sirve para que el área se entere; el mensaje directo sirve para
     * que a QUIEN le toca le suene el teléfono. En un grupo con doce personas
     * nadie se da por aludido.
     */
    empleados?: Record<string, string>;
    /**
     * A dónde manda el enlace del mensaje.
     *
     * El aviso no lleva los detalles: lleva lo justo para saber que hay algo y
     * un enlace para entrar. Los detalles se ven dentro de la cuenta, que es
     * donde están los permisos — un mensaje de Telegram se reenvía a
     * cualquiera.
     */
    urlApp?: string;
    actualizadoEn?: string;
}

const REF = () => doc(db, "configuracion", "telegram");

export const subscribeToTelegram = (callback: (c: ConfigTelegram) => void) =>
    onSnapshot(
        REF(),
        snap => callback((snap.exists() ? snap.data() : {}) as ConfigTelegram),
        error => {
            console.error("Error leyendo la configuración de Telegram:", error);
            callback({});
        }
    );

export const cargarTelegram = async (): Promise<ConfigTelegram> => {
    try {
        const snap = await getDoc(REF());
        return (snap.exists() ? snap.data() : {}) as ConfigTelegram;
    } catch (error) {
        console.error("Error cargando la configuración de Telegram:", error);
        return {};
    }
};

export const guardarTelegram = async (cfg: ConfigTelegram) => {
    await setDoc(
        REF(),
        { ...cfg, actualizadoEn: new Date().toISOString() },
        { merge: true }
    );
};

/** El chat privado de un empleado, si lo tiene y los avisos están encendidos. */
export const chatDeEmpleado = (cfg: ConfigTelegram, empleadoId?: string): string => {
    if (cfg?.activo === false || !empleadoId) return "";
    return String(cfg?.empleados?.[empleadoId] || "").trim();
};

/** El grupo de un área, si lo tiene configurado y los avisos están encendidos. */
export const chatDeArea = (cfg: ConfigTelegram, area: string): string => {
    if (cfg?.activo === false) return "";
    return String(cfg?.chats?.[area as AreaTelegram] || "").trim();
};

export interface ResultadoAviso {
    enviado: boolean;
    /** Por qué no se envió, para poder decirlo en vez de callarlo. */
    motivo?: string;
}

/**
 * Manda un aviso al grupo de un área.
 *
 * NUNCA lanza. Quien lo llama está en medio de guardar algo importante y un
 * fallo del aviso no puede tumbar esa operación.
 */
export const avisarAlArea = async (
    cfg: ConfigTelegram,
    area: string,
    texto: string
): Promise<ResultadoAviso> => {
    const chatId = chatDeArea(cfg, area);
    if (!chatId) return { enviado: false, motivo: "Esa área no tiene grupo configurado" };

    return enviarTelegram(chatId, texto);
};

export interface ChatDescubierto {
    id: string;
    nombre: string;
    tipo: string;
    /** "@juanperez", si lo tiene. Telegram nunca da el telefono. */
    usuario?: string;
}

/**
 * Los grupos donde el bot ya recibió algo.
 *
 * Copiar el id de un grupo a mano es donde todo el mundo se equivoca. Esto lo
 * pregunta y devuelve la lista con sus nombres, para elegir en vez de teclear.
 */
export const descubrirChats = async (): Promise<{
    chats: ChatDescubierto[]; botUsuario?: string; error?: string;
}> => {
    try {
        const res = await fetch("/api/telegram", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { chats: [], error: data?.error || `Error ${res.status}` };
        return { chats: data?.chats || [], botUsuario: data?.botUsuario || "" };
    } catch (e: any) {
        return { chats: [], error: e?.message || "Sin conexión" };
    }
};

/**
 * Por qué no vale lo que se escribió, o null si vale.
 *
 * Comprobarlo antes de guardarlo evita el caso peor: creer que está
 * configurado y descubrir que no el día que hace falta el aviso.
 *
 * EL TELÉFONO SE DETECTA APARTE, Y A PROPÓSITO
 *
 * Es el error que va a cometer todo el mundo: la pantalla pide "el chat de
 * Jesús" y uno escribe el número de Jesús. Un teléfono venezolano —0414…— es
 * once dígitos, así que pasaría por un id numérico sin despeinarse.
 *
 * Lo que lo delata es el cero de delante: los identificadores de Telegram son
 * enteros de verdad y ninguno empieza por cero. Decir "eso es un teléfono" en
 * vez de "formato inválido" es la diferencia entre corregirlo en diez segundos
 * y pasar media hora buscando dónde está el campo del teléfono.
 */
export const motivoChatInvalido = (valor: string): string | null => {
    const v = String(valor || "").trim();
    if (!v) return "Escribe el id del chat o su @usuario";

    if (/^@/.test(v)) {
        return /^@[A-Za-z0-9_]{4,}$/.test(v)
            ? null
            : "Un @usuario lleva al menos 4 letras, números o guiones bajos";
    }

    if (/^\+?\d[\d\s-]+$/.test(v) && /^\+?0/.test(v.replace(/[\s-]/g, ""))) {
        return "Eso es un teléfono. Telegram no los usa: hace falta el id del chat";
    }

    if (!/^-?[1-9]\d{4,}$/.test(v)) {
        return "No parece un chat: un número como 1524194054, o un @usuario";
    }

    return null;
};

/** Atajo para cuando solo importa si vale. */
export const chatIdValido = (v: string): boolean => motivoChatInvalido(v) === null;

/** El envío en crudo. Pasa por el servidor porque el token no sale de ahí. */
export const enviarTelegram = async (
    chatId: string,
    texto: string
): Promise<ResultadoAviso> => {
    try {
        const res = await fetch("/api/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId, texto }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { enviado: false, motivo: data?.error || `Error ${res.status}` };
        return { enviado: true };
    } catch (e: any) {
        return { enviado: false, motivo: e?.message || "Sin conexión" };
    }
};

/**
 * EL MENSAJE DIRECTO A QUIEN LE TOCA.
 *
 * Corto a propósito. No lleva medidas ni material ni precios: lleva que hay
 * algo suyo, cuántas cosas tiene encima y por dónde entrar.
 *
 * Los detalles se ven dentro de la cuenta y no aquí por dos razones: un
 * mensaje de Telegram se reenvía a cualquiera y no sabe de permisos, y un
 * mensaje largo en el teléfono no se lee — se archiva.
 */
export const mensajeParaEmpleado = (t: {
    nombre?: string;
    ordenNumero?: string | number | null;
    cliente?: string;
    resumen?: string;
    fechaEntrega?: string;
    pendientes?: number;
    urlApp?: string;
}): string => {
    const lineas = [
        "🔔 *NUEVA ORDEN*",
        t.nombre ? `${t.nombre}, te toca esta:` : null,
        "",
        t.ordenNumero ? `*Orden #${t.ordenNumero}*` : null,
        t.cliente ? `Cliente: ${t.cliente}` : null,
        (t.resumen || "").trim() || null,
        t.fechaEntrega ? `Entrega: ${t.fechaEntrega}` : null,
    ];

    if (t.pendientes != null) {
        lineas.push(
            "",
            t.pendientes === 1
                ? "Con esta tienes *1 pendiente*."
                : `Con esta tienes *${t.pendientes} pendientes*.`
        );
    }

    lineas.push(
        "",
        t.urlApp
            ? `Los detalles en tu cuenta: ${t.urlApp}`
            : `Los detalles están en tu cuenta de ${MARCA_CORTA}.`
    );

    return lineas.filter(l => l !== null).join("\n");
};

/**
 * El resumen de un trabajo en una línea.
 *
 * Lo que se lee de un vistazo sin abrir nada. Si son varios renglones se dice
 * cuántos, en vez de pegar una lista que nadie lee en el teléfono.
 */
export const resumenCorto = (descripcion?: string): string => {
    const lineas = String(descripcion || "")
        .split("\n")
        .map(l => l.trim())
        .filter(Boolean);

    if (!lineas.length) return "";
    if (lineas.length === 1) return lineas[0];
    return `${lineas[0]} (+${lineas.length - 1} más)`;
};

/**
 * El mensaje de un trabajo que se termina.
 *
 * Va a administración, que es quien llama al cliente. Dice de dónde salió para
 * que no haya que ir a buscarlo.
 */
export const mensajeTrabajoTerminado = (t: {
    ordenNumero?: string | number | null;
    cliente?: string;
    descripcion?: string;
    area?: string;
}): string => {
    const areaLabel = AREAS_TELEGRAM.find(a => a.id === t.area)?.label || t.area || "el taller";
    return [
        "✅ *Trabajo terminado*",
        t.ordenNumero ? `Orden #${t.ordenNumero}` : null,
        t.cliente ? `Cliente: ${t.cliente}` : null,
        `Salió de: ${areaLabel}`,
        "",
        (t.descripcion || "").trim(),
        "",
        "Listo para avisarle al cliente.",
    ].filter(l => l !== null).join("\n");
};

/**
 * El mensaje de un trabajo que entra a un área.
 *
 * Corto y en el orden en que se lee de un vistazo en el teléfono: qué área,
 * qué número, de quién, qué hay que hacer y para cuándo. Las observaciones van
 * al final porque son lo que se lee con calma.
 */
export const mensajeTrabajoNuevo = (t: {
    area: string;
    ordenNumero?: string | number | null;
    cliente?: string;
    descripcion?: string;
    materiales?: string[];
    fechaEntrega?: string;
    responsable?: string;
    observaciones?: string;
    /** De qué área viene, cuando es un traspaso y no un trabajo recién creado. */
    vieneDe?: string;
}): string => {
    const areaLabel = AREAS_TELEGRAM.find(a => a.id === t.area)?.label || t.area;
    const origen = t.vieneDe
        ? AREAS_TELEGRAM.find(a => a.id === t.vieneDe)?.label || t.vieneDe
        : null;

    const lineas = [
        origen
            ? `🔧 *${areaLabel}* — llega de ${origen}`
            : `🔧 *${areaLabel}* — trabajo nuevo`,
        t.ordenNumero ? `Orden #${t.ordenNumero}` : null,
        t.cliente ? `Cliente: ${t.cliente}` : null,
        "",
        (t.descripcion || "").trim(),
    ];

    if (t.materiales?.length) lineas.push("", `Material: ${t.materiales.join(", ")}`);
    if (t.fechaEntrega) lineas.push(`Entrega: ${t.fechaEntrega}`);
    if (t.responsable) lineas.push(`Responsable: ${t.responsable}`);
    if (t.observaciones?.trim()) lineas.push("", `📝 ${t.observaciones.trim()}`);

    return lineas.filter(l => l !== null).join("\n");
};
