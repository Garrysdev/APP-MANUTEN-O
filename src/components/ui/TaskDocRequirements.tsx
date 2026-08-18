'use client'

import { useState } from 'react'
import { FileText, CheckCircle2, AlertCircle, Eye, Edit3, X, Check, Lock, ShieldCheck, ClipboardList } from 'lucide-react'
import { updateTaskFRsAndITsAction } from '@/app/dashboard/tasks/actions'
import { useRouter } from 'next/navigation'

export const AVAILABLE_FRS = [
  {
    id: 'FR-01',
    title: 'FR-01: Registo de Leituras Diárias & Parâmetros',
    desc: 'Leituras de Pressão (bar), Temperatura (ºC), Tensão Elétrica e Horas.',
    fields: [
      { name: 'pressao_bar', label: 'Pressão de Ar / Circuito (bar)', type: 'number', placeholder: 'Ex: 6.5' },
      { name: 'temp_celsius', label: 'Temperatura Operacional (ºC)', type: 'number', placeholder: 'Ex: 48.0' },
      { name: 'horas_func', label: 'Horas de Funcionamento / Contadores', type: 'number', placeholder: 'Ex: 12450' },
      { name: 'observacoes', label: 'Observações de Estado', type: 'text', placeholder: 'Sem anomalias detetadas...' }
    ]
  },
  {
    id: 'FR-02',
    title: 'FR-02: Checklist de Inspeção Visual & Estado Mecânico',
    desc: 'Verificação de folgas, nível de ruído, fugas de óleo e estado de correias.',
    fields: [
      { name: 'estado_correias', label: 'Estado das Correias / Transmissão', type: 'select', options: ['Conforme', 'Desgaste Ligeiro', 'Substituir'] },
      { name: 'fugas_oleo', label: 'Deteção de Fugas de Óleo / Fluído', type: 'select', options: ['Nenhuma', 'Transudação Ligeira', 'Fuga Ativa'] },
      { name: 'nivel_ruido', label: 'Nível de Ruído e Vibração', type: 'select', options: ['Normal / Silencioso', 'Vibração Moderada', 'Anómalo'] },
      { name: 'obs_inspecao', label: 'Notas da Inspeção', type: 'text', placeholder: 'Limpeza efetuada...' }
    ]
  },
  {
    id: 'FR-03',
    title: 'FR-03: Registo de Causa da Avaria & Teste de Carga',
    desc: 'Sintoma inicial, causa raiz identificada, substituição efetuada e teste final.',
    fields: [
      { name: 'sintoma', label: 'Sintoma / Manifestação da Falha', type: 'text', placeholder: 'Disjuntor disparou...' },
      { name: 'causa_raiz', label: 'Causa Raiz Apurada', type: 'text', placeholder: 'Curto-circuito em bobine...' },
      { name: 'teste_carga', label: 'Resultado do Teste de Funcionamento', type: 'select', options: ['Aprovado / 100% Operacional', 'Requer Monitorização', 'Não Aprovado'] }
    ]
  }
]

export const AVAILABLE_ITS = [
  {
    id: 'IT-01',
    title: 'IT-01: Consignação LOTO & Segurança Elétrica',
    content: `PROCEDIMENTO OBRIGATÓRIO DE CONSIGNAÇÃO (LOTO):
1. Desligar o seccionador geral de alimentação do equipamento.
2. Bloquear o seccionador com o alfinete / alavanca de bloqueio LOTO individual.
3. Colocar a etiqueta de sinalização "NÃO LIGAR - TRABALHOS EM CURSO".
4. Verificar obrigatoriamente a ausência de tensão através de multímetro/voltímetro testado antes de iniciar qualquer intervenção.`
  },
  {
    id: 'IT-02',
    title: 'IT-02: Manutenção de Sistemas Oleodinâmicos & Hidráulicos',
    content: `PROCEDIMENTO DE MANUTENÇÃO HIDRÁULICA:
1. Despressurizar totalmente o acumulador e as linhas hidráulicas antes de desapertar conexões.
2. Utilizar obrigatoriamente luvas de nitrilo resistente a hidrocarbonetos e óculos de proteção.
3. Manter bacia de retenção posicionada para recolha de eventuais pingos ou derrames de óleo.
4. Depositar panos contaminados e filtros usados no ecoponto de resíduos perigosos (LER 15 02 02).`
  },
  {
    id: 'IT-03',
    title: 'IT-03: Trabalho em Altura & Plataforma Elevatória',
    content: `INSTRUÇÃO DE SEGURANÇA PARA TRABALHOS EM ALTURA:
1. Equipar arnês anticada de 2 pontos de fixação com absorvedor de energia verificado.
2. Fixar obrigatoriamente os mosquetões a ponto de ancoragem / linha de vida homologada.
3. Delimitar e sinalizar o raio de trabalho no solo com fita de sinalização e cones.
4. Proibida a utilização de escadas simples para trabalhos superiores a 2 metros sem ponto de apoio fixo.`
  }
]

// Modal para o Gestor selecionar quais FRs e ITs são obrigatórias ao criar/editar OT (Estilo Regras de Segurança)
export function TaskDocPickerManager({
  selectedFRs = [],
  selectedITs = [],
  onChangeFRs,
  onChangeITs
}: {
  selectedFRs: string[]
  selectedITs: string[]
  onChangeFRs: (frs: string[]) => void
  onChangeITs: (its: string[]) => void
}) {
  const [frToSelect, setFrToSelect] = useState('')
  const [itToSelect, setItToSelect] = useState('')

  function handleAddFR(frId: string) {
    if (!frId) return
    if (!selectedFRs.includes(frId)) {
      onChangeFRs([...selectedFRs, frId])
    }
    setFrToSelect('')
  }

  function handleRemoveFR(frId: string) {
    onChangeFRs(selectedFRs.filter(id => id !== frId))
  }

  function handleAddIT(itId: string) {
    if (!itId) return
    if (!selectedITs.includes(itId)) {
      onChangeITs([...selectedITs, itId])
    }
    setItToSelect('')
  }

  function handleRemoveIT(itId: string) {
    onChangeITs(selectedITs.filter(id => id !== itId))
  }

  const unselectedFRs = AVAILABLE_FRS.filter(f => !selectedFRs.includes(f.id))
  const unselectedITs = AVAILABLE_ITS.filter(i => !selectedITs.includes(i.id))

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-4">
      {/* 1. Folhas de Registo Obrigatórias (FR) */}
      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wide text-industrial-blue dark:text-blue-300 flex items-center gap-1.5 mb-1">
          <ClipboardList className="h-4 w-4 text-safety-orange" />
          Folhas de Registo Obrigatórias (FR)
        </h4>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
          Selecione as Folhas de Registo a incluir nesta OT (podem ser incluídas várias).
        </p>

        {/* Dropdown de Seleção */}
        <div className="flex gap-2 mb-2">
          <select
            value={frToSelect}
            onChange={(e) => { setFrToSelect(e.target.value); if (e.target.value) handleAddFR(e.target.value) }}
            className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
          >
            <option value="">-- Incluir Folha de Registo (FR) --</option>
            {unselectedFRs.map(fr => (
              <option key={fr.id} value={fr.id}>{fr.title}</option>
            ))}
          </select>
        </div>

        {/* Lista de FRs Incluídas */}
        {selectedFRs.length > 0 ? (
          <div className="space-y-1.5">
            {selectedFRs.map(frId => {
              const frDef = AVAILABLE_FRS.find(f => f.id === frId) || { title: frId, desc: '' }
              return (
                <div key={frId} className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm text-xs">
                  <div>
                    <span className="font-bold text-amber-950 dark:text-amber-200 block">{frDef.title}</span>
                    <span className="text-[10px] text-slate-500">{frDef.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFR(frId)}
                    className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic font-medium">Nenhuma Folha de Registo incluída ainda.</div>
        )}
      </div>

      {/* 2. Instruções de Trabalho Obrigatórias (IT) */}
      <div>
        <h4 className="text-xs font-extrabold uppercase tracking-wide text-industrial-blue dark:text-blue-300 flex items-center gap-1.5 mb-1">
          <ShieldCheck className="h-4 w-4 text-teal-600" />
          Instruções de Trabalho Obrigatórias (IT)
        </h4>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
          Selecione as Instruções de Trabalho a incluir nesta OT (podem ser incluídas várias).
        </p>

        {/* Dropdown de Seleção */}
        <div className="flex gap-2 mb-2">
          <select
            value={itToSelect}
            onChange={(e) => { setItToSelect(e.target.value); if (e.target.value) handleAddIT(e.target.value) }}
            className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
          >
            <option value="">-- Incluir Instrução de Trabalho (IT) --</option>
            {unselectedITs.map(it => (
              <option key={it.id} value={it.id}>{it.title}</option>
            ))}
          </select>
        </div>

        {/* Lista de ITs Incluídas */}
        {selectedITs.length > 0 ? (
          <div className="space-y-1.5">
            {selectedITs.map(itId => {
              const itDef = AVAILABLE_ITS.find(i => i.id === itId) || { title: itId, content: '' }
              return (
                <div key={itId} className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-900/50 shadow-sm text-xs">
                  <div>
                    <span className="font-bold text-teal-950 dark:text-teal-200 block">{itDef.title}</span>
                    <span className="text-[10px] text-slate-500 line-clamp-1">{itDef.content}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveIT(itId)}
                    className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 italic font-medium">Nenhuma Instrução de Trabalho incluída ainda.</div>
        )}
      </div>
    </div>
  )
}

// Secção Interativa para o Técnico na página da OT
export function TaskDocRequirementsTechnician({
  taskId,
  requiredFRs = [],
  requiredITs = [],
  completedFRs = {},
  acknowledgedITs = [],
  onUpdate
}: {
  taskId: string
  requiredFRs?: string[]
  requiredITs?: string[]
  completedFRs?: Record<string, any>
  acknowledgedITs?: string[]
  onUpdate?: () => void
}) {
  const router = useRouter()
  const [activeFRPopup, setActiveFRPopup] = useState<any | null>(null)
  const [activeITPopup, setActiveITPopup] = useState<any | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  if ((!requiredFRs || requiredFRs.length === 0) && (!requiredITs || requiredITs.length === 0)) {
    return null
  }

  function openFR(frId: string) {
    const frDef = AVAILABLE_FRS.find(f => f.id === frId)
    if (!frDef) return
    setActiveFRPopup(frDef)
    setFormData(completedFRs?.[frId] || {})
  }

  function openIT(itId: string) {
    const itDef = AVAILABLE_ITS.find(i => i.id === itId)
    if (!itDef) return
    setActiveITPopup(itDef)
  }

  async function handleSaveFR(e: React.FormEvent) {
    e.preventDefault()
    if (!activeFRPopup) return
    setSaving(true)
    try {
      const nextCompleted = {
        ...(completedFRs || {}),
        [activeFRPopup.id]: {
          ...formData,
          _savedAt: new Date().toISOString()
        }
      }
      await updateTaskFRsAndITsAction(taskId, { completedFRs: nextCompleted })
      setActiveFRPopup(null)
      onUpdate?.()
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAcknowledgeIT(itId: string) {
    setSaving(true)
    try {
      const nextAck = Array.from(new Set([...(acknowledgedITs || []), itId]))
      await updateTaskFRsAndITsAction(taskId, { acknowledgedITs: nextAck })
      setActiveITPopup(null)
      onUpdate?.()
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="font-extrabold text-sm text-industrial-blue dark:text-slate-100 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-safety-orange" />
          Folhas de Registo & Instruções de Trabalho Obrigatórias
        </h3>
        <span className="text-[11px] font-bold text-slate-500">
          Obrigatórias para concluir a OT
        </span>
      </div>

      {/* Lista de FRs */}
      {requiredFRs && requiredFRs.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Folhas de Registo (FR)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {requiredFRs.map(frId => {
              const frDef = AVAILABLE_FRS.find(f => f.id === frId) || { id: frId, title: frId, desc: '' }
              const isFilled = !!completedFRs?.[frId]

              return (
                <button
                  key={frId}
                  type="button"
                  onClick={() => openFR(frId)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isFilled
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-bold block truncate">{frDef.title}</span>
                    <span className="text-[10px] font-semibold opacity-80">
                      {isFilled ? '✔️ Preenchida & Registada' : '⚠️ Clique para preencher no Popup'}
                    </span>
                  </div>
                  <Edit3 className={`h-4 w-4 shrink-0 ${isFilled ? 'text-emerald-600' : 'text-amber-600'}`} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de ITs */}
      {requiredITs && requiredITs.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Instruções de Trabalho (IT)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {requiredITs.map(itId => {
              const itDef = AVAILABLE_ITS.find(i => i.id === itId) || { id: itId, title: itId, content: '' }
              const isAck = (acknowledgedITs || []).includes(itId)

              return (
                <button
                  key={itId}
                  type="button"
                  onClick={() => openIT(itId)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isAck
                      ? 'bg-teal-50 dark:bg-teal-950/20 border-teal-300 dark:border-teal-800 text-teal-950 dark:text-teal-200'
                      : 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-bold block truncate">{itDef.title}</span>
                    <span className="text-[10px] font-semibold opacity-80">
                      {isAck ? '✔️ Lida & Confirmada' : '📖 Clique para ler e aprovar'}
                    </span>
                  </div>
                  <Eye className={`h-4 w-4 shrink-0 ${isAck ? 'text-teal-600' : 'text-blue-600'}`} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Popup Modal para Preenchimento de Folha de Registo (FR) */}
      {activeFRPopup && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center p-4 pt-6 sm:pt-10 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActiveFRPopup(null)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-auto sm:my-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-industrial-blue dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="text-safety-orange" size={20} />
                {activeFRPopup.title}
              </h3>
              <button onClick={() => setActiveFRPopup(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFR} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{activeFRPopup.desc}</p>

              <div className="space-y-3">
                {activeFRPopup.fields.map((field: any) => (
                  <div key={field.name}>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {field.label} *
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        className="input text-xs font-bold"
                        required
                      >
                        <option value="">-- Selecionar estado --</option>
                        {field.options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        className="input text-xs font-bold"
                        required
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setActiveFRPopup(null)} className="btn-secondary text-xs py-2 px-4">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> {saving ? 'A guardar...' : 'Guardar Folha de Registo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Modal para Leitura e Aprovação de Instrução de Trabalho (IT) */}
      {activeITPopup && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center p-4 pt-6 sm:pt-10 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActiveITPopup(null)} />
          <div className="card relative w-full max-w-lg p-6 shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-auto sm:my-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-industrial-blue dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="text-teal-600" size={20} />
                {activeITPopup.title}
              </h3>
              <button onClick={() => setActiveITPopup(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                {activeITPopup.content}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setActiveITPopup(null)} className="btn-secondary text-xs py-2 px-4">
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => handleAcknowledgeIT(activeITPopup.id)}
                  disabled={saving}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" /> {saving ? 'A registar...' : 'Li e Confirmo o Procedimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
