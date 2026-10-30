'use client'

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import Select from '@/components/ui/Select'
import { ISO_PRESETS, type VibLimits } from '@/lib/vibration'
import { saveVibrationSettingsAction } from './actions'

export interface SettingsValue { sensorLabels: Record<string, string>; limits: VibLimits; base: 'rigid' | 'flexible' }

const inputCls = 'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm text-gray-900 dark:text-slate-100'

export default function VibrationSettings({
  assetId,
  sensors,
  value,
  onSaved,
}: {
  assetId: string
  sensors: string[]
  value: SettingsValue
  onSaved: (v: SettingsValue) => void
}) {
  const [labels, setLabels] = useState(value.sensorLabels)
  const [limits, setLimits] = useState(value.limits)
  const [base, setBase] = useState(value.base)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    const v = { sensorLabels: labels, limits, base }
    const res = await saveVibrationSettingsAction(assetId, v)
    setSaving(false)
    if (res.ok) { setMsg({ ok: true, text: 'Guardado.' }); onSaved(v) } else setMsg({ ok: false, text: res.error })
  }

  const num = (k: keyof VibLimits, placeholder?: string) => (
    <input type="number" step="0.1" min="0" className={inputCls} value={limits[k] || (placeholder ? '' : 0)} placeholder={placeholder}
      onChange={(e) => setLimits((l) => ({ ...l, [k]: parseFloat(e.target.value) || 0 }))} />
  )

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">Posição de cada sensor</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sensors.map((s) => (
            <div key={s}>
              <label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">{s}</label>
              <input className={inputCls} placeholder="ex.: Motor — lado ventilador" value={labels[s] ?? ''}
                onChange={(e) => setLabels((l) => ({ ...l, [s]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">Limites de alarme (ISO 10816-3, Grupo 2: 15–300 kW)</p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">Base de fixação</label>
            <Select className={inputCls} value={base} sort={false}
              onChange={(e) => { const b = e.target.value as 'rigid' | 'flexible'; setBase(b); setLimits((l) => ({ ...ISO_PRESETS[b], temp: l.temp, current: l.current })) }}>
              <option value="rigid">Rígida</option>
              <option value="flexible">Flexível</option>
            </Select>
          </div>
          <div><label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">A/B — bom (mm/s)</label>{num('ab')}</div>
          <div><label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">B/C — alerta (mm/s)</label>{num('bc')}</div>
          <div><label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">C/D — perigo (mm/s)</label>{num('cd')}</div>
          <div><label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">Temperatura (°C)</label>{num('temp')}</div>
          <div><label className="block text-[11px] text-gray-500 dark:text-slate-400 mb-0.5">Corrente do motor (A)</label>{num('current', 'sem alarme')}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2E86C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2471A3] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
        </button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}
