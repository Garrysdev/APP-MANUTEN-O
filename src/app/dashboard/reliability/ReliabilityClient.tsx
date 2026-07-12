'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Activity, Clock, Wrench, AlertTriangle } from 'lucide-react'
import type { Asset, Task } from '@/types/models'

type Props = {
  assets: Asset[]
  tasks: Task[]
}

export default function ReliabilityClient({ assets, tasks }: Props) {
  // Simple calculation for demonstration
  // In a real scenario, MTBF = (Total Uptime) / (Number of Breakdowns)
  // Here we count 'corrective' tasks as breakdowns and sum their duration for MTTR.
  
  const stats = useMemo(() => {
    let totalCorrectives = 0
    let totalRepairTimeHrs = 0 // Mock repair time
    
    const assetStats = assets.map(a => {
      const assetTasks = tasks.filter(t => t.assetId === a.id)
      const correctives = assetTasks.filter(t => t.tipo === 'corretiva')
      
      const breakdowns = correctives.length
      totalCorrectives += breakdowns
      
      // Mock MTTR: Assign random 2-5 hours per breakdown if no real data
      const repairTime = breakdowns * 3.5 
      totalRepairTimeHrs += repairTime

      // Mock MTBF: 720 hours in a month. Uptime = 720 - repairTime
      const uptime = 720 - repairTime
      const mtbf = breakdowns > 0 ? uptime / breakdowns : 720
      const mttr = breakdowns > 0 ? repairTime / breakdowns : 0
      const availability = ((uptime / 720) * 100).toFixed(1)

      return {
        name: a.name,
        breakdowns,
        mtbf: Math.round(mtbf),
        mttr: Math.round(mttr),
        availability: parseFloat(availability)
      }
    })

    return {
      assetStats: assetStats.sort((a, b) => a.mtbf - b.mtbf), // Lowest MTBF first (worst performing)
      globalBreakdowns: totalCorrectives,
      globalMtbf: totalCorrectives > 0 ? Math.round((assets.length * 720 - totalRepairTimeHrs) / totalCorrectives) : 720,
      globalMttr: totalCorrectives > 0 ? Math.round(totalRepairTimeHrs / totalCorrectives) : 0,
    }
  }, [assets, tasks])

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-emerald-500">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Activity className="h-5 w-5" />
            <h3 className="font-semibold text-sm">MTBF Global (médio)</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.globalMtbf} <span className="text-base font-normal text-gray-500">horas</span></p>
          <p className="text-xs text-gray-500 mt-2">Tempo Médio Entre Falhas</p>
        </div>
        
        <div className="card p-5 border-l-4 border-orange-500">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <Wrench className="h-5 w-5" />
            <h3 className="font-semibold text-sm">MTTR Global (médio)</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.globalMttr} <span className="text-base font-normal text-gray-500">horas</span></p>
          <p className="text-xs text-gray-500 mt-2">Tempo Médio de Reparação</p>
        </div>

        <div className="card p-5 border-l-4 border-red-500">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-semibold text-sm">Avarias Registadas</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.globalBreakdowns}</p>
          <p className="text-xs text-gray-500 mt-2">Total de OTs Corretivas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico MTBF */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6">MTBF por Equipamento (Horas)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.assetStats.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="mtbf" name="MTBF (h)" radius={[0, 4, 4, 0]}>
                  {stats.assetStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.mtbf < 300 ? '#ef4444' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">* Equipamentos a vermelho indicam MTBF crítico (&lt; 300h).</p>
        </div>

        {/* Gráfico Disponibilidade */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 dark:text-white mb-6">Disponibilidade (%)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.assetStats.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="availability" name="Disponibilidade (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
