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
import { materialDeDescripcion } from "@/lib/services/auditoria-materiales";

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
        // Lo estimado se arrastra al unir: si se pierde aqui, el balance
        // presenta como confirmado un numero que en parte esta deducido.
        acumulado.m2Estimados = (acumulado.m2Estimados || 0) + (entrada.m2Estimados || 0);
        acumulado.renglonesEstimados = (acumulado.renglonesEstimados || 0) + (entrada.renglonesEstimados || 0);

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

/**
 * Consumo declarado en las ORDENES ya facturadas, en el mismo formato que las
 * otras dos fuentes.
 *
 * Solo cuenta los renglones auditados. Un renglon sin `materialAuditado` no
 * suma nada: preferimos un total que se queda corto y lo dice, a uno inflado
 * con suposiciones. Cuantos faltan lo dice `renglonesSinAuditar`.
 */
export const consumoDesdeOrdenes = (ordenes: { items?: any[] }[]): ConsumoMaterial[] => {
    const mapa = new Map<string, ConsumoMaterial>();

    ordenes.forEach(orden => {
        (orden?.items || []).forEach((item: any) => {
            /**
             * QUE MATERIAL GASTO ESTE RENGLON.
             *
             * Primero lo confirmado. Si nadie lo confirmo, se deduce de la
             * descripcion con las mismas reglas de la auditoria y se marca
             * como estimado.
             *
             * Antes se descartaba: un renglon sin auditar valia cero. Como
             * casi ninguno esta auditado, el balance ensenaba 0,00 m2 teniendo
             * "banner matte quince años, 90x170" delante. Un cero es una
             * afirmacion —"no se imprimio nada"— y era falsa; un estimado
             * marcado dice lo que sabe y lo que no.
             *
             * Auditar no cambia el numero: lo confirma.
             */
            const aud = item?.materialAuditado;
            const estimado = !aud?.nombre;

            const nombreMaterial = aud?.nombre || materialDeDescripcion(item?.nombre || item?.descripcion || "");
            if (!nombreMaterial) return;

            const m2Deducido = (() => {
                const x = Number(item?.medidaXCm) || 0;
                const y = Number(item?.medidaYCm) || 0;
                const c = Number(item?.cantidad) || 0;
                if (x <= 0 || y <= 0 || c <= 0) return 0;
                return Math.round((x / 100) * (y / 100) * c * 10000) / 10000;
            })();

            // Sin id de catalogo se agrupa por nombre: el material puede no
            // estar dado de alta todavia y aun asi hay que contarlo.
            const clave = aud?.productoId || `nombre:${nombreMaterial}`;

            if (!mapa.has(clave)) {
                mapa.set(clave, {
                    productoId: clave,
                    productoNombre: nombreMaterial,
                    m2Totales: 0,
                    unidadesTotales: 0,
                    ingresosUSD: 0,
                    m2Estimados: 0,
                    renglonesEstimados: 0,
                    porServicio: [],
                });
            }

            const material = mapa.get(clave)!;
            const m2 = estimado ? m2Deducido : (Number(aud.m2) || 0);
            const uds = Number(item.cantidad) || 0;

            material.m2Totales += m2;
            material.unidadesTotales += uds;
            material.ingresosUSD += Number(item.subtotal) || 0;

            if (estimado) {
                material.m2Estimados = (material.m2Estimados || 0) + m2;
                material.renglonesEstimados = (material.renglonesEstimados || 0) + 1;
            }

            // El laminado se sigue como servicio aparte del material base: son
            // los mismos metros de vinil, pero gastan ademas rollo de laminado.
            const nombreServicio = aud?.laminado ? "Con laminado" : "Impresion";
            let servicio = material.porServicio.find(x => x.nombre === nombreServicio);
            if (!servicio) {
                servicio = { varianteId: nombreServicio, nombre: nombreServicio, m2: 0, unidades: 0, ingresosUSD: 0 };
                material.porServicio.push(servicio);
            }
            servicio.m2 += m2;
            servicio.unidades += uds;
            servicio.ingresosUSD += Number(item.subtotal) || 0;
        });
    });

    const salida = Array.from(mapa.values());
    salida.forEach(m => m.porServicio.sort((a, b) => (b.m2 - a.m2) || (b.unidades - a.unidades)));
    return salida.sort((a, b) => (b.m2Totales - a.m2Totales) || (b.ingresosUSD - a.ingresosUSD));
};

/** Renglones de estas ordenes que todavia no dicen que material gastaron. */
export const renglonesSinAuditar = (ordenes: { items?: any[] }[]): number =>
    ordenes.reduce((t, o) => t + (o?.items || []).filter((i: any) => !i?.materialAuditado?.nombre).length, 0);
