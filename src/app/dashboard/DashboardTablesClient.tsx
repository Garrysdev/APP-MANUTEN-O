'use client'

import { useMemo } from 'react'
import { BarChart3, TrendingUp, CalendarDays, CheckCircle2 } from 'lucide-react'
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

import { toNormalizedIsoDate } from '@/lib/utils'

// Helper: Filtrar tarefas de Pedidos de PI
function getPITasks(allTasks: Task[]) {
  return allTasks.filter((t) => {
    const tipoStr = String(t.tipo || '').toLowerCase()
    return (
      tipoStr === 'pi' ||
      tipoStr === 'solicitacao' ||
      tipoStr === 'curativa' ||
      t.ti === 'PI' ||
      t.tipoText === 'PI' ||
      t.source === 'folha_ur_pi' ||
      t.source === 'pedidos_pi' ||
      Boolean(t.requesterEmail) ||
      (t.title || '').toUpperCase().startsWith('PI') ||
      (t.title || '').toUpperCase().includes('PEDIDO DE INTERVENÇÃO') ||
      (t.title || '').toUpperCase().includes('PEDIDO PI') ||
      (t.description || '').toUpperCase().includes('PEDIDO DE INTERVENÇÃO')
    )
  })
}

// Helper: Filtrar tarefas do Plano de Manutenção
function getPlanTasks(allTasks: Task[]) {
  return allTasks.filter((t) => {
    const tipoStr = String(t.tipo || '').toLowerCase()
    return (
      tipoStr === 'plano' ||
      tipoStr === 'preventiva' ||
      tipoStr === 'pm' ||
      t.ti === 'PM' ||
      t.ti === 'MP' ||
      t.tipoText === 'PM' ||
      Boolean(t.maintenancePlanId) ||
      t.source === 'plano_manutencao' ||
      t.source === 'folha_ur_planos' ||
      (t.title || '').toUpperCase().includes('MANUTENÇÃO PREVENTIVA') ||
      (t.title || '').toUpperCase().includes('PLANO DE MANUTENÇÃO')
    )
  })
}

// Helper: Obter anos presentes nos dados
function getAvailableYears(allTasks: Task[]): number[] {
  const currentYear = new Date().getFullYear()
  const yearsSet = new Set<number>([currentYear - 2, currentYear - 1, currentYear])

  allTasks.forEach((t) => {
    const d = toNormalizedIsoDate(t.createdAt || t.plannedStartDate || t.completedAt)
    if (d) {
      const yr = parseInt(d.slice(0, 4), 10)
      if (!isNaN(yr) && yr >= 2020 && yr <= currentYear + 1) {
        yearsSet.add(yr)
      }
    }
  })

  return Array.from(yearsSet).sort((a, b) => a - b)
}

// 1. Pedidos de PI no Ano Corrente (Mês a Mês) — cada PI conta no mês em que foi
// pedida e é classificada pelo seu estado ATUAL (concluída vs por concluir). Assim as
// duas barras somam sempre o total de PIs desse mês, em vez de contarem em meses
// diferentes conforme a data de conclusão.
function computePICurrentYearData(allTasks: Task[]) {
  const piTasks = getPITasks(allTasks)
  const currentYear = new Date().getFullYear()
  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  const monthsMap: Record<string, { month: string; concluidas: number; naoConcluidas: number; total: number }> = {}

  for (let m = 0; m < 12; m++) {
    const key = `${currentYear}-${String(m + 1).padStart(2, '0')}`
    monthsMap[key] = { month: monthLabels[m], concluidas: 0, naoConcluidas: 0, total: 0 }
  }

  piTasks.forEach((t) => {
    const createdIso = toNormalizedIsoDate(t.createdAt || t.plannedStartDate)
    if (!createdIso || !createdIso.startsWith(String(currentYear))) return
    const bucket = monthsMap[createdIso.slice(0, 7)]
    if (!bucket) return

    bucket.total++
    if (t.status === 'done') bucket.concluidas++
    else bucket.naoConcluidas++
  })

  return Object.values(monthsMap)
}

// 2. Cumprimento do Plano de Manutenção por Ano — de todas as OT de PM existentes
// nesse ano, a percentagem que está no estado Concluída.
function computePlanYearlyData(allTasks: Task[]) {
  const planTasks = getPlanTasks(allTasks)
  const years = getAvailableYears(allTasks)
  const yearsMap: Record<string, { year: string; total: number; concluidas: number; percent: number }> = {}

  years.forEach((y) => {
    yearsMap[String(y)] = { year: String(y), total: 0, concluidas: 0, percent: 0 }
  })

  planTasks.forEach((t) => {
    const isoDate = toNormalizedIsoDate(t.plannedStartDate || t.dueDate || t.createdAt)
    if (!isoDate) return
    const bucket = yearsMap[isoDate.slice(0, 4)]
    if (!bucket) return

    bucket.total++
    if (t.status === 'done') bucket.concluidas++
  })

  Object.values(yearsMap).forEach((item) => {
    item.percent = item.total > 0 ? Math.round((item.concluidas / item.total) * 100) : 0
  })

  return Object.values(yearsMap)
}

// 3. Comparação de Pedidos de PI por Ano (Volume Anual)
function computePIYearlyData(allTasks: Task[]) {
  const piTasks = getPITasks(allTasks)
  const years = getAvailableYears(allTasks)
  const yearsMap: Record<string, { year: string; pedidas: number; concluidas: number }> = {}

  years.forEach((y) => {
    yearsMap[String(y)] = { year: String(y), pedidas: 0, concluidas: 0 }
  })

  piTasks.forEach((t) => {
    const createdIso = toNormalizedIsoDate(t.createdAt || t.plannedStartDate)
    if (createdIso) {
      const yr = createdIso.slice(0, 4)
      if (yearsMap[yr]) yearsMap[yr].pedidas++
    }

    if (t.status === 'done') {
      const completedIso = toNormalizedIsoDate(t.completedAt || t.updatedAt || t.createdAt)
      if (completedIso) {
        const yr = completedIso.slice(0, 4)
        if (yearsMap[yr]) yearsMap[yr].concluidas++
      }
    }
  })

  return Object.values(yearsMap)
}

// 4. Taxa de Resolução de Pedidos de PI por Ano (% de Resolução Anual)
function computePIResolutionRateYearlyData(allTasks: Task[]) {
  const piTasks = getPITasks(allTasks)
  const years = getAvailableYears(allTasks)
  const yearsMap: Record<string, { year: string; pedidas: number; concluidas: number; percent: number }> = {}

  years.forEach((y) => {
    yearsMap[String(y)] = { year: String(y), pedidas: 0, concluidas: 0, percent: 0 }
  })

  piTasks.forEach((t) => {
    const createdIso = toNormalizedIsoDate(t.createdAt || t.plannedStartDate)
    if (createdIso) {
      const yr = createdIso.slice(0, 4)
      if (yearsMap[yr]) yearsMap[yr].pedidas++
    }

    if (t.status === 'done') {
      const completedIso = toNormalizedIsoDate(t.completedAt || t.updatedAt || t.createdAt)
      if (completedIso) {
        const yr = completedIso.slice(0, 4)
        if (yearsMap[yr]) yearsMap[yr].concluidas++
      }
    }
  })

  Object.values(yearsMap).forEach((item) => {
    item.percent = item.pedidas > 0 ? Math.round((item.concluidas / item.pedidas) * 100) : 0
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
  const currentYear = new Date().getFullYear()

  const piCurrentYearData = useMemo(() => computePICurrentYearData(taskSource), [taskSource])
  const planYearlyData = useMemo(() => computePlanYearlyData(taskSource), [taskSource])
  const piYearlyData = useMemo(() => computePIYearlyData(taskSource), [taskSource])
  const piResolutionData = useMemo(() => computePIResolutionRateYearlyData(taskSource), [taskSource])

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* ── LINHA 1: GRÁFICOS SUPERIORES ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Gráfico 1: Pedidos de PI no Ano Corrente */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-safety-orange h-5 w-5" />
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Pedidos de PI ({currentYear} — Mês a Mês)
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  PIs Pedidas vs Concluídas por mês no ano corrente
                </p>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={piCurrentYearData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const item = payload[0]?.payload
                      const total = item?.total ?? 0
                      const pct = total > 0 ? Math.round(((item?.concluidas ?? 0) / total) * 100) : 0
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-xs font-semibold space-y-1">
                          <p className="font-extrabold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
                          <p className="text-emerald-600 dark:text-emerald-400">Concluídas: {item?.concluidas ?? 0}</p>
                          <p className="text-amber-600 dark:text-amber-400">Por concluir: {item?.naoConcluidas ?? 0}</p>
                          <p className="text-blue-600 dark:text-blue-400 font-extrabold pt-1 border-t border-slate-100 dark:border-slate-800">
                            Total: {total} · {pct}% concluídas
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="concluidas" name="Concluídas" stackId="pi" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="naoConcluidas" name="Por concluir" stackId="pi" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Cumprimento do Plano de Manutenção por Ano (mantido como estava) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-emerald-600 h-5 w-5" />
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Cumprimento do Plano de Manutenção (% por Ano)
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  % das OT de PM do ano que estão concluídas
                </p>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planYearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const item = payload[0]?.payload
                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-xs font-semibold space-y-1">
                          <p className="font-extrabold text-slate-800 dark:text-slate-100 mb-1">Ano {label}</p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                            Cumprimento: {item?.percent ?? 0}%
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {item?.concluidas ?? 0} concluídas de {item?.total ?? 0} OT de PM
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="percent" name="% Concluídas" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── LINHA 2: COMPARAÇÃO DOS ANOS (EXCLUSIVA PARA PEDIDOS DE PI) ──────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <CalendarDays className="text-industrial-blue h-5 w-5" />
          <h2 className="text-lg font-bold text-industrial-blue dark:text-slate-100">
            Comparação Anual dos Pedidos de PI
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {/* Gráfico 3: Comparação de Volume de Pedidos de PI por Ano */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-blue-600 h-5 w-5" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    Pedidos de PI por Ano (Volume Anual)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Comparação de PIs Pedidas vs Concluídas em cada ano
                  </p>
                </div>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={piYearlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="pedidas" name="PIs Pedidas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="concluidas" name="PIs Concluídas" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 4: Taxa de Resolução de Pedidos de PI por Ano */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-indigo-600 h-5 w-5" />
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                    Taxa de Resolução de PI por Ano (% Eficiência)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Percentagem de Pedidos de PI resolvidos anualmente
                  </p>
                </div>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={piResolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        const item = payload[0]?.payload
                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-xs font-semibold space-y-1">
                            <p className="font-extrabold text-slate-800 dark:text-slate-100 mb-1">Ano {label}</p>
                            <p className="text-blue-600 dark:text-blue-400">PIs Pedidas: {item?.pedidas ?? 0}</p>
                            <p className="text-emerald-600 dark:text-emerald-400">PIs Concluídas: {item?.concluidas ?? 0}</p>
                            <p className="text-indigo-600 dark:text-indigo-400 font-extrabold pt-1 border-t border-slate-100 dark:border-slate-800">
                              Taxa de Resolução: {item?.percent ?? 0}%
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="pedidas" name="Pedidas" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="concluidas" name="Concluídas" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
