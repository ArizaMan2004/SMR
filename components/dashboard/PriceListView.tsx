// @/components/dashboard/PriceListView.tsx
"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { Tag, Plus, Search, Trash2, Pencil, Package, AlertCircle, Euro, Users, Settings2, DollarSign } from "lucide-react"
import { savePriceItem, deletePriceItem, saveCategory, deleteCategory, type PriceItem, type CategoryItem } from "@/lib/services/prices-service"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface PriceListViewProps {
    prices: PriceItem[];
    categories: CategoryItem[];
    eurRate: number;
}

export function PriceListView({ prices = [], categories = [], eurRate = 0 }: PriceListViewProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isCatModalOpen, setIsCatModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [editingItem, setEditingItem] = useState<PriceItem | null>(null)
    const [newCatName, setNewCatName] = useState("")
    
    const [formData, setFormData] = useState<PriceItem>({
        nombre: "", categoriaId: "", precioPublico: 0, precioAliado: 0, unidad: "unidad"
    })

    const filteredPrices = useMemo(() => {
        return (prices || []).filter(p => 
            p.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [prices, searchTerm])

    const handleSave = async () => {
        if (!formData.nombre || !formData.categoriaId) return toast.error("Faltan datos obligatorios");
        setIsLoading(true);
        try {
            await savePriceItem(formData, editingItem?.id);
            toast.success("Catálogo actualizado");
            setIsModalOpen(false);
        } catch (e) { toast.error("Error al guardar"); }
        finally { setIsLoading(false); }
    }

    return (
        <div className="space-y-8 pb-24">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/40 dark:bg-white/5 p-4 rounded-[2rem] border border-black/5 backdrop-blur-md">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                    <input 
                        type="text" placeholder="Buscar..." value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-12 pr-6 py-3 bg-white dark:bg-black/20 border border-black/5 rounded-[1.5rem] text-sm outline-none" 
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={() => setIsCatModalOpen(true)} variant="outline" className="rounded-[1.5rem] font-bold h-12 gap-2">
                        <Settings2 size={16} /> CATEGORÍAS
                    </Button>
                    <Button onClick={() => { setEditingItem(null); setFormData({nombre: "", categoriaId: "", precioPublico: 0, precioAliado: 0, unidad: "unidad"}); setIsModalOpen(true); }} className="bg-blue-600 rounded-[1.5rem] font-bold h-12 gap-2 text-white">
                        <Plus size={16} /> NUEVO PRODUCTO
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredPrices.map((item) => {
                        const cat = categories.find(c => c.id === item.categoriaId);
                        return (
                            <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group">
                                <Card className="p-6 rounded-[2.5rem] bg-white dark:bg-[#1c1c1e] border-none shadow-sm hover:shadow-2xl transition-all relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl"><Package size={20}/></div>
                                        <Badge variant="outline" className="rounded-lg text-[9px] border-black/5 font-black uppercase tracking-widest">{cat?.nombre || 'S/C'}</Badge>
                                    </div>
                                    <h4 className="font-bold text-sm uppercase italic mb-6 truncate">{item.nombre}</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[8px] font-black opacity-30 uppercase">Público</p>
                                                <p className="text-xl font-black text-emerald-600 leading-none">${item.precioPublico.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-blue-500/40 uppercase">Tasa Euro</p>
                                                <p className="text-[10px] font-bold text-slate-400">Bs. {(item.precioPublico * eurRate).toLocaleString('es-VE')}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-black/5">
                                            <div>
                                                <p className="text-[8px] font-black text-blue-500 uppercase flex items-center gap-1"><Users size={8} /> Aliados</p>
                                                <p className="text-sm font-black text-blue-600 leading-none">${item.precioAliado.toFixed(2)}</p>
                                            </div>
                                            <p className="text-[9px] font-bold opacity-30">Bs. {(item.precioAliado * eurRate).toLocaleString('es-VE')}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-6 pt-4 border-t border-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => {setEditingItem(item); setFormData({...item}); setIsModalOpen(true);}} className="h-9 w-9 bg-orange-500/10 text-orange-600 rounded-xl"><Pencil size={14}/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => deletePriceItem(item.id!)} className="h-9 w-9 bg-red-500/10 text-red-600 rounded-xl"><Trash2 size={14}/></Button>
                                    </div>
                                </Card>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* MODAL PRODUCTO */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="rounded-[2.5rem] border-none max-w-md p-8">
                    <DialogHeader><DialogTitle className="uppercase italic font-black text-xl tracking-tighter">Gestionar Producto</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black opacity-40 ml-1">Nombre</Label>
                            <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="rounded-2xl h-12 font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black opacity-40 ml-1">Categoría</Label>
                                <select value={formData.categoriaId} onChange={e => setFormData({...formData, categoriaId: e.target.value})} className="w-full h-12 rounded-2xl border border-black/5 bg-white dark:bg-black/20 px-4 text-sm font-bold">
                                    <option value="">Seleccionar...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black opacity-40 ml-1">Unidad</Label>
                                <Input value={formData.unidad} onChange={e => setFormData({...formData, unidad: e.target.value})} className="rounded-2xl h-12 font-bold" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 p-4 bg-emerald-500/5 rounded-[1.8rem] border border-emerald-500/10 text-emerald-600">
                                <Label className="text-[10px] uppercase font-black">Precio Público</Label>
                                <Input type="number" value={formData.precioPublico} onChange={e => setFormData({...formData, precioPublico: Number(e.target.value)})} className="bg-transparent border-none text-xl font-black p-0 h-auto focus-visible:ring-0" />
                            </div>
                            <div className="space-y-2 p-4 bg-blue-500/5 rounded-[1.8rem] border border-blue-500/10 text-blue-600">
                                <Label className="text-[10px] uppercase font-black">Precio Aliado</Label>
                                <Input type="number" value={formData.precioAliado} onChange={e => setFormData({...formData, precioAliado: Number(e.target.value)})} className="bg-transparent border-none text-xl font-black p-0 h-auto focus-visible:ring-0" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSave} disabled={isLoading} className="w-full h-14 bg-blue-600 rounded-2xl font-black text-white">GUARDAR PRODUCTO</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL CATEGORÍAS */}
            <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
                <DialogContent className="rounded-[2.5rem] max-w-sm">
                    <DialogHeader><DialogTitle className="uppercase italic font-black">Categorías</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="flex gap-2">
                            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nueva categoría..." className="rounded-xl" />
                            <Button onClick={async () => { 
                                if(!newCatName.trim()) return; 
                                await saveCategory(newCatName); 
                                setNewCatName(""); 
                                toast.success("Categoría almacenada");
                            }} className="bg-blue-600 rounded-xl text-white"><Plus size={18}/></Button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {categories.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-black/5">
                                    <span className="text-sm font-bold uppercase">{c.nombre}</span>
                                    <Button variant="ghost" size="icon" onClick={() => deleteCategory(c.id!)} className="h-8 w-8 text-red-500"><Trash2 size={14}/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}