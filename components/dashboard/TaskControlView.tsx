// @/components/dashboard/TaskControlView.tsx
"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/firebase'
import {
    collection, onSnapshot, query, where,
    doc, addDoc, updateDoc, writeBatch, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
    Clock, XCircle, Search, Plus, Pencil, Trash2,
    Scissors, PenTool, Wrench, Layers, DollarSign,
    Percent, Activity, FileCheck, Check, Users,
    Banknote, CreditCard, ClipboardList, UserPlus,
    AlertCircle, TrendingUp, Coins, CheckCircle2,
    RefreshCw, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// TIPOS
// ============================================================
interface TareaEmpleado {
    id: string
    usuarioId: string
    empleadoDbId: string
    nombreEmpleado: string
    nombreTarea: string
    tipoTarea: string
    ordenRef?: string | null
    estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
    estadoPago: 'PENDIENTE' | 'PAGADO'
    asignadoPor?: string
    detalles: {
        tiempoMinutos?: string | null
        cantidad?: string | null
        medidas?: string | null
        descripcion?: string | null
    }
    fechaRegistro: any
    valorBaseUSD: number
    porcentajeAsignado?: number | null
    montoComision: number
    fechaAprobacion?: any
    aprobadoPor?: string
    fechaPago?: any
    pagadoPor?: string
    metodoPago?: string
    tasaPago?: number
}

type Moneda = 'USD' | 'EUR' | 'USDT' | 'BS'

interface TaskControlViewProps {
    currentUser: any
    empleadosDb: any[]
    rates: { usd: number; eur: number; usdt: number }
}

// ============================================================
// CONSTANTES
// ============================================================
const TASK_TYPES = [
    { value: 'SERVICIO', label: 'Servicio / Armado' },
    { value: 'CORTE_LASER', label: 'Corte Láser / Router' },
    { value: 'DISENO', label: 'Diseño Gráfico' },
    { value: 'OTRO', label: 'Otro' },
]

const MONEDAS: { value: Moneda; label: string }[] = [
    { value: 'USD', label: 'USD (BCV)' },
    { value: 'EUR', label: 'EUR (BCV)' },
    { value: 'USDT', label: 'USDT (Paralelo)' },
    { value: 'BS', label: 'Bolívares' },
]

const getTaskIcon = (tipo: string) => {
    switch (tipo) {
        case 'CORTE_LASER': return <Wrench className="w-5 h-5 text-orange-500" />
        case 'DISENO': return <PenTool className="w-5 h-5 text-indigo-500" />
        case 'OTRO': return <ClipboardList className="w-5 h-5 text-slate-500" />
        default: return <Scissors className="w-5 h-5 text-emerald-500" />
    }
}

const formatDate = (ts: any): string => {
    if (!ts) return '—'
    try {
        const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts)
        if (isNaN(d.getTime())) return '—'
        return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch { return '—' }
}

const FORM_DEFAULTS = {
    nombre: '', tipo: 'SERVICIO', tiempoMinutos: '',
    cantidad: '1', medidas: '', descripcion: '', ordenRef: ''
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export function TaskControlView({ currentUser, empleadosDb, rates }: TaskControlViewProps) {
    const isAdmin = ['ADMIN', 'PRODUCCION'].includes(currentUser?.rol)

    // Estado principal
    const [tareas, setTareas] = useState<TareaEmpleado[]>([])
    const [queryError, setQueryError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterEmpleado, setFilterEmpleado] = useState('TODOS')

    // Modales
    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isReviewOpen, setIsReviewOpen] = useState(false)
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<TareaEmpleado | null>(null)
    const [tareasSeleccionadas, setTareasSeleccionadas] = useState<Set<string>>(new Set())

    // Formulario: registrar (empleado)
    const [regForm, setRegForm] = useState({ ...FORM_DEFAULTS })

    // Formulario: asignar (admin) — cada campo se actualiza con setState funcional
    const [assignEmpleadoId, setAssignEmpleadoId] = useState('')
    const [assignNombre, setAssignNombre] = useState('')
    const [assignTipo, setAssignTipo] = useState('SERVICIO')
    const [assignOrdenRef, setAssignOrdenRef] = useState('')
    const [assignCantidad, setAssignCantidad] = useState('1')
    const [assignTiempo, setAssignTiempo] = useState('')
    const [assignMedidas, setAssignMedidas] = useState('')
    const [assignDescripcion, setAssignDescripcion] = useState('')
    const [assignValorBase, setAssignValorBase] = useState('')
    const [assignPorcentaje, setAssignPorcentaje] = useState('')

    // Formulario: valorar (admin)
    const [reviewValor, setReviewValor] = useState('')
    const [reviewPorcentaje, setReviewPorcentaje] = useState('')
    const [reviewMontoDirecto, setReviewMontoDirecto] = useState('')

    // Comisión directa en asignación
    const [assignMontoDirecto, setAssignMontoDirecto] = useState('')
    const [assignRatePerMin, setAssignRatePerMin] = useState<number | null>(null)

    // Formulario: editar (admin — todos los campos)
    const [editForm, setEditForm] = useState({
        nombre: '', tipo: 'SERVICIO', ordenRef: '', cantidad: '1',
        tiempoMinutos: '', medidas: '', descripcion: '',
        estado: 'PENDIENTE' as string, estadoPago: 'PENDIENTE' as string,
        valorBaseUSD: '', porcentajeComision: ''
    })

    // Pago global
    const [paymentMoneda, setPaymentMoneda] = useState<Moneda>('USD')

    // ============================================================
    // LISTENER FIRESTORE
    // ============================================================
    const setupListener = useCallback(() => {
        if (!currentUser?.uid) return () => {}
        setIsLoading(true)
        setQueryError(null)

        const tareasRef = collection(db, 'empleado_tareas')
        const q = isAdmin
            ? query(tareasRef)
            : query(tareasRef, where('usuarioId', '==', currentUser.uid))

        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TareaEmpleado))
            docs.sort((a, b) => {
                const aDate = a.fechaRegistro?.toDate ? a.fechaRegistro.toDate() : new Date(a.fechaRegistro || 0)
                const bDate = b.fechaRegistro?.toDate ? b.fechaRegistro.toDate() : new Date(b.fechaRegistro || 0)
                return bDate.getTime() - aDate.getTime()
            })
            setTareas(docs)
            setIsLoading(false)
            setQueryError(null)
        }, (err: any) => {
            console.error('[TaskControlView] Error Firestore:', err)
            const msg = err?.code === 'permission-denied'
                ? 'Permiso denegado en Firestore. Revisa las reglas de seguridad de la colección "empleado_tareas".'
                : `Error al cargar tareas: ${err?.code || err?.message || 'desconocido'}`
            setQueryError(msg)
            setIsLoading(false)
            toast.error(msg)
        })
        return unsub
    }, [currentUser?.uid, isAdmin])

    useEffect(() => {
        const unsub = setupListener()
        return () => { if (typeof unsub === 'function') unsub() }
    }, [setupListener])

    // ============================================================
    // FILTRADO Y MÉTRICAS
    // ============================================================
    const tareasFiltradas = useMemo(() => {
        return tareas.filter(t => {
            const matchSearch = !searchTerm ||
                (t.nombreTarea || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.nombreEmpleado || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.ordenRef || '').toLowerCase().includes(searchTerm.toLowerCase())
            const matchEmp = filterEmpleado === 'TODOS' || t.empleadoDbId === filterEmpleado
            return matchSearch && matchEmp
        })
    }, [tareas, searchTerm, filterEmpleado])

    const pendientesReview = tareas.filter(t => t.estado === 'PENDIENTE').length
    const tareasAPagar = useMemo(() => tareas.filter(t => t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE'), [tareas])
    const aPagarTotal = tareasAPagar.reduce((acc, t) => acc + (t.montoComision || 0), 0)
    const totalPagado = tareas.filter(t => t.estadoPago === 'PAGADO').reduce((acc, t) => acc + (t.montoComision || 0), 0)

    const resumenEmpleados = useMemo(() => {
        if (!isAdmin) return []
        const map = new Map<string, { nombre: string; pendientes: number; aPagar: number; pagado: number }>()
        tareas.forEach(t => {
            const e = map.get(t.empleadoDbId) || { nombre: t.nombreEmpleado || '—', pendientes: 0, aPagar: 0, pagado: 0 }
            if (t.estado === 'PENDIENTE') e.pendientes++
            if (t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE') e.aPagar += t.montoComision || 0
            if (t.estadoPago === 'PAGADO') e.pagado += t.montoComision || 0
            map.set(t.empleadoDbId, e)
        })
        return Array.from(map.entries()).map(([id, d]) => ({ id, ...d }))
    }, [tareas, isAdmin])

    const tareasAPagarPorEmpleado = useMemo(() => {
        const map = new Map<string, { nombre: string; tareas: TareaEmpleado[] }>()
        tareasAPagar.forEach(t => {
            const e = map.get(t.empleadoDbId) || { nombre: t.nombreEmpleado || '—', tareas: [] }
            e.tareas.push(t)
            map.set(t.empleadoDbId, e)
        })
        return Array.from(map.entries()).map(([id, d]) => ({ id, ...d }))
    }, [tareasAPagar])

    const totalSeleccionadoUSD = tareasAPagar.filter(t => tareasSeleccionadas.has(t.id)).reduce((acc, t) => acc + (t.montoComision || 0), 0)

    // ============================================================
    // HELPERS DE MONEDA
    // ============================================================
    const getRateForMoneda = (m: Moneda) => {
        if (m === 'EUR') return rates.eur
        if (m === 'USDT') return rates.usdt
        if (m === 'BS') return rates.usd
        return 1
    }
    const convertAmount = (usd: number, m: Moneda) => m === 'USD' ? usd : usd * getRateForMoneda(m)
    const getCurrencySymbol = (m: Moneda) => m === 'EUR' ? '€' : m === 'BS' ? 'Bs.' : '$'

    // ============================================================
    // ACCIÓN: REGISTRAR TAREA (EMPLEADO)
    // ============================================================
    const handleRegistrarTarea = async () => {
        if (!regForm.nombre.trim()) return void toast.error('El nombre de la tarea es obligatorio')
        if (!currentUser?.uid) return void toast.error('No hay sesión activa. Recarga la página.')
        const empleadoActual = empleadosDb.find((e: any) => e.usuarioId === currentUser.uid)

        const tid = toast.loading('Registrando tarea...')
        try {
            await addDoc(collection(db, 'empleado_tareas'), {
                usuarioId: currentUser.uid,
                empleadoDbId: empleadoActual?.id || '',
                nombreEmpleado: empleadoActual?.nombre || currentUser?.nombre || currentUser?.email || 'Empleado',
                nombreTarea: regForm.nombre.trim(),
                tipoTarea: regForm.tipo,
                ordenRef: regForm.ordenRef.trim() || null,
                estado: 'PENDIENTE',
                estadoPago: 'PENDIENTE',
                detalles: {
                    tiempoMinutos: regForm.tiempoMinutos || null,
                    cantidad: regForm.cantidad || null,
                    medidas: regForm.medidas || null,
                    descripcion: regForm.descripcion || null,
                },
                fechaRegistro: new Date(),
                valorBaseUSD: 0,
                montoComision: 0
            })
            toast.dismiss(tid)
            toast.success('Tarea registrada. El admin la revisará pronto.')
            setIsRegisterOpen(false)
            setRegForm({ ...FORM_DEFAULTS })
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error al guardar: ${err?.code || err?.message || 'desconocido'}`)
            console.error(err)
        }
    }

    // ============================================================
    // ACCIÓN: ASIGNAR TAREA (ADMIN) — sin closures problemáticos
    // ============================================================
    const handleAsignarTarea = async () => {
        if (!assignNombre.trim()) return void toast.error('El nombre de la tarea es obligatorio')
        if (!assignEmpleadoId) return void toast.error('Debes seleccionar un empleado')

        const empleado = empleadosDb.find(e => e.id === assignEmpleadoId)
        if (!empleado) {
            toast.error(`Empleado no encontrado. IDs en la lista: ${empleadosDb.map(e => e.id).join(', ')}`)
            return
        }

        const valorBase = parseFloat(assignValorBase) || 0
        const porcentaje = parseFloat(assignPorcentaje) || 0
        const montoDirecto = parseFloat(assignMontoDirecto) || 0
        const montoComision = montoDirecto > 0 ? montoDirecto : (valorBase > 0 && porcentaje > 0 ? (valorBase * porcentaje) / 100 : 0)

        const tid = toast.loading('Asignando tarea...')
        try {
            const docData: any = {
                usuarioId: empleado.usuarioId || '',
                empleadoDbId: empleado.id,
                nombreEmpleado: `${empleado.nombre || ''}${empleado.apellido ? ' ' + empleado.apellido : ''}`.trim(),
                nombreTarea: assignNombre.trim(),
                tipoTarea: assignTipo,
                ordenRef: assignOrdenRef.trim() || null,
                estado: montoComision > 0 ? 'APROBADA' : 'PENDIENTE',
                estadoPago: 'PENDIENTE',
                asignadoPor: currentUser.nombre || currentUser.email || 'Admin',
                detalles: {
                    tiempoMinutos: assignTiempo || null,
                    cantidad: assignCantidad || null,
                    medidas: assignMedidas || null,
                    descripcion: assignDescripcion || null,
                },
                fechaRegistro: new Date(),
                valorBaseUSD: valorBase,
                porcentajeAsignado: porcentaje || null,
                montoComision,
            }
            if (montoComision > 0) {
                docData.fechaAprobacion = serverTimestamp()
                docData.aprobadoPor = currentUser.nombre || 'Admin'
            }
            await addDoc(collection(db, 'empleado_tareas'), docData)
            toast.dismiss(tid)
            toast.success(`Tarea asignada a ${empleado.nombre}`)
            resetAssignForm()
            setIsAssignOpen(false)
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error al asignar: ${err?.code || err?.message || 'desconocido'}`)
            console.error('[handleAsignarTarea]', err)
        }
    }

    const resetAssignForm = () => {
        setAssignEmpleadoId('')
        setAssignNombre('')
        setAssignTipo('SERVICIO')
        setAssignOrdenRef('')
        setAssignCantidad('1')
        setAssignTiempo('')
        setAssignMedidas('')
        setAssignDescripcion('')
        setAssignValorBase('')
        setAssignPorcentaje('')
        setAssignMontoDirecto('')
        setAssignRatePerMin(null)
    }

    useEffect(() => {
        if (assignRatePerMin !== null && assignTiempo) {
            const mins = parseFloat(assignTiempo) || 0
            setAssignMontoDirecto(mins > 0 ? (mins * assignRatePerMin).toFixed(2) : '')
        }
    }, [assignTiempo, assignRatePerMin])

    // ============================================================
    // ACCIÓN: VALORAR/APROBAR TAREA (ADMIN)
    // ============================================================
    const handleAprobarTarea = async () => {
        if (!selectedTask) return
        const montoDirecto = parseFloat(reviewMontoDirecto) || 0
        const valor = parseFloat(reviewValor)
        const porcentaje = parseFloat(reviewPorcentaje)
        let montoGanado: number
        if (montoDirecto > 0) {
            montoGanado = montoDirecto
        } else {
            if (isNaN(valor) || valor <= 0) return void toast.error('Ingresa un valor base o un monto directo')
            if (isNaN(porcentaje) || porcentaje <= 0) return void toast.error('Ingresa el porcentaje o usa monto directo')
            montoGanado = (valor * porcentaje) / 100
        }

        const tid = toast.loading('Aprobando...')
        try {
            await updateDoc(doc(db, 'empleado_tareas', selectedTask.id), {
                estado: 'APROBADA',
                valorBaseUSD: valor,
                porcentajeAsignado: porcentaje,
                montoComision: montoGanado,
                fechaAprobacion: serverTimestamp(),
                aprobadoPor: currentUser.nombre || 'Admin'
            })
            toast.dismiss(tid)
            toast.success(`$${montoGanado.toFixed(2)} asignados a ${selectedTask.nombreEmpleado}`)
            setIsReviewOpen(false)
            setSelectedTask(null)
            setReviewValor('')
            setReviewPorcentaje('')
            setReviewMontoDirecto('')
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error: ${err?.code || err?.message}`)
        }
    }

    const handleEliminarTarea = async (tarea: TareaEmpleado) => {
        if (!confirm(`¿Eliminar la tarea "${tarea.nombreTarea}"? Esta acción no se puede deshacer.`)) return
        try {
            await deleteDoc(doc(db, 'empleado_tareas', tarea.id))
            toast.success('Tarea eliminada')
        } catch (err: any) {
            toast.error(`Error al eliminar: ${err?.code || err?.message}`)
        }
    }

    const handleRechazarTarea = async (tareaId: string) => {
        if (!confirm('¿Rechazar esta tarea? No generará comisión.')) return
        try {
            await updateDoc(doc(db, 'empleado_tareas', tareaId), {
                estado: 'RECHAZADA',
                fechaAprobacion: serverTimestamp(),
                aprobadoPor: currentUser.nombre || 'Admin'
            })
            toast.success('Tarea rechazada')
        } catch (err: any) {
            toast.error(`Error: ${err?.code || err?.message}`)
        }
    }

    // ============================================================
    // ACCIÓN: EDITAR TAREA COMPLETA (ADMIN)
    // ============================================================
    const openEditModal = (tarea: TareaEmpleado) => {
        setSelectedTask(tarea)
        setEditForm({
            nombre: tarea.nombreTarea || '',
            tipo: tarea.tipoTarea || 'SERVICIO',
            ordenRef: tarea.ordenRef || '',
            cantidad: tarea.detalles?.cantidad || '1',
            tiempoMinutos: tarea.detalles?.tiempoMinutos || '',
            medidas: tarea.detalles?.medidas || '',
            descripcion: tarea.detalles?.descripcion || '',
            estado: tarea.estado,
            estadoPago: tarea.estadoPago,
            valorBaseUSD: String(tarea.valorBaseUSD || 0),
            porcentajeComision: String(tarea.porcentajeAsignado || 0),
        })
        setIsEditOpen(true)
    }

    const handleGuardarEdicion = async () => {
        if (!selectedTask) return
        if (!editForm.nombre.trim()) return void toast.error('El nombre es obligatorio')

        const valorBase = parseFloat(editForm.valorBaseUSD) || 0
        const porcentaje = parseFloat(editForm.porcentajeComision) || 0
        const montoComision = valorBase > 0 && porcentaje > 0 ? (valorBase * porcentaje) / 100 : (selectedTask.montoComision || 0)

        const tid = toast.loading('Guardando cambios...')
        try {
            const updateData: any = {
                nombreTarea: editForm.nombre.trim(),
                tipoTarea: editForm.tipo,
                ordenRef: editForm.ordenRef.trim() || null,
                estado: editForm.estado,
                estadoPago: editForm.estadoPago,
                valorBaseUSD: valorBase,
                porcentajeAsignado: porcentaje || null,
                montoComision,
                detalles: {
                    tiempoMinutos: editForm.tiempoMinutos || null,
                    cantidad: editForm.cantidad || null,
                    medidas: editForm.medidas || null,
                    descripcion: editForm.descripcion || null,
                }
            }
            // Si se aprueba desde edición, registrar auditoría
            if (editForm.estado === 'APROBADA' && selectedTask.estado !== 'APROBADA') {
                updateData.fechaAprobacion = serverTimestamp()
                updateData.aprobadoPor = currentUser.nombre || 'Admin'
            }
            // Si se marca pagada desde edición
            if (editForm.estadoPago === 'PAGADO' && selectedTask.estadoPago !== 'PAGADO') {
                updateData.fechaPago = serverTimestamp()
                updateData.pagadoPor = currentUser.nombre || 'Admin'
                updateData.metodoPago = 'Manual (Edición)'
            }
            await updateDoc(doc(db, 'empleado_tareas', selectedTask.id), updateData)
            toast.dismiss(tid)
            toast.success('Tarea actualizada correctamente')
            setIsEditOpen(false)
            setSelectedTask(null)
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error al guardar: ${err?.code || err?.message}`)
            console.error(err)
        }
    }

    // ============================================================
    // ACCIÓN: PAGAR INDIVIDUAL (ADMIN)
    // ============================================================
    const handleMarcarPagada = async (tarea: TareaEmpleado) => {
        const tid = toast.loading('Registrando pago...')
        try {
            await updateDoc(doc(db, 'empleado_tareas', tarea.id), {
                estadoPago: 'PAGADO',
                fechaPago: serverTimestamp(),
                pagadoPor: currentUser.nombre || 'Admin',
                metodoPago: 'Manual',
                tasaPago: rates.usd
            })
            toast.dismiss(tid)
            toast.success(`Pago de $${tarea.montoComision.toFixed(2)} registrado`)
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error: ${err?.code || err?.message}`)
        }
    }

    // ============================================================
    // ACCIÓN: PAGO GLOBAL (ADMIN)
    // ============================================================
    const handlePagoGlobal = async () => {
        if (tareasSeleccionadas.size === 0) return void toast.error('Selecciona al menos una tarea')
        const tareasPagar = tareasAPagar.filter(t => tareasSeleccionadas.has(t.id))
        const rate = getRateForMoneda(paymentMoneda)
        const monedaLabel = MONEDAS.find(m => m.value === paymentMoneda)?.label || paymentMoneda

        const tid = toast.loading(`Procesando ${tareasPagar.length} pago(s)...`)
        try {
            const batch = writeBatch(db)
            tareasPagar.forEach(t => {
                batch.update(doc(db, 'empleado_tareas', t.id), {
                    estadoPago: 'PAGADO',
                    fechaPago: serverTimestamp(),
                    pagadoPor: currentUser.nombre || 'Admin',
                    metodoPago: monedaLabel,
                    tasaPago: rate
                })
            })
            await batch.commit()
            toast.dismiss(tid)
            toast.success(`${tareasPagar.length} tarea(s) marcadas como pagadas`)
            setIsPaymentOpen(false)
            setTareasSeleccionadas(new Set())
        } catch (err: any) {
            toast.dismiss(tid)
            toast.error(`Error en pago global: ${err?.code || err?.message}`)
            console.error(err)
        }
    }

    const toggleTask = (id: string) => setTareasSeleccionadas(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
    const toggleAllByEmpleado = (ids: string[], allSelected: boolean) => setTareasSeleccionadas(prev => {
        const next = new Set(prev); ids.forEach(id => allSelected ? next.delete(id) : next.add(id)); return next
    })

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="space-y-8 max-w-7xl mx-auto font-sans">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl font-black uppercase italic tracking-tighter dark:text-white flex items-center gap-3">
                        <Layers className="w-10 h-10 text-blue-600" />
                        {isAdmin ? 'Control de Tareas' : 'Mis Tareas'}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {isAdmin
                            ? `${tareas.length} tarea(s) cargada(s) de ${empleadosDb.length} empleado(s) — Rol: ${currentUser?.rol}`
                            : 'Registra tu trabajo y consulta tus comisiones'}
                    </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {isAdmin && (
                        <>
                            <Button variant="outline" size="icon" onClick={() => setupListener()}
                                className="h-12 w-12 rounded-2xl border-black/10 dark:border-white/10" title="Recargar datos">
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                                onClick={() => { setTareasSeleccionadas(new Set()); setIsPaymentOpen(true) }}
                                disabled={tareasAPagar.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-2xl px-5 font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20"
                            >
                                <Banknote className="w-4 h-4 mr-2" /> Pago Global
                                {tareasAPagar.length > 0 && <span className="ml-2 bg-white/20 rounded-full px-2 text-[9px]">{tareasAPagar.length}</span>}
                            </Button>
                            <Button
                                onClick={() => { resetAssignForm(); setIsAssignOpen(true) }}
                                className="bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl px-5 font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20"
                            >
                                <UserPlus className="w-4 h-4 mr-2" /> Asignar Tarea
                            </Button>
                        </>
                    )}
                    {!isAdmin && (
                        <Button onClick={() => setIsRegisterOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl px-5 font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4 mr-2" /> Registrar Trabajo
                        </Button>
                    )}
                </div>
            </div>

            {/* BANNER DE ERROR */}
            {queryError && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-black text-sm text-red-700 dark:text-red-400 uppercase">Error en la consulta de Firestore</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{queryError}</p>
                        <p className="text-[10px] text-red-500 mt-1 opacity-70">
                            Si ves "permission-denied", ve a Firebase Console → Firestore → Reglas y permite leer la colección "empleado_tareas" para usuarios autenticados.
                        </p>
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div className={cn('grid gap-4', isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2')}>
                <KpiCard icon={<Clock className="w-7 h-7" />} label="Pendientes Revisión" value={isLoading ? '...' : pendientesReview.toString()} color="amber" />
                <KpiCard icon={<AlertCircle className="w-7 h-7" />} label={isAdmin ? 'Por Pagar (USD)' : 'Por Cobrar'} value={isLoading ? '...' : `$${aPagarTotal.toFixed(2)}`} color="blue" />
                {isAdmin && (
                    <>
                        <KpiCard icon={<CheckCircle2 className="w-7 h-7" />} label="Total Pagado" value={isLoading ? '...' : `$${totalPagado.toFixed(2)}`} color="emerald" />
                        <KpiCard icon={<Users className="w-7 h-7" />} label="Empleados c/ Tareas" value={isLoading ? '...' : resumenEmpleados.length.toString()} color="indigo" />
                    </>
                )}
                {!isAdmin && (
                    <KpiCard icon={<TrendingUp className="w-7 h-7" />} label="Total Cobrado" value={isLoading ? '...' : `$${totalPagado.toFixed(2)}`} color="emerald" />
                )}
            </div>

            {/* FILTROS */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Buscar por empleado, tarea u orden..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-14 pl-14 rounded-[2rem] bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 font-bold shadow-sm dark:text-white"
                    />
                </div>
                {isAdmin && empleadosDb.length > 0 && (
                    <Select value={filterEmpleado} onValueChange={setFilterEmpleado}>
                        <SelectTrigger className="h-14 w-full md:w-56 rounded-[2rem] bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 font-bold text-xs uppercase">
                            <SelectValue placeholder="Filtrar por empleado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            <SelectItem value="TODOS" className="font-bold text-xs uppercase">Todos los empleados</SelectItem>
                            {empleadosDb.map(e => (
                                <SelectItem key={e.id} value={e.id} className="font-bold text-sm">
                                    {e.nombre} {e.apellido || ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* RESUMEN POR EMPLEADO */}
            {isAdmin && resumenEmpleados.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {resumenEmpleados.map(emp => (
                        <button key={emp.id}
                            onClick={() => setFilterEmpleado(prev => prev === emp.id ? 'TODOS' : emp.id)}
                            className={cn(
                                'text-left p-4 rounded-[2rem] border transition-all',
                                filterEmpleado === emp.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                    : 'border-black/5 dark:border-white/5 bg-white dark:bg-[#1c1c1e] hover:border-blue-300'
                            )}>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest truncate">{emp.nombre}</p>
                            <div className="flex gap-1.5 flex-wrap mt-2">
                                {emp.pendientes > 0 && <span className="text-[8px] bg-amber-100 text-amber-600 font-black px-2 py-0.5 rounded-full uppercase">{emp.pendientes} pend.</span>}
                                {emp.aPagar > 0 && <span className="text-[8px] bg-blue-100 text-blue-600 font-black px-2 py-0.5 rounded-full uppercase">${emp.aPagar.toFixed(0)}</span>}
                                {emp.pagado > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-600 font-black px-2 py-0.5 rounded-full uppercase">✓${emp.pagado.toFixed(0)}</span>}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* TABS */}
            <Tabs defaultValue={isAdmin ? 'pendientes' : 'todas'} className="w-full">
                <TabsList className="bg-slate-200/50 dark:bg-white/5 p-1.5 rounded-2xl mb-6 h-auto gap-1 flex-wrap">
                    {isAdmin && (
                        <TabsTrigger value="pendientes" className="rounded-xl px-5 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <Activity className="w-3.5 h-3.5 mr-1.5 inline-block" />
                            Requieren Acción
                            {pendientesReview > 0 && <span className="ml-1.5 bg-amber-500 text-white rounded-full w-4 h-4 text-[8px] inline-flex items-center justify-center">{pendientesReview}</span>}
                        </TabsTrigger>
                    )}
                    {isAdmin && (
                        <TabsTrigger value="apagar" className="rounded-xl px-5 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                            <Banknote className="w-3.5 h-3.5 mr-1.5 inline-block" />
                            A Pagar
                            {tareasAPagar.length > 0 && <span className="ml-1.5 bg-blue-500 text-white rounded-full w-4 h-4 text-[8px] inline-flex items-center justify-center">{tareasAPagar.length}</span>}
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="todas" className="rounded-xl px-5 py-2.5 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                        <FileCheck className="w-3.5 h-3.5 mr-1.5 inline-block" />
                        {isAdmin ? `Todas (${tareasFiltradas.length})` : `Mis Tareas (${tareasFiltradas.length})`}
                    </TabsTrigger>
                </TabsList>

                {isAdmin && (
                    <TabsContent value="pendientes" className="mt-0 space-y-4">
                        <TareasLista tareas={tareasFiltradas.filter(t => t.estado === 'PENDIENTE')} isAdmin={isAdmin}
                            onReview={t => { setSelectedTask(t); setReviewValor(''); setReviewPorcentaje(''); setIsReviewOpen(true) }}
                            onRechazar={handleRechazarTarea} onPagar={handleMarcarPagada}
                            onEdit={openEditModal} onEliminar={handleEliminarTarea} isLoading={isLoading}
                            emptyText="No hay tareas pendientes de revisión" />
                    </TabsContent>
                )}
                {isAdmin && (
                    <TabsContent value="apagar" className="mt-0 space-y-4">
                        <TareasLista tareas={tareasFiltradas.filter(t => t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE')} isAdmin={isAdmin}
                            onReview={t => { setSelectedTask(t); setReviewValor(''); setReviewPorcentaje(''); setIsReviewOpen(true) }}
                            onRechazar={handleRechazarTarea} onPagar={handleMarcarPagada}
                            onEdit={openEditModal} onEliminar={handleEliminarTarea} showPagarButton isLoading={isLoading}
                            emptyText="No hay comisiones pendientes de pago" />
                    </TabsContent>
                )}
                <TabsContent value="todas" className="mt-0 space-y-4">
                    <TareasLista tareas={tareasFiltradas} isAdmin={isAdmin}
                        onReview={t => { setSelectedTask(t); setReviewValor(''); setReviewPorcentaje(''); setIsReviewOpen(true) }}
                        onRechazar={handleRechazarTarea} onPagar={handleMarcarPagada}
                        onEdit={openEditModal} onEliminar={handleEliminarTarea} showPagarButton={isAdmin} isLoading={isLoading}
                        emptyText={isLoading ? 'Cargando tareas...' : queryError ? 'Error en la consulta — ver banner arriba' : 'No se encontraron tareas'} />
                </TabsContent>
            </Tabs>

            {/* ====================================================
                MODAL 1: REGISTRAR TAREA (EMPLEADO)
            ==================================================== */}
            <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Registrar Trabajo</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">El admin revisará y asignará tu comisión</p>
                    </DialogHeader>
                    <SimpleTaskForm form={regForm} onChange={(k, v) => setRegForm(p => ({ ...p, [k]: v }))} />
                    <Button onClick={handleRegistrarTarea} className="w-full h-14 rounded-[2rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl mt-4">
                        <Check className="w-4 h-4 mr-2" /> Enviar para Revisión
                    </Button>
                </DialogContent>
            </Dialog>

            {/* ====================================================
                MODAL 2: ASIGNAR TAREA (ADMIN) — estado directo, sin closures
            ==================================================== */}
            <Dialog open={isAssignOpen} onOpenChange={v => { setIsAssignOpen(v); if (!v) resetAssignForm() }}>
                <DialogContent className="sm:max-w-lg rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Asignar Tarea</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {empleadosDb.length === 0 ? '⚠ No hay empleados registrados en la BD' : `${empleadosDb.length} empleado(s) disponible(s)`}
                        </p>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Selector de empleado */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Empleado *</Label>
                            <Select value={assignEmpleadoId} onValueChange={setAssignEmpleadoId}>
                                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                    <SelectValue placeholder="Seleccionar empleado..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {empleadosDb.length === 0 && (
                                        <SelectItem value="__none__" disabled className="text-red-500 text-xs">No hay empleados registrados</SelectItem>
                                    )}
                                    {empleadosDb.map(e => (
                                        <SelectItem key={e.id} value={e.id} className="font-bold text-sm">
                                            {e.nombre} {e.apellido || ''} {e.cargo ? `— ${e.cargo}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Nombre de la tarea */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">¿Qué debe hacer? *</Label>
                            <Input placeholder="Ej. Corte de letras en MDF 3mm"
                                value={assignNombre} onChange={e => setAssignNombre(e.target.value)}
                                className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                        </div>

                        {/* Tipo + Orden */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo</Label>
                                <Select value={assignTipo} onValueChange={setAssignTipo}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="font-bold text-xs uppercase">{t.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nro. Orden (opcional)</Label>
                                <Input placeholder="Ej. ORD-0142"
                                    value={assignOrdenRef} onChange={e => setAssignOrdenRef(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                            </div>
                        </div>

                        {/* Cantidad / Tiempo / Medidas */}
                        <div className="grid grid-cols-2 gap-3">
                            {assignTipo === 'CORTE_LASER' ? (
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[10px] font-black uppercase text-orange-500 ml-2">Tiempo de Máquina (Min)</Label>
                                    <Input type="number" placeholder="Ej. 45"
                                        value={assignTiempo} onChange={e => setAssignTiempo(e.target.value)}
                                        className="h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border-none font-black text-orange-700 dark:text-orange-400" />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cantidad</Label>
                                    <Input type="number" min="1"
                                        value={assignCantidad} onChange={e => setAssignCantidad(e.target.value)}
                                        className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black text-center" />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Medidas (opcional)</Label>
                                <Input placeholder="Ej. 120x80cm"
                                    value={assignMedidas} onChange={e => setAssignMedidas(e.target.value)}
                                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descripción (opcional)</Label>
                            <Textarea placeholder="Detalles adicionales..."
                                value={assignDescripcion} onChange={e => setAssignDescripcion(e.target.value)}
                                className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-medium text-sm resize-none min-h-[72px]" />
                        </div>

                        {/* Tarifas del empleado seleccionado */}
                        {assignEmpleadoId && (() => {
                            const empSel = empleadosDb.find((e: any) => e.id === assignEmpleadoId)
                            const reglas: any[] = empSel?.reglasComision || []
                            if (!reglas.length) return null
                            return (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-purple-500 ml-2 flex items-center gap-1.5">
                                        <Layers className="w-3 h-3" /> Tarifas de {empSel?.nombre}
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {reglas.map((r: any) => {
                                            const lbl = r.tipo === 'POR_MINUTO' ? `$${r.valor}/min` : r.tipo === 'FIJO' ? `$${r.valor}` : `${r.valor}%`
                                            return (
                                                <button key={r.id} type="button"
                                                    onClick={() => {
                                                        setAssignNombre(r.nombre)
                                                        if (r.tipo === 'FIJO') {
                                                            setAssignMontoDirecto(String(r.valor))
                                                            setAssignRatePerMin(null)
                                                        } else if (r.tipo === 'POR_MINUTO') {
                                                            setAssignRatePerMin(r.valor)
                                                            setAssignTipo('CORTE_LASER')
                                                            setAssignMontoDirecto('')
                                                        } else {
                                                            setAssignPorcentaje(String(r.valor))
                                                            setAssignMontoDirecto('')
                                                            setAssignRatePerMin(null)
                                                        }
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 font-black text-[10px] uppercase hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors">
                                                    {r.nombre} · {lbl}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {assignRatePerMin !== null && assignTiempo && parseFloat(assignTiempo) > 0 && (
                                        <p className="text-[10px] font-black text-orange-500 ml-2">
                                            {assignTiempo} min × ${assignRatePerMin}/min = <span className="text-emerald-600">${(parseFloat(assignTiempo) * assignRatePerMin).toFixed(2)}</span>
                                        </p>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Comisión */}
                        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl space-y-3">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Comisión (opcional — puedes asignarla después)</p>

                            {/* Monto directo */}
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-blue-500 ml-1">Monto Fijo ($)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                                    <Input type="number" placeholder="0.00"
                                        value={assignMontoDirecto} onChange={e => { setAssignMontoDirecto(e.target.value); setAssignRatePerMin(null) }}
                                        className="h-12 pl-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 border-none font-black text-blue-700 dark:text-blue-400" />
                                </div>
                            </div>

                            {/* O por porcentaje */}
                            {!parseFloat(assignMontoDirecto) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Base ($) ÷ %</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                            <Input type="number" placeholder="0.00"
                                                value={assignValorBase} onChange={e => setAssignValorBase(e.target.value)}
                                                className="h-12 pl-8 rounded-xl bg-white dark:bg-black/20 border-black/10 font-black" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Comisión (%)</Label>
                                        <div className="relative">
                                            <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                                            <Input type="number" placeholder="Ej. 10"
                                                value={assignPorcentaje} onChange={e => setAssignPorcentaje(e.target.value)}
                                                className="h-12 pr-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border-none font-black text-emerald-600" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(parseFloat(assignMontoDirecto) > 0 || (parseFloat(assignValorBase) > 0 && parseFloat(assignPorcentaje) > 0)) && (
                                <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase opacity-80">Comisión a ganar:</span>
                                    <span className="text-xl font-black italic">
                                        +${parseFloat(assignMontoDirecto) > 0
                                            ? parseFloat(assignMontoDirecto).toFixed(2)
                                            : ((parseFloat(assignValorBase) * parseFloat(assignPorcentaje)) / 100).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <Button onClick={handleAsignarTarea} disabled={!assignNombre.trim() || !assignEmpleadoId}
                            className="w-full h-14 rounded-[2rem] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-xl disabled:opacity-50">
                            <UserPlus className="w-4 h-4 mr-2" /> Asignar Tarea
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ====================================================
                MODAL 3: EDITAR TAREA COMPLETA (ADMIN)
            ==================================================== */}
            <Dialog open={isEditOpen} onOpenChange={v => { setIsEditOpen(v); if (!v) setSelectedTask(null) }}>
                <DialogContent className="sm:max-w-lg rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Editar Tarea</DialogTitle>
                        {selectedTask && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empleado: {selectedTask.nombreEmpleado}</p>}
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre de la tarea *</Label>
                            <Input value={editForm.nombre} onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                                className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                        </div>

                        {/* Tipo + Orden */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo</Label>
                                <Select value={editForm.tipo} onValueChange={v => setEditForm(p => ({ ...p, tipo: v }))}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="font-bold text-xs">{t.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nro. Orden</Label>
                                <Input placeholder="ORD-0001" value={editForm.ordenRef} onChange={e => setEditForm(p => ({ ...p, ordenRef: e.target.value }))}
                                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                            </div>
                        </div>

                        {/* Detalles */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cantidad</Label>
                                <Input type="number" value={editForm.cantidad} onChange={e => setEditForm(p => ({ ...p, cantidad: e.target.value }))}
                                    className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black text-center" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Medidas</Label>
                                <Input placeholder="120x80cm" value={editForm.medidas} onChange={e => setEditForm(p => ({ ...p, medidas: e.target.value }))}
                                    className="h-12 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descripción</Label>
                                <Textarea value={editForm.descripcion} onChange={e => setEditForm(p => ({ ...p, descripcion: e.target.value }))}
                                    className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-medium text-sm resize-none min-h-[60px]" />
                            </div>
                        </div>

                        {/* Estado y Estado de Pago */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Estado de Revisión</Label>
                                <Select value={editForm.estado} onValueChange={v => setEditForm(p => ({ ...p, estado: v }))}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs uppercase">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDIENTE" className="font-bold text-xs">Pendiente</SelectItem>
                                        <SelectItem value="APROBADA" className="font-bold text-xs">Aprobada</SelectItem>
                                        <SelectItem value="RECHAZADA" className="font-bold text-xs">Rechazada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Estado de Pago</Label>
                                <Select value={editForm.estadoPago} onValueChange={v => setEditForm(p => ({ ...p, estadoPago: v }))}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs uppercase">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PENDIENTE" className="font-bold text-xs">Pendiente de Pago</SelectItem>
                                        <SelectItem value="PAGADO" className="font-bold text-xs">Pagado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Comisión */}
                        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl space-y-3">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Comisión</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Valor Base ($)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <Input type="number" value={editForm.valorBaseUSD} onChange={e => setEditForm(p => ({ ...p, valorBaseUSD: e.target.value }))}
                                            className="h-12 pl-8 rounded-xl bg-white dark:bg-black/20 border-black/10 font-black" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Comisión (%)</Label>
                                    <div className="relative">
                                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                                        <Input type="number" value={editForm.porcentajeComision} onChange={e => setEditForm(p => ({ ...p, porcentajeComision: e.target.value }))}
                                            className="h-12 pr-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border-none font-black text-emerald-600" />
                                    </div>
                                </div>
                            </div>
                            {parseFloat(editForm.valorBaseUSD) > 0 && parseFloat(editForm.porcentajeComision) > 0 && (
                                <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase opacity-80">Comisión calculada:</span>
                                    <span className="text-xl font-black italic">+${((parseFloat(editForm.valorBaseUSD) * parseFloat(editForm.porcentajeComision)) / 100).toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <Button onClick={handleGuardarEdicion}
                            className="w-full h-14 rounded-[2rem] bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-black uppercase tracking-widest shadow-xl">
                            <Check className="w-4 h-4 mr-2" /> Guardar Cambios
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ====================================================
                MODAL 4: VALORAR TAREA (ADMIN)
            ==================================================== */}
            <Dialog open={isReviewOpen} onOpenChange={v => { setIsReviewOpen(v); if (!v) { setSelectedTask(null); setReviewMontoDirecto(''); setReviewValor(''); setReviewPorcentaje('') } }}>
                <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Valorar Tarea</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comisión para {selectedTask?.nombreEmpleado}</p>
                    </DialogHeader>
                    {selectedTask && (
                        <div className="space-y-5">
                            {/* Info de la tarea */}
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                                <p className="font-black italic uppercase text-lg leading-tight mb-2">{selectedTask.nombreTarea}</p>
                                <div className="flex gap-2 flex-wrap">
                                    <Badge className="bg-blue-100 text-blue-600 text-[8px] uppercase border-none">{selectedTask.tipoTarea}</Badge>
                                    {selectedTask.ordenRef && <Badge variant="outline" className="text-[8px] border-black/10">Orden: {selectedTask.ordenRef}</Badge>}
                                    {selectedTask.detalles?.tiempoMinutos && <Badge className="bg-orange-100 text-orange-600 text-[8px] uppercase border-none">{selectedTask.detalles.tiempoMinutos} min</Badge>}
                                    {selectedTask.detalles?.cantidad && <Badge variant="outline" className="text-[8px] border-black/10">Cant: {selectedTask.detalles.cantidad}</Badge>}
                                </div>
                                {selectedTask.detalles?.descripcion && <p className="text-xs text-slate-500 mt-2 italic">{selectedTask.detalles.descripcion}</p>}
                            </div>

                            {/* Tarifas del empleado */}
                            {(() => {
                                const empDeTarea = empleadosDb.find((e: any) => e.id === selectedTask.empleadoDbId)
                                const reglas: any[] = empDeTarea?.reglasComision || []
                                if (!reglas.length) return null
                                return (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-purple-500 ml-2 flex items-center gap-1.5">
                                            <Layers className="w-3 h-3" /> Tarifas registradas
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {reglas.map((r: any) => (
                                                <button key={r.id} type="button"
                                                    onClick={() => {
                                                        if (r.tipo === 'FIJO') {
                                                            setReviewMontoDirecto(String(r.valor))
                                                        } else if (r.tipo === 'POR_MINUTO') {
                                                            const mins = parseFloat(selectedTask.detalles?.tiempoMinutos || '0') || 0
                                                            setReviewMontoDirecto(mins > 0 ? (mins * r.valor).toFixed(2) : String(r.valor))
                                                        } else {
                                                            setReviewPorcentaje(String(r.valor))
                                                            setReviewMontoDirecto('')
                                                        }
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 font-black text-[10px] uppercase hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors">
                                                    {r.nombre} · {r.tipo === 'POR_MINUTO' ? `$${r.valor}/min` : r.tipo === 'FIJO' ? `$${r.valor}` : `${r.valor}%`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Monto directo (principal) */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-blue-500 ml-2">Monto a Pagar ($)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                                    <Input type="number" placeholder="0.00" value={reviewMontoDirecto} onChange={e => setReviewMontoDirecto(e.target.value)}
                                        className="h-14 pl-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border-none font-black text-lg text-blue-700 dark:text-blue-400" />
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 ml-2 uppercase tracking-wide">O calcula por porcentaje:</p>
                            </div>

                            {/* Cálculo por porcentaje (secundario) */}
                            {!parseFloat(reviewMontoDirecto) && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor Base ($)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input type="number" placeholder="0.00" value={reviewValor} onChange={e => setReviewValor(e.target.value)}
                                                className="h-14 pl-10 rounded-2xl bg-white dark:bg-black/20 font-black text-lg border-black/10 dark:border-white/10" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Comisión (%)</Label>
                                        <div className="relative">
                                            <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                            <Input type="number" placeholder="Ej. 10" value={reviewPorcentaje} onChange={e => setReviewPorcentaje(e.target.value)}
                                                className="h-14 pr-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border-none font-black text-lg text-emerald-600" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview */}
                            {(parseFloat(reviewMontoDirecto) > 0 || (parseFloat(reviewValor) > 0 && parseFloat(reviewPorcentaje) > 0)) && (
                                <div className="bg-emerald-500 text-white p-5 rounded-[2rem] text-center shadow-lg shadow-emerald-500/20">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{selectedTask.nombreEmpleado} ganará:</p>
                                    <p className="text-4xl font-black italic tracking-tighter">
                                        +${parseFloat(reviewMontoDirecto) > 0
                                            ? parseFloat(reviewMontoDirecto).toFixed(2)
                                            : ((parseFloat(reviewValor) * parseFloat(reviewPorcentaje)) / 100).toFixed(2)}
                                    </p>
                                </div>
                            )}

                            <Button onClick={handleAprobarTarea}
                                disabled={!parseFloat(reviewMontoDirecto) && (!reviewValor || !reviewPorcentaje)}
                                className="w-full h-14 rounded-[2rem] bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-black uppercase tracking-widest shadow-xl disabled:opacity-50">
                                <Check className="w-4 h-4 mr-2" /> Aprobar y Asignar Comisión
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ====================================================
                MODAL 5: PAGO GLOBAL (ADMIN)
            ==================================================== */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent className="sm:max-w-2xl rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-0 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Pago Global de Comisiones</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selecciona tareas y moneda de pago</p>
                    </DialogHeader>

                    {tareasAPagarPorEmpleado.length === 0 ? (
                        <div className="text-center py-16 opacity-40">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
                            <p className="font-bold uppercase text-sm">Todas las comisiones están al día</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Moneda */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {MONEDAS.map(m => (
                                    <button key={m.value} onClick={() => setPaymentMoneda(m.value)}
                                        className={cn('px-3 py-3 rounded-2xl border font-black text-xs uppercase transition-all',
                                            paymentMoneda === m.value
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                                : 'border-black/10 dark:border-white/10 hover:border-blue-300 text-slate-600 dark:text-slate-400')}>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Tasa: {paymentMoneda === 'USD' ? '1:1' : `1 USD = ${getRateForMoneda(paymentMoneda).toFixed(2)} ${paymentMoneda}`}
                            </p>

                            {/* Lista por empleado */}
                            {tareasAPagarPorEmpleado.map(emp => {
                                const empIds = emp.tareas.map(t => t.id)
                                const allSel = empIds.every(id => tareasSeleccionadas.has(id))
                                const totalEmp = emp.tareas.filter(t => tareasSeleccionadas.has(t.id)).reduce((acc, t) => acc + (t.montoComision || 0), 0)
                                return (
                                    <div key={emp.id} className="border border-black/5 dark:border-white/5 rounded-[2rem] overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-white/5 cursor-pointer"
                                            onClick={() => toggleAllByEmpleado(empIds, allSel)}>
                                            <div className="flex items-center gap-3">
                                                <Checkbox checked={allSel} onCheckedChange={() => toggleAllByEmpleado(empIds, allSel)} className="rounded-lg border-2" />
                                                <div>
                                                    <p className="font-black text-sm uppercase">{emp.nombre}</p>
                                                    <p className="text-[9px] text-slate-400 uppercase">{emp.tareas.length} tarea(s)</p>
                                                </div>
                                            </div>
                                            {totalEmp > 0 && <p className="font-black text-emerald-600 text-lg">{getCurrencySymbol(paymentMoneda)}{convertAmount(totalEmp, paymentMoneda).toFixed(2)}</p>}
                                        </div>
                                        <div className="divide-y divide-black/5 dark:divide-white/5">
                                            {emp.tareas.map(t => (
                                                <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" onClick={() => toggleTask(t.id)}>
                                                    <Checkbox checked={tareasSeleccionadas.has(t.id)} onCheckedChange={() => toggleTask(t.id)} className="rounded-lg border-2" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm truncate">{t.nombreTarea}</p>
                                                        <p className="text-[9px] text-slate-400">{formatDate(t.fechaRegistro)}{t.ordenRef ? ` · ${t.ordenRef}` : ''}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-black text-sm">${t.montoComision.toFixed(2)}</p>
                                                        {paymentMoneda !== 'USD' && <p className="text-[9px] text-slate-400">{getCurrencySymbol(paymentMoneda)}{convertAmount(t.montoComision, paymentMoneda).toFixed(2)}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}

                            {tareasSeleccionadas.size > 0 ? (
                                <div className="bg-slate-900 dark:bg-white text-white dark:text-black p-6 rounded-[2rem] space-y-3">
                                    <div className="flex justify-between text-sm"><span className="opacity-70 font-bold">Tareas:</span><span className="font-black">{tareasSeleccionadas.size}</span></div>
                                    <div className="flex justify-between"><span className="opacity-70 font-bold text-sm">Total USD:</span><span className="font-black text-lg">${totalSeleccionadoUSD.toFixed(2)}</span></div>
                                    {paymentMoneda !== 'USD' && (
                                        <div className="flex justify-between border-t border-white/10 dark:border-black/10 pt-3">
                                            <span className="opacity-70 font-bold text-sm">Total {paymentMoneda}:</span>
                                            <span className="font-black text-2xl">{getCurrencySymbol(paymentMoneda)}{convertAmount(totalSeleccionadoUSD, paymentMoneda).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <Button onClick={handlePagoGlobal} className="w-full h-14 rounded-[2rem] bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest">
                                        <Banknote className="w-4 h-4 mr-2" /> Confirmar Pago — {getCurrencySymbol(paymentMoneda)}{convertAmount(totalSeleccionadoUSD, paymentMoneda).toFixed(2)}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest">Selecciona tareas para ver el total</p>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ============================================================
// SUB-COMPONENTES
// ============================================================
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const map: Record<string, string> = {
        amber: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600',
        blue: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600',
        emerald: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600',
        indigo: 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600',
    }
    return (
        <Card className="rounded-[2rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm p-5 flex items-center gap-4">
            <div className={cn('p-3 rounded-[1.2rem] shrink-0', map[color] || map.blue)}>{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
                <p className="text-2xl font-black italic tracking-tighter truncate">{value}</p>
            </div>
        </Card>
    )
}

interface TareasListaProps {
    tareas: TareaEmpleado[]
    isAdmin: boolean
    onReview: (t: TareaEmpleado) => void
    onRechazar: (id: string) => void
    onPagar: (t: TareaEmpleado) => void
    onEdit: (t: TareaEmpleado) => void
    onEliminar: (t: TareaEmpleado) => void
    showPagarButton?: boolean
    isLoading?: boolean
    emptyText?: string
}

function TareasLista({ tareas, isAdmin, onReview, onRechazar, onPagar, onEdit, onEliminar, showPagarButton, isLoading, emptyText }: TareasListaProps) {
    if (isLoading) {
        return (
            <div className="text-center py-20 opacity-40">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
                <p className="font-bold uppercase tracking-widest text-xs">Cargando tareas...</p>
            </div>
        )
    }
    if (tareas.length === 0) {
        return (
            <div className="text-center py-20 opacity-40">
                <Layers className="w-12 h-12 mx-auto mb-3" />
                <p className="font-bold uppercase tracking-widest text-xs">{emptyText || 'No hay tareas'}</p>
            </div>
        )
    }
    return (
        <AnimatePresence>
            {tareas.map(tarea => (
                <motion.div key={tarea.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-[#1c1c1e] p-5 md:p-6 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:shadow-md transition-all">

                    <div className="flex gap-4 items-start flex-1 min-w-0">
                        <div className="bg-slate-50 dark:bg-black/20 p-3.5 rounded-2xl border border-black/5 shrink-0">
                            {getTaskIcon(tarea.tipoTarea)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-black text-base md:text-lg uppercase italic dark:text-white leading-none">{tarea.nombreTarea}</h3>
                                <EstadoBadge estado={tarea.estado} />
                                {tarea.estadoPago === 'PAGADO' && <Badge className="bg-blue-100 text-blue-600 border-none text-[8px] uppercase font-black">Pagado</Badge>}
                                {tarea.asignadoPor && <Badge variant="outline" className="text-[8px] border-black/10">Asignada</Badge>}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                {isAdmin ? `${tarea.nombreEmpleado} · ` : ''}
                                {formatDate(tarea.fechaRegistro)}
                                {tarea.ordenRef ? ` · Orden: ${tarea.ordenRef}` : ''}
                            </p>
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                                {tarea.detalles?.cantidad && <span className="text-[8px] bg-slate-100 dark:bg-white/5 font-black px-2 py-0.5 rounded-md uppercase text-slate-500">Cant: {tarea.detalles.cantidad}</span>}
                                {tarea.detalles?.tiempoMinutos && <span className="text-[8px] bg-orange-50 dark:bg-orange-500/10 font-black px-2 py-0.5 rounded-md uppercase text-orange-600">{tarea.detalles.tiempoMinutos} min</span>}
                                {tarea.detalles?.medidas && <span className="text-[8px] bg-blue-50 dark:bg-blue-500/10 font-black px-2 py-0.5 rounded-md uppercase text-blue-600">{tarea.detalles.medidas}</span>}
                                {tarea.detalles?.descripcion && <span className="text-[8px] bg-slate-100 dark:bg-white/5 font-black px-2 py-0.5 rounded-md text-slate-500 max-w-[180px] truncate">{tarea.detalles.descripcion}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-black/5 pt-4 md:pt-0 shrink-0">
                        {tarea.estado === 'APROBADA' && (
                            <div className="text-right">
                                <p className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">
                                    {tarea.porcentajeAsignado ? `${tarea.porcentajeAsignado}%` : 'Comisión'}
                                </p>
                                <p className="text-xl font-black text-emerald-600 italic">+${(tarea.montoComision || 0).toFixed(2)}</p>
                                {tarea.estadoPago === 'PAGADO' && tarea.fechaPago && (
                                    <p className="text-[8px] text-slate-400">Pagado {formatDate(tarea.fechaPago)}</p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2">
                            {/* Botones de admin: editar y eliminar */}
                            {isAdmin && (
                                <>
                                    <Button variant="outline" size="icon" onClick={() => onEdit(tarea)}
                                        className="rounded-xl border-black/10 dark:border-white/10 h-10 w-10" title="Editar tarea">
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => onEliminar(tarea)}
                                        className="rounded-xl border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 h-10 w-10" title="Eliminar tarea">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </>
                            )}
                            {/* Acciones según estado */}
                            {isAdmin && tarea.estado === 'PENDIENTE' && (
                                <>
                                    <Button variant="outline" size="icon" onClick={() => onRechazar(tarea.id)}
                                        className="rounded-xl border-red-200 text-red-500 hover:bg-red-50 h-10 w-10" title="Rechazar">
                                        <XCircle className="w-4 h-4" />
                                    </Button>
                                    <Button onClick={() => onReview(tarea)}
                                        className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[9px] tracking-widest h-10 px-4">
                                        Valorar
                                    </Button>
                                </>
                            )}
                            {isAdmin && tarea.estado === 'APROBADA' && tarea.estadoPago === 'PENDIENTE' && showPagarButton && (
                                <Button onClick={() => onPagar(tarea)}
                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] tracking-widest h-10 px-4">
                                    <Banknote className="w-3.5 h-3.5 mr-1" /> Pagar
                                </Button>
                            )}
                            {!isAdmin && tarea.estado === 'PENDIENTE' && (
                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest italic animate-pulse">En revisión...</p>
                            )}
                            {!isAdmin && tarea.estado === 'RECHAZADA' && (
                                <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Rechazada</p>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </AnimatePresence>
    )
}

function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, string> = {
        PENDIENTE: 'bg-amber-100 text-amber-600',
        APROBADA: 'bg-emerald-100 text-emerald-600',
        RECHAZADA: 'bg-red-100 text-red-600',
    }
    const labels: Record<string, string> = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' }
    return <Badge className={cn('border-none text-[8px] uppercase font-black', map[estado] || 'bg-slate-100 text-slate-600')}>{labels[estado] || estado}</Badge>
}

// Formulario simple para el empleado (sin closures problemáticos)
function SimpleTaskForm({ form, onChange }: { form: any; onChange: (key: string, val: string) => void }) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">¿Qué realizaste? *</Label>
                <Input placeholder="Ej. Corte de letras en MDF 3mm"
                    value={form.nombre} onChange={e => onChange('nombre', e.target.value)}
                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => onChange('tipo', v)}>
                        <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="font-bold text-xs">{t.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nro. Orden (opcional)</Label>
                    <Input placeholder="ORD-0142"
                        value={form.ordenRef} onChange={e => onChange('ordenRef', e.target.value)}
                        className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {form.tipo === 'CORTE_LASER' ? (
                    <div className="space-y-2 col-span-2">
                        <Label className="text-[10px] font-black uppercase text-orange-500 ml-2">Tiempo Máquina (Min)</Label>
                        <Input type="number" placeholder="Ej. 45"
                            value={form.tiempoMinutos} onChange={e => onChange('tiempoMinutos', e.target.value)}
                            className="h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border-none font-black text-orange-700 dark:text-orange-400" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cantidad</Label>
                        <Input type="number" min="1"
                            value={form.cantidad} onChange={e => onChange('cantidad', e.target.value)}
                            className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-black text-center" />
                    </div>
                )}
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Medidas</Label>
                    <Input placeholder="120x80cm"
                        value={form.medidas} onChange={e => onChange('medidas', e.target.value)}
                        className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-bold" />
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descripción adicional</Label>
                <Textarea placeholder="Detalles del trabajo realizado..."
                    value={form.descripcion} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange('descripcion', e.target.value)}
                    className="rounded-2xl bg-slate-50 dark:bg-white/5 border-none font-medium text-sm resize-none min-h-[72px]" />
            </div>
        </div>
    )
}
