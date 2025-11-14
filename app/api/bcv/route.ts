// /app/api/bcv/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.dolarvzla.com/public/exchange-rate", {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Error consultando la API de DólarVzla" },
        { status: 500 }
      );
    }

    const data = await res.json();
    
    // Extracción de datos (Current)
    const usd = data?.current?.usd;
    const eur = data?.current?.eur; // <-- AÑADIDO: Tasa del Euro
    const date = data?.current?.date;

    // Validación de USD
    if (!usd) {
      return NextResponse.json(
        { error: "No se encontró el valor de USD en la respuesta" },
        { status: 404 }
      );
    }
    
    // Extracción de cambios porcentuales
    const previousUsd = data?.previous?.usd ?? null;
    const changeUsd = data?.changePercentage?.usd ?? null;
    const previousEur = data?.previous?.eur ?? null; // <-- AÑADIDO
    const changeEur = data?.changePercentage?.eur ?? null; // <-- AÑADIDO

    return NextResponse.json({
      // Tasas USD
      rate: Number(usd), // Manteniendo 'rate' por compatibilidad
      usdRate: Number(usd), 
      previous: previousUsd ? Number(previousUsd) : null,
      changePercentage: changeUsd ? Number(changeUsd) : null,
      changePercentageUsd: changeUsd ? Number(changeUsd) : null,
      
      // Tasas EUR
      eurRate: eur ? Number(eur) : null, 
      previousEur: previousEur ? Number(previousEur) : null,
      changePercentageEur: changeEur ? Number(changeEur) : null,
      
      // Metadatos
      date,
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error("Error API BCV:", error);
    return NextResponse.json(
      { error: "Fallo al conectar con la API" },
      { status: 500 }
    );
  }
}