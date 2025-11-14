// /lib/bcv-service.ts
// Define la nueva estructura de la respuesta de la API
interface BCVRateData {
    rate: number; // USD Rate (para compatibilidad)
    usdRate: number; // Tasa USD
    eurRate: number | null; // Nueva tasa del Euro
    lastUpdated: Date;
    changePercentage: number | null;
    changePercentageUsd: number | null;
    changePercentageEur: number | null;
}

export async function fetchBCVRateFromAPI(): Promise<BCVRateData> {
  try {
    const res = await fetch("/api/bcv")
    if (!res.ok) throw new Error("Error al consultar la API interna del BCV")

    const data = await res.json()
    // Ahora validamos usdRate o el campo 'rate'
    if (!data.rate && !data.usdRate) throw new Error("No se encontró la tasa del BCV en la respuesta")

    return {
      rate: Number(data.rate),
      usdRate: Number(data.usdRate ?? data.rate),
      eurRate: data.eurRate ? Number(data.eurRate) : null, // Captura eurRate
      lastUpdated: new Date(data.lastUpdated),
      changePercentage: data.changePercentage ? Number(data.changePercentage) : null,
      changePercentageUsd: data.changePercentageUsd ? Number(data.changePercentageUsd) : null,
      changePercentageEur: data.changePercentageEur ? Number(data.changePercentageEur) : null,
    }
  } catch (error) {
    console.error("Error obteniendo tasa BCV:", error)
    throw error
  }
}

// Estas funciones simulan almacenamiento local
export function getBCVRate() {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("bcvRate")
    if (stored) return JSON.parse(stored)
  }
  return { rate: 0, lastUpdated: new Date() }
}

export function setBCVRate(rate: number, source: "manual" | "api") {
  const data = { rate, source, lastUpdated: new Date() }
  if (typeof window !== "undefined") {
    localStorage.setItem("bcvRate", JSON.stringify(data))
  }
  return data
}