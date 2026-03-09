// @/components/auth/login-form.tsx
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
import { Moon, Sun, Mail, Lock, User, Key, ArrowRight, Loader2, Eye, EyeOff, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

const springConfig = { type: "spring", stiffness: 300, damping: 30 };

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  
  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [exclusiveCode, setExclusiveCode] = useState("")
  const [showPassword, setShowPassword] = useState(false) 
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // --- LÓGICA DE INICIO DE SESIÓN BLINDADA ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      // 1. Intentamos loguear en Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Verificamos el estado en Firestore antes de dejarlo pasar
      const userDoc = await getDoc(doc(db, "usuarios", userCredential.user.uid));
      
      if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // 3. Si la cuenta no está activa (Sala de espera o suspendida)
          if (!userData.isActive) {
              await auth.signOut(); // Lo deslogueamos inmediatamente
              setError("Tu cuenta está en espera de aprobación por un Administrador o ha sido suspendida.");
              setLoading(false);
              return;
          }
      } else {
          // Caso atípico: el usuario existe en Auth pero no en la base de datos de usuarios
          await auth.signOut();
          setError("Error de integridad de cuenta. Contacte soporte.");
          setLoading(false);
          return;
      }
      
      // Si pasa todas las validaciones, el auth-context lo detectará y lo enviará al Dashboard
    } catch (err: any) {
      setError("Credenciales incorrectas o cuenta no registrada.");
    } finally { setLoading(false) }
  }

  // --- LÓGICA DE REGISTRO BLINDADA ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      if (!exclusiveCode.trim()) { setError("Código de registro requerido"); setLoading(false); return; }
      if (!nombre.trim() || !apellido.trim()) { setError("Nombre y apellido requeridos"); setLoading(false); return; }

      // Validar código de invitación
      const codeRef = doc(db, "admin_codes", exclusiveCode.trim())
      const codeDoc = await getDoc(codeRef)
      if (!codeDoc.exists() || codeDoc.data().used) {
        setError("Código no válido o ya utilizado."); setLoading(false); return;
      }

      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Marcar código como usado
      await setDoc(codeRef, { used: true, usedBy: userCredential.user.uid, usedAt: new Date() }, { merge: true })
      
      // Guardar perfil del usuario en la Sala de Espera
      await setDoc(doc(db, "usuarios", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email.toLowerCase(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rol: "EMPLEADO", // Rol base, el Admin luego lo cambia
        createdAt: new Date(),
        isActive: false, // ✨ MAGIA: Nace desactivado. No puede entrar hasta que tú lo apruebes.
        registroCodigo: exclusiveCode
      })

      // Mensaje de éxito informando de la espera
      setError("Registro exitoso. Tu cuenta debe ser aprobada por un Administrador para poder entrar."); 
      setIsLogin(true);
      setPassword(""); // Limpiamos la contraseña
      setExclusiveCode("");
      
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  if (!mounted) return null
  const logoSrc = theme === "dark" ? "/smr-logo-dark.png" : "/smr-logo-light.png";

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-black flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />

      <div className="absolute top-8 right-8 z-50">
        <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} variant="ghost" size="icon" className="rounded-2xl bg-white/50 dark:bg-white/5 backdrop-blur-md border border-black/5 h-12 w-12">
          {theme === "dark" ? <Sun className="w-5 h-5 text-orange-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={springConfig} className="w-full max-w-[440px] z-10">
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl p-8 md:p-12">
          
          <div className="flex flex-col items-center mb-10">
            <motion.div whileHover={{ scale: 1.05 }} className="relative w-48 h-16 mb-6">
                <img src={logoSrc} alt="Logo SMR" className="w-full h-full object-contain" />
            </motion.div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none text-center">
                {isLogin ? "Bienvenido" : "Registro"}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2 text-center">
                {isLogin ? "SMR Staff Access" : "Creación de Cuenta Operativa"}
            </p>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                  
                  {/* Fila de Nombre y Apellido */}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Nombre</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                            <Input type="text" placeholder="Ej: Carlos" value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-14 pl-10 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-bold" required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Apellido</label>
                        <div className="relative group">
                            <Input type="text" placeholder="Ej: Pérez" value={apellido} onChange={(e) => setApellido(e.target.value)} className="h-14 px-4 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-bold" required />
                        </div>
                      </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Código de Registro</label>
                    <div className="relative group">
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                        <Input type="text" placeholder="Código de invitación" value={exclusiveCode} onChange={(e) => setExclusiveCode(e.target.value)} className="h-14 pl-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-bold uppercase" required />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Email</label>
                <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input type="email" placeholder="usuario@smr.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 pl-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-bold" required />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Contraseña</label>
                <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className="h-14 pl-12 pr-12 rounded-2xl bg-black/5 dark:bg-white/5 border-none focus:ring-4 ring-blue-500/10 transition-all font-bold tracking-widest placeholder:tracking-normal" 
                        required 
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 text-[11px] font-bold uppercase text-center flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="leading-tight">{error}</span>
                </motion.div>
            )}

            <Button type="submit" className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-blue-500/20 gap-3 transition-all active:scale-[0.98] mt-4" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>{isLogin ? "Acceder al Panel" : "Registrar Empleado"}<ArrowRight className="w-4 h-4" /></>
                )}
            </Button>

            <div className="pt-6 text-center">
                <button type="button" onClick={() => { setIsLogin(!isLogin); setError(""); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors">
                    {isLogin ? "¿Eres nuevo empleado? Regístrate aquí" : "¿Ya tienes cuenta? Inicia sesión"}
                </button>
            </div>
          </form>
        </Card>
        
        <p className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-8 opacity-40">
            SMR LASER PRINT SYSTEM © 2026 • PANEL INTERNO
        </p>
      </motion.div>
    </div>
  )
}