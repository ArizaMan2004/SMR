// @/lib/services/materia-prima-service.ts
//
// LO QUE HAY EN EL DEPÓSITO.
//
// El Catálogo dice lo que se VENDE. Esto dice lo que se TIENE para poder
// venderlo, que no es lo mismo: nadie compra un rollo de vinil ni un cartucho
// de tinta, pero sin ellos no hay nada que entregar.
//
// Antes esa cuenta no estaba en ningún sitio. El número de rollos vivía dentro
// de la ficha de venta del vinil, como si fuera su stock, y la tinta no vivía
// en ninguna parte: se sabía que se estaba acabando porque se veía la caja.
//
// COMPRAR MATERIA PRIMA ES UN GASTO
//
// Un lote grande de vinil o de tinta es la inversión que se hace para poder
// producir: sale dinero y tiene que verse en los gastos del mes, o el balance
// dice que se ganó más de lo que se ganó.
//
// Por eso "Compra" aquí hace las dos cosas a la vez y en una transacción: sube
// lo que entró al depósito y apunta el gasto en Insumos. O las dos o ninguna:
// existencias que subieron sin gasto detrás son un número que engaña.
//
// OJO CON APUNTAR LA MISMA COMPRA DOS VECES
//
// El "Compra" del Catálogo también manda su gasto a Insumos, porque de ahí
// saca a cómo queda el metro. Son dos puertas al mismo sitio: el mismo rollo
// registrado en las dos saldría dos veces en los gastos. Cada compra se apunta
// en una.

import { db } from "@/lib/firebase";
import {
    addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
    runTransaction, serverTimestamp, updateDoc, Timestamp,
} from "firebase/firestore";

const COL = "materia_prima";
const GASTOS_COL = "gastos_insumos";

/**
 * Cómo viene lo que se compra.
 *
 * No es la unidad en la que se vende nada —esto no se vende—: es en qué se
 * cuenta cuando se mira el estante. Un vinil son rollos, la tinta son
 * cartuchos o litros, los tornillos son cajas.
 */
export type PresentacionInsumo = "rollo" | "unidad" | "cartucho" | "litro" | "kilo" | "caja";

export const PRESENTACIONES: { valor: PresentacionInsumo; etiqueta: string; plural: string }[] = [
    { valor: "rollo", etiqueta: "Rollo", plural: "rollos" },
    { valor: "unidad", etiqueta: "Unidad", plural: "unidades" },
    { valor: "cartucho", etiqueta: "Cartucho", plural: "cartuchos" },
    { valor: "litro", etiqueta: "Litro", plural: "litros" },
    { valor: "kilo", etiqueta: "Kilo", plural: "kilos" },
    { valor: "caja", etiqueta: "Caja", plural: "cajas" },
];

export interface MateriaPrima {
    id?: string;
    /** Como se le llama en el taller: "Vinil blanco 137", "Tinta cyan". */
    nombre: string;
    presentacion: PresentacionInsumo;
    /** Cuántos hay ahora mismo. Se cuenta a mano: es lo que se ve en el estante. */
    stock: number;
    /** A partir de aquí avisa. En cero no avisa nunca. */
    stockMinimo: number;
    /**
     * Medidas del rollo, solo para reconocerlo.
     *
     * "El de 137" es como se pide por teléfono, y dos rollos del mismo vinil
     * con anchos distintos no son la misma cosa aunque se llamen igual.
     */
    anchoCm?: number;
    metrosRollo?: number;
    proveedor?: string;
    nota?: string;
    /** Lo que costó una unidad en la última compra. Los costos envejecen. */
    ultimoCostoUSD?: number;
    ultimaCompraEn?: string;
    activo: boolean;
    createdAt?: any;
    updatedAt?: any;
}

/** Una entrada al depósito: lo que llegó y lo que costó. */
export interface CompraInsumo {
    insumo: MateriaPrima;
    /** Cuántos entraron, en la presentación del insumo. */
    cantidad: number;
    montoUSD: number;
    /** Tasa del día, para que el gasto también quede en bolívares. */
    tasa?: number;
    proveedor?: string;
    nota?: string;
    creadoPor?: string;
}

export const INSUMO_NUEVO: MateriaPrima = {
    nombre: "",
    presentacion: "rollo",
    stock: 0,
    stockMinimo: 0,
    activo: true,
};

const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
};

/** Cómo se dice la cantidad: "3 rollos", "1 rollo". */
export const nombrarCantidad = (cantidad: number, p: PresentacionInsumo): string => {
    const def = PRESENTACIONES.find(x => x.valor === p);
    const uno = def?.etiqueta.toLowerCase() || "unidad";
    return `${cantidad} ${Math.abs(cantidad) === 1 ? uno : (def?.plural || "unidades")}`;
};

/** Se está acabando. Con mínimo en cero no avisa: nadie puso un límite. */
export const seEstaAcabando = (i: MateriaPrima): boolean =>
    n(i.stockMinimo) > 0 && n(i.stock) <= n(i.stockMinimo);

/** Qué le falta para poder guardarse, o null si está bien. */
export const problemaDeInsumo = (i: Partial<MateriaPrima>): string | null => {
    if (!i.nombre?.trim()) return "¿Cómo se llama?";
    if (n(i.stock) < 0) return "Las existencias no pueden ser negativas";
    if (n(i.stockMinimo) < 0) return "El mínimo no puede ser negativo";
    return null;
};

/** Por nombre: en un depósito se busca leyendo, no adivinando el orden. */
export const subscribeToMateriaPrima = (cb: (items: MateriaPrima[]) => void) =>
    onSnapshot(
        query(collection(db, COL), orderBy("nombre", "asc")),
        snap => cb(snap.docs.map(d => ({ ...(d.data() as MateriaPrima), id: d.id }))),
        err => {
            console.error("[materia prima] no se pudo leer:", err);
            cb([]);
        }
    );

export const guardarMateriaPrima = async (data: MateriaPrima, id?: string) => {
    const problema = problemaDeInsumo(data);
    if (problema) throw new Error(problema);

    const { id: _i, createdAt: _c, ...guardar } = data as any;
    const limpio = {
        ...guardar,
        nombre: String(data.nombre).trim(),
        stock: n(data.stock),
        stockMinimo: n(data.stockMinimo),
        // Firestore no admite `undefined`, y un ancho vacío no es un ancho de
        // cero: es que nadie lo dijo. Los campos sin valor no se escriben.
        ...(n(data.anchoCm) > 0 ? { anchoCm: n(data.anchoCm) } : {}),
        ...(n(data.metrosRollo) > 0 ? { metrosRollo: n(data.metrosRollo) } : {}),
        proveedor: String(data.proveedor || "").trim(),
        nota: String(data.nota || "").trim(),
    };

    if (id) {
        await updateDoc(doc(db, COL, id), { ...limpio, updatedAt: serverTimestamp() });
        return id;
    }
    const ref = await addDoc(collection(db, COL), {
        ...limpio,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
};

/**
 * Suma o resta de lo que hay.
 *
 * Entró un rollo, salió un rollo. No baja de cero: un depósito con existencias
 * negativas no significa nada, y el que lo ve piensa que el sistema está roto
 * en vez de que alguien se equivocó contando.
 */
export const ajustarStock = async (id: string, delta: number, stockActual: number) =>
    updateDoc(doc(db, COL, id), {
        stock: Math.max(0, n(stockActual) + n(delta)),
        updatedAt: serverTimestamp(),
    });

export const eliminarMateriaPrima = async (id: string) => deleteDoc(doc(db, COL, id));

/** Qué falta para poder registrar la compra, o null si está bien. */
export const problemaDeCompraInsumo = (c: Partial<CompraInsumo>): string | null => {
    if (!c.insumo?.id) return "¿De qué es la compra?";
    if (!(n(c.cantidad) > 0)) return "¿Cuántos llegaron?";
    if (!(n(c.montoUSD) > 0)) return "¿Cuánto costó en total?";
    return null;
};

/**
 * Registra la entrada: sube el depósito y apunta el gasto.
 *
 * Las dos en una transacción. Existencias que suben sin gasto detrás hacen
 * creer que el mes fue mejor de lo que fue, y un gasto sin existencias deja
 * buscando un rollo que sí llegó.
 */
export const registrarCompraInsumo = async (
    c: CompraInsumo
): Promise<{ costoUnitarioUSD: number }> => {
    const problema = problemaDeCompraInsumo(c);
    if (problema) throw new Error(problema);

    const cantidad = n(c.cantidad);
    const monto = n(c.montoUSD);
    const tasa = n(c.tasa);
    const unitario = Math.round((monto / cantidad) * 10000) / 10000;

    const insumoRef = doc(db, COL, c.insumo.id!);
    const gastoRef = doc(collection(db, GASTOS_COL));
    const ahora = Timestamp.now();

    await runTransaction(db, async tx => {
        // Se lee dentro de la transacción: si dos personas registran entradas a
        // la vez, cada una suma sobre lo que dejó la otra y no sobre lo que
        // había al abrir la pantalla.
        const snap = await tx.get(insumoRef);
        if (!snap.exists()) throw new Error("Ese insumo ya no está en el depósito");
        const actual = snap.data() as MateriaPrima;

        tx.update(insumoRef, {
            stock: n(actual.stock) + cantidad,
            ultimoCostoUSD: unitario,
            ultimaCompraEn: new Date().toISOString(),
            ...(c.proveedor?.trim() ? { proveedor: c.proveedor.trim() } : {}),
            updatedAt: serverTimestamp(),
        });

        tx.set(gastoRef, {
            nombre: `${c.insumo.nombre} (${nombrarCantidad(cantidad, c.insumo.presentacion)})`,
            descripcion: [
                `${nombrarCantidad(cantidad, c.insumo.presentacion)} a $${unitario.toFixed(2)} c/u`,
                c.proveedor?.trim() ? `Proveedor: ${c.proveedor.trim()}` : "",
                c.nota?.trim() || "",
            ].filter(Boolean).join(" · "),
            monto,
            montoBs: tasa > 0 ? Math.round(monto * tasa * 100) / 100 : 0,
            tasaDolar: tasa,
            // Materia prima, no consumible de oficina: es la inversión con la
            // que se produce.
            categoria: "materiales",
            estado: "pagado",
            insumoId: c.insumo.id,
            fecha: ahora,
            createdAt: ahora,
            updatedAt: ahora,
            ...(c.creadoPor ? { creadoPor: c.creadoPor } : {}),
        });
    });

    return { costoUnitarioUSD: unitario };
};
