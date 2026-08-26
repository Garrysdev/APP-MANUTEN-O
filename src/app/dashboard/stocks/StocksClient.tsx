'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, AlertTriangle, Boxes, Search, Filter, ChevronLeft, ChevronRight, Tag, Layers, CheckSquare } from 'lucide-react'
import type { StockItem, PlanName, Asset } from '@/types/models'
import { createStockItemAction, updateStockItemAction, deleteStockItemAction, bulkAssignStockAssetsAction } from './actions'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

type ModalMode = { type: 'create' } | { type: 'edit'; item: StockItem }

function StockForm({
  defaultValues,
  assets = [],
  onSave,
  onCancel,
  dict,
}: {
  defaultValues?: Partial<StockItem>
  assets?: Asset[]
  onSave: (formData: FormData) => Promise<void>
  onCancel: () => void
  dict: Dictionary
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave(new FormData(e.currentTarget))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formName}</label>
          <input name="name" defaultValue={defaultValues?.name ?? ''} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formRef}</label>
          <input name="reference" defaultValue={defaultValues?.reference ?? defaultValues?.code ?? ''} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formCategory}</label>
          <input name="category" defaultValue={defaultValues?.category ?? ''} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formQuantity}</label>
          <input name="quantity" type="number" min="0" step="0.01" defaultValue={defaultValues?.quantity ?? 0} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formUnit}</label>
          <input name="unit" defaultValue={defaultValues?.unit ?? ''} className="input" placeholder="L, un, kg…" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formCost}</label>
          <input name="unitCost" type="number" min="0" step="0.01" defaultValue={defaultValues?.unitCost ?? defaultValues?.cost ?? ''} className="input" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formMin}</label>
          <input name="minQuantity" type="number" min="0" step="0.01" defaultValue={defaultValues?.minQuantity ?? ''} className="input" placeholder="Ex: 5" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.stocks.formLocation}</label>
          <input name="location" defaultValue={defaultValues?.location ?? ''} className="input" />
        </div>

        {/* Atribuição a Múltiplos Equipamentos */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Equipamentos Atribuídos (Deixar em branco para Consumível Geral)
          </label>
          <select
            name="assetIds"
            multiple
            defaultValue={defaultValues?.assetIds ?? (defaultValues?.assetId ? [defaultValues.assetId] : [])}
            className="input min-h-[90px] text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1.5"
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.area || 'Geral'}] {a.tag ? `[TAG: ${a.tag}] ` : ''}{a.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Pressiona Ctrl / Cmd para selecionar mais do que um equipamento. Se nenhum for selecionado, este artigo fica disponível como consumo livre em todas as OTs.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">{dict.common.cancel}</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? dict.common.loading : dict.common.save}
        </button>
      </div>
    </form>
  )
}

export default function StocksClient({ items, assets = [], plan }: { items: StockItem[], assets?: Asset[], plan: PlanName }) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  function openCreate() {
    if (!planHas(plan, 'stocks') && items.length >= TEASER_LIMITS['stocks']) {
      setLockedFeature('stocks')
      return
    }
    setModal({ type: 'create' })
  }

  async function handleCreate(formData: FormData) {
    const result = await createStockItemAction({}, formData)
    if (result.error) throw new Error(result.error)
    setModal(null)
    router.refresh()
  }

  async function handleEdit(id: string, formData: FormData) {
    const result = await updateStockItemAction(id, {}, formData)
    if (result.error) throw new Error(result.error)
    setModal(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este item do stock?')) return
    await deleteStockItemAction(id)
    router.refresh()
  }

  const [colF, setColF] = useState({
    code: '',
    area: 'all',
    tag: 'all',
    system: 'all',
    name: '',
    unit: 'all',
  })

  // Modal para atribuição em lote a equipamentos por Área/TAG
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [selectedStockIds, setSelectedStockIds] = useState<Set<string>>(new Set())
  const [bulkArea, setBulkArea] = useState<string>('')
  const [bulkTag, setBulkTag] = useState<string>('')
  const [bulkAssignBusy, setBulkAssignBusy] = useState(false)

  const availableAreas = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => { if (i.area) set.add(i.area.trim()) })
    assets.forEach((a) => { if (a.area) set.add(a.area.trim()) })
    return Array.from(set).sort()
  }, [items, assets])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    const poolAssets = colF.area !== 'all'
      ? assets.filter(a => (a.area || '').trim().toLowerCase() === colF.area.toLowerCase())
      : assets
    poolAssets.forEach((a) => { if (a.tag) set.add(a.tag.trim()) })
    items.forEach((i) => { if (i.tag) set.add(i.tag.trim()) })
    return Array.from(set).sort()
  }, [items, assets, colF.area])

  const availableSystems = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => {
      const s = (i.system || i.category || '').trim()
      if (s) set.add(s)
    })
    return Array.from(set).sort()
  }, [items])

  const availableUnits = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => {
      const u = (i.unit || 'un').trim()
      if (u) set.add(u)
    })
    return Array.from(set).sort()
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchSearch =
          item.name.toLowerCase().includes(q) ||
          (item.code || '').toLowerCase().includes(q) ||
          (item.reference || '').toLowerCase().includes(q) ||
          (item.tag || '').toLowerCase().includes(q) ||
          (item.area || '').toLowerCase().includes(q) ||
          (item.category || item.system || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q)
        if (!matchSearch) return false
      }

      if (colF.code.trim()) {
        const cq = colF.code.toLowerCase().trim()
        const codeVal = (item.code || item.reference || item.tag || '').toLowerCase()
        if (!codeVal.includes(cq)) return false
      }

      if (colF.area !== 'all' && (item.area || '—') !== colF.area) return false

      if (colF.tag !== 'all') {
        const itemTag = (item.tag || (item.assetId ? assets.find(a => a.id === item.assetId)?.tag : '') || '').trim().toLowerCase()
        if (itemTag !== colF.tag.trim().toLowerCase()) return false
      }

      if (colF.system !== 'all') {
        const sysVal = item.system || item.category || '—'
        if (sysVal !== colF.system) return false
      }

      if (colF.name.trim()) {
        const nq = colF.name.toLowerCase().trim()
        if (!item.name.toLowerCase().includes(nq)) return false
      }

      if (colF.unit !== 'all' && (item.unit || 'un') !== colF.unit) return false

      return true
    })
  }, [items, assets, search, colF])

  const { sorted: baseSorted, sortKey, sortDir, toggleSort: requestSort } = useTableSort(
    filteredItems,
    {
      code: (i) => i.code || i.reference || i.tag || '',
      area: (i) => i.area || '',
      tag: (i) => i.tag || (i.assetId ? assets.find(a => a.id === i.assetId)?.tag : '') || '',
      system: (i) => i.system || i.category || '',
      name: (i) => i.name,
      quantity: (i) => i.quantity,
      unit: (i) => i.unit || 'un',
    },
    'name',
    'asc'
  )

  // ORDENAÇÃO ESPECIAL: Materiais já atribuídos a TAG/Equipamento aparecem SEMPRE NO TOPO
  const sortedItems = useMemo(() => {
    return [...baseSorted].sort((a, b) => {
      const aTagVal = a.tag || (a.assetId ? assets.find(x => x.id === a.assetId)?.tag : '') || ((a.assetIds || []).length > 0 ? 'yes' : '')
      const bTagVal = b.tag || (b.assetId ? assets.find(x => x.id === b.assetId)?.tag : '') || ((b.assetIds || []).length > 0 ? 'yes' : '')

      const aHasTag = Boolean(aTagVal && aTagVal !== '—')
      const bHasTag = Boolean(bTagVal && bTagVal !== '—')

      if (aHasTag && !bHasTag) return -1
      if (!aHasTag && bHasTag) return 1

      if (colF.tag !== 'all') {
        const aMatch = (aTagVal || '').toLowerCase() === colF.tag.toLowerCase()
        const bMatch = (bTagVal || '').toLowerCase() === colF.tag.toLowerCase()
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
      }

      return 0
    })
  }, [baseSorted, assets, colF.tag])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, colF, pageSize])

  const effectivePageSize = pageSize === -1 ? (sortedItems.length || 1) : pageSize
  const totalPages = Math.ceil(sortedItems.length / effectivePageSize) || 1
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return sortedItems
    return sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [sortedItems, currentPage, pageSize])

  const lowStock = items.filter((i) => i.minQuantity != null && i.quantity <= i.minQuantity && i.quantity > 0)

  return (
    <div>
      {lockedFeature && (
        <UpgradeModal feature={lockedFeature} isTeaser={true} onClose={() => setLockedFeature(null)} />
      )}
      {lowStock.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Stocks abaixo do mínimo</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              {lowStock.map((i) => i.name).slice(0, 5).join(', ')}
              {lowStock.length > 5 && ` +${lowStock.length - 5} mais`}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <span>{dict.stocks.title}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {sortedItems.length} / {items.length}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Cadastro de Inventário & Sobresselentes UR</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setShowBulkAssignModal(true)}
            className="btn-secondary flex items-center gap-1.5 shrink-0 text-xs font-bold text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 px-3 py-2"
            title="Atribuir artigos de stock a múltiplos equipamentos filtrando por Área e/ou TAG"
          >
            <Layers className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>Atribuir por Área/TAG</span>
          </button>
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-1.5 shrink-0 text-xs font-bold px-3 py-2"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>{dict.stocks.newItem}</span>
          </button>
        </div>
      </div>

      {/* Lupa Search Header */}
      <div className="mb-4 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, código, ref, área ou sistema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input text-xs pl-9 py-2 w-full"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card px-5 py-12 text-center text-gray-400 dark:text-slate-500">
          <Boxes className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{dict.stocks.empty}</p>
        </div>
      ) : (
        <div className="card overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/60 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <SortableTh label="COD" sortableKey="code" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2.5 py-2.5 whitespace-nowrap" />
                  <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2 py-2.5 whitespace-nowrap" />
                  <SortableTh label="TAG" sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2 py-2.5 whitespace-nowrap" />
                  <SortableTh label="SISTEMA" sortableKey="system" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2 py-2.5" />
                  <SortableTh label="DESIGNAÇÃO" sortableKey="name" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2.5 py-2.5" />
                  <SortableTh label="QUANT" sortableKey="quantity" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-right px-2 py-2.5 whitespace-nowrap" />
                  <SortableTh label="UNID" sortableKey="unit" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2 py-2.5 whitespace-nowrap" />
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">AÇÕES</th>
                </tr>
                {/* Linha de Filtros por Coluna (Pulldowns) */}
                <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-800 text-[11px]">
                  <td className="p-1">
                    <input
                      type="text"
                      placeholder="Filtrar..."
                      value={colF.code}
                      onChange={(e) => setColF((prev) => ({ ...prev, code: e.target.value }))}
                      className="input text-[11px] py-1 px-1.5 w-full bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="p-1">
                    <select
                      value={colF.area}
                      onChange={(e) => setColF((prev) => ({ ...prev, area: e.target.value }))}
                      className="input text-[11px] py-1 px-1 w-full bg-white dark:bg-slate-900"
                    >
                      <option value="all">Todas ({availableAreas.length})</option>
                      {availableAreas.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <select
                      value={colF.tag}
                      onChange={(e) => setColF((prev) => ({ ...prev, tag: e.target.value }))}
                      className="input text-[11px] py-1 px-1 w-full bg-white dark:bg-slate-900"
                    >
                      <option value="all">Todas ({availableTags.length})</option>
                      {availableTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <select
                      value={colF.system}
                      onChange={(e) => setColF((prev) => ({ ...prev, system: e.target.value }))}
                      className="input text-[11px] py-1 px-1 w-full bg-white dark:bg-slate-900"
                    >
                      <option value="all">Todos ({availableSystems.length})</option>
                      {availableSystems.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      placeholder="Filtrar designação..."
                      value={colF.name}
                      onChange={(e) => setColF((prev) => ({ ...prev, name: e.target.value }))}
                      className="input text-[11px] py-1 px-1.5 w-full bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="p-1"></td>
                  <td className="p-1">
                    <select
                      value={colF.unit}
                      onChange={(e) => setColF((prev) => ({ ...prev, unit: e.target.value }))}
                      className="input text-[11px] py-1 px-1 w-full bg-white dark:bg-slate-900"
                    >
                      <option value="all">Todas</option>
                      {availableUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="p-1 text-center">
                    {(colF.code || colF.area !== 'all' || colF.tag !== 'all' || colF.system !== 'all' || colF.name || colF.unit !== 'all') && (
                      <button
                        onClick={() => setColF({ code: '', area: 'all', tag: 'all', system: 'all', name: '', unit: 'all' })}
                        className="text-[10px] text-red-600 dark:text-red-400 hover:underline font-semibold"
                      >
                        Limpar
                      </button>
                    )}
                  </td>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {paginatedItems.map((item) => {
                  const isLow = item.minQuantity != null && item.quantity <= item.minQuantity && item.quantity > 0
                  const itemTagVal = item.tag || (item.assetId ? assets.find(a => a.id === item.assetId)?.tag : '') || '—'

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-2.5 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.code || item.reference || item.tag || '—'}
                      </td>
                      <td className="px-2 py-2 text-slate-700 dark:text-slate-300 font-mono font-semibold whitespace-nowrap">
                        {item.area || '—'}
                      </td>
                      <td className="px-2 py-2 text-purple-700 dark:text-purple-400 font-mono font-bold whitespace-nowrap">
                        {itemTagVal}
                      </td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-400 max-w-[150px]">
                        <span className="line-clamp-1" title={item.system || item.category || '—'}>
                          {item.system || item.category || '—'}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 max-w-[300px]">
                        <Link href={`/dashboard/stocks/${item.id}`} className="font-bold text-[#2E86C1] hover:underline transition-colors block line-clamp-2" title={item.name}>
                          {item.name}
                        </Link>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1" title={item.description}>{item.description}</p>
                        )}
                        {isLow && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded px-1.5 py-0.2">
                            <AlertTriangle className="h-2.5 w-2.5" /> stock baixo
                          </span>
                        )}
                      </td>
                      <td className={`px-2 py-2 text-right font-mono font-extrabold whitespace-nowrap ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.quantity}
                      </td>
                      <td className="px-2 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{item.unit ?? 'un'}</td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => setModal({ type: 'edit', item })}
                            className="p-1 text-gray-400 hover:text-[#2E86C1] transition-colors"
                            aria-label="Editar"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="input text-xs py-1 px-2"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={-1}>Todos ({sortedItems.length})</option>
              </select>
              <span>registos de um total de <strong>{sortedItems.length}</strong></span>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary p-1 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary p-1 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Criar / Editar */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setModal(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">
              {modal.type === 'create' ? dict.stocks.modalNew : dict.stocks.modalEdit}
            </h2>
            <StockForm
              defaultValues={modal.type === 'edit' ? modal.item : undefined}
              assets={assets}
              onSave={(formData) =>
                modal.type === 'create'
                  ? handleCreate(formData)
                  : handleEdit(modal.item.id, formData)
              }
              onCancel={() => setModal(null)}
              dict={dict}
            />
          </div>
        </div>
      )}

      {/* Modal Atribuição em Lote por Área/TAG */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 w-full max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowBulkAssignModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Atribuir Artigo(s) por Área / TAG</h2>
                <p className="text-xs text-slate-500">Associa materiais do inventário a todos os equipamentos de uma determinada Área ou TAG</p>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Passo 1: Escolher Artigo(s) do Stock */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Selecionar Artigos de Stock a Atribuir:
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  {items.map((it) => {
                    const isChecked = selectedStockIds.has(it.id)
                    return (
                      <label key={it.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selectedStockIds)
                            if (e.target.checked) next.add(it.id)
                            else next.delete(it.id)
                            setSelectedStockIds(next)
                          }}
                          className="rounded accent-purple-600 h-3.5 w-3.5"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{it.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({it.code || it.reference || 'sem ref'})</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Passo 2: Filtrar Área e/ou TAG */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-purple-50/40 dark:bg-purple-950/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/40">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">2. Filtrar por Área:</label>
                  <select
                    value={bulkArea}
                    onChange={(e) => setBulkArea(e.target.value)}
                    className="input text-xs w-full bg-white dark:bg-slate-900"
                  >
                    <option value="">Todas as Áreas ({availableAreas.length})</option>
                    {availableAreas.map((a) => (
                      <option key={a} value={a}>Área {a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Filtrar por TAG Específica:</label>
                  <select
                    value={bulkTag}
                    onChange={(e) => setBulkTag(e.target.value)}
                    className="input text-xs w-full bg-white dark:bg-slate-900"
                  >
                    <option value="">Todas as TAGs</option>
                    {availableTags.map((t) => (
                      <option key={t} value={t}>TAG {t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pré-visualização dos Equipamentos Alvo */}
              {(() => {
                const targetAssets = assets.filter((a) => {
                  if (bulkArea && (a.area || '').trim().toLowerCase() !== bulkArea.trim().toLowerCase()) return false
                  if (bulkTag && (a.tag || '').trim().toLowerCase() !== bulkTag.trim().toLowerCase()) return false
                  return true
                })
                return (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Equipamentos Alvo Encontrados ({targetAssets.length}):
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs bg-white dark:bg-slate-900">
                      {targetAssets.length === 0 ? (
                        <p className="text-slate-400 text-center py-2">Nenhum equipamento encontrado com estes filtros.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {targetAssets.map((a) => (
                            <div key={a.id} className="p-1 rounded bg-slate-50 dark:bg-slate-800/40 text-[11px] truncate">
                              <span className="font-bold text-purple-700 dark:text-purple-400">[{a.area || 'Geral'}] {a.tag ? `[TAG: ${a.tag}] ` : ''}</span>
                              <span className="text-slate-800 dark:text-slate-200">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button type="button" onClick={() => setShowBulkAssignModal(false)} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedStockIds.size === 0 || bulkAssignBusy}
                onClick={async () => {
                  const targetAssetIds = assets
                    .filter((a) => {
                      if (bulkArea && (a.area || '').trim().toLowerCase() !== bulkArea.trim().toLowerCase()) return false
                      if (bulkTag && (a.tag || '').trim().toLowerCase() !== bulkTag.trim().toLowerCase()) return false
                      return true
                    })
                    .map((a) => a.id)

                  if (targetAssetIds.length === 0) {
                    alert('Nenhum equipamento selecionado para atribuição.')
                    return
                  }

                  setBulkAssignBusy(true)
                  const res = await bulkAssignStockAssetsAction(Array.from(selectedStockIds), targetAssetIds)
                  setBulkAssignBusy(false)
                  if (res?.error) {
                    alert(res.error)
                  } else {
                    setShowBulkAssignModal(false)
                    setSelectedStockIds(new Set())
                    router.refresh()
                  }
                }}
                className="btn-primary text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckSquare className="h-4 w-4" />
                {bulkAssignBusy ? 'A guardar…' : `Atribuir ${selectedStockIds.size} Artigo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
