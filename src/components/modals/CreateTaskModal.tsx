'use client'

import React, { useState, useEffect, useRef, useId } from 'react'
import Image from 'next/image'
import {
  X, ShieldAlert, Camera, Plus, Trash2, MapPin, Tag, Wrench
} from 'lucide-react'
import type { Task, TaskCriticidade, TipoTarefa, User, Asset, Periodicidade } from '@/types/models'
import { TIPO_LABELS, CRITICIDADE_LABELS, STATUS_LABELS } from '@/types/models'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import SearchableAssetSelect from '@/components/ui/SearchableAssetSelect'
import MaterialsSelector from '@/components/ui/MaterialsSelector'
import { TaskDocPickerManager } from '@/components/ui/TaskDocRequirements'
import { createTaskAction, type StockMaterialRef } from '@/app/dashboard/tasks/actions'

export const PREDEFINED_SAFETY_RULES = [
  'EPI: Capacete',
  'EPI: Luvas de proteção',
  'EPI: Óculos de proteção',
  'EPI: Botas de segurança',
  'EPI: Arnês de segurança',
  'EPI: Colete refletor',
  'EPI: Proteção auricular',
  'EPI: Máscara respiratória',
  'Desligar energia (Lockout/Tagout)',
  'Ventilar o espaço confinado',
  'Sinalizar a zona de trabalho',
  'Verificar ausência de tensão',
  'Trabalho a quente - ter extintor próximo',
  'Manter área limpa e livre de obstáculos'
]

function isInternalUser(u: any): boolean {
  if (!u || u.active === false) return false
  if (u.isExternal === true || u.isExternal === 'true') return false
  if (u.role === 'external') return false
  if (u.externalCompanyName && u.externalCompanyName.trim()) return false
  if (u.externalCompanyId && u.externalCompanyId.trim()) return false
  const n = (u.name || '').toLowerCase()
  const e = (u.email || '').toLowerCase()
  const a = (u.abbreviation || '').toLowerCase()
  const id = (u.id || '').toLowerCase()
  if (n.includes('carrier') || e.includes('carrier') || a.includes('carrier') || id.includes('carrier')) return false
  if (n.includes('schindler') || e.includes('schindler') || a.includes('schindler') || id.includes('schindler')) return false
  if (n.includes('ox2') || e.includes('ox2') || a.includes('ox2') || id.includes('ox2')) return false
  if (n.includes('block') || e.includes('block') || a.includes('block') || id.includes('block')) return false
  if (n.includes('heleno') || e.includes('heleno') || a.includes('heleno') || id.includes('heleno')) return false
  if (n.includes('prestador') || n.includes('externo')) return false
  return true
}

function DynamicList({
  label,
  icon: Icon,
  items,
  onChange,
  placeholder,
  addLabel,
  suggestions,
}: {
  label: string
  icon: React.ElementType
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
  suggestions?: string[]
}) {
  const datalistId = useId()
  const update = (index: number, val: string) => {
    const next = [...items]
    next[index] = val
    onChange(next)
  }
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }
  const add = () => {
    onChange([...items, ''])
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-safety-orange" />}
          {label}
        </label>
      )}
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={val}
              onChange={(e) => update(i, e.target.value)}
              className="input flex-1 text-xs"
              placeholder={placeholder}
              list={suggestions ? datalistId : undefined}
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {suggestions && (
        <datalist id={datalistId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-1 text-xs font-bold text-safety-orange hover:text-safety-orange/80 transition-colors flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  )
}

export interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  initialAssetId?: string | null
  assets: any[]
  users: any[]
  stockRefs?: StockMaterialRef[]
  isManager?: boolean
  onSuccess?: (newTask?: Task) => void
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  initialAssetId = '',
  assets,
  users,
  stockRefs = [],
  isManager = true,
  onSuccess,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [tipo, setTipo] = useState<TipoTarefa>('preventiva')
  const [criticidade, setCriticidade] = useState<TaskCriticidade>('verde')
  const [assetId, setAssetId] = useState(initialAssetId || '')
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])
  const [plannedStartDate, setPlannedStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'done' | 'cancelled'>('pending')
  const [safetyRules, setSafetyRules] = useState<string[]>([])
  const [materialsRequired, setMaterialsRequired] = useState<string[]>([])
  const [requiredFRs, setRequiredFRs] = useState<string[]>([])
  const [requiredITs, setRequiredITs] = useState<string[]>([])
  const [addToPmModal, setAddToPmModal] = useState(false)
  const [periodicidadeModal, setPeriodicidadeModal] = useState<string>('mensal')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (initialAssetId) setAssetId(initialAssetId)
    } else {
      // Reset form on close
      setTitle('')
      setTipo('preventiva')
      setCriticidade('verde')
      setAssetId(initialAssetId || '')
      setSelectedTechIds([])
      setPlannedStartDate('')
      setDueDate('')
      setDescription('')
      setObservacoes('')
      setStatus('pending')
      setSafetyRules([])
      setMaterialsRequired([])
      setRequiredFRs([])
      setRequiredITs([])
      setPhotoFile(null)
      setPhotoPreview(null)
      setAddToPmModal(false)
      setPeriodicidadeModal('mensal')
      setError('')
      setBusy(false)
    }
  }, [isOpen, initialAssetId])

  if (!isOpen) return null

  const selectedAsset = assets.find((a) => a.id === assetId)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhotoFile(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) {
      setError('O título da OT é obrigatório.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const formData = new FormData(e.currentTarget)
      if (!formData.get('assetId')) formData.set('assetId', assetId)

      if (photoFile) {
        try {
          const url = await uploadImage(photoFile, 'tasks')
          formData.set('photoUrl', url)
        } catch (err) {
          console.error('Erro no upload de foto da OT:', err)
        }
      }

      formData.set('safetyRules', JSON.stringify(safetyRules.filter(Boolean)))
      formData.set('materialsRequired', JSON.stringify(materialsRequired.filter(Boolean)))
      formData.set('requiredFRs', JSON.stringify(requiredFRs.filter(Boolean)))
      formData.set('requiredITs', JSON.stringify(requiredITs.filter(Boolean)))
      formData.set('assignedToIds', JSON.stringify(selectedTechIds))
      formData.set('addToMaintenancePlan', addToPmModal ? 'true' : 'false')
      formData.set('periodicidade', periodicidadeModal)

      const result = await createTaskAction({}, formData)
      setBusy(false)

      if (result.error) {
        setError(result.error)
      } else {
        const newTask: Task = {
          id: 'ot_' + Date.now(),
          companyId: selectedAsset?.companyId || '',
          title,
          description: description || null,
          assetId: assetId || null,
          tag: selectedAsset?.tag || assetId || null,
          area: selectedAsset?.area || 'Geral',
          criticidade,
          tipo,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'eu',
          createdByName: 'Eu',
          assignedTo: selectedTechIds
            .map((id) => {
              const u = users.find((usr) => usr.id === id || usr.abbreviation === id)
              return u ? (u.abbreviation || u.name) : id
            })
            .join(', '),
          assignedToIds: selectedTechIds,
          dueDate: dueDate || null,
          plannedStartDate: plannedStartDate || null,
          observacoes: observacoes || null,
          safetyRules: safetyRules.filter(Boolean).length ? safetyRules.filter(Boolean) : null,
          materialsRequired: materialsRequired.filter(Boolean).length ? materialsRequired.filter(Boolean) : null,
          requiredFRs: requiredFRs.filter(Boolean).length ? requiredFRs.filter(Boolean) : null,
          requiredITs: requiredITs.filter(Boolean).length ? requiredITs.filter(Boolean) : null,
          photoUrl: photoPreview,
        }

        if (onSuccess) onSuccess(newTask)
        onClose()
      }
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Erro ao guardar OT.')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-4 sm:pt-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative w-full max-w-xl p-6 shadow-2xl my-auto sm:my-4 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <span>Nova OT</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Título *</label>
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              required
              placeholder="Ex.: Lubrificação mensal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Tipo de OT *</label>
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoTarefa)}
                className="input"
              >
                <option value="preventiva">MP (Manutenção Preventiva)</option>
                <option value="curativa">MC (Manutenção Curativa)</option>
                <option value="inspecao">Inspeção</option>
                <option value="lubrificacao">Lubrificação</option>
                <option value="calibracao">Calibração</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Criticidade *</label>
              <select
                name="criticidade"
                value={criticidade}
                onChange={(e) => setCriticidade(e.target.value as TaskCriticidade)}
                className="input"
              >
                <option value="verde">Baixa / Normal (Verde)</option>
                <option value="amarelo">Média (Amarelo)</option>
                <option value="vermelho">Alta / Urgente (Vermelho)</option>
              </select>
            </div>
          </div>

          <div>
            <SearchableAssetSelect
              value={assetId}
              onChange={(val) => setAssetId(val)}
              assets={assets}
              required
            />
            {selectedAsset && (
              <>
                <input type="hidden" name="tag" value={selectedAsset.tag ?? ''} />
                <input type="hidden" name="area" value={selectedAsset.area ?? ''} />
              </>
            )}
          </div>

          {/* NOVO CAMPO: Foto da Avaria / Equipamento */}
          <div className="space-y-1.5 bg-purple-50/50 dark:bg-slate-900/60 p-3 rounded-xl border border-purple-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-purple-600 shrink-0" />
              Foto da Avaria / Equipamento (Opcional)
            </label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-purple-200 dark:border-slate-700 shrink-0 shadow-sm">
                  <Image src={photoPreview} alt="Preview" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-2 border-2 border-dashed border-purple-300 dark:border-slate-700 hover:border-purple-500 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2 transition-all hover:bg-purple-100/50"
                >
                  <Camera className="h-4 w-4 text-purple-600" /> Tirar / Carregar Foto
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
              Técnico(s) Atribuído(s) ({selectedTechIds.length})
            </label>

            {/* TÉCNICOS INTERNOS ATIVOS */}
            <div>
              <div className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>🟧</span> TÉCNICOS INTERNOS ATIVOS
              </div>
              <div className="max-h-32 overflow-y-auto border border-orange-200 dark:border-slate-700 rounded-lg p-2 bg-orange-50/30 dark:bg-slate-900/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {users
                    .filter((u: any) => u.active !== false && isInternalUser(u))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
                    .map((u) => {
                      const checked = selectedTechIds.includes(u.id) || (u.abbreviation ? selectedTechIds.includes(u.abbreviation) : false)
                      return (
                        <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-200 cursor-pointer hover:bg-orange-100/50 dark:hover:bg-slate-800 p-1 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTechIds((prev) => [...prev, u.id])
                              } else {
                                setSelectedTechIds((prev) => prev.filter((id) => id !== u.id && id !== u.abbreviation))
                              }
                            }}
                            className="rounded accent-orange-600 h-3.5 w-3.5"
                          />
                          <span className="truncate">{(u as any).abbreviation ? `[${(u as any).abbreviation}] ` : ''}{u.name}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            </div>

            {/* EMPRESAS EXTERNAS / PRESTADORES */}
            <div>
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>🟦</span> EMPRESAS EXTERNAS / PRESTADORES
              </div>
              <div className="max-h-32 overflow-y-auto border border-blue-200 dark:border-slate-700 rounded-lg p-2 bg-blue-50/30 dark:bg-slate-900/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {users
                    .filter((u: any) => u.active !== false && !isInternalUser(u))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
                    .map((u) => {
                      const checked = selectedTechIds.includes(u.id) || (u.abbreviation ? selectedTechIds.includes(u.abbreviation) : false)
                      const compName = (u as any).externalCompanyName || (u as any).company || 'Empresa Externa'
                      const abbrText = (u as any).abbreviation ? `[${(u as any).abbreviation}] ` : ''
                      const labelText = u.name.toLowerCase().includes(compName.toLowerCase()) ? `${abbrText}${u.name}` : `${abbrText}${u.name} (${compName})`
                      return (
                        <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-200 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-slate-800 p-1 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTechIds((prev) => [...prev, u.id])
                              } else {
                                setSelectedTechIds((prev) => prev.filter((id) => id !== u.id && id !== u.abbreviation))
                              }
                            }}
                            className="rounded accent-blue-600 h-3.5 w-3.5"
                          />
                          <span className="truncate" title={labelText}>{labelText}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Data Planeada de Início</label>
              <input
                type="datetime-local"
                name="plannedStartDate"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Prazo / Conclusão</label>
              <input
                type="date"
                name="dueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição da Intervenção</label>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={2}
              placeholder="Descreva os trabalhos a realizar..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Observações Adicionais</label>
            <textarea
              name="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="input"
              rows={2}
              placeholder="Instruções específicas ou notas sobre a intervenção..."
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Estado</label>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="input"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Regras de segurança */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Regras de Segurança</span>
              <a href="/dashboard/safety-rules" target="_blank" className="text-[11px] font-bold text-safety-orange hover:underline">
                Gerir Itens de Segurança ↗
              </a>
            </div>
            <DynamicList
              label=""
              icon={ShieldAlert}
              items={safetyRules}
              onChange={setSafetyRules}
              placeholder="Ex.: Usar EPI, desligar máquina antes…"
              addLabel="Adicionar regra"
              suggestions={PREDEFINED_SAFETY_RULES}
            />
          </div>

          {/* Materiais / Peças a Utilizar */}
          <MaterialsSelector
            items={materialsRequired}
            onChange={setMaterialsRequired}
            stockRefs={stockRefs}
          />

          {/* Incluir no PM e Periodicidade */}
          <div className="bg-amber-50/60 dark:bg-amber-900/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-900 dark:text-amber-300">
              <input
                type="checkbox"
                checked={addToPmModal}
                onChange={(e) => setAddToPmModal(e.target.checked)}
                className="rounded accent-amber-600 h-4 w-4"
              />
              <span>⚙️ Criar / Incluir no Plano de Manutenção Preventiva (PM)</span>
            </label>
            {addToPmModal && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Periodicidade do PM *
                </label>
                <select
                  value={periodicidadeModal}
                  onChange={(e) => setPeriodicidadeModal(e.target.value)}
                  className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700"
                >
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                  <option value="bimensal">Bimensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="quadrimestral">Quadrimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            )}
          </div>

          {isManager && (
            <TaskDocPickerManager
              selectedFRs={requiredFRs}
              selectedITs={requiredITs}
              onChangeFRs={setRequiredFRs}
              onChangeITs={setRequiredITs}
            />
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? 'A guardar…' : 'Guardar OT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
