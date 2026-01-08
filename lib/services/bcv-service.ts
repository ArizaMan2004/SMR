// /lib/bcv-service.ts

/**
 * Interfaz que define la estructura de las tasas en toda la aplicación.
 * Sincronizada con los componentes GastosFijosView y Form.
 */
export interface BCVRates {
  usd: number;
  eur: number;
  lastUpdated: Date;
  changeUsd?: number | null;
  changeEur?: number | null;
  source?: "api" | "cache";
}

/**
 * Consulta tu API interna (/api/bcv) que extrae datos de DolarVzla.
 * Mapea 'usdRate' y 'eurRate' a un formato simplificado para el frontend.
 */
export async function fetchBCVRateFromAPI(): Promise<BCVRates> {
  try {
    const res = await fetch("/api/bcv", { 
      cache: "no-store",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error("Fallo al conectar con la API de tasas");

    const data = await res.json();

    // Mapeo robusto: extrae usdRate o rate del JSON de la API
    const rates: BCVRates = {
      usd: Number(data.usdRate || data.rate || 0),
      eur: Number(data.eurRate || 0),
      changeUsd: data.changePercentageUsd || 0,
      changeEur: data.changePercentageEur || 0,
      lastUpdated: new Date(),
      source: "api"
    };

    // Si la tasa es válida (> 0), la guardamos en el caché del navegador
    if (rates.usd > 0) {
      setBCVRateInStorage(rates);
    }

    return rates;
  } catch (error) {
    console.error("Error en fetchBCVRateFromAPI:", error);
    // Si falla la API, devolvemos lo que tengamos en caché para no romper la UI
    return getBCVRateFromStorage();
  }
}

/**
 * Recupera las tasas guardadas en el navegador (localStorage).
 * Evita que los cálculos den 0 si la API tarda en responder en el primer render.
 */
export function getBCVRateFromStorage(): BCVRates {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("systemax_bcv_cache");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          lastUpdated: new Date(parsed.lastUpdated),
          source: "cache"
        };
      } catch (e) {
        console.error("Error parseando caché de tasas:", e);
      }
    }
  }
  // Valores de emergencia (Fallback) si no hay nada disponible
  return { usd: 0, eur: 0, lastUpdated: new Date() };
}

/**
 * Guarda las tasas procesadas en el storage local.
 */
export function setBCVRateInStorage(rates: BCVRates): void {
  if (typeof window !== "undefined") {
    const dataToSave = {
      ...rates,
      lastUpdated: rates.lastUpdated.toISOString()
    };
    localStorage.setItem("systemax_bcv_cache", JSON.stringify(dataToSave));
  }
}

/**
 * Utilidad para formatear montos en Bolívares con formato local (es-VE).
 */
export function formatBs(amountUSD: number, rate: number): string {
  if (!rate || rate === 0) return "Bs. 0,00";
  return (amountUSD * rate).toLocaleString("es-VE", {
    style: "currency",
    currency: "VES",
    minimumFractionDigits: 2
  });
}