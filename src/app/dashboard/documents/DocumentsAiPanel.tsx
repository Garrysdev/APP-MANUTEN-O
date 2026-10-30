'use client'

import { useState } from 'react'
import { Sparkles, Send, Download } from 'lucide-react'
import { askDocumentsAction, type DocAnswer } from './actions'

type Msg = { sender: 'user' | 'ai'; text: string; sources?: DocAnswer['sources'] }

/** "Perguntar à IA" sobre os documentos da Gestão Documental (FR, IT, Manuais & Normas). */
export default function DocumentsAiPanel({ docCount }: { docCount: number }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    { sender: 'ai', text: `Faz uma pergunta sobre os ${docCount} documentos da Gestão Documental (Folhas de Registo, Instruções de Trabalho, Manuais & Normas).` },
  ])

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return
    setQuestion('')
    setMessages((m) => [...m, { sender: 'user', text: q }])
    setLoading(true)
    const res = await askDocumentsAction(q).catch(() => ({ response: '', sources: [], error: 'Erro ao contactar a IA.' }) as DocAnswer)
    setLoading(false)
    setMessages((m) => [...m, { sender: 'ai', text: res.error || res.response, sources: res.error ? [] : res.sources }])
  }

  return (
    <div className="card p-4 border border-slate-200 dark:border-slate-800 flex flex-col h-[520px]">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
        <Sparkles className="h-5 w-5 text-safety-orange" />
        <h3 className="font-extrabold text-sm text-gray-900 dark:text-slate-100">Perguntar à IA</h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl max-w-[92%] ${m.sender === 'user' ? 'bg-[#1B4F72] text-white ml-auto rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-auto rounded-bl-none'}`}
          >
            <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                {m.sources.slice(0, 6).map((s) => (
                  <p key={s.id} className="text-[11px] font-semibold flex items-center gap-1">
                    <span className="font-mono text-industrial-blue dark:text-blue-300">{s.code}</span>
                    {s.fileUrl ? (
                      <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1 truncate">
                        {s.title} <Download className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="truncate">{s.title}</span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 p-3 rounded-xl max-w-[80%] animate-pulse">A consultar os documentos…</div>
        )}
      </div>
      <form onSubmit={handleAsk} className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Perguntar sobre os documentos…"
          maxLength={500}
          className="input text-xs flex-1"
        />
        <button type="submit" disabled={loading || !question.trim()} className="btn-primary px-3 text-xs" aria-label="Enviar pergunta">
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  )
}
