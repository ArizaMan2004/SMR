// @/lib/services/perfil-apariencia.ts
//
// LA CARA DE CADA CUENTA.
//
// Todo el mundo veía el mismo cuadrito azul con dos letras. En un taller donde
// seis personas comparten pantallas, mirar la esquina y no saber de un vistazo
// con qué cuenta estás abierto es como para registrar un pago a nombre de
// otro.
//
// Aquí vive lo que hace reconocible una cuenta: su foto y su color. Se guarda
// en el documento de la propia persona —`usuarios/{uid}`— porque es suyo: cada
// quien elige el suyo y nadie pisa el del otro.
//
// EL DEGRADADO NO ES ADORNO
//
// Una foto no siempre hay. Las iniciales sobre un degradado propio distinguen
// igual de rápido y no dependen de que alguien suba nada: el verde es Daniela
// y el naranja es Pedro, y eso se aprende en dos días.

import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export interface AparienciaPerfil {
    /** Foto subida a Cloudinary. Sin ella se usan las iniciales. */
    fotoUrl?: string;
    /** Los dos extremos del degradado, en hex. */
    colorDesde?: string;
    colorHasta?: string;
}

/**
 * Degradados de fábrica.
 *
 * Se eligen de una lista y no de una rueda de color por una razón práctica:
 * la mitad de los colores que uno escoge a mano dejan las letras blancas
 * ilegibles encima. Estos están comprobados con texto blanco.
 */
export const DEGRADADOS: { id: string; nombre: string; desde: string; hasta: string }[] = [
    { id: "azul", nombre: "Azul", desde: "#2563eb", hasta: "#4f46e5" },
    { id: "indigo", nombre: "Índigo", desde: "#4f46e5", hasta: "#9333ea" },
    { id: "morado", nombre: "Morado", desde: "#7c3aed", hasta: "#db2777" },
    { id: "rosa", nombre: "Rosa", desde: "#db2777", hasta: "#f43f5e" },
    { id: "rojo", nombre: "Rojo", desde: "#dc2626", hasta: "#ea580c" },
    { id: "naranja", nombre: "Naranja", desde: "#ea580c", hasta: "#f59e0b" },
    { id: "ambar", nombre: "Ámbar", desde: "#d97706", hasta: "#65a30d" },
    { id: "verde", nombre: "Verde", desde: "#16a34a", hasta: "#0d9488" },
    { id: "esmeralda", nombre: "Esmeralda", desde: "#059669", hasta: "#0891b2" },
    { id: "cian", nombre: "Cian", desde: "#0891b2", hasta: "#2563eb" },
    { id: "pizarra", nombre: "Pizarra", desde: "#334155", hasta: "#0f172a" },
    { id: "cobre", nombre: "Cobre", desde: "#b45309", hasta: "#78350f" },
];

/** El de fábrica, el mismo azul de siempre: nadie pierde su aspecto al migrar. */
export const DEGRADADO_POR_DEFECTO = DEGRADADOS[0];

/**
 * Un degradado estable a partir del nombre.
 *
 * Mientras nadie elige, cada quien ya sale de un color distinto en vez de
 * salir todos azules. Es el mismo siempre para la misma persona: si cambiara
 * en cada carga no serviría para reconocer a nadie.
 */
export const degradadoDeNombre = (nombre?: string) => {
    const texto = String(nombre || "").trim().toLowerCase();
    if (!texto) return DEGRADADO_POR_DEFECTO;

    let suma = 0;
    for (let i = 0; i < texto.length; i++) suma = (suma * 31 + texto.charCodeAt(i)) >>> 0;
    return DEGRADADOS[suma % DEGRADADOS.length];
};

/** Los dos colores que le tocan a esta cuenta, elegidos o deducidos. */
export const coloresDe = (
    apariencia?: AparienciaPerfil,
    nombre?: string
): { desde: string; hasta: string } => {
    if (apariencia?.colorDesde && apariencia?.colorHasta) {
        return { desde: apariencia.colorDesde, hasta: apariencia.colorHasta };
    }
    const d = degradadoDeNombre(nombre);
    return { desde: d.desde, hasta: d.hasta };
};

/** El CSS listo para pegar en un style. */
export const fondoDegradado = (apariencia?: AparienciaPerfil, nombre?: string): string => {
    const { desde, hasta } = coloresDe(apariencia, nombre);
    return `linear-gradient(135deg, ${desde} 0%, ${hasta} 100%)`;
};

/**
 * Las iniciales.
 *
 * Con nombre y apellido, una de cada uno. Con uno solo, las dos primeras
 * letras: "SA" se lee mejor que una "S" sola perdida en un círculo.
 */
export const inicialesDe = (nombre?: string, apellido?: string): string => {
    const n = String(nombre || "").trim();
    const a = String(apellido || "").trim();

    if (n && a) return (n[0] + a[0]).toUpperCase();
    if (n.length >= 2) return n.slice(0, 2).toUpperCase();
    if (n) return n[0].toUpperCase();
    return "?";
};

/** El nombre de pila, que es como se saluda a alguien. */
export const nombreDePila = (nombre?: string): string => {
    const n = String(nombre || "").trim().split(/\s+/)[0] || "";
    if (!n) return "";
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};

export const guardarApariencia = async (uid: string, apariencia: AparienciaPerfil) => {
    // Se omiten los campos vacíos: Firestore rechaza undefined y tumbaría el
    // guardado entero por un color sin elegir.
    const limpio: Record<string, string> = {};
    if (apariencia.fotoUrl) limpio.fotoUrl = apariencia.fotoUrl;
    if (apariencia.colorDesde) limpio.colorDesde = apariencia.colorDesde;
    if (apariencia.colorHasta) limpio.colorHasta = apariencia.colorHasta;

    await updateDoc(doc(db, "usuarios", uid), limpio);
};

/** Quita la foto y deja las iniciales. */
export const quitarFoto = async (uid: string) => {
    await updateDoc(doc(db, "usuarios", uid), { fotoUrl: "" });
};

export const cargarApariencia = async (uid: string): Promise<AparienciaPerfil> => {
    try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        const d = snap.exists() ? (snap.data() as any) : {};
        return { fotoUrl: d.fotoUrl, colorDesde: d.colorDesde, colorHasta: d.colorHasta };
    } catch {
        return {};
    }
};
