// @/lib/hooks/use-consumo-materiales.ts
//
// El consumo real de material del taller, en un solo sitio.
//
// Lo usan a la vez la tarjeta de "Volumen Impreso" y los desgloses de
// materiales de impresión y de corte. Antes cada uno sacaba sus números por su
// cuenta contando palabras en el nombre de los ítems de las órdenes, y por eso
// nunca cuadraban entre sí ni con el stock.
//
// Aquí se calcula una vez y se reparte: mismos datos, mismas cuentas, un único
// sitio que corregir si algo sale mal.

"use client"

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    consumoPorMaterial, areaDeProducto, materialEsDelArea,
    subscribeToCatalogoProducts, subscribeToCatalogoCategories,
    type ConsumoMaterial, type VentaCatalogo, type CatalogoProducto, type CatalogoCategoria,
} from "@/lib/services/catalog-service";
import {
    consumoDesdePresupuestos, consumoDesdeOrdenes, unirConsumos,
    itemsSinClasificar, renglonesSinAuditar,
} from "@/lib/services/subitems-service";
import { loadBudgetsFromFirestore, type DbBudgetEntry } from "@/lib/firebase/firestore-budget-service";

export type AreaVista = "IMPRESION" | "CORTE";

/**
 * Los presupuestos se leen una sola vez por sesión.
 *
 * El hook se monta en varios sitios de la misma pantalla y sin esto cada uno
 * se traía el historial entero de Firestore. Se guarda la promesa, no el
 * resultado: si dos componentes montan a la vez, ambos esperan a la misma
 * lectura en lugar de lanzar dos.
 */
let lecturaEnCurso: Promise<DbBudgetEntry[]> | null = null;

const leerPresupuestos = (): Promise<DbBudgetEntry[]> => {
    if (!lecturaEnCurso) {
        lecturaEnCurso = loadBudgetsFromFirestore().catch(e => {
            // Si falla, se olvida para que el siguiente montaje reintente.
            lecturaEnCurso = null;
            throw e;
        });
    }
    return lecturaEnCurso;
};

/** Fuerza una relectura. Para cuando se acaba de guardar un desglose. */
export const olvidarPresupuestosEnCache = () => { lecturaEnCurso = null; };

const enRango = (valor: any, inicio: Date, fin: Date): boolean => {
    if (!valor) return false;
    // Firestore devuelve Timestamp en unas colecciones y cadena ISO en otras.
    const fecha = typeof valor?.toDate === "function" ? valor.toDate() : new Date(valor);
    if (isNaN(fecha.getTime())) return false;
    return fecha >= inicio && fecha <= fin;
};

export interface ConsumoDelPeriodo {
    /** Materiales del área, de mayor a menor consumo. */
    materiales: ConsumoMaterial[];
    m2Totales: number;
    unidadesTotales: number;
    /** Presupuestos del periodo con algún renglón sin desglosar. */
    presupuestosSinDesglosar: number;
    /** Renglones de órdenes del periodo que aún no dicen qué material gastaron. */
    ordenesSinAuditar: number;
    /** Categorías en uso a las que no se les ha dicho el área todavía. */
    categoriasSinArea: string[];
}

export function useConsumoMateriales(ventasCatalogo: any[] = [], ordenes: any[] = []) {
    const [budgets, setBudgets] = useState<DbBudgetEntry[]>([]);
    const [productos, setProductos] = useState<CatalogoProducto[]>([]);
    const [categorias, setCategorias] = useState<CatalogoCategoria[]>([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => subscribeToCatalogoProducts(setProductos), []);
    useEffect(() => subscribeToCatalogoCategories(setCategorias), []);

    useEffect(() => {
        let vivo = true;
        leerPresupuestos()
            .then(b => { if (vivo) setBudgets(b); })
            .catch(e => console.error("No se pudieron cargar los presupuestos para el consumo:", e))
            .finally(() => { if (vivo) setCargando(false); });
        return () => { vivo = false; };
    }, []);

    const ventas = useMemo(
        () => (ventasCatalogo as VentaCatalogo[]) || [],
        [ventasCatalogo]
    );

    const ordenesLista = useMemo(() => ordenes || [], [ordenes]);

    const consumoDe = useCallback((area: AreaVista, inicio: Date, fin: Date): ConsumoDelPeriodo => {
        const presupuestos = budgets.filter(b => enRango(b.dateCreated, inicio, fin));
        const delMostrador = ventas.filter(v => enRango(v?.fecha, inicio, fin));
        // Las órdenes ya facturadas son la tercera fuente: es donde está el
        // grueso de lo que sale del rollo cada mes.
        const delTaller = ordenesLista.filter(o => enRango(o?.fecha, inicio, fin));

        const materiales = unirConsumos(
            consumoPorMaterial(delMostrador),
            consumoDesdePresupuestos(presupuestos),
            consumoDesdeOrdenes(delTaller)
        ).filter(m => {
            // Los materiales auditados en órdenes pueden no estar dados de alta
            // en el catálogo: su clave es "nombre:Banner". Para esos se busca el
            // producto por nombre antes de rendirse.
            const producto = productos.find(p => p.id === m.productoId)
                || productos.find(p => p.nombre.toLowerCase() === m.productoNombre.toLowerCase());
            return materialEsDelArea(areaDeProducto(producto, categorias), area);
        });

        const usadas = new Set(
            materiales.map(m => productos.find(p => p.id === m.productoId)?.categoriaId).filter(Boolean)
        );

        return {
            materiales,
            m2Totales: materiales.reduce((t, m) => t + m.m2Totales, 0),
            unidadesTotales: materiales.reduce((t, m) => t + m.unidadesTotales, 0),
            presupuestosSinDesglosar: presupuestos.filter(b => itemsSinClasificar(b) > 0).length,
            ordenesSinAuditar: renglonesSinAuditar(delTaller),
            categoriasSinArea: categorias.filter(c => usadas.has(c.id) && !c.area).map(c => c.nombre),
        };
    }, [budgets, ventas, ordenesLista, productos, categorias]);

    return { consumoDe, cargando };
}
