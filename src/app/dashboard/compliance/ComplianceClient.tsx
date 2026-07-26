'use client'

import { useState } from 'react'
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecklistItem {
  id: string
  label: string
  status: 'ok' | 'pending' | 'alert'
}

interface AuditSection {
  title: string
  norm: string
  items: ChecklistItem[]
}

const AUDIT_SECTIONS: AuditSection[] = [
  {
    title: 'Gestão de Equipamentos',
    norm: 'ISO 9001 §7.1.3',
    items: [
      { id: 'eq1', label: 'Todos os equipamentos registados com TAG única', status: 'ok' },
      { id: 'eq2', label: 'Fichas técnicas atualizadas (≤ 12 meses)', status: 'pending' },
      { id: 'eq3', label: 'Calibrações dentro da validade', status: 'alert' },
      { id: 'eq4', label: 'Plano de substituição documentado', status: 'pending' },
    ],
  },
  {
    title: 'Manutenção Preventiva',
    norm: 'NP EN 13306',
    items: [
      { id: 'mp1', label: 'Plano de manutenção anual aprovado', status: 'ok' },
      { id: 'mp2', label: 'Intervalos de manutenção respeitados (≥ 90%)', status: 'ok' },
      { id: 'mp3', label: 'OTs de manutenção com técnico responsável atribuído', status: 'ok' },
      { id: 'mp4', label: 'Relatórios de manutenção arquivados (≥ 5 anos)', status: 'pending' },
    ],
  },
  {
    title: 'Registo de Intervenções',
    norm: 'ISO 9001 §7.5',
    items: [
      { id: 'ri1', label: 'Histórico de intervenções completo e legível', status: 'ok' },
      { id: 'ri2', label: 'Causa raiz registada para avarias críticas', status: 'alert' },
      { id: 'ri3', label: 'Tempos de resposta documentados (MTTR)', status: 'pending' },
    ],
  },
  {
    title: 'Gestão de Stocks e Peças',
    norm: 'ISO 9001 §8.4',
    items: [
      { id: 'st1', label: 'Stock mínimo definido para peças críticas', status: 'ok' },
      { id: 'st2', label: 'Fornecedores qualificados e avaliados', status: 'pending' },
      { id: 'st3', label: 'Rastreabilidade de peças usadas nas OTs', status: 'alert' },
    ],
  },
]

const STATUS_CONFIG = {
  ok:      { label: 'Conforme',   icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/50' },
  pending: { label: 'Pendente',   icon: Clock,          color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-800/50' },
  alert:   { label: 'Não conforme', icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-800/50' },
}

export default function ComplianceClient({ companyName }: { companyName: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 0: true })
  const [statuses, setStatuses] = useState<Record<string, ChecklistItem['status']>>(() => {
    const initial: Record<string, ChecklistItem['status']> = {}
    AUDIT_SECTIONS.forEach(s => s.items.forEach(i => { initial[i.id] = i.status }))
    return initial
  })

  const totalItems = AUDIT_SECTIONS.reduce((acc, s) => acc + s.items.length, 0)
  const okCount = Object.values(statuses).filter(s => s === 'ok').length
  const alertCount = Object.values(statuses).filter(s => s === 'alert').length
  const score = Math.round((okCount / totalItems) * 100)

  const cycleStatus = (id: string) => {
    const order: ChecklistItem['status'][] = ['ok', 'pending', 'alert']
    setStatuses(prev => {
      const current = prev[id]
      const next = order[(order.indexOf(current) + 1) % order.length]
      return { ...prev, [id]: next }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black text-[#1B4F72] dark:text-slate-100 tracking-tight">
          Conformidade
        </h1>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 uppercase tracking-wider font-medium">
          {companyName} · ISO 9001 & NP EN 13306
        </p>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-emerald-500">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Conformidade</p>
          <p className="text-3xl font-black text-[#1B4F72] dark:text-slate-100">{score}%</p>
          <p className="text-xs text-gray-500 mt-1">{okCount}/{totalItems} itens conformes</p>
        </div>
        <div className="card p-5 border-l-4 border-red-500">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Não conformes</p>
          <p className="text-3xl font-black text-red-600">{alertCount}</p>
          <p className="text-xs text-gray-500 mt-1">Requerem ação imediata</p>
        </div>
        <div className="card p-5 border-l-4 border-[#1B4F72]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Próxima Auditoria</p>
          <p className="text-3xl font-black text-[#1B4F72] dark:text-slate-100">—</p>
          <p className="text-xs text-gray-500 mt-1">Não agendada</p>
        </div>
      </div>

      {/* Seção de Documentos de Norma e Procedimentos Oficiais */}
      <div className="card p-5 border border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
          <FileText className="h-5 w-5 text-industrial-blue" />
          Documentos & Normas de Conformidade
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
          Clica em &ldquo;Abrir Documento&rdquo; para consultar a regulamentação completa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-slate-100">NP EN 13306 — Terminologia</p>
              <p className="text-xs text-gray-500">Definições de MP, MC, PM e disponibilidade</p>
            </div>
            <a
              href="/dashboard/knowledge"
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
            >
              Abrir Documento ↗
            </a>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-slate-100">ISO 9001 — Requisitos Mant.</p>
              <p className="text-xs text-gray-500">§7.1.3 Infraestrutura & §7.5 Registos</p>
            </div>
            <a
              href="/dashboard/knowledge"
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
            >
              Abrir Documento ↗
            </a>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {AUDIT_SECTIONS.map((section, idx) => {
          const sectionOk = section.items.filter(i => statuses[i.id] === 'ok').length
          const isOpen = !!expanded[idx]

          return (
            <div key={idx} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#1B4F72] dark:text-blue-400 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{section.title}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{section.norm}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-500">
                    {sectionOk}/{section.items.length}
                  </span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-800/50">
                  {section.items.map(item => {
                    const status = statuses[item.id]
                    const cfg = STATUS_CONFIG[status]
                    const Icon = cfg.icon

                    return (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-slate-300">{item.label}</span>
                        </div>
                        <button
                          onClick={() => cycleStatus(item.id)}
                          title="Clica para alterar estado"
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hover:opacity-80',
                            cfg.bg, cfg.border, cfg.color
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-slate-600 text-center">
        Clica no estado de cada item para alterá-lo · Módulo Enterprise
      </p>
    </div>
  )
}
