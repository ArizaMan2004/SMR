// @/components/dashboard/empleados-view.tsx
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Users, CheckCircle2, Clock, TrendingUp, Plus, DollarSign, 
  Calendar, ArrowRightLeft, Trash2, Edit3, X, Briefcase, 
  Wallet, ReceiptText, Search, Filter, AlertCircle, ChevronRight,
  CreditCard, Banknote, Repeat, Link2, UserCheck, Layers, Loader2
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase"; 
import { 
  collection, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp, onSnapshot
} from "firebase/firestore";
import { formatBs } from "@/lib/services/bcv-service";
import { cn } from "@/lib/utils";

// --- CONSTANTES ---
const PAYMENT_METHODS = [
    { value: "Efectivo USD", label: "Caja Chica ($)" },
    { value: "Pago Móvil (Bs)", label: "Banco Nacional (Bs)" },
    { value: "Zelle", label: "Zelle" },
    { value: "Binance USDT", label: "Binance" },
    { value: "Efectivo Bs", label: "Caja Chica (Bs)" }
];

const PERIOD_OPTIONS = [
    "1ra Quincena",
    "2da Quincena",
    "Mes Completo",
    "Semana",
    "Adelanto",
    "Liquidación Final",
    "Bono Especial"
];

const FREQUENCY_OPTIONS = [
    { value: "Mensual", label: "Mensual" },
    { value: "Quincenal", label: "Quincenal" },
    { value: "Semanal", label: "Semanal" },
    { value: "Por Proyecto", label: "Por Proyecto" }
];

const DAYS_OF_WEEK = [
    { value: "1", label: "Lunes" },
    { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" },
    { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" },
    { value: "6", label: "Sábado" },
    { value: "0", label: "Domingo" }
];

// --- HELPERS ---
const calcularDiasRestantes = (emp: any) => {
    const hoy = new Date();
    
    if (emp.frecuenciaPago === 'Semanal') {
        const targetDay = parseInt(emp.diaPago) || 1; 
        const todayDay = hoy.getDay();
        let diff = targetDay - todayDay;
        if (diff < 0) diff += 7;
        
        if (emp.ultimoPagoIso) {
            const lastP = new Date(emp.ultimoPagoIso);
            const diffSinceLastPayment = Math.floor((hoy.getTime() - lastP.getTime()) / (1000 * 60 * 60 * 24));
            if (diffSinceLastPayment < 6 && diff === 0) {
                return 7; 
            }
        }
        return diff === 0 ? "Hoy" : diff;
    } else {
        const diaPago = parseInt(emp.diaPago) || 15;
        let fechaPago = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
        if (hoy.getDate() > diaPago) {
            fechaPago.setMonth(fechaPago.getMonth() + 1);
        }
        const diff = fechaPago.getTime() - hoy.getTime();
        const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return dias === 0 ? "Hoy" : dias;
    }
};

const formatearMes = (yyyy_mm: string) => {
    if (yyyy_mm === 'todos') return 'Todos los meses';
    const [y, m] = yyyy_mm.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
};

interface EmpleadosViewProps {
  empleados: any[];
  pagos: any[];
  rates: any;
  tareas?: any[];
}

export function EmpleadosView({ empleados, pagos, rates, tareas = [] }: EmpleadosViewProps) {
  const [view, setView] = useState<'control' | 'registro' | 'historial'>('control');
  const [editTarget, setEditTarget] = useState<any>(null);
  const [usuariosApp, setUsuariosApp] = useState<any[]>([]);
  const [filtroHistorial, setFiltroHistorial] = useState("todos");
  const [selectedMonthHist, setSelectedMonthHist] = useState<string>(new Date().toISOString().slice(0, 7));
  
  // Estados para Pagos
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const [paymentConfig, setPaymentConfig] = useState({
      metodo: "Efectivo USD",
      intervalo: "1ra Quincena",
      area: "IMPRESION",
      nota: ""
  });

  // Estado del Formulario de Registro
  const [form, setForm] = useState({ 
      nombre: "", 
      cargo: "", 
      sueldo: "", 
      dia: "15", 
      frecuencia: "Mensual",
      usuarioId: "none" 
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const [isTarifasOpen, setIsTarifasOpen] = useState(false);
  const [tarifasEmp, setTarifasEmp] = useState<any>(null);
  const [nuevaTarifa, setNuevaTarifa] = useState({ nombre: '', tipo: 'FIJO', valor: '', descripcion: '' });
  const [editTarifaIdx, setEditTarifaIdx] = useState<number | null>(null);

  useEffect(() => {
      const unsub = onSnapshot(collection(db, "usuarios"), (snap) => {
          setUsuariosApp(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
  }, []);

  const handleRegistrar = async () => {
    if (!form.nombre.trim() || !form.sueldo) {
        alert("El nombre y el sueldo son campos obligatorios.");
        return;
    }
    
    setIsRegistering(true);
    
    // Corrección para el Domingo (0)
    const parsedDia = parseInt(form.dia);
    const diaFinal = isNaN(parsedDia) ? (form.frecuencia === 'Semanal' ? 1 : 15) : parsedDia;

    try {
      await addDoc(collection(db, "empleados"), {
        nombre: form.nombre.trim(),
        cargo: form.cargo.trim() || "Empleado",
        montoSueldo: parseFloat(form.sueldo) || 0,
        diaPago: diaFinal,
        frecuenciaPago: form.frecuencia, 
        comisiones: [],
        ultimoPagoMes: "",
        ultimoPagoIso: null, 
        usuarioId: form.usuarioId === "none" ? null : form.usuarioId,
        fechaRegistro: serverTimestamp()
      });
      setForm({ nombre: "", cargo: "", sueldo: "", dia: "15", frecuencia: "Mensual", usuarioId: "none" });
      setView('control');
    } catch (error) {
      console.error("Error al registrar empleado:", error);
      alert("Ocurrió un error al registrar. Inténtalo de nuevo.");
    } finally {
      setIsRegistering(false);
    }
  };

  const preparePayment = (emp: any) => {
      setSelectedEmployee(emp);
      let defaultInterval = "Mes Completo";
      if (emp.frecuenciaPago === "Quincenal") defaultInterval = "1ra Quincena";
      if (emp.frecuenciaPago === "Semanal") defaultInterval = "Semana";

      const cargo = (emp.cargo || "").toUpperCase();
      let areaSugerida = "IMPRESION";
      if (cargo.includes("LASER") || cargo.includes("CORTE") || cargo.includes("PRODUCCION") || cargo.includes("ARMADO")) {
          areaSugerida = "CORTE";
      }

      setPaymentConfig({
          metodo: "Efectivo USD",
          intervalo: defaultInterval,
          area: areaSugerida,
          nota: ""
      });
      setPaymentModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!selectedEmployee || !rates?.usd) return;
    
    setIsProcessingPayment(true);
    const emp = selectedEmployee;
    const mesActual = new Date().toISOString().slice(0, 7);
    const hoyIso = new Date().toISOString();
    const esSemanal = emp.frecuenciaPago === 'Semanal';
    
    let sueldo = emp.montoSueldo;
    if (esSemanal) {
        if (emp.ultimoPagoIso) {
            const diffDays = Math.floor((new Date().getTime() - new Date(emp.ultimoPagoIso).getTime()) / 86400000);
            if (diffDays < 6) sueldo = 0; 
        }
    } else {
        if (emp.ultimoPagoMes === mesActual) sueldo = 0; 
    }

    const tCom = emp.comisiones?.reduce((a: number, c: any) => a + c.monto, 0) || 0;

    const tareasAprobadas = tareas.filter(t =>
        t.empleadoDbId === emp.id && t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE'
    );
    const taskCom = tareasAprobadas.reduce((s: number, t: any) => s + (t.montoComision || 0), 0);

    const totalUSD = sueldo + tCom + taskCom;

    if (totalUSD <= 0) {
        alert("Este empleado no tiene montos pendientes para transferir en este periodo.");
        setIsProcessingPayment(false);
        return;
    }

    try {
      await addDoc(collection(db, "pagos"), {
        empleadoId: emp.id,
        nombre: emp.nombre,
        conceptos: [
          ...(sueldo > 0 ? [{ tipo: 'Sueldo', monto: sueldo, motivo: paymentConfig.intervalo }] : []),
          ...(emp.comisiones?.map((c: any) => ({ tipo: 'Comisión', monto: c.monto, motivo: c.desc })) || []),
          ...tareasAprobadas.map((t: any) => ({ tipo: 'Bono Tarea', monto: t.montoComision, motivo: t.nombreTarea || t.tipoTarea || 'Tarea completada' })),
        ],
        totalUSD,
        totalVES: totalUSD * rates.usd,
        tasaBCV: rates.usd,
        metodoPago: paymentConfig.metodo,
        areaAsignada: paymentConfig.area,
        notaAdicional: paymentConfig.nota.trim(),
        fecha: hoyIso,
        mesRelativo: mesActual,
        usuarioId: emp.usuarioId || null
      });

      await Promise.all(tareasAprobadas.map((t: any) =>
        updateDoc(doc(db, "empleado_tareas", t.id), { estadoPago: 'PAGADO', fechaPago: hoyIso, pagadoPor: 'ADMIN' })
      ));

      await updateDoc(doc(db, "empleados", emp.id), {
        ...(sueldo > 0 ? { ultimoPagoMes: mesActual, ultimoPagoIso: hoyIso } : {}),
        comisiones: []
      });

      setPaymentModalOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Error en el pago:", error);
      alert("No se pudo procesar el pago. Verifica tu conexión.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const openTarifas = (emp: any) => {
      setTarifasEmp(emp);
      setIsTarifasOpen(true);
      setNuevaTarifa({ nombre: '', tipo: 'FIJO', valor: '', descripcion: '' });
      setEditTarifaIdx(null);
  };

  const handleSaveTarifa = async () => {
      if (!nuevaTarifa.nombre.trim() || !nuevaTarifa.valor) return;
      const reglas = [...(tarifasEmp.reglasComision || [])];
      const rule: any = {
          id: editTarifaIdx !== null ? reglas[editTarifaIdx].id : Date.now().toString(36),
          nombre: nuevaTarifa.nombre.trim(),
          tipo: nuevaTarifa.tipo,
          valor: parseFloat(nuevaTarifa.valor),
      };
      if (nuevaTarifa.descripcion.trim()) rule.descripcion = nuevaTarifa.descripcion.trim();
      if (editTarifaIdx !== null) reglas[editTarifaIdx] = rule;
      else reglas.push(rule);
      await updateDoc(doc(db, 'empleados', tarifasEmp.id), { reglasComision: reglas });
      setTarifasEmp({ ...tarifasEmp, reglasComision: reglas });
      setNuevaTarifa({ nombre: '', tipo: 'FIJO', valor: '', descripcion: '' });
      setEditTarifaIdx(null);
  };

  const handleDeleteTarifa = async (idx: number) => {
      const reglas = [...(tarifasEmp.reglasComision || [])];
      reglas.splice(idx, 1);
      await updateDoc(doc(db, 'empleados', tarifasEmp.id), { reglasComision: reglas });
      setTarifasEmp({ ...tarifasEmp, reglasComision: reglas });
  };

  const handleSaveEdit = async () => {
      if (!editTarget.nombre.trim() || !editTarget.montoSueldo) {
          alert("El nombre y el sueldo son obligatorios.");
          return;
      }

      // Corrección para el Domingo (0)
      const parsedDia = parseInt(editTarget.diaPago);
      const diaFinal = isNaN(parsedDia) ? (editTarget.frecuenciaPago === 'Semanal' ? 1 : 15) : parsedDia;

      try {
          const { id, ...cleanData } = editTarget;
          await updateDoc(doc(db, "empleados", id), {
              ...cleanData, 
              montoSueldo: parseFloat(editTarget.montoSueldo) || 0,
              diaPago: diaFinal, 
              frecuenciaPago: editTarget.frecuenciaPago || "Mensual",
              usuarioId: editTarget.usuarioId === "none" ? null : editTarget.usuarioId
          });
          setEditTarget(null);
      } catch (error) {
          console.error("Error editando empleado:", error);
          alert("Ocurrió un error al guardar los cambios.");
      }
  };

  const stats = useMemo(() => {
    const mesActual = new Date().toISOString().slice(0, 7);
    let pend = 0;
    empleados.forEach(e => {
      const com = e.comisiones?.reduce((a: any, c: any) => a + c.monto, 0) || 0;
      const taskCom = tareas
        .filter(t => t.empleadoDbId === e.id && t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE')
        .reduce((s: number, t: any) => s + (t.montoComision || 0), 0);
      let sueldo = e.montoSueldo;
      if (e.frecuenciaPago === 'Semanal') {
          if (e.ultimoPagoIso) {
              const diffDays = Math.floor((new Date().getTime() - new Date(e.ultimoPagoIso).getTime()) / 86400000);
              if (diffDays < 6) sueldo = 0;
          }
      } else {
          if (e.ultimoPagoMes === mesActual) sueldo = 0;
      }
      pend += sueldo + com + taskCom;
    });
    const pagado = pagos.filter(p => p.mesRelativo === mesActual).reduce((a, p) => a + p.totalUSD, 0);
    return { pend, pagado };
  }, [empleados, pagos, tareas]);

  const availableMonths = useMemo(() => {
      const months = new Set(pagos.map(p => p.mesRelativo || (p.fecha ? p.fecha.slice(0,7) : '')).filter(Boolean));
      months.add(new Date().toISOString().slice(0, 7)); 
      return Array.from(months).sort().reverse();
  }, [pagos]);

  const pagosFiltrados = useMemo(() => {
      return pagos.filter(p => {
          const mesDelPago = p.mesRelativo || (p.fecha ? p.fecha.slice(0,7) : '');
          const matchEmp = filtroHistorial === 'todos' || p.empleadoId === filtroHistorial;
          const matchMonth = selectedMonthHist === 'todos' || mesDelPago === selectedMonthHist;
          return matchEmp && matchMonth;
      }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pagos, filtroHistorial, selectedMonthHist]);

  // ✨ AQUÍ RESTAURAMOS LA VARIABLE FALTANTE ✨
  const totalFiltradoUSD = useMemo(() => {
      return pagosFiltrados.reduce((sum, p) => sum + (Number(p.totalUSD) || 0), 0);
  }, [pagosFiltrados]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-8 min-h-screen bg-[#F2F2F7] dark:bg-black text-slate-900 font-sans pb-24">

      {/* HEADER DE LA VISTA */}
      <header className="mb-6 sm:mb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6 mb-5 sm:mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white italic uppercase">Personal</h1>
            <p className="text-slate-400 font-bold ml-1 uppercase text-[10px] tracking-widest mt-1">Gestión de Nómina y Accesos</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#1c1c1e] px-4 sm:px-6 py-3 sm:py-4 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5 w-full sm:w-auto">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-blue-600 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-white shadow-lg shadow-blue-500/20 shrink-0"><ArrowRightLeft size={18}/></div>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Tasa Oficial BCV</p>
                  <p className="font-black text-xl sm:text-2xl dark:text-white tracking-tighter">{rates?.usd ? `Bs. ${Number(rates.usd).toFixed(2)}` : "---"}</p>
                </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <StatCard label="Por Pagar" value={`$${stats.pend.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pend, rates.usd) : ""} icon={<Clock/>} color="bg-orange-500" />
          <StatCard label="Liquidado (Mes)" value={`$${stats.pagado.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pagado, rates.usd) : ""} icon={<CheckCircle2/>} color="bg-emerald-500" />
        </div>
      </header>

      {/* MENÚ DE NAVEGACIÓN */}
      <div className="flex bg-white/40 dark:bg-white/5 p-1 sm:p-1.5 rounded-[2rem] sm:rounded-[2.5rem] mb-6 sm:mb-10 border border-black/5 mx-auto sm:mx-0 shadow-sm overflow-x-auto max-w-full custom-scrollbar w-full sm:w-fit">
        <TabBtn active={view === 'control'} onClick={() => setView('control')} label="Nómina Actual" icon={<Users size={15}/>} />
        <TabBtn active={view === 'registro'} onClick={() => setView('registro')} label="Nuevo Ingreso" icon={<Plus size={15}/>} />
        <TabBtn active={view === 'historial'} onClick={() => setView('historial')} label="Historial" icon={<ReceiptText size={15}/>} />
      </div>

      <main>
        <AnimatePresence mode="wait">
          
          {/* ========================================================================= */}
          {/* VISTA 1: CONTROL DE NÓMINA (LISTA DE EMPLEADOS)                           */}
          {/* ========================================================================= */}
          {view === 'control' && (
            <motion.div key="c" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <LayoutGroup>
                {empleados.length > 0 ? (
                    empleados.map(emp => (
                    <EmpleadoCard
                        key={emp.id} emp={emp} rates={rates}
                        tareasEmp={tareas.filter(t => t.empleadoDbId === emp.id)}
                        onPagar={() => preparePayment(emp)}
                        onEdit={() => setEditTarget({...emp, usuarioId: emp.usuarioId || "none"})}
                        onDelete={async () => { if(confirm(`¿Eliminar permanentemente a ${emp.nombre}?`)) await deleteDoc(doc(db, "empleados", emp.id)) }}
                        onAddCom={async (m:any, d:any) => {
                            await updateDoc(doc(db, "empleados", emp.id), { comisiones: [...(emp.comisiones || []), { id: Date.now().toString(), monto: m, desc: d }] });
                        }}
                        onTarifas={() => openTarifas(emp)}
                    />
                    ))
                ) : (
                    <div className="py-24 text-center bg-white dark:bg-[#1c1c1e] rounded-[3rem] border border-black/5 dark:border-white/5 shadow-sm">
                        <Users className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic">Nómina Vacía</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">No hay empleados registrados en el sistema.</p>
                    </div>
                )}
              </LayoutGroup>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* VISTA 2: FORMULARIO DE NUEVO INGRESO                                      */}
          {/* ========================================================================= */}
          {view === 'registro' && (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto bg-white dark:bg-[#1c1c1e] p-5 sm:p-8 md:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] md:rounded-[4rem] shadow-2xl border border-black/5 dark:border-white/5">
              <div className="mb-6 sm:mb-10 text-center sm:text-left">
                  <h2 className="text-3xl sm:text-4xl font-black mb-2 italic uppercase dark:text-white tracking-tighter">Nuevo Ingreso</h2>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Crear perfil de nómina y asignar credenciales.</p>
              </div>

              <div className="space-y-8">
                
                {/* ENLACE DE CUENTA APP */}
                <div className="p-6 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-[2.5rem] space-y-3">
                    <Label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                        <Link2 size={14}/> Vincular con Cuenta de la App
                    </Label>
                    <Select value={form.usuarioId} onValueChange={(v) => setForm({...form, usuarioId: v})}>
                        <SelectTrigger className="rounded-[1.8rem] h-16 bg-white dark:bg-black/40 border-none px-6 font-bold text-sm shadow-sm dark:text-white">
                            <SelectValue placeholder="Seleccionar usuario registrado..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-[2rem] p-2">
                            <SelectItem value="none" className="font-bold text-xs text-slate-400 py-3">No vincular / Solo perfil físico</SelectItem>
                            {usuariosApp.map(u => (
                                <SelectItem key={u.id} value={u.id} className="font-bold text-xs uppercase py-3">
                                    {u.nombre} {u.apellido} <span className="opacity-50 tracking-widest ml-2">({u.rol})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Field label="Nombre Completo del Colaborador" value={form.nombre} onChange={(v: string) => setForm({...form, nombre: v})} placeholder="Ej. Juan Pérez" />
                <Field label="Cargo u Oficio" value={form.cargo} onChange={(v: string) => setForm({...form, cargo: v})} placeholder="Ej. Operador de Láser" />
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Frecuencia de Pago</label>
                    <Select value={form.frecuencia} onValueChange={(v) => {
                        const defaultDay = v === 'Semanal' ? "1" : "15";
                        setForm({...form, frecuencia: v, dia: defaultDay});
                    }}>
                        <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-base shadow-inner dark:text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-[2rem] p-2">
                            {FREQUENCY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-bold uppercase text-xs py-3">{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field label="Sueldo Base Operativo ($)" value={form.sueldo} onChange={(v: string) => setForm({...form, sueldo: v})} type="number" placeholder="0.00" />
                  
                  {/* SELECTOR DE DÍA DINÁMICO */}
                  {form.frecuencia === 'Semanal' ? (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Día de Cobro</label>
                        <Select value={form.dia?.toString()} onValueChange={(v) => setForm({...form, dia: v})}>
                            <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-base shadow-inner dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-[2rem] p-2">
                                {DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={d.value} className="font-bold uppercase text-xs py-3">{d.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                  ) : (
                    <Field label="Día del Mes" value={form.dia} onChange={(v: string) => setForm({...form, dia: v})} type="number" placeholder="Ej. 15" />
                  )}
                </div>

                <Button
                    onClick={handleRegistrar}
                    disabled={isRegistering}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-14 sm:h-20 rounded-[2rem] sm:rounded-[2.5rem] font-black text-base sm:text-lg mt-5 sm:mt-8 shadow-2xl shadow-blue-500/20 text-white uppercase tracking-widest transition-all active:scale-95"
                >
                  {isRegistering ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar Registro"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ========================================================================= */}
          {/* VISTA 3: HISTORIAL DE PAGOS                                               */}
          {/* ========================================================================= */}
          {view === 'historial' && (
            <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                {/* BARRA DE FILTROS SUPERIOR */}
                <div className="flex flex-col gap-3 bg-white dark:bg-[#1c1c1e] p-3 sm:p-4 rounded-[1.75rem] sm:rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        <button onClick={() => setFiltroHistorial('todos')} className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${filtroHistorial === 'todos' ? 'bg-slate-900 dark:bg-white dark:text-black text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'}`}>Todos</button>
                        {empleados.map(e => (
                        <button key={e.id} onClick={() => setFiltroHistorial(e.id)} className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${filtroHistorial === e.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'}`}>
                            {e.nombre.split(" ")[0]}
                        </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 border-t border-black/5 dark:border-white/5 pt-3">
                        <Select value={selectedMonthHist} onValueChange={setSelectedMonthHist}>
                            <SelectTrigger className="flex-1 rounded-xl bg-slate-50 dark:bg-white/5 border-none font-black text-[10px] uppercase tracking-widest h-10 sm:h-12 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="todos" className="font-bold text-[10px] uppercase">Historial Completo</SelectItem>
                                {availableMonths.map(m => (
                                    <SelectItem key={m} value={m} className="font-bold text-[10px] uppercase">{formatearMes(m)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="bg-emerald-500 text-white px-4 sm:px-6 py-2 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-500/20 flex flex-col items-end shrink-0">
                            <span className="text-[8px] uppercase tracking-widest font-black text-emerald-100">Total</span>
                            <span className="font-black text-base sm:text-xl italic leading-none">${totalFiltradoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                {/* LISTA DE RECIBOS */}
                <div className="grid gap-4">
                    {pagosFiltrados.length > 0 ? (
                        pagosFiltrados.map(pago => <Recibo pago={pago} rates={rates} key={pago.id} />)
                    ) : (
                        <div className="py-20 text-center bg-white dark:bg-[#1c1c1e] rounded-[3rem] border border-black/5 shadow-sm">
                            <ReceiptText className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">No se encontraron pagos con estos filtros.</p>
                        </div>
                    )}
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: LIQUIDAR NÓMINA (PAGOS)                                          */}
      {/* ========================================================================= */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2.5rem] p-6 md:p-8 border-none bg-white dark:bg-slate-950 shadow-2xl">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl"><Wallet size={24} /></div>
                    Liquidar Nómina
                </DialogTitle>
            </DialogHeader>

            {selectedEmployee && (() => {
                const mesActual = new Date().toISOString().slice(0, 7);
                const comisiones = selectedEmployee.comisiones?.reduce((a:number,c:any)=>a+c.monto,0) || 0;
                let sBase = selectedEmployee.montoSueldo;

                if (selectedEmployee.frecuenciaPago === 'Semanal') {
                    if (selectedEmployee.ultimoPagoIso) {
                        const diffDays = Math.floor((new Date().getTime() - new Date(selectedEmployee.ultimoPagoIso).getTime()) / 86400000);
                        if (diffDays < 6) sBase = 0;
                    }
                } else {
                    if (selectedEmployee.ultimoPagoMes === mesActual) sBase = 0;
                }

                const tareasModal = tareas.filter(t =>
                    t.empleadoDbId === selectedEmployee.id && t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE'
                );
                const taskCom = tareasModal.reduce((s:number, t:any) => s + (t.montoComision || 0), 0);

                const total = sBase + comisiones + taskCom;

                return (
                    <div className="space-y-6">
                        {/* RESUMEN DE MONTO */}
                        <div className="bg-slate-50 dark:bg-white/5 p-4 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] text-center border border-black/5 dark:border-white/5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto a Transferir</p>
                            <h2 className="text-4xl sm:text-6xl font-black tracking-tighter dark:text-white italic">${total.toFixed(2)}</h2>
                            <p className="text-xs sm:text-sm font-bold text-blue-600 mt-2 uppercase tracking-widest">Equivale a Bs. {(total * (rates?.usd || 0)).toLocaleString('es-VE', {minimumFractionDigits: 2})}</p>
                        </div>

                        <div className={`grid gap-4 ${taskCom > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            <div className="p-4 bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-2xl shadow-sm text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Sueldo Base</span>
                                <span className="text-xl font-black text-slate-800 dark:text-white">${sBase}</span>
                            </div>
                            <div className="p-4 bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-2xl shadow-sm text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block mb-1">Comisiones</span>
                                <span className="text-xl font-black text-emerald-600">${comisiones.toFixed(2)}</span>
                            </div>
                            {taskCom > 0 && (
                                <div className="p-4 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded-2xl shadow-sm text-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-500 block mb-1">Bonos Tareas ({tareasModal.length})</span>
                                    <span className="text-xl font-black text-purple-600">${taskCom.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {tareasModal.length > 0 && (
                            <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 rounded-2xl p-4 space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-purple-500 mb-2">Tareas incluidas en este pago:</p>
                                {tareasModal.map((t: any) => (
                                    <div key={t.id} className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{t.nombreTarea || t.tipoTarea}</span>
                                        <span className="text-purple-600 font-black">${(t.montoComision || 0).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-5 pt-2">
                            {/* SELECTOR DE ÁREA PARA BALANCE FINANCIERO */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Asignar Gasto a Área:</Label>
                                <Select value={paymentConfig.area} onValueChange={(v) => setPaymentConfig({...paymentConfig, area: v})}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 font-bold text-xs shadow-sm dark:text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="IMPRESION" className="font-bold text-xs uppercase py-3">División Impresión</SelectItem>
                                        <SelectItem value="CORTE" className="font-bold text-xs uppercase py-3">División Corte / Láser</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Método de Salida:</Label>
                                <Select value={paymentConfig.metodo} onValueChange={(v) => setPaymentConfig({...paymentConfig, metodo: v})}>
                                    <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 font-bold text-xs shadow-sm dark:text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value} className="font-bold text-xs uppercase py-3">{m.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-2 tracking-widest">Nota Adicional / Referencia:</Label>
                                <Input 
                                    value={paymentConfig.nota} 
                                    onChange={e=>setPaymentConfig({...paymentConfig, nota: e.target.value})} 
                                    placeholder="N° Referencia o detalle..." 
                                    className="h-14 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 font-bold text-sm px-4 dark:text-white" 
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={confirmPayment} 
                            disabled={isProcessingPayment}
                            className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-black uppercase tracking-widest shadow-2xl mt-4"
                        >
                            {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Liquidación"}
                        </Button>
                    </div>
                );
            })()}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: EDITAR PERFIL (CON LÓGICA DINÁMICA CORREGIDA)                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {editTarget && (
          <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
            <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[3rem] shadow-2xl">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-8 md:p-10">
                <DialogHeader className="mb-8">
                    <DialogTitle className="text-3xl font-black italic uppercase dark:text-white tracking-tighter">
                        Editar Perfil
                    </DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ajustes de nómina para {editTarget.nombre}</p>
                </DialogHeader>

                <div className="space-y-6">
                  
                  {/* SELECTOR VINCULACIÓN EN EDICIÓN */}
                  <div className="p-5 bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-[2.5rem] space-y-3">
                      <Label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                          <Link2 size={14}/> Vinculación a la App
                      </Label>
                      <Select value={editTarget.usuarioId || "none"} onValueChange={(v) => setEditTarget({...editTarget, usuarioId: v})}>
                          <SelectTrigger className="rounded-[1.8rem] h-14 bg-white dark:bg-black/40 border-none px-6 font-bold text-sm shadow-sm dark:text-white">
                              <SelectValue placeholder="Seleccionar cuenta..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-[2rem] p-2">
                              <SelectItem value="none" className="font-bold text-xs text-slate-400 py-3">Desvincular (Solo físico)</SelectItem>
                              {usuariosApp.map(u => (
                                  <SelectItem key={u.id} value={u.id} className="font-bold text-xs uppercase py-3">
                                      {u.nombre} {u.apellido}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  <Field label="Nombre Completo" value={editTarget.nombre} onChange={(v: string) => setEditTarget({...editTarget, nombre: v})} />
                  <Field label="Cargo asignado" value={editTarget.cargo} onChange={(v: string) => setEditTarget({...editTarget, cargo: v})} />
                  
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Frecuencia de Pago</label>
                      <Select value={editTarget.frecuenciaPago || "Mensual"} onValueChange={(v) => {
                          const defaultDay = v === 'Semanal' ? "1" : "15";
                          setEditTarget({...editTarget, frecuenciaPago: v, diaPago: defaultDay});
                      }}>
                          <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-base shadow-inner dark:text-white">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[2rem] p-2">
                              {FREQUENCY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-bold text-xs uppercase py-3">{opt.label}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <Field label="Sueldo Base ($)" value={editTarget.montoSueldo} onChange={(v: string) => setEditTarget({...editTarget, montoSueldo: v})} type="number" />
                      
                      {/* ✨ CAMPO DINÁMICO EN EDICIÓN CORREGIDO ✨ */}
                      {editTarget.frecuenciaPago === 'Semanal' ? (
                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Día de Cobro</label>
                              <Select value={editTarget.diaPago?.toString()} onValueChange={(v) => setEditTarget({...editTarget, diaPago: v})}>
                                  <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-base shadow-inner dark:text-white">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-[2rem] p-2">
                                      {DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={d.value} className="font-bold text-xs uppercase py-3">{d.label}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                          </div>
                      ) : (
                          <Field label="Día del Mes" value={editTarget.diaPago} onChange={(v: string) => setEditTarget({...editTarget, diaPago: v})} type="number" />
                      )}
                  </div>

                  <DialogFooter className="pt-6 border-t border-black/5 dark:border-white/5 mt-4 sm:justify-between flex-col sm:flex-row gap-3">
                      <Button variant="ghost" onClick={() => setEditTarget(null)} className="h-14 rounded-2xl font-bold uppercase tracking-widest text-[10px]">
                          Cancelar
                      </Button>
                      <Button 
                          onClick={handleSaveEdit} 
                          className="h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20"
                      >
                          Guardar Cambios
                      </Button>
                  </DialogFooter>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: GESTIONAR TARIFAS DE EMPLEADO                                    */}
      {/* ========================================================================= */}
      <Dialog open={isTarifasOpen} onOpenChange={v => { setIsTarifasOpen(v); if (!v) { setTarifasEmp(null); setEditTarifaIdx(null); setNuevaTarifa({ nombre: '', tipo: 'FIJO', valor: '', descripcion: '' }); } }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[3rem] shadow-2xl">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black italic uppercase dark:text-white tracking-tighter flex items-center gap-3">
                <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 p-2.5 rounded-2xl"><Layers size={18}/></span>
                Tarifas · {tarifasEmp?.nombre}
              </DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define cuánto gana este empleado por cada tipo de trabajo</p>
            </DialogHeader>

            {/* Lista de tarifas actuales */}
            <div className="space-y-2 mb-6">
              {(tarifasEmp?.reglasComision || []).length === 0 && (
                <div className="py-8 text-center text-slate-400 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold uppercase">Sin tarifas registradas</p>
                </div>
              )}
              {(tarifasEmp?.reglasComision || []).map((r: any, idx: number) => (
                <div key={r.id} className="flex items-center justify-between bg-slate-50 dark:bg-white/5 rounded-2xl px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm uppercase dark:text-white truncate">{r.nombre}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                      {r.tipo === 'FIJO' && <span className="text-blue-500">${r.valor} fijo</span>}
                      {r.tipo === 'PORCENTAJE' && <span className="text-emerald-500">{r.valor}% del valor</span>}
                      {r.tipo === 'POR_MINUTO' && <span className="text-orange-500">${r.valor}/minuto</span>}
                      {r.descripcion && <span className="text-slate-400 ml-2">· {r.descripcion}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditTarifaIdx(idx); setNuevaTarifa({ nombre: r.nombre, tipo: r.tipo, valor: String(r.valor), descripcion: r.descripcion || '' }); }}
                      className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-white dark:hover:bg-black/20 transition-colors"><Edit3 size={14}/></button>
                    <button onClick={() => handleDeleteTarifa(idx)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-white dark:hover:bg-black/20 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Formulario para añadir / editar tarifa */}
            <div className="bg-purple-50 dark:bg-purple-500/10 rounded-2xl p-5 space-y-4 border border-purple-100 dark:border-purple-500/20">
              <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-widest">
                {editTarifaIdx !== null ? 'Editando tarifa' : 'Nueva tarifa'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Nombre del trabajo *</Label>
                  <Input placeholder="Ej. Corte láser, Armado llavero..."
                    value={nuevaTarifa.nombre} onChange={e => setNuevaTarifa(p => ({ ...p, nombre: e.target.value }))}
                    className="h-12 rounded-xl bg-white dark:bg-black/20 border-none font-bold" />
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Tipo de cobro</Label>
                  <Select value={nuevaTarifa.tipo} onValueChange={v => setNuevaTarifa(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-black/20 border-none font-bold text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="FIJO" className="font-bold text-xs">Monto fijo ($)</SelectItem>
                      <SelectItem value="POR_MINUTO" className="font-bold text-xs">Por minuto ($)</SelectItem>
                      <SelectItem value="PORCENTAJE" className="font-bold text-xs">Porcentaje (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                    {nuevaTarifa.tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : nuevaTarifa.tipo === 'POR_MINUTO' ? 'Valor por minuto ($)' : 'Monto fijo ($)'}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                      {nuevaTarifa.tipo === 'PORCENTAJE' ? '%' : '$'}
                    </span>
                    <Input type="number" step="0.01" placeholder="0.00"
                      value={nuevaTarifa.valor} onChange={e => setNuevaTarifa(p => ({ ...p, valor: e.target.value }))}
                      className="h-12 pl-7 rounded-xl bg-white dark:bg-black/20 border-none font-black" />
                  </div>
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Descripción (opcional)</Label>
                  <Input placeholder="Ej. Por minuto de corte con máquina láser"
                    value={nuevaTarifa.descripcion} onChange={e => setNuevaTarifa(p => ({ ...p, descripcion: e.target.value }))}
                    className="h-12 rounded-xl bg-white dark:bg-black/20 border-none font-bold" />
                </div>
              </div>

              <div className="flex gap-2">
                {editTarifaIdx !== null && (
                  <Button variant="ghost" onClick={() => { setEditTarifaIdx(null); setNuevaTarifa({ nombre: '', tipo: 'FIJO', valor: '', descripcion: '' }); }}
                    className="h-12 rounded-xl font-bold uppercase text-[10px] text-slate-500">Cancelar</Button>
                )}
                <Button onClick={handleSaveTarifa} disabled={!nuevaTarifa.nombre.trim() || !nuevaTarifa.valor}
                  className="flex-1 h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50">
                  {editTarifaIdx !== null ? 'Guardar Cambios' : '+ Agregar Tarifa'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- SUB-COMPONENTES VISUALES ---

function EmpleadoCard({ emp, rates, onPagar, onEdit, onDelete, onAddCom, onTarifas, tareasEmp = [] }: any) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const esSemanal = emp.frecuenciaPago === 'Semanal';
  const dias = calcularDiasRestantes(emp);

  const tCom = emp.comisiones?.reduce((a:any, c:any) => a + c.monto, 0) || 0;

  const tareasAprobadas = tareasEmp.filter((t:any) => t.estado === 'APROBADA' && t.estadoPago === 'PENDIENTE');
  const tareasPendientes = tareasEmp.filter((t:any) => t.estado === 'PENDIENTE');
  const taskCom = tareasAprobadas.reduce((s:number, t:any) => s + (t.montoComision || 0), 0);

  let sPend = emp.montoSueldo;
  if (esSemanal) {
      if (emp.ultimoPagoIso) {
          const diff = Math.floor((new Date().getTime() - new Date(emp.ultimoPagoIso).getTime()) / 86400000);
          if (diff < 6) sPend = 0;
      }
  } else {
      if (emp.ultimoPagoMes === mesActual) sPend = 0;
  }

  const total = tCom + sPend + taskCom;

  let tCobro = dias === 'Hoy' ? "Toca Pagar Hoy" : (esSemanal ? `Cobro los ${DAYS_OF_WEEK.find(d => d.value === emp.diaPago?.toString())?.label || "Día"}` : `Día ${emp.diaPago} (en ${dias} d)`);

  const [m, setM] = useState("");
  const [d, setD] = useState("");

  return (
    <motion.div layout className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] sm:rounded-[3.5rem] p-4 sm:p-6 md:p-10 shadow-sm border border-black/5 dark:border-white/5 group hover:shadow-2xl hover:shadow-black/5 transition-all duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 sm:gap-8">

        {/* INFO USUARIO */}
        <div className="flex items-center gap-3 sm:gap-5 w-full lg:w-auto">
          <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-blue-600 dark:to-blue-800 text-white rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center font-black text-2xl sm:text-3xl italic shrink-0 shadow-xl group-hover:scale-105 transition-transform">
              {emp.nombre.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-4 mb-1.5 sm:mb-2">
              <h3 className="font-black text-xl sm:text-2xl md:text-3xl tracking-tighter dark:text-white italic uppercase truncate">{emp.nombre}</h3>
              <div className="flex bg-slate-50 dark:bg-white/5 rounded-xl sm:rounded-2xl p-1 border border-black/5 shadow-sm shrink-0">
                <button onClick={onEdit} className="p-1.5 sm:p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-xl hover:bg-white dark:hover:bg-black/20" title="Editar Perfil"><Edit3 size={14}/></button>
                <button onClick={onTarifas} className="p-1.5 sm:p-2 text-slate-400 hover:text-purple-600 transition-colors rounded-xl hover:bg-white dark:hover:bg-black/20" title="Gestionar Tarifas"><Layers size={14}/></button>
                <button onClick={onDelete} className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 transition-colors rounded-xl hover:bg-white dark:hover:bg-black/20" title="Eliminar"><Trash2 size={14}/></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <span className="bg-slate-100 dark:bg-white/5 text-slate-500 text-[9px] font-black px-2.5 py-1 rounded-full uppercase italic border border-black/5 shadow-sm">
                  <Briefcase size={10} className="inline mr-1"/> {emp.cargo}
              </span>
              <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase italic shadow-sm border border-black/5 ${dias === 'Hoy' ? 'bg-red-500 text-white animate-pulse border-none' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  <Calendar size={10} className="inline mr-1"/> {tCobro}
              </span>
              {emp.usuarioId && (
                  <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase italic border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
                      <UserCheck size={10} className="inline mr-1"/> Vinculado
                  </span>
              )}
              {tareasAprobadas.length > 0 && (
                  <span className="bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase italic border border-purple-100 dark:border-purple-500/20 shadow-sm">
                      <CheckCircle2 size={10} className="inline mr-1"/> {tareasAprobadas.length} Bono{tareasAprobadas.length > 1 ? 's' : ''} (${taskCom.toFixed(0)})
                  </span>
              )}
              {tareasPendientes.length > 0 && (
                  <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase italic border border-amber-100 dark:border-amber-500/20 shadow-sm">
                      <Clock size={10} className="inline mr-1"/> {tareasPendientes.length} Pendiente{tareasPendientes.length > 1 ? 's' : ''}
                  </span>
              )}
            </div>
          </div>
        </div>

        {/* BALANCE */}
        <div className="flex-1 w-full lg:max-w-md bg-[#F8F9FB] dark:bg-black/20 rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-6 flex flex-row justify-between items-center border border-black/5 gap-4 text-center shadow-inner">
           <div className="flex-1">
               <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Por Pagar</p>
               <p className="text-3xl sm:text-4xl md:text-5xl font-black dark:text-white italic tracking-tighter">${total.toFixed(2)}</p>
               <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest hidden sm:block">
                 Base: ${emp.montoSueldo}
                 {taskCom > 0 && <span className="text-purple-500 ml-2">+ ${taskCom.toFixed(0)}</span>}
               </p>
           </div>
           <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10" />
           <div className="flex-1">
               <p className="text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Equiv BCV</p>
               <p className="text-base sm:text-xl md:text-2xl font-black text-slate-700 dark:text-slate-300 italic">{rates?.usd ? formatBs(total, rates.usd) : "---"}</p>
           </div>
        </div>

        {/* BOTON PAGAR */}
        <Button
            onClick={onPagar}
            disabled={total === 0}
            className={`h-14 sm:h-20 w-full lg:w-auto px-8 sm:px-10 rounded-[2rem] sm:rounded-[2.5rem] font-black text-base sm:text-xl shadow-2xl uppercase italic transition-all active:scale-95 ${total > 0 ? 'bg-slate-900 dark:bg-blue-600 text-white hover:scale-105' : 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 shadow-none'}`}
        >
            {total > 0 ? "Liquidar" : "Al Día"}
        </Button>
      </div>

      {/* AÑADIR COMISIÓN */}
      <div className="mt-5 sm:mt-8 pt-5 sm:pt-8 border-t border-black/5 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center">
         <div className="relative w-full sm:w-40">
            <Input placeholder="0.00" type="number" value={m} onChange={e=>setM(e.target.value)} className="rounded-2xl h-12 sm:h-14 bg-slate-50 dark:bg-black/20 border-none pl-10 sm:pl-12 font-black text-base sm:text-lg shadow-inner dark:text-white" />
            <DollarSign className="absolute left-3 sm:left-4 top-3 sm:top-4 text-blue-600" size={18}/>
         </div>
         <Input placeholder="Concepto de comisión, bono o adelanto..." value={d} onChange={e=>setD(e.target.value)} className="rounded-2xl h-12 sm:h-14 bg-slate-50 dark:bg-black/20 border-none px-4 sm:px-6 font-bold flex-1 shadow-inner italic dark:text-white" />
         <Button onClick={()=>{if(m)onAddCom(parseFloat(m),d);setM("");setD("");}} variant="ghost" className="w-full sm:w-auto h-12 sm:h-14 rounded-2xl text-blue-600 bg-blue-50 dark:bg-blue-500/10 font-black hover:bg-blue-100 dark:hover:bg-blue-500/20 px-6 sm:px-8 transition-colors uppercase text-[10px] tracking-widest">
            + Sumar
         </Button>
      </div>
    </motion.div>
  );
}

function Recibo({ pago, rates }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-6 md:p-8 shadow-sm border border-black/5 dark:border-white/5 flex flex-col gap-4 group hover:shadow-md transition-shadow">
       <div className="flex gap-3 sm:gap-4 items-center">
          <div className="bg-emerald-100 dark:bg-emerald-500/20 p-3 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-inner shrink-0">
              <Wallet size={20}/>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-base sm:text-xl md:text-2xl font-black dark:text-white italic uppercase truncate tracking-tight leading-none">{pago.nombre}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {new Date(pago.fecha).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-[1.5rem] shadow-xl text-right shrink-0">
            <p className="text-[8px] font-black opacity-60 uppercase tracking-widest">Total</p>
            <p className="text-xl sm:text-2xl font-black italic tracking-tighter">${Number(pago.totalUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
       </div>

       <div className="bg-slate-50 dark:bg-black/20 rounded-[1.5rem] sm:rounded-[2rem] px-4 sm:px-6 py-4 space-y-2 border border-black/5">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-2 mb-2">
             <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                {pago.areaAsignada || "General"}
             </span>
             <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[120px] sm:max-w-[200px] italic">{pago.notaAdicional}</span>
          </div>

          <div className="space-y-1.5">
              {pago.conceptos?.map((c:any, i:number) => (
                 <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-slate-400 truncate mr-2">{c.tipo}: <span className="text-slate-600 dark:text-slate-300">{c.motivo}</span></span>
                    <span className="dark:text-white font-black shrink-0">${Number(c.monto).toFixed(2)}</span>
                 </div>
              ))}
          </div>
          <p className="text-[9px] font-bold text-slate-300 uppercase text-right pt-1">Vía {pago.metodoPago}</p>
       </div>
    </motion.div>
  );
}

function StatCard({ label, value, sub, icon, color }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-[#1c1c1e] p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-sm border border-black/5 dark:border-white/5 flex flex-col gap-3 sm:gap-5 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
      <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:scale-150 transition-transform text-slate-900 dark:text-white duration-700">{icon}</div>
      <div className={`${color} w-10 h-10 sm:w-14 sm:h-14 rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center text-white shadow-xl group-hover:rotate-12 transition-transform`}>{icon}</div>
      <div>
        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 sm:mb-2">{label}</p>
        <p className="text-2xl sm:text-4xl font-black dark:text-white leading-none tracking-tighter italic">{value}</p>
        {sub && <p className="text-xs sm:text-sm font-bold text-blue-600 mt-2 sm:mt-3 uppercase italic tracking-widest">{sub}</p>}
      </div>
    </motion.div>
  );
}

function TabBtn({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 sm:px-7 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2rem] text-[10px] sm:text-[11px] font-black transition-all duration-500 uppercase tracking-widest whitespace-nowrap ${active ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md scale-105 italic border border-black/5' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
      {icon} <span>{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-4 sm:ml-6 tracking-widest">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-[1.5rem] sm:rounded-[1.8rem] h-13 sm:h-16 bg-slate-50 dark:bg-white/5 border-none px-5 sm:px-8 font-black text-base shadow-inner italic dark:text-white placeholder:text-slate-300 transition-all focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );
}