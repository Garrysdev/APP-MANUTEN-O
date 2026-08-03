'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Package, X, Tag, Camera, ImageOff, Upload, Filter, Search, ChevronLeft, ChevronRight, QrCode, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import type { Asset, PlanName } from '@/types/models'
import { createAssetAction, updateAssetAction, deleteAssetAction, importAssetsAction, bulkDeleteAssetsAction, bulkUpdateAssetsAction } from './actions'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import { planHas, TEASER_LIMITS, type FeatureKey } from '@/lib/plans'
import UpgradeModal from '@/components/ui/UpgradeModal'
import { useLanguage } from '@/components/providers/LanguageProvider'

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
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [printQRAsset, setPrintQRAsset] = useState<Asset | null>(null)
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null)

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
    return assets.filter((a) => {
      if (estadoFilter === 'active' && !a.active) return false
      if (estadoFilter === 'inactive' && a.active) return false
      if (q) {
        const haystack = `${a.name || ''} ${a.location || ''} ${a.type || ''} ${a.area || ''} ${a.tag || ''} ${a.manufacturer || ''} ${(a.tags || []).join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [assets, search, estadoFilter])

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

  const temFiltro = search.trim() || estadoFilter !== 'all'
  function limparFiltros() { setSearch(''); setEstadoFilter('all') }

  useEffect(() => {
    setCurrentPage(1)
  }, [search, estadoFilter, pageSize])

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

      {assets.length > 0 && (
        <div className="card p-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" /> {dict.common.filters}
            </span>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={dict.assets.searchPlaceholder}
                className="input text-sm py-1.5 pl-7 pr-7 w-56 sm:w-64"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as typeof estadoFilter)} className="input text-sm py-1.5 w-auto">
              <option value="all">{dict.assets.allStatus}</option>
              <option value="active">{dict.assets.activeOnly}</option>
              <option value="inactive">{dict.assets.inactiveOnly}</option>
            </select>
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
      )}

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
        {shown.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{temFiltro ? dict.assets.emptyFilter : dict.assets.empty}</p>
          </div>
        ) : (
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
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar Área..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-mono" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar TAG..." className="input !text-[11px] !py-0.5 !px-1.5 w-full font-mono" /></td>
                  <td className="p-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar Nome..." className="input !text-[11px] !py-0.5 !px-1.5 w-full" /></td>
                  <td className="p-1">
                    <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as any)} className="input !text-[11px] !py-0.5 !px-1 w-full">
                      <option value="all">Todos</option>
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </td>
                  <td className="p-1" />
                </tr>
              </thead>
              <tbody>
                {currentShown.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selectedAssets.has(a.id)} onChange={() => toggleSelection(a.id)} className="rounded border-slate-300 bg-white" />
                    </td>
                    <td className="px-3 py-3.5 text-slate-900 font-mono font-bold">{a.area ?? '—'}</td>
                    <td className="px-3 py-3.5 text-slate-900 font-bold">
                      {a.tag ? (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100/90 border border-slate-200 text-slate-900">
                          <Tag className="h-3 w-3" />{a.tag}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        {a.photoUrl ? (
                          <div className="relative w-7 h-7 rounded overflow-hidden border border-slate-300 flex-shrink-0">
                            <Image src={a.photoUrl} alt={a.name} fill className="object-cover" sizes="28px" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Package className="h-3.5 w-3.5 text-slate-500" />
                          </div>
                        )}
                        <Link href={`/dashboard/assets/${a.id}`} className="hover:text-safety-orange hover:underline transition-colors">
                          {a.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={a.active ? 'badge-done' : 'badge-cancelled'}>
                        {a.active ? dict.assets.lblActive : dict.assets.lblInactive}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button onClick={() => setPrintQRAsset(a)} className="text-slate-600 hover:text-purple-700 p-1.5" aria-label="Imprimir QR Code">
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(a)} className="text-slate-600 hover:text-blue-700 p-1.5" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(a)} className="text-slate-600 hover:text-red-700 p-1.5" aria-label="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-[#2E86C1] transition-colors overflow-hidden bg-gray-50 dark:bg-slate-800 flex-shrink-0"
                  >
                    {photoPreview ? (
                      <Image src={photoPreview} alt="preview" width={80} height={80} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Camera className="h-6 w-6 text-gray-300 dark:text-slate-500" />
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 space-y-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#2E86C1] hover:underline font-medium block"
                    >
                      {photoPreview ? dict.assets.formChangePhoto : dict.assets.formUploadPhoto}
                    </button>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                        className="text-red-500 hover:underline text-xs flex items-center gap-1"
                      >
                        <ImageOff className="h-3 w-3" /> {dict.assets.formRemovePhoto}
                      </button>
                    )}
                    <p className="text-xs text-gray-400">JPG, PNG — máx. 5 MB</p>
                  </div>
                </div>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:p-0 print:bg-white bg-black/40 dark:bg-black/60 backdrop-blur-sm print:backdrop-blur-none">
          <div className="absolute inset-0" onClick={() => setPrintQRAsset(null)} />
          <div className="card relative w-full max-w-sm p-8 shadow-2xl bg-white dark:bg-slate-900 print:shadow-none print:border-none print:p-0 text-center">
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
          body > *:not(.fixed) { display: none !important; }
          .fixed { position: static !important; }
        }
      `}} />
    </div>
  )
}
