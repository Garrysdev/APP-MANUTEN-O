'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Settings2, Wrench, Loader2, AlertTriangle, TrendingUp, TrendingDown, Thermometer, Activity, Gauge, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Select from '@/components/ui/Select'
import type { AssetOption } from '@/components/ui/SearchableAssetSelect'
import type { VibrationConfig } from '@/lib/firebase/vibration-data'
import { ISO_PRESETS, metricLabel, type VibDayPayload, type VibSeriesMeta, type Zone } from '@/lib/vibration'
import { buildPoints, summarizeSensor, findAlerts, lastDates, correlation } from '@/lib/vibration-view'
import { datesBetween, dayStartMs, ymd, autoGroup, windowStats, windowCsv, type TimeWindow } from '@/lib/vibration-window'
import { loadVibrationDaysAction } from './actions'
import VibrationImport from './VibrationImport'
import VibrationSettings, { type SettingsValue } from './VibrationSettings'
import MetricChart, { SENSOR_COLORS, type ChartView } from './VibrationCharts'
import VibrationTable, { downloadText } from './VibrationTable'

type Cfg = Omit<VibrationConfig, 'id' | 'companyId' | 'updatedAt'>

// Atalhos de período (terminam no último dia com dados); "Tudo" = do 1.º ao último dia.
const PRESETS = [
  { days: 2, label: '48 h' },
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 0, label: 'Tudo' },
]
const MAX_RANGE_DAYS = 366
const CHUNK = 31 // dias por pedido ao servidor (o servidor aceita até 92)

type Range = { from: string; to: string }

function presetRange(c: { firstDate: string | null; lastDate: string | null } | null, days: number): Range {
  const to = c?.lastDate ?? ymd(Date.now())
  if (days === 0) {
    const first = c?.firstDate ?? to
    const all = datesBetween(first, to)
    return { from: all.length > MAX_RANGE_DAYS ? all[all.length - MAX_RANGE_DAYS] : first, to }
  }
  return { from: lastDates(to, days)[0], to }
}

const fmtWhen = (t: number) => new Date(t).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const ZONE_STYLE: Record<Zone, { cls: string; text: string }> = {
  A: { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', text: 'A · Bom' },
  B: { cls: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300', text: 'B · Aceitável' },
  C: { cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', text: 'C · Alerta' },
  D: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', text: 'D · Perigo' },
}

const card = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'
const btn = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'
const dateInput = 'rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-[7px] text-sm'
const tool = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40'

export default function PredictiveClient({ assets, configs: initial }: { assets: AssetOption[]; configs: VibrationConfig[] }) {
  const router = useRouter()
  const [configs, setConfigs] = useState<Cfg[]>(initial)
  const [assetId, setAssetId] = useState(initial[0]?.assetId ?? '')
  const [range, setRange] = useState<Range>(() => presetRange(initial[0] ?? null, 7))
  const [zoom, setZoom] = useState<TimeWindow | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showMax, setShowMax] = useState(false)
  const [showTooltip, setShowTooltip] = useState(true)
  // Dias já lidos, por equipamento (null = dia sem medições) — mudar o período só lê o que falta.
  const cache = useRef(new Map<string, Map<string, VibDayPayload | null>>())
  const [cacheVersion, setCacheVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'import' | 'settings' | null>(initial.length === 0 ? 'import' : null)
  const [reloadKey, setReloadKey] = useState(0)

  const cfg = configs.find((c) => c.assetId === assetId) ?? null
  const asset = assets.find((a) => a.id === assetId)
  const assetName = (id: string) => { const a = assets.find((x) => x.id === id); return a ? `${a.tag ? `${a.tag} — ` : ''}${a.name}` : id }
  const limits = cfg?.limits ?? ISO_PRESETS.rigid
  const sensors = useMemo(() => [...new Set((cfg?.series ?? []).filter((m) => m.sensor !== 'OUTROS').map((m) => m.sensor))].sort(), [cfg])
  // Corrente / rpm / … do motor (só as do mesmo equipamento entram na importação).
  const processGroups = useMemo(() => {
    const extras = (cfg?.series ?? []).filter((m) => m.sensor === 'OUTROS')
    return [...new Set(extras.map((m) => m.metric))].map((metric) => ({ metric, unit: extras.find((m) => m.metric === metric)?.unit ?? '', items: extras.filter((m) => m.metric === metric) }))
  }, [cfg])
  const labelOf = (s: string) => (cfg?.sensorLabels?.[s] ? `${s} · ${cfg.sensorLabels[s]}` : s)
  const colorOf = (s: string) => SENSOR_COLORS[Math.max(0, sensors.indexOf(s)) % SENSOR_COLORS.length]

  const rangeDates = useMemo(() => datesBetween(range.from, range.to), [range])

  useEffect(() => {
    if (!cfg?.lastDate) return
    const id = cfg.assetId
    if (!cache.current.has(id)) cache.current.set(id, new Map())
    const known = cache.current.get(id)!
    const missing = rangeDates.filter((d) => !known.has(d))
    if (missing.length === 0) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      for (let i = 0; i < missing.length && !cancelled; i += CHUNK) {
        const part = missing.slice(i, i + CHUNK)
        const res = await loadVibrationDaysAction(id, part)
        if (cancelled) return
        if (!res.ok) { setError(res.error); break }
        const got = new Map((res.data ?? []).map((d) => [d.date, d]))
        for (const d of part) known.set(d, got.get(d) ?? null)
      }
      // Um só redesenho no fim (redesenhar a cada bloco prendia a página com períodos longos).
      if (!cancelled) { setCacheVersion((v) => v + 1); setLoading(false) }
    })()
    return () => { cancelled = true; setLoading(false) }
  }, [cfg?.assetId, cfg?.lastDate, rangeDates, reloadKey])

  const days = useMemo(() => {
    const known = cache.current.get(assetId)
    return known ? rangeDates.map((d) => known.get(d)).filter((d): d is VibDayPayload => !!d) : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, rangeDates, cacheVersion])

  // Janela analisada: o zoom (arrastar num gráfico) ou o período inteiro.
  const fullWindow: TimeWindow = useMemo(() => ({ from: dayStartMs(range.from), to: dayStartMs(range.to) + 86_400_000 - 1 }), [range])
  const win = zoom ?? fullWindow
  const winDays = useMemo(() => days.filter((d) => { const t = dayStartMs(d.date); return t + 86_400_000 > win.from && t <= win.to }), [days, win])
  const group = autoGroup(win.to - win.from)
  const inWin = (pts: ReturnType<typeof buildPoints>) => pts.filter((p) => p.t >= win.from && p.t <= win.to)
  const metricPoints = (metric: string) => inWin(buildPoints(winDays, sensors.map((s) => `${s}__${metric}`), group))
  const view: ChartView = {
    window: win,
    onZoom: (from, to) => setZoom({ from, to: Math.max(to, from + 30 * 60_000) }),
    hidden,
    onToggle: (key) => setHidden((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n }),
    showMax,
    showTooltip,
    onToggleTooltip: () => setShowTooltip((v) => !v),
  }
  function setRangeSafe(next: Range) {
    let { from, to } = next
    if (from > to) [from, to] = [to, from]
    const all = datesBetween(from, to)
    if (all.length > MAX_RANGE_DAYS) from = all[all.length - MAX_RANGE_DAYS]
    setRange({ from, to })
    setZoom(null)
  }
  function zoomOut() {
    const span = win.to - win.from
    const from = Math.max(fullWindow.from, win.from - span / 2)
    const to = Math.min(fullWindow.to, win.to + span / 2)
    setZoom(from <= fullWindow.from && to >= fullWindow.to ? null : { from, to })
  }
  function pan(dir: -1 | 1) {
    const span = win.to - win.from
    const shift = (span / 2) * dir
    const from = Math.min(Math.max(win.from + shift, fullWindow.from), fullWindow.to - span)
    setZoom({ from, to: from + span })
  }
  const metasInView = (cfg?.series ?? []).filter((m) => !hidden.has(m.key))
  const stats = useMemo(() => windowStats(winDays, (cfg?.series ?? []).map((m) => m.key), win), [winDays, cfg, win])
  const fileStem = `preditiva-${asset?.tag || assetId}-${ymd(win.from)}_${ymd(win.to)}`
  const metricSeries = (metric: string) => sensors.map((s) => ({ key: `${s}__${metric}`, label: labelOf(s), color: colorOf(s) }))
  const hasMetric = (metric: string) => (cfg?.series ?? []).some((m) => m.metric === metric)

  const summaries = useMemo(() => sensors.map((s) => summarizeSensor(winDays, s, limits)), [winDays, sensors, limits])
  const currents = useMemo(() => processGroups.filter((g) => g.metric === 'Corrente').flatMap((g) => g.items.map((m) => ({ key: m.key, label: `Corrente ${g.items.length > 1 ? m.label : ''}`.trim() }))), [processGroups])
  const alerts = useMemo(() => findAlerts(winDays, sensors, limits, currents), [winDays, sensors, limits, currents])
  const worst = summaries.reduce<Zone | null>((w, s) => (s.zone && (!w || s.zone > w) ? s.zone : w), null)
  const soonest = summaries.reduce<number | null>((m, s) => (s.daysToAlert !== null && (m === null || s.daysToAlert < m) ? s.daysToAlert : m), null)

  function handleImported(id: string, series: VibSeriesMeta[], dates: string[]) {
    setConfigs((prev) => {
      const sorted = [...dates].sort()
      const existing = prev.find((c) => c.assetId === id)
      const base: Cfg = existing ?? { assetId: id, sensorLabels: {}, limits: ISO_PRESETS.rigid, base: 'rigid', series: [], firstDate: null, lastDate: null }
      const known = new Map(base.series.map((m) => [m.key, m]))
      for (const m of series) if (!known.has(m.key)) known.set(m.key, m)
      const next: Cfg = {
        ...base,
        series: [...known.values()],
        firstDate: !base.firstDate || sorted[0] < base.firstDate ? sorted[0] : base.firstDate,
        lastDate: !base.lastDate || sorted[sorted.length - 1] > base.lastDate ? sorted[sorted.length - 1] : base.lastDate,
      }
      return existing ? prev.map((c) => (c.assetId === id ? next : c)) : [...prev, next]
    })
    // Os dias importados voltam a ser lidos; se ficarem fora do período, o período passa a mostrá-los.
    const known = cache.current.get(id)
    for (const d of dates) known?.delete(d)
    const sorted = [...dates].sort()
    if (sorted.length && (id !== assetId || sorted[0] < range.from || sorted[sorted.length - 1] > range.to)) {
      setRangeSafe({ from: sorted[0], to: sorted[sorted.length - 1] })
    }
    setAssetId(id)
    setPanel(null)
    setReloadKey((k) => k + 1)
  }

  function handleSettingsSaved(v: SettingsValue) {
    setConfigs((prev) => prev.map((c) => (c.assetId === assetId ? { ...c, ...v } : c)))
    setPanel(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Equipamento monitorizado</label>
          <Select value={assetId} onChange={(e) => { const id = e.target.value; setAssetId(id); setRangeSafe(presetRange(configs.find((c) => c.assetId === id) ?? null, 7)) }}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
            {configs.length === 0 && <option value="">Nenhum equipamento com dados — importa um .csv</option>}
            {configs.map((c) => <option key={c.assetId} value={c.assetId}>{assetName(c.assetId)}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">De</label>
          <input type="date" value={range.from} min={cfg?.firstDate ?? undefined} max={range.to}
            onChange={(e) => e.target.value && setRangeSafe({ from: e.target.value, to: range.to })} className={dateInput} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Até</label>
          <input type="date" value={range.to} min={range.from} max={cfg?.lastDate ?? undefined}
            onChange={(e) => e.target.value && setRangeSafe({ from: range.from, to: e.target.value })} className={dateInput} />
        </div>
        <div className="flex gap-1">
          {PRESETS.map((p) => {
            const r = presetRange(cfg, p.days)
            const on = r.from === range.from && r.to === range.to
            return (
              <button key={p.days} type="button" onClick={() => setRangeSafe(r)}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold border ${on ? 'bg-[#2E86C1] text-white border-[#2E86C1]' : 'border-slate-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                {p.label}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => setPanel(panel === 'import' ? null : 'import')} className={`${btn} bg-[#2E86C1] text-white hover:bg-[#2471A3]`}>
          <Upload className="h-4 w-4" /> Importar .csv
        </button>
        {cfg && (
          <button type="button" onClick={() => setPanel(panel === 'settings' ? null : 'settings')} className={`${btn} border border-slate-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800`}>
            <Settings2 className="h-4 w-4" /> Sensores e limites
          </button>
        )}
        {cfg && (
          <button type="button" onClick={() => router.push(`/dashboard/tasks?create=true&assetId=${encodeURIComponent(cfg.assetId)}`)}
            className={`${btn} border border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950`}>
            <Wrench className="h-4 w-4" /> Criar OT
          </button>
        )}
      </div>

      {panel === 'import' && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Importar medições</h2>
          <VibrationImport assets={assets} defaultAssetId={assetId} onImported={handleImported} />
        </div>
      )}
      {panel === 'settings' && cfg && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Sensores e limites — {asset?.name ?? cfg.assetId}</h2>
          <VibrationSettings key={cfg.assetId} assetId={cfg.assetId} sensors={sensors}
            value={{ sensorLabels: cfg.sensorLabels ?? {}, limits, base: cfg.base ?? 'rigid' }} onSaved={handleSettingsSaved} />
        </div>
      )}

      {error && <p className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle className="h-4 w-4" />{error}</p>}
      {loading && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />A carregar medições…</p>}

      {cfg && !loading && days.length === 0 && !error && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Sem medições neste período. Há dados de {cfg.firstDate} a {cfg.lastDate}.</p>
      )}

      {cfg && days.length > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-2">
          <span className="text-xs text-gray-600 dark:text-slate-300 mr-auto">
            <strong>{zoom ? 'Zoom' : 'Janela'}:</strong> {fmtWhen(win.from)} → {fmtWhen(win.to)} · pontos de {group * 10 >= 60 ? `${+(group / 6).toFixed(1)} h` : `${group * 10} min`}
            <span className="hidden md:inline text-gray-400"> · arrasta num gráfico para ampliar · clica na legenda para esconder uma série</span>
          </span>
          <button type="button" className={tool} disabled={!zoom} onClick={() => pan(-1)} title="Recuar"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button type="button" className={tool} disabled={!zoom} onClick={() => pan(1)} title="Avançar"><ChevronRight className="h-3.5 w-3.5" /></button>
          <button type="button" className={tool} disabled={!zoom} onClick={zoomOut}><ZoomOut className="h-3.5 w-3.5" /> Reduzir</button>
          <button type="button" className={tool} disabled={!zoom} onClick={() => setZoom(null)}><RotateCcw className="h-3.5 w-3.5" /> Repor zoom</button>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-200 px-1">
            <input type="checkbox" checked={showMax} onChange={(e) => setShowMax(e.target.checked)} /> Mostrar máximos
          </label>
          <button type="button" className={tool} onClick={() => downloadText(`${fileStem}.csv`, windowCsv(winDays, metasInView, win, 1))}
            title="Valores de 10 em 10 min (mín/média/máx) das séries visíveis, só da janela atual">
            <Download className="h-3.5 w-3.5" /> Exportar janela (.csv)
          </button>
        </div>
      )}

      {cfg && days.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />Estado geral</p>
              <p className="mt-1">{worst ? <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${ZONE_STYLE[worst].cls}`}>{ZONE_STYLE[worst].text}</span> : '—'}</p>
              <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">Pior sensor, última leitura · dados até {cfg.lastDate}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Projeção</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-slate-100">
                {soonest === null ? 'Estável' : soonest < 1 ? 'Já no limite' : `~${Math.round(soonest)} dias`}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Até à zona de alerta ({limits.bc} mm/s), pela tendência diária do período</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Alertas no período</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-slate-100">{alerts.length}</p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Dias com vibração ≥ {limits.bc} mm/s ou temperatura ≥ {limits.temp} °C</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><Activity className="h-3.5 w-3.5" />Sensores</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-slate-100">{sensors.length}</p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Base {cfg.base === 'flexible' ? 'flexível' : 'rígida'} · A/B {limits.ab} · B/C {limits.bc} · C/D {limits.cd} mm/s</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaries.map((s) => (
              <div key={s.sensor} className={card} style={{ borderTop: `3px solid ${colorOf(s.sensor)}` }}>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate" title={labelOf(s.sensor)}>{labelOf(s.sensor)}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{s.velocity !== null ? s.velocity.toFixed(2) : '—'}</span>
                  <span className="text-xs text-gray-500">mm/s</span>
                  {s.zone && <span className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold ${ZONE_STYLE[s.zone].cls}`}>{ZONE_STYLE[s.zone].text}</span>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-gray-600 dark:text-slate-300">
                  <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" />{s.temperature !== null ? `${s.temperature.toFixed(1)} °C` : '—'}</span>
                  <span>Crista {s.crest !== null ? s.crest.toFixed(1) : '—'}</span>
                  <span>Fricção {s.friction !== null ? `${s.friction.toFixed(1)} m/s²` : '—'}</span>
                  <span>Choque {s.shock !== null ? `${s.shock.toFixed(1)} m/s²` : '—'}</span>
                  <span className="flex items-center gap-1">
                    {s.changePct !== null && (s.changePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                    {s.changePct !== null ? `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(0)}% vs. antes` : 'sem histórico'}
                  </span>
                  <span>{s.daysToAlert === null ? 'Tendência estável' : `Alerta em ~${Math.round(s.daysToAlert)} d`}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Alertas</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Sem valores acima dos limites no período (vibração ≥ {limits.bc} mm/s, temperatura ≥ {limits.temp} °C).
              </p>
            ) : (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="text-left text-xs uppercase text-gray-500 dark:text-slate-400">
                      <th className="py-1 pr-3">Data / hora</th><th className="py-1 pr-3">Sensor</th><th className="py-1 pr-3">Tipo</th><th className="py-1 pr-3">Máximo</th>
                      <th className="py-1 pr-3" title="Temperatura do mesmo sensor no momento do alerta">Temperatura</th>
                      {currents.map((c) => <th key={c.key} className="py-1 pr-3" title="Corrente do motor no momento do alerta">{c.label}</th>)}
                      <th className="py-1">Nível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800 text-gray-700 dark:text-slate-200">
                        <td className="py-1 pr-3 whitespace-nowrap">
                          <button type="button" className="hover:underline" title="Ampliar os gráficos à volta deste momento"
                            onClick={() => setZoom({ from: Math.max(fullWindow.from, a.t - 3 * 3_600_000), to: Math.min(fullWindow.to, a.t + 3 * 3_600_000) })}>
                            {fmtWhen(a.t)}
                          </button>
                        </td>
                        <td className="py-1 pr-3">{labelOf(a.sensor)}</td>
                        <td className="py-1 pr-3">{a.kind}</td>
                        <td className="py-1 pr-3 whitespace-nowrap">{a.value.toFixed(2)} {a.kind === 'vibração' ? 'mm/s' : '°C'}</td>
                        <td className="py-1 pr-3 whitespace-nowrap">{a.temperature === null ? '—' : `${a.temperature.toFixed(1)} °C`}</td>
                        {a.currents.map((c, j) => <td key={j} className="py-1 pr-3 whitespace-nowrap">{c.value === null ? '—' : `${c.value.toFixed(1)} A`}</td>)}
                        <td className="py-1"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${a.level === 'perigo' ? ZONE_STYLE.D.cls : ZONE_STYLE.C.cls}`}>{a.level}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {hasMetric('vRMS') && (
            <MetricChart view={view} title="Fadiga — velocidade de vibração RMS" unit="mm/s" points={metricPoints('vRMS')} series={metricSeries('vRMS')} zones={limits}
              subtitle="Desequilíbrio, desalinhamento e folgas — zonas ISO 10816-3 a cores (0,2 mm/s = 0,0002 m/s no SCADA)" />
          )}
          {processGroups.map((g) => (
            <div key={g.metric} className="space-y-2">
              <MetricChart view={view} title={`Fadiga × ${g.metric}`} unit="mm/s" points={inWin(buildPoints(winDays, [...sensors.map((s) => `${s}__vRMS`), ...g.items.map((m) => m.key)], group))}
                series={metricSeries('vRMS')} rightUnit={g.unit}
                rightSeries={g.items.map((m, i) => ({ key: m.key, label: `${g.metric} ${g.items.length > 1 ? m.label : ''}`.trim(), color: SENSOR_COLORS[(sensors.length + i) % SENSOR_COLORS.length] }))}
                subtitle={`Vibração (linhas contínuas, eixo esquerdo) e ${g.metric.toLowerCase()} (tracejado, eixo direito, ${g.unit})`} />
              <div className="flex flex-wrap gap-2 text-[11px]">
                {sensors.flatMap((s) => g.items.map((m) => {
                  const r = correlation(winDays, `${s}__vRMS`, m.key)
                  if (r === null) return null
                  const strong = Math.abs(r) >= 0.7, mid = Math.abs(r) >= 0.4
                  return (
                    <span key={`${s}-${m.key}`} title="Correlação de Pearson entre a Fadiga do sensor e esta grandeza (−1 a 1)"
                      className={`rounded px-2 py-0.5 border ${strong ? 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300' : mid ? 'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                      {labelOf(s)} × {g.metric}{g.items.length > 1 ? ` (${m.label})` : ''}: r = {r.toFixed(2)} · {strong ? 'relação forte' : mid ? 'relação moderada' : 'pouca relação'}
                    </span>
                  )
                }))}
              </div>
            </div>
          ))}
          <div className="grid gap-4 lg:grid-cols-2">
            {hasMetric('aRMS') && (
              <MetricChart view={view} title={`${metricLabel('aRMS')} — aceleração RMS`} unit="m/s²" points={metricPoints('aRMS')} series={metricSeries('aRMS')}
                subtitle="Sobe com desgaste de rolamentos e engrenagens (alta frequência)" />
            )}
            {hasMetric('aPeak') && (
              <MetricChart view={view} title={`${metricLabel('aPeak')} — aceleração de pico`} unit="m/s²" points={metricPoints('aPeak')} series={metricSeries('aPeak')}
                subtitle="Impactos — picos isolados indicam defeitos localizados" />
            )}
            {hasMetric('Crista') && (
              <MetricChart view={view} title={metricLabel('Crista')} unit="" points={metricPoints('Crista')} series={metricSeries('Crista')}
                subtitle="Pico ÷ RMS. Acima de ~6 de forma persistente sugere defeito inicial em rolamento" />
            )}
            {hasMetric('Temperatura') && (
              <MetricChart view={view} title="Temperatura" unit="°C" points={metricPoints('Temperatura')} limitLine={limits.temp}
                series={sensors.filter((s) => cfg.series.some((m) => m.key === `${s}__Temperatura`)).map((s) => ({ key: `${s}__Temperatura`, label: labelOf(s), color: colorOf(s) }))}
                subtitle="Aquecimento progressivo acompanha lubrificação deficiente ou sobrecarga" />
            )}
          </div>

          {stats.length > 0 && (
            <div className={card}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Estatísticas da janela</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left uppercase text-gray-500 dark:text-slate-400">
                    <th className="py-1 pr-3">Série</th><th className="py-1 pr-3 text-right">Mínimo</th><th className="py-1 pr-3 text-right">Média</th>
                    <th className="py-1 pr-3 text-right">Máximo</th><th className="py-1 pr-3 text-right">Desvio-padrão</th><th className="py-1 text-right">Variação</th>
                  </tr></thead>
                  <tbody>
                    {stats.map((st) => {
                      const m = cfg.series.find((x) => x.key === st.key)
                      const u = m?.unit ? ` ${m.unit}` : ''
                      const n = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 3 })
                      const ch = st.first !== 0 ? ((st.last - st.first) / Math.abs(st.first)) * 100 : null
                      return (
                        <tr key={st.key} className="border-t border-slate-100 dark:border-slate-800 text-gray-700 dark:text-slate-200">
                          <td className="py-1 pr-3">{m?.sensor === 'OUTROS' ? `${m.metric} ${m.label}` : `${labelOf(m?.sensor ?? '')} · ${metricLabel(m?.metric ?? st.key)}`}</td>
                          <td className="py-1 pr-3 text-right">{n(st.min)}{u}</td>
                          <td className="py-1 pr-3 text-right font-semibold">{n(st.avg)}{u}</td>
                          <td className="py-1 pr-3 text-right">{n(st.max)}{u}</td>
                          <td className="py-1 pr-3 text-right">{n(st.sd)}{u}</td>
                          <td className="py-1 text-right" title="Do primeiro ao último valor médio da janela">{ch === null ? '—' : `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <VibrationTable days={winDays} metas={cfg.series} window={win} sensorLabel={labelOf} fileStem={fileStem} />
        </>
      )}
    </div>
  )
}
