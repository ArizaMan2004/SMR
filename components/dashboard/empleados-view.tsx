// @/components/dashboard/empleados-view.tsx
"use client"

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Users, CheckCircle2, Clock, TrendingUp, Plus, DollarSign, 
  Calendar, ArrowRightLeft, Trash2, Edit3, X, Briefcase, 
  Wallet, ReceiptText, Search, Filter, AlertCircle, ChevronRight,
  CreditCard, Banknote, Repeat // Icono para frecuencia
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase"; 
import { 
  collection, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp 
} from "firebase/firestore";
import { formatBs } from "@/lib/services/bcv-service";

// --- HELPERS ---
const calcularDiasRestantes = (diaPago: number) => {
  const hoy = new Date();
  let fechaPago = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
  if (hoy.getDate() > diaPago) fechaPago.setMonth(fechaPago.getMonth() + 1);
  const diff = fechaPago.getTime() - hoy.getTime();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return dias === 0 ? "Hoy" : dias;
};

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

interface EmpleadosViewProps {
  empleados: any[];
  pagos: any[];
  rates: any;
}

export function EmpleadosView({ empleados, pagos, rates }: EmpleadosViewProps) {
  const [view, setView] = useState<'control' | 'registro' | 'historial'>('control');
  const [editTarget, setEditTarget] = useState<any>(null);
  const [filtroHistorial, setFiltroHistorial] = useState("todos");

  // Estados para el Modal de Pago
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [paymentConfig, setPaymentConfig] = useState({
      metodo: "Efectivo USD",
      intervalo: "1ra Quincena",
      nota: ""
  });

  // Formulario Registro (AHORA CON FRECUENCIA)
  const [form, setForm] = useState({ 
      nombre: "", 
      cargo: "", 
      sueldo: "", 
      dia: "15", 
      frecuencia: "Mensual" // Valor por defecto
  });

  // --- 1. ACCIONES ---
  const handleRegistrar = async () => {
    if (!form.nombre || !form.sueldo) return alert("Nombre y sueldo son obligatorios");
    
    try {
      await addDoc(collection(db, "empleados"), {
        nombre: form.nombre,
        cargo: form.cargo || "Empleado",
        montoSueldo: parseFloat(form.sueldo),
        diaPago: parseInt(form.dia),
        frecuenciaPago: form.frecuencia, // Guardamos la frecuencia
        comisiones: [],
        ultimoPagoMes: "",
        fechaRegistro: serverTimestamp()
      });
      // Reset form
      setForm({ nombre: "", cargo: "", sueldo: "", dia: "15", frecuencia: "Mensual" });
      setView('control');
    } catch (error) {
      console.error("Error al registrar:", error);
    }
  };

  // Prepara el pago abriendo el modal
  const preparePayment = (emp: any) => {
      setSelectedEmployee(emp);
      // Intentar pre-seleccionar el intervalo lógico según la frecuencia del empleado
      let defaultInterval = "Mes Completo";
      if (emp.frecuenciaPago === "Quincenal") defaultInterval = "1ra Quincena";
      if (emp.frecuenciaPago === "Semanal") defaultInterval = "Semana";

      setPaymentConfig({
          metodo: "Efectivo USD",
          intervalo: defaultInterval,
          nota: ""
      });
      setPaymentModalOpen(true);
  };

  // Ejecuta el pago final
  const confirmPayment = async () => {
    if (!selectedEmployee || !rates?.usd) return;
    
    const emp = selectedEmployee;
    const mesActual = new Date().toISOString().slice(0, 7);
    const tCom = emp.comisiones?.reduce((a: number, c: any) => a + c.monto, 0) || 0;
    const sueldo = emp.ultimoPagoMes === mesActual ? 0 : emp.montoSueldo;
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
        notaAdicional: paymentConfig.nota,
        fecha: new Date().toISOString(),
        mesRelativo: mesActual
      });

      await updateDoc(doc(db, "empleados", emp.id), {
        ...(sueldo > 0 ? { ultimoPagoMes: mesActual } : {}),
        comisiones: []
      });

      setPaymentModalOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Error en el pago:", error);
      alert("Error al procesar pago");
    }
  };

  // --- 2. ESTADÍSTICAS ---
  const stats = useMemo(() => {
    const mesActual = new Date().toISOString().slice(0, 7);
    let pend = 0;
    empleados.forEach(e => {
      const com = e.comisiones?.reduce((a: any, c: any) => a + c.monto, 0) || 0;
      const sueldo = e.ultimoPagoMes === mesActual ? 0 : e.montoSueldo;
      pend += sueldo + com;
    });
    const pagado = pagos.filter(p => p.mesRelativo === mesActual).reduce((a, p) => a + p.totalUSD, 0);
    return { pend, pagado, total: pend + pagado };
  }, [empleados, pagos]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen bg-[#F2F2F7] text-slate-900 font-sans selection:bg-blue-100">
      
      {/* HEADER */}
      <header className="mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-6xl font-black tracking-tighter text-slate-900 italic uppercase">Personal</h1>
            <p className="text-slate-400 font-bold ml-1 uppercase text-[10px] tracking-widest">Gestión de nómina global compartida</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white px-8 py-4 rounded-[2.5rem] shadow-xl shadow-gray-200/50 flex items-center gap-5 border border-white">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200"><ArrowRightLeft size={20}/></div>
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase leading-none mb-1 tracking-widest">Tasa BCV Oficial</p>
              <p className="font-black text-2xl text-slate-800">
                {rates?.usd ? `Bs. ${Number(rates.usd).toFixed(2)}` : "---"}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Por Pagar" value={`$${stats.pend.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pend, rates.usd) : ""} icon={<Clock/>} color="bg-orange-500" />
          <StatCard label="Pagado este mes" value={`$${stats.pagado.toLocaleString()}`} sub={rates?.usd ? formatBs(stats.pagado, rates.usd) : ""} icon={<CheckCircle2/>} color="bg-green-500" />
          <StatCard label="Presupuesto Total" value={`$${stats.total.toLocaleString()}`} icon={<TrendingUp/>} color="bg-indigo-600" />
        </div>
      </header>

      {/* NAVEGACIÓN */}
      <div className="flex bg-gray-200/50 p-1.5 rounded-[2.5rem] mb-10 w-fit backdrop-blur-xl border border-gray-200/20 mx-auto md:mx-0 shadow-inner">
        <TabBtn active={view === 'control'} onClick={() => setView('control')} label="Nómina" icon={<Users size={18}/>} />
        <TabBtn active={view === 'registro'} onClick={() => setView('registro')} label="Nuevo Empleado" icon={<Plus size={18}/>} />
        <TabBtn active={view === 'historial'} onClick={() => setView('historial')} label="Historial" icon={<ReceiptText size={18}/>} />
      </div>

      <main>
        <AnimatePresence mode="wait">
          {view === 'control' && (
            <motion.div key="c" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <LayoutGroup>
                {empleados.length > 0 ? empleados.map(emp => (
                  <EmpleadoCard 
                    key={emp.id} 
                    emp={emp} 
                    rates={rates} 
                    onPagar={() => preparePayment(emp)} 
                    onEdit={() => setEditTarget(emp)}
                    onDelete={async () => { if(confirm("¿Eliminar empleado permanentemente?")) await deleteDoc(doc(db, "empleados", emp.id)) }}
                    onAddCom={async (m:any, d:any) => {
                      await updateDoc(doc(db, "empleados", emp.id), {
                        comisiones: [...(emp.comisiones || []), { id: Date.now().toString(), monto: m, desc: d }]
                      });
                    }}
                  />
                )) : (
                  <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No hay personal registrado en la base de datos.</p>
                  </div>
                )}
              </LayoutGroup>
            </motion.div>
          )}

          {view === 'registro' && (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-w-xl mx-auto bg-white p-12 rounded-[4rem] shadow-2xl border border-white">
              <div className="mb-10">
                 <h2 className="text-4xl font-black mb-2 tracking-tight italic uppercase">Nuevo Ingreso</h2>
                 <p className="text-gray-400 font-medium text-[10px] uppercase tracking-widest">Registrar trabajador al sistema global.</p>
              </div>
              <div className="space-y-5">
                <Field label="Nombre Completo" value={form.nombre} onChange={(v: string) => setForm({...form, nombre: v})} placeholder="Ej. Juan Pérez" />
                <Field label="Cargo u Oficio" value={form.cargo} onChange={(v: string) => setForm({...form, cargo: v})} placeholder="Ej. Administrador" />
                
                {/* SELECTOR DE FRECUENCIA EN REGISTRO */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-6 tracking-widest">Frecuencia de Pago</label>
                    <Select value={form.frecuencia} onValueChange={(v) => setForm({...form, frecuencia: v})}>
                        <SelectTrigger className="rounded-[1.8rem] h-16 bg-gray-50 border-none px-8 font-black text-lg shadow-inner">
                            <SelectValue placeholder="Seleccione frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                            {FREQUENCY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Sueldo Base ($)" value={form.sueldo} onChange={(v: string) => setForm({...form, sueldo: v})} type="number" />
                  <Field label="Día de Cobro" value={form.dia} onChange={(v: string) => setForm({...form, dia: v})} type="number" />
                </div>
                <Button onClick={handleRegistrar} className="w-full bg-blue-600 hover:bg-blue-700 h-20 rounded-[2.5rem] font-black text-xl mt-6 shadow-2xl shadow-blue-200 transition-all active:scale-95">
                  Confirmar Registro
                </Button>
              </div>
            </motion.div>
          )}

          {view === 'historial' && (
            <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                 <button onClick={() => setFiltroHistorial('todos')} className={`px-8 py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${filtroHistorial === 'todos' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-gray-400 shadow-sm'}`}>Todos los registros</button>
                 {empleados.map(e => (
                   <button key={e.id} onClick={() => setFiltroHistorial(e.id)} className={`px-8 py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-widest ${filtroHistorial === e.id ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-400 shadow-sm'}`}>{e.nombre}</button>
                 ))}
              </div>
              <div className="grid gap-4">
                {pagos.filter(p => filtroHistorial === 'todos' || p.empleadoId === filtroHistorial).map(pago => (
                  <Recibo pago={pago} rates={rates} key={pago.id} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* --- MODAL DE LIQUIDACIÓN DE PAGO --- */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none bg-white dark:bg-slate-950 shadow-2xl">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                    <Wallet className="text-blue-600" /> Liquidar Nómina
                </DialogTitle>
            </DialogHeader>
            
            {selectedEmployee && (() => {
                const mesActual = new Date().toISOString().slice(0, 7);
                const comisiones = selectedEmployee.comisiones?.reduce((a:number,c:any)=>a+c.monto,0) || 0;
                const sueldoBase = selectedEmployee.ultimoPagoMes === mesActual ? 0 : selectedEmployee.montoSueldo;
                const total = sueldoBase + comisiones;
                const totalBs = total * (rates?.usd || 0);

                return (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] text-center border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto a Transferir</p>
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">${total}</h2>
                            <p className="text-sm font-bold text-blue-600 mt-1">Bs. {totalBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Sueldo Base</span>
                                    <span className="text-lg font-black text-slate-800">${sueldoBase}</span>
                                </div>
                                <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Comisiones</span>
                                    <span className="text-lg font-black text-emerald-600">${comisiones}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cuenta de Salida</Label>
                                <Select value={paymentConfig.metodo} onValueChange={(v) => setPaymentConfig({...paymentConfig, metodo: v})}>
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-100 border-none font-bold text-xs">
                                        <div className="flex items-center gap-2">
                                            <CreditCard size={14} className="text-slate-500"/>
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAYMENT_METHODS.map(m => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {sueldoBase > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Concepto / Intervalo</Label>
                                    <Select value={paymentConfig.intervalo} onValueChange={(v) => setPaymentConfig({...paymentConfig, intervalo: v})}>
                                        <SelectTrigger className="h-12 rounded-2xl bg-slate-100 border-none font-bold text-xs">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-500"/>
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PERIOD_OPTIONS.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nota Adicional</Label>
                                <Input 
                                    value={paymentConfig.nota}
                                    onChange={(e) => setPaymentConfig({...paymentConfig, nota: e.target.value})}
                                    placeholder="Detalles extra..."
                                    className="h-12 rounded-2xl bg-slate-100 border-none font-bold text-xs placeholder:font-normal"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button onClick={confirmPayment} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest shadow-xl hover:bg-black">
                                Confirmar Egreso
                            </Button>
                        </DialogFooter>
                    </div>
                )
            })()}
        </DialogContent>
      </Dialog>

      {/* MODAL EDICIÓN PERFIL (CON FRECUENCIA) */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl relative">
              <button onClick={() => setEditTarget(null)} className="absolute right-8 top-8 bg-gray-100 p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={20}/></button>
              <h2 className="text-3xl font-black mb-8 tracking-tighter italic uppercase">Editar Perfil</h2>
              <div className="space-y-5">
                <Field label="Nombre" value={editTarget.nombre} onChange={(v: string) => setEditTarget({...editTarget, nombre: v})} />
                <Field label="Cargo" value={editTarget.cargo} onChange={(v: string) => setEditTarget({...editTarget, cargo: v})} />
                
                {/* SELECTOR EN EDICIÓN */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-6 tracking-widest">Frecuencia</label>
                    <Select value={editTarget.frecuenciaPago || "Mensual"} onValueChange={(v) => setEditTarget({...editTarget, frecuenciaPago: v})}>
                        <SelectTrigger className="rounded-[1.8rem] h-16 bg-gray-50 border-none px-8 font-black text-lg shadow-inner">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FREQUENCY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Sueldo" value={editTarget.montoSueldo} onChange={(v: string) => setEditTarget({...editTarget, montoSueldo: v})} type="number" />
                  <Field label="Día" value={editTarget.diaPago} onChange={(v: string) => setEditTarget({...editTarget, diaPago: v})} type="number" />
                </div>
                <Button 
                  onClick={async () => {
                    const { id, ...cleanData } = editTarget;
                    await updateDoc(doc(db, "empleados", id), {
                      ...cleanData, 
                      montoSueldo: parseFloat(editTarget.montoSueldo),
                      diaPago: parseInt(editTarget.diaPago),
                      frecuenciaPago: editTarget.frecuenciaPago || "Mensual"
                    });
                    setEditTarget(null);
                  }} 
                  className="w-full bg-slate-900 text-white h-16 rounded-[2rem] font-black mt-4 shadow-xl active:scale-95 transition-transform"
                >
                  Guardar Cambios
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTES AUXILIARES ---

function EmpleadoCard({ emp, rates, onPagar, onEdit, onDelete, onAddCom }: any) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const dias = calcularDiasRestantes(emp.diaPago);
  const tCom = emp.comisiones?.reduce((a:any, c:any) => a + c.monto, 0) || 0;
  const sPend = emp.ultimoPagoMes === mesActual ? 0 : emp.montoSueldo;
  const total = tCom + sPend;

  const [m, setM] = useState("");
  const [d, setD] = useState("");

  return (
    <motion.div layout className="bg-white rounded-[3.5rem] p-10 shadow-sm border border-gray-50 group hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
        <div className="flex items-center gap-8 w-full lg:w-auto">
          <div className="h-24 w-24 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[2.5rem] flex items-center justify-center font-black text-3xl shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform italic">
            {emp.nombre.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h3 className="font-black text-3xl tracking-tighter text-slate-900 italic uppercase">{emp.nombre}</h3>
              <div className="flex bg-gray-50 rounded-full p-1 border border-gray-100 shadow-inner">
                <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-sm italic">
                <Briefcase size={12}/> {emp.cargo}
              </span>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-sm italic">
                <Repeat size={12}/> {emp.frecuenciaPago || "Mensual"}
              </span>
              <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm flex items-center gap-2 italic ${dias === 'Hoy' ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
                <Calendar size={12}/> {dias === 'Hoy' ? "Toca Pagar" : `Cobro en ${dias} días`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full bg-[#F8F9FB] rounded-[3rem] p-8 flex flex-col md:flex-row justify-around items-center border border-gray-100 gap-6">
           <div className="text-center md:text-left">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-[0.2em]">Pendiente (USD)</p>
              <p className="text-4xl font-black tracking-tighter text-slate-900 italic">${total.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 italic uppercase tracking-widest">Base: ${emp.montoSueldo}</p>
           </div>
           <div className="h-10 w-[1px] bg-gray-200 hidden md:block" />
           <div className="text-center md:text-right">
              <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-[0.2em]">Equivalente BCV</p>
              <p className="text-2xl font-black text-slate-700 italic">
                {rates?.usd ? formatBs(total, rates.usd) : "---"}
              </p>
           </div>
        </div>

        <Button 
          onClick={onPagar} 
          disabled={total === 0} 
          className={`h-24 px-12 rounded-[2.5rem] font-black text-xl shadow-2xl transition-all active:scale-90 italic uppercase ${total > 0 ? 'bg-slate-900 text-white hover:bg-black' : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'}`}
        >
          {total > 0 ? "Pagar Nómina" : "Al Día"}
        </Button>
      </div>

      <div className="mt-10 pt-10 border-t border-gray-100 flex flex-col md:flex-row gap-5 items-center">
         <div className="relative flex-1 w-full">
            <Input 
              placeholder="0.00" 
              type="number" 
              value={m} 
              onChange={e => setM(e.target.value)} 
              className="rounded-2xl h-14 bg-gray-50 border-none pl-12 font-black text-lg shadow-inner" 
            />
            <DollarSign className="absolute left-4 top-4 text-blue-600" size={20}/>
         </div>
         <div className="flex-[3] w-full">
            <Input 
              placeholder="Descripción de la comisión o bono extra..." 
              value={d} 
              onChange={e => setD(e.target.value)} 
              className="rounded-2xl h-14 bg-gray-50 border-none px-6 font-bold shadow-inner italic" 
            />
         </div>
         <Button 
            onClick={() => { if(m) onAddCom(parseFloat(m), d); setM(""); setD(""); }} 
            variant="ghost" 
            className="h-14 rounded-2xl text-blue-600 font-black hover:bg-blue-50 px-8 transition-colors shrink-0 uppercase text-[10px] tracking-widest"
         >
            + Añadir Comisión
         </Button>
      </div>
    </motion.div>
  );
}

function Recibo({ pago, rates }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-8 group hover:shadow-md transition-shadow">
       <div className="flex gap-6 items-center w-full md:w-auto">
          <div className="bg-green-100 p-5 rounded-[2rem] text-green-700 shadow-inner group-hover:scale-110 transition-transform"><Wallet size={28}/></div>
          <div>
            <h4 className="text-2xl font-black tracking-tighter text-slate-900 italic uppercase">{pago.nombre}</h4>
            <div className="flex items-center gap-2 text-gray-400 italic">
               <Calendar size={12}/>
               <p className="text-[10px] font-black uppercase tracking-widest">
                {new Date(pago.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
               </p>
            </div>
          </div>
       </div>
       <div className="bg-gray-50/50 rounded-[2.5rem] px-10 py-6 flex-1 w-full space-y-3 border border-gray-100 shadow-inner">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
             <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Método: {pago.metodoPago || "Efectivo"}</span>
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{pago.notaAdicional}</span>
          </div>
          {pago.conceptos?.map((c:any, i:number) => (
             <div key={i} className="flex justify-between items-center">
                <span className="font-black text-[10px] text-gray-400 uppercase tracking-tighter italic">{c.tipo}: <span className="text-slate-600 ml-2">{c.motivo}</span></span>
                <span className="font-black text-slate-900 italic">${c.monto.toFixed(2)}</span>
             </div>
          ))}
       </div>
       <div className="text-center md:text-right min-w-[180px]">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Liquidado</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter italic">${pago.totalUSD.toLocaleString()}</p>
          <p className="text-sm font-bold text-blue-600 mt-1 italic uppercase tracking-widest">Bs. {pago.totalVES.toLocaleString()}</p>
       </div>
    </motion.div>
  );
}

function StatCard({ label, value, sub, icon, color }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col gap-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-150 transition-transform duration-700">{icon}</div>
      <div className={`${color} w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl group-hover:rotate-12 transition-transform`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-2">{label}</p>
        <p className="text-4xl font-black text-slate-900 leading-none tracking-tighter italic">{value}</p>
        {sub && <p className="text-sm font-bold text-blue-600 mt-3 italic uppercase tracking-widest">{sub}</p>}
      </div>
    </motion.div>
  );
}

function TabBtn({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[11px] font-black transition-all duration-500 relative uppercase tracking-widest ${active ? 'bg-white text-slate-900 shadow-2xl scale-105 italic' : 'text-gray-500 hover:text-slate-800'}`}>
      {icon} {label}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-gray-400 uppercase ml-6 tracking-widest">{label}</label>
      <Input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
        className="rounded-[1.8rem] h-16 bg-gray-50 border-none px-8 font-black text-lg shadow-inner placeholder:text-gray-300 italic" 
      />
    </div>
  );
}