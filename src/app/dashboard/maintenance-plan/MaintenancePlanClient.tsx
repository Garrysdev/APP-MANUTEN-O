'use client'

import { useState, useMemo, useEffect, useRef, useTransition, useId } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, ShieldAlert, Power, PowerOff,
  CalendarClock, Building2, Scale, ClipboardList, Upload, Download, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type {
  MaintenancePlan, TaskCriticidade, TipoTarefa, Periodicidade, PlanName
} from '@/types/models'
import {
  CRITICIDADE_LABELS, TIPO_LABELS, RECURRENCE_LABELS,
  PERIODICIDADE_LABELS, EXECUTOR_LABELS,
} from '@/types/models'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import {
  createMaintenancePlanAction,
  updateMaintenancePlanAction,
  deleteMaintenancePlanAction,
  toggleMaintenancePlanActiveAction,
  importMaintenancePlansAction,
} from './actions'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { PREDEFINED_SAFETY_RULES } from '../tasks/TasksClient'

function sanitizeCell(v: string): string {
  // neutraliza formula injection (=, +, -, @, tab, CR) ao abrir o CSV em Excel/Sheets
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
}

function toCSV(rows: string[][]): string {
  return rows
    .map((row) => row.map((v) => `"${sanitizeCell(String(v ?? '')).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

function downloadCSV(content: string, filename: string) {
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type Ref = { id: string; name: string }

const CRITICIDADE_DOT: Record<TaskCriticidade, string> = {
  vermelho: 'bg-red-500',
  amarelo: 'bg-yellow-400',
  verde: 'bg-green-500',
}

const PERIODICIDADE_OPTIONS: Periodicidade[] = ['semanal', 'mensal', 'trimestral', 'bianual', 'anual', 'bienal', 'trianual', 'horas', 'pontual']
const CRITICIDADE_OPTIONS: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
const TIPO_OPTIONS: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']

/** Rótulo de periodicidade: usa a do plano (importada) ou deriva do motor de recorrência. */
function periodLabel(p: MaintenancePlan): string {
  if (p.periodicidade) return PERIODICIDADE_LABELS[p.periodicidade]
  const v = p.recurrenceValue > 1 ? `A cada ${p.recurrenceValue} ` : ''
  return `${v}${RECURRENCE_LABELS[p.recurrence]}`
}

export default function MaintenancePlanClient({
  plans,
  assets,
  users,
  plan,
}: {
  plans: MaintenancePlan[]
  assets: Ref[]
  users: Ref[]
  plan: PlanName
}) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [editing, setEditing] = useState<MaintenancePlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [safetyRules, setSafetyRules] = useState<string[]>([''])
  const [isPending, startTransition] = useTransition()
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null)
  const datalistId = useId()

  // Filtros por coluna (estilo Excel)
  const emptyCol = { title: '', description: '', asset: '', tag: '', period: '', executor: '', months: '', estado: '', crit: '' }
  const [colF, setColF] = useState(emptyCol)
  const setCol = (k: keyof typeof emptyCol, v: string) => setColF((c) => ({ ...c, [k]: v }))
  const [fLegal, setFLegal] = useState(false)
  const anyFilter = fLegal || Object.values(colF).some(Boolean)
  function clearFilters() { setColF(emptyCol); setFLegal(false) }

  const assetName = (id?: string | null) => assets.find((a) => a.id === id)?.name ?? '—'
  const userName = (id?: string | null) => users.find((u) => u.id === id)?.name ?? '—'

  function openCreate() {
    if (!planHas(plan, 'maintenance-plan') && plans.length >= TEASER_LIMITS['maintenance-plan']) {
      setLockedFeature('maintenance-plan')
      return
    }
    setEditing(null)
    setSafetyRules([''])
    setError('')
    setCreating(true)
  }
  function openEdit(plan: MaintenancePlan) {
    setEditing(plan)
    setSafetyRules(plan.safetyRules?.length ? plan.safetyRules : [''])
    setError('')
    setCreating(true)
  }
  function closeModal() {
    setCreating(false)
    setEditing(null)
    setError('')
    setSafetyRules([''])
  }
  function addRule() { setSafetyRules((r) => [...r, '']) }
  function removeRule(i: number) { setSafetyRules((r) => r.filter((_, idx) => idx !== i)) }
  function updateRule(i: number, v: string) { setSafetyRules((r) => r.map((x, idx) => idx === i ? v : x)) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const cleanRules = safetyRules.filter((r) => r.trim())
    fd.set('safetyRules', JSON.stringify(cleanRules.length ? cleanRules : []))
    if (editing) fd.set('id', editing.id)
    const result = editing
      ? await updateMaintenancePlanAction({}, fd)
      : await createMaintenancePlanAction({}, fd)
    setBusy(false)
    if (result.error) setError(result.error)
    else { closeModal(); router.refresh() }
  }

  async function handleDelete(plan: MaintenancePlan) {
    if (!confirm(`Eliminar o plano "${plan.title}"?`)) return
    await deleteMaintenancePlanAction(plan.id)
    router.refresh()
  }
  function handleToggleActive(plan: MaintenancePlan) {
    startTransition(async () => {
      await toggleMaintenancePlanActiveAction(plan.id, !plan.active)
      router.refresh()
    })
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!planHas(plan, 'maintenance-plan') && plans.length >= TEASER_LIMITS['maintenance-plan']) {
      setLockedFeature('maintenance-plan')
      return
    }
    setImporting(true)
    setImportError('')
    setImportResult(null)
    const fd = new FormData()
    fd.set('file', file)
    const result = await importMaintenancePlansAction(fd)
    setImporting(false)
    if (result.error) setImportError(result.error)
    else {
      setImportResult({ created: result.created ?? 0, skipped: result.skipped ?? 0 })
      router.refresh()
    }
  }

  function handleExportCSV() {
    const header = ['TAG', 'ÁREA', 'SISTEMA', 'TAREFA', 'DESCRIÇÃO', 'EQUIPAMENTO', 'PERIODICIDADE', 'EXECUTOR', 'LEGAL', 'MESES', 'CRITICIDADE', 'ESTADO']
    const rows = shown.map((p) => [
      p.tag ?? '',
      p.area ?? '',
      p.system ?? '',
      p.title,
      p.description ?? '',
      assetName(p.assetId),
      p.periodicidade ? PERIODICIDADE_LABELS[p.periodicidade] : '',
      p.executor ? EXECUTOR_LABELS[p.executor] : EXECUTOR_LABELS.interno,
      p.legal ? 'Sim' : 'Não',
      p.months ?? '',
      CRITICIDADE_LABELS[p.criticidade],
      p.active ? 'Ativo' : 'Inativo',
    ])
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(toCSV([header, ...rows]), `plano_manutencao_${date}.csv`)
  }

  // ── Filtragem por coluna (estilo Excel) ──
  const inc = (val: string | null | undefined, f: string) =>
    !f || String(val ?? '').toLowerCase().includes(f.toLowerCase())

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (colF.crit && p.criticidade !== colF.crit) return false
      if (colF.period && p.periodicidade !== colF.period) return false
      if (colF.executor && (p.executor ?? 'interno') !== colF.executor) return false
      if (colF.estado === 'ativo' && !p.active) return false
      if (colF.estado === 'inativo' && p.active) return false
      if (fLegal && !p.legal) return false
      if (!inc(p.title, colF.title)) return false
      if (!inc(p.description, colF.description)) return false
      if (!inc(assetName(p.assetId), colF.asset)) return false
      if (!inc(p.tag, colF.tag)) return false
      if (!inc(p.months, colF.months)) return false
      return true
    })
  }, [plans, colF, fLegal]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => { setCurrentPage(1) }, [colF, fLegal])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<MaintenancePlan>(
    filtered,
    {
      title: (p) => p.title?.toLowerCase(),
      description: (p) => p.description?.toLowerCase() ?? null,
      asset: (p) => assetName(p.assetId),
      tag: (p) => p.tag ?? null,
      period: (p) => periodLabel(p),
      executor: (p) => (p.executor ? EXECUTOR_LABELS[p.executor] : ''),
      months: (p) => p.months ?? null,
      estado: (p) => (p.active ? 0 : 1),
    },
    'title',
  )

  const totalPages = Math.ceil(shown.length / pageSize)
  const currentShown = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const colFilterCls = 'w-full rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-1 text-xs text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#2E86C1]'

  return (
    <div>
      {lockedFeature && (
        <UpgradeModal feature={lockedFeature} isTeaser={true} onClose={() => setLockedFeature(null)} />
      )}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {shown.length} / {plans.length}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="h-4 w-4" /> {importing ? dict.common.importing : dict.common.import}
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx" onChange={handleImportFile} className="hidden" />
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> {dict.maintenancePlan.newPlan}
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <span>{importError}</span>
          <button onClick={() => setImportError('')} className="text-red-500 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {importResult && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-green-50 dark:bg-emerald-900/20 border border-green-200 dark:border-emerald-800/50 px-4 py-3 text-sm text-green-700 dark:text-emerald-400">
          <span>
            {importResult.created} plano(s) importado(s)
            {importResult.skipped > 0 ? `, ${importResult.skipped} linha(s) ignorada(s)` : ''}.
          </span>
          <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700 dark:hover:text-emerald-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filtros por estado — mesma lógica (pills) da página Tarefas */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['', 'ativo', 'inativo'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setCol('estado', s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              colF.estado === s ? 'bg-[#1B4F72] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {s === '' ? 'Todos' : s === 'ativo' ? 'Ativo' : 'Inativo'}
          </button>
        ))}
      </div>

      {/* Barra fina: toggle legais + limpar (filtros detalhados estão por coluna, em baixo) */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400 cursor-pointer select-none">
          <input type="checkbox" checked={fLegal} onChange={(e) => setFLegal(e.target.checked)} className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800" />
          <Scale className="h-3.5 w-3.5" /> Só legais
        </label>
        {anyFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400">
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        )}
        <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Filtra por coluna na linha abaixo dos títulos (estilo Excel).</span>
      </div>

      <div className="card overflow-x-auto">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 dark:text-slate-500">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{dict.maintenancePlan.empty}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <SortableTh label="TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-3 w-6" />
                <SortableTh label={dict.maintenancePlan.colTask} sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Descrição" sortableKey="description" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                <SortableTh label={dict.maintenancePlan.colAsset} sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortableTh label={dict.maintenancePlan.colRecurrence} sortableKey="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label={dict.maintenancePlan.colAssignee} sortableKey="executor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                <SortableTh label="Meses" sortableKey="months" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                <SortableTh label={dict.common.status} sortableKey="estado" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{dict.common.actions}</th>
              </tr>
              {/* Linha de filtros por coluna (estilo Excel) */}
              <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/60">
                <th className="px-2 py-1.5">
                  <input value={colF.tag} onChange={(e) => setCol('tag', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-2 py-1.5">
                  <select value={colF.crit} onChange={(e) => setCol('crit', e.target.value)} className={colFilterCls} title="Filtrar criticidade">
                    <option value="">—</option>
                    {CRITICIDADE_OPTIONS.map((c) => <option key={c} value={c}>{CRITICIDADE_LABELS[c]}</option>)}
                  </select>
                </th>
                <th className="px-2 py-1.5">
                  <input value={colF.title} onChange={(e) => setCol('title', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-2 py-1.5 hidden lg:table-cell">
                  <input value={colF.description} onChange={(e) => setCol('description', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-2 py-1.5 hidden md:table-cell">
                  <input value={colF.asset} onChange={(e) => setCol('asset', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-2 py-1.5">
                  <select value={colF.period} onChange={(e) => setCol('period', e.target.value)} className={colFilterCls} title="Filtrar periodicidade">
                    <option value="">Todas</option>
                    {PERIODICIDADE_OPTIONS.map((p) => <option key={p} value={p}>{PERIODICIDADE_LABELS[p]}</option>)}
                  </select>
                </th>
                <th className="px-2 py-1.5 hidden sm:table-cell">
                  <select value={colF.executor} onChange={(e) => setCol('executor', e.target.value)} className={colFilterCls} title="Filtrar executor">
                    <option value="">Todos</option>
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                  </select>
                </th>
                <th className="px-2 py-1.5 hidden xl:table-cell">
                  <input value={colF.months} onChange={(e) => setCol('months', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-2 py-1.5" title="Filtra pelos separadores acima da tabela" />
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {currentShown.map((p) => (
                <tr key={p.id} className={`border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-3.5 text-gray-600 dark:text-slate-400 text-xs font-mono whitespace-nowrap">{p.tag ?? '—'}</td>
                  <td className="px-3 py-3.5">
                    <span title={CRITICIDADE_LABELS[p.criticidade]} className={`inline-block w-2.5 h-2.5 rounded-full ${CRITICIDADE_DOT[p.criticidade]}`} />
                  </td>
                  <td className="px-3 py-3.5 font-medium text-gray-800 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span>{p.title}</span>
                      {p.legal && (
                        <span title="Inspeção legal/obrigatória" className="inline-flex items-center gap-0.5 rounded bg-red-100 dark:bg-red-900/30 px-1 py-0.5 text-[10px] text-red-700 dark:text-red-400">
                          <Scale className="h-3 w-3" /> Legal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-gray-500 dark:text-slate-400 text-xs hidden lg:table-cell">
                    {p.description ? <span className="line-clamp-2 max-w-[240px]" title={p.description}>{p.description}</span> : '—'}
                  </td>
                  <td className="px-3 py-3.5 text-gray-500 dark:text-slate-400 hidden md:table-cell">{assetName(p.assetId)}</td>
                  <td className="px-3 py-3.5 text-gray-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <CalendarClock className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                      {periodLabel(p)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 hidden sm:table-cell text-xs">
                    {p.executor === 'externo' ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-500"><Building2 className="h-3.5 w-3.5" /> Externo</span>
                    ) : (
                      <span className="text-gray-400 dark:text-slate-500">Interno</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-gray-400 dark:text-slate-500 hidden xl:table-cell text-xs">{p.months ?? '—'}</td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${p.active ? 'bg-green-50 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right whitespace-nowrap">
                    <button onClick={() => handleToggleActive(p)} disabled={isPending} className={`p-1.5 rounded ${p.active ? 'text-green-600 dark:text-emerald-500 hover:text-gray-400 dark:hover:text-slate-400' : 'text-gray-300 dark:text-slate-600 hover:text-green-600 dark:hover:text-emerald-500'}`} title={p.active ? 'Desativar' : 'Ativar'}>
                      {p.active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-[#2E86C1] rounded" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {shown.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 rounded-b-xl">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <span>Linhas por página:</span>
              <select 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                className="bg-transparent border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-300">
              <span className="text-xs">
                {Math.min((currentPage - 1) * pageSize + 1, shown.length)} - {Math.min(currentPage * pageSize, shown.length)} de {shown.length}
              </span>
              
              <div className="flex items-center gap-1 text-gray-400 dark:text-slate-500">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  aria-label="Página seguinte"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="card relative w-full max-w-xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{editing ? dict.maintenancePlan.modalEdit : dict.maintenancePlan.modalNew}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Título *</label>
                <input name="title" defaultValue={editing?.title ?? ''} className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Descrição</label>
                <textarea name="description" defaultValue={editing?.description ?? ''} className="input" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Criticidade</label>
                  <select name="criticidade" defaultValue={editing?.criticidade ?? 'verde'} className="input">
                    {CRITICIDADE_OPTIONS.map((c) => <option key={c} value={c}>{CRITICIDADE_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tipo</label>
                  <select name="tipo" defaultValue={editing?.tipo ?? 'preventiva'} className="input">
                    {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Periodicidade</label>
                  <select name="periodicidade" defaultValue={editing?.periodicidade ?? 'mensal'} className="input">
                    {PERIODICIDADE_OPTIONS.map((p) => <option key={p} value={p}>{PERIODICIDADE_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Executor</label>
                  <select name="executor" defaultValue={editing?.executor ?? 'interno'} className="input">
                    <option value="interno">{EXECUTOR_LABELS.interno}</option>
                    <option value="externo">{EXECUTOR_LABELS.externo}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Equipamento</label>
                  <select name="assetId" defaultValue={editing?.assetId ?? ''} className="input">
                    <option value="">— nenhum —</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Responsável</label>
                  <select name="assignedTo" defaultValue={editing?.assignedTo ?? ''} className="input">
                    <option value="">— nenhum —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 cursor-pointer select-none">
                <input type="checkbox" name="legal" defaultChecked={editing?.legal ?? false} className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800" />
                <Scale className="h-4 w-4 text-red-500" /> Inspeção legal / obrigatória
              </label>

              {/* Regras de segurança */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Regras de segurança
                </label>
                <div className="space-y-2">
                  {safetyRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input 
                        value={rule} 
                        onChange={(e) => updateRule(i, e.target.value)} 
                        className="input flex-1 text-sm" 
                        placeholder={`Regra ${i + 1} (ex: usar EPI, desligar equipamento…)`} 
                        list={datalistId}
                      />
                      {safetyRules.length > 1 && (
                        <button type="button" onClick={() => removeRule(i)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <datalist id={datalistId}>
                  {PREDEFINED_SAFETY_RULES.map(s => <option key={s} value={s} />)}
                </datalist>
                <button type="button" onClick={addRule} className="mt-2 text-sm text-[#2E86C1] hover:underline flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar regra
                </button>
              </div>

              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">{dict.common.cancel}</button>
                <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? dict.common.loading : dict.common.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
