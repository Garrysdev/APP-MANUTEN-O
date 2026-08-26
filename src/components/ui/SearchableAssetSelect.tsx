'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Tag, MapPin, Wrench, QrCode, Camera, X, CheckCircle2, Upload } from 'lucide-react'
import jsQR from 'jsqr'

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
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  assets: AssetOption[]
  name?: string
  required?: boolean
  placeholder?: string
}) {
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [scannedSuccess, setScannedSuccess] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrFileInputRef = useRef<HTMLInputElement | null>(null)

const DEFAULT_FALLBACK_ASSETS: AssetOption[] = [
  { id: '80', name: 'Área 80', area: '80', tag: '80' },
  { id: '120B', name: 'Área 120B', area: '120B', tag: '120B' },
  { id: '121B', name: 'Área 121B', area: '121B', tag: '121B' },
  { id: '122B', name: 'Área 122B', area: '122B', tag: '122B' },
  { id: '130', name: 'Área 130', area: '130', tag: '130' },
  { id: '130EST', name: 'Área 130EST', area: '130EST', tag: '130EST' },
  { id: '130INK', name: 'Área 130INK', area: '130INK', tag: '130INK' },
  { id: 'SR', name: 'Área SR', area: 'SR', tag: 'SR' },
  { id: 'VT', name: 'Área VT', area: 'VT', tag: 'VT' },
  { id: 'UR', name: 'Área UR', area: 'UR', tag: 'UR' },
  { id: 'Geral', name: 'Geral', area: 'Geral', tag: 'Geral' },
]

  const effectiveAssets = useMemo(() => {
    return (assets && assets.length > 0) ? assets : DEFAULT_FALLBACK_ASSETS
  }, [assets])

  // Encontrar o equipamento correspondente ao `value` de forma SÍNCRONA
  const matchedAsset = useMemo(() => {
    if (value === 'varios') return { id: 'varios', name: 'Vários Equipamentos / Serviços Transversais', tag: 'Vários', area: 'Geral' }
    if (!value) return null
    const valLower = value.toLowerCase().trim()
    const valAlpha = valLower.replace(/[^a-z0-9]/g, '')

    const found = effectiveAssets.find((a) => {
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
  }, [value, effectiveAssets])

  // Lista de Áreas Únicas extraídas dos equipamentos
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    effectiveAssets.forEach((a) => {
      if (a.area && a.area.trim()) set.add(a.area.trim())
    })
    if (matchedAsset && matchedAsset.area && matchedAsset.area.trim()) {
      set.add(matchedAsset.area.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [effectiveAssets, matchedAsset])

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

  // Equipamentos filtrados rigorosamente pela Área selecionada
  const availableEquipments = useMemo(() => {
    if (!selectedArea || selectedArea === 'varios') return []
    const selNorm = selectedArea.toLowerCase().replace(/\s+/g, ' ').trim()
    const selAlpha = selNorm.replace(/[^a-z0-9]/g, '')

    const filtered = effectiveAssets.filter((a) => {
      const aArea = (a.area || '').toLowerCase().replace(/\s+/g, ' ').trim()
      const aAlpha = aArea.replace(/[^a-z0-9]/g, '')
      const aTag = (a.tag || a.name || '').toLowerCase().trim()
      const aTagAlpha = aTag.replace(/[^a-z0-9]/g, '')

      // 1. A Área do equipamento é idêntica à Área selecionada (ex: "130EST" == "130EST")
      const areaEquals = aArea === selNorm || (selAlpha && aAlpha === selAlpha)

      // 2. A TAG do equipamento começa pela Área selecionada (ex: "130EST U3 Y5 Y1" começa por "130EST")
      const tagStartsWithArea = aTag.startsWith(selNorm) || (selAlpha && aTagAlpha.startsWith(selAlpha))

      return areaEquals || tagStartsWithArea
    })

    if (matchedAsset && (matchedAsset.area || '').toLowerCase().trim() === selNorm) {
      if (!filtered.some((f) => f.id === matchedAsset.id)) {
        return [matchedAsset, ...filtered]
      }
    }
    return filtered
  }, [effectiveAssets, selectedArea, matchedAsset])

  function handleAreaChange(area: string) {
    setUserArea(area)
    setUserTag('')
    if (area === 'varios') {
      setUserTag('varios')
      onChange('varios')
    } else {
      const normArea = area.toLowerCase().trim()
      const normAlpha = normArea.replace(/[^a-z0-9]/g, '')
      const items = assets.filter((a) => {
        const aArea = (a.area || '').toLowerCase().trim()
        const aAlpha = aArea.replace(/[^a-z0-9]/g, '')
        const aTag = (a.tag || a.name || '').toLowerCase().trim()
        const aTagAlpha = aTag.replace(/[^a-z0-9]/g, '')
        return aArea === normArea || (normAlpha && aAlpha === normAlpha) || aTag.startsWith(normArea) || (normAlpha && aTagAlpha.startsWith(normAlpha))
      })
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

  // Resolução de QR Code Lido (Câmara ou Imagem)
  function handleResolveScannedQR(rawText: string) {
    let cleanCode = rawText.trim()
    if (cleanCode.includes('/assets/')) {
      const parts = cleanCode.split('/assets/')
      cleanCode = decodeURIComponent(parts[parts.length - 1])
    } else if (cleanCode.includes('/tasks?')) {
      const urlObj = new URL(cleanCode, 'http://localhost')
      const pAsset = urlObj.searchParams.get('assetId') || urlObj.searchParams.get('tag')
      if (pAsset) cleanCode = pAsset
    }

    const cleanLower = cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')

    const found = assets.find((a) => {
      const aId = (a.id || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const aTag = (a.tag || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const aName = (a.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return (
        aId === cleanLower ||
        aTag === cleanLower ||
        aName === cleanLower ||
        (cleanLower && (aId.includes(cleanLower) || aTag.includes(cleanLower)))
      )
    })

    if (found) {
      setUserArea(found.area || 'Geral')
      setUserTag(found.id)
      onChange(found.id)
      setScannedSuccess(`Equipamento detetado: [${found.tag || found.id}] ${found.name} (Área: ${found.area || 'Geral'})`)
      setScanError(null)
      setShowQRScanner(false)
      setTimeout(() => setScannedSuccess(null), 5000)
    } else {
      // Se não encontrou o ID exato, usa a string como TAG/ID sintético
      setUserArea('Geral')
      setUserTag(cleanCode)
      onChange(cleanCode)
      setScannedSuccess(`QR Code associado: ${cleanCode}`)
      setScanError(null)
      setShowQRScanner(false)
      setTimeout(() => setScannedSuccess(null), 5000)
    }
  }

  // Leitura de QR em ficheiro de imagem
  function handleFileQRDecode(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        })
        if (code && code.data) {
          handleResolveScannedQR(code.data)
        } else {
          setScanError('Não foi possível ler o QR Code nesta foto. Tente aproximar o código.')
        }
      }
    }
  }

  // Transmissão da Câmara em Tempo Real
  useEffect(() => {
    if (!showQRScanner) return
    let active = true
    let stream: MediaStream | null = null
    let interval: NodeJS.Timeout | null = null

    async function startCamera() {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        }

        if (!active) {
          if (stream) stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.setAttribute('playsinline', 'true')
          videoRef.current.play().catch(() => {})
        }

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        interval = setInterval(() => {
          const video = videoRef.current
          if (!video || video.readyState < 2) return
          try {
            canvas.width = video.videoWidth || 300
            canvas.height = video.videoHeight || 300
            if (ctx && canvas.width > 0 && canvas.height > 0) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth',
              })
              if (code && code.data) {
                handleResolveScannedQR(code.data)
                return
              }
            }
          } catch {}
        }, 300)
      } catch (err) {
        console.error('Erro ao iniciar câmara:', err)
        setScanError('Não foi possível aceder à câmara do dispositivo.')
      }
    }

    startCamera()

    return () => {
      active = false
      if (interval) clearInterval(interval)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [showQRScanner])

  return (
    <div className="space-y-3 w-full bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
      <input type="hidden" name={name} value={value} required={required} />

      {/* Header com Botão para Ler QR Code */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Wrench className="h-4 w-4 text-industrial-blue dark:text-sky-400" />
          Seleção de Equipamento / TAG
        </span>

        <button
          type="button"
          onClick={() => {
            setShowQRScanner(true)
            setScanError(null)
          }}
          className="btn-primary text-[11px] font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm bg-safety-orange hover:bg-safety-orange/90 text-white cursor-pointer"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>📷 Ler QR Code</span>
        </button>
      </div>

      {/* Alerta de Sucesso na Deteção do QR Code */}
      {scannedSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="truncate">{scannedSuccess}</span>
        </div>
      )}

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
              Selecione a Área e a TAG (ou leia o QR Code) para definir o Equipamento
            </span>
          )}
        </div>
      </div>

      {/* MODAL SCANNER DE QR CODE */}
      {showQRScanner && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-5 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Camera className="h-4 w-4 text-safety-orange" />
                <span>Ler QR Code do Equipamento</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowQRScanner(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aponte a câmara do telemóvel para a etiqueta QR Code afixada na máquina/equipamento.
            </p>

            {/* Video Feed */}
            <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border-2 border-safety-orange shadow-inner flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-dashed border-safety-orange rounded-xl pointer-events-none animate-pulse" />
            </div>

            {scanError && (
              <div className="p-2 rounded bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                {scanError}
              </div>
            )}

            {/* Alternativa: Escolher Foto da Galeria */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <input
                type="file"
                accept="image/*"
                ref={qrFileInputRef}
                onChange={handleFileQRDecode}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => qrFileInputRef.current?.click()}
                className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-1.5 font-bold"
              >
                <Upload className="h-3.5 w-3.5 text-industrial-blue" />
                <span>Escolher Foto com QR Code</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQRScanner(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 block w-full py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

