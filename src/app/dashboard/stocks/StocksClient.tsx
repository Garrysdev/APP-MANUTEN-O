'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, AlertTriangle, Boxes, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import type { StockItem, PlanName } from '@/types/models'
import { createStockItemAction, updateStockItemAction, deleteStockItemAction } from './actions'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

type ModalMode = { type: 'create' } | { type: 'edit'; item: StockItem }

function StockForm({
  defaultValues,
  onSave,
  onCancel,
  dict,
}: {
  defaultValues?: Partial<StockItem>
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

export default function StocksClient({ items, plan }: { items: StockItem[], plan: PlanName }) {
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

  const availableCategories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => { if (i.category) set.add(i.category.trim()) })
    return Array.from(set).sort()
  }, [items])

  const availableAreas = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => { if (i.area) set.add(i.area.trim()) })
    return Array.from(set).sort()
  }, [items])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => {
      if (areaFilter !== 'all' && i.area && i.area.trim().toLowerCase() !== areaFilter.trim().toLowerCase()) return
      if (i.tag) set.add(i.tag.trim())
    })
    return Array.from(set).sort()
  }, [items, areaFilter])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (areaFilter !== 'all' && item.area !== areaFilter) return false
      if (tagFilter !== 'all' && item.tag !== tagFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        (item.code || '').toLowerCase().includes(q) ||
        (item.reference || '').toLowerCase().includes(q) ||
        (item.tag || '').toLowerCase().includes(q) ||
        (item.area || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      )
    })
  }, [items, search, categoryFilter, areaFilter, tagFilter])

  const { sorted: sortedItems, sortKey, sortDir, toggleSort: requestSort } = useTableSort(
    filteredItems,
    {
      code: (i) => i.code || i.reference || '',
      name: (i) => i.name,
      category: (i) => i.category || '',
      area: (i) => i.area || '',
      tag: (i) => i.tag || '',
      quantity: (i) => i.quantity,
      location: (i) => i.location || '',
    },
    'name',
    'asc'
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryFilter, areaFilter, tagFilter, pageSize])

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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
            {dict.stocks.title} ({items.length})
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cadastro de Inventário & Sobresselentes UR</p>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{dict.stocks.newItem}</span>
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, código, ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input text-xs pl-8 py-1.5 w-full"
          />
        </div>

        <div>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="input text-xs py-1.5 w-full"
          >
            <option value="all">Todas as Áreas ({availableAreas.length})</option>
            {availableAreas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="input text-xs py-1.5 w-full"
          >
            <option value="all">Todas as TAGs ({availableTags.length})</option>
            {availableTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input text-xs py-1.5 w-full"
          >
            <option value="all">Todas as Categorias ({availableCategories.length})</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
                  <SortableTh label="CÓD / TAG" sortableKey="code" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2.5 py-2.5 whitespace-nowrap" />
                  <SortableTh label="DESIGNAÇÃO / SOBRESSELANTE" sortableKey="name" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2.5 py-2.5" />
                  <SortableTh label="ÁREA" sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2 py-2.5 whitespace-nowrap" />
                  <SortableTh label="SISTEMA / CATEGORIA" sortableKey="category" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-left px-2 py-2.5" />
                  <SortableTh label="QUANT." sortableKey="quantity" sortKey={sortKey} sortDir={sortDir} onSort={requestSort} className="text-right px-2 py-2.5 whitespace-nowrap" />
                  <th className="text-left px-2 py-2.5 whitespace-nowrap">UNID.</th>
                  <th className="text-left px-2 py-2.5 whitespace-nowrap">LOCAL</th>
                  <th className="px-2 py-2.5 text-center">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                {paginatedItems.map((item) => {
                  const isLow = item.minQuantity != null && item.quantity <= item.minQuantity && item.quantity > 0
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-2.5 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.tag || item.code || item.reference || '—'}
                      </td>
                      <td className="px-2.5 py-2 max-w-[280px]">
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
                      <td className="px-2 py-2 text-slate-700 dark:text-slate-300 font-mono font-semibold whitespace-nowrap">
                        {item.area || '—'}
                      </td>
                      <td className="px-2 py-2 text-slate-600 dark:text-slate-400 max-w-[160px]">
                        <span className="line-clamp-2" title={item.category || item.system || '—'}>{item.category || item.system || '—'}</span>
                      </td>
                      <td className={`px-2 py-2 text-right font-mono font-extrabold whitespace-nowrap ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.quantity}
                      </td>
                      <td className="px-2 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{item.unit ?? 'un'}</td>
                      <td className="px-2 py-2 text-slate-500 dark:text-slate-400 max-w-[120px]">
                        <span className="line-clamp-1" title={item.location ?? '—'}>{item.location ?? '—'}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => setModal({ type: 'edit', item })}
                            className="p-1 text-gray-400 hover:text-[#2E86C1] transition-colors"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Eliminar"
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
    </div>
  )
}
