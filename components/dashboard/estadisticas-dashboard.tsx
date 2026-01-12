// @/components/orden/estadisticas-dashboard.tsx
"use client"

import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { 
  ArrowUpRight, ArrowDownLeft, Users, 
  ShoppingCart, Building2, Package, Layers, Calendar,
  History, DollarSign, Wallet, Percent, TrendingUp, Activity,
  ShoppingBag, AlertCircle, CheckCircle2
} from "lucide-react"

import type { GastoInsumo, GastoFijo, Empleado, PagoEmpleado, Cobranza } from "@/lib/types/gastos"
import { cn } from "@/lib/utils"

interface EstadisticasDashboardProps {
  gastosInsumos: GastoInsumo[]
  gastosFijos: GastoFijo[]
  empleados: Empleado[]
  pagosEmpleados: PagoEmpleado[]
  cobranzas: Cobranza[]
  clientes: any[]
  ordenes: any[]
}

export function EstadisticasDashboard({
  gastosInsumos, gastosFijos, empleados, pagosEmpleados, cobranzas, clientes, ordenes
}: EstadisticasDashboardProps) {

  const [filtroTiempo, setFiltroTiempo] = useState<'semana' | 'mes' | 'año'>('mes');
  const mesActualStr = new Date().toISOString().slice(0, 7); 

  // --- 1. KPIs SIMPLIFICADOS (INGRESO, EGRESO, GANANCIA) ---
  const kpis = useMemo(() => {
    const ingresosTotal = cobranzas?.filter(c => c.estado === "pagado").reduce((s, c) => s + (c.montoUSD || 0), 0) || 0;
    
    const gastosInsumosTotal = gastosInsumos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0;
    const gastosFijosTotal = gastosFijos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0;
    const nominaTotal = pagosEmpleados?.reduce((s, p) => s + (Number(p.totalUSD) || 0), 0) || 0;
    
    const egresosTotal = gastosInsumosTotal + gastosFijosTotal + nominaTotal;
    const gananciaBruta = ingresosTotal - egresosTotal;

    return { ingresosTotal, egresosTotal, gananciaBruta };
  }, [cobranzas, gastosFijos, gastosInsumos, pagosEmpleados]);

  // --- 2. EVOLUCIÓN FINANCIERA (POR DÍAS) ---
  const evolucionData = useMemo(() => {
    const map = new Map();
    const getPeriodKey = (dateStr: string) => {
        const d = new Date(dateStr);
        if (filtroTiempo === 'año') return d.toLocaleString('es-VE', { month: 'short' });
        if (filtroTiempo === 'mes') return `${d.getDate()}/${d.getMonth() + 1}`;
        if (filtroTiempo === 'semana') return d.toLocaleString('es-VE', { weekday: 'short' });
        return dateStr;
    };

    cobranzas?.filter(c => c.estado === 'pagado').forEach(c => {
        const key = getPeriodKey(c.fecha || new Date().toISOString());
        const curr = map.get(key) || { name: key, ingresos: 0, gastos: 0, sortKey: new Date(c.fecha).getTime() };
        curr.ingresos += (c.montoUSD || 0);
        map.set(key, curr);
    });

    const todosLosGastos = [
        ...(gastosInsumos || []).map(g => ({ monto: g.monto, fecha: g.fecha })),
        ...(pagosEmpleados || []).map(p => ({ monto: p.totalUSD, fecha: p.fechaPago })),
        ...(gastosFijos || []).map(g => ({ monto: g.monto, fecha: new Date().toISOString() }))
    ];

    todosLosGastos.forEach(g => {
        if (!g.fecha) return;
        const key = getPeriodKey(g.fecha);
        const curr = map.get(key) || { name: key, ingresos: 0, gastos: 0, sortKey: new Date(g.fecha).getTime() };
        curr.gastos += (Number(g.monto) || 0);
        map.set(key, curr);
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey).slice(-15);
  }, [cobranzas, gastosFijos, gastosInsumos, pagosEmpleados, filtroTiempo]);

  // --- 3. SEGMENTACIÓN ---
  const segmentacion = useMemo(() => {
    const aliados = ordenes?.filter(o => o.cliente?.tipoCliente === 'ALIADO').length || 0;
    const regulares = (ordenes?.length || 0) - aliados;
    return [
        { name: 'Aliados', value: aliados, color: '#9333ea' },
        { name: 'Regulares', value: regulares, color: '#6366f1' }
    ];
  }, [ordenes]);

  // --- 4. RESUMEN DE GASTOS ---
  const resumenGastos = useMemo(() => {
    const fijos = (gastosFijos || []).map(g => ({ ...g, tipo: 'Fijo', color: 'orange', icon: <Building2 size={18} /> }));
    const insumos = (gastosInsumos || []).map(g => ({ ...g, tipo: 'Insumo', color: 'blue', icon: <Package size={18} /> }));
    return [...fijos, ...insumos].sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0));
  }, [gastosFijos, gastosInsumos]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 p-2 font-sans pb-24">
      
      {/* SECCIÓN 1: PANEL DE KPIs SIMPLIFICADO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatIsland 
            label="Ingresos" 
            val={kpis.ingresosTotal} 
            sub="Total Cobrado Real" 
            icon={<TrendingUp size={22}/>} 
            color="emerald" 
        />
        <StatIsland 
            label="Egresos" 
            val={kpis.egresosTotal} 
            sub="Insumos + Fijos + Nómina" 
            icon={<ArrowDownLeft size={22}/>} 
            color="rose" 
        />
        <StatIsland 
            label="Ganancia Bruta" 
            val={kpis.gananciaBruta} 
            sub="Balance Operativo Neto" 
            icon={<DollarSign size={22}/>} 
            color={kpis.gananciaBruta >= 0 ? "blue" : "rose"} 
        />
      </div>

      {/* SECCIÓN 2: GRÁFICAS DE CONTROL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FLUJO DIARIO */}
        <Card className="lg:col-span-2 p-8 rounded-[3rem] border-0 bg-white dark:bg-zinc-900 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <div>
                <h3 className="text-2xl font-black tracking-tight uppercase italic">Flujo Diario</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comparativa de ingresos vs gastos</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl gap-1">
                {(['semana', 'mes', 'año'] as const).map(f => (
                    <button key={f} onClick={() => setFiltroTiempo(f)} className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all", filtroTiempo === f ? "bg-white dark:bg-zinc-700 shadow-lg text-blue-600" : "text-slate-400")}>
                        {f}
                    </button>
                ))}
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                    <Bar name="Ingresos ($)" dataKey="ingresos" fill="#10b981" radius={[8, 8, 0, 0]} barSize={25} />
                    <Bar name="Gastos ($)" dataKey="gastos" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={25} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* SEGMENTACIÓN */}
        <Card className="p-8 rounded-[3rem] border-0 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
          <h3 className="text-xl font-black uppercase italic mb-8">Segmentación</h3>
          <div className="h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segmentacion} innerRadius={75} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                  {segmentacion.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-black text-slate-900 dark:text-white">{ordenes?.length || 0}</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Órdenes</span>
            </div>
          </div>
          <div className="space-y-3 mt-8">
            {segmentacion.map(s => (
                <div key={s.name} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] font-black text-slate-500 uppercase">{s.name}</span>
                    </div>
                    <span className="text-sm font-black">{s.value} <span className="text-[8px] text-slate-400 ml-1">TRABAJOS</span></span>
                </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECCIÓN 3: GASTOS ADMINISTRATIVOS */}
      <Card className="p-10 rounded-[4rem] border-0 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md shadow-inner">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
            <ShoppingBag size={22} />
          </div>
          <div>
            <h4 className="font-black text-xl tracking-tighter">Gastos Administrativos</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Control de Insumos y Fijos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <AnimatePresence>
            {resumenGastos.map((gasto: any, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-6 rounded-[2.5rem] bg-white dark:bg-slate-800 shadow-sm border border-slate-50 flex flex-col gap-4 group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
              >
                <div className="flex justify-between items-start">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${gasto.tipo === 'Fijo' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                    {gasto.icon}
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${gasto.tipo === 'Fijo' ? 'text-orange-600' : 'text-blue-600'}`}>
                      ${Number(gasto.monto).toFixed(0)}
                    </p>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{gasto.tipo}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {gasto.nombre || gasto.descripcion || "Gasto sin nombre"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {gasto.categoria || "Operativo"}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {resumenGastos.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-300 opacity-50 italic">
              <AlertCircle size={40} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">No hay gastos registrados</p>
            </div>
          )}
        </div>
      </Card>

      {/* SECCIÓN 4: LIQUIDACIONES NÓMINA */}
      <Card className="p-10 rounded-[4rem] border-0 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md shadow-inner">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-xl">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="font-black text-xl tracking-tighter">Liquidaciones Realizadas</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de pagos del mes {mesActualStr}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <AnimatePresence>
            {pagosEmpleados?.filter(p => p.mesRelativo === mesActualStr).map((pago, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-[2.5rem] bg-white dark:bg-slate-800 shadow-sm border border-slate-50 flex flex-col gap-4 group hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-lg uppercase">
                    {pago.nombre?.charAt(0)}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-emerald-600">${Number(pago.totalUSD).toFixed(0)}</p>
                    <p className="text-[9px] font-bold text-slate-300">TASA: {pago.tasaBCV?.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{pago.nombre}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                    {pago.conceptos?.[0]?.tipo || "Sueldo y Comisiones"}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {(!pagosEmpleados || pagosEmpleados.length === 0) && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-300 opacity-50 italic">
              <AlertCircle size={40} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">Sin liquidaciones registradas</p>
            </div>
          )}
        </div>
      </Card>

    </motion.div>
  )
}

function StatIsland({ label, val, sub, icon, color }: any) {
  const styles: any = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
    blue: "bg-blue-500/10 text-blue-600",
    orange: "bg-orange-500/10 text-orange-600",
  }
  
  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      className="p-10 rounded-[3.5rem] bg-white shadow-2xl shadow-slate-200/40 border border-slate-50 relative overflow-hidden group"
    >
      <div className={`absolute -right-6 -top-6 w-32 h-32 ${styles[color].split(' ')[0]} rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity`} />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div className={`p-4 rounded-[1.8rem] ${styles[color]}`}>
            {icon}
          </div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-300">$</span>
            <p className="text-5xl font-black tracking-tighter text-slate-900">
              {val.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className={`text-xs font-black mt-3 ${styles[color].split(' ')[1]}`}>{sub}</p>
        </div>
      </div>
    </motion.div>
  )
}