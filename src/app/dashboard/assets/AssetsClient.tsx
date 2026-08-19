'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Package, X, Tag, Camera, ImageOff, Upload, Filter, Search, ChevronLeft, ChevronRight, QrCode, Printer, History } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import type { Asset, PlanName } from '@/types/models'
import { createAssetAction, updateAssetAction, deleteAssetAction, importAssetsAction, bulkDeleteAssetsAction, bulkUpdateAssetsAction } from './actions'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'

import jsQR from 'jsqr'

export default function AssetsClient({ assets, plan }: { assets: Asset[], plan: PlanName }) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [editing, setEditing] = useState<Asset | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [colAreaFilter, setColAreaFilter] = useState('')
  const [colTagFilter, setColTagFilter] = useState('')
  const [colNameFilter, setColNameFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [printQRAsset, setPrintQRAsset] = useState<Asset | null>(null)
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null)

  const [showBatchQRModal, setShowBatchQRModal] = useState(false)
  const [batchArea, setBatchArea] = useState<string>('')
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set())

  const [showQRScanner, setShowQRScanner] = useState(false)
  const [qrInput, setQrInput] = useState('')
  const [qrError, setQrError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function normAlphaNum(str?: string | null): string {
    if (!str) return ''
    return str.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  function resolveAndNavigateQR(scannedInput: string) {
    let raw = scannedInput.trim()
    if (!raw) return

    try { raw = decodeURIComponent(raw).trim() } catch {}

    // Remover prefixos comuns de leitores (ex: "TAG: 90 H1 B1", "EQUIPAMENTO: ...", "ID: ...")
    let cleanedQuery = raw.replace(/^(tag|id|qr|equipamento|asset)[:=\s]+/i, '').trim()
    if (!cleanedQuery) cleanedQuery = raw

    let query = cleanedQuery
    let explicitTag = ''
    let explicitId = ''
    try {
      const u = new URL(raw.startsWith('http') ? raw : `http://dummy.local/${raw}`)
      explicitTag = u.searchParams.get('tag') || u.searchParams.get('qrTag') || ''
      explicitId = u.searchParams.get('id') || u.searchParams.get('qrId') || ''
    } catch {}

    const matchUrl = query.match(/\/dashboard\/assets\/([^\/\?#]+)/)
    if (matchUrl) {
      try { query = decodeURIComponent(matchUrl[1]) } catch { query = matchUrl[1] }
    }

    const normQuery = query.toLowerCase().trim()
    const queryAlpha = normAlphaNum(query)

    // 1. Se veio tag explícita na URL
    if (explicitTag) {
      const expTagAlpha = normAlphaNum(explicitTag)
      const foundByExpTag = assets.find((a) => a.tag && normAlphaNum(a.tag) === expTagAlpha)
      if (foundByExpTag) {
        setShowQRScanner(false)
        setQrError('')
        router.push(`/dashboard/assets/${foundByExpTag.id}`)
        return
      }
    }

    // 2. Se veio id explícito na URL
    if (explicitId) {
      const foundByExpId = assets.find((a) => a.id === explicitId || a.id.toLowerCase() === explicitId.toLowerCase())
      if (foundByExpId) {
        setShowQRScanner(false)
        setQrError('')
        router.push(`/dashboard/assets/${foundByExpId.id}`)
        return
      }
    }

    // 3. Procura por TAG (exata ou alpha-numérica)
    const matchedByTag = assets.find((a) => {
      if (!a.tag) return false
      const aTagLower = a.tag.toLowerCase().trim()
      const aTagAlpha = normAlphaNum(a.tag)
      return aTagLower === normQuery || (queryAlpha && aTagAlpha === queryAlpha)
    })
    if (matchedByTag) {
      setShowQRScanner(false)
      setQrError('')
      router.push(`/dashboard/assets/${matchedByTag.id}`)
      return
    }

    // 4. Procura por ID
    const matchedById = assets.find((a) => {
      const aIdLower = a.id.toLowerCase().trim()
      const aIdAlpha = normAlphaNum(a.id)
      return aIdLower === normQuery || (queryAlpha && aIdAlpha === queryAlpha)
    })
    if (matchedById) {
      setShowQRScanner(false)
      setQrError('')
      router.push(`/dashboard/assets/${matchedById.id}`)
      return
    }

    // 5. Procura por qrCode guardado
    const matchedByQrCode = assets.find((a) => {
      const qrVal = (a as any).qrCode
      if (!qrVal) return false
      return qrVal.toLowerCase().trim() === normQuery || (queryAlpha && normAlphaNum(qrVal) === queryAlpha)
    })
    if (matchedByQrCode) {
      setShowQRScanner(false)
      setQrError('')
      router.push(`/dashboard/assets/${matchedByQrCode.id}`)
      return
    }

    // 6. Procura por Nome
    const matchedByName = assets.find((a) => {
      if (!a.name) return false
      const aNameLower = a.name.toLowerCase().trim()
      const aNameAlpha = normAlphaNum(a.name)
      return aNameLower === normQuery || (queryAlpha && aNameAlpha === queryAlpha)
    })
    if (matchedByName) {
      setShowQRScanner(false)
      setQrError('')
      router.push(`/dashboard/assets/${matchedByName.id}`)
      return
    }

    setQrError(`Equipamento não encontrado para "${raw}". Tenta por TAG (ex: 90 H1 B1 ou 101 Y3 B3) ou ID.`)
  }

  async function scanFromFile(file: File) {
    try {
      setQrError('')
      const img = new window.Image()
      img.src = URL.createObjectURL(file)
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
      })
      const cvs = document.createElement('canvas')
      cvs.width = img.width
      cvs.height = img.height
      const c = cvs.getContext('2d')
      if (c) {
        c.drawImage(img, 0, 0)
        const imgData = c.getImageData(0, 0, cvs.width, cvs.height)
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' })
        if (code && code.data) {
          resolveAndNavigateQR(code.data)
          return
        }
      }
      setQrError('Não foi possível detetar um QR Code válido na imagem. Tenta outra foto.')
    } catch {
      setQrError('Erro ao carregar ficheiro de imagem.')
    }
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let interval: NodeJS.Timeout | null = null
    let active = true

    async function startCamera() {
      if (!showQRScanner) {
        setCameraActive(false)
        return
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false)
        return
      }

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

        setCameraActive(true)

        setTimeout(() => {
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
            videoRef.current.setAttribute('playsinline', 'true')
            videoRef.current.play().catch(() => {})
          }
        }, 100)

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        interval = setInterval(async () => {
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
                resolveAndNavigateQR(code.data)
                return
              }
            }
          } catch {}

          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] })
              const barcodes = await detector.detect(video)
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                resolveAndNavigateQR(barcodes[0].rawValue)
              }
            } catch {}
          }
        }, 300)
      } catch (err) {
        console.error('Camera startup error:', err)
        setCameraActive(false)
      }
    }

    startCamera()

    return () => {
      active = false
      if (interval) clearInterval(interval)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [showQRScanner])

  function openCreate() {
    if (!planHas(plan, 'assets') && assets.length >= TEASER_LIMITS['assets']) {
      setLockedFeature('assets')
      return
    }
    setCreating(true)
    setPhotoFile(null)
    setPhotoPreview(null)
    setError('')
  }

  function openEdit(asset: Asset) {
    setEditing(asset)
    setPhotoFile(null)
    setPhotoPreview(asset.photoUrl ?? null)
    setError('')
  }

  function closeModal() {
    setEditing(null)
    setCreating(false)
    setError('')
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original) // comprime antes do upload (tarefa 06)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    let photoFailed = false

    try {
      // A foto NÃO bloqueia a gravação: se o upload ao Storage falhar, o
      // equipamento é guardado na mesma e o utilizador é avisado. (bug 08)
      if (photoFile) {
        try {
          const url = await uploadImage(photoFile, 'assets')
          formData.set('photoUrl', url)
        } catch {
          photoFailed = true
          if (editing?.photoUrl) formData.set('photoUrl', editing.photoUrl)
        }
      } else if (editing?.photoUrl) {
        formData.set('photoUrl', editing.photoUrl)
      }

      const result = editing
        ? await updateAssetAction({}, formData)
        : await createAssetAction({}, formData)

      if (result.error) {
        setError(result.error)
      } else {
        if (photoFailed) {
          setNotice('Equipamento guardado, mas a foto não foi carregada (serviço de imagens indisponível). Podes adicioná-la mais tarde.')
        }
        closeModal()
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(asset: Asset) {
    if (!confirm(`Eliminar "${asset.name}"?`)) return
    await deleteAssetAction(asset.id)
    router.refresh()
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedAssets)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedAssets(next)
  }

  function toggleSelectAll() {
    if (selectedAssets.size === shown.length) {
      setSelectedAssets(new Set())
    } else {
      setSelectedAssets(new Set(shown.map((a) => a.id)))
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Eliminar ${selectedAssets.size} equipamento(s)?`)) return
    setBusy(true)
    await bulkDeleteAssetsAction(Array.from(selectedAssets))
    setSelectedAssets(new Set())
    setBusy(false)
    router.refresh()
  }

  async function handleBulkArea() {
    const area = window.prompt(`Nova Área para ${selectedAssets.size} equipamento(s):`)
    if (area === null) return
    setBusy(true)
    await bulkUpdateAssetsAction(Array.from(selectedAssets), { area })
    setSelectedAssets(new Set())
    setBusy(false)
    router.refresh()
  }

  async function handleBulkTag() {
    const tag = window.prompt(`Novo TAG para ${selectedAssets.size} equipamento(s):`)
    if (tag === null) return
    setBusy(true)
    await bulkUpdateAssetsAction(Array.from(selectedAssets), { tag })
    setSelectedAssets(new Set())
    setBusy(false)
    router.refresh()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!planHas(plan, 'assets') && assets.length >= TEASER_LIMITS['assets']) {
      setLockedFeature('assets')
      return
    }
    setImporting(true)
    setImportError('')
    setImportResult(null)
    const formData = new FormData()
    formData.set('file', file)
    const result = await importAssetsAction(formData)
    setImporting(false)
    if (result.error) setImportError(result.error)
    else {
      setImportResult({ created: result.created ?? 0, skipped: result.skipped ?? 0 })
      router.refresh()
    }
  }

  const showForm = creating || editing !== null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const areaQ = colAreaFilter.trim().toLowerCase()
    const tagQ = colTagFilter.trim().toLowerCase()
    const nameQ = colNameFilter.trim().toLowerCase()

    return assets.filter((a) => {
      if (estadoFilter === 'active' && a.active === false) return false
      if (estadoFilter === 'inactive' && a.active !== false) return false
      if (areaQ && !(a.area || '').toLowerCase().includes(areaQ)) return false
      if (tagQ && !(a.tag || '').toLowerCase().includes(tagQ)) return false
      if (nameQ && !(a.name || '').toLowerCase().includes(nameQ)) return false
      if (q) {
        const haystack = `${a.name || ''} ${a.location || ''} ${a.type || ''} ${a.area || ''} ${a.tag || ''} ${a.manufacturer || ''} ${(a.tags || []).join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [assets, search, estadoFilter, colAreaFilter, colTagFilter, colNameFilter])

  const { sorted: shown, sortKey, sortDir, toggleSort } = useTableSort<Asset>(
    filtered,
    {
      name: (a) => a.name?.toLowerCase(),
      tag: (a) => a.tag?.toLowerCase(),
      area: (a) => a.area?.toLowerCase(),
      location: (a) => a.location,
      type: (a) => a.type,
      active: (a) => (a.active ? 1 : 0),
    },
    null,
  )

  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.area).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b), 'pt', { numeric: true })
    )
  }, [assets])

  const uniqueTags = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.tag).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b), 'pt', { numeric: true })
    )
  }, [assets])

  const uniqueNames = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.name).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b), 'pt')
    )
  }, [assets])

  const temFiltro = search.trim() || estadoFilter !== 'all' || colAreaFilter || colTagFilter || colNameFilter
  function limparFiltros() {
    setSearch('')
    setEstadoFilter('all')
    setColAreaFilter('')
    setColTagFilter('')
    setColNameFilter('')
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [search, estadoFilter, colAreaFilter, colTagFilter, colNameFilter, pageSize])

  const effectivePageSize = pageSize === -1 ? (shown.length || 1) : pageSize
  const totalPages = Math.ceil(shown.length / effectivePageSize) || 1
  const currentShown = useMemo(() => {
    if (pageSize === -1) return shown
    return shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  }, [shown, currentPage, pageSize])

  return (
    <div className="max-w-6xl mx-auto">
      {lockedFeature && (
        <UpgradeModal feature={lockedFeature} isTeaser={true} onClose={() => setLockedFeature(null)} />
      )}
      <div className="flex items-center justify-between mb-6 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">{dict.assets.title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {shown.length} / {assets.length}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowQRScanner(true)}
            className="bg-[#2E86C1] hover:bg-[#21618C] text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shrink-0 active:scale-95 transition-all"
            title="Digitalizar QR Code de equipamento"
          >
            <QrCode className="h-4 w-4 shrink-0 text-white stroke-[2.5]" />
            <span className="text-xs font-bold text-white">Ler QR</span>
          </button>
          <button
            onClick={() => {
              setBatchSelectedIds(new Set(assets.map(a => a.id)))
              setShowBatchQRModal(true)
            }}
            className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shrink-0 active:scale-95 transition-all"
            title="Gerar e imprimir QR Codes em lote"
          >
            <Printer className="h-4 w-4 shrink-0 text-white stroke-[2.5]" />
            <span className="text-xs font-bold text-white">Imprimir QR</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{importing ? dict.common.importing : dict.common.import}</span>
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{dict.assets.newAsset}</span>
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {importError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <span>{importError}</span>
          <button onClick={() => setImportError('')} className="text-red-500 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {importResult && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-green-50 dark:bg-emerald-900/20 border border-green-200 dark:border-emerald-800/50 px-4 py-3 text-sm text-green-700 dark:text-emerald-400">
          <span>
            {importResult.created} equipamento(s) importado(s)
            {importResult.skipped > 0 ? `, ${importResult.skipped} linha(s) ignorada(s)` : ''}.
          </span>
          <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700 dark:hover:text-emerald-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 flex-shrink-0" aria-label="Dispensar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barra de Filtros e Pesquisa */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={dict.assets.searchPlaceholder}
              className="input pl-9 text-xs sm:text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 ml-auto">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="input text-xs py-1 px-2 w-auto"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={-1}>Todos ({assets.length})</option>
              </select>
            </div>
            {temFiltro && (
              <button onClick={limparFiltros} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400">
                <X className="h-3.5 w-3.5" /> {dict.common.clear}
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedAssets.size > 0 && (
        <div className="card p-3 mb-4 bg-[#2E86C1]/10 dark:bg-[#2E86C1]/20 border border-[#2E86C1]/20 flex items-center justify-between animate-fade-in-up">
          <span className="text-sm font-bold text-[#1B4F72] dark:text-[#2E86C1]">
            {selectedAssets.size} equipamento(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkArea} disabled={busy} className="btn-secondary text-xs py-1.5 px-3">Alterar Área</button>
            <button onClick={handleBulkTag} disabled={busy} className="btn-secondary text-xs py-1.5 px-3">Alterar TAG</button>
            <button onClick={handleBulkDelete} disabled={busy} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">Apagar</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px] md:min-w-0">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700 font-bold uppercase tracking-wider">
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={shown.length > 0 && selectedAssets.size === shown.length} onChange={toggleSelectAll} className="rounded border-slate-300 bg-white" />
                </th>
                <SortableTh label={dict.assets.colArea} sortableKey="area" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-slate-700 font-bold" />
                <SortableTh label={dict.assets.colTag} sortableKey="tag" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-slate-700 font-bold" />
                <SortableTh label={dict.assets.colName} sortableKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-slate-700 font-bold" />
                <SortableTh label={dict.common.status} sortableKey="active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left text-slate-700 font-bold" />
                <th className="px-3 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wide">{dict.common.actions}</th>
              </tr>
              {/* Linha de Filtro por Colunas em Equipamentos */}
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 p-1">
                <td className="p-1" />
                <td className="p-1">
                  <select
                    value={colAreaFilter}
                    onChange={(e) => setColAreaFilter(e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">Área (Todas)</option>
                    {uniqueAreas.map((a) => (
                      <option key={String(a)} value={String(a)}>{String(a)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select
                    value={colTagFilter}
                    onChange={(e) => setColTagFilter(e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">TAG (Todas)</option>
                    {uniqueTags.map((t) => (
                      <option key={String(t)} value={String(t)}>{String(t)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select
                    value={colNameFilter}
                    onChange={(e) => setColNameFilter(e.target.value)}
                    className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="">Nome (Todos)</option>
                    {uniqueNames.map((n) => (
                      <option key={String(n)} value={String(n)}>{String(n)}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1">
                  <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as any)} className="input !text-[11px] !py-0.5 !px-1 w-full font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded">
                    <option value="all">Estado (Todos)</option>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </td>
                <td className="p-1" />
              </tr>
            </thead>
            <tbody>
              {currentShown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">{temFiltro ? dict.assets.emptyFilter : dict.assets.empty}</p>
                    {temFiltro && (
                      <button
                        type="button"
                        onClick={limparFiltros}
                        className="mt-3 text-xs font-bold text-[#2E86C1] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <X size={14} /> Limpar Todos os Filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                currentShown.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/dashboard/assets/${a.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title={`Clique para abrir Histórico de OTs e detalhes de ${a.name}`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedAssets.has(a.id)} onChange={() => toggleSelection(a.id)} className="rounded border-slate-300 bg-white" />
                    </td>
                    <td className="px-3 py-3.5 text-slate-900 dark:text-slate-100 font-mono font-bold">{a.area ?? '—'}</td>
                    <td className="px-3 py-3.5 text-slate-900 dark:text-slate-100 font-bold">
                      {a.tag ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                          <Tag className="h-3 w-3" />{a.tag}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        {a.photoUrl ? (
                          <div className="relative w-7 h-7 rounded overflow-hidden border border-slate-300 flex-shrink-0">
                            <Image src={a.photoUrl} alt={a.name} fill className="object-cover" sizes="28px" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <Package className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                        )}
                        <span className="hover:text-safety-orange hover:underline transition-colors">
                          {a.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={a.active ? 'badge-done' : 'badge-cancelled'}>
                        {a.active ? dict.assets.lblActive : dict.assets.lblInactive}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => router.push(`/dashboard/assets/${a.id}`)}
                        className="text-slate-600 dark:text-slate-400 hover:text-industrial-blue dark:hover:text-blue-400 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Ver Histórico de OTs e Ficha Técnica"
                      >
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        className="text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Editar Equipamento"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPrintQRAsset(a)}
                        className="text-slate-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-purple-300 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Imprimir QR Code / Etiqueta"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        className="text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {shown.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 rounded-b-xl">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <span>{dict.common.rowsPerPage}</span>
              <select 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
                className="bg-transparent border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={-1}>Todos ({shown.length})</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-300">
              <span className="text-xs">
                {Math.min((currentPage - 1) * pageSize + 1, shown.length)} - {Math.min(currentPage * pageSize, shown.length)} de {shown.length}
              </span>
              
              <div className="flex items-center gap-1 text-gray-400 dark:text-slate-500">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  aria-label="Página seguinte"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {editing ? dict.assets.modalEdit : dict.assets.modalNew}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {editing && <input type="hidden" name="id" value={editing.id} />}

              {/* Foto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formPhoto}</label>
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-[#2E86C1] transition-colors overflow-hidden bg-gray-50 dark:bg-slate-800 flex-shrink-0 relative group"
                    title="Tirar foto com a câmara"
                  >
                    {photoPreview ? (
                      <Image src={photoPreview} alt="preview" width={80} height={80} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className="text-center p-1">
                        <Camera className="h-6 w-6 mx-auto text-gray-400 dark:text-slate-500 group-hover:text-[#2E86C1]" />
                        <span className="text-[9px] text-gray-400 font-medium block mt-0.5">Tirar Foto</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1.5"
                      >
                        <Camera className="h-3.5 w-3.5" /> Tirar Foto (Câmara)
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
                      >
                        📁 Escolher da Galeria
                      </button>
                    </div>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                        className="text-red-500 hover:underline text-xs flex items-center gap-1"
                      >
                        <ImageOff className="h-3 w-3" /> {dict.assets.formRemovePhoto}
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400">JPG, PNG, WEBP — máx. 5 MB (Comprime automaticamente)</p>
                  </div>
                </div>

                {/* Input com capture=environment para câmara fotográfica direta */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {/* Input para escolher da galeria de fotos/ficheiros */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formName}</label>
                <input name="name" defaultValue={editing?.name ?? ''} className="input" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formTag}</label>
                  <input name="tag" defaultValue={editing?.tag ?? ''} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formArea}</label>
                  <input name="area" defaultValue={editing?.area ?? ''} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formLocation}</label>
                  <input name="location" defaultValue={editing?.location ?? ''} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formType}</label>
                  <input name="type" defaultValue={editing?.type ?? ''} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formManufacturer}</label>
                  <input name="manufacturer" defaultValue={editing?.manufacturer ?? ''} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formSerialNumber}</label>
                  <input name="serialNumber" defaultValue={editing?.serialNumber ?? ''} className="input" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formCharacteristics}</label>
                <textarea name="characteristics" defaultValue={editing?.characteristics ?? ''} className="input" rows={2} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formTags}</label>
                <input
                  name="tags"
                  defaultValue={editing?.tags?.join(', ') ?? ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{dict.assets.formNotes}</label>
                <textarea name="notes" defaultValue={editing?.notes ?? ''} className="input" rows={2} />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                <input type="checkbox" name="active" value="true" defaultChecked={editing?.active ?? true} className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800" />
                {dict.assets.lblActive}
              </label>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">{dict.common.cancel}</button>
                <button type="submit" disabled={busy} className="btn-primary flex-1">
                  {busy ? dict.common.loading : dict.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printQRAsset && (
        <div className="print-qr-container fixed inset-0 z-[200] flex items-center justify-center p-4 print:p-0 print:bg-white bg-black/40 dark:bg-black/60 backdrop-blur-sm print:backdrop-blur-none">
          <div className="absolute inset-0 print:hidden" onClick={() => setPrintQRAsset(null)} />
          <div className="card relative w-full max-w-sm p-8 shadow-2xl bg-white dark:bg-slate-900 print:shadow-none print:border-none print:p-0 text-center text-gray-900 dark:text-slate-100">
            <button onClick={() => setPrintQRAsset(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 print:hidden">
              <X className="h-5 w-5" />
            </button>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">{printQRAsset.name}</h2>
            <p className="text-sm text-gray-500 mb-6">{printQRAsset.tag || 'Sem TAG'}</p>
            
            <div className="flex justify-center mb-6 bg-white p-4 rounded-xl inline-block border border-gray-100 print:border-none">
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/assets/${printQRAsset.id}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            
            <p className="text-xs text-gray-400 mt-2">RG Maintenance</p>
            
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-slate-800 print:hidden flex justify-center">
              <button 
                onClick={() => window.print()}
                className="btn-primary flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> {dict.assets.printLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-qr-container, .print-qr-container *, .print-batch-container, .print-batch-container * {
            visibility: visible !important;
          }
          .print-qr-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .print-batch-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 194mm !important;
            display: grid !important;
            grid-template-columns: repeat(2, 94mm) !important;
            grid-auto-rows: 65mm !important;
            gap: 5mm !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .print-label-card {
            width: 94mm !important;
            height: 65mm !important;
            border: 2px solid #000 !important;
            border-radius: 10px !important;
            padding: 6px 8px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
      
      {/* MODAL DE IMPRESSÃO EM LOTE DE QR CODES */}
      {showBatchQRModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto print:hidden">
          <div className="absolute inset-0" onClick={() => setShowBatchQRModal(false)} />
          <div className="card relative w-full max-w-4xl p-6 shadow-2xl bg-white dark:bg-slate-900 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Gerar & Imprimir QR Codes em Lote</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Seleciona por Área ou TAGs específicas para imprimir etiquetas autocolantes (8 por folha A4)</p>
                </div>
              </div>
              <button onClick={() => setShowBatchQRModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* FILTROS & OPÇÕES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 shrink-0 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Filtrar por Área:</label>
                <select
                  value={batchArea}
                  onChange={(e) => {
                    const areaVal = e.target.value
                    setBatchArea(areaVal)
                    const matching = areaVal
                      ? assets.filter(a => (a.area || '').trim().toLowerCase() === areaVal.toLowerCase()).map(a => a.id)
                      : assets.map(a => a.id)
                    setBatchSelectedIds(new Set(matching))
                  }}
                  className="input text-xs w-full font-semibold"
                >
                  <option value="">Todas as Áreas ({uniqueAreas.length})</option>
                  {uniqueAreas.map(a => (
                    <option key={String(a)} value={String(a)}>Área {String(a)}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end justify-between gap-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Etiquetas selecionadas: <strong className="text-purple-600 dark:text-purple-400 font-bold">{batchSelectedIds.size}</strong> de {assets.length}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const pool = batchArea
                        ? assets.filter(a => (a.area || '').trim().toLowerCase() === batchArea.toLowerCase())
                        : assets
                      setBatchSelectedIds(new Set(pool.map(a => a.id)))
                    }}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    Selecionar Todos
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setBatchSelectedIds(new Set())}
                    className="text-[11px] font-bold text-slate-500 hover:underline"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>
            </div>

            {/* SELEÇÃO INDIVIDUAL DE EQUIPAMENTOS */}
            <div className="overflow-y-auto flex-1 min-h-[160px] border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(batchArea ? assets.filter(a => (a.area || '').trim().toLowerCase() === batchArea.toLowerCase()) : assets).map((a) => {
                const isChecked = batchSelectedIds.has(a.id)
                return (
                  <label key={a.id} className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${isChecked ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800' : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const next = new Set(batchSelectedIds)
                        if (e.target.checked) next.add(a.id)
                        else next.delete(a.id)
                        setBatchSelectedIds(next)
                      }}
                      className="rounded accent-purple-600 h-3.5 w-3.5"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{a.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">TAG: <strong>{a.tag || '—'}</strong> • Área: <strong>{a.area || '—'}</strong></p>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setShowBatchQRModal(false)}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={batchSelectedIds.size === 0}
                className="btn-primary text-xs flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> Imprimir {batchSelectedIds.size} Etiquetas (8 por folha A4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DE IMPRESSÃO EM LOTE (GRID DE ETIQUETAS A4: 8 POR PÁGINA) */}
      {showBatchQRModal && (
        <div className="hidden print:grid print-batch-container">
          {assets
            .filter(a => batchSelectedIds.has(a.id))
            .map((a) => {
              const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://rg-maintenance.vercel.app'
              const qrDataUrl = `${currentOrigin}/dashboard/assets?tag=${encodeURIComponent(a.tag || a.id)}&id=${a.id}`
              const qrApiImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrDataUrl)}`

              return (
                <div key={a.id} className="print-label-card">
                  <div className="w-full text-center">
                    <div className="text-[8px] font-black uppercase tracking-widest text-slate-500">RG MAINTENANCE</div>
                    <h3 className="text-[11px] font-extrabold text-slate-900 leading-tight truncate max-w-full px-1">{a.name}</h3>
                    <div className="text-[10px] font-extrabold text-slate-800 mt-0.5">
                      TAG: <span className="text-purple-800">{a.tag || a.id}</span> • Área: <span>{a.area || 'Geral'}</span>
                    </div>
                  </div>
                  
                  <div className="w-24 h-24 my-0.5 border border-slate-300 p-1 rounded-lg bg-white flex items-center justify-center shrink-0">
                    <img src={qrApiImg} alt={`QR Code ${a.tag || a.id}`} className="w-full h-full object-contain" />
                  </div>

                  <div className="text-[7.5px] font-mono text-slate-500 uppercase tracking-tight">SCAN PARA FICHA DO EQUIPAMENTO</div>
                </div>
              )
            })}
        </div>
      )}

      {showQRScanner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowQRScanner(false)} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-[#2E86C1]">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">Leitor de QR Code</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Digitalizar etiqueta de equipamento</p>
                </div>
              </div>
              <button onClick={() => setShowQRScanner(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative bg-slate-950 rounded-2xl overflow-hidden mb-3 min-h-[220px] flex items-center justify-center border border-slate-800">
              <video ref={videoRef} className={`w-full h-[220px] object-cover ${cameraActive ? 'block' : 'hidden'}`} playsInline muted />
              {!cameraActive && (
                <div className="text-center p-6 text-slate-400">
                  <Camera className="h-10 w-10 mx-auto mb-2 opacity-50 text-slate-500" />
                  <p className="text-xs">A câmara não está ativa ou a permissão foi recusada.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Podes carregar uma foto do QR ou usar a pesquisa abaixo.</p>
                </div>
              )}
              {cameraActive && (
                <div className="absolute inset-0 border-2 border-dashed border-[#2E86C1]/70 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                  <div className="w-48 h-48 border border-white/40 rounded-xl" />
                </div>
              )}
            </div>

            <label className="cursor-pointer text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2 py-2 px-4 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors mb-3 w-full">
              <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Tirar / Carregar Foto com QR Code</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) scanFromFile(e.target.files[0])
                }}
              />
            </label>

            {qrError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
                {qrError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                resolveAndNavigateQR(qrInput)
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Introduzir TAG, ID ou colar URL do QR:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => {
                      setQrInput(e.target.value)
                      setQrError('')
                    }}
                    placeholder="Ex: 10 ED, asset_ur_1..."
                    className="input text-xs flex-1"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary text-xs px-3.5 flex items-center gap-1.5 shrink-0">
                    <Search className="h-3.5 w-3.5" /> Abrir Histórico
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
