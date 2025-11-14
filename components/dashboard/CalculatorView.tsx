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
    Zap, 
    DollarSign, 
    Timer,
    ArrowRight, 
    Euro, 
    Trash2, 
    Plus,
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

// --- Componente de Visualización de Resultados en Multidivisa ---
interface MultiCurrencyResultProps {
    usdAmount: number | null;
    rates: ExchangeRates;
    title: string;
}

const MultiCurrencyResult: React.FC<MultiCurrencyResultProps> = ({ usdAmount, rates, title }) => {
    if (usdAmount === null || usdAmount <= 0) return null;

    const bsAmount = rates.usdRate ? usdAmount * rates.usdRate : null;
    // Cálculo de EUR usando tasa cruzada (USD a Bs, luego Bs a EUR)
    const eurAmount = rates.usdRate && rates.eurRate ? (usdAmount * rates.usdRate) / rates.eurRate : null;

    return (
        <div className="mt-4 p-4 border rounded-md bg-green-50 dark:bg-green-900/20 space-y-2">
            <h4 className="font-semibold text-lg">{title}:</h4>
            
            <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${usdAmount.toFixed(2)} USD
                </span>
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>

            {bsAmount !== null && (
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 border-t pt-1">
                    <span>Equivalente en Bolívares (Bs):</span>
                    <strong className="text-primary font-bold">Bs {bsAmount.toFixed(2)}</strong>
                </div>
            )}
             {eurAmount !== null && (
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Equivalente en Euros (€):</span>
                    <strong className="text-primary font-bold">€ {eurAmount.toFixed(2)}</strong>
                </div>
            )}
            
            {rates.loading && <p className="text-xs text-yellow-600 mt-2">Cargando tasas BCV...</p>}
            {rates.error && <p className="text-xs text-red-600 mt-2">Error en tasas BCV.</p>}
        </div>
    );
};


// --- CÁLCULO 1: COSTO POR METRO CUADRADO ---
interface MetroCuadradoCalculatorProps {
    rates: ExchangeRates;
}

const MetroCuadradoCalculator: React.FC<MetroCuadradoCalculatorProps> = ({ rates }) => {
    const [cmAlto, setCmAlto] = useState<number>(0);
    const [cmAncho, setCmAncho] = useState<number>(0);
    const [precioDolar, setPrecioDolar] = useState<number>(0);
    const [resultado, setResultado] = useState<number | null>(null);

    const calcularInstantaneo = useCallback(() => {
        if (cmAlto <= 0 || cmAncho <= 0 || precioDolar <= 0) {
            setResultado(null);
            return;
        }

        const altoEnMetros = cmAlto / 100;
        const anchoEnMetros = cmAncho / 100;
        const costoTotal = altoEnMetros * anchoEnMetros * precioDolar;
        
        setResultado(costoTotal);
    }, [cmAlto, cmAncho, precioDolar]);

    useEffect(() => {
        calcularInstantaneo();
    }, [calcularInstantaneo]);

    return (
        <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
                Cálculo: (Alto en cm / 100) × (Ancho en cm / 100) × Precio/m² (USD)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Etiqueta para Alto (cm) */}
                <div className="space-y-2">
                    <label htmlFor="alto-cm" className="text-sm font-medium block">Alto (cm)</label>
                    <Input 
                        id="alto-cm"
                        type="number" 
                        value={cmAlto} 
                        onChange={(e) => setCmAlto(parseFloat(e.target.value) || 0)} 
                        placeholder="ej. 50"
                    />
                </div>
                {/* Etiqueta para Ancho (cm) */}
                <div className="space-y-2">
                    <label htmlFor="ancho-cm" className="text-sm font-medium block">Ancho (cm)</label>
                    <Input 
                        id="ancho-cm"
                        type="number" 
                        value={cmAncho} 
                        onChange={(e) => setCmAncho(parseFloat(e.target.value) || 0)} 
                        placeholder="ej. 80"
                    />
                </div>
                {/* Etiqueta para Precio por m² */}
                <div className="space-y-2">
                    <label htmlFor="precio-m2" className="text-sm font-medium block">Precio por m² (USD)</label>
                    <Input 
                        id="precio-m2"
                        type="number" 
                        value={precioDolar} 
                        onChange={(e) => setPrecioDolar(parseFloat(e.target.value) || 0)} 
                        placeholder="ej. 25.00"
                    />
                </div>
            </div>

            <MultiCurrencyResult 
                usdAmount={resultado} 
                rates={rates} 
                title="Costo Total Estimado del Material" 
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
            // Asegura que los valores sean números positivos
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
            
            {/* NUEVO/MEJORADO: Mostrar el tiempo total de corte */}
            {resultado?.totalMinutes !== undefined && resultado.totalMinutes > 0 && (
                 <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-md">
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        Tiempo Total de Corte: 
                        <strong className="ml-2 text-xl text-blue-600 dark:text-blue-400">
                            {resultado.totalMinutes.toFixed(3)} minutos
                        </strong>
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