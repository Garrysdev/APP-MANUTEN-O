'use client'

import { useMemo } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'
import type { Task, User } from '@/types/models'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

// 1. Pedidos de PI por Mês (reais da BD)
function computePIMonthlyData(allTasks: Task[]) {
  const piTasks = allTasks.filter(
    (t) =>
      t.tipo === 'pi' ||
      t.ti === 'PI' ||
      t.tipoText === 'PI' ||
      (t.title || '').toUpperCase().startsWith('PI')
  )
  const monthsMap: Record<string, { month: string; pedidas: number; concluidas: number }> = {}

  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt', { month: 'short' })
    monthsMap[key] = { month: label.charAt(0).toUpperCase() + label.slice(1), pedidas: 0, concluidas: 0 }
  }

  piTasks.forEach((t) => {
    if (t.createdAt) {
      const key = t.createdAt.slice(0, 7)
      if (monthsMap[key]) monthsMap[key].pedidas++
    }
    if (t.status === 'done' && (t.completedAt || t.createdAt)) {
      const key = (t.completedAt || t.createdAt).slice(0, 7)
      if (monthsMap[key]) monthsMap[key].concluidas++
    }
  })

  return Object.values(monthsMap)
}

// 2. % Cumprimento do Plano de Manutenção por Ano (reais da BD)
function computePlanYearlyData(allTasks: Task[]) {
  const planTasks = allTasks.filter(
    (t) =>
      t.tipo === 'plano' ||
      t.tipo === 'preventiva' ||
      t.ti === 'PM' ||
      t.ti === 'MP' ||
      t.tipoText === 'PM' ||
      !!t.maintenancePlanId
  )

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear]
  const yearsMap: Record<string, { year: string; agendadas: number; concluidas: number; percent: number }> = {}

  years.forEach((y) => {
    yearsMap[String(y)] = { year: String(y), agendadas: 0, concluidas: 0, percent: 0 }
  })

  planTasks.forEach((t) => {
    const yr = (t.plannedStartDate || t.createdAt || '').slice(0, 4)
    if (yearsMap[yr]) {
      yearsMap[yr].agendadas++
      if (t.status === 'done') {
        yearsMap[yr].concluidas++
      }
    }
  })

  Object.values(yearsMap).forEach((item) => {
    item.percent = item.agendadas > 0 ? Math.round((item.concluidas / item.agendadas) * 100) : 100
  })

  return Object.values(yearsMap)
}

export default function DashboardTablesClient({
  normalTasks = [],
  allTasks = [],
}: {
  normalTasks?: Task[]
  projectTasks?: Task[]
  allTasks?: Task[]
  usersList?: User[]
}) {
  const taskSource = allTasks.length ? allTasks : normalTasks

  const piMonthlyData = useMemo(() => computePIMonthlyData(taskSource), [taskSource])
  const planYearlyData = useMemo(() => computePlanYearlyData(taskSource), [taskSource])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Gráfico 1: Pedidos de PI (Pedida vs Concluída por Mês) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-safety-orange h-5 w-5" />
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Pedidos de PI (Por Mês)</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">PIs Pedidas (criadas) vs Concluídas no mês</p>
            </div>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={piMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="pedidas" name="PIs Pedidas" fill="#2E86C1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="concluidas" name="PIs Concluídas" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: % Cumprimento do Plano de Manutenção (Por Ano) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-emerald-600 h-5 w-5" />
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Cumprimento do Plano de Manutenção (% por Ano)</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Agendado vs Concluído e Taxa de Cumprimento anuais</p>
            </div>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planYearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: any, name: any) => [name === '% Cumprimento' ? `${val}%` : val, name]} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="agendadas" name="Agendadas" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
