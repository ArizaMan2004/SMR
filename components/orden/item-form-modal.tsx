// @/components/orden/item-form-modal.tsx
"use client"

import { MuestraMaterial } from "@/components/taller/MuestraMaterial"
import * as React from "react"
import { useState, useEffect, useMemo } from "react" 
import { motion, AnimatePresence } from "framer-motion"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import {
    X, Scissors, Hash, DollarSign, Box, Type,
    User, Calculator, Layers, Palette, MoveVertical, AlertCircle, Clock, Printer,
    BookOpen, ChevronDown, ChevronUp
} from "lucide-react"

import {
    subscribeToCatalogoProducts, subscribeToCatalogoCategories, areaDeProducto,
    precioDeServicio, acabadosActivos, opcionesDe,
    consumoMetroLineal, unidadDe, tipoEntradaDe,
    type CatalogoCategoria,
} from "@/lib/services/catalog-service"
import { SelectorCatalogo } from "@/components/orden/SelectorCatalogo"
import {
    subscribeToMaterialesTaller, materialesDePegado, materialesDeCorte,
    buscarMaterial, grosoresDe, coloresDe, costoPegado, precioFondoBlancoM2,
    type ConfigMaterialesTaller,
} from "@/lib/services/materiales-taller"

// --- CONSTANTES ---
const PRECIO_LASER_POR_MINUTO = 0.80;
const PERSONAL_TALLER = ["Marcos", "Samuel", "Daniela", "Jose Angel", "Daniel Montero"];

// --- CONSTANTES DE IMPRESIÓN ---
const MATERIALES_IMPRESION = [
    "Banner", "Banner Mate", "Banner Cara Negra",
    "Vinil Brillante", "Vinil Mate", "Clear", "DTF", "Stickers",
    "Vinil Textil", "Vinil Blackout", "Microperforado", "Tornasol", "Esmerilado",
    "Vinil con Corte"
];

// --- FUNCIONES DE VALIDACIÓN ESTRICTA ---
const isBanner = (mat: string) => mat.toLowerCase().includes('banner');
const isSticker = (mat: string) => mat.toLowerCase() === 'stickers';
const isClear = (mat: string) => mat.toLowerCase() === 'clear';
const isVinilPegable = (mat: string) => {
    const v = mat.toLowerCase();
    return (v.includes('vinil') && !v.includes('textil') && !v.includes('corte')) || ['microperforado', 'tornasol', 'esmerilado'].includes(v);
};

const COLORES_PREDEFINIDOS = [
    { value: "Transparente", label: "Transparente", emoji: "💎" },
    { value: "Blanco", label: "Blanco", emoji: "⬜" },
    { value: "Negro", label: "Negro", emoji: "⬛" },
    { value: "Rojo", label: "Rojo", emoji: "🟥" },
    { value: "Dorado", label: "Dorado", emoji: "🪙" },
    { value: "Espejo (Plateado)", label: "Espejo (Plateado)", emoji: "💿" },
];

const getInitialState = () => ({
  nombre: "",
  tipoServicio: "OTROS",
  cantidad: 1,
  unidad: "und",
  precioUnitario: 0,
  monedaItem: 'USD' as 'USD' | 'EUR',   // moneda del precio (EUR para aliados)
  precioMayor: 0,                         // precio al mayor por unidad
  cantidadMayor: 0,                       // cantidad mínima para activar precio al mayor
  modoCobroLaser: "tiempo", 
  materialDeCorte: "Acrilico",
  grosorMaterial: "3mm",
  colorAcrilico: "Transparente",
  nuevoColorCustom: "",
  
  // --- ESTADOS IMPRESIÓN ---
  materialImpresion: "Vinil Brillante",
  impresionConCorte: false,
  
  // --- ESTADOS PEGADO (PVC / Acrilico) ---
  impresionPegado: false,
  tipoPegado: "PVC", // el sustrato rigido: PVC, PVC Rigido, Acrilico...
  grosorPegado: "",
  // Un clear sobre acrilico no se ve si no lleva fondo: el blanco es lo que
  // hace que el color se lea. Es material aparte y se cobra aparte.
  fondoBlancoPegado: false,
  proveedorPegado: "taller", // 'taller' o 'cliente'
  precioPegado: 0,
  
  impresionOjales: false,
  impresionBolsillos: false,
  impresionTubos: false,
  impresionRefilado: false,
  
  // --- ESTADOS LAMINADO ---
  impresionLaminado: false,
  tipoCobroLaminado: "auto", // 'auto' | 'x' | 'y' | 'manual'
  precioLaminadoLineal: 0,
  precioLaminadoManual: 0,

  medidaXCm: 0,
  medidaYCm: 0,
  empleadoAsignado: "N/A", 
  suministrarMaterial: false,
  costoMaterialExtra: 0,
  subtotal: 0,
});

export function ItemFormModal({
    isOpen, onClose, onAddItem, itemToEdit, designers = [],
    customColors = [], onRegisterColor,
    tipoCliente = 'REGULAR',  // 'REGULAR' | 'ALIADO'
    eurRate = 0,              // Bs/EUR para referencia visual
    usdRate = 0,              // Bs/USD para referencia visual
}: any) {
    const esAliado = tipoCliente === 'ALIADO'
  const [state, setState] = useState<any>(getInitialState());
  const [horas, setHoras] = useState('0');
  const [minutos, setMinutos] = useState('0');
  const [segundos, setSegundos] = useState('00');
  const [errors, setErrors] = useState<any>({});

  // --- Catálogo de precios ---
  const [catalogProductos, setCatalogProductos] = useState<any[]>([])

  /** Los materiales del taller: que se corta, que se pega y a como. */
  const [matTaller, setMatTaller] = useState<ConfigMaterialesTaller>({})
  const [catalogCategorias, setCatalogCategorias] = useState<CatalogoCategoria[]>([])
  const [showCatalogPicker, setShowCatalogPicker] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')

  // Material del catálogo seleccionado para IMPRESION
  const [catalogMaterialId, setCatalogMaterialId] = useState<string | null>(null)
  const [catalogVarianteId, setCatalogVarianteId] = useState<string | null>(null)
  // De qué rollo sale: mate, brillante, blackout… No cambia el precio, pero es
  // lo que permite saber después cuál se está gastando más.
  const [catalogAcabadoId, setCatalogAcabadoId] = useState<string | null>(null)
  const [modoMaterialManual, setModoMaterialManual] = useState(false)
  /**
   * A qué material del catálogo se imputa un ítem escrito a mano.
   *
   * El modo manual existe porque siempre hay trabajos que no encajan, y
   * quitarlo obligaría a inventar entradas de catálogo para cada rareza. Pero
   * un ítem sin material no suma en ningún balance: así se llegó a tener un
   * mes entero de banner contado como vinil.
   *
   * Con esto se escribe lo que se quiera en la descripción y aun así se dice
   * de qué rollo salió. Es opcional: si de verdad no corresponde a ningún
   * material, se deja vacío y sale en la lista de pendientes de Auditoría.
   */
  const [manualMaterialId, setManualMaterialId] = useState<string | null>(null)
  /** El producto o servicio elegido en la sección de venta por unidad. */
  const [ventaProductoId, setVentaProductoId] = useState<string | null>(null)

  useEffect(() => {
      const unsub = subscribeToCatalogoProducts(setCatalogProductos)
      return unsub
  }, [])

  useEffect(() => subscribeToCatalogoCategories(setCatalogCategorias), [])
  useEffect(() => subscribeToMaterialesTaller(setMatTaller), [])

  // Los sustratos y sus grosores salen de la configuración, no de una lista
  // escrita aquí: así se puede añadir uno nuevo sin tocar código.
  const sustratosPegado = useMemo(() => materialesDePegado(matTaller), [matTaller])

  // EL CORTE SALE DE LA CONFIGURACION, NO DE UNA LISTA EN EL CODIGO.
  //
  // Antes los sustratos y los grosores estaban escritos aqui dentro, asi que
  // registrar un material en Ajustes no servia de nada: el formulario seguia
  // ofreciendo los cinco de siempre. Y como el PVC ya declara que no se corta,
  // deja de aparecer solo, sin tener que acordarse de quitarlo.
  const sustratosCorte = useMemo(() => materialesDeCorte(matTaller), [matTaller])
  const materialCorte = useMemo(
      () => buscarMaterial(matTaller, state.materialDeCorte),
      [matTaller, state.materialDeCorte]
  )
  const grosoresCorte = useMemo(() => grosoresDe(materialCorte), [materialCorte])
  const coloresCorte = useMemo(() => coloresDe(materialCorte), [materialCorte])

  // El desplegable compara textos tal cual, asi que "Acrilico" y "Acrilico"
  // con tilde son dos cosas distintas y el campo sale vacio aunque el material
  // exista. `buscarMaterial` si los reconoce como el mismo, asi que en cuanto
  // carga la configuracion se escribe el nombre bueno.
  useEffect(() => {
      if (state.tipoServicio !== 'CORTE') return
      if (materialCorte && materialCorte.nombre !== state.materialDeCorte) {
          setState((prev: any) => ({ ...prev, materialDeCorte: materialCorte.nombre }))
      }
  }, [materialCorte, state.materialDeCorte, state.tipoServicio])
  const grosoresPegado = useMemo(
      () => grosoresDe(buscarMaterial(matTaller, state.tipoPegado)),
      [matTaller, state.tipoPegado]
  )

  /**
   * Lo que costaría el montaje según lo configurado.
   *
   * Se propone, no se impone: quien factura puede escribir otro precio y ese
   * manda. Sin precio configurado da cero y no se propone nada, en vez de
   * sugerir un cero que alguien acepte sin mirar.
   */
  const pegadoSugerido = useMemo(() => {
      const x = parseFloat(state.medidaXCm) || 0
      const y = parseFloat(state.medidaYCm) || 0
      const c = parseFloat(state.cantidad) || 1
      const m2 = (x > 0 && y > 0) ? (x / 100) * (y / 100) * c : 0
      return costoPegado(matTaller, {
          material: state.tipoPegado,
          grosor: state.grosorPegado,
          m2,
          fondoBlanco: !!state.fondoBlancoPegado,
      })
  }, [matTaller, state.tipoPegado, state.grosorPegado, state.fondoBlancoPegado, state.medidaXCm, state.medidaYCm, state.cantidad])

  // Reset selección de material cuando cambia tipoServicio
  useEffect(() => {
      setCatalogMaterialId(null)
      setCatalogVarianteId(null)
      setModoMaterialManual(false)
  }, [state.tipoServicio])

  const catalogM2 = useMemo(() =>
      catalogProductos.filter(p => p.activo !== false && p.tipoVenta === 'metro_cuadrado'),
      [catalogProductos]
  )

  const catalogUnidad = useMemo(() => {
      const q = catalogSearch.toLowerCase().trim()
      return catalogProductos
          .filter(p => p.activo !== false && p.tipoVenta !== 'metro_cuadrado')
          .filter(p => !q || p.nombre.toLowerCase().includes(q))
          .slice(0, 12)
  }, [catalogProductos, catalogSearch])

  const catalogFiltrado = useMemo(() => {
      const q = catalogSearch.toLowerCase().trim()
      return catalogProductos
          .filter(p => p.activo !== false)
          .filter(p => !q || p.nombre.toLowerCase().includes(q))
          .slice(0, 12)
  }, [catalogProductos, catalogSearch])

  const materialSeleccionado = useMemo(() =>
      catalogM2.find(p => p.id === catalogMaterialId) ?? null,
      [catalogM2, catalogMaterialId]
  )

  /**
   * Qué extras admite lo que está elegido ahora mismo.
   *
   * Con un material del catálogo mandan sus casillas configuradas. En modo
   * manual no hay material que consultar, así que se siguen usando las reglas
   * de siempre sobre el nombre — es lo único que hay, y quitarlas dejaría el
   * modo manual sin ninguna opción.
   */
  const opcionesActivas = useMemo(() => {
      if (!modoMaterialManual && materialSeleccionado) return opcionesDe(materialSeleccionado)
      const m = state.materialImpresion
      return {
          ojales: isBanner(m),
          bolsillos: isBanner(m),
          tubos: isBanner(m),
          refilado: isBanner(m),
          laminado: isVinilPegable(m) || isClear(m) || isBanner(m),
          pegado: isVinilPegable(m) || isClear(m),
          corteObligatorio: isSticker(m),
          corteOpcional: !isBanner(m) && m !== 'Vinil con Corte',
      }
  }, [modoMaterialManual, materialSeleccionado, state.materialImpresion])

  /**
   * Cuánto laminado consume esta pieza y qué habría que cobrar.
   *
   * El rollo tiene un ancho fijo y se corta a lo largo: la pieza se gira para
   * que su lado corto quepa, y lo que se gasta es el largo. La tira que sobra
   * al lado NO se reaprovecha, así que una pieza estrecha consume lo mismo que
   * una que ocupe todo el ancho. Cobrar solo el área impresa es regalar rollo.
   *
   * El precio que sale de aquí es una recomendación: se puede pisar a mano,
   * porque hay retazos y trabajos donde la cuenta no aplica.
   */
  const laminado = useMemo(() => {
      const mat = catalogProductos.find((p: any) =>
          /laminaci/i.test(p?.nombre || '') && unidadDe(p) === 'metro_lineal')
      const anchoRollo = Number(mat?.anchoBaseCm) || 0
      if (!anchoRollo) return null

      const calc = consumoMetroLineal(anchoRollo, state.medidaXCm, state.medidaYCm, state.cantidad || 1)
      if (calc.metrosLineales <= 0) return null

      const esAliadoLam = esAliado && (mat?.precioPublicista ?? 0) > 0
      const precioML = esAliadoLam ? mat.precioPublicista : (mat?.precioBase || 0)

      return {
          anchoRollo,
          ...calc,
          precioML,
          moneda: esAliadoLam ? '€' : '$',
          costoSugerido: Math.round(calc.metrosLineales * precioML * 100) / 100,
          // Lo que se está imprimiendo, para poder comparar con lo que se gasta.
          m2Impresos: Math.round((state.medidaXCm / 100) * (state.medidaYCm / 100) * (state.cantidad || 1) * 100) / 100,
      }
  }, [catalogProductos, state.medidaXCm, state.medidaYCm, state.cantidad, esAliado])

  /**
   * Elegir del catálogo en la venta por unidad.
   *
   * Aquí se vende una pieza a un precio, sin medidas: llaveros, trofeos,
   * diseño, instalación. Se apunta el producto para que descuente del stock y
   * cuente en las estadísticas, cosa que el buscador anterior no hacía —
   * copiaba el precio y se olvidaba de qué se había vendido.
   */
  const seleccionarProductoVenta = (prod: any) => {
      const usarPublicista = esAliado && (prod.precioPublicista ?? 0) > 0
      const precio = usarPublicista ? prod.precioPublicista : prod.precioBase

      // A que area del taller pertenece esto lo dice el catalogo, no el nombre
      // del renglon. Una medalla es corte entera y un pendon impresion entera,
      // aunque los dos se vendan por unidad.
      const area = areaDeProducto(prod, catalogCategorias)

      setVentaProductoId(prod.id)
      setState((s: any) => ({
          ...s,
          precioUnitario: precio,
          nombre: s.nombre || prod.nombre,
          monedaItem: usarPublicista ? 'EUR' : 'USD',
          unidad: unidadDe(prod) === 'metro_lineal' ? 'ml' : 'und',
          // Se guarda tal cual, incluido 'AMBAS': con eso el balance reparte
          // esta plata en vez de suponer.
          catalogoArea: area,
          tipoServicio: area === 'IMPRESION' ? 'IMPRESION' : area === 'CORTE' ? 'CORTE' : s.tipoServicio,
          catalogoProductoId: prod.id,
          _catalogPrecioBase: prod.precioBase || 0,
          _catalogPrecioPublicista: prod.precioPublicista || 0,
          _catalogVarianteAjuste: 0,
      }))
  }

  const seleccionarMaterialCatalogo = (prod: any, varianteId?: string | null, acabadoId?: string | null) => {
      const variante = varianteId ? prod.variantes?.find((v: any) => v.id === varianteId) : null
      const usarPublicista = esAliado && (prod.precioPublicista ?? 0) > 0

      // El precio lo decide un único sitio, el mismo que usa el catálogo: así
      // el formulario de órdenes y la venta de mostrador no pueden discrepar.
      const precio = precioDeServicio(prod, variante, usarPublicista ? 'publicista' : 'general')
      const moneda: 'USD' | 'EUR' = usarPublicista ? 'EUR' : 'USD'

      // Al cambiar de material el acabado anterior deja de existir; si el nuevo
      // tiene uno solo, se elige solo.
      const acabados = acabadosActivos(prod)
      const acabadoFinal = acabadoId !== undefined
          ? acabadoId
          : (acabados.length === 1 ? acabados[0].id : null)
      const acabado = acabados.find(a => a.id === acabadoFinal)

      // Las opciones del material mandan sobre las casillas del formulario.
      const op = opcionesDe(prod)

      setCatalogMaterialId(prod.id)
      setCatalogVarianteId(varianteId ?? null)
      setCatalogAcabadoId(acabadoFinal)
      setModoMaterialManual(false)
      setState((s: any) => ({
          ...s,
          precioUnitario: precio,
          // El nombre lleva el acabado: es lo que se lee en producción y en el
          // historial, donde no hay desplegables que consultar.
          materialImpresion: acabado ? `${prod.nombre} ${acabado.nombre}` : prod.nombre,
          nombre: s.nombre || prod.nombre,
          monedaItem: moneda,
          impresionConCorte: op.corteObligatorio ? true : (op.corteOpcional ? s.impresionConCorte : false),
          impresionPegado: op.pegado ? s.impresionPegado : false,
          impresionLaminado: op.laminado ? s.impresionLaminado : false,
          impresionOjales: op.ojales ? s.impresionOjales : false,
          impresionBolsillos: op.bolsillos ? s.impresionBolsillos : false,
          impresionTubos: op.tubos ? s.impresionTubos : false,
          // Referencias al catálogo: con esto la orden ya nace sabiendo qué
          // material gastó y no hace falta auditarla después.
          //
          // El área no toca el servicio elegido: este panel es el de impresión
          // y quien está aquí ya dijo lo que hace. Se guarda para que el
          // balance no tenga que deducirla del nombre.
          catalogoArea: areaDeProducto(prod, catalogCategorias),
          catalogoProductoId: prod.id,
          catalogoVarianteId: varianteId ?? null,
          catalogoVarianteNombre: variante?.nombre || null,
          catalogoAcabadoId: acabadoFinal,
          catalogoAcabadoNombre: acabado?.nombre || null,
          _catalogPrecioBase: prod.precioBase || 0,
          _catalogPrecioPublicista: prod.precioPublicista || 0,
          _catalogVarianteAjuste: variante?.precioAjuste || 0,
      }))
  }

  const usarPrecioCatalogo = (prod: any) => {
      const usarPublicista = esAliado && (prod.precioPublicista ?? 0) > 0
      const precio = usarPublicista ? prod.precioPublicista : prod.precioBase
      const moneda: 'USD' | 'EUR' = usarPublicista ? 'EUR' : 'USD'
      setState((s: any) => ({
          ...s,
          precioUnitario: precio,
          nombre: s.nombre || prod.nombre,
          monedaItem: moneda,
          _catalogPrecioBase: prod.precioBase || 0,
          _catalogPrecioPublicista: prod.precioPublicista || 0,
          _catalogVarianteAjuste: 0,
      }))
      setShowCatalogPicker(false)
      setCatalogSearch('')
  }

  // Aqui vivia `allColors`, que juntaba una lista fija con los colores sueltos
  // registrados a mano. Los colores del corte ahora salen del material —cada
  // uno tiene los suyos, con su tono y su familia—, que es lo que evita ofrecer
  // un dorado en un material que no viene en dorado.

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
          if (itemToEdit.unidad === 'tiempo' && itemToEdit.tiempoCorte) {
             const parts = itemToEdit.tiempoCorte.split(':');
             if (parts.length === 3) {
                 setHoras(parts[0] || '0');
                 setMinutos(parts[1] || '0');
                 setSegundos(parts[2] || '00');
             } else {
                 setHoras('0');
                 setMinutos(parts[0] || '0'); 
                 setSegundos(parts[1] || '00');
             }
          }
          setState({ ...getInitialState(), ...itemToEdit, nuevoColorCustom: "" });
      } else {
          setState(getInitialState());
          setHoras('0'); setMinutos('0'); setSegundos('00');
      }
      setErrors({}); 
    }
  }, [isOpen, itemToEdit]);

  // LÓGICA DE CÁLCULO
  useEffect(() => {
    let costoBaseUnitario = 0;
    const {
        cantidad, precioUnitario, precioMayor, cantidadMayor,
        unidad, medidaXCm, medidaYCm, suministrarMaterial,
        costoMaterialExtra, tipoServicio, modoCobroLaser, impresionLaminado,
        tipoCobroLaminado, precioLaminadoLineal, precioLaminadoManual,
        impresionPegado, proveedorPegado, precioPegado
    } = state;

    const cantidadCalculo = cantidad > 0 ? cantidad : 0;

    // Lo que cuesta laminar UNA pieza segun el rollo real. `laminado` cuenta la
    // tirada entera, asi que se divide entre las copias.
    const laminadoPorUnidad = laminado && laminado.costoSugerido > 0
        ? laminado.costoSugerido / (state.cantidad || 1)
        : 0;

    // Precio efectivo: si aplica precio al mayor, usarlo
    const usaMayor = cantidadMayor > 0 && cantidadCalculo >= cantidadMayor && precioMayor > 0;
    const precioEfectivo = usaMayor ? precioMayor : precioUnitario;

    if (cantidadCalculo > 0 || (modoCobroLaser === 'tiempo' && tipoServicio === 'CORTE')) {
        if (tipoServicio === 'CORTE' && modoCobroLaser === 'tiempo') {
            const h = parseFloat(horas) || 0;
            const m = parseFloat(minutos) || 0;
            const s = parseFloat(segundos) || 0;
            const totalMinutes = (h * 60) + m + (s / 60);
            costoBaseUnitario = totalMinutes * PRECIO_LASER_POR_MINUTO;
        } else if (unidad === 'm2' && medidaXCm > 0 && medidaYCm > 0) {
            costoBaseUnitario = (medidaXCm / 100) * (medidaYCm / 100) * precioEfectivo;

            if (tipoServicio === 'IMPRESION') {
                if (impresionLaminado) {
                    // Modo automatico: el largo real que se lleva del rollo, ya
                    // con la pieza girada y con las pasadas que hagan falta.
                    // Es por unidad, y `laminado` ya multiplico por la cantidad,
                    // asi que aqui se reparte de vuelta.
                    if (tipoCobroLaminado === 'auto' && laminadoPorUnidad > 0) {
                        costoBaseUnitario += laminadoPorUnidad;
                    } else if (tipoCobroLaminado === 'x' && precioLaminadoLineal > 0) {
                        costoBaseUnitario += (medidaXCm / 100) * precioLaminadoLineal;
                    } else if (tipoCobroLaminado === 'y' && precioLaminadoLineal > 0) {
                        costoBaseUnitario += (medidaYCm / 100) * precioLaminadoLineal;
                    } else if (tipoCobroLaminado === 'manual' && precioLaminadoManual > 0) {
                        costoBaseUnitario += precioLaminadoManual;
                    }
                }
                if (impresionPegado && proveedorPegado === 'taller' && precioPegado > 0) {
                    costoBaseUnitario += precioPegado;
                }
            }
        } else {
            costoBaseUnitario = precioEfectivo;
        }

        const totalUnit = costoBaseUnitario + (suministrarMaterial ? costoMaterialExtra : 0);
        setState((prev: any) => ({ ...prev, subtotal: totalUnit * cantidadCalculo }));
    }
  }, [
      state.cantidad, state.precioUnitario, state.precioMayor, state.cantidadMayor,
      state.unidad, state.medidaXCm, state.medidaYCm,
      horas, minutos, segundos, state.suministrarMaterial, state.costoMaterialExtra,
      state.tipoServicio, state.modoCobroLaser, state.impresionLaminado,
      state.tipoCobroLaminado, state.precioLaminadoLineal, state.precioLaminadoManual,
      state.impresionPegado, state.proveedorPegado, state.precioPegado
  ]);

  const handleSave = async () => {
    const newErrors: any = {};
    let hasError = false;

    if (!state.nombre.trim()) { newErrors.nombre = true; hasError = true; }

    if (state.unidad === 'm2') {
        if (state.medidaXCm <= 0) { newErrors.medidaXCm = true; hasError = true; }
        if (state.medidaYCm <= 0) { newErrors.medidaYCm = true; hasError = true; }
    }

    if (state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo') {
        const tH = parseFloat(horas) || 0;
        const tMin = parseFloat(minutos) || 0;
        const tSec = parseFloat(segundos) || 0;
        if (tH === 0 && tMin === 0 && tSec === 0) {
            newErrors.tiempo = true;
            hasError = true;
        }
    }

    if ((state.cantidad || 0) <= 0) { newErrors.cantidad = true; hasError = true; }

    setErrors(newErrors);
    if (hasError) return;

    let colorFinal = state.colorAcrilico;

    if (state.colorAcrilico === 'NEW' && state.nuevoColorCustom.trim() !== "") {
        colorFinal = state.nuevoColorCustom.trim();
        if (onRegisterColor) {
            await onRegisterColor({ label: colorFinal, value: colorFinal, emoji: "🎨" });
        }
    }

    const finalUnitPrice = state.unidad === 'm2' 
        ? state.precioUnitario 
        : (state.subtotal / (state.cantidad || 1));

    const hVal = parseInt(horas) || 0;
    const mVal = parseInt(minutos) || 0;
    const sVal = segundos.padStart(2, '0');
    
    const tiempoString = hVal > 0 
        ? `${hVal}:${mVal.toString().padStart(2, '0')}:${sVal}`
        : `${mVal}:${sVal}`;

    let detallesExtras = [];
    if (state.tipoServicio === 'IMPRESION') {
        detallesExtras.push(`Mat: ${state.materialImpresion}`);
        
        // Corte detallado
        if ((state.impresionConCorte || opcionesActivas.corteObligatorio) && opcionesActivas.corteOpcional) {
            detallesExtras.push("Corte");
        }
        
        // Pegado detallado
        if (state.impresionPegado) {
            const prov = state.proveedorPegado === 'taller' ? "(Taller)" : "(Cliente)";
            // El grosor va en el texto: "pegado en PVC" no dice nada al que
            // tiene que cortar la lámina, y en producción no hay desplegables
            // que consultar.
            const grosor = state.grosorPegado ? ` ${state.grosorPegado}` : '';
            detallesExtras.push(`Pegado en ${state.tipoPegado}${grosor} ${prov}`);
            if (state.fondoBlancoPegado) detallesExtras.push("Fondo de vinil blanco");
        }
        
        if (state.impresionOjales) detallesExtras.push("Ojales");
        if (state.impresionBolsillos) detallesExtras.push("Bolsillos");
        if (state.impresionTubos) detallesExtras.push("Tubos");
        if (state.impresionRefilado) detallesExtras.push("Refilado");
        if (state.impresionLaminado) detallesExtras.push("Laminado");
    }

    // De donde sale el material que se apunta: del catalogo si se eligio ahi,
    // del selector de respaldo si se escribio a mano. Si no hay ninguno no se
    // inventa: el renglon sale en la lista de pendientes, que es lo honesto.
    const materialParaAuditoria = state.tipoServicio === 'VENTA'
        ? catalogProductos.find((p: any) => p.id === ventaProductoId)
        : modoMaterialManual
            ? catalogProductos.find((p: any) => p.id === manualMaterialId)
            : materialSeleccionado

    onAddItem({ 
        ...state, 
        cantidad: state.cantidad || 1, 
        colorAcrilico: colorFinal,
        grosorPegado: state.impresionPegado ? (state.grosorPegado || null) : null,
        fondoBlancoPegado: state.impresionPegado ? !!state.fondoBlancoPegado : false,
        materialDetalleCorte: state.tipoServicio === 'CORTE' 
            ? `${state.materialDeCorte} ${state.materialDeCorte === 'Cartulina' ? 'N/A' : state.grosorMaterial} ${colorFinal}`
            : state.tipoServicio === 'IMPRESION' 
            ? detallesExtras.join(" | ")
            : null,
        precioUnitario: finalUnitPrice,
        tiempoCorte: state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo' ? tiempoString : "Servicio",

        // La orden nace sabiendo que material gasto.
        //
        // Esto es lo que hace innecesario auditarla despues: el material sale
        // del catalogo, no de adivinarlo por la descripcion. Solo se rellena
        // cuando se eligio del catalogo; en modo manual no hay material que
        // referenciar y se deja vacio a proposito, para que salga en la lista
        // de pendientes en vez de colarse con un dato inventado.
        ...(materialParaAuditoria ? {
            materialAuditado: {
                nombre: materialParaAuditoria.nombre,
                productoId: materialParaAuditoria.id,
                m2: state.tipoServicio === 'IMPRESION'
                    ? Math.round((state.medidaXCm / 100) * (state.medidaYCm / 100) * (state.cantidad || 1) * 10000) / 10000
                    : 0,
                laminado: !!state.impresionLaminado,
                auditadoEn: new Date().toISOString(),
                origen: 'manual' as const,
            },
        } : {}),
    });
    
    onClose();
  };

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev: any) => ({ ...prev, [field]: false }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl h-auto max-h-[92vh] p-0 border-none bg-white dark:bg-slate-950 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Banner ALIADO */}
        {esAliado && (
            <div className="bg-purple-600 text-white px-6 py-2 flex items-center gap-2 shrink-0">
                <span className="text-sm">⭐</span>
                <p className="text-[9px] font-black uppercase tracking-widest">
                    Cliente Aliado — Precios preferenciales en EUR aplicados automáticamente
                </p>
            </div>
        )}

        <header className="p-6 border-b bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-lg", esAliado ? "bg-purple-600 shadow-purple-500/20" : "bg-blue-600 shadow-blue-500/20")}>
                    <Layers className="w-5 h-5" />
                </div>
                <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Configuración de Ítem</DialogTitle>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {esAliado ? '⭐ Orden Aliado · Precio en EUR' : 'Terminal de Producción'}
                    </p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 hover:bg-red-50 text-red-500"><X /></Button>
        </header>

        <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-5 sm:p-8 space-y-6 sm:space-y-8 pb-12">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                    <div className="md:col-span-8 space-y-1.5">
                        <Label className={cn("text-[10px] font-black uppercase ml-1 transition-colors", errors.nombre ? "text-red-500" : "text-slate-400")}>
                            Descripción {errors.nombre && <span className="text-[8px] ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Campo Obligatorio</span>}
                        </Label>
                        <Input 
                            value={state.nombre} 
                            onChange={e => { setState({...state, nombre: e.target.value}); clearError('nombre'); }}
                            className={cn(
                                "h-12 rounded-xl border-none font-bold text-base transition-all",
                                errors.nombre ? "bg-red-50 text-red-900 placeholder:text-red-300 ring-2 ring-red-500/50" : "bg-slate-100 dark:bg-slate-800"
                            )}
                            placeholder="Ej: Medallas acrílicas / Banner promocional"
                            autoFocus
                        />
                    </div>
                    <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Servicio</Label>
                        <Select value={state.tipoServicio} onValueChange={v => {
                            const updates: any = { tipoServicio: v };
                            if (v === 'IMPRESION') updates.unidad = 'm2';
                            else if (v === 'CORTE') updates.unidad = 'tiempo';
                            else updates.unidad = 'und';
                            setState({...state, ...updates});
                            setErrors({});
                        }}>
                            <SelectTrigger className="h-12 rounded-xl border-none bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-black uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="IMPRESION">🖨️ Impresión</SelectItem>
                                <SelectItem value="CORTE">✂️ Corte Láser</SelectItem>
                                <SelectItem value="VENTA">🛍️ Venta / Producto</SelectItem>
                                <SelectItem value="DISENO">🎨 Diseño</SelectItem>
                                <SelectItem value="ROTULACION">🚗 Rotulación</SelectItem>
                                <SelectItem value="OTROS">📦 Otros</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <AnimatePresence>
                    {state.tipoServicio === 'CORTE' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-orange-50 dark:bg-orange-900/10 rounded-[2rem] border border-orange-100 dark:border-orange-800 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <h4 className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2 tracking-[0.2em]"><Scissors className="w-4 h-4"/> Parámetros de Láser</h4>
                                <Tabs value={state.modoCobroLaser} onValueChange={v => setState({...state, modoCobroLaser: v, unidad: v === 'tiempo' ? 'tiempo' : 'und'})}>
                                    <TabsList className="bg-orange-200/50 dark:bg-orange-900 rounded-xl h-10 p-1">
                                        <TabsTrigger value="tiempo" className="text-[9px] font-black">POR TIEMPO</TabsTrigger>
                                        <TabsTrigger value="servicio" className="text-[9px] font-black">POR SERVICIO</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {/* QUIEN PONE EL MATERIAL.

                                No es un detalle administrativo: decide lo que se
                                cobra. Si la plancha la trae el cliente solo se
                                cobra el tiempo de maquina; si es nuestra, se
                                cobra tambien el material. Preguntarlo aqui evita
                                tener que reclamarlo despues. */}
                            <div className="grid grid-cols-2 gap-2 mb-5">
                                {([
                                    { propio: true, titulo: 'Material nuestro', pie: 'Tiempo + material' },
                                    { propio: false, titulo: 'Lo trae el cliente', pie: 'Solo el tiempo' },
                                ]).map(o => (
                                    <button
                                        key={String(o.propio)}
                                        type="button"
                                        onClick={() => setState({ ...state, suministrarMaterial: o.propio })}
                                        className={cn(
                                            'p-3 rounded-2xl border text-left transition-all',
                                            !!state.suministrarMaterial === o.propio
                                                ? 'border-orange-400 bg-orange-100/70 dark:bg-orange-500/15'
                                                : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60'
                                        )}
                                    >
                                        <p className="text-[10px] font-black uppercase tracking-widest">{o.titulo}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{o.pie}</p>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Sustrato</Label>
                                    <Select value={state.materialDeCorte} onValueChange={v => setState({...state, materialDeCorte: v, grosorMaterial: '', colorAcrilico: ''})}>
                                        <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                        <SelectContent>
                                            {sustratosCorte.length === 0 && (
                                                <div className="px-3 py-2 text-[10px] text-slate-400">
                                                    Ninguno marcado como que se corta
                                                </div>
                                            )}
                                            {sustratosCorte.map(m => <SelectItem key={m.id} value={m.nombre}>{m.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Grosor</Label>
                                    {/* Se deshabilita por lo que el material DICE, no por su
                                        nombre: antes estaba escrito "si es Cartulina", asi que
                                        un material nuevo sin grosores lo seguia pidiendo. */}
                                    <Select value={state.grosorMaterial} onValueChange={v => setState({...state, grosorMaterial: v})} disabled={grosoresCorte.length === 0}>
                                        <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue placeholder={grosoresCorte.length ? 'Elegir...' : 'N/A'} /></SelectTrigger>
                                        <SelectContent>{grosoresCorte.map(g => <SelectItem key={g.id} value={g.nombre}>{g.nombre}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black text-orange-400 uppercase">Color</Label>
                                    <Select value={state.colorAcrilico} onValueChange={v => setState({...state, colorAcrilico: v})} disabled={coloresCorte.length === 0}>
                                        <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold">
                                            <SelectValue placeholder={coloresCorte.length ? 'Elegir...' : 'Sin colores'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {coloresCorte.map(c => (
                                                <SelectItem key={c.id} value={c.nombre}>
                                                    <span className="flex items-center gap-2">
                                                        <MuestraMaterial material={materialCorte} color={c} tam={16} className="rounded" />
                                                        {c.nombre}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                                {state.modoCobroLaser === 'tiempo' ? (
                                    <div className="space-y-1.5">
                                        <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.tiempo ? "text-red-500" : "text-orange-400")}>
                                            Tiempo (H : M : S) {errors.tiempo && "(Requerido)"}
                                        </Label>
                                        <div className={cn("flex items-center gap-1 bg-white dark:bg-slate-800 h-14 px-4 rounded-2xl shadow-inner font-black text-xl border transition-all", errors.tiempo ? "border-red-500 ring-2 ring-red-500/20" : "border-transparent")}>
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <input value={horas === '0' ? '' : horas} onChange={e => { setHoras(e.target.value); clearError('tiempo'); }} className="w-full text-center outline-none bg-transparent" placeholder="0" type="number" />
                                                <span className="text-[7px] text-slate-300 uppercase font-bold tracking-widest">Hrs</span>
                                            </div>
                                            <span className="opacity-20 pb-3 text-2xl">:</span>
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <input value={minutos === '0' ? '' : minutos} onChange={e => { setMinutos(e.target.value); clearError('tiempo'); }} className="w-full text-center outline-none bg-transparent" placeholder="00" type="number" />
                                                <span className="text-[7px] text-slate-300 uppercase font-bold tracking-widest">Min</span>
                                            </div>
                                            <span className="opacity-20 pb-3 text-2xl">:</span>
                                            <div className="flex flex-col items-center justify-center w-full">
                                                <input value={segundos === '00' ? '' : segundos} onChange={e => { setSegundos(e.target.value); clearError('tiempo'); }} className="w-full text-center outline-none bg-transparent" placeholder="00" maxLength={2} />
                                                <span className="text-[7px] text-slate-300 uppercase font-bold tracking-widest">Seg</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black text-orange-400 uppercase">Precio por Pieza (USD)</Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400"/>
                                            <Input type="number" step="0.01" value={state.precioUnitario === 0 ? '' : state.precioUnitario} onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})} className="h-14 pl-12 border-none bg-white dark:bg-slate-800 font-black text-orange-600 text-xl rounded-2xl shadow-inner" />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.cantidad ? "text-red-500" : "text-orange-400")}>
                                        Cantidad de Piezas
                                    </Label>
                                    <Input type="number" value={state.cantidad === 0 ? '' : state.cantidad} onChange={e => { setState({...state, cantidad: parseInt(e.target.value) || 0}); clearError('cantidad'); }} className={cn("h-14 border-none font-black text-center text-xl rounded-2xl shadow-inner transition-all", errors.cantidad ? "bg-red-50 text-red-600 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* PANEL DE VENTA POR UNIDAD */}
                <AnimatePresence>
                    {state.tipoServicio === 'VENTA' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-800 space-y-5">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🛍️</span>
                                <h4 className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-[0.2em]">Venta por Unidad</h4>
                                <p className="text-[8px] text-emerald-600/60 font-bold">Precio fijo × cantidad</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Precio unitario */}
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase text-emerald-600 ml-1">Precio por Unidad (USD)</Label>

                                    {/* Antes esto era una caja de búsqueda que no enseñaba
                                        nada hasta acertar las primeras letras, y que al
                                        elegir solo copiaba el precio: la orden no guardaba
                                        qué se había vendido, así que no descontaba stock ni
                                        salía en las estadísticas. */}
                                    {catalogProductos.some((p: any) => p.activo !== false && tipoEntradaDe(p) !== 'material') && (
                                        <div className="mb-3">
                                            <SelectorCatalogo
                                                productos={catalogProductos}
                                                categorias={catalogCategorias}
                                                seleccionadoId={ventaProductoId}
                                                onElegir={seleccionarProductoVenta}
                                                esAliado={esAliado}
                                                pestanaInicial="producto"
                                                soloTipos={['producto', 'servicio']}
                                            />
                                        </div>
                                    )}

                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                        <Input type="number" step="0.01"
                                            value={state.precioUnitario === 0 ? '' : state.precioUnitario}
                                            onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})}
                                            className="h-12 pl-12 rounded-2xl border-none bg-white dark:bg-slate-800 font-black text-emerald-600 text-xl shadow-inner" />
                                    </div>
                                </div>

                                {/* Cantidad + unidad */}
                                <div className="space-y-2">
                                    <Label className={cn("text-[9px] font-black uppercase ml-1 transition-colors", errors.cantidad ? "text-red-500" : "text-emerald-600")}>
                                        Cantidad
                                    </Label>
                                    <Input type="number"
                                        value={state.cantidad === 0 ? '' : state.cantidad}
                                        onChange={e => { setState({...state, cantidad: parseInt(e.target.value) || 0}); clearError('cantidad'); }}
                                        className={cn("h-12 rounded-2xl border-none font-black text-center text-xl shadow-inner", errors.cantidad ? "bg-red-50 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} />
                                    <Select value={state.unidad} onValueChange={v => setState({...state, unidad: v})}>
                                        <SelectTrigger className="h-10 rounded-xl border-none bg-white dark:bg-slate-800 text-xs font-black"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="und">Pieza / Unidad</SelectItem>
                                            <SelectItem value="rollo">Rollo</SelectItem>
                                            <SelectItem value="m">Metro lineal</SelectItem>
                                            <SelectItem value="lamina">Lámina</SelectItem>
                                            <SelectItem value="par">Par</SelectItem>
                                            <SelectItem value="juego">Juego / Set</SelectItem>
                                            <SelectItem value="hora">Hora</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Subtotal preview */}
                            {state.precioUnitario > 0 && state.cantidad > 0 && (
                                <div className="flex items-center justify-between bg-emerald-600 text-white px-5 py-3 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase opacity-80">{state.cantidad} × ${state.precioUnitario}</p>
                                    <p className="font-black text-xl">${(state.precioUnitario * state.cantidad).toFixed(2)}</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {state.unidad === 'm2' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border border-blue-100 dark:border-blue-900/30 space-y-6">
                            
                            {/* SECCIÓN: OPCIONES DE IMPRESIÓN */}
                            {state.tipoServicio === 'IMPRESION' && (
                                <div className="space-y-4 pb-4 border-b border-blue-200 dark:border-blue-900/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Printer className="w-5 h-5 text-blue-600" />
                                            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em]">Material de Impresión</h4>
                                        </div>
                                        <button type="button"
                                            onClick={() => { setModoMaterialManual(v => !v); setCatalogMaterialId(null); setCatalogVarianteId(null); }}
                                            className="text-[8px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors">
                                            {modoMaterialManual ? '← Catálogo' : 'Ingresar manual'}
                                        </button>
                                    </div>

                                    {modoMaterialManual ? (
                                        /* Selector manual heredado */
                                        <Select value={state.materialImpresion} onValueChange={v => {
                                            let updates: any = { materialImpresion: v };
                                            if (isBanner(v)) { updates.impresionConCorte = false; updates.impresionPegado = false; }
                                            else if (isSticker(v)) { updates.impresionConCorte = true; updates.impresionPegado = false; }
                                            else if (isClear(v)) { updates.tipoPegado = 'Acrilico'; }

                                            /**
                                             * ESTA LISTA TAMBIEN CUENTA EN EL BALANCE.
                                             *
                                             * Antes solo escribia materialImpresion, un texto
                                             * suelto que el balance ignora a proposito: viene
                                             * relleno con "Vinil Brillante" en casi todos los
                                             * renglones y contarlo diria que todo es vinil.
                                             *
                                             * Resultado: cambiabas el material aqui y no pasaba
                                             * nada en ningun sitio. Ahora se busca el producto
                                             * del catalogo que se llama asi ("Banner Mate" ->
                                             * Banner) y se guarda su id, que es lo que el
                                             * balance sabe leer. Una eleccion deliberada deja
                                             * rastro; el valor por defecto de hace meses no.
                                             */
                                            const buscado = v.trim().toLowerCase()
                                            const igual = (x: any) => String(x || '').trim().toLowerCase() === buscado

                                            // Primero por producto: "Banner Mate" es Banner.
                                            let prod = catalogProductos.find((p: any) => {
                                                const n = String(p?.nombre || '').trim().toLowerCase()
                                                return n && (buscado === n || buscado.startsWith(n + ' '))
                                            })
                                            let variante: any = null

                                            // Y si no, por variante: "Stickers" no es un
                                            // material, es una forma de vender el vinil.
                                            if (!prod) {
                                                for (const p of catalogProductos) {
                                                    const v2 = (p?.variantes || []).find((x: any) => igual(x?.nombre))
                                                    if (v2) { prod = p; variante = v2; break }
                                                }
                                            }

                                            updates.catalogoProductoId = prod?.id || null
                                            updates.catalogoVarianteId = variante?.id || null
                                            updates.catalogoVarianteNombre = variante?.nombre || null
                                            updates.catalogoArea = prod
                                                ? areaDeProducto(prod, catalogCategorias)
                                                : null

                                            setState({...state, ...updates});
                                        }}>
                                            <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {MATERIALES_IMPRESION.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        /* Picker visual del catálogo */
                                        <div className="space-y-3">
                                            {/* Buscador, filtros y fotos: con el catálogo
                                                creciendo, una rejilla sin filtro deja de
                                                servir en cuanto pasa de diez materiales. */}
                                            <SelectorCatalogo
                                                productos={catalogProductos}
                                                categorias={catalogCategorias}
                                                seleccionadoId={catalogMaterialId}
                                                onElegir={(prod: any) => seleccionarMaterialCatalogo(prod)}
                                                esAliado={esAliado}
                                                pestanaInicial="material"
                                                soloTipos={['material']}
                                            />

                                            {/* Acabado: de qué rollo sale. No cambia el precio;
                                                sirve para saber cuál se está gastando. */}
                                            {acabadosActivos(materialSeleccionado).length > 0 && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                                                    <p className="text-[8px] font-black uppercase text-blue-500">Acabado</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {acabadosActivos(materialSeleccionado).map((a: any) => (
                                                            <button key={a.id} type="button"
                                                                onClick={() => seleccionarMaterialCatalogo(materialSeleccionado, catalogVarianteId, a.id)}
                                                                className={cn(
                                                                    'px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase transition-all',
                                                                    catalogAcabadoId === a.id
                                                                        ? 'bg-slate-900 dark:bg-white dark:text-slate-900 border-slate-900 text-white'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                                )}>
                                                                {a.nombre}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* Formas de venta del material seleccionado */}
                                            {materialSeleccionado?.tieneVariantes && materialSeleccionado.variantes?.length > 0 && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                                                    <p className="text-[8px] font-black uppercase text-blue-500">Forma de venta</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {/* Opción base (sin variante) */}
                                                        <button type="button"
                                                            onClick={() => seleccionarMaterialCatalogo(materialSeleccionado, null, catalogAcabadoId)}
                                                            className={cn(
                                                                'px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase transition-all',
                                                                !catalogVarianteId
                                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                            )}>
                                                            Base {esAliado ? '€' : '$'}{precioDeServicio(materialSeleccionado, null, esAliado ? 'publicista' : 'general').toFixed(2)}
                                                        </button>
                                                        {materialSeleccionado.variantes.map((v: any) => (
                                                            <button key={v.id} type="button"
                                                                onClick={() => seleccionarMaterialCatalogo(materialSeleccionado, v.id, catalogAcabadoId)}
                                                                className={cn(
                                                                    'px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase transition-all',
                                                                    catalogVarianteId === v.id
                                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                                )}>
                                                                {v.nombre}
                                                                {' · '}{esAliado ? '€' : '$'}{precioDeServicio(materialSeleccionado, v, esAliado ? 'publicista' : 'general').toFixed(2)}
                                                                /{materialSeleccionado.unidadLabel || 'm²'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* Precio resultante */}
                                            {catalogMaterialId && (
                                                <div className={cn("flex items-center justify-between text-white px-4 py-2.5 rounded-2xl", state.monedaItem === 'EUR' ? "bg-purple-600" : "bg-blue-600")}>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase opacity-80">Precio cargado</p>
                                                        {state.monedaItem === 'EUR' && <p className="text-[8px] opacity-60">Precio preferencial aliado</p>}
                                                    </div>
                                                    <p className="font-black text-lg">
                                                        {state.monedaItem === 'EUR' ? '€' : '$'}{state.precioUnitario.toFixed(2)}
                                                        <span className="text-[9px] opacity-70 font-bold">/m²</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Aunque el material se escriba a mano, decir de qué
                                        rollo salió: sin eso el ítem no suma en ningún
                                        balance ni descuenta del stock. */}
                                    {modoMaterialManual && catalogM2.length > 0 && (
                                        <div className="mt-3 space-y-2 bg-amber-50/70 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-3">
                                            <p className="text-[8px] font-black uppercase text-amber-600 tracking-widest">
                                                ¿De qué material salió? · para que cuente en el balance
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {catalogM2.map((prod: any) => (
                                                    <button key={prod.id} type="button"
                                                        onClick={() => setManualMaterialId(manualMaterialId === prod.id ? null : prod.id)}
                                                        className={cn(
                                                            'px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase transition-all',
                                                            manualMaterialId === prod.id
                                                                ? 'bg-slate-900 dark:bg-white dark:text-slate-900 border-slate-900 text-white'
                                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                        )}>
                                                        {prod.nombre}
                                                    </button>
                                                ))}
                                            </div>
                                            {!manualMaterialId && (
                                                <p className="text-[9px] font-bold text-amber-700 dark:text-amber-500 leading-snug">
                                                    Sin material, sus metros no entran en el balance ni descuentan del rollo.
                                                    Quedará pendiente en Auditoría.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* CASILLAS SEGÚN EL MATERIAL.
                                        Lo que sale aquí lo decide el propio material en el
                                        catálogo, no una lista de nombres en el código: así,
                                        una forma de imprimir nueva se da de alta y ya trae
                                        sus opciones sin tocar nada. */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                                        {(opcionesActivas.corteOpcional || opcionesActivas.corteObligatorio) && (
                                            <div className={cn("flex items-center space-x-2 p-2.5 rounded-lg shadow-sm transition-opacity", opcionesActivas.corteObligatorio ? "bg-slate-200/50 dark:bg-slate-800/50 opacity-70 pointer-events-none" : "bg-white dark:bg-slate-800")}>
                                                <Checkbox
                                                    id="chk-corte"
                                                    checked={opcionesActivas.corteObligatorio ? true : state.impresionConCorte}
                                                    disabled={opcionesActivas.corteObligatorio}
                                                    onCheckedChange={c => setState({ ...state, impresionConCorte: !!c })}
                                                />
                                                <Label htmlFor="chk-corte" className="text-xs font-bold cursor-pointer">
                                                    {opcionesActivas.corteObligatorio ? "Corte (Obligatorio)" : "Añadir Corte"}
                                                </Label>
                                            </div>
                                        )}

                                        {opcionesActivas.pegado && (
                                            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                <Checkbox id="chk-pegado" checked={state.impresionPegado} onCheckedChange={c => setState({ ...state, impresionPegado: !!c })} />
                                                <Label htmlFor="chk-pegado" className="text-xs font-bold cursor-pointer">Pegado en Rígido</Label>
                                            </div>
                                        )}

                                        {opcionesActivas.ojales && (
                                            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                <Checkbox id="chk-ojales" checked={state.impresionOjales} onCheckedChange={c => setState({ ...state, impresionOjales: !!c })} />
                                                <Label htmlFor="chk-ojales" className="text-xs font-bold cursor-pointer">Ojales</Label>
                                            </div>
                                        )}

                                        {opcionesActivas.bolsillos && (
                                            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                <Checkbox id="chk-bolsillos" checked={state.impresionBolsillos} onCheckedChange={c => setState({ ...state, impresionBolsillos: !!c })} />
                                                <Label htmlFor="chk-bolsillos" className="text-xs font-bold cursor-pointer">Bolsillos</Label>
                                            </div>
                                        )}

                                        {opcionesActivas.tubos && (
                                            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                <Checkbox id="chk-tubos" checked={state.impresionTubos} onCheckedChange={c => setState({ ...state, impresionTubos: !!c })} />
                                                <Label htmlFor="chk-tubos" className="text-xs font-bold cursor-pointer">Tubos</Label>
                                            </div>
                                        )}

                                        {opcionesActivas.refilado && (
                                            <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm">
                                                <Checkbox id="chk-refilado" checked={state.impresionRefilado} onCheckedChange={c => setState({ ...state, impresionRefilado: !!c })} />
                                                <Label htmlFor="chk-refilado" className="text-xs font-bold cursor-pointer">Refilado</Label>
                                            </div>
                                        )}

                                        {opcionesActivas.laminado && (
                                            <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                                                <Checkbox id="chk-laminado" checked={state.impresionLaminado} onCheckedChange={c => setState({ ...state, impresionLaminado: !!c })} className="data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500" />
                                                <Label htmlFor="chk-laminado" className="text-xs font-black text-indigo-700 dark:text-indigo-300 cursor-pointer">Laminado Extra</Label>
                                            </div>
                                        )}
                                    </div>

                                    {/* PANELES DE CONFIGURACIÓN EXTRAS (Pegado y Laminado) */}
                                    <div className="space-y-3 mt-4">
                                        
                                        {/* PANEL DE PEGADO */}
                                        <AnimatePresence>
                                            {opcionesActivas.pegado && state.impresionPegado && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 overflow-hidden">
                                                    <Label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase flex items-center gap-2"><Box className="w-3 h-3"/> Configuración de Pegado</Label>

                                                    {/* SOBRE QUE SE PEGA Y A COMO.

                                                        El sustrato se corta a la medida de lo que se
                                                        pega, asi que se cobra por los m2 de la pieza.
                                                        Un PVC de 5mm no vale lo mismo que uno de 3mm,
                                                        por eso el precio vive en el grosor.

                                                        La lista sale de Materiales de taller: aqui
                                                        estaban PVC y Acrilico escritos a mano, y no
                                                        habia forma de anadir uno nuevo ni de saber
                                                        cuanto costaba. */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-slate-500 uppercase">Sustrato rígido</Label>
                                                            <Select
                                                                value={state.tipoPegado}
                                                                onValueChange={v => setState({ ...state, tipoPegado: v, grosorPegado: '' })}
                                                                disabled={isClear(state.materialImpresion) && sustratosPegado.length === 0}
                                                            >
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-none h-11 rounded-lg text-xs font-bold"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                                                                <SelectContent>
                                                                    {sustratosPegado.map(m => (
                                                                        <SelectItem key={m.id} value={m.nombre}>{m.nombre}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-slate-500 uppercase">Grosor</Label>
                                                            <Select
                                                                value={state.grosorPegado || ''}
                                                                onValueChange={v => setState({ ...state, grosorPegado: v })}
                                                                disabled={grosoresPegado.length === 0}
                                                            >
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-none h-11 rounded-lg text-xs font-bold">
                                                                    <SelectValue placeholder={grosoresPegado.length ? 'Elegir...' : 'Sin grosores'} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {grosoresPegado.map(g => (
                                                                        <SelectItem key={g.id} value={g.nombre}>
                                                                            {g.nombre}{g.precioPegadoM2 ? ` · $${g.precioPegadoM2}/m²` : ''}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-slate-500 uppercase">¿Quién lo pone?</Label>
                                                            <Select value={state.proveedorPegado} onValueChange={v => setState({...state, proveedorPegado: v})}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-900 border-none h-11 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="taller">Taller (Cobrar material)</SelectItem>
                                                                    <SelectItem value="cliente">Cliente (No cobrar material)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    {state.proveedorPegado === 'taller' && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* EL FONDO BLANCO.
                                                                Un clear sobre acrilico no se ve si no
                                                                lleva blanco detras. Es material aparte
                                                                del sustrato y se cobra aparte. */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setState({ ...state, fondoBlancoPegado: !state.fondoBlancoPegado })}
                                                                className={cn(
                                                                    'h-11 px-3 rounded-lg border text-left transition-colors flex items-center justify-between gap-2',
                                                                    state.fondoBlancoPegado
                                                                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-500/10'
                                                                        : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900'
                                                                )}
                                                            >
                                                                <span className={cn('text-[10px] font-black uppercase', state.fondoBlancoPegado ? 'text-blue-600' : 'text-slate-400')}>
                                                                    Fondo de vinil blanco
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-400 shrink-0">
                                                                    {precioFondoBlancoM2(matTaller) > 0 ? `$${precioFondoBlancoM2(matTaller)}/m²` : 'sin precio'}
                                                                </span>
                                                            </button>

                                                            <div className="space-y-1.5">
                                                                <Label className="text-[9px] font-bold text-slate-500 uppercase">
                                                                    Costo del montaje (USD)
                                                                    {pegadoSugerido.total > 0 && (
                                                                        <span className="text-blue-500 normal-case font-black">
                                                                            {' · '}sugerido ${pegadoSugerido.total.toFixed(2)}
                                                                        </span>
                                                                    )}
                                                                </Label>
                                                                <div className="relative">
                                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                                                                    <Input
                                                                        type="number" step="0.01"
                                                                        value={state.precioPegado === 0 ? '' : state.precioPegado}
                                                                        onChange={e => setState({...state, precioPegado: parseFloat(e.target.value) || 0})}
                                                                        placeholder={pegadoSugerido.total > 0 ? pegadoSugerido.total.toFixed(2) : '0.00'}
                                                                        className="h-11 pl-9 border-none bg-white dark:bg-slate-900 font-black text-slate-700 dark:text-slate-300 rounded-lg shadow-sm"
                                                                    />
                                                                </div>
                                                                {/* Se propone, no se impone: lo tecleado manda. */}
                                                                {pegadoSugerido.total > 0 && Math.abs(pegadoSugerido.total - (Number(state.precioPegado) || 0)) > 0.01 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setState({ ...state, precioPegado: pegadoSugerido.total })}
                                                                        className="text-[9px] font-black uppercase text-blue-600 hover:underline"
                                                                    >
                                                                        Usar ${pegadoSugerido.total.toFixed(2)}
                                                                        {pegadoSugerido.fondo > 0 && ` (${pegadoSugerido.sustrato.toFixed(2)} sustrato + ${pegadoSugerido.fondo.toFixed(2)} fondo)`}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* PANEL DE LAMINADO */}
                                        <AnimatePresence>
                                            {opcionesActivas.laminado && state.impresionLaminado && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50 space-y-3 overflow-hidden">
                                                    <Label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2"><Layers className="w-3 h-3"/> Configuración de Costo (Laminado)</Label>

                                                    {/* La cuenta del rollo, siempre a la vista: es donde
                                                        se pierde dinero sin darse cuenta. */}
                                                    {laminado && (
                                                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 space-y-2 border border-indigo-100 dark:border-indigo-800/50">
                                                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                                                <span className="text-[9px] font-black uppercase text-slate-400">
                                                                    Rollo de {laminado.anchoRollo} cm
                                                                    {laminado.pasadas > 1 && ` · ${laminado.pasadas} pasadas`}
                                                                </span>
                                                                <span className="text-sm font-black tabular-nums text-indigo-600">
                                                                    {laminado.metrosLineales.toFixed(2)} m.l.
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[10px] font-bold">
                                                                <span className="text-slate-400">
                                                                    Se gastan <span className="text-slate-600 dark:text-slate-300 tabular-nums">{laminado.m2Rollo.toFixed(2)} m²</span> de rollo
                                                                    {laminado.m2Impresos > 0 && laminado.m2Rollo > laminado.m2Impresos * 1.15 && (
                                                                        <span className="text-amber-600"> · solo {laminado.m2Impresos.toFixed(2)} m² van impresos</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            {laminado.precioML > 0 && (
                                                                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                                                                    <div>
                                                                        <p className="text-[9px] font-black uppercase text-emerald-600">Cobro sugerido</p>
                                                                        <p className="text-sm font-black tabular-nums text-emerald-600">
                                                                            {laminado.moneda}{laminado.costoSugerido.toFixed(2)}
                                                                            <span className="text-[9px] font-bold opacity-60"> · {laminado.moneda}{laminado.precioML}/m.l.</span>
                                                                        </p>
                                                                    </div>
                                                                    <Button type="button" size="sm"
                                                                        onClick={() => setState({ ...state, tipoCobroLaminado: 'manual', precioLaminadoManual: laminado.costoSugerido })}
                                                                        className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] px-3">
                                                                        Usar
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-indigo-500 uppercase">Modo de Cálculo</Label>
                                                            <Select value={state.tipoCobroLaminado} onValueChange={v => setState({...state, tipoCobroLaminado: v})}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-800 border-none h-11 rounded-lg text-xs font-bold"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="auto">Automático (rollo real)</SelectItem>
                                                                    <SelectItem value="y">M. Lineal (Gastar Alto Y)</SelectItem>
                                                                    <SelectItem value="x">M. Lineal (Gastar Ancho X)</SelectItem>
                                                                    <SelectItem value="manual">Monto Fijo (Retazos)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-bold text-indigo-500 uppercase">
                                                                {state.tipoCobroLaminado === 'manual' ? "Costo del Laminado (USD)" : "Precio por M. Lineal (USD)"}
                                                            </Label>
                                                            <div className="relative">
                                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400"/>
                                                                <Input 
                                                                    type="number" step="0.01" 
                                                                    value={state.tipoCobroLaminado === 'manual' ? (state.precioLaminadoManual === 0 ? '' : state.precioLaminadoManual) : (state.precioLaminadoLineal === 0 ? '' : state.precioLaminadoLineal)}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        if (state.tipoCobroLaminado === 'manual') setState({...state, precioLaminadoManual: val});
                                                                        else setState({...state, precioLaminadoLineal: val});
                                                                    }} 
                                                                    className="h-11 pl-9 border-none bg-white dark:bg-slate-800 font-black text-indigo-600 rounded-lg shadow-sm" 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                </div>
                            )}

                            <h4 className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 tracking-[0.2em]"><MoveVertical className="w-4 h-4"/> Dimensiones del Archivo</h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.medidaXCm ? "text-red-500" : "text-blue-400")}>
                                        Ancho X (cm) {state.impresionLaminado && state.tipoCobroLaminado === 'x' && <span className="text-[7px] text-indigo-500 ml-1">(Usado para Laminado)</span>}
                                    </Label>
                                    <Input 
                                        type="number" 
                                        value={state.medidaXCm === 0 ? '' : state.medidaXCm}
                                        onChange={e => { setState({...state, medidaXCm: parseFloat(e.target.value) || 0}); clearError('medidaXCm'); }}
                                        className={cn("h-12 text-center border-none font-black text-lg rounded-xl shadow-inner transition-all", errors.medidaXCm ? "bg-red-50 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className={cn("text-[9px] font-black uppercase transition-colors", errors.medidaYCm ? "text-red-500" : "text-blue-400")}>
                                        Alto Y (cm) {state.impresionLaminado && state.tipoCobroLaminado === 'y' && <span className="text-[7px] text-indigo-500 ml-1">(Usado para Laminado)</span>}
                                    </Label>
                                    <Input 
                                        type="number" 
                                        value={state.medidaYCm === 0 ? '' : state.medidaYCm}
                                        onChange={e => { setState({...state, medidaYCm: parseFloat(e.target.value) || 0}); clearError('medidaYCm'); }}
                                        className={cn("h-12 text-center border-none font-black text-lg rounded-xl shadow-inner transition-all", errors.medidaYCm ? "bg-red-50 ring-2 ring-red-500/50" : "bg-white dark:bg-slate-800")} 
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!(state.tipoServicio === 'CORTE' && state.modoCobroLaser === 'tiempo') && state.tipoServicio !== 'VENTA' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Precio Unitario Base (USD)</Label>
                                <button
                                    type="button"
                                    onClick={() => setShowCatalogPicker(v => !v)}
                                    className="flex items-center gap-1 text-[8px] font-black uppercase text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    <BookOpen className="w-3 h-3" />
                                    Catálogo
                                    {showCatalogPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                            </div>

                            {/* Mini picker del catálogo */}
                            <AnimatePresence>
                                {showCatalogPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-3 space-y-2 mb-2">
                                            <input
                                                type="text"
                                                placeholder="Buscar material o producto..."
                                                value={catalogSearch}
                                                onChange={e => setCatalogSearch(e.target.value)}
                                                className="w-full h-8 px-3 rounded-xl bg-white dark:bg-black/20 border-none text-xs font-bold outline-none"
                                                autoFocus
                                            />
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {catalogFiltrado.length === 0 ? (
                                                    <p className="text-[9px] text-slate-400 text-center py-2">Sin resultados</p>
                                                ) : catalogFiltrado.map(prod => (
                                                    <button
                                                        key={prod.id}
                                                        type="button"
                                                        onClick={() => usarPrecioCatalogo(prod)}
                                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white dark:hover:bg-black/20 transition-colors text-left group"
                                                    >
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white group-hover:text-blue-600 transition-colors">{prod.nombre}</p>
                                                            <p className="text-[8px] text-slate-400">
                                                                {prod.tipoVenta === 'metro_cuadrado' ? `$${prod.precioBase}/m²` : `$${prod.precioBase}/${prod.unidadLabel}`}
                                                                {prod.precioPublicista ? ` · €${prod.precioPublicista} pub` : ''}
                                                            </p>
                                                        </div>
                                                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                                                            ${prod.precioBase}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={state.precioUnitario === 0 ? '' : state.precioUnitario}
                                    onChange={e => setState({...state, precioUnitario: parseFloat(e.target.value) || 0})}
                                    className="h-12 pl-12 rounded-2xl border-none bg-slate-100 dark:bg-slate-800 font-black text-emerald-600 text-xl shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className={cn("text-[10px] font-black uppercase ml-1 transition-colors", errors.cantidad ? "text-red-500" : "text-slate-400")}>Cantidad de Copias</Label>
                            <Input 
                                type="number" 
                                value={state.cantidad === 0 ? '' : state.cantidad}
                                onChange={e => { setState({...state, cantidad: parseInt(e.target.value) || 0}); clearError('cantidad'); }}
                                className={cn("h-12 rounded-2xl border-none font-black text-center text-xl shadow-inner transition-all", errors.cantidad ? "bg-red-50 ring-2 ring-red-500/50" : "bg-slate-100 dark:bg-slate-800")} 
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Responsable de Ejecución</Label>
                        <Select value={state.empleadoAsignado} onValueChange={v => setState({...state, empleadoAsignado: v})}>
                            <SelectTrigger className="h-12 rounded-xl border-none bg-slate-100 dark:bg-slate-800 font-bold text-sm shadow-inner px-5">
                                <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400"/> <SelectValue /></div>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="N/A">Sin Asignar</SelectItem>
                                {PERSONAL_TALLER.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                {designers.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* En CORTE esto ya se pregunta arriba, con las palabras
                        que importan ahi: quien pone la plancha y por tanto si
                        se cobra solo el tiempo. Dos interruptores para el mismo
                        dato en la misma pantalla es una invitacion a que uno de
                        los dos se quede sin tocar. */}
                    <div className={cn("p-4 rounded-2xl border items-center justify-between transition-all", state.tipoServicio === 'CORTE' ? "hidden" : "flex", state.suministrarMaterial ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200" : "bg-slate-50 dark:bg-slate-900 border-slate-100")}>
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", state.suministrarMaterial ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>
                                <Box className="w-5 h-5" />
                            </div>
                            <div className="leading-none">
                                <p className="font-black text-[10px] uppercase text-slate-700 dark:text-slate-200">Suministrar Material</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sumar costo de sustrato extra</p>
                            </div>
                        </div>
                        <input type="checkbox" checked={state.suministrarMaterial} onChange={e => setState({...state, suministrarMaterial: e.target.checked})} className="w-6 h-6 rounded-lg accent-emerald-500 cursor-pointer" />
                    </div>
                </div>

                {state.suministrarMaterial && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="p-5 bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 overflow-hidden">
                        <Label className="text-[9px] font-black text-emerald-600 uppercase ml-1">Costo Adicional Material (USD)</Label>
                        <div className="relative mt-1">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500"/>
                            <Input
                                type="number" step="0.01"
                                value={state.costoMaterialExtra === 0 ? '' : state.costoMaterialExtra}
                                onChange={e => setState({...state, costoMaterialExtra: parseFloat(e.target.value) || 0})}
                                className="h-11 pl-11 border-none bg-white dark:bg-slate-800 font-black text-emerald-600 rounded-xl shadow-inner"
                            />
                        </div>
                    </motion.div>
                )}

                {/* PRECIO AL MAYOR */}
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-[1.5rem] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Precio al Mayor (opcional)</p>
                            <p className="text-[8px] text-amber-600/70 font-bold">Si el cliente compra N o más unidades, se aplica este precio en lugar del normal</p>
                        </div>
                        {state.cantidadMayor > 0 && state.precioMayor > 0 && state.cantidad >= state.cantidadMayor && (
                            <span className="text-[8px] font-black uppercase bg-amber-500 text-white px-2 py-1 rounded-full">Activo</span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-amber-600 ml-1">Cantidad mínima</Label>
                            <Input type="number" placeholder="Ej: 10"
                                value={state.cantidadMayor === 0 ? '' : state.cantidadMayor}
                                onChange={e => setState({...state, cantidadMayor: parseInt(e.target.value) || 0})}
                                className="h-11 rounded-xl border-none bg-white dark:bg-slate-800 font-black text-center text-amber-700" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase text-amber-600 ml-1">
                                Precio al mayor ({state.monedaItem === 'EUR' ? '€' : '$'})
                            </Label>
                            <Input type="number" step="0.01" placeholder="Ej: 8.50"
                                value={state.precioMayor === 0 ? '' : state.precioMayor}
                                onChange={e => setState({...state, precioMayor: parseFloat(e.target.value) || 0})}
                                className="h-11 rounded-xl border-none bg-white dark:bg-slate-800 font-black text-center text-amber-700" />
                        </div>
                    </div>
                    {state.cantidadMayor > 0 && state.precioMayor > 0 && (
                        <p className="text-[9px] text-amber-700 dark:text-amber-400 font-bold">
                            {state.cantidad >= state.cantidadMayor
                                ? `✓ Aplicando precio al mayor: ${state.monedaItem === 'EUR' ? '€' : '$'}${state.precioMayor} c/u`
                                : `Necesitas ${state.cantidadMayor - state.cantidad} más para activar el precio al mayor`
                            }
                        </p>
                    )}
                </div>
            </div>
        </ScrollArea>

        <footer className="p-5 sm:p-8 bg-white dark:bg-slate-900 border-t flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 shrink-0 z-20">
            <div className="flex items-center gap-5 w-full md:w-auto">
                <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner", state.monedaItem === 'EUR' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600")}>
                    <Calculator className="w-7 h-7" />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Monto Subtotal</p>
                        {state.monedaItem === 'EUR' && <span className="text-[7px] font-black bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-1.5 py-0.5 rounded-full uppercase">EUR · Aliado</span>}
                        {state.cantidadMayor > 0 && state.precioMayor > 0 && state.cantidad >= state.cantidadMayor && (
                            <span className="text-[7px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full uppercase">Al Mayor</span>
                        )}
                    </div>
                    <p className={cn("text-3xl sm:text-4xl font-black tracking-tighter leading-none", state.monedaItem === 'EUR' ? "text-purple-600" : "text-blue-600")}>
                        {state.monedaItem === 'EUR' ? '€' : '$'}{state.subtotal.toFixed(2)}
                    </p>
                </div>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <Button variant="ghost" onClick={onClose} className="flex-1 md:flex-none h-14 px-8 font-black uppercase text-xs tracking-widest text-slate-400">Cancelar</Button>
                <Button
                    onClick={handleSave}
                    className={cn("flex-[2] md:flex-none h-14 px-12 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-sm tracking-widest", esAliado ? "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20")}
                >
                    {itemToEdit ? "ACTUALIZAR ÍTEM" : "AÑADIR A LA ORDEN"}
                </Button>
            </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}