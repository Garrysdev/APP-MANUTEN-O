'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, Check, Search } from 'lucide-react'

export type PickerUser = {
  id: string
  name: string
  externalCompanyName?: string | null
  external: boolean
}

/**
 * Escolha dos técnicos (internos e externos) diretamente na coluna TÉCNICO da tabela do
 * PM. Abre num portal (a tabela tem scroll horizontal e cortava o popover).
 */
export function PlanTechPicker({
  anchor,
  users,
  initial,
  onApply,
  onClose,
}: {
  anchor: HTMLElement
  users: PickerUser[]
  initial: string[]
  onApply: (ids: string[]) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const rect = anchor.getBoundingClientRect()
  const width = 240
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  const openUp = rect.bottom + 320 > window.innerHeight && rect.top > 320
  const pos = openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  const term = q.trim().toLowerCase()
  const list = users.filter((u) => !term || `${u.name} ${u.externalCompanyName || ''}`.toLowerCase().includes(term))
  const internal = list.filter((u) => !u.external)
  const external = list.filter((u) => u.external)

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const row = (u: PickerUser) => (
    <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-[11px]">
      <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="h-3.5 w-3.5" />
      <span className="truncate text-slate-800 dark:text-slate-200">{u.name}</span>
      {u.external && u.externalCompanyName && <span className="ml-auto truncate text-[9px] text-amber-700">{u.externalCompanyName}</span>}
    </label>
  )

  return createPortal(
    <div
      ref={boxRef}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', left, width, ...pos }}
      className="z-[300] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
    >
      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-1.5">
          <Search className="h-3 w-3 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar técnico…" className="w-full bg-transparent py-1 text-[11px] outline-none" />
        </div>
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {internal.length > 0 && <p className="px-2 pt-1 text-[9px] font-bold uppercase text-slate-400">Internos</p>}
        {internal.map(row)}
        {external.length > 0 && <p className="px-2 pt-2 text-[9px] font-bold uppercase text-amber-700 flex items-center gap-1"><Building2 className="h-3 w-3" /> Externos</p>}
        {external.map(row)}
        {list.length === 0 && <p className="px-2 py-3 text-center text-[11px] text-slate-400">Nenhum técnico</p>}
      </div>
      <div className="flex gap-1.5 p-2 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 !py-1 !text-[11px]">Cancelar</button>
        <button type="button" onClick={() => onApply(selected)} className="btn-primary flex-1 !py-1 !text-[11px] inline-flex items-center justify-center gap-1">
          <Check className="h-3 w-3" /> Gravar
        </button>
      </div>
    </div>,
    document.body
  )
}
