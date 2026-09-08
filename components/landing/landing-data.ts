// @/components/landing/landing-data.ts
//
// LO QUE CUENTA LA PORTADA.
//
// Está aparte de la página por una razón práctica: el texto se corrige mucho
// más a menudo que la maquetación, y buscar una frase entre 800 líneas de JSX
// para cambiar una palabra invita a no cambiarla.
//
// Cada módulo describe lo que el sistema HACE, no lo que promete. Todo lo que
// hay aquí abajo existe y se puede abrir: si algo deja de existir, se quita de
// esta lista.

import {
    Receipt, Hammer, FileText, Package, Users, BarChart3, Wallet,
    ClipboardCheck, CalendarClock, ShieldCheck, MessageCircle, Wand2,
    type LucideIcon,
} from "lucide-react";

export interface ModuloPortada {
    id: string;
    label: string;
    icon: LucideIcon;
    titular: string;
    detalle: string;
    puntos: string[];
    /**
     * La captura de la vista, si la hay.
     *
     * Son capturas REALES del sistema funcionando, tomadas de esta misma
     * instalación, con los nombres de los clientes y sus documentos cambiados
     * por otros inventados. Los módulos que no tienen captura no llevan una
     * inventada: se enseñan con sus puntos y ya.
     */
    imagen?: string;
}

export const MODULOS: ModuloPortada[] = [
    {
        id: "facturacion",
        imagen: "/portada/ordenes.webp",
        label: "Facturación",
        icon: Receipt,
        titular: "La orden se arma y se cobra en la misma pantalla.",
        detalle:
            "Cliente, renglones y pago. Cada renglón sabe cómo se cobra lo suyo —por metro cuadrado, por unidad, por minuto de láser— y el total se recalcula solo mientras escribes.",
        puntos: [
            "Se cobra al crear la orden: pago completo, abono o sin pagar",
            "El material sale del catálogo, así que la orden nace sabiendo qué gastó",
            "Precios distintos para cliente regular y para aliado, sin recordarlos de memoria",
            "Presupuestos matriz: un solo documento repartido entre los locales de una empresa",
        ],
    },
    {
        id: "taller",
        label: "Taller",
        icon: Hammer,
        titular: "De la factura a la mesa de trabajo, sin volver a escribirlo.",
        detalle:
            "Al cobrar, el trabajo pasa al taller con lo que ya dice la orden: qué hay que hacer, con qué material y para cuándo. Se revisa antes de mandarlo, porque el papel del cliente y el de la mesa no hablan igual.",
        puntos: [
            "Un trabajo de cinco impresiones es una lista que se va tachando",
            "Pasa de Diseño a Impresión, de ahí a Producción y de ahí a terminado",
            "Aviso por Telegram a quien le toca, con lo que lleva pendiente",
            "Se busca por número de orden, cliente, material o fecha de entrega",
        ],
    },
    {
        id: "presupuestos",
        label: "Presupuestos",
        icon: FileText,
        titular: "El documento se ve antes de mandarlo, no después.",
        detalle:
            "Presupuesto, nota de entrega, factura y estado de cuenta salen de la misma hoja. Se decide en el momento qué lleva: la tasa, el IVA, los datos de pago y el tamaño del papel.",
        puntos: [
            "El IVA se saca de dentro del precio, no se suma encima",
            "Cada tipo lleva la leyenda legal que le toca",
            "Avisa de lo que falta antes de imprimir, no cuando el cliente ya se fue",
            "Los datos de la empresa se cambian desde Ajustes, sin tocar código",
        ],
    },
    {
        id: "catalogo",
        imagen: "/portada/catalogo.webp",
        label: "Catálogo",
        icon: Package,
        titular: "Los precios viven en un sitio y todo lo demás los lee.",
        detalle:
            "Materiales, servicios y productos con sus variantes, acabados y formas de venta. Lo que se registra aquí es lo que ofrece el formulario de órdenes y lo que cuenta el balance.",
        puntos: [
            "Por unidad, metro cuadrado, metro lineal, kilo o litro",
            "Los metros lineales giran la pieza para cobrar lo que de verdad se gasta",
            "El stock se descuenta al facturar y vuelve si se anula",
            "Del costo de compra sale un precio recomendado, que puedes ignorar",
        ],
    },
    {
        id: "balance",
        imagen: "/portada/balance.webp",
        label: "Balance",
        icon: BarChart3,
        titular: "Cuánto entró, en qué se fue el material y qué área lo hizo.",
        detalle:
            "Los ingresos salen de los cobros reales, no de lo facturado. Los metros salen de las medidas de cada renglón. Y cuando algo está deducido y no confirmado, la pantalla lo dice.",
        puntos: [
            "Metros cuadrados por material y por servicio",
            "Reparto entre Impresión y Corte según lo que dice cada ítem",
            "Auditoría para confirmar qué material gastó cada orden vieja",
            "Lo estimado se marca aparte: medido y deducido no valen lo mismo",
        ],
    },
    {
        id: "cobranza",
        imagen: "/portada/cobranza.webp",
        label: "Cobranza",
        icon: Users,
        titular: "Quién debe, cuánto y desde cuándo.",
        detalle:
            "Cada cliente con su saldo, su antigüedad de deuda y su historial de abonos. El estado de cuenta se arma solo, agrupado por orden.",
        puntos: [
            "Abono global: un pago que se reparte entre varias órdenes",
            "El comprobante se guarda con el pago, no en el teléfono de alguien",
            "Datos de la cuenta y QR a mano para dictárselos al cliente",
            "Facturado menos abonado da el saldo, y cuadra con la vista",
        ],
    },
    {
        id: "tesoreria",
        label: "Tesorería",
        icon: Wallet,
        titular: "En qué banco entró cada bolívar.",
        detalle:
            "Caja en dólares, banco en bolívares, Zelle y USDT, cada uno con sus cuentas. Un cobro por pago móvil no se queda en «entró dinero»: se sabe a cuál de tus cuentas.",
        puntos: [
            "Varias cuentas por billetera, con el logo de su banco",
            "Tasa BCV, euro y paralelo, actualizadas solas",
            "Aviso cuando el dólar sube y tu saldo en bolívares pierde valor",
            "Auditoría de ingresos y egresos, mes a mes",
        ],
    },
    {
        id: "equipo",
        imagen: "/portada/horarios.webp",
        label: "Equipo",
        icon: CalendarClock,
        titular: "Quién trabaja hoy y qué se le debe.",
        detalle:
            "Horarios, nómina y comisiones. Cada quien entra con su cuenta y ve lo suyo; lo demás no le aparece.",
        puntos: [
            "Rangos con las vistas que le tocan a cada puesto",
            "Permisos por persona, por encima o por debajo de su rango",
            "Cada cuenta con su foto y su color, para saber con cuál estás",
            "Registro por código de invitación, y el admin aprueba",
        ],
    },
];

export interface Dolor {
    problema: string;
    respuesta: string;
}

/**
 * De dónde salió cada cosa.
 *
 * No son objeciones de vendedor: son las cosas que pasaban de verdad en el
 * taller y que obligaron a construir cada pantalla. Van primero porque quien
 * llega reconoce el problema antes que la solución.
 */
export const DOLORES: Dolor[] = [
    {
        problema: "«¿Este cliente pagó o no pagó?»",
        respuesta:
            "Cada orden lleva sus abonos con fecha, monto, comprobante y a qué cuenta entró. El saldo no se calcula de memoria.",
    },
    {
        problema: "«¿Alguien mandó a hacer esto ya?»",
        respuesta:
            "Al pasar un trabajo al taller, el sistema avisa si esa orden ya tiene uno abierto y enseña el resumen antes de duplicarlo.",
    },
    {
        problema: "«¿Cuánto banner se gastó este mes?»",
        respuesta:
            "Los metros salen de las medidas de cada renglón, repartidos por material y por servicio. Y lo que está deducido se marca como deducido.",
    },
    {
        problema: "«Se me olvidó decirle a producción»",
        respuesta:
            "El trabajo entra al área y le suena el teléfono a quien le toca, con lo que lleva pendiente encima.",
    },
];

export interface Ventaja {
    icon: LucideIcon;
    titulo: string;
    texto: string;
}

/**
 * Por qué está hecho así.
 *
 * No son características: son decisiones. Las características se copian; las
 * decisiones explican por qué el sistema se comporta como se comporta.
 */
export const VENTAJAS: Ventaja[] = [
    {
        icon: ClipboardCheck,
        titulo: "No inventa datos",
        texto:
            "Cuando un número está deducido y no confirmado, la pantalla lo dice. Un cero que afirma «no se imprimió nada» siendo falso hace más daño que un dato que reconoce lo que no sabe.",
    },
    {
        icon: ShieldCheck,
        titulo: "Nada se pierde en silencio",
        texto:
            "Si algo falla al guardar, se dice. Una operación que falla y deja la pantalla igual es peor que un error: parece que funcionó.",
    },
    {
        icon: MessageCircle,
        titulo: "Los avisos llegan al teléfono",
        texto:
            "El trabajo entra al taller y le suena a quien le toca, con lo que lleva pendiente. No hay que estar mirando la pantalla para enterarse.",
    },
    {
        icon: Wand2,
        titulo: "Todo configurable",
        texto:
            "Materiales, colores, grosores, precios, datos de los documentos, cuentas bancarias y hasta el nombre de la empresa. Cambiarlos no es tocar código.",
    },
];

/** Lo que también está dentro, sin merecer su propia sección. */
export const TAMBIEN = [
    "Calculadora de costos",
    "Quita fondos con IA",
    "Ampliar imagen a HD",
    "Convertidor de formatos",
    "Gastos fijos y servicios",
    "Insumos y compras",
    "Pago a diseñadores",
    "Control de inventario",
];

export interface Pregunta {
    q: string;
    a: string;
}

export const PREGUNTAS: Pregunta[] = [
    {
        q: "¿Hace falta internet todo el tiempo?",
        a: "No para consultar. El sistema guarda una copia en el navegador, así que lo ya cargado se ve sin conexión. Para guardar sí hace falta, porque el dato tiene que llegar a la base.",
    },
    {
        q: "¿Se puede usar desde el teléfono?",
        a: "Sí. Las pantallas están hechas para que el taller consulte desde el móvil y la administración trabaje desde la computadora, sin dos versiones distintas.",
    },
    {
        q: "¿Qué pasa si alguien se equivoca en una orden?",
        a: "Se corrige. Los pagos tienen historial y se pueden revertir, las órdenes se editan, y la auditoría de materiales deja cambiar lo que la máquina dedujo mal.",
    },
    {
        q: "¿Cada quien ve todo?",
        a: "No. Cada rango tiene sus vistas, y por persona se puede dar o quitar acceso por encima de su rango. Quien imprime no necesita ver la nómina.",
    },
];
