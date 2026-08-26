'use client'

import type { Task, Asset, User } from '@/types/models'
import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Wrench, BarChart2 } from 'lucide-react'
import ExcelDateFilter, { ExcelDateFilterValues, DEFAULT_EXCEL_DATE_FILTER, filterByExcelDate } from '@/components/ui/ExcelDateFilter'

export default function FinanceClient({ tasks, assets, users }: { tasks: Task[]; assets: Asset[]; users: User[] }) {
  const [excelDateFilter, setExcelDateFilter] = useState<ExcelDateFilterValues>(DEFAULT_EXCEL_DATE_FILTER)

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => filterByExcelDate(t.createdAt || t.plannedStartDate, excelDateFilter))
  }, [tasks, excelDateFilter])

  const stats = useMemo(() => {
    let totalSpent = 0
    let completedTasksWithCost = 0
    const assetCosts: Record<string, number> = {}
    const techCosts: Record<string, number> = {}

    filteredTasks.forEach(t => {
      if (t.totalCost && t.totalCost > 0) {
        totalSpent += t.totalCost
        completedTasksWithCost++

        if (t.assetId) {
          assetCosts[t.assetId] = (assetCosts[t.assetId] || 0) + t.totalCost
        }
        if (t.assignedTo) {
          techCosts[t.assignedTo] = (techCosts[t.assignedTo] || 0) + t.totalCost
        }
      }
    })

    const topAssets = Object.entries(assetCosts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, cost]) => ({
        asset: assets.find(a => a.id === id)?.name || 'Desconhecido',
        cost
      }))

    const topTechs = Object.entries(techCosts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, cost]) => ({
        tech: users.find(u => u.id === id)?.name || 'Desconhecido',
        cost
      }))

    return { totalSpent, completedTasksWithCost, topAssets, topTechs }
  }, [filteredTasks, assets, users])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-500" />
            Dashboard Financeiro
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            Análise de custos de manutenção (peças e mão de obra)
          </p>
        </div>
      </div>

      <ExcelDateFilter values={excelDateFilter} onChange={setExcelDateFilter} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/10 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500 rounded-lg text-white">
              <DollarSign className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-400">Total Gasto</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-white mt-4">{stats.totalSpent.toFixed(2)}€</p>
          <p className="text-sm text-green-700 dark:text-green-500 mt-2">Em {stats.completedTasksWithCost} intervenções faturadas</p>
        </div>

        <div className="card p-6">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-blue-500" /> Equipamentos mais dispendiosos
          </h3>
          <div className="space-y-3">
            {stats.topAssets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados no período selecionado.</p>
            ) : (
              stats.topAssets.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 dark:text-slate-300 truncate max-w-[200px]">{item.asset}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{item.cost.toFixed(2)}€</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-6 md:col-span-2">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <BarChart2 className="h-5 w-5 text-purple-500" /> Custos por Técnico (Mão de Obra + Peças Aplicadas)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {stats.topTechs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados.</p>
            ) : (
              stats.topTechs.map((item, i) => (
                <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/30 flex justify-between items-center">
                  <span className="text-gray-700 dark:text-slate-300 font-medium truncate pr-2">{item.tech}</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{item.cost.toFixed(2)}€</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
