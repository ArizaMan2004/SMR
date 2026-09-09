// @/lib/services/materiales-taller.ts
//
// LOS MATERIALES QUE SE CORTAN Y LOS QUE SE PEGAN.
//
// Estaban escritos a mano en el formulario de ítems: cinco materiales de
// corte, doce grosores del 1mm al 12mm para todos por igual, y una lista de
// colores que no distinguía de qué material eran. En la práctica el acrílico
// viene en colores y el MDF no; el MDF viene en 3, 5 y 9mm y no en 7; y el
// PVC se pega, no se corta.
//
// Ofrecer los doce grosores para todo obliga a quien toma la orden a saberse
// de memoria cuáles existen de verdad, y cuando se equivoca el error queda
// escrito en la orden.
//
// Aquí eso pasa a ser configurable: cada material trae SUS colores y SUS
// grosores. El formulario solo ofrece lo que existe.
//
// PRECIO DEL PEGADO
//
// Una base rígida se cobra por metro cuadrado, y el precio depende del grosor:
// un PVC de 5mm no vale lo mismo que uno de 3mm. Ese precio vive en el grosor,
// así el formulario puede calcular el costo en vez de pedir que se teclee de
// memoria cada vez.
//
// Lo tecleado a mano sigue mandando: esto propone, no impone.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export interface GrosorMaterial {
    /** Estable: queda escrito en las órdenes ya hechas, no se reutiliza. */
    id: string;
    /** Lo que se lee: "3mm", "5mm". */
    nombre: string;
    /**
     * Precio por m² cuando este grosor se usa como base rígida de un pegado.
     *
     * Sin valor, el formulario no propone nada y se teclea a mano, como antes.
     */
    precioPegadoM2?: number;
    activo?: boolean;
}

/**
 * De que tipo es el color, que no es lo mismo que cual es.
 *
 * Un acrilico rojo solido y un rojo translucido son el mismo color y dos
 * materiales distintos: uno tapa y el otro deja pasar la luz. En un aviso con
 * luz detras esa diferencia es TODO el trabajo, asi que separarlos no es
 * cosmetica.
 */
export type FamiliaColor = "solido" | "translucido" | "metalico";

export const FAMILIAS_COLOR: { id: FamiliaColor; label: string }[] = [
    { id: "solido", label: "Solido" },
    { id: "translucido", label: "Translucido" },
    { id: "metalico", label: "Metalizado / Espejo" },
];

export interface ColorMaterial {
    id: string;
    nombre: string;
    /**
     * El color con el que se tine la muestra, en hexadecimal.
     *
     * NO se sube una foto por color. Se sube UNA sola del material en blanco y
     * se pinta con este valor: la textura, los brillos y las sombras son los
     * mismos, y de Cloudinary sale una imagen en vez de dieciseis.
     */
    hex?: string;
    familia?: FamiliaColor;
    activo?: boolean;
}

export interface MaterialTaller {
    id: string;
    /** "Acrílico", "MDF", "PVC Rígido". */
    nombre: string;
    /**
     * Dónde se ofrece.
     *
     * Un material puede cortarse, usarse como base de un pegado, o las dos
     * cosas: el acrílico se corta y también se pega detrás de una impresión.
     */
    seCorta?: boolean;
    sePega?: boolean;
    /**
     * UNA foto del material en BLANCO o gris muy claro.
     *
     * Se reutiliza para todos sus colores tinendola (ver `hex`). Tiene que ser
     * clara: al tenir por multiplicacion, lo oscuro se queda oscuro y un negro
     * no se puede volver amarillo.
     */
    fotoUrl?: string;
    colores: ColorMaterial[];
    grosores: GrosorMaterial[];
    activo?: boolean;
}

export interface ConfigMaterialesTaller {
    materiales?: MaterialTaller[];
    /**
     * Precio por m² del vinil blanco que se pega DETRÁS de una impresión.
     *
     * Un clear sobre acrílico no se ve si no lleva fondo: el blanco es lo que
     * hace que el color se lea. Es material aparte del sustrato y se cobra
     * aparte, así que tiene su propio precio.
     */
    fondoBlancoM2?: number;
    actualizadoEn?: string;
}

const REF = () => doc(db, "configuracion", "materiales_taller");

/** Id legible al depurar y sin choques en la práctica. */
export const nuevoIdMaterial = (p = "mat") =>
    `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const g = (nombre: string, precioPegadoM2?: number): GrosorMaterial => ({
    id: `gr_${nombre.replace(/\W/g, "")}`,
    nombre,
    ...(precioPegadoM2 != null ? { precioPegadoM2 } : {}),
});

const c = (nombre: string, hex?: string, familia: FamiliaColor = "solido"): ColorMaterial => ({
    id: `co_${nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W/g, "")}`,
    nombre,
    ...(hex ? { hex } : {}),
    familia,
});

/**
 * Tonos y familias de los colores que ya estan escritos en las ordenes.
 *
 * Hay instalaciones con los colores guardados de antes, sin tono ni familia.
 * En vez de obligar a reconfigurarlos uno a uno, se deducen del nombre: lo
 * que se lee "Dorado" se pinta dorado. Lo que no este aqui sale en gris, que
 * es honesto —no sabemos de que color es— y se arregla editandolo.
 */
const TONOS: Record<string, { hex: string; familia: FamiliaColor }> = {
    blanco: { hex: "#FFFFFF", familia: "solido" },
    negro: { hex: "#1A1A1A", familia: "solido" },
    gris: { hex: "#8A8F94", familia: "solido" },
    rojo: { hex: "#C4262E", familia: "solido" },
    azul: { hex: "#1E5AA8", familia: "solido" },
    verde: { hex: "#2E7D32", familia: "solido" },
    amarillo: { hex: "#F2C300", familia: "solido" },
    naranja: { hex: "#EE7B21", familia: "solido" },
    turquesa: { hex: "#12A5A5", familia: "solido" },
    fucsia: { hex: "#D4157E", familia: "solido" },
    rosado: { hex: "#E88BAE", familia: "solido" },
    morado: { hex: "#6A3FA0", familia: "solido" },
    madera: { hex: "#B98A55", familia: "solido" },
    kraft: { hex: "#C8A87C", familia: "solido" },
    transparente: { hex: "#DCEAF2", familia: "translucido" },
    ambar: { hex: "#E0A03A", familia: "translucido" },
    humo: { hex: "#6E6E73", familia: "translucido" },
    dorado: { hex: "#C9A227", familia: "metalico" },
    plateado: { hex: "#C0C5CB", familia: "metalico" },
    espejo: { hex: "#C7CDD4", familia: "metalico" },
    bronce: { hex: "#9C6B3F", familia: "metalico" },
};

const sinTildes = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Lo que hay que saber para pintar la muestra de un color. */
export const tonoDeColor = (
    color?: ColorMaterial
): { hex: string; familia: FamiliaColor } => {
    if (!color) return { hex: "#9AA0A6", familia: "solido" };
    if (color.hex) return { hex: color.hex, familia: color.familia || "solido" };

    const limpio = sinTildes(color.nombre || "");
    // Por palabras, para que "Rojo translucido" encuentre a "rojo" y a
    // "translucido" sin tener que estar los dos juntos en la tabla.
    const esTranslucido = /translucid|transparent/.test(limpio);
    for (const palabra of limpio.split(/\s+/)) {
        const t = TONOS[palabra];
        if (t) return { hex: t.hex, familia: esTranslucido ? "translucido" : t.familia };
    }
    return { hex: "#9AA0A6", familia: esTranslucido ? "translucido" : (color.familia || "solido") };
};

/**
 * Lo que hay mientras nadie configure nada.
 *
 * Son los materiales y colores que aparecen de verdad en las órdenes del
 * taller, no una lista de catálogo: si algo está aquí es porque se cortó.
 * Los precios de pegado van en cero a propósito — los pone quien compra.
 */
export const MATERIALES_POR_DEFECTO: MaterialTaller[] = [
    {
        id: "mat_acrilico",
        nombre: "Acrílico",
        seCorta: true,
        sePega: true,
        grosores: [g("1mm"), g("2mm"), g("3mm"), g("5mm"), g("9mm"), g("12mm")],
        colores: [
            // Solidos: tapan la luz.
            c("Blanco", "#FFFFFF"), c("Negro", "#1A1A1A"), c("Gris", "#8A8F94"),
            c("Azul", "#1E5AA8"), c("Rojo", "#C4262E"), c("Verde", "#2E7D32"),
            c("Amarillo", "#F2C300"), c("Naranja", "#EE7B21"),
            c("Turquesa", "#12A5A5"), c("Fucsia", "#D4157E"),
            c("Rosado", "#E88BAE"), c("Morado", "#6A3FA0"),
            // Translucidos: dejan pasar la luz. En un aviso retroiluminado no
            // son un capricho de color, son otro trabajo.
            c("Transparente", "#DCEAF2", "translucido"),
            c("Ambar", "#E0A03A", "translucido"),
            c("Humo", "#6E6E73", "translucido"),
            // Metalizados: no se tinen como los demas, llevan reflejo.
            c("Dorado", "#C9A227", "metalico"),
            c("Plateado", "#C0C5CB", "metalico"),
            c("Espejo", "#C7CDD4", "metalico"),
            c("Bronce", "#9C6B3F", "metalico"),
        ],
    },
    {
        id: "mat_mdf",
        nombre: "MDF",
        seCorta: true,
        // El MDF crudo no viene en colores: pedirlos sería inventarse un dato.
        grosores: [g("2mm"), g("3mm"), g("5mm"), g("9mm"), g("12mm")],
        colores: [],
    },
    {
        id: "mat_melamina",
        nombre: "Melamina",
        seCorta: true,
        grosores: [g("3mm"), g("5mm"), g("9mm")],
        colores: [c("Blanco", "#FFFFFF"), c("Negro", "#1A1A1A"), c("Madera", "#B98A55")],
    },
    {
        id: "mat_cartulina",
        nombre: "Cartulina",
        seCorta: true,
        // Se mide en gramos, no en milímetros; el formulario no pide grosor.
        grosores: [],
        colores: [c("Blanco", "#FFFFFF"), c("Negro", "#1A1A1A"), c("Kraft", "#C8A87C")],
    },
    {
        id: "mat_pvc",
        nombre: "PVC (espumado)",
        // AQUI NO SE CORTA PVC.
        //
        // Sigue existiendo porque se vende y porque es la base rigida de casi
        // todo lo que se pega. Ofrecerlo en el formulario de corte solo serviria
        // para que alguien lo eligiera y mandara al taller algo que no se hace.
        seCorta: false,
        sePega: true,
        grosores: [g("3mm", 0), g("5mm", 0)],
        colores: [c("Blanco", "#FFFFFF"), c("Negro", "#1A1A1A")],
    },
    {
        id: "mat_pvc_rigido",
        nombre: "PVC Rígido",
        seCorta: false,
        sePega: true,
        grosores: [g("3mm", 0), g("5mm", 0)],
        colores: [c("Blanco", "#FFFFFF"), c("Transparente", "#DCEAF2", "translucido")],
    },
];

// ============================================================ lectura

export const subscribeToMaterialesTaller = (
    callback: (c: ConfigMaterialesTaller) => void
) =>
    onSnapshot(
        REF(),
        snap => callback((snap.exists() ? snap.data() : {}) as ConfigMaterialesTaller),
        error => {
            console.error("Error leyendo los materiales del taller:", error);
            callback({});
        }
    );

export const cargarMaterialesTaller = async (): Promise<ConfigMaterialesTaller> => {
    try {
        const snap = await getDoc(REF());
        return (snap.exists() ? snap.data() : {}) as ConfigMaterialesTaller;
    } catch (error) {
        console.error("Error cargando los materiales del taller:", error);
        return {};
    }
};

/**
 * Los materiales que valen, configurados o de fábrica.
 *
 * Sin configuración se devuelven los de fábrica: el formulario nunca se queda
 * sin opciones por no haber pasado antes por Ajustes.
 */
export const materialesDe = (cfg: ConfigMaterialesTaller): MaterialTaller[] => {
    const lista = cfg?.materiales?.length ? cfg.materiales : MATERIALES_POR_DEFECTO;
    return lista.filter(m => m.activo !== false);
};

/** Los que se cortan. */
export const materialesDeCorte = (cfg: ConfigMaterialesTaller): MaterialTaller[] =>
    materialesDe(cfg).filter(m => !!m.seCorta);

/** Los que sirven de base rígida en un pegado. */
export const materialesDePegado = (cfg: ConfigMaterialesTaller): MaterialTaller[] =>
    materialesDe(cfg).filter(m => !!m.sePega);

export const buscarMaterial = (
    cfg: ConfigMaterialesTaller,
    nombre?: string
): MaterialTaller | undefined => {
    if (!nombre) return undefined;
    const limpio = nombre.trim().toLowerCase();
    return materialesDe(cfg).find(m => m.nombre.trim().toLowerCase() === limpio);
};

export const grosoresDe = (m?: MaterialTaller): GrosorMaterial[] =>
    (m?.grosores || []).filter(x => x.activo !== false);

export const coloresDe = (m?: MaterialTaller): ColorMaterial[] =>
    (m?.colores || []).filter(x => x.activo !== false);

/**
 * Lo que cuesta el metro cuadrado de esta base rígida.
 *
 * Cero cuando no está configurado: el formulario lo trata como "no sé" y deja
 * escribir el precio a mano, en vez de proponer un cero que alguien acepte
 * sin mirar.
 */
export const precioPegadoM2 = (
    cfg: ConfigMaterialesTaller,
    material?: string,
    grosor?: string
): number => {
    const m = buscarMaterial(cfg, material);
    if (!m || !grosor) return 0;
    const limpio = grosor.trim().toLowerCase();
    const gr = grosoresDe(m).find(x => x.nombre.trim().toLowerCase() === limpio);
    return Number(gr?.precioPegadoM2) || 0;
};

// ============================================================ escritura

/** Lo que cuesta el m² de fondo blanco. Cero: no configurado. */
export const precioFondoBlancoM2 = (cfg: ConfigMaterialesTaller): number =>
    Number(cfg?.fondoBlancoM2) || 0;

/**
 * Lo que se cobra por montar una impresión sobre un sólido.
 *
 * Se calcula sobre los metros de la pieza: el sustrato se corta a la medida de
 * lo que se pega, así que si la impresión mide 2 m² el PVC mide 2 m².
 *
 * Devuelve cero cuando falta el precio del sustrato. El formulario lo trata
 * como "no sé" y deja escribirlo a mano, en vez de proponer un cero que
 * alguien acepte sin mirar.
 */
export const costoPegado = (
    cfg: ConfigMaterialesTaller,
    opciones: { material?: string; grosor?: string; m2: number; fondoBlanco?: boolean }
): { sustrato: number; fondo: number; total: number } => {
    const m2 = Math.max(0, Number(opciones.m2) || 0);
    const sustrato = precioPegadoM2(cfg, opciones.material, opciones.grosor) * m2;
    const fondo = opciones.fondoBlanco ? precioFondoBlancoM2(cfg) * m2 : 0;
    return {
        sustrato: Math.round(sustrato * 100) / 100,
        fondo: Math.round(fondo * 100) / 100,
        total: Math.round((sustrato + fondo) * 100) / 100,
    };
};

export const guardarMaterialesTaller = async (
    materiales: MaterialTaller[],
    extras?: { fondoBlancoM2?: number }
) => {
    await setDoc(
        REF(),
        { materiales, ...(extras || {}), actualizadoEn: new Date().toISOString() },
        { merge: true }
    );
};
