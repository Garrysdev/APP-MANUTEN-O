'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts'
import {
  Activity,
  Clock,
  Wrench,
  AlertTriangle,
  Search,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Filter,
  BarChart3,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import type { Asset, Task, Intervention } from '@/types/models'

type Props = {
  assets: Asset[]
  tasks: Task[]
  interventions?: Intervention[]
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function ReliabilityClient({ assets, tasks, interventions = [] }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [criticidadeFilter, setCriticidadeFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [hasBreakdownFilter, setHasBreakdownFilter] = useState<'all' | 'with_breakdowns' | 'zero_breakdowns'>('all')
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())

  // Análise detalhada por equipamento
  const assetAnalysis = useMemo(() => {
    return assets.map((a) => {
      // Tarefas associadas por ID ou por TAG canónica
      const assetTasks = tasks.filter((t) => {
        if (t.assetId && t.assetId === a.id) return true
        if (a.tag && t.tag && t.tag.trim().toUpperCase() === a.tag.trim().toUpperCase()) return true
        return false
      })

      // Avarias = OTs curativas, corretivas ou PIs
      const correctives = assetTasks.filter((t) => {
        const tipo = (t.tipo || '').toLowerCase()
        const ti = (t.ti || '').toUpperCase()
        return tipo === 'curativa' || tipo === 'pi' || ti === 'PI' || ti === 'MC' || ti === 'CORRETIVA'
      })

      const breakdownsCount = correctives.length

      // Duração de reparação (MTTR) em horas
      let totalDowntimeHrs = 0
      correctives.forEach((t) => {
        // Se houver intervenções reais para esta tarefa
        const taskInterventions = interventions.filter((i) => i.taskId === t.id)
        let taskInterventionDuration = 0
        taskInterventions.forEach((inv) => {
          if (inv.startedAt && inv.endedAt) {
            const start = new Date(inv.startedAt).getTime()
            const end = new Date(inv.endedAt).getTime()
            if (end > start) {
              taskInterventionDuration += (end - start) / (1000 * 60 * 60)
            }
          }
        })

        if (taskInterventionDuration > 0) {
          totalDowntimeHrs += taskInterventionDuration
        } else if (t.startedAt && t.completedAt) {
          const s = new Date(t.startedAt).getTime()
          const c = new Date(t.completedAt).getTime()
          if (c > s) totalDowntimeHrs += (c - s) / (1000 * 60 * 60)
        } else if (t.createdAt && t.completedAt) {
          const s = new Date(t.createdAt).getTime()
          const c = new Date(t.completedAt).getTime()
          if (c > s) {
            // Se demorou dias, limitamos razoavelmente o tempo de paragem de intervenção direta
            const diffHours = (c - s) / (1000 * 60 * 60)
            totalDowntimeHrs += Math.min(diffHours, 24)
          }
        } else if (t.status === 'done') {
          // Estimativa base de intervenção concluída (ex: 2.5h) se não tiver timestamps precisos
          totalDowntimeHrs += 2.5
        }
      })

      // Tempo de operação disponível no ano (ex: 365 dias * 24h = 8760h, ou período homólogo)
      const totalOperatingHours = 720 * 12 // 8640h anuais nominais
      const operatingHours = Math.max(0, totalOperatingHours - totalDowntimeHrs)

      // MTBF = Tempo de Operação / Número de Falhas
      const mtbf = breakdownsCount > 0 ? operatingHours / breakdownsCount : totalOperatingHours
      // MTTR = Tempo de Reparação / Número de Falhas
      const mttr = breakdownsCount > 0 ? totalDowntimeHrs / breakdownsCount : 0
      // Disponibilidade = (Operação / Total) * 100
      const availability = totalOperatingHours > 0 ? Math.min(100, Math.max(0, (operatingHours / totalOperatingHours) * 100)) : 100

      return {
        asset: a,
        totalTasks: assetTasks.length,
        breakdownsCount,
        downtimeHours: parseFloat(totalDowntimeHrs.toFixed(1)),
        mtbf: Math.round(mtbf),
        mttr: parseFloat(mttr.toFixed(1)),
        availability: parseFloat(availability.toFixed(1)),
        criticidade: a.criticidadeABC || 'C',
      }
    })
  }, [assets, tasks, interventions])

  // KPIs Globais
  const globalKPIs = useMemo(() => {
    let totalBreakdowns = 0
    let totalDowntime = 0
    assetAnalysis.forEach((item) => {
      totalBreakdowns += item.breakdownsCount
      totalDowntime += item.downtimeHours
    })

    const totalAssetHours = assets.length * 720 * 12
    const totalOperating = Math.max(0, totalAssetHours - totalDowntime)
    const globalAvailability = totalAssetHours > 0 ? (totalOperating / totalAssetHours) * 100 : 100
    const globalMtbf = totalBreakdowns > 0 ? Math.round(totalOperating / totalBreakdowns) : (assets.length > 0 ? 8640 : 0)
    const globalMttr = totalBreakdowns > 0 ? parseFloat((totalDowntime / totalBreakdowns).toFixed(1)) : 0

    return {
      totalBreakdowns,
      totalDowntime: Math.round(totalDowntime),
      globalAvailability: parseFloat(globalAvailability.toFixed(1)),
      globalMtbf,
      globalMttr,
    }
  }, [assetAnalysis, assets.length])

  // Evolução Temporal Mês a Mês para o Gráfico por Linha
  const monthlyTrends = useMemo(() => {
    const dataByMonth = Array.from({ length: 12 }, (_, index) => ({
      monthIdx: index,
      mes: MONTH_NAMES[index],
      disponibilidade: 100,
      mtbf: 720,
      mttr: 0,
      avarias: 0,
    }))

    const correctives = tasks.filter((t) => {
      const dateStr = t.completedAt || t.startedAt || t.createdAt
      if (!dateStr) return false
      const d = new Date(dateStr)
      if (isNaN(d.getTime()) || d.getFullYear() !== selectedYear) return false
      const tipo = (t.tipo || '').toLowerCase()
      const ti = (t.ti || '').toUpperCase()
      return tipo === 'curativa' || tipo === 'pi' || ti === 'PI' || ti === 'MC'
    })

    correctives.forEach((t) => {
      const d = new Date(t.completedAt || t.startedAt || t.createdAt)
      const mIdx = d.getMonth()
      if (mIdx >= 0 && mIdx < 12) {
        dataByMonth[mIdx].avarias += 1
      }
    })

    const totalEquipamentos = Math.max(1, assets.length)
    const horasMesEquipamentos = totalEquipamentos * 720

    return dataByMonth.map((m) => {
      // Horas estimadas paradas com base nas avarias do mês (média ~3.2h por avaria se não houver tempo exato)
      const downtimeEstimado = m.avarias * 3.5
      const uptime = Math.max(0, horasMesEquipamentos - downtimeEstimado)
      const disp = parseFloat(((uptime / horasMesEquipamentos) * 100).toFixed(1))
      const mtbfMes = m.avarias > 0 ? Math.round(uptime / m.avarias) : 720
      const mttrMes = m.avarias > 0 ? parseFloat((downtimeEstimado / m.avarias).toFixed(1)) : 0

      return {
        ...m,
        disponibilidade: disp,
        mtbf: mtbfMes,
        mttr: mttrMes,
      }
    })
  }, [tasks, assets.length, selectedYear])

  // Filtragem e ordenação dos equipamentos
  const filteredAssets = useMemo(() => {
    return assetAnalysis
      .filter((item) => {
        // Pesquisa de texto (Nome, TAG, Área, Localização)
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim()
          const matchName = (item.asset.name || '').toLowerCase().includes(q)
          const matchTag = (item.asset.tag || '').toLowerCase().includes(q)
          const matchArea = (item.asset.area || '').toLowerCase().includes(q)
          const matchLoc = (item.asset.location || '').toLowerCase().includes(q)
          if (!matchName && !matchTag && !matchArea && !matchLoc) return false
        }

        // Filtro Criticidade ABC
        if (criticidadeFilter !== 'all') {
          if ((item.asset.criticidadeABC || 'C') !== criticidadeFilter) return false
        }

        // Filtro Avarias
        if (hasBreakdownFilter === 'with_breakdowns' && item.breakdownsCount === 0) return false
        if (hasBreakdownFilter === 'zero_breakdowns' && item.breakdownsCount > 0) return false

        return true
      })
      .sort((a, b) => {
        // Ordenar primeiro os com mais avarias e menor disponibilidade
        if (b.breakdownsCount !== a.breakdownsCount) {
          return b.breakdownsCount - a.breakdownsCount
        }
        return a.availability - b.availability
      })
  }, [assetAnalysis, searchTerm, criticidadeFilter, hasBreakdownFilter])

  return (
    <div className="space-y-6">
      {/* 4 Cartões Executivos de Fiabilidade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disponibilidade Global</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{globalKPIs.globalAvailability}%</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Meta: &gt;95%</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Parque de {assets.length} equipamentos cadastrados</p>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">MTBF Médio (Global)</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{globalKPIs.globalMtbf}</span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">horas</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Tempo Médio Entre Falhas</p>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">MTTR Médio (Global)</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{globalKPIs.globalMttr}</span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">horas</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Tempo Médio de Reparação Técnica</p>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avarias Registadas</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{globalKPIs.totalBreakdowns}</span>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">OTs Curativas</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">~{globalKPIs.totalDowntime}h acumuladas em paragens</p>
        </div>
      </div>

      {/* Gráfico por Linha da Evolução Mensal de Fiabilidade */}
      <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Evolução Temporal de Fiabilidade & Disponibilidade
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gráfico por linha mensal de Disponibilidade Operacional (%), MTBF e Avarias registadas em {selectedYear}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
              <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis yAxisId="left" domain={[60, 100]} unit="%" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="disponibilidade"
                name="Disponibilidade (%)"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981' }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avarias"
                name="Nº Avarias (Curativas)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4, fill: '#ef4444' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="mttr"
                name="MTTR Médio (h)"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secção de Consulta e Análise dos Equipamentos */}
      <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              Matriz de Desempenho e Indicadores por Equipamento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Visualize claramente os equipamentos mais críticos, tempos de paragem e indicadores MTBF/MTTR.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Campo de Pesquisa */}
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar TAG, Nome ou Área..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro Criticidade */}
            <select
              value={criticidadeFilter}
              onChange={(e) => setCriticidadeFilter(e.target.value as any)}
              className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as Criticidades</option>
              <option value="A">Classe A (Críticos)</option>
              <option value="B">Classe B (Médios)</option>
              <option value="C">Classe C (Baixos)</option>
            </select>

            {/* Filtro Avarias */}
            <select
              value={hasBreakdownFilter}
              onChange={(e) => setHasBreakdownFilter(e.target.value as any)}
              className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos os Estados</option>
              <option value="with_breakdowns">Com Avarias Registadas</option>
              <option value="zero_breakdowns">Sem Avarias (100% OK)</option>
            </select>
          </div>
        </div>

        {/* Tabela de Equipamentos Aprimorada */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Área / TAG</th>
                <th className="py-3 px-3">Equipamento</th>
                <th className="py-3 px-3 text-center">Classe</th>
                <th className="py-3 px-3 text-center">Avarias</th>
                <th className="py-3 px-3 text-right">Tempo Parado</th>
                <th className="py-3 px-3 text-right">MTBF</th>
                <th className="py-3 px-3 text-right">MTTR</th>
                <th className="py-3 px-3">Disponibilidade</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhum equipamento corresponde aos filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((item) => {
                  const criticidadeBadge =
                    item.criticidade === 'A'
                      ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : item.criticidade === 'B'
                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'

                  return (
                    <tr
                      key={item.asset.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white block font-mono">
                          {item.asset.tag || 'S/ TAG'}
                        </span>
                        {item.asset.area && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Área {item.asset.area}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <Link
                          href={`/dashboard/assets/${item.asset.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1.5"
                        >
                          {item.asset.name}
                        </Link>
                        {item.asset.location && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                            {item.asset.location}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-[11px] border ${criticidadeBadge}`}
                        >
                          {item.criticidade}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {item.breakdownsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/50">
                            <AlertTriangle className="h-3 w-3" />
                            {item.breakdownsCount}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 0
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                        {item.downtimeHours > 0 ? `${item.downtimeHours} h` : '0 h'}
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {item.mtbf.toLocaleString()} h
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {item.mttr > 0 ? `${item.mttr} h` : '—'}
                      </td>

                      <td className="py-3 px-3">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span
                              className={
                                item.availability >= 98
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : item.availability >= 90
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {item.availability}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.availability >= 98
                                  ? 'bg-emerald-500'
                                  : item.availability >= 90
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, item.availability))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/dashboard/assets/${item.asset.id}`}
                            title="Ver Ficha do Equipamento"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/dashboard/tasks?asset=${encodeURIComponent(item.asset.name)}`}
                            title="Ver OTs deste Equipamento"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span>A mostrar {filteredAssets.length} de {assets.length} equipamentos cadastrados.</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> &ge; 98% (Excelente)</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" /> 90-97% (Atenção)</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" /> &lt; 90% (Crítico)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
