// @/lib/services/notifications-service.ts
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit, addDoc } from "firebase/firestore";

// Función para enviar notificaciones desde CUALQUIER parte de la app
export const sendSMRNotification = async (notif: any) => {
    await addDoc(collection(db, "notificaciones"), {
        ...notif,
        timestamp: new Date(),
        isRead: false
    });
};

// Hook para que el Dashboard escuche automáticamente
export const subscribeToNotifications = (callback: (data: any[]) => void) => {
    const q = query(collection(db, "notificaciones"), orderBy("timestamp", "desc"), limit(50));
    return onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifs);
    });
};