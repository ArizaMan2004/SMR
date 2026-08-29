// @/lib/utils/nomina.ts
//
// Cálculo de lo que se le debe a un empleado.
//
// Esta lógica estaba copiada en cuatro sitios (el resumen de Gestión de Personal,
// la tarjeta de cada empleado, el modal de pago y la vista "Mis Finanzas" del
// propio empleado) y con el tiempo dejaron de coincidir: el modal podía mostrar
// un monto y registrarse otro, o el empleado veía un pendiente distinto al que
// veía el jefe. Ahora todos llaman aquí.

import { claveMesLocal, diasDesde } from "@/lib/utils/fechas";

/** Días que deben pasar entre dos pagos de un sueldo semanal. Una semana son 7. */
export const DIAS_ENTRE_PAGOS_SEMANALES = 7;

/**
 * Sueldo base que toca pagar ahora mismo: el monto completo si ya corresponde,
 * o 0 si el periodo actual ya fue cobrado.
 */
export const sueldoPendienteDe = (empleado: any): number => {
    const monto = Number(empleado?.montoSueldo) || 0;
    if (monto <= 0) return 0;

    if (empleado.frecuenciaPago === "Semanal") {
        if (empleado.ultimoPagoIso && diasDesde(empleado.ultimoPagoIso) < DIAS_ENTRE_PAGOS_SEMANALES) {
            return 0;
        }
        return monto;
    }

    // Mensual y quincenal se controlan por mes cobrado.
    return empleado.ultimoPagoMes === claveMesLocal() ? 0 : monto;
};

/** Comisiones y adelantos cargados a mano que aún no se le han pagado. */
export const comisionesPendientesDe = (empleado: any): number =>
    (empleado?.comisiones || []).reduce((total: number, c: any) => total + (Number(c.monto) || 0), 0);

/** Tareas ya aprobadas por el admin que todavía están sin pagar. */
export const tareasPorPagarDe = (empleadoId: string, tareas: any[]): any[] =>
    (tareas || []).filter(
        t => t.empleadoDbId === empleadoId && t.estado === "APROBADA" && t.estadoPago === "PENDIENTE"
    );

export const bonosPendientesDe = (empleadoId: string, tareas: any[]): number =>
    tareasPorPagarDe(empleadoId, tareas).reduce(
        (total: number, t: any) => total + (Number(t.montoComision) || 0),
        0
    );

/** Desglose completo de lo que se le debe. Es lo que se muestra y lo que se paga. */
export interface DeudaEmpleado {
    sueldo: number;
    comisiones: number;
    bonos: number;
    total: number;
    tareasPorPagar: any[];
}

export const calcularDeuda = (empleado: any, tareas: any[]): DeudaEmpleado => {
    const sueldo = sueldoPendienteDe(empleado);
    const comisiones = comisionesPendientesDe(empleado);
    const tareasPorPagar = tareasPorPagarDe(empleado?.id, tareas);
    const bonos = tareasPorPagar.reduce((t: number, x: any) => t + (Number(x.montoComision) || 0), 0);

    return { sueldo, comisiones, bonos, total: sueldo + comisiones + bonos, tareasPorPagar };
};
