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

// --- Interfaz de Registro de Pagos / Transacciones ---
export interface PaymentLog {
    montoUSD: number;
    fechaRegistro: string; // ISO String
    metodo: 'Transferencia' | 'Efectivo' | 'Pago Móvil' | 'Tarjeta Débito/Crédito' | 'Otro';
    referencia: string;
    bancoOrigen?: string;
    bancoDestino?: string;
}

// Alias para compatibilidad con el servicio
export interface PagoTransaction extends PaymentLog {}

// --- Tipos de Servicio y Unidades ---
// Se añaden tipos para cubrir todas las áreas de la TasksView
export type TipoServicio = 
    | 'IMPRESION' 
    | 'CORTE_LASER' 
    | 'ROTULACION' 
    | 'AVISO_CORPOREO' 
    | 'INSTALACION' 
    | 'DISENO' 
    | 'OTROS';

export type UnidadItem = 'm2' | 'metros' | 'unidades' | 'horas' | 'piezas';


// --- Interfaz de Ítem de la Orden ---
export interface ItemOrden {
    nombre: string;
    tipoServicio: TipoServicio;
    cantidad: number;
    unidad: UnidadItem;
    largo?: number; 
    ancho?: number; 
    tiempoEstimadoMinutos?: number; 

    // ✅ MEJORA: Estado de la tarea para persistencia
    completado?: boolean; 

    // Detalles técnicos
    materialDeImpresion?: string; 
    materialDetalleCorte?: string; 
    grosorCorte?: number; 
    materialPropio?: 'Propio' | 'Intermediario'; 
    impresionMaterialPropio?: 'Propio' | 'Intermediario';

    empleadoAsignado?: string; 
    
    // Precios
    precioUnitario: number; 
    subtotal: number;

    // Referencias
    imagenes?: string[]; 
    pruebasImagenes?: string[];
}

// --- Interfaces de la Orden ---

export interface OrdenServicio {
    id?: string; // Opcional porque al crearla no existe aún
    ordenNumero: string;
    fecha: string; // Fecha de creación
    fechaEntrega: string; // Fecha límite original
    
    // ✅ MEJORA: Para el orden de prioridad en TasksView
    fechaEntregaEstimada?: string; 

    cliente: ClienteData;
    serviciosSolicitados: ServiciosSolicitados;
    items: ItemOrden[];
    descripcionDetallada: string;
    
    // Totales
    totalUSD: number;
    totalBS: number; 
    
    // Pagos
    montoPagadoUSD: number; 
    estadoPago: EstadoPago;
    
    // ✅ CORRECCIÓN: Estandarizado con el nombre usado en el servicio
    registroPagos: PaymentLog[]; 
    
    // Estado General
    estado: EstadoOrden; 
    
    // Seguimiento
    fechaFinalizacion?: string; 
    updatedAt?: string;
    designerId?: string;
    designStatus?: string;
}