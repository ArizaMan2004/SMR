// /app/api/bcv/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Una sola petición, más rápido y menos consumo de recursos
    const res = await fetch("https://ve.dolarapi.com/v1/cotizaciones", { 
      cache: "no-store" 
    });

    if (!res.ok) {
      console.error(`Error DolarApi unificado: ${res.status}`);
      return NextResponse.json(
        { error: "Error de conexión con los servidores de DolarApi" },
        { status: 502 }
      );
    }

    const data = await res.json();
    
    // Buscamos específicamente las monedas y nos aseguramos de que sean de fuente "oficial" (BCV)
    const usdData = data.find((item: any) => item.moneda === "USD" && item.fuente === "oficial");
    const eurData = data.find((item: any) => item.moneda === "EUR" && item.fuente === "oficial");

    if (!usdData || !usdData.promedio) {
      console.error("No se encontró el USD oficial en el arreglo devuelto:", data);
      return NextResponse.json(
        { error: "No se encontró el valor promedio del USD" },
        { status: 500 }
      );
    }

    // Extraemos los promedios
    const usdRate = usdData.promedio;
    const eurRate = eurData?.promedio || null;
    const date = usdData.fechaActualizacion;

    // Retornamos la data en el formato exacto que espera tu frontend
    return NextResponse.json({
      rate: Number(usdRate),
      usdRate: Number(usdRate), 
      previous: null, 
      changePercentage: 0, 
      changePercentageUsd: 0,
      eurRate: eurRate ? Number(eurRate) : null, 
      previousEur: null,
      changePercentageEur: 0,
      date: date,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error crítico API BCV:", error);
    return NextResponse.json(
      { error: "Fallo interno al procesar la API" },
      { status: 500 }
    );
  }
}