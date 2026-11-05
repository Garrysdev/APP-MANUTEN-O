'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Trash2, X } from 'lucide-react'
import { listDeletedItemsAction, restoreDeletedItemAction } from './actions'
import type { DeletedItem } from '@/lib/firebase/data'

function fmt(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return day && m && y ? `${day}/${m}/${y}` : d
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

/** Planos e OT apagados, com "Recuperar" (pedido do Rui, 05/11/2026). */
export default function DeletedItemsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [items, setItems] = useState<DeletedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [kind, setKind] = useState<'all' | 'plan' | 'task'>('all')

  useEffect(() => {
    let alive = true
    listDeletedItemsAction().then((res) => {
      if (!alive) return
      if (res.error) setError(res.error)
      else setItems(res.items || [])
    })
    return () => { alive = false }
  }, [])

  async function restore(item: DeletedItem) {
    setBusyId(item.id)
    setMessage(null)
    setError(null)
    const res = await restoreDeletedItemAction(item.kind, item.id)
    setBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setItems((list) => (list || []).filter((x) => !(x.id === item.id && x.kind === item.kind)))
    setMessage(`${item.kind === 'plan' ? 'Plano' : 'OT'} ${item.title || item.id}: ${res.message || 'Recuperado.'}`)
    router.refresh()
  }

  const shown = (items || []).filter((x) => kind === 'all' || x.kind === kind)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Apagados</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
          {(['all', 'plan', 'task'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === k ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
            >
              {k === 'all' ? 'Todos' : k === 'plan' ? 'Planos' : 'OT'}
            </button>
          ))}
          <p className="ml-auto text-[11px] text-slate-400">
            Apagados antes de 05/11/2026 recuperam-se das cópias de segurança (últimos 30 dias).
          </p>
        </div>

        {message && <p className="mx-5 mt-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p className="mx-5 mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-3 flex-1 overflow-auto px-5 pb-5">
          {items === null && !error && <p className="py-8 text-center text-sm text-slate-400">A carregar…</p>}
          {items !== null && shown.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nada apagado.</p>}
          {shown.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">TAG</th>
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">Apagado em</th>
                  <th className="py-2 pr-2">Estado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={`${item.kind}:${item.id}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-2 text-xs font-semibold text-slate-600">{item.kind === 'plan' ? 'Plano' : `OT${item.otNumber ? ` ${item.otNumber}` : ''}`}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{item.tag || '—'}</td>
                    <td className="py-2 pr-2">
                      {item.title || <span className="text-slate-400">Sem dados ({item.id})</span>}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{fmt(item.date)}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{fmtDateTime(item.deletedAt)}</td>
                    <td className="py-2 pr-2">
                      <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Apagada</span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => restore(item)}
                        className="btn-secondary inline-flex items-center gap-1 !py-1 !text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {busyId === item.id ? 'A recuperar…' : 'Recuperar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
