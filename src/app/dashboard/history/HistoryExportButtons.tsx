'use client'

import { useState } from 'react'
import { Download, Printer, FileSpreadsheet } from 'lucide-react'
import ExcelJS from 'exceljs'
import type { Intervention, Material, Task } from '@/types/models'
import { STATUS_LABELS, CRITICIDADE_LABELS, TIPO_LABELS } from '@/types/models'
import { format3DigitId } from './HistoryClient'

async function downloadXLSX(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
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
  filteredRows,
}: {
  interventions: Intervention[]
  tasks: Task[]
  allMaterials: Material[]
  userMap: Record<string, string>
  assetMap: Record<string, string>
  filteredRows?: any[]
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const matsByIntervention = new Map<string, Material[]>()
  for (const m of allMaterials) {
    const list = matsByIntervention.get(m.interventionId) ?? []
    list.push(m)
    matsByIntervention.set(m.interventionId, list)
  }

  function buildHistoryRows() {
    if (filteredRows && filteredRows.length > 0) {
      return filteredRows.map((r) => ({
        id: r.id,
        data: r.data,
        area: r.area,
        equiTag: r.equiTag,
        ti: r.ti,
        avaria: r.avaria,
        tecnicos: r.tecnicos,
        inicio: r.inicio,
        fim: r.fim,
        causa: r.causa,
      }))
    }
    const existingTaskIds = new Set(interventions.map((i) => i.taskId))
    const list: any[] = []
    let index = 0

    // 1. Intervenções ativas
    for (const iv of interventions) {
      const t = taskMap.get(iv.taskId)
      const formattedId = format3DigitId(t?.id || iv.id, index++)
      const inicio = iv.startedAt ? iv.startedAt.replace('T', ' ').slice(0, 16) : (iv.createdAt ? iv.createdAt.replace('T', ' ').slice(0, 16) : '—')
      const fim = iv.endedAt ? iv.endedAt.replace('T', ' ').slice(0, 16) : '—'
      list.push({
        id: formattedId,
        data: (iv.startedAt || iv.createdAt || '').slice(0, 10),
        area: (t as any)?.area || '—',
        equiTag: t?.assetId ? (assetMap[t.assetId] || t?.tag || '—') : (t?.tag || '—'),
        ti: t?.tipo ? (TIPO_LABELS[t.tipo] || t.tipo) : 'MP',
        avaria: t?.title || iv.observations || '—',
        tecnicos: userMap[iv.technicianId] || iv.technicianId || '—',
        inicio,
        fim,
        causa: iv.observations || t?.description || '—',
      })
    }

    // 2. OTs importadas / concluídas
    for (const t of tasks) {
      if ((t as any).source === 'folha_ur_historico' || t.status === 'done' || t.status === 'cancelled') {
        if (!existingTaskIds.has(t.id)) {
          const formattedId = format3DigitId(t.id, index++)
          list.push({
            id: formattedId,
            data: t.plannedStartDate ? t.plannedStartDate.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '—'),
            area: (t as any).area || '—',
            equiTag: t.assetId ? (assetMap[t.assetId] || t.tag || '—') : (t.tag || '—'),
            ti: t.tipo ? (TIPO_LABELS[t.tipo] || t.tipo) : 'MC',
            avaria: t.title || t.description || '—',
            tecnicos: t.assignedTo ? (userMap[t.assignedTo] || t.assignedTo) : '—',
            inicio: t.plannedStartDate ? t.plannedStartDate.slice(0, 10) : '—',
            fim: t.completedAt ? t.completedAt.slice(0, 10) : '—',
            causa: t.description || '—',
          })
        }
      }
    }

    return list
  }

  async function exportInterventionsXLSX() {
    setBusy(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'RG Maintenance'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet('Histórico de Intervenções', {
        views: [{ showGridLines: true }]
      })

      sheet.mergeCells('A1:J1')
      const titleCell = sheet.getCell('A1')
      titleCell.value = 'FR-MAN-09 FOLHA DE REGISTO E HISTÓRICO DE INTERVENÇÕES'
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      sheet.getRow(1).height = 32

      const rows = buildHistoryRows()

      sheet.mergeCells('A2:J2')
      const subCell = sheet.getCell('A2')
      subCell.value = `EXPORTAÇÃO REALIZADA EM: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')} | TOTAL REGISTOS: ${rows.length}`
      subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF333333' } }
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } }
      subCell.alignment = { vertical: 'middle', horizontal: 'center' }
      sheet.getRow(2).height = 20

      sheet.addRow([])

      const headers = ['ID', 'DATA', 'ÁREA', 'EQUIPAMENTO / TAG', 'TI', 'AVARIA / DESCRIÇÃO', 'TÉCNICOS', 'INÍCIO', 'FIM', 'CAUSA / OBS']
      const headerRow = sheet.getRow(4)
      headerRow.values = headers
      headerRow.height = 26
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1B4F72' } },
          left: { style: 'thin', color: { argb: 'FF1B4F72' } },
          bottom: { style: 'medium', color: { argb: 'FF1B4F72' } },
          right: { style: 'thin', color: { argb: 'FF1B4F72' } }
        }
      })

      rows.forEach((r, idx) => {
        const row = sheet.addRow([
          r.id, r.data, r.area, r.equiTag, r.ti, r.avaria, r.tecnicos, r.inicio, r.fim, r.causa
        ])
        row.height = 20
        const isEven = idx % 2 === 0
        const bgColor = isEven ? 'FFFFFFFF' : 'FFF8F9FA'
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Arial', size: 9 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
          cell.alignment = { vertical: 'middle', horizontal: colNum <= 3 || colNum === 5 || colNum >= 8 ? 'center' : 'left' }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
        })
      })

      sheet.columns.forEach((col) => {
        let maxLen = 10
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = String(cell.value || '').length
          if (len > maxLen && len < 50) maxLen = len
        })
        col.width = Math.max(maxLen + 4, 10)
      })

      const date = new Date().toISOString().split('T')[0]
      await downloadXLSX(workbook, `FR-MAN-09_HISTORICO_INTERVENCOES_${date}.xlsx`)
    } catch (e) {
      console.error('Erro ao exportar Excel:', e)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  async function exportMaterialsXLSX() {
    setBusy(true)
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'RG Maintenance'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet('Materiais Utilizados', {
        views: [{ showGridLines: true }]
      })

      sheet.mergeCells('A1:I1')
      const titleCell = sheet.getCell('A1')
      titleCell.value = 'REGISTO E HISTÓRICO DE MATERIAIS UTILIZADOS'
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
      sheet.getRow(1).height = 32

      const headers = ['DATA INTERVENÇÃO', 'TÉCNICO', 'ORDEM DE TRABALHO (OT)', 'MATERIAL', 'REFERÊNCIA', 'QUANTIDADE', 'UNIDADE', 'CUSTO/UN (€)', 'TOTAL (€)']
      const headerRow = sheet.getRow(3)
      headerRow.values = headers
      headerRow.height = 26
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })

      for (const iv of interventions) {
        const task = taskMap.get(iv.taskId)
        const mats = matsByIntervention.get(iv.id) ?? []
        for (const m of mats) {
          const row = sheet.addRow([
            iv.startedAt ? iv.startedAt.replace('T', ' ').slice(0, 16) : '',
            userMap[iv.technicianId] ?? iv.technicianId,
            task?.title ?? '(removida)',
            m.name,
            m.reference ?? '',
            m.quantity,
            m.unit ?? 'un',
            m.unitCost != null ? Number(m.unitCost.toFixed(2)) : 0,
            m.unitCost != null ? Number((m.unitCost * m.quantity).toFixed(2)) : 0,
          ])
          row.height = 20
          row.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 9 }
          })
        }
      }

      sheet.columns.forEach((col) => {
        let maxLen = 12
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = String(cell.value || '').length
          if (len > maxLen && len < 50) maxLen = len
        })
        col.width = Math.max(maxLen + 4, 12)
      })

      const date = new Date().toISOString().split('T')[0]
      await downloadXLSX(workbook, `HISTORICO_MATERIAIS_${date}.xlsx`)
    } catch (e) {
      console.error('Erro ao exportar Materiais Excel:', e)
    } finally {
      setBusy(false)
      setOpen(false)
    }
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
          disabled={busy}
          className="btn-secondary flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{busy ? 'A gerar Excel…' : 'Exportar Excel (.xlsx)'}</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg py-1 min-w-[250px]">
              <button
                onClick={exportInterventionsXLSX}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Histórico de Intervenções (.xlsx)
              </button>

              <button
                onClick={exportMaterialsXLSX}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Materiais Utilizados (.xlsx)
              </button>

              <button
                onClick={() => {
                  window.open('/api/backup/excel?type=plan', '_blank')
                  setTimeout(() => {
                    window.open('/api/backup/excel?type=tasks', '_blank')
                  }, 500)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                Backup Servidor (PL-MAN & FR-MAN .xlsx)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
