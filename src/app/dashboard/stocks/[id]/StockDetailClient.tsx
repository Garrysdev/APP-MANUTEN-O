'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Plus, History, Activity, CalendarDays, Boxes, Info, CreditCard } from 'lucide-react'
import type { StockItem, StockMovement, Material } from '@/types/models'
import { createStockPurchaseAction } from '../actions'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

export default function StockDetailClient({
  item,
  movements,
  usages
}: {
  item: StockItem
  movements: StockMovement[]
  usages: Material[]
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handlePurchase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await createStockPurchaseAction(item.id, new FormData(e.currentTarget))
      if (result.error) throw new Error(result.error)
      setModalOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setBusy(false)
    }
  }

  const isLow = item.minQuantity != null && item.quantity <= item.minQuantity

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/stocks" className="p-2 -ml-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-6 w-6 text-[#2E86C1]" />
            {item.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {item.reference ? `Ref: ${item.reference}` : 'Sem referência'} • {item.category ?? 'Sem categoria'}
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Registar Compra
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* RESUMO CARD */}
        <div className="card p-6 border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-[#2E86C1]" /> Detalhes do Artigo
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-1">Quantidade Atual</p>
              <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold ${isLow ? 'text-amber-500' : 'text-gray-900 dark:text-slate-100'}`}>
                  {item.quantity}
                </span>
                <span className="text-gray-500 dark:text-slate-400 mb-1">{item.unit || 'un'}</span>
              </div>
              {isLow && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded inline-block">
                  Abaixo da quantidade mínima ({item.minQuantity})
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-1">Custo Unitário</p>
              <p className="text-lg font-medium text-gray-900 dark:text-slate-200">
                {item.unitCost != null ? `${item.unitCost.toFixed(2)} €` : '—'}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide font-semibold mb-1">Localização</p>
              <p className="font-medium text-gray-900 dark:text-slate-200">{item.location || '—'}</p>
            </div>
          </div>
        </div>

        {/* HISTÓRICO DE COMPRAS */}
        <div className="md:col-span-2 card p-6 border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-500" /> Histórico de Compras (Reposição)
          </h3>
          
          {movements.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-slate-500 bg-gray-50/50 dark:bg-slate-800/30 rounded-lg">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum registo de compra para este artigo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800">
                    <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Data</th>
                    <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Descrição</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-slate-400">Qtd</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-slate-400">Custo Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {movements.map(mov => (
                    <tr key={mov.id}>
                      <td className="py-3 text-gray-900 dark:text-slate-200">
                        {format(new Date(mov.createdAt), "dd MMM yyyy, HH:mm", { locale: pt })}
                      </td>
                      <td className="py-3 text-gray-600 dark:text-slate-400">{mov.description}</td>
                      <td className="py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">+{mov.quantity}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-slate-400">
                        {mov.cost != null ? `${mov.cost.toFixed(2)} €` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE UTILIZAÇÃO */}
      <div className="card p-6 border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" /> Histórico de Utilização
        </h3>
        
        {usages.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 bg-gray-50/50 dark:bg-slate-800/30 rounded-lg">
            <Boxes className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Artigo ainda não foi utilizado em nenhuma Ordem de Trabalho.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Data</th>
                  <th className="text-left py-2 font-medium text-gray-500 dark:text-slate-400">Ordem de Trabalho</th>
                  <th className="text-right py-2 font-medium text-gray-500 dark:text-slate-400">Qtd Utilizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                {usages.map(u => (
                  <tr key={u.id}>
                    <td className="py-3 text-gray-900 dark:text-slate-200">
                      {format(new Date(u.createdAt), "dd MMM yyyy", { locale: pt })}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-slate-400">
                      {/* O link para a OT poderia estar aqui se conseguirmos cruzar o ID da tarefa */}
                      <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mr-2">
                        {u.interventionId.slice(0,6)}
                      </span>
                      Utilizado em intervenção
                    </td>
                    <td className="py-3 text-right font-medium text-red-500">-{u.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL COMPRA */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4">Registar Compra</h2>
            <form onSubmit={handlePurchase} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Quantidade a adicionar</label>
                <div className="flex items-center gap-2">
                  <input name="quantity" type="number" min="0.01" step="0.01" className="input flex-1" required />
                  <span className="text-sm text-gray-500 dark:text-slate-400 w-12">{item.unit || 'un'}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Custo Unitário (€) (Opcional)</label>
                <input name="unitCost" type="number" min="0" step="0.01" className="input" placeholder={item.unitCost ? String(item.unitCost) : '0.00'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Descrição (Opcional)</label>
                <input name="description" className="input" placeholder="Fornecedor X, Fatura Y..." />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={busy} className="btn-primary flex-1">
                  {busy ? 'A registar...' : 'Registar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
