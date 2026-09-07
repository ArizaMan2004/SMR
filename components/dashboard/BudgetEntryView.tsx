// @/components/dashboard/BudgetEntryView.tsx
"use client"

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'; 
import { motion, AnimatePresence } from "framer-motion"

// --- SERVICIOS ---
import { generateBudgetPDF } from "@/lib/services/pdf-generator";
import { 
    saveBudgetToFirestore, 
    loadBudgetsFromFirestore, 
    deleteBudgetFromFirestore,
    numerarPresupuestosAntiguos
} from "@/lib/firebase/firestore-budget-service";
import { createOrden } from "@/lib/services/ordenes-service";
import { getNextOrderNumber } from "@/lib/firebase/ordenes";

// NUEVOS IMPORT PARA CLIENTES
import { subscribeToClients } from "@/lib/services/clientes-service";
import { subscribeToCatalogoProducts, calcPrecioM2, type CatalogoProducto } from "@/lib/services/catalog-service";
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
    AlertCircle, Hourglass, Banknote, ChevronDown, Building2, Users,
    Search, Filter, ArrowUp, ArrowDown, Ruler, Package, History, AlertTriangle
} from "lucide-react";

import { cn } from "@/lib/utils";

// --- CONSTANTES ---
const BACKUP_KEY = 'smr_budget_autosave'

// Estados iniciales a nivel de módulo: son la única fuente de verdad para "empezar de cero",
// así el botón de Nuevo Presupuesto y los reinicios automáticos limpian exactamente lo mismo.
const initialBudgetState = {
    id: null as string | null,
    clienteNombre: '',
    isMaster: false,
    items: [] as any[],
    dateCreated: null as string | null
};

const initialNewItemState = {
    id: null as number | null,
    subCliente: '',
    descripcion: '',
    cantidad: 1,
    precioUnitarioUSD: 0,
    unidad: 'und' as 'und' | 'm2',
    medidaXCm: 0,
    medidaYCm: 0,
};

// Sugerencias genéricas de respaldo: solo se muestran si no hay ninguna coincidencia real en el inventario
const SMR_CATALOG_FALLBACK = [
    "Impresión de Alta Resolución en Vinil Adhesivo",
    "Letras Corpóreas en Acrílico con Iluminación LED",
    "Medallas en Acrílico Personalizadas",
    "Servicio de Diseño Gráfico Publicitario",
    "Corte Láser en MDF",
    "Instalación de Vinil en Vidrieras"
];

/**
 * Clave para ordenar y buscar clientes.
 *
 * Quita espacios sobrantes, tildes y mayúsculas. Los nombres se teclean a mano
 * y en la base conviven " DISBATTERY,SA", "DISBATTERY.,SA " y "Disbattery SA":
 * sin normalizar, el mismo cliente aparece esparcido por toda la lista.
 */
const claveCliente = (nombre: any): string =>
    String(nombre ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ');

// Búsqueda por palabras (todas deben aparecer, en cualquier orden) — más tolerante que un "includes" plano,
// y permite que la predicción encuentre coincidencias tanto en el nombre como en la descripción/detalle del ítem.
const matchesQuery = (haystack: string, query: string) => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;
    const target = haystack.toLowerCase();
    return words.every(w => target.includes(w));
};

import { SubItemsModal } from '@/components/dashboard/SubItemsModal'
import { EditorPDFModal } from '@/components/dashboard/EditorPDFModal'
import type { DatosDocumento } from '@/components/dashboard/DocumentoHTML'
import {
    m2DeSubItems, sinClasificar, itemsSinClasificar,
    type SubItemInterno,
} from '@/lib/services/subitems-service'
import { guardarSubItemsDeItem } from '@/lib/firebase/firestore-budget-service'

export default function BudgetEntryView({
    rates = { usd: 0, eur: 0, usdt: 0 }, 
    // Las tres imagenes llegan ya en base64 solo para armar el PDF.
    // Cambiarlas es cosa de Ajustes -> Identidad de Empresa, no de esta vista.
    currentBcvRate, pdfLogoBase64, firmaBase64, selloBase64,
    currentUserId
}: any) {
    

    const safeRates = useMemo(() => ({
        usd: rates.usd || currentBcvRate || 1,
        eur: rates.eur || 1,
        usdt: rates.usdt || 1
    }), [rates, currentBcvRate]);

    // --- ESTADO INICIAL ---
    const [budgetData, setBudgetData] = useState(initialBudgetState);
    const [newItem, setNewItem] = useState(initialNewItemState);

    const [history, setHistory] = useState<any[]>([]);
    const [clientsList, setClientsList] = useState<any[]>([]); // ESTADO PARA LOS CLIENTES DE LA BD
    const [showClientSuggestions, setShowClientSuggestions] = useState(false);

    // --- CATÁLOGO DE INVENTARIO (mercancía por unidad + materiales por m² como viniles) ---
    const [catalogProductos, setCatalogProductos] = useState<CatalogoProducto[]>([]);
    const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<CatalogoProducto | null>(null);
    const [selectedVarianteId, setSelectedVarianteId] = useState<string | null>(null);

    // --- DESGLOSE INTERNO DE UN RENGLON ---
    //
    // Se abre desde dos sitios: desde el presupuesto que se esta escribiendo
    // (todavia sin guardar) y desde una tarjeta del historial (ya facturado).
    // De ahi que haga falta saber a que presupuesto pertenece el renglon.
    const [subItemsTarget, setSubItemsTarget] = useState<{ item: any; budgetId?: string } | null>(null);

    /**
     * El presupuesto que se esta preparando para emitir.
     *
     * Se abre el editor en vez de soltar el PDF: asi se decide en el momento
     * si lleva las condiciones, que cuenta bancaria sale y en que hoja va,
     * viendolo antes de mandarselo al cliente.
     */
    const [pdfEnEdicion, setPdfEnEdicion] = useState<DatosDocumento | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [recoveredDraft, setRecoveredDraft] = useState<any>(null);
    const [errors, setErrors] = useState<any>({}); 
    
    // --- ESTADOS PARA FILTROS Y ORDENAMIENTO DEL HISTORIAL ---
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        search: '',
        type: 'ALL', // 'ALL', 'MASTER', 'NORMAL'
        minMonto: '',
        maxMonto: '',
        minItems: '',
        date: 'ALL', // 'ALL', 'TODAY', 'WEEK', 'MONTH'
        // Solo los presupuestos con algun renglon sin desglosar. Es la lista
        // de trabajo pendiente para que el balance de metros cuadre.
        soloSinClasificar: false,
        // Por defecto agrupados por cliente en orden alfabético: así los
        // presupuestos de una misma persona quedan juntos y se encuentran de un
        // vistazo, que es como se busca un presupuesto en el mostrador.
        sortBy: 'clienteNombre', // 'dateCreated', 'clienteNombre', 'totalUSD', 'itemsCount'
        sortOrder: 'asc' // 'asc', 'desc'
    });

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

    // --- PREDICCIÓN DE NOMBRES Y DETALLES: busca en el inventario real (mercancía + materiales m²) ---
    const catalogSuggestions = useMemo(() => {
        const q = newItem.descripcion.trim();
        if (q.length < 2) return [];
        return catalogProductos
            .filter(p => p.activo !== false)
            .filter(p => matchesQuery(`${p.nombre} ${p.descripcion || ''}`, q))
            .slice(0, 8);
    }, [catalogProductos, newItem.descripcion]);

    // --- APRENDIZAJE DE PRESUPUESTOS ANTERIORES: aprende nombres muy específicos que no están en el catálogo ---
    // (ej. "Aviso tipo bastidor medidas 1.50 x 1.20cm") y también recuerda el precio/medidas que se usó la última vez.
    const historicalSuggestions = useMemo(() => {
        const q = newItem.descripcion.trim();
        if (q.length < 2) return [];

        const map = new Map<string, {
            descripcion: string; precioUnitarioUSD: number; unidad: 'und' | 'm2';
            medidaXCm: number; medidaYCm: number; catalogProductoId: string | null; catalogVarianteId: string | null;
            count: number; lastUsed: number;
        }>();

        history.forEach((entry: any) => {
            const ts = entry.dateCreated ? new Date(entry.dateCreated).getTime() : 0;
            (entry.items || []).forEach((item: any) => {
                const desc = (item.descripcion || '').trim();
                if (!desc) return;
                const key = desc.toLowerCase();
                const existing = map.get(key);
                if (existing) {
                    existing.count += 1;
                    if (ts >= existing.lastUsed) {
                        existing.lastUsed = ts;
                        existing.precioUnitarioUSD = item.precioUnitarioUSD || 0;
                        existing.unidad = item.unidad === 'm2' ? 'm2' : 'und';
                        existing.medidaXCm = item.medidaXCm || 0;
                        existing.medidaYCm = item.medidaYCm || 0;
                        existing.catalogProductoId = item.catalogProductoId || null;
                        existing.catalogVarianteId = item.catalogVarianteId || null;
                    }
                } else {
                    map.set(key, {
                        descripcion: desc,
                        precioUnitarioUSD: item.precioUnitarioUSD || 0,
                        unidad: item.unidad === 'm2' ? 'm2' : 'und',
                        medidaXCm: item.medidaXCm || 0,
                        medidaYCm: item.medidaYCm || 0,
                        catalogProductoId: item.catalogProductoId || null,
                        catalogVarianteId: item.catalogVarianteId || null,
                        count: 1,
                        lastUsed: ts,
                    });
                }
            });
        });

        return Array.from(map.values())
            .filter(h => matchesQuery(h.descripcion, q))
            .sort((a, b) => (b.count - a.count) || (b.lastUsed - a.lastUsed))
            .slice(0, 6);
    }, [history, newItem.descripcion]);

    const fallbackSuggestions = useMemo(() => {
        if (catalogSuggestions.length > 0 || historicalSuggestions.length > 0) return [];
        const q = newItem.descripcion.trim();
        if (q.length < 2) return [];
        return SMR_CATALOG_FALLBACK.filter(s => matchesQuery(s, q));
    }, [catalogSuggestions, historicalSuggestions, newItem.descripcion]);

    const varianteSeleccionada = useMemo(() => {
        if (!selectedCatalogProduct || !selectedVarianteId) return null;
        return selectedCatalogProduct.variantes?.find(v => v.id === selectedVarianteId) || null;
    }, [selectedCatalogProduct, selectedVarianteId]);

    // --- BACKUP LOCAL: cargar al montar ---
    useEffect(() => {
        const raw = localStorage.getItem(BACKUP_KEY)
        if (!raw) return
        try {
            const saved = JSON.parse(raw)
            if (saved?.budgetData && (saved.budgetData.clienteNombre || saved.budgetData.items?.length > 0)) {
                setRecoveredDraft(saved)
            }
        } catch {
            localStorage.removeItem(BACKUP_KEY)
        }
    }, [])

    // --- BACKUP LOCAL: auto-guardar mientras el usuario escribe ---
    useEffect(() => {
        const hasContent = budgetData.clienteNombre.trim() || budgetData.items.length > 0 || newItem.descripcion.trim()
        if (!hasContent) return
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ budgetData, newItem, savedAt: new Date().toISOString() }))
    }, [budgetData, newItem])

    // --- CARGAR DATOS EXTERNOS (Historial y Clientes) ---
    const fetchHistory = useCallback(async () => {
        try {
            const data = await loadBudgetsFromFirestore();
            if (data) {
                const uniqueEntries = Array.from(new Map(data.map((item: any) => [item.id, item])).values());
                // El ordenamiento inicial lo hace la consulta, luego se encarga el filtro
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

        // SUSCRIBIR AL CATÁLOGO DE INVENTARIO (mismo origen de datos que el Order Wizard)
        const unsubscribeCatalog = subscribeToCatalogoProducts(setCatalogProductos);

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
            unsubscribeCatalog();
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [fetchHistory]);

    const getDaysElapsed = (dateString: string | null) => {
        if (!dateString) return 0;
        const diff = new Date().getTime() - new Date(dateString).getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    };

    // --- LÓGICA DE CLIENTES ---
    const filteredClients = clientsList.filter(c => 
        c.nombreRazonSocial?.toLowerCase().includes(budgetData.clienteNombre.toLowerCase())
    );
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
    /**
     * Prepara el presupuesto para el editor.
     *
     * Ya no genera el PDF: abre el editor con la vista previa, donde se decide
     * que lleva y en que hoja va antes de mandarselo al cliente.
     */
    const handleDownloadPDF = async (data: any, _rateType?: 'USD' | 'EUR' | 'USDT' | 'USD_ONLY') => {
        const items = (data.items || []).map((i: any) => ({
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitarioUSD ?? (i.totalUSD / (i.cantidad || 1)),
            total: i.totalUSD,
            subCliente: i.subCliente,
        }));

        setPdfEnEdicion({
            titulo: data.isMaster ? 'Presupuesto Matriz' : 'Presupuesto',
            numero: data.numero,
            fecha: data.dateCreated || new Date().toISOString(),
            clienteNombre: data.clienteNombre,
            clienteDocumento: data.clienteCedula || data.clienteRif,
            items,
            totalUSD: data.totalUSD || totalUSD,
        });
    };

    // --- LÓGICA DE CATÁLOGO / INVENTARIO (coherente con el Order Wizard) ---
    const handleSelectCatalogProduct = (prod: CatalogoProducto, varianteId?: string | null) => {
        const variante = varianteId ? prod.variantes?.find(v => v.id === varianteId) : null;
        const precio = (prod.precioBase || 0) + (variante?.precioAjuste || 0);
        setSelectedCatalogProduct(prod);
        setSelectedVarianteId(varianteId ?? null);
        setNewItem(prev => ({
            ...prev,
            descripcion: variante ? `${prod.nombre} — ${variante.nombre}` : prod.nombre,
            precioUnitarioUSD: precio,
            unidad: prod.tipoVenta === 'metro_cuadrado' ? 'm2' : 'und',
        }));
        setShowSuggestions(false);
        clearError('descripcion');
    };

    const clearCatalogSelection = () => {
        setSelectedCatalogProduct(null);
        setSelectedVarianteId(null);
        setNewItem(prev => ({ ...prev, unidad: 'und', medidaXCm: 0, medidaYCm: 0 }));
    };

    // Selecciona una sugerencia aprendida de presupuestos anteriores: recupera nombre, precio, unidad y medidas de la última vez
    const handleSelectHistorical = (h: typeof historicalSuggestions[number]) => {
        const catalogProd = h.catalogProductoId ? catalogProductos.find(p => p.id === h.catalogProductoId) || null : null;
        setSelectedCatalogProduct(catalogProd);
        setSelectedVarianteId(catalogProd ? h.catalogVarianteId : null);
        setNewItem(prev => ({
            ...prev,
            descripcion: h.descripcion,
            precioUnitarioUSD: h.precioUnitarioUSD,
            unidad: h.unidad,
            medidaXCm: h.unidad === 'm2' ? h.medidaXCm : 0,
            medidaYCm: h.unidad === 'm2' ? h.medidaYCm : 0,
        }));
        setShowSuggestions(false);
        clearError('descripcion');
    };

    const computeNewItemTotal = () => {
        if (newItem.unidad === 'm2' && newItem.medidaXCm > 0 && newItem.medidaYCm > 0) {
            return calcPrecioM2(newItem.precioUnitarioUSD, newItem.medidaYCm, newItem.medidaXCm, newItem.cantidad).subtotal;
        }
        return newItem.cantidad * newItem.precioUnitarioUSD;
    };

    // --- LÓGICA DE ITEMS ---
    const handleAddOrUpdateItem = () => {
        const newErrors: any = {};
        let hasError = false;

        if (budgetData.isMaster && !newItem.subCliente.trim()) { newErrors.subCliente = true; hasError = true; }
        if (!newItem.descripcion.trim()) { newErrors.descripcion = true; hasError = true; }
        if (newItem.cantidad <= 0) { newErrors.cantidad = true; hasError = true; }
        if (newItem.unidad === 'm2' && (newItem.medidaXCm <= 0 || newItem.medidaYCm <= 0)) { newErrors.medidas = true; hasError = true; }

        if (hasError) {
            setErrors((prev: any) => ({ ...prev, ...newErrors }));
            toast.error("Complete los datos requeridos");
            return;
        }

        const subC = newItem.subCliente.trim();
        const desc = newItem.descripcion.trim() || "Concepto General";
        const calculatedTotal = computeNewItemTotal();
        const catalogRefs = {
            catalogProductoId: selectedCatalogProduct?.id || null,
            catalogVarianteId: selectedVarianteId || null,
        };

        if (newItem.id) {
            setBudgetData((prev: any) => ({
                ...prev,
                items: prev.items.map((item: any) =>
                    item.id === newItem.id
                    ? { ...newItem, ...catalogRefs, subCliente: subC, descripcion: desc, totalUSD: calculatedTotal }
                    : item
                )
            }));
            toast.success("Concepto actualizado");
        } else {
            setBudgetData((prev: any) => ({
                ...prev,
                items: [...prev.items, { ...newItem, ...catalogRefs, subCliente: subC, descripcion: desc, id: Date.now(), totalUSD: calculatedTotal }]
            }));
            toast.success("Concepto añadido");
        }

        setNewItem({ id: null, subCliente: budgetData.isMaster ? subC : '', descripcion: '', cantidad: 1, precioUnitarioUSD: 0, unidad: 'und', medidaXCm: 0, medidaYCm: 0 });
        setSelectedCatalogProduct(null);
        setSelectedVarianteId(null);
        setShowSuggestions(false);
        setErrors((prev:any) => ({ ...prev, subCliente: false, descripcion: false, cantidad: false, precio: false, medidas: false }));
    };

    /**
     * Guarda el desglose. Si el renglon es del presupuesto abierto, se queda
     * en memoria y viaja con el resto al pulsar guardar. Si viene del
     * historial, se escribe directo en Firestore: quien entra a clasificar un
     * presupuesto viejo no espera tener que abrirlo y volverlo a guardar.
     */
    const handleGuardarSubItems = async (itemId: number, subItems: SubItemInterno[]) => {
        const budgetId = subItemsTarget?.budgetId;

        if (!budgetId) {
            setBudgetData((p: any) => ({
                ...p,
                items: p.items.map((i: any) => i.id === itemId ? { ...i, subItems } : i),
            }));
            toast.success(subItems.length ? 'Desglose actualizado' : 'Desglose vaciado');
            return;
        }

        try {
            await guardarSubItemsDeItem(budgetId, itemId, subItems);
            setHistory(prev => prev.map(b => b.id === budgetId
                ? { ...b, items: (b.items || []).map((i: any) => i.id === itemId ? { ...i, subItems } : i) }
                : b));
            toast.success('Desglose guardado en el presupuesto');
        } catch (e) {
            console.error(e);
            toast.error('No se pudo guardar el desglose');
        }
    };

    const handleEditItemRequest = (item: any) => {
        setNewItem({
            id: item.id,
            subCliente: item.subCliente || '',
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitarioUSD: item.precioUnitarioUSD,
            unidad: item.unidad === 'm2' ? 'm2' : 'und',
            medidaXCm: item.medidaXCm || 0,
            medidaYCm: item.medidaYCm || 0,
        });
        setSelectedCatalogProduct(item.catalogProductoId ? catalogProductos.find(p => p.id === item.catalogProductoId) || null : null);
        setSelectedVarianteId(item.catalogVarianteId || null);
        setErrors({});
    };

    // --- NUEVO PRESUPUESTO ---
    // Deja la vista como recién cargada sin recargar la página: limpia el documento, el concepto
    // que se esté escribiendo, la selección de catálogo, los errores y el respaldo local.
    const handleNewBudget = ({ skipConfirm = false }: { skipConfirm?: boolean } = {}) => {
        // Solo avisamos si hay trabajo que todavía no está en la base de datos.
        const hasUnsavedWork = !budgetData.id && (budgetData.items.length > 0 || budgetData.clienteNombre.trim() !== '');
        if (hasUnsavedWork && !skipConfirm) {
            if (!window.confirm("Este presupuesto no se ha guardado. ¿Empezar uno nuevo y descartarlo?")) return;
        }

        setBudgetData(initialBudgetState);
        setNewItem(initialNewItemState);
        setSelectedCatalogProduct(null);
        setSelectedVarianteId(null);
        setShowSuggestions(false);
        setShowClientSuggestions(false);
        setRecoveredDraft(null);
        setErrors({});
        localStorage.removeItem(BACKUP_KEY);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.success("Listo para un nuevo presupuesto");
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
            const newDateCreated = budgetData.id ? budgetData.dateCreated : new Date().toISOString();
            
            const payload: any = {
                ...rest,
                totalUSD: totalUSD,
                dateCreated: newDateCreated,
                userId: "" 
            };

            if (id) payload.id = id;

            const resultId = await saveBudgetToFirestore(payload);
            // Atajo directo: recién guardado, el siguiente paso casi siempre es empezar otro presupuesto.
            toast.success(id ? "Cambios actualizados" : "Borrador guardado", {
                action: {
                    label: "Nuevo",
                    onClick: () => handleNewBudget({ skipConfirm: true })
                }
            });
            localStorage.removeItem(BACKUP_KEY)

            if (!id) {
                let newDocId = typeof resultId === 'string' ? resultId : null;
                if (!newDocId) {
                    const updatedBudgets = await loadBudgetsFromFirestore();
                    if (updatedBudgets) {
                        const match = updatedBudgets.find((b: any) => 
                            b.clienteNombre === budgetData.clienteNombre && 
                            b.dateCreated === newDateCreated
                        );
                        // `?? null`: el id del estado es `string | null`, nunca undefined.
                        if (match) newDocId = match.id ?? null;
                    }
                }
                setBudgetData(prev => ({
                    ...prev,
                    id: newDocId,
                    dateCreated: newDateCreated
                }));
            }
            
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
            // Reserva atómica: el método anterior repetía números.
            const nextNumber = await getNextOrderNumber();
            
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
                    correo: "",
                    personaContacto: "N/A"
                },
                items: data.items.map((item: any) => ({
                    subCliente: data.isMaster ? (item.subCliente || '') : '',
                    nombre: item.descripcion,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitarioUSD,
                    unidad: item.unidad === 'm2' ? 'm2' : 'und',
                    medidaXCm: item.medidaXCm || 0,
                    medidaYCm: item.medidaYCm || 0,
                    tipoServicio: item.unidad === 'm2' ? 'IMPRESION' : 'OTROS',
                    subtotal: item.totalUSD
                })),
                totalUSD: data.totalUSD || totalUSD,
                totalBS: (data.totalUSD || totalUSD) * safeRates.usd,
                montoPagadoUSD: 0,
                // Sin estadoPago la orden nacía "sin estado": no aparecía como
                // deuda en Clientes & Cobranza ni contaba en las estadísticas.
                estadoPago: 'PENDIENTE',
                registroPagos: [],
                serviciosSolicitados: {
                    impresionDigital: false,
                    impresionGranFormato: data.items.some((i: any) => i.unidad === 'm2'),
                    corteLaser: false,
                    laminacion: false,
                    avisoCorporeo: false,
                    rotulacion: false,
                    instalacion: false,
                    senaletica: false,
                },
                descripcionDetallada: `Convertida desde presupuesto de ${data.clienteNombre}`,
                estado: 'PENDIENTE',
                userId: ""
            };

            await createOrden(orderPayload);
            if (data.id) await deleteBudgetFromFirestore(data.id);

            toast.success(`Orden #${nextNumber} creada con éxito.`);
            localStorage.removeItem(BACKUP_KEY)
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
            if (budgetData.id === id) {
                setBudgetData(initialBudgetState);
            }
            await fetchHistory();
        } catch (error) {
            toast.error("Error al borrar el registro");
        }
    };

    /** Pone número correlativo a los presupuestos creados antes de esta función. */
    const handleNumerarAntiguos = async () => {
        setIsLoading(true);
        try {
            const cuantos = await numerarPresupuestosAntiguos();
            toast.success(cuantos > 0
                ? `${cuantos} presupuesto(s) numerados por orden de creación`
                : 'Todos ya tenían número');
            await fetchHistory();
        } catch (e) {
            console.error(e);
            toast.error('No se pudieron numerar los presupuestos');
        } finally {
            setIsLoading(false);
        }
    };

    const clearError = (field: string) => {
        if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: false }));
    };

    /**
     * Presupuestos con algun renglon sin desglosar.
     *
     * Es el recordatorio que pidio el taller: el presupuesto puede estar
     * perfecto de cara al cliente y aun asi no haber dicho nunca que material
     * se gasto, y esos metros no aparecen en ningun balance.
     */
    const pendientesDeClasificar = useMemo(
        () => history.filter(b => itemsSinClasificar(b) > 0).length,
        [history]
    );

    // --- FILTRADO Y ORDENAMIENTO DE HISTORIAL ---
    const filteredHistory = useMemo(() => {
        let result = history.filter(entry => {
            // Filtrado
            // La búsqueda mira el cliente Y el número, para poder escribir "45"
            // o "#45" y encontrar el presupuesto directamente.
            if (filters.search) {
                const bruto = filters.search.trim();
                // Con almohadilla se busca SOLO por número: escribir "#67" debe
                // dar el presupuesto 67 y no todos los clientes cuyo RIF
                // contenga un 67. Sin ella se busca en el nombre y en el número.
                const soloNumero = bruto.startsWith('#');
                const q = claveCliente(bruto.replace(/^#/, ''));
                if (!q) return true;

                const porNumero = String(entry.numero ?? '') === q || (!soloNumero && String(entry.numero ?? '').includes(q));
                const porCliente = !soloNumero && claveCliente(entry.clienteNombre).includes(q);
                if (!porCliente && !porNumero) return false;
            }
            if (filters.type === 'MASTER' && !entry.isMaster) return false;
            if (filters.type === 'NORMAL' && entry.isMaster) return false;
            if (filters.minMonto !== '' && entry.totalUSD < Number(filters.minMonto)) return false;
            if (filters.maxMonto !== '' && entry.totalUSD > Number(filters.maxMonto)) return false;
            if (filters.minItems !== '' && (entry.items?.length || 0) < Number(filters.minItems)) return false;
            if (filters.soloSinClasificar && itemsSinClasificar(entry) === 0) return false;
            if (filters.date !== 'ALL') {
                const days = getDaysElapsed(entry.dateCreated);
                if (filters.date === 'TODAY' && days > 0) return false;
                if (filters.date === 'WEEK' && days > 7) return false;
                if (filters.date === 'MONTH' && days > 30) return false;
            }
            return true;
        });

        // Ordenamiento
        result.sort((a, b) => {
            let comparison = 0;
            switch (filters.sortBy) {
                case 'clienteNombre':
                    // Se compara por la clave normalizada. En la base hay nombres
                    // con espacios al principio (" DISBATTERY,SA"), y esos espacios
                    // cuentan para localeCompare: mandaban al cliente al principio
                    // de la lista como si empezara por un carácter raro.
                    comparison = claveCliente(a.clienteNombre).localeCompare(claveCliente(b.clienteNombre), 'es');
                    break;
                case 'totalUSD':
                    comparison = (a.totalUSD || 0) - (b.totalUSD || 0);
                    break;
                case 'itemsCount':
                    comparison = (a.items?.length || 0) - (b.items?.length || 0);
                    break;
                case 'dateCreated':
                default:
                    const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
                    const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
                    comparison = dateA - dateB;
                    break;
            }
            return filters.sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [history, filters]);

    // El punto rojo del botón de filtros avisa de que hay algo distinto de lo
    // normal, así que se compara contra los valores por defecto REALES.
    const hasActiveFilters = filters.type !== 'ALL' || filters.date !== 'ALL' || filters.minMonto || filters.maxMonto || filters.minItems || filters.soloSinClasificar || filters.sortBy !== 'clienteNombre' || filters.sortOrder !== 'asc';

    /** Presupuestos que aún no tienen número asignado (los creados antes). */
    const sinNumerar = useMemo(() => history.filter(h => !h.numero).length, [history]);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-4 sm:space-y-8 pb-24 sm:pb-32 px-2 sm:px-4">

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/40 dark:bg-white/5 backdrop-blur-3xl p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 shadow-2xl gap-3 sm:gap-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                        <FileText className="text-white w-5 h-5 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">Presupuestos</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-500 mt-1 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            {budgetData.id ? "Editando Registro" : "Nuevo Documento"}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                    {/* El logo, la firma y el sello ya no se suben desde aqui.
                        Son de la empresa entera, viven en la nube y se cambian en
                        Ajustes -> Identidad de Empresa. Tener botones sueltos aqui
                        solo invitaba a que cada quien pusiera el suyo. */}

                    <Button
                        onClick={() => handleNewBudget()}
                        title="Limpiar todo y empezar un presupuesto desde cero"
                        className="h-11 shrink-0 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-black uppercase text-[10px] tracking-widest gap-2 px-5 shadow-lg active:scale-95 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Presupuesto
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                <StatCard label="Total USD" value={`$${totalUSD.toFixed(2)}`} icon={<Wallet />} color="blue" />
                <StatCard label="Monto Bs." value={`${(totalUSD * safeRates.usd).toLocaleString('es-VE', { maximumFractionDigits: 0 })}`} icon={<Calculator />} color="emerald" />
                <StatCard label="Tasa BCV" value={safeRates.usd.toFixed(2)} icon={<TrendingUp />} color="amber" />
            </div>

            {/* BANNER DE RECUPERACIÓN */}
            <AnimatePresence>
                {recoveredDraft && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-[2rem] p-5"
                    >
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-amber-800 dark:text-amber-300">
                                Borrador sin guardar encontrado
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                                <span className="uppercase">{recoveredDraft.budgetData.clienteNombre || 'Sin cliente'}</span>
                                {' · '}{recoveredDraft.budgetData.items.length} concepto(s)
                                {' · '}Guardado a las {new Date(recoveredDraft.savedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button
                                size="sm"
                                onClick={() => {
                                    setBudgetData(recoveredDraft.budgetData)
                                    setNewItem(recoveredDraft.newItem)
                                    setRecoveredDraft(null)
                                    toast.success('Borrador restaurado')
                                }}
                                className="h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-wider"
                            >
                                Restaurar
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { localStorage.removeItem(BACKUP_KEY); setRecoveredDraft(null) }}
                                className="h-9 rounded-xl text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-800/30 font-black uppercase text-[10px] tracking-wider"
                            >
                                Descartar
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* CONSTRUCTOR */}
                <div className="lg:col-span-8 space-y-4 sm:space-y-6">
                    <Card className="rounded-[2rem] sm:rounded-[3rem] border-none shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="p-4 sm:p-8 md:p-12 space-y-5 sm:space-y-8 md:space-y-10">
                            
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
                                        <Button variant="ghost" size="icon" title="Empezar de cero" onClick={() => handleNewBudget()} className="text-red-400 hover:bg-red-50 h-10 w-10 shrink-0">
                                            <RotateCcw className="w-4 h-4"/>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* BUSCADOR DE CLIENTES CON AUTOCOMPLETADO */}
                            <div className="relative w-full" ref={clientRef}>
                                <User className={cn("absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 transition-colors z-10", errors.clienteNombre ? "text-red-400" : "text-slate-300")} />
                                <Input
                                    value={budgetData.clienteNombre}
                                    onChange={(e) => {
                                        setBudgetData({...budgetData, clienteNombre: e.target.value});
                                        setShowClientSuggestions(true);
                                        clearError('clienteNombre');
                                    }}
                                    onFocus={() => setShowClientSuggestions(true)}
                                    className={cn(
                                        "h-12 sm:h-16 rounded-2xl sm:rounded-[1.5rem] border-none font-black text-base sm:text-xl px-11 sm:px-16 shadow-inner transition-all relative z-0",
                                        errors.clienteNombre ? "bg-red-50 ring-2 ring-red-500/20 placeholder:text-red-300" : "bg-slate-50 dark:bg-slate-800/50"
                                    )}
                                    placeholder={budgetData.isMaster ? "EMPRESA MATRIZ..." : "NOMBRE DEL CLIENTE..."}
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

                                {/* El recordatorio. Un renglon sin desglosar es plata
                                    facturada cuyos metros no llegan al balance, y es
                                    facil que se pase por alto porque el presupuesto
                                    esta perfecto de cara al cliente. */}
                                {itemsSinClasificar(budgetData) > 0 && (
                                    <div className="mx-1 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-3 sm:p-4 flex items-start gap-3">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                                            {itemsSinClasificar(budgetData) === 1
                                                ? 'Hay 1 concepto sin desglosar.'
                                                : `Hay ${itemsSinClasificar(budgetData)} conceptos sin desglosar.`}
                                            {' '}Sus metros no entran en el balance ni descuentan del rollo.
                                            Toca la etiqueta ambar de cada renglon para decir que material se uso.
                                            <span className="block text-amber-600/70 dark:text-amber-500/60 font-medium mt-0.5">
                                                Se puede hacer ahora o despues de facturar. No cambia nada de lo que ve el cliente.
                                            </span>
                                        </p>
                                    </div>
                                )}
                                <div className={cn("p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border space-y-4 transition-all", (errors.descripcion || errors.cantidad || errors.subCliente) ? "border-red-200 bg-red-50/30" : "border-black/5")}>
                                    
                                    {budgetData.isMaster && (
                                        <div className="mb-4">
                                            <Input
                                                value={newItem.subCliente}
                                                onChange={(e) => { setNewItem({...newItem, subCliente: e.target.value}); clearError('subCliente'); }}
                                                className={cn(
                                                    "h-10 sm:h-12 rounded-xl border-none px-4 sm:px-6 font-bold text-sm shadow-sm transition-all",
                                                    errors.subCliente ? "bg-red-50 ring-1 ring-red-300 placeholder:text-red-300" : "bg-white dark:bg-slate-900 text-blue-600 placeholder:text-blue-300/50"
                                                )}
                                                placeholder="Sub-Cliente o Sucursal..."
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
                                                "min-h-[66px] sm:min-h-[80px] py-3 sm:py-4 rounded-xl border-none px-4 sm:px-6 font-bold text-sm sm:text-base shadow-sm transition-all resize-y",
                                                errors.descripcion ? "bg-red-50 ring-1 ring-red-300 placeholder:text-red-300" : "bg-white dark:bg-slate-900"
                                            )}
                                            placeholder={errors.descripcion ? "⚠️ Descripción requerida..." : "Nombre del ítem...\nDetalles adicionales..."}
                                        />
                                        <AnimatePresence>
                                            {showSuggestions && newItem.descripcion.length > 1 && (historicalSuggestions.length > 0 || catalogSuggestions.length > 0 || fallbackSuggestions.length > 0) && (
                                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-50 border border-slate-100 dark:border-slate-700 overflow-hidden max-h-72 overflow-y-auto">
                                                    {historicalSuggestions.length > 0 && (
                                                        <p className="px-4 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-amber-500">De tus presupuestos anteriores</p>
                                                    )}
                                                    {historicalSuggestions.map((h, i) => (
                                                        <button key={`hist-${i}`} onClick={() => handleSelectHistorical(h)} className="w-full text-left p-3 px-4 hover:bg-amber-50 dark:hover:bg-amber-500/10 border-b last:border-none border-slate-50 dark:border-slate-700/50 flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-50 text-amber-500 dark:bg-amber-900/30">
                                                                <History className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-xs uppercase text-slate-700 dark:text-slate-200 truncate">{h.descripcion}</p>
                                                                <p className="text-[9px] text-slate-400 font-bold">
                                                                    Usado {h.count}x
                                                                    {h.unidad === 'm2' && h.medidaXCm > 0 && h.medidaYCm > 0 ? ` · ${h.medidaXCm}x${h.medidaYCm}cm` : ''}
                                                                </p>
                                                            </div>
                                                            <span className="text-[10px] font-black text-amber-600 shrink-0">
                                                                ${h.precioUnitarioUSD}{h.unidad === 'm2' ? '/m²' : ''}
                                                            </span>
                                                        </button>
                                                    ))}
                                                    {catalogSuggestions.length > 0 && (
                                                        <p className="px-4 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-blue-400">Del inventario</p>
                                                    )}
                                                    {catalogSuggestions.map((prod) => (
                                                        <button key={prod.id} onClick={() => handleSelectCatalogProduct(prod)} className="w-full text-left p-3 px-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 border-b last:border-none border-slate-50 dark:border-slate-700/50 flex items-center gap-3">
                                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", prod.tipoVenta === 'metro_cuadrado' ? "bg-indigo-50 text-indigo-500 dark:bg-indigo-900/30" : "bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30")}>
                                                                {prod.tipoVenta === 'metro_cuadrado' ? <Ruler className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-xs uppercase text-slate-700 dark:text-slate-200 truncate">{prod.nombre}</p>
                                                                {prod.descripcion && <p className="text-[10px] text-slate-400 truncate">{prod.descripcion}</p>}
                                                            </div>
                                                            <span className="text-[10px] font-black text-blue-600 shrink-0">
                                                                ${prod.precioBase}{prod.tipoVenta === 'metro_cuadrado' ? '/m²' : ''}
                                                            </span>
                                                        </button>
                                                    ))}
                                                    {fallbackSuggestions.length > 0 && (
                                                        <>
                                                            <p className="px-4 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-300">Sugerencias generales</p>
                                                            {fallbackSuggestions.map((s, i) => (
                                                                <button key={i} onClick={() => { clearCatalogSelection(); setNewItem(prev => ({...prev, descripcion: s})); setShowSuggestions(false); clearError('descripcion'); }} className="w-full text-left p-4 hover:bg-blue-50 dark:hover:bg-blue-500/10 font-bold text-xs uppercase border-b last:border-none text-slate-600 dark:text-slate-300">{s}</button>
                                                            ))}
                                                        </>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* PRODUCTO DE INVENTARIO SELECCIONADO: variantes + quitar */}
                                    {selectedCatalogProduct && (
                                        <div className="flex flex-wrap items-center gap-2 px-1">
                                            <Badge className={cn("border-none font-black text-[9px] uppercase gap-1.5", selectedCatalogProduct.tipoVenta === 'metro_cuadrado' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700")}>
                                                {selectedCatalogProduct.tipoVenta === 'metro_cuadrado' ? <Ruler className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                                                {selectedCatalogProduct.nombre}
                                            </Badge>
                                            {selectedCatalogProduct.tieneVariantes && selectedCatalogProduct.variantes?.length > 0 && (
                                                <>
                                                    <button type="button" onClick={() => handleSelectCatalogProduct(selectedCatalogProduct, null)} className={cn("px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase transition-all", !selectedVarianteId ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500")}>
                                                        Base
                                                    </button>
                                                    {selectedCatalogProduct.variantes.map(v => (
                                                        <button type="button" key={v.id} onClick={() => handleSelectCatalogProduct(selectedCatalogProduct, v.id)} className={cn("px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase transition-all", selectedVarianteId === v.id ? "bg-blue-600 border-blue-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500")}>
                                                            {v.nombre}{v.precioAjuste ? ` +$${v.precioAjuste}` : ''}
                                                        </button>
                                                    ))}
                                                </>
                                            )}
                                            <button type="button" onClick={clearCatalogSelection} className="text-[9px] font-black uppercase text-red-400 hover:text-red-500 flex items-center gap-1 ml-auto">
                                                <X className="w-3 h-3" /> Quitar
                                            </button>
                                        </div>
                                    )}

                                    {/* MEDIDAS EN M² (viniles / materiales por metro cuadrado) */}
                                    {newItem.unidad === 'm2' && (
                                        <div className={cn("p-3 rounded-2xl border space-y-2", errors.medidas ? "border-red-200 bg-red-50/40" : "border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-900/10")}>
                                            <Label className={cn("text-[9px] font-black uppercase flex items-center gap-1.5", errors.medidas ? "text-red-500" : "text-indigo-500")}>
                                                <Ruler className="w-3 h-3" /> Medidas del material {errors.medidas && "(Requerido)"}
                                            </Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input type="number" value={newItem.medidaXCm === 0 ? '' : newItem.medidaXCm} onChange={e => { setNewItem({...newItem, medidaXCm: Number(e.target.value) || 0}); clearError('medidas'); }} className="h-10 rounded-xl border-none bg-white dark:bg-slate-900 font-black text-center text-sm" placeholder="Ancho (cm)" />
                                                <Input type="number" value={newItem.medidaYCm === 0 ? '' : newItem.medidaYCm} onChange={e => { setNewItem({...newItem, medidaYCm: Number(e.target.value) || 0}); clearError('medidas'); }} className="h-10 rounded-xl border-none bg-white dark:bg-slate-900 font-black text-center text-sm" placeholder="Alto (cm)" />
                                            </div>
                                            {newItem.medidaXCm > 0 && newItem.medidaYCm > 0 && (
                                                <p className="text-[10px] font-bold text-indigo-500 text-center">
                                                    {((newItem.medidaXCm / 100) * (newItem.medidaYCm / 100)).toFixed(2)} m² × {newItem.cantidad || 1} pieza(s) · ${newItem.precioUnitarioUSD}/m²
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-12 gap-2 sm:gap-3">
                                        <div className="col-span-3">
                                            <Input
                                                type="number"
                                                value={newItem.cantidad === 0 ? '' : newItem.cantidad}
                                                onChange={(e) => { setNewItem({...newItem, cantidad: Number(e.target.value) || 0}); clearError('cantidad'); }}
                                                className={cn(
                                                    "h-11 sm:h-14 rounded-xl border-none text-center font-black transition-all text-sm",
                                                    errors.cantidad ? "bg-red-50 ring-1 ring-red-300 text-red-600" : "bg-white dark:bg-slate-900"
                                                )}
                                                placeholder="Cant."
                                            />
                                        </div>
                                        <div className="col-span-6 relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
                                            <Input
                                                type="number"
                                                value={newItem.precioUnitarioUSD === 0 ? '' : newItem.precioUnitarioUSD}
                                                onChange={(e) => { setNewItem({...newItem, precioUnitarioUSD: Number(e.target.value) || 0}); clearError('precio'); }}
                                                className="h-11 sm:h-14 rounded-xl bg-white dark:bg-slate-900 border-none pl-8 sm:pl-10 font-black text-blue-600 text-sm"
                                                placeholder={newItem.unidad === 'm2' ? "Precio /m²" : "Precio Unit."}
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <Button
                                                onClick={handleAddOrUpdateItem}
                                                className={cn(
                                                    "w-full h-11 sm:h-14 rounded-xl text-white shadow-lg active:scale-95 transition-all",
                                                    newItem.id ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                                                )}
                                            >
                                                {newItem.id ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* TABLA DE ITEMS */}
                            <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
                              <div className="overflow-x-auto custom-scrollbar">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-800/30">
                                        <TableRow className="border-none">
                                            <TableHead className="px-3 sm:px-8 text-[9px] font-black uppercase tracking-widest">Descripción</TableHead>
                                            <TableHead className="text-right px-3 sm:px-8 text-[9px] font-black uppercase tracking-widest">Subtotal</TableHead>
                                            <TableHead className="w-16 sm:w-24"></TableHead>
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
                                                        <TableCell colSpan={3} className="px-3 sm:px-8 py-2 sm:py-3">
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
                                                    <TableRow key={item.id} className={cn("border-b dark:border-slate-800 transition-colors", newItem.id === item.id && "bg-amber-50 dark:bg-amber-500/5", budgetData.isMaster && "border-none")}>
                                                        <TableCell className="px-3 sm:px-8 font-bold uppercase text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed py-3 sm:py-4">
                                                            {item.descripcion} <span className="ml-1 text-slate-400 font-black italic">x{item.cantidad}</span>
                                                            {item.unidad === 'm2' && item.medidaXCm > 0 && item.medidaYCm > 0 && (
                                                                <Badge variant="outline" className="ml-2 border-indigo-200 text-indigo-500 font-black text-[8px] h-4 px-1.5 gap-1 align-middle normal-case">
                                                                    <Ruler className="w-2.5 h-2.5" /> {item.medidaXCm}x{item.medidaYCm}cm
                                                                </Badge>
                                                            )}

                                                            {/* Que material hay detras de este renglon. En ambar
                                                                mientras no se sepa: es plata facturada cuyos
                                                                metros no estan entrando al balance. */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setSubItemsTarget({ item })}
                                                                title="Desglose interno: que material se gasto (no sale en el PDF)"
                                                                className={cn(
                                                                    "ml-2 inline-flex items-center gap-1 h-4 px-1.5 rounded-full border font-black text-[8px] uppercase align-middle transition-colors",
                                                                    sinClasificar(item)
                                                                        ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20"
                                                                        : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                                                                )}
                                                            >
                                                                <Layers className="w-2.5 h-2.5" />
                                                                {sinClasificar(item)
                                                                    ? 'Sin clasificar'
                                                                    : (m2DeSubItems(item.subItems) > 0
                                                                        ? `${m2DeSubItems(item.subItems).toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`
                                                                        : `${item.subItems.length} mat.`)}
                                                            </button>
                                                        </TableCell>
                                                        <TableCell className="text-right px-3 sm:px-8 font-black text-blue-600 text-xs sm:text-sm tracking-tight">${item.totalUSD.toFixed(2)}</TableCell>
                                                        <TableCell className="pr-1 sm:pr-6">
                                                            <div className="flex items-center justify-end gap-0.5 sm:gap-1">
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
                                                        <TableCell className="text-right px-3 sm:px-8 font-black text-[9px] uppercase tracking-widest text-slate-500">
                                                            Sub. {subCliente}
                                                        </TableCell>
                                                        <TableCell className="text-right px-3 sm:px-8 font-black text-slate-700 dark:text-slate-200">
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
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                                <Button onClick={() => handleConvertToOrder()} disabled={isLoading || budgetData.items.length === 0} className="h-12 sm:h-16 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] sm:text-xs gap-2 sm:gap-3 shadow-xl active:scale-95 transition-all">
                                    {isLoading ? <Clock className="animate-spin w-4 h-4 sm:w-5 sm:h-5" /> : <Zap className="w-4 h-4 sm:w-5 sm:h-5" />} Facturar ahora
                                </Button>
                                <Button onClick={handleSaveDraft} disabled={isLoading} className="h-12 sm:h-16 rounded-xl sm:rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] sm:text-xs gap-2 sm:gap-3 active:scale-95 transition-all">
                                    <Save className="w-4 h-4 sm:w-5 sm:h-5" /> {budgetData.id ? "Actualizar" : "Guardar Borrador"}
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            disabled={budgetData.items.length === 0}
                                            className="h-12 sm:h-16 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] sm:text-xs gap-2 sm:gap-3 active:scale-95 transition-all flex items-center justify-center"
                                        >
                                            <Download className="w-4 h-4 sm:w-5 sm:h-5" /> PDF <ChevronDown className="w-3 h-3 opacity-50"/>
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
                <aside className="lg:col-span-4 space-y-3 sm:space-y-4">
                    {/* CABECERA Y FILTROS */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-4">
                            <h2 className="text-base sm:text-xl font-black italic uppercase flex items-center gap-2 sm:gap-3 text-slate-900 dark:text-white">
                                <Clock className="w-5 h-5 text-blue-600" /> Presupuestos
                            </h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={cn("h-8 w-8 rounded-xl transition-colors relative", showFilters ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                                >
                                    <Filter className="w-4 h-4" />
                                    {hasActiveFilters && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
                                </Button>
                                <Badge className="rounded-full bg-blue-100 text-blue-600 px-3 border-none font-black">{filteredHistory.length}</Badge>
                            </div>
                        </div>

                        {/* Cuantos presupuestos siguen sin decir que material
                            gastaron. Se puede tocar para ver solo esos. */}
                        {pendientesDeClasificar > 0 && (
                            <div className="px-2">
                                <button
                                    type="button"
                                    onClick={() => setFilters(f => ({ ...f, soloSinClasificar: !f.soloSinClasificar }))}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                                        filters.soloSinClasificar
                                            ? "border-amber-300 bg-amber-100 dark:bg-amber-500/15"
                                            : "border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 hover:bg-amber-100/70"
                                    )}
                                >
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                                    <span className="flex-1 min-w-0 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-500 leading-snug">
                                        {pendientesDeClasificar} sin desglosar
                                        <span className="block normal-case tracking-normal font-bold text-amber-600/70 dark:text-amber-500/60">
                                            {filters.soloSinClasificar ? 'Mostrando solo estos · toca para ver todos' : 'Sus metros no entran al balance'}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* BUSCADOR SIEMPRE A LA VISTA.
                            Antes vivía dentro del panel de filtros plegado, así que
                            para buscar un presupuesto había que acordarse de abrirlo. */}
                        <div className="px-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <Input
                                    value={filters.search}
                                    onChange={e => setFilters({ ...filters, search: e.target.value })}
                                    placeholder="Buscar por cliente o número..."
                                    className="h-12 pl-11 pr-10 rounded-2xl border-none bg-slate-50 dark:bg-slate-800/50 font-bold text-xs shadow-inner"
                                />
                                {filters.search && (
                                    <button
                                        onClick={() => setFilters({ ...filters, search: '' })}
                                        title="Limpiar búsqueda"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Aviso puntual: los presupuestos creados antes de que
                                existiera la numeración no tienen número. */}
                            {sinNumerar > 0 && (
                                <button
                                    onClick={handleNumerarAntiguos}
                                    disabled={isLoading}
                                    className="mt-2 w-full h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                                >
                                    <Layers className="w-3 h-3" />
                                    Numerar {sinNumerar} presupuesto{sinNumerar > 1 ? 's' : ''} antiguo{sinNumerar > 1 ? 's' : ''}
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {showFilters && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 space-y-3">
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <Input 
                                                placeholder="Buscar por cliente o empresa..." 
                                                value={filters.search}
                                                onChange={e => setFilters({...filters, search: e.target.value})}
                                                className="pl-9 h-10 text-xs rounded-xl border-none bg-white dark:bg-slate-900 font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select 
                                                value={filters.type} 
                                                onChange={e => setFilters({...filters, type: e.target.value})}
                                                className="h-10 rounded-xl border-none bg-white font-bold text-slate-600 text-xs px-3 dark:bg-slate-900 dark:text-slate-300 outline-none"
                                            >
                                                <option value="ALL">Todos los tipos</option>
                                                <option value="NORMAL">Clientes Normales</option>
                                                <option value="MASTER">Empresas Matrices</option>
                                            </select>
                                            <select 
                                                value={filters.date} 
                                                onChange={e => setFilters({...filters, date: e.target.value})}
                                                className="h-10 rounded-xl border-none bg-white font-bold text-slate-600 text-xs px-3 dark:bg-slate-900 dark:text-slate-300 outline-none"
                                            >
                                                <option value="ALL">Cualquier Fecha</option>
                                                <option value="TODAY">Hoy</option>
                                                <option value="WEEK">Últimos 7 días</option>
                                                <option value="MONTH">Últimos 30 días</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <div className="relative">
                                                <DollarSign className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <Input
                                                    type="number" placeholder="Min"
                                                    value={filters.minMonto} onChange={e => setFilters({...filters, minMonto: e.target.value})}
                                                    className="h-9 pl-6 text-xs rounded-xl border-none bg-white dark:bg-slate-900 font-bold"
                                                />
                                            </div>
                                            <div className="relative">
                                                <DollarSign className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <Input 
                                                    type="number" placeholder="Max" 
                                                    value={filters.maxMonto} onChange={e => setFilters({...filters, maxMonto: e.target.value})}
                                                    className="h-9 pl-6 text-xs rounded-xl border-none bg-white dark:bg-slate-900 font-bold"
                                                />
                                            </div>
                                            <div className="relative">
                                                <Layers className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <Input 
                                                    type="number" placeholder="Items" 
                                                    value={filters.minItems} onChange={e => setFilters({...filters, minItems: e.target.value})}
                                                    className="h-9 pl-7 text-xs rounded-xl border-none bg-white dark:bg-slate-900 font-bold"
                                                    title="Cantidad mínima de elementos"
                                                />
                                            </div>
                                        </div>
                                        
                                        {/* NUEVA SECCIÓN DE ORDENAMIENTO */}
                                        <div className="grid grid-cols-12 gap-2 border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                                            <div className="col-span-8 flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-black text-slate-400 shrink-0">Ordenar:</span>
                                                <select
                                                    value={filters.sortBy}
                                                    onChange={e => setFilters({...filters, sortBy: e.target.value})}
                                                    className="h-8 rounded-xl border-none bg-white font-bold text-slate-600 text-[10px] uppercase px-2 dark:bg-slate-900 dark:text-slate-300 outline-none flex-1 w-full"
                                                >
                                                    <option value="dateCreated">Fecha</option>
                                                    <option value="clienteNombre">Nombre</option>
                                                    <option value="totalUSD">Monto</option>
                                                    <option value="itemsCount">Cant. Elementos</option>
                                                </select>
                                            </div>
                                            <div className="col-span-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setFilters({...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                                                    className="w-full h-8 text-[10px] font-black uppercase rounded-xl border-none bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300"
                                                >
                                                    {filters.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                    {filters.sortOrder === 'asc' ? 'Asc' : 'Desc'}
                                                </Button>
                                            </div>
                                        </div>

                                        {hasActiveFilters && (
                                            <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', type: 'ALL', minMonto: '', maxMonto: '', minItems: '', date: 'ALL', soloSinClasificar: false, sortBy: 'dateCreated', sortOrder: 'desc' })} className="w-full text-[10px] uppercase font-black text-red-500 hover:bg-red-50 h-8 rounded-xl mt-2">
                                                Limpiar Filtros
                                            </Button>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* LISTA DE PRESUPUESTOS */}
                    <div className="space-y-3 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                        {filteredHistory.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 text-sm font-bold uppercase italic">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredHistory.map((entry) => {
                                const daysOld = getDaysElapsed(entry.dateCreated);
                                let ageColor = "bg-emerald-100 text-emerald-600";
                                if (daysOld > 3) ageColor = "bg-amber-100 text-amber-600";
                                if (daysOld > 7) ageColor = "bg-rose-100 text-rose-600";

                                return (
                                    <motion.div key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <Card className="p-4 rounded-[2rem] border-none shadow-md bg-white dark:bg-slate-900 group relative overflow-hidden transition-all hover:scale-[1.01]">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="space-y-2 min-w-0 pr-4">
                                                    <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm truncate uppercase italic tracking-tight flex items-center gap-2">
                                                        {/* Número correlativo: es lo que se le dice al cliente
                                                            por teléfono, el id de Firestore no sirve para eso. */}
                                                        {entry.numero ? (
                                                            <span className="shrink-0 text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/15 rounded-lg px-1.5 py-0.5 not-italic tracking-normal">
                                                                #{entry.numero}
                                                            </span>
                                                        ) : (
                                                            <span className="shrink-0 text-[10px] font-black text-slate-300 dark:text-slate-600 not-italic" title="Presupuesto anterior a la numeración">
                                                                #—
                                                            </span>
                                                        )}
                                                        {entry.isMaster && <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0"/>}
                                                        <span className="truncate">{entry.clienteNombre}</span>
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
                                            
                                            {/* PREVIEW DE ITEMS */}
                                            {entry.items && entry.items.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                                                    {entry.items.slice(0, 2).map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                                            <span className="truncate pr-1 font-medium flex items-center gap-1.5 min-w-0">
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0"></span>
                                                                <span className="truncate">{item.descripcion}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1 shrink-0">
                                                                {/* Clasificar despues de facturar: se guarda directo en
                                                                    el presupuesto, sin tener que reabrirlo. */}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setSubItemsTarget({ item, budgetId: entry.id }); }}
                                                                    title="Desglose interno: que material se gasto (no sale en el PDF)"
                                                                    className={cn(
                                                                        "inline-flex items-center gap-1 h-4 px-1.5 rounded-full border font-black text-[8px] uppercase transition-colors",
                                                                        sinClasificar(item)
                                                                            ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20"
                                                                            : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                                                                    )}
                                                                >
                                                                    <Layers className="w-2.5 h-2.5" />
                                                                    {sinClasificar(item)
                                                                        ? '?'
                                                                        : (m2DeSubItems(item.subItems) > 0
                                                                            ? `${m2DeSubItems(item.subItems).toLocaleString(undefined, { maximumFractionDigits: 1 })}m²`
                                                                            : `${item.subItems.length}`)}
                                                                </button>
                                                                <span className="font-black bg-slate-50 dark:bg-slate-800 px-1.5 rounded-md">x{item.cantidad}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {entry.items.length > 2 && (
                                                        <div className="text-[9px] text-blue-500 font-black italic mt-1.5 flex items-center gap-1">
                                                            <Plus className="w-3 h-3" /> {entry.items.length - 2} concepto(s) adicionales
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* ACCIONES HOVER */}
                                            <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1.5 rounded-2xl shadow-xl border border-black/5">
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
                            })
                        )}
                    </div>
                </aside>
            </div>

            {/* Desglose interno del renglon. Vale tanto para el presupuesto que
                se esta escribiendo como para uno del historial ya facturado. */}
            <EditorPDFModal
                open={!!pdfEnEdicion}
                onOpenChange={o => !o && setPdfEnEdicion(null)}
                tipo="presupuesto"
                datos={pdfEnEdicion}
                tasas={[
                    { id: 'usd', nombre: 'Tasa BCV ($)', valor: safeRates.usd },
                    { id: 'eur', nombre: 'Tasa BCV (€)', valor: safeRates.eur },
                    { id: 'usdt', nombre: 'Tasa Monitor', valor: safeRates.usdt },
                    { id: 'solo', nombre: 'Solo dólares', valor: 0 },
                ]}
                logoBase64={pdfLogoBase64}
                firmaBase64={firmaBase64}
                selloBase64={selloBase64}
            />

            <SubItemsModal
                open={!!subItemsTarget}
                onOpenChange={o => !o && setSubItemsTarget(null)}
                item={subItemsTarget?.item || null}
                productos={catalogProductos}
                onGuardar={handleGuardarSubItems}
            />
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
        <Card className={cn("rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-xl p-3 sm:p-7 flex items-center gap-2 sm:gap-5", colors[color], className)}>
            <div className={cn("w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-inner", color === 'blue' ? "bg-white/20" : "bg-slate-50 dark:bg-white/5")}>
                {React.cloneElement(icon, { className: cn("w-4 h-4 sm:w-6 sm:h-6", color === 'blue' ? "text-white" : "text-slate-400") })}
            </div>
            <div className="min-w-0">
                <p className={cn("text-[8px] font-black uppercase tracking-wider leading-none mb-1", color === 'blue' ? "text-white/70" : "text-slate-400")}>{label}</p>
                <h3 className="text-base sm:text-2xl font-black tracking-tighter leading-none truncate">{value}</h3>
            </div>
        </Card>
    );
}
