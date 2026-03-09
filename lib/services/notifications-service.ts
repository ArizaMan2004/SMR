// @/lib/services/notifications-service.ts
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from "firebase/firestore";

// Función para enviar notificaciones desde CUALQUIER parte de la app
export const sendSMRNotification = async (notif: any) => {
    await addDoc(collection(db, "notificaciones"), {
        ...notif,
        timestamp: serverTimestamp(), // <--- CAMBIO AQUÍ: Usa la hora oficial del servidor
        isRead: false
    });
};

// Hook para que el Dashboard escuche automáticamente
export const subscribeToNotifications = (callback: (data: any[]) => void) => {
    // El limit(50) ya está perfecto aquí para cuidar tu cuota Spark
    const q = query(collection(db, "notificaciones"), orderBy("timestamp", "desc"), limit(50));
    return onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifs);
    });
};