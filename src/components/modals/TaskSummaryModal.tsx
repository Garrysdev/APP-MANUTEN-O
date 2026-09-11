'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  X, Play, CheckCircle2, RotateCcw, Clock, ShieldAlert,
  Camera, Image as ImageIcon, FileText, CheckSquare, Square,
  Save, ExternalLink, Wrench
} from 'lucide-react'
import type { Task, TaskStatus } from '@/types/models'
import { STATUS_LABELS, CRITICIDADE_LABELS } from '@/types/models'
import { formatDate } from '@/lib/utils'
import { TipoBadge } from '@/components/ui/TipoBadge'
import { format3DigitId } from '@/app/dashboard/history/HistoryClient'
import { updateTaskStatusAction, updateTaskExecutionDetailsAction } from '@/app/dashboard/tasks/actions'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'

const DEFAULT_SAFETY_RULES = [
  'EPIs obrigatórios (Botas, Luvas, Óculos)',
  'Corte e bloqueio de energia (LOTO)',
  'Sinalização e isolamento da zona de trabalho',
  'Verificação de ausência de tensão e pressão'
]

export default function TaskSummaryModal({
  task,
  onClose,
  onStatusChanged,
  onOpenFullEdit,
  isManager,
  resolveTechInitials,
  resolveTechLabel,
  assetTag,
  assetName,
  area,
}: {
  task: Task
  onClose: () => void
  onStatusChanged: (taskId: string, newStatus: TaskStatus) => void
  onOpenFullEdit?: (task: Task) => void
  isManager: boolean
  resolveTechInitials: (id?: string | null) => string
  resolveTechLabel: (id?: string | null) => string
  assetTag?: string
  assetName?: string
  area?: string
}) {
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [observacoes, setObservacoes] = useState(task.observacoes || '')
  const [savingObs, setSavingObs] = useState(false)
  const [obsSaved, setObsSaved] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  // Checklist de Regras de Segurança
  const rules = (task.safetyRules && task.safetyRules.length > 0)
    ? task.safetyRules
    : DEFAULT_SAFETY_RULES

  const [checkedRules, setCheckedRules] = useState<string[]>(() => {
    if ((task as any).safetyRulesChecked && Array.isArray((task as any).safetyRulesChecked)) {
      return (task as any).safetyRulesChecked
    }
    return []
  })

  // Folhas de Registo e Instruções de Trabalho
  const frList = task.requiredFRs || []
  const itList = task.requiredITs || []
  const [checkedFRs, setCheckedFRs] = useState<string[]>(() => {
    if ((task as any).frsChecked && Array.isArray((task as any).frsChecked)) {
      return (task as any).frsChecked
    }
    return []
  })

  // Fotos
  const existingPhotos = Array.isArray((task as any).photos)
    ? (task as any).photos
    : (task.photoUrl ? [task.photoUrl] : [])
  const [photos, setPhotos] = useState<string[]>(existingPhotos)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formattedId = format3DigitId(task.id, 0)

  const ids = (task.assignedToIds && task.assignedToIds.length > 0)
    ? task.assignedToIds
    : (task.assignedTo ? [task.assignedTo] : [])

  async function handleToggleStatus(newStatus: TaskStatus) {
    setChangingStatus(true)
    try {
      const res = await updateTaskStatusAction(task.id, newStatus)
      setChangingStatus(false)
      if (res.error) {
        alert(res.error)
      } else {
        setStatus(newStatus)
        onStatusChanged(task.id, newStatus)
      }
    } catch {
      setChangingStatus(false)
    }
  }

  async function handleSaveObservations() {
    setSavingObs(true)
    setObsSaved(false)
    try {
      const res = await updateTaskExecutionDetailsAction(task.id, {
        observacoes,
        safetyRulesChecked: checkedRules,
        frsChecked: checkedFRs,
      })
      setSavingObs(false)
      if (res.error) {
        alert(res.error)
      } else {
        setObsSaved(true)
        setTimeout(() => setObsSaved(false), 3000)
      }
    } catch {
      setSavingObs(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(file, 1200)
      const url = await uploadImage(compressed, 'tasks')
      if (url) {
        const nextPhotos = [...photos, url]
        setPhotos(nextPhotos)
        await updateTaskExecutionDetailsAction(task.id, { photoUrl: url })
      }
    } catch {
      alert('Erro ao carregar fotografia.')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function toggleRule(ruleText: string) {
    const next = checkedRules.includes(ruleText)
      ? checkedRules.filter((r) => r !== ruleText)
      : [...checkedRules, ruleText]
    setCheckedRules(next)
    void updateTaskExecutionDetailsAction(task.id, { safetyRulesChecked: next })
  }

  function toggleFR(frCode: string) {
    const next = checkedFRs.includes(frCode)
      ? checkedFRs.filter((f) => f !== frCode)
      : [...checkedFRs, frCode]
    setCheckedFRs(next)
    void updateTaskExecutionDetailsAction(task.id, { frsChecked: next })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        
        {/* Cabecalho */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono font-extrabold text-sm bg-industrial-blue text-white px-2.5 py-0.5 rounded-lg shadow-2xs">
                {formattedId}
              </span>
              <TipoBadge tipo={task.tipo} />
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                task.criticidade === 'vermelho' ? 'bg-red-50 text-red-700 border-red-200' :
                task.criticidade === 'amarelo' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {CRITICIDADE_LABELS[task.criticidade] || 'Normal'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {task.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap font-medium">
              <span className="font-bold text-industrial-blue dark:text-sky-400">
                {assetTag ? `[${assetTag}] ${assetName || ''}` : (task as any).tag || 'Equipamento Geral'}
              </span>
              <span>·</span>
              <span>Área: {area || (task as any).area || 'Geral'}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Resumo */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar min-h-0 flex-1 text-slate-800 dark:text-slate-200 text-sm">
          
          {/* Instrucoes / Descricao dos Trabalhos */}
          {task.description && (
            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-industrial-blue dark:text-sky-400 mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Instruções Técnicas & Descrição dos Trabalhos:</span>
              </p>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-line">
                {task.description}
              </p>
            </div>
          )}

          {/* Painel de Execucao: Inicio e Fim da OT */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Estado da Intervenção
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge-${status} text-xs font-extrabold px-3 py-1 rounded-full`}>
                    {STATUS_LABELS[status] || status}
                  </span>
                  {task.plannedStartDate && (
                    <span className="text-xs text-slate-500 font-mono font-medium">
                      Agendada: {formatDate(task.plannedStartDate)}
                    </span>
                  )}
                </div>
              </div>

              {/* Botoes de Acao Imediata */}
              <div className="flex items-center gap-2 flex-wrap">
                {status === 'pending' && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleToggleStatus('in_progress')}
                    className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Dar Início à OT</span>
                  </button>
                )}

                {status === 'in_progress' && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleToggleStatus('done')}
                    className="btn-primary bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dar Fim / Concluir OT</span>
                  </button>
                )}

                {status === 'done' && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-4 w-4" /> OT Concluída
                    </span>
                    <button
                      type="button"
                      disabled={changingStatus}
                      onClick={() => handleToggleStatus('in_progress')}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Reabrir OT se necessário"
                    >
                      <RotateCcw className="h-3 w-3" /> Reabrir
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tecnicos Atribuidos */}
            <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">Técnicos Designados:</span>
              <div className="flex flex-wrap gap-1.5">
                {ids.length === 0 ? (
                  <span className="text-slate-400">Nenhum técnico atribuído</span>
                ) : (
                  ids.map((idOrAbbr) => (
                    <span
                      key={idOrAbbr}
                      title={resolveTechLabel(idOrAbbr)}
                      className="inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md text-[11px] bg-orange-100 text-orange-950 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-300 dark:border-orange-800"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-safety-orange shrink-0" />
                      <span>{resolveTechInitials(idOrAbbr)}</span>
                      <span className="text-[9px] font-normal opacity-70 hidden sm:inline">({resolveTechLabel(idOrAbbr).split('-').pop()?.trim()})</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Checklist Interativo de Regras de Seguranca */}
          <div className="border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Checklist de Regras de Segurança
                </h3>
              </div>
              <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                {checkedRules.length} / {rules.length} Verificadas
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Assinale as verificações de segurança antes e durante a intervenção:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rules.map((rule) => {
                const isChecked = checkedRules.includes(rule)
                return (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => toggleRule(rule)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </span>
                    <span className="leading-tight">{rule}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Folhas de Registo (FRs) e ITs */}
          {(frList.length > 0 || itList.length > 0) && (
            <div className="border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-industrial-blue dark:text-sky-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-industrial-blue dark:text-sky-300">
                  Folhas de Registo (FR) e Instruções de Trabalho (IT)
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5">
                Documentos associados a esta OT para preenchimento e cumprimento técnico:
              </p>
              <div className="flex flex-wrap gap-2">
                {frList.map((fr) => {
                  const isChecked = checkedFRs.includes(fr)
                  return (
                    <button
                      key={fr}
                      type="button"
                      onClick={() => toggleFR(fr)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {isChecked ? <CheckSquare className="h-3.5 w-3.5 text-emerald-600" /> : <Square className="h-3.5 w-3.5 text-slate-400" />}
                      <span>{fr}</span>
                      {isChecked && <span className="text-[10px] text-emerald-700 font-extrabold">(Validada)</span>}
                    </button>
                  )
                })}
                {itList.map((it) => (
                  <span
                    key={it}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    <FileText className="h-3 w-3 text-slate-500" />
                    <span>{it}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Observacoes / Trabalho Efetuado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Observações / Relatório Técnico
              </label>
              {obsSaved && (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-fade-in">
                  <CheckCircle2 className="h-3 w-3" /> Observações guardadas!
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Descreva os trabalhos efetuados, anomalias encontradas, peças ou medições..."
              className="input w-full text-xs sm:text-sm resize-y leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingObs}
                onClick={handleSaveObservations}
                className="btn-secondary text-xs py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{savingObs ? 'A guardar...' : 'Guardar Observações'}</span>
              </button>
            </div>
          </div>

          {/* Registo Fotografico / Fotos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-slate-500" />
                Registo Fotográfico ({photos.length})
              </label>

              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer text-industrial-blue dark:text-sky-400"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{uploadingPhoto ? 'A carregar foto...' : 'Tirar / Anexar Foto'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-industrial-blue dark:hover:border-sky-400 transition-colors"
              >
                <ImageIcon className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-500 font-medium">Nenhuma fotografia anexada a esta OT</p>
                <p className="text-[11px] text-industrial-blue font-bold mt-0.5">Clique para tirar foto com a câmara ou escolher da galeria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100"
                  >
                    <img src={url} alt={`Foto OT ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                      Ver Foto
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodape */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/tasks/${task.id}`}
              className="text-xs font-bold text-industrial-blue dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Ver ficha detalhada da OT</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {isManager && onOpenFullEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenFullEdit(task)
                }}
                className="btn-secondary text-xs py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                title="Acesso exclusivo a gestores para editar todos os campos técnicos da OT"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Editar Estrutura (Gestor)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn-primary text-xs py-1.5 px-4 rounded-lg font-bold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
