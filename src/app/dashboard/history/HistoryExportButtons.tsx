'use client'

import { useState } from 'react'
import { Download, Printer, FileSpreadsheet } from 'lucide-react'
import type { Intervention, Material, Task } from '@/types/models'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS } from '@/types/models'

function toCSV(rows: string[][]): string {
  return rows
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

function downloadCSV(content: string, filename: string) {
  const bom = '﻿'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function HistoryExportButtons({
  interventions,
  tasks,
  allMaterials,
  userMap,
  assetMap,
}: {
  interventions: Intervention[]
  tasks: Task[]
  allMaterials: Material[]
  userMap: Record<string, string>
  assetMap: Record<string, string>
}) {
  const [open, setOpen] = useState(false)

  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const matsByIntervention = new Map<string, Material[]>()
  for (const m of allMaterials) {
    const list = matsByIntervention.get(m.interventionId) ?? []
    list.push(m)
    matsByIntervention.set(m.interventionId, list)
  }

  function exportInterventionsCSV() {
    const header = [
      'Data Início', 'Data Fim', 'Duração (min)', 'Técnico',
      'Ordem de Trabalho (OT)', 'Equipamento', 'Tipo', 'Criticidade', 'Estado',
      'Checklist concluídos', 'Checklist total', 'Observações',
      'Nº Materiais', 'Custo Total Materiais (€)',
    ]
    const rows = interventions.map((iv) => {
      const task = taskMap.get(iv.taskId)
      const mats = matsByIntervention.get(iv.id) ?? []
      const totalCost = mats.reduce((s, m) => s + (m.unitCost ?? 0) * m.quantity, 0)
      const duration = iv.startedAt && iv.endedAt
        ? Math.round((new Date(iv.endedAt).getTime() - new Date(iv.startedAt).getTime()) / 60000)
        : ''
      const checkDone = iv.checklist.filter((c) => c.done).length
      return [
        iv.startedAt ? iv.startedAt.replace('T', ' ').slice(0, 16) : '',
        iv.endedAt ? iv.endedAt.replace('T', ' ').slice(0, 16) : '',
        String(duration),
        userMap[iv.technicianId] ?? iv.technicianId,
        task?.title ?? '(removida)',
        task?.assetId ? (assetMap[task.assetId] ?? '') : '',
        task ? (TIPO_LABELS[task.tipo] ?? task.tipo) : '',
        task ? CRITICIDADE_LABELS[task.criticidade] : '',
        task ? STATUS_LABELS[task.status] : '',
        String(checkDone),
        String(iv.checklist.length),
        iv.observations ?? '',
        String(mats.length),
        totalCost > 0 ? totalCost.toFixed(2) : '',
      ]
    })
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(toCSV([header, ...rows]), `historico_intervencoes_${date}.csv`)
    setOpen(false)
  }

  function exportMaterialsCSV() {
    const header = [
      'Data Intervenção', 'Técnico', 'Ordem de Trabalho (OT)', 'Material',
      'Referência', 'Quantidade', 'Unidade', 'Custo/un (€)', 'Total (€)',
    ]
    const rows: string[][] = []
    for (const iv of interventions) {
      const task = taskMap.get(iv.taskId)
      const mats = matsByIntervention.get(iv.id) ?? []
      for (const m of mats) {
        rows.push([
          iv.startedAt ? iv.startedAt.replace('T', ' ').slice(0, 16) : '',
          userMap[iv.technicianId] ?? iv.technicianId,
          task?.title ?? '(removida)',
          m.name,
          m.reference ?? '',
          String(m.quantity),
          m.unit ?? '',
          m.unitCost != null ? String(m.unitCost) : '',
          m.unitCost != null ? (m.unitCost * m.quantity).toFixed(2) : '',
        ])
      }
    }
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(toCSV([header, ...rows]), `historico_materiais_${date}.csv`)
    setOpen(false)
  }

  function handlePrint() {
    setOpen(false)
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="relative flex gap-2 shrink-0">
      <button onClick={handlePrint} className="btn-secondary flex items-center gap-1.5">
        <Printer className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Imprimir</span>
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-secondary flex items-center gap-1.5"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg py-1 min-w-[220px]">
              <button
                onClick={() => {
                  window.open('/api/backup/excel?type=plan', '_blank')
                  setTimeout(() => {
                    window.open('/api/backup/excel?type=tasks', '_blank')
                  }, 500)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-b border-gray-100 dark:border-slate-800"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Backup Completo Excel (PL-MAN & FR-MAN)
              </button>
              <button
                onClick={exportInterventionsCSV}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <Download className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                Intervenções (.csv / Excel)
              </button>
              <button
                onClick={exportMaterialsCSV}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/50"
              >
                <Download className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                Materiais (.csv / Excel)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
