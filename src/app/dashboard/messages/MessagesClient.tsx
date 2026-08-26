'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import {
  MessageSquare, Send, Plus, Search, Filter, Camera, Image as ImageIcon,
  CheckCheck, User, Users, ClipboardList, ShieldAlert, ArrowLeft, X, Paperclip,
} from 'lucide-react'
import type { InternalMessage } from '@/types/models'
import { formatDate, formatDateTime } from '@/lib/utils'
import { sendInternalMessageAction } from './actions'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'

interface UserRef {
  id: string
  name: string
  abbreviation?: string | null
  role?: string | null
  active?: boolean
  isExternal?: boolean
  avatarUrl?: string | null
}

interface TaskRef {
  id: string
  title: string
  area?: string
  tag?: string
  status: string
}

export default function MessagesClient({
  messages,
  users,
  tasks,
  currentUserId,
  currentUserName,
  currentUserAbbr,
  isManager,
}: {
  messages: InternalMessage[]
  users: UserRef[]
  tasks: TaskRef[]
  currentUserId: string
  currentUserName: string
  currentUserAbbr: string
  isManager: boolean
}) {
  const [localMessages, setLocalMessages] = useState<InternalMessage[]>(messages)
  const [filter, setFilter] = useState<'all' | 'inbox' | 'sent'>('all')
  const [techFilter, setTechFilter] = useState('')
  const [otFilter, setOtFilter] = useState<'all' | 'with_ot' | 'no_ot'>('all')
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with_photo'>('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<InternalMessage | null>(null)

  // Form State
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isTechRole = (role?: string | null) => {
    if (!role) return false
    const r = role.toLowerCase().trim()
    return r === 'technician' || r === 'tecnico' || r === 'técnico' || r === 'tech'
  }

  // Apenas técnicos ATIVOS e INTERNOS (exclui prestadores externos Schindler, Helenos, etc)
  const activeTechs = users
    .filter((u) => u.active !== false && !u.isExternal && u.role !== 'external' && u.role !== 'prestador' && isTechRole(u.role))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))

  // OTs ordenadas rigorosamente por ÁREA (depois TAG/Título)
  const sortedTasksForSelect = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const areaA = (a.area || 'Geral').toLowerCase().trim()
      const areaB = (b.area || 'Geral').toLowerCase().trim()
      const comp = areaA.localeCompare(areaB, 'pt', { numeric: true })
      if (comp !== 0) return comp
      const tagA = (a.tag || a.title).toLowerCase().trim()
      const tagB = (b.tag || b.title).toLowerCase().trim()
      return tagA.localeCompare(tagB, 'pt', { numeric: true })
    })
  }, [tasks])

  const filteredMessages = localMessages.filter((m) => {
    // 1. Folder (Inbox / Sent)
    if (filter === 'inbox' && m.senderId === currentUserId) return false
    if (filter === 'sent' && m.senderId !== currentUserId) return false

    // 2. Tech filter (sender or recipient)
    if (techFilter) {
      const selectedUserObj = users.find((u) => u.id === techFilter || u.abbreviation === techFilter)
      const matchesSender = m.senderId === techFilter || (selectedUserObj && (m.senderName === selectedUserObj.name || m.senderAbbr === selectedUserObj.abbreviation))
      const matchesRecipient = (m.recipientIds || []).includes(techFilter) || (selectedUserObj && (m.recipientNames || '').includes(selectedUserObj.name))
      if (!matchesSender && !matchesRecipient) return false
    }

    // 3. OT filter
    if (otFilter === 'with_ot' && !m.taskId) return false
    if (otFilter === 'no_ot' && m.taskId) return false

    // 4. Photo filter
    if (photoFilter === 'with_photo' && !m.photoUrl) return false

    // 5. Date filter
    if (dateStart && m.createdAt) {
      const msgDate = m.createdAt.slice(0, 10)
      if (msgDate < dateStart) return false
    }
    if (dateEnd && m.createdAt) {
      const msgDate = m.createdAt.slice(0, 10)
      if (msgDate > dateEnd) return false
    }

    // 6. Text Search
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchText = (
        (m.content || '') + ' ' +
        (m.subject || '') + ' ' +
        (m.senderName || '') + ' ' +
        (m.senderAbbr || '') + ' ' +
        (m.recipientNames || '') + ' ' +
        (m.taskTitle || '')
      ).toLowerCase()
      if (!matchText.includes(q)) return false
    }

    return true
  })

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhotoFile(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
  }

  function handleSelectAll() {
    if (selectedTechIds.includes('ALL')) {
      setSelectedTechIds([])
    } else {
      setSelectedTechIds(['ALL'])
    }
  }

  function toggleTech(id: string) {
    if (selectedTechIds.includes('ALL')) {
      setSelectedTechIds([id])
      return
    }
    if (selectedTechIds.includes(id)) {
      setSelectedTechIds(selectedTechIds.filter((t) => t !== id))
    } else {
      setSelectedTechIds([...selectedTechIds, id])
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) {
      setError('Escreva o conteúdo da mensagem.')
      return
    }
    if (!selectedTechIds.length) {
      setError('Selecione pelo menos um técnico destinatário.')
      return
    }

    setBusy(true)
    setError('')

    try {
      let photoUrl: string | null = null
      if (photoFile) {
        try {
          photoUrl = await uploadImage(photoFile, 'messages')
        } catch (err) {
          console.error('Erro no upload de foto da mensagem:', err)
        }
      }

      const recipientNamesText = selectedTechIds.includes('ALL')
        ? 'Todos os Técnicos'
        : selectedTechIds
            .map((id) => {
              const u = users.find((usr) => usr.id === id)
              return u ? (u.abbreviation ? `[${u.abbreviation}] ${u.name}` : u.name) : id
            })
            .join(', ')

      const formData = new FormData()
      formData.set('content', content.trim())
      formData.set('recipientIds', JSON.stringify(selectedTechIds))
      formData.set('recipientNames', recipientNamesText)
      if (subject.trim()) formData.set('subject', subject.trim())
      if (selectedTaskId) {
        const t = tasks.find((tk) => tk.id === selectedTaskId)
        formData.set('taskId', selectedTaskId)
        if (t) formData.set('taskTitle', t.title)
      }
      if (photoUrl) formData.set('photoUrl', photoUrl)

      const res = await sendInternalMessageAction({}, formData)
      setBusy(false)

      if (res.error) {
        setError(res.error)
      } else {
        const newMsgObj: InternalMessage = {
          id: res.messageId || 'msg_' + Date.now(),
          companyId: '',
          senderId: currentUserId,
          senderName: currentUserName,
          senderAbbr: currentUserAbbr,
          recipientIds: selectedTechIds,
          recipientNames: recipientNamesText,
          subject: subject.trim() || null,
          content: content.trim(),
          taskId: selectedTaskId || null,
          taskTitle: selectedTaskId ? (tasks.find((tk) => tk.id === selectedTaskId)?.title || null) : null,
          photoUrl: photoUrl || null,
          createdAt: new Date().toISOString(),
        }
        setLocalMessages((prev) => [newMsgObj, ...prev])
        setModalOpen(false)
        setContent('')
        setSubject('')
        setSelectedTaskId('')
        setSelectedTechIds([])
        setPhotoFile(null)
        setPhotoFile(null)
        setPhotoPreview(null)
      }
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-industrial-blue dark:text-sky-400 rounded-xl">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Mensagens Internas & Comunicação Técnica
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comunicação em tempo real para equipa de manutenção e técnicos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-md text-sm font-bold cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Mensagem</span>
        </button>
      </div>

      {/* Painel Completo de Filtros (Estilo Tabela) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Filter className="h-4 w-4 text-industrial-blue dark:text-sky-400" />
            <span>Filtros de Mensagens</span>
          </span>
          {(filter !== 'all' || techFilter || otFilter !== 'all' || photoFilter !== 'all' || dateStart || dateEnd || search) && (
            <button
              onClick={() => {
                setFilter('all')
                setTechFilter('')
                setOtFilter('all')
                setPhotoFilter('all')
                setDateStart('')
                setDateEnd('')
                setSearch('')
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Pesquisa */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Pesquisar Conteúdo / OT
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Texto, assunto, remetente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-8 text-xs font-semibold w-full"
              />
            </div>
          </div>

          {/* 2. Pasta / Origem */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Pasta
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="all">📥 Todas as Mensagens ({localMessages.length})</option>
              <option value="inbox">📬 Recebidas</option>
              <option value="sent">📤 Enviadas por mim</option>
            </select>
          </div>

          {/* 3. Filtro por Técnico */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Técnico (Destinatário / Remetente)
            </label>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="">-- Todos os Técnicos --</option>
              {activeTechs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.abbreviation ? `[${u.abbreviation}] ` : ''}{u.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Associação a OT */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Ligação a OT
            </label>
            <select
              value={otFilter}
              onChange={(e) => setOtFilter(e.target.value as any)}
              className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="all">Todas as Mensagens</option>
              <option value="with_ot">⚙️ Apenas com OT Associada</option>
              <option value="no_ot">💬 Sem OT Associada</option>
            </select>
          </div>

          {/* 5. Fotos / Anexos */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Imagens / Fotos
            </label>
            <select
              value={photoFilter}
              onChange={(e) => setPhotoFilter(e.target.value as any)}
              className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="all">Todas as Mensagens</option>
              <option value="with_photo">📷 Apenas com Foto Anexada</option>
            </select>
          </div>

          {/* 6. Data Início */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="input text-xs font-bold w-full"
            />
          </div>

          {/* 7. Data Fim */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="input text-xs font-bold w-full"
            />
          </div>
        </div>

        {/* Resumo de Contagem */}
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <span>A mostrar <strong className="text-industrial-blue dark:text-sky-400">{filteredMessages.length}</strong> de <strong>{localMessages.length}</strong> mensagens</span>
        </div>
      </div>

      {/* Listagem de Mensagens */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma mensagem encontrada</h3>
            <p className="text-xs text-slate-500 mt-1">
              Envie uma mensagem aos técnicos para iniciar a comunicação.
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isSentByMe = msg.senderId === currentUserId
            return (
              <div
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-industrial-blue dark:text-sky-400 font-black text-xs flex items-center justify-center border border-blue-200 dark:border-blue-700">
                      {msg.senderAbbr || 'RG'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                          {msg.senderName}
                        </span>
                        {isSentByMe && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold">
                            Você
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Para: <strong className="text-slate-700 dark:text-slate-300">{msg.recipientNames || 'Técnicos'}</strong>
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    {formatDateTime(msg.createdAt)}
                  </span>
                </div>

                {msg.subject && (
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {msg.subject}
                  </h4>
                )}

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {msg.content}
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  {msg.taskTitle ? (
                    <span className="inline-flex items-center gap-1 text-industrial-blue dark:text-sky-400 font-semibold bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-slate-700">
                      <ClipboardList className="h-3 w-3" /> OT: {msg.taskTitle}
                    </span>
                  ) : <span />}

                  {msg.photoUrl && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <ImageIcon className="h-3.5 w-3.5" /> Foto Anexa
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal de Detalhe da Mensagem */}
      {selectedMessage && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-industrial-blue text-white font-black text-xs flex items-center justify-center">
                  {selectedMessage.senderAbbr || 'RG'}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedMessage.senderName}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDateTime(selectedMessage.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-500">
                Para: <strong className="text-slate-800 dark:text-slate-200">{selectedMessage.recipientNames || 'Técnicos'}</strong>
              </div>
              {selectedMessage.subject && (
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedMessage.subject}
                </div>
              )}
              <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                {selectedMessage.content}
              </div>

              {selectedMessage.photoUrl && (
                <div className="mt-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Imagem Anexada:
                  </span>
                  <a href={selectedMessage.photoUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={selectedMessage.photoUrl}
                      alt="Anexo"
                      className="max-h-60 rounded-xl border border-slate-200 shadow-sm object-cover hover:opacity-95 transition-opacity"
                    />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedMessage(null)}
                className="btn-secondary px-4 py-2 text-xs font-bold rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Nova Mensagem */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Send className="h-5 w-5 text-industrial-blue dark:text-sky-400" />
                <span>Nova Mensagem Interna</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seleção de Técnicos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Destinatário(s) *
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] font-bold text-industrial-blue dark:text-sky-400 hover:underline"
                  >
                    {selectedTechIds.includes('ALL') ? 'Desmarcar Todos' : 'Enviar para Todos os Técnicos'}
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300 cursor-pointer p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                    <input
                      type="checkbox"
                      checked={selectedTechIds.includes('ALL')}
                      onChange={handleSelectAll}
                      className="rounded accent-blue-600 h-4 w-4"
                    />
                    <span>📢 TODOS OS TÉCNICOS (Mensagem Geral / Transmissão)</span>
                  </label>

                  {!selectedTechIds.includes('ALL') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {activeTechs.map((u) => {
                        const checked = selectedTechIds.includes(u.id)
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTech(u.id)}
                              className="rounded accent-blue-600 h-3.5 w-3.5"
                            />
                            <span className="truncate">
                              {u.abbreviation ? `[${u.abbreviation}] ` : ''}{u.name}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Assunto e OT associada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assunto (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex.: Aviso sobre Bomba P-02"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Associar a OT (Opcional)
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="input text-xs font-bold"
                  >
                    <option value="">-- Nenhuma OT selecionada --</option>
                    {sortedTasksForSelect.map((t: TaskRef) => (
                      <option key={t.id} value={t.id}>
                        📍 [{t.area || 'Geral'}] 🏷️ [{t.tag || t.id}] — {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Texto da mensagem */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Conteúdo da Mensagem *
                </label>
                <textarea
                  rows={3}
                  placeholder="Escreva aqui a mensagem interna..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input text-xs"
                  required
                />
              </div>

              {/* Anexo de Foto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Anexar Foto (Opcional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 font-bold"
                  >
                    <Camera className="h-4 w-4 text-safety-orange" />
                    <span>{photoFile ? 'Alterar Foto' : 'Tirar ou Escolher Foto'}</span>
                  </button>

                  {photoPreview && (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="h-10 w-10 object-cover rounded-lg border border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null)
                          setPhotoPreview(null)
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 text-[9px]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-2"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{busy ? 'A enviar...' : 'Enviar Mensagem'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
