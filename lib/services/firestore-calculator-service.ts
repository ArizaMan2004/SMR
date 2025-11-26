// src/lib/services/firestore-calculator-service.ts

import { db } from "@/lib/firebase/firebase-config";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, Timestamp } from "firebase/firestore";

// --- TIPOS (Coinciden con tu calculadora) ---

// Tipo para Costo m2
export interface AreaCalculation {
    id?: string;
    name: string;
    date: string; // Guardamos la fecha legible
    createdAt: any; // Timestamp para ordenar
    mediciones: any[]; // Array de tus mediciones
    totalCost: number;
    totalM2: number;
}

// Tipo para Láser
export interface LaserCalculation {
    id?: string;
    name: string;
    date: string;
    createdAt: any;
    tiempos: any[]; // Array de tus tiempos
    totalMinutes: number;
    totalCost: number;
}

// --- FUNCIONES PARA CÁLCULO DE ÁREA (m2) ---

export const saveAreaCalculation = async (data: Omit<AreaCalculation, 'id' | 'createdAt'>) => {
    try {
        const docRef = await addDoc(collection(db, "calculos_area"), {
            ...data,
            createdAt: Timestamp.now() // Usamos Timestamp de servidor para ordenar bien
        });
        return { ...data, id: docRef.id };
    } catch (e) {
        console.error("Error guardando cálculo área:", e);
        throw e;
    }
};

export const getAreaHistory = async () => {
    try {
        const q = query(collection(db, "calculos_area"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as AreaCalculation[];
    } catch (e) {
        console.error("Error leyendo historial área:", e);
        return [];
    }
};

export const deleteAreaCalculation = async (id: string) => {
    await deleteDoc(doc(db, "calculos_area", id));
};


// --- FUNCIONES PARA CÁLCULO LÁSER ---

export const saveLaserCalculation = async (data: Omit<LaserCalculation, 'id' | 'createdAt'>) => {
    try {
        const docRef = await addDoc(collection(db, "calculos_laser"), {
            ...data,
            createdAt: Timestamp.now()
        });
        return { ...data, id: docRef.id };
    } catch (e) {
        console.error("Error guardando cálculo láser:", e);
        throw e;
    }
};

export const getLaserHistory = async () => {
    try {
        const q = query(collection(db, "calculos_laser"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as LaserCalculation[];
    } catch (e) {
        console.error("Error leyendo historial láser:", e);
        return [];
    }
};

export const deleteLaserCalculation = async (id: string) => {
    await deleteDoc(doc(db, "calculos_laser", id));
};