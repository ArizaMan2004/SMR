// @/lib/services/subitems-service.ts
//
// SUB-ÍTEMS INTERNOS DE UN PRESUPUESTO.
//
// El problema que resuelven:
//
// En el mostrador un presupuesto se escribe como lo entiende el cliente —
// "Señalización completa del local, $450" — y eso es lo único que sale en el
// PDF. Pero el sistema, al facturar ese renglón, no tiene ni idea de qué se
// gastó: si fueron 12 m² de vinil impreso, si hubo corte láser, ni de qué
// material salió. El resultado es que el balance no cuenta los metros
// impresos y el stock de rollos nunca cuadra.
//
// Un sub-ítem es el desglose interno de ese renglón: qué material del
// catálogo se usó, en qué servicio derivado y cuántos metros cuadrados.
//
// TRES REGLAS QUE NO SE TOCAN:
//
//   1. Los sub-ítems NO salen en ningún PDF. Nunca. El generador solo lee
//      descripcion / cantidad / precio del ítem, así que basta con no
//      añadirlos ahí — pero conviene tenerlo escrito.
//   2. Son independientes del precio. El renglón sigue valiendo lo que dice
//      el presupuesto; esto solo dice de dónde salió la mercancía.
//   3. Se pueden rellenar antes o después de facturar. Un presupuesto viejo
//      sin clasificar se puede clasificar hoy y el balance se corrige.

import type { ConsumoMaterial } from "@/lib/services/catalog-service";

export interface SubItemInterno {
    id: string;
    productoId: string;
    productoNombre: string;
    /** El servicio derivado: "Impresión en vinil mate", "Stickers"… */
    varianteId?: string;
    varianteNombre?: string;
    tipoVenta: "unidad" | "metro_cuadrado";

    /** Piezas. Para material por m², cuántas veces entra esa medida. */
    cantidad: number;
    anchoCm?: number;
    altoCm?: number;
    /** Los m² que de verdad salieron del rollo. Es el dato del balance. */
    m2Total: number;

    nota?: string;
}

export const nuevoSubItemId = () =>
    `si_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Metros cuadrados de una pieza por su medida en centímetros.
 *
 * Se redondea a cuatro decimales: con dos, un adhesivo de 10x5 cm se quedaba
 * en 0,01 m² y multiplicado por mil piezas el error ya era de metros.
 */
export const m2DeMedida = (anchoCm: number, altoCm: number, cantidad: number): number => {
    const ancho = Number(anchoCm) || 0;
    const alto = Number(altoCm) || 0;
    const uds = Number(cantidad) || 0;
    if (ancho <= 0 || alto <= 0 || uds <= 0) return 0;
    return Math.round(((ancho / 100) * (alto / 100) * uds) * 10000) / 10000;
};

export const m2DeSubItems = (subItems?: SubItemInterno[]): number =>
    (subItems || []).reduce((t, s) => t + (Number(s.m2Total) || 0), 0);

/**
 * ¿Este renglón está sin clasificar?
 *
 * Es la pregunta que dispara el aviso en pantalla. Un renglón sin sub-ítems es
 * dinero facturado del que no sabemos qué material consumió.
 */
export const sinClasificar = (item: { subItems?: SubItemInterno[] }): boolean =>
    !item?.subItems || item.subItems.length === 0;

/** Cuántos renglones de un presupuesto siguen sin desglosar. */
export const itemsSinClasificar = (budget: { items?: any[] }): number =>
    (budget?.items || []).filter(sinClasificar).length;

/**
 * Consumo de material declarado en los presupuestos, en el mismo formato que
 * devuelve `consumoPorMaterial` para las ventas del catálogo.
 *
 * Que las dos fuentes hablen el mismo idioma es lo que permite a Estadísticas
 * sumarlas sin tratarlas como cosas distintas: al final del mes el vinil que
 * salió por una venta de mostrador y el que salió por un presupuesto grande
 * salieron del mismo rollo.
 */
export const consumoDesdePresupuestos = (budgets: { items?: any[] }[]): ConsumoMaterial[] => {
    const mapa = new Map<string, ConsumoMaterial>();

    budgets.forEach(budget => {
        (budget?.items || []).forEach((item: any) => {
            (item?.subItems || []).forEach((sub: SubItemInterno) => {
                if (!sub?.productoId) return;

                if (!mapa.has(sub.productoId)) {
                    mapa.set(sub.productoId, {
                        productoId: sub.productoId,
                        productoNombre: sub.productoNombre || "Sin nombre",
                        m2Totales: 0,
                        unidadesTotales: 0,
                        // Los sub-ítems no llevan precio a propósito: el importe
                        // vive en el renglón del presupuesto y repartirlo entre
                        // los sub-ítems sería inventarse un reparto.
                        ingresosUSD: 0,
                        porServicio: [],
                    });
                }

                const material = mapa.get(sub.productoId)!;
                const m2 = Number(sub.m2Total) || 0;
                const uds = Number(sub.cantidad) || 0;

                material.m2Totales += m2;
                material.unidadesTotales += uds;

                const clave = sub.varianteId || "__base__";
                let servicio = material.porServicio.find(s => s.varianteId === clave);
                if (!servicio) {
                    servicio = {
                        varianteId: clave,
                        nombre: sub.varianteNombre || "Sin servicio derivado",
                        m2: 0, unidades: 0, ingresosUSD: 0,
                    };
                    material.porServicio.push(servicio);
                }
                servicio.m2 += m2;
                servicio.unidades += uds;
            });
        });
    });

    const salida = Array.from(mapa.values());
    salida.forEach(m => m.porServicio.sort((a, b) => (b.m2 - a.m2) || (b.unidades - a.unidades)));
    return salida.sort((a, b) => (b.m2Totales - a.m2Totales) || (b.unidadesTotales - a.unidadesTotales));
};

/** Une dos listas de consumo (ventas del catálogo + presupuestos) en una sola. */
export const unirConsumos = (...listas: ConsumoMaterial[][]): ConsumoMaterial[] => {
    const mapa = new Map<string, ConsumoMaterial>();

    listas.flat().forEach(entrada => {
        if (!mapa.has(entrada.productoId)) {
            mapa.set(entrada.productoId, {
                ...entrada,
                porServicio: entrada.porServicio.map(s => ({ ...s })),
            });
            return;
        }

        const acumulado = mapa.get(entrada.productoId)!;
        acumulado.m2Totales += entrada.m2Totales;
        acumulado.unidadesTotales += entrada.unidadesTotales;
        acumulado.ingresosUSD += entrada.ingresosUSD;

        entrada.porServicio.forEach(s => {
            const previo = acumulado.porServicio.find(x => x.varianteId === s.varianteId);
            if (previo) {
                previo.m2 += s.m2;
                previo.unidades += s.unidades;
                previo.ingresosUSD += s.ingresosUSD;
            } else {
                acumulado.porServicio.push({ ...s });
            }
        });
    });

    const salida = Array.from(mapa.values());
    salida.forEach(m => m.porServicio.sort((a, b) => (b.m2 - a.m2) || (b.unidades - a.unidades)));
    return salida.sort((a, b) => (b.m2Totales - a.m2Totales) || (b.ingresosUSD - a.ingresosUSD));
};
