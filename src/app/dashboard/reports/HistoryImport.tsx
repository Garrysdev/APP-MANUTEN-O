'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, Save } from 'lucide-react'
import { parseHistorySheet, type HistoryRow, type SheetRows } from '@/lib/history-import'
import { importHistoryAction } from './actions'

type Preview = { file: string; rows: HistoryRow[]; created: number; skipped: number; years: number[]; byTi: [string, number][] }

/** Importa as OT de um ano a partir da folha FR-MAN-09 (só a folha UR; salta as que já existem). */
export default function HistoryImport() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function read(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMsg(null)
    setPreview(null)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
      const sheet = wb.SheetNames.find((n) => n.trim().toUpperCase() === 'UR') ?? wb.SheetNames.find((n) => /INTERVEN/i.test(n))
      if (!sheet) throw new Error('O ficheiro não tem a folha "UR".')
      const rows = parseHistorySheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null }) as SheetRows)
      if (rows.length === 0) throw new Error('Não encontrei linhas com DATA e AVARIA/ACÇÃO.')
      const res = await importHistoryAction(rows, file.name, true)
      if (!res.ok) throw new Error(res.error)
      const ti = new Map<string, number>()
      rows.forEach((r) => ti.set(r.ti || '—', (ti.get(r.ti || '—') || 0) + 1))
      setPreview({ file: file.name, rows, created: res.created, skipped: res.skipped, years: res.years, byTi: [...ti.entries()].sort((a, b) => b[1] - a[1]) })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao ler o ficheiro.' })
    }
    setBusy(false)
  }

  async function save() {
    if (!preview) return
    setBusy(true)
    const res = await importHistoryAction(preview.rows, preview.file, false)
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: res.error }); return }
    setMsg({ ok: true, text: `${res.created} OT importadas${res.skipped ? `, ${res.skipped} já existiam` : ''}.` })
    setPreview(null)
    router.refresh()
  }

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 no-print">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold text-industrial-blue dark:text-sky-400 hover:underline">
        {open ? 'Fechar' : 'Importar histórico de OT de um ano (Excel FR-MAN-09)'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Lê a folha UR e importa as OT como concluídas. As que já existem (mesma data, área, TAG e avaria) são saltadas — pode repetir-se sem duplicar.
          </p>
          <label className="inline-flex items-center gap-2 rounded-lg bg-[#2E86C1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2471A3] cursor-pointer">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Escolher ficheiro FR-MAN-09
            <input type="file" accept=".xls,.xlsx,.xlsm,.xlsb" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void read(f) }} />
          </label>
          {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
          {preview && (
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              <p>
                <strong>{preview.file}</strong>: {preview.rows.length} linhas · <strong>{preview.created} novas</strong>
                {preview.skipped ? ` · ${preview.skipped} já existem` : ''}{preview.years.length ? ` · anos ${preview.years.join(', ')}` : ''}
              </p>
              <p className="text-slate-500">{preview.byTi.map(([k, n]) => `${k}: ${n}`).join(' · ')}</p>
              <button type="button" onClick={save} disabled={busy || preview.created === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> Importar {preview.created} OT
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
