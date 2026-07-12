'use client'

import { useState } from 'react'
import { Brain, Sparkles, Loader2, Info } from 'lucide-react'
import { askTaskConsultantAction } from './aiActions'

type AITaskConsultantProps = {
  taskId: string
  taskTitle: string
  assetId: string | null
  assetName: string | null
  interventionsCount: number
  aiCredits: number
  hasAiModule: boolean
}

export default function AITaskConsultant({ taskId, taskTitle, assetId, assetName, interventionsCount, aiCredits, hasAiModule }: AITaskConsultantProps) {
  const [response, setResponse] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [currentCredits, setCurrentCredits] = useState(aiCredits)

  if (!hasAiModule) return null

  async function handleAskAI() {
    if (currentCredits <= 0) {
      setError('Sem créditos IA disponíveis. Adquire mais na Loja de Módulos.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const result = await askTaskConsultantAction(taskId, {
        title: taskTitle,
        assetId,
        assetName,
        interventionsCount
      })
      if (result.error) {
        setError(result.error)
      } else {
        setResponse(result.answer || '')
        setCurrentCredits(result.remainingCredits || 0)
      }
    } catch (e) {
      setError('Ocorreu um erro ao comunicar com a IA.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-6 border border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-white to-purple-50/50 dark:from-slate-900 dark:to-purple-900/10 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
        <Brain className="w-24 h-24 text-purple-600" />
      </div>

      <div className="p-5 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-bold text-lg">Consultor IA</h3>
          </div>
          <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border border-purple-200 dark:border-purple-800">
            <span>{currentCredits} créditos restantes</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/50">
            {error}
          </div>
        )}

        {response ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-sm text-gray-700 dark:text-slate-300 border border-purple-100 dark:border-purple-800/50 leading-relaxed shadow-sm">
              {response}
            </div>
            <button 
              onClick={() => setResponse(null)}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              Fazer nova análise (custa 1 crédito)
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              O Consultor IA pode analisar o estado atual desta OT, os materiais usados e o tempo reportado para identificar padrões anómalos ou sugerir os próximos passos para a resolução técnica.
            </p>
            <button
              onClick={handleAskAI}
              disabled={busy || currentCredits <= 0}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {busy ? 'A analisar OT...' : 'Analisar OT (-1 crédito)'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
