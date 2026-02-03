"use client"

import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, User, Phone, Mail, MapPin, 
  Trophy, Clock, AlertCircle, CheckCircle2, 
  TrendingUp, Wallet, ArrowRight, Layers,
  CalendarDays, Star
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

// --- HELPERS REUTILIZADOS PARA DETECCIÓN ---
const detectarMaterial = (items: any[]) => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
        const nombre = (item.nombre || '').toLowerCase();
        let key = 'Otros';
        if (nombre.includes('vinil') || nombre.includes('sticker')) key = 'Vinil';
        else if (nombre.includes('banner') || nombre.includes('lona')) key = 'Banner';
        else if (nombre.includes('mdf')) key = 'MDF';
        else if (nombre.includes('acrilico') || nombre.includes('acr')) key = 'Acrílico';
        else if (nombre.includes('micro') || nombre.includes('microperforado')) key = 'Microperforado';
        else if (nombre.includes('papel') || nombre.includes('tarjeta')) key = 'Papelería';
        
        counts[key] = (counts[key] || 0) + (Number(item.cantidad) || 1);
    });
    // Retornar top 3
    return Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k);
};

export function ClientesView({ ordenes }: { ordenes: any[] }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClient, setSelectedClient] = useState<any | null>(null)

  // --- LÓGICA DE PROCESAMIENTO DE CLIENTES ---
  const clientesProcesados = useMemo(() => {
      const map = new Map();

      ordenes.forEach(orden => {
          if (!orden.cliente || !orden.cliente.nombreRazonSocial) return;
          const clienteId = orden.cliente.id || orden.cliente.nombreRazonSocial; // Fallback al nombre si no hay ID
          
          if (!map.has(clienteId)) {
              map.set(clienteId, {
                  id: clienteId,
                  info: orden.cliente, // Guardamos datos de contacto
                  totalOrdenes: 0,
                  totalGastado: 0,
                  deudaTotal: 0,
                  tiemposPago: [], // Array para guardar dias que tardó en pagar
                  materialesItems: [], // Acumulamos items para analizar gustos
                  ultimaOrden: null
              });
          }

          const entry = map.get(clienteId);
          entry.totalOrdenes += 1;
          entry.totalGastado += Number(orden.totalUSD) || 0;
          
          // Cálculo de Deuda
          const pagado = Number(orden.montoPagadoUSD) || 0;
          const total = Number(orden.totalUSD) || 0;
          const deuda = Math.max(0, total - pagado);
          if (deuda > 0.01) entry.deudaTotal += deuda;

          // Cálculo de Tiempo de Pago
          // Si está pagado totalmente, calculamos la diferencia de fechas
          if (deuda <= 0.01 && orden.fecha) {
              // Buscamos la fecha del último pago registrado, si no existe, asumimos fecha de orden (contado)
              const fechaOrden = new Date(orden.fecha);
              let fechaPagoTotal = fechaOrden;
              
              if (orden.pagos && orden.pagos.length > 0) {
                  // Obtener la fecha más reciente de los pagos
                  const fechasPagos = orden.pagos.map((p: any) => new Date(p.fecha || p.createdAt));
                  fechaPagoTotal = new Date(Math.max(...fechasPagos.map((d: Date) => d.getTime())));
              }

              const diffTime = Math.abs(fechaPagoTotal.getTime() - fechaOrden.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              entry.tiemposPago.push(diffDays);
          }

          // Guardar items para análisis de materiales
          if (orden.items) entry.materialesItems.push(...orden.items);

          // Guardar fecha más reciente
          const fechaOrd = new Date(orden.fecha);
          if (!entry.ultimaOrden || fechaOrd > new Date(entry.ultimaOrden)) {
              entry.ultimaOrden = orden.fecha;
          }
      });

      // Procesamiento final (Promedios y Tops)
      return Array.from(map.values()).map((c: any) => {
          const avgDiasPago = c.tiemposPago.length > 0 
              ? c.tiemposPago.reduce((a:number, b:number) => a + b, 0) / c.tiemposPago.length 
              : 0;
          
          return {
              ...c,
              promedioPagoDias: Math.round(avgDiasPago),
              topMateriales: detectarMaterial(c.materialesItems),
              ticketPromedio: c.totalGastado / c.totalOrdenes
          };
      }).sort((a, b) => b.totalOrdenes - a.totalOrdenes); // Ordenar por fidelidad (cantidad de ordenes)
  }, [ordenes]);

  // --- FILTRO DE BÚSQUEDA ---
  const filteredClients = useMemo(() => {
      return clientesProcesados.filter(c => 
          c.info.nombreRazonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.info.telefono || '').includes(searchTerm)
      );
  }, [clientesProcesados, searchTerm]);

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-24 font-sans text-slate-800 dark:text-slate-100">
      
      {/* HEADER & BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#1c1c1e] p-5 rounded-[2.5rem] shadow-sm border border-black/5">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl">
                <User size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">Directorio de Clientes</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {clientesProcesados.length} Registrados &bull; Análisis de Comportamiento
                </p>
            </div>
        </div>
        
        <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, empresa o teléfono..." 
                className="pl-11 h-12 rounded-xl bg-slate-50 dark:bg-black/20 border-transparent focus:bg-white transition-all font-bold"
            />
        </div>
      </div>

      {/* GRID DE CLIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredClients.map((cliente, idx) => (
                <motion.div
                    key={cliente.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -5 }}
                    onClick={() => setSelectedClient(cliente)}
                    className="group bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] shadow-sm border border-black/5 hover:shadow-xl hover:border-indigo-500/20 transition-all cursor-pointer relative overflow-hidden"
                >
                    {/* Indicador de Estado (Solvente vs Deudor) */}
                    <div className={cn(
                        "absolute top-0 right-0 px-4 py-2 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest",
                        cliente.deudaTotal > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                        {cliente.deudaTotal > 0 ? `Deuda: $${cliente.deudaTotal}` : "Solvente"}
                    </div>

                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-xl font-black text-slate-500 uppercase">
                            {cliente.info.nombreRazonSocial.slice(0, 2)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <h3 className="text-lg font-black truncate text-slate-800 dark:text-white mb-1">
                                {cliente.info.nombreRazonSocial}
                            </h3>
                            <div className="flex flex-col gap-1">
                                {cliente.info.telefono && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                        <Phone size={10} /> {cliente.info.telefono}
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                    <Trophy size={10} className="text-yellow-500" /> {cliente.totalOrdenes} Órdenes totales
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-slate-50 dark:bg-black/20 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tiempo de Pago</p>
                            <div className="flex items-center gap-2">
                                <Clock size={14} className={cliente.promedioPagoDias < 5 ? "text-emerald-500" : "text-orange-500"} />
                                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                    {cliente.promedioPagoDias === 0 ? "Contado" : `~${cliente.promedioPagoDias} días`}
                                </p>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-black/20 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Total Histórico</p>
                            <div className="flex items-center gap-2">
                                <Wallet size={14} className="text-indigo-500" />
                                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                    ${cliente.totalGastado.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Suele Contratar</p>
                        <div className="flex flex-wrap gap-1.5">
                            {cliente.topMateriales.map((mat: string, i: number) => (
                                <span key={i} className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-[10px] font-bold uppercase border border-indigo-100 dark:border-indigo-500/20">
                                    {mat}
                                </span>
                            ))}
                            {cliente.topMateriales.length === 0 && <span className="text-[10px] text-slate-400 italic">Sin datos suficientes</span>}
                        </div>
                    </div>
                </motion.div>
            ))}
          </AnimatePresence>
      </div>

      {/* MODAL DETALLE DE CLIENTE */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-[#1c1c1e] border-none rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
             {selectedClient && (
                 <>
                    <div className="p-8 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-3xl font-black italic uppercase text-slate-900 dark:text-white mb-2">
                                    {selectedClient.info.nombreRazonSocial}
                                </h2>
                                <div className="flex gap-4">
                                    {selectedClient.info.email && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <Mail size={12}/> {selectedClient.info.email}
                                        </span>
                                    )}
                                    {selectedClient.info.direccion && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                            <MapPin size={12}/> {selectedClient.info.direccion}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Última Actividad</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {selectedClient.ultimaOrden ? new Date(selectedClient.ultimaOrden).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-black/20 p-4 rounded-2xl shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fidelidad</p>
                                <p className="text-2xl font-black text-indigo-600">{selectedClient.totalOrdenes}</p>
                                <p className="text-[9px] font-bold text-slate-400">Órdenes totales</p>
                            </div>
                            <div className="bg-white dark:bg-black/20 p-4 rounded-2xl shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ticket Prom.</p>
                                <p className="text-2xl font-black text-emerald-600">${Math.round(selectedClient.ticketPromedio)}</p>
                                <p className="text-[9px] font-bold text-slate-400">Por orden</p>
                            </div>
                            <div className="bg-white dark:bg-black/20 p-4 rounded-2xl shadow-sm">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Velocidad</p>
                                <p className="text-2xl font-black text-blue-600">{selectedClient.promedioPagoDias}d</p>
                                <p className="text-[9px] font-bold text-slate-400">Prom. pago</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                            <Star size={14} className="text-yellow-500"/> Análisis de Materiales
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-8">
                            {selectedClient.topMateriales.map((m:string, i:number) => (
                                <span key={i} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl text-xs font-black uppercase">
                                    {i+1}. {m}
                                </span>
                            ))}
                        </div>

                        {selectedClient.deudaTotal > 0 && (
                             <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 p-4 rounded-2xl flex items-center gap-4">
                                <AlertCircle size={24} className="text-rose-500" />
                                <div>
                                    <p className="text-xs font-black text-rose-700 uppercase">Saldo Pendiente</p>
                                    <p className="text-sm text-rose-600 font-bold">
                                        Este cliente tiene una deuda activa de <span className="text-lg font-black">${selectedClient.deudaTotal.toFixed(2)}</span>
                                    </p>
                                </div>
                             </div>
                        )}
                         {selectedClient.deudaTotal <= 0 && (
                             <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                                <CheckCircle2 size={24} className="text-emerald-500" />
                                <div>
                                    <p className="text-xs font-black text-emerald-700 uppercase">Cliente Solvente</p>
                                    <p className="text-sm text-emerald-600 font-bold">
                                        No tiene deudas pendientes actualmente.
                                    </p>
                                </div>
                             </div>
                        )}
                    </div>
                 </>
             )}
        </DialogContent>
      </Dialog>
    </div>
  )
}