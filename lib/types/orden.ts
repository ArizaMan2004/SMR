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
    // ✅ AGREGADO: Usado en el dashboard para los badges de cliente
    tipoCliente?: 'REGULAR' | 'ALIADO' | string; 
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
    fechaRegistro?: string; // ISO String (A veces el dashboard manda 'fecha' en vez de 'fechaRegistro')
    fecha?: string; 
    // ✅ CORREGIDO: Ampliado para aceptar "Efectivo USD" o "DESCUENTO" que envía el dashboard
    metodo: 'Transferencia' | 'Efectivo' | 'Pago Móvil' | 'Tarjeta Débito/Crédito' | 'Otro' | 'Efectivo USD' | 'DESCUENTO' | string;
    referencia?: string;
    bancoOrigen?: string;
    bancoDestino?: string;
    nota?: string; // ✅ AGREGADO: El dashboard manda notas al pagar
    imagenUrl?: string; // ✅ AGREGADO: Soporte para comprobantes
    tasaBCV?: number;
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
    // ✅ CORREGIDO: Soporte para números (Firebase suele guardar el autoincremental como número)
    ordenNumero: string | number; 
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
    estadoPago: EstadoPago | string; // Añadido string para evitar choques
    
    registroPagos: PaymentLog[]; 
    
    // Estado General
    estado: EstadoOrden | string; 
    
    // Seguimiento
    fechaFinalizacion?: string; 
    updatedAt?: string;
    designerId?: string;
    designStatus?: string;
}