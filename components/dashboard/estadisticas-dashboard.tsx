// @/components/orden/estadisticas-dashboard.tsx
"use client"

import React, { useMemo, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Zap, Timer, FileDown, Loader2, Palette
} from "lucide-react"
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

import type { GastoInsumo, GastoFijo, Empleado, PagoEmpleado, Cobranza } from "@/lib/types/gastos"
import { cn } from "@/lib/utils"

// --- VARIANTES DE ANIMACIÓN ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

const hoverEffect = {
  y: -4,
  scale: 1.01,
  transition: { type: "spring", stiffness: 300, damping: 15 }
};

const tapEffect = { scale: 0.96 };

interface EstadisticasDashboardProps {
  gastosInsumos: GastoInsumo[]
  gastosFijos: GastoFijo[]
  empleados: Empleado[]
  pagosEmpleados: PagoEmpleado[]
  cobranzas: Cobranza[]
  clientes: any[]
  ordenes: any[]
}

type ViewMode = 'GENERAL' | 'IMPRESION' | 'CORTE';
type DetailType = 'INGRESOS' | 'EGRESOS' | 'UTILIDAD' | 'DEUDA' | 'MATERIALES' | null;

// --- HELPERS ---
const identificarServicio = (item: any) => {
    const tipo = (item.tipoServicio || '').toUpperCase();
    const nombre = (item.nombre || item.descripcion || '').toLowerCase();

    if (tipo === 'DISENO' || tipo === 'DISEÑO') return 'DISENO'; // Identificación explícita
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

export function EstadisticasDashboard({
  gastosInsumos, gastosFijos, empleados, pagosEmpleados, cobranzas, clientes, ordenes
}: EstadisticasDashboardProps) {

  const [viewMode, setViewMode] = useState<ViewMode>('GENERAL');
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [selectedDetail, setSelectedDetail] = useState<DetailType>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

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
          let vinilCount = 0; let vinilRevenue = 0;
          let bannerCount = 0; let bannerRevenue = 0;
          let minutosTotales = 0;
          let mdfCount = 0; let mdfRevenue = 0;
          let acrilicoCount = 0; let acrilicoRevenue = 0;

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
                      if (nombreLower.includes('vinil') || nombreLower.includes('sticker')) {
                          vinilCount += qty; vinilRevenue += subtotal;
                      } else if (nombreLower.includes('banner') || nombreLower.includes('lona')) {
                          bannerCount += qty; bannerRevenue += subtotal;
                      }
                  }
                  if (servicio === 'CORTE') {
                      const minutosItem = (item.tiempo ? parseFloat(item.tiempo) : qty);
                      minutosTotales += minutosItem;
                      if (nombreLower.includes('mdf') || nombreLower.includes('madera')) {
                          mdfCount += qty; mdfRevenue += subtotal;
                      } else if (nombreLower.includes('acrilico') || nombreLower.includes('acr')) {
                          acrilicoCount += qty; acrilicoRevenue += subtotal;
                      }
                  }
              });
          });
          return { m2Totales, vinilCount, vinilRevenue, bannerCount, bannerRevenue, minutosTotales, mdfCount, mdfRevenue, acrilicoCount, acrilicoRevenue };
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
        
        // INGRESOS (Cobranzas)
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

        // CONTEO DE ORDENES
        ordenes.filter(o => {
            const f = new Date(o.fecha);
            return f >= inicio && f <= fin && o.estado !== 'ANULADO';
        }).forEach(o => {
            const props = orderBreakdown.get(o.id);
            if (viewMode === 'GENERAL') ordenesCount++;
            else if (viewMode === 'IMPRESION' && (props?.pctImp || 0) > 0.01) ordenesCount++;
            else if (viewMode === 'CORTE' && (props?.pctCorte || 0) > 0.01) ordenesCount++;
        });

        // GASTOS INSUMOS (Directos)
        const keywordsImp = ['tinta', 'vinil', 'lona', 'banner', 'papel', 'impresion', 'microperforado', 'ojales', 'laminacion', 'laminado', 'esmerilado'];
        const keywordsCorte = ['mdf', 'acrilico', 'acr', 'madera', 'laser', 'corte', 'pintura', 'thinner', 'balsa', 'plywood'];
        (gastosInsumos || []).filter(g => {
            const f = new Date(g.fecha);
            return f >= inicio && f <= fin;
        }).forEach(g => {
            const areaExplicita = (g as any).area; 
            const texto = ((g as any).nombre || g.descripcion || (g as any).concepto || "" + ' ' + (g.categoria || '')).toLowerCase();
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
            if (relevante) egresosDirectos += (Number(g.monto) || 0);
        });

        // --- CÁLCULO DE NÓMINA DE DISEÑO (NUEVO) ---
        // Se extrae directamente de las órdenes que tienen items de diseño marcados como pagados
        let gastosDiseno = 0;
        if (viewMode === 'GENERAL') { // Solo calculamos diseño en vista General por ahora
             ordenes.forEach(o => {
                (o.items || []).forEach((item: any) => {
                    // Verificamos si es diseño y si está pagado
                    const tipo = identificarServicio(item);
                    const isPaid = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                    
                    if (tipo === 'DISENO' && isPaid) {
                        // Usamos la fecha de pago si existe, sino la de la orden como fallback seguro
                        const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                        if (fechaPago >= inicio && fechaPago <= fin) {
                             gastosDiseno += (Number(item.precioUnitario) || 0) * (Number(item.cantidad) || 1);
                        }
                    }
                });
             });
        }

        return { ingresos, egresosDirectos, ordenesCount, gastosDiseno };
    };

    const actual = calcularRango(fechas.inicio, fechas.fin);
    const anterior = calcularRango(fechas.inicioPrev, fechas.finPrev);

    // GASTOS FIJOS
    const totalFijosRaw = gastosFijos?.reduce((s, g) => s + (Number(g.monto) || 0), 0) || 0;
    const fijosAplicables = viewMode === 'GENERAL' ? totalFijosRaw : 0; 

    // NÓMINA EMPLEADOS (Regular)
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
    
    // EGRESOS TOTALES: Insumos + Fijos + Nómina Regular + Nómina Diseño
    const egresosOperativos = fijosAplicables + nominaAplicable + actual.gastosDiseno;
    const egresosTotales = actual.egresosDirectos + egresosOperativos;
    
    const utilidadNeta = actual.ingresos - egresosTotales;
    const margenGanancia = actual.ingresos > 0 ? (utilidadNeta / actual.ingresos) * 100 : 0;
    
    // KPIs varios
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
          }
      });
      const listaDeudores = Array.from(ordenes.filter(o => {
          const deuda = (o.totalUSD || 0) - (o.montoPagadoUSD || 0);
          return deuda > 0.01 && o.estado !== 'ANULADO';
      }).reduce((acc, o) => {
          const nombre = o.cliente?.nombreRazonSocial || 'Cliente Desconocido';
          const deudaReal = (o.totalUSD || 0) - (o.montoPagadoUSD || 0);
          const props = orderBreakdown.get(o.id) || { pctImp: 0, pctCorte: 0, pctOtros: 0 };
          let deudaApp = 0;
          if (viewMode === 'GENERAL') deudaApp = deudaReal;
          else if (viewMode === 'IMPRESION') deudaApp = deudaReal * props.pctImp;
          else if (viewMode === 'CORTE') deudaApp = deudaReal * props.pctCorte;
          if(deudaApp > 0) acc.set(nombre, (acc.get(nombre) || 0) + deudaApp);
          return acc;
      }, new Map<string, number>()).entries()).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto);
      return { totalDeuda, deudaCorriente, deudaCritica, topDeudores: listaDeudores };
  }, [ordenes, viewMode, orderBreakdown]);

  // --- 7. GRÁFICOS ---
  const chartData = useMemo(() => {
    const map = new Map();
    const daysInMonth = new Date(fechas.fin.getFullYear(), fechas.fin.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        map.set(i, { day: i, ingresos: 0, gastos: 0 });
    }
    cobranzas?.filter(c => {
        const f = new Date(c.fecha || '');
        return c.estado === 'pagado' && f >= fechas.inicio && f <= fechas.fin;
    }).forEach(c => {
        const dia = new Date(c.fecha || '').getDate();
        const props = orderBreakdown.get(c.id);
        let monto = Number(c.montoUSD) || 0;
        if (viewMode === 'IMPRESION') monto *= (props?.pctImp || 0);
        if (viewMode === 'CORTE') monto *= (props?.pctCorte || 0);
        if (map.has(dia)) map.get(dia).ingresos += monto;
    });
    (gastosInsumos || []).filter(g => {
        const f = new Date(g.fecha);
        return f >= fechas.inicio && f <= fechas.fin;
    }).forEach(g => {
        const dia = new Date(g.fecha).getDate();
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

        if (relevante && map.has(dia)) map.get(dia).gastos += (Number(g.monto) || 0);
    });
    return Array.from(map.values());
  }, [fechas, viewMode, cobranzas, gastosInsumos, orderBreakdown]);

  const cambiarMes = (dir: 'prev' | 'next') => {
      const nueva = new Date(fechaReferencia);
      nueva.setMonth(nueva.getMonth() + (dir === 'next' ? 1 : -1));
      setFechaReferencia(nueva);
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
          
          // ITEMS DE DISEÑO PARA MODAL
          const disenoItems: any[] = [];
          if (viewMode === 'GENERAL') {
               ordenes.forEach(o => {
                  (o.items || []).forEach((item: any) => {
                      const tipo = identificarServicio(item);
                      const isPaid = (item.designPaymentStatus === 'PAGADO' || !!item.paymentReference);
                      if (tipo === 'DISENO' && isPaid) {
                          const fechaPago = item.paymentDate ? new Date(item.paymentDate) : new Date(o.fecha);
                          if (fechaPago >= fechas.inicio && fechaPago <= fechas.fin) {
                               disenoItems.push({
                                   nombre: item.empleadoAsignado || 'Sin Asignar',
                                   descripcion: `Orden #${o.ordenNumero} - ${item.nombre}`,
                                   fecha: fechaPago,
                                   monto: (Number(item.precioUnitario) || 0) * (Number(item.cantidad) || 1)
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
      className="space-y-8 p-2 font-sans pb-24 text-slate-800 dark:text-slate-100"
      ref={dashboardRef}
    >
      
      {/* HEADER DE CONTROL */}
      <motion.div variants={itemVariants} className="flex flex-col xl:flex-row justify-between items-center gap-6 bg-white dark:bg-[#1c1c1e] p-5 rounded-[2.5rem] shadow-sm border border-black/5 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-4">
            <motion.div whileHover={{ rotate: 360, transition: { duration: 0.5 } }} className="p-3 bg-slate-100 dark:bg-white/5 rounded-2xl">
                <BarChart3 className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </motion.div>
            <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter">
                    {viewMode === 'GENERAL' ? 'Visión General' : `División ${viewMode}`}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Reporte Mensual de Gestión
                </p>
            </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-black/20 p-2 rounded-2xl border border-black/5">
                <motion.button whileTap={tapEffect} onClick={() => cambiarMes('prev')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 transition-colors shadow-sm"><ChevronLeft size={18}/></motion.button>
                <div className="px-4 text-center min-w-[120px]">
                    <span className="block text-xs font-black uppercase tracking-widest text-slate-400">Periodo</span>
                    <span className="block text-sm font-bold uppercase">{fechaReferencia.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}</span>
                </div>
                <motion.button whileTap={tapEffect} onClick={() => cambiarMes('next')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-white/5 hover:bg-slate-200 transition-colors shadow-sm"><ChevronRight size={18}/></motion.button>
            </div>

            <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={tapEffect}
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
                {isGeneratingPdf ? <Loader2 className="animate-spin w-4 h-4"/> : <FileDown className="w-4 h-4" />}
                {isGeneratingPdf ? "Generando..." : "Reporte"}
            </motion.button>
        </div>

        <div className="flex bg-slate-100 dark:bg-black/20 p-1.5 rounded-2xl gap-1">
            <TabButton active={viewMode === 'GENERAL'} onClick={() => setViewMode('GENERAL')} icon={<LayoutGrid size={14}/>} label="General" />
            <TabButton active={viewMode === 'IMPRESION'} onClick={() => setViewMode('IMPRESION')} icon={<Printer size={14}/>} label="Impresión" color="blue" />
            <TabButton active={viewMode === 'CORTE'} onClick={() => setViewMode('CORTE')} icon={<Scissors size={14}/>} label="Corte" color="orange" />
        </div>
      </motion.div>

      {/* SECCIÓN IMPRESIÓN */}
      <AnimatePresence mode="wait">
        {viewMode === 'IMPRESION' && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
            >
                {/* FORZAMOS VISIBILIDAD CON ANIMATE="VISIBLE" */}
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
                        <p className="text-4xl font-black tracking-tighter">{productionMetrics.actual.m2Totales.toFixed(2)} <span className="text-lg opacity-60">m²</span></p>
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
                    className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2.5rem] shadow-sm border border-black/5 flex flex-col justify-between"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl"><ImageIcon size={20} className="text-slate-500"/></div>
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Desglose Materiales</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Vinil</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{productionMetrics.actual.vinilCount} <span className="text-[10px] opacity-50">unids</span></p>
                            <p className="text-xs font-bold text-emerald-600">${productionMetrics.actual.vinilRevenue.toFixed(0)}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Banner/Lona</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{productionMetrics.actual.bannerCount} <span className="text-[10px] opacity-50">unids</span></p>
                            <p className="text-xs font-bold text-emerald-600">${productionMetrics.actual.bannerRevenue.toFixed(0)}</p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* SECCIÓN CORTE LÁSER */}
      <AnimatePresence mode="wait">
        {viewMode === 'CORTE' && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
            >
                {/* FORZAMOS VISIBILIDAD CON ANIMATE="VISIBLE" */}
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
                        <p className="text-4xl font-black tracking-tighter">{productionMetrics.actual.minutosTotales.toFixed(0)} <span className="text-lg opacity-60">min</span></p>
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
                    className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2.5rem] shadow-sm border border-black/5 flex flex-col justify-between"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl"><Layers size={20} className="text-slate-500"/></div>
                        <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Desglose Materiales</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20">
                            <p className="text-[10px] font-black text-slate-400 uppercase">MDF</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{productionMetrics.actual.mdfCount} <span className="text-[10px] opacity-50">unids</span></p>
                            <p className="text-xs font-bold text-emerald-600">${productionMetrics.actual.mdfRevenue.toFixed(0)}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/20">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Acrílico</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">{productionMetrics.actual.acrilicoCount} <span className="text-[10px] opacity-50">unids</span></p>
                            <p className="text-xs font-bold text-emerald-600">${productionMetrics.actual.acrilicoRevenue.toFixed(0)}</p>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* KPI PRINCIPALES */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <h3 className="text-3xl font-black italic tracking-tighter">{metricas.puntoEquilibrioPct.toFixed(0)}%</h3>
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
            <Card className="p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col justify-between h-full">
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
            <Card className="p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm relative overflow-hidden h-full">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase italic flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-slate-400"/> Flujo Diario
                    </h3>
                    <div className="flex gap-4 text-[10px] font-black uppercase">
                        <span className="flex items-center gap-1 text-emerald-500"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Ingresos</span>
                        <span className="flex items-center gap-1 text-rose-500"><div className="w-2 h-2 rounded-full bg-rose-500"/> Gastos Directos</span>
                    </div>
                </div>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} dy={10} />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                            <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
          </motion.div>
      </motion.div>

      {/* DEUDA */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} whileHover={hoverEffect}>
            <Card className="p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col relative overflow-hidden h-full">
                <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400"/> Antigüedad de Deuda
                </h3>
                <div className="flex gap-4">
                    <div className="flex-1 p-4 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Corriente (&lt;30d)</p>
                        <p className="text-2xl font-black text-slate-700 dark:text-white">${analisisDeuda.deudaCorriente.toLocaleString()}</p>
                        <div className="h-1.5 w-full bg-slate-200 mt-3 rounded-full overflow-hidden">
                            <motion.div initial={{width:0}} animate={{width: `${(analisisDeuda.deudaCorriente / (analisisDeuda.totalDeuda || 1)) * 100}%`}} className="h-full bg-blue-500 rounded-full" />
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-900/20">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Crítica (&gt;30d)</p>
                            <ShieldAlert className="w-3 h-3 text-rose-500" />
                        </div>
                        <p className="text-2xl font-black text-rose-600">${analisisDeuda.deudaCritica.toLocaleString()}</p>
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

          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="p-8 rounded-[3rem] border-0 bg-white dark:bg-[#1c1c1e] shadow-sm flex flex-col h-full">
                <h3 className="text-lg font-black uppercase italic mb-6 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-slate-400"/> Cartera de Deudores {viewMode !== 'GENERAL' && `(${viewMode})`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 max-h-[200px] custom-scrollbar">
                    {analisisDeuda.topDeudores.length > 0 ? analisisDeuda.topDeudores.slice(0, 6).map((d, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-black/20 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center font-black text-xs text-slate-500 shadow-sm shrink-0">
                                    {idx + 1}
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{d.nombre}</span>
                            </div>
                            <span className="text-sm font-black text-rose-500">${d.monto.toLocaleString()}</span>
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
                <DialogContent className="max-w-4xl p-0 border-none bg-white dark:bg-[#1c1c1e] rounded-[3rem] shadow-2xl overflow-hidden">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="p-8 pb-0"
                    >
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                                {selectedDetail === 'INGRESOS' && <TrendingUp className="text-emerald-500"/>}
                                {selectedDetail === 'EGRESOS' && <Wallet className="text-rose-500"/>}
                                {selectedDetail === 'UTILIDAD' && <DollarSign className="text-indigo-500"/>}
                                {selectedDetail === 'DEUDA' && <AlertCircle className="text-orange-500"/>}
                                Detalle de {selectedDetail?.toLowerCase()}
                            </DialogTitle>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                                {viewMode} &bull; {fechaReferencia.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}
                            </p>
                        </DialogHeader>
                    </motion.div>

                    <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {selectedDetail === 'EGRESOS' && (
                            <Tabs defaultValue="insumos" className="w-full">
                                <TabsList className={`grid w-full mb-6 bg-slate-100 p-1 rounded-[1.5rem] ${viewMode === 'GENERAL' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                                    <TabsTrigger value="insumos" className="rounded-2xl font-bold uppercase text-[10px]">
                                        Insumos (${(modalData as any)?.insumos?.reduce((a:any,b:any)=>a+Number(b.monto),0).toFixed(0)})
                                    </TabsTrigger>
                                    {viewMode === 'GENERAL' && (
                                        <>
                                            <TabsTrigger value="fijos" className="rounded-2xl font-bold uppercase text-[10px]">
                                                Fijos (${(modalData as any)?.fijos?.reduce((a:any,b:any)=>a+Number(b.monto),0).toFixed(0)})
                                            </TabsTrigger>
                                            <TabsTrigger value="diseno" className="rounded-2xl font-bold uppercase text-[10px]">
                                                Diseño (${(modalData as any)?.disenoItems?.reduce((a:any,b:any)=>a+Number(b.monto),0).toFixed(0)})
                                            </TabsTrigger>
                                        </>
                                    )}
                                    <TabsTrigger value="nomina" className="rounded-2xl font-bold uppercase text-[10px]">
                                        Nómina (${(modalData as any)?.nomina?.reduce((a:any,b:any)=>a+Number(b.totalUSD),0).toFixed(0)})
                                    </TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="insumos" className="space-y-3">
                                    {(modalData as any)?.insumos?.map((item:any, i:number) => (
                                        <motion.div 
                                            key={i} 
                                            initial={{ opacity: 0, x: -10 }} 
                                            animate={{ opacity: 1, x: 0 }} 
                                            transition={{ delay: i * 0.05 }}
                                            className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Package size={16} className="text-blue-500"/>
                                                <div>
                                                    <p className="text-xs font-bold uppercase">{item.descripcion || item.nombre}</p>
                                                    <p className="text-[9px] text-slate-400">{new Date(item.fecha).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="font-black text-sm">${item.monto}</span>
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
                                                    className="flex justify-between items-center p-3 bg-orange-50/50 rounded-2xl"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Building2 size={16} className="text-orange-500"/>
                                                        <p className="text-xs font-bold uppercase">{item.nombre}</p>
                                                    </div>
                                                    <span className="font-black text-sm">${item.monto}</span>
                                                </motion.div>
                                            ))}
                                        </TabsContent>
                                        <TabsContent value="diseno" className="space-y-3">
                                            {(modalData as any)?.disenoItems?.map((item:any, i:number) => (
                                                <motion.div 
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex justify-between items-center p-3 bg-purple-50/50 rounded-2xl"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Palette size={16} className="text-purple-500"/>
                                                        <div>
                                                            <p className="text-xs font-bold uppercase">{item.nombre}</p>
                                                            <p className="text-[9px] text-slate-400">{item.descripcion}</p>
                                                            <p className="text-[9px] text-slate-400">{new Date(item.fecha).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-black text-sm">${item.monto.toFixed(2)}</span>
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
                                            className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-2xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <UserCheck size={16} className="text-indigo-500"/>
                                                <div>
                                                    <p className="text-xs font-bold uppercase">{item.nombre}</p>
                                                    <p className="text-[9px] text-slate-400">{new Date(item.fechaPago || item.fecha).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="font-black text-sm">${item.totalUSD}</span>
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
                                        className="flex justify-between items-center p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl hover:bg-emerald-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-xs">{i+1}</div>
                                            <div>
                                                <p className="text-xs font-black uppercase text-slate-700">{c.nombreCliente}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[9px] text-slate-400 font-bold">{new Date(c.fecha).toLocaleDateString()}</p>
                                                    {c.esRecurrente && (
                                                        <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                                            CLIENTE RECURRENTE
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-emerald-600 block">+${c.montoRelevante?.toFixed(2)}</span>
                                            {viewMode !== 'GENERAL' && (
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">
                                                    ({c.porcentaje.toFixed(0)}% de ${c.montoTotal})
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
                                    className="text-center py-6 bg-slate-50 rounded-[2rem]"
                                >
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Resultado Neto del Periodo</p>
                                    <div className={cn("text-6xl font-black tracking-tighter mb-2", metricas.utilidadNeta >= 0 ? "text-indigo-600" : "text-red-500")}>
                                        ${metricas.utilidadNeta.toFixed(2)}
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 bg-white border border-slate-100 inline-block px-4 py-1.5 rounded-full shadow-sm">
                                        Margen de Ganancia: <span className={metricas.margenGanancia >= 0 ? "text-emerald-500" : "text-red-500"}>{metricas.margenGanancia.toFixed(1)}%</span>
                                    </p>
                                </motion.div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Desglose de la Operación</p>
                                    <div className="flex justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                        <span className="text-xs font-black uppercase text-emerald-700">Ingresos Totales</span>
                                        <span className="font-black text-emerald-700">+ ${metricas.actual.ingresos.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                                        <span className="text-xs font-black uppercase text-rose-700">Insumos & Materiales</span>
                                        <span className="font-black text-rose-700">- ${metricas.actual.egresosDirectos.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                        <span className="text-xs font-black uppercase text-indigo-700">Nómina Operativa</span>
                                        <span className="font-black text-indigo-700">- ${metricas.nominaAplicable.toFixed(2)}</span>
                                    </div>
                                    {viewMode === 'GENERAL' && (
                                        <>
                                            <div className="flex justify-between items-center p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                                <span className="text-xs font-black uppercase text-orange-700">Gastos Fijos</span>
                                                <span className="font-black text-orange-700">- ${metricas.fijosAplicables.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                                                <span className="text-xs font-black uppercase text-purple-700">Nómina Diseño</span>
                                                <span className="font-black text-purple-700">- ${metricas.actual.gastosDiseno.toFixed(2)}</span>
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
                "p-6 rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] shadow-sm border border-black/5 relative overflow-hidden group transition-all cursor-pointer hover:shadow-xl",
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
                <p className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">
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
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all",
                active ? activeClass : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800"
            )}
        >
            {icon} {label}
        </motion.button>
    )
}