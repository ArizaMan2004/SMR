// /app/api/bcv/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // CAMBIO 1: Usamos el endpoint '/private/' en lugar de '/public/'
    // CAMBIO 2: Agregamos tu API Key en los headers
    const res = await fetch("https://api.dolarvzla.com/private/exchange-rate", {
      cache: "no-store",
      headers: {
        "x-dolarvzla-key": "fd313f847b5b2502fe4718f764ea137feb6cac0fe989291a67c11671d38b4718",
        "Accept": "application/json",
        "User-Agent": "SystemaxApp/1.0", // Es buena práctica identificarte, aunque la Key es lo importante
      },
    });

    if (!res.ok) {
      console.error(`Error API DolarVzla: ${res.status} - ${res.statusText}`);
      // Si el endpoint /private/ falla, intentamos una vez más con el /public/ pero con la Key
      if (res.status === 404) {
         console.log("Reintentando con endpoint público...");
         // Fallback por si acaso la estructura de la API cambió recientemente
         return fetchPublicFallback();
      }
      
      return NextResponse.json(
        { error: `Error de autorización o conexión: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    
    // --- Lógica de extracción (igual que antes) ---
    // Nota: A veces la estructura del JSON en /private es ligeramente diferente (más directa)
    // pero usualmente mantienen la compatibilidad 'current.usd'.
    
    const usd = data?.object?.usd?.price || data?.current?.usd || data?.usd?.price;
    const eur = data?.object?.eur?.price || data?.current?.eur || data?.eur?.price;
    const date = data?.object?.date || data?.current?.date || new Date().toISOString();

    if (!usd) {
      console.error("Estructura inesperada en JSON:", data);
      return NextResponse.json(
        { error: "No se encontró el valor de USD en la estructura recibida" },
        { status: 500 }
      );
    }
    
    // Extracción segura de variaciones
    const changeUsd = data?.object?.usd?.change || data?.changePercentage?.usd || 0;
    const changeEur = data?.object?.eur?.change || data?.changePercentage?.eur || 0;

    return NextResponse.json({
      rate: Number(usd),
      usdRate: Number(usd), 
      previous: null, // Con la API Key a veces el historial viene en otro endpoint
      changePercentage: Number(changeUsd),
      changePercentageUsd: Number(changeUsd),
      eurRate: eur ? Number(eur) : null, 
      previousEur: null,
      changePercentageEur: Number(changeEur),
      date,
      lastUpdated: new Date(),
    });

  } catch (error) {
    console.error("Error crítico API BCV:", error);
    return NextResponse.json(
      { error: "Fallo interno al procesar la API" },
      { status: 500 }
    );
  }
}

// Función de respaldo por si el endpoint privado falla
async function fetchPublicFallback() {
    const res = await fetch("https://api.dolarvzla.com/public/exchange-rate", {
      cache: "no-store",
      headers: {
        "x-dolarvzla-key": "e143b92b835b6aae1a3153fcd867c6c0a7bf782bc6d1f94bf8b8dc624ab29d08",
      }
    });
    
    if (!res.ok) return NextResponse.json({ error: "Fallo total" }, { status: 500 });
    const data = await res.json();
    return NextResponse.json({
        rate: Number(data?.current?.usd),
        usdRate: Number(data?.current?.usd),
        eurRate: Number(data?.current?.eur),
        lastUpdated: new Date()
    });
}