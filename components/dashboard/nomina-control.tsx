"use client"

import React from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, ArrowRight, Coins, CalendarCheck } from "lucide-react"

export function NominaControl({ empleados, pagos, onPay }: any) {
  const hoy = new Date().getDate()
  
  // Filtrar quienes cobran hoy o están pendientes (Sueldo Fijo)
  const pendientesFijos = empleados.filter((e: any) => 
    e.tipoPago === "fijo" && 
    !pagos.some((p: any) => p.empleadoId === e.id && new Date(p.fecha).getMonth() === new Date().getMonth())
  )

  // Filtrar comisionistas (siempre aparecen para registrar abonos)
  const comisionistas = empleados.filter((e: any) => e.tipoPago === "comision")

  return (
    <div className="space-y-10">
      
      {/* SECCIÓN 1: RECORDATORIOS DE SUELDO FIJO */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-4">
          <CalendarCheck className="text-indigo-500 w-5 h-5" />
          <h3 className="font-black text-lg tracking-tighter uppercase italic">Sueldos del Mes</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendientesFijos.map((emp: any) => (
            <Card key={emp.id} className="p-6 rounded-[2.5rem] border-0 bg-white dark:bg-slate-900 shadow-xl relative overflow-hidden group">
              {Number(emp.diaPago) === hoy && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase">
                  Cobrar Hoy
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center font-black">
                    {emp.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-none">{emp.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Día de pago: {emp.diaPago}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monto Pactado</p>
                    <p className="text-xl font-black text-indigo-600">${emp.montoUSD}</p>
                  </div>
                  <Button 
                    onClick={() => onPay(emp.id, emp.montoUSD)}
                    className="rounded-2xl bg-slate-900 dark:bg-indigo-600 text-white text-[10px] font-black uppercase px-6 h-10 hover:scale-105 transition-all"
                  >
                    Marcar como Pagado <ArrowRight className="ml-2 w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* SECCIÓN 2: ABONOS POR COMISIÓN (TRABAJO REALIZADO) */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-4">
          <Coins className="text-emerald-500 w-5 h-5" />
          <h3 className="font-black text-lg tracking-tighter uppercase italic">Comisiones y Abonos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comisionistas.map((emp: any) => (
            <Card key={emp.id} className="p-5 rounded-[2rem] border-0 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">{emp.nombre}</p>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Pago por trabajo</p>
                </div>
              </div>
              <Button 
                variant="outline"
                className="rounded-xl border-slate-200 dark:border-white/10 text-[9px] font-black uppercase h-10 px-6 hover:bg-emerald-500 hover:text-white transition-all"
                onClick={() => {
                  const monto = prompt(`Monto a pagar a ${emp.nombre}:`, emp.montoUSD)
                  if(monto) onPay(emp.id, parseFloat(monto))
                }}
              >
                Registrar Abono
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}