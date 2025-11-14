// @/lib/services/task-actions-service.ts

import { doc, getDoc, updateDoc } from "firebase/firestore";
// ⚠️ VERIFICA QUE ESTA RUTA DE db SEA CORRECTA
import { db } from "@/lib/firebase"; 
import type { OrdenServicio, ItemOrden, EstadoOrden } from "@/lib/types/orden";

// ⚠️ NECESITAS IMPLEMENTAR ESTE SERVICIO EN OTRO ARCHIVO
// Asumimos que la lógica de Cloudinary reside en /lib/services/cloudinary-service
import { deleteFileFromCloudinary } from "@/lib/services/cloudinary-service"; 

// =========================================================================
// FUNCIÓN DE AYUDA CENTRAL: Encuentra y actualiza una propiedad del Ítem
// =========================================================================
async function updateItemProperty(
  ordenId: string,
  itemNombre: string,
  key: keyof ItemOrden | 'isReviewed',
  value: any
) {
  const docRef = doc(db, "ordenes", ordenId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Orden con ID ${ordenId} no encontrada.`);
  }

  const ordenData = docSnap.data() as OrdenServicio;
  let items: ItemOrden[] = ordenData.items || [];
  let itemIndex = items.findIndex(item => item.nombre === itemNombre); 

  if (itemIndex === -1) {
    throw new Error(`Ítem con nombre '${itemNombre}' no encontrado.`);
  }

  // 1. Modificar el array de ítems de forma inmutable
  const updatedItems = items.map((item, index) => {
    if (index === itemIndex) {
      return { 
        ...item, 
        [key]: value // Actualizar la propiedad específica
      };
    }
    return item;
  });

  // 2. Guardar el array de items modificado en Firestore
  await updateDoc(docRef, { 
    items: updatedItems 
  });
}

// =========================================================================
// FUNCIONES EXPUESTAS
// =========================================================================

/**
 * 🔹 Guarda una nota o el array de imágenes en el ítem.
 * NOTA: Cuando se usa para 'imagenes', el valor es el ARRAY COMPLETO actualizado.
 */
export async function saveTaskNote(
  ordenId: string,
  itemNombre: string,
  value: string | string[],
  key: 'areaNote' | 'imagenes'
) {
    await updateItemProperty(ordenId, itemNombre, key, value);
}

/**
 * 🔹 Elimina una imagen de la lista del ítem y de Cloudinary.
 * @param ordenId ID de la orden.
 * @param itemNombre Nombre del ítem (tarea).
 * @param imageUrl URL de la imagen a eliminar.
 */
export async function deleteTaskImage(
  ordenId: string,
  itemNombre: string,
  imageUrl: string
): Promise<void> {
    const docRef = doc(db, "ordenes", ordenId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Orden con ID ${ordenId} no encontrada para eliminar imagen.`);
    }

    const ordenData = docSnap.data() as OrdenServicio;
    let items: ItemOrden[] = ordenData.items || [];
    let itemIndex = items.findIndex(item => item.nombre === itemNombre); 

    if (itemIndex === -1) {
      throw new Error(`Ítem con nombre '${itemNombre}' no encontrado para eliminar imagen.`);
    }

    const currentItem = items[itemIndex];
    const currentImages = currentItem.imagenes || [];
    
    // 1. Remover la URL de la base de datos (inmutablemente)
    const updatedImages = currentImages.filter(url => url !== imageUrl);
    
    // Usar la función de ayuda para guardar el array filtrado
    await updateItemProperty(ordenId, itemNombre, 'imagenes', updatedImages);

    // 2. Eliminar de Cloudinary (Lógica crítica)
    try {
        // NOTA: La función deleteFileFromCloudinary DEBE existir y debe saber 
        // cómo extraer el public_id de la imageUrl para hacer la llamada a Cloudinary.
        await deleteFileFromCloudinary(imageUrl);
        console.log(`[Cloudinary] Imagen eliminada correctamente: ${imageUrl}`);
    } catch (error) {
        // Es importante no fallar la eliminación de la DB si falla Cloudinary, 
        // pero registrar el error. Se puede considerar reintentar o notificar.
        console.error(`Error al intentar eliminar el archivo de Cloudinary: ${imageUrl}`, error);
        // Dependiendo de tu política de errores, podrías lanzar el error o solo logearlo.
        // Aquí optamos por solo logear, ya que la DB está limpia.
    }
}


/**
 * 🔹 Marca un ítem como revisado (o terminado) por el área de producción.
 */
export async function markItemAsReviewed(
  ordenId: string, 
  itemNombre: string, 
  newEstado: EstadoOrden // Este argumento no se usa actualmente, pero se mantiene para consistencia.
) {
    // Aquí se utiliza 'isReviewed' como una propiedad simple booleana para indicar la finalización.
    await updateItemProperty(ordenId, itemNombre, 'isReviewed', true);
}