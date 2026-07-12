'use client'

import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { format, subDays, isSameDay } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Task, TipoTarefa } from '@/types/models'
import { TIPO_LABELS } from '@/types/models'

const COLORS_STATUS = {
  pending: '#f59e0b', // amber-500
  in_progress: '#2563eb', // blue-600
  done: '#10b981', // emerald-500
  cancelled: '#64748b' // slate-500
}

const STATUS_LABELS = {
  pending: 'Pendentes',
  in_progress: 'Em Curso',
  done: 'Concluídas',
  cancelled: 'Canceladas'
}

export default function DashboardCharts({ tasks }: { tasks: Task[] }) {
  const byType = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach(t => {
      counts[t.tipo] = (counts[t.tipo] || 0) + 1
    })
    return Object.entries(counts).map(([tipo, count]) => ({
      name: TIPO_LABELS[tipo as TipoTarefa] || tipo,
      total: count
    })).sort((a, b) => b.total - a.total)
  }, [tasks])

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, done: 0, cancelled: 0 }
    tasks.forEach(t => {
      if (counts[t.status] !== undefined) counts[t.status]++
    })
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
        value: count,
        color: COLORS_STATUS[status as keyof typeof COLORS_STATUS]
      }))
  }, [tasks])

  const last7Days = useMemo(() => {
    const today = new Date()
    const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i)).reverse()
    return days.map(d => {
      const count = tasks.filter(t => isSameDay(new Date(t.createdAt), d)).length
      return {
        date: format(d, 'dd MMM', { locale: pt }),
        Tarefas: count
      }
    })
  }, [tasks])

  // Custom tooltips with dark mode styles
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 dark:bg-slate-900/90 border border-gray-100 dark:border-slate-800 p-3 rounded-lg shadow-xl backdrop-blur-md">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color || entry.fill }}>
              {entry.name}: <span className="font-bold">{entry.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="card p-6 flex flex-col col-span-1 lg:col-span-2 relative overflow-hidden group">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#1B4F72]/5 dark:bg-[#2E86C1]/5 rounded-full blur-3xl" />
        <h3 className="font-bold text-gray-800 dark:text-slate-200 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-[#1B4F72] dark:bg-[#2E86C1] rounded-full"></span>
          Novas OTs (Últimos 7 dias)
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTarefas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E86C1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2E86C1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-slate-800/50" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Ordens de Trabalho (OTs)" name="Criadas" stroke="#2E86C1" strokeWidth={3} fillOpacity={1} fill="url(#colorTarefas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6 flex flex-col relative overflow-hidden group">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl" />
        <h3 className="font-bold text-gray-800 dark:text-slate-200 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-amber-500 rounded-full"></span>
          Distribuição por Estado
        </h3>
        <div className="h-64 w-full flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byStatus}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {byStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-gray-800 dark:text-slate-200">{tasks.length}</span>
            <span className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-widest font-bold">Total</span>
          </div>
        </div>
      </div>

      <div className="card p-6 flex flex-col col-span-1 lg:col-span-3 relative overflow-hidden group">
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#1B4F72]/5 dark:bg-[#2E86C1]/5 rounded-full blur-3xl" />
        <h3 className="font-bold text-gray-800 dark:text-slate-200 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-[#1B4F72] dark:bg-[#2E86C1] rounded-full"></span>
          Volume de OTs por Tipo
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-slate-800/50" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" className="text-gray-400 dark:text-slate-500" tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-gray-50 dark:text-slate-800/30' }} />
              <Bar dataKey="total" name="Quantidade" fill="#1B4F72" className="dark:fill-[#2E86C1]" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
