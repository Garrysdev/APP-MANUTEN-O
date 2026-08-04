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
  togglePlanCalendarAction,
} from './actions'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { TipoBadge } from '@/components/ui/TipoBadge'
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

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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

type Ref = { id: string; name: string; tag?: string | null }

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
  // Filtros por coluna (estilo Excel - alinhados com a folha PM)
  const emptyCol = { area: '', tag: '', system: '', asset: '', title: '', description: '', tipo: '', period: '', crit: '', executor: '', estado: '' }
  const [colF, setColF] = useState(emptyCol)
  const setCol = (k: keyof typeof emptyCol, v: string) => setColF((c) => ({ ...c, [k]: v }))
  const [fLegal, setFLegal] = useState(false)
  const anyFilter = fLegal || Object.values(colF).some(Boolean)
  function clearFilters() { setColF(emptyCol); setFLegal(false) }

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a.name])), [assets])
  const assetTagMap = useMemo(() => new Map(assets.map((a) => [a.id, a.tag || ''])), [assets])
  const getPlanTag = (p: MaintenancePlan) => p.tag || (p.assetId ? assetTagMap.get(p.assetId) || '' : '')

  // Áreas únicas dos planos
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    plans.forEach((p) => {
      if (p.area && p.area.trim()) set.add(p.area.trim())
    })
    return Array.from(set).sort()
  }, [plans])

  // TAGs únicas em cascata com a ÁREA selecionada
  const availableTags = useMemo(() => {
    const set = new Set<string>()
    plans.forEach((p) => {
      if (colF.area && p.area && p.area.trim().toLowerCase() !== colF.area.trim().toLowerCase()) {
        return
      }
      const t = getPlanTag(p)
      if (t && t.trim()) set.add(t.trim())
    })
    return Array.from(set).sort()
  }, [plans, colF.area, assetTagMap])

  const assetName = (id?: string | null) => (id ? assetMap.get(id) ?? '—' : '—')
  const userName = (id?: string | null) => (id ? users.find((u) => u.id === id)?.name ?? '—' : '—')

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

  // Modal de Agendamento no Calendário
  const [calendarModalPlan, setCalendarModalPlan] = useState<MaintenancePlan | null>(null)
  const [calendarStartDate, setCalendarStartDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [savingCalendar, setSavingCalendar] = useState(false)

  // Previsão de ocorrências por periodicidade
  const calculatedDates = useMemo(() => {
    if (!calendarModalPlan || !calendarStartDate) return []
    const start = new Date(calendarStartDate)
    if (isNaN(start.getTime())) return []
    
    const dates: string[] = []
    const period = calendarModalPlan.periodicidade || 'mensal'

    let count = 12
    if (period === 'semanal') count = 12
    else if (period === 'mensal') count = 12
    else if (period === 'trimestral') count = 4
    else if (period === 'bianual') count = 2
    else if (period === 'anual') count = 3
    else if (period === 'bienal') count = 2
    else if (period === 'trianual') count = 2
    else if (period === 'pontual') count = 1
    else count = 6

    for (let i = 0; i < count; i++) {
      const d = new Date(start)
      if (period === 'semanal') d.setDate(d.getDate() + i * 7)
      else if (period === 'mensal') d.setMonth(d.getMonth() + i)
      else if (period === 'trimestral') d.setMonth(d.getMonth() + i * 3)
      else if (period === 'bianual') d.setMonth(d.getMonth() + i * 6)
      else if (period === 'anual') d.setFullYear(d.getFullYear() + i)
      else if (period === 'bienal') d.setFullYear(d.getFullYear() + i * 2)
      else if (period === 'trianual') d.setFullYear(d.getFullYear() + i * 3)
      else if (period === 'horas') d.setMonth(d.getMonth() + i)
      else if (period === 'pontual') { if (i > 0) break }
      
      dates.push(d.toISOString().slice(0, 10))
    }
    return dates
  }, [calendarModalPlan, calendarStartDate])

  async function handleConfirmCalendarSchedule() {
    if (!calendarModalPlan) return
    setSavingCalendar(true)
    await togglePlanCalendarAction(
      calendarModalPlan.id,
      true,
      calendarStartDate,
      calculatedDates
    )
    setSavingCalendar(false)
    setCalendarModalPlan(null)
    router.refresh()
  }

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
    const header = ['ÁREA', 'TAG', 'SISTEMA', 'EQUIPAMENTO', 'AÇÃO / TAREFA', 'DESCRIÇÃO', 'PERIODICIDADE', 'CAT', 'EXECUTOR', 'ESTADO']
    const rows = shown.map((p) => [
      p.area ?? '',
      getPlanTag(p),
      p.system ?? '',
      assetName(p.assetId),
      p.title,
      p.description ?? '',
      p.periodicidade ? PERIODICIDADE_LABELS[p.periodicidade] : '',
      CRITICIDADE_LABELS[p.criticidade],
      p.executor ? EXECUTOR_LABELS[p.executor] : EXECUTOR_LABELS.interno,
      p.active ? 'Ativo' : 'Inativo',
    ])
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(toCSV([header, ...rows]), `plano_manutencao_${date}.csv`)
  }

  // ── Filtragem por coluna (estilo Excel) ──
  const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const inc = (val: string | null | undefined, f: string) =>
    !f || norm(val).includes(norm(f))

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (colF.area && norm(p.area) !== norm(colF.area)) return false
      if (colF.tag && norm(getPlanTag(p)) !== norm(colF.tag)) return false
      if (!inc(p.system, colF.system)) return false
      if (!inc(assetName(p.assetId), colF.asset)) return false
      if (!inc(p.title, colF.title)) return false
      if (!inc(p.description, colF.description)) return false
      if (!inc(periodLabel(p), colF.period)) return false
      if (colF.crit && p.criticidade !== colF.crit) return false
      if (colF.executor && (p.executor ?? 'interno') !== colF.executor) return false
      if (colF.estado === 'ativo' && !p.active) return false
      if (colF.estado === 'inativo' && p.active) return false
      if (fLegal && !p.legal) return false
      return true
    })
  }, [plans, colF, fLegal, assetMap, assetTagMap])

  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  useEffect(() => { setCurrentPage(1) }, [colF, fLegal, pageSize])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<MaintenancePlan>(
    filtered,
    {
      area: (p) => p.area ?? null,
      tag: (p) => getPlanTag(p),
      system: (p) => p.system ?? null,
      asset: (p) => assetName(p.assetId),
      title: (p) => p.title?.toLowerCase(),
      description: (p) => p.description?.toLowerCase() ?? null,
      period: (p) => periodLabel(p),
      crit: (p) => p.criticidade,
      executor: (p) => (p.executor ? EXECUTOR_LABELS[p.executor] : ''),
      estado: (p) => (p.active ? 0 : 1),
    },
    'title',
  )

  const effectivePageSize = pageSize === -1 ? (shown.length || 1) : pageSize
  const totalPages = Math.ceil(shown.length / effectivePageSize) || 1
  const currentShown = useMemo(() => {
    if (pageSize === -1) return shown
    return shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [shown, currentPage, pageSize])

  const colFilterCls = 'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-safety-orange shadow-sm'

  return (
    <div>
      {lockedFeature && (
        <UpgradeModal feature={lockedFeature} isTeaser={true} onClose={() => setLockedFeature(null)} />
      )}
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 shrink-0">
          {shown.length} / {plans.length}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mr-2">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input text-xs py-1 px-2 w-auto"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={-1}>Todos ({plans.length})</option>
            </select>
          </div>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-1.5">
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{importing ? dict.common.importing : dict.common.import}</span>
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx" onChange={handleImportFile} className="hidden" />
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4 shrink-0" />
            <span>Criar Tarefa</span>
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-medium">
          {importError}
        </div>
      )}
      {importResult && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between text-xs text-green-800 font-medium">
          <span>
            Importação concluída: {importResult.created} planos criados{importResult.skipped > 0 ? `, ${importResult.skipped} ignorados (duplicados)` : ''}.
          </span>
          <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700 dark:hover:text-emerald-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filtros por estado */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {[
          { key: 'todos', label: 'Todos' },
          { key: 'ativo', label: 'Ativo' },
          { key: 'inativo', label: 'Inativo' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCol('estado', key === 'todos' ? '' : key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              (colF.estado === key || (key === 'todos' && !colF.estado))
                ? 'bg-[#1B4F72] text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Barra de filtros: checkbox legais + limpar */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-900 font-bold cursor-pointer select-none bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-sm hover:bg-slate-50">
          <input type="checkbox" checked={fLegal} onChange={(e) => setFLegal(e.target.checked)} className="rounded border-slate-300 text-safety-orange focus:ring-safety-orange w-3.5 h-3.5" />
          <Scale className="h-3.5 w-3.5 text-red-600" />
          <span>Só legais</span>
        </label>
        {anyFilter && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-600 hover:underline font-bold">
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        )}
        <span className="text-xs font-semibold text-slate-700 ml-auto">Filtra por coluna na linha abaixo dos títulos (estilo Excel).</span>
      </div>

      <div className="card overflow-x-auto">
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{dict.maintenancePlan.empty}</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider">
                <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="SISTEMA" sortableKey="system" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="EQUIPAMENTO" sortableKey="asset" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2" />
                <SortableTh label="AÇÃO / TAREFA" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2" />
                <SortableTh label="TIPO / MARCADOR" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="PERIODICIDADE" sortableKey="period" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="CAT" sortableKey="crit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="EXECUTOR" sortableKey="executor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <SortableTh label="ESTADO" sortableKey="estado" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-2 py-2 whitespace-nowrap" />
                <th className="px-2 py-2 text-center text-xs font-bold text-slate-700 uppercase tracking-wide">AÇÕES</th>
              </tr>
              {/* Linha de filtros por coluna (estilo Excel) */}
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-1 py-1">
                  <select
                    value={colF.area}
                    onChange={(e) => {
                      setCol('area', e.target.value)
                      setCol('tag', '')
                    }}
                    className={colFilterCls}
                    title="Filtrar por Área"
                  >
                    <option value="">Todas ({uniqueAreas.length})</option>
                    {uniqueAreas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </th>
                <th className="px-1 py-1">
                  <select
                    value={colF.tag}
                    onChange={(e) => setCol('tag', e.target.value)}
                    className={colFilterCls}
                    title="Filtrar por TAG"
                  >
                    <option value="">Todas ({availableTags.length})</option>
                    {availableTags.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </th>
                <th className="px-1 py-1">
                  <input value={colF.system} onChange={(e) => setCol('system', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-1 py-1">
                  <input value={colF.asset} onChange={(e) => setCol('asset', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-1 py-1">
                  <input value={colF.title} onChange={(e) => setCol('title', e.target.value)} placeholder="filtrar…" className={colFilterCls} />
                </th>
                <th className="px-1 py-1">
                  <select value={colF.tipo} onChange={(e) => setCol('tipo', e.target.value)} className={colFilterCls} title="Filtrar tipo">
                    <option value="">Todos</option>
                    {Object.entries(TIPO_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </th>
                <th className="px-1 py-1">
                  <select value={colF.period} onChange={(e) => setCol('period', e.target.value)} className={colFilterCls} title="Filtrar periodicidade">
                    <option value="">Todas</option>
                    {Object.entries(PERIODICIDADE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </th>
                <th className="px-1 py-1">
                  <select value={colF.crit} onChange={(e) => setCol('crit', e.target.value)} className={colFilterCls} title="Filtrar criticidade">
                    <option value="">Todas</option>
                    {Object.entries(CRITICIDADE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </th>
                <th className="px-1 py-1">
                  <select value={colF.executor} onChange={(e) => setCol('executor', e.target.value)} className={colFilterCls} title="Filtrar executor">
                    <option value="">Todos</option>
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                  </select>
                </th>
                <th className="px-1 py-1">
                  <select value={colF.estado} onChange={(e) => setCol('estado', e.target.value)} className={colFilterCls} title="Filtrar estado">
                    <option value="">Todos</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {currentShown.map((p) => (
                <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${!p.active ? 'opacity-50' : ''}`}>
                  <td className="px-2 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">{p.area || '—'}</td>
                  <td className="px-2 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{getPlanTag(p) || '—'}</span>
                  </td>
                  <td className="px-2 py-2 text-slate-800 font-semibold whitespace-nowrap">{p.system || '—'}</td>
                  <td className="px-2 py-2 text-slate-900 font-bold max-w-[180px]">
                    <span className="line-clamp-2" title={assetName(p.assetId)}>{assetName(p.assetId)}</span>
                  </td>
                  <td className="px-2 py-2 font-bold text-slate-900 max-w-[240px]">
                    <div className="flex items-center gap-1.5">
                      <span className="line-clamp-2" title={p.title}>{p.title}</span>
                      {p.legal && (
                        <span title="Inspeção legal/obrigatória" className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-800 font-bold border border-red-300 shrink-0">
                          <Scale className="h-3 w-3" /> Legal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <TipoBadge tipo={p.tipo || 'plano'} codeOnly={false} />
                      <label className="inline-flex items-center gap-1 cursor-pointer select-none text-[10px] font-bold">
                        <input
                          type="checkbox"
                          checked={p.showInCalendar === true}
                          onChange={async (e) => {
                            if (!e.target.checked) {
                              await togglePlanCalendarAction(p.id, false)
                              router.refresh()
                            } else {
                              setCalendarModalPlan(p)
                            }
                          }}
                          className="rounded border-slate-300 text-safety-orange focus:ring-safety-orange h-3.5 w-3.5"
                        />
                        <span className={p.showInCalendar === true ? "text-blue-800 dark:text-blue-300 font-bold" : "text-slate-400"}>
                          {p.showInCalendar === true ? "No Calendário" : "Fora do Calendário"}
                        </span>
                      </label>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-slate-800 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                      {periodLabel(p)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span title={CRITICIDADE_LABELS[p.criticidade]} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.criticidade === 'vermelho' ? 'bg-red-100 text-red-800 border border-red-300' :
                      p.criticidade === 'amarelo' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      {CRITICIDADE_LABELS[p.criticidade]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {p.executor === 'externo' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"><Building2 className="h-3.5 w-3.5" /> Externo</span>
                    ) : (
                      <span className="text-slate-600 font-medium">Interno</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${p.active ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-slate-100 text-slate-600 border border-slate-300'}`}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => handleToggleActive(p)} disabled={isPending} className={`p-1 rounded ${p.active ? 'text-green-600 hover:text-slate-400' : 'text-slate-400 hover:text-green-600'}`} title={p.active ? 'Desativar' : 'Ativar'}>
                      {p.active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(p)} className="p-1 text-slate-500 hover:text-blue-600 rounded" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-1 text-slate-500 hover:text-red-600 rounded" title="Eliminar">
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
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={-1}>Todos ({plans.length})</option>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
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

      {/* Modal Perguntar Datas do Calendário */}
      {calendarModalPlan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setCalendarModalPlan(null)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 mb-1">
                  Agendar Tarefa no Calendário
                </span>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-safety-orange" />
                  {calendarModalPlan.title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  TAG: <span className="font-bold text-gray-800 dark:text-slate-200">{getPlanTag(calendarModalPlan) || '—'}</span> | Periodicidade: <span className="font-bold text-blue-700 dark:text-blue-400 uppercase">{periodLabel(calendarModalPlan)}</span>
                </p>
              </div>
              <button onClick={() => setCalendarModalPlan(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-sm font-bold text-gray-800 dark:text-slate-200 mb-1">
                  Data de Início / 1ª Execução no Calendário *
                </label>
                <input
                  type="date"
                  value={calendarStartDate}
                  onChange={(e) => setCalendarStartDate(e.target.value)}
                  className="input font-mono font-bold"
                  required
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>Previsão de Datas de Ocorrência ({calculatedDates.length})</span>
                  <span className="text-[10px] text-slate-500 font-mono">Calculado p/ {periodLabel(calendarModalPlan)}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pt-1">
                  {calculatedDates.map((dStr, idx) => (
                    <div key={dStr + idx} className="bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-800 text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span className="text-slate-400 text-[9px]">#{idx + 1}</span>
                      <span>{formatDate(dStr)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-slate-800">
              <button type="button" onClick={() => setCalendarModalPlan(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmCalendarSchedule} disabled={savingCalendar} className="btn-primary flex-1">
                {savingCalendar ? 'A guardar…' : 'Confirmar & Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
