// @/app/manifest.ts
//
// EL MANIFIESTO DE LA APP INSTALADA, CON EL NOMBRE QUE TOQUE.
//
// Era un archivo fijo en `public/manifest.json` con "SMR Lase Print" escrito
// dentro. Todo lo demás de la marca ya salía del entorno —la pestaña, el
// login, los códigos, los avisos— pero esto no, y esto es justo lo que se
// queda pegado al teléfono: el nombre bajo el icono de la pantalla de inicio.
//
// Una copia montada para otro taller se instalaba llamándose SMR. Y no se
// notaba hasta que alguien pulsaba "Añadir a pantalla de inicio", que es
// tarde.
//
// Ahora se genera, así que sale de `lib/marca.ts` como el resto.
//
// LOS ICONOS SIGUEN SIENDO ARCHIVOS
//
// A propósito: una copia cambia los PNG de `public/icons/` por los suyos y no
// toca nada más. Meter las rutas en el entorno obligaría a configurar cinco
// variables más para acabar en el mismo sitio.

import type { MetadataRoute } from "next";
import { MARCA, MARCA_DESCRIPCION, TITULO_APP } from "@/lib/marca";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: TITULO_APP,
        short_name: MARCA,
        description: `Sistema de gestión para ${MARCA}: inventario, órdenes, empleados y pagos.`,
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#2563eb",
        icons: [
            { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
            { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
            {
                src: "/icons/icon-512x512.maskable.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
