"use client"

// @/components/taller/MuestraMaterial.tsx
//
// UNA FOTO, TODOS LOS COLORES.
//
// El acrilico se vende en veinte colores y la foto de los veinte es la misma
// plancha con distinta tinta. Subir veinte fotos gasta veinte veces el
// almacenamiento para ensenar lo mismo, y ademas obliga a fotografiar cada
// color nuevo antes de poder venderlo.
//
// Aqui se sube UNA foto del material en blanco y se pinta. La textura, el
// brillo del canto y las sombras son las de la foto de verdad; lo unico que
// cambia es el tono.
//
// COMO SE PINTA
//
// Con `mix-blend-mode: multiply` sobre un fondo del color. Multiplicar
// conserva lo oscuro y tine lo claro, que es exactamente como se comporta un
// material coloreado: los brillos siguen siendo brillos y las sombras siguen
// siendo sombras. Por eso la foto DEBE ser blanca o gris muy claro — sobre una
// foto oscura no se puede pintar un amarillo, y ningun truco lo arregla.
//
// Las tres familias no se pintan igual:
//
//   SOLIDO       el color, y ya.
//   TRANSLUCIDO  ademas se ve el fondo a traves. Se dibuja una cuadricula
//                detras, como en los programas de diseno, para que se lea
//                "esto deja pasar la luz" y no "esto es un color palido".
//   METALIZADO   lleva un reflejo diagonal encima. Un dorado plano parece
//                mostaza; lo que lo hace dorado es el brillo que se mueve.

import React from "react"
import { cn } from "@/lib/utils"
import {
    tonoDeColor,
    type ColorMaterial,
    type MaterialTaller,
} from "@/lib/services/materiales-taller"

/** La cuadricula de "esto es transparente", en SVG para no pedir un fichero. */
const CUADRICULA =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Crect width='6' height='6' fill='%23fff'/%3E%3Crect x='6' y='6' width='6' height='6' fill='%23fff'/%3E%3Crect x='6' width='6' height='6' fill='%23d8dade'/%3E%3Crect y='6' width='6' height='6' fill='%23d8dade'/%3E%3C/svg%3E\")"

export interface MuestraMaterialProps {
    material?: MaterialTaller
    color?: ColorMaterial
    /** Lado en pixeles. */
    tam?: number
    className?: string
    /** Marco resaltado, para cuando esta elegido. */
    elegido?: boolean
}

export const MuestraMaterial: React.FC<MuestraMaterialProps> = ({
    material,
    color,
    tam = 40,
    className,
    elegido,
}) => {
    const { hex, familia } = tonoDeColor(color)
    const foto = material?.fotoUrl
    const translucido = familia === "translucido"
    const metalico = familia === "metalico"

    const etiqueta = [material?.nombre, color?.nombre].filter(Boolean).join(" ") || "Material"

    return (
        <div
            title={etiqueta}
            aria-label={etiqueta}
            role="img"
            className={cn(
                "relative overflow-hidden shrink-0 rounded-lg",
                elegido
                    ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900"
                    : "ring-1 ring-black/10 dark:ring-white/15",
                className
            )}
            style={{ width: tam, height: tam }}
        >
            {/* El damero solo asoma donde el material deja pasar la luz. */}
            {translucido && (
                <div
                    className="absolute inset-0"
                    style={{ backgroundImage: CUADRICULA, backgroundSize: "12px 12px" }}
                />
            )}

            {/* El color. Translucido: se deja ver lo de detras. */}
            <div
                className="absolute inset-0"
                style={{ background: hex, opacity: translucido ? 0.62 : 1 }}
            />

            {/* La foto, multiplicando. Sin foto, el color plano ya sirve. */}
            {foto && (
                <img
                    src={foto}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ mixBlendMode: "multiply", opacity: translucido ? 0.75 : 1 }}
                />
            )}

            {/* El reflejo que convierte un ocre en un dorado. */}
            {metalico && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            "linear-gradient(115deg, rgba(255,255,255,0) 18%, rgba(255,255,255,.78) 34%, rgba(255,255,255,0) 46%, rgba(0,0,0,.16) 62%, rgba(255,255,255,.42) 78%, rgba(255,255,255,0) 92%)",
                    }}
                />
            )}

            {/* Un canto tenue: sin el, sobre fondo claro, el blanco no se ve. */}
            <div className="absolute inset-0 pointer-events-none rounded-lg ring-1 ring-inset ring-black/10" />
        </div>
    )
}
