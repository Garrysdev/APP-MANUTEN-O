'use client'

import { createPortal } from 'react-dom'
import { Users, X } from 'lucide-react'

export type TechScope = 'this' | 'all'

/**
 * Pergunta, ao mudar o técnico de uma OT de PM, se a mudança é só para esta OT ou também
 * para as próximas OT do plano. `planMode`: a mudança foi feita no próprio plano — aí as
 * próximas mudam sempre e a pergunta é se a OT atual (aberta) também muda.
 */
export function TechScopeDialog({
  planMode = false,
  onChoose,
}: {
  planMode?: boolean
  onChoose: (scope: TechScope | null) => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
      onClick={() => onChoose(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
            <Users className="h-4 w-4 text-industrial-blue" /> Mudar o técnico
          </h3>
          <button type="button" onClick={() => onChoose(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          {planMode
            ? 'As próximas OT deste plano passam a ter este técnico. Mudar também a OT atual (a que está aberta)?'
            : 'Esta OT é de um Plano de Manutenção. A mudança é só para esta OT ou também para as próximas?'}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={() => onChoose('this')} className="btn-secondary w-full py-2 text-xs font-bold">
            {planMode ? 'Só as próximas OT' : 'Só esta OT'}
          </button>
          <button type="button" onClick={() => onChoose('all')} className="btn-primary w-full py-2 text-xs font-bold">
            {planMode ? 'As próximas e a OT atual' : 'Esta e as próximas OT'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
