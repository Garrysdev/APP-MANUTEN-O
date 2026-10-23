'use client'

import { useMemo, useState } from 'react'
import Select from '@/components/ui/Select'
import type { Asset } from '@/types/models'

const NEW = '__nova__'
const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

/**
 * Área e TAG do formulário de equipamento como listas (igual à OT): escolhe-se uma Área
 * existente e a TAG filtra-se por essa Área. "+ Nova…" deixa escrever um valor novo.
 * Os valores vão no FormData como `area` e `tag` (inputs escondidos).
 */
export default function AssetAreaTagFields({
  assets,
  defaultArea,
  defaultTag,
  areaLabel,
  tagLabel,
}: {
  assets: Asset[]
  defaultArea: string
  defaultTag: string
  areaLabel: string
  tagLabel: string
}) {
  const areas = useMemo(() => {
    const set = new Set(assets.map((a) => (a.area || '').trim()).filter(Boolean))
    if (defaultArea) set.add(defaultArea)
    return [...set].sort(byNumber)
  }, [assets, defaultArea])

  const [area, setArea] = useState(defaultArea)
  const [newArea, setNewArea] = useState(false)
  const [tag, setTag] = useState(defaultTag)
  const [newTag, setNewTag] = useState(false)

  const tags = useMemo(() => {
    const set = new Set(
      assets
        .filter((a) => !area || (a.area || '').trim().toLowerCase() === area.trim().toLowerCase())
        .map((a) => (a.tag || '').trim())
        .filter(Boolean),
    )
    if (defaultTag && (!area || area === defaultArea)) set.add(defaultTag)
    return [...set].sort(byNumber)
  }, [assets, area, defaultArea, defaultTag])

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{tagLabel}</label>
        {newTag ? (
          <div className="flex gap-1">
            <input value={tag} onChange={(e) => setTag(e.target.value)} className="input" placeholder="Nova TAG" autoFocus required />
            <button type="button" onClick={() => { setNewTag(false); setTag(defaultTag) }} className="px-2 text-xs text-slate-500 hover:text-slate-800" title="Voltar à lista">✕</button>
          </div>
        ) : (
          <Select value={tag} className="input" sort={false} required
            onChange={(e) => { if (e.target.value === NEW) { setNewTag(true); setTag('') } else setTag(e.target.value) }}>
            <option value="">-- Selecionar TAG ({tags.length}) --</option>
            <option value={NEW}>+ Nova TAG…</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}
        <input type="hidden" name="tag" value={tag} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{areaLabel}</label>
        {newArea ? (
          <div className="flex gap-1">
            <input value={area} onChange={(e) => setArea(e.target.value)} className="input" placeholder="Nova área" autoFocus />
            <button type="button" onClick={() => { setNewArea(false); setArea(defaultArea) }} className="px-2 text-xs text-slate-500 hover:text-slate-800" title="Voltar à lista">✕</button>
          </div>
        ) : (
          <Select value={area} className="input" sort={false}
            onChange={(e) => { if (e.target.value === NEW) { setNewArea(true); setArea('') } else setArea(e.target.value) }}>
            <option value="">-- Selecionar Área ({areas.length}) --</option>
            <option value={NEW}>+ Nova área…</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        )}
        <input type="hidden" name="area" value={area} />
      </div>
    </div>
  )
}
