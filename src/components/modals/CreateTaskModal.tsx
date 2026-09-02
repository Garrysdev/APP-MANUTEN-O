'use client'

import React, { useState, useEffect, useRef, useId } from 'react'
import Image from 'next/image'
import {
  X, ShieldAlert, Camera, Images, Plus, Trash2, MapPin, Tag, Wrench, Mail, ArrowLeft, FolderKanban
} from 'lucide-react'
import type { Task, TaskCriticidade, TipoTarefa, User, Asset, Periodicidade } from '@/types/models'
import { TIPO_LABELS, CRITICIDADE_LABELS, STATUS_LABELS } from '@/types/models'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import { formatDate, formatDateTime } from '@/lib/utils'
import SearchableAssetSelect from '@/components/ui/SearchableAssetSelect'
import MaterialsSelector from '@/components/ui/MaterialsSelector'
import { TaskDocPickerManager } from '@/components/ui/TaskDocRequirements'
import { createTaskAction, updateTaskAction, loadSafetyRulesAction, type StockMaterialRef } from '@/app/dashboard/tasks/actions'

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
  titleText?: string
  editingTask?: Task | any | null
  initialAssetId?: string | null
  assets: any[]
  users: any[]
  stockRefs?: StockMaterialRef[]
  isManager?: boolean
  onSuccess?: (newTask?: Task) => void
  createAction?: (prevState: any, formData: FormData) => Promise<any>
  updateAction?: (prevState: any, formData: FormData) => Promise<any>
  availableTasksForDependencies?: Task[]
  showDependencies?: boolean
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  titleText,
  editingTask = null,
  initialAssetId = '',
  assets,
  users,
  stockRefs = [],
  isManager = true,
  onSuccess,
  createAction,
  updateAction,
  availableTasksForDependencies,
  showDependencies = false,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [tipo, setTipo] = useState<TipoTarefa>('preventiva')
  const [criticidade, setCriticidade] = useState<TaskCriticidade>('verde')
  const [assetId, setAssetId] = useState(initialAssetId || '')
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])
  const [plannedStartDate, setPlannedStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const [description, setDescription] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'done' | 'cancelled'>('pending')
  const [executor, setExecutor] = useState<string>('interno')
  const [legal, setLegal] = useState<boolean>(false)
  const [safetyRules, setSafetyRules] = useState<string[]>([])
  const [dynamicSafetyRules, setDynamicSafetyRules] = useState<string[]>(PREDEFINED_SAFETY_RULES)
  const [materialsRequired, setMaterialsRequired] = useState<string[]>([])
  const [requiredFRs, setRequiredFRs] = useState<string[]>([])
  const [requiredITs, setRequiredITs] = useState<string[]>([])
  const [dependsOn, setDependsOn] = useState<string[]>([])
  const [addToPmModal, setAddToPmModal] = useState(false)
  const [periodicidadeModal, setPeriodicidadeModal] = useState<string>('mensal')

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [requesterEmail, setRequesterEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadSafetyRulesAction().then((rules) => {
        if (rules && rules.length > 0) {
          const combined = Array.from(new Set([...rules, ...PREDEFINED_SAFETY_RULES]))
          setDynamicSafetyRules(combined)
        }
      }).catch(() => {})

      if (editingTask) {
        setTitle(editingTask.title || '')
        setTipo(editingTask.tipo || 'preventiva')
        setCriticidade(editingTask.criticidade || 'verde')
        setAssetId(editingTask.assetId || editingTask.tag || initialAssetId || '')
        const techIds = (editingTask.assignedToIds && editingTask.assignedToIds.length > 0)
          ? editingTask.assignedToIds
          : (editingTask.assignedTo ? [editingTask.assignedTo] : [])
        setSelectedTechIds(techIds)
        let formattedStart = ''
        if (editingTask.plannedStartDate) {
          formattedStart = editingTask.plannedStartDate.slice(0, 16)
          if (!formattedStart.includes('T') && formattedStart.length === 10) {
            formattedStart = `${formattedStart}T09:00`
          }
        }
        setPlannedStartDate(formattedStart)
        setDueDate(editingTask.dueDate ? editingTask.dueDate.slice(0, 10) : '')
        setStartedAt(editingTask.startedAt ? editingTask.startedAt.slice(0, 16) : '')
        setCompletedAt(editingTask.completedAt ? editingTask.completedAt.slice(0, 16) : '')
        setDescription(editingTask.description || '')
        setObservacoes(editingTask.observacoes || editingTask.observations || '')
        setStatus(editingTask.status || 'pending')
        setExecutor(editingTask.executor || 'interno')
        setLegal(Boolean(editingTask.legal || editingTask.inspecaoLegal))
        setSafetyRules(editingTask.safetyRules?.length ? editingTask.safetyRules : [])
        setMaterialsRequired(editingTask.materialsRequired?.length ? editingTask.materialsRequired : [])
        setRequiredFRs(editingTask.requiredFRs || [])
        setRequiredITs(editingTask.requiredITs || [])
        setDependsOn(Array.isArray(editingTask.dependsOn) ? (editingTask.dependsOn as string[]) : [])
        setRequesterEmail(editingTask.requesterEmail || '')
        setPhotoPreview(editingTask.photoUrl || (editingTask.photoUrls && editingTask.photoUrls[0]) || null)
        setPeriodicidadeModal(editingTask.periodicidade || 'mensal')
      } else {
        if (initialAssetId) setAssetId(initialAssetId)
        setDependsOn([])
      }
    } else {
      // Reset form on close
      setTitle('')
      setTipo('preventiva')
      setCriticidade('verde')
      setAssetId(initialAssetId || '')
      setSelectedTechIds([])
      setPlannedStartDate('')
      setDueDate('')
      setStartedAt('')
      setCompletedAt('')
      setDescription('')
      setObservacoes('')
      setRequesterEmail('')
      setStatus('pending')
      setExecutor('interno')
      setLegal(false)
      setSafetyRules([])
      setMaterialsRequired([])
      setRequiredFRs([])
      setRequiredITs([])
      setDependsOn([])
      setPhotoFile(null)
      setPhotoPreview(null)
      setAddToPmModal(false)
      setPeriodicidadeModal('mensal')
      setError('')
      setBusy(false)
    }
  }, [isOpen, initialAssetId, editingTask])

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
      setError('⚠️ O Título / Descrição da Avaria é um campo obrigatório (*). Por favor preencha o título antes de guardar.')
      return
    }
    if (!assetId.trim()) {
      setError('⚠️ A Seleção do Equipamento / TAG é um campo obrigatório (*). Por favor selecione a Área e a TAG do equipamento.')
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
      formData.set('dependsOn', JSON.stringify(dependsOn.filter(Boolean)))
      formData.set('assignedToIds', JSON.stringify(selectedTechIds))
      formData.set('addToMaintenancePlan', addToPmModal ? 'true' : 'false')
      formData.set('periodicidade', periodicidadeModal)
      formData.set('requesterEmail', requesterEmail.trim())
      if (!dueDate.trim() && (status === 'done' || status === 'cancelled' || editingTask?.status === 'done' || editingTask?.status === 'cancelled')) {
        formData.set('status', 'pending')
      } else {
        formData.set('status', status)
      }

      if (editingTask) {
        formData.set('id', editingTask.id)
      }

      const submitAction = editingTask
        ? (updateAction || updateTaskAction)
        : (createAction || createTaskAction)

      const result = await submitAction({}, formData)

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
          requesterEmail: requesterEmail.trim() || null,
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
          startedAt: startedAt || null,
          completedAt: completedAt || null,
          observacoes: observacoes || null,
          safetyRules: safetyRules.filter(Boolean).length ? safetyRules.filter(Boolean) : null,
          materialsRequired: materialsRequired.filter(Boolean).length ? materialsRequired.filter(Boolean) : null,
          requiredFRs: requiredFRs.filter(Boolean).length ? requiredFRs.filter(Boolean) : null,
          requiredITs: requiredITs.filter(Boolean).length ? requiredITs.filter(Boolean) : null,
          dependsOn: dependsOn.length ? dependsOn : null,
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
    <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-slate-950 overflow-y-auto flex flex-col">
      {/* Sticky Header de Página Completa */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{titleText || (editingTask ? 'Editar OT' : 'Nova Ordem de Trabalho')}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Ficha completa de registo de OT
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Conteúdo Principal de Página Completa */}
      <div className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-8 space-y-6 pb-28">
        <form onSubmit={handleSubmit} className="card p-6 shadow-xl space-y-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
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
                <option value="pm">PM (Plano de Manutenção)</option>
                <option value="curativa">MC (Manutenção Curativa)</option>
                <option value="preventiva">MP (Manutenção Preventiva / Preditiva)</option>
                <option value="pi">PI (Pedido de Intervenção)</option>
                <option value="mi">MI (Melhoria / Investimento)</option>
                <option value="stp">STP (STOP-PARAGEM)</option>
                <option value="inspecao">INS (Inspeção)</option>
                <option value="lubrificacao">LUB (Lubrificação)</option>
                <option value="calibracao">CAL (Calibração)</option>
                <option value="projeto">PR (Projeto)</option>
                <option value="outro">OUT (Outro)</option>
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

          {/* Periodicidade & Executor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Periodicidade</label>
              <select
                name="periodicidade"
                value={periodicidadeModal}
                onChange={(e) => setPeriodicidadeModal(e.target.value)}
                className="input"
              >
                <option value="pontual">Pontual / Uma vez</option>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Executor</label>
              <select
                name="executor"
                value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                className="input"
              >
                <option value="interno">Interno (RG / Equipa Própria)</option>
                <option value="externo">Prestador Externo</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Inspeção Legal / Obrigatória */}
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer select-none bg-slate-100/70 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              name="legal"
              checked={legal}
              onChange={(e) => setLegal(e.target.checked)}
              className="rounded accent-red-600 h-4 w-4"
            />
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              ⚖️ Inspeção legal / obrigatória (Regulamentação Oficial)
            </span>
          </label>

          {/* Email do Requerente / Solicitante (PI) */}
          <div className="bg-sky-50/60 dark:bg-sky-950/20 p-3.5 rounded-xl border border-sky-200 dark:border-sky-800/50 space-y-1.5">
            <label className="block text-xs font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              Email do Requerente / Solicitante (Pedido de Intervenção - PI)
            </label>
            <input
              type="email"
              name="requesterEmail"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              className="input text-xs bg-white dark:bg-slate-900 border-sky-300 dark:border-sky-700"
              placeholder="Ex.: requerente@empresa.pt"
            />
            <p className="text-[11px] text-sky-700 dark:text-sky-400">
              💡 Ao fechar esta OT, poderá enviar a resposta do relatório de fecho para este e-mail.
            </p>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Data Planeada</label>
              <input
                type="datetime-local"
                name="plannedStartDate"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Prazo</label>
              <input
                type="date"
                name="dueDate"
                value={dueDate}
                onChange={(e) => {
                  const val = e.target.value
                  setDueDate(val)
                  if (!val.trim() && (status === 'done' || status === 'cancelled' || editingTask?.status === 'done' || editingTask?.status === 'cancelled')) {
                    setStatus('pending')
                  }
                }}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Data de Início (real)</label>
              <input
                type="datetime-local"
                name="startedAt"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Data de Fim (real)</label>
              <input
                type="datetime-local"
                name="completedAt"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Seletor de Dependências Finish-to-Start (Visível quando showDependencies ou há tarefas disponíveis) */}
          {(showDependencies || (availableTasksForDependencies && availableTasksForDependencies.length > 0)) && (
            <div className="space-y-2 bg-indigo-50/60 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5">
                  <FolderKanban className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Depende de (só pode começar depois destas terminarem)
                </label>
                {dependsOn.length > 0 && (
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                    {dependsOn.length} selecionada{dependsOn.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-indigo-800/80 dark:text-indigo-400">
                Selecione as tarefas antecessoras (Finish-to-Start). Ao reagendar a antecessora, esta OT desloca-se automaticamente.
              </p>

              <div className="max-h-36 overflow-y-auto border border-indigo-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900 space-y-1">
                {availableTasksForDependencies
                  ?.filter((t) => t.id !== editingTask?.id)
                  .map((t) => {
                    const isSelected = dependsOn.includes(t.id)
                    const createsCycle = Boolean(editingTask?.id && t.dependsOn && Array.isArray(t.dependsOn) && t.dependsOn.includes(editingTask.id))
                    const tag = (t as any).tag || ''
                    const label = tag ? `[${tag}] ${t.title}` : t.title

                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2 text-xs p-1.5 rounded transition-colors ${
                          createsCycle
                            ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-800'
                            : isSelected
                            ? 'bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-950 dark:text-indigo-100 cursor-pointer font-semibold'
                            : 'hover:bg-indigo-50/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer'
                        }`}
                        title={createsCycle ? 'Dependência circular não permitida (esta tarefa já depende da atual)' : label}
                      >
                        <input
                          type="checkbox"
                          disabled={createsCycle}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDependsOn((prev) => [...prev, t.id])
                            } else {
                              setDependsOn((prev) => prev.filter((id) => id !== t.id))
                            }
                          }}
                          className="rounded accent-indigo-600 h-3.5 w-3.5 shrink-0"
                        />
                        <span className="truncate flex-1 font-mono text-[11px]">{label}</span>
                        {t.dueDate && (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            (Fim: {t.dueDate.slice(0, 10)})
                          </span>
                        )}
                      </label>
                    )
                  })}
                {(!availableTasksForDependencies || availableTasksForDependencies.filter((t) => t.id !== editingTask?.id).length === 0) && (
                  <div className="text-xs text-slate-400 text-center py-2">
                    Sem outras tarefas disponíveis para dependência.
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Fotos da Avaria / Equipamento */}
          <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Foto da Avaria / Equipamento (Opcional)
            </label>
            
            {photoPreview ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-purple-500 shrink-0 shadow-md">
                <Image src={photoPreview} alt="Preview da Foto" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full hover:bg-red-600 transition-colors cursor-pointer"
                  title="Remover foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3.5 py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2 transition-all hover:bg-purple-50/60 dark:hover:bg-purple-900/30 cursor-pointer"
                >
                  <Camera className="h-4 w-4 text-purple-600" /> Tirar Foto (Câmera)
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3.5 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-all hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer"
                >
                  <Images className="h-4 w-4 text-slate-500" /> Carregar (Galeria)
                </button>
              </div>
            )}

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          {/* Regras de segurança */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Regras de Segurança</span>
              {isManager && (
                <a href="/dashboard/safety-rules" target="_blank" className="text-[11px] font-bold text-safety-orange hover:underline">
                  Gerir Itens de Segurança ↗
                </a>
              )}
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
            isManager={isManager}
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

          {/* SECÇÃO REGISTO ERP & AUDITORIA */}
          {editingTask && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <Wrench className="h-4 w-4 text-industrial-blue dark:text-sky-400" />
                  Registo ERP & Auditoria (Histórico de Alterações)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-medium">
                <div>
                  <span className="text-slate-500 block text-[10px]">👤 Criado por:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {editingTask.createdByName || editingTask.createdBy || 'Sistema (Excel)'}
                    {editingTask.createdByAbbr ? ` (${editingTask.createdByAbbr})` : ''}
                  </strong>
                  <span className="text-slate-500 text-[10px] block font-mono">
                    {formatDateTime(editingTask.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">✏️ Última Alteração por:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {editingTask.updatedByName || editingTask.updatedBy || editingTask.createdByName || 'Sistema'}
                    {editingTask.updatedByAbbr ? ` (${editingTask.updatedByAbbr})` : ''}
                  </strong>
                  <span className="text-slate-500 text-[10px] block font-mono">
                    {formatDateTime(editingTask.updatedAt || editingTask.createdAt)}
                  </span>
                </div>
              </div>

              {editingTask.auditTrail && editingTask.auditTrail.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Linha do Tempo de Auditoria:</span>
                  {editingTask.auditTrail.map((entry: any, i: number) => (
                    <div key={i} className="text-[11px] p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-0.5 shadow-xs">
                      <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span>{entry.action}</span>
                        <span className="font-mono text-[10px] text-slate-500">{formatDateTime(entry.timestamp)}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Utilizador: <strong>{entry.userName}{entry.userAbbr ? ` (${entry.userAbbr})` : ''}</strong>
                      </div>
                      {entry.details && <div className="text-[10px] text-slate-500 font-mono italic">{entry.details}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action bar no fundo do formulário */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3 text-sm font-bold">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 py-3 text-sm font-bold shadow-lg">
              {busy ? 'A guardar…' : 'Guardar Nova OT'}
            </button>
          </div>
        </form>
      </div>

      {/* Barra Inferior Fixa para Dispositivos Móveis */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 flex gap-3 shadow-2xl z-40 sm:hidden">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-xs font-bold">
          Cancelar
        </button>
        <button type="button" onClick={(e) => {
          const form = document.querySelector('form')
          if (form) form.requestSubmit()
        }} disabled={busy} className="btn-primary flex-1 py-2.5 text-xs font-bold shadow-md">
          {busy ? 'A guardar…' : 'Guardar Nova OT'}
        </button>
      </div>
    </div>
  )
}
