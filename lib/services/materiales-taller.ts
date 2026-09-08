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

export interface ColorMaterial {
    id: string;
    nombre: string;
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

const c = (nombre: string): ColorMaterial => ({
    id: `co_${nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W/g, "")}`,
    nombre,
});

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
        grosores: [g("2mm"), g("3mm"), g("5mm"), g("6mm"), g("9mm")],
        colores: [
            c("Transparente"), c("Blanco"), c("Negro"), c("Espejo"),
            c("Dorado"), c("Azul"), c("Rojo"), c("Verde"), c("Amarillo"),
            c("Turquesa"), c("Fucsia"), c("Rosado"), c("Morado"),
            c("Naranja"), c("Gris"), c("Bronce"),
        ],
    },
    {
        id: "mat_mdf",
        nombre: "MDF",
        seCorta: true,
        // El MDF crudo no viene en colores: pedirlos sería inventarse un dato.
        grosores: [g("3mm"), g("5mm"), g("9mm"), g("12mm")],
        colores: [],
    },
    {
        id: "mat_melamina",
        nombre: "Melamina",
        seCorta: true,
        grosores: [g("3mm"), g("5mm"), g("9mm")],
        colores: [c("Blanco"), c("Negro"), c("Madera")],
    },
    {
        id: "mat_cartulina",
        nombre: "Cartulina",
        seCorta: true,
        // Se mide en gramos, no en milímetros; el formulario no pide grosor.
        grosores: [],
        colores: [c("Blanco"), c("Negro"), c("Kraft")],
    },
    {
        id: "mat_pvc",
        nombre: "PVC (espumado)",
        seCorta: true,
        sePega: true,
        grosores: [g("3mm", 0), g("5mm", 0)],
        colores: [c("Blanco"), c("Negro")],
    },
    {
        id: "mat_pvc_rigido",
        nombre: "PVC Rígido",
        seCorta: true,
        sePega: true,
        grosores: [g("3mm", 0), g("5mm", 0)],
        colores: [c("Blanco"), c("Transparente")],
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
