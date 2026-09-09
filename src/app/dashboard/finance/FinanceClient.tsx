'use client'

import { useMemo, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wrench,
  BarChart2,
  Calendar,
  Users,
  Package,
  Layers,
  Search,
  ExternalLink,
  PieChart as PieChartIcon,
  Clock,
  ArrowUpRight,
  ChevronRight
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import Link from 'next/link'
import type { Task, Asset, User, Intervention, StockItem } from '@/types/models'
import ExcelDateFilter, {
  ExcelDateFilterValues,
  DEFAULT_EXCEL_DATE_FILTER,
  filterByExcelDate
} from '@/components/ui/ExcelDateFilter'

type Props = {
  tasks: Task[]
  assets: Asset[]
  users: User[]
  interventions?: Intervention[]
  stockItems?: StockItem[]
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function FinanceClient({
  tasks,
  assets,
  users,
  interventions = [],
  stockItems = []
}: Props) {
  const [excelDateFilter, setExcelDateFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)
  const [taskSearch, setTaskSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Mapeamento rápido de utilizadores e equipamentos por ID/código
  const userMap = useMemo(() => {
    const map = new Map<string, User>()
    users.forEach((u) => {
      map.set(u.id, u)
      if (u.abbreviation) map.set(u.abbreviation.toUpperCase(), u)
    })
    return map
  }, [users])

  const assetMap = useMemo(() => {
    const map = new Map<string, Asset>()
    assets.forEach((a) => {
      map.set(a.id, a)
      if (a.tag) map.set(a.tag.trim().toUpperCase(), a)
    })
    return map
  }, [assets])

  // Cálculo individual de custo real por OT
  const enrichedTasks = useMemo(() => {
    return tasks.map((t) => {
      // 1. Horas de mão de obra
      let laborHours = 0
      let laborCost = 0
      const taskInterventions = interventions.filter((i) => i.taskId === t.id)

      if (taskInterventions.length > 0) {
        taskInterventions.forEach((inv) => {
          let durationHrs = 0
          if (inv.startedAt && inv.endedAt) {
            const start = new Date(inv.startedAt).getTime()
            const end = new Date(inv.endedAt).getTime()
            if (end > start) durationHrs = (end - start) / (1000 * 60 * 60)
          } else {
            durationHrs = 1.5 // média padrão por intervenção registada
          }
          laborHours += durationHrs

          const tech = userMap.get(inv.technicianId)
          const isExternal = tech?.isExternal || t.executor === 'externo' || (t.tipo || '').includes('stp')
          const hourlyRate = tech?.hourlyRate || (isExternal ? 38.0 : 22.5)
          laborCost += durationHrs * hourlyRate
        })
      } else if (t.startedAt && t.completedAt) {
        const start = new Date(t.startedAt).getTime()
        const end = new Date(t.completedAt).getTime()
        if (end > start) {
          laborHours = Math.min((end - start) / (1000 * 60 * 60), 24)
          const tech = t.assignedTo ? userMap.get(t.assignedTo) : null
          const isExternal = tech?.isExternal || t.executor === 'externo' || (t.tipo || '').includes('stp')
          const rate = tech?.hourlyRate || (isExternal ? 38.0 : 22.5)
          laborCost = laborHours * rate
        }
      } else if (t.status === 'done') {
        // Se a OT foi concluída sem registo exato de horas, estimativa mínima padrão
        const isPreventiva = t.tipo === 'preventiva' || t.tipo === 'pm' || t.tipo === 'plano'
        laborHours = isPreventiva ? 1.0 : 2.5
        const isExternal = t.executor === 'externo' || (t.tipo || '').includes('stp')
        const rate = isExternal ? 38.0 : 22.5
        laborCost = laborHours * rate
      }

      // 2. Custo de Peças / Materiais
      let materialCost = 0
      if (t.totalCost && t.totalCost > laborCost) {
        materialCost = t.totalCost - laborCost
      } else if (t.materialsRequired && t.materialsRequired.length > 0) {
        // Estima custo dos materiais associados com base no stock
        t.materialsRequired.forEach((reqName) => {
          const item = stockItems.find((s) => s.name.toLowerCase().includes(reqName.toLowerCase()))
          materialCost += item?.unitCost || 18.5
        })
      }

      // Se houver totalCost explícito na OT que supere o calculado, respeita o totalCost
      let totalCalculatedCost = laborCost + materialCost
      if (t.totalCost && t.totalCost > 0) {
        totalCalculatedCost = Math.max(t.totalCost, totalCalculatedCost)
      }

      const assignedUser = t.assignedTo ? userMap.get(t.assignedTo) : null
      const isExternalTech = assignedUser?.isExternal || t.executor === 'externo' || (t.tipo || '').includes('stp')
      const matchedAsset = (t.assetId ? assetMap.get(t.assetId) : null) || (t.tag ? assetMap.get(t.tag.trim().toUpperCase()) : null)

      return {
        ...t,
        matchedAsset,
        assignedUser,
        isExternal: isExternalTech,
        laborHours: parseFloat(laborHours.toFixed(1)),
        laborCost: parseFloat(laborCost.toFixed(2)),
        materialCost: parseFloat(materialCost.toFixed(2)),
        calculatedTotalCost: parseFloat(totalCalculatedCost.toFixed(2)),
      }
    })
  }, [tasks, interventions, userMap, assetMap, stockItems])

  // Filtragem pelo Período do Excel
  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      const date = t.completedAt || t.startedAt || t.plannedStartDate || t.createdAt
      return filterByExcelDate(date, excelDateFilter)
    })
  }, [enrichedTasks, excelDateFilter])

  // Estatísticas e Agregações Gerais
  const stats = useMemo(() => {
    let totalSpent = 0
    let totalLaborCost = 0
    let totalMaterialCost = 0
    let totalExternalServices = 0
    let totalLaborHours = 0

    const assetCosts: Record<string, { asset: Asset; cost: number; otCount: number }> = {}
    const techCosts: Record<string, { name: string; isExternal: boolean; cost: number; hours: number; otCount: number }> = {}
    const typeCosts: Record<string, { label: string; cost: number; count: number }> = {
      curativa: { label: 'Corretiva / Curativa (MC/PI)', cost: 0, count: 0 },
      preventiva: { label: 'Preventiva / Plano (PM)', cost: 0, count: 0 },
      projeto: { label: 'Projetos / Melhorias', cost: 0, count: 0 },
      outro: { label: 'Outras Intervenções', cost: 0, count: 0 },
    }

    filteredTasks.forEach((t) => {
      const cost = t.calculatedTotalCost
      totalSpent += cost
      totalLaborCost += t.laborCost
      totalMaterialCost += t.materialCost
      totalLaborHours += t.laborHours

      if (t.isExternal) {
        totalExternalServices += cost
      }

      // Custos por Tipo de Tarefa
      const tipo = (t.tipo || '').toLowerCase()
      const ti = (t.ti || '').toUpperCase()
      if (tipo === 'curativa' || tipo === 'pi' || ti === 'PI' || ti === 'MC') {
        typeCosts.curativa.cost += cost
        typeCosts.curativa.count += 1
      } else if (tipo === 'preventiva' || tipo === 'pm' || tipo === 'plano' || ti === 'PM') {
        typeCosts.preventiva.cost += cost
        typeCosts.preventiva.count += 1
      } else if (tipo === 'projeto' || t.isProject || ti === 'PR') {
        typeCosts.projeto.cost += cost
        typeCosts.projeto.count += 1
      } else {
        typeCosts.outro.cost += cost
        typeCosts.outro.count += 1
      }

      // Custos por Equipamento
      const assetKey = t.matchedAsset?.id || t.assetId || t.tag || 'outros'
      if (t.matchedAsset) {
        if (!assetCosts[assetKey]) {
          assetCosts[assetKey] = { asset: t.matchedAsset, cost: 0, otCount: 0 }
        }
        assetCosts[assetKey].cost += cost
        assetCosts[assetKey].otCount += 1
      }

      // Custos por Técnico
      const techKey = t.assignedTo || (t.assignedUser ? t.assignedUser.name : 'Não Atribuído')
      const techName = t.assignedUser ? t.assignedUser.name : (t.assignedTo || 'Não Atribuído')
      if (!techCosts[techKey]) {
        techCosts[techKey] = {
          name: techName,
          isExternal: t.isExternal,
          cost: 0,
          hours: 0,
          otCount: 0,
        }
      }
      techCosts[techKey].cost += cost
      techCosts[techKey].hours += t.laborHours
      techCosts[techKey].otCount += 1
    })

    // Top 10 Equipamentos
    const topAssets = Object.values(assetCosts)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)

    // Top Técnicos
    const topTechs = Object.values(techCosts)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8)

    // Dados para PieChart de Tipos
    const pieData = Object.values(typeCosts)
      .filter((tc) => tc.cost > 0)
      .map((tc) => ({
        name: tc.label,
        value: parseFloat(tc.cost.toFixed(2)),
      }))

    return {
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalLaborCost: parseFloat(totalLaborCost.toFixed(2)),
      totalMaterialCost: parseFloat(totalMaterialCost.toFixed(2)),
      totalExternalServices: parseFloat(totalExternalServices.toFixed(2)),
      totalLaborHours: parseFloat(totalLaborHours.toFixed(1)),
      completedCount: filteredTasks.filter((t) => t.status === 'done').length,
      topAssets,
      topTechs,
      pieData,
    }
  }, [filteredTasks])

  // Evolução Mensal dos Custos (Ano Atual)
  const monthlyCostTrends = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      mes: MONTH_NAMES[i],
      maoObra: 0,
      materiais: 0,
      servicosExternos: 0,
      total: 0,
    }))

    filteredTasks.forEach((t) => {
      const dStr = t.completedAt || t.startedAt || t.createdAt
      if (!dStr) return
      const d = new Date(dStr)
      if (isNaN(d.getTime())) return
      const mIdx = d.getMonth()
      if (mIdx >= 0 && mIdx < 12) {
        months[mIdx].maoObra += t.isExternal ? 0 : t.laborCost
        months[mIdx].materiais += t.materialCost
        months[mIdx].servicosExternos += t.isExternal ? t.calculatedTotalCost : 0
        months[mIdx].total += t.calculatedTotalCost
      }
    })

    return months.map((m) => ({
      ...m,
      maoObra: Math.round(m.maoObra),
      materiais: Math.round(m.materiais),
      servicosExternos: Math.round(m.servicosExternos),
      total: Math.round(m.total),
    }))
  }, [filteredTasks])

  // Tabela discriminativa de OTs com pesquisa
  const displayTasks = useMemo(() => {
    return filteredTasks.filter((t) => {
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase()
        const mTitle = (t.title || '').toLowerCase().includes(q)
        const mTag = (t.tag || '').toLowerCase().includes(q)
        const mAsset = (t.matchedAsset?.name || '').toLowerCase().includes(q)
        const mTech = (t.assignedUser?.name || '').toLowerCase().includes(q)
        if (!mTitle && !mTag && !mAsset && !mTech) return false
      }

      if (typeFilter !== 'all') {
        const tipo = (t.tipo || '').toLowerCase()
        if (typeFilter === 'curativa' && tipo !== 'curativa' && tipo !== 'pi') return false
        if (typeFilter === 'preventiva' && tipo !== 'preventiva' && tipo !== 'pm' && tipo !== 'plano') return false
        if (typeFilter === 'projeto' && tipo !== 'projeto' && !t.isProject) return false
      }

      return true
    })
  }, [filteredTasks, taskSearch, typeFilter])

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <DollarSign className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Relatório Financeiro & Custos Reais
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">
            Auditoria rigorosa de despesas operacionais: Mão de Obra Interna, Prestadores Externos (STP) e Materiais/Peças.
          </p>
        </div>
      </div>

      {/* Filtro de Datas Excel */}
      <ExcelDateFilter values={excelDateFilter} onChange={setExcelDateFilter} />

      {/* 4 Cartões Executivos de Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Gasto Real</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {stats.totalSpent.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {stats.completedCount} intervenções faturadas no período
          </p>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mão de Obra Interna</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {stats.totalLaborCost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {stats.totalLaborHours} horas técnicas aplicadas
          </p>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Peças & Materiais</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {stats.totalMaterialCost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Consumo de armazém e compras diretas
          </p>
        </div>

        <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Serviços Externos (STP)</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {stats.totalExternalServices.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Contratos e prestadores especializados
          </p>
        </div>
      </div>

      {/* Gráficos de Evolução Financeira */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Barras Empilhadas: Evolução Mensal de Custos */}
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-blue-600" />
                Evolução Mensal de Custos por Rubrica (€)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Repartição entre Mão de Obra Interna, Peças e Serviços Externos ao longo do ano.
              </p>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCostTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis unit="€" tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString('pt-PT')}€`, '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '8px' }} />
                <Bar dataKey="maoObra" name="Mão de Obra Interna" stackId="a" fill="#3b82f6" />
                <Bar dataKey="materiais" name="Peças & Peças" stackId="a" fill="#f59e0b" />
                <Bar dataKey="servicosExternos" name="Serviços Externos" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Circular: Distribuição por Tipo de Manutenção */}
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <PieChartIcon className="h-5 w-5 text-emerald-600" />
              Custos por Tipologia
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proporção de custo: Curativa vs Preventiva vs Projetos.
            </p>

            <div className="h-[220px] w-full mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stats.pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${Number(value).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€`, 'Custo']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
            {stats.pieData.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">{item.value.toLocaleString('pt-PT')}€</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabelas de Desdobramento: Equipamentos Mais Dispendiosos & Custos por Técnico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Equipamentos */}
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-blue-600" />
            Top 10 Equipamentos Mais Dispendiosos
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <th className="pb-2.5">TAG / Equipamento</th>
                  <th className="pb-2.5 text-center">OTs</th>
                  <th className="pb-2.5 text-right">Custo Acumulado</th>
                  <th className="pb-2.5 text-center">Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stats.topAssets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">Sem registos no período.</td>
                  </tr>
                ) : (
                  stats.topAssets.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-2">
                        <span className="font-semibold text-slate-900 dark:text-white block font-mono text-[11px]">
                          {item.asset.tag || 'S/ TAG'}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[240px] block">
                          {item.asset.name}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-medium text-slate-700 dark:text-slate-300">
                        {item.otCount}
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        {item.cost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                      </td>
                      <td className="py-2.5 text-center">
                        <Link
                          href={`/dashboard/assets/${item.asset.id}`}
                          className="p-1 text-slate-400 hover:text-blue-600 inline-block"
                          title="Abrir Cadastro"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Custos por Técnico / Fornecedor */}
        <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-purple-600" />
            Despesas por Técnico / Empresa Prestadora
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <th className="pb-2.5">Técnico / Empresa</th>
                  <th className="pb-2.5 text-center">Horas</th>
                  <th className="pb-2.5 text-center">OTs</th>
                  <th className="pb-2.5 text-right">Total Faturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stats.topTechs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">Sem registos no período.</td>
                  </tr>
                ) : (
                  stats.topTechs.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                          {item.isExternal ? (
                            <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                              Externo (STP)
                            </span>
                          ) : (
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
                              Interno
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-medium text-slate-700 dark:text-slate-300">
                        {item.hours} h
                      </td>
                      <td className="py-2.5 text-center font-medium text-slate-700 dark:text-slate-300">
                        {item.otCount}
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        {item.cost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabela Discriminativa de OTs com Pesquisa e Custos Detalhados */}
      <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Detalhamento de Custos por Ordem de Trabalho
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inspeção detalhada de cada OT com separação de Mão de Obra e Materiais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar OT, TAG ou Técnico..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as Tipologias</option>
              <option value="curativa">Curativas / PIs</option>
              <option value="preventiva">Preventivas / PMs</option>
              <option value="projeto">Projetos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">OT / Título</th>
                <th className="py-3 px-3">Equipamento (TAG)</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Técnico</th>
                <th className="py-3 px-3 text-right">Horas</th>
                <th className="py-3 px-3 text-right">Mão de Obra</th>
                <th className="py-3 px-3 text-right">Materiais</th>
                <th className="py-3 px-3 text-right">Custo Total</th>
                <th className="py-3 px-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {displayTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma OT encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                displayTasks.slice(0, 50).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3">
                      <Link
                        href={`/dashboard/tasks/${t.id}`}
                        className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 block hover:underline"
                      >
                        {t.title}
                      </Link>
                      <span className="text-[10px] text-slate-400">
                        {t.completedAt ? new Date(t.completedAt).toLocaleDateString('pt-PT') : (t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-PT') : '')}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-medium text-slate-900 dark:text-slate-200 block">
                        {t.tag || (t.matchedAsset ? t.matchedAsset.tag : '—')}
                      </span>
                      {t.matchedAsset && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                          {t.matchedAsset.name}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.ti || t.tipo}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-slate-800 dark:text-slate-200">
                        {t.assignedUser ? t.assignedUser.name : (t.assignedTo || '—')}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                      {t.laborHours > 0 ? `${t.laborHours} h` : '—'}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {t.laborCost.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                    </td>

                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {t.materialCost.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {t.calculatedTotalCost.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€
                    </td>

                    <td className="py-3 px-3 text-center">
                      <Link
                        href={`/dashboard/tasks/${t.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 inline-block"
                        title="Abrir OT"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {displayTasks.length > 50 && (
          <p className="text-xs text-slate-500 text-center pt-2">
            A mostrar as primeiras 50 de {displayTasks.length} ordens de trabalho. Use os filtros para refinar.
          </p>
        )}
      </div>
    </div>
  )
}
