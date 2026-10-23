'use client'

import { useState } from 'react'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import SearchableAssetSelect, { type AssetOption } from '@/components/ui/SearchableAssetSelect'
import { createVibrationAggregator, mergeSeriesDay, type VibDayPayload, type VibSeriesMeta } from '@/lib/vibration'
import { importVibrationDayAction } from './actions'

type Parsed = { series: VibSeriesMeta[]; days: VibDayPayload[]; rows: number; from: number | null; to: number | null; files: string[] }

/** Lê o ficheiro aos bocados (UTF-16 ou UTF-8), sem o carregar inteiro como texto. */
async function readLines(file: File, onLine: (line: string) => void, onProgress: (pct: number) => void) {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  const encoding = head[0] === 0xff && head[1] === 0xfe ? 'utf-16le' : head[0] === 0xfe && head[1] === 0xff ? 'utf-16be' : 'utf-8'
  const bytesPerChar = encoding === 'utf-8' ? 1 : 2
  const reader = file.stream().pipeThrough(new TextDecoderStream(encoding)).getReader()
  let buf = ''
  let chars = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += value
    chars += value.length
    let start = 0
    let i: number
    while ((i = buf.indexOf('\n', start)) >= 0) {
      onLine(buf.slice(start, i))
      start = i + 1
    }
    buf = buf.slice(start)
    onProgress(Math.min(99, Math.round(((chars * bytesPerChar) / file.size) * 100)))
  }
  if (buf) onLine(buf)
}

const fmt = (t: number | null) => (t ? new Date(t).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—')

export default function VibrationImport({
  assets,
  defaultAssetId,
  onImported,
}: {
  assets: AssetOption[]
  defaultAssetId: string
  onImported: (assetId: string, series: VibSeriesMeta[], dates: string[]) => void
}) {
  const [assetId, setAssetId] = useState(defaultAssetId)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setDone(null)
    setParsed(null)
    try {
      // Vários ficheiros (ex.: um por semana) juntam-se num só agregado por ficheiro e depois por dia.
      const all: Parsed = { series: [], days: [], rows: 0, from: null, to: null, files: [] }
      const byDate = new Map<string, VibDayPayload>()
      for (const file of Array.from(files)) {
        const agg = createVibrationAggregator()
        await readLines(file, agg.push, (pct) => setProgress({ label: `A ler ${file.name}`, pct }))
        const r = agg.finish()
        if (r.series.length === 0 || r.rows === 0) throw new Error(`${file.name}: não encontrei colunas "Time"/"ValueY" com dados.`)
        for (const m of r.series) if (!all.series.some((s) => s.key === m.key)) all.series.push(m)
        for (const d of r.days) {
          const prev = byDate.get(d.date)
          if (!prev) { byDate.set(d.date, d); continue }
          const series = { ...prev.series }
          for (const [k, s] of Object.entries(d.series)) series[k] = mergeSeriesDay(prev.series[k], s)
          byDate.set(d.date, { date: d.date, series })
        }
        all.rows += r.rows
        all.from = r.from !== null && (all.from === null || r.from < all.from) ? r.from : all.from
        all.to = r.to !== null && (all.to === null || r.to > all.to) ? r.to : all.to
        all.files.push(file.name)
      }
      all.days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
      setParsed(all)
      setSelected(new Set(all.series.map((m) => m.key)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o ficheiro.')
    } finally {
      setProgress(null)
    }
  }

  async function handleImport() {
    if (!parsed || !assetId || selected.size === 0) return
    setError(null)
    const series = parsed.series.filter((m) => selected.has(m.key))
    const dates: string[] = []
    try {
      for (let i = 0; i < parsed.days.length; i++) {
        const d = parsed.days[i]
        const s = Object.fromEntries(Object.entries(d.series).filter(([k]) => selected.has(k)))
        if (Object.keys(s).length === 0) continue
        setProgress({ label: `A gravar ${d.date}`, pct: Math.round((i / parsed.days.length) * 100) })
        const res = await importVibrationDayAction(assetId, { date: d.date, series: s }, series)
        if (!res.ok) throw new Error(res.error)
        dates.push(d.date)
      }
      setDone(`${dates.length} dia(s) importado(s).`)
      setParsed(null)
      onImported(assetId, series, dates)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar.')
    } finally {
      setProgress(null)
    }
  }

  const groups = parsed
    ? [...new Set(parsed.series.map((m) => m.sensor))].map((sensor) => ({ sensor, items: parsed.series.filter((m) => m.sensor === sensor) }))
    : []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Equipamento</label>
          <SearchableAssetSelect value={assetId} onChange={setAssetId} assets={assets} placeholder="Escolhe o equipamento monitorizado" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Ficheiro(s) .csv exportado(s)</label>
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            Escolher ficheiro(s)…
            <input type="file" accept=".csv,.txt,text/csv" multiple className="hidden" disabled={!!progress}
              onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300"><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress.label} — {progress.pct}%</div>
          <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700"><div className="h-1.5 rounded bg-[#2E86C1] transition-all" style={{ width: `${progress.pct}%` }} /></div>
        </div>
      )}

      {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" />{error}</p>}
      {done && <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{done}</p>}

      {parsed && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-200">
            <FileSpreadsheet className="h-4 w-4 mt-0.5 text-[#2E86C1]" />
            <div>
              <p className="font-semibold">{parsed.files.join(', ')}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {parsed.rows.toLocaleString('pt-PT')} linhas · {fmt(parsed.from)} → {fmt(parsed.to)} · {parsed.days.length} dia(s), agregados em intervalos de 10 min
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div key={g.sensor} className="text-xs">
                <p className="font-semibold text-gray-700 dark:text-slate-200 mb-1">{g.sensor === 'OUTROS' ? 'Motor (corrente / rpm)' : g.sensor}</p>
                {g.items.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 py-0.5 text-gray-600 dark:text-slate-300">
                    <input type="checkbox" checked={selected.has(m.key)}
                      onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(m.key); else n.delete(m.key); return n })} />
                    {g.sensor === 'OUTROS' ? `${m.metric} — ${m.label}` : m.label.replace(`${g.sensor} · `, '')}{m.unit ? ` (${m.unit})` : ''}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <button type="button" onClick={handleImport} disabled={!assetId || selected.size === 0 || !!progress}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2E86C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2471A3] disabled:opacity-50">
            <Upload className="h-4 w-4" /> Importar {selected.size} série(s)
          </button>
          {!assetId && <p className="text-xs text-amber-600">Escolhe primeiro o equipamento.</p>}
        </div>
      )}
    </div>
  )
}
