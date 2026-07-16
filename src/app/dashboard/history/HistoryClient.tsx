'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { History as HistoryIcon, CheckSquare, Package, Filter, X } from 'lucide-react'
import type { Intervention, Material, Task } from '@/types/models'
import { formatDateTime, formatDuration } from '@/lib/utils'
import HistoryExportButtons from './HistoryExportButtons'
import Avatar from '@/components/ui/Avatar'
import { useLanguage } from '@/components/providers/LanguageProvider'

type Ref = { id: string; name: string }
type UserRef = Ref & { avatarUrl?: string | null }

/** Histórico com filtros (técnico, equipamento, período) que afetam visualização e exportação — tarefa 12. */
export default function HistoryClient({
  interventions,
  tasks,
  allMaterials,
  users,
  assets,
  userMap,
  assetMap,
  isTechnician,
}: {
  interventions: Intervention[]
  tasks: Task[]
  allMaterials: Material[]
  users: UserRef[]
  assets: Ref[]
  userMap: Record<string, string>
  assetMap: Record<string, string>
  isTechnician: boolean
}) {
  const { dict } = useLanguage()
  const [tecnico, setTecnico] = useState('')
  const [equipamento, setEquipamento] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const matsByIntervention = useMemo(() => {
    const m: Record<string, Material[]> = {}
    for (const mat of allMaterials) {
      if (!m[mat.interventionId]) m[mat.interventionId] = []
      m[mat.interventionId].push(mat)
    }
    return m
  }, [allMaterials])

  const filtered = useMemo(() => {
    return interventions.filter((iv) => {
      if (tecnico && iv.technicianId !== tecnico) return false
      const task = taskMap.get(iv.taskId)
      if (equipamento && task?.assetId !== equipamento) return false
      const data = (iv.startedAt ?? iv.createdAt)?.slice(0, 10)
      if (de && (!data || data < de)) return false
      if (ate && (!data || data > ate)) return false
      return true
    })
  }, [interventions, tecnico, equipamento, de, ate, taskMap])

  const matsFiltered = useMemo(() => {
    const ids = new Set(filtered.map((i) => i.id))
    return allMaterials.filter((m) => ids.has(m.interventionId))
  }, [filtered, allMaterials])

  const temFiltro = tecnico || equipamento || de || ate
  function limpar() { setTecnico(''); setEquipamento(''); setDe(''); setAte('') }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3 no-print">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">{dict.history.title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {filtered.length} / {interventions.length} {isTechnician ? 'suas' : ''}
          </p>
        </div>
        <HistoryExportButtons
          interventions={filtered}
          tasks={tasks}
          allMaterials={matsFiltered}
          userMap={userMap}
          assetMap={assetMap}
        />
      </div>

      {/* Filtros */}
      <div className="card p-3 mb-4 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
            <Filter className="h-3.5 w-3.5" /> {dict.common.filters}
          </span>
          {!isTechnician && (
            <select value={tecnico} onChange={(e) => setTecnico(e.target.value)} className="input text-sm py-1.5 w-auto">
              <option value="">Todos os técnicos</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select value={equipamento} onChange={(e) => setEquipamento(e.target.value)} className="input text-sm py-1.5 w-auto">
            <option value="">Todos os equipamentos</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <label className="text-xs text-gray-500 dark:text-slate-400">De
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="input text-sm py-1.5 ml-1 w-auto" />
          </label>
          <label className="text-xs text-gray-500 dark:text-slate-400">Até
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="input text-sm py-1.5 ml-1 w-auto" />
          </label>
          {temFiltro && (
            <button onClick={limpar} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400">
              <X className="h-3.5 w-3.5" /> {dict.common.clear}
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card px-5 py-12 text-center text-gray-400 dark:text-slate-500">
          <HistoryIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{dict.history.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((iv) => {
            const task = taskMap.get(iv.taskId)
            const done = iv.checklist.filter((c) => c.done).length
            const mats = matsByIntervention[iv.id] ?? []
            const totalCost = mats.reduce((sum, m) => sum + (m.unitCost ?? 0) * m.quantity, 0)
            return (
              <div key={iv.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {task ? (
                      <Link href={`/dashboard/tasks/${iv.taskId}`} className="font-medium text-gray-800 dark:text-slate-200 hover:text-[#2E86C1] hover:underline">
                        {task.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-500 dark:text-slate-400 italic">Tarefa removida</span>
                    )}
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                      <span>{task?.assetId ? `${assetMap[task.assetId] ?? '—'} · ` : ''}</span>
                      <Avatar
                        name={userMap[iv.technicianId] ?? '—'}
                        avatarUrl={users.find((u) => u.id === iv.technicianId)?.avatarUrl}
                        size={14}
                      />
                      <span>{userMap[iv.technicianId] ?? '—'}</span>
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500 dark:text-slate-400">
                    <p>{formatDateTime(iv.startedAt ?? iv.createdAt)}</p>
                    {iv.startedAt && iv.endedAt && (
                      <p className="text-gray-400 dark:text-slate-500 mt-0.5">{formatDuration(iv.startedAt, iv.endedAt)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-slate-400 flex-wrap">
                  {iv.checklist.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <CheckSquare className="h-3.5 w-3.5 text-green-600 dark:text-emerald-500" />
                      {done}/{iv.checklist.length} pontos
                    </span>
                  )}
                  {mats.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-blue-500" />
                      {mats.length} material(ais)
                      {totalCost > 0 && ` · ${totalCost.toFixed(2)} €`}
                    </span>
                  )}
                </div>

                {iv.observations && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/60 rounded-lg px-3 py-2">{iv.observations}</p>
                )}

                {mats.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800/50">
                    <p className="text-xs font-medium text-gray-400 dark:text-slate-500 mb-2">Materiais utilizados</p>
                    <div className="space-y-1">
                      {mats.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/40 rounded px-2.5 py-1.5">
                          <span>
                            <span className="font-medium">{m.name}</span>
                            {m.reference && <span className="text-gray-400 dark:text-slate-500 ml-1">({m.reference})</span>}
                            {' · '}{m.quantity} {m.unit ?? 'un'}
                          </span>
                          {m.unitCost != null && (
                            <span className="text-gray-500 dark:text-slate-400">{(m.unitCost * m.quantity).toFixed(2)} €</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
