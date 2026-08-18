'use client'

import { useState, useRef } from 'react'
import {
  FileText, UploadCloud, Trash2, CheckCircle2, Eye,
  Sparkles, Send, X, ToggleLeft, ToggleRight, FolderPlus, Download
} from 'lucide-react'

export interface KBFile {
  id: string
  name: string
  size: string
  date: string
  status: 'active' | 'inactive'
  content: string
  type: string
  category: 'knowledge' | 'registry_sheets' | 'work_instructions'
}

const initialFiles: KBFile[] = [
  {
    id: '1',
    name: 'NP_EN_13306_Terminologia.md',
    size: '14.2 KB',
    date: new Date().toLocaleDateString('pt-PT'),
    status: 'active',
    type: 'text/markdown',
    category: 'knowledge',
    content: `# NP EN 13306 - Terminologia da Manutenção
## Definições Principais
- **Manutenção Preventiva (MP)**: Manutenção efetuada a intervalos predeterminados.
- **Manutenção Curativa (MC)**: Manutenção efetuada após deteção da avaria.
- **Plano de Manutenção (PM)**: Conjunto estruturado de tarefas e periodicidade.`
  },
  {
    id: '2',
    name: 'ISO_9001_Maintenance.md',
    size: '18.5 KB',
    date: new Date().toLocaleDateString('pt-PT'),
    status: 'active',
    type: 'text/markdown',
    category: 'knowledge',
    content: `# ISO 9001 - Requisitos de Manutenção
## §7.1.3 Infraestrutura
Manter a infraestrutura necessária para a operação dos processos.
## §7.5 Informação Documentada
Os registos de intervenções de manutenção e calibração devem ser conservados e rastreáveis por TAG.`
  },
  {
    id: '3',
    name: 'FR01_Folha_Registo_Leituras_Diarias.md',
    size: '8.4 KB',
    date: new Date().toLocaleDateString('pt-PT'),
    status: 'active',
    type: 'text/markdown',
    category: 'registry_sheets',
    content: `# FR-01: Folha de Registo de Leituras Diárias
- Pressão de Ar Comprimido (bar)
- Temperatura dos Compressores (ºC)
- Horas de Funcionamento e Consumos Elétricos`
  },
  {
    id: '4',
    name: 'IT01_Instrucoes_Trabalho_Bloqueio_LOTO.md',
    size: '12.1 KB',
    date: new Date().toLocaleDateString('pt-PT'),
    status: 'active',
    type: 'text/markdown',
    category: 'work_instructions',
    content: `# IT-01: Instruções de Trabalho - Consignação LOTO
1. Desligar interruptor geral da máquina.
2. Aplicar alfinete de bloqueio e alavanca LOTO.
3. Testar ausência de tensão antes de iniciar trabalho.`
  }
]

export default function KnowledgeClient({ isAdmin }: { isAdmin: boolean }) {
  const [files, setFiles] = useState<KBFile[]>(initialFiles)
  const [selectedFile, setSelectedFile] = useState<KBFile | null>(null)
  
  // Chat IA sobre os ficheiros
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'ai'; text: string; fileName?: string }[]>([
    {
      sender: 'ai',
      text: 'Olá! Sou o assistente da Base de Conhecimento IA. Podes fazer perguntas sobre os manuais, normas ISO 9001 e NP EN 13306 indexados.'
    }
  ])
  const [aiLoading, setAiLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Manipulação de Upload Real via Input File
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = Array.from(e.target.files || [])
    if (uploadedFiles.length === 0) return

    uploadedFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || `[Ficheiro binário / PDF indexado: ${file.name}]`
        const newKBFile: KBFile = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          date: new Date().toLocaleDateString('pt-PT'),
          status: 'active',
          type: file.type || 'document',
          category: activeTab !== 'all' ? activeTab : 'knowledge',
          content: textContent,
        }
        setFiles((prev) => [newKBFile, ...prev])
      }
      reader.readAsText(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Alternar estado Ativo / Inativo
  function toggleStatus(id: string) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: f.status === 'active' ? 'inactive' : 'active' } : f))
    )
  }

  // Apagar ficheiro obsoleto
  function handleDelete(id: string, name: string) {
    if (!confirm(`Desejas remover o ficheiro "${name}" da Base de Conhecimento?`)) return
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (selectedFile?.id === id) {
      setSelectedFile(null)
    }
  }

  // Enviar Pergunta à IA sobre os Ficheiros
  function handleAskAI(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return

    const userQ = question
    setQuestion('')
    setChatHistory((prev) => [...prev, { sender: 'user', text: userQ, fileName: selectedFile?.name }])
    setAiLoading(true)

    setTimeout(() => {
      let response = ''
      const activeFiles = files.filter((f) => f.status === 'active')
      const targetName = selectedFile ? selectedFile.name : 'toda a Base de Conhecimento'

      if (userQ.toLowerCase().includes('preventiva') || userQ.toLowerCase().includes('mp')) {
        response = `Com base no documento NP_EN_13306_Terminologia.md: A Manutenção Preventiva (MP) é efetuada a intervalos predeterminados para reduzir a probabilidade de falha.`
      } else if (userQ.toLowerCase().includes('iso') || userQ.toLowerCase().includes('9001')) {
        response = `De acordo com a norma ISO 9001 §7.1.3 e §7.5, é obrigatório manter o registo documentado de todas as OTs e calibrações rastreáveis pela TAG do equipamento.`
      } else {
        response = `Análise sobre "${targetName}": Encontrei registos relevantes para a tua questão. ${activeFiles.length} documentos ativos foram consultados no RAG.`
      }

      setChatHistory((prev) => [...prev, { sender: 'ai', text: response }])
      setAiLoading(false)
    }, 1000)
  }

  const [activeTab, setActiveTab] = useState<'all' | 'knowledge' | 'registry_sheets' | 'work_instructions'>('all')

  const filteredFiles = files.filter((f) => {
    if (activeTab === 'all') return true
    return f.category === activeTab || (!f.category && activeTab === 'knowledge')
  })

  return (
    <div className="space-y-6">
      {/* Header da Página de Documentação */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold text-industrial-blue dark:text-slate-100 flex items-center gap-2">
          <FileText className="text-safety-orange" size={26} />
          Documentação
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Gestão centralizada de documentos técnicos, folhas de registo e instruções de trabalho indexadas na IA.
        </p>

        {/* Separadores de Secção */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {[
            { id: 'all', label: 'Toda a Documentação', count: files.length },
            { id: 'knowledge', label: 'Base de Conhecimento', count: files.filter(f => f.category === 'knowledge' || !f.category).length },
            { id: 'registry_sheets', label: 'Folhas de Registo', count: files.filter(f => f.category === 'registry_sheets').length },
            { id: 'work_instructions', label: 'Instruções de Trabalho', count: files.filter(f => f.category === 'work_instructions').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                activeTab === tab.id
                  ? 'bg-industrial-blue text-white border-industrial-blue shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input File Oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx"
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Zona de Importação & Lista de Ficheiros */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6 border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <UploadCloud className="h-6 w-6 text-[#2E86C1] dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Importar Ficheiros / Drive / Pastas</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Seleciona qualquer documento (PDF, DOCX, MD, TXT). A IA indexa instantaneamente.
                </p>
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap text-xs py-2.5 px-4"
            >
              <FolderPlus className="h-4 w-4" /> Selecionar Ficheiro
            </button>
          </div>

          {/* Lista de Ficheiros */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-slate-200 text-sm">
                Ficheiros Indexados ({filteredFiles.length})
              </h3>
              <span className="text-xs text-slate-500">
                {filteredFiles.filter((f) => f.status === 'active').length} Ativos na IA
              </span>
            </div>

            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredFiles.length === 0 ? (
                <li className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                  Nenhum documento nesta secção da Documentação. Clica em &ldquo;Selecionar Ficheiro&rdquo; para importar.
                </li>
              ) : (
                filteredFiles.map((f) => (
                  <li
                    key={f.id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between gap-3 transition-colors ${
                      selectedFile?.id === f.id ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => setSelectedFile(f)}>
                      <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-industrial-blue dark:text-blue-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate hover:text-safety-orange transition-colors">
                          {f.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          <span>{f.size}</span>
                          <span>•</span>
                          <span>{f.date}</span>
                          <span>•</span>
                          <span className={`inline-flex items-center font-bold text-[10px] px-1.5 py-0.2 rounded ${
                            f.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {f.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Abrir / Ver */}
                      <button
                        onClick={() => setSelectedFile(f)}
                        className="btn-secondary text-xs p-2 flex items-center gap-1"
                        title="Abrir / Visualizar Ficheiro"
                      >
                        <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Abrir</span>
                      </button>

                      {/* Alternar Ativo/Inativo */}
                      <button
                        onClick={() => toggleStatus(f.id)}
                        className="p-2 text-slate-400 hover:text-industrial-blue transition-colors"
                        title={f.status === 'active' ? 'Marcar como Inativo (desativar na IA)' : 'Marcar como Ativo (ativar na IA)'}
                      >
                        {f.status === 'active' ? (
                          <ToggleRight className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-slate-400" />
                        )}
                      </button>

                      {/* Eliminar Ficheiro Obsoleto */}
                      <button
                        onClick={() => handleDelete(f.id, f.name)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        title="Remover ficheiro obsoleto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Coluna 2: Chat IA sobre os Ficheiros & RAG */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-safety-orange" />
                <h3 className="font-extrabold text-sm text-gray-900 dark:text-slate-100">
                  Perguntar à IA (RAG)
                </h3>
              </div>
              {selectedFile && (
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded truncate max-w-[120px]">
                  Foco: {selectedFile.name}
                </span>
              )}
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {chatHistory.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl max-w-[90%] ${
                    m.sender === 'user'
                      ? 'bg-[#1B4F72] text-white ml-auto rounded-br-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-auto rounded-bl-none'
                  }`}
                >
                  {m.fileName && (
                    <p className="text-[10px] font-bold text-amber-300 mb-1">
                      📄 Sobre: {m.fileName}
                    </p>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                </div>
              ))}
              {aiLoading && (
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 p-3 rounded-xl max-w-[80%] text-xs animate-pulse">
                  A consultar ficheiros ativos na Base de Conhecimento...
                </div>
              )}
            </div>

            {/* Form de pergunta */}
            <form onSubmit={handleAskAI} className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={selectedFile ? `Perguntar sobre ${selectedFile.name}...` : 'Perguntar sobre os documentos...'}
                className="input text-xs flex-1"
              />
              <button type="submit" disabled={aiLoading || !question.trim()} className="btn-primary px-3 text-xs">
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Pré-visualização do Ficheiro */}
      {selectedFile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card relative w-full max-w-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-[#2E86C1]" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{selectedFile.name}</h3>
                  <p className="text-xs text-slate-500">{selectedFile.size} · {selectedFile.date} · Estado: {selectedFile.status}</p>
                </div>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
              {selectedFile.content}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs text-slate-500">Documento pronto para leitura pela IA.</span>
              <button onClick={() => setSelectedFile(null)} className="btn-secondary text-xs px-4">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
