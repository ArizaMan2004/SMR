// @/lib/utils/order-utils.ts

/**
 * 🔹 Formatea un número como moneda USD.
 * Ej: 1234.56 -> $1,234.56
 */
export const formatCurrency = (amount: number): string => {
  const numericAmount = typeof amount === "number" && !isNaN(amount) ? amount : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

/**
 * 🔹 Convierte y formatea un monto de USD a Bolívares (Bs) usando la tasa BCV.
 * Ej: 10 USD @ 36.5 Bs/USD -> Bs. 365,00
 */
export const formatBsCurrency = (amountUSD: number, bcvRate: number): string => {
  const numericAmountUSD = typeof amountUSD === "number" && !isNaN(amountUSD) ? amountUSD : 0;

  if (!bcvRate || bcvRate <= 0) {
    // En caso de tasa inválida, mostramos el valor en USD con aviso
    return `${formatCurrency(numericAmountUSD)} (Tasa N/A)`;
  }

  const amountBs = numericAmountUSD * bcvRate;

  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountBs);
};

/**
 * 🔹 Formatea fechas (Date, string o Firestore Timestamp)
 * Ej: '2025-10-27T...' -> 27/10/2025
 */
export const formatDate = (input: any): string => {
  if (!input) return "N/A";

  let date: Date;

  // Si es Timestamp de Firestore
  if (typeof input === "object" && input.seconds) {
    date = new Date(input.seconds * 1000);
  }
  // Si es cadena de texto
  else if (typeof input === "string") {
    date = new Date(input);
  }
  // Si ya es un objeto Date
  else if (input instanceof Date) {
    date = input;
  } else {
    return "Fecha inválida";
  }

  if (isNaN(date.getTime())) return "Fecha inválida";

  return date.toLocaleDateString("es-VE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

// Puedes agregar más utilidades aquí si lo necesitas (por ejemplo, cálculos o conversiones adicionales)
