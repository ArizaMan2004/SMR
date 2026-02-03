// @/components/dashboard/WalletsView.tsx
"use client"

import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Wallet, TrendingUp, TrendingDown, RefreshCcw, 
    Plus, ArrowRightLeft, DollarSign, Coins, Landmark, 
    CreditCard, Calendar, ArrowUpRight, ArrowDownLeft,
    Banknote, Search, Filter, History, AlertCircle
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

interface WalletsViewProps {
    ordenes: any[]
    gastos: any[]
    gastosFijos: any[]
    pagosEmpleados: any[]
    rates: { usd: number, eur: number, usdt: number }
}

const WALLETS_CONFIG = [
    { id: 'cash_usd', label: 'Caja Chica ($)', currency: 'USD', icon: <Banknote className="w-6 h-6"/>, color: 'emerald', bg: 'bg-emerald-600' },
    { id: 'bank_bs', label: 'Banco Nacional (Bs)', currency: 'VES', icon: <Landmark className="w-6 h-6"/>, color: 'blue', bg: 'bg-blue-600' },
    { id: 'zelle', label: 'Zelle / Bofa', currency: 'USD', icon: <CreditCard className="w-6 h-6"/>, color: 'purple', bg: 'bg-purple-600' },
    { id: 'usdt', label: 'Binance / USDT', currency: 'USDT', icon: <Coins className="w-6 h-6"/>, color: 'orange', bg: 'bg-orange-500' },
]

export function WalletsView({ ordenes, gastos, gastosFijos, pagosEmpleados, rates }: WalletsViewProps) {
    
    const [selectedWallet, setSelectedWallet] = useState<string>('cash_usd')
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    
    const [exchangeForm, setExchangeForm] = useState({ 
        origen: 'bank_bs', destino: 'cash_usd', montoSalida: '', montoEntrada: '', tasa: '' 
    })
    const [manualForm, setManualForm] = useState({ 
        tipo: 'INGRESO', billetera: 'cash_usd', monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] 
    })

    // --- MOTOR DE CÁLCULO DE SALDOS ---
    const walletBalances = useMemo(() => {
        const balances: any = { cash_usd: 0, bank_bs: 0, zelle: 0, usdt: 0 };
        const movements: any[] = [];

        // 1. INGRESOS (Cobros de Órdenes)
        ordenes.forEach(o => {
            (o.registroPagos || []).forEach((p: any) => {
                const metodo = (p.metodo || p.paymentMethod || '').toLowerCase();
                let targetWallet = 'cash_usd'; // Default: Efectivo
                let amount = Number(p.montoUSD) || 0;
                let originalCurrencyAmount = amount;

                if (metodo.includes('movil') || metodo.includes('transferencia') || metodo.includes('bs')) {
                    targetWallet = 'bank_bs';
                    // Si tenemos el monto en Bs real, lo usamos. Si no, calculamos con la tasa del momento.
                    const tasaRef = p.tasaBCV || rates.usd;
                    originalCurrencyAmount = (p.montoBs && Number(p.montoBs) > 0) ? Number(p.montoBs) : amount * tasaRef;
                } else if (metodo.includes('zelle')) {
                    targetWallet = 'zelle';
                } else if (metodo.includes('binance') || metodo.includes('usdt')) {
                    targetWallet = 'usdt';
                }

                balances[targetWallet] += originalCurrencyAmount;
                movements.push({
                    id: `ingreso-${o.id}-${Math.random()}`,
                    type: 'INGRESO',
                    wallet: targetWallet,
                    amount: originalCurrencyAmount,
                    amountUSD: amount,
                    description: `Cobro Orden #${o.ordenNumero} - ${o.cliente?.nombreRazonSocial || 'Cliente'}`,
                    date: new Date(p.fecha || p.fechaPago || o.fecha),
                    category: 'Venta'
                });
            });
        });

        // 2. EGRESOS (Insumos)
        gastos.forEach(g => {
            // Lógica simple: Si dice "Dolar" o "Efectivo" es Caja Chica, si no es Banco Bs.
            const metodo = (g.metodoPago || '').toLowerCase();
            let targetWallet = 'bank_bs'; 
            let amountUSD = Number(g.monto) || 0;
            let amountWallet = amountUSD * rates.usd; // Default a Bs

            if (metodo.includes('dolar') || metodo.includes('efectivo') || metodo.includes('cash')) {
                targetWallet = 'cash_usd';
                amountWallet = amountUSD;
            } else if (metodo.includes('zelle')) {
                targetWallet = 'zelle';
                amountWallet = amountUSD;
            }

            balances[targetWallet] -= amountWallet;
            movements.push({
                id: `gasto-${g.id}`, 
                type: 'EGRESO', 
                wallet: targetWallet, 
                amount: amountWallet,
                amountUSD: amountUSD,
                description: `Compra: ${g.nombre || g.descripcion || 'Materiales'}`, 
                date: new Date(g.fecha), 
                category: 'Insumo'
            });
        });

        // 3. EGRESOS (Nómina)
        pagosEmpleados.forEach(p => {
            // Asumimos efectivo si no hay data, o podrías agregar un campo de método en NóminaView
            const targetWallet = 'cash_usd'; 
            const amount = Number(p.totalUSD) || 0;
            
            balances[targetWallet] -= amount;
             movements.push({
                id: `nomina-${p.id}`, 
                type: 'EGRESO', 
                wallet: targetWallet, 
                amount: amount,
                amountUSD: amount,
                description: `Nómina: ${p.nombre || 'Personal'}`, 
                date: new Date(p.fechaPago || p.fecha), 
                category: 'Nómina'
            });
        });

        // Ordenar movimientos por fecha descendente
        movements.sort((a, b) => b.date.getTime() - a.date.getTime());

        return { balances, movements };
    }, [ordenes, gastos, pagosEmpleados, rates]);

    const activeMovements = walletBalances.movements.filter((m:any) => m.wallet === selectedWallet);

    const handleManualTransaction = () => {
        alert("Función de ajuste manual. \n(Aquí conectaríamos con 'createTransaction' en Firebase)");
        setIsManualModalOpen(false);
    }
    
    const handleExchange = () => {
        alert(`Cambio registrado: Salieron ${exchangeForm.montoSalida} de ${exchangeForm.origen} y entraron ${exchangeForm.montoEntrada} a ${exchangeForm.destino}`);
        setIsExchangeModalOpen(false);
    }

    return (
        <div className="space-y-8 p-2 font-sans pb-24 text-slate-800 dark:text-slate-100 animate-in fade-in duration-500">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-blue-600" /> Billeteras <span className="text-slate-300">|</span> Tesorería
                    </h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de Flujo de Caja y Divisas</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => setIsManualModalOpen(true)} variant="outline" className="rounded-2xl border-slate-200 dark:border-white/10 font-bold uppercase text-[10px] tracking-wider gap-2">
                        <Plus className="w-4 h-4" /> Ajuste Manual
                    </Button>
                    <Button onClick={() => setIsExchangeModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-wider gap-2 shadow-lg shadow-indigo-500/20">
                        <RefreshCcw className="w-4 h-4" /> Comprar Divisas
                    </Button>
                </div>
            </div>

            {/* WALLET CARDS SCROLL */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
                {WALLETS_CONFIG.map(wallet => (
                    <WalletCard 
                        key={wallet.id}
                        config={wallet}
                        balance={walletBalances.balances[wallet.id]}
                        isActive={selectedWallet === wallet.id}
                        onClick={() => setSelectedWallet(wallet.id)}
                    />
                ))}
            </div>

            {/* MAIN CONTENT SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT: DETALLES & ESTADÍSTICAS DE LA WALLET SELECCIONADA */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden">
                        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Movimientos Recientes</p>
                                <h3 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-2">
                                    {WALLETS_CONFIG.find(w => w.id === selectedWallet)?.label}
                                </h3>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="rounded-xl"><Filter className="w-4 h-4 text-slate-400"/></Button>
                                <Button variant="ghost" size="icon" className="rounded-xl"><Search className="w-4 h-4 text-slate-400"/></Button>
                            </div>
                        </div>

                        <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar space-y-3">
                            {activeMovements.length > 0 ? activeMovements.map((mov: any) => (
                                <MovementRow key={mov.id} movement={mov} currency={WALLETS_CONFIG.find(w => w.id === selectedWallet)?.currency || 'USD'} />
                            )) : (
                                <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                                    <History className="w-12 h-12 mb-4 opacity-20"/>
                                    <p className="text-xs font-bold uppercase tracking-widest">Sin movimientos registrados</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* RIGHT: RESUMEN RAPIDO */}
                <div className="space-y-6">
                    <Card className="rounded-[2.5rem] p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl border-none relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-10"><TrendingUp size={120} /></div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-6">Patrimonio Líquido</h4>
                        <div className="space-y-6 relative z-10">
                            <div>
                                <p className="text-xs font-bold opacity-60 uppercase mb-1">Total en Dólares (Caja + Zelle)</p>
                                <p className="text-4xl font-black tracking-tighter">
                                    {formatCurrency(walletBalances.balances.cash_usd + walletBalances.balances.zelle)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold opacity-60 uppercase mb-1">Total en Bolívares</p>
                                <p className="text-2xl font-black tracking-tighter text-blue-300">
                                    Bs. {walletBalances.balances.bank_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="pt-4 border-t border-white/10">
                                <p className="text-[10px] font-bold opacity-50 uppercase mb-1">USDT (Crypto)</p>
                                <p className="text-xl font-black tracking-tight text-orange-300">
                                    {walletBalances.balances.usdt.toFixed(2)} USDT
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="rounded-[2.5rem] p-6 bg-white dark:bg-[#1c1c1e] border-none shadow-lg">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Acciones Rápidas</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={() => setIsManualModalOpen(true)} variant="outline" className="h-20 rounded-2xl flex flex-col gap-2 hover:bg-emerald-50 hover:border-emerald-200 border-slate-100 shadow-sm group transition-all">
                                <ArrowUpRight className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform"/>
                                <span className="text-[9px] font-black uppercase text-emerald-700">Registrar<br/>Ingreso Extra</span>
                            </Button>
                            <Button onClick={() => setIsManualModalOpen(true)} variant="outline" className="h-20 rounded-2xl flex flex-col gap-2 hover:bg-rose-50 hover:border-rose-200 border-slate-100 shadow-sm group transition-all">
                                <ArrowDownLeft className="w-6 h-6 text-rose-500 group-hover:scale-110 transition-transform"/>
                                <span className="text-[9px] font-black uppercase text-rose-700">Registrar<br/>Gasto Vario</span>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- MODAL: COMPRA DE DIVISAS --- */}
            <Dialog open={isExchangeModalOpen} onOpenChange={setIsExchangeModalOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none bg-white dark:bg-[#1c1c1e] shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                            <RefreshCcw className="text-indigo-600"/> Compra de Divisas
                        </DialogTitle>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Registrar cambio de Bs a Divisa</p>
                    </DialogHeader>
                    
                    <div className="space-y-5 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Sale de (Origen)</Label>
                                <div className="h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center px-4 font-bold text-sm text-blue-700 border border-blue-100">
                                    Banco Nacional
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Entra a (Destino)</Label>
                                <Select value={exchangeForm.destino} onValueChange={(v) => setExchangeForm({...exchangeForm, destino: v})}>
                                    <SelectTrigger className="h-12 rounded-2xl bg-slate-100 border-none font-bold text-xs"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash_usd">Caja Chica ($)</SelectItem>
                                        <SelectItem value="zelle">Zelle</SelectItem>
                                        <SelectItem value="usdt">Binance USDT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-3xl space-y-4 border border-slate-100 dark:border-white/10">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Monto en Bolívares (Pagado)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="h-14 text-xl font-black bg-white dark:bg-black/20 border-none rounded-2xl"
                                    value={exchangeForm.montoSalida}
                                    onChange={(e) => {
                                        const bs = parseFloat(e.target.value) || 0;
                                        const tasa = parseFloat(exchangeForm.tasa) || rates.usd;
                                        setExchangeForm({...exchangeForm, montoSalida: e.target.value, montoEntrada: tasa > 0 ? (bs / tasa).toFixed(2) : ''})
                                    }}
                                />
                            </div>
                            
                            <div className="flex items-center justify-center -my-2 relative z-10">
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-100">
                                    <ArrowRightLeft className="w-4 h-4 text-slate-400"/>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Monto Recibido (Divisa)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="h-14 text-xl font-black bg-white dark:bg-black/20 border-none rounded-2xl text-emerald-600"
                                    value={exchangeForm.montoEntrada}
                                    onChange={(e) => setExchangeForm({...exchangeForm, montoEntrada: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                             <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Tasa de Cambio Real</Label>
                             <Input 
                                type="number" 
                                className="h-12 bg-slate-50 border-none rounded-2xl font-bold"
                                placeholder={`Ref: ${rates.usd}`}
                                value={exchangeForm.tasa}
                                onChange={(e) => setExchangeForm({...exchangeForm, tasa: e.target.value})}
                             />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleExchange} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl">
                            Registrar Operación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             {/* --- MODAL: AJUSTE MANUAL --- */}
             <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none bg-white dark:bg-[#1c1c1e] shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Ajuste Manual</DialogTitle>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Corregir saldo o registrar movimiento extra</p>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                         <div className="grid grid-cols-2 gap-4">
                            <Button 
                                variant={manualForm.tipo === 'INGRESO' ? 'default' : 'outline'}
                                onClick={() => setManualForm({...manualForm, tipo: 'INGRESO'})}
                                className={cn("rounded-2xl h-12 font-black uppercase", manualForm.tipo === 'INGRESO' ? "bg-emerald-600 hover:bg-emerald-700 border-none text-white" : "border-slate-200")}
                            >Ingreso</Button>
                            <Button 
                                variant={manualForm.tipo === 'EGRESO' ? 'default' : 'outline'}
                                onClick={() => setManualForm({...manualForm, tipo: 'EGRESO'})}
                                className={cn("rounded-2xl h-12 font-black uppercase", manualForm.tipo === 'EGRESO' ? "bg-rose-600 hover:bg-rose-700 border-none text-white" : "border-slate-200")}
                            >Egreso</Button>
                         </div>
                         
                         <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Billetera Afectada</Label>
                            <Select value={manualForm.billetera} onValueChange={(v) => setManualForm({...manualForm, billetera: v})}>
                                <SelectTrigger className="h-12 rounded-2xl bg-slate-100 border-none font-bold text-xs"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {WALLETS_CONFIG.map(w => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                         </div>

                         <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Monto</Label>
                            <Input type="number" className="h-14 text-xl font-black bg-slate-50 border-none rounded-2xl" placeholder="0.00" value={manualForm.monto} onChange={e => setManualForm({...manualForm, monto: e.target.value})} />
                         </div>

                         <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Descripción</Label>
                            <Input className="h-12 font-bold bg-slate-50 border-none rounded-2xl" placeholder="Motivo del ajuste..." value={manualForm.descripcion} onChange={e => setManualForm({...manualForm, descripcion: e.target.value})} />
                         </div>
                    </div>
                    <DialogFooter>
                         <Button onClick={handleManualTransaction} className="w-full h-14 rounded-2xl bg-black text-white font-black uppercase tracking-widest">Guardar Ajuste</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function WalletCard({ config, balance, isActive, onClick }: any) {
    return (
        <motion.div 
            onClick={onClick}
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "min-w-[260px] p-6 rounded-[2.5rem] cursor-pointer transition-all border-2 relative overflow-hidden group",
                isActive 
                    ? `border-${config.color}-500/50 shadow-xl shadow-${config.color}-500/20 bg-white dark:bg-[#1c1c1e]` 
                    : "border-transparent bg-white dark:bg-[#1c1c1e] hover:border-slate-200 shadow-sm"
            )}
        >
            {/* Background decoration */}
            <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-10 -mt-10 rounded-full opacity-10 transition-transform group-hover:scale-150", config.bg)} />
            
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={cn("p-3 rounded-2xl text-white shadow-md", config.bg)}>
                    {config.icon}
                </div>
                {isActive && <Badge className={cn("text-white border-none", config.bg)}>ACTIVO</Badge>}
            </div>
            
            <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{config.label}</p>
                <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
                    {config.currency === 'USD' ? '$' : config.currency === 'USDT' ? '₮' : 'Bs.'}
                    {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
            </div>
        </motion.div>
    )
}

function MovementRow({ movement, currency }: any) {
    const isIncome = movement.type === 'INGRESO';
    return (
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-[1.5rem] hover:bg-slate-100 transition-colors group border border-transparent hover:border-slate-200">
            <div className="flex items-center gap-4">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    isIncome ? "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200" : "bg-rose-100 text-rose-600 group-hover:bg-rose-200"
                )}>
                    {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{movement.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4 bg-white border-slate-200">{movement.category}</Badge>
                        <span className="text-[9px] font-bold text-slate-400">{movement.date.toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <p className={cn("text-base font-black tracking-tighter", isIncome ? "text-emerald-600" : "text-rose-600")}>
                    {isIncome ? "+" : "-"}{movement.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase">{currency}</p>
            </div>
        </div>
    )
}