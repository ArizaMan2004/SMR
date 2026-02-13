// @/components/dashboard/TutorialController.tsx
"use client"

import { driver } from "driver.js"
import "driver.js/dist/driver.css" 

// --- 1. PASOS DEL DASHBOARD GENERAL (Vista 'orders') ---
const DASHBOARD_STEPS = [
    { 
        element: "#dashboard-header", 
        popover: { title: "👋 Panel Principal", description: "Tu centro de comando. Aquí ves el resumen general de tu negocio.", side: "bottom", align: 'start' } 
    },
    { 
        element: "#main-sidebar", 
        popover: { title: "📂 Menú", description: "Navega entre Facturación, Inventario, Taller y Administración.", side: "right", align: 'start' } 
    },
    { 
        element: "#tasas-container", 
        popover: { title: "💰 Tasas de Cambio", description: "Gestiona el valor del dólar BCV y Paralelo para tus cálculos.", side: "bottom", align: 'end' } 
    },
    { 
        element: "#stats-grid", 
        popover: { title: "📊 Métricas Rápidas", description: "Resumen de órdenes activas, cuentas por cobrar y trabajos finalizados.", side: "top", align: 'start' } 
    },
    { 
        element: "#btn-new-order", 
        popover: { title: "✨ Nueva Orden", description: "Crea una cotización o pedido desde cero aquí.", side: "left", align: 'center' } 
    }
];

// --- 2. PASOS DE INVENTARIO (Vista 'inventory_general') ---
const INVENTORY_STEPS = [
    { 
        element: "#inventory-header", 
        popover: { title: "📦 Gestión de Inventario", description: "Controla tu stock, entradas y salidas de material.", side: "bottom", align: 'start' } 
    },
    { 
        element: "#btn-edit-mode", 
        popover: { title: "✏️ Modo Edición", description: "Activa esto para eliminar productos o ajustar stock rápidamente.", side: "bottom", align: 'start' } 
    },
    { 
        element: "#inventory-tabs", 
        popover: { title: "📑 Historial", description: "Alterna entre ver existencias actuales o el historial de movimientos.", side: "top", align: 'start' } 
    }
];

// --- 3. PASOS DEL WIZARD DE ORDEN (Modal) ---
const WIZARD_STEPS = [
    { 
        element: "#wizard-header", 
        popover: { title: "📝 Creación de Orden", description: "Configura los detalles del pedido. El número se genera automático.", side: "bottom", align: 'center' } 
    },
    { 
        element: "#wizard-client-section", 
        popover: { title: "👤 Cliente", description: "Busca un cliente frecuente o selecciona 'Venta Directa'.", side: "right", align: 'center' } 
    },
    { 
        element: "#wizard-items-section", 
        popover: { title: "📦 Productos", description: "Agrega servicios de impresión, corte láser o artículos manuales.", side: "right", align: 'start' } 
    },
    { 
        element: "#wizard-footer-actions", 
        popover: { title: "✅ Finalizar", description: "Confirma la orden para guardarla en la base de datos.", side: "top", align: 'end' } 
    }
];

// --- 4. PASOS DE ESTADÍSTICAS (Vista 'financial_stats') ---
const STATS_STEPS = [
    { 
        element: "#stats-header", 
        popover: { 
            title: "📈 Centro Financiero", 
            description: "Filtra por mes, genera reportes PDF y cambia entre vista General, Impresión o Corte.", 
            side: "bottom", 
            align: 'start' 
        } 
    },
    { 
        element: "#financial-kpis", 
        popover: { 
            title: "💰 Indicadores Clave", 
            description: "Tu salud financiera en 3 números: Ingresos reales, Egresos operativos y Utilidad Neta.", 
            side: "top", 
            align: 'start' 
        } 
    },
    { 
        element: "#main-chart-section", 
        popover: { 
            title: "📊 Flujo de Caja", 
            description: "Visualiza ingresos vs gastos día a día. Haz clic en las barras para ver el detalle.", 
            side: "left", 
            align: 'center' 
        } 
    },
    { 
        element: "#debt-analysis-section", 
        popover: { 
            title: "⚠️ Cobranza", 
            description: "Monitorea quién te debe y la antigüedad de la deuda.", 
            side: "top", 
            align: 'start' 
        } 
    }
];

// --- FUNCIÓN PRINCIPAL ---
export const startTour = (currentView: string) => {
    
    // DEBUG: Abre la consola (F12) para ver qué vista está llegando
    console.log("🚀 Iniciando Tutorial. Vista actual recibida:", currentView);

    let steps: any[] = [];

    // LÓGICA DE SELECCIÓN DE TUTORIAL
    if (currentView === "inventory_general") {
        steps = INVENTORY_STEPS;
    } else if (currentView === "financial_stats") {
        steps = STATS_STEPS; // <--- ESTADÍSTICAS
    } else if (currentView === "order_wizard") {
        steps = WIZARD_STEPS;
    } else if (currentView === "orders" || currentView === "") {
        steps = DASHBOARD_STEPS;
    } else {
        console.warn("⚠️ Vista no reconocida, usando fallback:", currentView);
        // Fallback: Muestra solo 2 pasos básicos para que no se rompa
        steps = [DASHBOARD_STEPS[0], DASHBOARD_STEPS[1]]; 
    }

    const driverObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        doneBtnText: "¡Entendido!",
        nextBtnText: "Siguiente",
        prevBtnText: "Atrás",
        progressText: "{{current}} de {{total}}",
        
        stagePadding: 8,
        overlayOpacity: 0.6,
        
        steps: steps,
        
        onDestroyed: () => {
             // Limpieza si es necesaria
        }
    });

    driverObj.drive();
}

export default function TutorialController() { return null; }