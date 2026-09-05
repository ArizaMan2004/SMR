// @/lib/services/bancos-venezuela.ts
//
// CATÁLOGO DE BANCOS VENEZOLANOS.
//
// No hay ninguna API de logos que sirva para esto. La que usaba todo el mundo
// (Clearbit) cerró a finales de 2024, y los catálogos que quedan no cubren la
// banca venezolana: Banesco, Bancamiga o el BNC no aparecen en ninguno.
//
// Lo que sí funciona es el servicio de favicons de Google: devuelve el logo de
// verdad del banco a partir de su dominio. Es un PNG pequeño y no siempre
// nítido, pero en una pastilla de 20 px se ve bien y es el logo real.
//
// Debajo va siempre un monograma con el color de marca, dibujado en el propio
// componente: es lo que se ve mientras carga el favicon, lo que queda si no
// hay internet y lo que aparece si Google no tiene nada de ese dominio. Así el
// banco nunca sale como un cuadro vacío.
//
// Los colores son la aproximación de la marca de cada banco. Si alguno no
// convence, se cambia el hex de esta lista y se actualiza en todas partes.

export interface BancoVE {
    /** Código SUDEBAN de 4 dígitos: es el que la gente dicta y reconoce. */
    codigo: string;
    nombre: string;
    /** Lo que cabe en una pastilla estrecha. */
    corto: string;
    /** Las letras del monograma. Dos o tres como mucho. */
    sigla: string;
    color: string;
    /** Para sacarle el favicon. Sin dominio se queda con el monograma. */
    dominio?: string;
}

export const BANCOS_VE: BancoVE[] = [
    { codigo: "0102", nombre: "Banco de Venezuela",        corto: "Venezuela",   sigla: "BDV", color: "#C8102E" , dominio: "bancodevenezuela.com" },
    { codigo: "0104", nombre: "Venezolano de Crédito",     corto: "Venezolano",  sigla: "BVC", color: "#0F3D6E" , dominio: "venezolano.com" },
    { codigo: "0105", nombre: "Mercantil",                 corto: "Mercantil",   sigla: "M",   color: "#00358E" , dominio: "mercantilbanco.com" },
    { codigo: "0108", nombre: "BBVA Provincial",           corto: "Provincial",  sigla: "BP",  color: "#072146" , dominio: "provincial.com" },
    { codigo: "0114", nombre: "Bancaribe",                 corto: "Bancaribe",   sigla: "BC",  color: "#E1251B" , dominio: "bancaribe.com.ve" },
    { codigo: "0115", nombre: "Banco Exterior",            corto: "Exterior",    sigla: "BE",  color: "#D6001C" , dominio: "bancoexterior.com" },
    { codigo: "0128", nombre: "Banco Caroní",              corto: "Caroní",      sigla: "BC",  color: "#0069B4" , dominio: "bancocaroni.com.ve" },
    { codigo: "0134", nombre: "Banesco",                   corto: "Banesco",     sigla: "B",   color: "#00693E" , dominio: "banesco.com" },
    { codigo: "0137", nombre: "Sofitasa",                  corto: "Sofitasa",    sigla: "SF",  color: "#005CA9" , dominio: "sofitasa.com" },
    { codigo: "0138", nombre: "Banco Plaza",               corto: "Plaza",       sigla: "BP",  color: "#E4002B" , dominio: "bancoplaza.com" },
    { codigo: "0146", nombre: "Bangente",                  corto: "Bangente",    sigla: "BG",  color: "#F58220" , dominio: "bangente.com.ve" },
    { codigo: "0151", nombre: "BFC Banco Fondo Común",     corto: "BFC",         sigla: "BFC", color: "#12326E" , dominio: "bfc.com.ve" },
    { codigo: "0156", nombre: "100% Banco",                corto: "100% Banco",  sigla: "100", color: "#E4002B" , dominio: "100x100banco.com" },
    { codigo: "0157", nombre: "Banco del Sur (DelSur)",    corto: "DelSur",      sigla: "DS",  color: "#006B54" , dominio: "delsur.com.ve" },
    { codigo: "0163", nombre: "Banco del Tesoro",          corto: "Tesoro",      sigla: "BT",  color: "#00954E" , dominio: "bt.gob.ve" },
    { codigo: "0166", nombre: "Banco Agrícola de Venezuela", corto: "Agrícola",  sigla: "BAV", color: "#2E7D32" , dominio: "bav.com.ve" },
    { codigo: "0168", nombre: "Bancrecer",                 corto: "Bancrecer",   sigla: "BR",  color: "#E4002B" , dominio: "bancrecer.com.ve" },
    { codigo: "0169", nombre: "Mi Banco",                  corto: "Mi Banco",    sigla: "MB",  color: "#00A0DF" , dominio: "mibanco.com.ve" },
    { codigo: "0171", nombre: "Banco Activo",              corto: "Activo",      sigla: "BA",  color: "#F58220" , dominio: "bancoactivo.com" },
    { codigo: "0172", nombre: "Bancamiga",                 corto: "Bancamiga",   sigla: "BM",  color: "#00A4B4" , dominio: "bancamiga.com" },
    { codigo: "0174", nombre: "Banplus",                   corto: "Banplus",     sigla: "B+",  color: "#7A1F7A" , dominio: "banplus.com" },
    { codigo: "0175", nombre: "Banco Bicentenario",        corto: "Bicentenario", sigla: "BB", color: "#003DA5" , dominio: "bicentenariobu.com" },
    { codigo: "0177", nombre: "Banco de la FANB",          corto: "Banfanb",     sigla: "FA",  color: "#6B5B3E" , dominio: "banfanb.com.ve" },
    { codigo: "0191", nombre: "Banco Nacional de Crédito", corto: "BNC",         sigla: "BNC", color: "#003087" , dominio: "bnc.com.ve" },

    // No son bancos, pero es por donde entra buena parte del dinero y en la
    // lista tienen que estar: si no, la cuenta de Zelle se queda sin color.
    { codigo: "ZELLE",    nombre: "Zelle",             corto: "Zelle",     sigla: "Z",  color: "#6D1ED4" , dominio: "zellepay.com" },
    { codigo: "BINANCE",  nombre: "Binance / USDT",    corto: "Binance",   sigla: "₮",  color: "#F0B90B" , dominio: "binance.com" },
    { codigo: "PAYPAL",   nombre: "PayPal",            corto: "PayPal",    sigla: "PP", color: "#003087" , dominio: "paypal.com" },
    { codigo: "EFECTIVO", nombre: "Efectivo",          corto: "Efectivo",  sigla: "$",  color: "#059669" },
    { codigo: "OTRO",     nombre: "Otro",              corto: "Otro",      sigla: "•",  color: "#64748B" },
];

const PORCODIGO = new Map(BANCOS_VE.map(b => [b.codigo, b]));

export const bancoPorCodigo = (codigo?: string): BancoVE | undefined =>
    codigo ? PORCODIGO.get(codigo) : undefined;

/**
 * Encuentra el banco a partir de lo que se haya escrito a mano.
 *
 * Las cuentas viejas tienen el banco en un campo de texto libre: "banesco",
 * "0134", "Banesco Corriente". Esto intenta reconocerlo para poder pintarle su
 * color sin obligar a nadie a volver a capturar nada.
 */
export const adivinarBanco = (texto?: string): BancoVE | undefined => {
    const t = (texto || "").trim().toLowerCase();
    if (!t) return undefined;

    const porCodigo = BANCOS_VE.find(b => t.includes(b.codigo.toLowerCase()));
    if (porCodigo) return porCodigo;

    // De los más largos a los más cortos: "banco de venezuela" antes que
    // "banco", para que no gane la coincidencia más pobre.
    return [...BANCOS_VE]
        .sort((a, b) => b.corto.length - a.corto.length)
        .find(b => t.includes(b.corto.toLowerCase()) || t.includes(b.nombre.toLowerCase()));
};

/** El color con el que pintar una cuenta, tenga banco reconocido o no. */
export const colorDeBanco = (codigo?: string, textoLibre?: string): string =>
    (bancoPorCodigo(codigo) || adivinarBanco(textoLibre))?.color || "#64748B";

/**
 * URL del favicon del banco, vía el servicio de Google.
 *
 * Es un PNG pequeño y no siempre nítido, pero es el logo de verdad y para una
 * pastilla de 20 px cumple de sobra. Cuando el dominio no existe o Google no
 * tiene nada, devuelve un icono genérico: por eso el componente que lo pinta
 * deja debajo el monograma de color, que nunca falla.
 */
export const faviconDeBanco = (codigo?: string, tam = 64): string | undefined => {
    const dominio = bancoPorCodigo(codigo)?.dominio;
    return dominio
        ? `https://www.google.com/s2/favicons?domain=${dominio}&sz=${tam}`
        : undefined;
};
