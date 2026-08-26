'use client'

import { useState, useTransition, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, UserX, ShieldCheck, Wrench, X, Eye, EyeOff, Link2, Copy, Check, Camera, Filter, KeyRound } from 'lucide-react'
import { DEFAULT_TECHNICIAN_TYPES, type User, type ExternalCompany } from '@/types/models'
import { createUserDirectAction, deactivateUserAction, deleteUserAction, deleteExternalCompanyAction, generateInviteAction, updateUserRateAction, updateUserByManagerAction, updateTechnicianTypesAction, toggleUserActiveAction, resetUserPasswordAction } from './actions'
import Avatar from '@/components/ui/Avatar'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import { useLanguage } from '@/components/providers/LanguageProvider'
import { useTableSort, SortableTh } from '@/lib/useTableSort'
import { Building2, Phone, Mail, MapPin, FileText, UserPlus as UserPlusIcon, ExternalLink, Briefcase, Pencil, Trash2 } from 'lucide-react'

export default function UsersClient({
  users,
  currentUserId,
  isManager,
  technicianTypes = DEFAULT_TECHNICIAN_TYPES,
  externalCompanies = [],
}: {
  users: User[]
  currentUserId: string
  isManager: boolean
  technicianTypes?: string[]
  externalCompanies?: ExternalCompany[]
}) {
  const router = useRouter()
  const { dict } = useLanguage()
  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal')
  const [selectedCompany, setSelectedCompany] = useState<ExternalCompany | null>(null)
  const [isExternalNew, setIsExternalNew] = useState(false)
  const [isExternalEdit, setIsExternalEdit] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied] = useState(false)
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [tempRate, setTempRate] = useState<string>('')
  
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Avatar para novo utilizador
  const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null)
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null)
  const newFileRef = useRef<HTMLInputElement>(null)

  // Gestão de tipos de técnico
  const [showTypesModal, setShowTypesModal] = useState(false)
  const [typesList, setTypesList] = useState<string[]>(technicianTypes)
  const [newTypeName, setNewTypeName] = useState('')
  const [savingTypes, setSavingTypes] = useState(false)

  // Filtros por Colunas
  const [searchName, setSearchName] = useState('')
  const [searchAbbr, setSearchAbbr] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | 'manager' | 'technician'>('all')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')
  const [pageSize, setPageSize] = useState<number>(20)
  const [currentPage, setCurrentPage] = useState<number>(1)

  useEffect(() => { setCurrentPage(1) }, [searchName, searchAbbr, filterRole, filterSpecialty, filterActive, pageSize])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (activeTab === 'internal' && u.isExternal) return false
      if (activeTab === 'external' && !u.isExternal) return false
      if (filterActive === 'active' && !u.active) return false
      if (filterActive === 'inactive' && u.active) return false
      const roleStr = String(u.role || '').toLowerCase().trim()
      const isTechUser = roleStr === 'technician' || roleStr === 'tecnico' || roleStr === 'técnico' || roleStr === 'tech'
      if (filterRole === 'technician' && !isTechUser) return false
      if (filterRole === 'manager' && isTechUser) return false
      if (filterSpecialty !== 'all' && (u.specialty || '') !== filterSpecialty) return false
      if (searchAbbr.trim() && !(u.abbreviation || '').toLowerCase().includes(searchAbbr.toLowerCase().trim())) return false
      if (searchName.trim()) {
        const q = searchName.toLowerCase().trim()
        const haystack = `${u.name || ''} ${u.email || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [users, activeTab, filterActive, filterRole, filterSpecialty, searchAbbr, searchName])

  const { sorted: sortedUsers, sortKey, sortDir, toggleSort } = useTableSort<User>(
    filteredUsers,
    {
      name: (u) => u.name?.toLowerCase(),
      abbreviation: (u) => u.abbreviation?.toLowerCase() || '',
      email: (u) => u.email?.toLowerCase(),
      role: (u) => u.role,
      active: (u) => (u.active ? 1 : 0),
      hourlyRate: (u) => u.hourlyRate ?? 0,
    },
    null,
  )

  const effectivePageSize = pageSize === -1 ? (sortedUsers.length || 1) : pageSize
  const totalPages = Math.ceil(sortedUsers.length / effectivePageSize) || 1
  const currentUsers = useMemo(() => {
    if (pageSize === -1) return sortedUsers
    const start = (currentPage - 1) * pageSize
    return sortedUsers.slice(start, start + pageSize)
  }, [sortedUsers, currentPage, pageSize])

  async function handleNewAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original, 400, 0.70)
    setNewAvatarFile(file)
    setNewAvatarPreview(URL.createObjectURL(file))
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original, 400, 0.70)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function closeEditModal() {
    setEditingUser(null)
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  async function handleEditUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingUser) return
    setEditBusy(true)
    setEditError('')
    
    let avatarUrl: string | null = null
    let avatarFailed = false

    if (avatarFile) {
      setUploadingAvatar(true)
      try {
        avatarUrl = await uploadImage(avatarFile, 'avatars')
      } catch {
        avatarFailed = true
      } finally {
        setUploadingAvatar(false)
      }
    }

    const fd = new FormData(e.currentTarget)
    if (avatarUrl) fd.set('avatarUrl', avatarUrl)

    const result = await updateUserByManagerAction(editingUser.id, fd)
    setEditBusy(false)
    if (result.error) {
      setEditError(result.error)
    } else if (avatarFailed) {
      setEditError('Dados guardados, mas falha ao carregar a fotografia.')
      setAvatarFile(null)
      router.refresh()
    } else {
      closeEditModal()
      router.refresh()
    }
  }

  function closeForm() {
    setShowForm(false)
    setError('')
    setSuccess(false)
    setNewAvatarFile(null)
    setNewAvatarPreview(null)
  }

  async function handleGenerateInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setInviteBusy(true)
    setInviteError('')
    const fd = new FormData(e.currentTarget)
    const result = await generateInviteAction({}, fd)
    setInviteBusy(false)
    if (result.error) { setInviteError(result.error); return }
    if (result.inviteUrl) setInviteUrl(result.inviteUrl)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    
    let avatarUrl: string | null = null
    if (newAvatarFile) {
      try {
        avatarUrl = await uploadImage(newAvatarFile, 'avatars')
      } catch {
        console.error('Erro ao carregar foto do técnico')
      }
    }

    const fd = new FormData(e.currentTarget)
    if (avatarUrl) fd.set('avatarUrl', avatarUrl)

    const result = await createUserDirectAction({}, fd)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      ;(e.currentTarget as HTMLFormElement).reset()
      router.refresh()
      setTimeout(() => { setSuccess(false); closeForm() }, 1500)
    }
  }

  function handleAddType() {
    const val = newTypeName.trim()
    if (!val || typesList.includes(val)) return
    setTypesList([...typesList, val])
    setNewTypeName('')
  }

  function handleRemoveType(typeToRemove: string) {
    setTypesList(typesList.filter(t => t !== typeToRemove))
  }

  async function handleSaveTypes() {
    setSavingTypes(true)
    await updateTechnicianTypesAction(typesList)
    setSavingTypes(false)
    setShowTypesModal(false)
    router.refresh()
  }

  function handleDeactivate(userId: string, name: string) {
    if (!confirm(`Desativar a conta de ${name}? O utilizador perderá acesso à plataforma.`)) return
    startTransition(async () => {
      await deactivateUserAction(userId)
      router.refresh()
    })
  }

  async function handleSaveRate(userId: string) {
    if (!tempRate || isNaN(Number(tempRate))) {
      setEditingRateId(null)
      return
    }
    startTransition(async () => {
      await updateUserRateAction(userId, Number(tempRate))
      setEditingRateId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Navegação entre Técnicos Internos vs Prestadores Externos */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => setActiveTab('internal')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'internal'
              ? 'bg-[#2E86C1] text-white shadow-sm'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200'
          }`}
        >
          <Wrench className="h-4 w-4" />
          Utilizadores & Técnicos Internos ({users.filter((u) => !u.isExternal).length})
        </button>
        <button
          onClick={() => setActiveTab('external')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'external'
              ? 'bg-[#2E86C1] text-white shadow-sm'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Empresas & Técnicos Externos ({externalCompanies.length})
        </button>
      </div>

      {activeTab === 'external' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="h-6 w-6 text-[#2E86C1]" /> Empresas Prestadoras de Serviços & Subempreiteiros
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Consulta as empresas contratadas e a lista de técnicos associados a cada empresa externa.
              </p>
            </div>
            {isManager && (
              <button
                onClick={() => {
                  setShowForm(true)
                  setIsExternalNew(true)
                  setActiveTab('internal')
                }}
                className="btn-primary flex items-center gap-1.5 text-xs font-bold"
              >
                <UserPlusIcon className="h-4 w-4" /> Adicionar Técnico Externo
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {externalCompanies.map((comp) => {
              const compTechs = users.filter((u) => u.isExternal && (u.externalCompanyId === comp.id || (u.externalCompanyName || '').toLowerCase().includes(comp.name.toLowerCase())))
              return (
                <div key={comp.id} className="card p-5 hover:shadow-md transition-shadow border-l-4 border-l-[#2E86C1]">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 mb-1">
                        {comp.specialty || 'Prestador de Serviços'}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{comp.name}</h3>
                      {comp.nif && <p className="text-xs font-mono text-gray-500 dark:text-slate-400">NIF: {comp.nif}</p>}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                      {compTechs.length} técnico(s)
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300 mb-4">
                    {comp.contactPerson && (
                      <p className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-800 dark:text-slate-200">Contacto:</span> {comp.contactPerson}
                      </p>
                    )}
                    {comp.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-800 dark:text-slate-200">Telefone:</span> {comp.phone}
                      </p>
                    )}
                    {comp.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-800 dark:text-slate-200">E-mail:</span> {comp.email}
                      </p>
                    )}
                    {comp.address && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-800 dark:text-slate-200">Morada:</span> {comp.address}
                      </p>
                    )}
                  </div>

                  {/* Lista sumária de técnicos da empresa */}
                  <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-lg border border-gray-200 dark:border-slate-700 mb-4">
                    <p className="text-[11px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Técnicos Registados nesta Empresa:
                    </p>
                    {compTechs.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nenhum técnico associado especificamente.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {compTechs.map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-1.5 rounded border border-gray-100 dark:border-slate-800">
                            <span className="font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1">
                              <span className="font-mono text-[10px] bg-gray-100 dark:bg-slate-800 px-1 rounded">{t.abbreviation || 'EXT'}</span>
                              {t.name}
                            </span>
                            <span className="text-gray-500 text-[10px]">{t.specialty || t.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedCompany(comp)}
                    className="w-full bg-[#1B4F72] hover:bg-[#154360] text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0 text-white" />
                    <span>📂 Abrir Ficha Completa da Empresa & Técnicos</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
      {isManager && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#2E86C1]" />
              {dict.users.newUser}
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTypesModal(true)}
                className="text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-[#2E86C1] dark:hover:text-[#2E86C1] flex items-center gap-1 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Wrench className="h-3.5 w-3.5" /> Gerir Tipos de Técnico
              </button>
              <button
                onClick={() => { showForm ? closeForm() : setShowForm(true) }}
                className="text-sm font-semibold text-[#2E86C1] hover:underline"
              >
                {showForm ? dict.common.close : dict.users.newUser}
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleAddUser} className="space-y-3">
              {/* Foto do Utilizador / Técnico */}
              <div className="flex flex-col items-center justify-center mb-3 pt-1">
                <div className="relative cursor-pointer" onClick={() => newFileRef.current?.click()}>
                  {newAvatarPreview ? (
                    <Image
                      src={newAvatarPreview}
                      alt="Novo utilizador"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover border-2 border-[#2E86C1]"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-[#2E86C1] transition-colors">
                      <Camera className="h-6 w-6 text-gray-400 dark:text-slate-500" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#2E86C1] text-white shadow-sm flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <input
                    ref={newFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleNewAvatarChange}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {newAvatarFile ? 'Fotografia selecionada' : 'Adicionar fotografia de perfil (opcional)'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Nome *</label>
                  <input name="name" className="input" placeholder="Nome completo" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Abreviatura (3 dígitos)</label>
                  <input name="abbreviation" className="input font-mono uppercase font-bold" placeholder="Ex: LM" maxLength={6} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">E-mail *</label>
                <input name="email" type="email" className="input" placeholder="nome@empresa.pt" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Papel *</label>
                  <select name="role" className="input">
                    <option value="technician">Técnico</option>
                    <option value="manager">Gestor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Especialidade / Tipo de Técnico</label>
                  <select name="specialty" className="input">
                    <option value="">— Sem especialidade —</option>
                    {typesList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Opção Técnico Externo / Prestador de Serviço */}
              <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isExternal"
                    checked={isExternalNew}
                    onChange={(e) => setIsExternalNew(e.target.checked)}
                    className="rounded border-gray-300 text-[#2E86C1]"
                  />
                  Técnico Externo / Prestador de Serviço Contratado
                </label>
                {isExternalNew && (
                  <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-gray-600 dark:text-slate-400 mb-1 font-medium">Empresa Prestadora de Serviços</label>
                      <select name="externalCompanyId" className="input text-xs">
                        <option value="">— Selecionar Empresa —</option>
                        {externalCompanies.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-600 dark:text-slate-400 mb-1 font-medium">Telefone Directo / Contacto</label>
                      <input name="phone" className="input text-xs" placeholder="Ex: 912 345 678" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password temporária *</label>
                <div className="relative">
                  <input
                    name="tempPassword"
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-9"
                    placeholder="Mín. 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  Utilizador criado com sucesso.
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm} className="btn-secondary flex items-center gap-1.5">
                  <X className="h-4 w-4" /> Cancelar
                </button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {busy ? 'A criar…' : 'Criar utilizador'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}



      {/* Barra Superior de Contagem e Filtros Rápidos */}
      <div className="flex items-center justify-between gap-3 mb-3 px-1 flex-wrap">
        <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 flex items-center gap-2">
          <Filter size={14} className="text-[#2E86C1]" />
          <span>A mostrar <strong>{sortedUsers.length}</strong> de <strong>{users.length}</strong> utilizadores</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span>Por página:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="input !py-1 !px-2 text-xs w-auto"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={-1}>Todos ({users.length})</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs min-w-[1000px] table-fixed">
            <thead>
              {/* Linha 1: Cabeçalhos com Ordenação */}
              <tr className="bg-slate-100/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <SortableTh label="Cód." sortableKey="abbreviation" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-center w-[70px]" />
                <SortableTh label={dict.users.colName} sortableKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[200px]" />
                <SortableTh label="E-mail" sortableKey="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[180px]" />
                <SortableTh label={dict.users.colRole} sortableKey="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[140px]" />
                <SortableTh label="Estado" sortableKey="active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[90px]" />
                {isManager && <SortableTh label={dict.users.colCost} sortableKey="hourlyRate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[80px]" />}
                {isManager && <th className="px-4 py-3 text-right w-[240px]">AÇÕES</th>}
              </tr>

              {/* Linha 2: Filtros por Colunas */}
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="text"
                    value={searchAbbr}
                    onChange={(e) => setSearchAbbr(e.target.value)}
                    placeholder="Cód..."
                    className="input !text-xs !py-1 !px-2 w-16 text-center font-mono uppercase"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Filtrar nome..."
                    className="input !text-xs !py-1 !px-2 w-full"
                  />
                </td>
                <td className="px-2 py-1.5 hidden md:table-cell">
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Filtrar email..."
                    className="input !text-xs !py-1 !px-2 w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex gap-1 flex-wrap">
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value as any)}
                      className="input !text-xs !py-1 !px-1.5 w-24"
                    >
                      <option value="all">Todos papéis</option>
                      <option value="manager">Gestor</option>
                      <option value="technician">Técnico</option>
                    </select>
                    <select
                      value={filterSpecialty}
                      onChange={(e) => setFilterSpecialty(e.target.value)}
                      className="input !text-xs !py-1 !px-1.5 flex-1 min-w-[100px]"
                    >
                      <option value="all">Todas especialidades</option>
                      {typesList.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={filterActive}
                    onChange={(e) => setFilterActive(e.target.value as any)}
                    className="input !text-xs !py-1 !px-1.5 w-28"
                  >
                    <option value="all">Todos estados</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </td>
                {isManager && <td className="px-2 py-1.5" />}
                {isManager && <td className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 7 : 5} className="px-4 py-8 text-center text-gray-400">
                    <Filter className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold">Nenhum utilizador encontrado com estes filtros.</p>
                  </td>
                </tr>
              ) : (
                currentUsers.map((u) => (
                  <tr 
                    key={u.id} 
                    onClick={() => { if (isManager) setEditingUser(u) }}
                    className={`hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors ${isManager ? 'cursor-pointer' : ''} ${!u.active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                        {u.abbreviation || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} avatarUrl={u.avatarUrl} size={24} />
                        <span>
                          {u.name}
                          {u.id === currentUserId && (
                            <span className="ml-2 text-xs text-gray-400">(tu)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 hidden md:table-cell">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.role === 'manager'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {u.role === 'manager'
                            ? <><ShieldCheck className="h-3 w-3" /> Gestor</>
                            : <><Wrench className="h-3 w-3" /> Técnico</>
                          }
                        </span>
                        {u.specialty && (
                          <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                            {u.specialty}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {isManager && u.id !== currentUserId ? (
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(async () => {
                              const res = await toggleUserActiveAction(u.id, !u.active)
                              if (res?.error) alert(res.error)
                              else router.refresh()
                            })
                          }}
                          disabled={isPending}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all shadow-sm ${
                            u.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                          title="Clique para alternar entre Ativo e Inativo"
                        >
                          {u.active ? '✓ Ativo' : '✕ Inativo'}
                        </button>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      )}
                    </td>
                    {isManager && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {editingRateId === u.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input !py-1 !px-2 w-20 text-sm"
                              value={tempRate}
                              onChange={(e) => setTempRate(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRate(u.id)
                                if (e.key === 'Escape') setEditingRateId(null)
                              }}
                            />
                            <button onClick={() => handleSaveRate(u.id)} disabled={isPending} className="text-green-600 hover:text-green-700">
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                            setEditingRateId(u.id)
                            setTempRate(String(u.hourlyRate ?? ''))
                          }}>
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {u.hourlyRate != null && u.hourlyRate > 0 ? `${u.hourlyRate} €/h` : '—'}
                            </span>
                          </div>
                        )}
                      </td>
                    )}
                    {isManager && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={async () => {
                              const pwdPrompt = window.prompt(`Definir nova password para ${u.name} (mínimo 6 caracteres) ou clique em OK para gerar automática:`)
                              if (pwdPrompt === null) return
                              const res = await resetUserPasswordAction(u.id, pwdPrompt || undefined)
                              if (res.error) {
                                alert(`Erro: ${res.error}`)
                              } else {
                                alert(`Password de ${u.name} reposta com sucesso!\n\nNova Password Provisória: ${res.tempPassword}\n\n(O utilizador terá de alterar a password na primeira utilização)`)
                                router.refresh()
                              }
                            }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 rounded text-xs font-bold transition-all flex items-center gap-1"
                            title="Repor password do utilizador (exige alteração no primeiro login)"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Repor Pass
                          </button>
                          <button
                            onClick={() => setEditingUser(u)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold transition-all flex items-center gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              onClick={() => {
                                if (confirm(`Tem a certeza que deseja eliminar o utilizador ${u.name}?`)) {
                                  startTransition(async () => {
                                    const res = await deleteUserAction(u.id, false)
                                    if (res?.hasHistory || res?.error === 'HAS_HISTORY') {
                                      if (confirm(`O técnico "${u.name}" já possui histórico de intervenções/tarefas registadas.\n\nDeseja eliminar definitivamente a conta deste utilizador do sistema?`)) {
                                        const forceRes = await deleteUserAction(u.id, true)
                                        if (forceRes?.error) alert(forceRes.error)
                                        else router.refresh()
                                      }
                                    } else if (res?.error) {
                                      alert(res.error)
                                    } else {
                                      router.refresh()
                                    }
                                  })
                                }
                              }}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold transition-all flex items-center gap-1"
                              title="Eliminar permanentemente este utilizador"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

        </>
      )}

      {/* Modal Editar Utilizador */}
      {editingUser && isManager && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeEditModal} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">{dict.users.modalEdit}</h2>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="flex flex-col items-center justify-center mb-4">
                <div className="relative">
                  {avatarPreview || editingUser.avatarUrl ? (
                    <Image
                      src={avatarPreview || editingUser.avatarUrl!}
                      alt={editingUser.name}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover border-2 border-gray-100 dark:border-slate-700"
                    />
                  ) : (
                    <Avatar name={editingUser.name} size={64} />
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-gray-500 dark:text-slate-400 hover:text-[#2E86C1] dark:hover:text-blue-400 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                {avatarFile && <span className="text-[10px] text-blue-500 mt-1">Nova foto selecionada</span>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Nome *</label>
                  <input name="name" defaultValue={editingUser.name} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Abreviatura</label>
                  <input name="abbreviation" defaultValue={editingUser.abbreviation || ''} className="input font-mono uppercase font-bold" maxLength={6} placeholder="Ex: LM" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">E-mail</label>
                <input type="email" name="email" defaultValue={editingUser.email} className="input" required />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Papel</label>
                  <select name="role" defaultValue={editingUser.role} className="input" disabled={editingUser.id === currentUserId}>
                    <option value="technician">Técnico</option>
                    <option value="manager">Gestor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Estado</label>
                  <select name="active" defaultValue={editingUser.active ? 'true' : 'false'} className="input font-bold" disabled={editingUser.id === currentUserId}>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Língua</label>
                  <select name="language" defaultValue={editingUser.language || 'pt'} className="input">
                    <option value="pt">Português</option>
                    <option value="en">Inglês</option>
                    <option value="es">Espanhol</option>
                    <option value="fr">Francês</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Especialidade / Tipo de Técnico</label>
                <select name="specialty" defaultValue={editingUser.specialty || ''} className="input">
                  <option value="">— Sem especialidade —</option>
                  {typesList.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Vínculo Técnico Externo no Edit */}
              <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2 text-xs">
                <label className="flex items-center gap-2 font-bold text-gray-800 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isExternal"
                    defaultChecked={editingUser.isExternal || false}
                    className="rounded border-gray-300 text-[#2E86C1]"
                  />
                  Técnico Externo / Prestador de Serviço Contratado
                </label>
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-600 dark:text-slate-400 mb-1 font-medium">Empresa Prestadora de Serviços</label>
                    <select name="externalCompanyId" defaultValue={editingUser.externalCompanyId || ''} className="input text-xs">
                      <option value="">— Selecionar Empresa —</option>
                      {externalCompanies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-slate-400 mb-1 font-medium">Telefone Directo / Contacto</label>
                    <input name="phone" defaultValue={editingUser.phone || ''} className="input text-xs" placeholder="Ex: 912 345 678" />
                  </div>
                </div>
              </div>

              {editError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                {editingUser.id !== currentUserId && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Tem a certeza que deseja eliminar definitivamente o utilizador ${editingUser.name}?`)) return
                      setEditBusy(true)
                      const res = await deleteUserAction(editingUser.id)
                      setEditBusy(false)
                      if (res.error) {
                        setEditError(res.error)
                      } else {
                        closeEditModal()
                        router.refresh()
                      }
                    }}
                    disabled={editBusy}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button type="button" onClick={closeEditModal} className="btn-secondary text-xs px-4 py-1.5 font-bold">
                    {dict.common.cancel}
                  </button>
                  <button type="submit" disabled={editBusy || uploadingAvatar} className="btn-primary text-xs px-5 py-1.5 font-bold">
                    {uploadingAvatar ? dict.common.loading : editBusy ? dict.common.loading : dict.common.save}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerir Tipos de Técnico */}
      {showTypesModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowTypesModal(false)} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-[#2E86C1]" /> Tipos de Técnico / Especialidades
              </h2>
              <button onClick={() => setShowTypesModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Gerir especialidades disponíveis para selecionar no perfil dos técnicos (ex: Mecânico, Eletricista, HVAC).
            </p>

            <div className="flex gap-2">
              <input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ex: Frigorista, Instrumentista…"
                className="input flex-1 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddType() } }}
              />
              <button type="button" onClick={handleAddType} className="btn-primary shrink-0 text-xs px-3">
                Adicionar
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pt-2">
              {typesList.map((t) => (
                <div key={t} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-sm font-medium">
                  <span className="text-gray-800 dark:text-slate-200">{t}</span>
                  <button
                    onClick={() => handleRemoveType(t)}
                    className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                    title="Remover tipo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {typesList.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum tipo configurado.</p>
              )}
            </div>

            <div className="flex gap-3 pt-3">
              <button type="button" onClick={() => setShowTypesModal(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveTypes} disabled={savingTypes} className="btn-primary flex-1">
                {savingTypes ? 'A guardar…' : 'Guardar Tipos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ficha Completa da Empresa Prestadora de Serviços & Técnicos */}
      {selectedCompany && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCompany(null)} />
          <div className="card relative w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900 mb-1">
                  Ficha da Empresa Prestadora de Serviços
                </span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-[#2E86C1]" />
                  {selectedCompany.name}
                </h2>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Informação Geral da Empresa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
              <div>
                <p className="text-gray-500 font-medium mb-1">Especialidade / Ramo:</p>
                <p className="font-bold text-gray-900 dark:text-slate-100">{selectedCompany.specialty || 'Serviços Gerais'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">NIF:</p>
                <p className="font-mono font-bold text-gray-900 dark:text-slate-100">{selectedCompany.nif || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Pessoa de Contacto:</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{selectedCompany.contactPerson || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Telefone Directo:</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{selectedCompany.phone || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">E-mail Oficial:</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{selectedCompany.email || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Sede / Morada:</p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">{selectedCompany.address || '—'}</p>
              </div>
              {selectedCompany.notes && (
                <div className="col-span-full pt-2 border-t border-gray-200 dark:border-slate-700">
                  <p className="text-gray-500 font-medium mb-1">Observações & Âmbito do Contrato:</p>
                  <p className="text-gray-800 dark:text-slate-200 italic">{selectedCompany.notes}</p>
                </div>
              )}
            </div>

            {/* Técnicos Pertencentes a esta Empresa */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-[#2E86C1]" />
                  Técnicos Associados a esta Empresa
                </h3>
                <span className="text-xs text-gray-500 font-semibold">
                  Total: {users.filter((u) => u.isExternal && (u.externalCompanyId === selectedCompany.id || (u.externalCompanyName || '').toLowerCase().includes(selectedCompany.name.toLowerCase()))).length} técnico(s)
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users
                  .filter((u) => u.isExternal && (u.externalCompanyId === selectedCompany.id || (u.externalCompanyName || '').toLowerCase().includes(selectedCompany.name.toLowerCase())))
                  .map((tech) => (
                    <div key={tech.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm text-xs">
                      <div className="flex items-center gap-3">
                        <Avatar name={tech.name} avatarUrl={tech.avatarUrl} size={36} />
                        <div>
                          <p className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span className="font-mono bg-blue-100 text-blue-900 text-[10px] px-1.5 py-0.5 rounded font-extrabold">{tech.abbreviation || 'EXT'}</span>
                            {tech.name}
                          </p>
                          <p className="text-gray-500 text-[11px]">{tech.email} {tech.phone ? `· Tel: ${tech.phone}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                            {tech.specialty || 'Técnico Externo'}
                          </span>
                          {tech.hourlyRate != null && tech.hourlyRate > 0 && (
                            <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 mt-0.5">{tech.hourlyRate.toFixed(2)}€ / hora</p>
                          )}
                        </div>
                        {isManager && (
                          <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-slate-800 pl-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCompany(null)
                                setEditingUser(tech)
                              }}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar Perfil do Técnico"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Tem a certeza que deseja eliminar definitivamente o técnico ${tech.name}?`)) {
                                  startTransition(async () => {
                                    const res = await deleteUserAction(tech.id)
                                    if (res?.error) alert(res.error)
                                    setSelectedCompany(null)
                                    router.refresh()
                                  })
                                }
                              }}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Eliminar Técnico"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                {users.filter((u) => u.isExternal && (u.externalCompanyId === selectedCompany.id || (u.externalCompanyName || '').toLowerCase().includes(selectedCompany.name.toLowerCase()))).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
                    Nenhum técnico individual registado ainda para a empresa {selectedCompany.name}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-200 dark:border-slate-800">
              {isManager && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const compTechs = users.filter((u) => u.isExternal && (u.externalCompanyId === selectedCompany.id || (u.externalCompanyName || '').toLowerCase().includes(selectedCompany.name.toLowerCase())))
                      if (compTechs.length > 0) {
                        setEditingUser(compTechs[0])
                        setSelectedCompany(null)
                      } else {
                        setShowForm(true)
                        setIsExternalNew(true)
                        setActiveTab('internal')
                        setSelectedCompany(null)
                      }
                    }}
                    className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 font-bold"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-600" /> Editar Dados da Empresa / Técnico
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(`Tem a certeza que deseja eliminar a empresa prestadora de serviços ${selectedCompany.name}?`)) {
                        startTransition(async () => {
                          const res = await deleteExternalCompanyAction(selectedCompany.id)
                          if (res?.error) alert(res.error)
                          setSelectedCompany(null)
                          router.refresh()
                        })
                      }
                    }}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar Empresa
                  </button>
                </div>
              )}
              <button onClick={() => setSelectedCompany(null)} className="btn-primary text-xs px-5 ml-auto">
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
