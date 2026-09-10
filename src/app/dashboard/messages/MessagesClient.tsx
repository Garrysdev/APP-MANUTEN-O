'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Send, Plus, Search, Filter, Camera, Image as ImageIcon,
  CheckCheck, User, Users, ClipboardList, ShieldAlert, ArrowLeft, X, Paperclip,
  Clock, Reply, CheckCircle2, Info, Check, RefreshCw, Trash2, Wrench, ChevronDown, ChevronUp
} from 'lucide-react'
import type { InternalMessage, MessageStatus } from '@/types/models'
import { MESSAGE_STATUS_LABELS } from '@/types/models'
import { formatDateTime } from '@/lib/utils'
import { sendInternalMessageAction, updateMessageStatusAction, deleteInternalMessageAction } from './actions'
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

interface AssetRef {
  id: string
  name: string
  tag?: string
  area?: string
}

export default function MessagesClient({
  messages,
  users,
  tasks,
  assets = [],
  currentUserId,
  currentUserName,
  currentUserAbbr,
  isManager,
}: {
  messages: InternalMessage[]
  users: UserRef[]
  tasks: TaskRef[]
  assets?: AssetRef[]
  currentUserId: string
  currentUserName: string
  currentUserAbbr: string
  isManager: boolean
}) {
  const router = useRouter()
  const STORAGE_KEY = 'rg_internal_messages_cache'
  const STORAGE_RESET_KEY = 'rg_msgs_cleared_v3'
  const [localMessages, setLocalMessages] = useState<InternalMessage[]>(messages)

  const isSeedMessage = (m?: InternalMessage | null) => {
    if (!m || !m.id) return true
    if (m.id.startsWith('msg_seed_')) return true
    if (m.id === 'msg_seed_1' || m.id === 'msg_seed_2' || m.id === 'msg_seed_3' || m.id === 'msg_seed_4' || m.id === 'msg_seed_5') return true
    return false
  }

  const persistMessages = (list: InternalMessage[]) => {
    try {
      if (typeof window !== 'undefined') {
        const clean = list.filter((m) => !isSeedMessage(m))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean.slice(0, 100)))
      }
    } catch {}
  }

  // Abertura automática de mensagem via notificação do sino ou URL (?msgId=...&open=true)
  useEffect(() => {
    function checkUrlForMessage() {
      if (typeof window === 'undefined') return
      const params = new URLSearchParams(window.location.search)
      const msgId = params.get('msgId')
      if (msgId) {
        const found = localMessages.find((m) => m.id === msgId)
        if (found) {
          setSelectedMessage(found)
        } else {
          fetch('/api/messages')
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data?.messages)) {
                const target = data.messages.find((m: any) => m.id === msgId)
                if (target) {
                  setSelectedMessage(target)
                  setLocalMessages((prev) => [target, ...prev.filter((p) => p.id !== target.id)])
                }
              }
            })
            .catch(() => {})
        }
      }
    }

    checkUrlForMessage()

    function handleOpenNotif(e: any) {
      const link = e?.detail?.link || ''
      if (link && link.includes('/dashboard/messages')) {
        try {
          const url = new URL(link, window.location.origin)
          const msgId = url.searchParams.get('msgId')
          if (msgId) {
            const found = localMessages.find((m) => m.id === msgId)
            if (found) {
              setSelectedMessage(found)
            } else {
              fetch('/api/messages')
                .then((r) => r.json())
                .then((data) => {
                  if (Array.isArray(data?.messages)) {
                    const target = data.messages.find((m: any) => m.id === msgId)
                    if (target) {
                      setSelectedMessage(target)
                      setLocalMessages((prev) => [target, ...prev.filter((p) => p.id !== target.id)])
                    }
                  }
                })
                .catch(() => {})
            }
          }
        } catch {}
      }
    }

    window.addEventListener('rg:open-notification', handleOpenNotif)
    return () => window.removeEventListener('rg:open-notification', handleOpenNotif)
  }, [localMessages])

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      let storedList: InternalMessage[] = []
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            storedList = parsed.filter((m) => !isSeedMessage(m))
          }
        } catch {}
      }

      // Merge: mensagens reais do servidor + mensagens locais guardadas no browser
      const map = new Map<string, InternalMessage>()
      storedList.forEach((m) => { if (m?.id && !isSeedMessage(m)) map.set(m.id, m) })
      messages.forEach((m) => { if (m?.id && !isSeedMessage(m)) map.set(m.id, m) })

      const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setLocalMessages(merged)
      persistMessages(merged)

      // Se houver mensagens locais reais, sincronizar com o servidor em background
      if (merged.length > 0) {
        fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: merged }),
        }).catch(() => {})
      } else {
        // Tentar obter mensagens frescas do servidor se a lista estiver vazia
        fetch('/api/messages')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data?.messages) && data.messages.length > 0) {
              const fresh: InternalMessage[] = data.messages.filter((m: any) => !isSeedMessage(m))
              if (fresh.length > 0) {
                setLocalMessages((prev) => {
                  const m = new Map<string, InternalMessage>()
                  prev.forEach((item) => { if (item?.id && !isSeedMessage(item)) m.set(item.id, item) })
                  fresh.forEach((item: InternalMessage) => { if (item?.id && !isSeedMessage(item)) m.set(item.id, item) })
                  const res = Array.from(m.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                  persistMessages(res)
                  return res
                })
              }
            }
          })
          .catch(() => {})
      }
    } catch {
      const clean = messages.filter((m) => !isSeedMessage(m))
      setLocalMessages(clean)
    }
  }, [messages])
  const [filter, setFilter] = useState<'all' | 'inbox' | 'sent'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | MessageStatus>('all')
  const [techFilter, setTechFilter] = useState('')
  const [otFilter, setOtFilter] = useState<'all' | 'with_ot' | 'no_ot'>('all')
  const [photoFilter, setPhotoFilter] = useState<'all' | 'with_photo'>('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const hasActiveFilters = filter !== 'all' || statusFilter !== 'all' || Boolean(techFilter) || otFilter !== 'all' || photoFilter !== 'all' || Boolean(dateStart) || Boolean(dateEnd) || Boolean(search.trim())
  const activeFiltersCount = (filter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (techFilter ? 1 : 0) + (otFilter !== 'all' ? 1 : 0) + (photoFilter !== 'all' ? 1 : 0) + (dateStart ? 1 : 0) + (dateEnd ? 1 : 0) + (search.trim() ? 1 : 0)

  // Modal / Composer State
  const [modalOpen, setModalOpen] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState<InternalMessage | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<InternalMessage | null>(null)

  // Form State
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [requiresResponse, setRequiresResponse] = useState<boolean>(true)
  const [messageStatus, setMessageStatus] = useState<MessageStatus>('awaiting_reply')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Resposta Rápida Direta (no detalhe da mensagem)
  const [directReplyContent, setDirectReplyContent] = useState('')
  const [directPhotoFile, setDirectPhotoFile] = useState<File | null>(null)
  const [directPhotoPreview, setDirectPhotoPreview] = useState<string | null>(null)
  const [directBusy, setDirectBusy] = useState(false)
  const [directError, setDirectError] = useState('')
  const directFileInputRef = useRef<HTMLInputElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isTechRole = (role?: string | null) => {
    if (!role) return false
    const r = role.toLowerCase().trim()
    return r === 'technician' || r === 'tecnico' || r === 'técnico' || r === 'tech'
  }

  const isManagerRole = (role?: string | null) => {
    if (!role) return false
    const r = role.toLowerCase().trim()
    return r === 'manager' || r === 'admin' || r === 'gestor' || r === 'administrador'
  }

  // Lista APENAS de técnicos e utilizadores disponíveis (Gestores NUNCA aparecem nos técnicos)
  const activeTechs = useMemo(() => {
    const list = users.filter((u) => {
      if (u.active === false) return false
      if (u.isExternal) return false
      const r = (u.role || '').toLowerCase().trim()
      if (isManagerRole(r)) return false
      if (u.name?.toLowerCase().includes('garrido') || u.abbreviation === 'RG' || (u as any).email?.toLowerCase().includes('garrido.rui')) return false
      return isTechRole(r) || u.id === 'mWSsTRtgq5QcOHusTdVYgDVrwHt2'
    })

    if (!list.some((u) => u.id === 'mWSsTRtgq5QcOHusTdVYgDVrwHt2' || u.name?.includes('RuiG'))) {
      list.push({
        id: 'mWSsTRtgq5QcOHusTdVYgDVrwHt2',
        name: 'RuiG',
        abbreviation: 'RU',
        role: 'technician',
        active: true,
        isExternal: false,
      })
    }

    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  }, [users])

  // Equipamentos ordenados por ÁREA e TAG
  const sortedAssetsForSelect = useMemo(() => {
    return [...assets].sort((a, b) => {
      const areaA = (a.area || 'Geral').toLowerCase().trim()
      const areaB = (b.area || 'Geral').toLowerCase().trim()
      const comp = areaA.localeCompare(areaB, 'pt', { numeric: true })
      if (comp !== 0) return comp
      return (a.tag || a.name).localeCompare(b.tag || b.name, 'pt', { numeric: true })
    })
  }, [assets])

  // OTs ordenadas por ÁREA e TAG
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
    // 1. Folder (Inbox / Sent) - estritamente por ID único de remetente
    const isSentByMe =
      m.senderId === currentUserId ||
      (currentUserId && m.senderId?.toLowerCase() === currentUserId.toLowerCase())

    if (filter === 'inbox' && isSentByMe) return false
    if (filter === 'sent' && !isSentByMe) return false

    // 2. Status filter
    const effectiveStatus = m.status || (m.requiresResponse ? 'awaiting_reply' : 'info')
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false

    // 3. Tech filter (sender or recipient)
    if (techFilter) {
      const selectedUserObj = users.find((u) => u.id === techFilter || u.abbreviation === techFilter)
      const matchesSender = m.senderId === techFilter || (selectedUserObj && (m.senderName === selectedUserObj.name || m.senderAbbr === selectedUserObj.abbreviation))
      const matchesRecipient = (m.recipientIds || []).includes(techFilter) || (selectedUserObj && (m.recipientNames || '').includes(selectedUserObj.name))
      if (!matchesSender && !matchesRecipient) return false
    }

    // 4. OT filter
    if (otFilter === 'with_ot' && !m.taskId) return false
    if (otFilter === 'no_ot' && m.taskId) return false

    // 5. Photo filter
    if (photoFilter === 'with_photo' && !m.photoUrl) return false

    // 6. Date filter
    if (dateStart && m.createdAt) {
      const msgDate = m.createdAt.slice(0, 10)
      if (msgDate < dateStart) return false
    }
    if (dateEnd && m.createdAt) {
      const msgDate = m.createdAt.slice(0, 10)
      if (msgDate > dateEnd) return false
    }

    // 7. Text Search
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

  // Abrir modal de Nova Mensagem
  function handleOpenCreate() {
    setReplyToMessage(null)
    setSelectedTechIds([])
    setSubject('')
    setContent('')
    setSelectedTaskId('')
    setSelectedAssetId('')
    setRequiresResponse(true)
    setMessageStatus('awaiting_reply')
    setPhotoFile(null)
    setPhotoPreview(null)
    setError('')
    setModalOpen(true)
  }

  // Abrir o MESMO menu de mensagem para Responder
  function handleOpenReply(msg: InternalMessage) {
    setReplyToMessage(msg)
    setSelectedMessage(null) // Fecha o modal de detalhe se estiver aberto

    // Pre-selecionar o remetente original como destinatário
    const senderObj = users.find((u) => u.id === msg.senderId || (u.name && u.name.toLowerCase() === msg.senderName.toLowerCase()))
    if (senderObj) {
      setSelectedTechIds([senderObj.id])
    } else if (msg.senderId) {
      setSelectedTechIds([msg.senderId])
    } else {
      setSelectedTechIds([])
    }

    // Pre-definir assunto com Re:
    const baseSubject = msg.subject || (msg.taskTitle ? `OT ${msg.taskTitle}` : 'Mensagem')
    setSubject(baseSubject.startsWith('Re:') ? baseSubject : `Re: ${baseSubject}`)

    // Pre-definir OT e Equipamento se existirem
    setSelectedTaskId(msg.taskId || '')
    setSelectedAssetId(msg.assetId || '')

    // Por defeito, uma resposta responde e pode pedir esclarecimento adicional ou fechar
    setRequiresResponse(false)
    setMessageStatus('replied')
    setContent('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setError('')
    setModalOpen(true)
  }

  async function handleDirectPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setDirectPhotoFile(compressed)
    setDirectPhotoPreview(URL.createObjectURL(compressed))
  }

  async function handleDirectReplySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMessage) return
    if (!directReplyContent.trim()) {
      setDirectError('Por favor escreva a sua resposta.')
      return
    }

    setDirectBusy(true)
    setDirectError('')

    try {
      let photoUrl: string | null = null
      if (directPhotoFile) {
        try {
          photoUrl = await uploadImage(directPhotoFile, 'messages')
        } catch (err) {
          console.error('Erro no upload de foto da resposta rápida:', err)
        }
      }

      const senderObj = users.find((u) => u.id === selectedMessage.senderId || (u.name && u.name.toLowerCase() === selectedMessage.senderName.toLowerCase()))
      const targetRecipientIds = senderObj ? [senderObj.id] : (selectedMessage.senderId ? [selectedMessage.senderId] : [])
      const recipientNamesText = senderObj ? (senderObj.abbreviation ? `[${senderObj.abbreviation}] ${senderObj.name}` : senderObj.name) : selectedMessage.senderName

      const formData = new FormData()
      formData.set('content', directReplyContent.trim())
      formData.set('recipientIds', JSON.stringify(targetRecipientIds))
      formData.set('recipientNames', recipientNamesText)
      formData.set('status', 'replied')
      formData.set('requiresResponse', 'false')

      const baseSubject = selectedMessage.subject || (selectedMessage.taskTitle ? `OT ${selectedMessage.taskTitle}` : 'Mensagem')
      formData.set('subject', baseSubject.startsWith('Re:') ? baseSubject : `Re: ${baseSubject}`)

      if (selectedMessage.taskId) {
        formData.set('taskId', selectedMessage.taskId)
        if (selectedMessage.taskTitle) formData.set('taskTitle', selectedMessage.taskTitle)
      }
      if (selectedMessage.assetId) {
        formData.set('assetId', selectedMessage.assetId)
        if (selectedMessage.assetTag) formData.set('assetTag', selectedMessage.assetTag)
        if (selectedMessage.assetName) formData.set('assetName', selectedMessage.assetName)
      }
      if (photoUrl) formData.set('photoUrl', photoUrl)

      formData.set('replyToId', selectedMessage.id)
      formData.set('replyToSubject', selectedMessage.subject || selectedMessage.taskTitle || 'Mensagem')
      formData.set('replyToSender', selectedMessage.senderName)
      formData.set('replyToContent', selectedMessage.content.slice(0, 150))

      const res = await sendInternalMessageAction({}, formData)
      setDirectBusy(false)

      if (res.error) {
        setDirectError(res.error)
      } else {
        const newMsgObj: InternalMessage = {
          id: res.messageId || 'msg_' + Date.now(),
          companyId: '',
          senderId: currentUserId,
          senderName: currentUserName,
          senderAbbr: currentUserAbbr,
          recipientIds: targetRecipientIds,
          recipientNames: recipientNamesText,
          subject: baseSubject.startsWith('Re:') ? baseSubject : `Re: ${baseSubject}`,
          content: directReplyContent.trim(),
          taskId: selectedMessage.taskId || null,
          taskTitle: selectedMessage.taskTitle || null,
          assetId: selectedMessage.assetId || null,
          assetTag: selectedMessage.assetTag || null,
          assetName: selectedMessage.assetName || null,
          photoUrl: photoUrl || null,
          status: 'replied',
          requiresResponse: false,
          replyToId: selectedMessage.id,
          replyToSubject: selectedMessage.subject || null,
          replyToSender: selectedMessage.senderName,
          replyToContent: selectedMessage.content ? selectedMessage.content.slice(0, 150) : null,
          createdAt: new Date().toISOString(),
        }

        // Atualizar estado da mensagem original para 'replied' e adicionar nova mensagem
        const updatedList = [
          newMsgObj,
          ...localMessages.map((m) => (m.id === selectedMessage.id ? { ...m, status: 'replied' as MessageStatus } : m)),
        ]
        setLocalMessages(updatedList)
        persistMessages(updatedList)
        setSelectedMessage((prev) => (prev ? { ...prev, status: 'replied' } : null))

        setDirectReplyContent('')
        setDirectPhotoFile(null)
        setDirectPhotoPreview(null)
        router.refresh()
      }
    } catch (err) {
      setDirectBusy(false)
      setDirectError(err instanceof Error ? err.message : 'Erro ao enviar resposta.')
    }
  }

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

  // Alteração direta de estado da mensagem (Aguarda Resposta, Respondida, Informativa, Fechada)
  async function handleUpdateStatus(messageId: string, newStatus: MessageStatus) {
    setStatusUpdatingId(messageId)
    // Atualização otimista local
    const updated = localMessages.map((m) => (m.id === messageId ? { ...m, status: newStatus } : m))
    setLocalMessages(updated)
    persistMessages(updated)
    if (selectedMessage && selectedMessage.id === messageId) {
      setSelectedMessage((prev) => (prev ? { ...prev, status: newStatus } : null))
    }

    const res = await updateMessageStatusAction(messageId, newStatus)
    setStatusUpdatingId(null)
    if (!res.ok && res.error) {
      alert(`Erro ao atualizar estado: ${res.error}`)
    } else {
      router.refresh()
    }
  }

  // Apagar mensagem permanentemente (apenas para Admin / Gestor)
  async function handleDeleteMessage(messageId: string) {
    if (!isManager) return
    if (!window.confirm('Tem a certeza que deseja apagar esta mensagem permanentemente?')) return

    const updated = localMessages.filter((m) => m.id !== messageId)
    setLocalMessages(updated)
    persistMessages(updated)
    if (selectedMessage && selectedMessage.id === messageId) {
      setSelectedMessage(null)
    }

    const res = await deleteInternalMessageAction(messageId)
    if (!res.ok && res.error) {
      alert(`Erro ao apagar mensagem: ${res.error}`)
    } else {
      router.refresh()
    }
  }

  async function handleClearAll() {
    if (!isManager) return
    if (!window.confirm('Tem a certeza que deseja apagar permanentemente todas as mensagens para reiniciar o histórico?')) return
    setBusy(true)
    try {
      const { clearAllMessagesAction } = await import('./actions')
      await clearAllMessagesAction()
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
      setLocalMessages([])
      setSelectedMessage(null)
      setBusy(false)
      router.refresh()
    } catch (err: any) {
      setBusy(false)
      alert(err?.message || 'Erro ao limpar mensagens.')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!content.trim()) {
      setError('Escreva o conteúdo da mensagem.')
      return
    }

    let finalRecipientIds = [...selectedTechIds]
    if (replyToMessage) {
      if (finalRecipientIds.length === 0 || finalRecipientIds.includes('ALL')) {
        const sObj = users.find((u) => u.id === replyToMessage.senderId || (u.name && u.name.toLowerCase() === replyToMessage.senderName.toLowerCase()))
        if (sObj) finalRecipientIds = [sObj.id]
        else if (replyToMessage.senderId) finalRecipientIds = [replyToMessage.senderId]
      }
    }

    if (!finalRecipientIds.length) {
      setError('Selecione pelo menos um destinatário.')
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

      const finalStatus: MessageStatus = messageStatus || (requiresResponse ? 'awaiting_reply' : 'info')

      const formData = new FormData()
      formData.set('content', content.trim())
      formData.set('recipientIds', JSON.stringify(selectedTechIds))
      formData.set('recipientNames', recipientNamesText)
      formData.set('status', finalStatus)
      formData.set('requiresResponse', requiresResponse ? 'true' : 'false')

      if (replyToMessage) {
        formData.set('replyToId', replyToMessage.id)
        const replySubj = replyToMessage.subject
          ? (replyToMessage.subject.startsWith('Re:') ? replyToMessage.subject : `Re: ${replyToMessage.subject}`)
          : (replyToMessage.taskTitle ? `Re: OT ${replyToMessage.taskTitle}` : 'Resposta')
        formData.set('replyToSubject', replySubj)
        formData.set('subject', replySubj)
        formData.set('replyToSender', replyToMessage.senderName)
        formData.set('replyToContent', replyToMessage.content.slice(0, 150))
        if (replyToMessage.taskId) {
          formData.set('taskId', replyToMessage.taskId)
          if (replyToMessage.taskTitle) formData.set('taskTitle', replyToMessage.taskTitle)
        }
      } else {
        if (subject.trim()) formData.set('subject', subject.trim())
        if (selectedTaskId) {
          const t = tasks.find((tk) => tk.id === selectedTaskId)
          formData.set('taskId', selectedTaskId)
          if (t) formData.set('taskTitle', t.title)
        }
      }

      const res = await sendInternalMessageAction({}, formData)
      setBusy(false)

      if (res.error) {
        setError(res.error)
      } else {
        const replySubj = replyToMessage?.subject
          ? (replyToMessage.subject.startsWith('Re:') ? replyToMessage.subject : `Re: ${replyToMessage.subject}`)
          : (replyToMessage?.taskTitle ? `Re: OT ${replyToMessage.taskTitle}` : null)

        const newMsgObj: InternalMessage = {
          id: res.messageId || 'msg_' + Date.now(),
          companyId: '',
          senderId: currentUserId,
          senderName: currentUserName,
          senderAbbr: currentUserAbbr,
          recipientIds: selectedTechIds,
          recipientNames: recipientNamesText,
          subject: replyToMessage ? replySubj : (subject.trim() || null),
          content: content.trim(),
          taskId: replyToMessage ? (replyToMessage.taskId || null) : (selectedTaskId || null),
          taskTitle: replyToMessage ? (replyToMessage.taskTitle || null) : (selectedTaskId ? (tasks.find((tk) => tk.id === selectedTaskId)?.title || null) : null),
          photoUrl: photoUrl || null,
          status: finalStatus,
          requiresResponse,
          replyToId: replyToMessage?.id || null,
          replyToSubject: replyToMessage?.subject || null,
          replyToSender: replyToMessage?.senderName || null,
          replyToContent: replyToMessage?.content ? replyToMessage.content.slice(0, 150) : null,
          createdAt: new Date().toISOString(),
        }

        // Se for resposta, atualizar também a mensagem original para 'replied' localmente
        const updatedSubmitList = replyToMessage
          ? [newMsgObj, ...localMessages.map((m) => (m.id === replyToMessage.id ? { ...m, status: 'replied' as MessageStatus } : m))]
          : [newMsgObj, ...localMessages]
        setLocalMessages(updatedSubmitList)
        persistMessages(updatedSubmitList)

        setModalOpen(false)
        setReplyToMessage(null)
        setContent('')
        setSubject('')
        setSelectedTaskId('')
        setSelectedTechIds([])
        setPhotoFile(null)
        setPhotoPreview(null)
        router.refresh()
      }
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.')
    }
  }

  // Render do Badge de Estado
  const renderStatusBadge = (msg: InternalMessage) => {
    const st = msg.status || (msg.requiresResponse ? 'awaiting_reply' : 'info')
    switch (st) {
      case 'awaiting_reply':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-2xs">
            <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 animate-pulse" />
            <span>Aguarda Resposta</span>
          </span>
        )
      case 'replied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-sky-300 border border-blue-300 dark:border-blue-700">
            <Reply className="h-3 w-3 text-blue-600 dark:text-sky-400" />
            <span>Respondida</span>
          </span>
        )
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>Fechada</span>
          </span>
        )
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Info className="h-3 w-3 text-slate-500 dark:text-slate-400" />
            <span>Informativa</span>
          </span>
        )
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
              Comunicação em tempo real para equipa de manutenção com múltiplos estados e pedidos de resposta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={busy}
              className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Apagar todas as mensagens para reiniciar o histórico"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Limpar Mensagens</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-md text-sm font-bold cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Mensagem</span>
          </button>
        </div>
      </div>

      {/* Link / Botão Filtros */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border shadow-xs cursor-pointer ${
            filtersOpen || activeFiltersCount > 0
              ? 'bg-industrial-blue text-white border-industrial-blue'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
              filtersOpen || activeFiltersCount > 0 ? 'bg-white text-industrial-blue' : 'bg-industrial-blue text-white'
            }`}>
              {activeFiltersCount}
            </span>
          )}
          {filtersOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilter('all')
              setStatusFilter('all')
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

      {/* Painel Completo de Filtros (Apenas visível se o utilizador clicar em Filtros) */}
      {filtersOpen && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Filter className="h-4 w-4 text-industrial-blue dark:text-sky-400" />
              <span>Painel de Filtros Avançados</span>
            </span>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setFilter('all')
                  setStatusFilter('all')
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
                <span>Limpar</span>
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

          {/* 2. Estado da Mensagem */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Estado da Mensagem
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="all">⚡ Todos os Estados</option>
              <option value="awaiting_reply">⏳ Aguarda Resposta</option>
              <option value="replied">💬 Respondida</option>
              <option value="info">ℹ️ Informativa</option>
              <option value="closed">✅ Fechada</option>
            </select>
          </div>

          {/* 3. Pasta / Origem */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Pasta
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input text-xs font-bold w-full bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            >
              <option value="all">📥 Todas ({localMessages.length})</option>
              <option value="inbox">📬 Recebidas</option>
              <option value="sent">📤 Enviadas por mim</option>
            </select>
          </div>

          {/* 4. Filtro por Técnico */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Técnico / Remetente
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

          {/* 5. Associação a OT */}
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
              <option value="with_ot">⚙️ Apenas com OT</option>
              <option value="no_ot">💬 Sem OT</option>
            </select>
          </div>

          {/* 6. Fotos / Anexos */}
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
              <option value="with_photo">📷 Com Foto Anexa</option>
            </select>
          </div>

          {/* 7. Data Início */}
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

          {/* 8. Data Fim */}
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
      )}

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
            const isAwaitingReply = (msg.status === 'awaiting_reply' || msg.requiresResponse) && msg.status !== 'closed' && msg.status !== 'replied'

            return (
              <div
                key={msg.id}
                className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all shadow-xs space-y-2.5 ${
                  isAwaitingReply
                    ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/20 bg-amber-50/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600'
                }`}
              >
                {/* Header do Cartão */}
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => setSelectedMessage(msg)}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-industrial-blue dark:text-sky-400 font-black text-xs flex items-center justify-center border border-blue-200 dark:border-blue-700 shrink-0">
                      {msg.senderAbbr || 'RG'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                          {msg.senderName}
                        </span>
                        {isSentByMe && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-semibold">
                            Você
                          </span>
                        )}
                        {renderStatusBadge(msg)}
                      </div>
                      <span className="text-[11px] text-slate-500 truncate block">
                        Para: <strong className="text-slate-700 dark:text-slate-300">{msg.recipientNames || 'Técnicos'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                      {formatDateTime(msg.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenReply(msg)}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-industrial-blue dark:text-sky-300 text-xs font-bold rounded-lg border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Responder a esta mensagem no mesmo menu"
                    >
                      <Reply className="h-3 w-3" />
                      <span>Responder</span>
                    </button>
                    {isManager && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteMessage(msg.id)
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        title="Apagar Mensagem (Admin)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Bloco de Contexto se responde a outra mensagem */}
                {msg.replyToSender && (
                  <div className="text-[11px] bg-slate-50 dark:bg-slate-800/60 border-l-2 border-industrial-blue dark:border-sky-400 px-2.5 py-1 rounded-r text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Reply className="h-3 w-3 text-slate-400" />
                    <span>Em resposta a <strong>{msg.replyToSender}</strong>{msg.replyToSubject ? `: "${msg.replyToSubject}"` : ''}</span>
                  </div>
                )}

                {/* Assunto e Conteúdo */}
                <div onClick={() => setSelectedMessage(msg)} className="cursor-pointer space-y-1">
                  {msg.subject && (
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      {msg.subject}
                    </h4>
                  )}
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {msg.content}
                  </p>
                </div>

                {/* Footer do Cartão */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    {msg.taskTitle && (
                      <span className="inline-flex items-center gap-1 text-industrial-blue dark:text-sky-400 font-semibold bg-blue-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-slate-700">
                        <ClipboardList className="h-3 w-3" /> OT: {msg.taskTitle}
                      </span>
                    )}

                    {msg.photoUrl && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <ImageIcon className="h-3.5 w-3.5" /> Foto Anexa
                      </span>
                    )}
                  </div>

                  {/* Seletor Rápido de Estado Inline */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Estado:</span>
                    <select
                      value={msg.status || (msg.requiresResponse ? 'awaiting_reply' : 'info')}
                      disabled={statusUpdatingId === msg.id}
                      onChange={(e) => handleUpdateStatus(msg.id, e.target.value as MessageStatus)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-bold py-0.5 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="awaiting_reply">⏳ Aguarda Resposta</option>
                      <option value="replied">💬 Respondida</option>
                      <option value="info">ℹ️ Informativa</option>
                      <option value="closed">✅ Fechada</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal de Detalhe da Mensagem */}
      {selectedMessage && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-industrial-blue text-white font-black text-xs flex items-center justify-center">
                  {selectedMessage.senderAbbr || 'RG'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedMessage.senderName}
                    </h3>
                    {renderStatusBadge(selectedMessage)}
                  </div>
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

            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Para: <strong className="text-slate-800 dark:text-slate-200">{selectedMessage.recipientNames || 'Técnicos'}</strong>
              </div>

              {selectedMessage.replyToSender && (
                <div className="text-xs bg-slate-50 dark:bg-slate-800/80 border-l-3 border-industrial-blue p-2.5 rounded-r text-slate-600 dark:text-slate-300">
                  <span className="font-bold flex items-center gap-1 text-industrial-blue dark:text-sky-400">
                    <Reply className="h-3.5 w-3.5" /> Em resposta a {selectedMessage.replyToSender}:
                  </span>
                  {selectedMessage.replyToContent && (
                    <p className="mt-1 italic text-[11px] text-slate-500 dark:text-slate-400">
                      &quot;{selectedMessage.replyToContent}&quot;
                    </p>
                  )}
                </div>
              )}

              {selectedMessage.subject && (
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedMessage.subject}
                </div>
              )}

              <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {selectedMessage.content}
              </div>

              {selectedMessage.taskTitle && (
                <div className="text-xs bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-900 flex items-center gap-2 text-industrial-blue dark:text-sky-300 font-semibold">
                  <ClipboardList className="h-4 w-4" />
                  <span>Associada à OT: {selectedMessage.taskTitle}</span>
                </div>
              )}

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

              {/* Ações de Estado */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Alterar Estado da Mensagem:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedMessage.id, 'awaiting_reply')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border text-center ${
                      selectedMessage.status === 'awaiting_reply'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    ⏳ Aguarda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedMessage.id, 'replied')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border text-center ${
                      selectedMessage.status === 'replied'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-blue-700 dark:text-sky-400 border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    💬 Respondida
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedMessage.id, 'info')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border text-center ${
                      selectedMessage.status === 'info'
                        ? 'bg-slate-600 text-white border-slate-700 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    ℹ️ Info
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedMessage.id, 'closed')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border text-center ${
                      selectedMessage.status === 'closed'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    ✅ Fechada
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenReply(selectedMessage)}
                  className="btn-primary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Reply className="h-4 w-4" />
                  <span>Responder no Menu</span>
                </button>

                {isManager && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900 text-xs font-bold rounded-xl border border-red-200 dark:border-red-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Apagar Mensagem Permanentemente"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Apagar</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedMessage(null)}
                className="btn-secondary px-4 py-2 text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal UNIFICADO: Criar Nova Mensagem & Responder à Mensagem */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {replyToMessage ? (
                  <>
                    <Reply className="h-5 w-5 text-industrial-blue dark:text-sky-400" />
                    <span>Responder à Mensagem</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 text-industrial-blue dark:text-sky-400" />
                    <span>Nova Mensagem Interna</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Banner de Contexto da Mensagem a que se responde */}
            {replyToMessage && (
              <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-blue-800 dark:text-sky-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Reply className="h-3.5 w-3.5 text-industrial-blue dark:text-sky-400" />
                    <span>Contexto da Mensagem:</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{formatDateTime(replyToMessage.createdAt)}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 italic line-clamp-2">
                  &quot;{replyToMessage.content}&quot;
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seleção de Destinatários */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Destinatário(s) *
                  </label>
                  {!replyToMessage && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[11px] font-bold text-industrial-blue dark:text-sky-400 hover:underline"
                    >
                      {selectedTechIds.includes('ALL') ? 'Desmarcar Todos' : 'Enviar para Todos os Técnicos'}
                    </button>
                  )}
                </div>

                {replyToMessage ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-500 dark:text-slate-400">Destinatário:</span>
                      <span className="font-extrabold text-industrial-blue dark:text-sky-300">
                        {replyToMessage.senderAbbr ? `[${replyToMessage.senderAbbr}] ` : ''}{replyToMessage.senderName}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-sky-300 border border-blue-200 dark:border-blue-800">
                      Automático
                    </span>
                  </div>
                ) : (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300 cursor-pointer p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                      <input
                        type="checkbox"
                        checked={selectedTechIds.includes('ALL')}
                        onChange={handleSelectAll}
                        className="rounded accent-blue-600 h-4 w-4"
                      />
                      <span>📢 TODOS OS TÉCNICOS (Mensagem Geral)</span>
                    </label>

                    {!selectedTechIds.includes('ALL') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {activeTechs.map((u) => {
                          const checked = selectedTechIds.includes(u.id)
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-2 text-xs cursor-pointer p-1 rounded transition-colors ${
                                checked
                                  ? 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-sky-200 font-bold'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
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
                )}
              </div>

              {/* Tipo de Interação / Espera Resposta */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Estado & Resposta Requerida
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    requiresResponse
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="responseRequirement"
                      checked={requiresResponse}
                      onChange={() => {
                        setRequiresResponse(true)
                        setMessageStatus('awaiting_reply')
                      }}
                      className="accent-amber-600 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold block flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-amber-600" /> Aguarda Resposta
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Destinatários devem responder
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                    !requiresResponse
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="responseRequirement"
                      checked={!requiresResponse}
                      onChange={() => {
                        setRequiresResponse(false)
                        setMessageStatus(replyToMessage ? 'replied' : 'info')
                      }}
                      className="accent-slate-600 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-bold block flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-slate-500" /> Apenas Informativa
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Não necessita de resposta
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Assunto e OT associada (Ocultos se for resposta a mensagem) */}
              {!replyToMessage && (
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
              )}

              {/* Texto da mensagem */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Conteúdo da {replyToMessage ? 'Resposta' : 'Mensagem'} *
                </label>
                <textarea
                  rows={3}
                  placeholder={replyToMessage ? 'Escreva aqui a sua resposta...' : 'Escreva aqui a mensagem interna...'}
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
                    className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 font-bold cursor-pointer"
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
                  className="btn-secondary flex-1 py-2.5 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary flex-1 py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {replyToMessage ? <Reply className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                  <span>{busy ? 'A enviar...' : (replyToMessage ? 'Enviar Resposta' : 'Enviar Mensagem')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

