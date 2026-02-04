// @/components/dashboard/InsumosView.tsx
"use client"

import React, { useState, useMemo } from "react"
import { 
  Package, 
  ShoppingBag, 
  TrendingUp, 
  ArrowUpRight,
  PlusCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { GastosForm } from "./gastos-form"
import { GastosList } from "./gastos-list"

interface InsumosViewProps {
  gastos: any[]
  currentBcvRate: number
  currentUserId: string
  onCreateGasto: (data: any) => Promise<void>
  onDeleteGasto: (id: string) => Promise<void>
}

export function InsumosView({ 
  gastos, 
  currentBcvRate, 
  currentUserId,
  onCreateGasto,
  onDeleteGasto 
}: InsumosViewProps) {
  
  const [isSaving, setIsSaving] = useState(false)
  const [editingInsumo, setEditingInsumo] = useState<any>(null)

  // --- 1. FILTRO MAESTRO: SOLO INSUMOS ---
  // Esto elimina de la vista cualquier registro que sea pago de servicios, nómina o fijo.
  const gastosFiltrados = useMemo(() => {
    return gastos.filter(g => {
        const cat = (g.categoria || "").toLowerCase();
        const tipo = (g.tipo || "").toUpperCase();
        const nombre = (g.nombre || "").toUpperCase();

        // Si es explícitamente un gasto fijo, servicio o nómina -> LO IGNORAMOS
        if (cat === 'gasto fijo' || cat === 'servicios' || cat === 'serviciospublicos') return false;
        if (tipo === 'FIJO' || tipo === 'NOMINA') return false;
        if (nombre.startsWith('[PAGO SERVICIO]')) return false;

        return true; // Solo pasan Insumos, Materiales, Otros, etc.
    });
  }, [gastos]);

  // --- 2. KPI CALCULADOS SOBRE LOS FILTRADOS ---
  const stats = useMemo(() => {
    const totalUSD = gastosFiltrados.reduce((acc, g) => acc + (Number(g.monto) || Number(g.montoUSD) || 0), 0);
    const totalBs = totalUSD * currentBcvRate;
    const sinClasificar = gastosFiltrados.filter(g => !g.area).length; 
    
    return {
      count: gastosFiltrados.length,
      usd: totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      bs: totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
      pending: sinClasificar
    };
  }, [gastosFiltrados, currentBcvRate]);

  const handleSubmit = async (data: any) => {
    setIsSaving(true)
    try {
      const { id, ...camposDeContenido } = data;
      // Aseguramos que los nuevos registros tengan categoría válida por defecto si no se elige
      const gastoFinal: any = {
        ...camposDeContenido,
        empresa_id: currentUserId,
        categoria: camposDeContenido.categoria || "insumos", // Default seguro
        fecha: camposDeContenido.fecha ? new Date(camposDeContenido.fecha) : new Date(),
        updatedAt: new Date()
      };

      if (id) {
        await onCreateGasto({ ...gastoFinal, id });
      } else {
        await onCreateGasto({ ...gastoFinal, createdAt: new Date() });
      }
      setEditingInsumo(null)
    } catch (error) {
      console.error("Error al procesar:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleQuickCategorize = async (id: string, area: string) => {
      const gastoOriginal = gastos.find(g => g.id === id);
      if (!gastoOriginal) return;

      const gastoActualizado = {
          ...gastoOriginal,
          area: area,
          updatedAt: new Date()
      };

      try {
          await onCreateGasto(gastoActualizado);
      } catch (error) {
          console.error("Error al clasificar rápido:", error);
      }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    try { await onDeleteGasto(id) } catch (error) { console.error(error) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 px-6 animate-in fade-in duration-700">
      
      {/* HEADER SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Título */}
        <div className="md:col-span-1 bg-white dark:bg-[#1c1c1e] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-none">
                Insumos <br/><span className="text-blue-600">& Materiales</span>
              </h2>
            </div>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 opacity-70">
            Control de Operaciones SMR
          </p>
        </div>

        {/* Total Inversión */}
        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white flex flex-col justify-between relative overflow-hidden group">
          <TrendingUp className="absolute right-[-10px] top-[-10px] w-32 h-32 text-white/10 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 opacity-80">Inversión Total (USD)</p>
          <div className="mt-4">
            <h3 className="text-4xl font-black tracking-tighter">${stats.usd}</h3>
            <p className="text-blue-200 text-[10px] font-bold mt-1">≈ {stats.bs} Bs.</p>
          </div>
        </div>

        {/* Pendientes de Clasificar */}
        <div className="bg-white dark:bg-[#1c1c1e] p-8 rounded-[2.5rem] border border-black/5 dark:border-white/5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            
            {stats.pending > 0 && (
                <div className="bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 animate-pulse border border-amber-500/20">
                    <AlertCircle size={10} />
                    {stats.pending} Sin clasificar
                </div>
            )}
          </div>
          <div>
            <h3 className="text-4xl font-black tracking-tighter mt-4">{stats.count}</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Registros</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* PANEL IZQUIERDO: Formulario */}
        <div className="lg:col-span-5 space-y-4 sticky top-24">
          <AnimatePresence mode="wait">
            {editingInsumo && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-indigo-600 text-white px-6 py-4 rounded-[1.5rem] flex items-center justify-between shadow-lg shadow-indigo-500/20"
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Modo Edición Activo</span>
                </div>
                <button onClick={() => setEditingInsumo(null)} className="hover:scale-110 transition-transform">
                  <XCircle className="w-5 h-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <GastosForm 
            onSubmit={handleSubmit} 
            bcvRate={currentBcvRate} 
            isLoading={isSaving}
            initialData={editingInsumo} 
          />
        </div>

        {/* PANEL DERECHO: Listado (SOLO FILTRADOS) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-400 italic">
              Historial de Adquisiciones
            </h3>
            <div className="h-px flex-1 bg-black/5 dark:bg-white/5 mx-6" />
            <ArrowUpRight className="w-4 h-4 text-slate-300" />
          </div>
          
          <div className="bg-white/20 dark:bg-black/10 rounded-[3rem] p-2 backdrop-blur-sm">
            <GastosList 
              gastos={gastosFiltrados} // AQUI PASAMOS SOLO LOS FILTRADOS
              onDelete={handleDelete}
              onEdit={(g: any) => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setEditingInsumo(g);
              }}
              onQuickCategory={handleQuickCategorize}
            />
          </div>
        </div>
      </div>
    </div>
  )
}