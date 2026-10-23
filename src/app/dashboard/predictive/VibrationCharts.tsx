'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts'
import type { ChartPoint } from '@/lib/vibration-view'

export const SENSOR_COLORS = ['#2E86C1', '#E67E22', '#27AE60', '#8E44AD', '#C0392B', '#16A085', '#D4AC0D', '#5D6D7E']

const fmtTick = (t: number, spanDays: number) => {
  const d = new Date(t)
  return spanDays <= 2
    ? d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

export interface ChartSeries { key: string; label: string; color: string }

export default function MetricChart({
  title,
  subtitle,
  unit,
  points,
  series,
  zones,
  limitLine,
  rightSeries = [],
  rightUnit = '',
}: {
  title: string
  subtitle?: string
  unit: string
  points: ChartPoint[]
  series: ChartSeries[]
  zones?: { ab: number; bc: number; cd: number }
  limitLine?: number
  /** Segundo eixo (direita) — ex.: corrente e rpm para comparar com a vibração. */
  rightSeries?: ChartSeries[]
  rightUnit?: string
}) {
  if (points.length === 0 || series.length === 0) return null
  const spanDays = (points[points.length - 1].t - points[0].t) / 86_400_000
  let yMax = 0
  for (const p of points) for (const s of series) { const v = p[s.key]; if (typeof v === 'number' && v > yMax) yMax = v }
  const top = zones ? Math.max(yMax * 1.15, zones.bc * 1.1) : limitLine ? Math.max(yMax * 1.1, limitLine * 1.05) : undefined

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}{unit ? ` (${unit})` : ''}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
            {zones && top !== undefined && (
              <>
                <ReferenceArea y1={0} y2={zones.ab} fill="#22c55e" fillOpacity={0.08} ifOverflow="hidden" />
                <ReferenceArea y1={zones.ab} y2={zones.bc} fill="#eab308" fillOpacity={0.08} ifOverflow="hidden" />
                <ReferenceArea y1={zones.bc} y2={zones.cd} fill="#f97316" fillOpacity={0.1} ifOverflow="hidden" />
                <ReferenceArea y1={zones.cd} y2={Math.max(top, zones.cd * 1.2)} fill="#ef4444" fillOpacity={0.1} ifOverflow="hidden" />
                <ReferenceLine y={zones.bc} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'Alerta', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }} />
              </>
            )}
            {limitLine !== undefined && <ReferenceLine y={limitLine} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Limite', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />}
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(t) => fmtTick(t, spanDays)} tick={{ fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, top ?? 'auto']} allowDataOverflow={false} />
            {rightSeries.length > 0 && (
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} label={rightUnit ? { value: rightUnit, angle: 90, position: 'insideRight', fontSize: 10 } : undefined} />
            )}
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
              formatter={(v, name) => {
                const right = rightSeries.find((s) => s.label === name)
                const u = right ? rightUnit : unit
                return [`${v}${u ? ` ${u}` : ''}`, name]
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
            ))}
            {rightSeries.map((s) => (
              <Line key={s.key} yAxisId="right" type="monotone" dataKey={s.key} name={s.label} stroke={s.color} dot={false} strokeWidth={1.5} strokeDasharray="5 3" connectNulls={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
