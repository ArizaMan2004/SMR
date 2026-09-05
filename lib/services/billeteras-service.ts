// @/lib/services/billeteras-service.ts
//
// NOMBRES DE BILLETERAS Y CUENTAS BANCARIAS.
//
// Las cuatro billeteras del sistema (caja chica, banco en bolívares, Zelle y
// USDT) estaban con el nombre escrito a mano en el código: "Banco Nacional
// (Bs)". En la práctica la empresa no tiene un banco, tiene varios, y cuando
// alguien miraba un movimiento no había forma de saber a cuál de ellos había
// entrado el dinero.
//
// Aquí se guardan dos cosas:
//   1. El nombre que cada quien le quiera poner a la billetera.
//   2. Las cuentas concretas que cuelgan de ella — Banesco, Mercantil, el
//      Zelle de fulano — para poder decir "esto entró por Banesco" al
//      registrar un cobro y luego verlo en el cuadre.
//
// Los ids de las billeteras siguen siendo los mismos de siempre. Esto solo
// les pone etiqueta: nada de lo que ya estaba calculado cambia.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

export type BilleteraId = "cash_usd" | "bank_bs" | "zelle" | "usdt";

export const BILLETERAS: BilleteraId[] = ["cash_usd", "bank_bs", "zelle", "usdt"];

/** El nombre de fábrica, el que se usa mientras nadie configure nada. */
export const NOMBRE_POR_DEFECTO: Record<BilleteraId, string> = {
    cash_usd: "Caja Chica ($)",
    bank_bs: "Banco Nacional (Bs)",
    zelle: "Zelle / Bofa",
    usdt: "Binance / USDT",
};

export interface CuentaBilletera {
    /** Estable: queda escrito en los pagos ya registrados, no se reutiliza. */
    id: string;
    /** Lo que ve la gente: "Banesco Corriente", "Zelle de Samuel". */
    nombre: string;
    /** Opcional, para el recibo: "0134" o "Banesco". */
    banco?: string;
    /** Código del catálogo de bancos: es lo que decide el logo y el color. */
    bancoCodigo?: string;
    /** Opcional, los últimos dígitos bastan: nadie necesita el número entero. */
    referencia?: string;
    /** Una cuenta que se cierra se archiva, no se borra: los pagos viejos la nombran. */
    activa?: boolean;

    // --- Lo que hay que dictarle al cliente para que pague ---
    //
    // Hasta ahora esto vivía en una nota del teléfono de cada quien, y cada
    // vendedor dictaba una versión distinta. Un dígito mal en el RIF y el
    // cliente paga a otro lado.
    /** A nombre de quién está la cuenta. */
    titular?: string;
    /** RIF o cédula del titular: "J-12345678-9". */
    documento?: string;
    /** Los 20 dígitos de la cuenta. */
    numeroCuenta?: string;
    /** Corriente, Ahorro… */
    tipoCuenta?: string;
    /** El teléfono del pago móvil. */
    telefono?: string;
    /** El correo, que es lo que se usa en Zelle. */
    correo?: string;
    /** Usuario o Pay ID: es como se cobra en Binance. */
    usuario?: string;
    /** QR de cobro subido a Cloudinary. Lo genera el banco, no nosotros. */
    qrUrl?: string;
}

export interface ConfigBilletera {
    nombre?: string;
    cuentas?: CuentaBilletera[];
}

export type ConfigBilleteras = Partial<Record<BilleteraId, ConfigBilletera>>;

const REF = () => doc(db, "configuracion", "billeteras");

export const nombreBilletera = (id: string, config?: ConfigBilleteras): string => {
    const propio = config?.[id as BilleteraId]?.nombre?.trim();
    return propio || NOMBRE_POR_DEFECTO[id as BilleteraId] || id;
};

/** Solo las que siguen en uso. Para elegir al cobrar. */
export const cuentasActivas = (id: string, config?: ConfigBilleteras): CuentaBilletera[] =>
    (config?.[id as BilleteraId]?.cuentas || []).filter(c => c.activa !== false);

/** Todas, archivadas incluidas. Para poder leer un movimiento viejo. */
export const todasLasCuentas = (id: string, config?: ConfigBilleteras): CuentaBilletera[] =>
    config?.[id as BilleteraId]?.cuentas || [];

export const buscarCuenta = (
    billeteraId: string,
    cuentaId: string | undefined,
    config?: ConfigBilleteras
): CuentaBilletera | undefined =>
    cuentaId ? todasLasCuentas(billeteraId, config).find(c => c.id === cuentaId) : undefined;

export const subscribeToBilleteras = (callback: (c: ConfigBilleteras) => void) =>
    onSnapshot(
        REF(),
        snap => callback((snap.exists() ? snap.data() : {}) as ConfigBilleteras),
        error => {
            console.error("Error leyendo la configuración de billeteras:", error);
            callback({});
        }
    );

export const cargarBilleteras = async (): Promise<ConfigBilleteras> => {
    try {
        const snap = await getDoc(REF());
        return (snap.exists() ? snap.data() : {}) as ConfigBilleteras;
    } catch (error) {
        console.error("Error cargando la configuración de billeteras:", error);
        return {};
    }
};

/** Guarda solo la billetera tocada; las otras tres quedan como estaban. */
export const guardarBilletera = async (id: BilleteraId, datos: ConfigBilletera): Promise<void> => {
    await setDoc(
        REF(),
        {
            [id]: {
                nombre: (datos.nombre || "").trim(),
                cuentas: (datos.cuentas || []).map(c => ({
                    id: c.id,
                    nombre: (c.nombre || "").trim(),
                    banco: (c.banco || "").trim(),
                    bancoCodigo: (c.bancoCodigo || "").trim(),
                    referencia: (c.referencia || "").trim(),
                    activa: c.activa !== false,
                    titular: (c.titular || "").trim(),
                    documento: (c.documento || "").trim(),
                    numeroCuenta: (c.numeroCuenta || "").trim(),
                    tipoCuenta: (c.tipoCuenta || "").trim(),
                    telefono: (c.telefono || "").trim(),
                    correo: (c.correo || "").trim(),
                    usuario: (c.usuario || "").trim(),
                    qrUrl: (c.qrUrl || "").trim(),
                })),
            },
            actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
    );
};

/** Id de cuenta: legible al depurar y sin colisiones en la práctica. */
export const nuevaCuentaId = () =>
    `cta_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * A qué billetera pertenece un método de pago escrito como texto.
 *
 * Los gastos y la nómina no guardan el id de la billetera, guardan la etiqueta
 * ("Pago Móvil (Bs)", "Binance USDT"). Estas son las mismas reglas con las que
 * Tesorería reparte esos movimientos, puestas en un solo sitio para que el
 * formulario ofrezca las cuentas de la billetera correcta.
 */
export const billeteraDeMetodo = (metodo?: string): BilleteraId => {
    const m = (metodo || "").toLowerCase();
    if (m.includes("zelle")) return "zelle";
    if (m.includes("usdt") || m.includes("binance")) return "usdt";
    if (m.includes("dolar") || m.includes("efectivo")) return "cash_usd";
    return "bank_bs";
};

/**
 * ¿Hay algo que enseñarle al cliente de esta cuenta?
 *
 * Una cuenta puede existir solo para clasificar movimientos (caja chica, por
 * ejemplo) y no tener nada que dictar. En ese caso el botón de "ver datos" no
 * debe aparecer: un modal vacío es peor que ningún botón.
 */
export const tieneDatosParaCobrar = (c?: CuentaBilletera): boolean =>
    !!c && !!(c.qrUrl || c.numeroCuenta || c.telefono || c.correo || c.usuario || c.titular || c.documento);
