'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, ShieldAlert, Package, Plus, Minus } from 'lucide-react'
import {
  type Task,
  type TaskStatus,
  type TaskCriticidade,
  type TipoTarefa,
  STATUS_LABELS,
  CRITICIDADE_LABELS,
  TIPO_LABELS,
} from '@/types/models'
import { updateTaskAction } from '@/app/dashboard/tasks/actions'

type Ref = { id: string; name: string }

function DynamicList({
  label,
  icon: Icon,
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string
  icon: React.ElementType
  items: string[]
  onChange: (v: string[]) => void
  placeholder: string
  addLabel: string
}) {
  function update(i: number, val: string) {
    const next = [...items]
    next[i] = val
    onChange(next)
  }
  function add() { onChange([...items, '']) }
  function remove(i: number) {
    if (items.length === 1) { onChange(['']); return }
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </label>
      <div className="space-y-2">
        {items.map((val, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={val}
              onChange={(e) => update(i, e.target.value)}
              className="input flex-1 text-sm"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              tabIndex={-1}
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  )
}

export default function TaskSummaryActions({
  task,
  assets,
  users,
}: {
  task: Task
  assets: Ref[]
  users: Ref[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [safetyRules, setSafetyRules] = useState<string[]>([''])
  const [materialsRequired, setMaterialsRequired] = useState<string[]>([''])

  const statuses: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled']
  const criticidades: TaskCriticidade[] = ['vermelho', 'amarelo', 'verde']
  const tipos: TipoTarefa[] = ['preventiva', 'curativa', 'plano', 'inspecao', 'lubrificacao', 'calibracao', 'outro']

  useEffect(() => {
    if (open) {
      setSafetyRules(task.safetyRules?.length ? [...task.safetyRules] : [''])
      setMaterialsRequired(task.materialsRequired?.length ? [...task.materialsRequired] : [''])
    }
  }, [open, task])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const formData = new FormData(e.currentTarget)

    const validRules = safetyRules.map((r) => r.trim()).filter(Boolean)
    const validMaterials = materialsRequired.map((m) => m.trim()).filter(Boolean)
    if (validRules.length) formData.set('safetyRules', JSON.stringify(validRules))
    if (validMaterials.length) formData.set('materialsRequired', JSON.stringify(validMaterials))

    const result = await updateTaskAction({}, formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else {
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError('') }}
        className="btn-secondary flex items-center gap-2"
      >
        <Pencil className="h-4 w-4" /> Editar OT
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Editar OT</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="id" value={task.id} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Título *</label>
                <input name="title" defaultValue={task.title} className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
                <textarea name="description" defaultValue={task.description ?? ''} className="input" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
                  <select name="tipo" defaultValue={task.tipo} className="input">
                    {tipos.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Criticidade *</label>
                  <select name="criticidade" defaultValue={task.criticidade} className="input">
                    {criticidades.map((c) => <option key={c} value={c}>{CRITICIDADE_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Equipamento</label>
                  <select name="assetId" defaultValue={task.assetId ?? ''} className="input">
                    <option value="">— Nenhum —</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsável</label>
                  <select name="assignedTo" defaultValue={task.assignedTo ?? ''} className="input">
                    <option value="">— Ninguém —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
                  <select name="status" defaultValue={task.status} className="input">
                    {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prazo</label>
                  <input type="date" name="dueDate" defaultValue={task.dueDate ?? ''} className="input" />
                </div>
              </div>

              <DynamicList
                label="Regras de segurança"
                icon={ShieldAlert}
                items={safetyRules}
                onChange={setSafetyRules}
                placeholder="Ex.: Usar EPI, desligar máquina antes…"
                addLabel="Adicionar regra"
              />

              <DynamicList
                label="Materiais a utilizar"
                icon={Package}
                items={materialsRequired}
                onChange={setMaterialsRequired}
                placeholder="Ex.: Óleo 5W30, Filtro de ar…"
                addLabel="Adicionar material"
              />

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={busy} className="btn-primary flex-1">
                  {busy ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
