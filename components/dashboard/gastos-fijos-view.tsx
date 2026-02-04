// @/components/dashboard/gastos-fijos-view.tsx
"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
    TrendingDown, CheckCircle2, Clock, AlertCircle, 
    Calculator, X, Plus, Loader2, CreditCard, Wallet,
    BellRing // Icono para alerta
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
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

// MÉTODOS DE PAGO
const PAYMENT_METHODS = [
    { value: "Efectivo USD", label: "Caja Chica ($)" },
    { value: "Pago Móvil (Bs)", label: "Banco Nacional (Bs)" },
    { value: "Zelle", label: "Zelle" },
    { value: "Binance USDT", label: "Binance" },
    { value: "Efectivo Bs", label: "Caja Chica (Bs)" }
];

export function GastosFijosView({ gastos, rates, onNotification }: ViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingGasto, setEditingGasto] = useState<GastoFijo | null>(null)
  
  // Estado para el modal de pago
  const [paymentTarget, setPaymentTarget] = useState<GastoFijo | null>(null)
  const [montoBsInput, setMontoBsInput] = useState("")
  const [selectedMethod, setSelectedMethod] = useState("Efectivo USD")

  // Ref para evitar spam de notificaciones en cada render
  const hasNotifiedRef = useRef(false);

  // Aseguramos que existan tasas
  const tasaUSD = useMemo(() => Number(rates?.usd || rates?.usdRate || rates?.rate || 0), [rates]);
  const tasaEUR = useMemo(() => Number(rates?.eur || rates?.eurRate || 0), [rates]);

  // --- LÓGICA DE ESTADÍSTICAS Y ALERTAS ---
  const stats = useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anoActual = ahora.getFullYear();
    const hoyMs = ahora.getTime();

    // Arrays para clasificar
    const pendientes: GastoFijo[] = [];
    const pagados: GastoFijo[] = [];
    const urgentes: GastoFijo[] = [];

    let totalPresupuesto = 0;
    let montoPagadoUSD = 0;
    let montoPendienteUSD = 0;

    gastos.forEach((g: GastoFijo) => {
      const fechaUltimo = g.ultimoPago instanceof Date ? g.ultimoPago : (g.ultimoPago as any)?.toDate?.() || null;
      const esPagadoEsteMes = fechaUltimo && 
                              fechaUltimo.getMonth() === mesActual && 
                              fechaUltimo.getFullYear() === anoActual;

      const montoUSD = Number(g.monto) || 0;
      totalPresupuesto += montoUSD;

      if (esPagadoEsteMes) {
        pagados.push(g);
        montoPagadoUSD += (Number(g.ultimoMontoPagadoUSD) || montoUSD);
      } else {
        pendientes.push(g);
        montoPendienteUSD += montoUSD;

        // Verificar si es urgente (Vence en 3 días o menos, o ya venció)
        if (g.proximoPago) {
            const fechaProx = g.proximoPago instanceof Date ? g.proximoPago : (g.proximoPago as any).toDate();
            const diffDias = Math.ceil((fechaProx.getTime() - hoyMs) / (1000 * 60 * 60 * 24));
            
            if (diffDias <= 3) {
                urgentes.push(g);
            }
        }
      }
    });

    return { pendientes, pagados, urgentes, totalPresupuesto, montoPagadoUSD, montoPendienteUSD };
  }, [gastos]);

  // --- EFECTO: DISPARAR NOTIFICACIÓN AL ENTRAR ---
  useEffect(() => {
    if (stats.urgentes.length > 0 && !hasNotifiedRef.current && onNotification) {
        const count = stats.urgentes.length;
        const msg = count === 1 
            ? `El servicio "${stats.urgentes[0].nombre}" está próximo a vencer.`
            : `Tienes ${count} servicios por pagar urgentemente.`;
        
        onNotification("Atención Tesorería", msg);
        hasNotifiedRef.current = true; // Marcar como notificado para esta sesión del componente
    }
  }, [stats.urgentes, onNotification]);

  // Inicializar modal de pago
  useEffect(() => {
    if (paymentTarget && tasaUSD > 0) {
        if (paymentTarget.monto > 0) {
            setMontoBsInput((paymentTarget.monto * tasaUSD).toFixed(2));
        } else {
            setMontoBsInput("");
        }
        setSelectedMethod("Efectivo USD"); 
    }
  }, [paymentTarget, tasaUSD]);

  const usdEquivalent = useMemo(() => {
    const bs = parseFloat(montoBsInput) || 0;
    return tasaUSD <= 0 ? "0.00" : (bs / tasaUSD).toFixed(2);
  }, [montoBsInput, tasaUSD]);

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
        });
      }
      setShowForm(false);
      setEditingGasto(null);
      toast.success("Registro actualizado");
      handleRefresh();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setIsLoading(false);
    }
  };

  const processFinalPay = useCallback(async () => {
    if (isLoading || !paymentTarget) return;

    if (tasaUSD <= 0) {
        toast.error("Error: Tasa de cambio no cargada.");
        return;
    }

    setIsLoading(true);
    try {
      const bsAmount = parseFloat(montoBsInput) || 0;
      const usdAmount = parseFloat(usdEquivalent) || 0;

      // 1. Crear el gasto en el historial
      await createGasto({
        nombre: `[PAGO SERVICIO] ${paymentTarget.nombre}`,
        descripcion: `Pago mensual - ${paymentTarget.categoria}`,
        montoUSD: usdAmount,
        montoBs: bsAmount,
        monto: usdAmount,
        categoria: "Gasto Fijo",
        tipo: "FIJO",
        fecha: new Date(),
        metodoPago: selectedMethod,
        proveedor: paymentTarget.proveedor || "Servicio",
        tasaDolar: tasaUSD
      });

      // 2. Actualizar fecha próximo pago
      const currentNext = paymentTarget.proximoPago instanceof Date ? paymentTarget.proximoPago : (paymentTarget.proximoPago as any).toDate();
      const newNext = new Date(currentNext);
      newNext.setMonth(newNext.getMonth() + 1);

      await updateGastoFijo(paymentTarget.id, {
        proximoPago: newNext,
        ultimoPago: new Date(),
        ultimoMontoPagadoUSD: usdAmount,
        ultimoMontoPagadoBs: bsAmount,
        ultimoMetodoPago: selectedMethod // Actualizamos el último método usado
      });

      toast.success("Pago registrado correctamente");
      setPaymentTarget(null);
      setMontoBsInput("");
      handleRefresh();
    } catch (error) { 
        console.error(error);
        toast.error("Error al procesar el pago"); 
    } finally { 
        setIsLoading(false); 
    }
  }, [tasaUSD, isLoading, paymentTarget, montoBsInput, usdEquivalent, selectedMethod]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este servicio global?")) return;
    try {
        await deleteGastoFijo(id);
        toast.success("Eliminado");
        handleRefresh();
    } catch (e) { toast.error("Error al eliminar"); }
  }

  const handlePayClick = (g: GastoFijo) => {
    setPaymentTarget(g);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4">
      
      {/* ALERTA VISUAL SI HAY DEUDAS URGENTES */}
      <AnimatePresence>
        {stats.urgentes.length > 0 && (
            <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 p-4 rounded-[2rem] flex items-center gap-4 shadow-sm"
            >
                <div className="bg-rose-100 dark:bg-rose-900/30 p-2.5 rounded-full text-rose-600 animate-pulse">
                    <BellRing size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 uppercase tracking-wide">Atención Requerida</h4>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Tienes {stats.urgentes.length} servicio(s) que vencen pronto o están vencidos.
                    </p>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* KPI CARDS */}
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

      {/* FORMULARIO */}
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

      {/* LISTAS */}
      <div className="space-y-16">
        <div className="space-y-6">
            <h3 className="flex items-center gap-3 text-orange-600 px-4">
                <AlertCircle className="w-6 h-6" />
                <span className="text-[11px] font-black uppercase tracking-[0.4em]">Pendientes Compartidos</span>
            </h3>
            <GastosFijosList 
                gastos={stats.pendientes} 
                onPay={handlePayClick} 
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

      {/* --- MODAL DE PAGO (MEJORADO) --- */}
      <Dialog open={!!paymentTarget} onOpenChange={(open) => !open && setPaymentTarget(null)}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">Procesar Pago</DialogTitle>
          <div className="bg-white dark:bg-[#1c1c1e] w-full rounded-[3rem] p-10 shadow-2xl border border-black/5">
              <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                          <Wallet size={28} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black italic uppercase text-slate-900 dark:text-white leading-none">Liquidar Servicio</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{paymentTarget?.nombre}</p>
                      </div>
                  </div>
                  <button onClick={() => setPaymentTarget(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="text-slate-400 w-6 h-6" /></button>
              </div>
              
              <div className="space-y-6">
                  {/* INPUT MONTO BS */}
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Total Pagado en Bolívares</label>
                      <div className="relative">
                          <input 
                              autoFocus 
                              type="number" 
                              value={montoBsInput} 
                              onChange={(e) => setMontoBsInput(e.target.value)}
                              className="w-full px-7 py-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] outline-none font-black text-4xl text-blue-600 placeholder:opacity-20"
                              placeholder="0,00"
                          />
                          <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-slate-300 italic text-xl">Bs.</span>
                      </div>
                  </div>

                  {/* SELECTOR MÉTODO DE PAGO */}
                  <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Cuenta de Salida</label>
                      <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                        <SelectTrigger className="w-full h-14 bg-slate-50 dark:bg-white/5 rounded-[1.5rem] border-none font-bold text-xs pl-6">
                            <div className="flex items-center gap-3">
                                <CreditCard className="w-4 h-4 text-slate-400"/>
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

                  {/* INFO CONVERSIÓN */}
                  <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-dashed border-black/10">
                      <div className="flex justify-between items-center">
                          <span className="text-slate-400 uppercase tracking-widest text-[9px]">Equivalente USD</span>
                          <span className="font-black text-slate-900 dark:text-white text-lg">${usdEquivalent}</span>
                      </div>
                  </div>

                  <Button 
                      disabled={!montoBsInput || isLoading || tasaUSD <= 0}
                      onClick={processFinalPay}
                      className="w-full h-16 rounded-[2rem] bg-blue-600 hover:bg-blue-700 font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all text-white"
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