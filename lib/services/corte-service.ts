// @/lib/services/corte-service.ts
//
// EN QUÉ SE FUE LA MÁQUINA DE CORTE.
//
// El balance sabe cuántos metros de vinil se imprimieron, pero del láser no
// sabía nada: cuánto tiempo estuvo encendido, sobre qué material, y qué se
// pidió más. Sin eso no se puede responder a lo único que importa para
// comprar — de qué plancha hay que tener siempre y de cuál no.
//
// SE MIDE EN DOS UNIDADES PORQUE SE COBRA DE DOS MANERAS
//
// Un corte se factura por TIEMPO de máquina o por SERVICIO (tanto la pieza).
// Sumar las dos cosas en un número daría un total que no significa nada, así
// que cada material lleva sus minutos y sus piezas por separado:
//
//   MINUTOS   lo que ocupó la máquina. Es lo que dice qué material la tiene
//             parada más rato, que es el coste real de la hora de láser.
//   PIEZAS    cuántas se pidieron. Es lo que dice qué plancha se gasta.
//
// Un material puede ser el primero en minutos y el último en piezas: una sola
// pieza grande de MDF puede llevar más láser que doscientas medallas.
//
// LO QUE PONE EL CLIENTE NO ES NUESTRO GASTO
//
// Cuando la plancha la trae el cliente se cobra solo el tiempo, y ese trabajo
// NO consume nuestro material. Se cuenta aparte: mezclarlo haría creer que hay
// que reponer un acrílico que nunca salió del almacén.
//
// PERO SOLO SE CUENTA CUANDO ALGUIEN LO DIJO
//
// Las órdenes de antes no llevan esa pregunta. Tienen `suministrarMaterial` en
// falso, que en su momento solo quería decir "no sumes un costo extra", no "la
// trajo el cliente". Leerlo como lo segundo pintaba un "31 de 31 con material
// del cliente" que era falso de cabo a rabo.
//
// Por eso manda `materialDelCliente`, que solo existe si alguien lo eligió. Sin
// él, el trabajo va a `sinEspecificar` y la pantalla lo dice. Un hueco
// reconocido se rellena; un dato inventado se cree.

/** Un ítem de orden, con lo poco que hace falta mirar de él. */
interface ItemCorte {
    tipoServicio?: string;
    materialDeCorte?: string;
    grosorMaterial?: string;
    colorAcrilico?: string;
    modoCobroLaser?: string;
    tiempoCorte?: string;
    cantidad?: number;
    subtotal?: number;
    /** Elegido a mano en el formulario. Ausente en todo lo anterior. */
    materialDelCliente?: boolean | null;
}

interface OrdenConItems {
    items?: ItemCorte[];
    fecha?: string;
}

export interface DetalleCorte {
    /** "3mm · Transparente", o lo que haya. */
    clave: string;
    grosor: string;
    color: string;
    minutos: number;
    piezas: number;
    ingresosUSD: number;
}

export interface ConsumoCorte {
    material: string;
    minutos: number;
    piezas: number;
    ingresosUSD: number;
    /** Piezas en las que la plancha la puso el cliente, dicho expresamente. */
    piezasDelCliente: number;
    minutosDelCliente: number;
    /** Piezas de antes de que se preguntara. No se les atribuye dueño. */
    piezasSinEspecificar: number;
    /** Cuántos renglones lo usaron. Un material con muchos trabajos pequeños
     *  y otro con uno grande no se gestionan igual. */
    trabajos: number;
    detalle: DetalleCorte[];
}

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Los minutos que dice `tiempoCorte`.
 *
 * Se guarda como "H:MM:SS" cuando pasa de la hora y como "M:SS" cuando no, así
 * que el número de trozos es lo que distingue un formato del otro. Cualquier
 * otra cosa —"Servicio", vacío, algo escrito a mano— vale cero: es un corte
 * que no se cobró por tiempo, no un corte de duración desconocida.
 */
export const minutosDeCorte = (tiempo?: string): number => {
    const t = String(tiempo || "").trim();
    if (!t || !/^\d+(:\d+)+$/.test(t)) return 0;

    const partes = t.split(":").map(x => Number(x) || 0);
    const [h, m, s] = partes.length === 3 ? partes : [0, partes[0], partes[1]];
    return h * 60 + m + s / 60;
};

/** Cómo se llama un material que no dice cuál es. */
const SIN_DECIR = "Sin especificar";

/**
 * Reparte lo cortado por material.
 *
 * Ordena por minutos y, a igualdad, por piezas: la pregunta que se hace
 * primero es cuál tiene la máquina ocupada.
 */
export const consumoDeCorte = (ordenes: OrdenConItems[]): ConsumoCorte[] => {
    const porMaterial = new Map<string, ConsumoCorte>();

    for (const orden of ordenes || []) {
        for (const item of orden?.items || []) {
            if (item?.tipoServicio !== "CORTE") continue;

            const material = String(item.materialDeCorte || "").trim() || SIN_DECIR;
            const grosor = String(item.grosorMaterial || "").trim();
            const color = String(item.colorAcrilico || "").trim();

            const piezas = num(item.cantidad) || 1;
            // El tiempo se guarda POR PIEZA —así se cobra— así que la máquina
            // estuvo ocupada eso multiplicado por las copias.
            const minutos = minutosDeCorte(item.tiempoCorte) * piezas;
            const ingresos = num(item.subtotal);

            // Tres estados, no dos: suyo, nuestro, y "no consta".
            const loPusoElCliente = item.materialDelCliente === true;
            const sinConstar = item.materialDelCliente == null;

            let m = porMaterial.get(material);
            if (!m) {
                m = {
                    material,
                    minutos: 0, piezas: 0, ingresosUSD: 0,
                    piezasDelCliente: 0, minutosDelCliente: 0,
                    piezasSinEspecificar: 0,
                    trabajos: 0, detalle: [],
                };
                porMaterial.set(material, m);
            }

            m.minutos += minutos;
            m.piezas += piezas;
            m.ingresosUSD += ingresos;
            m.trabajos += 1;
            if (loPusoElCliente) {
                m.piezasDelCliente += piezas;
                m.minutosDelCliente += minutos;
            } else if (sinConstar) {
                m.piezasSinEspecificar += piezas;
            }

            const clave = [grosor, color].filter(Boolean).join(" · ") || SIN_DECIR;
            let d = m.detalle.find(x => x.clave === clave);
            if (!d) {
                d = { clave, grosor, color, minutos: 0, piezas: 0, ingresosUSD: 0 };
                m.detalle.push(d);
            }
            d.minutos += minutos;
            d.piezas += piezas;
            d.ingresosUSD += ingresos;
        }
    }

    const salida = [...porMaterial.values()];
    salida.forEach(m => {
        m.minutos = Math.round(m.minutos * 100) / 100;
        m.minutosDelCliente = Math.round(m.minutosDelCliente * 100) / 100;
        m.ingresosUSD = Math.round(m.ingresosUSD * 100) / 100;
        m.detalle.forEach(d => {
            d.minutos = Math.round(d.minutos * 100) / 100;
            d.ingresosUSD = Math.round(d.ingresosUSD * 100) / 100;
        });
        m.detalle.sort((a, b) => (b.minutos - a.minutos) || (b.piezas - a.piezas));
    });

    return salida.sort((a, b) => (b.minutos - a.minutos) || (b.piezas - a.piezas));
};

/** "2 h 15 min", "45 min", "3 min". Cero se dice, no se esconde. */
export const tiempoLegible = (minutos: number): string => {
    const m = Math.round(num(minutos));
    if (m <= 0) return "—";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const resto = m % 60;
    return resto ? `${h} h ${resto} min` : `${h} h`;
};
