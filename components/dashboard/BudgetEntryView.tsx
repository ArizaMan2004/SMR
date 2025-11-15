// @/components/dashboard/BudgetEntryView.tsx

"use client"

import React, { useState, useMemo, useEffect, useCallback } from 'react'; 
import { generateBudgetPDF } from "@/lib/services/pdf-generator";
import { 
    saveBudgetToFirestore, 
    loadBudgetsFromFirestore, 
    deleteBudgetFromFirestore,
    DbBudgetEntry 
} from "@/lib/firebase/firestore-budget-service"; // 👈 Importación del nuevo servicio
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Image, Handshake, Stamp, FileText, X, Save, Clock, Download, Loader2 } from "lucide-react"; 
import { Separator } from "@/components/ui/separator"; 

// --- TIPOS DE DATOS ---
interface BudgetItem {
    id: number;
    descripcion: string;
    cantidad: number;
    precioUnitarioUSD: number;
    totalUSD: number;
}

interface BudgetData {
    clienteNombre: string;
    items: BudgetItem[];
}

// HistoryEntry ahora corresponde a DbBudgetEntry con el ID de Firestore
interface HistoryEntry extends BudgetData {
    id: string; // ID de Firestore
    dateCreated: string;
    totalUSD: number;
}

// --- PROPS DEL DASHBOARD (Mantenidas) ---
interface BudgetEntryViewProps {
    currentBcvRate: number;
    // Props de Assets
    pdfLogoBase64: string | undefined;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleClearLogo: () => void;
    firmaBase64: string | undefined;
    handleFirmaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleClearFirma: () => void;
    selloBase64: string | undefined;
    handleSelloUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleClearSello: () => void;
}

const initialBudgetData: BudgetData = {
    clienteNombre: '',
    items: [],
};

export default function BudgetEntryView({
    currentBcvRate,
    pdfLogoBase64,
    handleLogoUpload,
    handleClearLogo,
    firmaBase64,
    handleFirmaUpload,
    handleClearFirma,
    selloBase64,
    handleSelloUpload,
    handleClearSello,
}: BudgetEntryViewProps) {
    const [budgetData, setBudgetData] = useState<BudgetData>(initialBudgetData);
    const [newItem, setNewItem] = useState({ descripcion: '', cantidad: 1, precioUnitarioUSD: 0 });
    const [history, setHistory] = useState<HistoryEntry[]>([]); 
    const [isLoading, setIsLoading] = useState(false); // Estado de carga para operaciones de DB

    const totalCalculations = useMemo(() => {
        const totalUSD = budgetData.items.reduce((sum, item) => sum + item.totalUSD, 0);
        return { subtotalUSD: totalUSD, ivaMontoUSD: 0, totalUSD };
    }, [budgetData.items]);
    
    // --- LÓGICA DE FIREBASE ---

    /**
     * Carga todo el historial de presupuestos desde Firestore.
     */
    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const loadedBudgets = await loadBudgetsFromFirestore();
            // Mapeamos el ID de Firestore al estado local
            setHistory(loadedBudgets.map(b => ({ ...b, id: b.id! })) as HistoryEntry[]); 
        } catch (error) {
            console.error("Fallo al cargar el historial:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Efecto para cargar el historial al montar el componente
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    /**
     * Guarda el presupuesto actual en Firestore.
     */
    const handleSaveBudget = async () => { 
        if (!budgetData.clienteNombre || budgetData.items.length === 0) {
            alert("El presupuesto debe tener nombre de cliente y al menos un ítem para guardar.");
            return;
        }

        const newEntryDataToSave: Omit<DbBudgetEntry, 'id'> = {
            ...budgetData,
            dateCreated: new Date().toISOString(), // 👈 Fecha de creación persistente (ISO String)
            totalUSD: totalCalculations.totalUSD,
        };
        
        setIsLoading(true);
        try {
            await saveBudgetToFirestore(newEntryDataToSave);
            await fetchHistory(); // Recarga la lista para ver el nuevo presupuesto
            alert(`Presupuesto para ${budgetData.clienteNombre} guardado en la base de datos.`);
        } catch (error) {
            alert("Error al guardar el presupuesto en la base de datos.");
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Elimina una entrada del historial de Firestore.
     */
    const handleRemoveHistoryEntry = async (id: string) => { 
        if (!confirm("¿Está seguro de que desea eliminar este presupuesto del historial? Esta acción es permanente.")) {
            return;
        }

        setIsLoading(true);
        try {
            await deleteBudgetFromFirestore(id);
            await fetchHistory(); // Recarga la lista
            alert("Entrada eliminada de la base de datos.");
        } catch (error) {
            alert("Error al eliminar el presupuesto de la base de datos.");
        } finally {
            setIsLoading(false);
        }
    }
    
    // --- MANEJADORES DE ESTADO Y UI (Mantenidos) ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBudgetData({ ...budgetData, [e.target.name]: e.target.value });
    };

    const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewItem(prev => {
            const parsedValue = (name === 'descripcion' ? value : parseFloat(value) || 0);
            
            const updatedItem = { 
                ...prev, 
                [name]: parsedValue 
            };
            
            const cantidad = name === 'cantidad' ? parsedValue : updatedItem.cantidad;
            const precioUnitarioUSD = name === 'precioUnitarioUSD' ? parsedValue : updatedItem.precioUnitarioUSD;
            const totalUSD = cantidad * precioUnitarioUSD;
            
            return { 
                ...updatedItem, 
                totalUSD: totalUSD 
            };
        });
    };

    const handleAddItem = () => {
        if (newItem.descripcion && newItem.cantidad > 0 && newItem.precioUnitarioUSD >= 0) {
            const itemToAdd: BudgetItem = { 
                ...newItem, 
                id: Date.now(),
                totalUSD: newItem.cantidad * newItem.precioUnitarioUSD
            };
            setBudgetData(prev => ({ ...prev, items: [...prev.items, itemToAdd] }));
            setNewItem({ descripcion: '', cantidad: 1, precioUnitarioUSD: 0 }); 
        } else {
            alert("Por favor, rellene todos los campos del ítem correctamente.");
        }
    };

    const handleRemoveItem = (id: number) => {
        setBudgetData(prev => ({ 
            ...prev, 
            items: prev.items.filter(item => item.id !== id) 
        }));
    };
    
    /**
     * 🔁 Carga un presupuesto del historial al formulario.
     */
    const handleLoadBudget = (entry: HistoryEntry) => {
        const { id, dateCreated, totalUSD, ...dataToLoad } = entry; 
        setBudgetData(dataToLoad);
        alert(`Presupuesto para ${entry.clienteNombre} cargado al formulario.`);
    };

    /**
     * FUNCIÓN PRINCIPAL DE GENERACIÓN DE PDF (Usa la fecha persistente del historial si se proporciona)
     */
    const handleGeneratePDF = async (entry?: HistoryEntry) => { 
        const dataToUse = entry || budgetData;
        
        // 1. DETERMINAR LA FECHA A USAR: usa la fecha de creación persistente si existe, si no, la fecha actual.
        const dateToPrint = entry?.dateCreated 
            ? new Date(entry.dateCreated) 
            : new Date();                 
            
        // Formatear la fecha para el PDF
        const dateString = dateToPrint.toLocaleDateString('es-VE', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });

        if (!pdfLogoBase64) {
            alert("Por favor, cargue el logo de la compañía antes de generar el presupuesto.");
            return;
        }
        if (!dataToUse.clienteNombre) {
            alert("Por favor, ingrese el nombre del cliente.");
            return;
        }
        if (dataToUse.items.length === 0) {
            alert("El presupuesto debe tener al menos un ítem.");
            return;
        }
        
        const total = dataToUse.items.reduce((sum, item) => sum + item.totalUSD, 0);

        const budgetDataForPDF = {
            titulo: 'Presupuesto de Servicio', 
            clienteNombre: dataToUse.clienteNombre,
            clienteCedula: '', 
            items: dataToUse.items,
            totalUSD: total,
            fechaCreacion: dateString, // 👈 Se usa la fecha correcta (original o actual)
        };

        const pdfOptions = {
            bcvRate: currentBcvRate,
            firmaBase64: firmaBase64,
            selloBase64: selloBase64,
        };

        try {
            await generateBudgetPDF(budgetDataForPDF, pdfLogoBase64, pdfOptions);
        } catch (error) {
            console.error("Error al generar el PDF del presupuesto:", error);
            alert("Error al generar el PDF. Verifique la consola para detalles.");
        }
    };


    return (
        <div className="p-4 space-y-8 max-w-4xl mx-auto">
            {/* TÍTULO PRINCIPAL */}
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-4">
                Generador de Presupuestos
            </h2>
            
            {/* GRUPO DE BOTONES: LOGO, FIRMA Y SELLO (Omitido por espacio, funcionalidad mantenida) */}
            <Card className="shadow-none border border-gray-200 dark:border-gray-700">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-300">Activos para Documento (Opcional)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        {/* 1. Logo PDF */}
                        <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <input type="file" accept="image/png, image/jpeg, image/svg+xml" id="pdf-logo-upload" className="hidden" onChange={handleLogoUpload}/>
                            <Button variant={pdfLogoBase64 ? 'default' : 'outline'} size="sm" onClick={() => document.getElementById('pdf-logo-upload')?.click()} title={pdfLogoBase64 ? 'Cambiar Logo PDF' : 'Añadir Logo PDF'} className="transition-colors duration-200">
                                <Image className="w-4 h-4 mr-2"/> {pdfLogoBase64 ? 'Logo Cargado' : 'Logo Compañía'}
                            </Button>
                            {pdfLogoBase64 && (<Button variant="ghost" size="icon" onClick={handleClearLogo} title="Eliminar logo PDF"> <X className="w-4 h-4 text-gray-500 hover:text-red-500" /> </Button>)}
                        </div>
                        
                        {/* 2. Firma PDF */}
                        <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <input type="file" accept="image/png, image/jpeg" id="pdf-firma-upload" className="hidden" onChange={handleFirmaUpload}/>
                            <Button variant={firmaBase64 ? 'default' : 'outline'} size="sm" onClick={() => document.getElementById('pdf-firma-upload')?.click()} title={firmaBase64 ? 'Cambiar Firma PDF' : 'Añadir Firma PDF'} className="transition-colors duration-200">
                                <Handshake className="w-4 h-4 mr-2"/> {firmaBase64 ? 'Firma Cargada' : 'Añadir Firma'}
                            </Button>
                            {firmaBase64 && (<Button variant="ghost" size="icon" onClick={handleClearFirma} title="Eliminar Firma PDF"><X className="w-4 h-4 text-gray-500 hover:text-red-500" /></Button>)}
                        </div>
                        
                        {/* 3. Sello PDF */}
                        <div className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                            <input type="file" accept="image/png, image/jpeg" id="pdf-sello-upload" className="hidden" onChange={handleSelloUpload}/>
                            <Button variant={selloBase64 ? 'default' : 'outline'} size="sm" onClick={() => document.getElementById('pdf-sello-upload')?.click()} title={selloBase64 ? 'Cambiar Sello PDF' : 'Añadir Sello PDF'} className="transition-colors duration-200">
                                <Stamp className="w-4 h-4 mr-2"/> {selloBase64 ? 'Sello Cargado' : 'Añadir Sello'}
                            </Button>
                            {selloBase64 && (<Button variant="ghost" size="icon" onClick={handleClearSello} title="Eliminar Sello PDF"><X className="w-4 h-4 text-gray-500 hover:text-red-500" /></Button>)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Formulario de Datos del Presupuesto */}
            <Card className="shadow-none border border-gray-200 dark:border-gray-700">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-300">Información del Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4"> 
                        <div className="space-y-2">
                            <Label htmlFor="clienteNombre">Nombre o Razón Social del Cliente</Label>
                            <Input id="clienteNombre" name="clienteNombre" value={budgetData.clienteNombre} onChange={handleInputChange} required className="focus:border-blue-500 dark:focus:border-blue-400"/>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla y Formulario de Items */}
            <Card className="shadow-none border border-gray-200 dark:border-gray-700">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-300">Detalle de Ítems</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Formulario de Nuevo Ítem */}
                    <div className="grid grid-cols-5 gap-4 items-end border-b pb-4 mb-4">
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="item-desc">Descripción</Label>
                            <Input id="item-desc" name="descripcion" value={newItem.descripcion} onChange={handleNewItemChange} placeholder="Servicio, Material, etc."/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-qty">Cantidad</Label>
                            <Input id="item-qty" name="cantidad" type="number" value={newItem.cantidad} onChange={handleNewItemChange} min="1"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-price">Precio Unit. (USD)</Label>
                            <Input id="item-price" name="precioUnitarioUSD" type="number" step="0.01" value={newItem.precioUnitarioUSD} onChange={handleNewItemChange} min="0"/>
                        </div>
                        <Button onClick={handleAddItem} className="h-10 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors">
                            <Plus className="w-4 h-4 mr-2"/> Añadir
                        </Button>
                    </div>

                    {/* Tabla de Ítems */}
                    <Table className="border-t border-gray-200 dark:border-gray-700">
                        <TableHeader>
                            <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-700">
                                <TableHead className="w-[40%] font-semibold text-gray-700 dark:text-gray-300">Descripción</TableHead>
                                <TableHead className="w-[15%] text-right font-semibold text-gray-700 dark:text-gray-300">Cantidad</TableHead>
                                <TableHead className="w-[20%] text-right font-semibold text-gray-700 dark:text-gray-300">Precio Unit. (USD)</TableHead>
                                <TableHead className="w-[20%] text-right font-semibold text-gray-700 dark:text-gray-300">Total (USD)</TableHead>
                                <TableHead className="w-[5%]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {budgetData.items.map(item => (
                                <TableRow key={item.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <TableCell className="font-medium text-gray-800 dark:text-gray-200">{item.descripcion}</TableCell>
                                    <TableCell className="text-right text-gray-600 dark:text-gray-400">{item.cantidad}</TableCell>
                                    <TableCell className="text-right text-gray-600 dark:text-gray-400">${item.precioUnitarioUSD.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-semibold text-gray-800 dark:text-gray-200">${item.totalUSD.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="opacity-70 hover:opacity-100">
                                            <Trash2 className="w-4 h-4 text-red-500"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {budgetData.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-400 italic py-8">
                                        No hay ítems en el presupuesto. Agregue un servicio o material.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    
                    {/* Resumen de Totales y Botones de Acción */}
                    <div className="flex justify-between pt-4">
                         {/* Botón de Guardar Historial en DB */}
                        <Button 
                            onClick={handleSaveBudget} 
                            className="h-10 px-4 text-base bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors duration-200 shadow-md"
                            disabled={budgetData.items.length === 0 || !budgetData.clienteNombre || isLoading}
                        >
                            <Save className="w-4 h-4 mr-2"/> {isLoading ? 'Guardando...' : 'Guardar Presupuesto en DB'}
                        </Button>

                        <div className="w-full max-w-sm space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between text-lg font-bold text-gray-800 dark:text-gray-100">
                                <span>Total USD:</span> 
                                <span className="text-xl text-blue-600 dark:text-blue-400">${totalCalculations.totalUSD.toFixed(2)}</span>
                            </div>
                            <Separator className="bg-gray-300 dark:bg-gray-600"/> 
                            <p className="text-sm text-right text-gray-600 dark:text-gray-400">Tasa BCV Referencial: **1 USD = {currentBcvRate.toFixed(2)} VES**</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Botón de Generar PDF (usa la fecha actual) */}
            <div className="flex justify-end pt-4">
                <Button 
                    onClick={() => handleGeneratePDF()} 
                    className="h-12 px-8 text-lg bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 transition-colors duration-200 shadow-md"
                    disabled={budgetData.items.length === 0 || !budgetData.clienteNombre || !pdfLogoBase64}
                >
                    <FileText className="w-5 h-5 mr-2"/> Generar Presupuesto PDF
                </Button>
            </div>
            
            <Separator className="my-8"/>

            {/* SECCIÓN DE HISTORIAL DESDE FIREBASE */}
            <Card className="shadow-none border border-gray-200 dark:border-gray-700">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                        <Clock className="w-5 h-5 mr-2"/> Historial de Presupuestos ({history.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Indicador de Carga */}
                    {isLoading && (
                        <div className="flex justify-center items-center p-6 text-blue-500">
                            <Loader2 className="w-5 h-5 mr-2 animate-spin"/> Cargando datos desde la base de datos...
                        </div>
                    )}
                    
                    {/* Tabla de Historial */}
                    {!isLoading && (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-700">
                                    <TableHead className="w-[40%] font-semibold text-gray-700 dark:text-gray-300">Cliente</TableHead>
                                    <TableHead className="w-[20%] text-right font-semibold text-gray-700 dark:text-gray-300">Total (USD)</TableHead>
                                    <TableHead className="w-[20%] font-semibold text-gray-700 dark:text-gray-300">Creado</TableHead>
                                    <TableHead className="w-[20%] text-right font-semibold text-gray-700 dark:text-gray-300">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.length > 0 ? (
                                    history.map((entry) => (
                                        <TableRow key={entry.id} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                                            <TableCell className="font-medium">{entry.clienteNombre}</TableCell>
                                            <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">${entry.totalUSD.toFixed(2)}</TableCell>
                                            <TableCell>{new Date(entry.dateCreated).toLocaleDateString('es-VE')}</TableCell> 
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="icon" onClick={() => handleLoadBudget(entry)} title="Cargar a Formulario" disabled={isLoading}>
                                                    <Plus className="w-4 h-4"/>
                                                </Button>
                                                <Button variant="default" size="icon" onClick={() => handleGeneratePDF(entry)} title="Descargar PDF" disabled={isLoading}>
                                                    <Download className="w-4 h-4"/> {/* Genera PDF con la fecha original */}
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveHistoryEntry(entry.id)} title="Eliminar" disabled={isLoading}>
                                                    <Trash2 className="w-4 h-4 text-red-500"/>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-500 dark:text-gray-400 italic py-6">
                                            El historial de presupuestos está vacío. Guarde su primer presupuesto en la base de datos.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}