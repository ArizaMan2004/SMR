// pages/api/ordenes.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { OrdenServicio, EstadoOrden } from '@/types/ordenServicio';

// NUEVA INTERFAZ: Define la estructura que viene por la red (fechas como string)
interface OrdenServicioPostData extends Omit<OrdenServicio, 'fecha_emision' | 'fecha_entrega_prometida'> {
    // Sobreescribe los tipos de fecha para esperar strings, ya que vienen del input HTML
    fecha_emision?: string | Date; // Permite el valor por si acaso, aunque lo sobrescribimos
    fecha_entrega_prometida: string; // Debe ser un string 'YYYY-MM-DD'
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    
    const ordenesRef = collection(db, 'ordenes');

    if (req.method === 'POST') {
        try {
            // USO LA INTERFAZ para el cuerpo de la solicitud
            const data: OrdenServicioPostData = req.body;
            
            // ⭐️ FIX: Excluimos la propiedad 'fecha_entrega_prometida' del spread
            const { fecha_entrega_prometida, ...restOfData } = data;
            
            // CONVERSIÓN SEGURA a Timestamp
            const fechaEntregaTimestamp = Timestamp.fromDate(new Date(fecha_entrega_prometida));
            
            const ordenDataParaGuardar: OrdenServicio = {
                // Hacemos spread del resto de las propiedades compatibles
                ...restOfData, 
                
                // Sobreescribimos las propiedades de fecha y estado con el tipo correcto (Timestamp)
                fecha_emision: Timestamp.fromDate(new Date()), 
                fecha_entrega_prometida: fechaEntregaTimestamp,
                estado: 'PENDIENTE' as EstadoOrden,
            };

            const docRef = await addDoc(ordenesRef, ordenDataParaGuardar);
            
            return res.status(201).json({ id: docRef.id, ...ordenDataParaGuardar });

        } catch (error) {
            console.error('Error al crear orden de servicio:', error);
            return res.status(500).json({ message: 'Error interno del servidor al crear la orden.', error: (error as Error).message });
        }
    }

    if (req.method === 'GET') {
        try {
            const q = query(ordenesRef, orderBy('fecha_emision', 'desc'));
            const snapshot = await getDocs(q);
            
            const ordenes: OrdenServicio[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as OrdenServicio[];

            return res.status(200).json(ordenes);
        } catch (error) {
            console.error('Error al obtener órdenes:', error);
            return res.status(500).json({ message: 'Error al obtener órdenes.' });
        }
    }

    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}