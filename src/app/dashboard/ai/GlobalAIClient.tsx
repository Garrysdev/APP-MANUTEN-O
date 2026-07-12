'use client'

import { useState } from 'react'
import { Brain, Sparkles, Loader2, Send } from 'lucide-react'
import Link from 'next/link'

export default function GlobalAIClient({ hasAiModule, aiCredits }: { hasAiModule: boolean, aiCredits: number }) {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: 'Olá! Sou o teu Consultor IA. Podes perguntar-me sobre os teus equipamentos, tarefas pendentes, ou dicas sobre normas (ex: ISO 9001, NP EN 13306). Em que posso ajudar?' }
  ])
  const [busy, setBusy] = useState(false)
  const [currentCredits, setCurrentCredits] = useState(aiCredits)

  if (!hasAiModule) {
    return (
      <div className="card p-10 text-center max-w-2xl mx-auto mt-10 border-dashed border-purple-200 bg-purple-50/30">
        <Brain className="w-16 h-16 text-purple-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Consultor IA Bloqueado</h2>
        <p className="text-gray-500 mb-6">
          Para aceder ao Consultor IA global, deves ativar este módulo no Marketplace.
        </p>
        <Link href="/dashboard/marketplace" className="btn-primary inline-block">
          Ir para o Marketplace
        </Link>
      </div>
    )
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || busy) return

    if (currentCredits <= 0) {
      alert('Sem créditos IA disponíveis. Adquire mais na Loja de Módulos.')
      return
    }

    const userMsg = prompt.trim()
    setPrompt('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setBusy(true)

    // Simulate AI thinking and calling server action
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: `Simulação de resposta IA para: "${userMsg}". Com base no teu histórico e nas diretrizes da ISO 9001, recomendo focar na manutenção preventiva dos equipamentos críticos indicados no dashboard.` 
      }])
      setCurrentCredits(prev => prev - 1)
      setBusy(false)
    }, 1500)
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 text-purple-700">
          <div className="bg-purple-100 p-2 rounded-xl">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consultor IA</h1>
            <p className="text-sm text-gray-500">Tira dúvidas sobre o teu plano de manutenção</p>
          </div>
        </div>
        <div className="bg-purple-100 text-purple-700 text-xs px-3 py-1.5 rounded-full font-medium border border-purple-200">
          {currentCredits} créditos restantes
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-purple-50 dark:bg-purple-900/20 text-gray-800 dark:text-slate-200 border border-purple-100 dark:border-purple-800/50 rounded-bl-none'
              }`}>
                {msg.role === 'ai' && <Sparkles className="h-4 w-4 text-purple-400 mb-2" />}
                {msg.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-purple-50 dark:bg-purple-900/20 px-5 py-4 rounded-2xl rounded-bl-none border border-purple-100 dark:border-purple-800/50">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
              </div>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSend} className="p-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
          <div className="relative">
            <input 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Pergunta sobre um equipamento, norma ISO, ou otimização de custos..."
              className="input w-full pr-12 py-3 bg-white dark:bg-slate-900"
              disabled={busy || currentCredits <= 0}
            />
            <button 
              type="submit"
              disabled={busy || !prompt.trim() || currentCredits <= 0}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Cada mensagem consome 1 crédito de IA.
          </p>
        </form>
      </div>
    </div>
  )
}
