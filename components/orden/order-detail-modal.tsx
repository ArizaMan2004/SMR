// @/components/orden/order-detail-modal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/order-utils";
import { generateOrderPDF } from "@/lib/services/pdf-generator";
// 🔑 CORRECCIÓN: Se añaden las funciones para obtener la firma y el sello
import { getLogoBase64, getFirmaBase64, getSelloBase64 } from "@/lib/logo-service";
import { type OrdenServicio } from "@/lib/types/orden";
import { X, FileDown, User, Package } from "lucide-react";
import type React from "react";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  orden: OrdenServicio | null;
  smrLogoBase64: string | undefined;
  bcvRate: number;
}

// 🔑 CORRECCIÓN 1.1: Constante para calcular el precio del tiempo
const PRECIO_LASER_POR_MINUTO = 0.80; 

/**
 * 🔹 Formatea una fecha en formato DD/MM/AAAA.
 */
const formatDateString = (dateString: string | Date): string => {
  if (!dateString) return "Fecha no registrada";
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  if (isNaN(date.getTime())) {
    return "Fecha Inválida";
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

/**
 * 🔹 Calcula el subtotal de un ítem.
 */
const getItemSubtotal = (item: any) => {
  let subtotal = 0;
  const { unidad, cantidad, precioUnitario, medidaXCm, medidaYCm, tiempoCorte } = item;

  const finalCantidad = cantidad || 0;
  const finalPrecio = precioUnitario || 0;

  if (unidad === "und") {
    subtotal = finalCantidad * finalPrecio;
  } else if (unidad === "m2") {
    if (medidaXCm && medidaYCm) {
      const areaM2 = (medidaXCm / 100) * (medidaYCm / 100);
      subtotal = areaM2 * finalPrecio * finalCantidad;
    }
  } else if (unidad === "tiempo") {
    // 🔑 Lógica correcta para la unidad 'tiempo' (Corte Láser)
    if (tiempoCorte) {
      // tiempoCorte viene como "MM:SS" (ej: "05:30")
      const [minutesStr, secondsStr] = tiempoCorte.split(':');
      const minutes = parseInt(minutesStr) || 0;
      const seconds = parseInt(secondsStr) || 0;
      
      const totalMinutes = minutes + (seconds / 60);
      // Multiplicamos por el precio por minuto y la cantidad de ítems
      subtotal = totalMinutes * PRECIO_LASER_POR_MINUTO * finalCantidad; 
    }
  }
  
  return subtotal;
};

/**
 * 🔹 Genera el PDF asegurando que el logo, la firma y el sello estén disponibles.
 */
const handleDownloadPDF = async (
  orden: OrdenServicio,
  smrLogoBase64: string | undefined,
  bcvRate: number
) => {
  if (!orden) return;

  try {
    let logoBase64 = smrLogoBase64;

    if (!logoBase64) {
      console.warn("⚠️ Logo no presente en memoria, cargando desde logo-service...");
      // Asumo que esta función existe y es asíncrona
      logoBase64 = await getLogoBase64(); 
    }

    if (!logoBase64) {
      alert("No se pudo cargar el logo. Verifica que /public/smr-logo.png exista.");
      return;
    }
    
    // 🔑 CORRECCIÓN: Obtener la firma y el sello de localStorage
    const firmaBase64 = getFirmaBase64(); 
    const selloBase64 = getSelloBase64();

    console.log("✅ Generando PDF con datos:", {
      ordenId: orden.id,
      bcvRate,
      hasFirma: !!firmaBase64, 
      hasSello: !!selloBase64, 
      logoBase64Preview: logoBase64.substring(0, 50) + "...",
    });

    // 🔑 CORRECCIÓN: Pasar firma y sello en las opciones para pdf-generator.ts
    generateOrderPDF(orden, logoBase64, { 
        bcvRate: bcvRate,
        firmaBase64: firmaBase64,
        selloBase64: selloBase64,
    }); 
  } catch (error) {
    console.error("Error al generar PDF:", error);
    alert("Ocurrió un error al generar el PDF. Revisa la consola para más detalles.");
  }
};

export function OrderDetailModal({
  open,
  onClose,
  orden,
  smrLogoBase64,
  bcvRate,
}: OrderDetailModalProps) {
  if (!orden) return null;

  // CÁLCULO DE MONTOS EN BOLÍVARES
  const montoPagadoVES = orden.montoPagadoUSD * bcvRate;
  const totalVES = orden.totalUSD * bcvRate;

  const montoPendiente = orden.totalUSD - orden.montoPagadoUSD;
  const estadoPagoText =
    montoPendiente <= 0.01
      ? "PAGADO"
      : orden.montoPagadoUSD > 0
      ? `ABONADO (${formatCurrency(montoPendiente)} Pendiente)`
      : "PENDIENTE";
  const estadoPagoColor =
    montoPendiente <= 0.01
      ? "text-green-600"
      : orden.montoPagadoUSD > 0
      ? "text-orange-600"
      : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95vh] flex flex-col p-0">
        {/* HEADER */}
        <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Detalle de Orden de Servicio #{orden.ordenNumero}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* CONTENIDO */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ESTADOS Y FECHAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">
              <CardContent className="p-3">
                <DataField label="Estado de la Orden" bold>
                  {orden.estado}
                </DataField>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
              <CardContent className="p-3">
                <DataField label="Fecha de Creación" bold>
                  {formatDateString(orden.fecha)}
                </DataField>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
              <CardContent className="p-3">
                <DataField label="Entrega Estimada" bold>
                  {formatDateString(orden.fechaEntrega)}
                </DataField>
              </CardContent>
            </Card>
          </div>

          {/* CLIENTE */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xl flex items-center gap-2 text-primary dark:text-gray-100">
                <User className="w-5 h-5" /> Datos del Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 pt-0">
              <DataField label="Nombre/Razón Social" bold fullWidth>
                {orden.cliente.nombreRazonSocial}
              </DataField>
              <DataField label="RIF/Cédula">{orden.cliente.rifCedula}</DataField>
              <DataField label="Teléfono">{orden.cliente.telefono}</DataField>
              <DataField label="Correo" fullWidth>
                {orden.cliente.correo}
              </DataField>
              <DataField label="Persona Contacto">{orden.cliente.personaContacto}</DataField>
            </CardContent>

            <Separator className="my-0" />

            <CardContent className="p-4 pt-3">
              <DataField label="Servicios Solicitados" fullWidth>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(orden.serviciosSolicitados)
                    .filter(([, checked]) => checked)
                    .map(([key]) => (
                      <span
                        key={key}
                        className="text-xs font-semibold px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full"
                      >
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                      </span>
                    ))}
                  {Object.values(orden.serviciosSolicitados).every((v) => v === false) && (
                    <span className="text-sm text-muted-foreground">
                      No hay servicios marcados.
                    </span>
                  )}
                </div>
              </DataField>
            </CardContent>
          </Card>

          {/* ÍTEMS */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xl flex items-center gap-2 text-primary dark:text-gray-100">
                <Package className="w-5 h-5" /> Detalle de Ítems ({orden.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                      <TableHead>Ítem/Descripción</TableHead><TableHead className="text-center">Cant.</TableHead><TableHead className="text-center">Unidad</TableHead><TableHead>Medidas</TableHead><TableHead>Material</TableHead><TableHead>Encargado</TableHead><TableHead className="text-right">Precio Unid.</TableHead><TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orden.items.map((item, index) => {
                      const itemAny = item as any;
                      const subtotal = getItemSubtotal(itemAny); 
                      const encargadoDisplay = itemAny.empleadoAsignado
                        ? itemAny.empleadoAsignado.split(" ")[0]
                        : "Sin asignar";
                        
                      // Lógica para mostrar el material de Corte o Impresión
                      const materialDisplay = 
                        (itemAny.tipoServicio === 'CORTE' || itemAny.tipoServicio === 'CORTE_LASER')
                          ? itemAny.materialDetalleCorte || 'N/A' 
                          : itemAny.materialDeImpresion || 'N/A'; 

                      return (
                        <TableRow
                          key={index}
                          className="hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        >
                          <TableCell className="font-medium">
                            {itemAny.nombre}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {itemAny.tipoServicio}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">{itemAny.cantidad}</TableCell>
                          <TableCell className="text-center uppercase font-mono">
                            {itemAny.unidad}
                          </TableCell>
                          <TableCell>
                            {itemAny.unidad === "m2" && itemAny.medidaXCm && itemAny.medidaYCm
                              ? `${itemAny.medidaXCm}x${itemAny.medidaYCm}cm`
                              : itemAny.unidad === "tiempo" && itemAny.tiempoCorte
                              ? `${itemAny.tiempoCorte} (min:seg)`
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground dark:text-gray-400">
                            {materialDisplay}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-primary dark:text-blue-300">
                            {encargadoDisplay}
                          </TableCell>
                          <TableCell className="text-right">
                            {/* Ajustado el texto para la unidad tiempo, el cálculo va en Subtotal */}
                            {itemAny.unidad === "tiempo"
                              ? `${formatCurrency(PRECIO_LASER_POR_MINUTO)}/min`
                              : formatCurrency(itemAny.precioUnitario)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {/* El subtotal ahora es correcto para todos los tipos de unidad */}
                            {formatCurrency(subtotal)} 
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* NOTAS Y DESCRIPCIÓN */}
          <Card>
            <CardContent className="p-4">
              <DataField label="Descripción Detallada/Notas" fullWidth>
                <p className="whitespace-pre-wrap text-sm italic">
                  {orden.descripcionDetallada || "No hay descripción detallada."}
                </p>
              </DataField>
            </CardContent>
          </Card>

          {/* TOTALES Y PAGOS */}
          <Card className="border-2 border-primary/50 dark:border-primary/70">
            <CardContent className="p-4 space-y-3">
              {/* Tasa BCV */}
              <DataField label="Tasa BCV Referencial" small>
                <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  1 USD = {formatCurrency(bcvRate)} VES
                </span>
              </DataField>
              <Separator />

              {/* Estado de Pago */}
              <DataField label="Estado del Pago" className={estadoPagoColor}>
                <strong className="text-lg">{estadoPagoText}</strong>
              </DataField>

              {/* Monto Pagado (USD y VES) */}
              <DataField label="Monto Pagado">
                <span className="block text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(orden.montoPagadoUSD)} USD
                </span>
                <span className="block text-base font-semibold text-orange-500 dark:text-orange-300">
                  ({formatCurrency(montoPagadoVES)} VES)
                </span>
              </DataField>
              <Separator />

              {/* Total Orden (USD y VES) */}
              <div className="flex justify-between items-center pt-2">
                <strong className="text-lg uppercase text-muted-foreground dark:text-gray-400">
                  Total Orden
                </strong>
                <div className="text-right">
                  <p className="text-4xl font-extrabold text-green-800 dark:text-green-300">
                    {formatCurrency(orden.totalUSD)} USD
                  </p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">
                    ({formatCurrency(totalVES)} VES)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end p-4 border-t flex-shrink-0">
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/50"
            onClick={() => handleDownloadPDF(orden, smrLogoBase64, bcvRate)}
          >
            <FileDown className="w-4 h-4" />
            Descargar Presupuesto PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Subcomponente para mostrar un campo de datos con etiqueta.
 */
interface DataFieldProps {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  bold?: boolean;
  small?: boolean;
  className?: string;
}

const DataField: React.FC<DataFieldProps> = ({
  label,
  children,
  fullWidth = false,
  bold = false,
  small = false,
  className = "",
}) => (
  <div className={fullWidth ? "col-span-3 sm:col-span-3" : ""}>
    <strong
      className={`block uppercase text-muted-foreground ${small ? "text-xs" : "text-sm"}`}
    >
      {label}
    </strong>
    <div
      className={`text-gray-800 dark:text-gray-200 ${bold ? "font-semibold" : ""} ${className}`}
    >
      {children}
    </div>
  </div>
);