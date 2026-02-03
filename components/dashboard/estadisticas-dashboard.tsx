// @/components/orden/estadisticas-dashboard.tsx
"use client"

import React, { useMemo, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { 
  Building2, Package, LayoutGrid,
  DollarSign, Wallet, TrendingUp, TrendingDown,
  AlertCircle, Scissors, Printer,
  UserCheck, ChevronLeft, ChevronRight,
  Target, BarChart3, Activity, Clock, ShieldAlert,
  Percent, Image as ImageIcon, Layers, Ruler,
  Zap, Timer, FileDown, Loader2, Palette, Eye, CalendarDays, ArrowUpRight, ArrowDownLeft,
  Search
} from "lucide-react"
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

import type { GastoInsumo, GastoFijo, Empleado, PagoEmpleado, Cobranza } from "@/lib/types/gastos"
import { type OrdenServicio } from "@/lib/types/orden"
import { cn } from "@/lib/utils"

// IMPORTAMOS EL MODAL DE DETALLE
import { OrderDetailModal } from "@/components/orden/order-detail-modal"

// --- CONSTANTES DE DETECCIÓN (INTELIGENCIA DE MATERIALES) ---
const MATERIALES_CORTE_KEYS = {
    'Acrilico': ['acrilico', 'acr', 'acrylic', 'plastico'],
    'MDF': ['mdf', 'm.d.f', 'madera', 'fibro', 'mdf crudo'],
    'Melamina': ['melamina', 'mdf melamina', 'chapilla'],
    'Cartulina': ['cartulina', 'carton', 'papel grueso'],
    'Otro': []
};

const COLORES_KEYS = {
    'Transparente': ['transparente', 'cristal', 'clear'],
    'Blanco': ['blanco', 'white', 'leche'],
    'Negro': ['negro', 'black'],
    'Rojo': ['rojo', 'red'],
    'Dorado': ['dorado', 'oro', 'gold'],
    'Espejo': ['espejo', 'mirror', 'plateado', 'plata', 'silver'],
    'Azul': ['azul', 'blue'],
    'Verde': ['verde', 'green'],
    'Amarillo': ['amarillo', 'yellow']
};

// --- VARIANTES DE ANIMACIÓN ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

const hoverEffect = {
  y: -2,
  transition: { type: "spring", stiffness: 300, damping: 15 }
};

const tapEffect = { scale: 0.98 };

interface EstadisticasDashboardProps {
  gastosInsumos: GastoInsumo[]
  gastosFijos: GastoFijo[]
  empleados: Empleado[]
  pagosEmpleados: PagoEmpleado[]
  cobranzas: Cobranza[]
  clientes: any[]
  ordenes: any[] 
  rates?: { usd: number, eur: number, usdt: number }
}

type ViewMode = 'GENERAL' | 'IMPRESION' | 'CORTE';
type DetailType = 'INGRESOS' | 'EGRESOS' | 'UTILIDAD' | 'DEUDA' | 'MATERIALES' | null;

// --- HELPERS ---
const identificarServicio = (item: any) => {
    const tipo = (item.tipoServicio || '').toUpperCase();
    const nombre = (item.nombre || item.descripcion || '').toLowerCase();

    if (tipo === 'DISENO' || tipo === 'DISEÑO') return 'DISENO'; 
    if (tipo === 'IMPRESION') return 'IMPRESION';
    if (tipo === 'CORTE' || tipo === 'CORTE_LASER') return 'CORTE';

    const keywordsLaser = [
        'laser', 'láser', 'corte', 'grabado', 'marcado', 'mdf', 'acrilico', 'acrílico', 
        'madera', 'plywood', 'cuero', 'piel', 'balsa', 'carton', 'reconocimiento', 
        'trofeo', 'medalla', 'galardon', 'placa', 'boligrafo', 'llavero', 'identificador', 
        'chapa', 'pin', 'topper', 'letras', 'corporeo', 'señaletica', 'buzon', 'rompecabezas'
    ];

    const keywordsPrint = [
        'impresion', 'impresión', 'print', 'plotter', 'tinta', 'vinil', 'vinilo', 'lona', 
        'banner', 'mesh', 'microperforado', 'papel', 'bond', 'glasé', 'fotografico', 
        'lienzo', 'canvas', 'back light', 'backlight', 'laminacion', 'laminado', 'matte', 
        'brillante', 'corte con impresion', 'troquelado', 'pendon', 'valla', 'gigantografia', 
        'sticker', 'calcomania', 'etiqueta', 'rotulado', 'floor graphic', 'esmerilado', 'poster', 'tarjeta'
    ];
    
    if (keywordsLaser.some(k => nombre.includes(k))) return 'CORTE';
    if (keywordsPrint.some(k => nombre.includes(k))) return 'IMPRESION';
    
    return 'OTROS';
};

const detectarCategoria = (texto: string, diccionario: any, fallback: string = 'Otros') => {
    const t = texto.toLowerCase();
    for (const [key, keywords] of Object.entries(diccionario)) {
        if (key.toLowerCase() === t) return key; // Coincidencia exacta
        if ((keywords as string[]).some(k => t.includes(k))) return key; // Coincidencia parcial
    }
    return fallback;
};

export function EstadisticasDashboard({
  gastosInsumos, gastosFijos, empleados, pagosEmpleados, cobranzas, clientes, ordenes, rates
}: EstadisticasDashboardProps) {

  const [viewMode, setViewMode] = useState<ViewMode>('GENERAL');
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [selectedDetail, setSelectedDetail] = useState<DetailType>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // ESTADO PARA FILTRO DE SEMANA
  const [selectedWeek, setSelectedWeek] = useState<string>('TODAS');

  // ESTADO PARA LOS MODALES
  const [selectedOrder, setSelectedOrder] = useState<OrdenServicio | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClientDebt, setSelectedClientDebt] = useState<any | null>(null);
  const [dayDetail, setDayDetail] = useState<{ date: Date; ingresos: any[]; egresos: any[] } | null>(null);
  
  // NUEVO ESTADO PARA DETALLE DE MATERIAL
  const [selectedMaterialDetail, setSelectedMaterialDetail] = useState<any | null>(null);

  // --- PDF ---
  const handleDownloadPDF = async () => {
    if (!dashboardRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const element = dashboardRef.current;
      const canvas = await toPng(element, { 
        cacheBust: true, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff'
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(canvas);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reporte_${viewMode}_${fechaReferencia.toLocaleDateString('es-VE').replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error("Error PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // --- DATOS ---
  const fechas = useMemo(() => {
      const year = fechaReferencia.getFullYear();
      const month = fechaReferencia.getMonth();
      return {
          inicio: new Date(year, month, 1),
          fin: new Date(year, month + 1, 0),
          inicioPrev: new Date(year, month - 1, 1),
          finPrev: new Date(year, month, 0)
      };
  }, [fechaReferencia]);

  const empRoleMap = useMemo(() => {
      const m = new Map();
      empleados.forEach(e => m.set(e.id, (e.cargo || '').toLowerCase()));
      return m;
  }, [empleados]);

  const clientFrequencyMap = useMemo(() => {
      const counts = new Map<string, number>();
      ordenes.forEach(o => {
          const name = o.cliente?.nombreRazonSocial || "Desconocido";
          counts.set(name, (counts.get(name) || 0) + 1);
      });
      return counts;
  }, [ordenes]);

  const orderBreakdown = useMemo(() => {
    const map = new Map<string, { pctImp: number, pctCorte: number, pctOtros: number }>();
    ordenes.forEach(o => {
        let totalImp = 0, totalCorte = 0, totalOtros = 0;
        (o.items || []).forEach((item: any) => {
            const sub = Number(item.subtotal) || 0;
            const servicioReal = identificarServicio(item);
            if (servicioReal === 'IMPRESION') totalImp += sub;
            else if (servicioReal === 'CORTE') totalCorte += sub;
            else totalOtros += sub;
        });

        let finalImp = totalImp;
        let finalCorte = totalCorte;
        if (totalOtros > 0) {
            const sumaBase = totalImp + totalCorte;
            if (sumaBase > 0) {
                finalImp += totalOtros * (totalImp / sumaBase);
                finalCorte += totalOtros * (totalCorte / sumaBase);
            } else {
                finalImp += totalOtros; 
            }
        }
        const totalFinal = finalImp + finalCorte || 1; 
        map.set(o.id, { pctImp: finalImp / totalFinal, pctCorte: finalCorte / totalFinal, pctOtros: 0 });
    });
    return map;
  }, [ordenes]);

  const productionMetrics = useMemo(() => {
      const calcularStats = (inicio: Date, fin: Date) => {
          let m2Totales = 0;
          let minutosTotales = 0;
          
          // Helper para agregar detalle
          const addDetail = (obj: any, item: any, orden: any, qty: number, subtotal: number) => {
              obj.count += qty;
              obj.revenue += subtotal;
              obj.details.push({
                  id: item.id || Math.random(),
                  ordenNumero: orden.ordenNumero,
                  cliente: orden.cliente?.nombreRazonSocial || "Cliente Desconocido",
                  fecha: orden.fecha,
                  descripcion: item.nombre || item.descripcion,
                  cantidad: qty,
                  monto: subtotal,
                  ordenData: orden // Referencia completa para abrir el modal
              });
          };

          // Desglose Impresión
          const matImpresion: any = {
              vinil: { label: 'Vinil / Stickers', count: 0, revenue: 0, details: [] },
              banner: { label: 'Banner / Lona', count: 0, revenue: 0, details: [] },
              micro: { label: 'Microperforado', count: 0, revenue: 0, details: [] },
              laminado: { label: 'Laminado', count: 0, revenue: 0, details: [] },
              papel: { label: 'Papel / Poster', count: 0, revenue: 0, details: [] },
              otros: { label: 'Otros Print', count: 0, revenue: 0, details: [] }
          };

          // Desglose Corte
          const matCorte: Record<string, { label: string, count: number, revenue: number, details: any[] }> = {};
          const colCorte: Record<string, { label: string, count: number, revenue: number, details: any[] }> = {};

          ordenes.filter(o => {
              const f = new Date(o.fecha);
              return f >= inicio && f <= fin && o.estado !== 'ANULADO';
          }).forEach(o => {
              (o.items || []).forEach((item: any) => {
                  const servicio = identificarServicio(item);
                  const nombreLower = (item.nombre || '').toLowerCase();
                  const subtotal = Number(item.subtotal) || 0;
                  const qty = parseFloat(item.cantidad) || 1;

                  if (servicio === 'IMPRESION') {
                      const x = parseFloat(item.medidaXCm) || 0;
                      const y = parseFloat(item.medidaYCm) || 0;
                      if (x > 0 && y > 0) m2Totales += (x * y / 10000) * qty; 
                      
                      if (nombreLower.includes('microperforado')) {
                          addDetail(matImpresion.micro, item, o, qty, subtotal);
                      } else if (nombreLower.includes('laminado') || nombreLower.includes('laminacion')) {
                          addDetail(matImpresion.laminado, item, o, qty, subtotal);
                      } else if (nombreLower.includes('banner') || nombreLower.includes('lona') || nombreLower.includes('mesh') || nombreLower.includes('lienzo')) {
                          addDetail(matImpresion.banner, item, o, qty, subtotal);
                      } else if (nombreLower.includes('papel') || nombreLower.includes('bond') || nombreLower.includes('fotografico') || nombreLower.includes('poster')) {
                          addDetail(matImpresion.papel, item, o, qty, subtotal);
                      } else if (nombreLower.includes('vinil') || nombreLower.includes('sticker') || nombreLower.includes('etiqueta') || nombreLower.includes('rotulado')) {
                          addDetail(matImpresion.vinil, item, o, qty, subtotal);
                      } else {
                          addDetail(matImpresion.otros, item, o, qty, subtotal);
                      }
                  }
                  
                  if (servicio === 'CORTE') {
                      const minutosItem = (item.tiempo ? parseFloat(item.tiempo) : qty);
                      minutosTotales += minutosItem;
                      
                      // 1. Detección de Material
                      let materialKey = item.materialDeCorte || 'Otros';
                      if (!item.materialDeCorte || item.materialDeCorte === 'Otros') {
                           const detected = detectarCategoria(nombreLower, MATERIALES_CORTE_KEYS, 'Otros');
                           if(detected !== 'Otros') materialKey = detected;
                      }
                      
                      if (!matCorte[materialKey]) matCorte[materialKey] = { label: materialKey, count: 0, revenue: 0, details: [] };
                      addDetail(matCorte[materialKey], item, o, qty, subtotal);

                      // 2. Detección de Color
                      let colorKey = item.colorAcrilico || 'N/A';
                      if (!item.colorAcrilico || item.colorAcrilico === 'N/A') {
                          colorKey = detectarCategoria(nombreLower, COLORES_KEYS, 'N/A');
                      }
                      
                      if (colorKey !== 'N/A' && colorKey !== 'Otros') {
                          if (!colCorte[colorKey]) colCorte[colorKey] = { label: colorKey, count: 0, revenue: 0, details: [] };
                          addDetail(colCorte[colorKey], item, o, qty, subtotal);
                      }
                  }
              });
          });

          const sortedMaterialsCorte = Object.values(matCorte).sort((a, b) => b.count - a.count);
          const sortedColorsCorte = Object.values(colCorte).sort((a, b) => b.count - a.count);

          return { 
              m2Totales, 
              minutosTotales,
              breakdownImpresion: Object.values(matImpresion).filter((m: any) => m.count > 0 || m.revenue > 0),
              breakdownCorteMateriales: sortedMaterialsCorte,
              breakdownCorteColores: sortedColorsCorte
          };
      };

      const actual = calcularStats(fechas.inicio, fechas.fin);
      const anterior = calcularStats(fechas.inicioPrev, fechas.finPrev);
      const variacionM2 = anterior.m2Totales > 0 ? ((actual.m2Totales - anterior.m2Totales) / anterior.m2Totales) * 100 : 0;
      const variacionMinutos = anterior.minutosTotales > 0 ? ((actual.minutosTotales - anterior.minutosTotales) / anterior.minutosTotales) * 100 : 0;
      
      return { actual, anterior, variacionM2, variacionMinutos };
  }, [ordenes, fechas]);

  const metricas = useMemo(() => {
    const calcularRango = (inicio: Date, fin: Date) => {
        let ingresos = 0; let egresosDirectos = 0; let ordenesCount = 0;
        
        cobranzas?.filter(c => {
            const f = new Date(c.fecha || '');
            return c.estado === 'pagado' && f >= inicio && f <= fin;
        }).forEach(c => {
            const props = orderBreakdown.get(c.id) || { pctImp: 0, pctCorte: 0, pctOtros: 0 };
            const monto = Number(c.montoUSD) || 0;
            if (viewMode === 'GENERAL') ingresos += monto;
            else if (viewMode === 'IMPRESION') ingresos += monto * props.pctImp;
            else if (viewMode === 'CORTE') ingresos += monto * props.pctCorte;
        });

        ordenes.filter(o => {
            const f = new Date(o.fecha);
            return f >= inicio && f <= fin && o.estado !== 'ANULADO';
        }).forEach(o => {
            const props = orderBreakdown.get(o.id);
            if (viewMode === 'GENERAL') ordenesCount++;
            else if (viewMode === 'IMPRESION' && (props?.pctImp || 0) > 0.01) ordenesCount++;
            else if (viewMode === 'CORTE' && (props?.pctCorte || 0) > 0.01) ordenesCount++;
        });

        (gastosInsumos || []).filter(g => {
            const f = new Date(g.fecha);
            return f >= inicio && f <= fin;
        }).forEach(g => {
            const areaExplicita = (g as any).area; 
            const texto = ((g as any).nombre || g.descripcion || (g as any).concepto || "" + ' ' + (g.categoria || '')).toLowerCase();
            let relevante = false;
            const keywordsImp = ['tinta', 'vinil', 'lona', 'banner', 'papel', 'impresion', 'microperforado', 'ojales', 'laminacion', 'laminado', 'esmerilado'];
            const keywordsCorte = ['mdf', 'acrilico', 'acr', 'madera', 'laser', 'corte', 'pintura', 'thinner', 'balsa', 'plywood'];
            if (viewMode === 'GENERAL') relevante = true;
            else if (viewMode === 'IMPRESION') {
                if (areaExplicita) relevante = areaExplicita === 'IMPRESION';
                else relevante = keywordsImp.some(k => texto.includes(k));
            } 
            else if (viewMode === 'CORTE') {
                if (areaExplicita) relevante = areaExplicita === 'CORTE';
                else relevante = keywordsCorte.some(k => texto.includes(k));
            }
            if (relevante) egresosDirectos += (Number(g.monto) || 0);
        });

        let gastosDiseno = 0;
        if (viewMode === 'GENERAL') { 
             ordenes.forEach(o => {
                (o.items || []).forEach((item: any) => {
                    const tipo = identificarServicio(item);
                    const isPaid = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                    if (tipo === 'DISENO' && isPaid) {
                        const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                        if (fechaPago >= inicio && fechaPago <= fin) {
                             const costoReal = (item.costoInterno !== undefined && item.costoInterno !== null) 
                                                ? Number(item.costoInterno) 
                                                : Number(item.precioUnitario);
                             gastosDiseno += (costoReal || 0) * (Number(item.cantidad) || 1);
                        }
                    }
                });
             });
        }

        return { ingresos, egresosDirectos, ordenesCount, gastosDiseno };
    };

    const actual = calcularRango(fechas.inicio, fechas.fin);
    const anterior = calcularRango(fechas.inicioPrev, fechas.finPrev);

    const totalFijosRaw = gastosFijos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0;
    const fijosAplicables = viewMode === 'GENERAL' ? totalFijosRaw : 0; 

    const nominaFiltrada = (pagosEmpleados || []).filter(p => {
        const f = new Date(p.fecha || p.fechaPago || '');
        const enFecha = f >= fechas.inicio && f <= fechas.fin;
        if (!enFecha) return false;
        const cargo = empRoleMap.get(p.empleadoId) || '';
        if (viewMode === 'GENERAL') return true; 
        if (viewMode === 'IMPRESION') return cargo.includes('empleado') || cargo.includes('impresion') || cargo.includes('operario');
        if (viewMode === 'CORTE') return cargo.includes('laser') || cargo.includes('corte');
        return false;
    }).reduce((acc, p) => acc + (Number(p.totalUSD) || 0), 0);
    
    const nominaAplicable = nominaFiltrada;
    
    const egresosOperativos = fijosAplicables + nominaAplicable + actual.gastosDiseno;
    const egresosTotales = actual.egresosDirectos + egresosOperativos;
    
    const utilidadNeta = actual.ingresos - egresosTotales;
    const margenGanancia = actual.ingresos > 0 ? (utilidadNeta / actual.ingresos) * 100 : 0;
    
    const ticketPromedio = actual.ordenesCount > 0 ? actual.ingresos / actual.ordenesCount : 0;
    const numEmpleados = empleados.filter(e => {
        const cargo = (e.cargo || '').toLowerCase();
        if (viewMode === 'GENERAL') return true;
        if (viewMode === 'IMPRESION') return cargo.includes('empleado') || cargo.includes('impresion');
        if (viewMode === 'CORTE') return cargo.includes('laser');
        return false;
    }).length || 1;
    const ingresoPorEmpleado = actual.ingresos / numEmpleados;
    const puntoEquilibrioPct = egresosOperativos > 0 ? Math.min(100, (actual.ingresos / egresosOperativos) * 100) : 100;
    
    return { actual, anterior, fijosAplicables, nominaAplicable, egresosTotales, utilidadNeta, margenGanancia, ticketPromedio, ingresoPorEmpleado, puntoEquilibrioPct, variacionIngreso: anterior.ingresos > 0 ? ((actual.ingresos - anterior.ingresos) / anterior.ingresos) * 100 : 0 };
  }, [fechaReferencia, viewMode, cobranzas, ordenes, gastosInsumos, gastosFijos, pagosEmpleados, empRoleMap, orderBreakdown, fechas, empleados]);

  // --- 6. ANÁLISIS DE DEUDA ---
  const analisisDeuda = useMemo(() => {
      let deudaCorriente = 0; let deudaCritica = 0; let totalDeuda = 0;
      const hoy = new Date();
      
      const clientesDeudoresMap = new Map<string, {
          nombreCliente: string,
          montoTotal: number,
          ordenes: any[]
      }>();

      ordenes.forEach(o => {
          if (o.estado === 'ANULADO') return;
          const deudaReal = Math.max(0, (o.totalUSD || 0) - (o.montoPagadoUSD || 0));
          if (deudaReal <= 0.01) return;

          const props = orderBreakdown.get(o.id) || { pctImp: 0, pctCorte: 0, pctOtros: 0 };
          let deudaAplicable = 0;
          if (viewMode === 'GENERAL') deudaAplicable = deudaReal;
          else if (viewMode === 'IMPRESION') deudaAplicable = deudaReal * props.pctImp;
          else if (viewMode === 'CORTE') deudaAplicable = deudaReal * props.pctCorte;

          if (deudaAplicable > 0) {
              const fechaOrden = new Date(o.fecha);
              const diasAntiguedad = Math.floor((hoy.getTime() - fechaOrden.getTime()) / (1000 * 60 * 60 * 24));
              if (diasAntiguedad > 30) deudaCritica += deudaAplicable;
              else deudaCorriente += deudaAplicable;
              totalDeuda += deudaAplicable;

              const nombreKey = (o.cliente?.nombreRazonSocial || 'Cliente Desconocido').toUpperCase();
              
              if (!clientesDeudoresMap.has(nombreKey)) {
                  clientesDeudoresMap.set(nombreKey, {
                      nombreCliente: o.cliente?.nombreRazonSocial || 'Cliente Desconocido',
                      montoTotal: 0,
                      ordenes: []
                  });
              }

              const clienteData = clientesDeudoresMap.get(nombreKey)!;
              clienteData.montoTotal += deudaAplicable;
              clienteData.ordenes.push({
                  ...o,
                  deudaEspecifica: deudaAplicable
              });
          }
      });

      const topClientesDeuda = Array.from(clientesDeudoresMap.values())
          .sort((a, b) => b.montoTotal - a.montoTotal)
          .slice(0, 10);

      return { totalDeuda, deudaCorriente, deudaCritica, topClientesDeuda };
  }, [ordenes, viewMode, orderBreakdown]);

  // --- 7. GRÁFICOS ---
  const chartData = useMemo(() => {
    const map = new Map();
    const year = fechaReferencia.getFullYear();
    const month = fechaReferencia.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let startDay = 1;
    let endDay = daysInMonth;

    if (selectedWeek !== 'TODAS') {
        const weekNum = parseInt(selectedWeek);
        startDay = (weekNum - 1) * 7 + 1;
        endDay = Math.min(weekNum * 7, daysInMonth);
    }

    for (let i = startDay; i <= endDay; i++) {
        const date = new Date(year, month, i);
        let label = "";

        if (selectedWeek === 'TODAS') {
            label = i.toString();
        } else {
            const dayName = date.toLocaleDateString('es-VE', { weekday: 'short' });
            label = `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${i.toString().padStart(2, '0')}`;
        }
        map.set(i, { day: i, label, ingresos: 0, gastos: 0 });
    }

    cobranzas?.filter(c => {
        const f = new Date(c.fecha || '');
        return c.estado === 'pagado' && f >= fechas.inicio && f <= fechas.fin;
    }).forEach(c => {
        const dia = new Date(c.fecha || '').getDate();
        if (map.has(dia)) {
            const props = orderBreakdown.get(c.id);
            let monto = Number(c.montoUSD) || 0;
            if (viewMode === 'IMPRESION') monto *= (props?.pctImp || 0);
            if (viewMode === 'CORTE') monto *= (props?.pctCorte || 0);
            map.get(dia).ingresos += monto;
        }
    });

    (gastosInsumos || []).filter(g => {
        const f = new Date(g.fecha);
        return f >= fechas.inicio && f <= fechas.fin;
    }).forEach(g => {
        const dia = new Date(g.fecha).getDate();
        if (map.has(dia)) {
            const areaExplicita = (g as any).area; 
            const texto = ((g as any).nombre || g.descripcion || "").toLowerCase();
            let relevante = false;
            
            const keywordsImp = ['tinta', 'vinil', 'impresion', 'lona', 'papel'];
            const keywordsCorte = ['mdf', 'acrilico', 'laser', 'corte', 'madera'];

            if (viewMode === 'GENERAL') relevante = true;
            else if (viewMode === 'IMPRESION') {
                if (areaExplicita) relevante = areaExplicita === 'IMPRESION';
                else relevante = keywordsImp.some(k => texto.includes(k));
            }
            else if (viewMode === 'CORTE') {
                if (areaExplicita) relevante = areaExplicita === 'CORTE';
                else relevante = keywordsCorte.some(k => texto.includes(k));
            }

            if (relevante) map.get(dia).gastos += (Number(g.monto) || 0);
        }
    });

    (pagosEmpleados || []).filter(p => {
        const f = new Date(p.fecha || p.fechaPago || '');
        const enFecha = f >= fechas.inicio && f <= fechas.fin;
        if (!enFecha) return false;
        
        const cargo = empRoleMap.get(p.empleadoId) || '';
        if (viewMode === 'GENERAL') return true; 
        if (viewMode === 'IMPRESION') return cargo.includes('empleado') || cargo.includes('impresion') || cargo.includes('operario');
        if (viewMode === 'CORTE') return cargo.includes('laser') || cargo.includes('corte');
        return false;
    }).forEach(p => {
        const dia = new Date(p.fecha || p.fechaPago).getDate();
        if (map.has(dia)) map.get(dia).gastos += (Number(p.totalUSD) || 0);
    });

    if (viewMode === 'GENERAL') { 
         ordenes.forEach(o => {
            (o.items || []).forEach((item: any) => {
                const tipo = identificarServicio(item);
                const isPaid = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                
                if (tipo === 'DISENO' && isPaid) {
                    const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                    if (fechaPago >= fechas.inicio && fechaPago <= fechas.fin) {
                         const dia = fechaPago.getDate();
                         if (map.has(dia)) {
                             const costoReal = (item.costoInterno !== undefined && item.costoInterno !== null) 
                                                ? Number(item.costoInterno) 
                                                : Number(item.precioUnitario);
                             
                             const totalItem = (costoReal || 0) * (Number(item.cantidad) || 1);
                             map.get(dia).gastos += totalItem;
                         }
                    }
                }
            });
         });
    }

    return Array.from(map.values());
  }, [fechas, viewMode, cobranzas, gastosInsumos, orderBreakdown, pagosEmpleados, empRoleMap, ordenes, selectedWeek]);

  const cambiarMes = (dir: 'prev' | 'next') => {
      const nueva = new Date(fechaReferencia);
      nueva.setMonth(nueva.getMonth() + (dir === 'next' ? 1 : -1));
      setFechaReferencia(nueva);
  };

  const handleChartClick = (data: any) => {
      if (!data || !data.activePayload) return;
      const day = data.activePayload[0].payload.day;
      const targetDate = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), day);

      const ingresosDelDia = cobranzas?.filter(c => {
          const f = new Date(c.fecha || '');
          return c.estado === 'pagado' && f.getDate() === day && f.getMonth() === fechaReferencia.getMonth() && f.getFullYear() === fechaReferencia.getFullYear();
      }).map(c => {
          const props = orderBreakdown.get(c.id) || { pctImp: 0, pctCorte: 0, pctOtros: 0 };
          let monto = Number(c.montoUSD) || 0;
          if (viewMode === 'IMPRESION') monto *= props.pctImp;
          else if (viewMode === 'CORTE') monto *= props.pctCorte;
          
          const orden = ordenes.find(o => o.id === c.id);
          const cliente = orden?.cliente?.nombreRazonSocial || "Cliente Desconocido";
          
          return {
              id: c.id,
              descripcion: `Orden #${orden?.ordenNumero || 'S/N'} - ${cliente}`,
              monto: monto,
              tipo: "Ingreso",
              orden: orden
          };
      }).filter(i => i.monto > 0);

      const egresosDelDia: any[] = [];

      (gastosInsumos || []).forEach(g => {
          const f = new Date(g.fecha);
          if (f.getDate() === day && f.getMonth() === fechaReferencia.getMonth() && f.getFullYear() === fechaReferencia.getFullYear()) {
                const areaExplicita = (g as any).area; 
                const texto = ((g as any).nombre || g.descripcion || "").toLowerCase();
                const keywordsImp = ['tinta', 'vinil', 'impresion', 'lona', 'papel'];
                const keywordsCorte = ['mdf', 'acrilico', 'laser', 'corte', 'madera'];
                let relevante = false;

                if (viewMode === 'GENERAL') relevante = true;
                else if (viewMode === 'IMPRESION') {
                    if (areaExplicita) relevante = areaExplicita === 'IMPRESION';
                    else relevante = keywordsImp.some(k => texto.includes(k));
                }
                else if (viewMode === 'CORTE') {
                    if (areaExplicita) relevante = areaExplicita === 'CORTE';
                    else relevante = keywordsCorte.some(k => texto.includes(k));
                }

                if (relevante) {
                    egresosDelDia.push({
                        id: g.id,
                        descripcion: g.descripcion || (g as any).nombre || "Insumo Vario",
                        monto: Number(g.monto) || 0,
                        tipo: "Insumo"
                    });
                }
          }
      });

      (pagosEmpleados || []).forEach(p => {
          const f = new Date(p.fecha || p.fechaPago);
          if (f.getDate() === day && f.getMonth() === fechaReferencia.getMonth() && f.getFullYear() === fechaReferencia.getFullYear()) {
                const cargo = empRoleMap.get(p.empleadoId) || '';
                let relevante = false;
                if (viewMode === 'GENERAL') relevante = true; 
                else if (viewMode === 'IMPRESION') relevante = cargo.includes('empleado') || cargo.includes('impresion') || cargo.includes('operario');
                else if (viewMode === 'CORTE') relevante = cargo.includes('laser') || cargo.includes('corte');

                if (relevante) {
                    egresosDelDia.push({
                        id: p.id,
                        descripcion: `Nómina: ${p.nombre || 'Empleado'}`,
                        monto: Number(p.totalUSD) || 0,
                        tipo: "Nómina"
                    });
                }
          }
      });

      if (viewMode === 'GENERAL') {
          ordenes.forEach(o => {
            (o.items || []).forEach((item: any) => {
                const tipo = identificarServicio(item);
                const isPaid = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                if (tipo === 'DISENO' && isPaid) {
                    const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                    if (fechaPago.getDate() === day && fechaPago.getMonth() === fechaReferencia.getMonth() && fechaPago.getFullYear() === fechaReferencia.getFullYear()) {
                         const costoReal = (item.costoInterno !== undefined && item.costoInterno !== null) 
                                            ? Number(item.costoInterno) 
                                            : Number(item.precioUnitario);
                         
                         egresosDelDia.push({
                             id: item.id || Math.random(),
                             descripcion: `Diseño: ${item.empleadoAsignado || 'N/A'} (Orden #${o.ordenNumero})`,
                             monto: (costoReal || 0) * (Number(item.cantidad) || 1),
                             tipo: "Diseño",
                             orden: o 
                         });
                    }
                }
            });
         });
      }

      setDayDetail({
          date: targetDate,
          ingresos: ingresosDelDia || [],
          egresos: egresosDelDia || []
      });
  };

  const modalData = useMemo(() => {
      if (!selectedDetail) return null;
      const filtroFecha = (f: string | Date) => {
          const d = new Date(f);
          return d >= fechas.inicio && d <= fechas.fin;
      };
      if (selectedDetail === 'EGRESOS') {
          const keywordsImp = ['tinta', 'vinil', 'lona', 'banner', 'papel', 'impresion', 'microperforado', 'ojales', 'laminacion', 'laminado', 'esmerilado'];
          const keywordsCorte = ['mdf', 'acrilico', 'acr', 'madera', 'laser', 'corte', 'pintura', 'thinner', 'balsa', 'plywood'];
          const insumos = (gastosInsumos || []).filter(g => {
              if(!filtroFecha(g.fecha)) return false;
              const areaExplicita = (g as any).area;
              const texto = ((g as any).nombre || g.descripcion || "").toLowerCase();
              if (viewMode === 'GENERAL') return true;
              if (viewMode === 'IMPRESION') return areaExplicita === 'IMPRESION' || keywordsImp.some(k => texto.includes(k));
              if (viewMode === 'CORTE') return areaExplicita === 'CORTE' || keywordsCorte.some(k => texto.includes(k));
              return false;
          });
          const nomina = (pagosEmpleados || []).filter(p => filtroFecha(p.fecha || p.fechaPago || '') && (
              viewMode === 'GENERAL' ||
              (viewMode === 'IMPRESION' && (empRoleMap.get(p.empleadoId)||'').includes('empleado')) ||
              (viewMode === 'CORTE' && (empRoleMap.get(p.empleadoId)||'').includes('laser'))
          ));
          const fijos = viewMode === 'GENERAL' ? gastosFijos : [];
          
          const disenoItems: any[] = [];
          if (viewMode === 'GENERAL') {
               ordenes.forEach(o => {
                  (o.items || []).forEach((item: any) => {
                      const tipo = identificarServicio(item);
                      const isPaid = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                      if (tipo === 'DISENO' && isPaid) {
                          const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                          if (fechaPago >= fechas.inicio && fechaPago <= fechas.fin) {
                               const costoReal = (item.costoInterno !== undefined && item.costoInterno !== null) 
                                                ? Number(item.costoInterno) 
                                                : Number(item.precioUnitario);

                               disenoItems.push({
                                   nombre: item.empleadoAsignado || 'Sin Asignar',
                                   descripcion: `Orden #${o.ordenNumero} - ${item.nombre}`,
                                   fecha: fechaPago,
                                   monto: (costoReal || 0) * (Number(item.cantidad) || 1)
                               });
                          }
                      }
                  });
               });
          }

          return { insumos, fijos, nomina, disenoItems };
      }
      if (selectedDetail === 'INGRESOS') {
          return cobranzas.filter(c => c.estado === 'pagado' && filtroFecha(c.fecha || '')).map(c => {
                  const orden = ordenes.find(o => o.id === c.id);
                  const nombreCliente = orden?.cliente?.nombreRazonSocial || "Cliente Desconocido";
                  const ordersCount = clientFrequencyMap.get(nombreCliente) || 0;
                  const pct = viewMode === 'IMPRESION' ? (orderBreakdown.get(c.id)?.pctImp || 0) : (viewMode === 'CORTE' ? (orderBreakdown.get(c.id)?.pctCorte || 0) : 1);
                  return { ...c, nombreCliente, esRecurrente: ordersCount > 1, montoTotal: c.montoUSD, montoRelevante: (c.montoUSD || 0) * pct, porcentaje: pct * 100 };
              }).filter(c => (c.montoRelevante || 0) > 0);
      }
      return null;
  }, [selectedDetail, fechas, gastosInsumos, pagosEmpleados, gastosFijos, cobranzas, viewMode, empRoleMap, orderBreakdown, ordenes, clientFrequencyMap]);

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6 sm:space-y-8 p-4 sm:p-6 font-sans pb-24 text-slate-800 dark:text-slate-100"
      ref={dashboardRef}
    >
      
      {/* HEADER DE CONTROL */}
      <motion.div variants={itemVariants} className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 sm:gap-6 bg-white dark:bg-[#1c1c1e] p-4 sm:p-5 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-black/5 hover:shadow-lg transition-shadow">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <motion.div whileHover={{ rotate: 360, transition: { duration: 0.5 } }} className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl hidden sm:block">
                <BarChart3 className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </motion.div>
            <div>
                <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter">
                    {viewMode === 'GENERAL' ? 'Visión General' : `División ${viewMode}`}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Reporte Mensual
                </p>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center justify-between w-full sm:w-auto gap-3 bg-slate-50 dark:bg-black/20 p-2 rounded-2xl border border-black/5">
                <motion.button whileTap={tapEffect} onClick={() => cambiarMes('prev')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 transition-colors shadow-sm"><ChevronLeft size={18}/></motion.button>
                <div className="px-2 sm:px-4 text-center min-w-[100px] sm:min-w-[120px]">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Periodo</span>
                    <span className="block text-xs sm:text-sm font-bold uppercase">{fechaReferencia.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}</span>
                </div>
                <motion.button whileTap={tapEffect} onClick={() => cambiarMes('next')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 transition-colors shadow-sm"><ChevronRight size={18}/></motion.button>
            </div>

            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={tapEffect}
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="w-full sm:w-auto justify-center flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
                {isGeneratingPdf ? <Loader2 className="animate-spin w-4 h-4"/> : <FileDown className="w-4 h-4" />}
                {isGeneratingPdf ? "Generando..." : "Reporte"}
            </motion.button>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap bg-slate-100 dark:bg-black/20 p-1.5 rounded-2xl gap-1">
            <TabButton active={viewMode === 'GENERAL'} onClick={() => setViewMode('GENERAL')} icon={<LayoutGrid size={14}/>} label="General" />
            <TabButton active={viewMode === 'IMPRESION'} onClick={() => setViewMode('IMPRESION')} icon={<Printer size={14}/>} label="Print" color="blue" />
            <TabButton active={viewMode === 'CORTE'} onClick={() => setViewMode('CORTE')} icon={<Scissors size={14}/>} label="Corte" color="orange" />
        </div>
      </motion.div>

      {/* SECCIONES DE PRODUCCIÓN (CLICKEABLE) */}
      <AnimatePresence mode="wait">
        {viewMode === 'IMPRESION' && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
            >
                <motion.div 
                    variants={itemVariants} 
                    initial="hidden"
                    animate="visible"
                    whileHover={hoverEffect} 
                    className="bg-blue-600 p-6 rounded-[2.5rem] shadow-xl shadow-blue-500/20 text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-10"><Ruler size={100} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/20 rounded-xl"><Layers size={20}/></div>
                            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Volumen Impreso</span>
                        </div>
                        <p className="text-3xl sm:text-4xl font-black tracking-tighter">{productionMetrics.actual.m2Totales.toFixed(2)} <span className="text-lg opacity-60">m²</span></p>
                        <div className="flex items-center gap-2 mt-4 bg-white/10 w-fit px-3 py-1 rounded-lg">
                            {productionMetrics.variacionM2 >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                            <span className="text-xs font-bold">{Math.abs(productionMetrics.variacionM2).toFixed(1)}% vs mes anterior</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={hoverEffect} 
                    className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2.5rem] shadow-sm border border-black/5 flex flex-col"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl"><ImageIcon size={20} className="text-slate-500"/></div>
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Desglose Materiales</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                        {productionMetrics.actual.breakdownImpresion.map((mat: any, idx: number) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedMaterialDetail(mat)}
                                className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20 flex flex-col justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <p className="text-[9px] font-black text-slate-400 uppercase truncate" title={mat.label}>{mat.label}</p>
                                <div>
                                    <p className="text-lg font-black text-slate-800 dark:text-white leading-none mt-1">{mat.count} <span className="text-[9px] opacity-50 font-bold">unids</span></p>
                                    <p className="text-xs font-bold text-emerald-600 mt-0.5">${mat.revenue.toFixed(0)}</p>
                                </div>
                            </div>
                        ))}
                        {productionMetrics.actual.breakdownImpresion.length === 0 && (
                            <div className="col-span-2 text-center text-xs text-slate-400 py-4">No hay datos de impresión</div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {viewMode === 'CORTE' && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
            >
                <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={hoverEffect} 
                    className="bg-rose-600 p-6 rounded-[2.5rem] shadow-xl shadow-rose-500/20 text-white relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-10"><Timer size={100} /></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/20 rounded-xl"><Zap size={20}/></div>
                            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Tiempo de Corte</span>
                        </div>
                        <p className="text-3xl sm:text-4xl font-black tracking-tighter">{productionMetrics.actual.minutosTotales.toFixed(0)} <span className="text-lg opacity-60">min</span></p>
                        <div className="flex items-center gap-2 mt-4 bg-white/10 w-fit px-3 py-1 rounded-lg">
                            {productionMetrics.variacionMinutos >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                            <span className="text-xs font-bold">{Math.abs(productionMetrics.variacionMinutos).toFixed(1)}% vs mes anterior</span>
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={hoverEffect} 
                    className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2.5rem] shadow-sm border border-black/5 flex flex-col h-full"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl"><Layers size={20} className="text-slate-500"/></div>
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Tendencias Corte</span>
                    </div>

                    <Tabs defaultValue="materiales" className="flex-1 flex flex-col">
                        <TabsList className="w-full bg-slate-100 dark:bg-white/5 p-1 rounded-xl mb-3">
                            <TabsTrigger value="materiales" className="flex-1 text-[9px] uppercase font-black">Materiales</TabsTrigger>
                            <TabsTrigger value="colores" className="flex-1 text-[9px] uppercase font-black">Colores</TabsTrigger>
                        </TabsList>

                        <TabsContent value="materiales" className="flex-1 mt-0">
                            <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[140px] custom-scrollbar pr-1">
                                {productionMetrics.actual.breakdownCorteMateriales.map((mat: any, idx: number) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedMaterialDetail(mat)}
                                        className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20 flex flex-col justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <p className="text-[9px] font-black text-slate-400 uppercase truncate" title={mat.label}>{mat.label}</p>
                                        <div>
                                            <p className="text-lg font-black text-slate-800 dark:text-white leading-none mt-1">{mat.count} <span className="text-[9px] opacity-50 font-bold">unids</span></p>
                                        </div>
                                    </div>
                                ))}
                                {productionMetrics.actual.breakdownCorteMateriales.length === 0 && (
                                    <div className="col-span-2 text-center text-xs text-slate-400 py-4">No hay datos de materiales</div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="colores" className="flex-1 mt-0">
                             <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[140px] custom-scrollbar pr-1">
                                {productionMetrics.actual.breakdownCorteColores.map((col: any, idx: number) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedMaterialDetail(col)}
                                        className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20 flex flex-col justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <div className="w-2 h-2 rounded-full border border-slate-200" style={{ backgroundColor: col.label === 'Transparente' ? 'transparent' : col.label.toLowerCase() === 'espejo' ? '#c0c0c0' : col.label.toLowerCase() }} />
                                            <p className="text-[9px] font-black text-slate-400 uppercase truncate" title={col.label}>{col.label}</p>
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-slate-800 dark:text-white leading-none">{col.count} <span className="text-[9px] opacity-50 font-bold">unids</span></p>
                                        </div>
                                    </div>
                                ))}
                                {productionMetrics.actual.breakdownCorteColores.length === 0 && (
                                    <div className="col-span-2 text-center text-xs text-slate-400 py-4">No hay datos de colores</div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* KPI PRINCIPALES */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard 
            label="Ingresos Totales" 
            value={metricas.actual.ingresos} 
            trend={metricas.variacionIngreso}
            icon={<TrendingUp size={24}/>} 
            color="emerald"
            sub="Facturación Real"
            onClick={() => setSelectedDetail('INGRESOS')}
        />
        <StatCard 
            label="Egresos Operativos" 
            value={metricas.egresosTotales} 
            trend={0} 
            icon={<Wallet size={24}/>} 
            color="rose"
            sub={viewMode === 'GENERAL' ? "Insumos + Fijos + Nómina + Diseño" : "Solo Insumos + Nómina"}
            onClick={() => setSelectedDetail('EGRESOS')}
        />
        <StatCard 
            label="Utilidad Neta" 
            value={metricas.utilidadNeta} 
            trend={0}
            icon={<DollarSign size={24}/>} 
            color={metricas.utilidadNeta >= 0 ? "indigo" : "orange"}
            sub="Ganancia Libre"
            highlight
            onClick={() => setSelectedDetail('UTILIDAD')}
        />
        <motion.div 
            variants={itemVariants} 
            whileHover={hoverEffect}
            className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2.5rem] shadow-sm border border-black/5 flex flex-col justify-between relative overflow-hidden cursor-pointer"
        >
            <div className="flex justify-between items-start z-10">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Punto de Equilibrio</p>
                    <h3 className="text-2xl sm:text-3xl font-black italic tracking-tighter">{metricas.puntoEquilibrioPct.toFixed(0)}%</h3>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl"><Target size={24}/></div>
            </div>
            <div className="mt-4 z-10">
                <div className="h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${Math.min(metricas.puntoEquilibrioPct, 100)}%` }} 
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className={cn("h-full rounded-full", metricas.puntoEquilibrioPct >= 100 ? "bg-emerald-500" : "bg-blue-500")}
                    />
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-2 text-right uppercase">
                    {metricas.puntoEquilibrioPct >= 100 ? "¡Costos Cubiertos!" : "Cobertura de Costos Fijos"}
                </p>
            </div>
        </motion.div>
      </motion.div>

      {/* EFICIENCIA Y GRÁFICO */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} whileHover={hoverEffect}>
            <Card className="p-6 sm:p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col justify-between h-full">
                <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-slate-400"/> Eficiencia Operativa
                </h3>
                <div className="space-y-6">
                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-black/20 rounded-2xl">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Promedio</p>
                            <p className="text-2xl font-black">${metricas.ticketPromedio.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingreso / Empleado</p>
                            <p className="text-2xl font-black text-blue-600">${metricas.ingresoPorEmpleado.toFixed(0)}</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-xl"><Percent size={18}/></div>
                            <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">Margen Real</span>
                        </div>
                        <span className="text-2xl font-black text-emerald-600">{metricas.margenGanancia.toFixed(1)}%</span>
                    </div>
                </div>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="p-6 sm:p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm relative overflow-hidden h-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-slate-400"/> 
                        <h3 className="text-lg font-black uppercase italic">Flujo Mensual</h3>
                    </div>
                    
                    {/* FILTRO DE SEMANAS */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-black/20 p-1 rounded-xl overflow-x-auto max-w-full">
                        {['TODAS', '1', '2', '3', '4', '5'].map((w) => (
                            <button
                                key={w}
                                onClick={() => setSelectedWeek(w)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap",
                                    selectedWeek === w 
                                        ? "bg-white dark:bg-white/10 text-blue-600 shadow-sm" 
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {w === 'TODAS' ? 'Mes Completo' : `Sem ${w}`}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="h-[250px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} onClick={handleChartClick}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                            <XAxis 
                                dataKey="label" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                                dy={10} 
                                interval={selectedWeek === 'TODAS' ? 'preserveStartEnd' : 0} 
                            />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} 
                                cursor={{ fill: 'rgba(0,0,0,0.02)' }} 
                            />
                            <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer" />
                            <Bar dataKey="gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} cursor="pointer" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"/> Ingresos
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-600">
                        <div className="w-3 h-3 rounded-full bg-rose-500"/> Egresos
                    </div>
                </div>
            </Card>
          </motion.div>
      </motion.div>

      {/* DEUDA AGRUPADA POR CLIENTE */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} whileHover={hoverEffect}>
            <Card className="p-6 sm:p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col relative overflow-hidden h-full">
                <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400"/> Antigüedad de Deuda
                </h3>
                <div className="flex gap-4">
                    <div className="flex-1 p-4 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Corriente (&lt;30d)</p>
                        <p className="text-xl sm:text-2xl font-black text-slate-700 dark:text-white">${analisisDeuda.deudaCorriente.toLocaleString()}</p>
                        <div className="h-1.5 w-full bg-slate-200 mt-3 rounded-full overflow-hidden">
                            <motion.div initial={{width:0}} animate={{width: `${(analisisDeuda.deudaCorriente / (analisisDeuda.totalDeuda || 1)) * 100}%`}} className="h-full bg-blue-500 rounded-full" />
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-900/20">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Crítica (&gt;30d)</p>
                            <ShieldAlert className="w-3 h-3 text-rose-500" />
                        </div>
                        <p className="text-xl sm:text-2xl font-black text-rose-600">${analisisDeuda.deudaCritica.toLocaleString()}</p>
                        <div className="h-1.5 w-full bg-rose-200 mt-3 rounded-full overflow-hidden">
                            <motion.div initial={{width:0}} animate={{width: `${(analisisDeuda.deudaCritica / (analisisDeuda.totalDeuda || 1)) * 100}%`}} className="h-full bg-rose-500 rounded-full" />
                        </div>
                    </div>
                </div>
                <div className="mt-4 text-center cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-colors" onClick={() => setSelectedDetail('DEUDA')}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Total por Cobrar: <span className="text-slate-800 dark:text-white">${analisisDeuda.totalDeuda.toLocaleString()}</span>
                    </p>
                </div>
            </Card>
          </motion.div>

          {/* TABLA DE DEUDORES (CLIENTES) */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="p-6 sm:p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col h-full">
                <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-slate-400"/> Cartera de Clientes Deudores {viewMode !== 'GENERAL' && `(${viewMode})`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 max-h-[300px] custom-scrollbar">
                    {analisisDeuda.topClientesDeuda.length > 0 ? analisisDeuda.topClientesDeuda.slice(0, 6).map((cliente, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => setSelectedClientDebt(cliente)}
                            className="flex justify-between items-center p-4 rounded-[2rem] bg-slate-50 dark:bg-black/20 hover:bg-slate-100 transition-all cursor-pointer border border-transparent hover:border-slate-200"
                        >
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center font-black text-xs text-slate-500 shadow-sm shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{cliente.nombreCliente}</span>
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                        <Layers size={12} /> {cliente.ordenes.length} Órdenes
                                    </span>
                                </div>
                            </div>
                            <span className="text-base font-black text-rose-600">${cliente.montoTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </motion.div>
                    )) : (
                        <div className="col-span-full py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                            No hay deudas pendientes en este periodo/división.
                        </div>
                    )}
                </div>
            </Card>
          </motion.div>
      </motion.div>

      {/* --- MODALES --- */}
      <AnimatePresence>
        {selectedDetail && (
            <Dialog open={!!selectedDetail} onOpenChange={(o) => !o && setSelectedDetail(null)}>
                <DialogContent className="w-[95vw] max-w-4xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="p-6 sm:p-8 pb-0"
                    >
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-4">
                                {selectedDetail === 'INGRESOS' && <div className="p-3 bg-emerald-100 rounded-2xl"><TrendingUp className="text-emerald-600 w-6 h-6"/></div>}
                                {selectedDetail === 'EGRESOS' && <div className="p-3 bg-rose-100 rounded-2xl"><Wallet className="text-rose-600 w-6 h-6"/></div>}
                                {selectedDetail === 'UTILIDAD' && <div className="p-3 bg-indigo-100 rounded-2xl"><DollarSign className="text-indigo-600 w-6 h-6"/></div>}
                                {selectedDetail === 'DEUDA' && <div className="p-3 bg-orange-100 rounded-2xl"><AlertCircle className="text-orange-600 w-6 h-6"/></div>}
                                <div className="flex flex-col">
                                    <span>Detalle {selectedDetail?.toLowerCase()}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {viewMode} &bull; {fechaReferencia.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                    </motion.div>

                    <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {selectedDetail === 'EGRESOS' && (
                            <Tabs defaultValue="insumos" className="w-full">
                                <TabsList className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-full mb-8 h-auto flex flex-wrap gap-1">
                                    <TabsTrigger value="insumos" className="rounded-full px-6 py-2.5 font-bold uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md flex-1">
                                        Insumos (${(modalData as any)?.insumos?.reduce((a:any,b:any)=>a+(Number(b.monto) || 0), 0).toFixed(0)})
                                    </TabsTrigger>
                                    {viewMode === 'GENERAL' && (
                                        <>
                                            <TabsTrigger value="fijos" className="rounded-full px-6 py-2.5 font-bold uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md flex-1">
                                                Fijos (${(modalData as any)?.fijos?.reduce((a:any,b:any)=>a+(Number(b.monto) || 0), 0).toFixed(0)})
                                            </TabsTrigger>
                                            <TabsTrigger value="diseno" className="rounded-full px-6 py-2.5 font-bold uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md flex-1">
                                                Diseño (${(modalData as any)?.disenoItems?.reduce((a:any,b:any)=>a+(Number(b.monto) || 0), 0).toFixed(0)})
                                            </TabsTrigger>
                                        </>
                                    )}
                                    <TabsTrigger value="nomina" className="rounded-full px-6 py-2.5 font-bold uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md flex-1">
                                        Nómina (${(modalData as any)?.nomina?.reduce((a:any,b:any)=>a+(Number(b.totalUSD) || 0), 0).toFixed(0)})
                                    </TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="insumos" className="space-y-3">
                                    {(modalData as any)?.insumos?.map((item:any, i:number) => (
                                        <motion.div 
                                            key={i} 
                                            initial={{ opacity: 0, x: -10 }} 
                                            animate={{ opacity: 1, x: 0 }} 
                                            transition={{ delay: i * 0.05 }}
                                            className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><Package size={18}/></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{item.descripcion || item.nombre}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(item.fecha).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="text-base font-black text-slate-900 dark:text-white">${item.monto}</span>
                                        </motion.div>
                                    ))}
                                </TabsContent>
                                
                                {viewMode === 'GENERAL' && (
                                    <>
                                        <TabsContent value="fijos" className="space-y-3">
                                            {(modalData as any)?.fijos?.map((item:any, i:number) => (
                                                <motion.div 
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex justify-between items-center p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Building2 size={18}/></div>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{item.nombre}</p>
                                                    </div>
                                                    <span className="text-base font-black text-slate-900 dark:text-white">${item.monto}</span>
                                                </motion.div>
                                            ))}
                                        </TabsContent>
                                        <TabsContent value="diseno" className="space-y-3">
                                            {(modalData as any)?.disenoItems?.map((item:any, i:number) => (
                                                <motion.div 
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex justify-between items-center p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/20"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center"><Palette size={18}/></div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{item.nombre}</p>
                                                            <p className="text-[10px] font-bold text-slate-500">{item.descripcion}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-base font-black text-slate-900 dark:text-white">${item.monto.toFixed(2)}</span>
                                                </motion.div>
                                            ))}
                                        </TabsContent>
                                    </>
                                )}

                                <TabsContent value="nomina" className="space-y-3">
                                    {(modalData as any)?.nomina?.map((item:any, i:number) => (
                                        <motion.div 
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex justify-between items-center p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/20"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><UserCheck size={18}/></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white capitalize">{item.nombre}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(item.fechaPago || item.fecha).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="text-base font-black text-slate-900 dark:text-white">${item.totalUSD}</span>
                                        </motion.div>
                                    ))}
                                </TabsContent>
                            </Tabs>
                        )}

                        {selectedDetail === 'INGRESOS' && (
                            <div className="space-y-3">
                                {(modalData as any)?.map((c:any, i:number) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-sm">{i+1}</div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 uppercase">{c.nombreCliente}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{new Date(c.fecha).toLocaleDateString()}</span>
                                                    {c.esRecurrente && (
                                                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider">
                                                            Recurrente
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-lg font-black text-emerald-600 block">+${c.montoRelevante?.toFixed(2)}</span>
                                            {viewMode !== 'GENERAL' && (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                    ({c.porcentaje.toFixed(0)}% del total)
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {selectedDetail === 'UTILIDAD' && (
                            <div className="flex flex-col gap-6">
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center py-10 bg-slate-50 dark:bg-white/5 rounded-[2.5rem]"
                                >
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Resultado Neto</p>
                                    <div className={cn("text-6xl sm:text-7xl font-black tracking-tighter mb-4", metricas.utilidadNeta >= 0 ? "text-indigo-600" : "text-red-500")}>
                                        ${metricas.utilidadNeta.toFixed(2)}
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-black/20 rounded-full shadow-sm border border-slate-100 dark:border-white/10">
                                        <span className="text-[10px] font-black uppercase text-slate-400">Margen Real</span>
                                        <span className={cn("text-sm font-black", metricas.margenGanancia >= 0 ? "text-emerald-500" : "text-red-500")}>
                                            {metricas.margenGanancia.toFixed(1)}%
                                        </span>
                                    </div>
                                </motion.div>

                                <div className="space-y-3">
                                    <p className="text-xs font-black text-slate-400 uppercase ml-4 mb-2 tracking-widest">Desglose Operativo</p>
                                    <div className="flex justify-between items-center p-5 bg-emerald-50/50 rounded-[1.5rem] border border-emerald-100">
                                        <span className="text-xs font-black uppercase text-emerald-700 tracking-wide">Ingresos Totales</span>
                                        <span className="text-lg font-black text-emerald-700">+ ${metricas.actual.ingresos.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-5 bg-rose-50/50 rounded-[1.5rem] border border-rose-100">
                                        <span className="text-xs font-black uppercase text-rose-700 tracking-wide">Insumos & Materiales</span>
                                        <span className="text-lg font-black text-rose-700">- ${metricas.actual.egresosDirectos.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-5 bg-indigo-50/50 rounded-[1.5rem] border border-indigo-100">
                                        <span className="text-xs font-black uppercase text-indigo-700 tracking-wide">Nómina Operativa</span>
                                        <span className="text-lg font-black text-indigo-700">- ${metricas.nominaAplicable.toFixed(2)}</span>
                                    </div>
                                    {viewMode === 'GENERAL' && (
                                        <>
                                            <div className="flex justify-between items-center p-5 bg-orange-50/50 rounded-[1.5rem] border border-orange-100">
                                                <span className="text-xs font-black uppercase text-orange-700 tracking-wide">Gastos Fijos</span>
                                                <span className="text-lg font-black text-orange-700">- ${metricas.fijosAplicables.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-5 bg-purple-50/50 rounded-[1.5rem] border border-purple-100">
                                                <span className="text-xs font-black uppercase text-purple-700 tracking-wide">Nómina Diseño</span>
                                                <span className="text-lg font-black text-purple-700">- ${metricas.actual.gastosDiseno.toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>

      {/* --- MODAL DETALLE DE GRÁFICO --- */}
      <AnimatePresence>
        {dayDetail && (
            <Dialog open={!!dayDetail} onOpenChange={(o) => !o && setDayDetail(null)}>
                <DialogContent className="w-[95vw] max-w-xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] shadow-2xl overflow-hidden">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8">
                        <DialogHeader>
                            <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-white/5">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-[1.5rem] text-blue-600 mb-4">
                                    <CalendarDays size={32}/>
                                </div>
                                <DialogTitle className="text-2xl font-black uppercase italic text-slate-900 dark:text-white">
                                    {dayDetail.date.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric' })}
                                </DialogTitle>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {dayDetail.date.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </DialogHeader>

                        <div className="mt-8 space-y-8">
                            {/* SECCIÓN INGRESOS */}
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-4 flex items-center gap-2">
                                    <ArrowDownLeft size={16}/> Ingresos ({dayDetail.ingresos.length})
                                </h4>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                    {dayDetail.ingresos.length > 0 ? dayDetail.ingresos.map((item, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => item.orden && (setSelectedOrder(item.orden), setIsDetailModalOpen(true))}
                                            className={cn(
                                                "flex justify-between items-center p-4 bg-emerald-50/40 rounded-2xl transition-all border border-transparent",
                                                item.orden ? "hover:bg-emerald-100/50 cursor-pointer hover:border-emerald-200 hover:shadow-sm" : "hover:bg-emerald-50"
                                            )}
                                        >
                                            <div className="flex flex-col max-w-[70%]">
                                                <span className="text-sm font-bold text-slate-700 truncate">{item.descripcion}</span>
                                                {item.orden && (
                                                    <span className="text-[9px] font-black text-emerald-600/70 uppercase flex items-center gap-1 mt-0.5">
                                                        <Eye size={10} /> Ver Orden
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm font-black text-emerald-600 whitespace-nowrap">+${item.monto.toLocaleString()}</span>
                                        </div>
                                    )) : <div className="p-4 text-center text-xs font-bold text-slate-300 uppercase bg-slate-50 rounded-2xl">Sin movimientos</div>}
                                </div>
                            </div>

                            {/* SECCIÓN GASTOS */}
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-4 flex items-center gap-2">
                                    <ArrowUpRight size={16}/> Gastos ({dayDetail.egresos.length})
                                </h4>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                    {dayDetail.egresos.length > 0 ? dayDetail.egresos.map((item, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => item.orden && (setSelectedOrder(item.orden), setIsDetailModalOpen(true))}
                                            className={cn(
                                                "flex justify-between items-center p-4 bg-rose-50/40 rounded-2xl transition-all border border-transparent",
                                                item.orden ? "hover:bg-rose-100/50 cursor-pointer hover:border-rose-200 hover:shadow-sm" : "hover:bg-rose-50"
                                            )}
                                        >
                                            <div className="flex flex-col max-w-[70%]">
                                                <span className="text-sm font-bold text-slate-700 truncate">{item.descripcion}</span>
                                                {item.orden && (
                                                    <span className="text-[9px] font-black text-rose-600/70 uppercase flex items-center gap-1 mt-0.5">
                                                        <Eye size={10} /> Ver Diseño
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm font-black text-rose-600 whitespace-nowrap">-${item.monto.toLocaleString()}</span>
                                        </div>
                                    )) : <div className="p-4 text-center text-xs font-bold text-slate-300 uppercase bg-slate-50 rounded-2xl">Sin movimientos</div>}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>

      {/* --- MODAL NUEVO: DETALLE DE MATERIAL --- */}
      <AnimatePresence>
        {selectedMaterialDetail && (
            <Dialog open={!!selectedMaterialDetail} onOpenChange={(o) => !o && setSelectedMaterialDetail(null)}>
                <DialogContent className="w-[95vw] max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] shadow-2xl overflow-hidden">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8">
                        <DialogHeader>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Reporte de Material</p>
                                    <DialogTitle className="text-3xl font-black uppercase italic text-slate-900 dark:text-white leading-none">
                                        {selectedMaterialDetail.label}
                                    </DialogTitle>
                                </div>
                                <div className="text-right bg-blue-50 px-4 py-2 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">Total Generado</p>
                                    <p className="text-2xl font-black text-blue-600 tracking-tighter">${selectedMaterialDetail.revenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                            {selectedMaterialDetail.details?.map((det: any, idx: number) => (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all"
                                >
                                    <div className="mb-3 sm:mb-0 flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500">#{det.ordenNumero}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(det.fecha).toLocaleDateString()}</span>
                                            <span className="text-[10px] font-bold text-slate-400">• {det.cliente}</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">{det.descripcion}</p>
                                        <div className="flex gap-4 mt-1">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">Cant: {det.cantidad}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-lg font-black text-emerald-600">${det.monto.toLocaleString()}</span>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            onClick={() => { setSelectedOrder(det.ordenData); setIsDetailModalOpen(true); }}
                                            className="rounded-xl h-10 px-3 text-[10px] uppercase font-black hover:bg-slate-900 hover:text-white transition-colors"
                                        >
                                            <Eye size={14} />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                            {(!selectedMaterialDetail.details || selectedMaterialDetail.details.length === 0) && (
                                <div className="text-center py-10 text-slate-400 text-xs font-bold uppercase">No se encontraron detalles</div>
                            )}
                        </div>
                    </motion.div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>

      {/* --- MODAL DETALLE DE DEUDA POR CLIENTE --- */}
      <AnimatePresence>
        {selectedClientDebt && (
            <Dialog open={!!selectedClientDebt} onOpenChange={(o) => !o && setSelectedClientDebt(null)}>
                <DialogContent className="w-[95vw] max-w-2xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] shadow-2xl overflow-hidden">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8">
                        <DialogHeader>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Cliente</p>
                                    <DialogTitle className="text-3xl font-black uppercase italic text-slate-900 dark:text-white leading-none">
                                        {selectedClientDebt.nombreCliente}
                                    </DialogTitle>
                                </div>
                                <div className="text-right bg-rose-50 px-4 py-2 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1">Total Pendiente</p>
                                    <p className="text-2xl font-black text-rose-600 tracking-tighter">${selectedClientDebt.montoTotal.toLocaleString()}</p>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="mt-4 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                            {selectedClientDebt.ordenes.map((orden: any, idx: number) => (
                                <motion.div 
                                    key={orden.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all"
                                >
                                    <div className="mb-3 sm:mb-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500">#{orden.ordenNumero}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(orden.fecha).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-600">
                                            Deuda: <span className="text-rose-600 font-black">${orden.deudaEspecifica.toLocaleString()}</span>
                                        </p>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => { setSelectedOrder(orden); setIsDetailModalOpen(true); }}
                                        className="rounded-xl h-10 px-5 text-[10px] uppercase font-black gap-2 hover:bg-slate-900 hover:text-white transition-colors"
                                    >
                                        <Eye size={14} /> Ver Orden
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </DialogContent>
            </Dialog>
        )}
      </AnimatePresence>

      {/* --- MODAL DETALLE DE ORDEN (EXISTENTE) --- */}
      <OrderDetailModal 
        open={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)} 
        orden={selectedOrder}
        rates={rates || { usd: 1, eur: 1, usdt: 1 }} 
      />

    </motion.div>
  )
}

function StatCard({ label, value, trend, icon, color, sub, highlight, onClick }: any) {
    const colors: any = {
        emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        rose: "text-rose-600 bg-rose-50 dark:bg-rose-900/20",
        indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
        orange: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
    }

    return (
        <motion.div 
            whileHover={hoverEffect}
            whileTap={tapEffect}
            variants={itemVariants}
            onClick={onClick}
            className={cn(
                "p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] shadow-sm border border-black/5 relative overflow-hidden group transition-all cursor-pointer hover:shadow-xl",
                highlight && "ring-2 ring-indigo-500/20 shadow-indigo-500/10"
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl", colors[color])}>{icon}</div>
                {trend !== 0 && (
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black", trend > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                        {trend > 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                        {Math.abs(trend).toFixed(1)}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
                    ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
                <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wide opacity-60">{sub}</p>
            </div>
        </motion.div>
    )
}

function TabButton({ active, onClick, icon, label, color = "slate" }: any) {
    const activeClass = color === 'blue' ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-md" : 
                        color === 'orange' ? "bg-white dark:bg-zinc-700 text-orange-600 shadow-md" :
                        "bg-white dark:bg-zinc-700 text-slate-900 shadow-md";
    
    return (
        <motion.button 
            whileTap={tapEffect}
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex-1 sm:flex-none justify-center",
                active ? activeClass : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800"
            )}
        >
            {icon} <span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.slice(0,3)}</span>
        </motion.button>
    )
}