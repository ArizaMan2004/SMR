"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Users, CheckCircle2, Clock, TrendingUp, Plus, DollarSign, 
  Calendar, ArrowRightLeft, Trash2, Edit3, X, Briefcase, 
  Wallet, ReceiptText, Search, Filter, AlertCircle, ChevronRight
} from 'lucide-react';

// Importación de servicios
import { fetchBCVRateFromAPI, formatBs, type BCVRates } from "@/lib/services/bcv-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase"; 
import { 
  collection, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, query, orderBy, serverTimestamp 
} from "firebase/firestore";

// --- HELPERS ---
const calcularDiasRestantes = (diaPago: number) => {
  const hoy = new Date();
  let fechaPago = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
  if (hoy.getDate() > diaPago) fechaPago.setMonth(fechaPago.getMonth() + 1);
  const diff = fechaPago.getTime() - hoy.getTime();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return dias === 0 ? "Hoy" : dias;
};

export function EmpleadosView({ empresaId }: { empresaId: string }) {
  const [view, setView] = useState<'control' | 'registro' | 'historial'>('control');
  const [dataEmpleados, setDataEmpleados] = useState<any[]>([]);
  const [dataPagos, setDataPagos] = useState<any[]>([]);
  const [rates, setRates] = useState<BCVRates | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtroHistorial, setFiltroHistorial] = useState("todos");

  // Formulario Registro
  const [form, setForm] = useState({ nombre: "", cargo: "", sueldo: "", dia: "15" });

  // 1. CARGA DE DATOS
  useEffect(() => {
    if (!empresaId) return;

    fetchBCVRateFromAPI().then(setRates);

    const unsubEmp = onSnapshot(collection(db, "empresas", empresaId, "empleados"), (snap) => {
      setDataEmpleados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubPagos = onSnapshot(
      query(collection(db, "empresas", empresaId, "pagos"), orderBy("fecha", "desc")),
      (snap) => {
        setDataPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => { unsubEmp(); unsubPagos(); };
  }, [empresaId]);

  // 2. ACCIONES
  const handleRegistrar = async () => {
    if (!form.nombre || !form.sueldo) return alert("Nombre y sueldo son obligatorios");
    
    try {
      await addDoc(collection(db, "empresas", empresaId, "empleados"), {
        nombre: form.nombre,
        cargo: form.cargo || "Empleado",
        montoSueldo: parseFloat(form.sueldo),
        diaPago: parseInt(form.dia),
        comisiones: [],
        ultimoPagoMes: "",
        fechaRegistro: serverTimestamp()
      });
      setForm({ nombre: "", cargo: "", sueldo: "", dia: "15" });
      setView('control');
    } catch (error) {
      console.error("Error al registrar:", error);
    }
  };

  const handlePagar = async (emp: any) => {
    if (!rates?.usd) return alert("Sincronizando tasa BCV...");
    
    const mesActual = new Date().toISOString().slice(0, 7);
    const tCom = emp.comisiones?.reduce((a: number, c: any) => a + c.monto, 0) || 0;
    const sueldo = emp.ultimoPagoMes === mesActual ? 0 : emp.montoSueldo;
    const totalUSD = sueldo + tCom;

    if (totalUSD <= 0) return alert("No hay montos pendientes para este empleado.");

    try {
      await addDoc(collection(db, "empresas", empresaId, "pagos"), {
        empleadoId: emp.id,
        nombre: emp.nombre,
        conceptos: [
          ...(sueldo > 0 ? [{ tipo: 'Sueldo Fijo', monto: sueldo, motivo: `Nómina ${mesActual}` }] : []),
          ...(emp.comisiones?.map((c: any) => ({ tipo: 'Comisión', monto: c.monto, motivo: c.desc })) || [])
        ],
        totalUSD,
        totalVES: totalUSD * rates.usd,
        tasaBCV: rates.usd,
        fecha: new Date().toISOString(),
        mesRelativo: mesActual
      });

      await updateDoc(doc(db, "empresas", empresaId, "empleados", emp.id), {
        ultimoPagoMes: mesActual,
        comisiones: []
      });
    } catch (error) {
      console.error("Error en el pago:", error);
    }
  };

  // 3. ESTADÍSTICAS
  const stats = useMemo(() => {
    const mesActual = new Date().toISOString().slice(0, 7);
    let pend = 0;
    dataEmpleados.forEach(e => {
      const com = e.comisiones?.reduce((a: any, c: any) => a + c.monto, 0) || 0;
      const sueldo = e.ultimoPagoMes === mesActual ? 0 : e.montoSueldo;
      pend += sueldo + com;
    });
    const pagado = dataPagos.filter(p => p.mesRelativo === mesActual).reduce((a, p) => a + p.totalUSD, 0);
    return { pend, pagado, total: pend + pagado };
  }, [dataEmpleados, dataPagos]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#F2F2F7]">
      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }} className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Sincronizando con Firebase</p>
      </motion.div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen bg-[#F2F2F7] text-slate-900 font-sans selection:bg-blue-100">
      
      {/* HEADER */}
      <header className="mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-6xl font-black tracking-tighter text-slate-900">Personal</h1>
            <p className="text-slate-400 font-bold ml-1">Gestión de nómina y comisiones</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white px-8 py-4 rounded-[2.5rem] shadow-xl shadow-gray-200/50 flex items-center gap-5 border border-white">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200"><ArrowRightLeft size={20}/></div>
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase leading-none mb-1 tracking-widest">Tasa BCV Oficial</p>
              <p className="font-black text-2xl text-slate-800">
                {rates?.usd ? `Bs. ${Number(rates.usd).toFixed(2)}` : "Cargando..."}
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Por Pagar" value={`$${stats.pend.toLocaleString()}`} sub={rates ? formatBs(stats.pend, rates.usd) : ""} icon={<Clock/>} color="bg-orange-500" />
          <StatCard label="Pagado este mes" value={`$${stats.pagado.toLocaleString()}`} sub={rates ? formatBs(stats.pagado, rates.usd) : ""} icon={<CheckCircle2/>} color="bg-green-500" />
          <StatCard label="Presupuesto Total" value={`$${stats.total.toLocaleString()}`} icon={<TrendingUp/>} color="bg-indigo-600" />
        </div>
      </header>

      {/* NAVEGACIÓN */}
      <div className="flex bg-gray-200/50 p-1.5 rounded-[2.5rem] mb-10 w-fit backdrop-blur-xl border border-gray-200/20 mx-auto md:mx-0">
        <TabBtn active={view === 'control'} onClick={() => setView('control')} label="Nómina" icon={<Users size={18}/>} />
        <TabBtn active={view === 'registro'} onClick={() => setView('registro')} label="Nuevo Empleado" icon={<Plus size={18}/>} />
        <TabBtn active={view === 'historial'} onClick={() => setView('historial')} label="Historial" icon={<ReceiptText size={18}/>} />
      </div>

      <main>
        <AnimatePresence mode="wait">
          {view === 'control' && (
            <motion.div key="c" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <LayoutGroup>
                {dataEmpleados.length > 0 ? dataEmpleados.map(emp => (
                  <EmpleadoCard 
                    key={emp.id} 
                    emp={emp} 
                    rates={rates} 
                    onPagar={() => handlePagar(emp)} 
                    onEdit={() => setEditTarget(emp)}
                    onDelete={async () => { if(confirm("¿Eliminar empleado?")) await deleteDoc(doc(db, "empresas", empresaId, "empleados", emp.id)) }}
                    onAddCom={async (m:any, d:any) => {
                      await updateDoc(doc(db, "empresas", empresaId, "empleados", emp.id), {
                        comisiones: [...(emp.comisiones || []), { id: Date.now().toString(), monto: m, desc: d }]
                      });
                    }}
                  />
                )) : (
                  <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold">No hay empleados registrados todavía.</p>
                  </div>
                )}
              </LayoutGroup>
            </motion.div>
          )}

          {view === 'registro' && (
            <motion.div key="r" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-w-xl mx-auto bg-white p-12 rounded-[4rem] shadow-2xl border border-white">
              <div className="mb-10">
                 <h2 className="text-4xl font-black mb-2 tracking-tight">Nuevo Ingreso</h2>
                 <p className="text-gray-400 font-medium">Completa los datos básicos del trabajador.</p>
              </div>
              <div className="space-y-5">
                <Field label="Nombre Completo" value={form.nombre} onChange={(v: string) => setForm({...form, nombre: v})} placeholder="Ej. Juan Pérez" />
                <Field label="Cargo u Oficio" value={form.cargo} onChange={(v: string) => setForm({...form, cargo: v})} placeholder="Ej. Administrador" />
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
                 <button onClick={() => setFiltroHistorial('todos')} className={`px-8 py-3 rounded-full text-sm font-black transition-all whitespace-nowrap ${filtroHistorial === 'todos' ? 'bg-slate-900 text-white shadow-xl' : 'bg-white text-gray-400 shadow-sm'}`}>Todos los registros</button>
                 {dataEmpleados.map(e => (
                   <button key={e.id} onClick={() => setFiltroHistorial(e.id)} className={`px-8 py-3 rounded-full text-sm font-black transition-all whitespace-nowrap ${filtroHistorial === e.id ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-gray-400 shadow-sm'}`}>{e.nombre}</button>
                 ))}
              </div>
              <div className="grid gap-4">
                {dataPagos.filter(p => filtroHistorial === 'todos' || p.empleadoId === filtroHistorial).map(pago => (
                  <Recibo p={pago} rates={rates} key={pago.id} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL EDICIÓN CORREGIDO */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl relative">
              <button onClick={() => setEditTarget(null)} className="absolute right-8 top-8 bg-gray-100 p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"><X size={20}/></button>
              <h2 className="text-3xl font-black mb-8 tracking-tighter">Editar Perfil</h2>
              <div className="space-y-5">
                <Field label="Nombre" value={editTarget.nombre} onChange={(v: string) => setEditTarget({...editTarget, nombre: v})} />
                <Field label="Cargo" value={editTarget.cargo} onChange={(v: string) => setEditTarget({...editTarget, cargo: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Sueldo" value={editTarget.montoSueldo} onChange={(v: string) => setEditTarget({...editTarget, montoSueldo: v})} type="number" />
                  <Field label="Día" value={editTarget.diaPago} onChange={(v: string) => setEditTarget({...editTarget, diaPago: v})} type="number" />
                </div>
                <Button 
                  onClick={async () => {
                    const { id, ...cleanData } = editTarget;
                    await updateDoc(doc(db, "empresas", empresaId, "empleados", id), {
                      ...cleanData, 
                      montoSueldo: parseFloat(editTarget.montoSueldo),
                      diaPago: parseInt(editTarget.diaPago)
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

// --- SUB-COMPONENTES ---

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
          <div className="h-24 w-24 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[2.5rem] flex items-center justify-center font-black text-3xl shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform">
             <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            {emp.nombre.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h3 className="font-black text-3xl tracking-tighter text-slate-900">{emp.nombre}</h3>
              <div className="flex bg-gray-50 rounded-full p-1 border border-gray-100">
                <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Edit3 size={18}/></button>
                <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-sm">
                <Briefcase size={12}/> {emp.cargo}
              </span>
              <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm flex items-center gap-2 ${dias === 'Hoy' ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
                <Calendar size={12}/> {dias === 'Hoy' ? "Toca Pagar" : `Cobro en ${dias} días`}
              </span>
            </div>
          </div>
        </div>

        {/* ÁREA DE MONTOS CORREGIDA */}
        <div className="flex-1 w-full bg-[#F8F9FB] rounded-[3rem] p-8 flex flex-col md:flex-row justify-around items-center border border-gray-100 gap-6">
           <div className="text-center md:text-left">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-[0.2em]">Pendiente (USD)</p>
              <p className="text-4xl font-black tracking-tighter text-slate-900">${total.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 italic">Sueldo Base: ${emp.montoSueldo}</p>
           </div>
           <div className="h-10 w-[1px] bg-gray-200 hidden md:block" />
           <div className="text-center md:text-right">
              <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-[0.2em]">Equivalente BCV</p>
              <p className="text-2xl font-black text-slate-700">
                {rates ? formatBs(total, rates.usd) : "Calculando..."}
              </p>
           </div>
        </div>

        <Button 
          onClick={onPagar} 
          disabled={total === 0} 
          className={`h-24 px-12 rounded-[2.5rem] font-black text-xl shadow-2xl transition-all active:scale-90 ${total > 0 ? 'bg-slate-900 text-white hover:bg-black shadow-slate-200' : 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'}`}
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
              className="rounded-2xl h-14 bg-gray-50 border-none pl-12 font-black text-lg focus:ring-4 ring-blue-50 transition-all" 
            />
            <DollarSign className="absolute left-4 top-4 text-blue-600" size={20}/>
         </div>
         <div className="flex-[3] w-full">
            <Input 
              placeholder="Descripción de la comisión (ej. Venta de equipo, Bono extra...)" 
              value={d} 
              onChange={e => setD(e.target.value)} 
              className="rounded-2xl h-14 bg-gray-50 border-none px-6 font-bold placeholder:text-gray-300 focus:ring-4 ring-blue-50 transition-all" 
            />
         </div>
         <Button 
            onClick={() => { if(m) onAddCom(parseFloat(m), d); setM(""); setD(""); }} 
            variant="ghost" 
            className="h-14 rounded-2xl text-blue-600 font-black hover:bg-blue-50 px-8 transition-colors shrink-0"
         >
            + Añadir Comisión
         </Button>
      </div>
    </motion.div>
  );
}

function Recibo({ p, rates }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-white rounded-[3rem] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-8 group hover:shadow-md transition-shadow">
       <div className="flex gap-6 items-center w-full md:w-auto">
          <div className="bg-green-100 p-5 rounded-[2rem] text-green-700 shadow-inner group-hover:scale-110 transition-transform"><Wallet size={28}/></div>
          <div>
            <h4 className="text-2xl font-black tracking-tighter text-slate-900">{p.nombre}</h4>
            <div className="flex items-center gap-2 text-gray-400">
               <Calendar size={12}/>
               <p className="text-[10px] font-black uppercase tracking-widest">
                {new Date(p.fecha).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
               </p>
            </div>
          </div>
       </div>
       <div className="bg-gray-50/50 rounded-[2.5rem] px-10 py-6 flex-1 w-full space-y-3 border border-gray-100 shadow-inner">
          {p.conceptos.map((c:any, i:number) => (
             <div key={i} className="flex justify-between items-center">
                <span className="font-black text-[10px] text-gray-400 uppercase tracking-tighter">{c.tipo}: <span className="text-slate-600 ml-2">{c.motivo}</span></span>
                <span className="font-black text-slate-900">${c.monto.toFixed(2)}</span>
             </div>
          ))}
       </div>
       <div className="text-center md:text-right min-w-[180px]">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Liquidado</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">${p.totalUSD.toLocaleString()}</p>
          <p className="text-sm font-bold text-blue-600 mt-1">Bs. {p.totalVES.toLocaleString()}</p>
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
        <p className="text-4xl font-black text-slate-900 leading-none tracking-tighter">{value}</p>
        {sub && <p className="text-sm font-bold text-blue-600 mt-3">{sub}</p>}
      </div>
    </motion.div>
  );
}

function TabBtn({ active, onClick, label, icon }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[11px] font-black transition-all duration-500 relative ${active ? 'bg-white text-slate-900 shadow-2xl scale-105' : 'text-gray-500 hover:text-slate-800'}`}>
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
        className="rounded-[1.8rem] h-16 bg-gray-50 border-none px-8 font-black text-lg focus:ring-4 ring-blue-50 transition-all placeholder:text-gray-300" 
      />
    </div>
  );
}