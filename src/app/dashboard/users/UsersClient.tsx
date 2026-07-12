'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, UserX, ShieldCheck, Wrench, X, Eye, EyeOff, Link2, Copy, Check, Camera } from 'lucide-react'
import type { User } from '@/types/models'
import { createUserDirectAction, deactivateUserAction, generateInviteAction, updateUserRateAction, updateUserByManagerAction } from './actions'
import Avatar from '@/components/ui/Avatar'
import { compressImage } from '@/lib/image'
import { uploadImage } from '@/lib/upload'
import { useLanguage } from '@/components/providers/LanguageProvider'

export default function UsersClient({
  users,
  currentUserId,
  isManager,
}: {
  users: User[]
  currentUserId: string
  isManager: boolean
}) {
  const router = useRouter()
  const { dict } = useLanguage()
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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    if (!original) return
    const file = await compressImage(original, 512)
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
    const fd = new FormData(e.currentTarget)
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
      {isManager && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#2E86C1]" />
              {dict.users.newUser}
            </h2>
            <button
              onClick={() => { showForm ? closeForm() : setShowForm(true) }}
              className="text-sm text-[#2E86C1] hover:underline"
            >
              {showForm ? dict.common.close : dict.users.newUser}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleAddUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Nome *</label>
                  <input name="name" className="input" placeholder="Nome completo" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">E-mail *</label>
                  <input name="email" type="email" className="input" placeholder="nome@empresa.pt" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Papel</label>
                  <select name="role" className="input">
                    <option value="technician">Técnico</option>
                    <option value="manager">Gestor</option>
                  </select>
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

      {/* Invite by link */}
      {isManager && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#2E86C1]" />
              Convidar por link
            </h2>
            <button
              onClick={() => { setShowInvite((v) => !v); setInviteUrl(''); setInviteError('') }}
              className="text-sm text-[#2E86C1] hover:underline"
            >
              {showInvite ? 'Fechar' : 'Gerar link de convite'}
            </button>
          </div>

          {showInvite && (
            <div className="space-y-3">
              {!inviteUrl ? (
                <form onSubmit={handleGenerateInvite} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">E-mail (opcional)</label>
                      <input name="email" type="email" className="input" placeholder="tecnico@empresa.pt" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Papel do convidado</label>
                      <select name="role" className="input">
                        <option value="technician">Técnico</option>
                        <option value="manager">Gestor</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={inviteBusy} className="btn-primary w-full">
                    {inviteBusy ? 'A gerar…' : 'Gerar link de convite'}
                  </button>
                </form>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-slate-400">Partilha este link com o técnico. Expira quando utilizado.</p>
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900/60 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-800">
                    <input
                      readOnly
                      value={inviteUrl}
                      className="flex-1 bg-transparent text-xs text-gray-700 dark:text-slate-300 outline-none truncate"
                    />
                    <button
                      onClick={handleCopy}
                      className="text-gray-400 hover:text-[#2E86C1] dark:hover:text-[#2E86C1] flex-shrink-0"
                      title="Copiar link"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-600 dark:text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => setInviteUrl('')}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Gerar outro
                  </button>
                </div>
              )}
              {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">{dict.users.colName}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400 hidden md:table-cell">E-mail</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">{dict.users.colRole}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">Estado</th>
              {isManager && <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-slate-400">{dict.users.colCost}</th>}
              {isManager && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
            {users.map((u) => (
              <tr 
                key={u.id} 
                onClick={() => { if (isManager) setEditingUser(u) }}
                className={`hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors ${isManager ? 'cursor-pointer' : ''} ${!u.active ? 'opacity-50' : ''}`}
              >
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
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.active ? 'text-green-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
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
                        setTempRate(u.hourlyRate?.toString() || '0')
                      }}>
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                          {u.hourlyRate ? `${u.hourlyRate}€` : '--'}
                        </span>
                        <span className="text-xs text-[#2E86C1] opacity-0 group-hover:opacity-100 transition-opacity">
                          Editar
                        </span>
                      </div>
                    )}
                  </td>
                )}
                {isManager && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {u.active && u.id !== currentUserId && (
                      <button
                        onClick={() => handleDeactivate(u.id, u.name)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                        title="Desativar utilizador"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-400 text-sm">
            Nenhum utilizador encontrado.
          </div>
        )}
      </div>

      {editingUser && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={closeEditModal} />
          <div className="card relative w-full max-w-md p-6 shadow-2xl">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Nome *</label>
                <input name="name" defaultValue={editingUser.name} className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">E-mail</label>
                <input type="email" name="email" defaultValue={editingUser.email} className="input" required />
                <p className="text-xs text-gray-400 mt-1">Alterar este e-mail altera as credenciais de login deste utilizador de forma imediata.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Papel</label>
                  <select name="role" defaultValue={editingUser.role} className="input" disabled={editingUser.id === currentUserId}>
                    <option value="technician">Técnico</option>
                    <option value="manager">Gestor</option>
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

              {editError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeEditModal} className="btn-secondary flex-1">
                  {dict.common.cancel}
                </button>
                <button type="submit" disabled={editBusy || uploadingAvatar} className="btn-primary flex-1">
                  {uploadingAvatar ? dict.common.loading : editBusy ? dict.common.loading : dict.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
