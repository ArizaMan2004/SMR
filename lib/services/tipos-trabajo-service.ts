// @/lib/services/tipos-trabajo-service.ts
//
// LOS TIPOS DE TRABAJO: LO QUE SALE EN EL DESPLEGABLE "SERVICIO" DEL ÍTEM.
//
// El desplegable mezclaba dos cosas que no son lo mismo:
//
//   CÓMO SE CALCULA EL PRECIO  →  lógica del programa. Medidas por m², minutos
//                                 de láser, precio × cantidad. No se edita.
//   CÓMO LLAMA EL NEGOCIO A SU  →  Rotulación, Diseño, Medallas, Dibujos...
//   TRABAJO                        Esto sí lo decide quien usa el sistema.
//
// Estaban pegadas y escritas en el código, así que cualquier trabajo nuevo
// obligaba a tocar el programa. Ahora son dos capas: cuatro MODOS DE COBRO
// fijos, y encima los TIPOS, que se crean, renombran, ocultan y ordenan desde
// el Catálogo. Cada tipo elige un modo y un área para las estadísticas.
//
// LO QUE NO SE ROMPE
//
// Estadísticas, Balance, el taller y el pago de diseñadores leen el campo
// clásico `tipoServicio` (IMPRESION, CORTE, VENTA, DISENO, OTROS). Cada ítem lo
// sigue guardando: los tipos de fábrica con su valor de siempre, y los nuevos
// con el que corresponde a su área. Así esas pantallas cuentan igual sin
// cambiar nada de ellas.

import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

export type ModoCobro = "medida" | "laser" | "catalogo" | "libre";
export type AreaTrabajo = "IMPRESION" | "CORTE" | "DISENO" | "OTROS";
/** En modo catálogo, qué se ofrece. */
export type CatalogoDeTipo = "producto" | "servicio" | "ambos";

export interface TipoTrabajo {
    /** Estable: queda escrito en las órdenes. Los de fábrica usan el valor clásico. */
    id: string;
    nombre: string;
    emoji: string;
    modo: ModoCobro;
    area: AreaTrabajo;
    catalogo?: CatalogoDeTipo | null;
    /** Oculto: no se ofrece, pero las órdenes que lo usan se siguen leyendo. */
    activo?: boolean;
    orden?: number;
}

export interface ConfigTiposTrabajo {
    tipos?: TipoTrabajo[];
    actualizadoEn?: string;
}

export const MODOS_COBRO: { id: ModoCobro; label: string; ayuda: string }[] = [
    { id: "medida", label: "Por medida", ayuda: "Ancho × alto, material, laminado, pegado y extras" },
    { id: "laser", label: "Láser", ayuda: "Tiempo o pieza, material, grosor y color" },
    { id: "catalogo", label: "Del catálogo", ayuda: "Se elige un producto o servicio con su precio" },
    { id: "libre", label: "Precio libre", ayuda: "Precio × cantidad" },
];

export const AREAS_TRABAJO: { id: AreaTrabajo; label: string }[] = [
    { id: "IMPRESION", label: "Impresión" },
    { id: "CORTE", label: "Corte" },
    { id: "DISENO", label: "Diseño" },
    { id: "OTROS", label: "Otros" },
];

/**
 * Los de siempre, más Producto y Servicio por separado.
 *
 * Son el punto de partida mientras nadie guarde nada: no se escribe en la base
 * hasta que alguien pulse Guardar en el panel.
 */
export const TIPOS_POR_DEFECTO: TipoTrabajo[] = [
    { id: "IMPRESION", nombre: "Impresión", emoji: "🖨️", modo: "medida", area: "IMPRESION", activo: true },
    { id: "CORTE", nombre: "Corte Láser", emoji: "✂️", modo: "laser", area: "CORTE", activo: true },
    { id: "VENTA", nombre: "Producto", emoji: "🛍️", modo: "catalogo", area: "OTROS", catalogo: "producto", activo: true },
    { id: "SERVICIO", nombre: "Servicio", emoji: "🧰", modo: "catalogo", area: "OTROS", catalogo: "servicio", activo: true },
    { id: "DISENO", nombre: "Diseño", emoji: "🎨", modo: "libre", area: "DISENO", activo: true },
    { id: "ROTULACION", nombre: "Rotulación", emoji: "🚗", modo: "libre", area: "OTROS", activo: true },
    { id: "OTROS", nombre: "Otros", emoji: "📦", modo: "libre", area: "OTROS", activo: true },
];

/** Los valores que ya están escritos en órdenes viejas. */
const IDS_CLASICOS = new Set(["IMPRESION", "CORTE", "VENTA", "DISENO", "ROTULACION", "OTROS"]);

/** De fábrica: se ocultan, no se borran, porque hay órdenes que los usan. */
export const esTipoDeFabrica = (id: string) => TIPOS_POR_DEFECTO.some(t => t.id === id);

export const nuevoIdTipo = () =>
    `tipo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Todos, ocultos incluidos, en su orden. Sin configuración, los de fábrica. */
export const tiposDe = (cfg: ConfigTiposTrabajo): TipoTrabajo[] => {
    const lista = cfg?.tipos?.length ? cfg.tipos : TIPOS_POR_DEFECTO;
    return lista
        .map((t, i) => ({ t, i }))
        .sort((a, b) => ((a.t.orden ?? a.i) - (b.t.orden ?? b.i)))
        .map(x => x.t);
};

/** Los que se ofrecen en el desplegable. */
export const tiposVisibles = (cfg: ConfigTiposTrabajo): TipoTrabajo[] =>
    tiposDe(cfg).filter(t => t.activo !== false);

/**
 * El valor clásico que se guarda en `tipoServicio`.
 *
 * Los de fábrica guardan el suyo. Los nuevos, el de su área; en modo catálogo
 * sin área concreta, VENTA, que es como ya se guardaba lo vendido por unidad.
 */
export const tipoServicioDe = (t: TipoTrabajo): string => {
    if (IDS_CLASICOS.has(t.id)) return t.id;
    if (t.area === "IMPRESION") return "IMPRESION";
    if (t.area === "CORTE") return "CORTE";
    if (t.area === "DISENO") return "DISENO";
    return t.modo === "catalogo" ? "VENTA" : "OTROS";
};

/** La unidad con la que arranca un ítem de ese modo. */
export const unidadInicialDe = (modo: ModoCobro): string =>
    modo === "medida" ? "m2" : modo === "laser" ? "tiempo" : "und";

/**
 * Qué tipo es un ítem.
 *
 * Los ítems nuevos lo dicen (`tipoTrabajoId`). Los viejos solo tienen el valor
 * clásico, y se traducen: CORTE y CORTE_LASER son Corte, lo vendido del
 * catálogo que era un servicio abre como Servicio, etc. Si el tipo se borró,
 * cae en Otros en vez de dejar el formulario sin nada elegido.
 */
export const resolverTipo = (
    tipos: TipoTrabajo[],
    item: any,
    esServicio?: (productoId: string) => boolean
): TipoTrabajo => {
    const buscar = (id: string) =>
        tipos.find(t => t.id === id) || TIPOS_POR_DEFECTO.find(t => t.id === id);

    if (item?.tipoTrabajoId) {
        const t = buscar(item.tipoTrabajoId);
        if (t) return t;
    }

    const clasico = String(item?.tipoServicio || "").trim().toUpperCase();
    const esLaser = clasico === "CORTE" || clasico === "CORTE_LASER";
    const unidad = String(item?.unidad || "");

    // Algo del catálogo vendido por unidad. Al elegirlo, el código antiguo
    // cambiaba el valor clásico al área del producto (IMPRESION o CORTE), así
    // que ese valor ya no dice que fue una venta: lo dice la unidad.
    if (item?.catalogoProductoId && unidad !== "m2" && unidad !== "tiempo" && !esLaser) {
        const id = esServicio?.(item.catalogoProductoId) ? "SERVICIO" : "VENTA";
        return buscar(id)!;
    }

    const id = esLaser ? "CORTE"
        : clasico === "DISEÑO" ? "DISENO"
            : IDS_CLASICOS.has(clasico) ? clasico
                : "OTROS";
    return buscar(id) || buscar("OTROS")!;
};

// ------------------------------------------------------------ lectura y guardado

const REF = () => doc(db, "configuracion", "tipos_trabajo");

export const subscribeToTiposTrabajo = (callback: (c: ConfigTiposTrabajo) => void) =>
    onSnapshot(
        REF(),
        snap => callback((snap.exists() ? snap.data() : {}) as ConfigTiposTrabajo),
        error => {
            console.error("Error leyendo los tipos de trabajo:", error);
            callback({});
        }
    );

/**
 * Guarda la lista entera, con el orden de la pantalla.
 *
 * Firestore rechaza `undefined`, así que lo que no aplica va en null.
 */
export const guardarTiposTrabajo = async (tipos: TipoTrabajo[]) => {
    const limpios = tipos.map((t, i) => ({
        id: t.id,
        nombre: t.nombre.trim(),
        emoji: (t.emoji || "").trim() || "🏷️",
        modo: t.modo,
        area: t.area,
        catalogo: t.modo === "catalogo" ? (t.catalogo || "ambos") : null,
        activo: t.activo !== false,
        orden: i,
    }));
    await setDoc(REF(), { tipos: limpios, actualizadoEn: new Date().toISOString() }, { merge: true });
};
