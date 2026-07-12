'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2, X, Wrench, CheckSquare, Square, Package, ShieldAlert, Camera, Images, CheckCircle2 } from 'lucide-react'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import type { Intervention, ChecklistItem, TaskStatus, Material } from '@/types/models'
import { formatDateTime, formatDuration } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import {
  createInterventionAction,
  deleteInterventionAction,
  createMaterialAction,
  deleteMaterialAction,
  startTaskAction,
} from './actions'

const MAX_PHOTOS = 5
const MAX_PHOTO_MB = 10

type Ref = { id: string; name: string }
type UserRef = Ref & { avatarUrl?: string | null }

type StockRef = {
  id: string
  name: string
  reference: string | null
  unit: string | null
  unitCost: number | null
  quantity: number
}

type InlineMaterial = {
  _key: string
  name: string
  reference: string
  quantity: string
  unit: string
  unitCost: string
  stockItemId: string | null
}

async function uploadPhotos(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => uploadImage(file, 'interventions')))
}

function emptyMaterial(): InlineMaterial {
  return { _key: crypto.randomUUID(), name: '', reference: '', quantity: '1', unit: '', unitCost: '', stockItemId: null }
}

function nowLocalDateTime(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
}

export default function TaskDetailClient({
  taskId,
  taskStatus,
  users,
  interventions,
  materialsByIntervention,
  safetyRules,
  stockItems,
}: {
  taskId: string
  taskStatus: TaskStatus
  users: UserRef[]
  interventions: Intervention[]
  materialsByIntervention: Record<string, Material[]>
  safetyRules?: string[] | null
  stockItems: StockRef[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [startBusy, setStartBusy] = useState(false)
  const [startError, setStartError] = useState('')

  const [items, setItems] = useState<ChecklistItem[]>([{ label: '', done: false }])
  const [markDone, setMarkDone] = useState(false)
  const [startedAtValue, setStartedAtValue] = useState('')
  const [endedAtValue, setEndedAtValue] = useState('')

  // Photos
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Inline materials in the modal
  const [inlineMats, setInlineMats] = useState<InlineMaterial[]>([])

  // Material form state per intervention (post-creation)
  const [matOpen, setMatOpen] = useState<string | null>(null)
  const [matBusy, setMatBusy] = useState(false)
  const [matError, setMatError] = useState('')

  const userName = (id?: string | null) => users.find((u) => u.id === id)?.name ?? '—'
  const userRef = (id?: string | null) => users.find((u) => u.id === id)

  function resetForm() {
    setItems([{ label: '', done: false }])
    setMarkDone(false)
    setError('')
    setPhotos([])
    setPhotoPreviews([])
    setInlineMats([])
    setStartedAtValue(nowLocalDateTime())
    setEndedAtValue('')
  }

  function toggleMarkDone(checked: boolean) {
    setMarkDone(checked)
    if (checked && !endedAtValue) setEndedAtValue(nowLocalDateTime())
  }

  // Abre já o registo de trabalho pronto a fechar a tarefa, quando se vem do
  // botão "Concluir" da listagem (o registo é que fecha a tarefa, não um toggle direto).
  useEffect(() => {
    if (searchParams.get('concluir') === '1') {
      resetForm()
      toggleMarkDone(true)
      setOpen(true)
      router.replace(`/dashboard/tasks/${taskId}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Checklist helpers
  function addItem() { setItems((prev) => [...prev, { label: '', done: false }]) }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)) }
  function updateLabel(i: number, label: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, label } : it)))
  }
  function toggleDone(i: number) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)))
  }

  // Photo helpers — comprime no cliente antes de guardar (tarefa 06)
  async function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const slots = MAX_PHOTOS - photos.length
    const selecionadas = files.slice(0, slots)

    const comprimidas: File[] = []
    let aindaGrande = false
    for (const f of selecionadas) {
      const c = await compressImage(f)
      // Se mesmo depois de comprimir excede o limite, ignora
      if (c.size > MAX_PHOTO_MB * 1024 * 1024) { aindaGrande = true; continue }
      comprimidas.push(c)
    }
    if (aindaGrande) {
      setError(`Algumas fotos continuam acima de ${MAX_PHOTO_MB} MB mesmo após compressão e foram ignoradas.`)
    }
    setPhotos((prev) => [...prev, ...comprimidas])
    setPhotoPreviews((prev) => [...prev, ...comprimidas.map((f) => URL.createObjectURL(f))])
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(photoPreviews[i])
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
    setPhotoPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Inline material helpers
  function addInlineMat() { setInlineMats((prev) => [...prev, emptyMaterial()]) }

  function updateInlineMat(key: string, patch: Partial<Omit<InlineMaterial, '_key'>>) {
    setInlineMats((prev) => prev.map((m) => m._key === key ? { ...m, ...patch } : m))
  }

  function removeInlineMat(key: string) {
    setInlineMats((prev) => prev.filter((m) => m._key !== key))
  }

  function selectStockItem(key: string, stockId: string) {
    const stock = stockItems.find((s) => s.id === stockId)
    if (!stock) {
      updateInlineMat(key, { stockItemId: null, name: '', reference: '', unit: '', unitCost: '' })
      return
    }
    updateInlineMat(key, {
      stockItemId: stock.id,
      name: stock.name,
      reference: stock.reference ?? '',
      unit: stock.unit ?? '',
      unitCost: stock.unitCost != null ? String(stock.unitCost) : '',
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    formData.set('taskId', taskId)
    formData.set('checklist', JSON.stringify(items.filter((i) => i.label.trim())))
    if (markDone) formData.set('taskStatus', 'done')

    // Serialize inline materials
    const validMats = inlineMats.filter((m) => m.name.trim())
    if (validMats.length > 0) {
      formData.set('inlineMaterials', JSON.stringify(
        validMats.map((m) => ({
          name: m.name.trim(),
          reference: m.reference.trim() || null,
          quantity: parseFloat(m.quantity) || 1,
          unit: m.unit.trim() || null,
          unitCost: parseFloat(m.unitCost) > 0 ? parseFloat(m.unitCost) : null,
          stockItemId: m.stockItemId || null,
        }))
      ))
    }

    let photosFailed = false
    if (photos.length > 0) {
      // As fotos NÃO bloqueiam o registo da intervenção: se o upload falhar,
      // a intervenção é guardada na mesma e o utilizador é avisado. (bug 08)
      try {
        const urls = await uploadPhotos(photos)
        formData.set('photoUrls', JSON.stringify(urls))
      } catch {
        photosFailed = true
      }
    }

    const result = await createInterventionAction({}, formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else if (photosFailed) {
      setError('Intervenção registada, mas as fotos não foram carregadas (serviço de imagens indisponível). Tenta adicioná-las mais tarde.')
      resetForm()
      router.refresh()
    }
    else { setOpen(false); resetForm(); router.refresh() }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar esta intervenção?')) return
    await deleteInterventionAction(taskId, id)
    router.refresh()
  }

  async function handleAddMaterial(e: React.FormEvent<HTMLFormElement>, interventionId: string) {
    e.preventDefault()
    setMatBusy(true)
    setMatError('')
    const formData = new FormData(e.currentTarget)
    const result = await createMaterialAction(interventionId, taskId, formData)
    setMatBusy(false)
    if (result.error) setMatError(result.error)
    else { setMatOpen(null); router.refresh() }
  }

  async function handleDeleteMaterial(materialId: string) {
    await deleteMaterialAction(materialId, taskId)
    router.refresh()
  }

  async function handleStart() {
    setStartBusy(true)
    setStartError('')
    const result = await startTaskAction(taskId)
    setStartBusy(false)
    if (result.error) setStartError(result.error)
    else router.refresh()
  }

  const isDone = taskStatus === 'done'
  const isPending = taskStatus === 'pending'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">Registos ({interventions.length})</h2>
        <div className="flex items-center gap-2">
          {isPending && (
            <button
              onClick={handleStart}
              disabled={startBusy}
              className="btn-secondary flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" /> {startBusy ? 'A iniciar…' : 'Iniciar'}
            </button>
          )}
          {!isDone && (
            <button
              onClick={() => { resetForm(); setOpen(true) }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Registar trabalho
            </button>
          )}
        </div>
      </div>
      {startError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700 mb-3">{startError}</div>
      )}

      {interventions.length === 0 ? (
        <div className="card px-5 py-10 text-center text-gray-400">
          <Wrench className="h-9 w-9 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Sem registos de trabalho para esta OT.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {interventions.map((iv) => {
            const mats = materialsByIntervention[iv.id] ?? []
            const showMatForm = matOpen === iv.id
            return (
              <div key={iv.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={userName(iv.technicianId)} avatarUrl={userRef(iv.technicianId)?.avatarUrl} size={20} />
                      <p className="font-medium text-gray-800">{userName(iv.technicianId)}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateTime(iv.startedAt ?? null)}
                      {iv.endedAt ? ` → ${formatDateTime(iv.endedAt)}` : ''}
                      {iv.startedAt && iv.endedAt ? ` · ${formatDuration(iv.startedAt, iv.endedAt)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(iv.id)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {iv.checklist.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {iv.checklist.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        {c.done
                          ? <CheckSquare className="h-4 w-4 text-green-600" />
                          : <Square className="h-4 w-4 text-gray-300" />}
                        <span className={c.done ? 'line-through text-gray-400' : ''}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {iv.observations && (
                  <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    {iv.observations}
                  </p>
                )}

                {iv.photoUrls && iv.photoUrls.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                      <Camera className="h-3.5 w-3.5" />
                      Fotos ({iv.photoUrls.length})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {iv.photoUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity flex-shrink-0"
                        >
                          <Image src={url} alt={`foto ${i + 1}`} fill className="object-cover" sizes="64px" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Materiais */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      Materiais {mats.length > 0 && `(${mats.length})`}
                    </span>
                    <button
                      onClick={() => { setMatOpen(showMatForm ? null : iv.id); setMatError('') }}
                      className="text-xs text-[#2E86C1] hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>

                  {mats.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {mats.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2.5 py-1.5"
                        >
                          <span>
                            <span className="font-medium">{m.name}</span>
                            {m.reference && <span className="text-gray-400 ml-1">({m.reference})</span>}
                            {' · '}
                            {m.quantity} {m.unit ?? 'un'}
                            {m.unitCost != null && (
                              <span className="text-gray-400 ml-1">· {(m.unitCost * m.quantity).toFixed(2)} €</span>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="text-gray-400 hover:text-red-600 ml-2"
                            aria-label="Remover material"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showMatForm && (
                    <form onSubmit={(e) => handleAddMaterial(e, iv.id)} className="space-y-2 mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input name="name" className="input text-sm" placeholder="Nome *" required />
                        <input name="reference" className="input text-sm" placeholder="Referência" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input name="quantity" type="number" min="0.01" step="any" defaultValue="1" className="input text-sm" placeholder="Qtd *" required />
                        <input name="unit" className="input text-sm" placeholder="Unidade" />
                        <input name="unitCost" type="number" min="0" step="0.01" className="input text-sm" placeholder="Custo/un (€)" />
                      </div>
                      {matError && <p className="text-xs text-red-600">{matError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setMatOpen(null)} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
                        <button type="submit" disabled={matBusy} className="btn-primary text-xs py-1.5 px-3">
                          {matBusy ? 'A guardar…' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de nova intervenção */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Registar trabalho</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {safetyRules && safetyRules.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                  <ShieldAlert className="h-4 w-4" />
                  Regras de segurança obrigatórias
                </p>
                <ul className="space-y-1">
                  {safetyRules.map((rule, i) => (
                    <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span className="font-bold mt-0.5">{i + 1}.</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Técnico</label>
                <select name="technicianId" className="input" defaultValue="">
                  <option value="">— Eu —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Início</label>
                  <input
                    type="datetime-local"
                    name="startedAt"
                    className="input"
                    value={startedAtValue}
                    onChange={(e) => setStartedAtValue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Fim</label>
                  <input
                    type="datetime-local"
                    name="endedAt"
                    className="input"
                    value={endedAtValue}
                    onChange={(e) => setEndedAtValue(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Checklist</label>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleDone(i)} className="text-gray-400 hover:text-green-600" aria-label="Concluído">
                        {it.done
                          ? <CheckSquare className="h-5 w-5 text-green-600" />
                          : <Square className="h-5 w-5" />}
                      </button>
                      <input
                        value={it.label}
                        onChange={(e) => updateLabel(i, e.target.value)}
                        className="input flex-1"
                        placeholder={`Ponto ${i + 1}`}
                      />
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-600 p-1" aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItem} className="mt-2 text-sm text-[#2E86C1] hover:underline flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar ponto
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
                <textarea name="observations" className="input" rows={3} placeholder="O que foi feito, peças, anomalias…" />
              </div>

              {/* Materiais inline */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Materiais utilizados {inlineMats.length > 0 && `(${inlineMats.length})`}
                  </label>
                  <button
                    type="button"
                    onClick={addInlineMat}
                    className="text-sm text-[#2E86C1] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>

                {inlineMats.length > 0 && (
                  <div className="space-y-3">
                    {inlineMats.map((m) => (
                      <div key={m._key} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                        {/* Stock picker */}
                        {stockItems.length > 0 && (
                          <select
                            className="input text-sm"
                            value={m.stockItemId ?? ''}
                            onChange={(e) => selectStockItem(m._key, e.target.value)}
                          >
                            <option value="">— Livre (sem stock) —</option>
                            {stockItems.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}{s.reference ? ` (${s.reference})` : ''} · {s.quantity} {s.unit ?? 'un'} disponíveis
                              </option>
                            ))}
                          </select>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className="input text-sm"
                            placeholder="Nome *"
                            value={m.name}
                            onChange={(e) => updateInlineMat(m._key, { name: e.target.value })}
                          />
                          <input
                            className="input text-sm"
                            placeholder="Referência"
                            value={m.reference}
                            onChange={(e) => updateInlineMat(m._key, { reference: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="input text-sm"
                            placeholder="Qtd *"
                            value={m.quantity}
                            onChange={(e) => updateInlineMat(m._key, { quantity: e.target.value })}
                          />
                          <input
                            className="input text-sm"
                            placeholder="Unidade"
                            value={m.unit}
                            onChange={(e) => updateInlineMat(m._key, { unit: e.target.value })}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input text-sm"
                            placeholder="€/un"
                            value={m.unitCost}
                            onChange={(e) => updateInlineMat(m._key, { unitCost: e.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInlineMat(m._key)}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fotos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fotos {photos.length > 0 && `(${photos.length}/${MAX_PHOTOS})`}
                </label>

                {photoPreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <Image src={src} alt={`foto ${i + 1}`} fill className="object-cover" sizes="64px" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                          aria-label="Remover foto"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {photos.length < MAX_PHOTOS && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-[#2E86C1] hover:text-[#2E86C1] transition-colors"
                    >
                      <Camera className="h-4 w-4" /> Câmera
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-[#2E86C1] hover:text-[#2E86C1] transition-colors"
                    >
                      <Images className="h-4 w-4" /> Galeria
                    </button>
                  </div>
                )}

                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoAdd} className="hidden" />
                <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handlePhotoAdd} className="hidden" />
                <p className="text-xs text-gray-400 mt-1.5">Máx. {MAX_PHOTOS} fotos · {MAX_PHOTO_MB} MB cada</p>
              </div>

              {/* Fechar OT — secção destacada */}
              <div className={`rounded-xl border-2 p-4 transition-colors ${markDone ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markDone}
                    onChange={(e) => toggleMarkDone(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-green-600"
                  />
                  <div>
                    <p className={`text-sm font-semibold ${markDone ? 'text-green-800' : 'text-gray-700'}`}>
                      <CheckCircle2 className={`inline h-4 w-4 mr-1 ${markDone ? 'text-green-600' : 'text-gray-400'}`} />
                      Fechar OT
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Marca a OT como concluída. Pode ser reaberta pelo gestor se necessário.
                    </p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={busy} className={`flex-1 font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors ${markDone ? 'bg-green-600 hover:bg-green-700 text-white' : 'btn-primary'}`}>
                  {busy
                    ? (photos.length > 0 ? 'A carregar fotos…' : 'A guardar…')
                    : markDone ? 'Guardar e Fechar OT' : 'Guardar registo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
