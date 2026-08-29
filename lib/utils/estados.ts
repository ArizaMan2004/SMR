// @/lib/utils/estados.ts
//
// Normalización del estado de pago de una orden.
//
// En la base de datos conviven DOS formas de escribir lo mismo, según qué
// pantalla creó el registro:
//
//   - dashboard y Clientes & Cobranza escriben  "PAGADO" / "ABONADO"
//   - Pago Diseños usa el enum EstadoPago, que vale "Pagado" / "Pendiente"
//
// Como las comparaciones estaban hechas contra la forma en mayúsculas, las
// órdenes creadas desde Pago Diseños no cuadraban: su deuda no se sumaba al
// estado de cuenta del cliente y el badge de "Abonado" nunca se pintaba.
//
// La solución es leer siempre de forma tolerante (da igual cómo esté escrito)
// y escribir siempre en la forma canónica en mayúsculas.

export type EstadoPagoCanonico = 'PENDIENTE' | 'ABONADO' | 'PAGADO' | 'ANULADO';

/**
 * Lleva cualquier variante a la forma canónica.
 * "Pagado", "pagado", "PAGADO" y "  Pagado " son todos 'PAGADO'.
 * Lo que no se reconozca (incluido undefined) se trata como 'PENDIENTE',
 * que es la lectura prudente: una orden sin estado se debe, no está cobrada.
 */
export const normalizarEstadoPago = (valor: any): EstadoPagoCanonico => {
    const texto = String(valor ?? '').trim().toUpperCase();
    if (texto === 'PAGADO') return 'PAGADO';
    if (texto === 'ABONADO') return 'ABONADO';
    if (texto === 'ANULADO') return 'ANULADO';
    return 'PENDIENTE';
};

export const esPagada = (orden: any): boolean => normalizarEstadoPago(orden?.estadoPago) === 'PAGADO';
export const esAbonada = (orden: any): boolean => normalizarEstadoPago(orden?.estadoPago) === 'ABONADO';
export const esAnulada = (orden: any): boolean => normalizarEstadoPago(orden?.estadoPago) === 'ANULADO';

/** Sigue debiendo dinero: ni cobrada del todo ni anulada. */
export const tieneDeuda = (orden: any): boolean => {
    const estado = normalizarEstadoPago(orden?.estadoPago);
    return estado === 'PENDIENTE' || estado === 'ABONADO';
};

/**
 * Tolerancia de un céntimo al comparar dinero.
 *
 * Los abonos se van sumando uno sobre otro y la coma flotante acumula restos:
 * en la base hay 47 órdenes marcadas como PAGADO cuyo `montoPagadoUSD` es
 * 13.999999999999982 frente a un total de 14. Comparar con `>=` exacto las
 * dejaba fuera del contador de "Pagadas" y las sumaba a "Abonadas".
 */
export const TOLERANCIA_CENTIMO = 0.01;

/** Lo que falta por cobrar. Los restos de coma flotante se tratan como cero. */
export const saldoDeOrden = (orden: any): number => {
    const saldo = (Number(orden?.totalUSD) || 0) - (Number(orden?.montoPagadoUSD) || 0);
    return Math.abs(saldo) < TOLERANCIA_CENTIMO ? 0 : saldo;
};

/** Cobrada del todo (con tolerancia de un céntimo). */
export const estaSaldada = (orden: any): boolean =>
    (Number(orden?.totalUSD) || 0) > 0 && saldoDeOrden(orden) <= 0;

/** Tiene algo abonado pero aún debe. */
export const estaAbonada = (orden: any): boolean =>
    (Number(orden?.montoPagadoUSD) || 0) > 0 && saldoDeOrden(orden) > 0;

/** Redondea a céntimos antes de guardar, para no seguir acumulando basura. */
export const aCentimos = (valor: number): number => Math.round((Number(valor) || 0) * 100) / 100;

/**
 * ¿Este ítem es corte láser?
 *
 * Mismo problema que con el estado de pago: hay dos valores conviviendo en la
 * base de datos para lo mismo. El wizard de órdenes (item-form-modal) guarda
 * 'CORTE', mientras que la conversión desde la Calculadora guarda 'CORTE_LASER'.
 * Cualquier comparación contra uno solo de los dos deja fuera la mitad de los
 * trabajos de láser.
 */
export const esCorteLaser = (tipoServicio: any): boolean => {
    const texto = String(tipoServicio ?? '').trim().toUpperCase();
    return texto === 'CORTE' || texto === 'CORTE_LASER';
};
