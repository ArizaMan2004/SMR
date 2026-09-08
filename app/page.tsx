"use client"

import { useAuth } from "@/lib/auth-context"
import { PermisosProvider } from "@/lib/contexts/permisos-context"
import PortadaPage from "@/components/landing/PortadaPage"
import Dashboard from "@/components/dashboard/dashboard"

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  // Los permisos se resuelven por encima del dashboard para que el propio
  // dashboard pueda decidir con ellos qué vista abrir y qué menú construir.
  // Sin cuenta se ve la portada, no el formulario.
  //
  // Antes se caia directo en la caja de contrasenia, que no dice nada de lo
  // que hay dentro: quien llega por primera vez —un empleado nuevo, alguien a
  // quien se le ensenia el sistema— veia un campo vacio y punto. El formulario
  // sigue existiendo, en /acceso, a un boton de distancia.
  return user ? (
    <PermisosProvider>
      <Dashboard />
    </PermisosProvider>
  ) : (
    <PortadaPage />
  )
}
