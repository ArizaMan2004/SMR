// @/lib/utils/extras-impresion.ts
//
// LOS EXTRAS DE UNA IMPRESIÓN: corte, pegado, laminado, ojales...
//
// Eran siete casillas escritas en el formulario. Ahora son una lista:
//
//   LOS DE FÁBRICA  →  los siete de siempre. Se renombran y se ocultan, pero
//                      su cálculo no cambia: pegado y laminado tienen su propio
//                      panel de precio y los demás solo quedan anotados. No se
//                      borran, porque hay órdenes que los tienen marcados.
//
//   LOS PROPIOS     →  los crea el negocio, con precio fijo por pieza, por m²
//                      o por metro lineal (del perímetro, del ancho o del alto).
//
// El ítem guarda una copia de cada extra propio que lleva, precio incluido: si
// mañana cambia el precio o se borra el extra, la orden sigue sumando lo que se
// cobró. Por eso el cálculo lee el ítem y no la configuración.
//
// Sin imports a propósito: lo usan el formulario, el asistente de la orden y el
// detalle, y así se prueba solo.

export type CobroExtra = "fijo" | "m2" | "lineal";
export type MedidaLineal = "perimetro" | "ancho" | "alto";

export interface ExtraImpresion {
    id: string;
    nombre: string;
    /** Oculto: no se ofrece, pero los ítems que lo llevan se siguen leyendo. */
    activo?: boolean;
    /** Solo los propios: los de fábrica calculan como siempre. */
    cobro?: CobroExtra;
    medida?: MedidaLineal;
    precio?: number;
}

/** Los siete de siempre. El id es el que lee el formulario; no cambia. */
export const EXTRAS_DE_FABRICA: ExtraImpresion[] = [
    { id: "corte", nombre: "Corte", activo: true },
    { id: "pegado", nombre: "Pegado en rígido", activo: true },
    { id: "laminado", nombre: "Laminado", activo: true },
    { id: "ojales", nombre: "Ojales", activo: true },
    { id: "bolsillos", nombre: "Bolsillos", activo: true },
    { id: "tubos", nombre: "Tubos", activo: true },
    { id: "refilado", nombre: "Refilado", activo: true },
];

export const esExtraDeFabrica = (id: string) => EXTRAS_DE_FABRICA.some(e => e.id === id);

export const COBROS_EXTRA: { id: CobroExtra; label: string }[] = [
    { id: "fijo", label: "Precio fijo por pieza" },
    { id: "m2", label: "Por m²" },
    { id: "lineal", label: "Por metro lineal" },
];

export const MEDIDAS_LINEALES: { id: MedidaLineal; label: string }[] = [
    { id: "perimetro", label: "Del perímetro" },
    { id: "ancho", label: "Del ancho" },
    { id: "alto", label: "Del alto" },
];

export const nuevoIdExtra = () =>
    `extra_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * La lista completa, en su orden.
 *
 * Sin nada guardado, los de fábrica. Si falta alguno de fábrica en lo guardado
 * se añade al final: el formulario cuenta con que los siete existen.
 */
export const extrasDe = (guardados?: ExtraImpresion[] | null): ExtraImpresion[] => {
    const lista = Array.isArray(guardados) && guardados.length ? guardados : EXTRAS_DE_FABRICA;
    const faltan = EXTRAS_DE_FABRICA.filter(f => !lista.some(e => e.id === f.id));
    return [...lista, ...faltan];
};

/** El nombre que ve el negocio para un extra de fábrica. */
export const nombreExtra = (lista: ExtraImpresion[], id: string): string =>
    (lista.find(e => e.id === id)?.nombre || "").trim()
    || EXTRAS_DE_FABRICA.find(e => e.id === id)?.nombre
    || id;

const num = (v: any) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** Lo que suma un extra propio a UNA pieza de esas medidas. */
export const montoExtra = (e: Pick<ExtraImpresion, "cobro" | "medida" | "precio">, xCm: any, yCm: any): number => {
    const precio = num(e?.precio);
    if (precio <= 0) return 0;
    const x = num(xCm) / 100;
    const y = num(yCm) / 100;
    if (e.cobro === "m2") return x * y * precio;
    if (e.cobro === "lineal") {
        const metros = e.medida === "ancho" ? x : e.medida === "alto" ? y : 2 * (x + y);
        return metros * precio;
    }
    return precio;
};

/** Lo que suman los extras propios de un ítem, por pieza. */
export const costoExtrasPorPieza = (item: any): number => {
    const extras = Array.isArray(item?.extrasImpresion) ? item.extrasImpresion : [];
    return extras.reduce((s: number, e: ExtraImpresion) => s + montoExtra(e, item?.medidaXCm, item?.medidaYCm), 0);
};

/** "por m²", "por metro lineal del perímetro"... para leerlo junto al precio. */
export const comoSeCobra = (e: Pick<ExtraImpresion, "cobro" | "medida">): string => {
    if (e.cobro === "m2") return "por m²";
    if (e.cobro === "lineal") {
        const m = MEDIDAS_LINEALES.find(x => x.id === (e.medida || "perimetro"));
        return `por metro lineal ${(m?.label || "Del perímetro").toLowerCase()}`;
    }
    return "por pieza";
};

/** Por qué no vale la lista, o null si vale. */
export const motivoExtrasInvalidos = (lista: ExtraImpresion[]): string | null => {
    const vistos = new Set<string>();
    for (const e of lista) {
        const nombre = String(e.nombre || "").trim();
        if (!nombre) return "Todos los extras necesitan nombre";
        const clave = nombre.toLowerCase();
        if (vistos.has(clave)) return `"${nombre}" está repetido`;
        vistos.add(clave);
        if (!esExtraDeFabrica(e.id)) {
            const p = Number(e.precio);
            if (e.precio !== undefined && e.precio !== null && (!Number.isFinite(p) || p < 0)) {
                return `El precio de "${nombre}" no es válido`;
            }
        }
    }
    return null;
};

/** Lo que se guarda: sin undefined, que Firestore lo rechaza. */
export const limpiarExtras = (lista: ExtraImpresion[]): ExtraImpresion[] =>
    lista.map(e => {
        const base = { id: e.id, nombre: String(e.nombre || "").trim(), activo: e.activo !== false };
        if (esExtraDeFabrica(e.id)) return base;
        const cobro: CobroExtra = e.cobro === "m2" || e.cobro === "lineal" ? e.cobro : "fijo";
        return {
            ...base,
            cobro,
            medida: cobro === "lineal" ? (e.medida || "perimetro") : null as any,
            precio: Math.max(0, num(e.precio)),
        };
    });

/** La copia que guarda el ítem de un extra propio. */
export const copiaParaItem = (e: ExtraImpresion): ExtraImpresion => ({
    id: e.id,
    nombre: e.nombre,
    cobro: e.cobro || "fijo",
    medida: e.cobro === "lineal" ? (e.medida || "perimetro") : null as any,
    precio: Math.max(0, num(e.precio)),
});
