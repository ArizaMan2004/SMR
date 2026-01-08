"use client"

import React, { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { 
  ArrowUpRight, ArrowDownLeft, TrendingUp, Users, 
  Receipt, Wallet, CheckCircle2, AlertCircle, Activity,
  Building2, Package, Layers, ShoppingBag
} from "lucide-react"

// Tipos basados en tu implementación real
import type { GastoInsumo, GastoFijo, Empleado, PagoEmpleado, Cobranza } from "@/lib/types/gastos"

interface EstadisticasDashboardProps {
  gastosInsumos: GastoInsumo[]
  gastosFijos: GastoFijo[]
  empleados: Empleado[]
  pagosEmpleados: PagoEmpleado[]
  cobranzas: Cobranza[]
}

export function EstadisticasDashboard({
  gastosInsumos,
  gastosFijos,
  empleados,
  pagosEmpleados,
  cobranzas,
}: EstadisticasDashboardProps) {

  const mesActualStr = new Date().toISOString().slice(0, 7); 

  const finanzas = useMemo(() => {
    const ingresosUSD = cobranzas?.filter(c => c.estado === "pagado").reduce((s, c) => s + (c.montoUSD || 0), 0) || 0;
    const ingresosBS = cobranzas?.filter(c => c.estado === "pagado").reduce((s, c) => s + (c.montoBs || 0), 0) || 0;

    const pagadoUSD = pagosEmpleados
      ?.filter(p => p.mesRelativo === mesActualStr)
      .reduce((s, p) => s + (Number(p.totalUSD) || 0), 0) || 0;

    let pendienteUSD = 0;
    empleados?.forEach(e => {
      const sueldoBase = e.ultimoPagoMes === mesActualStr ? 0 : (Number(e.montoSueldo) || 0);
      const comisiones = e.comisiones?.reduce((a: number, c: any) => a + (Number(c.monto) || 0), 0) || 0;
      pendienteUSD += (sueldoBase + comisiones);
    });

    const fijosUSD = gastosFijos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0;
    const operativosUSD = gastosInsumos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0;

    const egresoProyectado = pagadoUSD + fijosUSD + operativosUSD + pendienteUSD;

    return {
      ingresosUSD, ingresosBS,
      pagadoUSD, pendienteUSD,
      fijosUSD, operativosUSD,
      egresoProyectado,
      balance: ingresosUSD - egresoProyectado
    };
  }, [cobranzas, pagosEmpleados, empleados, gastosFijos, gastosInsumos, mesActualStr]);

  // Combinación de gastos para el resumen visual
  const resumenGastos = useMemo(() => {
    const fijos = (gastosFijos || []).map(g => ({ ...g, tipo: 'Fijo', color: 'orange', icon: <Building2 size={18} /> }));
    const insumos = (gastosInsumos || []).map(g => ({ ...g, tipo: 'Insumo', color: 'blue', icon: <Package size={18} /> }));
    return [...fijos, ...insumos].sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0));
  }, [gastosFijos, gastosInsumos]);

  const chartData = [
    { name: "Nómina", valor: finanzas.pagadoUSD + finanzas.pendienteUSD, color: "#5856D6" },
    { name: "Fijos", valor: finanzas.fijosUSD, color: "#FF9500" },
    { name: "Insumos", valor: finanzas.operativosUSD, color: "#007AFF" },
  ].filter(d => d.valor > 0);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-12 p-2 font-sans pb-20"
    >
      {/* KPI TOP SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatIsland label="Cobranzas Totales" val={finanzas.ingresosUSD} sub={`Bs. ${finanzas.ingresosBS.toLocaleString()}`} icon={<ArrowUpRight size={24} />} color="emerald" />
        <StatIsland label="Egresos Proyectados" val={finanzas.egresoProyectado} sub="Nómina, Fijos e Insumos" icon={<ArrowDownLeft size={24} />} color="rose" />
        <StatIsland label="Balance del Mes" val={finanzas.balance} sub={finanzas.balance >= 0 ? "Superávit Operativo" : "Déficit Proyectado"} icon={<Activity size={24} />} color={finanzas.balance >= 0 ? "blue" : "orange"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* GRÁFICO DE DISTRIBUCIÓN */}
        <Card className="p-10 rounded-[3.5rem] border-0 bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl shadow-2xl shadow-slate-200/50">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black tracking-tighter">Estructura de Gastos</h3>
            <Layers className="text-slate-300" size={28} />
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload?.length) return (
                      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-5 rounded-[2rem] shadow-2xl border border-white/20">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">${payload[0].value.toLocaleString()}</p>
                      </div>
                    )
                    return null;
                  }}
                />
                <Bar dataKey="valor" radius={[15, 15, 15, 15]} barSize={55}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* MONITOR DE NÓMINA */}
        <Card className="p-10 rounded-[3.5rem] border-0 bg-white/70 dark:bg-slate-900/40 backdrop-blur-3xl shadow-2xl shadow-slate-200/50 flex flex-col">
          <h3 className="text-2xl font-black tracking-tighter mb-2">Monitor de Nómina</h3>
          <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest">Ejecución vs Pendiente</p>
          <div className="h-[280px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Liquidado", value: finanzas.pagadoUSD, color: "#34C759" },
                    { name: "Pendiente", value: finanzas.pendienteUSD, color: "#FF3B30" }
                  ]}
                  innerRadius={90} outerRadius={120} paddingAngle={12} dataKey="value" stroke="none"
                >
                  <Cell fill="#34C759" />
                  <Cell fill="#FF3B30" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compromiso Total</span>
              <span className="text-4xl font-black text-slate-900 dark:text-white">
                ${(finanzas.pagadoUSD + finanzas.pendienteUSD).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-auto pt-6 border-t border-slate-100">
            <div className="flex flex-col items-center">
              <p className="text-[11px] font-black text-emerald-600 uppercase mb-1">Liquidado</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">${finanzas.pagadoUSD.toLocaleString()}</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-[11px] font-black text-rose-600 uppercase mb-1">Pendiente</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">${finanzas.pendienteUSD.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* NUEVA SECCIÓN: RESUMEN DE GASTOS FIJOS E INSUMOS */}
      <Card className="p-10 rounded-[4rem] border-0 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h4 className="font-black text-xl tracking-tighter">Gastos Administrativos</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Operaciones</p>
            </div>
          </div>
          <div className="flex gap-4">
             <div className="px-4 py-2 rounded-full bg-orange-100 text-orange-600 text-[9px] font-black uppercase tracking-widest">Fijos: ${finanzas.fijosUSD.toFixed(0)}</div>
             <div className="px-4 py-2 rounded-full bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-widest">Insumos: ${finanzas.operativosUSD.toFixed(0)}</div>
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
                    {gasto.nombre || gasto.descripcion || "Sin descripción"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {gasto.categoria || "Gasto General"}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {resumenGastos.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-300 opacity-50">
              <AlertCircle size={40} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">No hay gastos registrados</p>
            </div>
          )}
        </div>
      </Card>

      {/* LISTA DE PAGOS DE NÓMINA (YA EXISTENTE) */}
      <Card className="p-10 rounded-[4rem] border-0 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-200">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="font-black text-xl tracking-tighter">Liquidaciones Realizadas</h4>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nómina del mes {mesActualStr}</p>
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
                    <p className="text-[9px] font-bold text-slate-300">REF: {pago.tasaBCV?.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{pago.nombre}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                    {pago.conceptos?.[0]?.tipo || "Pago General"}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {(!pagosEmpleados || pagosEmpleados.length === 0) && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-300 opacity-50">
              <AlertCircle size={40} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.3em]">Sin liquidaciones este mes</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

// --- SUB-COMPONENTES ---

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