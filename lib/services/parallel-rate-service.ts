// src/lib/services/parallel-rate-service.ts

export interface ParallelData {
  fuente: string;
  promedio: number;
  fechaActualizacion: string;
}

/**
 * Obtiene la tasa del dólar paralelo desde la API externa.
 */
export async function fetchParallelRateFromAPI(): Promise<number> {
  try {
    const response = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      cache: 'no-store' // Para asegurar datos frescos
    });
    const data: ParallelData = await response.json();
    
    // Basado en tu imagen d8d085.png, el valor que necesitas es 'promedio'
    return data.promedio || 0;
  } catch (error) {
    console.error("Error al obtener la tasa paralela:", error);
    return 0;
  }
}