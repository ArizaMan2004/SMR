// logo-service.ts

const LOGO_STORAGE_KEY = "pdfLogoBase64";
const FIRMA_STORAGE_KEY = "pdfFirmaBase64"; // Clave para la firma
const SELLO_STORAGE_KEY = "pdfSelloBase64"; // Clave para el sello

// --- Funciones para el Logo (Se mantienen) ---

/**
 * Obtiene el logo en Base64 desde localStorage o, si no existe,
 * lo carga desde /smr-logo.png y lo guarda automáticamente.
 */
export async function getLogoBase64(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  // 1️⃣ Primero intentamos leerlo de localStorage
  const stored = localStorage.getItem(LOGO_STORAGE_KEY);
  if (stored) return stored;

  // 2️⃣ Si no existe, lo cargamos desde el archivo público
  try {
    const response = await fetch("/smr-logo.png");
    if (!response.ok) throw new Error("No se pudo cargar /smr-logo.png");

    const blob = await response.blob();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // 3️⃣ Guardamos para uso futuro
    localStorage.setItem(LOGO_STORAGE_KEY, base64);

    return base64;
  } catch (error) {
    console.error("Error cargando el logo base64:", error);
    return undefined;
  }
}

/**
 * Guarda o elimina el logo Base64 manualmente.
 */
export function setLogoBase64(base64String: string | undefined): void {
  if (typeof window === "undefined") return;

  if (base64String) {
    localStorage.setItem(LOGO_STORAGE_KEY, base64String);
  } else {
    localStorage.removeItem(LOGO_STORAGE_KEY);
  }
}

// --- Nuevas Funciones para la Firma ---

/**
 * Obtiene la firma en Base64 desde localStorage.
 */
export function getFirmaBase64(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(FIRMA_STORAGE_KEY) || undefined;
}

/**
 * Guarda o elimina la firma Base64.
 */
export function setFirmaBase64(base64String: string | undefined): void {
  if (typeof window === "undefined") return;

  if (base64String) {
    localStorage.setItem(FIRMA_STORAGE_KEY, base64String);
  } else {
    localStorage.removeItem(FIRMA_STORAGE_KEY);
  }
}

// --- Nuevas Funciones para el Sello ---

/**
 * Obtiene el sello en Base64 desde localStorage.
 */
export function getSelloBase64(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem(SELLO_STORAGE_KEY) || undefined;
}

/**
 * Guarda o elimina el sello Base64.
 */
export function setSelloBase64(base64String: string | undefined): void {
  if (typeof window === "undefined") return;

  if (base64String) {
    localStorage.setItem(SELLO_STORAGE_KEY, base64String);
  } else {
    localStorage.removeItem(SELLO_STORAGE_KEY);
  }
}