import React from 'react'
import type { TipoTarefa } from '@/types/models'
import { TIPO_LABELS } from '@/types/models'

export function getTipoBadgeClass(tipo: TipoTarefa | string): string {
  const t = String(tipo || '').toLowerCase().trim()

  if (t === 'pi') {
    // PI - Vermelho Escuro
    return 'bg-red-900 text-white border border-red-950 font-extrabold shadow-sm'
  }
  if (t === 'curativa' || t === 'mc' || t === 'corretiva') {
    // MC - Amarelo torrado
    return 'bg-amber-600 text-white border border-amber-700 font-extrabold shadow-sm'
  }
  if (t === 'mi' || t === 'investimento') {
    // MI (Manutenção Curativa / Interna) - Verde escuro
    return 'bg-emerald-900 text-white border border-emerald-950 font-bold shadow-sm'
  }
  if (t === 'plano' || t === 'pm') {
    // PM (Plano Manutenção) - Azul escuro e texto branco
    return 'bg-blue-900 text-white border border-blue-950 font-bold shadow-sm'
  }
  if (t === 'stp' || t === 'serviço técnico prestador' || t === 'paragem' || t === 'stop') {
    // STP (STOP-PARAGEM) - Verde fluorescente
    return 'bg-lime-400 text-slate-950 border border-lime-500 font-extrabold shadow-sm'
  }
  if (t === 'preventiva' || t === 'mp' || t === 'preditiva') {
    // MP - Manutenção Preditiva / Preventiva - Roxo texto branco
    return 'bg-purple-800 text-white border border-purple-900 font-bold shadow-sm'
  }
  if (t === 'inspecao' || t === 'ins' || t === 'inspeção' || t === 'inspecções') {
    // INS (Inspeções) - Laranja texto branco
    return 'bg-orange-600 text-white border border-orange-700 font-bold shadow-sm'
  }
  if (t === 'lubrificacao' || t === 'lub' || t === 'lubrificação') {
    // LUB (Lubrificação) - Castanho texto branco
    return 'bg-[#5c3a21] text-white border border-[#3d2616] font-bold shadow-sm'
  }
  if (t === 'calibracao' || t === 'cal' || t === 'calibração' || t === 'calibrações') {
    // CAL (Calibrações) - Branco texto azul
    return 'bg-white text-blue-700 border-2 border-blue-600 font-extrabold shadow-sm'
  }
  if (t === 'projeto' || t === 'projetos' || t === 'projecto' || t === 'projectos' || t === 'pr') {
    return 'bg-amber-800 text-white border border-amber-900 font-bold shadow-sm'
  }

  return 'bg-slate-600 text-white border border-slate-700 font-semibold shadow-sm'
}

export function TipoBadge({ tipo, codeOnly = false }: { tipo: TipoTarefa | string; codeOnly?: boolean }) {
  const cls = getTipoBadgeClass(tipo)
  const t = String(tipo || '').toLowerCase().trim()
  const code = (
    t === 'projeto' || t === 'projetos' || t === 'projecto' || t === 'projectos' || t === 'pr' ? 'PR' :
    t === 'curativa' || t === 'mc' ? 'MC' :
    t === 'mi' ? 'MI' :
    t === 'preventiva' || t === 'mp' ? 'MP' :
    t === 'plano' || t === 'pm' ? 'PM' :
    t === 'pi' ? 'PI' :
    t === 'stp' || t === 'paragem' || t === 'stop' ? 'STP' :
    t === 'inspecao' || t === 'ins' || t === 'inspeção' ? 'INS' :
    t === 'lubrificacao' || t === 'lub' || t === 'lubrificação' ? 'LUB' :
    t === 'calibracao' || t === 'cal' || t === 'calibração' ? 'CAL' :
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
