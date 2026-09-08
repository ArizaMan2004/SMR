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
}

/**
 * Los grupos donde el bot ya recibió algo.
 *
 * Copiar el id de un grupo a mano es donde todo el mundo se equivoca. Esto lo
 * pregunta y devuelve la lista con sus nombres, para elegir en vez de teclear.
 */
export const descubrirChats = async (): Promise<{ chats: ChatDescubierto[]; error?: string }> => {
    try {
        const res = await fetch("/api/telegram", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { chats: [], error: data?.error || `Error ${res.status}` };
        return { chats: data?.chats || [] };
    } catch (e: any) {
        return { chats: [], error: e?.message || "Sin conexión" };
    }
};

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
