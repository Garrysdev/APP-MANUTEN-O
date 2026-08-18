'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'
import type { SafetyRule } from '@/types/models'
import { createSafetyRuleAction, updateSafetyRuleAction, deleteSafetyRuleAction } from './actions'

export default function SafetyRulesClient({ initialRules }: { initialRules: SafetyRule[] }) {
  const router = useRouter()
  const [rules, setRules] = useState<SafetyRule[]>(initialRules)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<SafetyRule | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Geral')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openCreate() {
    setEditingRule(null)
    setTitle('')
    setCategory('Geral')
    setDescription('')
    setActive(true)
    setError('')
    setModalOpen(true)
  }

  function openEdit(rule: SafetyRule) {
    setEditingRule(rule)
    setTitle(rule.title)
    setCategory(rule.category || 'Geral')
    setDescription(rule.description || '')
    setActive(rule.active !== false)
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('O título da regra de segurança é obrigatório.')
      return
    }
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('title', title)
    formData.append('category', category)
    formData.append('description', description)
    formData.append('active', active ? 'true' : 'false')

    let res
    if (editingRule) {
      res = await updateSafetyRuleAction(editingRule.id, formData)
    } else {
      res = await createSafetyRuleAction(formData)
    }

    setLoading(false)
    if (res?.error) {
      setError(res.error)
    } else {
      setModalOpen(false)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem a certeza que deseja eliminar esta regra de segurança?')) return
    await deleteSafetyRuleAction(id)
    router.refresh()
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-safety-orange" />
            <h1 className="text-2xl font-extrabold text-industrial-blue dark:text-slate-100">
              Regras de Segurança
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão centralizada de regras de segurança (EPIs, LOTO, Altura) a aplicar nas OTs.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="h-10 px-4 bg-safety-orange hover:bg-safety-orange/90 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Nova Regra de Segurança</span>
        </button>
      </div>

      {/* Lista de Regras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((r) => (
          <div
            key={r.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                  {r.category || 'Geral'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                  {r.active !== false ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">{r.title}</h3>
              {r.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{r.description}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => openEdit(r)}
                className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Editar"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1.5 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Criar / Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              {editingRule ? 'Editar Regra de Segurança' : 'Nova Regra de Segurança'}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Título da Regra / EPI *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Bloqueio LOTO, Uso de Arnês, EPI Obrigatório..."
                  className="input text-xs w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input text-xs w-full"
                >
                  <option value="Geral">Geral</option>
                  <option value="Elétrico">Elétrico</option>
                  <option value="Trabalho em Altura">Trabalho em Altura</option>
                  <option value="Mecânico">Mecânico</option>
                  <option value="Espaços Confinados">Espaços Confinados</option>
                  <option value="Químico / Biológico">Químico / Biológico</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Instruções Adicionais
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes ou procedimentos de verificação..."
                  className="input text-xs w-full h-20 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ruleActive"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="ruleActive" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Regra Ativa (disponível na seleção de OTs)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold text-white bg-safety-orange hover:bg-safety-orange/90 rounded-lg shadow-sm transition-all"
                >
                  {loading ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
