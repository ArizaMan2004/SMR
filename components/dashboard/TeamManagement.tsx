// @/components/dashboard/TeamManagement.tsx
"use client" // Obligatorio para usar estados

import React, { useState } from "react" // 👈 Faltaba esta importación
import { Settings, Plus, UserPlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

// Añadimos un valor por defecto [] a designers para evitar errores si no se pasa el prop
export function TeamManagement({ designers = [], onAdd, onDelete }: { designers: any[], onAdd: any, onDelete: any }) {
  const [name, setName] = useState("")

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim())
      setName("")
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl border-slate-200 dark:border-slate-800 gap-2 font-bold shadow-sm hover:bg-slate-50 transition-all">
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="hidden sm:inline">Gestionar Equipo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[2rem] border-none shadow-2xl bg-white dark:bg-slate-900 max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <UserPlus className="text-blue-600" /> Mi Equipo de Diseño
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2 mt-6">
          <Input 
            placeholder="Nombre del nuevo diseñador..." 
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none shadow-inner h-12"
          />
          <Button 
            onClick={handleAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 h-12"
          >
            <Plus />
          </Button>
        </div>

        <div className="mt-8 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {designers && designers.length > 0 ? (
            designers.map((d) => (
              <div key={d.id} className="flex justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 items-center group transition-all hover:border-blue-200">
                <span className="font-bold text-slate-700 dark:text-slate-200">{d.name}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                  onClick={() => onDelete(d.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="py-10 text-center flex flex-col items-center gap-3 opacity-40">
                <UserPlus className="w-10 h-10" />
                <p className="text-sm font-bold uppercase tracking-widest">No hay diseñadores registrados</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}