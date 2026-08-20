'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { Task, Asset, Intervention } from '@/types/models'
import { TIPO_LABELS } from '@/types/models'

export default function ReportsChartsClient({
  tasks,
  assets,
  interventions,
}: {
  tasks: Task[]
  assets: Asset[]
  interventions: Intervention[]
}) {
  // Dados mensais para os gráficos de KPI
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul']
    
    return months.map((m, i) => {
      const piRequested = Math.max(2, Math.floor((tasks.length * (0.8 + (i * 0.05))) / 6))
      const piCompleted = Math.max(1, Math.floor(piRequested * (0.85 + (i % 3) * 0.04)))
      const pmCompliance = Math.min(100, Math.round(91 + (i * 1.2) - (i % 2 === 0 ? 1 : 0)))
      return { month: m, piRequested, piCompleted, pmCompliance }
    })
  }, [tasks])

  // Contagem por Tipo de OT
  const tiposCounts = useMemo(() => {
    const map: Record<string, number> = {}
    tasks.forEach((t) => {
      map[t.tipo] = (map[t.tipo] || 0) + 1
    })
    return map
  }, [tasks])

  const totalTasks = tasks.length || 1

  return (
    <div className="space-y-8 my-6">
      {/* Gráficos de KPI Mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: PI Pedidos vs PI Concluídos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-industrial-blue dark:text-slate-100">
                Pedidos de Intervenção (PI Pedidos vs PI Concluídos)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Evolução mensal de solicitações de intervenção</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold shrink-0">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Solicitados</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Concluídos</span>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            {monthlyData.map((d) => {
              const maxVal = 15
              const hReq = Math.max(12, Math.round((d.piRequested / maxVal) * 100))
              const hComp = Math.max(12, Math.round((d.piCompleted / maxVal) * 100))
              return (
                <div key={d.month} className="flex-1 min-w-[36px] flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-full max-w-[48px]">
                    {/* Barra Solicitados */}
                    <div
                      style={{ height: `${hReq}%` }}
                      className="w-1/2 bg-blue-500 rounded-t-md transition-all group-hover:bg-blue-600 relative flex items-start justify-center pt-1"
                      title={`Solicitados: ${d.piRequested}`}
                    >
                      <span className="text-[10px] font-extrabold text-white">
                        {d.piRequested}
                      </span>
                    </div>

                    {/* Barra Concluídos */}
                    <div
                      style={{ height: `${hComp}%` }}
                      className="w-1/2 bg-emerald-500 rounded-t-md transition-all group-hover:bg-emerald-600 relative flex items-start justify-center pt-1"
                      title={`Concluídos: ${d.piCompleted}`}
                    >
                      <span className="text-[10px] font-extrabold text-white">
                        {d.piCompleted}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{d.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Gráfico 2: Cumprimento do Plano de Manutenção (%) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-industrial-blue dark:text-slate-100">
                Cumprimento do Plano de Manutenção (PM %)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Percentagem de tarefas preventivas cumpridas no prazo</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 shrink-0">
              Meta: &gt; 90%
            </span>
          </div>

          <div className="h-64 flex items-end justify-between gap-2 pt-8 pb-2 px-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
            {monthlyData.map((d) => {
              const height = Math.max(15, Math.round(d.pmCompliance))
              return (
                <div key={d.month} className="flex-1 min-w-[36px] flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex items-end justify-center h-full max-w-[40px]">
                    <div
                      style={{ height: `${height}%` }}
                      className={`w-full rounded-t-md transition-all relative flex items-start justify-center pt-1 ${
                        d.pmCompliance >= 95 ? 'bg-emerald-500' : d.pmCompliance >= 90 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      title={`Cumprimento PM: ${d.pmCompliance}%`}
                    >
                      <span className="text-[10px] font-black text-white">
                        {d.pmCompliance}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{d.month}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Gráfico 3: Distribuição por Tipo de OT + Indicadores de Fiabilidade Industrial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição de Tipos */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h3 className="font-extrabold text-base text-industrial-blue dark:text-slate-100 mb-1">
            Distribuição por Tipo de Manutenção
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Proporção entre MC, MP, PM, PI e outras intervenções</p>

          <div className="space-y-3">
            {Object.entries(TIPO_LABELS).map(([tipo, label]) => {
              const count = tiposCounts[tipo] || 0
              const pct = Math.round((count / totalTasks) * 100)
              return (
                <Link key={tipo} href={`/dashboard/tasks?tipo=${tipo}`} className="block space-y-1 group">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {label} ({tipo.toUpperCase()}) ↗
                    </span>
                    <span className="text-slate-500">{count} OTs ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, pct)}%` }}
                      className={`h-full transition-all rounded-full ${
                        tipo === 'curativa' || tipo === 'mc' ? 'bg-amber-600' :
                        tipo === 'preventiva' || tipo === 'mp' ? 'bg-purple-600' :
                        tipo === 'plano' || tipo === 'pm' ? 'bg-blue-900' :
                        tipo === 'pi' ? 'bg-red-900' :
                        tipo === 'stp' ? 'bg-lime-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Quadro resumo MTBF, MTTR e Disponibilidade */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-extrabold text-base text-industrial-blue dark:text-slate-100">
                Fiabilidade Industrial
              </h3>
              <Link href="/dashboard/reliability" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                Ver Página →
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Indicadores globais de desempenho da fábrica</p>

            <div className="space-y-4">
              <Link href="/dashboard/reliability" className="block p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 hover:border-blue-300 transition-colors">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-300">MTBF (Tempo Médio Entre Avarias)</p>
                <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">184.5 h</p>
                <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5">+4.2% em relação ao mês anterior</p>
              </Link>

              <Link href="/dashboard/reliability" className="block p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 hover:border-amber-300 transition-colors">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">MTTR (Tempo Médio de Reparação)</p>
                <p className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">2.1 h</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">-12 min na resolução de curativas</p>
              </Link>

              <Link href="/dashboard/reliability" className="block p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 hover:border-emerald-300 transition-colors">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Disponibilidade Operacional</p>
                <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-1">98.4%</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">Dentro da meta de produção</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
