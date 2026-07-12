'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import type { Task, Intervention } from '@/types/models'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS } from '@/types/models'

function toCSV(rows: string[][]): string {
  return rows
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

function download(content: string, filename: string, mime: string) {
  const bom = '﻿' // UTF-8 BOM para Excel abrir correctamente
  const blob = new Blob([bom + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function CSVExportButton({
  tasks,
  interventions,
  userMap,
  assetMap,
}: {
  tasks: Task[]
  interventions: Intervention[]
  userMap: Record<string, string>
  assetMap: Record<string, string>
}) {
  const [open, setOpen] = useState(false)

  function exportTasks() {
    const header = ['ID', 'Título', 'Tipo', 'Criticidade', 'Estado', 'Equipamento', 'Responsável', 'Prazo', 'Criado em']
    const rows = tasks.map((t) => [
      t.id,
      t.title,
      TIPO_LABELS[t.tipo] ?? t.tipo,
      CRITICIDADE_LABELS[t.criticidade],
      STATUS_LABELS[t.status],
      assetMap[t.assetId ?? ''] ?? '',
      userMap[t.assignedTo ?? ''] ?? '',
      t.dueDate ?? '',
      t.createdAt.split('T')[0],
    ])
    download(toCSV([header, ...rows]), `tarefas_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;')
    setOpen(false)
  }

  function exportInterventions() {
    const header = ['ID', 'Ordem de Trabalho (OT)', 'Técnico', 'Início', 'Fim', 'Duração (min)', 'Observações']
    const rows = interventions.map((iv) => {
      const duration = iv.startedAt && iv.endedAt
        ? Math.round((new Date(iv.endedAt).getTime() - new Date(iv.startedAt).getTime()) / 60000)
        : ''
      return [
        iv.id,
        iv.taskId,
        userMap[iv.technicianId] ?? iv.technicianId,
        iv.startedAt ? iv.startedAt.replace('T', ' ').slice(0, 16) : '',
        iv.endedAt ? iv.endedAt.replace('T', ' ').slice(0, 16) : '',
        String(duration),
        iv.observations ?? '',
      ]
    })
    download(toCSV([header, ...rows]), `intervencoes_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Exportar
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
            <button
              onClick={exportTasks}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5 text-gray-400" />
              Tarefas (.csv)
            </button>
            <button
              onClick={exportInterventions}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5 text-gray-400" />
              Intervenções (.csv)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
