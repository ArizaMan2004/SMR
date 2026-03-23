// @/components/dashboard/BudgetEntryView.tsx
"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'; 
import { motion, AnimatePresence } from "framer-motion"

// --- SERVICIOS ---
import { generateBudgetPDF } from "@/lib/services/pdf-generator";
import { 
    saveBudgetToFirestore, 
    loadBudgetsFromFirestore, 
    deleteBudgetFromFirestore 
} from "@/lib/firebase/firestore-budget-service";
import { createOrden } from "@/lib/services/ordenes-service";
import { getLastOrderNumber } from "@/lib/firebase/ordenes";

// NUEVOS IMPORT PARA CLIENTES
import { subscribeToClients } from "@/lib/services/clientes-service";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

// --- UI COMPONENTS ---
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from 'sonner';

// --- ICONOS ---
import { 
    Plus, Trash2, FileText, Save, Clock, Download, 
    User, Calculator, TrendingUp, Sparkles, Layers, Zap, Wallet, X,
    DollarSign, CheckCircle2, Calendar, Pencil, RotateCcw, Check, 
    AlertCircle, Hourglass, Banknote, ChevronDown, Building2, Users
} from "lucide-react"; 

import { cn } from "@/lib/utils";

// --- CONSTANTES ---
const SMR_CATALOG = [
    "Impresión de Alta Resolución en Vinil Adhesivo ( )", 
    "Letras Corpóreas en Acrílico con Iluminación LED ( )",
    "Medallas en Acrílico Personalizadas ( )", 
    "Servicio de Diseño Gráfico Publicitario",
    "Corte Láser en MDF ( )",
    "Instalación de Vinil en Vidrieras"
];

export default function BudgetEntryView({
    rates = { usd: 0, eur: 0, usdt: 0 }, 
    currentBcvRate, pdfLogoBase64, firmaBase64, selloBase64,
    handleLogoUpload, handleClearLogo, handleFirmaUpload, 
    handleClearFirma, handleSelloUpload, handleClearSello,
    currentUserId
}: any) {
    
    const safeRates = useMemo(() => ({
        usd: rates.usd || currentBcvRate || 1,
        eur: rates.eur || 1,
        usdt: rates.usdt || 1
    }), [rates, currentBcvRate]);

    // --- ESTADO INICIAL ---
    const initialBudgetState = { 
        id: null as string | null, 
        clienteNombre: '', 
        isMaster: false, 
        items: [] as any[],
        dateCreated: null as string | null 
    };

    const [budgetData, setBudgetData] = useState(initialBudgetState);
    const [newItem, setNewItem] = useState({ 
        id: null as number | null, 
        subCliente: '', 
        descripcion: '', 
        cantidad: 1, 
        precioUnitarioUSD: 0 
    });
    
    const [history, setHistory] = useState<any[]>([]); 
    const [clientsList, setClientsList] = useState<any[]>([]); // ESTADO PARA LOS CLIENTES DE LA BD
    const [showClientSuggestions, setShowClientSuggestions] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [errors, setErrors] = useState<any>({}); 
    
    const suggestionRef = useRef<HTMLDivElement>(null);
    const clientRef = useRef<HTMLDivElement>(null); // REF PARA CERRAR EL BUSCADOR DE CLIENTES

    // --- CÁLCULOS ---
    const totalUSD = useMemo(() => 
        budgetData.items.reduce((sum: number, i: any) => sum + i.totalUSD, 0), 
    [budgetData.items]);

    const groupedItems = useMemo(() => {
        if (!budgetData.isMaster) return { 'General': budgetData.items };
        const groups: any = {};
        budgetData.items.forEach(item => {
            const sc = item.subCliente || 'General';
            if (!groups[sc]) groups[sc] = [];
            groups[sc].push(item);
        });
        return groups;
    }, [budgetData.items, budgetData.isMaster]);

    const uniqueSubClientes = useMemo(() => {
        if (!budgetData.isMaster) return [];
        return Array.from(new Set(budgetData.items.map(i => i.subCliente).filter(sc => sc && sc.trim() !== '')));
    }, [budgetData.items, budgetData.isMaster]);

    // --- CARGAR DATOS EXTERNOS (Historial y Clientes) ---
    const fetchHistory = useCallback(async () => {
        try {
            const data = await loadBudgetsFromFirestore();
            if (data) {
                const uniqueEntries = Array.from(new Map(data.map((item: any) => [item.id, item])).values());
                uniqueEntries.sort((a: any, b: any) => {
                    const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                    const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                    return dateB - dateA;
                });
                setHistory(uniqueEntries);
            }
        } catch (e) { console.error("Error al cargar historial:", e); }
    }, []);

    useEffect(() => { 
        fetchHistory(); 
        
        // SUSCRIBIR A LA BASE DE DATOS DE CLIENTES
        const unsubscribeClients = subscribeToClients((data) => {
            setClientsList(data);
        });

        // DETECTAR CLICS AFUERA PARA CERRAR LOS BUSCADORES
        function handleClickOutside(event: any) {
            if (clientRef.current && !clientRef.current.contains(event.target)) {
                setShowClientSuggestions(false);
            }
            if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            unsubscribeClients();
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [fetchHistory]);

    const getDaysElapsed = (dateString: string | null) => {
        if (!dateString) return 0;
        const diff = new Date().getTime() - new Date(dateString).getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    };

    // --- LÓGICA DE CLIENTES ---
    // Filtramos la lista de la BD por lo que se va escribiendo
    const filteredClients = clientsList.filter(c => 
        c.nombreRazonSocial?.toLowerCase().includes(budgetData.clienteNombre.toLowerCase())
    );
    // Verificamos si lo que está escrito es exactamente igual a un cliente para no mostrar el botón de "Guardar"
    const exactClientMatch = clientsList.some(c => 
        c.nombreRazonSocial?.toLowerCase() === budgetData.clienteNombre.trim().toLowerCase()
    );

    const handleSaveNewClient = async (nombre: string) => {
        try {
            await addDoc(collection(db, "clientes"), {
                nombreRazonSocial: nombre.trim().toUpperCase(),
                rifCedulaCompleto: "EXPRESS", 
                telefono: "N/A",
                domicilioFiscal: "N/A",
                correo: "",
                fechaRegistro: new Date().toISOString()
            });
            toast.success(`¡Cliente "${nombre}" guardado en la base de datos!`);
            setShowClientSuggestions(false);
        } catch (error) {
            console.error("Error guardando cliente:", error);
            toast.error("Hubo un error al guardar el cliente.");
        }
    };


    // --- LÓGICA DE PDF ---
    const handleDownloadPDF = async (data: any, rateType: 'USD' | 'EUR' | 'USDT' | 'USD_ONLY') => {
        const dataToPrint = {
            ...data,
            totalUSD: data.totalUSD || totalUSD, 
            dateCreated: data.dateCreated || new Date().toISOString()
        };

        let selectedCurrency = { rate: safeRates.usd, label: "Tasa BCV ($)", symbol: "Bs." };
        if (rateType === 'EUR') selectedCurrency = { rate: safeRates.eur, label: "Tasa BCV (€)", symbol: "Bs." };
        if (rateType === 'USDT') selectedCurrency = { rate: safeRates.usdt, label: "Tasa Monitor", symbol: "Bs." };
        if (rateType === 'USD_ONLY') selectedCurrency = { rate: 1, label: "", symbol: "" };

        await generateBudgetPDF(
            dataToPrint, 
            pdfLogoBase64, 
            { firmaBase64, selloBase64, currency: selectedCurrency }
        );
    };

    // --- LÓGICA DE ITEMS ---
    const handleAddOrUpdateItem = () => {
        const newErrors: any = {};
        let hasError = false;

        if (budgetData.isMaster && !newItem.subCliente.trim()) { newErrors.subCliente = true; hasError = true; }
        if (!newItem.descripcion.trim()) { newErrors.descripcion = true; hasError = true; }
        if (newItem.cantidad <= 0) { newErrors.cantidad = true; hasError = true; }

        if (hasError) {
            setErrors((prev: any) => ({ ...prev, ...newErrors }));
            toast.error("Complete los datos requeridos");
            return;
        }

        const subC = newItem.subCliente.trim();
        const desc = newItem.descripcion.trim() || "Concepto General";
        const calculatedTotal = newItem.cantidad * newItem.precioUnitarioUSD;

        if (newItem.id) {
            setBudgetData((prev: any) => ({
                ...prev,
                items: prev.items.map((item: any) => 
                    item.id === newItem.id 
                    ? { ...newItem, subCliente: subC, descripcion: desc, totalUSD: calculatedTotal } 
                    : item
                )
            }));
            toast.success("Concepto actualizado");
        } else {
            setBudgetData((prev: any) => ({ 
                ...prev, 
                items: [...prev.items, { ...newItem, subCliente: subC, descripcion: desc, id: Date.now(), totalUSD: calculatedTotal }] 
            }));
            toast.success("Concepto añadido");
        }

        setNewItem({ id: null, subCliente: budgetData.isMaster ? subC : '', descripcion: '', cantidad: 1, precioUnitarioUSD: 0 });
        setShowSuggestions(false);
        setErrors((prev:any) => ({ ...prev, subCliente: false, descripcion: false, cantidad: false, precio: false })); 
    };

    const handleEditItemRequest = (item: any) => {
        setNewItem({
            id: item.id,
            subCliente: item.subCliente || '', 
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitarioUSD: item.precioUnitarioUSD
        });
        setErrors({});
    };

    // --- LÓGICA DE GUARDADO ---
    const handleSaveDraft = async () => {
        const newErrors: any = {};
        let hasError = false;

        if (!budgetData.clienteNombre.trim()) { newErrors.clienteNombre = true; hasError = true; }
        
        if (hasError) {
            setErrors((prev: any) => ({ ...prev, ...newErrors }));
            toast.error("Faltan datos obligatorios");
            return;
        }

        if (budgetData.items.length === 0) return toast.error("La tabla está vacía");

        setIsLoading(true);
        try {
            const { id, ...rest } = budgetData;
            const payload: any = {
                ...rest,
                totalUSD: totalUSD,
                dateCreated: budgetData.id ? budgetData.dateCreated : new Date().toISOString(),
                userId: "" 
            };

            if (id) payload.id = id;

            await saveBudgetToFirestore(payload);
            toast.success(id ? "Cambios actualizados" : "Borrador guardado");
            
            setBudgetData(initialBudgetState);
            setErrors({});
            await fetchHistory();
        } catch (error) {
            toast.error("Error al guardar en la base de datos");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConvertToOrder = async (targetBudget?: any) => {
        const data = targetBudget || budgetData;
        if (data.items.length === 0) return toast.error("No hay conceptos para facturar");

        const confirmConversion = window.confirm(`¿Convertir presupuesto de ${data.clienteNombre} en factura real?`);
        if (!confirmConversion) return;

        setIsLoading(true);
        try {
            const lastNumber = await getLastOrderNumber();
            const nextNumber = lastNumber + 1;
            
            const orderPayload = {
                ordenNumero: nextNumber,
                fecha: new Date().toISOString(),
                fechaEntrega: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
                isMaster: data.isMaster || false, 
                cliente: {
                    nombreRazonSocial: data.clienteNombre,
                    rifCedula: "EXPRESS",
                    telefono: "N/A",
                    domicilioFiscal: "N/A",
                    correo: ""
                },
                items: data.items.map((item: any) => ({
                    subCliente: data.isMaster ? (item.subCliente || '') : '',
                    nombre: item.descripcion,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitarioUSD,
                    unidad: 'und',
                    tipoServicio: 'OTROS',
                    subtotal: item.totalUSD
                })),
                totalUSD: data.totalUSD || totalUSD,
                montoPagadoUSD: 0,
                estado: 'PENDIENTE',
                userId: "" 
            };

            await createOrden(orderPayload);
            if (data.id) await deleteBudgetFromFirestore(data.id);

            toast.success(`Orden #${nextNumber} creada con éxito.`);
            setBudgetData(initialBudgetState);
            await fetchHistory();
        } catch (e) {
            toast.error("Error al facturar.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditBudget = (entry: any) => {
        setBudgetData({
            id: entry.id,
            clienteNombre: entry.clienteNombre,
            isMaster: entry.isMaster || false, 
            items: entry.items || [],
            dateCreated: entry.dateCreated || null
        });
        setErrors({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteBudget = async (id: string) => {
        if (!id) return;
        if (!window.confirm("¿Eliminar este presupuesto permanentemente?")) return;

        try {
            await deleteBudgetFromFirestore(id);
            toast.success("Presupuesto eliminado");
            await fetchHistory();
        } catch (error) {
            toast.error("Error al borrar el registro");
        }
    };

    const clearError = (field: string) => {
        if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: false }));
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-8 pb-32 px-4">
            
            <header className="flex flex-col md:flex-row justify-between items-center bg-white/40 dark:bg-white/5 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/20 shadow-2xl gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <FileText className="text-white w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">Presupuestos</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mt-2 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" /> 
                            {budgetData.id ? "Editando Registro" : "Nuevo Documento"}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <AssetPill active={!!pdfLogoBase64} label="Logo" onUpload={handleLogoUpload} onClear={handleClearLogo} />
                    <AssetPill active={!!firmaBase64} label="Firma" onUpload={handleFirmaUpload} onClear={handleClearFirma} />
                    <AssetPill active={!!selloBase64} label="Sello" onUpload={handleSelloUpload} onClear={handleClearSello} />
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total USD" value={`$${totalUSD.toFixed(2)}`} icon={<Wallet />} color="blue" />
                <StatCard label="Monto BS" value={`Bs. ${(totalUSD * safeRates.usd).toLocaleString()}`} icon={<Calculator />} color="emerald" />
                <StatCard label="Tasa BCV" value={safeRates.usd.toFixed(2)} icon={<TrendingUp />} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* CONSTRUCTOR */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="rounded-[3rem] border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="p-8 md:p-12 space-y-10">
                            
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <Label className={cn("text-[10px] font-black uppercase tracking-widest ml-4 flex items-center gap-2", errors.clienteNombre ? "text-red-500" : "text-slate-400")}>
                                    {budgetData.isMaster ? "Empresa Matriz" : "Datos del Cliente"} 
                                    {errors.clienteNombre && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Requerido</span>}
                                </Label>
                                
                                <div className="flex items-center gap-2 w-full md:w-auto px-4 md:px-0">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => { setBudgetData({...budgetData, isMaster: !budgetData.isMaster}); setErrors({}); }} 
                                        className={cn(
                                            "text-[10px] font-black uppercase tracking-wider rounded-xl transition-all h-10 w-full md:w-auto", 
                                            budgetData.isMaster ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm hover:bg-blue-100" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                                        )}
                                    >
                                        <Building2 className="w-4 h-4 mr-2"/> 
                                        {budgetData.isMaster ? "Modo Matriz: ON" : "Presupuesto Matriz"}
                                    </Button>
                                    
                                    {(budgetData.id || budgetData.items.length > 0) && (
                                        <Button variant="ghost" size="icon" onClick={() => { setBudgetData(initialBudgetState); setErrors({}); }} className="text-red-400 hover:bg-red-50 h-10 w-10 shrink-0">
                                            <RotateCcw className="w-4 h-4"/>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* BUSCADOR DE CLIENTES CON AUTOCOMPLETADO */}
                            <div className="relative w-full" ref={clientRef}>
                                <User className={cn("absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors z-10", errors.clienteNombre ? "text-red-400" : "text-slate-300")} />
                                <Input 
                                    value={budgetData.clienteNombre} 
                                    onChange={(e) => { 
                                        setBudgetData({...budgetData, clienteNombre: e.target.value}); 
                                        setShowClientSuggestions(true);
                                        clearError('clienteNombre'); 
                                    }} 
                                    onFocus={() => setShowClientSuggestions(true)}
                                    className={cn(
                                        "h-16 rounded-[1.5rem] border-none font-black text-xl px-16 shadow-inner transition-all relative z-0",
                                        errors.clienteNombre ? "bg-red-50 ring-2 ring-red-500/20 placeholder:text-red-300" : "bg-slate-50 dark:bg-slate-800/50"
                                    )}
                                    placeholder={budgetData.isMaster ? "NOMBRE DE LA EMPRESA MATRIZ..." : "NOMBRE DEL CLIENTE..."} 
                                />
                                
                                <AnimatePresence>
                                    {showClientSuggestions && budgetData.clienteNombre.trim().length > 0 && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-50 border border-slate-100 dark:border-slate-700 overflow-hidden max-h-64 overflow-y-auto">
                                            
                                            {/* LISTA DE CLIENTES COINCIDENTES */}
                                            {filteredClients.map((c, i) => (
                                                <button key={c.id || i} onClick={() => { 
                                                    setBudgetData({...budgetData, clienteNombre: c.nombreRazonSocial}); 
                                                    setShowClientSuggestions(false); 
                                                    clearError('clienteNombre'); 
                                                }} className="w-full text-left p-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold text-xs uppercase border-b last:border-none text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                    <User className="w-3 h-3 text-blue-500" />
                                                    {c.nombreRazonSocial}
                                                    {c.rifCedulaCompleto && c.rifCedulaCompleto !== "EXPRESS" && <span className="text-[9px] text-slate-400 ml-auto">{c.rifCedulaCompleto}</span>}
                                                </button>
                                            ))}

                                            {/* BOTÓN PARA GUARDAR SI NO HAY COINCIDENCIA EXACTA */}
                                            {!exactClientMatch && budgetData.clienteNombre.trim().length > 2 && (
                                                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700">
                                                    <Button 
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleSaveNewClient(budgetData.clienteNombre);
                                                        }} 
                                                        className="w-full text-xs font-bold text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 gap-2"
                                                    >
                                                        <Save className="w-3 h-3"/> Añadir "{budgetData.clienteNombre}" a Base de Datos
                                                    </Button>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* CONCEPTOS */}
                            <div className="space-y-4">
                                <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-blue-500" /> Conceptos {newItem.id && <Badge className="bg-amber-500 ml-2">Editando</Badge>}
                                </h3>
                                <div className={cn("p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border space-y-4 transition-all", (errors.descripcion || errors.cantidad || errors.subCliente) ? "border-red-200 bg-red-50/30" : "border-black/5")}>
                                    
                                    {budgetData.isMaster && (
                                        <div className="mb-4">
                                            <Input 
                                                value={newItem.subCliente} 
                                                onChange={(e) => { setNewItem({...newItem, subCliente: e.target.value}); clearError('subCliente'); }} 
                                                className={cn(
                                                    "h-12 rounded-xl border-none px-6 font-bold text-sm shadow-sm transition-all",
                                                    errors.subCliente ? "bg-red-50 ring-1 ring-red-300 placeholder:text-red-300" : "bg-white dark:bg-slate-900 text-blue-600 placeholder:text-blue-300/50"
                                                )}
                                                placeholder="Nombre del Sub-Cliente o Sucursal (Ej. Tienda Centro)..."
                                            />
                                            {uniqueSubClientes.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-2 mt-2 px-2">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recientes:</span>
                                                    {uniqueSubClientes.map(sc => (
                                                        <Badge
                                                            key={sc as string}
                                                            variant="secondary"
                                                            className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 bg-white dark:bg-slate-800 text-slate-500 text-[10px] transition-colors shadow-sm"
                                                            onClick={() => { setNewItem({...newItem, subCliente: sc as string}); clearError('subCliente'); }}
                                                        >
                                                            {sc as string}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="relative" ref={suggestionRef}>
                                        <Textarea 
                                            value={newItem.descripcion} 
                                            onChange={(e) => { setNewItem({...newItem, descripcion: e.target.value}); setShowSuggestions(true); clearError('descripcion'); }} 
                                            className={cn(
                                                "min-h-[80px] py-4 rounded-xl border-none px-6 font-bold text-base shadow-sm transition-all resize-y",
                                                errors.descripcion ? "bg-red-50 ring-1 ring-red-300 placeholder:text-red-300" : "bg-white dark:bg-slate-900"
                                            )}
                                            placeholder={errors.descripcion ? "⚠️ Escribe una descripción..." : "Nombre del ítem...\nDetalles adicionales..."}
                                        />
                                        <AnimatePresence>
                                            {showSuggestions && newItem.descripcion.length > 1 && (
                                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-50 border border-slate-100 dark:border-slate-700 overflow-hidden">
                                                    {SMR_CATALOG.filter(s => s.toLowerCase().includes(newItem.descripcion.toLowerCase())).map((s, i) => (
                                                        <button key={i} onClick={() => { setNewItem({...newItem, descripcion: s}); setShowSuggestions(false); clearError('descripcion'); }} className="w-full text-left p-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold text-xs uppercase border-b last:border-none text-slate-600 dark:text-slate-300">{s}</button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-3">
                                            <Input 
                                                type="number" 
                                                value={newItem.cantidad === 0 ? '' : newItem.cantidad} 
                                                onChange={(e) => { setNewItem({...newItem, cantidad: Number(e.target.value) || 0}); clearError('cantidad'); }} 
                                                className={cn(
                                                    "h-14 rounded-xl border-none text-center font-black transition-all",
                                                    errors.cantidad ? "bg-red-50 ring-1 ring-red-300 text-red-600" : "bg-white dark:bg-slate-900"
                                                )} 
                                                placeholder="Cant." 
                                            />
                                        </div>
                                        <div className="col-span-6 relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                            <Input 
                                                type="number" 
                                                value={newItem.precioUnitarioUSD === 0 ? '' : newItem.precioUnitarioUSD} 
                                                onChange={(e) => { setNewItem({...newItem, precioUnitarioUSD: Number(e.target.value) || 0}); clearError('precio'); }} 
                                                className="h-14 rounded-xl bg-white dark:bg-slate-900 border-none pl-10 font-black text-blue-600" 
                                                placeholder="Precio Unitario" 
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <Button 
                                                onClick={handleAddOrUpdateItem} 
                                                className={cn(
                                                    "w-full h-14 rounded-xl text-white shadow-lg active:scale-95 transition-all",
                                                    newItem.id ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                                                )}
                                            >
                                                {newItem.id ? <Check /> : <Plus />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TABLA DE ITEMS */}
                            <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-800/30">
                                        <TableRow className="border-none">
                                            <TableHead className="px-8 text-[9px] font-black uppercase tracking-widest">Descripción</TableHead>
                                            <TableHead className="text-right px-8 text-[9px] font-black uppercase tracking-widest">Subtotal</TableHead>
                                            <TableHead className="w-24"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(groupedItems).map(([subCliente, items]: any) => (
                                            <React.Fragment key={subCliente}>
                                                
                                                {budgetData.isMaster && (
                                                    <TableRow 
                                                        className="bg-blue-50/80 dark:bg-blue-900/30 border-none group cursor-pointer hover:bg-blue-100/80 transition-colors"
                                                        onClick={() => { 
                                                            setNewItem({...newItem, subCliente: subCliente}); 
                                                            clearError('subCliente');
                                                            window.scrollTo({ top: 0, behavior: 'smooth' }); 
                                                        }}
                                                        title="Clic para añadir un ítem a este cliente"
                                                    >
                                                        <TableCell colSpan={3} className="px-8 py-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-black text-[10px] uppercase tracking-widest text-blue-800 dark:text-blue-400 flex items-center gap-2">
                                                                    <Users className="w-3 h-3"/> {subCliente}
                                                                </span>
                                                                <span className="text-[9px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                                    <Plus className="w-3 h-3"/> Añadir
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}

                                                {items.map((item: any) => (
                                                    <TableRow key={item.id} className={cn("h-16 border-b dark:border-slate-800 transition-colors", newItem.id === item.id && "bg-amber-50 dark:bg-amber-500/5", budgetData.isMaster && "border-none")}>
                                                        <TableCell className="px-8 font-bold uppercase text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed py-4">
                                                            {item.descripcion} <span className="ml-2 text-slate-400 font-black italic">x{item.cantidad}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right px-8 font-black text-blue-600 text-sm tracking-tight">${item.totalUSD.toFixed(2)}</TableCell>
                                                        <TableCell className="pr-6">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon" onClick={() => handleEditItemRequest(item)} className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => setBudgetData((p:any) => ({...p, items: p.items.filter((i:any) => i.id !== item.id)}))} className="text-red-400 hover:bg-red-50">
                                                                    <Trash2 className="w-4 h-4"/>
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}

                                                {budgetData.isMaster && (
                                                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50/50">
                                                        <TableCell className="text-right px-8 font-black text-[9px] uppercase tracking-widest text-slate-500">
                                                            Subtotal {subCliente}
                                                        </TableCell>
                                                        <TableCell className="text-right px-8 font-black text-slate-700 dark:text-slate-200">
                                                            ${items.reduce((s:number, i:any) => s + i.totalUSD, 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell></TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button onClick={() => handleConvertToOrder()} disabled={isLoading || budgetData.items.length === 0} className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs gap-3 shadow-xl active:scale-95 transition-all">
                                    {isLoading ? <Clock className="animate-spin w-5 h-5" /> : <Zap className="w-5 h-5" />} Facturar ahora
                                </Button>
                                <Button onClick={handleSaveDraft} disabled={isLoading} className="h-16 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-xs gap-3 active:scale-95 transition-all">
                                    <Save className="w-5 h-5" /> {budgetData.id ? "Actualizar Registro" : "Guardar Borrador"}
                                </Button>
                                
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            disabled={budgetData.items.length === 0} 
                                            className="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs gap-3 active:scale-95 transition-all flex items-center justify-center"
                                        >
                                            <Download className="w-5 h-5" /> Exportar PDF <ChevronDown className="w-3 h-3 opacity-50 ml-1"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-2xl min-w-[200px] p-2">
                                        <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400 px-2 py-1.5">Seleccionar Tasa</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleDownloadPDF(budgetData, 'USD')} className="gap-3 cursor-pointer text-xs font-bold p-2 rounded-xl focus:bg-emerald-50 text-emerald-700">
                                            <Badge variant="outline" className="bg-emerald-100 text-emerald-600 border-emerald-200">BCV $</Badge>
                                            {safeRates.usd.toFixed(2)}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownloadPDF(budgetData, 'EUR')} className="gap-3 cursor-pointer text-xs font-bold p-2 rounded-xl focus:bg-blue-50 text-blue-700">
                                            <Badge variant="outline" className="bg-blue-100 text-blue-600 border-blue-200">BCV €</Badge>
                                            {safeRates.eur.toFixed(2)}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownloadPDF(budgetData, 'USDT')} className="gap-3 cursor-pointer text-xs font-bold p-2 rounded-xl focus:bg-orange-50 text-orange-700">
                                            <Badge variant="outline" className="bg-orange-100 text-orange-600 border-orange-200">Monitor</Badge>
                                            {safeRates.usdt.toFixed(2)}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleDownloadPDF(budgetData, 'USD_ONLY')} className="gap-3 cursor-pointer text-xs font-bold p-2 rounded-xl focus:bg-slate-100 text-slate-600">
                                            <Banknote className="w-4 h-4 text-slate-500" />
                                            Solo Dólares (Sin Bs)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* HISTORIAL LATERAL */}
                <aside className="lg:col-span-4 space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h2 className="text-xl font-black italic uppercase flex items-center gap-3 text-slate-900 dark:text-white">
                            <Clock className="w-5 h-5 text-blue-600" /> Recientes
                        </h2>
                        <Badge className="rounded-full bg-blue-100 text-blue-600 px-3 border-none font-black">{history.length}</Badge>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                        {history.map((entry) => {
                            const daysOld = getDaysElapsed(entry.dateCreated);
                            let ageColor = "bg-emerald-100 text-emerald-600";
                            if (daysOld > 3) ageColor = "bg-amber-100 text-amber-600";
                            if (daysOld > 7) ageColor = "bg-rose-100 text-rose-600";

                            return (
                                <motion.div key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <Card className="p-5 rounded-[2.5rem] border-none shadow-lg bg-white dark:bg-slate-900 group relative overflow-hidden transition-all hover:scale-[1.02]">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-2 min-w-0 pr-4">
                                                <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm truncate uppercase italic tracking-tight flex items-center gap-2">
                                                    {entry.isMaster && <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0"/>}
                                                    {entry.clienteNombre}
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline" className="border-slate-200 text-slate-400 font-bold text-[9px] h-5 px-1.5 flex gap-1">
                                                        <Calendar className="w-2.5 h-2.5" /> 
                                                        {entry.dateCreated ? new Date(entry.dateCreated).toLocaleDateString() : 'Hoy'}
                                                    </Badge>
                                                    {daysOld > 0 && (
                                                        <Badge className={cn("border-none font-black text-[8px] h-5 px-1.5 flex gap-1", ageColor)}>
                                                            <Hourglass className="w-2.5 h-2.5" /> 
                                                            Hace {daysOld} días
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-lg font-black text-blue-600 tracking-tighter leading-none">${entry.totalUSD?.toFixed(2)}</p>
                                        </div>
                                        
                                        <div className="mt-4 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                                            <Button size="icon" onClick={() => handleEditBudget(entry)} className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors shadow-sm" title="Editar">
                                                <Pencil className="w-4 h-4" />
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="icon" className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors shadow-sm">
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-2xl min-w-[200px] p-2">
                                                    <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400 px-2 py-1.5">Tasa PDF</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleDownloadPDF(entry, 'USD')} className="gap-2 cursor-pointer text-xs font-bold p-2 rounded-xl text-emerald-700">
                                                        BCV $ ({safeRates.usd.toFixed(2)})
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadPDF(entry, 'EUR')} className="gap-2 cursor-pointer text-xs font-bold p-2 rounded-xl text-blue-700">
                                                        BCV € ({safeRates.eur.toFixed(2)})
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadPDF(entry, 'USDT')} className="gap-2 cursor-pointer text-xs font-bold p-2 rounded-xl text-orange-700">
                                                        Monitor ({safeRates.usdt.toFixed(2)})
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownloadPDF(entry, 'USD_ONLY')} className="gap-2 cursor-pointer text-xs font-bold p-2 rounded-xl text-slate-600">
                                                        Solo USD
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <Button size="icon" onClick={() => handleConvertToOrder(entry)} className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors shadow-sm" title="Facturar">
                                                <Zap className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" onClick={() => handleDeleteBudget(entry.id)} className="h-10 w-10 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-colors shadow-sm" title="Eliminar">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </div>
                </aside>
            </div>
        </motion.div>
    );
}

function StatCard({ label, value, icon, color, className }: any) {
    const colors: any = { 
        blue: "bg-blue-600 text-white shadow-blue-500/20", 
        emerald: "bg-white dark:bg-slate-900 border-black/5 dark:border-white/5 shadow-md", 
        amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 border-none" 
    };
    return (
        <Card className={cn("rounded-[2.5rem] border-none shadow-xl p-7 flex items-center gap-5", colors[color], className)}>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", color === 'blue' ? "bg-white/20" : "bg-slate-50 dark:bg-white/5")}>
                {React.cloneElement(icon, { className: cn("w-6 h-6", color === 'blue' ? "text-white" : "text-slate-400") })}
            </div>
            <div className="min-w-0">
                <p className={cn("text-[9px] font-black uppercase tracking-widest leading-none mb-1.5", color === 'blue' ? "text-white/70" : "text-slate-400")}>{label}</p>
                <h3 className="text-2xl font-black tracking-tighter leading-none truncate">{value}</h3>
            </div>
        </Card>
    );
}

function AssetPill({ active, label, onUpload, onClear }: any) {
    return (
        <div className="flex items-center gap-2 p-1.5 pl-4 rounded-full bg-white dark:bg-slate-800 border border-black/5 shadow-sm h-11">
            <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "text-blue-600" : "text-slate-400")}>{label}</span>
            <input type="file" className="hidden" id={`pill-${label}`} onChange={onUpload} />
            <Button variant="ghost" size="icon" onClick={() => document.getElementById(`pill-${label}`)?.click()} className={cn("h-8 w-8 rounded-full transition-all", active ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-50 dark:bg-white/5")}>
                {active ? <CheckCircle2 className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
            </Button>
            {active && <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8 rounded-full text-red-400 hover:bg-red-50"><X className="w-4 h-4"/></Button>}
        </div>
    );
}