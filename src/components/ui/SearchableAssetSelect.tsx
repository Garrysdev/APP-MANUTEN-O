'use client'

import { useState, useMemo, useEffect } from 'react'
import { Tag, MapPin, Wrench } from 'lucide-react'

export interface AssetOption {
  id: string
  name: string
  tag?: string | null
  area?: string | null
}

export default function SearchableAssetSelect({
  value,
  onChange,
  assets,
  name = 'assetId',
  required = false,
}: {
  value: string
  onChange: (val: string) => void
  assets: AssetOption[]
  name?: string
  required?: boolean
  placeholder?: string
}) {


  // Encontrar o equipamento correspondente ao `value` de forma SÍNCRONA
  const matchedAsset = useMemo(() => {
    if (value === 'varios') return { id: 'varios', name: 'Vários Equipamentos / Serviços Transversais', tag: 'Vários', area: 'Geral' }
    if (!value) return null
    const valLower = value.toLowerCase().trim()
    const valAlpha = valLower.replace(/[^a-z0-9]/g, '')

    const found = assets.find((a) => {
      const aId = (a.id || '').toLowerCase()
      const aTag = (a.tag || '').toLowerCase()
      const aName = (a.name || '').toLowerCase()
      const aIdAlpha = aId.replace(/[^a-z0-9]/g, '')
      const aTagAlpha = aTag.replace(/[^a-z0-9]/g, '')
      const aNameAlpha = aName.replace(/[^a-z0-9]/g, '')

      return (
        aId === valLower ||
        aTag === valLower ||
        aName === valLower ||
        (valAlpha && (aIdAlpha === valAlpha || aTagAlpha === valAlpha || aNameAlpha === valAlpha))
      )
    })

    if (found) return found

    // Synthetic Fallback se o ID/TAG não existir no array assets
    const areaMatch = value.match(/^(\d+[A-Za-z0-9]*)/)
    const inferredArea = areaMatch ? areaMatch[1] : 'Geral'
    return {
      id: value,
      name: value,
      tag: value,
      area: inferredArea
    }
  }, [value, assets])

  // Lista de Áreas Únicas extraídas dos equipamentos
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    assets.forEach((a) => {
      if (a.area && a.area.trim()) set.add(a.area.trim())
    })
    if (matchedAsset && matchedAsset.area && matchedAsset.area.trim()) {
      set.add(matchedAsset.area.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [assets, matchedAsset])

  // Área e TAG derivadas do matchedAsset (ou do valor)
  const derivedArea = useMemo(() => {
    if (matchedAsset) {
      const fArea = (matchedAsset.area || '').trim()
      return uniqueAreas.find((u) => u.trim().toLowerCase() === fArea.toLowerCase()) || fArea
    }
    return ''
  }, [matchedAsset, uniqueAreas])

  const derivedTag = matchedAsset ? matchedAsset.id : ''

  // Estados controlados pelo utilizador (permitem alterar manualmente)
  const [userArea, setUserArea] = useState<string | null>(null)
  const [userTag, setUserTag] = useState<string | null>(null)

  // Quando o prop `value` muda externamente, fazemos reset aos overrides manuais
  useEffect(() => {
    setUserArea(null)
    setUserTag(null)
  }, [value])

  const selectedArea = userArea !== null ? userArea : derivedArea
  const selectedTag = userTag !== null ? userTag : derivedTag

  // Equipamentos filtrados pela Área selecionada
  const availableEquipments = useMemo(() => {
    if (!selectedArea) return assets
    if (selectedArea === 'varios') return []
    const filtered = assets.filter((a) => (a.area || '').trim().toLowerCase() === selectedArea.toLowerCase())
    if (matchedAsset && (matchedAsset.area || '').trim().toLowerCase() === selectedArea.toLowerCase()) {
      if (!filtered.some((f) => f.id === matchedAsset.id)) {
        return [matchedAsset, ...filtered]
      }
    }
    return filtered
  }, [assets, selectedArea, matchedAsset])

  function handleAreaChange(area: string) {
    setUserArea(area)
    setUserTag('')
    if (area === 'varios') {
      setUserTag('varios')
      onChange('varios')
    } else {
      const items = assets.filter((a) => (a.area || '').trim().toLowerCase() === area.toLowerCase())
      if (items.length === 1) {
        setUserTag(items[0].id)
        onChange(items[0].id)
      } else {
        onChange('')
      }
    }
  }

  function handleTagChange(tagVal: string) {
    setUserTag(tagVal)
    if (tagVal === 'varios') {
      onChange('varios')
      return
    }
    const found = availableEquipments.find((a) => a.id === tagVal || (a.tag || a.name).trim() === tagVal)
    if (found) {
      onChange(found.id)
    } else {
      onChange('')
    }
  }

  return (
    <div className="space-y-3 w-full bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
      <input type="hidden" name={name} value={value} required={required} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 1. Área */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-safety-orange shrink-0" />
            Área *
          </label>
          <select
            value={selectedArea}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
          >
            <option value="">-- Selecionar Área ({uniqueAreas.length}) --</option>
            <option value="varios">⚙️ VÁRIOS / TRANSVERSAL</option>
            {uniqueAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        {/* 2. TAG */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-industrial-blue dark:text-blue-400 shrink-0" />
            TAG *
          </label>
          <select
            value={selectedTag || value}
            onChange={(e) => handleTagChange(e.target.value)}
            disabled={!selectedArea || selectedArea === 'varios'}
            className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 disabled:opacity-50"
            required={required}
          >
            <option value="">
              {!selectedArea
                ? '-- Selecione primeiro a Área --'
                : `-- TAGs da Área ${selectedArea} (${availableEquipments.length}) --`}
            </option>
            <option value="varios">⚙️ Vários Equipamentos</option>
            {availableEquipments.map((item) => {
              const tagStr = (item.tag || item.name).trim()
              return (
                <option key={item.id} value={item.id}>
                  {tagStr}{item.tag && item.name ? ` — ${item.name}` : ''}
                </option>
              )
            })}
          </select>
        </div>
      </div>

      {/* 3. Nome do Equipamento */}
      <div>
        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
          <Wrench className="h-3 w-3 text-teal-600" />
          Nome do Equipamento
        </label>
        <div className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {matchedAsset ? (
            <span className="truncate flex items-center gap-2">
              {matchedAsset.tag && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border text-slate-700 dark:text-slate-300 font-bold">
                  {matchedAsset.tag}
                </span>
              )}
              <span>{matchedAsset.name}</span>
            </span>
          ) : (
            <span className="text-slate-400 font-normal italic">
              Selecione a Área e a TAG para definir o Equipamento
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
