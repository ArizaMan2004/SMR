// @/components/dashboard/UsersManagementView.tsx
"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion' 
import { db } from '@/lib/firebase'
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Users, Ban, CheckCircle2, Trash2, Loader2, 
    Key, Plus, Copy, Check, ShieldCheck, Ticket, Pencil
} from 'lucide-react'
import { toast } from 'sonner'

const ROLES = [
    { id: 'ADMIN', label: 'Administrador Principal', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    { id: 'VENDEDOR', label: 'Ventas / Atención', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    { id: 'DISENADOR', label: 'Diseño Gráfico', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
    { id: 'IMPRESOR', label: 'Operador Impresión', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400' },
    { id: 'OPERADOR_LASER', label: 'Operador Corte/Láser', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
    { id: 'PRODUCCION', label: 'Jefe de Producción (Armado)', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    { id: 'EMPLEADO', label: 'Empleado Base (Espera)', color: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300' }
]

export function UsersManagementView() {
    const [usuarios, setUsuarios] = useState<any[]>([])
    const [codigos, setCodigos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    // --- ESTADOS PARA EDICIÓN DE PERFIL ---
    const [editingUser, setEditingUser] = useState<any | null>(null)
    const [editForm, setEditForm] = useState({ nombre: '', apellido: '' })

    // Cargar Usuarios y Códigos en tiempo real
    useEffect(() => {
        const unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snap) => {
            setUsuarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubCodigos = onSnapshot(collection(db, "admin_codes"), (snap) => {
            const loadedCodes = snap.docs.map(doc => ({ code: doc.id, ...doc.data() }));
            loadedCodes.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
                return dateB - dateA;
            });
            setCodigos(loadedCodes);
            setLoading(false);
        });

        return () => { unsubUsuarios(); unsubCodigos(); };
    }, [])

    // --- FUNCIONES DE USUARIOS ---
    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            await updateDoc(doc(db, "usuarios", userId), { rol: newRole });
            toast.success(`Rol actualizado a ${newRole}`);
        } catch (error) { toast.error("Error al actualizar el rol"); }
    }

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, "usuarios", userId), { isActive: !currentStatus });
            toast.success(currentStatus ? "Usuario suspendido" : "Usuario reactivado");
        } catch (error) { toast.error("Error al cambiar estado"); }
    }

    const handleDeleteUser = async (userId: string, nombre: string) => {
        if (!confirm(`⚠️ ALERTA: ¿Estás seguro de eliminar permanentemente al usuario ${nombre}?`)) return;
        try {
            await deleteDoc(doc(db, "usuarios", userId));
            toast.success("Usuario eliminado de la base de datos");
        } catch (error) { toast.error("Error al eliminar usuario"); }
    }

    const handleSaveProfileEdit = async () => {
        if (!editingUser) return;
        if (!editForm.nombre.trim() || !editForm.apellido.trim()) {
            toast.error("El nombre y apellido son obligatorios");
            return;
        }

        try {
            await updateDoc(doc(db, "usuarios", editingUser.id), {
                nombre: editForm.nombre.trim(),
                apellido: editForm.apellido.trim()
            });
            toast.success("Perfil de empleado actualizado");
            setEditingUser(null);
        } catch (error) {
            toast.error("Error al actualizar el perfil");
        }
    }

    // --- FUNCIONES DE CÓDIGOS DE REGISTRO ---
    const handleGenerateCode = async () => {
        setIsGenerating(true);
        try {
            const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
            const newCode = `SMR-${randomString}`;
            
            await setDoc(doc(db, "admin_codes", newCode), {
                createdAt: new Date(),
                used: false
            });
            
            toast.success("Código generado con éxito");
        } catch (error) {
            toast.error("Error al generar el código");
        } finally {
            setIsGenerating(false);
        }
    }

    const handleDeleteCode = async (codeId: string) => {
        if (!confirm("¿Eliminar este código de registro?")) return;
        try {
            await deleteDoc(doc(db, "admin_codes", codeId));
            toast.success("Código eliminado");
        } catch (error) { toast.error("Error al eliminar código"); }
    }

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success("Código copiado al portapapeles");
        setTimeout(() => setCopiedCode(null), 2000);
    }

    if (loading) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
    }

    return (
        <div className="space-y-8 p-4 font-sans max-w-6xl mx-auto">
            
            {/* HEADER */}
            <div className="flex items-center gap-4 bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] shadow-sm border border-black/5">
                <div className="p-4 bg-blue-100 dark:bg-blue-500/20 text-blue-600 rounded-2xl"><ShieldCheck size={32} /></div>
                <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Panel de Autorización</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de Accesos y Equipo SMR</p>
                </div>
            </div>

            <Tabs defaultValue="usuarios" className="w-full">
                <TabsList className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl mb-6 flex w-fit gap-2">
                    <TabsTrigger value="usuarios" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <Users className="w-4 h-4 mr-2 inline-block"/> Empleados Registrados
                    </TabsTrigger>
                    <TabsTrigger value="codigos" className="rounded-xl px-6 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        <Key className="w-4 h-4 mr-2 inline-block"/> Códigos de Invitación
                    </TabsTrigger>
                </TabsList>

                {/* ==========================================
                    PESTAÑA 1: GESTIÓN DE USUARIOS
                ========================================== */}
                <TabsContent value="usuarios" className="mt-0">
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-white/5">
                                <TableRow className="border-0">
                                    <TableHead className="py-6 px-8 text-[10px] font-black uppercase text-slate-400">Usuario</TableHead>
                                    <TableHead className="py-6 text-[10px] font-black uppercase text-slate-400">Rol Asignado</TableHead>
                                    <TableHead className="py-6 text-[10px] font-black uppercase text-slate-400 text-center">Estado de Acceso</TableHead>
                                    <TableHead className="py-6 pr-8 text-[10px] font-black uppercase text-slate-400 text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usuarios.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-slate-400 font-bold uppercase text-xs">No hay usuarios registrados</TableCell>
                                    </TableRow>
                                )}
                                {usuarios.map(u => {
                                    const roleConfig = ROLES.find(r => r.id === u.rol) || ROLES[4];
                                    
                                    return (
                                        <TableRow key={u.id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5">
                                            <TableCell className="py-5 px-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 uppercase">
                                                        {u.nombre?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white capitalize leading-tight">
                                                            {u.nombre} {u.apellido}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{u.email}</p>
                                                        <p className="text-[9px] font-black text-blue-500/50 mt-1 uppercase">Ref: {u.registroCodigo || 'S/N'}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <Select value={u.rol || 'EMPLEADO'} onValueChange={(val) => handleUpdateRole(u.id, val)}>
                                                    <SelectTrigger className={`w-[180px] h-9 border-none rounded-xl text-xs font-black uppercase tracking-wider ${roleConfig.color} shadow-sm`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl">
                                                        {ROLES.map(r => (
                                                            <SelectItem key={r.id} value={r.id} className="text-xs font-bold uppercase">{r.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="py-5 text-center">
                                                <Badge className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border-0 ${u.isActive ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600 animate-pulse"}`}>
                                                    {u.isActive ? "Acceso Permitido" : "En Espera / Bloqueado"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-5 pr-8 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    {/* BOTÓN EDITAR PERFIL */}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={() => {
                                                            setEditingUser(u);
                                                            setEditForm({ nombre: u.nombre || '', apellido: u.apellido || '' });
                                                        }}
                                                        className="h-9 w-9 rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        title="Editar Datos"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>

                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        onClick={() => handleToggleStatus(u.id, u.isActive)}
                                                        className={`h-9 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 border-0 shadow-sm transition-all ${u.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 ring-2 ring-emerald-500/20"}`}
                                                    >
                                                        {u.isActive ? <><Ban className="w-3 h-3"/> Suspender</> : <><CheckCircle2 className="w-3 h-3"/> Aprobar</>}
                                                    </Button>

                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={() => handleDeleteUser(u.id, u.nombre)}
                                                        className="h-9 w-9 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                {/* ==========================================
                    PESTAÑA 2: CÓDIGOS DE REGISTRO
                ========================================== */}
                <TabsContent value="codigos" className="mt-0">
                    <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white dark:bg-[#1c1c1e] p-6 md:p-8">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                            <div>
                                <h3 className="text-xl font-black uppercase italic">Módulo de Invitaciones</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Genera códigos de 1 solo uso para nuevos empleados</p>
                            </div>
                            <Button 
                                onClick={handleGenerateCode} 
                                disabled={isGenerating}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest h-12 px-6 shadow-lg shadow-blue-500/20"
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Plus className="w-4 h-4 mr-2"/>}
                                Crear Nuevo Código
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {codigos.length === 0 && (
                                <div className="col-span-full text-center py-10 text-slate-400 font-bold uppercase text-xs">
                                    No has generado ningún código aún.
                                </div>
                            )}

                            <AnimatePresence>
                                {codigos.map((c) => (
                                    <motion.div 
                                        key={c.code}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className={`relative p-5 rounded-[2rem] border transition-all ${c.used ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-70' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-500/30 shadow-sm'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <Ticket className={`w-5 h-5 ${c.used ? 'text-slate-400' : 'text-blue-600'}`} />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${c.used ? 'text-slate-500' : 'text-blue-600'}`}>
                                                    {c.used ? 'Código Usado' : 'Código Disponible'}
                                                </span>
                                            </div>
                                            {!c.used && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleDeleteCode(c.code)}
                                                    className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 -mt-2 -mr-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between bg-white dark:bg-black/20 p-3 rounded-xl border border-black/5">
                                            <code className={`text-lg font-black tracking-[0.1em] ${c.used ? 'text-slate-400 line-through decoration-rose-500/50' : 'text-slate-900 dark:text-white'}`}>
                                                {c.code}
                                            </code>
                                            {!c.used && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={() => handleCopyCode(c.code)}
                                                    className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                                >
                                                    {copiedCode === c.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </Button>
                                            )}
                                        </div>

                                        {c.used && c.usedAt && (
                                            <p className="text-[9px] font-bold text-slate-400 mt-4 text-center">
                                                Usado el: {c.usedAt.toDate().toLocaleDateString()} a las {c.usedAt.toDate().toLocaleTimeString()}
                                            </p>
                                        )}
                                        {!c.used && c.createdAt && (
                                            <p className="text-[9px] font-bold text-slate-400 mt-4 text-center">
                                                Creado: {c.createdAt.toDate().toLocaleDateString()}
                                            </p>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- MODAL DE EDICIÓN DE USUARIO --- */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-sm rounded-[2rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tighter">Editar Perfil</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre</Label>
                            <Input 
                                value={editForm.nombre} 
                                onChange={(e) => setEditForm({...editForm, nombre: e.target.value})}
                                className="h-12 bg-slate-50 dark:bg-black/20 border-none rounded-xl font-bold px-4 focus:ring-2 ring-blue-500/20"
                                placeholder="Ej. Carlos"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Apellido</Label>
                            <Input 
                                value={editForm.apellido} 
                                onChange={(e) => setEditForm({...editForm, apellido: e.target.value})}
                                className="h-12 bg-slate-50 dark:bg-black/20 border-none rounded-xl font-bold px-4 focus:ring-2 ring-blue-500/20"
                                placeholder="Ej. Pérez"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button variant="ghost" onClick={() => setEditingUser(null)} className="rounded-xl font-bold text-xs uppercase tracking-widest">
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveProfileEdit} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20">
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}