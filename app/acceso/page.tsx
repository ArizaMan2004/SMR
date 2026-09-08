// @/app/acceso/page.tsx
//
// LA PUERTA.
//
// El formulario de entrada vive en su propia dirección para que la portada
// pueda ocupar la raíz. Quien ya entró y llega aquí de vuelta —un enlace
// viejo, el botón de atrás— se manda al panel en vez de enseñarle una caja de
// contraseña que no necesita.

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/lib/auth-context"
import LoginForm from "@/components/auth/login-form"

export default function AccesoPage() {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && user) router.replace("/")
    }, [loading, user, router])

    if (loading || user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        )
    }

    return <LoginForm />
}
