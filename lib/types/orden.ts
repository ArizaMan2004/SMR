// @/lib/types/orden.ts

// Enum para el estado de la orden (usado en la tabla y modal)
export enum EstadoOrden {
    PENDIENTE = 'Pendiente',
    PROCESO = 'En Proceso',
    TERMINADO = 'Terminado',
    CANCELADO = 'Cancelado',
}

// Enum para el estado de pago (usado en la vista de pagos)
export enum EstadoPago {
    PENDIENTE = 'Pendiente',
    ABONADO = 'Abonado',
    PAGADO = 'Pagado',
    ANULADO = 'Anulado',
}


// --- Interfaces de Datos Simples ---

export interface ClienteData {
    nombreRazonSocial: string;
    rifCedula: string;
    telefono: string;
    domicilioFiscal: string;
    correo: string;
    personaContacto: string;
}

export interface ServiciosSolicitados {
    impresionDigital: boolean;
    impresionGranFormato: boolean;
    corteLaser: boolean;
    laminacion: boolean;
    avisoCorporeo: boolean;
    rotulacion: boolean;
    instalacion: boolean;
    senaletica: boolean;
}

// --- Interfaz de Registro de Pagos ---
export interface PaymentLog {
    montoUSD: number;
    fechaRegistro: string; // ISO String para el registro
    metodo: 'Transferencia' | 'Efectivo' | 'Pago Móvil' | 'Tarjeta Débito/Crédito' | 'Otro';
    referencia: string; // Número de referencia/lote
    bancoOrigen?: string;
    bancoDestino?: string;
}

// --- Tipos de Servicio y Unidades ---
export type TipoServicio = 'IMPRESION' | 'CORTE_LASER' | 'ROTULACION' | 'AVISO_CORPOREO' | 'OTROS';
export type UnidadItem = 'm2' | 'metros' | 'unidades' | 'horas' | 'piezas';


// --- Interfaz de Ítem de la Orden (el producto o servicio individual) ---
export interface ItemOrden {
    nombre: string;
    tipoServicio: TipoServicio;
    cantidad: number;
    unidad: UnidadItem;
    largo?: number; // Medida en la unidad especificada
    ancho?: number; // Medida en la unidad especificada
    tiempoEstimadoMinutos?: number; // Solo para corte láser

    // Impresión
    materialDeImpresion?: string; // Tipo de material (Vinil, Lona, Papel, etc.)

    // Corte Láser
    materialDetalleCorte?: string; // Tipo de material (Acrilico, MDF, etc.)
    grosorCorte?: number; // Grosor en mm
    materialPropio?: 'Propio' | 'Intermediario'; // Campo antiguo/genérico (mantengo el campo original por si acaso)
    impresionMaterialPropio?: 'Propio' | 'Intermediario';

    empleadoAsignado?: string; 
    
    // Precios
    precioUnitario: number; // Precio base (ej. por m2, por unidad)
    subtotal: number;

    // ✅ CORRECCIÓN: Referencias a archivos/imágenes
    imagenes?: string[]; // URLs de las imágenes o referencias de archivos
}

// Se mantiene para compatibilidad, si se usa en order-utils.ts
export interface ItemCobro extends ItemOrden {}


// --- Interfaces de la Orden ---

// Usado para el formulario (wizard) y datos base
export interface FormularioOrdenData {
    ordenNumero: string;
    fechaEntrega: string; // ISO String (YYYY-MM-DD)
    cliente: ClienteData;
    serviciosSolicitados: ServiciosSolicitados;
    items: ItemOrden[];
    descripcionDetallada: string;
}

// Usado para la base de datos y la visualización final 
export interface OrdenServicio {
    id: string; // El ID de Firestore
    ordenNumero: string;
    fecha: string; // ISO String (Fecha de creación de la orden)
    fechaEntrega: string; // ISO String
    cliente: ClienteData;
    serviciosSolicitados: ServiciosSolicitados;
    items: ItemOrden[];
    descripcionDetallada: string;
    
    // Total calculado (en USD)
    totalUSD: number;
    totalBS: number; // Total calculado (en Bolívares)
    
    // CAMPOS DE PAGO ACTUALIZADOS
    montoPagadoUSD: number; // Se convierte en totalUSD si está 'PAGADO', o el monto abonado
    estadoPago: EstadoPago;
    historialPagos: PaymentLog[]; // Registro de abonos
    
    // CAMPOS DE ESTADO DE LA ORDEN
    estado: EstadoOrden; 
    
    // Fechas de seguimiento
    fechaFinalizacion?: string; // ISO String
}