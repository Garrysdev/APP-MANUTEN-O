import React from 'react'
import type { TipoTarefa } from '@/types/models'
import { TIPO_LABELS } from '@/types/models'

export function getTipoBadgeClass(tipo: TipoTarefa | string): string {
  const t = String(tipo || '').toLowerCase()
  if (t === 'projeto' || t === 'projetos' || t === 'projecto' || t === 'projectos' || t === 'pr') {
    // Laranja + texto branco - Projetos
    return 'bg-safety-orange text-white border border-orange-600 font-extrabold'
  }
  if (t === 'plano' || t === 'pm') {
    // Azul com texto branco - Plano de Manutenção
    return 'bg-[#1B4F72] text-white border border-[#1B4F72] font-bold'
  }
  if (t === 'curativa' || t === 'mc' || t === 'corretiva') {
    // Amarelo - Manutenção Corretiva
    return 'bg-yellow-400 text-slate-900 border border-yellow-500 font-extrabold'
  }
  if (t === 'investimento' || t === 'mi') {
    // Verde - Manutenção Investimentos
    return 'bg-emerald-600 text-white border border-emerald-700 font-bold'
  }
  if (t === 'pi') {
    // Vermelho, com texto amarelo - Pedido de Intervenção
    return 'bg-red-600 text-yellow-300 border border-red-700 font-extrabold'
  }
  if (t === 'preventiva' || t === 'mp') {
    return 'bg-blue-600 text-white border border-blue-700 font-bold'
  }
  return 'bg-slate-200 text-slate-800 border border-slate-300 font-semibold'
}

export function TipoBadge({ tipo, codeOnly = false }: { tipo: TipoTarefa | string; codeOnly?: boolean }) {
  const cls = getTipoBadgeClass(tipo)
  const t = String(tipo || '').toLowerCase()
  const code = (
    t === 'projeto' || t === 'projetos' || t === 'projecto' || t === 'projectos' || t === 'pr' ? 'PR' :
    t === 'curativa' ? 'MC' :
    t === 'preventiva' ? 'MP' :
    t === 'plano' || t === 'pm' ? 'PM' :
    t === 'pi' ? 'PI' :
    t === 'investimento' || t === 'mi' ? 'MI' :
    t.toUpperCase()
  )
  const label = (TIPO_LABELS as any)[t] || code
  const textToShow = codeOnly || code === label || String(label).toUpperCase() === code ? code : `${code} · ${label}`

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] uppercase tracking-wider shadow-sm ${cls}`}>
      {textToShow}
    </span>
  )
}
