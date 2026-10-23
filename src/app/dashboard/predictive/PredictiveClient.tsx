'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Settings2, Wrench, Loader2, AlertTriangle, TrendingUp, TrendingDown, Thermometer, Activity, Gauge } from 'lucide-react'
import Select from '@/components/ui/Select'
import type { AssetOption } from '@/components/ui/SearchableAssetSelect'
import type { VibrationConfig } from '@/lib/firebase/vibration-data'
import { ISO_PRESETS, metricLabel, type VibDayPayload, type VibSeriesMeta, type Zone } from '@/lib/vibration'
import { buildPoints, summarizeSensor, findAlerts, lastDates } from '@/lib/vibration-view'
import { loadVibrationDaysAction } from './actions'
import VibrationImport from './VibrationImport'
import VibrationSettings, { type SettingsValue } from './VibrationSettings'
import MetricChart, { SENSOR_COLORS } from './VibrationCharts'

type Cfg = Omit<VibrationConfig, 'id' | 'companyId' | 'updatedAt'>

const PERIODS = [
  { days: 2, label: '48 horas', group: 1 },
  { days: 7, label: '7 dias', group: 1 },
  { days: 30, label: '30 dias', group: 6 },
  { days: 90, label: '90 dias', group: 18 },
]

const ZONE_STYLE: Record<Zone, { cls: string; text: string }> = {
  A: { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', text: 'A · Bom' },
  B: { cls: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300', text: 'B · Aceitável' },
  C: { cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', text: 'C · Alerta' },
  D: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', text: 'D · Perigo' },
}

const card = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4'
const btn = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'

export default function PredictiveClient({ assets, configs: initial }: { assets: AssetOption[]; configs: VibrationConfig[] }) {
  const router = useRouter()
  const [configs, setConfigs] = useState<Cfg[]>(initial)
  const [assetId, setAssetId] = useState(initial[0]?.assetId ?? '')
  const [period, setPeriod] = useState(7)
  const [days, setDays] = useState<VibDayPayload[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'import' | 'settings' | null>(initial.length === 0 ? 'import' : null)
  const [reloadKey, setReloadKey] = useState(0)

  const cfg = configs.find((c) => c.assetId === assetId) ?? null
  const asset = assets.find((a) => a.id === assetId)
  const assetName = (id: string) => { const a = assets.find((x) => x.id === id); return a ? `${a.tag ? `${a.tag} — ` : ''}${a.name}` : id }
  const limits = cfg?.limits ?? ISO_PRESETS.rigid
  const sensors = useMemo(() => [...new Set((cfg?.series ?? []).filter((m) => m.sensor !== 'OUTROS').map((m) => m.sensor))].sort(), [cfg])
  const labelOf = (s: string) => (cfg?.sensorLabels?.[s] ? `${s} · ${cfg.sensorLabels[s]}` : s)
  const colorOf = (s: string) => SENSOR_COLORS[Math.max(0, sensors.indexOf(s)) % SENSOR_COLORS.length]

  useEffect(() => {
    if (!cfg?.lastDate) { setDays([]); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    loadVibrationDaysAction(cfg.assetId, lastDates(cfg.lastDate, period)).then((res) => {
      if (cancelled) return
      if (res.ok) setDays(res.data ?? [])
      else setError(res.error)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [cfg?.assetId, cfg?.lastDate, period, reloadKey])

  const group = PERIODS.find((p) => p.days === period)?.group ?? 1
  const metricPoints = (metric: string) => buildPoints(days, sensors.map((s) => `${s}__${metric}`), group)
  const metricSeries = (metric: string) => sensors.map((s) => ({ key: `${s}__${metric}`, label: labelOf(s), color: colorOf(s) }))
  const hasMetric = (metric: string) => (cfg?.series ?? []).some((m) => m.metric === metric)

  const summaries = useMemo(() => sensors.map((s) => summarizeSensor(days, s, limits)), [days, sensors, limits])
  const alerts = useMemo(() => findAlerts(days, sensors, limits), [days, sensors, limits])
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
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
            {configs.length === 0 && <option value="">Nenhum equipamento com dados — importa um .csv</option>}
            {configs.map((c) => <option key={c.assetId} value={c.assetId}>{assetName(c.assetId)}</option>)}
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Período</label>
          <Select value={String(period)} sort={false} onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
            {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
          </Select>
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
        <p className="text-sm text-gray-500 dark:text-slate-400">Sem medições neste período.</p>
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

          {hasMetric('vRMS') && (
            <MetricChart title="Fadiga — velocidade de vibração RMS" unit="mm/s" points={metricPoints('vRMS')} series={metricSeries('vRMS')} zones={limits}
              subtitle="Desequilíbrio, desalinhamento e folgas — zonas ISO 10816-3 a cores (0,2 mm/s = 0,0002 m/s no SCADA)" />
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {hasMetric('aRMS') && (
              <MetricChart title={`${metricLabel('aRMS')} — aceleração RMS`} unit="m/s²" points={metricPoints('aRMS')} series={metricSeries('aRMS')}
                subtitle="Sobe com desgaste de rolamentos e engrenagens (alta frequência)" />
            )}
            {hasMetric('aPeak') && (
              <MetricChart title={`${metricLabel('aPeak')} — aceleração de pico`} unit="m/s²" points={metricPoints('aPeak')} series={metricSeries('aPeak')}
                subtitle="Impactos — picos isolados indicam defeitos localizados" />
            )}
            {hasMetric('Crista') && (
              <MetricChart title={metricLabel('Crista')} unit="" points={metricPoints('Crista')} series={metricSeries('Crista')}
                subtitle="Pico ÷ RMS. Acima de ~6 de forma persistente sugere defeito inicial em rolamento" />
            )}
            {hasMetric('Temperatura') && (
              <MetricChart title="Temperatura" unit="°C" points={metricPoints('Temperatura')} limitLine={limits.temp}
                series={sensors.filter((s) => cfg.series.some((m) => m.key === `${s}__Temperatura`)).map((s) => ({ key: `${s}__Temperatura`, label: labelOf(s), color: colorOf(s) }))}
                subtitle="Aquecimento progressivo acompanha lubrificação deficiente ou sobrecarga" />
            )}
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Alertas</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Sem valores acima dos limites no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-slate-400"><th className="py-1 pr-3">Data</th><th className="py-1 pr-3">Sensor</th><th className="py-1 pr-3">Tipo</th><th className="py-1 pr-3">Máximo</th><th className="py-1">Nível</th></tr></thead>
                  <tbody>
                    {alerts.map((a, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800 text-gray-700 dark:text-slate-200">
                        <td className="py-1 pr-3">{a.date}</td>
                        <td className="py-1 pr-3">{labelOf(a.sensor)}</td>
                        <td className="py-1 pr-3">{a.kind}</td>
                        <td className="py-1 pr-3">{a.value.toFixed(2)} {a.kind === 'vibração' ? 'mm/s' : '°C'}</td>
                        <td className="py-1"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${a.level === 'perigo' ? ZONE_STYLE.D.cls : ZONE_STYLE.C.cls}`}>{a.level}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
