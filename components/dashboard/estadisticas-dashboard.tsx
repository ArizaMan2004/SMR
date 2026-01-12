// @/components/orden/estadisticas-dashboard.tsx
"use client"

import React, { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts"
import { 
  ArrowUpRight, ArrowDownLeft, Activity, Users, 
  ShoppingCart, Building2, Package, Layers, Calendar,
  History, DollarSign, Wallet, Percent, TrendingUp, Clock
} from "lucide-react"

import type { GastoInsumo, GastoFijo, Empleado, PagoEmpleado, Cobranza } from "@/lib/types/gastos"

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

  // --- 1. KPIs EXTENDIDOS ---
  const kpis = useMemo(() => {
    const ingresosTotal = cobranzas?.filter(c => c.estado === "pagado").reduce((s, c) => s + (c.montoUSD || 0), 0) || 0;
    const egresosTotal = (gastosFijos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0) + 
                         (gastosInsumos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0) +
                         (pagosEmpleados?.reduce((s, p) => s + (Number(p.totalUSD) || 0), 0) || 0);
    
    const ticketPromedio = ordenes?.length > 0 ? ingresosTotal / ordenes.length : 0;
    const tasaAliados = clientes?.length > 0 ? (clientes.filter(c => c.tipoCliente === 'ALIADO').length / clientes.length) * 100 : 0;

    return { ingresosTotal, egresosTotal, ticketPromedio, tasaAliados, balance: ingresosTotal - egresosTotal };
  }, [cobranzas, gastosFijos, gastosInsumos, pagosEmpleados, ordenes, clientes]);

  // --- 2. EVOLUCIÓN FINANCIERA DETALLADA (POR DÍAS) ---
  const evolucionData = useMemo(() => {
    const map = new Map();
    const getPeriodKey = (dateStr: string) => {
        const d = new Date(dateStr);
        if (filtroTiempo === 'año') return d.toLocaleString('es-VE', { month: 'short' });
        if (filtroTiempo === 'mes') return `${d.getDate()}/${d.getMonth() + 1}`;
        if (filtroTiempo === 'semana') return d.toLocaleString('es-VE', { weekday: 'short' });
        return dateStr;
    };

    // Procesar Ingresos
    cobranzas?.filter(c => c.estado === 'pagado').forEach(c => {
        const key = getPeriodKey(c.fecha || new Date().toISOString());
        const curr = map.get(key) || { name: key, ingresos: 0, gastos: 0, sortKey: new Date(c.fecha).getTime() };
        curr.ingresos += (c.montoUSD || 0);
        map.set(key, curr);
    });

    // Procesar Gastos
    const todosLosGastos = [
        ...(gastosFijos || []).map(g => ({ monto: g.monto, fecha: new Date().toISOString() })), // Fijos se asumen hoy para el gráfico
        ...(gastosInsumos || []).map(g => ({ monto: g.monto, fecha: g.fecha })),
        ...(pagosEmpleados || []).map(p => ({ monto: p.totalUSD, fecha: p.fechaPago }))
    ];

    todosLosGastos.forEach(g => {
        if (!g.fecha) return;
        const key = getPeriodKey(g.fecha);
        const curr = map.get(key) || { name: key, ingresos: 0, gastos: 0, sortKey: new Date(g.fecha).getTime() };
        curr.gastos += (Number(g.monto) || 0);
        map.set(key, curr);
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey).slice(-12);
  }, [cobranzas, gastosFijos, gastosInsumos, pagosEmpleados, filtroTiempo]);

  // --- 3. HISTORIAL RECIENTE (Últimos 5) ---
  const ultimosMovimientos = useMemo(() => {
    const ultimasCompras = [...(gastosInsumos || [])]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 5);

    const ultimosPagosNomina = [...(pagosEmpleados || [])]
        .sort((a, b) => new Date(b.fechaPago).getTime() - new Date(a.fechaPago).getTime())
        .slice(0, 5);

    return { ultimasCompras, ultimosPagosNomina };
  }, [gastosInsumos, pagosEmpleados]);

  // --- 4. SEGMENTACIÓN ---
  const segmentacion = useMemo(() => {
    const aliados = ordenes?.filter(o => o.cliente?.tipoCliente === 'ALIADO').length || 0;
    const regulares = (ordenes?.length || 0) - aliados;
    return [
        { name: 'Aliados', value: aliados, color: '#9333ea' },
        { name: 'Regulares', value: regulares, color: '#6366f1' }
    ];
  }, [ordenes]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 p-2 font-sans pb-24">
      
      {/* SECCIÓN 1: KPIs MAESTROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatIsland label="Ingresos Reales" val={kpis.ingresosTotal} sub="Total Cobranzas" icon={<TrendingUp size={20}/>} color="emerald" />
        <StatIsland label="Egresos Totales" val={kpis.egresosTotal} sub="Operativo + Nómina" icon={<ArrowDownLeft size={20}/>} color="rose" />
        <StatIsland label="Ticket Promedio" val={kpis.ticketPromedio} sub="Por Orden" icon={<ShoppingCart size={20}/>} color="blue" />
        <StatIsland label="Tasa de Aliados" val={kpis.tasaAliados} sub="% de Cartera" icon={<Percent size={20}/>} color="purple" isPercent />
      </div>

      {/* SECCIÓN 2: GRÁFICAS PRINCIPALES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* EVOLUCIÓN TEMPORAL GRANULAR */}
        <Card className="lg:col-span-2 p-8 rounded-[3rem] border-0 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden relative group">
          <div className="flex justify-between items-center mb-10 relative z-10">
            <div>
                <h3 className="text-2xl font-black tracking-tight uppercase italic">Flujo de Caja Detallado</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Movimientos Diarios vs Gastos</p>
            </div>
            <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-2xl gap-1">
                {(['semana', 'mes', 'año'] as const).map(f => (
                    <button key={f} onClick={() => setFiltroTiempo(f)} className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all", filtroTiempo === f ? "bg-white dark:bg-zinc-700 shadow-lg text-blue-600" : "text-slate-400")}>
                        {f}
                    </button>
                ))}
            </div>
          </div>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucionData}>
                    <defs>
                        <linearGradient id="colorIngreso" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                    <Bar name="Ingresos ($)" dataKey="ingresos" fill="#10b981" radius={[8, 8, 0, 0]} barSize={25} />
                    <Bar name="Gastos ($)" dataKey="gastos" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={25} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* VENTAS POR SEGMENTO (ÓRDENES) */}
        <Card className="p-8 rounded-[3rem] border-0 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black uppercase italic tracking-tighter">Segmentación</h3>
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500"><ShoppingCart size={20}/></div>
          </div>
          <div className="h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segmentacion} innerRadius={70} outerRadius={95} paddingAngle={10} dataKey="value" stroke="none">
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
                <div key={s.name} className="flex justify-between items-center p-4 rounded-[1.5rem] bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[10px] font-black text-slate-500 uppercase">{s.name}</span>
                    </div>
                    <span className="text-sm font-black">{s.value} <span className="text-[9px] text-slate-400 ml-1">TRABAJOS</span></span>
                </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECCIÓN 3: HISTORIAL RECIENTE (TABLAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ÚLTIMAS COMPRAS DE INSUMOS */}
        <Card className="p-8 rounded-[3rem] border-0 bg-white/60 dark:bg-zinc-900 shadow-xl border border-white/20">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl"><Package size={20}/></div>
                <h3 className="text-lg font-black uppercase italic">Últimas Compras</h3>
            </div>
            <div className="space-y-3">
                {ultimosMovimientos.ultimasCompras.length > 0 ? ultimosMovimientos.ultimasCompras.map((g, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-slate-50 dark:border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500"><ShoppingCart size={16}/></div>
                            <div>
                                <p className="text-[11px] font-black uppercase truncate max-w-[150px]">{g.nombre}</p>
                                <p className="text-[9px] font-bold text-slate-400">{new Date(g.fecha).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-rose-500">-${Number(g.monto).toLocaleString()}</p>
                    </div>
                )) : <div className="text-center py-10 text-[10px] font-bold text-slate-300 uppercase">Sin movimientos</div>}
            </div>
        </Card>

        {/* ÚLTIMOS PAGOS DE NÓMINA */}
        <Card className="p-8 rounded-[3rem] border-0 bg-white/60 dark:bg-zinc-900 shadow-xl border border-white/20">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl"><Users size={20}/></div>
                <h3 className="text-lg font-black uppercase italic">Pagos Recientes</h3>
            </div>
            <div className="space-y-3">
                {ultimosMovimientos.ultimosPagosNomina.length > 0 ? ultimosMovimientos.ultimosPagosNomina.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-slate-50 dark:border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500"><DollarSign size={16}/></div>
                            <div>
                                <p className="text-[11px] font-black uppercase truncate max-w-[150px]">{p.nombreEmpleado}</p>
                                <p className="text-[9px] font-bold text-slate-400">{new Date(p.fechaPago).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-emerald-600">${Number(p.totalUSD).toLocaleString()}</p>
                    </div>
                )) : <div className="text-center py-10 text-[10px] font-bold text-slate-300 uppercase">Sin movimientos</div>}
            </div>
        </Card>
      </div>
    </motion.div>
  )
}

function StatIsland({ label, val, sub, icon, color, isPercent = false }: any) {
  const styles: any = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
    blue: "bg-blue-500/10 text-blue-600",
    purple: "bg-purple-500/10 text-purple-600",
  }
  return (
    <motion.div whileHover={{ y: -5, scale: 1.02 }} className="p-8 rounded-[2.5rem] bg-white dark:bg-zinc-900 shadow-xl border border-slate-50 dark:border-white/5 relative overflow-hidden group transition-all">
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className={`p-3 rounded-2xl ${styles[color]}`}>{icon}</div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <div>
          <p className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
            {isPercent ? '' : '$'}{val.toLocaleString('en-US', { minimumFractionDigits: isPercent ? 1 : 2 })}
            {isPercent ? '%' : ''}
          </p>
          <p className="text-[10px] font-bold mt-1 text-slate-400 uppercase leading-none">{sub}</p>
        </div>
      </div>
    </motion.div>
  )
}

function cn(...inputs: any[]) { return inputs.filter(Boolean).join(' '); }