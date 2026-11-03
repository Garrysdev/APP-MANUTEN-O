'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, ClipboardList, FolderKanban, Wrench } from 'lucide-react'
import { getStartupSummaryAction, type StartupSummary, type SummaryItem } from '@/app/dashboard/startup-summary-actions'
import { formatDate } from '@/lib/utils'

const SESSION_KEY = 'rg:startup-summary-shown'
const MAX_ROWS = 8

/**
 * Popup ao abrir a app: OT e Projetos em curso e OT de PM desta semana. Aparece uma vez
 * por sessão (sessionStorage) e só se houver alguma coisa para mostrar.
 */
export default function StartupSummaryPopup() {
  const [data, setData] = useState<StartupSummary | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let shown = false
    try { shown = sessionStorage.getItem(SESSION_KEY) === '1' } catch { /* sem storage */ }
    if (shown) return
    getStartupSummaryAction().then((res) => {
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* sem storage */ }
      if (res && (res.tasks.length || res.projects.length || res.pm.length)) {
        setData(res)
        setOpen(true)
      }
    }).catch(() => {})
  }, [])

  if (!open || !data) return null

  const close = () => setOpen(false)
  const section = (title: string, Icon: typeof Wrench, tone: string, items: SummaryItem[], moreHref: string) => (
    <section className="space-y-1.5">
      <h3 className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${tone}`}>
        <Icon className="h-4 w-4" /> {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 pl-5">Nenhuma.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
          {items.slice(0, MAX_ROWS).map((it) => (
            <li key={it.id}>
              <Link href={it.href} onClick={close} className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60">
                {it.tag && <span className="font-mono font-bold text-[10px] text-slate-500 shrink-0">{it.tag}</span>}
                <span className="flex-1 truncate font-semibold text-slate-800 dark:text-slate-100">{it.title}</span>
                {it.date && <span className="font-mono text-[10px] text-slate-500 shrink-0">{formatDate(it.date)}</span>}
              </Link>
            </li>
          ))}
          {items.length > MAX_ROWS && (
            <li>
              <Link href={moreHref} onClick={close} className="block px-2.5 py-1.5 text-[11px] font-bold text-industrial-blue dark:text-sky-400 hover:underline">
                + {items.length - MAX_ROWS} — ver todas
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  )

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="card relative w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Resumo de hoje</h2>
            <p className="text-xs text-slate-500">Semana de {formatDate(data.weekStart)} a {formatDate(data.weekEnd)}</p>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {section('OT em curso', ClipboardList, 'text-teal-700 dark:text-teal-400', data.tasks, '/dashboard/tasks')}
        {section('Projetos em curso', FolderKanban, 'text-indigo-700 dark:text-indigo-400', data.projects, '/dashboard/projects')}
        {section('OT de PM previstas esta semana', Wrench, 'text-amber-700 dark:text-amber-400', data.pm, '/dashboard/maintenance-plan')}
        <div className="flex justify-end">
          <button type="button" onClick={close} className="btn-primary text-xs py-1.5 px-4">Fechar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
