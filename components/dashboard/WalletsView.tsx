// @/components/dashboard/WalletsView.tsx
"use client"

import React, { useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Wallet, TrendingUp, TrendingDown, RefreshCcw, 
    Plus, ArrowRightLeft, Coins, Landmark, 
    CreditCard, ArrowUpRight, ArrowDownLeft,
    Banknote, Settings, Save, Calculator, 
    HelpCircle, X, AlertTriangle, Megaphone, ShieldAlert
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/order-utils"

// --- IMPORTACIONES DE FIREBASE ---
import { collection, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

// --- TIPOS ---
interface WalletsViewProps {
    ordenes: any[]
    gastos: any[]
    pagosEmpleados: any[]
    rates: { usd: number, eur: number, usdt: number }
    yesterdayRate?: number
    initialBalancesData?: { cash_usd: number, bank_bs: number, zelle: number, usdt: number }
    movimientosManuales?: any[] // Añadimos esto para recibir los ajustes
}

const WALLETS_CONFIG = [
    { id: 'cash_usd', label: 'Caja Chica ($)', currency: 'USD', icon: <Banknote className="w-6 h-6"/>, color: 'emerald', bg: 'bg-emerald-600' },
    { id: 'bank_bs', label: 'Banco Nacional (Bs)', currency: 'VES', icon: <Landmark className="w-6 h-6"/>, color: 'blue', bg: 'bg-blue-600' },
    { id: 'zelle', label: 'Zelle / Bofa', currency: 'USD', icon: <CreditCard className="w-6 h-6"/>, color: 'purple', bg: 'bg-purple-600' },
    { id: 'usdt', label: 'Binance / USDT', currency: 'USDT', icon: <Coins className="w-6 h-6"/>, color: 'orange', bg: 'bg-orange-500' },
]

// --- COMPONENTE DE TUTORIAL ---
const TutorialTip = ({ text, position = "top" }: { text: string, position?: "top" | "bottom" | "left" | "right" }) => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={cn(
            "absolute z-50 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide p-3 rounded-xl shadow-xl w-48 pointer-events-none border-2 border-white/20",
            position === "top" && "-top-20 left-1/2 -translate-x-1/2",
            position === "bottom" && "-bottom-20 left-1/2 -translate-x-1/2",
            position === "left" && "top-1/2 -left-52 -translate-y-1/2",
            position === "right" && "top-1/2 -right-52 -translate-y-1/2",
        )}
    >
        <div className="absolute inset-0 bg-indigo-600 blur-lg opacity-50 -z-10 rounded-xl"></div>
        {text}
        <div className={cn(
            "absolute w-3 h-3 bg-indigo-600 rotate-45",
            position === "top" && "bottom-[-6px] left-1/2 -translate-x-1/2",
            position === "bottom" && "top-[-6px] left-1/2 -translate-x-1/2",
             position === "left" && "right-[-6px] top-1/2 -translate-y-1/2",
             position === "right" && "left-[-6px] top-1/2 -translate-y-1/2",
        )}></div>
    </motion.div>
)

export function WalletsView({ ordenes, gastos, pagosEmpleados, rates, yesterdayRate = 0, initialBalancesData, movimientosManuales = [] }: WalletsViewProps) {
    
    // --- ESTADOS ---
    const [selectedWallet, setSelectedWallet] = useState<string>('cash_usd')
    const [showTutorial, setShowTutorial] = useState(false)
    
    // Modales
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)

    const prevRate = yesterdayRate || (rates.usd * 0.98); 

    // Estado Saldos Iniciales
    const [initialBalances, setInitialBalances] = useState({
        cash_usd: initialBalancesData?.cash_usd || 0,
        bank_bs: initialBalancesData?.bank_bs || 0,
        zelle: initialBalancesData?.zelle || 0,
        usdt: initialBalancesData?.usdt || 0,
    })
    const [tempInitialBalances, setTempInitialBalances] = useState(initialBalances)

    // Formulario de Cambio
    const [exchangeForm, setExchangeForm] = useState({ 
        origen: 'bank_bs', 
        destino: 'cash_usd', 
        montoSalida: '', 
        montoEntrada: '', 
        tasa: rates.usd.toString(),
        referencia: '' 
    })
    
    // Formulario Manual / Cuadre
    const [manualForm, setManualForm] = useState({ 
        mode: 'SIMPLE', tipo: 'INGRESO', billetera: 'cash_usd', monto: '', montoReal: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] 
    })

    // ESTADOS PARA EL CUADRE MULTIPLE
    const [unlockedWallets, setUnlockedWallets] = useState<Record<string, boolean>>({})
    const [cuadreData, setCuadreData] = useState<Record<string, string>>({})

    useEffect(() => {
        if(initialBalancesData) {
            setInitialBalances(initialBalancesData)
            setTempInitialBalances(initialBalancesData)
        }
    }, [initialBalancesData])

    // --- MOTOR DE CÁLCULO ---
    const walletBalances = useMemo(() => {
        const balances: any = { 
            cash_usd: Number(initialBalances.cash_usd), 
            bank_bs: Number(initialBalances.bank_bs), 
            zelle: Number(initialBalances.zelle), 
            usdt: Number(initialBalances.usdt) 
        };
        const movements: any[] = [];

        // 0. Saldos Iniciales
        Object.entries(initialBalances).forEach(([key, value]) => {
            if (Number(value) > 0) {
                movements.push({
                    id: `init-${key}`, type: 'SALDO_INICIAL', wallet: key, amount: Number(value),
                    description: 'Saldo Inicial Configurado', date: new Date('2024-01-01'), category: 'Ajuste'
                });
            }
        });

        // 1. Ingresos
        ordenes.forEach(o => {
            (o.registroPagos || []).forEach((p: any, index: number) => {
                const metodo = (p.metodo || p.paymentMethod || '').toLowerCase();
                let targetWallet = 'cash_usd'; 
                let amount = Number(p.montoUSD) || 0;
                let originalCurrencyAmount = amount;

                if (metodo.includes('movil') || metodo.includes('transferencia') || metodo.includes('bs')) {
                    targetWallet = 'bank_bs';
                    const tasaRef = p.tasaBCV || rates.usd;
                    originalCurrencyAmount = (p.montoBs && Number(p.montoBs) > 0) ? Number(p.montoBs) : amount * tasaRef;
                } else if (metodo.includes('zelle')) targetWallet = 'zelle';
                else if (metodo.includes('usdt')) targetWallet = 'usdt';

                balances[targetWallet] += originalCurrencyAmount;
                
                movements.push({ 
                    id: `in-${o.id}-${index}`, 
                    type: 'INGRESO', wallet: targetWallet, amount: originalCurrencyAmount, 
                    description: `Orden #${o.ordenNumero}`, date: new Date(p.fecha), category: 'Venta' 
                });
            });
        });

        // 2. Gastos
        gastos.forEach(g => {
            const metodo = (g.metodoPago || '').toLowerCase();
            let targetWallet = 'bank_bs'; 
            let amountUSD = Number(g.monto) || 0;
            let amountWallet = amountUSD * rates.usd; 
            
            if (metodo.includes('dolar') || metodo.includes('efectivo')) { targetWallet = 'cash_usd'; amountWallet = amountUSD; }
            else if (metodo.includes('zelle')) { targetWallet = 'zelle'; amountWallet = amountUSD; }
            else if (metodo.includes('usdt')) { targetWallet = 'usdt'; amountWallet = amountUSD; }

            balances[targetWallet] -= amountWallet;
            movements.push({ id: `out-${g.id}`, type: 'EGRESO', wallet: targetWallet, amount: amountWallet, description: g.nombre, date: new Date(g.fecha), category: 'Gasto' });
        });

        // 3. Nómina
        pagosEmpleados.forEach(p => {
            balances['cash_usd'] -= (Number(p.totalUSD) || 0);
            movements.push({ id: `nom-${p.id}`, type: 'EGRESO', wallet: 'cash_usd', amount: Number(p.totalUSD), description: `Nómina: ${p.nombre}`, date: new Date(p.fechaPago), category: 'Nómina' });
        });

        // 4. Movimientos Manuales y Ajustes de Cuadre
        (movimientosManuales || []).forEach((m: any) => {
            const targetWallet = m.billetera || 'cash_usd';
            const amount = Number(m.monto) || 0;
            
            if (m.tipo === 'INGRESO') {
                balances[targetWallet] += amount;
            } else {
                balances[targetWallet] -= amount;
            }
            
            movements.push({ 
                id: `man-${m.id || Math.random()}`, 
                type: m.tipo, 
                wallet: targetWallet, 
                amount: amount, 
                description: m.descripcion, 
                date: m.fecha ? new Date(m.fecha) : new Date(), 
                category: m.categoria || 'Ajuste' 
            });
        });

        movements.sort((a, b) => b.date.getTime() - a.date.getTime());
        return { balances, movements };
    }, [ordenes, gastos, pagosEmpleados, rates, initialBalances, movimientosManuales]);

    // --- INTELIGENCIA FINANCIERA ---
    const rateAnalysis = useMemo(() => {
        const diff = rates.usd - prevRate;
        const percentChange = prevRate > 0 ? ((diff / prevRate) * 100) : 0;
        const isRisk = percentChange > 2; 
        
        return { diff, percentChange, isRisk, trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'EQUAL' }
    }, [rates.usd, prevRate]);

    const getWalletBalance = (walletId: string) => walletBalances.balances[walletId] || 0;
    
    // --- HANDLERS ---
    const activeMovements = walletBalances.movements.filter((m:any) => m.wallet === selectedWallet);
    const handleSaveInit = () => { setInitialBalances(tempInitialBalances); setIsConfigModalOpen(false); }
    
    // Ajuste simple manual
    const handleManual = async () => { 
        if (!manualForm.monto || parseFloat(manualForm.monto) <= 0) return alert("Ingrese un monto válido");
        
        const ajuste = {
            billetera: manualForm.billetera,
            tipo: manualForm.tipo,
            monto: parseFloat(manualForm.monto),
            descripcion: manualForm.descripcion || `Movimiento manual (${manualForm.tipo})`,
            fecha: new Date().toISOString(),
            categoria: 'Ajuste'
        };

        try {
            await addDoc(collection(db, "movimientos_caja"), ajuste);
            alert("¡Movimiento guardado exitosamente!");
            setIsManualModalOpen(false);
            setManualForm({...manualForm, monto: '', descripcion: ''});
            window.location.reload();
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar el movimiento");
        }
    }
    
    const handleEx = () => { setIsExchangeModalOpen(false); alert("Compra de Divisas Registrada (Conectar a Base de Datos)"); }

    // --- HANDLERS DE CUADRE ---
    const handleUnlockWallet = (walletId: string, walletLabel: string) => {
        const confirmacion = window.confirm(`¿Estás seguro que deseas realizar un cuadre en ${walletLabel}? Esto te permitirá registrar la cantidad física real y el sistema creará un ajuste por la diferencia.`);
        if (confirmacion) {
            setUnlockedWallets(prev => ({ ...prev, [walletId]: true }));
            setCuadreData(prev => ({ ...prev, [walletId]: getWalletBalance(walletId).toString() }));
        }
    }

    const handleSaveCuadre = async () => {
        const ajustes = Object.keys(unlockedWallets).map(walletId => {
            const saldoSistema = getWalletBalance(walletId);
            const saldoReal = parseFloat(cuadreData[walletId] || '0');
            const diferencia = saldoReal - saldoSistema;

            if (diferencia !== 0) {
                return {
                    billetera: walletId,
                    tipo: diferencia > 0 ? 'INGRESO' : 'EGRESO',
                    monto: Math.abs(diferencia),
                    descripcion: `Ajuste por Cuadre de Caja (${diferencia > 0 ? 'Sobrante' : 'Faltante'})`,
                    fecha: new Date().toISOString(),
                    categoria: 'Ajuste'
                };
            }
            return null;
        }).filter(Boolean);

        if (ajustes.length === 0) {
            alert("No hay diferencias detectadas para guardar o los saldos son idénticos al sistema.");
            return;
        }

        try {
            for (const ajuste of ajustes) {
                await addDoc(collection(db, "movimientos_caja"), ajuste);
            }

            alert("¡Cuadre guardado exitosamente en Firebase!");
            
            setUnlockedWallets({});
            setCuadreData({});
            setIsManualModalOpen(false);
            
            window.location.reload(); 

        } catch (error) {
            console.error("Error al guardar en Firebase:", error);
            alert("Hubo un error al guardar el ajuste.");
        }
    }

    return (
        <div className="space-y-6 p-2 font-sans pb-24 text-slate-800 dark:text-slate-100 animate-in fade-in duration-500 relative">
            
            {/* ALERTA DE RIESGO */}
            {rateAnalysis.isRisk && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-rose-500 rounded-[2rem] p-6 text-white shadow-xl shadow-rose-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle size={120}/></div>
                    <div className="relative z-10 flex items-start gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl animate-pulse"><Megaphone className="w-8 h-8 text-white"/></div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">¡Alerta de Devaluación!</h3>
                            <p className="text-sm font-bold opacity-90 mt-1 max-w-xl">
                                El dólar subió un <span className="bg-white text-rose-600 px-1 rounded mx-1">{rateAnalysis.percentChange.toFixed(2)}%</span>.
                                Tus <span className="font-black underline decoration-white">Bs. {walletBalances.balances.bank_bs.toLocaleString()}</span> pierden valor.
                            </p>
                            <Button onClick={() => setIsExchangeModalOpen(true)} className="mt-4 bg-white text-rose-600 font-black uppercase tracking-widest hover:bg-rose-50 border-none shadow-lg">
                                <ShieldAlert className="w-4 h-4 mr-2"/> Proteger Capital
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-blue-600" /> Billeteras <span className="text-slate-300">|</span> Tesorería
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tasa Hoy: {rates.usd} Bs/$</p>
                        <Badge variant={rateAnalysis.trend === 'UP' ? 'destructive' : 'secondary'} className="h-5 text-[9px]">
                            {rateAnalysis.trend === 'UP' ? 'Subió' : 'Bajó'} {Math.abs(rateAnalysis.diff).toFixed(2)} Bs vs Ayer
                        </Badge>
                    </div>
                </div>
                
                <div className="flex gap-2 relative">
                    <AnimatePresence>{showTutorial && <TutorialTip text="Configura aquí tus saldos iniciales o usa los botones para acciones rápidas." position="bottom" />}</AnimatePresence>
                    <Button onClick={() => setShowTutorial(!showTutorial)} variant={showTutorial ? "default" : "outline"} size="icon" className="rounded-xl border-slate-200 text-indigo-500">
                        {showTutorial ? <X className="w-5 h-5"/> : <HelpCircle className="w-5 h-5" />}
                    </Button>
                    <Button onClick={() => setIsConfigModalOpen(true)} variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100 text-slate-400"><Settings className="w-5 h-5" /></Button>
                    <Button onClick={() => setIsManualModalOpen(true)} variant="outline" className="rounded-2xl border-slate-200 font-bold uppercase text-[10px] tracking-wider gap-2"><Plus className="w-4 h-4" /> Ajuste</Button>
                    <Button onClick={() => setIsExchangeModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-wider gap-2 shadow-lg"><RefreshCcw className="w-4 h-4" /> Cambiar</Button>
                </div>
            </div>

            {/* CARDS */}
            <div className="relative">
                <AnimatePresence>{showTutorial && <TutorialTip text="Mira tu tarjeta azul (Bs). Te muestra el equivalente en dólares automáticamente." position="top" />}</AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
                    {WALLETS_CONFIG.map(wallet => {
                        const balance = walletBalances.balances[wallet.id];
                        const secondaryValue = wallet.id === 'bank_bs' ? (balance / rates.usd) : null;
                        return (
                            <WalletCard 
                                key={wallet.id} config={wallet} balance={balance} 
                                isActive={selectedWallet === wallet.id} onClick={() => setSelectedWallet(wallet.id)}
                                secondaryValue={secondaryValue} 
                                rateAnalysis={wallet.id === 'bank_bs' ? rateAnalysis : null}
                            />
                        )
                    })}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-2xl font-black italic uppercase tracking-tight">{WALLETS_CONFIG.find(w => w.id === selectedWallet)?.label}</h3>
                            <Badge variant="outline" className="bg-white">Historial</Badge>
                        </div>
                        <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar space-y-3">
                            {activeMovements.map((mov: any) => (
                                <MovementRow key={mov.id} movement={mov} currency={WALLETS_CONFIG.find(w => w.id === selectedWallet)?.currency || 'USD'} />
                            ))}
                            {activeMovements.length === 0 && <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase">Sin movimientos</div>}
                        </div>
                    </Card>
                </div>
                
                {/* RESUMEN PATRIMONIAL */}
                <div className="space-y-6">
                    <Card className="rounded-[2.5rem] p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl border-none relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-10"><TrendingUp size={120} /></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-6">Total Real (USD)</h4>
                        <div className="space-y-2 relative z-10">
                            <p className="text-5xl font-black tracking-tighter">
                                {formatCurrency(
                                    walletBalances.balances.cash_usd + 
                                    walletBalances.balances.zelle + 
                                    walletBalances.balances.usdt + 
                                    (walletBalances.balances.bank_bs / rates.usd)
                                )}
                            </p>
                            <p className="text-[10px] font-bold opacity-50 uppercase">Sumando todas las cuentas</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- MODAL CONFIGURACIÓN DE SALDOS --- */}
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent className="rounded-[2.5rem] bg-white dark:bg-[#1c1c1e]">
                    <DialogHeader><DialogTitle>Saldos Iniciales</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Caja Chica ($)</Label>
                        <Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.cash_usd} onChange={e=>setTempInitialBalances({...tempInitialBalances, cash_usd: +e.target.value})}/></div>
                        <div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Banco (Bs)</Label>
                        <Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.bank_bs} onChange={e=>setTempInitialBalances({...tempInitialBalances, bank_bs: +e.target.value})}/></div>
                        <div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Zelle ($)</Label>
                        <Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.zelle} onChange={e=>setTempInitialBalances({...tempInitialBalances, zelle: +e.target.value})}/></div>
                        <div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Binance (USDT)</Label>
                        <Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.usdt} onChange={e=>setTempInitialBalances({...tempInitialBalances, usdt: +e.target.value})}/></div>
                        <Button onClick={handleSaveInit} className="w-full h-12 bg-slate-900 text-white rounded-xl uppercase font-black">Guardar</Button>
                    </div>
                </DialogContent>
            </Dialog>
            
            {/* --- MODAL AJUSTE / CUADRE --- */}
            <Dialog open={isManualModalOpen} onOpenChange={(open) => {
                setIsManualModalOpen(open);
                if (!open) { setUnlockedWallets({}); setCuadreData({}); }
            }}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none bg-white dark:bg-[#1c1c1e] shadow-2xl custom-scrollbar max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                            {manualForm.mode === 'SIMPLE' ? 'Ajuste Manual' : 'Cuadre de Cajas'}
                        </DialogTitle>
                    </DialogHeader>

                    {/* TABS */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-2">
                        <button onClick={() => setManualForm({...manualForm, mode: 'SIMPLE', monto: '', montoReal: ''})}
                            className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all", manualForm.mode === 'SIMPLE' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600")}>Movimiento Único</button>
                        <button onClick={() => setManualForm({...manualForm, mode: 'CUADRE', monto: '', montoReal: ''})}
                            className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2", manualForm.mode === 'CUADRE' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600")}><Calculator className="w-3 h-3"/> Cuadre Total</button>
                    </div>

                    <div className="space-y-4 py-2">
                        {manualForm.mode === 'SIMPLE' ? (
                            <>
                                <Select value={manualForm.billetera} onValueChange={(v) => setManualForm({...manualForm, billetera: v})}>
                                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold"><SelectValue/></SelectTrigger>
                                    <SelectContent>{WALLETS_CONFIG.map(w => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent>
                                </Select>

                                <div className="grid grid-cols-2 gap-4">
                                    <Button variant={manualForm.tipo === 'INGRESO' ? 'default' : 'outline'} onClick={() => setManualForm({...manualForm, tipo: 'INGRESO'})} className={cn("rounded-xl font-black", manualForm.tipo === 'INGRESO' && "bg-emerald-600 text-white")}>Ingreso</Button>
                                    <Button variant={manualForm.tipo === 'EGRESO' ? 'default' : 'outline'} onClick={() => setManualForm({...manualForm, tipo: 'EGRESO'})} className={cn("rounded-xl font-black", manualForm.tipo === 'EGRESO' && "bg-rose-600 text-white")}>Egreso</Button>
                                </div>
                                <Input type="number" placeholder="Monto" className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={manualForm.monto} onChange={e => setManualForm({...manualForm, monto: e.target.value})} />
                                <Input placeholder="Descripción (Ej: Pago proveedor)" className="h-12 bg-slate-50 border-none rounded-xl" value={manualForm.descripcion} onChange={e => setManualForm({...manualForm, descripcion: e.target.value})} />
                                <Button onClick={handleManual} className="w-full h-12 bg-slate-900 text-white rounded-xl uppercase font-black">Guardar Movimiento</Button>
                            </>
                        ) : (
                            // MODO CUADRE TOTAL
                            <div className="space-y-4">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center mb-4">
                                    Desbloquea la cuenta que deseas cuadrar. Se creará un ajuste automático por la diferencia.
                                </p>
                                
                                {WALLETS_CONFIG.map(w => {
                                    const sysBal = getWalletBalance(w.id);
                                    const isUnlocked = unlockedWallets[w.id];
                                    const realVal = cuadreData[w.id];
                                    const diff = (realVal !== undefined && realVal !== '') ? parseFloat(realVal) - sysBal : 0;

                                    return (
                                        <div key={w.id} className={cn("p-4 rounded-2xl border transition-all", isUnlocked ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-100 opacity-80")}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-700">{w.icon}</span>
                                                    <span className="font-black text-sm uppercase text-slate-700">{w.label}</span>
                                                </div>
                                                {!isUnlocked ? (
                                                    <Button size="sm" variant="outline" className="h-7 text-[10px] uppercase font-bold rounded-lg" onClick={() => handleUnlockWallet(w.id, w.label)}>Ajustar</Button>
                                                ) : (
                                                    <Badge className="bg-indigo-600 hover:bg-indigo-600">Editando</Badge>
                                                )}
                                            </div>
                                            
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <Label className="text-[9px] font-bold uppercase text-slate-400">Saldo Sistema</Label>
                                                    <div className="font-black text-slate-600">{formatCurrency(sysBal)}</div>
                                                </div>
                                                <div className="flex-[2]">
                                                    <Label className="text-[9px] font-bold uppercase text-indigo-600">Saldo Real (Físico/Banco)</Label>
                                                    <Input
                                                        disabled={!isUnlocked}
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={cuadreData[w.id] ?? ''}
                                                        onChange={(e) => setCuadreData(prev => ({...prev, [w.id]: e.target.value}))}
                                                        className={cn("h-10 border-none font-black text-right", isUnlocked ? "bg-white text-indigo-700 shadow-sm" : "bg-slate-200/50 text-slate-400")}
                                                    />
                                                </div>
                                            </div>

                                            {/* Indicador de Diferencia */}
                                            {isUnlocked && realVal !== '' && diff !== 0 && (
                                                <div className={cn("mt-3 p-2 rounded-xl text-center text-xs font-black uppercase tracking-wide", diff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                                    {diff > 0 ? "Sobrante" : "Faltante"}: {formatCurrency(Math.abs(diff))}
                                                    <span className="block text-[8px] opacity-70 mt-0.5">Se creará un movimiento automático</span>
                                                </div>
                                            )}
                                            {isUnlocked && realVal !== '' && diff === 0 && (
                                                <div className="mt-3 p-2 rounded-xl text-center text-xs font-black uppercase tracking-wide bg-slate-200 text-slate-600">
                                                    Cuadre Exacto (Sin diferencias)
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}

                                <Button 
                                    onClick={handleSaveCuadre} 
                                    disabled={Object.keys(unlockedWallets).length === 0}
                                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl uppercase font-black tracking-widest shadow-xl mt-4">
                                    Aplicar Ajustes
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- MODAL CAMBIO DIVISAS --- */}
            <Dialog open={isExchangeModalOpen} onOpenChange={setIsExchangeModalOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] shadow-2xl overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                            <RefreshCcw className="text-indigo-600"/> Compra de Divisas
                        </DialogTitle>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Calculadora de Cambio Real</p>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-5">
                        <div className="bg-slate-50 p-1 rounded-2xl flex items-center border border-slate-100">
                            <div className="pl-4 pr-2 text-[10px] font-black uppercase text-slate-400">Destino:</div>
                            <Select value={exchangeForm.destino} onValueChange={(v) => setExchangeForm({...exchangeForm, destino: v})}>
                                <SelectTrigger className="h-10 bg-white border-none rounded-xl font-bold text-xs shadow-sm text-indigo-700 flex-1">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash_usd">💵 Caja Chica (Efectivo)</SelectItem>
                                    <SelectItem value="zelle">🏛️ Zelle / Bofa</SelectItem>
                                    <SelectItem value="usdt">🪙 Binance / USDT</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Precio Compra (Tasa)</Label>
                                <Input 
                                    type="number" 
                                    className="h-12 bg-indigo-50 border-indigo-100 text-indigo-700 font-black rounded-xl text-center text-lg" 
                                    placeholder="0.00"
                                    value={exchangeForm.tasa}
                                    onChange={(e) => {
                                        const newRate = parseFloat(e.target.value);
                                        const usd = parseFloat(exchangeForm.montoEntrada); 
                                        const newBs = (usd && newRate) ? (usd * newRate).toFixed(2) : exchangeForm.montoSalida;
                                        setExchangeForm({ ...exchangeForm, tasa: e.target.value, montoSalida: newBs });
                                    }}
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-emerald-600 ml-2">Dólares a Recibir ($)</Label>
                                <Input 
                                    type="number" 
                                    className="h-12 bg-emerald-50 border-emerald-100 text-emerald-600 font-black rounded-xl text-center text-lg shadow-inner" 
                                    placeholder="0.00"
                                    value={exchangeForm.montoEntrada}
                                    onChange={(e) => {
                                        const newUSD = parseFloat(e.target.value);
                                        const rate = parseFloat(exchangeForm.tasa);
                                        const newBs = (newUSD && rate) ? (newUSD * rate).toFixed(2) : '';
                                        setExchangeForm({ ...exchangeForm, montoEntrada: e.target.value, montoSalida: newBs });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                            <span>Total a Pagar</span>
                            <ArrowDownLeft className="w-3 h-3" />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Monto Salida (Bolívares)</Label>
                            <Input 
                                type="number" 
                                className="h-14 bg-slate-100 border-none text-slate-800 font-black rounded-2xl text-xl px-4" 
                                placeholder="0.00"
                                value={exchangeForm.montoSalida}
                                onChange={(e) => {
                                    const newBs = parseFloat(e.target.value);
                                    const rate = parseFloat(exchangeForm.tasa);
                                    const newUSD = (newBs && rate) ? (newBs / rate).toFixed(2) : '';
                                    setExchangeForm({ ...exchangeForm, montoSalida: e.target.value, montoEntrada: newUSD });
                                }}
                            />
                        </div>

                        <div className="space-y-1 pt-2">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nota / Referencia</Label>
                            <Input 
                                className="h-10 bg-white border border-slate-200 rounded-xl font-bold text-xs" 
                                placeholder="Ej: Pago Móvil #123456 - Sr. Cambio"
                                value={exchangeForm.referencia}
                                onChange={(e) => setExchangeForm({...exchangeForm, referencia: e.target.value})}
                            />
                        </div>

                        <Button onClick={handleEx} className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl uppercase font-black tracking-widest shadow-xl mt-2 flex flex-col justify-center items-center gap-0">
                            <span>Registrar Compra</span>
                            <span className="text-[8px] font-normal opacity-70 normal-case">
                                {exchangeForm.montoEntrada && exchangeForm.tasa 
                                    ? `Ingresan $${exchangeForm.montoEntrada} a tasa ${exchangeForm.tasa}` 
                                    : 'Completa los datos'}
                            </span>
                        </Button>
                     </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function WalletCard({ config, balance, isActive, onClick, secondaryValue, rateAnalysis }: any) {
    return (
        <motion.div onClick={onClick} whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }}
            className={cn("min-w-[260px] p-6 rounded-[2.5rem] cursor-pointer transition-all border-2 relative overflow-hidden group",
                isActive ? `border-${config.color}-500/50 shadow-xl shadow-${config.color}-500/20 bg-white` : "border-transparent bg-white hover:border-slate-200 shadow-sm")}>
            <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-10 -mt-10 rounded-full opacity-10 transition-transform group-hover:scale-150", config.bg)} />
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={cn("p-3 rounded-2xl text-white shadow-md", config.bg)}>{config.icon}</div>
                {rateAnalysis?.isRisk && <div className="animate-bounce bg-rose-500 text-white p-1 rounded-full"><AlertTriangle size={16}/></div>}
            </div>
            <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{config.label}</p>
                <h3 className="text-3xl font-black tracking-tighter text-slate-900">
                    {config.currency === 'USD' ? '$' : config.currency === 'USDT' ? '₮' : 'Bs.'}
                    {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                {secondaryValue !== null && secondaryValue !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-bold border-none text-[10px]">
                            ≈ ${secondaryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </Badge>
                        {rateAnalysis && (
                            <span className={cn("text-[9px] font-black uppercase", rateAnalysis.trend === 'UP' ? "text-rose-500" : "text-emerald-500")}>
                                {rateAnalysis.trend === 'UP' ? '↘ Valor bajando' : '→ Estable'}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    )
}

function MovementRow({ movement, currency }: any) {
    const isIncome = movement.type === 'INGRESO' || movement.type === 'SALDO_INICIAL';
    const isInitial = movement.type === 'SALDO_INICIAL';
    return (
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.5rem] hover:bg-slate-100 transition-colors group border border-transparent hover:border-slate-200">
            <div className="flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    isInitial ? "bg-slate-200 text-slate-600" : isIncome ? "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200" : "bg-rose-100 text-rose-600 group-hover:bg-rose-200")}>
                    {isInitial ? <Landmark className="w-5 h-5"/> : isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{movement.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4 bg-white border-slate-200">{movement.category}</Badge>
                        <span className="text-[9px] font-bold text-slate-400">{movement.date.toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <p className={cn("text-base font-black tracking-tighter", isInitial ? "text-slate-600" : isIncome ? "text-emerald-600" : "text-rose-600")}>
                    {isIncome ? "+" : "-"}{movement.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">{currency}</p>
            </div>
        </div>
    )
}