export interface GastoInsumo {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string
  monto: number // USD
  montoBs: number // Bolívares
  tasaDolar: number // Tasa usada al momento del registro
  fecha: Date
  categoria: "insumos" | "materiales" | "servicios" | "otros"
  estado: "pendiente" | "pagado"
  createdAt: Date
  updatedAt: Date
}

export interface GastoFijo {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string
  monto: number // USD
  montoBs: number // Bolívares
  tasaDolar: number // Tasa al momento del registro
  fechaPago: number // día del mes (1-31)
  frecuencia: "mensual" | "quincenal"
  activo: boolean
  notificaciones: boolean
  diasAviso: number // días antes de la fecha para notificar
  ultimoPago?: Date
  proximoPago: Date
  createdAt: Date
  updatedAt: Date

  // Campos que las vistas ya usaban pero el tipo no declaraba, así que
  // TypeScript no protegía absolutamente nada aquí.
  categoria?: string
  moneda?: 'USD' | 'BS' | string
  proveedor?: string
  /** Último monto realmente pagado, para mostrarlo sin recalcularlo por tasa. */
  ultimoMontoPagadoUSD?: number
  ultimoMontoPagadoBs?: number
  /** Con qué se pagó la última vez, para proponerlo por defecto. */
  ultimoMetodoPago?: string
}

/** Comisión, bono o adelanto cargado a mano a un empleado y aún sin pagar. */
export interface ComisionEmpleado {
  id: string
  monto: number
  desc?: string
}

/** Regla de tarifa configurable para calcular comisiones de ese empleado. */
export interface ReglaComision {
  id: string
  nombre: string
  tipo: 'FIJO' | 'PORCENTAJE' | string
  valor: number
  descripcion?: string
}

/**
 * Empleado de nómina.
 *
 * OJO: este tipo estaba completamente desfasado. Declaraba `salario`,
 * `fechaPago`, `empresa_id`... campos que no existen en la base de datos.
 * El código real siempre usó `montoSueldo`, `frecuenciaPago`, `ultimoPagoIso`
 * y `comisiones`. Como los nombres no coincidían, TypeScript no detectaba
 * ni un solo error de nómina.
 */
export interface Empleado {
  id: string
  nombre: string
  apellido?: string
  email?: string
  telefono?: string
  /** Puesto/cargo. Ambos nombres aparecen en datos existentes. */
  puesto?: string
  cargo?: string

  /** Sueldo base en USD. */
  montoSueldo: number
  frecuenciaPago?: 'Semanal' | 'Quincenal' | 'Mensual' | string
  /** Día del mes (mensual/quincenal) o día de la semana (semanal). */
  diaPago?: number | string

  /** Mes ya cobrado, en formato YYYY-MM y en hora LOCAL (ver lib/utils/fechas). */
  ultimoPagoMes?: string
  /** Fecha ISO del último pago, base del control de los 7 días del sueldo semanal. */
  ultimoPagoIso?: string

  comisiones?: ComisionEmpleado[]
  reglasComision?: ReglaComision[]

  /** Enlace con la cuenta de acceso, para que el empleado vea sus finanzas. */
  usuarioId?: string
  activo?: boolean

  createdAt?: any
  updatedAt?: any
}

/** Un concepto dentro de un pago: sueldo, comisión o bono por tarea. */
export interface ConceptoPago {
  tipo: 'Sueldo' | 'Comisión' | 'Bono Tarea' | string
  monto: number
  motivo?: string
}

/**
 * Pago de nómina ya efectuado. También estaba desfasado: declaraba `monto` y
 * `empleado_id`, cuando lo que se guarda es `totalUSD` y `empleadoId`.
 */
export interface PagoEmpleado {
  id: string
  empleadoId: string
  nombre?: string
  conceptos?: ConceptoPago[]
  totalUSD: number
  totalVES?: number
  tasaBCV?: number
  metodoPago?: string
  areaAsignada?: string
  notaAdicional?: string
  /** Fecha ISO del pago. */
  fecha: string
  /** Mes al que se imputa, YYYY-MM en hora local. */
  mesRelativo?: string
  usuarioId?: string | null
}

export interface Cobranza {
  id: string
  empresa_id: string
  ordenNumero: string
  cliente: string
  montoUSD: number
  montoBs: number
  tasaDolar: number
  estado: "pagado" | "abonado" | "pendiente"
  fechaCobranza: Date
  createdAt: Date
}

export interface ResumenGastos {
  totalInsumosUSD: number
  totalInsumosBS: number
  totalMaterialesUSD: number
  totalMaterialesBS: number
  totalServiciosUSD: number
  totalServiciosBS: number
  totalOtrosUSD: number
  totalOtrosBS: number
  totalEmpleadosUSD: number
  totalEmpleadosBS: number
  totalGastosFijosUSD: number
  totalGastosFijosBS: number
  totalCobranzasUSD: number
  totalCobranzasBS: number
  totalGastosUSD: number
  totalGastosBS: number
  gananciaNetaUSD: number
  gananciaNetaBS: number
  periodo: "mes" | "trimestre" | "año"
  fecha: Date
}
