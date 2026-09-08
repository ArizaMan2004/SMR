// @/lib/services/auditoria-materiales.ts
//
// AUDITORÍA DE MATERIALES DE LAS ÓRDENES.
//
// El problema, medido sobre septiembre de 2026: los 94 renglones del mes
// tenían todos `materialImpresion = "Vinil Brillante"` y
// `materialDeCorte = "Acrilico"`, porque son los valores que el formulario
// pone por defecto y nadie los cambia nunca. El balance daba 55.83 m² de
// vinil cuando 28.39 de esos metros eran banner. Medio mes de banner se
// descontaba del rollo de vinil.
//
// El dato real sí está: en la DESCRIPCIÓN que escribe quien toma la orden
// ("banner matte quince años", "vinil moto") y en las MEDIDAS, que están
// completas en todos los renglones cobrados por m².
//
// Esto lee esas dos cosas y escribe `materialAuditado` en cada renglón.
//
// REGLA QUE NO SE ROMPE: solo se audita lo que la descripción nombra. Un
// renglón llamado "corte" o "negro" no dice de qué material es, y en esos se
// deja el campo vacío para revisarlo a mano. Un material inventado ensucia el
// balance más de lo que lo arregla, y encima sin que se note.
//
// NO TOCA PRECIOS. Solo añade el material.

import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";

/**
 * Palabras que SÍ nombran un material, y a qué producto del catálogo van.
 *
 * `material` es el NOMBRE EXACTO del producto en el catálogo. Antes eran
 * etiquetas inventadas aquí ("Vinil Adhesivo Blanco Brillante", "Banner /
 * Lona") y el balance las agrupaba por nombre, así que el mismo rollo salía
 * dos veces: una por lo que consume el catálogo y otra por lo que decía la
 * auditoría. Dos filas para un solo material es peor que ninguna.
 *
 * Están ordenadas de más específica a más general: "corte mdf 5mm" tiene que
 * caer en MDF, no en el genérico de corte. Con el orden al revés, todo lo que
 * empieza por "corte" acababa en acrílico — incluidos el MDF y la cartulina.
 */
const REGLAS: { patron: RegExp; material: string }[] = [
    { patron: /\bmdf\b|madera|plywood/i,           material: "MDF" },
    { patron: /cartulina/i,                         material: "Cartulina" },
    { patron: /banner|lona|mesh/i,                  material: "Banner" },
    { patron: /\bclear\b/i,                         material: "Clear" },
    { patron: /microperforado/i,                    material: "Microperforado" },
    { patron: /esmerilado/i,                        material: "Vinil Esmerilado" },
    { patron: /sticker|stiker|calcomania/i,         material: "Vinil" },
    { patron: /vinil|vinilo|rotulad|impresi[oó]n/i, material: "Vinil" },
    { patron: /acr[ií]lic|trofeo|medalla/i,         material: "Acrilico" },
    { patron: /ojal/i,                              material: "Ojales" },
];

/** El material que nombra una descripción, o null si no nombra ninguno. */
export const materialDeDescripcion = (descripcion: string): string | null =>
    REGLAS.find(r => r.patron.test(descripcion || ""))?.material ?? null;

/**
 * El id del producto del catálogo que se llama así.
 *
 * Sin id, el balance agrupa por nombre y basta con que alguien renombre el
 * producto para que el histórico se parta en dos. Con id aguanta el cambio de
 * nombre. Un material que todavía no está dado de alta se queda sin id y se
 * cuenta igual, por nombre: es peor perderlo que contarlo sin enlazar.
 */
const idDeCatalogo = (
    material: string | null,
    catalogo: { __id?: string; id?: string; nombre?: string }[]
): string | null => {
    if (!material) return null;
    const limpio = material.trim().toLowerCase();
    const p = catalogo.find(c => (c.nombre || "").trim().toLowerCase() === limpio);
    return p?.__id || p?.id || null;
};

export interface RenglonAuditado {
    ordenId: string;
    ordenNumero: string | number;
    fecha: string;
    cliente: string;
    indice: number;
    descripcion: string;
    material: string | null;
    /** El producto del catálogo, cuando el material está dado de alta. */
    productoId: string | null;
    m2: number;
    laminado: boolean;
    unidad?: string;
    tiempo?: string;
    montoUSD: number;
    /** Ya tenía material auditado de antes. */
    yaAuditado: boolean;
    /**
     * Quién decidió el material.
     *
     * 'auto' lo leyó la máquina de la descripción; 'manual' lo puso una
     * persona. Queda escrito en la orden porque no valen lo mismo: si mañana
     * hay que revisar un número raro, importa saber cuál de los dos lo puso.
     */
    origen?: "auto" | "manual";
}

export interface PlanAuditoria {
    ordenes: number;
    renglones: number;
    /** Los que se pueden auditar solos. */
    automaticos: RenglonAuditado[];
    /** Los que hay que mirar a mano: la descripción no nombra material. */
    manuales: RenglonAuditado[];
    /** Metros y renglones que aporta cada material. */
    porMaterial: { material: string; renglones: number; m2: number }[];
    m2Totales: number;
    /**
     * Lo que se puede elegir a mano para los renglones que la máquina no supo
     * leer.
     *
     * Sale del catálogo real más los materiales que las reglas saben nombrar,
     * para que quien resuelva a mano no tenga que escribir el nombre y
     * arriesgarse a inventar uno que no cuadre con nada.
     */
    opciones: { nombre: string; productoId: string | null }[];
}

const m2De = (item: any): number => {
    const x = Number(item?.medidaXCm) || 0;
    const y = Number(item?.medidaYCm) || 0;
    const c = Number(item?.cantidad) || 0;
    if (x <= 0 || y <= 0 || c <= 0) return 0;
    // Cuatro decimales: con dos, mil adhesivos de 10x5 cm perdían metros enteros.
    return Math.round((x / 100) * (y / 100) * c * 10000) / 10000;
};

const fechaDe = (valor: any): Date => {
    if (typeof valor?.toDate === "function") return valor.toDate();
    return new Date(valor);
};

/**
 * Prepara la auditoría de un mes SIN escribir nada.
 *
 * Se lee de la caché local cuando se puede: el histórico de órdenes ya está
 * descargado y volver a pedirlo al servidor por cada simulación sería pagar
 * lecturas por mirar.
 */
export async function planificarAuditoria(anio: number, mes: number): Promise<PlanAuditoria> {
    const { getDocsFromCache } = await import("firebase/firestore");
    const ref = collection(db, "ordenes");

    let snap;
    try {
        snap = await getDocsFromCache(ref);
        if (snap.empty) snap = await getDocs(ref);
    } catch {
        snap = await getDocs(ref);
    }

    // El catálogo, para enlazar cada material con su producto.
    const catSnap = await (async () => {
        const ref2 = collection(db, "catalogo_productos");
        try {
            const c = await getDocsFromCache(ref2);
            return c.empty ? await getDocs(ref2) : c;
        } catch { return await getDocs(ref2); }
    })();
    const catalogo = catSnap.docs.map(d => ({ __id: d.id, ...(d.data() as any) }));

    const automaticos: RenglonAuditado[] = [];
    const manuales: RenglonAuditado[] = [];

    snap.docs.forEach(d => {
        const orden: any = { id: d.id, ...d.data() };
        const f = fechaDe(orden.fecha);
        if (isNaN(f.getTime()) || f.getFullYear() !== anio || f.getMonth() !== mes) return;

        (orden.items || []).forEach((item: any, indice: number) => {
            const descripcion = String(item?.nombre || "").trim();
            const material = materialDeDescripcion(descripcion);

            const fila: RenglonAuditado = {
                ordenId: d.id,
                ordenNumero: orden.ordenNumero,
                fecha: String(orden.fecha || "").slice(0, 10),
                cliente: orden.cliente?.nombreRazonSocial || "Sin cliente",
                indice,
                descripcion,
                material,
                productoId: idDeCatalogo(material, catalogo),
                m2: m2De(item),
                laminado: /laminado/i.test(item?.materialDetalleCorte || ""),
                unidad: item?.unidad,
                tiempo: typeof item?.tiempoCorte === "string" ? item.tiempoCorte : undefined,
                montoUSD: Number(item?.subtotal) || 0,
                yaAuditado: !!item?.materialAuditado?.nombre,
                origen: material ? "auto" : undefined,
            };

            (material ? automaticos : manuales).push(fila);
        });
    });

    const agrupado = new Map<string, { material: string; renglones: number; m2: number }>();
    automaticos.forEach(r => {
        const previo = agrupado.get(r.material!) || { material: r.material!, renglones: 0, m2: 0 };
        previo.renglones++;
        previo.m2 += r.m2;
        agrupado.set(r.material!, previo);
    });

    // Lo que se puede elegir a mano: primero el catálogo —es lo que de verdad
    // se compra— y detrás los materiales que las reglas nombran pero que
    // todavía no están dados de alta.
    const opciones: { nombre: string; productoId: string | null }[] = [];
    const vistos = new Set<string>();

    const anotar = (nombre: string, productoId: string | null) => {
        const clave = nombre.trim().toLowerCase();
        if (!clave || vistos.has(clave)) return;
        vistos.add(clave);
        opciones.push({ nombre: nombre.trim(), productoId });
    };

    catalogo
        .filter((c: any) => c.activo !== false)
        .forEach((c: any) => anotar(String(c.nombre || ""), c.__id));
    REGLAS.forEach(r => anotar(r.material, idDeCatalogo(r.material, catalogo)));

    const ordenesTocadas = new Set([...automaticos, ...manuales].map(r => r.ordenId));

    return {
        ordenes: ordenesTocadas.size,
        renglones: automaticos.length + manuales.length,
        automaticos,
        manuales,
        porMaterial: Array.from(agrupado.values())
            .map(g => ({ ...g, m2: Math.round(g.m2 * 100) / 100 }))
            .sort((a, b) => b.m2 - a.m2 || b.renglones - a.renglones),
        m2Totales: Math.round(automaticos.reduce((t, r) => t + r.m2, 0) * 100) / 100,
        opciones,
    };
}

/**
 * Escribe el material en los renglones del plan.
 *
 * Se reescribe el array `items` entero porque Firestore no sabe actualizar un
 * elemento suelto de un array. Para no pisar nada, se parte SIEMPRE del
 * documento que hay en el servidor en este momento y solo se le añade el
 * campo nuevo a los renglones que toca.
 */
export async function aplicarAuditoria(plan: PlanAuditoria): Promise<number> {
    const porOrden = new Map<string, RenglonAuditado[]>();
    plan.automaticos.forEach(r => {
        porOrden.set(r.ordenId, [...(porOrden.get(r.ordenId) || []), r]);
    });
    if (porOrden.size === 0) return 0;

    const snap = await getDocs(collection(db, "ordenes"));
    const vigentes = new Map(snap.docs.map(d => [d.id, d.data() as any]));

    const marca = new Date().toISOString();
    const ids = Array.from(porOrden.keys());
    let escritas = 0;

    // Firestore admite 500 operaciones por lote; se parte en 400 por margen.
    for (let i = 0; i < ids.length; i += 400) {
        const lote = writeBatch(db);
        let enLote = 0;

        ids.slice(i, i + 400).forEach(ordenId => {
            const datos = vigentes.get(ordenId);
            if (!datos) return;

            const items = [...(datos.items || [])];
            porOrden.get(ordenId)!.forEach(r => {
                const item = items[r.indice];
                // Si el renglón cambió de sitio o de texto desde que se
                // planificó, se deja en paz: escribirlo sería auditar otra cosa.
                if (!item || String(item.nombre || "").trim() !== r.descripcion) return;

                items[r.indice] = {
                    ...item,
                    materialAuditado: {
                        nombre: r.material,
                        productoId: r.productoId,
                        m2: r.m2,
                        laminado: r.laminado,
                        auditadoEn: marca,
                        origen: r.origen === "manual" ? "manual" : "auto",
                    },
                };
            });

            lote.update(doc(db, "ordenes", ordenId), { items });
            enLote++;
        });

        if (enLote > 0) {
            await lote.commit();
            escritas += enLote;
        }
    }

    return escritas;
}
