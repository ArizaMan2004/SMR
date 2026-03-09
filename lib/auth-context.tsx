// @/lib/auth-context.tsx
"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { type User, onAuthStateChanged, signOut } from "firebase/auth"
import { auth, db } from "./firebase"
import { doc, onSnapshot } from "firebase/firestore"

export interface UserData {
  uid: string
  email: string
  nombre: string
  apellido: string
  // ✨ NUEVO ROL: PRODUCCION EN LUGAR DE INSTALADOR
  rol: 'ADMIN' | 'VENDEDOR' | 'DISENADOR' | 'IMPRESOR' | 'OPERADOR_LASER' | 'PRODUCCION' | 'EMPLEADO'
  isActive: boolean
  registroCodigo?: string
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const userDocRef = doc(db, "usuarios", currentUser.uid)
          unsubscribeDoc = onSnapshot(userDocRef, async (userDocSnap) => {
            if (userDocSnap.exists()) {
              const data = userDocSnap.data() as UserData
              if (!data.isActive) {
                await signOut(auth);
                setUser(null);
                setUserData(null);
              } else {
                setUserData(data);
              }
            } else {
              setUserData(null);
            }
            setLoading(false);
          }, (error) => {
            console.error("Error al leer datos del usuario:", error);
            setLoading(false);
          });
          
        } catch (error) {
          console.error("Error configurando la sesión:", error);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setLoading(false);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    })

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    }
  }, [])

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
        {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider")
  }
  return context
}