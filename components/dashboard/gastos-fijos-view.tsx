// @/components/dashboard/gastos-fijos-view.tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
    TrendingDown, CheckCircle2, Clock, AlertCircle, 
    Calculator, X, Plus, Loader2 
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog" 
import { GastosFijosForm } from "./gastos-fijos-form"
import { GastosFijosList } from "./gastos-fijos-list"
import type { GastoFijo } from "@/lib/types/gastos"
import { createGasto, deleteGastoFijo, updateGastoFijo, createGastoFijo } from "@/lib/services/gastos-service"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ViewProps {
    gastos: GastoFijo[];
    rates: any;
    onNotification?: (title: string, message: string) => void;
}

export function GastosFijosView({ gastos, rates }: ViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingGasto, setEditingGasto] = useState<GastoFijo | null>(null)
  const [variablePaymentGasto, setVariablePaymentGasto] = useState<GastoFijo | null>(null)
  const [montoBsInput, setMontoBsInput] = useState("")

  const tasaUSD = useMemo(() => Number(rates?.usd || rates?.usdRate || rates?.rate || 0), [rates]);
  const tasaEUR = useMemo(() => Number(rates?.eur || rates?.eurRate || 0), [rates]);

  const usdEquivalent = useMemo(() => {
    const bs = parseFloat(montoBsInput) || 0;
    return tasaUSD <= 0 ? "0.00" : (bs / tasaUSD).toFixed(2);
  }, [montoBsInput, tasaUSD]);

  const stats = useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anoActual = ahora.getFullYear();

    return gastos.reduce((acc: any, g: GastoFijo) => {
      const fechaUltimo = g.ultimoPago instanceof Date ? g.ultimoPago : (g.ultimoPago as any)?.toDate?.() || null;
      const esPagadoEsteMes = fechaUltimo && 
                              fechaUltimo.getMonth() === mesActual && 
                              fechaUltimo.getFullYear() === anoActual;

      const montoUSD = Number(g.monto) || 0;
      acc.totalPresupuesto += montoUSD;

      if (esPagadoEsteMes) {
        acc.pagados.push(g);
        acc.montoPagadoUSD += (Number(g.ultimoMontoPagadoUSD) || montoUSD);
      } else {
        acc.pendientes.push(g);
        acc.montoPendienteUSD += montoUSD;
      }
      return acc;
    }, { pendientes: [], pagados: [], totalPresupuesto: 0, montoPagadoUSD: 0, montoPendienteUSD: 0 });
  }, [gastos]);

  const handleRefresh = () => router.refresh();

  const handleSave = async (data: any) => {
    setIsLoading(true);
    try {
      if (editingGasto) {
        await updateGastoFijo(editingGasto.id, { ...data, proximoPago: new Date(data.proximoPago) });
      } else {
        await createGastoFijo({ 
            ...data, 
            proximoPago: new Date(data.proximoPago), 
            ultimoPago: null 
            // empresa_id REMOVIDO
        });
      }
      setShowForm(false);
      setEditingGasto(null);
      toast.success("Registro actualizado en base de datos global");
      handleRefresh();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setIsLoading(false);
    }
  };

  const processFinalPay = useCallback(async (gasto: GastoFijo, montoBsManual?: number) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (tasaUSD <= 0) throw new Error("Tasa no válida");

      const safeTasaUSD = tasaUSD;
      const tasaAplicada = gasto.moneda === 'BS_EUR' ? (tasaEUR || 1) : safeTasaUSD;
      
      let montoBsFinal = montoBsManual || (gasto.monto * tasaAplicada);
      let montoUSDFinal = montoBsManual ? (montoBsManual / safeTasaUSD) : gasto.monto;

      await createGasto({
        nombre: `[PAGO SERVICIO] ${gasto.nombre}`,
        descripcion: `Pago mensual global - categoría ${gasto.categoria}.`,
        montoUSD: montoUSDFinal,
        montoBs: montoBsFinal,
        categoria: "Gasto Fijo",
        fecha: new Date(),
        metodoPago: gasto.moneda === 'USD' ? 'Divisas' : `Bolívares (${gasto.moneda})`
        // empresa_id REMOVIDO
      });

      const currentNext = gasto.proximoPago instanceof Date ? gasto.proximoPago : (gasto.proximoPago as any).toDate();
      const newNext = new Date(currentNext);
      newNext.setMonth(newNext.setMonth(newNext.getMonth() + 1));

      await updateGastoFijo(gasto.id, {
        proximoPago: newNext,
        ultimoPago: new Date(),
        ultimoMontoPagadoUSD: montoUSDFinal,
        ultimoMontoPagadoBs: montoBsFinal
      });

      toast.success("Pago registrado exitosamente");
      setVariablePaymentGasto(null);
      setMontoBsInput("");
      handleRefresh();
    } catch (error) { 
        toast.error("Error en el pago"); 
    } finally { 
        setIsLoading(false); 
    }
  }, [tasaUSD, tasaEUR, isLoading]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este servicio global?")) return;
    try {
        await deleteGastoFijo(id);
        toast.success("Eliminado");
        handleRefresh();
    } catch (e) { toast.error("Error al eliminar"); }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 rounded-[3rem] bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Presupuesto Mensual Compartido</p>
                <h2 className="text-5xl font-black tracking-tighter italic">${stats.totalPresupuesto.toFixed(2)}</h2>
                <Button 
                    onClick={() => { setEditingGasto(null); setShowForm(true); }}
                    className="mt-6 w-full rounded-2xl h-12 bg-blue-600 hover:bg-blue-700 font-black text-[11px] uppercase tracking-widest transition-all gap-2"
                >
                    <Plus className="w-4 h-4" /> Nuevo Servicio Global
                </Button>
            </div>
            <TrendingDown className="absolute -bottom-10 -right-10 w-48 h-48 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
        </Card>

        <Card className="p-8 rounded-[3rem] bg-white dark:bg-[#1c1c1e] border-black/5 shadow-xl flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">Cuentas Pendientes</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">${stats.montoPendienteUSD.toFixed(2)}</h2>
        </Card>

        <Card className="p-8 rounded-[3rem] bg-white dark:bg-[#1c1c1e] border-black/5 shadow-xl flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Total Pagado (Mes)</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">${stats.montoPagadoUSD.toFixed(2)}</h2>
        </Card>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if(!open) setEditingGasto(null); }}>
        <DialogContent className="max-w-xl p-0 border-none bg-transparent shadow-none overflow-visible">
            <DialogTitle className="sr-only">Formulario Global</DialogTitle>
            <GastosFijosForm 
                onSubmit={handleSave} 
                isLoading={isLoading} 
                rates={{ usd: tasaUSD, eur: tasaEUR }} 
                initialData={editingGasto} 
            />
        </DialogContent>
      </Dialog>

      <div className="space-y-16">
        <div className="space-y-6">
            <h3 className="flex items-center gap-3 text-orange-600 px-4">
                <AlertCircle className="w-6 h-6" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em]">Pendientes Compartidos</span>
            </h3>
            <GastosFijosList 
                gastos={stats.pendientes} 
                onPay={(g: any) => (g.categoria?.toLowerCase().includes("impuesto") || g.monto === 0) ? setVariablePaymentGasto(g) : processFinalPay(g)} 
                onDelete={(id: any) => handleDelete(id)} 
                onEdit={(g: any) => { setEditingGasto(g); setShowForm(true); }} 
                isLoading={isLoading} 
            />
        </div>

        {stats.pagados.length > 0 && (
            <div className="space-y-6 pt-10 border-t border-black/5">
                <h3 className="flex items-center gap-3 px-4 text-emerald-600 opacity-60">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-[11px] font-black uppercase tracking-[0.4em]">Solventes</span>
                </h3>
                <div className="opacity-60">
                    <GastosFijosList gastos={stats.pagados} onPay={() => {}} onDelete={() => {}} onEdit={() => {}} isLoading={false} isPaidMode={true} />
                </div>
            </div>
        )}
      </div>

      <Dialog open={!!variablePaymentGasto} onOpenChange={(open) => !open && setVariablePaymentGasto(null)}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">Monto Real</DialogTitle>
          <div className="bg-white dark:bg-[#1c1c1e] w-full rounded-[3rem] p-10 shadow-2xl border border-black/5">
              <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                          <Calculator size={28} />
                      </div>
                      <h4 className="text-2xl font-black italic uppercase">Monto Real</h4>
                  </div>
                  <button onClick={() => setVariablePaymentGasto(null)}><X className="text-slate-400" /></button>
              </div>
              <div className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Total en Bolívares</label>
                      <div className="relative">
                          <input 
                              autoFocus type="number" value={montoBsInput} onChange={(e) => setMontoBsInput(e.target.value)}
                              className="w-full px-7 py-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] outline-none font-black text-4xl text-blue-600 placeholder:opacity-20"
                              placeholder="0,00"
                          />
                          <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-slate-300 italic text-xl">Bs.</span>
                      </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-dashed border-black/10">
                      <div className="flex justify-between items-center">
                          <span className="text-slate-400 uppercase tracking-widest text-[9px]">Equivalente USD</span>
                          <span className="font-black text-slate-900 dark:text-white text-lg">${usdEquivalent}</span>
                      </div>
                  </div>
                  <Button 
                      disabled={!montoBsInput || isLoading || tasaUSD <= 0}
                      onClick={() => variablePaymentGasto && processFinalPay(variablePaymentGasto, Number(montoBsInput))}
                      className="w-full h-16 rounded-[2rem] bg-blue-600 hover:bg-blue-700 font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                      {isLoading ? <Loader2 className="animate-spin" /> : "Confirmar Pago Global"}
                  </Button>
              </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}