'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, AlertTriangle, Boxes } from 'lucide-react'
import type { StockItem, PlanName } from '@/types/models'
import { createStockItemAction, updateStockItemAction, deleteStockItemAction } from './actions'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'
import type { Dictionary } from '@/lib/i18n/dictionaries'

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
          <input name="reference" defaultValue={defaultValues?.reference ?? ''} className="input" />
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
          <input name="unitCost" type="number" min="0" step="0.01" defaultValue={defaultValues?.unitCost ?? ''} className="input" placeholder="0.00" />
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

  const lowStock = items.filter((i) => i.minQuantity != null && i.quantity <= i.minQuantity)

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
              {lowStock.map((i) => i.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
          {dict.stocks.title}
        </h1>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{dict.stocks.newItem}</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card px-5 py-12 text-center text-gray-400 dark:text-slate-500">
          <Boxes className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{dict.stocks.empty}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell w-32">{dict.stocks.colRef}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{dict.stocks.colName}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">{dict.stocks.colCategory}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{dict.stocks.colQuantity}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">{dict.stocks.formUnit}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">{dict.stocks.formCost}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide hidden xl:table-cell">{dict.stocks.colLocation}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                {items.map((item) => {
                  const isLow = item.minQuantity != null && item.quantity <= item.minQuantity
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell font-mono text-xs">{item.reference ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/stocks/${item.id}`} className="font-medium text-[#2E86C1] hover:underline transition-colors block">
                          {item.name}
                        </Link>
                        {isLow && (
                          <span className="mt-1 inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded px-1.5 py-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> stock baixo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden lg:table-cell">{item.category ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-slate-200'}`}>
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell">{item.unit ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 hidden lg:table-cell">
                        {item.unitCost != null ? `${item.unitCost.toFixed(2)} €` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden xl:table-cell">{item.location ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setModal({ type: 'edit', item })}
                            className="p-1.5 text-gray-400 hover:text-[#2E86C1] transition-colors"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {modal.type === 'create' ? dict.stocks.modalNew : dict.stocks.modalEdit}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modal.type === 'create' ? (
              <StockForm dict={dict} onSave={handleCreate} onCancel={() => setModal(null)} />
            ) : (
              <StockForm
                dict={dict}
                defaultValues={modal.item}
                onSave={(fd) => handleEdit(modal.item.id, fd)}
                onCancel={() => setModal(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
