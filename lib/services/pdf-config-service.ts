// @/lib/services/pdf-config-service.ts
//
// QUÉ LLEVA CADA DOCUMENTO QUE SALE DE LA EMPRESA.
//
// El generador tenía todo escrito a fuego: el nombre fiscal, el RIF, la
// dirección, el nombre y la cédula de quien firma, las notas legales y hasta
// el número de cuenta de Banesco. Cambiar cualquiera de esas cosas —mudarse,
// cambiar de banco, que firme otra persona— obligaba a tocar el código.
//
// Y no todos los documentos quieren lo mismo. Un presupuesto necesita los
// datos de pago para que el cliente transfiera; una nota de entrega firmada no
// los necesita para nada. Antes salían siempre los mismos bloques.
//
// Aquí se dice, por tipo de documento, qué bloques aparecen. Los datos de
// cobro salen del catálogo de cuentas bancarias, no de una copia pegada aquí:
// se cambian en un sitio y se actualizan en todos los PDF.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

/** Los cuatro documentos que emite la empresa. */
export type TipoDocumento = "orden" | "presupuesto" | "estadoCuenta" | "ventaCatalogo";

export const DOCUMENTOS: { tipo: TipoDocumento; nombre: string; ayuda: string }[] = [
    { tipo: "orden",         nombre: "Orden de servicio", ayuda: "La que se entrega con el trabajo" },
    { tipo: "presupuesto",   nombre: "Presupuesto",       ayuda: "Lo que se pasa antes de aprobar" },
    { tipo: "estadoCuenta",  nombre: "Estado de cuenta",  ayuda: "Resumen de lo que un cliente debe" },
    { tipo: "ventaCatalogo", nombre: "Venta de mostrador", ayuda: "Recibo de una venta directa" },
];

/** Cada bloque que puede aparecer o no en un documento. */
export interface BloquesDocumento {
    logo?: boolean;
    /** Datos fiscales del cliente: RIF y dirección. */
    datosFiscalesCliente?: boolean;
    /** Tasa BCV del día junto al total. */
    tasaBcv?: boolean;
    /** El total también en bolívares. */
    totalEnBs?: boolean;
    /** Cómo pagar: banco, cuenta, titular. Sale del catálogo de cuentas. */
    datosPago?: boolean;
    /** Las condiciones de siempre: IVA, plazos, forma de pago. */
    notasLegales?: boolean;
    /** La línea de despedida antes de la firma. */
    despedida?: boolean;
    /** Firma escaneada sobre la línea. */
    firma?: boolean;
    /** Sello húmedo. */
    sello?: boolean;
    /** Nombre y cédula de quien firma. */
    datosFirmante?: boolean;
    /** El pie con el nombre fiscal, RIF y dirección de la empresa. */
    pieEmpresa?: boolean;
}

export interface DatosEmpresa {
    nombre: string;
    rif: string;
    direccion: string;
    telefono?: string;
    correo?: string;
}

export interface DatosFirmante {
    nombre: string;
    cedula?: string;
    telefono?: string;
    cargo?: string;
}

export interface ConfigPDF {
    empresa?: DatosEmpresa;
    firmante?: DatosFirmante;
    notasLegales?: string[];
    /** Qué cuentas bancarias salen en los PDF, por id. Vacío = todas. */
    cuentasEnPDF?: string[];
    documentos?: Partial<Record<TipoDocumento, BloquesDocumento>>;
    actualizadoEn?: string;
}

const REF = () => doc(db, "configuracion", "pdf");

/**
 * Lo que traía el generador escrito a fuego.
 *
 * Se mantiene como valor de partida para que los PDF salgan igual que siempre
 * mientras nadie configure nada: una migración que cambia el aspecto de los
 * documentos el día que se instala es una migración que da miedo usar.
 */
export const EMPRESA_POR_DEFECTO: DatosEmpresa = {
    nombre: "EMPRENDIMIENTO JOSUE LEAL",
    rif: "J-50650878-8",
    direccion: "AV. ROMULO GALLEGOS CON CALLE CRISTAL, LOCAL MERCADO MINORISTA NRO 011-012, SECTOR LOS CLARITOS. SANTA ANA DE CORO, FALCÓN. ZONA POSTAL 4101",
};

export const FIRMANTE_POR_DEFECTO: DatosFirmante = {
    nombre: "JOSUE LEAL",
    cedula: "19448046",
    telefono: "04246118494",
};

export const NOTAS_POR_DEFECTO = [
    "LOS PRECIOS NO INCLUYEN IVA, SOLO FACTURA NOTA DE ENTREGA.",
    "TIEMPO DE ELABORACIÓN 5 DÍAS A PARTIR DE LA ENTREGA DE LA INICIAL",
    "FORMA DE PAGO 60% PARA INICIAR 40% EL FINALIZAR",
];

/**
 * Qué lleva cada documento cuando nadie lo ha configurado.
 *
 * No es lo mismo en todos, y ahí está la gracia: el presupuesto necesita los
 * datos de pago y las condiciones porque el cliente decide con eso delante; la
 * orden ya está aprobada y solo necesita la firma; el recibo de mostrador es
 * un papel corto que no lleva ni condiciones ni sello.
 */
export const BLOQUES_POR_DEFECTO: Record<TipoDocumento, BloquesDocumento> = {
    orden: {
        logo: true, datosFiscalesCliente: true, tasaBcv: true, totalEnBs: true,
        datosPago: false, notasLegales: false, despedida: true,
        firma: true, sello: true, datosFirmante: true, pieEmpresa: true,
    },
    presupuesto: {
        logo: true, datosFiscalesCliente: true, tasaBcv: true, totalEnBs: true,
        datosPago: true, notasLegales: true, despedida: true,
        firma: true, sello: true, datosFirmante: true, pieEmpresa: true,
    },
    estadoCuenta: {
        logo: true, datosFiscalesCliente: true, tasaBcv: true, totalEnBs: true,
        datosPago: true, notasLegales: false, despedida: false,
        firma: true, sello: false, datosFirmante: true, pieEmpresa: true,
    },
    ventaCatalogo: {
        logo: true, datosFiscalesCliente: false, tasaBcv: true, totalEnBs: true,
        datosPago: false, notasLegales: false, despedida: false,
        firma: false, sello: false, datosFirmante: false, pieEmpresa: true,
    },
};

export const subscribeToConfigPDF = (callback: (c: ConfigPDF) => void) =>
    onSnapshot(
        REF(),
        snap => callback((snap.exists() ? snap.data() : {}) as ConfigPDF),
        error => {
            console.error("Error leyendo la configuración de los PDF:", error);
            callback({});
        }
    );

export const cargarConfigPDF = async (): Promise<ConfigPDF> => {
    try {
        const snap = await getDoc(REF());
        return (snap.exists() ? snap.data() : {}) as ConfigPDF;
    } catch (error) {
        console.error("Error cargando la configuración de los PDF:", error);
        return {};
    }
};

export const guardarConfigPDF = async (config: ConfigPDF): Promise<void> => {
    await setDoc(REF(), { ...config, actualizadoEn: new Date().toISOString() }, { merge: true });
};

// --- LECTURA TOLERANTE ---
//
// Todo lo de abajo devuelve el valor de siempre cuando falta el configurado,
// para que el generador no tenga que preguntar dos veces por cada dato.

export const empresaDe = (c?: ConfigPDF): DatosEmpresa => ({
    ...EMPRESA_POR_DEFECTO,
    ...(c?.empresa || {}),
});

export const firmanteDe = (c?: ConfigPDF): DatosFirmante => ({
    ...FIRMANTE_POR_DEFECTO,
    ...(c?.firmante || {}),
});

export const notasDe = (c?: ConfigPDF): string[] =>
    c?.notasLegales?.length ? c.notasLegales : NOTAS_POR_DEFECTO;

export const bloquesDe = (c: ConfigPDF | undefined, tipo: TipoDocumento): BloquesDocumento => ({
    ...BLOQUES_POR_DEFECTO[tipo],
    ...(c?.documentos?.[tipo] || {}),
});
