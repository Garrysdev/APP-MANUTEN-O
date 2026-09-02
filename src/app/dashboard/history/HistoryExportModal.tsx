'use client'

import { useState, useMemo } from 'react'
import { Printer, Download, X, Eye, FileSpreadsheet, ArrowLeft, Filter } from 'lucide-react'
import ExcelJS from 'exceljs'
import type { Intervention, Material, Task } from '@/types/models'
import { TIPO_LABELS } from '@/types/models'
import { compareDates, toNormalizedIsoDate, formatDate } from '@/lib/utils'
import { useLanguage } from '@/components/providers/LanguageProvider'
import type { HistoryRow } from './HistoryClient'

async function downloadXLSX(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function HistoryExportModal({
  isOpen,
  onClose,
  initialMode,
  allRows,
  interventions,
  tasks,
  allMaterials,
  userMap,
  assetMap,
  onApplyFiltersToPage,
}: {
  isOpen: boolean
  onClose: () => void
  initialMode: 'print' | 'export'
  allRows: HistoryRow[]
  interventions: Intervention[]
  tasks: Task[]
  allMaterials: Material[]
  userMap: Record<string, string>
  assetMap: Record<string, string>
  onApplyFiltersToPage: (filters: {
    dateFrom: string
    dateTo: string
    area: string
    equiTag: string
    ti: string
    tecnicos: string
  }) => void
}) {
  const { lang } = useLanguage()
  const [mode, setMode] = useState<'print' | 'export'>(initialMode)
  const [contentType, setContentType] = useState<'interventions' | 'materials' | 'backup'>('interventions')

  // Filtros do Modal / Popup
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [area, setArea] = useState('')
  const [equiTag, setEquiTag] = useState('')
  const [ti, setTi] = useState('')
  const [tecnicos, setTecnicos] = useState('')

  const [busy, setBusy] = useState(false)

  // Listas únicas de opções para dropdowns
  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(allRows.map((r) => r.area).filter(Boolean))).sort()
  }, [allRows])

  const uniqueTags = useMemo(() => {
    return Array.from(new Set(allRows.map((r) => r.equiTag).filter(Boolean))).sort()
  }, [allRows])

  const uniqueTechs = useMemo(() => {
    return Array.from(new Set(allRows.map((r) => r.tecnicos).filter((t) => t && t !== '—' && t !== 'N/D'))).sort()
  }, [allRows])

  // Filtragem ao vivo para a pré-visualização
  const norm = (s: string | null | undefined) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const inc = (val: string | null | undefined, f: string) => !f || norm(val).includes(norm(f))

  const filteredPreview = useMemo(() => {
    return allRows
      .filter((r) => {
        if (dateFrom && r.data && r.data < dateFrom) return false
        if (dateTo && r.data && r.data > dateTo) return false
        if (area && norm(r.area) !== norm(area) && !norm(r.area).includes(norm(area))) return false
        if (equiTag && norm(r.equiTag) !== norm(equiTag) && !norm(r.equiTag).includes(norm(equiTag))) return false
        if (ti && norm(r.ti) !== norm(ti)) return false
        if (tecnicos && norm(r.tecnicos) !== norm(tecnicos) && !norm(r.tecnicos).includes(norm(tecnicos))) return false
        return true
      })
      .sort((a, b) => compareDates(a.data, b.data))
  }, [allRows, dateFrom, dateTo, area, equiTag, ti, tecnicos])

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setArea('')
    setEquiTag('')
    setTi('')
    setTecnicos('')
  }

  // Executar Impressão
  function handleConfirmPrint() {
    onApplyFiltersToPage({ dateFrom, dateTo, area, equiTag, ti, tecnicos })
    onClose()
    setTimeout(() => {
      window.print()
    }, 200)
  }

  // Executar Exportação Excel (.xlsx)
  async function handleConfirmExport() {
    setBusy(true)
    try {
      if (contentType === 'backup') {
        window.open('/api/backup/excel?type=plan', '_blank')
        setTimeout(() => {
          window.open('/api/backup/excel?type=tasks', '_blank')
        }, 500)
        onClose()
        return
      }

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'RG Maintenance'
      workbook.created = new Date()

      if (contentType === 'materials') {
        const sheet = workbook.addWorksheet('Materiais Utilizados', { views: [{ showGridLines: true }] })
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

        const taskMap = new Map(tasks.map((t) => [t.id, t]))
        const matsByIntervention = new Map<string, Material[]>()
        for (const m of allMaterials) {
          const list = matsByIntervention.get(m.interventionId) ?? []
          list.push(m)
          matsByIntervention.set(m.interventionId, list)
        }

        for (const iv of interventions) {
          const task = taskMap.get(iv.taskId)
          const mats = matsByIntervention.get(iv.id) ?? []
          for (const m of mats) {
            const dateStr = iv.startedAt ? iv.startedAt.slice(0, 10) : ''
            if (dateFrom && dateStr && dateStr < dateFrom) continue
            if (dateTo && dateStr && dateStr > dateTo) continue
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
        await downloadXLSX(workbook, `HISTORICO_MATERIAIS_${date}.xls`)
      } else {
        // Intervenções (Padrão)
        const sheet = workbook.addWorksheet('Histórico de Intervenções', { views: [{ showGridLines: true }] })

        sheet.mergeCells('A1:J1')
        const titleCell = sheet.getCell('A1')
        titleCell.value = 'FR-MAN-09 FOLHA DE REGISTO E HISTÓRICO DE INTERVENÇÕES'
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
        sheet.getRow(1).height = 32

        sheet.mergeCells('A2:J2')
        const subCell = sheet.getCell('A2')
        subCell.value = `EXPORTAÇÃO REALIZADA EM: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')} | REGISTOS: ${filteredPreview.length}`
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

        filteredPreview.forEach((r, idx) => {
          const row = sheet.addRow([
            r.id, formatDate(r.data, lang), r.area, r.equiTag, r.ti, r.avaria, r.tecnicos, r.inicio, r.fim, r.causa
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
        await downloadXLSX(workbook, `FR-MAN-09_HISTORICO_INTERVENCOES_${date}.xls`)
      }

      onApplyFiltersToPage({ dateFrom, dateTo, area, equiTag, ti, tecnicos })
      onClose()
    } catch (e) {
      console.error('Erro ao exportar Excel:', e)
    } finally {
      setBusy(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-[#2E86C1]" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {mode === 'print' ? 'Opções de Impressão de Histórico' : 'Opções de Exportação Excel (.xls)'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* Seletor de Modo (Impressão / Exportação) */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-sm">
            <button
              onClick={() => setMode('print')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'print'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Printer className="h-4 w-4 text-blue-600" /> Modo Impressão
            </button>
            <button
              onClick={() => setMode('export')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'export'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Exportar Excel (.xls)
            </button>
          </div>

          {/* Formular de Filtros */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Seleciona os Filtros Desejados
              </h3>
              {(dateFrom || dateTo || area || equiTag || ti || tecnicos) && (
                <button
                  onClick={resetFilters}
                  className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Limpar Filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Data Início</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input !text-xs !py-1.5 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input !text-xs !py-1.5 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Área</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="input !text-xs !py-1.5 font-semibold"
                >
                  <option value="">-- Todas as Áreas --</option>
                  {uniqueAreas.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">TAG / Equipamento</label>
                <select
                  value={equiTag}
                  onChange={(e) => setEquiTag(e.target.value)}
                  className="input !text-xs !py-1.5 font-semibold"
                >
                  <option value="">-- Todas as TAGs --</option>
                  {uniqueTags.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Intervenção (TI)</label>
                <select
                  value={ti}
                  onChange={(e) => setTi(e.target.value)}
                  className="input !text-xs !py-1.5 font-semibold"
                >
                  <option value="">-- Todos os Tipos --</option>
                  <option value="MC">MC - Curativa</option>
                  <option value="MP">MP - Preventiva</option>
                  <option value="PM">PM - Plano Manutenção</option>
                  <option value="PI">PI - Pedido Intervenção</option>
                  <option value="MI">MI - Investimento</option>
                  <option value="PR">PR - Projeto</option>
                  <option value="INS">INS - Inspeção</option>
                  <option value="LUB">LUB - Lubrificação</option>
                  <option value="CAL">CAL - Calibração</option>
                  <option value="OUT">OUT - Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Técnico</label>
                <select
                  value={tecnicos}
                  onChange={(e) => setTecnicos(e.target.value)}
                  className="input !text-xs !py-1.5 font-semibold"
                >
                  <option value="">-- Todos os Técnicos --</option>
                  {uniqueTechs.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'export' && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Conteúdo do Ficheiro Excel</label>
                <div className="flex items-center gap-4 flex-wrap text-xs font-semibold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="contentType"
                      checked={contentType === 'interventions'}
                      onChange={() => setContentType('interventions')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Histórico de Intervenções (.xls)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="contentType"
                      checked={contentType === 'materials'}
                      onChange={() => setContentType('materials')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Materiais Utilizados (.xls)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="contentType"
                      checked={contentType === 'backup'}
                      onChange={() => setContentType('backup')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Backup Completo Servidor</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Área de Pré-visualização das Linhas Filtradas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#2E86C1]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  2. Pré-visualização dos Dados Filtrados
                </h3>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                {filteredPreview.length} de {allRows.length} registo(s) selecionados
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner max-h-48 overflow-y-auto custom-scrollbar">
              {filteredPreview.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-xs font-semibold">Nenhum registo de histórico coincide com os filtros selecionados.</p>
                </div>
              ) : (
                <table className="w-full text-[11px] table-fixed">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold sticky top-0">
                    <tr>
                      <th className="w-[60px] px-2 py-1.5 text-left">ID</th>
                      <th className="w-[85px] px-2 py-1.5 text-left">DATA</th>
                      <th className="w-[65px] px-2 py-1.5 text-left">ÁREA</th>
                      <th className="w-[110px] px-2 py-1.5 text-left">EQUIPAMENTO</th>
                      <th className="w-[50px] px-2 py-1.5 text-left">TI</th>
                      <th className="px-2 py-1.5 text-left">AVARIA / DESCRIÇÃO</th>
                      <th className="w-[100px] px-2 py-1.5 text-left">TÉCNICO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPreview.slice(0, 30).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-2 py-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">{r.id}</td>
                        <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-300">{formatDate(r.data, lang)}</td>
                        <td className="px-2 py-1.5 font-mono font-semibold">{r.area}</td>
                        <td className="px-2 py-1.5 font-semibold truncate">{r.equiTag}</td>
                        <td className="px-2 py-1.5 font-bold text-blue-700 dark:text-blue-400">{r.ti}</td>
                        <td className="px-2 py-1.5 truncate text-slate-800 dark:text-slate-200">{r.avaria}</td>
                        <td className="px-2 py-1.5 truncate">{r.tecnicos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {filteredPreview.length > 30 && (
              <p className="text-[10px] text-slate-500 italic mt-1 text-right">
                * A mostrar 30 de {filteredPreview.length} registos na pré-visualização. Todos os {filteredPreview.length} registos serão {mode === 'print' ? 'impressos' : 'exportados'}.
              </p>
            )}
          </div>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="btn-outline flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="h-4 w-4" /> Cancelar / Voltar
          </button>

          <div className="flex items-center gap-2">
            {mode === 'print' ? (
              <button
                onClick={handleConfirmPrint}
                disabled={filteredPreview.length === 0}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-[#1B4F72] hover:bg-[#154360] text-white shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Imprimir ({filteredPreview.length} Registos em Horizontal)
              </button>
            ) : (
              <button
                onClick={handleConfirmExport}
                disabled={filteredPreview.length === 0 || busy}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" /> {busy ? 'A gerar Excel…' : `Exportar Excel (.xls)`}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
