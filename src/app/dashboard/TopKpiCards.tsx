'use client'

import React from 'react'
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import type { Task } from '@/types/models'

const downtimeData = [
  { value: 10 }, { value: 15 }, { value: 8 }, { value: 12 }, { value: 20 }, { value: 15 }, { value: 25 }, { value: 22 }
]

const uptimeData = [
  { value: 92 }, { value: 94 }, { value: 91 }, { value: 96 }, { value: 95 }, { value: 98 }, { value: 96 }, { value: 97 }
]

export default function TopKpiCards({ tasks }: { tasks: Task[] }) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100)

  // Mock OEE data
  const oeeValue = 89.1
  const oeeData = [
    { name: 'OEE', value: oeeValue },
    { name: 'Rem', value: 100 - oeeValue }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
      
      {/* 1. DOWNTIME REDUCED */}
      <div className="card p-5 pb-0 flex flex-col relative overflow-hidden bg-white/90 dark:bg-slate-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <p className="text-[11px] font-bold text-gray-800 dark:text-slate-300 uppercase tracking-wide mb-3">Tempo Paragem Reduzido</p>
        <div className="flex flex-col z-10">
          <p className="text-4xl font-black text-gray-900 dark:text-white">21.4%</p>
          <p className="text-xs font-semibold text-emerald-500 mt-1">+3.8% MoM</p>
        </div>
        <div className="h-20 w-full mt-2 -ml-2 -mr-2 opacity-90">
          <ResponsiveContainer width="105%" height="100%">
            <AreaChart data={downtimeData}>
              <defs>
                <linearGradient id="colorDowntime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="natural" dataKey="value" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorDowntime)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. EQUIPMENT UPTIME */}
      <div className="card p-5 pb-0 flex flex-col relative overflow-hidden bg-white/90 dark:bg-slate-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <p className="text-[11px] font-bold text-gray-800 dark:text-slate-300 uppercase tracking-wide mb-3">Disponibilidade (Uptime)</p>
        <div className="flex flex-col z-10">
          <p className="text-4xl font-black text-gray-900 dark:text-white">96.8%</p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">97.5% Objetivo</p>
        </div>
        <div className="h-20 w-full mt-2 -ml-2 -mr-2">
          <ResponsiveContainer width="105%" height="100%">
            <LineChart data={uptimeData}>
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. OVERALL OEE */}
      <div className="card p-5 flex flex-col relative overflow-hidden bg-white/90 dark:bg-slate-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <p className="text-[11px] font-bold text-gray-800 dark:text-slate-300 uppercase tracking-wide mb-3">Eficiência Global (OEE)</p>
        <div className="flex flex-col z-10 items-center">
          <p className="text-4xl font-black text-gray-900 dark:text-white">{oeeValue}%</p>
        </div>
        <div className="h-24 w-full mt-4 flex flex-col items-center justify-end relative">
          <ResponsiveContainer width="100%" height="200%">
            <PieChart>
              <defs>
                <linearGradient id="oeeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
              <Pie
                data={oeeData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={75}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
                cornerRadius={10}
              >
                <Cell fill="url(#oeeGrad)" />
                <Cell fill="var(--tw-colors-gray-100)" className="dark:fill-slate-800" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-0 w-full flex justify-center">
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">91.0% Objetivo</p>
          </div>
        </div>
      </div>

      {/* 4. WORK ORDERS COMPLETED */}
      <div className="card p-5 flex flex-col relative overflow-hidden bg-white/90 dark:bg-slate-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <p className="text-[11px] font-bold text-gray-800 dark:text-slate-300 uppercase tracking-wide mb-3">Intervenções Concluídas</p>
        <div className="flex flex-col z-10">
          <p className="text-4xl font-black text-gray-900 dark:text-white">{done}<span className="text-2xl text-gray-400 dark:text-slate-500">/{total}</span></p>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">91.0% Objetivo</p>
        </div>
        
        <div className="mt-auto pt-6 w-full">
          <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      
    </div>
  )
}
