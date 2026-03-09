// @/components/dashboard/WalletsView.tsx
"use client"

import React, { useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Wallet, TrendingUp, TrendingDown, RefreshCcw, 
    Plus, Coins, Landmark, CreditCard, ArrowUpRight, ArrowDownLeft,
    Banknote, Settings, Calculator, HelpCircle, X, AlertTriangle, 
    Megaphone, ShieldAlert, Loader2, Search, Receipt, FileText, Image as ImageIcon,
    ExternalLink, Eye, Layers
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/order-utils"

// --- IMPORTACIONES DE FIREBASE ---
import { collection, addDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface WalletsViewProps {
    rates: { usd: number, eur: number, usdt: number }
    yesterdayRate?: number
    initialBalancesData?: { cash_usd: number, bank_bs: number, zelle: number, usdt: number }
}

const WALLETS_CONFIG = [
    { id: 'cash_usd', label: 'Caja Chica ($)', currency: 'USD', icon: <Banknote className="w-6 h-6"/>, color: 'emerald', bg: 'bg-emerald-600' },
    { id: 'bank_bs', label: 'Banco Nacional (Bs)', currency: 'VES', icon: <Landmark className="w-6 h-6"/>, color: 'blue', bg: 'bg-blue-600' },
    { id: 'zelle', label: 'Zelle / Bofa', currency: 'USD', icon: <CreditCard className="w-6 h-6"/>, color: 'purple', bg: 'bg-purple-600' },
    { id: 'usdt', label: 'Binance / USDT', currency: 'USDT', icon: <Coins className="w-6 h-6"/>, color: 'orange', bg: 'bg-orange-500' },
]

const parseDate = (val: any) => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate();
    return new Date(val);
}

export function WalletsView({ rates, yesterdayRate = 0, initialBalancesData }: WalletsViewProps) {
    
    // --- ESTADOS ---
    const [selectedWallet, setSelectedWallet] = useState<string>('cash_usd')
    const [showTutorial, setShowTutorial] = useState(false)
    const [searchQuery, setSearchQuery] = useState("") 
    
    // Modales
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false)
    const [selectedMovement, setSelectedMovement] = useState<any | null>(null) 

    const prevRate = yesterdayRate || (rates.usd * 0.98); 

    const [initialBalances, setInitialBalances] = useState({
        cash_usd: initialBalancesData?.cash_usd || 0,
        bank_bs: initialBalancesData?.bank_bs || 0,
        zelle: initialBalancesData?.zelle || 0,
        usdt: initialBalancesData?.usdt || 0,
    })
    const [tempInitialBalances, setTempInitialBalances] = useState(initialBalances)

    const [exchangeForm, setExchangeForm] = useState({ 
        origen: 'bank_bs', destino: 'cash_usd', montoSalida: '', montoEntrada: '', tasa: rates.usd.toString(), referencia: '' 
    })
    
    const [manualForm, setManualForm] = useState({ 
        mode: 'SIMPLE', tipo: 'INGRESO', billetera: 'cash_usd', monto: '', montoReal: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] 
    })

    const [unlockedWallets, setUnlockedWallets] = useState<Record<string, boolean>>({})
    const [cuadreData, setCuadreData] = useState<Record<string, string>>({})

    const [fullOrdenes, setFullOrdenes] = useState<any[]>([])
    const [fullGastos, setFullGastos] = useState<any[]>([])
    const [fullPagos, setFullPagos] = useState<any[]>([])
    const [fullMovimientos, setFullMovimientos] = useState<any[]>([])
    const [isCalculating, setIsCalculating] = useState(true)

    // OBTENER HISTORIA COMPLETA
    useEffect(() => {
        const fetchFullHistory = async () => {
            setIsCalculating(true);
            try {
                const [oSnap, gSnap, pSnap, mSnap] = await Promise.all([
                    getDocs(collection(db, "ordenes")),
                    getDocs(collection(db, "gastos_insumos")),
                    getDocs(collection(db, "pagos")),
                    getDocs(collection(db, "movimientos_caja"))
                ]);
                setFullOrdenes(oSnap.docs.map(d => ({id: d.id, ...d.data()})));
                setFullGastos(gSnap.docs.map(d => ({id: d.id, ...d.data()})));
                setFullPagos(pSnap.docs.map(d => ({id: d.id, ...d.data()})));
                setFullMovimientos(mSnap.docs.map(d => ({id: d.id, ...d.data()})));
            } catch (error) {
                console.error("Error obteniendo historia para billeteras", error);
            } finally {
                setIsCalculating(false);
            }
        };
        fetchFullHistory();
    }, []);

    useEffect(() => {
        if(initialBalancesData) {
            setInitialBalances(initialBalancesData)
            setTempInitialBalances(initialBalancesData)
        }
    }, [initialBalancesData])

    // --- MOTOR DE CÁLCULO Y AGRUPACIÓN DE ABONOS GLOBALES ---
    const walletBalances = useMemo(() => {
        const balances: any = { 
            cash_usd: Number(initialBalances.cash_usd), 
            bank_bs: Number(initialBalances.bank_bs), 
            zelle: Number(initialBalances.zelle), 
            usdt: Number(initialBalances.usdt) 
        };
        const movements: any[] = [];
        const groupedPayments: Record<string, any> = {};

        // 0. Saldos Iniciales
        Object.entries(initialBalances).forEach(([key, value]) => {
            if (Number(value) > 0) {
                movements.push({
                    id: `init-${key}`, type: 'SALDO_INICIAL', wallet: key, amount: Number(value),
                    description: 'Saldo Inicial Configurado', date: new Date('2024-01-01'), category: 'Ajuste'
                });
            }
        });

        // 1. Ingresos (Facturación) con Agrupación Inteligente por CLOUDINARY LINK
        fullOrdenes.forEach(o => {
            const clienteName = o.cliente?.nombreRazonSocial || 'Cliente S/N';
            (o.registroPagos || []).forEach((p: any, index: number) => {
                const metodo = (p.metodo || p.paymentMethod || '').toLowerCase();
                let targetWallet = 'cash_usd'; 
                let amount = Number(p.montoUSD) || 0;
                let originalCurrencyAmount = amount;
                const tasaAplicada = Number(p.tasaBCV) || rates.usd;

                if (metodo.includes('movil') || metodo.includes('transferencia') || metodo.includes('bs')) {
                    targetWallet = 'bank_bs';
                    originalCurrencyAmount = (p.montoBs && Number(p.montoBs) > 0) ? Number(p.montoBs) : amount * tasaAplicada;
                } else if (metodo.includes('zelle')) targetWallet = 'zelle';
                else if (metodo.includes('usdt')) targetWallet = 'usdt';

                balances[targetWallet] += originalCurrencyAmount;
                
                // ¿Es un Abono Global?
                const isGlobal = metodo.includes('abono global') || (p.nota && p.nota.toLowerCase().includes('consolidado global'));

                if (isGlobal) {
                    let groupKey = '';
                    const img = p.imagenUrl || p.comprobante;

                    // ✨ MAGIA: Agrupar usando la imagen de Cloudinary si existe
                    if (img && img.length > 10) {
                        groupKey = `GLOBAL_IMG_${img}`;
                    } else {
                        // Fallback: Si no hay imagen, agrupa por fecha (ignorando los segundos) y cliente
                        const dateKey = new Date(p.fecha || p.fechaPago || new Date()).toISOString().slice(0, 16); 
                        groupKey = `GLOBAL_TXT_${targetWallet}_${dateKey}_${clienteName}`;
                    }

                    if (!groupedPayments[groupKey]) {
                        groupedPayments[groupKey] = {
                            id: groupKey,
                            type: 'INGRESO',
                            wallet: targetWallet,
                            amount: 0,
                            description: `Abono Global - ${clienteName}`,
                            date: parseDate(p.fecha || p.fechaPago),
                            category: 'Abono Global',
                            montoUSD: 0,
                            tasaAplicada: tasaAplicada,
                            metodoPago: p.metodo || p.paymentMethod || 'Abono Global',
                            referencia: p.nota || p.referencia || '',
                            imagenUrl: img || null,
                            ordenesRelacionadas: [] // Guardamos los N° de ordenes
                        };
                    }

                    // Sumamos los montos en el bloque unificado
                    groupedPayments[groupKey].amount += originalCurrencyAmount;
                    groupedPayments[groupKey].montoUSD += amount;
                    
                    // Solo añadimos la orden si no está ya en la lista (para evitar duplicados visuales)
                    if (!groupedPayments[groupKey].ordenesRelacionadas.includes(o.ordenNumero)) {
                        groupedPayments[groupKey].ordenesRelacionadas.push(o.ordenNumero);
                    }
                    
                    // Si el grupo aún no tenía imagen pero este recibo sí, se la ponemos
                    if (!groupedPayments[groupKey].imagenUrl && img) {
                        groupedPayments[groupKey].imagenUrl = img;
                    }
                } else {
                    // Pago Individual (Flujo normal)
                    movements.push({ 
                        id: `in-${o.id}-${index}`, 
                        type: 'INGRESO', wallet: targetWallet, amount: originalCurrencyAmount, 
                        description: `Orden #${o.ordenNumero || 'S/N'} - ${clienteName}`, 
                        date: parseDate(p.fecha || p.fechaPago), 
                        category: 'Venta',
                        montoUSD: amount,
                        tasaAplicada: tasaAplicada,
                        metodoPago: p.metodo || p.paymentMethod || 'N/A',
                        referencia: p.nota || p.referencia || '',
                        imagenUrl: p.imagenUrl || p.comprobante || null,
                        ordenRef: String(o.ordenNumero)
                    });
                }
            });
        });

        // Insertamos los abonos globales agrupados en los movimientos de la billetera
        Object.values(groupedPayments).forEach(group => {
            group.ordenRef = group.ordenesRelacionadas.join(', ');
            movements.push(group);
        });

        // 2. Gastos
        fullGastos.forEach(g => {
            const metodo = (g.metodoPago || '').toLowerCase();
            let targetWallet = 'bank_bs'; 
            let amountUSD = Number(g.monto) || Number(g.montoUSD) || 0;
            const tasaAplicada = Number(g.tasa) || rates.usd; 
            let amountWallet = amountUSD * tasaAplicada; 
            
            if (metodo.includes('dolar') || metodo.includes('efectivo')) { targetWallet = 'cash_usd'; amountWallet = amountUSD; }
            else if (metodo.includes('zelle')) { targetWallet = 'zelle'; amountWallet = amountUSD; }
            else if (metodo.includes('usdt')) { targetWallet = 'usdt'; amountWallet = amountUSD; }

            balances[targetWallet] -= amountWallet;
            movements.push({ 
                id: `out-${g.id}`, type: 'EGRESO', wallet: targetWallet, amount: amountWallet, 
                description: g.nombre || g.descripcion || 'Gasto', date: parseDate(g.fecha), category: 'Gasto',
                montoUSD: amountUSD,
                tasaAplicada: tasaAplicada,
                metodoPago: g.metodoPago || 'N/A',
                referencia: g.referencia || g.numeroFactura || '',
                imagenUrl: g.imagenUrl || g.reciboUrl || null
            });
        });

        // 3. Nómina
        fullPagos.forEach(p => {
            balances['cash_usd'] -= (Number(p.totalUSD) || 0);
            movements.push({ 
                id: `nom-${p.id}`, type: 'EGRESO', wallet: 'cash_usd', amount: Number(p.totalUSD), 
                description: `Nómina: ${p.nombre}`, date: parseDate(p.fechaPago || p.fecha), category: 'Nómina',
                montoUSD: Number(p.totalUSD),
                tasaAplicada: rates.usd,
                metodoPago: 'Efectivo USD (Asumido)',
                referencia: p.nota || '',
                imagenUrl: p.comprobante || null
            });
        });

        // 4. Movimientos Manuales y Ajustes de Cuadre
        (fullMovimientos || []).forEach((m: any) => {
            const targetWallet = m.billetera || 'cash_usd';
            const amount = Number(m.monto) || 0;
            
            if (m.tipo === 'INGRESO') balances[targetWallet] += amount;
            else balances[targetWallet] -= amount;
            
            movements.push({ 
                id: `man-${m.id || Math.random()}`, type: m.tipo, wallet: targetWallet, amount: amount, 
                description: m.descripcion, date: parseDate(m.fecha), category: m.categoria || 'Ajuste',
                montoUSD: targetWallet === 'bank_bs' ? (amount / rates.usd) : amount,
                tasaAplicada: targetWallet === 'bank_bs' ? rates.usd : 1,
                metodoPago: 'Ajuste de Sistema',
                referencia: 'Cuadre / Movimiento Manual',
                imagenUrl: null
            });
        });

        movements.sort((a, b) => b.date.getTime() - a.date.getTime());
        return { balances, movements };
    }, [fullOrdenes, fullGastos, fullPagos, fullMovimientos, rates, initialBalances]);

    // Filtro del buscador
    const activeMovements = useMemo(() => {
        let movs = walletBalances.movements.filter((m:any) => m.wallet === selectedWallet);
        if (searchQuery.trim() !== "") {
            const q = searchQuery.toLowerCase();
            movs = movs.filter((m:any) => 
                m.description?.toLowerCase().includes(q) || 
                m.referencia?.toLowerCase().includes(q) ||
                m.category?.toLowerCase().includes(q) ||
                (m.ordenRef && m.ordenRef.includes(q))
            );
        }
        return movs;
    }, [walletBalances.movements, selectedWallet, searchQuery]);

    const rateAnalysis = useMemo(() => {
        const diff = rates.usd - prevRate;
        const percentChange = prevRate > 0 ? ((diff / prevRate) * 100) : 0;
        const isRisk = percentChange > 2; 
        return { diff, percentChange, isRisk, trend: diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : 'EQUAL' }
    }, [rates.usd, prevRate]);

    const getWalletBalance = (walletId: string) => walletBalances.balances[walletId] || 0;
    
    // --- HANDLERS ---
    const handleSaveInit = () => { setInitialBalances(tempInitialBalances); setIsConfigModalOpen(false); }
    const handleEx = () => { setIsExchangeModalOpen(false); alert("Compra de Divisas Registrada (Conectar a Base de Datos)"); }

    const handleManual = async () => { 
        if (!manualForm.monto || parseFloat(manualForm.monto) <= 0) return alert("Ingrese un monto válido");
        const ajuste = {
            billetera: manualForm.billetera, tipo: manualForm.tipo, monto: parseFloat(manualForm.monto),
            descripcion: manualForm.descripcion || `Movimiento manual (${manualForm.tipo})`,
            fecha: new Date().toISOString(), categoria: 'Ajuste'
        };
        try {
            await addDoc(collection(db, "movimientos_caja"), ajuste);
            alert("¡Movimiento guardado exitosamente!");
            setIsManualModalOpen(false);
            window.location.reload();
        } catch (error) { alert("Error al guardar el movimiento"); }
    }

    const handleUnlockWallet = (walletId: string, walletLabel: string) => {
        if (window.confirm(`¿Realizar cuadre en ${walletLabel}? El sistema creará un ajuste por la diferencia.`)) {
            setUnlockedWallets(prev => ({ ...prev, [walletId]: true }));
            setCuadreData(prev => ({ ...prev, [walletId]: getWalletBalance(walletId).toString() }));
        }
    }

    const handleSaveCuadre = async () => {
        const ajustes = Object.keys(unlockedWallets).map(walletId => {
            const sysBal = getWalletBalance(walletId);
            const realVal = parseFloat(cuadreData[walletId] || '0');
            const diff = realVal - sysBal;
            if (diff !== 0) return { billetera: walletId, tipo: diff > 0 ? 'INGRESO' : 'EGRESO', monto: Math.abs(diff), descripcion: `Ajuste por Cuadre (${diff > 0 ? 'Sobrante' : 'Faltante'})`, fecha: new Date().toISOString(), categoria: 'Ajuste' };
            return null;
        }).filter(Boolean);

        if (ajustes.length === 0) return alert("No hay diferencias para guardar.");
        try {
            for (const ajuste of ajustes) await addDoc(collection(db, "movimientos_caja"), ajuste);
            alert("¡Cuadre guardado exitosamente!");
            window.location.reload(); 
        } catch (error) { alert("Hubo un error al guardar el ajuste."); }
    }

    const currentWalletData = WALLETS_CONFIG.find(w => w.id === selectedWallet);

    return (
        <div className="space-y-6 p-2 font-sans pb-24 text-slate-800 dark:text-slate-100 animate-in fade-in duration-500 relative">
            
            {isCalculating && (
                <div className="absolute inset-0 z-50 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-[2.5rem]">
                    <div className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-2xl border border-black/10">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Calculando Auditoría...</p>
                    </div>
                </div>
            )}

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
                    </div>
                </div>
                
                <div className="flex gap-2 relative">
                    <Button onClick={() => setIsConfigModalOpen(true)} variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100 text-slate-400"><Settings className="w-5 h-5" /></Button>
                    <Button onClick={() => setIsManualModalOpen(true)} variant="outline" className="rounded-2xl border-slate-200 font-bold uppercase text-[10px] tracking-wider gap-2"><Plus className="w-4 h-4" /> Ajuste</Button>
                    <Button onClick={() => setIsExchangeModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-wider gap-2 shadow-lg"><RefreshCcw className="w-4 h-4" /> Cambiar</Button>
                </div>
            </div>

            <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
                    {WALLETS_CONFIG.map(wallet => {
                        const balance = walletBalances.balances[wallet.id];
                        const secondaryValue = wallet.id === 'bank_bs' ? (balance / rates.usd) : null;
                        return (
                            <WalletCard 
                                key={wallet.id} config={wallet} balance={balance} 
                                isActive={selectedWallet === wallet.id} onClick={() => setSelectedWallet(wallet.id)}
                                secondaryValue={secondaryValue} rateAnalysis={wallet.id === 'bank_bs' ? rateAnalysis : null}
                            />
                        )
                    })}
                </div>
            </div>

            {/* MAIN CONTENT CON BUSCADOR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[2.5rem] border-none shadow-xl bg-white dark:bg-[#1c1c1e] overflow-hidden flex flex-col h-[600px]">
                        
                        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tight">{currentWalletData?.label}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Historial de Movimientos</p>
                            </div>
                            
                            {/* NUEVO BUSCADOR */}
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                    placeholder="Buscar cliente, orden, nota..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm focus-visible:ring-1 focus-visible:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                            {activeMovements.map((mov: any) => (
                                <MovementRow 
                                    key={mov.id} 
                                    movement={mov} 
                                    currency={currentWalletData?.currency || 'USD'} 
                                    onClick={() => setSelectedMovement(mov)}
                                />
                            ))}
                            {activeMovements.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-50 py-20">
                                    <Receipt className="w-16 h-16 mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest text-center">
                                        {searchQuery ? "No hay resultados para tu búsqueda" : "No hay movimientos registrados"}
                                    </p>
                                </div>
                            )}
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
                                {formatCurrency(walletBalances.balances.cash_usd + walletBalances.balances.zelle + walletBalances.balances.usdt + (walletBalances.balances.bank_bs / rates.usd))}
                            </p>
                            <p className="text-[10px] font-bold opacity-50 uppercase">Sumando todas las cuentas</p>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- NUEVO MODAL: DETALLE DEL MOVIMIENTO Y COMPROBANTE --- */}
            <AnimatePresence>
                {selectedMovement && (
                    <Dialog open={!!selectedMovement} onOpenChange={(o) => !o && setSelectedMovement(null)}>
                        <DialogContent className="max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            
                            {/* Cabecera dinámica según el tipo de movimiento */}
                            <div className={cn(
                                "p-6 flex items-start gap-4",
                                selectedMovement.type === 'INGRESO' ? "bg-emerald-50" : 
                                selectedMovement.type === 'EGRESO' ? "bg-rose-50" : "bg-slate-100"
                            )}>
                                <div className={cn(
                                    "p-4 rounded-2xl shadow-sm text-white",
                                    selectedMovement.type === 'INGRESO' ? "bg-emerald-500" : 
                                    selectedMovement.type === 'EGRESO' ? "bg-rose-500" : "bg-slate-500"
                                )}>
                                    {selectedMovement.category === 'Abono Global' ? <Layers size={28}/> : selectedMovement.type === 'INGRESO' ? <ArrowDownLeft size={28}/> : 
                                     selectedMovement.type === 'EGRESO' ? <ArrowUpRight size={28}/> : <Landmark size={28}/>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <Badge variant="outline" className="bg-white text-[9px] uppercase font-black tracking-widest px-2 py-0.5">
                                            {selectedMovement.category}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                            {selectedMovement.date.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    </div>
                                    <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 line-clamp-2 leading-tight">
                                        {selectedMovement.description}
                                    </DialogTitle>
                                    {selectedMovement.ordenRef && (
                                        <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> Ref. Orden(es) #{selectedMovement.ordenRef}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Cuerpo del Modal */}
                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-white dark:bg-[#1c1c1e]">
                                
                                {/* Tarjeta de Resumen Matemático */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-[1.5rem] border border-slate-100 dark:border-white/5">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Movimiento</p>
                                        <p className={cn("text-2xl font-black tracking-tighter", 
                                            selectedMovement.type === 'INGRESO' ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {formatCurrency(selectedMovement.amount)} <span className="text-sm">{currentWalletData?.currency}</span>
                                        </p>
                                    </div>

                                    {/* Muestra desglose en USD si la billetera es en Bolívares */}
                                    {currentWalletData?.currency === 'VES' && selectedMovement.montoUSD > 0 && (
                                        <>
                                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-[1.5rem] border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Valor en Dólares</p>
                                                <p className="text-2xl font-black tracking-tighter text-blue-700 dark:text-blue-400">
                                                    {formatCurrency(selectedMovement.montoUSD)}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-[1.5rem] border border-slate-100 dark:border-white/5 col-span-2 md:col-span-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tasa Calculada</p>
                                                <p className="text-xl font-bold tracking-tight text-slate-700 dark:text-slate-300">
                                                    {selectedMovement.tasaAplicada} <span className="text-xs">Bs/$</span>
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Detalles extra */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><CreditCard className="w-3 h-3"/> Método de Pago</Label>
                                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-sm font-bold capitalize">
                                            {selectedMovement.metodoPago || 'No especificado'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3"/> Nota / Referencia</Label>
                                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 min-h-[44px]">
                                            {selectedMovement.referencia || 'Sin nota o referencia'}
                                        </div>
                                    </div>
                                </div>

                                {/* VISOR DEL COMPROBANTE (FOTO) */}
                                {selectedMovement.imagenUrl ? (
                                    <div className="space-y-2 mt-4">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4"/> Comprobante Adjunto
                                        </Label>
                                        <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-100 dark:bg-black relative group">
                                            <img 
                                                src={selectedMovement.imagenUrl} 
                                                alt="Comprobante" 
                                                className="w-full object-contain max-h-[300px] cursor-pointer"
                                                onClick={() => window.open(selectedMovement.imagenUrl, '_blank')}
                                            />
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="sm" className="bg-black/50 hover:bg-black text-white rounded-lg backdrop-blur-md text-[10px] uppercase font-bold" onClick={() => window.open(selectedMovement.imagenUrl, '_blank')}>
                                                    <ExternalLink className="w-3 h-3 mr-2" /> Ampliar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 p-6 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                                        <Receipt className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Sin Comprobante Físico</p>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>

            {/* MODALES VIEJOS (CONFIG, AJUSTE, CAMBIO) OCULTOS AQUÍ POR ESPACIO PERO ESTÁN INTACTOS */}
            {/* --- MODAL CONFIGURACIÓN DE SALDOS --- */}
            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent className="rounded-[2.5rem] bg-white dark:bg-[#1c1c1e]"><DialogHeader><DialogTitle>Saldos Iniciales</DialogTitle></DialogHeader><div className="py-4 space-y-4"><div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Caja Chica ($)</Label><Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.cash_usd} onChange={e=>setTempInitialBalances({...tempInitialBalances, cash_usd: +e.target.value})}/></div><div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Banco (Bs)</Label><Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.bank_bs} onChange={e=>setTempInitialBalances({...tempInitialBalances, bank_bs: +e.target.value})}/></div><div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Zelle ($)</Label><Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.zelle} onChange={e=>setTempInitialBalances({...tempInitialBalances, zelle: +e.target.value})}/></div><div className="space-y-1"><Label className="text-xs uppercase text-slate-400">Binance (USDT)</Label><Input type="number" className="rounded-xl bg-slate-50 border-none font-bold" value={tempInitialBalances.usdt} onChange={e=>setTempInitialBalances({...tempInitialBalances, usdt: +e.target.value})}/></div><Button onClick={handleSaveInit} className="w-full h-12 bg-slate-900 text-white rounded-xl uppercase font-black">Guardar</Button></div></DialogContent>
            </Dialog>

            {/* --- MODAL AJUSTE / CUADRE --- */}
            <Dialog open={isManualModalOpen} onOpenChange={(open) => {setIsManualModalOpen(open); if(!open){setUnlockedWallets({}); setCuadreData({});}}}>
                <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none bg-white dark:bg-[#1c1c1e] shadow-2xl custom-scrollbar max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">{manualForm.mode === 'SIMPLE' ? 'Ajuste Manual' : 'Cuadre de Cajas'}</DialogTitle></DialogHeader>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-2"><button onClick={() => setManualForm({...manualForm, mode: 'SIMPLE', monto: '', montoReal: ''})} className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all", manualForm.mode === 'SIMPLE' ? "bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white" : "text-slate-400 hover:text-slate-600")}>Movimiento Único</button><button onClick={() => setManualForm({...manualForm, mode: 'CUADRE', monto: '', montoReal: ''})} className={cn("flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2", manualForm.mode === 'CUADRE' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600")}><Calculator className="w-3 h-3"/> Cuadre Total</button></div>
                    <div className="space-y-4 py-2">
                        {manualForm.mode === 'SIMPLE' ? (
                            <><Select value={manualForm.billetera} onValueChange={(v) => setManualForm({...manualForm, billetera: v})}><SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold"><SelectValue/></SelectTrigger><SelectContent>{WALLETS_CONFIG.map(w => <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-4"><Button variant={manualForm.tipo === 'INGRESO' ? 'default' : 'outline'} onClick={() => setManualForm({...manualForm, tipo: 'INGRESO'})} className={cn("rounded-xl font-black", manualForm.tipo === 'INGRESO' && "bg-emerald-600 text-white")}>Ingreso</Button><Button variant={manualForm.tipo === 'EGRESO' ? 'default' : 'outline'} onClick={() => setManualForm({...manualForm, tipo: 'EGRESO'})} className={cn("rounded-xl font-black", manualForm.tipo === 'EGRESO' && "bg-rose-600 text-white")}>Egreso</Button></div><Input type="number" placeholder="Monto" className="h-12 bg-slate-50 border-none rounded-xl font-bold" value={manualForm.monto} onChange={e => setManualForm({...manualForm, monto: e.target.value})} /><Input placeholder="Descripción (Ej: Pago proveedor)" className="h-12 bg-slate-50 border-none rounded-xl" value={manualForm.descripcion} onChange={e => setManualForm({...manualForm, descripcion: e.target.value})} /><Button onClick={handleManual} className="w-full h-12 bg-slate-900 text-white rounded-xl uppercase font-black">Guardar Movimiento</Button></>
                        ) : (
                            <div className="space-y-4"><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center mb-4">Desbloquea la cuenta que deseas cuadrar.</p>
                                {WALLETS_CONFIG.map(w => {
                                    const sysBal = getWalletBalance(w.id); const isUnlocked = unlockedWallets[w.id]; const realVal = cuadreData[w.id]; const diff = (realVal !== undefined && realVal !== '') ? parseFloat(realVal) - sysBal : 0;
                                    return (<div key={w.id} className={cn("p-4 rounded-2xl border transition-all", isUnlocked ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-100 opacity-80")}><div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2"><span className="p-1.5 rounded-lg bg-white shadow-sm text-slate-700">{w.icon}</span><span className="font-black text-sm uppercase text-slate-700">{w.label}</span></div>{!isUnlocked ? (<Button size="sm" variant="outline" className="h-7 text-[10px] uppercase font-bold rounded-lg" onClick={() => handleUnlockWallet(w.id, w.label)}>Ajustar</Button>) : (<Badge className="bg-indigo-600 hover:bg-indigo-600">Editando</Badge>)}</div><div className="flex gap-3 items-end"><div className="flex-1"><Label className="text-[9px] font-bold uppercase text-slate-400">Saldo Sistema</Label><div className="font-black text-slate-600">{formatCurrency(sysBal)}</div></div><div className="flex-[2]"><Label className="text-[9px] font-bold uppercase text-indigo-600">Saldo Real (Físico/Banco)</Label><Input disabled={!isUnlocked} type="number" placeholder="0.00" value={cuadreData[w.id] ?? ''} onChange={(e) => setCuadreData(prev => ({...prev, [w.id]: e.target.value}))} className={cn("h-10 border-none font-black text-right", isUnlocked ? "bg-white text-indigo-700 shadow-sm" : "bg-slate-200/50 text-slate-400")} /></div></div>{isUnlocked && realVal !== '' && diff !== 0 && (<div className={cn("mt-3 p-2 rounded-xl text-center text-xs font-black uppercase tracking-wide", diff > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{diff > 0 ? "Sobrante" : "Faltante"}: {formatCurrency(Math.abs(diff))}<span className="block text-[8px] opacity-70 mt-0.5">Se creará un movimiento automático</span></div>)}{isUnlocked && realVal !== '' && diff === 0 && (<div className="mt-3 p-2 rounded-xl text-center text-xs font-black uppercase tracking-wide bg-slate-200 text-slate-600">Cuadre Exacto (Sin diferencias)</div>)}</div>)
                                })}
                                <Button onClick={handleSaveCuadre} disabled={Object.keys(unlockedWallets).length === 0} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl uppercase font-black tracking-widest shadow-xl mt-4">Aplicar Ajustes</Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isExchangeModalOpen} onOpenChange={setIsExchangeModalOpen}>
                <DialogContent className="max-w-md rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] shadow-2xl overflow-hidden"><DialogHeader><DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3"><RefreshCcw className="text-indigo-600"/> Compra de Divisas</DialogTitle></DialogHeader><div className="py-4 space-y-5"><div className="bg-slate-50 p-1 rounded-2xl flex items-center border border-slate-100"><div className="pl-4 pr-2 text-[10px] font-black uppercase text-slate-400">Destino:</div><Select value={exchangeForm.destino} onValueChange={(v) => setExchangeForm({...exchangeForm, destino: v})}><SelectTrigger className="h-10 bg-white border-none rounded-xl font-bold text-xs shadow-sm text-indigo-700 flex-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cash_usd">💵 Caja Chica (Efectivo)</SelectItem><SelectItem value="zelle">🏛️ Zelle / Bofa</SelectItem><SelectItem value="usdt">🪙 Binance / USDT</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Precio Compra (Tasa)</Label><Input type="number" className="h-12 bg-indigo-50 border-indigo-100 text-indigo-700 font-black rounded-xl text-center text-lg" value={exchangeForm.tasa} onChange={(e) => {const newRate = parseFloat(e.target.value); const usd = parseFloat(exchangeForm.montoEntrada); const newBs = (usd && newRate) ? (usd * newRate).toFixed(2) : exchangeForm.montoSalida; setExchangeForm({ ...exchangeForm, tasa: e.target.value, montoSalida: newBs });}}/></div><div className="space-y-1"><Label className="text-[9px] font-black uppercase text-emerald-600 ml-2">Dólares a Recibir ($)</Label><Input type="number" className="h-12 bg-emerald-50 border-emerald-100 text-emerald-600 font-black rounded-xl text-center text-lg shadow-inner" value={exchangeForm.montoEntrada} onChange={(e) => {const newUSD = parseFloat(e.target.value); const rate = parseFloat(exchangeForm.tasa); const newBs = (newUSD && rate) ? (newUSD * rate).toFixed(2) : ''; setExchangeForm({ ...exchangeForm, montoEntrada: e.target.value, montoSalida: newBs });}}/></div></div><div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400 ml-2">Monto Salida (Bolívares)</Label><Input type="number" className="h-14 bg-slate-100 border-none text-slate-800 font-black rounded-2xl text-xl px-4" value={exchangeForm.montoSalida} onChange={(e) => {const newBs = parseFloat(e.target.value); const rate = parseFloat(exchangeForm.tasa); const newUSD = (newBs && rate) ? (newBs / rate).toFixed(2) : ''; setExchangeForm({ ...exchangeForm, montoSalida: e.target.value, montoEntrada: newUSD });}}/></div><Button onClick={handleEx} className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl uppercase font-black tracking-widest shadow-xl mt-2 flex flex-col justify-center items-center gap-0"><span>Registrar Compra</span></Button></div></DialogContent>
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

function MovementRow({ movement, currency, onClick }: any) {
    const isIncome = movement.type === 'INGRESO' || movement.type === 'SALDO_INICIAL';
    const isInitial = movement.type === 'SALDO_INICIAL';
    return (
        <div 
            onClick={onClick}
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black/20 rounded-[1.5rem] hover:bg-white dark:hover:bg-white/5 transition-all group border border-transparent hover:border-slate-200 hover:shadow-md cursor-pointer"
        >
            <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm",
                    isInitial ? "bg-slate-200 text-slate-600" : isIncome ? "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white" : "bg-rose-100 text-rose-600 group-hover:bg-rose-500 group-hover:text-white")}>
                    {movement.category === 'Abono Global' ? <Layers className="w-5 h-5" /> : isInitial ? <Landmark className="w-5 h-5"/> : isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="secondary" className="text-[8px] font-black uppercase px-1.5 h-4 bg-white border-slate-200 shadow-sm">{movement.category}</Badge>
                        {movement.imagenUrl && <ImageIcon className="w-3 h-3 text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" title="Tiene comprobante" />}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{movement.description}</p>
                    <p className="text-[9px] font-bold text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        {movement.date.toLocaleDateString()} {movement.referencia && `• Ref: ${movement.referencia}`}
                    </p>
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className={cn("text-base font-black tracking-tighter flex items-center justify-end gap-2", isInitial ? "text-slate-600" : isIncome ? "text-emerald-600" : "text-rose-600")}>
                    {isIncome ? "+" : "-"}{movement.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <Eye className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase mr-6">{currency}</p>
            </div>
        </div>
    )
}