// @/components/dashboard/CalculatorView.tsx

"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Calculator as CalcIcon, 
    Ruler, 
    DollarSign, 
    Timer,
    ArrowRight, 
    Euro, 
    Trash2, // Asegurado para el nuevo MetroCuadradoCalculator
    Plus,    // Asegurado para el nuevo MetroCuadradoCalculator
    Loader2 
} from "lucide-react";
// Importar el servicio BCV para obtener las tasas
import { fetchBCVRateFromAPI } from "@/lib/bcv-service"; 

// --- Tipado para las tasas de cambio ---
interface ExchangeRates {
    usdRate: number | null; // Tasa Bs por 1 USD
    eurRate: number | null; // Tasa Bs por 1 EUR
    loading: boolean;
    error: string | null;
}

// --- UTILIDAD: Función para convertir minutos decimales a formato mm:ss ---
const formatTimeInMinutes = (totalMinutes: number): string => {
    if (totalMinutes < 0) return "00:00";
    
    // Obtener la parte entera de los minutos
    const minutes = Math.floor(totalMinutes);
    
    // Obtener los segundos restantes (la parte decimal * 60)
    const secondsDecimal = (totalMinutes - minutes) * 60;
    // Redondear a un entero (o usar Math.round si prefieres)
    const seconds = Math.round(secondsDecimal);

    // Formatear a mm:ss con padding de cero
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
};


// --- Componente de Visualización de Resultados en Multidivisa ---
interface MultiCurrencyResultProps {
    usdAmount: number | null;
    rates: ExchangeRates;
    title: string;
}

const MultiCurrencyResult: React.FC<MultiCurrencyResultProps> = ({ usdAmount, rates, title }) => {
    if (usdAmount === null || usdAmount <= 0) return null;

    // Tasa de Bolívares (Bs) PRINCIPAL (usando la tasa del Euro para el cobro)
    // Se multiplica el monto en USD por la tasa del Euro/Bs
    const bsAmount_euroRate = rates.eurRate ? usdAmount * rates.eurRate : null;
    
    // Tasa de Bolívares (Bs) SECUNDARIA (usando la tasa del Dólar para referencia)
    const bsAmount_usdRate = rates.usdRate ? usdAmount * rates.usdRate : null;

    return (
        <div className="mt-4 p-4 border rounded-md bg-green-50 dark:bg-green-900/20 space-y-2">
            <h4 className="font-semibold text-lg">{title}:</h4>
            
            {/* Monto principal en USD */}
            <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${usdAmount.toFixed(2)} USD
                </span>
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>

            {/* Resultado Principal en Bolívares (Cobro con Tasa Euro) */}
            {bsAmount_euroRate !== null && (
                <div className="flex justify-between text-base font-bold text-primary border-t pt-2">
                    <span className="font-bold">Total a Cobrar en Bolívares (Tasa EUR):</span>
                    <strong className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                        Bs {bsAmount_euroRate.toFixed(2)}
                    </strong>
                </div>
            )}
            
            {/* Resultado Secundario en Bolívares (Referencia con Tasa Dólar) */}
            {bsAmount_usdRate !== null && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>(Referencia Tasa BCV USD):</span>
                    <strong className="text-sm">Bs {bsAmount_usdRate.toFixed(2)}</strong>
                </div>
            )}
            
            {rates.loading && <p className="text-xs text-yellow-600 mt-2">Cargando tasas BCV...</p>}
            {rates.error && <p className="text-xs text-red-600 mt-2">Error en tasas BCV.</p>}
        </div>
    );
};


// --- Tipado para una medición individual ---
interface Measurement {
    id: number; // Para una clave única en el renderizado
    cmAlto: number;
    cmAncho: number;
    precioDolar: number; // Precio por m² (USD)
}

// --- CÁLCULO 1: COSTO POR METRO CUADRADO (MODIFICADO PARA MÚLTIPLES ENTRADAS) ---
interface MetroCuadradoCalculatorProps {
    rates: ExchangeRates;
}

const MetroCuadradoCalculator: React.FC<MetroCuadradoCalculatorProps> = ({ rates }) => {
    // Inicializar el estado con una medición por defecto
    const [mediciones, setMediciones] = useState<Measurement[]>([
        { id: Date.now(), cmAlto: 0, cmAncho: 0, precioDolar: 0 }
    ]);
    const [resultadoTotal, setResultadoTotal] = useState<number | null>(null);

    const calcularInstantaneo = useCallback(() => {
        let costoTotalAcumulado = 0;
        let algunaMedicionValida = false;

        mediciones.forEach(m => {
            if (m.cmAlto > 0 && m.cmAncho > 0 && m.precioDolar > 0) {
                const altoEnMetros = m.cmAlto / 100;
                const anchoEnMetros = m.cmAncho / 100;
                const costoIndividual = altoEnMetros * anchoEnMetros * m.precioDolar;
                costoTotalAcumulado += costoIndividual;
                algunaMedicionValida = true;
            }
        });

        setResultadoTotal(algunaMedicionValida ? costoTotalAcumulado : null);
    }, [mediciones]);

    useEffect(() => {
        calcularInstantaneo();
    }, [calcularInstantaneo]);

    // --- MANEJO DE ESTADO PARA LAS MEDICIONES ---
    
    const addMeasurementEntry = () => {
        // Usamos Date.now() para generar un ID único para la key
        setMediciones([...mediciones, { id: Date.now(), cmAlto: 0, cmAncho: 0, precioDolar: 0 }]);
    };

    const updateMeasurementEntry = (id: number, field: keyof Omit<Measurement, 'id'>, value: number) => {
        const newMediciones = mediciones.map(m => 
            m.id === id 
                ? { ...m, [field]: value >= 0 ? value : 0 }
                : m
        );
        setMediciones(newMediciones);
    };

    const removeMeasurementEntry = (id: number) => {
        const newMediciones = mediciones.filter(m => m.id !== id);
        // Si no quedan mediciones, añadir una vacía para mantener la interfaz
        setMediciones(newMediciones.length > 0 ? newMediciones : [{ id: Date.now(), cmAlto: 0, cmAncho: 0, precioDolar: 0 }]);
    };
    
    // Función de utilidad para mostrar el costo individual 
    const getIndividualCost = (m: Measurement): string | null => {
        if (m.cmAlto > 0 && m.cmAncho > 0 && m.precioDolar > 0) {
            const altoEnMetros = m.cmAlto / 100;
            const anchoEnMetros = m.cmAncho / 100;
            const cost = altoEnMetros * anchoEnMetros * m.precioDolar;
            return `$${cost.toFixed(2)} USD`;
        }
        return null;
    };


    return (
        <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
                Fórmula de Costo Individual: (Alto en cm / 100) × (Ancho en cm / 100) × Precio/m² (USD)
            </p>
            
            {mediciones.map((m, index) => (
                <div key={m.id} className="border p-4 rounded-lg space-y-4 shadow-sm relative">
                    <div className="flex justify-between items-start">
                        <h4 className="text-base font-bold text-primary">Medición #{index + 1}</h4>
                        {mediciones.length > 1 && (
                             <Button 
                                variant="destructive"
                                size="icon" 
                                onClick={() => removeMeasurementEntry(m.id)}
                                title="Eliminar esta medición"
                                className="flex-shrink-0 w-8 h-8"
                            >
                                <Trash2 className="w-4 h-4" /> 
                            </Button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Input para Alto (cm) */}
                        <div className="space-y-2">
                            <label htmlFor={`alto-cm-${m.id}`} className="text-sm font-medium block">Alto (cm)</label>
                            <Input 
                                id={`alto-cm-${m.id}`}
                                type="number" 
                                value={m.cmAlto} 
                                onChange={(e) => updateMeasurementEntry(m.id, 'cmAlto', parseFloat(e.target.value) || 0)} 
                                placeholder="ej. 50"
                            />
                        </div>
                        {/* Input para Ancho (cm) */}
                        <div className="space-y-2">
                            <label htmlFor={`ancho-cm-${m.id}`} className="text-sm font-medium block">Ancho (cm)</label>
                            <Input 
                                id={`ancho-cm-${m.id}`}
                                type="number" 
                                value={m.cmAncho} 
                                onChange={(e) => updateMeasurementEntry(m.id, 'cmAncho', parseFloat(e.target.value) || 0)} 
                                placeholder="ej. 80"
                            />
                        </div>
                        {/* Input para Precio por m² */}
                        <div className="space-y-2">
                            <label htmlFor={`precio-m2-${m.id}`} className="text-sm font-medium block">Precio por m² (USD)</label>
                            <Input 
                                id={`precio-m2-${m.id}`}
                                type="number" 
                                value={m.precioDolar} 
                                onChange={(e) => updateMeasurementEntry(m.id, 'precioDolar', parseFloat(e.target.value) || 0)} 
                                placeholder="ej. 25.00"
                            />
                        </div>
                    </div>

                    {/* Mostrar costo individual (Opcional, pero útil) */}
                    {getIndividualCost(m) && (
                        <div className="text-right text-sm font-medium text-green-700 dark:text-green-300 pt-2 border-t">
                            Costo Individual: <strong>{getIndividualCost(m)}</strong>
                        </div>
                    )}
                </div>
            ))}
            
            <Button 
                variant="secondary"
                onClick={addMeasurementEntry} 
                className="w-full mt-4"
                title="Añadir otra dimensión/cálculo"
            >
                <Plus className="w-4 h-4 mr-2" /> Añadir Otra Medición 
            </Button>


            <MultiCurrencyResult 
                usdAmount={resultadoTotal} 
                rates={rates} 
                title="Costo Total Estimado Acumulado" 
            />
        </CardContent>
    );
};


// --- CÁLCULO 2: CORTES LÁSER POR TIEMPO ---
interface LaserCutsCalculatorProps {
    rates: ExchangeRates;
}

const LaserCutsCalculator: React.FC<LaserCutsCalculatorProps> = ({ rates }) => {
    const [tiempos, setTiempos] = useState<Array<{ minutes: number; seconds: number }>>([
        { minutes: 0, seconds: 0 }
    ]);
    const COSTO_POR_MINUTO = 0.80; 
    const [resultado, setResultado] = useState<{ totalMinutes: number; totalCost: number } | null>(null);

    const calcularInstantaneo = useCallback(() => {
        let totalTimeInMinutes = 0;

        tiempos.forEach(t => {
            const minutes = Math.max(0, t.minutes || 0);
            const seconds = Math.max(0, t.seconds || 0);

            const timeInMinutes = minutes + (seconds / 60);
            totalTimeInMinutes += timeInMinutes;
        });

        if (totalTimeInMinutes <= 0) {
            setResultado(null);
            return;
        }

        const totalCost = totalTimeInMinutes * COSTO_POR_MINUTO;

        setResultado({ totalMinutes: totalTimeInMinutes, totalCost: totalCost });
    }, [tiempos]);

    useEffect(() => {
        calcularInstantaneo();
    }, [calcularInstantaneo]);


    const addTimeEntry = () => {
        setTiempos([...tiempos, { minutes: 0, seconds: 0 }]);
    };

    const updateTimeEntry = (index: number, field: 'minutes' | 'seconds', value: number) => {
        const newTiempos = [...tiempos];
        newTiempos[index] = {
            ...newTiempos[index],
            [field]: value >= 0 ? value : 0
        };
        setTiempos(newTiempos);
    };
    
    const removeTimeEntry = (index: number) => {
        const newTiempos = tiempos.filter((_, i) => i !== index);
        setTiempos(newTiempos.length > 0 ? newTiempos : [{ minutes: 0, seconds: 0 }]);
    };


    return (
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Costo del corte láser: ${COSTO_POR_MINUTO.toFixed(2)} por minuto.
            </p>
            
            {tiempos.map((t, index) => (
                <div key={index} className="flex items-end space-x-2 border-b pb-3">
                    <div className="flex-1 space-y-1">
                        <label className="text-base font-semibold block mb-2">Corte #{index + 1}</label>
                        <div className="flex space-x-2">
                            {/* Etiqueta para Minutos */}
                            <div className="flex-1 space-y-1">
                                <label htmlFor={`min-${index}`} className="text-sm font-medium block">Minutos</label>
                                <Input 
                                    id={`min-${index}`}
                                    type="number" 
                                    value={t.minutes} 
                                    onChange={(e) => updateTimeEntry(index, 'minutes', parseFloat(e.target.value) || 0)} 
                                    placeholder="0"
                                    className="w-full"
                                />
                            </div>
                            {/* Etiqueta para Segundos */}
                            <div className="flex-1 space-y-1">
                                <label htmlFor={`sec-${index}`} className="text-sm font-medium block">Segundos</label>
                                <Input 
                                    id={`sec-${index}`}
                                    type="number" 
                                    value={t.seconds} 
                                    onChange={(e) => updateTimeEntry(index, 'seconds', parseFloat(e.target.value) || 0)} 
                                    placeholder="0"
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                    {tiempos.length > 1 && (
                        <Button 
                            variant="destructive"
                            size="icon" 
                            onClick={() => removeTimeEntry(index)}
                            title="Eliminar este corte"
                            className="flex-shrink-0 mb-0.5"
                        >
                            <Trash2 className="w-4 h-4" /> 
                        </Button>
                    )}
                </div>
            ))}
            
            <Button 
                variant="secondary"
                onClick={addTimeEntry} 
                className="w-full mt-2"
                title="Añadir un nuevo corte/tiempo"
            >
                <Plus className="w-4 h-4 mr-2" /> Añadir Otro Tiempo de Corte 
            </Button>
            
            {/* MEJORA: Mostrar el tiempo total de corte en formato mm:ss */}
            {resultado?.totalMinutes !== undefined && resultado.totalMinutes > 0 && (
                 <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Tiempo Total de Corte: 
                        <strong className="ml-2 text-xl text-blue-600 dark:text-blue-400">
                            {formatTimeInMinutes(resultado.totalMinutes)}
                        </strong>
                        <span className="text-sm text-muted-foreground ml-1">(mm:ss)</span>
                    </p>
                 </div>
            )}

            <MultiCurrencyResult 
                usdAmount={resultado ? resultado.totalCost : null} 
                rates={rates} 
                title="Costo Total de Cortes Estimado" 
            />
        </CardContent>
    );
};


// --- CÁLCULO 3: CONVERSOR DE DIVISAS ---
const CurrencyConverterCalculator: React.FC<{ rates: ExchangeRates }> = ({ rates }) => {
    const { usdRate, eurRate, loading, error } = rates;
    const [amount, setAmount] = useState<number>(1);
    const [isUsdToBs, setIsUsdToBs] = useState(true); 
    const [resultBs, setResultBs] = useState<number | null>(null);

    const handleCalculate = useCallback((currentUsdRate: number | null, currentEurRate: number | null, currentAmount: number, currentMode: boolean) => {
        let rate = 0;

        if (currentMode && currentUsdRate) {
            rate = currentUsdRate;
        } else if (!currentMode && currentEurRate) {
            rate = currentEurRate;
        } else {
            setResultBs(null);
            return;
        }

        const calculatedBs = currentAmount * rate;
        setResultBs(calculatedBs);
    }, []);

    const toggleMode = () => {
        const newMode = !isUsdToBs;
        setIsUsdToBs(newMode);
        handleCalculate(usdRate, eurRate, amount, newMode);
    };

    useEffect(() => {
        handleCalculate(usdRate, eurRate, amount, isUsdToBs);
    }, [amount, usdRate, eurRate, isUsdToBs, handleCalculate]);


    const currentRate = isUsdToBs ? usdRate : eurRate;
    const currentCurrency = isUsdToBs ? 'USD' : 'EUR';
    const otherRateAvailable = isUsdToBs ? (eurRate !== null) : (usdRate !== null);

    return (
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Convierte Dólares/Euros a Bolívares (Bs) usando la tasa BCV actual.
            </p>
            
            {loading && (
                 <div className="p-4 bg-yellow-50/50 rounded-md text-sm text-yellow-700 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin"/>Cargando tasas de cambio...
                </div>
            )}
            
            {error && (
                <div className="p-4 bg-red-50/50 rounded-md text-sm text-red-700">{error}</div>
            )}

            {currentRate && !loading && (
                <>
                    <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                        <span className="text-sm font-semibold">Tasa Actual ({currentCurrency}):</span>
                        <span className="text-lg font-bold text-primary">
                            Bs {currentRate.toFixed(2)}
                        </span>
                    </div>

                    <div className="flex gap-2 items-center">
                        {/* Etiqueta para Monto a Convertir */}
                        <div className="flex-1 space-y-2">
                            <label htmlFor="monto-convertir" className="text-sm font-medium block">Monto ({currentCurrency})</label>
                            <Input 
                                id="monto-convertir"
                                type="number" 
                                value={amount} 
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} 
                                placeholder="1.00"
                                className="text-lg font-semibold"
                            />
                        </div>

                        <ArrowRight className="w-5 h-5 mt-7 text-muted-foreground flex-shrink-0" />
                        
                        {/* Etiqueta para Resultado */}
                        <div className="flex-1 space-y-2">
                            <label htmlFor="resultado-bs" className="text-sm font-medium block">Resultado (Bs)</label>
                            <Input 
                                id="resultado-bs"
                                type="text" 
                                value={resultBs !== null ? resultBs.toFixed(2) : "Calculando..."} 
                                readOnly
                                className="text-lg font-semibold bg-primary/10 border-primary"
                            />
                        </div>
                    </div>
                    
                    {otherRateAvailable && (
                        <Button
                            variant="outline"
                            onClick={toggleMode}
                            className="w-full mt-2 gap-2"
                        >
                            <Euro className="w-4 h-4" />
                            {isUsdToBs ? `Cambiar a EUR a Bs` : `Cambiar a USD a Bs`}
                        </Button>
                    )}
                </>
            )}
        </CardContent>
    );
};


// --- COMPONENTE PRINCIPAL (VISTA) ---

const CalculatorView: React.FC = () => {
    const [activeTab, setActiveTab] = useState("currency"); 
    const [rates, setRates] = useState<ExchangeRates>({ 
        usdRate: null, 
        eurRate: null, 
        loading: true, 
        error: null 
    });

    useEffect(() => {
        const loadRates = async () => {
            try {
                setRates(r => ({ ...r, loading: true, error: null }));
                // @ts-ignore
                const data = await fetchBCVRateFromAPI();
                
                // @ts-ignore
                const currentUsdRate = data.usdRate ?? data.rate;
                // @ts-ignore
                const currentEurRate = data.eurRate ?? null; 

                setRates({
                    usdRate: currentUsdRate,
                    eurRate: currentEurRate,
                    loading: false,
                    error: null,
                });

            } catch (err) {
                console.error("Error al cargar tasas de BCV:", err);
                setRates(r => ({ ...r, loading: false, error: "No se pudieron cargar las tasas de cambio BCV." }));
            }
        };
        loadRates();
    }, []);

    return (
        <div className="p-4 lg:p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center text-3xl font-bold">
                            <CalcIcon className="w-7 h-7 mr-3 text-primary" /> 
                            Calculadora de Producción
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3"> 
                                <TabsTrigger value="currency" className="flex items-center"><DollarSign className="w-4 h-4 mr-1"/> Divisas</TabsTrigger> 
                                <TabsTrigger value="area" className="flex items-center"><Ruler className="w-4 h-4 mr-1"/> Costo m²</TabsTrigger>
                                <TabsTrigger value="laser" className="flex items-center"><Timer className="w-4 h-4 mr-1"/> Corte Láser</TabsTrigger>
                            </TabsList>

                            <TabsContent value="currency">
                                <CurrencyConverterCalculator rates={rates} />
                            </TabsContent>
                            
                            <TabsContent value="area">
                                <MetroCuadradoCalculator rates={rates} />
                            </TabsContent>
                            
                            <TabsContent value="laser">
                                <LaserCutsCalculator rates={rates} />
                            </TabsContent>
                            
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CalculatorView;