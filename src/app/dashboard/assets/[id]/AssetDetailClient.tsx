'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Activity, Thermometer, Clock, Package, 
  Settings, PenTool, Edit2, Save, X, Camera, ImageOff, Plus,
  ShieldAlert, Trash2, Wrench, CalendarClock
} from 'lucide-react'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import { updateAssetAction } from '../actions'
import { 
  LineChart, Line, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import type { Asset, Task, User } from '@/types/models'
import { STATUS_LABELS, TIPO_LABELS } from '@/types/models'
import { useTableSort, SortableTh } from '@/lib/useTableSort'

import CreateTaskModal from '@/components/modals/CreateTaskModal'

export default function AssetDetailClient({
  asset,
  tasks,
  users
}: {
  asset: Asset
  tasks: Task[]
  users: User[]
}) {
  const router = useRouter()

  const [taskList, setTaskList] = useState<Task[]>(tasks)
  React.useEffect(() => {
    setTaskList(tasks)
  }, [tasks])

  const isPMTask = (t: Task) => {
    const tipoStr = String(t.tipo || '').toLowerCase().trim()
    const tiStr = String((t as any).ti || '').toUpperCase().trim()
    const tipoText = String((t as any).tipoText || '').toUpperCase().trim()
    return (
      tipoStr === 'pm' ||
      tipoStr === 'plano' ||
      tipoStr === 'preventiva' ||
      tiStr === 'PM' ||
      tipoText === 'PM' ||
      Boolean(t.maintenancePlanId) ||
      (t as any).source === 'plano_manutencao' ||
      (t as any).source === 'pm_anual_paragem_verao_2026' ||
      (t as any).source === 'pm_agendamento_2026' ||
      String(t.id || '').startsWith('task_pm_') ||
      (t.title && (t.title.startsWith('[PM]') || t.title.startsWith('[MP]')))
    )
  }

  const pmTasks = React.useMemo(() => taskList.filter(isPMTask), [taskList])
  const correctiveTasks = React.useMemo(() => taskList.filter((t) => !isPMTask(t)), [taskList])

  const { sorted: sortedTasks, sortKey, sortDir, toggleSort } = useTableSort<Task>(
    taskList,
    {
      date: (t) => t.createdAt,
      title: (t) => t.title,
      tipo: (t) => t.tipo,
      status: (t) => t.status,
    },
    'date',
    'desc'
  )

  const [isEditing, setIsEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(asset.photoUrl ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modal de Nova OT no Equipamento
  const [showCreateModal, setShowCreateModal] = useState(false)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSaveSpecs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    const formData = new FormData(e.currentTarget)
    
    try {
      if (photoFile) {
        try {
          const url = await uploadImage(photoFile, 'assets')
          formData.set('photoUrl', url)
        } catch {
          if (asset.photoUrl) formData.set('photoUrl', asset.photoUrl)
        }
      } else if (photoPreview === null) {
        formData.set('photoUrl', '')
      } else if (asset.photoUrl) {
        formData.set('photoUrl', asset.photoUrl)
      }

      const result = await updateAssetAction({}, formData)
      
      if (result.error) {
        setError(result.error)
      } else {
        setIsEditing(false)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  const assetOption = { id: asset.id, name: asset.name, tag: asset.tag, area: asset.area }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/assets')} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-slate-300">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-3">
              {asset.name}
              <span className={asset.active ? 'badge-done text-sm' : 'badge-cancelled text-sm'}>
                {asset.active ? 'Ativo' : 'Inativo'}
              </span>
            </h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Nova OT</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {asset.tag ? `TAG: ${asset.tag}` : 'Sem TAG'} • {asset.area ? `Área: ${asset.area}` : 'Sem Área'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Asset Info & Specs */}
        <div className="space-y-6">
          <form onSubmit={handleSaveSpecs} className="card p-6 border border-gray-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
            <input type="hidden" name="id" value={asset.id} />
            <input type="hidden" name="name" value={asset.name} />
            <input type="hidden" name="tag" value={asset.tag ?? ''} />
            <input type="hidden" name="area" value={asset.area ?? ''} />
            <input type="hidden" name="location" value={asset.location ?? ''} />
            <input type="hidden" name="tags" value={asset.tags?.join(',') ?? ''} />
            <input type="hidden" name="notes" value={asset.notes ?? ''} />
            <input type="hidden" name="active" value={asset.active ? 'true' : 'false'} />
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#2E86C1]" /> Ficha Técnica
              </h3>
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-[#2E86C1] hover:bg-blue-50 dark:hover:bg-slate-800 rounded transition-colors" title="Editar Ficha Técnica">
                  <Edit2 className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setIsEditing(false); setPhotoPreview(asset.photoUrl ?? null); setError('') }} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                  <button type="submit" disabled={busy} className="p-1.5 text-white bg-[#2E86C1] hover:bg-[#21618C] rounded transition-colors disabled:opacity-50">
                    <Save className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className={`aspect-video relative rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 mb-6 border border-gray-200 dark:border-slate-700 ${isEditing ? 'ring-2 ring-[#2E86C1] ring-offset-2 dark:ring-offset-slate-900' : ''}`}>
              {photoPreview ? (
                <Image src={photoPreview} alt={asset.name} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="h-12 w-12 text-gray-300 dark:text-slate-600" />
                </div>
              )}
              
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-primary text-xs flex items-center gap-2 py-1.5 px-3">
                    <Camera className="h-4 w-4" /> Alterar Foto
                  </button>
                  {photoPreview && (
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className="btn-secondary text-xs text-red-500 flex items-center gap-2 py-1.5 px-3">
                      <ImageOff className="h-4 w-4" /> Remover
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Fabricante</span>
                {isEditing ? (
                  <input name="manufacturer" defaultValue={asset.manufacturer ?? ''} className="input py-0.5 px-2 text-xs w-1/2 text-right" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.manufacturer || '—'}</span>
                )}
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Nº de Série</span>
                {isEditing ? (
                  <input name="serialNumber" defaultValue={asset.serialNumber ?? ''} className="input py-0.5 px-2 text-xs w-1/2 text-right" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.serialNumber || '—'}</span>
                )}
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
                <span className="text-gray-500 dark:text-slate-400">Tipo</span>
                {isEditing ? (
                  <input name="type" defaultValue={asset.type ?? ''} className="input py-0.5 px-2 text-xs w-1/2 text-right" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.type || '—'}</span>
                )}
              </div>
              <div className="flex flex-col pb-2">
                <span className="text-gray-500 dark:text-slate-400 mb-1">Características</span>
                {isEditing ? (
                  <textarea name="characteristics" defaultValue={asset.characteristics ?? ''} className="input py-1.5 px-2 text-xs w-full min-h-[60px]" />
                ) : (
                  <span className="font-medium text-gray-900 dark:text-slate-200">{asset.characteristics || '—'}</span>
                )}
              </div>
            </div>
            
            {isEditing && (
              <p className="mt-4 text-[10px] text-gray-400 dark:text-slate-500 text-center uppercase tracking-widest font-semibold">
                Funcionalidade sujeita a validação de plano
              </p>
            )}
          </form>
        </div>

        {/* MIDDLE & RIGHT: KPIs and History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* KPI ROW - Métricas Reais do Equipamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4 border border-[#2E86C1]/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 bg-[#2E86C1]/10 rounded-lg text-[#2E86C1]">
                  <Activity className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-300">Total de OTs</h3>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{taskList.length} <span className="text-xs font-normal text-gray-500">registadas</span></p>
              <p className="text-[11px] text-gray-500 mt-1">Histórico completo</p>
            </div>

            <div className="card p-4 border border-emerald-500/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <Clock className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-300">OTs Concluídas</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{taskList.filter(t => t.status === 'done').length} <span className="text-xs font-normal text-gray-500">finalizadas</span></p>
              <p className="text-[11px] text-gray-500 mt-1">Intervenções realizadas</p>
            </div>

            <div className="card p-4 border border-amber-500/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-300">Plano PM</h3>
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {pmTasks.filter(t => t.status === 'done').length} <span className="text-xs font-normal text-gray-500">/ {pmTasks.length} OTs</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {pmTasks.length > 0 ? `${Math.round((pmTasks.filter(t => t.status === 'done').length / pmTasks.length) * 100)}% concluído` : 'Sem PM agendado'}
              </p>
            </div>

            <div className="card p-4 border border-blue-500/20 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/80">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500">
                  <Settings className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-300">Em Curso / Pendentes</h3>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{taskList.filter(t => t.status !== 'done' && t.status !== 'cancelled').length} <span className="text-xs font-normal text-gray-500">ativas</span></p>
              <p className="text-[11px] text-gray-500 mt-1">Aguardam execução</p>
            </div>
          </div>

          {/* 1. TABELA DE OTs DO PLANO DE MANUTENÇÃO (PM) */}
          <div className="card overflow-hidden border border-amber-500/20">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>Ordens de Trabalho — Plano de Manutenção Preventiva (PM)</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                {pmTasks.length} {pmTasks.length === 1 ? 'OT de PM' : 'OTs de PM'}
              </span>
            </div>

            {pmTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                Nenhuma Ordem de Trabalho do Plano de Manutenção (PM) registada para este equipamento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <th className="px-4 py-3">Data Prevista Execução</th>
                      <th className="px-4 py-3">Ordem de Trabalho (PM)</th>
                      <th className="px-4 py-3">Periodicidade</th>
                      <th className="px-4 py-3">Data Realizada</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmTasks.map((t) => {
                      const datePlanned = t.plannedStartDate || t.dueDate || (t as any).scheduledDate || t.createdAt
                      const dateFormatted = datePlanned
                        ? (datePlanned.includes('T') ? datePlanned.split('T')[0] : datePlanned)
                        : '—'
                      const dateDone = t.completedAt ? t.completedAt.split('T')[0] : '—'
                      const periodicidadeLabel = t.periodicidade || (t as any).periodicidadeLabel || 'Anual'

                      return (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                          className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 transition-colors cursor-pointer group"
                          title={`Clique para abrir a OT ${t.title}`}
                        >
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono font-bold">
                            {dateFormatted}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#2E86C1] group-hover:underline">
                            <Link href={`/dashboard/tasks/${t.id}`} onClick={(e) => e.stopPropagation()}>
                              {t.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs font-medium uppercase">
                            {periodicidadeLabel}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap font-mono text-xs">
                            {dateDone}
                          </td>
                          <td className="px-4 py-3">
                            <span className={
                              t.status === 'done' ? 'badge-done' : 
                              t.status === 'in_progress' ? 'badge-pending' : 
                              t.status === 'cancelled' ? 'badge-cancelled' : 'badge-neutral'
                            }>
                              {STATUS_LABELS[t.status] || t.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. TABELA DE HISTÓRICO DE INTERVENÇÕES CORRETIVAS / OUTRAS */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <PenTool className="h-4 w-4 text-[#2E86C1]" />
                <span>Histórico de Intervenções (Corretivas / Pedidos de Intervenção)</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {correctiveTasks.length} {correctiveTasks.length === 1 ? 'Intervenção' : 'Intervenções'}
              </span>
            </div>
            {correctiveTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                Nenhum registo de intervenção corretiva encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <SortableTh label="Data" sortableKey="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3" />
                      <SortableTh label="Ordem de Trabalho (OT)" sortableKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3" />
                      <SortableTh label="Tipo" sortableKey="tipo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3" />
                      <SortableTh label="Estado" sortableKey="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.filter((t) => !isPMTask(t)).map(t => (
                      <tr
                        key={t.id}
                        onClick={() => router.push(`/dashboard/tasks/${t.id}`)}
                        className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-blue-50/60 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                        title={`Clique para abrir a OT ${t.title}`}
                      >
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap font-mono">
                          {new Date(t.createdAt).toLocaleDateString('pt-PT')}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#2E86C1] group-hover:underline">
                          <Link href={`/dashboard/tasks/${t.id}`} onClick={(e) => e.stopPropagation()}>
                            {t.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-slate-400">
                          {TIPO_LABELS[t.tipo] || t.tipo}
                        </td>
                        <td className="px-4 py-3">
                          <span className={
                            t.status === 'done' ? 'badge-done' : 
                            t.status === 'in_progress' ? 'badge-pending' : 
                            t.status === 'cancelled' ? 'badge-cancelled' : 'badge-neutral'
                          }>
                            {STATUS_LABELS[t.status] || t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Unified Nova OT Modal Component */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        initialAssetId={asset.id}
        assets={[asset]}
        users={users}
        isManager={true}
        onSuccess={(newTask) => {
          if (newTask) {
            setTaskList((prev) => [newTask, ...prev])
          }
          router.refresh()
        }}
      />
    </div>
  )
}
