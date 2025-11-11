"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [exclusiveCode, setExclusiveCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (!exclusiveCode.trim()) {
        setError("Debes ingresar el código exclusivo de registro para el plan completo")
        setLoading(false)
        return
      }

      const codeRef = doc(db, "admin_codes", exclusiveCode.trim())
      const codeDoc = await getDoc(codeRef)

      if (!codeDoc.exists()) {
        setError("Código exclusivo no válido o inexistente.")
        setLoading(false)
        return
      }

      const codeData = codeDoc.data()
      if (codeData.used) {
        setError("Este código ya ha sido utilizado.")
        setLoading(false)
        return
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await sendEmailVerification(userCredential.user)

      await setDoc(codeRef, { used: true, usedBy: userCredential.user.uid, usedAt: new Date() }, { merge: true })

      await setDoc(doc(db, "usuarios", userCredential.user.uid), {
        email,
        businessName: businessName,
        createdAt: new Date(),
        emailVerified: false,
        plan: "complete",
        exclusiveCode: exclusiveCode,
        isActive: true,
      })

      setError("Verifica tu correo electrónico para continuar")
    } catch (err: any) {
      setError(err.message || "Error al registrarse")
    } finally {
      setLoading(false)
    }
  }

  // ✅ CORRECCIÓN CLAVE: Usamos las rutas y nombres de archivo correctos
  // Asumimos que los archivos son .png o .svg. Si son .png, cámbialo.
  const logoSrc = theme === "dark" ? "/smr-logo-dark.png" : "/smr-logo-light.png";

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4 relative">
      
      {/* Botón de cambio de tema (Se mantiene) */}
      <div className="absolute top-6 right-6">
        <Button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-accent/20"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-primary/20 animate-fade-in">
        <CardHeader className="space-y-2">
          
          {/* ✅ IMPLEMENTACIÓN DEL LOGO CENTRADO Y GRANDE (Sin texto) */}
          <div className="flex justify-center mb-4">
            <img 
              src={logoSrc} 
              alt="SMR Laser Print Logo" 
              // Aumentamos el tamaño (w-40 es más grande que w-32)
              className="w-40 h-auto object-contain transition-opacity duration-300" 
            />
          </div>
          
          <CardTitle className="text-2xl text-center">{isLogin ? "Bienvenido" : "Registro de Cuenta"}</CardTitle>
          <CardDescription className="text-center">
            {isLogin ? "Accede a tu sistema de gestión" : "Crea tu cuenta ingresando tu código exclusivo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground">Nombre del Comercio</label>
                  <Input
                    type="text"
                    placeholder="Mi Tienda"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Código Exclusivo de Registro</label>
                  <Input
                    type="text"
                    placeholder="Ingresa tu código exclusivo"
                    value={exclusiveCode}
                    onChange={(e) => setExclusiveCode(e.target.value)}
                    className="mt-1"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    ¿No tienes código? Contacta al administrador:
                    <a
                      href="https://wa.me/584146004526"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline font-bold"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-500"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        <path d="M16 10a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"></path>
                        <path d="M9 10a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z"></path>
                        <path d="M12 10V10"></path>
                        <path d="M12 14V14"></path>
                      </svg>
                      +58 0414-6004526
                    </a>
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Correo Electrónico</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">{error}</div>}

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? "Cargando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError("")
              }}
              className="w-full text-sm text-primary hover:underline"
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}