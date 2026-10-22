'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import ExcelJS from 'exceljs'
import { Archive, ArrowLeft, Download, ExternalLink } from 'lucide-react'
import type { DocRecord } from '@/lib/doc-archive'
import { AVAILABLE_FRS, AVAILABLE_ITS } from '@/components/ui/TaskDocRequirements'
import { addLogoToWorkbook } from '@/lib/export-logo'
import { useBranding } from '@/components/providers/BrandingProvider'
import { formatDate } from '@/lib/utils'

// Arquivo de FR/IT preenchidas para auditorias: filtros por OT, Área, TAG, documento,
// tipo, assinante e datas; cada registo abre o documento tal como foi preenchido e
// assinado (/report/doc/...), pronto a imprimir/guardar em PDF.

// FR/IT antigas fixas no código (FR-01...): 'FR-01: Registo de...' → referência + título.
const LEGACY_INFO: Record<string, DocInfo> = Object.fromEntries(
  [...AVAILABLE_FRS, ...AVAILABLE_ITS].map((d) => {
    const [code, ...rest] = d.title.split(':')
    return [d.id, { code: code.trim(), title: rest.join(':').trim() || d.title }]
  })
)

type DocInfo = { code: string; title: string }
const PAGE_SIZE = 100

type Filters = { ref: string; ot: string; area: string; tag: string; doc: string; kind: '' | 'FR' | 'IT'; signedBy: string; from: string; to: string }
const EMPTY_FILTERS: Filters = { ref: '', ot: '', area: '', tag: '', doc: '', kind: '', signedBy: '', from: '', to: '' }

const norm = (s: unknown) => String(s ?? '').toLowerCase().trim()

export default function ArchiveClient({ records, docInfo }: { records: DocRecord[]; docInfo: Record<string, DocInfo> }) {
  const { logoUrl } = useBranding()
  const [f, setF] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const infoOf = (id: string): DocInfo => docInfo[id] || LEGACY_INFO[id] || { code: '', title: id }
  const titleOf = (id: string) => { const i = infoOf(id); return i.code ? `${i.code} · ${i.title}` : i.title }
  const set = (key: keyof Filters, value: string) => { setF((prev) => ({ ...prev, [key]: value })); setPage(1) }

  const docOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.docId))).map((id) => ({ id, title: titleOf(id) })).sort((a, b) => a.title.localeCompare(b.title, 'pt')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, docInfo]
  )

  const shown = useMemo(() => records.filter((r) => {
    const day = (r.date || '').slice(0, 10)
    return (!f.ref || norm(infoOf(r.docId).code).includes(norm(f.ref)))
      && (!f.ot || norm(r.otNumber ?? r.taskId).includes(norm(f.ot)) || norm(r.taskTitle).includes(norm(f.ot)))
      && (!f.area || norm(r.area).includes(norm(f.area)))
      && (!f.tag || norm(r.tag).includes(norm(f.tag)))
      && (!f.doc || r.docId === f.doc)
      && (!f.kind || r.kind === f.kind)
      && (!f.signedBy || norm(r.signedBy).includes(norm(f.signedBy)))
      && (!f.from || day >= f.from)
      && (!f.to || day <= f.to)
  // infoOf só depende de docInfo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [records, f, docInfo])

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const pageRows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleExport() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Arquivo FR-IT')
    sheet.mergeCells('A1:I1')
    const title = sheet.getCell('A1')
    title.value = 'ARQUIVO DE FOLHAS DE REGISTO E INSTRUÇÕES DE TRABALHO'
    title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } }
    title.alignment = { vertical: 'middle', horizontal: 'center' }
    const header = sheet.getRow(3)
    header.values = ['DATA', 'REFERÊNCIA', 'DOCUMENTO', 'TIPO', 'OT', 'DESCRIÇÃO DA OT', 'ÁREA', 'TAG', 'ASSINADO POR']
    header.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86C1' } }
    })
    for (const r of shown) {
      sheet.addRow([r.date ? formatDate(r.date) : '', infoOf(r.docId).code, infoOf(r.docId).title, r.kind, r.otNumber ?? r.taskId, r.taskTitle, r.area ?? '', r.tag ?? '', r.signedBy ?? ''])
    }
    sheet.columns = [{ width: 12 }, { width: 14 }, { width: 40 }, { width: 6 }, { width: 10 }, { width: 45 }, { width: 10 }, { width: 18 }, { width: 22 }]
    await addLogoToWorkbook(workbook, logoUrl)
    const buffer = await workbook.xlsx.writeBuffer()
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `Arquivo_FR_IT_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const input = 'input !text-xs !py-1.5 w-full'

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Link href="/dashboard/documents" className="text-xs font-bold text-industrial-blue dark:text-blue-400 inline-flex items-center gap-1 hover:underline mb-1">
            <ArrowLeft size={14} /> Gestão Documental
          </Link>
          <h1 className="text-2xl font-extrabold text-industrial-blue dark:text-slate-100 flex items-center gap-2">
            <Archive className="h-7 w-7 text-safety-orange" /> Arquivo de FR / IT preenchidas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registos assinados por OT, Área e TAG — para auditorias. {shown.length} de {records.length} registo(s).
          </p>
        </div>
        <button type="button" onClick={handleExport} disabled={shown.length === 0} className="btn-secondary text-xs flex items-center gap-2">
          <Download size={15} /> Exportar Excel
        </button>
      </div>

      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <input value={f.ref} onChange={(e) => set('ref', e.target.value)} placeholder="Referência (FR/MAN/18)" className={input} />
        <input value={f.ot} onChange={(e) => set('ot', e.target.value)} placeholder="OT nº / descrição" className={input} />
        <input value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="Área" className={input} />
        <input value={f.tag} onChange={(e) => set('tag', e.target.value)} placeholder="TAG" className={input} />
        <select value={f.doc} onChange={(e) => set('doc', e.target.value)} className={input}>
          <option value="">Todos os documentos</option>
          {docOptions.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <select value={f.kind} onChange={(e) => set('kind', e.target.value)} className={input}>
          <option value="">FR e IT</option>
          <option value="FR">Só FR</option>
          <option value="IT">Só IT</option>
        </select>
        <input value={f.signedBy} onChange={(e) => set('signedBy', e.target.value)} placeholder="Assinado por" className={input} />
        <input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} className={input} title="Desde" />
        <input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} className={input} title="Até" />
      </div>

      {shown.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">
          {records.length === 0 ? 'Ainda não há FR/IT preenchidas nas OTs.' : 'Nenhum registo com estes filtros.'}
        </div>
      ) : (
        <>
          {/* Telemóvel: cartões */}
          <div className="md:hidden space-y-2">
            {pageRows.map((r) => (
              <Link key={`${r.taskId}-${r.kind}-${r.docId}`} href={`/report/doc/${r.taskId}/${encodeURIComponent(r.docId)}`} target="_blank" className="card p-3 block">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-industrial-blue">OT {r.otNumber ?? r.taskId}</span>
                  <span className="text-slate-500">{r.date ? formatDate(r.date) : '—'}</span>
                </div>
                <p className="text-sm font-bold mt-1">{titleOf(r.docId)}</p>
                <p className="text-xs text-slate-500">{r.tag || '—'} · Área {r.area || '—'} · {r.signedBy ? `Assinado por ${r.signedBy}` : 'Sem assinatura (registo antigo)'}</p>
              </Link>
            ))}
          </div>

          {/* Ecrãs maiores: tabela */}
          <div className="hidden md:block card overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Referência</th>
                  <th className="px-3 py-2 text-left">OT</th>
                  <th className="px-3 py-2 text-left">Área</th>
                  <th className="px-3 py-2 text-left">TAG</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Documento</th>
                  <th className="px-3 py-2 text-left">Assinado por</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((r) => (
                  <tr key={`${r.taskId}-${r.kind}-${r.docId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.date ? formatDate(r.date) : '—'}</td>
                    <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">{infoOf(r.docId).code || '—'}</td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/tasks/${r.taskId}`} className="font-mono font-bold text-industrial-blue dark:text-blue-400 hover:underline">{r.otNumber ?? r.taskId}</Link>
                      <span className="block text-[10px] text-slate-500 line-clamp-1 max-w-[220px]" title={r.taskTitle}>{r.taskTitle}</span>
                    </td>
                    <td className="px-3 py-2">{r.area || '—'}</td>
                    <td className="px-3 py-2 font-mono">{r.tag || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.kind === 'FR' ? 'bg-amber-100 text-amber-900' : 'bg-teal-100 text-teal-900'}`}>{r.kind}</span>
                    </td>
                    <td className="px-3 py-2 font-semibold">{infoOf(r.docId).title}</td>
                    <td className="px-3 py-2">{r.signedBy || <span className="text-slate-400 italic">registo antigo</span>}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/report/doc/${r.taskId}/${encodeURIComponent(r.docId)}`} target="_blank" className="inline-flex items-center gap-1 font-bold text-industrial-blue dark:text-blue-400 hover:underline whitespace-nowrap">
                        Abrir / PDF <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 text-xs">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-outline !py-1 !px-3">Anterior</button>
              <span className="font-bold">{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn-outline !py-1 !px-3">Seguinte</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
