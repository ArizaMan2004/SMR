// @/lib/types/horarios.ts
//
// HORARIO ESTÁNDAR DEL PERSONAL.
//
// El horario del taller es un ESTÁNDAR: "Juan viene lunes, miércoles y viernes
// de 8 a 12". No cambia cada semana. Por eso no se guardan bloques con fecha
// concreta —eso obligaba a rellenar la agenda semana tras semana— sino un único
// patrón semanal por persona que se repite solo.
//
// Se sigue admitiendo más de un bloque el mismo día, porque muchos del equipo
// son estudiantes y hacen turno partido: vienen por la mañana, se van a clase
// y vuelven por la tarde.

/** Un tramo de presencia dentro de un día: "de 8:00 a 12:00". */
export interface BloqueHorario {
    inicio: string; // HH:MM en 24h
    fin: string;    // HH:MM en 24h
}

/**
 * Horario semanal de una persona.
 *
 * `dias` va indexado por el día de la semana de JavaScript:
 * 0 = domingo, 1 = lunes ... 6 = sábado. Lista vacía = ese día no viene.
 */
export interface HorarioEstandar {
    /** Coincide con el id del empleado: un horario por persona. */
    id: string;
    empleadoId: string;
    /** Desnormalizado para pintar la agenda sin cruzar colecciones. */
    empleadoNombre: string;
    dias: Record<number, BloqueHorario[]>;
    /** Permite "apagar" a alguien sin borrar su horario (vacaciones, baja). */
    activo: boolean;
    /** Nota libre: "en época de exámenes entra a las 12". */
    nota?: string;
    actualizadoEn?: string;
}

export const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const NOMBRES_DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Orden de la semana empezando en lunes, que es como se lee una agenda. */
export const SEMANA_LABORAL = [1, 2, 3, 4, 5, 6, 0];

/**
 * HORARIO DE LA CASA.
 *
 * El del taller: se abre a las 8:00, se cierra a las 12:30 para almorzar y se
 * vuelve a abrir de 2:00 a 6:00. Es el que cumple casi todo el equipo, así que
 * vive en un solo sitio: si algún día cambia el horario del local, se cambia
 * aquí y se puede volver a aplicar a todos.
 */
export const HORARIO_CASA: BloqueHorario[] = [
    { inicio: '08:00', fin: '12:30' },
    { inicio: '14:00', fin: '18:00' },
];

/**
 * Días que abre el taller: de lunes a sábado. El domingo no se trabaja.
 * Si algún día el sábado pasa a ser media jornada, se ajusta esa columna a
 * mano por persona; el resto de la semana no se toca.
 */
export const DIAS_LABORABLES = [1, 2, 3, 4, 5, 6];

/** Turnos habituales, para rellenar de un toque en vez de teclear horas. */
export const TURNOS_RAPIDOS: { label: string; bloques: BloqueHorario[] }[] = [
    { label: 'Horario de la casa', bloques: HORARIO_CASA },
    { label: 'Solo mañana', bloques: [{ inicio: '08:00', fin: '12:30' }] },
    { label: 'Solo tarde', bloques: [{ inicio: '14:00', fin: '18:00' }] },
    { label: 'Media jornada', bloques: [{ inicio: '12:00', fin: '18:00' }] },
];

// --- UTILIDADES DE HORA ---

/** "08:30" -> 510 minutos. Sirve para ordenar, comparar y sumar. */
export const horaAMinutos = (hora: string): number => {
    const [h, m] = (hora || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

/** Duración de un bloque en horas decimales. */
export const duracionEnHoras = (bloque: BloqueHorario): number => {
    const minutos = horaAMinutos(bloque.fin) - horaAMinutos(bloque.inicio);
    return minutos > 0 ? minutos / 60 : 0;
};

/** "08:30" -> "8:30 am". En el taller se lee mejor el formato de 12 horas. */
export const formatoAmPm = (hora: string): string => {
    const [h, m] = (hora || '0:0').split(':').map(Number);
    const sufijo = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m || 0).padStart(2, '0')} ${sufijo}`;
};

/** Dos bloques del mismo día que se pisan: casi siempre es un error de tecleo. */
export const seSolapan = (a: BloqueHorario, b: BloqueHorario): boolean =>
    horaAMinutos(a.inicio) < horaAMinutos(b.fin) && horaAMinutos(b.inicio) < horaAMinutos(a.fin);

/** Total de horas que cumple una persona en la semana. */
export const horasSemanales = (horario: HorarioEstandar): number =>
    Object.values(horario.dias || {}).reduce(
        (total, bloques) => total + (bloques || []).reduce((t, b) => t + duracionEnHoras(b), 0),
        0
    );

/** Bloques de una persona para un día de la semana, ya ordenados. */
export const bloquesDelDia = (horario: HorarioEstandar, diaSemana: number): BloqueHorario[] =>
    [...(horario.dias?.[diaSemana] || [])].sort((a, b) => horaAMinutos(a.inicio) - horaAMinutos(b.inicio));

// --- QUIÉN VIENE HOY ---

export interface AsistenciaDelDia {
    empleadoId: string;
    empleadoNombre: string;
    bloques: BloqueHorario[];
    /** Minuto en que entra por primera vez, para ordenar la lista. */
    entradaMin: number;
    /** true si ahora mismo debería estar en el taller. */
    presenteAhora: boolean;
}

/**
 * Quién trabaja en un día concreto, ordenado por hora de entrada.
 * Es lo que alimenta tanto la barra de novedades como el resumen del panel.
 */
export const asistenciaDe = (
    horarios: HorarioEstandar[],
    fecha: Date = new Date()
): AsistenciaDelDia[] => {
    const dia = fecha.getDay();
    const ahora = fecha.getHours() * 60 + fecha.getMinutes();

    return horarios
        .filter(h => h.activo !== false)
        .map(h => {
            const bloques = bloquesDelDia(h, dia);
            if (bloques.length === 0) return null;
            return {
                empleadoId: h.empleadoId,
                empleadoNombre: h.empleadoNombre,
                bloques,
                entradaMin: horaAMinutos(bloques[0].inicio),
                presenteAhora: bloques.some(
                    b => ahora >= horaAMinutos(b.inicio) && ahora < horaAMinutos(b.fin)
                ),
            };
        })
        .filter((x): x is AsistenciaDelDia => x !== null)
        .sort((a, b) => a.entradaMin - b.entradaMin);
};

/** Resumen en una línea: "8:00 am — 12:00 pm · 2:00 pm — 6:00 pm". */
export const resumenBloques = (bloques: BloqueHorario[]): string =>
    bloques.map(b => `${formatoAmPm(b.inicio)} — ${formatoAmPm(b.fin)}`).join(' · ');
