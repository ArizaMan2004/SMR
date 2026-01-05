"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { useTheme } from "next-themes"

// UI - Shadcn & Iconos
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Moon, Sun, Mail, Lock, Store, Key, ArrowRight, Loader2, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };

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

  // --- LÓGICA DE FIREBASE (SIN CAMBIOS) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: any) {
      setError("Credenciales incorrectas o cuenta no activada.")
    } finally { setLoading(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      if (!exclusiveCode.trim()) { setError("Código exclusivo requerido"); setLoading(false); return; }
      const codeRef = doc(db, "admin_codes", exclusiveCode.trim())
      const codeDoc = await getDoc(codeRef)
      if (!codeDoc.exists() || codeDoc.data().used) {
        setError("Código no válido o ya utilizado."); setLoading(false); return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await sendEmailVerification(userCredential.user)
      await setDoc(codeRef, { used: true, usedBy: userCredential.user.uid, usedAt: new Date() }, { merge: true })
      await setDoc(doc(db, "usuarios", userCredential.user.uid), {
        email, businessName, createdAt: new Date(), plan: "complete", exclusiveCode, isActive: true,
      })
      setError("Verifica tu correo para continuar"); setIsLogin(true);
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  if (!mounted) return null
  const logoSrc = theme === "dark" ? "/smr-logo-dark.png" : "/smr-logo-light.png";

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-black flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Círculos decorativos de fondo (Efecto iOS) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />

      {/* Botón de cambio de tema superior */}
      <div className="absolute top-8 right-8 z-50">
        <Button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          variant="ghost"
          size="icon"
          className="rounded-2xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-black/5 h-12 w-12"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 text-orange-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springConfig}
        className="w-full max-w-[440px] z-10"
      >
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl p-8 md:p-12">
          
          {/* Header del Login */}
          <div className="flex flex-col items-center mb-10">
            <motion.div 
                whileHover={{ scale: 1.05 }}
                className="relative w-48 h-16 mb-6"
            >
                <img src={logoSrc} alt="Logo SMR" className="w-full h-full object-contain" />
            </motion.div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">
                {isLogin ? "Bienvenido" : "Registro"}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">
                {isLogin ? "SMR Intel Hub Access" : "Create Enterprise Account"}
            </p>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Comercio</label>
                    <div className="relative group">
                        <Store className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <Input
                            type="text" placeholder="Nombre de tu empresa" value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="h-14 pl-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-medium"
                            required
                        />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Código Admin</label>
                    <div className="relative group">
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <Input
                            type="text" placeholder="Código exclusivo" value={exclusiveCode}
                            onChange={(e) => setExclusiveCode(e.target.value)}
                            className="h-14 pl-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-medium"
                            required
                        />
                    </div>
                    <div className="flex justify-center pt-2">
                        <a href="https://wa.me/584146004526" target="_blank" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:opacity-70 transition-opacity">
                            <MessageCircle className="w-3 h-3" /> Obtener código administrador
                        </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Email</label>
                <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input
                        type="email" placeholder="usuario@smr.com" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 pl-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-medium"
                        required
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Password</label>
                <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input
                        type="password" placeholder="••••••••" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-14 pl-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-medium"
                        required
                    />
                </div>
            </div>

            {error && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold uppercase text-center"
                >
                    {error}
                </motion.div>
            )}

            <Button 
                type="submit" 
                className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-blue-500/20 gap-3 transition-all active:scale-[0.98]" 
                disabled={loading}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                        {isLogin ? "Acceder al Panel" : "Finalizar Registro"}
                        <ArrowRight className="w-4 h-4" />
                    </>
                )}
            </Button>

            <div className="pt-6 text-center">
                <button
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setError(""); }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
                >
                    {isLogin ? "¿No tienes cuenta? Regístrate aquí" : "¿Ya eres miembro? Inicia sesión"}
                </button>
            </div>
          </form>
        </Card>
        
        {/* Footer legal estilo iOS */}
        <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-8 opacity-40">
            SMR LASER PRINT SYSTEM © 2026 • TODOS LOS DERECHOS RESERVADOS
        </p>
      </motion.div>
    </div>
  )
}