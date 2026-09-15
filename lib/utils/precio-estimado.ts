// @/lib/utils/precio-estimado.ts
//
// LA CUENTA DEL PRECIO ESTIMADO.
//
// Es la cuenta que un administrador con experiencia hace de cabeza y uno nuevo
// no sabe hacer: cuánto me costó cada metro, cada unidad, cada pieza del lote,
// y cuánto le pongo encima. Está aparte de la pantalla para poder comprobarla
// sin abrir el navegador.
//
// EL MARGEN ES SOBRE EL COSTO
//
// "Ganarle un 30 %" se entiende de dos maneras y dan precios distintos:
//
//   sobre el costo:  costó $10 → se vende a $13,00
//   sobre la venta:  costó $10 → se vende a $14,29 (el 30 % de 14,29 es ganancia)
//
// Aquí es sobre el costo, que es como se dice en el taller y como ya calcula
// el precio sugerido de las compras por lote. Las dos cifras no pueden
// convivir sin decir cuál es cuál, así que la pantalla lo explica.

export type FormaDeCompra = "rollo" | "unidad" | "lote";

export interface DatosEstimacion {
    forma: FormaDeCompra;
    /** Lo que costó: el rollo entero, una unidad o el lote entero. */
    costo: number;
    /** Rollo: metros de largo. */
    largoM?: number;
    /** Rollo: metros de ancho. */
    anchoM?: number;
    /** Lote: cuántas unidades trae. */
    unidades?: number;
    /** Porcentaje que se le gana sobre el costo. */
    margenPct: number;
    /**
     * Se vende por metro lineal y no por metro cuadrado.
     *
     * Del rollo se gasta el ancho entero aunque la pieza sea estrecha, así que
     * lo que cuenta es lo que cuesta cada metro de largo.
     */
    porMetroLineal?: boolean;
}

export interface Estimacion {
    /** Lo que costó UNA unidad de venta: un m², un metro lineal o una pieza. */
    costoUnitario: number;
    /** A cinco céntimos: nadie cobra 3,3267. */
    precioSugerido: number;
    gananciaPorUnidad: number;
    /** "m²", "m.l." o "und". */
    unidad: string;
}

/** El margen con el que arranca. Es una guía, no una regla. */
export const MARGEN_RECOMENDADO = 30;

const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
};

/**
 * Qué falta para poder estimar, o null si está todo.
 *
 * Se dice en palabras: "falta el largo del rollo" se corrige; un precio en
 * cero no se entiende.
 */
export const faltaParaEstimar = (d: Partial<DatosEstimacion>): string | null => {
    if (!(n(d.costo) > 0)) {
        return d.forma === "rollo" ? "¿Cuánto costó el rollo?"
            : d.forma === "lote" ? "¿Cuánto costó el lote?"
                : "¿Cuánto costó cada unidad?";
    }
    if (d.forma === "rollo") {
        if (!(n(d.largoM) > 0)) return "¿Cuántos metros de largo trae el rollo?";
        if (!d.porMetroLineal && !(n(d.anchoM) > 0)) return "¿Cuánto mide de ancho?";
    }
    if (d.forma === "lote" && !(n(d.unidades) > 0)) return "¿Cuántas unidades trae el lote?";
    return null;
};

export const estimarPrecio = (d: DatosEstimacion): Estimacion | null => {
    if (faltaParaEstimar(d)) return null;

    const costo = n(d.costo);
    let costoUnitario: number;
    let unidad = "und";

    if (d.forma === "rollo") {
        if (d.porMetroLineal) {
            costoUnitario = costo / n(d.largoM);
            unidad = "m.l.";
        } else {
            costoUnitario = costo / (n(d.largoM) * n(d.anchoM));
            unidad = "m²";
        }
    } else if (d.forma === "lote") {
        costoUnitario = costo / n(d.unidades);
    } else {
        costoUnitario = costo;
    }

    const margen = Math.max(0, Number(d.margenPct) || 0);
    const precioSugerido = Math.round(costoUnitario * (1 + margen / 100) * 20) / 20;

    return {
        costoUnitario: Math.round(costoUnitario * 10000) / 10000,
        precioSugerido,
        gananciaPorUnidad: Math.round((precioSugerido - costoUnitario) * 100) / 100,
        unidad,
    };
};
