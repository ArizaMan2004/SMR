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
}

export function EmpleadosView({ empleados, pagos, rates }: EmpleadosViewProps) {
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
    const totalUSD = sueldo + tCom;

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
          ...(emp.comisiones?.map((c: any) => ({ tipo: 'Comisión', monto: c.monto, motivo: c.desc })) || [])
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
      let sueldo = e.montoSueldo;
      if (e.frecuenciaPago === 'Semanal') {
          if (e.ultimoPagoIso) {
              const diffDays = Math.floor((new Date().getTime() - new Date(e.ultimoPagoIso).getTime()) / 86400000);
              if (diffDays < 6) sueldo = 0;
          }
      } else {
          if (e.ultimoPagoMes === mesActual) sueldo = 0;
      }
      pend += sueldo + com;
    });
    const pagado = pagos.filter(p => p.mesRelativo === mesActual).reduce((a, p) => a + p.totalUSD, 0);
    return { pend, pagado };
  }, [empleados, pagos]);

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
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen bg-[#F2F2F7] dark:bg-black text-slate-900 font-sans pb-24">
      
      {/* HEADER DE LA VISTA */}
      <header className="mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white italic uppercase">Personal</h1>
            <p className="text-slate-400 font-bold ml-1 uppercase text-[10px] tracking-widest mt-1">Gestión de Nómina y Accesos</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#1c1c1e] px-6 py-4 rounded-[2.5rem] shadow-sm border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20"><ArrowRightLeft size={20}/></div>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Tasa Oficial BCV</p>
                  <p className="font-black text-2xl dark:text-white tracking-tighter">{rates?.usd ? `Bs. ${Number(rates.usd).toFixed(2)}` : "---"}</p>
                </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard label="Por Pagar (Total Nómina)" value={`$${stats.pend.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pend, rates.usd) : ""} icon={<Clock/>} color="bg-orange-500" />
          <StatCard label="Liquidado (Este Mes)" value={`$${stats.pagado.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pagado, rates.usd) : ""} icon={<CheckCircle2/>} color="bg-emerald-500" />
        </div>
      </header>

      {/* MENÚ DE NAVEGACIÓN */}
      <div className="flex bg-white/40 dark:bg-white/5 p-1.5 rounded-[2.5rem] mb-10 w-fit border border-black/5 mx-auto md:mx-0 shadow-sm overflow-x-auto max-w-full custom-scrollbar">
        <TabBtn active={view === 'control'} onClick={() => setView('control')} label="Nómina Actual" icon={<Users size={16}/>} />
        <TabBtn active={view === 'registro'} onClick={() => setView('registro')} label="Nuevo Ingreso" icon={<Plus size={16}/>} />
        <TabBtn active={view === 'historial'} onClick={() => setView('historial')} label="Historial de Pagos" icon={<ReceiptText size={16}/>} />
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
                        onPagar={() => preparePayment(emp)} 
                        onEdit={() => setEditTarget({...emp, usuarioId: emp.usuarioId || "none"})}
                        onDelete={async () => { if(confirm(`¿Eliminar permanentemente a ${emp.nombre}?`)) await deleteDoc(doc(db, "empleados", emp.id)) }}
                        onAddCom={async (m:any, d:any) => {
                            await updateDoc(doc(db, "empleados", emp.id), { comisiones: [...(emp.comisiones || []), { id: Date.now().toString(), monto: m, desc: d }] });
                        }}
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
            <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto bg-white dark:bg-[#1c1c1e] p-8 md:p-12 rounded-[4rem] shadow-2xl border border-black/5 dark:border-white/5">
              <div className="mb-10 text-center md:text-left">
                  <h2 className="text-4xl font-black mb-2 italic uppercase dark:text-white tracking-tighter">Nuevo Ingreso</h2>
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
                    className="w-full bg-blue-600 hover:bg-blue-700 h-20 rounded-[2.5rem] font-black text-lg mt-8 shadow-2xl shadow-blue-500/20 text-white uppercase tracking-widest transition-all active:scale-95"
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#1c1c1e] p-4 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto custom-scrollbar">
                        <button onClick={() => setFiltroHistorial('todos')} className={`px-6 py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${filtroHistorial === 'todos' ? 'bg-slate-900 dark:bg-white dark:text-black text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'}`}>Todos</button>
                        {empleados.map(e => (
                        <button key={e.id} onClick={() => setFiltroHistorial(e.id)} className={`px-6 py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${filtroHistorial === e.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'}`}>
                            {e.nombre.split(" ")[0]}
                        </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-black/5 dark:border-white/5 pt-4 md:pt-0 md:pl-4">
                        <Select value={selectedMonthHist} onValueChange={setSelectedMonthHist}>
                            <SelectTrigger className="w-[180px] rounded-xl bg-slate-50 dark:bg-white/5 border-none font-black text-[10px] uppercase tracking-widest h-12 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="todos" className="font-bold text-[10px] uppercase">Historial Completo</SelectItem>
                                {availableMonths.map(m => (
                                    <SelectItem key={m} value={m} className="font-bold text-[10px] uppercase">{formatearMes(m)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="bg-emerald-500 text-white px-6 py-2 rounded-2xl shadow-lg shadow-emerald-500/20 flex flex-col items-end min-w-[120px]">
                            <span className="text-[8px] uppercase tracking-widest font-black text-emerald-100">Total Filtro</span>
                            <span className="font-black text-xl italic leading-none">${totalFiltradoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
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
                
                const total = sBase + comisiones;

                return (
                    <div className="space-y-6">
                        {/* RESUMEN DE MONTO */}
                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] text-center border border-black/5 dark:border-white/5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto a Transferir</p>
                            <h2 className="text-6xl font-black tracking-tighter dark:text-white italic">${total}</h2>
                            <p className="text-sm font-bold text-blue-600 mt-2 uppercase tracking-widest">Equivale a Bs. {(total * rates?.usd).toLocaleString('es-VE', {minimumFractionDigits: 2})}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-2xl shadow-sm text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Sueldo Base</span>
                                <span className="text-xl font-black text-slate-800 dark:text-white">${sBase}</span>
                            </div>
                            <div className="p-4 bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-2xl shadow-sm text-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block mb-1">Comisiones</span>
                                <span className="text-xl font-black text-emerald-600">${comisiones}</span>
                            </div>
                        </div>

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
    </div>
  );
}

// --- SUB-COMPONENTES VISUALES ---

function EmpleadoCard({ emp, rates, onPagar, onEdit, onDelete, onAddCom }: any) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const esSemanal = emp.frecuenciaPago === 'Semanal';
  const dias = calcularDiasRestantes(emp);
  
  const tCom = emp.comisiones?.reduce((a:any, c:any) => a + c.monto, 0) || 0;
  
  let sPend = emp.montoSueldo;
  if (esSemanal) { 
      if (emp.ultimoPagoIso) { 
          const diff = Math.floor((new Date().getTime() - new Date(emp.ultimoPagoIso).getTime()) / 86400000); 
          if (diff < 6) sPend = 0; 
      }
  } else { 
      if (emp.ultimoPagoMes === mesActual) sPend = 0; 
  }
  
  const total = tCom + sPend;
  
  let tCobro = dias === 'Hoy' ? "Toca Pagar Hoy" : (esSemanal ? `Cobro los ${DAYS_OF_WEEK.find(d => d.value === emp.diaPago?.toString())?.label || "Día"}` : `Día ${emp.diaPago} (en ${dias} d)`);

  const [m, setM] = useState("");
  const [d, setD] = useState("");

  return (
    <motion.div layout className="bg-white dark:bg-[#1c1c1e] rounded-[3.5rem] p-6 md:p-10 shadow-sm border border-black/5 dark:border-white/5 group hover:shadow-2xl hover:shadow-black/5 transition-all duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        
        {/* INFO USUARIO */}
        <div className="flex items-center gap-5 w-full lg:w-auto">
          <div className="h-20 w-20 md:h-24 md:w-24 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-blue-600 dark:to-blue-800 text-white rounded-[2.5rem] flex items-center justify-center font-black text-3xl italic shrink-0 shadow-xl group-hover:scale-105 transition-transform">
              {emp.nombre.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-black text-2xl md:text-3xl tracking-tighter dark:text-white italic uppercase truncate">{emp.nombre}</h3>
              <div className="flex bg-slate-50 dark:bg-white/5 rounded-2xl p-1 border border-black/5 shadow-sm shrink-0">
                <button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-xl hover:bg-white dark:hover:bg-black/20" title="Editar Perfil"><Edit3 size={16}/></button>
                <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-xl hover:bg-white dark:hover:bg-black/20" title="Eliminar"><Trash2 size={16}/></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="bg-slate-100 dark:bg-white/5 text-slate-500 text-[9px] md:text-[10px] font-black px-3 py-1.5 rounded-full uppercase italic border border-black/5 shadow-sm">
                  <Briefcase size={12} className="inline mr-1"/> {emp.cargo}
              </span>
              <span className={`text-[9px] md:text-[10px] font-black px-3 py-1.5 rounded-full uppercase italic shadow-sm border border-black/5 ${dias === 'Hoy' ? 'bg-red-500 text-white animate-pulse border-none' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                  <Calendar size={12} className="inline mr-1"/> {tCobro}
              </span>
              {emp.usuarioId && (
                  <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] md:text-[10px] font-black px-3 py-1.5 rounded-full uppercase italic border border-emerald-100 dark:border-emerald-500/20 shadow-sm" title="El usuario puede ver sus recibos en su cuenta.">
                      <UserCheck size={12} className="inline mr-1"/> Vinculado
                  </span>
              )}
            </div>
          </div>
        </div>

        {/* BALANCE */}
        <div className="flex-1 w-full lg:max-w-md bg-[#F8F9FB] dark:bg-black/20 rounded-[3rem] p-6 flex flex-col md:flex-row justify-between items-center border border-black/5 gap-6 text-center shadow-inner">
           <div className="flex-1">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Por Pagar</p>
               <p className="text-4xl md:text-5xl font-black dark:text-white italic tracking-tighter">${total.toLocaleString()}</p>
               <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Base: ${emp.montoSueldo}</p>
           </div>
           <div className="h-12 w-[1px] bg-slate-200 dark:bg-white/10 hidden md:block" />
           <div className="flex-1">
               <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Equiv BCV</p>
               <p className="text-xl md:text-2xl font-black text-slate-700 dark:text-slate-300 italic">{rates?.usd ? formatBs(total, rates.usd) : "---"}</p>
           </div>
        </div>

        {/* BOTON PAGAR */}
        <Button 
            onClick={onPagar} 
            disabled={total === 0} 
            className={`h-20 w-full lg:w-auto px-10 rounded-[2.5rem] font-black text-lg md:text-xl shadow-2xl uppercase italic transition-all active:scale-95 ${total > 0 ? 'bg-slate-900 dark:bg-blue-600 text-white hover:scale-105' : 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 shadow-none'}`}
        >
            {total > 0 ? "Liquidar" : "Al Día"}
        </Button>
      </div>

      {/* AÑADIR COMISIÓN */}
      <div className="mt-8 pt-8 border-t border-black/5 flex flex-col md:flex-row gap-4 items-center">
         <div className="relative w-full md:w-48">
            <Input placeholder="0.00" type="number" value={m} onChange={e=>setM(e.target.value)} className="rounded-2xl h-14 bg-slate-50 dark:bg-black/20 border-none pl-12 font-black text-lg shadow-inner dark:text-white" />
            <DollarSign className="absolute left-4 top-4 text-blue-600" size={20}/>
         </div>
         <Input placeholder="Concepto de comisión, bono especial, o adelanto..." value={d} onChange={e=>setD(e.target.value)} className="rounded-2xl h-14 bg-slate-50 dark:bg-black/20 border-none px-6 font-bold flex-1 shadow-inner italic dark:text-white" />
         <Button onClick={()=>{if(m)onAddCom(parseFloat(m),d);setM("");setD("");}} variant="ghost" className="w-full md:w-auto h-14 rounded-2xl text-blue-600 bg-blue-50 dark:bg-blue-500/10 font-black hover:bg-blue-100 dark:hover:bg-blue-500/20 px-8 transition-colors uppercase text-[10px] tracking-widest">
            + Sumar a Nómina
         </Button>
      </div>
    </motion.div>
  );
}

function Recibo({ pago, rates }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-[#1c1c1e] rounded-[3rem] p-6 md:p-8 shadow-sm border border-black/5 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 group hover:shadow-md transition-shadow">
       <div className="flex gap-4 items-center w-full md:w-auto">
          <div className="bg-emerald-100 dark:bg-emerald-500/20 p-5 rounded-[2rem] text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-inner shrink-0">
              <Wallet size={24}/>
          </div>
          <div className="min-w-0">
            <h4 className="text-xl md:text-2xl font-black dark:text-white italic uppercase truncate tracking-tight leading-none">{pago.nombre}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                {new Date(pago.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
       </div>

       <div className="bg-slate-50 dark:bg-black/20 rounded-[2.5rem] px-6 py-5 md:px-10 flex-1 w-full space-y-3 shadow-inner border border-black/5">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-3 mb-3">
             <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-md">
                Área: {pago.areaAsignada || "General"}
             </span>
             <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[150px] italic">{pago.notaAdicional}</span>
          </div>
          
          <div className="space-y-2">
              {pago.conceptos?.map((c:any, i:number) => (
                 <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase italic">
                    <span className="text-slate-400">{c.tipo}: <span className="text-slate-600 dark:text-slate-300 ml-2">{c.motivo}</span></span>
                    <span className="dark:text-white text-base font-black">${Number(c.monto).toFixed(2)}</span>
                 </div>
              ))}
          </div>
       </div>

       <div className="text-center md:text-right min-w-[180px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-[2rem] shadow-xl">
          <p className="text-[9px] font-black opacity-60 uppercase mb-1 tracking-widest">Liquidado Total</p>
          <p className="text-3xl md:text-4xl font-black italic tracking-tighter">${Number(pago.totalUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] font-black uppercase italic mt-1 opacity-80 text-center">Bs. {Number(pago.totalVES).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
          <p className="text-[8px] font-bold uppercase mt-2 opacity-50">Vía {pago.metodoPago}</p>
       </div>
    </motion.div>
  );
}

function StatCard({ label, value, sub, icon, color }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-[#1c1c1e] p-8 rounded-[3rem] shadow-sm border border-black/5 dark:border-white/5 flex flex-col gap-5 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
      <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:scale-150 transition-transform text-slate-900 dark:text-white duration-700">{icon}</div>
      <div className={`${color} w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl group-hover:rotate-12 transition-transform`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{label}</p>
        <p className="text-4xl font-black dark:text-white leading-none tracking-tighter italic">{value}</p>
        {sub && <p className="text-sm font-bold text-blue-600 mt-3 uppercase italic tracking-widest">{sub}</p>}
      </div>
    </motion.div>
  );
}

function TabBtn({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[11px] font-black transition-all duration-500 uppercase tracking-widest ${active ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md scale-105 italic border border-black/5' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">{label}</label>
      <Input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
        className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-base shadow-inner italic dark:text-white placeholder:text-slate-300 transition-all focus:ring-2 focus:ring-blue-500/20" 
      />
    </div>
  );
}