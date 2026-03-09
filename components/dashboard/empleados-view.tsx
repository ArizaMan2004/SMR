// @/components/dashboard/empleados-view.tsx
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Users, CheckCircle2, Clock, TrendingUp, Plus, DollarSign, 
  Calendar, ArrowRightLeft, Trash2, Edit3, X, Briefcase, 
  Wallet, ReceiptText, Search, Filter, AlertCircle, ChevronRight,
  CreditCard, Banknote, Repeat, Link2, UserCheck, Layers
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
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  const [paymentConfig, setPaymentConfig] = useState({
      metodo: "Efectivo USD",
      intervalo: "1ra Quincena",
      area: "IMPRESION",
      nota: ""
  });

  const [form, setForm] = useState({ 
      nombre: "", 
      cargo: "", 
      sueldo: "", 
      dia: "15", 
      frecuencia: "Mensual",
      usuarioId: "none" 
  });

  useEffect(() => {
      const unsub = onSnapshot(collection(db, "usuarios"), (snap) => {
          setUsuariosApp(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
  }, []);

  const handleRegistrar = async () => {
    if (!form.nombre || !form.sueldo) return alert("Nombre y sueldo son obligatorios");
    try {
      await addDoc(collection(db, "empleados"), {
        nombre: form.nombre,
        cargo: form.cargo || "Empleado",
        montoSueldo: parseFloat(form.sueldo),
        diaPago: parseInt(form.dia),
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
      console.error("Error al registrar:", error);
    }
  };

  const preparePayment = (emp: any) => {
      setSelectedEmployee(emp);
      let defaultInterval = "Mes Completo";
      if (emp.frecuenciaPago === "Quincenal") defaultInterval = "1ra Quincena";
      if (emp.frecuenciaPago === "Semanal") defaultInterval = "Semana";

      const cargo = (emp.cargo || "").toUpperCase();
      let areaSugerida = "IMPRESION";
      if (cargo.includes("LASER") || cargo.includes("CORTE") || cargo.includes("PRODUCCION")) {
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
        alert("No hay montos pendientes.");
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
        areaAsignada: paymentConfig.area, // <--- CAMBIO CLAVE PARA BALANCE
        notaAdicional: paymentConfig.nota,
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

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen bg-[#F2F2F7] dark:bg-black text-slate-900 font-sans pb-24">
      <header className="mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-6xl font-black tracking-tighter text-slate-900 dark:text-white italic uppercase">Personal</h1>
            <p className="text-slate-400 font-bold ml-1 uppercase text-[10px] tracking-widest">Gestión de nómina global</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#1c1c1e] px-8 py-4 rounded-[2.5rem] shadow-xl border border-black/5 dark:border-white/5">
            <div className="flex items-center gap-5">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg"><ArrowRightLeft size={20}/></div>
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Tasa BCV</p>
                  <p className="font-black text-2xl dark:text-white">{rates?.usd ? `Bs. ${Number(rates.usd).toFixed(2)}` : "---"}</p>
                </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard label="Por Pagar" value={`$${stats.pend.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pend, rates.usd) : ""} icon={<Clock/>} color="bg-orange-500" />
          <StatCard label="Pagado (Mes)" value={`$${stats.pagado.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pagado, rates.usd) : ""} icon={<CheckCircle2/>} color="bg-emerald-500" />
        </div>
      </header>

      <div className="flex bg-white/40 dark:bg-white/5 p-1.5 rounded-[2.5rem] mb-10 w-fit border border-black/5 mx-auto md:mx-0 shadow-sm">
        <TabBtn active={view === 'control'} onClick={() => setView('control')} label="Nómina" icon={<Users size={18}/>} />
        <TabBtn active={view === 'registro'} onClick={() => setView('registro')} label="Nuevo" icon={<Plus size={18}/>} />
        <TabBtn active={view === 'historial'} onClick={() => setView('historial')} label="Historial" icon={<ReceiptText size={18}/>} />
      </div>

      <main>
        <AnimatePresence mode="wait">
          {view === 'control' && (
            <motion.div key="c" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <LayoutGroup>
                {empleados.map(emp => (
                  <EmpleadoCard 
                    key={emp.id} emp={emp} rates={rates} 
                    onPagar={() => preparePayment(emp)} 
                    onEdit={() => setEditTarget({...emp, usuarioId: emp.usuarioId || "none"})}
                    onDelete={async () => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, "empleados", emp.id)) }}
                    onAddCom={async (m:any, d:any) => {
                      await updateDoc(doc(db, "empleados", emp.id), { comisiones: [...(emp.comisiones || []), { id: Date.now().toString(), monto: m, desc: d }] });
                    }}
                  />
                ))}
              </LayoutGroup>
            </motion.div>
          )}

          {view === 'registro' && (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto bg-white dark:bg-[#1c1c1e] p-8 md:p-12 rounded-[4rem] shadow-2xl border border-black/5 dark:border-white/5">
              <h2 className="text-4xl font-black mb-8 italic uppercase dark:text-white">Nuevo Ingreso</h2>
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 rounded-[2rem] space-y-3">
                    <Label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-2 flex items-center gap-1"><Link2 size={12}/> Vincular Cuenta App</Label>
                    <Select value={form.usuarioId} onValueChange={(v) => setForm({...form, usuarioId: v})}>
                        <SelectTrigger className="rounded-[1.5rem] h-14 bg-white dark:bg-black/20 border-none px-6 font-bold">
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            <SelectItem value="none" className="font-bold text-xs">Ninguna / Registro Físico</SelectItem>
                            {usuariosApp.map(u => <SelectItem key={u.id} value={u.id} className="font-bold text-xs uppercase">{u.nombre} {u.apellido}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <Field label="Nombre Completo" value={form.nombre} onChange={(v: string) => setForm({...form, nombre: v})} />
                <Field label="Cargo" value={form.cargo} onChange={(v: string) => setForm({...form, cargo: v})} />
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Frecuencia de Pago</label>
                    <Select value={form.frecuencia} onValueChange={(v) => {
                        const defaultDay = v === 'Semanal' ? "1" : "15";
                        setForm({...form, frecuencia: v, dia: defaultDay});
                    }}>
                        <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-lg shadow-inner">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            {FREQUENCY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-bold uppercase text-xs">{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Sueldo Base ($)" value={form.sueldo} onChange={(v: string) => setForm({...form, sueldo: v})} type="number" />
                  
                  {form.frecuencia === 'Semanal' ? (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Día de Cobro</label>
                        <Select value={form.dia} onValueChange={(v) => setForm({...form, dia: v})}>
                            <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-lg shadow-inner">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                {DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={d.value} className="font-bold uppercase text-xs">{d.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                  ) : (
                    <Field label="Día del Mes" value={form.dia} onChange={(v: string) => setForm({...form, dia: v})} type="number" placeholder="Ej. 15" />
                  )}
                </div>

                <Button onClick={handleRegistrar} className="w-full bg-blue-600 hover:bg-blue-700 h-20 rounded-[2.5rem] font-black text-xl mt-6 shadow-2xl text-white">Registrar Trabajador</Button>
              </div>
            </motion.div>
          )}

          {view === 'historial' && (
            <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid gap-4">
                    {pagosFiltrados.map(pago => <Recibo pago={pago} rates={rates} key={pago.id} />)}
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- MODAL PAGO CON ASIGNACIÓN DE ÁREA --- */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none bg-white dark:bg-slate-950 shadow-2xl">
            <DialogHeader><DialogTitle className="text-2xl font-black uppercase italic italic flex items-center gap-3"><Wallet className="text-blue-600" /> Liquidar Nómina</DialogTitle></DialogHeader>
            {selectedEmployee && (() => {
                const mesActual = new Date().toISOString().slice(0, 7);
                const comisiones = selectedEmployee.comisiones?.reduce((a:number,c:any)=>a+c.monto,0) || 0;
                let sBase = selectedEmployee.montoSueldo;
                if (selectedEmployee.frecuenciaPago === 'Semanal') {
                    if (selectedEmployee.ultimoPagoIso) {
                        const diffDays = Math.floor((new Date().getTime() - new Date(selectedEmployee.ultimoPagoIso).getTime()) / 86400000);
                        if (diffDays < 6) sBase = 0;
                    }
                } else { if (selectedEmployee.ultimoPagoMes === mesActual) sBase = 0; }
                const total = sBase + comisiones;

                return (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] text-center border border-black/5">
                            <h2 className="text-5xl font-black tracking-tighter dark:text-white">${total}</h2>
                            <p className="text-sm font-bold text-blue-600">Bs. {(total * rates?.usd).toLocaleString()}</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Asignar a Área:</Label>
                                <Select value={paymentConfig.area} onValueChange={(v) => setPaymentConfig({...paymentConfig, area: v})}>
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-none font-bold text-xs shadow-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="IMPRESION" className="font-bold text-xs">IMPRESIÓN</SelectItem>
                                        <SelectItem value="CORTE" className="font-bold text-xs">CORTE / LÁSER</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Método de Pago:</Label>
                                <Select value={paymentConfig.metodo} onValueChange={(v) => setPaymentConfig({...paymentConfig, metodo: v})}>
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-none font-bold text-xs shadow-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl">{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value} className="font-bold text-xs">{m.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nota Adicional:</Label>
                                <Input value={paymentConfig.nota} onChange={e=>setPaymentConfig({...paymentConfig, nota: e.target.value})} placeholder="Detalles..." className="h-12 rounded-2xl bg-slate-100 dark:bg-white/5 border-none font-bold text-xs" />
                            </div>
                        </div>
                        <Button onClick={confirmPayment} className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest shadow-xl">Confirmar Egreso</Button>
                    </div>
                );
            })()}
        </DialogContent>
      </Dialog>

      {/* --- MODAL EDICIÓN CORREGIDO Y DINÁMICO --- */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white dark:bg-[#1c1c1e] w-full max-w-md rounded-[3.5rem] p-8 md:p-12 shadow-2xl relative border border-white/5">
              <button onClick={() => setEditTarget(null)} className="absolute right-8 top-8 bg-slate-100 dark:bg-white/10 p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={20}/></button>
              <h2 className="text-3xl font-black mb-8 italic uppercase dark:text-white">Editar Perfil</h2>
              <div className="space-y-5">
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 rounded-3xl space-y-2">
                    <Label className="text-[10px] font-black text-blue-600 uppercase ml-2 flex items-center gap-1"><Link2 size={12}/> Vincular App</Label>
                    <Select value={editTarget.usuarioId || "none"} onValueChange={(v) => setEditTarget({...editTarget, usuarioId: v})}>
                        <SelectTrigger className="rounded-2xl h-12 bg-white dark:bg-black/20 border-none px-4 font-bold text-xs shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            <SelectItem value="none" className="font-bold text-xs">Desvincular</SelectItem>
                            {usuariosApp.map(u => <SelectItem key={u.id} value={u.id} className="font-bold text-xs uppercase">{u.nombre} {u.apellido}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <Field label="Nombre" value={editTarget.nombre} onChange={(v: string) => setEditTarget({...editTarget, nombre: v})} />
                <Field label="Cargo" value={editTarget.cargo} onChange={(v: string) => setEditTarget({...editTarget, cargo: v})} />
                
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Frecuencia</label>
                    <Select value={editTarget.frecuenciaPago || "Mensual"} onValueChange={(v) => {
                        const defaultDay = v === 'Semanal' ? "1" : "15";
                        setEditTarget({...editTarget, frecuenciaPago: v, diaPago: defaultDay});
                    }}>
                        <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-lg shadow-inner"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            {FREQUENCY_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-bold text-xs uppercase">{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Sueldo" value={editTarget.montoSueldo} onChange={(v: string) => setEditTarget({...editTarget, montoSueldo: v})} type="number" />
                    
                    {/* ✨ CAMPO DINÁMICO EN EDICIÓN ✨ */}
                    {editTarget.frecuenciaPago === 'Semanal' ? (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-6 tracking-widest">Día Cobro</label>
                            <Select value={editTarget.diaPago?.toString()} onValueChange={(v) => setEditTarget({...editTarget, diaPago: v})}>
                                <SelectTrigger className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-lg shadow-inner"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    {DAYS_OF_WEEK.map(d => <SelectItem key={d.value} value={d.value} className="font-bold text-xs uppercase">{d.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <Field label="Día Mes" value={editTarget.diaPago} onChange={(v: string) => setEditTarget({...editTarget, diaPago: v})} type="number" />
                    )}
                </div>
                <Button onClick={async () => {
                    const { id, ...cleanData } = editTarget;
                    await updateDoc(doc(db, "empleados", id), {
                      ...cleanData, montoSueldo: parseFloat(editTarget.montoSueldo), diaPago: parseInt(editTarget.diaPago), 
                      usuarioId: editTarget.usuarioId === "none" ? null : editTarget.usuarioId
                    });
                    setEditTarget(null);
                  }} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-16 rounded-[2rem] font-black mt-4 shadow-xl active:scale-95 transition-transform">Guardar Cambios</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-componentes visuales
function EmpleadoCard({ emp, rates, onPagar, onEdit, onDelete, onAddCom }: any) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const esSemanal = emp.frecuenciaPago === 'Semanal';
  const dias = calcularDiasRestantes(emp);
  const tCom = emp.comisiones?.reduce((a:any, c:any) => a + c.monto, 0) || 0;
  let sPend = emp.montoSueldo;
  if (esSemanal) { if (emp.ultimoPagoIso) { const diff = Math.floor((new Date().getTime() - new Date(emp.ultimoPagoIso).getTime()) / 86400000); if (diff < 6) sPend = 0; }
  } else { if (emp.ultimoPagoMes === mesActual) sPend = 0; }
  const total = tCom + sPend;
  let tCobro = dias === 'Hoy' ? "Toca Pagar Hoy" : (esSemanal ? `Cobro los ${DAYS_OF_WEEK.find(d => d.value === emp.diaPago?.toString())?.label || "Día"}` : `Día ${emp.diaPago} (en ${dias} d)`);

  const [m, setM] = useState("");
  const [d, setD] = useState("");

  return (
    <motion.div layout className="bg-white dark:bg-[#1c1c1e] rounded-[3.5rem] p-8 md:p-10 shadow-sm border border-black/5 dark:border-white/5 group hover:shadow-2xl transition-all duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="h-24 w-24 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-blue-600 text-white rounded-[2.5rem] flex items-center justify-center font-black text-3xl italic shrink-0 shadow-lg">{emp.nombre.charAt(0)}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <h3 className="font-black text-2xl tracking-tighter dark:text-white italic uppercase truncate leading-tight">{emp.nombre}</h3>
              <div className="flex bg-slate-50 dark:bg-white/5 rounded-full p-1 border border-black/5 shrink-0">
                <button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="bg-slate-100 dark:bg-white/5 text-slate-500 text-[10px] font-black px-3 py-1.5 rounded-full uppercase italic border border-black/5 shadow-sm"><Briefcase size={12} className="inline mr-1"/> {emp.cargo}</span>
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase italic shadow-sm border border-black/5 ${dias === 'Hoy' ? 'bg-red-500 text-white animate-pulse border-none' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600'}`}><Calendar size={12} className="inline mr-1"/> {tCobro}</span>
              {emp.usuarioId && <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-full uppercase italic border border-emerald-100 dark:border-emerald-500/20 shadow-sm"><UserCheck size={12} className="inline mr-1"/> Vinculado</span>}
            </div>
          </div>
        </div>
        <div className="flex-1 w-full bg-[#F8F9FB] dark:bg-black/20 rounded-[3rem] p-6 flex flex-col md:flex-row justify-around items-center border border-black/5 gap-6 text-center md:text-left shadow-inner">
           <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendiente</p><p className="text-4xl font-black dark:text-white italic tracking-tighter">${total.toLocaleString()}</p></div>
           <div className="h-10 w-[1px] bg-slate-200 dark:bg-white/10 hidden md:block" />
           <div><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">BCV</p><p className="text-2xl font-black text-slate-700 dark:text-slate-300 italic">{rates?.usd ? formatBs(total, rates.usd) : "---"}</p></div>
        </div>
        <Button onClick={onPagar} disabled={total === 0} className={`h-24 px-12 rounded-[2.5rem] font-black text-xl shadow-2xl uppercase italic transition-all active:scale-95 ${total > 0 ? 'bg-slate-900 dark:bg-blue-600 text-white hover:bg-black' : 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 shadow-none'}`}>{total > 0 ? "Pagar" : "Al Día"}</Button>
      </div>
      <div className="mt-8 pt-8 border-t border-black/5 flex flex-col md:flex-row gap-4 items-center">
         <div className="relative w-full md:w-48"><Input placeholder="0.00" type="number" value={m} onChange={e=>setM(e.target.value)} className="rounded-2xl h-14 bg-slate-50 dark:bg-black/20 border-none pl-12 font-black text-lg shadow-inner dark:text-white" /><DollarSign className="absolute left-4 top-4 text-blue-600" size={20}/></div>
         <Input placeholder="Concepto de comisión o bono especial..." value={d} onChange={e=>setD(e.target.value)} className="rounded-2xl h-14 bg-slate-50 dark:bg-black/20 border-none px-6 font-bold flex-1 shadow-inner italic dark:text-white" />
         <Button onClick={()=>{if(m)onAddCom(parseFloat(m),d);setM("");setD("");}} variant="ghost" className="w-full md:w-auto h-14 rounded-2xl text-blue-600 font-black hover:bg-blue-50 dark:hover:bg-blue-500/10 px-8 transition-colors uppercase text-[10px] tracking-widest">+ Añadir</Button>
      </div>
    </motion.div>
  );
}

function Recibo({ pago, rates }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-[#1c1c1e] rounded-[3rem] p-6 shadow-sm border border-black/5 flex flex-col md:flex-row justify-between items-center gap-6 group hover:shadow-md transition-shadow">
       <div className="flex gap-4 items-center w-full md:w-auto">
          <div className="bg-emerald-100 dark:bg-emerald-500/20 p-5 rounded-[2rem] text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-inner shrink-0"><Wallet size={24}/></div>
          <div className="min-w-0">
            <h4 className="text-2xl font-black dark:text-white italic uppercase truncate tracking-tight leading-none">{pago.nombre}</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase mt-2">{new Date(pago.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
       </div>
       <div className="bg-slate-50 dark:bg-black/20 rounded-[2.5rem] px-10 py-6 flex-1 w-full space-y-3 shadow-inner border border-black/5">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-2 mb-2">
             <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Área: {pago.areaAsignada || "General"} &bull; Vía {pago.metodoPago}</span>
             <span className="text-[9px] font-black text-slate-400 uppercase truncate max-w-[150px] italic">{pago.notaAdicional}</span>
          </div>
          {pago.conceptos?.map((c:any, i:number) => (
             <div key={i} className="flex justify-between items-center text-[10px] font-black uppercase italic">
                <span className="text-slate-400">{c.tipo}: <span className="text-slate-600 dark:text-slate-300 ml-2">{c.motivo}</span></span>
                <span className="dark:text-white text-base font-black">${Number(c.monto).toFixed(2)}</span>
             </div>
          ))}
       </div>
       <div className="text-center md:text-right min-w-[180px]">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Liquidado</p>
          <p className="text-3xl font-black dark:text-white italic tracking-tighter">${Number(pago.totalUSD).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-sm font-bold text-blue-600 uppercase italic mt-1">Bs. {Number(pago.totalVES).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
       </div>
    </motion.div>
  );
}

function StatCard({ label, value, sub, icon, color }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white dark:bg-[#1c1c1e] p-8 rounded-[3rem] shadow-sm border border-black/5 flex flex-col gap-5 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
      <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:scale-150 transition-transform text-slate-900 dark:text-white">{icon}</div>
      <div className={`${color} w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl group-hover:rotate-12 transition-transform shadow-blue-500/20`}>{icon}</div>
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
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="rounded-[1.8rem] h-16 bg-slate-50 dark:bg-white/5 border-none px-8 font-black text-lg shadow-inner italic dark:text-white placeholder:text-slate-300" />
    </div>
  );
}