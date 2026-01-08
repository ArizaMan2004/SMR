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
}

export interface Empleado {
  id: string
  empresa_id: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  puesto: string
  salario: number // USD
  salarioBs: number // Bolívares
  tasaDolar: number // Tasa actual
  fechaPago: number // día del mes
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PagoEmpleado {
  id: string
  empresa_id: string
  empleado_id: string
  monto: number // USD
  montoBs: number // Bolívares
  tasaDolar: number // Tasa usada
  fechaPago: Date
  estado: "pendiente" | "pagado"
  referencia?: string
  createdAt: Date
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
