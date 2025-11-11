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
    metodo: 'Transferencia' | 'Efectivo' | 'Pago Móvil' | 'Punto de Venta' | 'Otro';
    referencia?: string;
    registradoPor: string; // ID del usuario que registra el pago
}

// --- Interfaz de Ítem de Cobro / Tarea ---

// 🔑 DEFINICIÓN DE TIPOS UNIFICADOS
export type TipoServicio = 'CORTE_LASER' | 'IMPRESION' | 'ROTULACION' | 'AVISO_CORPOREO' | 'OTROS';
export type UnidadItem = 'm2' | 'und' | 'tiempo';


export interface ItemOrden {
    nombre: string;
    // 🔑 TIPO DE SERVICIO CORREGIDO:
    tipoServicio: TipoServicio;
    unidad: UnidadItem;
    cantidad: number;
    precioUnitario: number; // Precio por m2, unidad, o minuto
    
    // Campos opcionales según la unidad de medida
    medidaXCm?: number;
    medidaYCm?: number;
    tiempoCorte?: string; // Usado si unidad es 'tiempo'
    
    // 🔑 NUEVOS CAMPOS AÑADIDOS para los detalles de material
    materialDeImpresion?: string; // Ej: "Vinil Brillante"
    materialDetalleCorte?: string; // Ej: "Acrilico 3mm Negro"

    material?: string; // Campo antiguo/genérico (mantengo el campo original por si acaso)
    impresionMaterialPropio?: 'Propio' | 'Intermediario';

    empleadoAsignado?: string; 
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
    montoPagadoUSD: number; // Se convierte en la suma de los abonos
    estadoPago: EstadoPago; // Determinado por la comparación de totalUSD vs montoPagadoUSD
    registroPagos: PaymentLog[]; // Historial de abonos
    
    // Estado de la orden (Progreso)
    estado: EstadoOrden; 
}