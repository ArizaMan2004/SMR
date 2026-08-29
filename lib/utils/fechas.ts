// @/lib/utils/fechas.ts
//
// Claves de fecha en hora LOCAL.
//
// Todo esto existe por un bug que costaba dinero: el mes se sacaba con
// `new Date().toISOString().slice(0, 7)`, y toISOString() devuelve UTC.
// Venezuela va en UTC-4, así que desde las 8:00 pm del último día del mes
// el sistema ya creía estar en el mes siguiente. Consecuencias reales:
//
//   - Un empleado mensual ya pagado volvía a aparecer como "pendiente",
//     porque su `ultimoPagoMes` no coincidía con el mes recién calculado.
//   - El pago quedaba archivado en el mes equivocado.
//   - El total de "pagado este mes" no cuadraba.
//
// Usa siempre estas funciones para agrupar por día o por mes.

/** "2026-08" en hora local. */
export const claveMesLocal = (fecha: Date = new Date()): string => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
};

/** "2026-08-27" en hora local. */
export const claveFechaLocal = (fecha: Date = new Date()): string => {
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${claveMesLocal(fecha)}-${d}`;
};

/**
 * Mes local de un valor guardado, sea texto ISO, Timestamp de Firestore o Date.
 * Devuelve "" si no se puede interpretar, para que quien llame decida qué hacer.
 */
export const mesDeValor = (valor: any): string => {
    const fecha = aFecha(valor);
    return fecha ? claveMesLocal(fecha) : "";
};

/** Normaliza a Date lo que venga de Firestore: Timestamp, ISO, número o Date. */
export const aFecha = (valor: any): Date | null => {
    if (!valor) return null;
    if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
    // Timestamp de Firestore
    if (typeof valor?.toDate === "function") {
        try {
            return valor.toDate();
        } catch {
            return null;
        }
    }
    const fecha = new Date(valor);
    return isNaN(fecha.getTime()) ? null : fecha;
};

/** Milisegundos para ordenar, tolerante a formatos mezclados. 0 si no se puede leer. */
export const tiempoDe = (valor: any): number => aFecha(valor)?.getTime() ?? 0;

/** Días completos transcurridos desde una fecha hasta hoy. */
export const diasDesde = (valor: any): number => {
    const fecha = aFecha(valor);
    if (!fecha) return Infinity;
    return Math.floor((Date.now() - fecha.getTime()) / 86400000);
};
