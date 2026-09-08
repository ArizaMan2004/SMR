// @/lib/marca.ts
//
// EL NOMBRE DE LA EMPRESA, EN UN SOLO SITIO.
//
// Estaba escrito a mano en 18 ficheros: en el título de la pestaña, en el
// login, en el pie de los formularios, en el nombre de los archivos que se
// descargan, en los códigos de registro y hasta en los mensajes de Telegram.
//
// Eso hace imposible montar el mismo sistema para otro taller sin ir a buscar
// cada aparición, y garantiza que se escape alguna: la que está dentro de una
// plantilla de texto, la del nombre de un PNG descargado, la del código de
// invitación.
//
// Ahora sale del entorno. Copiar el sistema para otra empresa es cambiar el
// `.env.local` — la base de datos, las llaves y el nombre— sin tocar una línea.
//
// NEXT_PUBLIC_ porque el nombre se pinta en el navegador. No es un secreto:
// es lo primero que se ve al abrir.

/** El nombre completo: "SMR Lase Print", "Gráficas del Centro". */
export const MARCA = process.env.NEXT_PUBLIC_MARCA_NOMBRE?.trim() || "SMR Lase Print";

/**
 * El corto, para donde no cabe el largo.
 *
 * Sin configurar se saca la primera palabra del nombre, que casi siempre es la
 * que la gente usa de verdad al hablar.
 */
export const MARCA_CORTA =
    process.env.NEXT_PUBLIC_MARCA_CORTA?.trim() || MARCA.split(/\s+/)[0] || MARCA;

/** Lo que se lee debajo del nombre en la pestaña del navegador. */
export const MARCA_DESCRIPCION =
    process.env.NEXT_PUBLIC_MARCA_DESCRIPCION?.trim() ||
    "Impresión Digital y Corte Láser";

/**
 * Un prefijo apto para códigos y nombres de archivo.
 *
 * Sin espacios ni acentos ni signos: acaba en un código de invitación y en el
 * nombre de un PNG que alguien descarga, y ahí un espacio rompe cosas.
 */
export const MARCA_CLAVE = (
    process.env.NEXT_PUBLIC_MARCA_CLAVE?.trim() || MARCA_CORTA
)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12) || "APP";

/** El título de la pestaña. */
export const TITULO_APP = `${MARCA} - ${MARCA_DESCRIPCION}`;
