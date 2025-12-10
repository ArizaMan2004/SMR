import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/lib/auth-context"
import { ThemeProviderWrapper } from "@/components/theme-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SMR Lase Print - Impresión Digital y Corte Láser",
  description: "Servicios de Impresión Digital, Gran Formato, y Corte Láser de alta precisión. Entregas rápidas y calidad garantizada en Falcón. ¡Cotiza tu proyecto hoy!",
  generator: "Jesus Ariza",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* AGREGADO: suppressHydrationWarning aquí abajo 👇 */}
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}