import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/lib/auth-context"
import { ThemeProviderWrapper } from "@/components/theme-provider"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" })

export const metadata: Metadata = {
  title: "SMR Lase Print - Impresión Digital y Corte Láser",
  description: "Servicios de Impresión Digital, Gran Formato, y Corte Láser de alta precisión. Entregas rápidas y calidad garantizada en Falcón. ¡Cotiza tu proyecto hoy!",
  generator: "Jesus Ariza",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SMR Lase Print",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el zoom deja tirados a quienes necesitan
  // acercar la pantalla, y en el taller se consulta desde el teléfono.
  themeColor: "#2563eb",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      {/* AGREGADO: suppressHydrationWarning aquí abajo 👇 */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}