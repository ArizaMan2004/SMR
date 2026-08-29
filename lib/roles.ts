// @/lib/roles.ts
//
// CATÁLOGO DE VISTAS Y PERMISOS POR DEFECTO.
//
// Los permisos ya NO están quemados aquí: el admin los edita desde la app y se
// guardan en Firestore (ver lib/services/roles-service.ts). Este archivo aporta
// dos cosas que sí deben vivir en el código:
//
//   1. VIEW_CATALOG  → qué vistas existen y cómo se llaman en la UI de permisos.
//   2. PERMISOS_POR_DEFECTO → con qué arranca cada rol de fábrica, y a qué se
//      recurre si un rol no tiene configuración guardada.
//
// Antes esto estaba repartido en cuatro sitios (sidebar, dashboard, cada vista y
// UsersManagementView) que se contradecían entre sí. De ahí salían las pantallas
// en blanco y el rol CAJERO que no se podía ni asignar.

// --- IDENTIFICADORES DE VISTA ---

export type ViewId =
    | 'orders'
    | 'tasks_taller'
    | 'task_control'
    | 'my_finances'
    | 'profile_settings'
    | 'notifications_full'
    | 'users_auth'
    | 'wallets'
    | 'payment_audit'
    | 'financial_stats'
    | 'design_production'
    | 'fixed_expenses'
    | 'insumos_mgmt'
    | 'employees_mgmt'
    | 'horarios'
    | 'catalogo_ventas'
    | 'clients'
    | 'calculator'
    | 'old_calculator'
    | 'ai_background'
    | 'ai_upscale'
    | 'format_converter';

export interface ViewMeta {
    id: ViewId;
    label: string;
    /** Para agrupar los checkboxes en la pantalla de permisos. */
    grupo: 'Operación' | 'Administración' | 'Ventas' | 'Herramientas' | 'Personal';
    descripcion: string;
    /** Vistas que todo el mundo debe tener siempre: no se pueden quitar. */
    siempre?: boolean;
}

/**
 * Todas las vistas que existen en el sistema. Si añades una vista nueva al
 * dashboard, agrégala aquí y aparecerá sola en la pantalla de permisos.
 */
export const VIEW_CATALOG: ViewMeta[] = [
    // Operación diaria
    { id: 'orders', label: 'Facturación y Cierre', grupo: 'Operación', descripcion: 'Crear órdenes, cobrar y cerrar el día' },
    { id: 'tasks_taller', label: 'Taller de Producción', grupo: 'Operación', descripcion: 'Trabajos en curso por área' },
    { id: 'task_control', label: 'Control de Tareas (Bonos)', grupo: 'Operación', descripcion: 'Asignar tareas y aprobar bonos' },
    { id: 'my_finances', label: 'Mis Finanzas', grupo: 'Operación', descripcion: 'Lo que cada empleado ha ganado' },

    // Ventas
    { id: 'catalogo_ventas', label: 'Catálogo & Ventas', grupo: 'Ventas', descripcion: 'Inventario y venta directa de mercancía' },
    { id: 'clients', label: 'Clientes & Cobranza', grupo: 'Ventas', descripcion: 'Base de clientes y estados de cuenta' },
    { id: 'calculator', label: 'Presupuestos / Cotizaciones', grupo: 'Ventas', descripcion: 'Generar presupuestos en PDF' },

    // Administración
    { id: 'wallets', label: 'Billeteras & Caja', grupo: 'Administración', descripcion: 'Saldos y movimientos de efectivo' },
    { id: 'payment_audit', label: 'Auditoría de Pagos', grupo: 'Administración', descripcion: 'Revisión de todo lo cobrado y pagado' },
    { id: 'financial_stats', label: 'Balance y Estadísticas', grupo: 'Administración', descripcion: 'Ingresos, egresos y utilidad' },
    { id: 'fixed_expenses', label: 'Gastos Fijos', grupo: 'Administración', descripcion: 'Alquiler, servicios y recurrentes' },
    { id: 'insumos_mgmt', label: 'Insumos y Materiales', grupo: 'Administración', descripcion: 'Compras de material' },
    { id: 'users_auth', label: 'Accesos y Roles', grupo: 'Administración', descripcion: 'Quién entra y qué puede ver' },

    // Personal
    { id: 'employees_mgmt', label: 'Gestión de Personal', grupo: 'Personal', descripcion: 'Empleados, sueldos y pagos' },
    { id: 'horarios', label: 'Horarios del Personal', grupo: 'Personal', descripcion: 'Quién viene y a qué hora, por bloques' },
    { id: 'design_production', label: 'Pago Diseños', grupo: 'Personal', descripcion: 'Comisiones de diseñadores' },

    // Herramientas
    { id: 'old_calculator', label: 'Calculadora de Costos', grupo: 'Herramientas', descripcion: 'Cálculo de área, láser y divisas' },
    { id: 'ai_background', label: 'IA Quita Fondos', grupo: 'Herramientas', descripcion: 'Quitar el fondo de una imagen' },
    { id: 'ai_upscale', label: 'IA Upscale (HD)', grupo: 'Herramientas', descripcion: 'Aumentar resolución de imágenes' },
    { id: 'format_converter', label: 'Convertidor de Formatos', grupo: 'Herramientas', descripcion: 'Convertir imágenes en lote' },

    // Siempre disponibles: no tiene sentido quitárselas a nadie
    { id: 'profile_settings', label: 'Mi Perfil', grupo: 'Operación', descripcion: 'Datos y preferencias propias', siempre: true },
    { id: 'notifications_full', label: 'Notificaciones', grupo: 'Operación', descripcion: 'Centro de avisos', siempre: true },
];

export const ALL_VIEW_IDS: ViewId[] = VIEW_CATALOG.map(v => v.id);

/** Vistas que nadie puede perder, se configure lo que se configure. */
export const VISTAS_SIEMPRE_VISIBLES: ViewId[] = VIEW_CATALOG.filter(v => v.siempre).map(v => v.id);

export function getViewMeta(id: string): ViewMeta | undefined {
    return VIEW_CATALOG.find(v => v.id === id);
}

// --- ROLES ---

/** Un rol puede ser de fábrica o creado por el admin, así que el id es texto libre. */
export type RolId = string;

export interface RolDefinicion {
    id: RolId;
    label: string;
    /** Clases de Tailwind para el badge del rol. */
    color: string;
    vistas: ViewId[];
    /** Los de fábrica no se pueden borrar (sí se les pueden cambiar las vistas). */
    esSistema: boolean;
    /** Gente de taller: se le abre por defecto la pestaña de su área. */
    esProduccion?: boolean;
}

export const ROL_ADMIN: RolId = 'ADMIN';
export const ROL_POR_DEFECTO: RolId = 'EMPLEADO';

// Todo el personal puede consultar los horarios (saber cuándo le toca venir);
// solo quien supervisa puede modificarlos.
const VISTAS_TALLER: ViewId[] = ['tasks_taller', 'task_control', 'my_finances', 'horarios'];

/**
 * Roles de fábrica. El admin puede editarles las vistas y crear los suyos,
 * pero estos siempre existen para que el sistema nunca se quede sin roles.
 */
export const ROLES_SISTEMA: RolDefinicion[] = [
    {
        id: 'ADMIN',
        label: 'Administrador Principal',
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
        esSistema: true,
        vistas: [...ALL_VIEW_IDS],
    },
    {
        id: 'VENDEDOR',
        label: 'Ventas / Atención',
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
        esSistema: true,
        vistas: ['orders', 'calculator', ...VISTAS_TALLER, 'old_calculator', 'ai_background', 'ai_upscale', 'format_converter'],
    },
    {
        id: 'CAJERO',
        label: 'Cajero / Punto de Venta',
        color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
        esSistema: true,
        vistas: ['orders', 'catalogo_ventas', 'clients', 'calculator', 'horarios', 'old_calculator', 'format_converter'],
    },
    {
        id: 'DISENADOR',
        label: 'Diseño Gráfico',
        color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
        esSistema: true,
        esProduccion: true,
        vistas: [...VISTAS_TALLER, 'old_calculator', 'ai_background', 'ai_upscale', 'format_converter'],
    },
    {
        id: 'IMPRESOR',
        label: 'Operador de Impresión',
        color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
        esSistema: true,
        esProduccion: true,
        vistas: [...VISTAS_TALLER, 'old_calculator', 'format_converter'],
    },
    {
        id: 'OPERADOR_LASER',
        label: 'Operador de Corte / Láser',
        color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
        esSistema: true,
        esProduccion: true,
        vistas: [...VISTAS_TALLER, 'old_calculator', 'format_converter'],
    },
    {
        id: 'PRODUCCION',
        label: 'Jefe de Producción',
        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
        esSistema: true,
        esProduccion: true,
        vistas: [...VISTAS_TALLER, 'catalogo_ventas', 'old_calculator', 'ai_background', 'ai_upscale', 'format_converter'],
    },
    {
        id: 'EMPLEADO',
        label: 'Empleado Base',
        color: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
        esSistema: true,
        esProduccion: true,
        vistas: [...VISTAS_TALLER],
    },
];

export const COLORES_ROL = [
    { label: 'Morado', value: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    { label: 'Azul', value: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    { label: 'Turquesa', value: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400' },
    { label: 'Índigo', value: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
    { label: 'Cian', value: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400' },
    { label: 'Naranja', value: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
    { label: 'Verde', value: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    { label: 'Rosa', value: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' },
    { label: 'Gris', value: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
];

export const COLOR_ROL_POR_DEFECTO = COLORES_ROL[COLORES_ROL.length - 1].value;

// --- RESOLUCIÓN DE PERMISOS ---

/** Permisos sueltos que el admin le da o le quita a UNA persona concreta. */
export interface OverridesUsuario {
    vistasExtra?: string[];
    vistasBloqueadas?: string[];
}

/**
 * Decide qué vistas ve una persona. Es la ÚNICA función que decide esto:
 * la usan igual el menú lateral y el render del dashboard, así que es imposible
 * que el menú ofrezca algo que luego no abra.
 *
 * Orden de resolución:
 *   1. Las vistas del rol (personalizado si existe, o el de fábrica).
 *   2. + vistasExtra de esa persona.
 *   3. − vistasBloqueadas de esa persona.
 *   4. + las vistas que nadie puede perder (perfil, notificaciones).
 *
 * El ADMIN siempre lo ve todo: si no, podría quitarse a sí mismo el acceso a la
 * pantalla de permisos y quedarse fuera de su propia aplicación sin vuelta atrás.
 */
export function resolverVistas(
    rol: RolId | undefined | null,
    rolesDisponibles: RolDefinicion[],
    overrides?: OverridesUsuario
): Set<ViewId> {
    if (rol === ROL_ADMIN) return new Set(ALL_VIEW_IDS);

    const definicion = rolesDisponibles.find(r => r.id === rol);
    const permitidas = new Set<ViewId>(definicion?.vistas ?? []);

    for (const v of overrides?.vistasExtra ?? []) {
        if (ALL_VIEW_IDS.includes(v as ViewId)) permitidas.add(v as ViewId);
    }
    for (const v of overrides?.vistasBloqueadas ?? []) {
        permitidas.delete(v as ViewId);
    }
    for (const v of VISTAS_SIEMPRE_VISIBLES) {
        permitidas.add(v);
    }

    return permitidas;
}

/**
 * Primera vista al entrar. La gente de taller aterriza en el Taller y no en
 * Facturación, que es lo que activa el interruptor "Es personal de taller"
 * de la pantalla de rangos.
 */
export function vistaInicialPara(vistasPermitidas: Set<ViewId>, esProduccion = false): ViewId {
    const preferencia: ViewId[] = esProduccion
        ? ['tasks_taller', 'task_control', 'my_finances', 'catalogo_ventas', 'orders', 'profile_settings']
        : ['orders', 'catalogo_ventas', 'tasks_taller', 'task_control', 'my_finances', 'profile_settings'];
    return preferencia.find(v => vistasPermitidas.has(v)) ?? 'profile_settings';
}

// --- PERMISOS DE ACCIÓN (dentro de una vista) ---
//
// Distintos de los de vista: no es "puede entrar", es "puede tocar".
// Antes los tres se llamaban `isAdmin` en archivos distintos y significaban
// cosas diferentes, que es de donde salía el comportamiento errático.

/** El dueño. Solo para lo que de verdad es exclusivo suyo. */
export function esAdmin(rol: string | undefined | null): boolean {
    return rol === ROL_ADMIN;
}

/** Puede crear, editar y borrar productos del catálogo y anular ventas. */
export function puedeGestionarInventario(rol: string | undefined | null): boolean {
    return rol === ROL_ADMIN || rol === 'PRODUCCION';
}

/** Puede asignar tareas, aprobarlas, rechazarlas y marcarlas como pagadas. */
export function puedeSupervisarTareas(rol: string | undefined | null): boolean {
    return rol === ROL_ADMIN || rol === 'PRODUCCION';
}
