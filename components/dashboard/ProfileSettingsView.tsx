// @/components/dashboard/ProfileSettingsView.tsx
"use client"

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { db, auth } from '@/lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from 'firebase/auth'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge' // <--- ¡AQUÍ ESTÁ LA CORRECCIÓN!
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from 'sonner'
import { UserCircle, Shield, Key, Mail, User, Loader2, Save, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProfileSettingsView() {
    const { user, userData } = useAuth()
    
    // Estados Perfil
    const [nombre, setNombre] = useState('')
    const [apellido, setApellido] = useState('')
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    // Estados Seguridad
    const [email, setEmail] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [isSavingSecurity, setIsSavingSecurity] = useState(false)

    // Cargar datos iniciales
    useEffect(() => {
        if (userData) {
            setNombre(userData.nombre || '')
            setApellido(userData.apellido || '')
            setEmail(userData.email || '')
        }
    }, [userData])

    // --- GUARDAR PERFIL (Solo Firestore) ---
    const handleSaveProfile = async () => {
        if (!user || !userData) return;
        if (!nombre.trim() || !apellido.trim()) {
            toast.error("El nombre y apellido no pueden estar vacíos");
            return;
        }

        setIsSavingProfile(true);
        try {
            await updateDoc(doc(db, "usuarios", user.uid), {
                nombre: nombre.trim(),
                apellido: apellido.trim()
            });
            toast.success("Datos personales actualizados correctamente");
        } catch (error) {
            toast.error("Error al actualizar los datos");
        } finally {
            setIsSavingProfile(false);
        }
    }

    // --- GUARDAR SEGURIDAD (Auth + Firestore) ---
    const handleSaveSecurity = async () => {
        if (!user || !userData) return;
        if (!currentPassword) {
            toast.error("Debes ingresar tu contraseña actual por seguridad");
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            toast.error("Las contraseñas nuevas no coinciden");
            return;
        }

        if (newPassword && newPassword.length < 6) {
            toast.error("La nueva contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsSavingSecurity(true);
        try {
            // 1. Reautenticar al usuario (Exigencia de Firebase para cambios sensibles)
            const credential = EmailAuthProvider.credential(user.email!, currentPassword);
            await reauthenticateWithCredential(user, credential);

            let changedSomething = false;

            // 2. Actualizar Email si cambió
            if (email.trim().toLowerCase() !== user.email) {
                await updateEmail(user, email.trim().toLowerCase());
                await updateDoc(doc(db, "usuarios", user.uid), { email: email.trim().toLowerCase() });
                changedSomething = true;
            }

            // 3. Actualizar Contraseña si la escribió
            if (newPassword) {
                await updatePassword(user, newPassword);
                changedSomething = true;
                setNewPassword('');
                setConfirmPassword('');
            }

            if (changedSomething) {
                toast.success("Credenciales actualizadas correctamente");
            } else {
                toast.info("No detectamos cambios en el correo o contraseña");
            }
            
            setCurrentPassword(''); // Limpiar contraseña actual por seguridad

        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/invalid-credential') {
                toast.error("La contraseña actual es incorrecta");
            } else if (error.code === 'auth/email-already-in-use') {
                toast.error("Ese correo ya está siendo usado por otra cuenta");
            } else {
                toast.error("Error al actualizar credenciales");
            }
        } finally {
            setIsSavingSecurity(false);
        }
    }

    if (!userData) return null;

    return (
        <div className="space-y-8 p-2 font-sans max-w-4xl mx-auto pb-24">
            
            {/* HEADER */}
            <div className="flex items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-black/5">
                <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-3xl uppercase shadow-lg shadow-blue-500/20 shrink-0">
                    {userData.nombre?.charAt(0)}{userData.apellido?.charAt(0)}
                </div>
                <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        Mi Perfil
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10">
                            {userData.rol}
                        </Badge>
                        <span className="text-xs font-bold text-slate-400">{userData.email}</span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="perfil" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl mb-6 flex w-fit gap-2">
                    <TabsTrigger value="perfil" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <UserCircle className="w-4 h-4 mr-2 inline-block"/> Datos Personales
                    </TabsTrigger>
                    <TabsTrigger value="seguridad" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <Shield className="w-4 h-4 mr-2 inline-block"/> Seguridad y Acceso
                    </TabsTrigger>
                </TabsList>

                {/* --- PESTAÑA 1: DATOS PERSONALES --- */}
                <TabsContent value="perfil" className="mt-0">
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-6 md:p-10 space-y-8">
                        <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tight">Información Básica</h3>
                            <p className="text-xs font-bold text-slate-400 mt-1">Estos datos son visibles para el administrador y en los registros del sistema.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombres</Label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                    <Input 
                                        value={nombre} 
                                        onChange={(e) => setNombre(e.target.value)}
                                        className="h-14 pl-12 rounded-2xl bg-slate-50 dark:bg-black/20 border border-transparent focus:border-blue-500/30 focus:ring-4 ring-blue-500/10 transition-all font-bold text-base"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Apellidos</Label>
                                <div className="relative group">
                                    <Input 
                                        value={apellido} 
                                        onChange={(e) => setApellido(e.target.value)}
                                        className="h-14 px-5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-transparent focus:border-blue-500/30 focus:ring-4 ring-blue-500/10 transition-all font-bold text-base"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                            <Button 
                                onClick={handleSaveProfile} 
                                disabled={isSavingProfile || (!nombre.trim() || !apellido.trim()) || (nombre === userData.nombre && apellido === userData.apellido)}
                                className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20"
                            >
                                {isSavingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                                Guardar Cambios
                            </Button>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- PESTAÑA 2: SEGURIDAD --- */}
                <TabsContent value="seguridad" className="mt-0">
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-6 md:p-10 space-y-8">
                        <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tight">Acceso a la Cuenta</h3>
                            <p className="text-xs font-bold text-slate-400 mt-1">Actualiza tu correo de acceso o cambia tu contraseña de seguridad.</p>
                        </div>

                        <div className="p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl flex gap-4">
                            <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0" />
                            <div>
                                <p className="text-sm font-black text-orange-700 dark:text-orange-400">Verificación Requerida</p>
                                <p className="text-xs font-medium text-orange-600/80 dark:text-orange-400/80 mt-1">
                                    Para guardar cualquier cambio en esta sección, necesitamos que ingreses tu contraseña actual por motivos de seguridad.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* CORREO */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correo Electrónico</Label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                    <Input 
                                        type="email"
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-14 pl-12 rounded-2xl bg-slate-50 dark:bg-black/20 border border-transparent focus:border-blue-500/30 focus:ring-4 ring-blue-500/10 transition-all font-bold text-base"
                                    />
                                </div>
                            </div>

                            <hr className="border-slate-100 dark:border-white/5" />

                            {/* CONTRASEÑA NUEVA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nueva Contraseña (Opcional)</Label>
                                    <div className="relative group">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                        <Input 
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword} 
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Mínimo 6 caracteres"
                                            className="h-14 pl-12 pr-12 rounded-2xl bg-slate-50 dark:bg-black/20 border border-transparent focus:border-blue-500/30 focus:ring-4 ring-blue-500/10 transition-all font-bold tracking-widest placeholder:tracking-normal"
                                        />
                                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600">
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirmar Nueva Contraseña</Label>
                                    <Input 
                                        type={showNewPassword ? "text" : "password"}
                                        value={confirmPassword} 
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Repite la nueva contraseña"
                                        className="h-14 px-5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-transparent focus:border-blue-500/30 focus:ring-4 ring-blue-500/10 transition-all font-bold tracking-widest placeholder:tracking-normal"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* VERIFICACIÓN FINAL */}
                        <div className="p-6 bg-slate-50 dark:bg-black/20 rounded-3xl border border-black/5 dark:border-white/5 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Contraseña Actual <span className="text-red-500">*</span></Label>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                                    <Input 
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={currentPassword} 
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Ingresa tu contraseña actual para confirmar los cambios"
                                        className="h-14 pl-12 pr-12 rounded-2xl bg-white dark:bg-[#1c1c1e] border-slate-200 dark:border-white/10 focus:border-red-500/50 focus:ring-4 ring-red-500/10 transition-all font-bold tracking-widest placeholder:tracking-normal"
                                    />
                                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <Button 
                                    onClick={handleSaveSecurity} 
                                    disabled={isSavingSecurity || !currentPassword}
                                    className="h-12 px-8 rounded-2xl bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 dark:text-black text-white font-black uppercase tracking-widest text-[10px] shadow-lg"
                                >
                                    {isSavingSecurity ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Shield className="w-4 h-4 mr-2"/>}
                                    Confirmar y Guardar
                                </Button>
                            </div>
                        </div>

                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}