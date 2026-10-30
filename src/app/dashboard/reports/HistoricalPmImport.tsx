'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, Trash2, Save, X } from 'lucide-react'
import type { HistoricalPmKpi } from '@/lib/pm-compliance'
import { parsePlanSheet, yearFromFileName, type SheetRows } from '@/lib/historical-kpis'
import { saveHistoricalPmKpisAction, deleteHistoricalPmKpiAction } from './actions'

const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—')

/** Importa o KPI de PM dos anos anteriores a partir das folhas PL-MAN-01 do Excel. */
export default function HistoricalPmImport({ saved }: { saved: HistoricalPmKpi[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<HistoricalPmKpi[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function readFiles(files: File[]) {
    if (!files.length) return
    setBusy(true)
    setMsg(null)
    const XLSX = await import('xlsx')
    const out: HistoricalPmKpi[] = []
    const skipped: string[] = []
    for (const f of files) {
      try {
        const wb = XLSX.read(await f.arrayBuffer())
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null }) as SheetRows
        const year = yearFromFileName(f.name) ?? new Date().getFullYear() - 1
        const k = parsePlanSheet(rows, year, f.name)
        if (k) out.push(k); else skipped.push(f.name)
      } catch {
        skipped.push(f.name)
      }
    }
    setPreview(out.sort((a, b) => a.year - b.year))
    setBusy(false)
    if (skipped.length) setMsg({ ok: false, text: `Sem colunas de intervenções devidas/realizadas: ${skipped.join(', ')}` })
  }

  async function save() {
    setBusy(true)
    const res = await saveHistoricalPmKpisAction(preview)
    setBusy(false)
    if (!res.ok) { setMsg({ ok: false, text: res.error }); return }
    setMsg({ ok: true, text: `${preview.length} ano(s) gravados.` })
    setPreview([])
    router.refresh()
  }

  async function remove(year: number) {
    if (!confirm(`Apagar o KPI de PM importado de ${year}?`)) return
    const res = await deleteHistoricalPmKpiAction(year)
    if (!res.ok) setMsg({ ok: false, text: res.error }); else router.refresh()
  }

  const cell = 'py-1 px-2 text-center'
  const table = (rows: HistoricalPmKpi[], edit: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
            <th className="py-1 px-2 text-left">Ano</th><th className={cell}>Devidas</th><th className={cell}>Realizadas</th>
            <th className={cell} title="Realizadas, no máximo as devidas de cada plano">Contam</th><th className={cell}>%</th>
            <th className="py-1 px-2 text-left">Ficheiro</th><th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((k, i) => (
            <tr key={`${k.year}-${i}`}>
              <td className="py-1 px-2 font-bold">
                {edit ? (
                  <input type="number" value={k.year} className="w-16 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-1"
                    onChange={(e) => setPreview((p) => p.map((x, j) => (j === i ? { ...x, year: Number(e.target.value) } : x)))} />
                ) : k.year}
              </td>
              <td className={cell}>{k.due}</td><td className={cell}>{k.done}</td>
              <td className={cell}>{k.doneCapped ?? '—'}</td>
              <td className={`${cell} font-black`}>{pct(Math.min(k.doneCapped ?? k.done, k.due), k.due)}</td>
              <td className="py-1 px-2 text-slate-500 truncate max-w-[220px]" title={k.file}>{k.file || '—'}</td>
              <td className="py-1 px-1 text-right">
                {edit ? (
                  <button type="button" onClick={() => setPreview((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" title="Não importar"><X className="h-3.5 w-3.5" /></button>
                ) : (
                  <button type="button" onClick={() => remove(k.year)} className="text-slate-400 hover:text-red-600" title="Apagar"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 no-print">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold text-industrial-blue dark:text-sky-400 hover:underline">
        {open ? 'Fechar' : `KPI do PM dos anos anteriores (Excel PL-MAN-01)${saved.length ? ` · ${saved.length} ano(s) importados` : ''}`}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Anos sem registo do plano na app usam a folha PL-MAN-01 de cada ano: intervenções realizadas ÷ devidas (as feitas a mais num plano não contam).
            O ano lê-se do nome do ficheiro — confirma antes de gravar.
          </p>
          <label className="inline-flex items-center gap-2 rounded-lg bg-[#2E86C1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2471A3] cursor-pointer">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Escolher ficheiros PL-MAN-01
            <input type="file" multiple accept=".xls,.xlsx,.xlsm,.xlsb" className="hidden" onChange={(e) => {
              // Copiar antes de limpar o campo: a FileList esvazia-se com value = ''.
              const files = Array.from(e.target.files ?? [])
              e.target.value = ''
              void readFiles(files)
            }} />
          </label>
          {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>}
          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">A importar</p>
              {table(preview, true)}
              <button type="button" onClick={save} disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> Gravar {preview.length} ano(s)
              </button>
            </div>
          )}
          {saved.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Importados</p>
              {table(saved, false)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
